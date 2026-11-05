import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, type Env, type CreateAppOptions } from '../src/index';
import { MemoryAdminStore } from '../src/admin/store';
import { hasPermission } from '../src/admin/rbac';

const BOT_TOKEN = '123456:ael-admin-test-token';
const BOOTSTRAP_TOKEN = 'ael-bootstrap-token-0123456789abcdef0123';

async function hmacHex(key: string | ArrayBuffer, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildInitData(userId: number, authDate = Math.floor(Date.now() / 1000)): Promise<string> {
  const params = new URLSearchParams();
  params.set('query_id', 'AAH-admin-query');
  params.set('auth_date', String(authDate));
  params.set('user', JSON.stringify({ id: userId, first_name: 'Admin', username: `admin${userId}` }));
  const dataCheckString = [...params.entries()]
    .filter(([k]) => k !== 'hash' && k !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const secretSig = await crypto.subtle.sign('HMAC', secretKey, new TextEncoder().encode(BOT_TOKEN));
  params.set('hash', await hmacHex(secretSig, dataCheckString));
  return params.toString();
}

function buildEnv(): Env {
  return {
    ENVIRONMENT: 'test',
    SESSION_SECRET: 'test-session-secret-0123456789',
    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    ADMIN_API_TOKEN: BOOTSTRAP_TOKEN,
  };
}

function buildOptions(adminStore: MemoryAdminStore): CreateAppOptions {
  return { store: { /* DataStore fakes below are not touched by admin routes */ } as never, adminStore };
}

describe('AEL-201 — Admin Bootstrap و نشست', () => {
  let adminStore: MemoryAdminStore;

  beforeEach(() => {
    adminStore = new MemoryAdminStore();
  });

  it('bootstrap بدون توکن 401 می‌دهد', async () => {
    const app = createApp(buildEnv(), buildOptions(adminStore));
    const res = await app.request('/api/admin/bootstrap', { method: 'POST', body: JSON.stringify({ initData: 'x' }) });
    expect(res.status).toBe(401);
  });

  it('bootstrap اولین OWNER می‌سازد و دوباره را رد می‌کند (ADR-007)', async () => {
    const app = createApp(buildEnv(), buildOptions(adminStore));
    const initData = await buildInitData(111);
    const first = await app.request('/api/admin/bootstrap', {
      method: 'POST',
      headers: { Authorization: `Bearer ${BOOTSTRAP_TOKEN}` },
      body: JSON.stringify({ initData }),
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, role: 'OWNER' });
    expect(await adminStore.countActiveOwnerAdmins()).toBe(1);

    const second = await app.request('/api/admin/bootstrap', {
      method: 'POST',
      headers: { Authorization: `Bearer ${BOOTSTRAP_TOKEN}` },
      body: JSON.stringify({ initData: await buildInitData(222) }),
    });
    expect(second.status).toBe(403);
  });

  it('نشست بدون نقش یا برای کاربر غیرمجاز رد می‌شود', async () => {
    const app = createApp(buildEnv(), buildOptions(adminStore));
    const res = await app.request('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ initData: await buildInitData(999) }),
    });
    expect(res.status).toBe(403);
  });

  it('initData جعلی رد می‌شود', async () => {
    const app = createApp(buildEnv(), buildOptions(adminStore));
    const res = await app.request('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ initData: 'auth_date=1&hash=deadbeef' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('AEL-202 — RBAC سمت سرور (Default Deny + SoD)', () => {
  let adminStore: MemoryAdminStore;
  let app: ReturnType<typeof createApp>;
  let ownerToken: string;
  let reviewerToken: string;

  beforeEach(async () => {
    adminStore = new MemoryAdminStore();
    app = createApp(buildEnv(), buildOptions(adminStore));
    const bootstrap = await (await app.request('/api/admin/bootstrap', {
      method: 'POST',
      headers: { Authorization: `Bearer ${BOOTSTRAP_TOKEN}` },
      body: JSON.stringify({ initData: await buildInitData(111) }),
    })).json() as { user: { id: string } };

    const ownerSession = await (await app.request('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ initData: await buildInitData(111) }),
    })).json() as { token: string };
    ownerToken = ownerSession.token;

    // بازبین علمی بدون مجوز مدیریتی — توسط OWNER ساخته می‌شود
    const reviewer = await adminStore.upsertAdminUser({ telegramUserId: 333, username: null, displayName: 'Reviewer' });
    await adminStore.grantRole(reviewer.id, 'ACADEMIC_REVIEWER', null, bootstrap.user.id);
    const reviewerSession = await (await app.request('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ initData: await buildInitData(333) }),
    })).json() as { token: string };
    reviewerToken = reviewerSession.token;
  });

  it('/me نقش و مجوزها را می‌دهد', async () => {
    const res = await app.request('/api/admin/me', { headers: { Authorization: `Bearer ${ownerToken}` } });
    expect(res.status).toBe(200);
    const data = await res.json() as { permissions: string[] };
    expect(data.permissions).toContain('user:manage');
    expect(data.permissions).toContain('release:publish');
  });

  it('بازبین علمی مجوز user:manage ندارد → 403 (Default Deny)', async () => {
    const res = await app.request('/api/admin/users', { headers: { Authorization: `Bearer ${reviewerToken}` } });
    expect(res.status).toBe(403);
  });

  it('بازبین علمی می‌تواند مسیر مجاز خودش را ببیند', async () => {
    const res = await app.request('/api/admin/me', { headers: { Authorization: `Bearer ${reviewerToken}` } });
    const data = await res.json() as { permissions: string[] };
    expect(data.permissions).toEqual(['registry:read', 'review:scientific:approve']);
  });

  it('Owner می‌تواند نقش بدهد و Audit ثبت می‌شود (AT-AEL-13 مسیر مدیریتی)', async () => {
    const target = await adminStore.upsertAdminUser({ telegramUserId: 444, username: null, displayName: 'New' });
    const res = await app.request(`/api/admin/users/${target.id}/roles`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ role: 'PUBLISHER' }),
    });
    expect(res.status).toBe(200);
    const audit = await adminStore.listAdminAudit(10);
    expect(audit.some(event => event.action === 'admin.role.grant')).toBe(true);
  });

  it('نقش ناشناخته رد می‌شود', async () => {
    const target = await adminStore.upsertAdminUser({ telegramUserId: 445, username: null, displayName: 'New2' });
    const res = await app.request(`/api/admin/users/${target.id}/roles`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ role: 'GODMODE' }),
    });
    expect(res.status).toBe(400);
  });

  it('audit فقط با مجوز audit:read خوانده می‌شود', async () => {
    const denied = await app.request('/api/admin/audit', { headers: { Authorization: `Bearer ${reviewerToken}` } });
    expect(denied.status).toBe(403);
    const allowed = await app.request('/api/admin/audit', { headers: { Authorization: `Bearer ${ownerToken}` } });
    expect(allowed.status).toBe(200);
    const data = await allowed.json() as { events: unknown[] };
    expect(data.events.length).toBeGreaterThan(0);
  });

  it('logout نشست را باطل می‌کند', async () => {
    await app.request('/api/admin/logout', { method: 'POST', headers: { Authorization: `Bearer ${ownerToken}` } });
    const res = await app.request('/api/admin/me', { headers: { Authorization: `Bearer ${ownerToken}` } });
    expect(res.status).toBe(401);
  });
});

describe('AEL-204 — Registry API از پنل', () => {
  let adminStore: MemoryAdminStore;
  let app: ReturnType<typeof createApp>;
  let ownerToken: string;

  beforeEach(async () => {
    adminStore = new MemoryAdminStore();
    app = createApp(buildEnv(), buildOptions(adminStore));
    await app.request('/api/admin/bootstrap', {
      method: 'POST',
      headers: { Authorization: `Bearer ${BOOTSTRAP_TOKEN}` },
      body: JSON.stringify({ initData: await buildInitData(111) }),
    });
    ownerToken = ((await (await app.request('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ initData: await buildInitData(111) }),
    })).json()) as { token: string }).token;
  });

  it('رکورد معتبر ذخیره می‌شود و قابل خواندن است', async () => {
    const res = await app.request('/api/admin/registry/institutions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify([{ code: 'inst-1', name: 'دانشگاه آزمایشی', kind: 'university', status: 'active' }]),
    });
    expect(res.status).toBe(200);
    const read = await (await app.request('/api/admin/registry/institutions', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })).json() as { rows: Array<{ code: string }> };
    expect(read.rows.map(row => row.code)).toContain('inst-1');
  });

  it('رکورد نامعتبر 422 می‌دهد و ذخیره نمی‌شود', async () => {
    const res = await app.request('/api/admin/registry/institutions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify([{ code: 'bad code!', name: 'x' }]),
    });
    expect(res.status).toBe(422);
    const read = await (await app.request('/api/admin/registry/institutions', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })).json() as { rows: unknown[] };
    expect(read.rows).toHaveLength(0);
  });

  it('موجودیت خارج از فهرست‌سفید 400 می‌دهد', async () => {
    const res = await app.request('/api/admin/registry/app_users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify([{ id: 'x' }]),
    });
    expect(res.status).toBe(400);
  });
});

describe('rbac — pure helpers', () => {
  it('hasPermission با Default Deny کار می‌کند', () => {
    expect(hasPermission([{ roleCode: 'PUBLISHER', scope: null }], 'release:publish')).toBe(true);
    expect(hasPermission([{ roleCode: 'PUBLISHER', scope: null }], 'review:rights:approve')).toBe(false);
    expect(hasPermission([{ roleCode: 'UNKNOWN_ROLE', scope: null }], 'release:publish')).toBe(false);
    expect(hasPermission([], 'course:create')).toBe(false);
  });
});
