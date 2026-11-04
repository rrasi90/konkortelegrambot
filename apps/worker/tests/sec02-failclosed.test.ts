import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, resetRateLimitsForTesting } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';
import { issueSessionToken, verifyTelegramInitData } from '../src/auth.ts';
import { hmacSha256Hex } from '../src/auth.ts';
import pack from '../../../content/examples/demo-pack.json';

/**
 * SEC-02 — بستن مسیرهای پرریسک یافت‌شده در ممیزی فقط‌خواندنی (۵ نوامبر ۲۰۲۶):
 * fail-closed پیش‌فرض، رد auth_date آینده، محدودسازی CORS و جداسازی دسترسی بین‌کاربران (AT-28).
 */

const PROD_SECRET = 'production-super-secret-key-32chars';
const SUPABASE = {
  SUPABASE_URL: 'https://test.supabase.co',
  // مقدار جای‌نگهدار آزمون — هیچ secret واقعی در مخزن نیست.
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-placeholder-service-key',
};

describe('SEC-02 — fail-closed پیش‌فرض محیط', () => {
  it('محیط نامشخص + پرچم دمو: createApp پرتاب می‌کند (این پیکربندی ران‌بوک ۲۰۲۶-۱۱-۰۳ بود)', () => {
    expect(() => {
      createApp({ SESSION_SECRET: PROD_SECRET, ALLOW_DEMO_AUTH: 'true', ...SUPABASE });
    }).toThrow(/ALLOW_DEMO_AUTH must not be enabled/);
  });

  it('محیط نامشخص + secret پیش‌فرض و بدون دیتابیس پایدار: پرتاب می‌شود', () => {
    expect(() => {
      createApp({ SESSION_SECRET: 'dev-secret' });
    }).toThrow(/In-memory store fallback is prohibited|SECURITY VIOLATION/);
  });

  it('مقدار ناشناختهٔ ENVIRONMENT (مثل staging) هم سخت‌گیرانه تفسیر می‌شود', () => {
    expect(() => {
      createApp({ ENVIRONMENT: 'staging', SESSION_SECRET: PROD_SECRET, ALLOW_DEMO_AUTH: 'true', ...SUPABASE });
    }).toThrow(/ALLOW_DEMO_AUTH must not be enabled/);
  });

  it('محیط اعلان‌شدهٔ development با دمو باز است و بدون دمو بسته', async () => {
    const store = new MemoryStore();
    store.nodes = pack.nodes.map((n) => ({ ...n })) as typeof store.nodes;
    store.dependencies = pack.dependencies.map((d) => ({ ...d })) as typeof store.dependencies;
    store.questions = pack.questions.map((q) => ({ ...q })) as typeof store.questions;
    const open = createApp({ ENVIRONMENT: 'development', SESSION_SECRET: 'dev-secret', ALLOW_DEMO_AUTH: 'true' }, { store });
    const ok = await open.request('/api/auth/demo', { method: 'POST', body: JSON.stringify({}) });
    expect(ok.status).toBe(200);

    const closed = createApp({ ENVIRONMENT: 'development', SESSION_SECRET: 'dev-secret' }, { store });
    const denied = await closed.request('/api/auth/demo', { method: 'POST', body: JSON.stringify({}) });
    expect(denied.status).toBe(403);
  });
});

describe('SEC-02 — auth_date آینده رد می‌شود', () => {
  function makeInitData(authDate: number): string {
    const user = JSON.stringify({ id: 12345, first_name: 'Test' });
    const params = new URLSearchParams({ auth_date: String(authDate), user, query_id: 'AAA' });
    return params.toString();
  }
  async function sign(initData: string): Promise<string> {
    const entries = [...new URLSearchParams(initData).entries()]
      .filter(([k]) => k !== 'hash' && k !== 'signature')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const botToken = 'test-bot-token';
    const secretKey = await crypto.subtle.importKey('raw', new TextEncoder().encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', secretKey, new TextEncoder().encode(botToken));
    return hmacSha256Hex(sig, entries);
  }

  it('auth_date یک ساعت در آینده با امضای درست رد می‌شود', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const initData = makeInitData(future);
    const hash = await sign(initData);
    const result = await verifyTelegramInitData(`${initData}&hash=${hash}`, 'test-bot-token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('auth_date stale');
  });

  it('auth_date تازهٔ گذشته همچنان پذیرفته می‌شود', async () => {
    const recent = Math.floor(Date.now() / 1000) - 30;
    const initData = makeInitData(recent);
    const hash = await sign(initData);
    const result = await verifyTelegramInitData(`${initData}&hash=${hash}`, 'test-bot-token');
    expect(result.ok).toBe(true);
  });
});

describe('SEC-02 — CORS محدود به فهرست سفید', () => {
  it('مبدأ ناشناس هدر Access-Control-Allow-Origin نمی‌گیرد؛ مبدأ اعلامی می‌گیرد', async () => {
    const store = new MemoryStore();
    const app = createApp(
      { ENVIRONMENT: 'development', SESSION_SECRET: 'dev-secret', APP_URL: 'https://app.example.org' },
      { store },
    );
    const foreign = await app.request('/api/health', {
      headers: { Origin: 'https://evil.example.net' },
    });
    expect(foreign.headers.get('Access-Control-Allow-Origin')).toBeNull();

    const declared = await app.request('/api/health', {
      headers: { Origin: 'https://app.example.org' },
    });
    expect(declared.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.org');
  });
});

describe('SEC-02 — AT-28: دسترسی بین‌کاربران رد می‌شود', () => {
  let store: MemoryStore;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    resetRateLimitsForTesting();
    store = new MemoryStore();
    store.nodes = pack.nodes.map((n) => ({ ...n })) as typeof store.nodes;
    store.dependencies = pack.dependencies.map((d) => ({ ...d })) as typeof store.dependencies;
    store.questions = pack.questions.map((q) => ({ ...q })) as typeof store.questions;
    app = createApp({ ENVIRONMENT: 'development', SESSION_SECRET: 'test-secret', ALLOW_DEMO_AUTH: 'true' }, { store });
  });

  async function login(name: string): Promise<string> {
    const res = await app.request('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name }),
    });
    return ((await res.json()) as { token: string }).token;
  }

  function authed(token: string, init: RequestInit = {}): RequestInit {
    return {
      ...init,
      headers: { ...((init.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
  }

  it('جلسهٔ شبیه‌سازی کاربر الف برای کاربر ب ۴۰۴ است و محتوایی افشا نمی‌شود', async () => {
    const tokenA = await login('الف');
    const tokenB = await login('ب');
    const started = await app.request('/api/exam-simulation/start', authed(tokenA, {
      method: 'POST',
      body: JSON.stringify({ level: 'doctorate', examYear: 1405, subGroupId: 'business' }),
    }));
    const startBody = (await started.json()) as { session?: { id?: string } };
    const sessionId = startBody.session?.id;
    expect(sessionId).toBeTruthy();

    const foreign = await app.request(`/api/exam-simulation/${sessionId}`, authed(tokenB));
    expect(foreign.status).toBe(404);
    const body = JSON.stringify(await foreign.json());
    expect(body).not.toContain('items');
    expect(body).not.toContain('questionNumber');
  });

  it('توکن دست‌کاری‌شدهٔ کاربر الف برای کاربر ب سؤال برنمی‌گرداند', async () => {
    const tokenA = await login('الف');
    const forged = `${tokenA}x`;
    const res = await app.request('/api/queue?limit=2', authed(forged));
    expect(res.status).toBe(401);
  });
});
