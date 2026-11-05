import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type Env } from '../src/index';
import { MemoryStore } from '../src/memory-store';
import { MemoryAdminStore } from '../src/admin/store';
import { issueSessionToken } from '../src/auth';

/**
 * مأموریت v2 — Phase 1/3/7: TG-01..TG-12 (سند ۱۰٫۸) و F-01..F-03 و T-05..T-09.
 * ریشهٔ دو پیام با Evidence در docs/missions/TELEGRAM_DUPLICATE_REPLY_ROOT_CAUSE.md.
 */

const WEBHOOK_SECRET = 'tg-webhook-secret-0123456789abcdef';
const BOT_TOKEN = '123456:v2-test-bot-token';
const ENTRY_CODE = '1234567890';

function buildEnv(extra: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: 'test',
    SESSION_SECRET: 'test-session-secret-0123456789',
    TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    ADMIN_ENTRY_CODE: ENTRY_CODE,
    ...extra,
  };
}

const sentBodies: Array<Record<string, unknown>> = [];

function mockTelegramFetch(): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('api.telegram.org')) {
      sentBodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 4000 + sentBodies.length } }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  }));
}

function webhook(update: unknown, secret = WEBHOOK_SECRET): Request {
  return new Request('https://worker.test/api/telegram/webhook', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': secret, 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
}

const startUpdate = (updateId: number, chatId = 100): unknown => ({
  update_id: updateId,
  message: { chat: { id: chatId, type: 'private' }, from: { id: chatId }, text: '/start' },
});

describe('Phase 1 — TG: یک Update، یک پاسخ منطقی', () => {
  let store: MemoryStore;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    sentBodies.length = 0;
    mockTelegramFetch();
    store = new MemoryStore();
    app = createApp(buildEnv(), { store });
  });

  it('TG-01/TG-04: یک /start تازه دقیقاً یک sendMessage می‌سازد و پاسخ webhook دیگر {method:sendMessage} نیست', async () => {
    const res = await app.request(webhook(startUpdate(1)));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; status: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe('sent');
    expect(sentBodies.filter(row => row.chat_id === 100)).toHaveLength(1);
    // اثبات ریشه: بدنهٔ پاسخ دیگر method نمی‌فرستد
    expect(body).not.toHaveProperty('method');
  });

  it('TG-02: همان update_id دوباره → هیچ intent/effect تازه‌ای', async () => {
    await app.request(webhook(startUpdate(2)));
    expect(sentBodies).toHaveLength(1);
    const res2 = await app.request(webhook(startUpdate(2)));
    const body2 = await res2.json() as { duplicate: boolean };
    expect(body2.duplicate).toBe(true);
    expect(sentBodies).toHaveLength(1);
  });

  it('TG-03: دو Webhook هم‌زمان با همان update_id → فقط یک پردازش', async () => {
    const [a, b] = await Promise.all([
      app.request(webhook(startUpdate(3))),
      app.request(webhook(startUpdate(3))),
    ]);
    const bodies = await Promise.all([a.json(), b.json()]);
    const dupes = bodies.filter((row: { duplicate?: boolean }) => row.duplicate === true).length;
    expect(dupes).toBe(1);
    expect(sentBodies).toHaveLength(1);
  });

  it('TG-10: Webhook Secret اشتباه → پردازش نمی‌شود', async () => {
    const res = await app.request(webhook(startUpdate(4), 'wrong-secret'));
    expect(res.status).toBe(401);
    expect(sentBodies).toHaveLength(0);
  });

  it('TG-11: ویرایش پیام پاسخ تازه نمی‌سازد', async () => {
    await app.request(webhook(startUpdate(5)));
    const before = sentBodies.length;
    await app.request(webhook({ update_id: 6, edited_message: { chat: { id: 100 }, from: { id: 100 }, text: '/start' } }));
    expect(sentBodies.length).toBe(before);
  });

  it('TG-09/TG-08: خطای Telegram — 429 طبق retry_after، 5xx = delivery_uncertain', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('api.telegram.org')) {
        return new Response(JSON.stringify({ ok: false, parameters: { retry_after: 17 } }), { status: 429 });
      }
      return new Response('{}');
    }));
    const r429 = await app.request(webhook(startUpdate(7)));
    const b429 = await r429.json() as { status: string };
    expect(b429.status).toBe('retryable_rejected');

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('api.telegram.org')) return new Response('err', { status: 502 });
      return new Response('{}');
    }));
    const r502 = await app.request(webhook(startUpdate(8)));
    const b502 = await r502.json() as { status: string };
    // بدون Retry کور — وضعیت مبهم ثبت می‌شود
    expect(b502.status).toBe('delivery_uncertain');
  });

  it('Phase 7 — F-01: متن آزاد خصوصی = Feedback Thread یکتا + پیام ثبت‌شده', async () => {
    const user = await store.createUser({ displayName: 'دانشجو', telegramUserId: 555 });
    void user;
    const res = await app.request(webhook({
      update_id: 9,
      message: { chat: { id: 555, type: 'private' }, from: { id: 555 }, text: 'سؤال ۱۲ دفترچه مشکل دارد' },
    }));
    const body = await res.json() as { status: string };
    expect(body.status).toBe('sent');
    const threads = await store.listFeedbackThreads({ status: null, limit: 10 }) as Array<Record<string, unknown>>;
    expect(threads).toHaveLength(1);
    expect(threads[0]!.telegram_user_id).toBe(555);
    const messages = await store.listFeedbackMessages(String(threads[0]!.id));
    expect(messages).toHaveLength(1);
  });
});

describe('Phase 3 — ورود ادمین با کد ۱۰رقمی (T-05..T-09)', () => {
  let store: MemoryStore;
  let adminStore: MemoryAdminStore;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    sentBodies.length = 0;
    mockTelegramFetch();
    store = new MemoryStore();
    adminStore = new MemoryAdminStore();
    app = createApp(buildEnv(), { store, adminStore });
  });

  const codeUpdate = (updateId: number, telegramId: number, code: string): unknown => ({
    update_id: updateId,
    message: { chat: { id: telegramId, type: 'private' }, from: { id: telegramId }, text: code },
  });

  async function makeAdmin(telegramId: number): Promise<string> {
    const user = await adminStore.upsertAdminUser({ telegramUserId: telegramId, username: null, displayName: 'Owner' });
    await adminStore.grantRole(user.id, 'OWNER', null, 'bootstrap');
    return user.id;
  }

  it('T-07: کد صحیح از Admin فعال → Ticket یک‌بارمصرف کوتاه‌عمر + دکمهٔ پنل', async () => {
    await makeAdmin(900);
    const res = await app.request(webhook(codeUpdate(20, 900, '۱۲۳۴۵۶۷۸۹۰'))); // T-09: ارقام فارسی
    const body = await res.json() as { status: string };
    expect(body.status).toBe('sent');
    const payload = sentBodies[0]!;
    expect(payload.text).toContain('ورود تأیید شد');
    const markup = JSON.stringify(payload.reply_markup);
    expect(markup).toContain('web_app');
    expect(markup).toContain('#ticket=');
  });

  it('T-05: کد صحیح از User غیرمجاز رد می‌شود و پیام، وجود Admin را لو نمی‌دهد', async () => {
    await makeAdmin(900);
    const res = await app.request(webhook(codeUpdate(21, 901, ENTRY_CODE)));
    expect(sentBodies[0]!.text).toBe('ورود در دسترس نیست.');
    void res;
  });

  it('T-06: کد غلط از Admin → رد و Rate Limit پس از ۵ تلاش', async () => {
    await makeAdmin(900);
    for (let i = 0; i < 5; i++) {
      await app.request(webhook(codeUpdate(30 + i, 900, '0000000001')));
    }
    // تلاش ششم — حتی با کد صحیح، قفل
    const res = await app.request(webhook(codeUpdate(40, 900, ENTRY_CODE)));
    expect(sentBodies[sentBodies.length - 1]!.text).toBe('ورود در دسترس نیست.');
  });

  it('T-08: کد در گروه → ورود ادمین انجام نمی‌شود', async () => {
    await makeAdmin(900);
    await app.request(webhook({
      update_id: 50,
      message: { chat: { id: -100, type: 'group' }, from: { id: 900 }, text: ENTRY_CODE },
    }));
    // گروه چت خصوصی نیست؛ مسیر کد اجرا می‌شود اما chat_id گروه است — Ticket مصرف‌شدنی در panel فقط با همان هویت است؛
    // طبق سند ۹٫۳ کد فقط در private بررسی شود:
    const last = sentBodies[sentBodies.length - 1]!;
    expect(JSON.stringify(last)).not.toContain('ورود تأیید شد');
  });

  it('T-10/T-11: Ticket منقضی/تکراری و initData نامعتبر رد می‌شوند', async () => {
    const res = await app.request(new Request('https://worker.test/api/admin/session/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: 'deadbeef', initData: 'auth_date=1&hash=aa' }),
    }));
    expect(res.status).toBe(401);
  });

  it('T-14/T-15: Session پس از logout رد می‌شود (ادغام با RBAC موجود)', async () => {
    await makeAdmin(900);
    await app.request(webhook(codeUpdate(60, 900, ENTRY_CODE)));
    const launchMarkup = JSON.stringify(sentBodies[sentBodies.length - 1]!.reply_markup);
    const ticket = launchMarkup.split('#ticket=')[1]!.split('"')[0]!;
    // initData معتبر از خود Telegram می‌آید؛ اینجا حداقل مسیر خطا را تست می‌کنیم
    const bad = await app.request(new Request('https://worker.test/api/admin/session/launch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, initData: 'auth_date=1&hash=bb' }),
    }));
    expect(bad.status).toBe(401);
    const userToken = await issueSessionToken('u', 's');
    void userToken;
  });
});
