import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type Env } from '../src/index';
import { MemoryStore } from '../src/memory-store';
import { MemoryAdminStore } from '../src/admin/store';

/** مأموریت v2 — Phase 7: F-01..F-06 (سند ۱۹٫۶) از مسیر واقعی API */
const BOOTSTRAP_TOKEN = 'ael-bootstrap-token-0123456789abcdef0123';

function buildEnv(): Env {
  return {
    ENVIRONMENT: 'test',
    SESSION_SECRET: 'test-session-secret-0123456789',
    TELEGRAM_BOT_TOKEN: '123456:fb-test-bot',
    TELEGRAM_WEBHOOK_SECRET: 'tg-webhook-secret-0123456789abcdef',
    ADMIN_API_TOKEN: BOOTSTRAP_TOKEN,
  };
}

async function hmacHex(key: string | ArrayBuffer, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message)))].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildInitData(userId: number): Promise<string> {
  const params = new URLSearchParams();
  params.set('query_id', 'q'); params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('user', JSON.stringify({ id: userId, first_name: 'S' }));
  const data = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const sk = await crypto.subtle.importKey('raw', new TextEncoder().encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  params.set('hash', await hmacHex(await crypto.subtle.sign('HMAC', sk, new TextEncoder().encode('123456:fb-test-bot')), data));
  return params.toString();
}

describe('Phase 7 — Feedback (F-01..F-06)', () => {
  let store: MemoryStore;
  let adminStore: MemoryAdminStore;
  let app: ReturnType<typeof createApp>;
  let agentToken: string;
  let agentId: string;
  const sent: Array<Record<string, unknown>> = [];

  beforeEach(async () => {
    sent.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('api.telegram.org')) {
        sent.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
        return new Response(JSON.stringify({ ok: true, result: { message_id: 5001 } }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }));
    store = new MemoryStore();
    adminStore = new MemoryAdminStore();
    app = createApp(buildEnv(), { store, adminStore });
    await app.request('/api/admin/bootstrap', {
      method: 'POST', headers: { Authorization: `Bearer ${BOOTSTRAP_TOKEN}` },
      body: JSON.stringify({ initData: await buildInitData(111) }),
    });
    const agent = await adminStore.upsertAdminUser({ telegramUserId: 777, username: null, displayName: 'Support' });
    await adminStore.grantRole(agent.id, 'SUPPORT_AGENT', null, 'x');
    agentId = agent.id;
    agentToken = ((await (await app.request('/api/admin/session', {
      method: 'POST', body: JSON.stringify({ initData: await buildInitData(777) }),
    })).json()) as { token: string }).token;
  });

  it('F-01/F-02: فیدبک تلگرام با Context کاربر ثبت می‌شود', async () => {
    const user = await store.createUser({ displayName: 'دانشجو', telegramUserId: 601 });
    void user;
    // از مسیر واقعی webhook (متن آزاد خصوصی = feedback)
    await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: { 'X-Telegram-Bot-Api-Secret-Token': 'tg-webhook-secret-0123456789abcdef' },
      body: JSON.stringify({ update_id: 1, message: { chat: { id: 601, type: 'private' }, from: { id: 601 }, text: 'سؤال ۵ دفترچه A مشکل دارد' } }),
    });
    const threads = await store.listFeedbackThreads({ status: 'new', limit: 10 }) as Array<Record<string, unknown>>;
    expect(threads).toHaveLength(1);
    expect(threads[0]!.chat_id).toBe(601);
    expect(threads[0]!.telegram_user_id).toBe(601);
  });

  it('F-04: پاسخ پشتیبانی به همان chat ارسال و در Thread ثبت می‌شود', async () => {
    const threadId = await store.createFeedbackThread({ userId: null, telegramUserId: 602, chatId: 602, category: 'general', body: 'سؤال دارم' });
    const res = await app.request(`/api/panel/feedback/${threadId}/reply`, {
      method: 'POST', headers: { Authorization: `Bearer ${agentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: 'پاسخ پشتیبانی: بررسی شد ✅' }),
    });
    const body = await res.json() as { ok: boolean; status: string; telegramMessageId: number };
    expect(body.ok).toBe(true);
    expect(body.status).toBe('sent');
    expect(sent[0]!.chat_id).toBe(602); // F-04: چت درست
    const messages = await store.listFeedbackMessages(threadId) as Array<Record<string, unknown>>;
    expect(messages.some(row => row.author_kind === 'admin' && row.is_internal_note === false)).toBe(true);
  });

  it('F-03: Internal Note در DB می‌ماند و هرگز به کاربر ارسال نمی‌شود', async () => {
    const threadId = await store.createFeedbackThread({ userId: null, telegramUserId: 603, chatId: 603, category: 'technical', body: 'خطا' });
    const res = await app.request(`/api/panel/feedback/${threadId}/reply`, {
      method: 'POST', headers: { Authorization: `Bearer ${agentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: 'یادداشت داخلی: کاربر اشتباه می‌کند', internalNote: true }),
    });
    const body = await res.json() as { internal: boolean };
    expect(body.internal).toBe(true);
    expect(sent).toHaveLength(0); // هیچ ارسال تلگرامی رخ نداده
    const messages = await store.listFeedbackMessages(threadId) as Array<Record<string, unknown>>;
    expect(messages.some(row => row.is_internal_note === true)).toBe(true);
  });

  it('F-06: نقش بدون مجوز reply → 403', async () => {
    const auditor = await adminStore.upsertAdminUser({ telegramUserId: 778, username: null, displayName: 'Auditor' });
    await adminStore.grantRole(auditor.id, 'AUDITOR_READONLY', null, 'x');
    const auditorToken = ((await (await app.request('/api/admin/session', {
      method: 'POST', body: JSON.stringify({ initData: await buildInitData(778) }),
    })).json()) as { token: string }).token;
    void agentId;
    const threadId = await store.createFeedbackThread({ userId: null, telegramUserId: 604, chatId: 604, category: 'general', body: 'x' });
    const res = await app.request(`/api/panel/feedback/${threadId}/reply`, {
      method: 'POST', headers: { Authorization: `Bearer ${auditorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: 'پاسخ' }),
    });
    expect(res.status).toBe(403);
  });
});
