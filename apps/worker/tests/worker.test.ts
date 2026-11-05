import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, resetRateLimitsForTesting } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';
import pack from '../../../content/examples/demo-pack.json';
import type { ReviewCard } from '@ael/contracts';

const ENV = {
  ENVIRONMENT: 'development',
  SESSION_SECRET: 'test-secret',
  ALLOW_DEMO_AUTH: 'true',
  TELEGRAM_WEBHOOK_SECRET: 'test_telegram_webhook_secret_2026_secure',
  ADMIN_API_TOKEN: 'test-admin-api-token-with-at-least-32-characters-2026',
};

let store: MemoryStore;
let app: ReturnType<typeof createApp>;

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  // شمارندهٔ مشترک سطح isolate: هر تست از صفر شروع کند
  resetRateLimitsForTesting();
  store = new MemoryStore();
  store.nodes = pack.nodes.map((n) => ({ ...n })) as typeof store.nodes;
  store.dependencies = pack.dependencies.map((d) => ({ ...d })) as typeof store.dependencies;
  store.questions = pack.questions.map((q) => ({ ...q })) as typeof store.questions;
  app = createApp(ENV, { store });
});

async function login(): Promise<string> {
  const res = await app.request('/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'داوطلب تست' }),
  });
  const body = (await res.json()) as { token: string };
  return body.token;
}

function authed(token: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...((init.headers as Record<string, string>) ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

async function json(res: Response): Promise<any> {
  return res.json();
}

describe('worker API — حلقهٔ کامل یادگیری', () => {
  it('کارت با ROI بالاتر حتی وقتی بعد از ۵۰ موعد قدیمی‌تر قرار می‌گیرد انتخاب می‌شود', async () => {
    const token = await login();
    const me = await json(await app.request('/api/me', authed(token)));
    const userId = me.user.id as string;

    const lowerPriorityQuestion = store.questions.find((q) => q.nodeId === 'sm.rbv');
    const higherPriorityQuestion = store.questions.find((q) => q.nodeId === 'sm.value_chain');
    expect(lowerPriorityQuestion).toBeTruthy();
    expect(higherPriorityQuestion).toBeTruthy();

    await store.upsertMastery(userId, [
      { nodeId: 'sm.rbv', mastery: 95, status: 'mastered' },
    ]);

    const now = Date.now();
    const lowPriorityCards: ReviewCard[] = Array.from({ length: 50 }, (_, index) => ({
      id: `queue-low-priority-${index}`,
      userId,
      nodeId: 'sm.rbv',
      cardType: 'question',
      questionId: lowerPriorityQuestion!.id,
      dueAt: new Date(now - 60_000).toISOString(),
      intervalDays: 365,
      ease: 2.5,
      isRepair: false,
      timesSeen: 5,
      timesCorrect: 5,
    }));
    const highPriorityCard: ReviewCard = {
      id: 'queue-high-priority-51st',
      userId,
      nodeId: 'sm.value_chain',
      cardType: 'question',
      questionId: higherPriorityQuestion!.id,
      dueAt: new Date(now - 30_000).toISOString(),
      intervalDays: 1,
      ease: 2.5,
      isRepair: false,
      timesSeen: 0,
      timesCorrect: 0,
    };
    await store.upsertCards([...lowPriorityCards, highPriorityCard]);

    const response = await app.request('/api/queue?limit=1', authed(token));
    expect(response.status).toBe(200);
    const queue = await json(response);

    expect(queue.items).toHaveLength(1);
    expect(queue.items[0].card.id).toBe(highPriorityCard.id);
    expect(queue.items[0].question.id).toBe(higherPriorityQuestion!.id);
  });
  it('سلامت سیستم', async () => {
    const app = createApp(ENV);
    const res = await app.request('/api/health');
    expect((await json(res)).ok).toBe(true);
  });

  it('ورود دمو، دریافت صف و پاسخ غلط با موج چهارلایه', async () => {
    const token = await login();
    expect(token).toBeTruthy();

    // انتخاب گرایش تکنولوژی
    const trackRes = await app.request(
      '/api/tracks',
      authed(token, { method: 'PUT', body: JSON.stringify({ tracks: ['technology'] }) }),
    );
    expect(trackRes.status).toBe(200);

    // صف امروز
    const queueRes = await app.request('/api/queue?limit=5', authed(token));
    expect(queueRes.status).toBe(200);
    const queue = await json(queueRes);
    expect(queue.items.length).toBeGreaterThan(0);
    // کلید صحیح نباید به کلاینت نشت کند
    for (const item of queue.items) {
      if (item.question) { expect(item.question.correctOption).toBeUndefined(); expect(item.question.explanation).toBeUndefined(); expect(item.question.trapNote).toBeUndefined(); }
    }

    // پیدا کردن سؤال sm.value_chain (که هم پیش‌نیاز و هم دو پل بین‌درسی دارد)
    const target = queue.items.find((i: any) => i.card.nodeId === 'sm.value_chain');
    expect(target).toBeTruthy();

    // پاسخ غلط (بلیت تلاش از خود صف می‌آید)
    const answerRes = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: target.attemptId, questionId: target.question.id, selectedOption: 3 }),
      }),
    );
    expect(answerRes.status).toBe(200);
    const { report } = await json(answerRes);
    expect(report.wasCorrect).toBe(false);
    expect(report.directReset).toBe(true);
    expect(report.trapCardCreated).toBe(true);
    // لایهٔ ۲: تسلط از ۵۰ به ۳۷.۵
    expect(report.topicMastery.before).toBe(50);
    expect(report.topicMastery.after).toBe(37.5);
    // لایهٔ ۴: پل به ظرفیت جذب (تکنولوژی فعال) و دارایی برند (غیرفعال → نباید باشد)
    const bridgeNodes = report.crossCourseBridges.map((b: any) => b.nodeId);
    expect(bridgeNodes).toContain('tech.absorptive');
    expect(bridgeNodes).not.toContain('mkt.brand');
    // لایه‌های ۳/۴: بدون کسر فوری — پیشنهاد بررسی تشخیصی
    expect(report.probeTargets).toContain('tech.absorptive');
    expect(report.mentorMessage).toContain('شاهد اولیه');

    // idempotency: همان attemptId همان نتیجه را برمی‌گرداند
    const replayRes = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: target.attemptId, questionId: target.question.id, selectedOption: 3 }),
      }),
    );
    const replay = await json(replayRes);
    expect(replay.replay).toBe(true);

    // نقشهٔ تسلط پس از خطا
    const mapRes = await app.request('/api/map', authed(token));
    const map = await json(mapRes);
    const allNodes = map.courses.flatMap((c: any) => c.chapters.flatMap((ch: any) => ch.nodes));
    const vc = allNodes.find((n: any) => n.id === 'sm.value_chain');
    const ac = allNodes.find((n: any) => n.id === 'tech.absorptive');
    expect(vc.mastery).toBe(37.5);
    expect(ac.mastery).toBeNull(); // سنجیده‌نشده — بدون کسر فوری بین‌درسی و بدون عدد نمایشی
    expect(ac.status).toBe('unseen');
    // مبحث بازرگانی نباید در نقشه باشد
    const brand = allNodes.find((n: any) => n.id === 'mkt.brand');
    expect(brand).toBeUndefined();
  });

  it('پاسخ درست رشد می‌دهد و کارت ترمیمی را ترمیم می‌کند', async () => {
    const token = await login();
    const queueRes = await app.request('/api/queue?limit=3', authed(token));
    const queue = await json(queueRes);
    const item = queue.items[0];
    const q = store.questions.find((x) => x.id === item.question.id)!;

    await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: item.attemptId, questionId: q.id, selectedOption: q.correctOption }),
      }),
    );
    const mapRes = await app.request('/api/map', authed(token));
    const map = await json(mapRes);
    const allNodes = map.courses.flatMap((c: any) => c.chapters.flatMap((ch: any) => ch.nodes));
    const node = allNodes.find((n: any) => n.id === item.card.nodeId);
    expect(node.mastery).toBe(57.5);
  });

  it('بدون توکن، دسترسی‌ها رد می‌شوند', async () => {
    const app = createApp(ENV);
    for (const path of ['/api/queue', '/api/map']) {
      const res = await app.request(path);
      expect(res.status).toBe(401);
    }
  });

  it('توکن جعلی رد می‌شود', async () => {
    const app = createApp(ENV);
    const res = await app.request('/api/queue', {
      headers: { Authorization: 'Bearer user-1.deadbeef' },
    });
    expect(res.status).toBe(401);
  });

  it('ورود تکراری با یک نام کاربری، همان حساب را برمی‌گرداند (نه حساب جدید)', async () => {
    const login = async (username: string) => {
      const res = await app.request('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUsername: username }),
      });
      expect(res.status).toBe(200);
      return (await json(res)) as { user: { id: string } };
    };
    const first = await login('@Ali_Reza');
    const second = await login('ali_reza');
    expect(second.user.id).toBe(first.user.id);
    expect(store.users.size).toBe(1);
  });

  it('ورود با نام کاربری بدون امضای تلگرام در محیط واقعی بسته است', async () => {
    const closed = createApp({ ...ENV, ALLOW_DEMO_AUTH: 'false' }, { store });
    const res = await closed.request('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUsername: 'someone_else' }),
    });
    expect(res.status).toBe(401);
  });

  it('توکن دستگاه کوتاه/خالی حساب مشترک نمی‌سازد و رد می‌شود', async () => {
    for (const deviceToken of ['', 'dev_', 'short', 'dev_123']) {
      const res = await app.request('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceToken }),
      });
      expect(res.status).toBe(400);
    }
    const users = [...store.users.values()];
    expect(users.length).toBe(0);
    expect(users.some((u) => u.telegramUsername === 'dev_')).toBe(false);
  });

  it('ورود دمو وقتی غیرفعال است رد می‌شود', async () => {
    const app = createApp({ ...ENV, ALLOW_DEMO_AUTH: 'false' });
    const res = await app.request('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('ورود پایدار با شناسه تلگرام telegramUserId همان حساب را بازیابی می‌کند', async () => {
    const res1 = await app.request('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: 12345678, displayName: 'داوطلب دکتری' }),
    });
    expect(res1.status).toBe(200);
    const body1 = (await json(res1)) as any;
    expect(body1.user.telegramUserId).toBe(12345678);

    const res2 = await app.request('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: 12345678 }),
    });
    expect(res2.status).toBe(200);
    const body2 = (await json(res2)) as any;
    expect(body2.user.id).toBe(body1.user.id);
  });

  it('شناسه تلگرام نامعتبر رد می‌شود', async () => {
    const res = await app.request('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: -5 }),
    });
    expect(res.status).toBe(400);
  });

  it('R-010: حالت ۲ (شناسه خام تلگرام) بدون پرچم دمو رد می‌شود', async () => {
    const closed = createApp({ ...ENV, ALLOW_DEMO_AUTH: 'false' }, { store: new MemoryStore() });
    const res = await closed.request('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: 999888777 }),
    });
    expect(res.status).toBe(401);
  });

  it('R-010: حالت ۳ (توکن دستگاه) بدون پرچم دمو رد می‌شود', async () => {
    const closed = createApp({ ...ENV, ALLOW_DEMO_AUTH: 'false' }, { store: new MemoryStore() });
    const res = await closed.request('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceToken: 'dev_' + 'a'.repeat(20) }),
    });
    expect(res.status).toBe(401);
  });

  it('R-010: محدودکنندهٔ نرخ روی مسیر احراز هویت پس از آستانه ۴۲۹ می‌دهد', async () => {
    const limited = createApp({ ...ENV }, { store: new MemoryStore() });
    let last = 0;
    for (let i = 0; i < 40; i++) {
      const res = await limited.request('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId: 1000 + i }),
      });
      last = res.status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });

  it('A-04: در پروداکشن شمارندهٔ نرخ از یک createApp به createApp بعدی زنده می‌ماند', async () => {
    // Workers به‌ازای هر درخواست createApp(env) را صدا می‌زند؛ اگر شمارنده داخل
    // createApp ساخته شود هر درخواست Map تازه می‌گیرد و ۴۲۹ هرگز صادر نمی‌شود.
    const prodEnv = {
      ...ENV,
      ENVIRONMENT: 'production',
      ALLOW_DEMO_AUTH: 'false',
      SESSION_SECRET: 'production-test-secret-with-enough-length',
    };
    const first = createApp(prodEnv, { store: new MemoryStore() });
    let sawThreshold = false;
    for (let i = 0; i < 31; i++) {
      const res = await first.request('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId: 7000 + i }),
      });
      if (res.status === 429) sawThreshold = true;
    }
    expect(sawThreshold).toBe(true);

    // اپ «جدید» با همان isolate باید هنوز محدود شده باشد
    const second = createApp(prodEnv, { store: new MemoryStore() });
    const res = await second.request('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: 9999 }),
    });
    expect(res.status).toBe(429);
  });

  it('A-04b: محدودکننده حتی بدون ENVIRONMENT=production هم کار می‌کند (پیکربندی واقعیِ زنده)', async () => {
    // راستی‌آزمایی روی محیط زنده در ۲۰۲۶-۱۱-۰۳ نشان داد نسخهٔ «اصلاح‌شده» هنوز
    // بی‌اثر است، چون رفتار مشترک‌سازی شمارنده به ENVIRONMENT گره خورده بود و
    // ورکر مستقرشده آن متغیر را ست نکرده بود. این تست همان حالت را می‌بندد.
    const first = createApp({ ...ENV }, { store: new MemoryStore() });
    let sawThreshold = false;
    for (let i = 0; i < 31; i++) {
      const res = await first.request('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUserId: 8100 + i }),
      });
      if (res.status === 429) {
        sawThreshold = true;
        break;
      }
    }
    expect(sawThreshold, 'بی‌اثر بودن محدودکننده در پیکربندی بدون ENVIRONMENT').toBe(true);

    const second = createApp({ ...ENV }, { store: new MemoryStore() });
    const res = await second.request('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: 8999 }),
    });
    expect(res.status).toBe(429);
  });

  it('A-28: /api/health/detail only with admin token, and never leaks secret values', async () => {
    const noToken = await app.request('/api/health/detail');
    expect(noToken.status).toBe(403);

    const wrong = await app.request('/api/health/detail', {
      headers: { Authorization: 'Bearer definitely-not-the-admin-token-value-1234' },
    });
    expect(wrong.status).toBe(403);

    const ok = await app.request('/api/health/detail', {
      headers: { Authorization: `Bearer ${ENV.ADMIN_API_TOKEN}` },
    });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as any;
    expect(body.store).toBe('injected');
    expect(body.productionGuardsActive).toBe(false);
    expect(body.demoAuthEnabled).toBe(true);
    expect(body.rateLimitScope).toBe('per-isolate-in-memory');
    expect(body.secretsConfigured.sessionSecret).toBe(true);
    // هیچ مقدار secret یا طول آن در پاسخ نیست
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(ENV.ADMIN_API_TOKEN as string);
    expect(raw).not.toContain(ENV.SESSION_SECRET as string);
    expect(raw).not.toContain(ENV.TELEGRAM_WEBHOOK_SECRET as string);
    expect(raw).not.toMatch(/"length"/);
    // وضعیت نگران‌کننده باید صریح اعلام شود (نه اینکه /api/health سالم به‌نظر برسد)
    expect(body.warnings.join(' ')).toContain('persistence=memory');
  });

  it('A-28b: با Supabase متصل، هشدار ماندگاری داده نمایش داده نمی‌شود', async () => {
    const withSupabase = createApp(
      { ...ENV, SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'x'.repeat(40) },
      { rateLimits: new Map() },
    );
    const res = await withSupabase.request('/api/health/detail', {
      headers: { Authorization: `Bearer ${ENV.ADMIN_API_TOKEN}` },
    });
    const body = (await res.json()) as any;
    expect(body.store).toBe('supabase');
    expect(body.warnings.join(' ')).not.toContain('persistence=memory');
  });

  it('A-28c: /api/health عمومی هیچ جزئیات پیکربندی نمی‌دهد', async () => {
    const res = await app.request('/api/health');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('A-26: محدودکننده خودش را در پاسخ گزارش می‌دهد (قابل مشاهده در پروداکشن)', async () => {
    const limited = createApp({ ...ENV }, { store: new MemoryStore() });
    const first = await limited.request('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: 4242, displayName: 'x' }),
    });
    expect(first.headers.get('x-ratelimit-limit')).toBe('30');
    expect(first.headers.get('x-ratelimit-remaining')).toBe('29');
    expect(first.headers.get('x-ratelimit-key')).toMatch(/^[0-9a-f]{8}$/);

    const second = await limited.request('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.9' },
      body: JSON.stringify({ telegramUserId: 4243, displayName: 'x' }),
    });
    // کلید متفاوت ⇒ اثر انگشت متفاوت و شمارندهٔ جدا
    expect(second.headers.get('x-ratelimit-key')).not.toBe(first.headers.get('x-ratelimit-key'));
    expect(second.headers.get('x-ratelimit-remaining')).toBe('29');
  });

  it('R-040: وب‌هوک بدون Secret Token درست یا با Secret اشتباه رد می‌شود', async () => {
    const body = JSON.stringify({
      message: { chat: { id: 987654 }, text: '/start' },
    });
    const missing = await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    expect(missing.status).toBe(401);

    const wrong = await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'wrong_secret_token_which_is_long_enough',
      },
      body,
    });
    expect(wrong.status).toBe(401);
  });

  it('R-040: مسیرهای مدیریتی وب‌هوک توکن نشست کاربر عادی را نمی‌پذیرند', async () => {
    const token = await login();
    const routes = [
      { path: '/api/telegram/webhook/info', method: 'GET' },
      { path: '/api/telegram/webhook/set', method: 'POST' },
      { path: '/api/telegram/webhook/delete', method: 'POST' },
    ] as const;
    for (const route of routes) {
      const res = await app.request(route.path, {
        method: route.method,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
    }
  });

  it('R-040: تنظیم وب‌هوک فقط با Admin API Token انجام می‌شود و Secret را به تلگرام می‌فرستد', async () => {
    const adminApp = createApp({ ...ENV, TELEGRAM_BOT_TOKEN: '123456:test-bot-token' }, { store });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await adminApp.request('/api/telegram/webhook/set', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ENV.ADMIN_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody).toMatchObject({
      url: 'http://localhost/api/telegram/webhook',
      secret_token: ENV.TELEGRAM_WEBHOOK_SECRET,
    });
    expect(requestBody).not.toHaveProperty('drop_pending_updates');
  });

  it('وب‌هوک تلگرام پیام /start را با یک ارسال واحد و دکمهٔ MiniApp پردازش می‌کند (رفع دو پیام — مأموریت v2)', async () => {
    ENV.TELEGRAM_BOT_TOKEN = ENV.TELEGRAM_BOT_TOKEN ?? '123456:worker-test-bot';
    // ارسال واقعی به Telegram mock می‌شود؛ پاسخ webhook دیگر {method:sendMessage} نیست
    const sent: Array<Record<string, unknown>> = [];
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('api.telegram.org')) {
        sent.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
        return new Response(JSON.stringify({ ok: true, result: { message_id: 777 } }), { status: 200 });
      }
      return realFetch(input as never, init);
    }));
    const res = await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': ENV.TELEGRAM_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        update_id: 901,
        message: {
          chat: { id: 987654, type: 'private' },
          from: { id: 987654 },
          text: '/start',
        },
      }),
    });
    expect(res.status).toBe(200);
    const data = (await json(res)) as any;
    expect(data.ok).toBe(true);
    expect(data.status).toBe('sent');
    // ریشهٔ دو پیام: بدنهٔ پاسخ دیگر method تلگرامی ندارد
    expect(data).not.toHaveProperty('method');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.chat_id).toBe(987654);
    expect((sent[0]!.reply_markup as { inline_keyboard: unknown[][] }).inline_keyboard[0]![0]).toHaveProperty('web_app');
    vi.unstubAllGlobals();
  });

  it('سؤال ناشناخته ۴۰۴ می‌دهد', async () => {
    const token = await login();
    const res = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: 'x1', questionId: 'nonexistent', selectedOption: 0 }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe('worker API — داشبورد خانه و کوییز شبانه (واژه‌راه-مانند)', () => {
  it('خانه در ابتدا: صفر و خنثی، بدون کوییز شبانه', async () => {
    const token = await login();
    const home = await json(await app.request('/api/home', authed(token)));
    expect(home.stats.coins).toBe(0);
    expect(home.stats.streakDays).toBe(0);
    expect(home.stats.dayNumber).toBe(0);
    expect(home.stats.daysLeft).toBeNull();
    expect(home.nightQuiz.available).toBe(false);
    expect(home.mentorMessage).toBeTruthy();
    expect(home.progress.nodes).toBeGreaterThan(0);
    // §8.1: کاربر تازه هیچ شاهدی ندارد ⇒ null، نه صفرِ ساختگی
    expect(home.progress.overall).toBeNull();
    expect(home.progress.assessedNodes).toBe(0);
  });

  it('پاسخ غلط: سکه و روز پیوسته ثبت می‌شود و کوییز شبانه همان سؤال را برمی‌گرداند', async () => {
    const token = await login();
    await app.request(
      '/api/tracks',
      authed(token, { method: 'PUT', body: JSON.stringify({ tracks: ['technology'] }) }),
    );
    const queue = await json(await app.request('/api/queue?limit=5', authed(token)));
    const target = queue.items.find((i: any) => i.card.nodeId === 'sm.value_chain');
    const question = store.questions.find((q: any) => q.id === target.question.id)!;
    const wrongOption = (question.correctOption + 1) % question.options.length;

    const res = await json(
      await app.request(
        '/api/answers',
        authed(token, {
          method: 'POST',
          body: JSON.stringify({ attemptId: target.attemptId, questionId: question.id, selectedOption: wrongOption }),
        }),
      ),
    );
    // سکه: پاسخ غلط هم ۱ سکه (مشارکت)
    expect(res.stats).toEqual({ coins: 1, streakDays: 1, dayNumber: 1 });

    // داشبورد خانه پس از پاسخ
    const home = await json(await app.request('/api/home', authed(token)));
    expect(home.stats.coins).toBe(1);
    expect(home.stats.streakDays).toBe(1);
    expect(home.today.answered).toBe(1);
    expect(home.today.correct).toBe(0);
    expect(home.nightQuiz.available).toBe(true);
    expect(home.nightQuiz.wrongCount).toBe(1);

    // کوییز شبانه: همان سؤالِ غلط، بدون کلید صحیح
    const night = await json(await app.request('/api/night-quiz', authed(token)));
    expect(night.items.length).toBe(1);
    expect(night.items[0].card.questionId).toBe(question.id);
    expect(night.items[0].question.correctOption).toBeUndefined(); expect(night.items[0].question.explanation).toBeUndefined(); expect(night.items[0].question.trapNote).toBeUndefined();
    expect(night.items[0].attemptId).toBeTruthy();

    // پاسخ درست در کوییز شبانه → سکه بیشتر (۲) و گزارش درست
    const nightRes = await json(
      await app.request(
        '/api/answers',
        authed(token, {
          method: 'POST',
          body: JSON.stringify({ attemptId: night.items[0].attemptId, questionId: question.id, selectedOption: question.correctOption }),
        }),
      ),
    );
    expect(nightRes.report.wasCorrect).toBe(true);
    expect(nightRes.stats.coins).toBe(3); // ۱ + ۲
  });

  it('تنظیم تاریخ کنکور → شمارش معکوس؛ فرمت نامعتبر رد می‌شود', async () => {
    const token = await login();
    const bad = await app.request(
      '/api/settings',
      authed(token, { method: 'PUT', body: JSON.stringify({ examDate: 'دیروز' }) }),
    );
    expect(bad.status).toBe(400);

    const future = new Date(Date.now() + 78 * 86_400_000).toISOString().slice(0, 10);
    const ok = await json(
      await app.request(
        '/api/settings',
        authed(token, { method: 'PUT', body: JSON.stringify({ examDate: future }) }),
      ),
    );
    expect(ok.examDate).toBe(future);

    const home = await json(await app.request('/api/home', authed(token)));
    expect(home.stats.daysLeft).toBeGreaterThanOrEqual(77);
    expect(home.stats.daysLeft).toBeLessThanOrEqual(79);
  });
  it('marks answer responses and authorization errors as non-cacheable', async () => {
    const unauthenticated = await app.request('/api/answers', { method: 'POST' });
    expect(unauthenticated.headers.get('Cache-Control')).toBe('no-store');

    const token = await login();
    const queueResponse = await app.request('/api/queue', authed(token));
    expect(queueResponse.headers.get('Cache-Control')).toBe('no-store');
    const queue = await json(queueResponse);
    const item = queue.items.find((entry: { question?: unknown }) => entry.question);
    const response = await app.request('/api/answers', authed(token, {
      method: 'POST',
      body: JSON.stringify({ questionId: item.question.id, attemptId: item.attemptId, selectedOption: 0 }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(typeof (await json(response)).correctOption).toBe('number');
  });

  it('محیط پروداکشن: شکست در صورت عدم وجود کلید یا مغایرت تنظیمات (Fail-Closed)', () => {
    // 1. کلید پیش‌فرض یا کوتاه در پروداکشن
    expect(() => {
      createApp({
        ENVIRONMENT: 'production',
        SESSION_SECRET: 'dev-secret',
      });
    }).toThrow(/SECURITY VIOLATION/);

    // 2. ورود دمو در پروداکشن ممنوع است
    expect(() => {
      createApp({
        ENVIRONMENT: 'production',
        SESSION_SECRET: 'production-super-secret-key-32chars',
        ALLOW_DEMO_AUTH: 'true',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      });
    }).toThrow(/ALLOW_DEMO_AUTH must not be enabled/);

    // 3. نبود دیتابیس پایدار در پروداکشن ممنوع است (Fallback به MemoryStore رد می‌شود)
    expect(() => {
      createApp({
        ENVIRONMENT: 'production',
        SESSION_SECRET: 'production-super-secret-key-32chars',
      });
    }).toThrow(/In-memory store fallback is prohibited/);
  });

  it('بررسی تقلب در تلاش مجدد: تلاش مجدد با شناسه سؤال دیگر خطا می‌دهد (۴۰۰)', async () => {
    const token = await login();
    const queueRes = await app.request('/api/queue?limit=5', authed(token));
    const queue = await json(queueRes);
    const q1 = queue.items[0].question.id;
    const q2 = queue.items[1].question.id;

    // ثبت پاسخ برای q1 با بلیت صادرشده برای همان آیتم صف
    const ans1 = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: queue.items[0].attemptId, questionId: q1, selectedOption: 0 }),
      }),
    );
    expect(ans1.status).toBe(200);

    // تلاش برای استفاده مجدد از همان بلیت برای سؤال دیگر (q2)
    const badReplay = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: queue.items[0].attemptId, questionId: q2, selectedOption: 0 }),
      }),
    );
    expect(badReplay.status).toBe(400);
    const errBody = await json(badReplay);
    expect(errBody.error).toContain('شناسه تلاش قبلاً برای سؤال دیگری ثبت شده است');
  });

  it('keeps explicitly reserved items out of diagnosis and old practice cards', async () => {
    const token = await login();
    const me = await json(await app.request('/api/me', authed(token)));
    const userId = me.user.id as string;
    const reserved = {
      ...store.questions[0],
      id: 'reserved-1399',
      examYear: 1399,
      accessType: 'proof' as const,
    };
    store.questions.push(reserved);
    await store.upsertCards([{
      id: 'old-reserved-card',
      userId,
      nodeId: reserved.nodeId,
      cardType: 'question',
      questionId: reserved.id,
      dueAt: new Date(0).toISOString(),
      intervalDays: 1,
      ease: 2.5,
      isRepair: false,
      timesSeen: 0,
      timesCorrect: 0,
    }]);

    for (const path of ['/api/queue?limit=50', '/api/diagnostic?count=20']) {
      const response = await app.request(path, authed(token));
      expect(response.status).toBe(200);
      const payload = await json(response);
      expect(JSON.stringify(payload)).not.toContain(reserved.id);
    }

    await store.issueAttemptTickets(userId, [{
      attemptId: 'old-reserved-ticket', questionId: reserved.id, attemptType: 'practice',
    }]);
    const answer = await app.request('/api/answers', authed(token, {
      method: 'POST',
      body: JSON.stringify({ questionId: reserved.id, attemptId: 'old-reserved-ticket', selectedOption: 0 }),
    }));
    expect(answer.status).toBe(409);
    expect(await json(answer)).not.toHaveProperty('correctOption');
  });

  it('قرنطینهٔ سؤالات هولدآوت: سؤالات سال ۱۴۰۴ در صف تمرین روزمره قرار نمی‌گیرند', async () => {
    const token = await login();
    // افزودن یک سوال سال 1404 به استور
    store.questions.push({
      id: 'q-1404-holdout-test',
      nodeId: 'sm.value_chain',
      examYear: 1404,
      text: 'سؤال تستی سال ۱۴۰۴ در قرنطینه',
      options: ['۱', '۲', '۳', '۴'],
      correctOption: 1,
    });

    const queueRes = await app.request('/api/queue?limit=50', authed(token));
    const queue = await json(queueRes);
    const holdoutItem = queue.items.find((i: any) => i.question?.id === 'q-1404-holdout-test');
    expect(holdoutItem).toBeUndefined();
  });
});

describe('worker API — سیم‌کشی نسل دوم (ROI Planner + بلیت تلاش + اثبات تسلط)', () => {
  it('صف روزانه: attemptId سرور + نوع تلاش برای هر آیتم صادر می‌شود و پاسخ با همان attemptId ثبت می‌شود', async () => {
    const token = await login();
    const queueRes = await app.request('/api/queue?limit=3', authed(token));
    const queue = await json(queueRes);
    expect(queue.items.length).toBeGreaterThan(0);
    for (const item of queue.items) {
      expect(typeof item.attemptId).toBe('string');
      expect(item.attemptId.startsWith('att-')).toBe(true);
      expect(item.attemptType).toBe('practice');
      expect(typeof item.estimatedMinutes).toBe('number');
    }

    // پاسخ با attemptId سرور
    const item = queue.items[0];
    const ansRes = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: item.attemptId,
          questionId: item.question.id,
          selectedOption: 1,
          responseTimeMs: 25_000,
          confidenceRating: 3,
        }),
      }),
    );
    expect(ansRes.status).toBe(200);
    const ans = await json(ansRes);
    expect(ans.report.attemptType).toBe('practice');

    // تلاش تکراری با همان attemptId → replay
    const replayRes = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: item.attemptId, questionId: item.question.id, selectedOption: 1 }),
      }),
    );
    expect((await json(replayRes)).replay).toBe(true);
  });

  it('حالت commute: سؤال‌های محاسباتی آمار (stats.*) از صف حذف می‌شوند', async () => {
    const token = await login();
    const deskQueue = await json(await app.request('/api/queue?limit=50&mode=desk', authed(token)));
    const commuteQueue = await json(await app.request('/api/queue?limit=50&mode=commute', authed(token)));
    const hasStats = (items: any[]) => items.some((i: any) => i.card.nodeId.startsWith('stats.'));
    // در دسک احتمال وجود آمار هست (بستهٔ دمو آمار دارد)؛ در commute نباید باشد
    expect(hasStats(commuteQueue.items)).toBe(false);
    if (hasStats(deskQueue.items)) {
      expect(deskQueue.items.length).toBeGreaterThan(commuteQueue.items.length);
    }
  });

  it('اثبات تسلط: needs_proof → سؤال قرنطینهٔ ۱۴۰۴ با برچسب proof؛ پاسخ درست → proven', async () => {
    const token = await login();
    const me = await json(await app.request('/api/me', authed(token)));
    const userId = me.user.id as string;

    // سؤال قرنطینهٔ ۱۴۰۴ برای گرهٔ sm.rbv
    store.questions.push({
      id: 'q-1404-proof-rbv',
      nodeId: 'sm.rbv',
      examYear: 1404,
      text: 'سؤال اثبات تسلط ۱۴۰۴ برای دیدگاه منبع‌محور',
      options: ['الف', 'ب'],
      correctOption: 0,
    });
    // وضعیت شش‌بعدی مهارت: آمادگی اثبات
    store.skillStates.set(`${userId}:skill.sm.rbv.vrio`, {
      skillId: 'skill.sm.rbv.vrio',
      userId,
      proficiencyProbability: 0.8,
      confidence: 0.5,
      evidenceCount: 2,
      memoryRetrievability: 1,
      fluencySpeedRatio: 1,
      dominantErrorType: 'unknown',
      coverageStatus: 'needs_proof',
    });

    const queue = await json(await app.request('/api/queue?limit=20', authed(token)));
    const proofItem = queue.items.find((i: any) => i.attemptType === 'proof');
    expect(proofItem).toBeDefined();
    expect(proofItem.question.id).toBe('q-1404-proof-rbv');
    expect(proofItem.proofLabel).toContain('اثبات تسلط');
    // اول صف است
    expect(queue.items[0].attemptType).toBe('proof');

    // پاسخ درست به سؤال اثبات
    const ansRes = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: proofItem.attemptId,
          questionId: 'q-1404-proof-rbv',
          selectedOption: 0,
          attemptType: 'proof',
          responseTimeMs: 40_000,
        }),
      }),
    );
    expect(ansRes.status).toBe(200);
    const ans = await json(ansRes);
    expect(ans.report.attemptType).toBe('proof');
    expect(ans.report.coverageStatus).toBe('proven');

    // وضعیت مهارت در store به proven به‌روزرسانی شده
    const st = store.skillStates.get(`${userId}:skill.sm.rbv.vrio`);
    expect(st?.coverageStatus).toBe('proven');
  });

  it('پاسخ تازه: wasCorrect/آمار/درس‌نامه در ریشهٔ پاسخ و مسیر replay همان قرارداد را دارد', async () => {
    const token = await login();
    const question = store.questions.find((q) => q.nodeId === 'sm.rbv')!;
    const me = await json(await app.request('/api/me', authed(token)));
    await store.issueAttemptTickets(me.user.id, [
      { attemptId: 'att-contract-1', questionId: question.id, attemptType: 'practice' },
    ]);

    const first = await json(
      await app.request(
        '/api/answers',
        authed(token, {
          method: 'POST',
          body: JSON.stringify({
            attemptId: 'att-contract-1',
            questionId: question.id,
            selectedOption: question.correctOption,
          }),
        }),
      ),
    );
    expect(first.replay).toBe(false);
    expect(first.wasCorrect).toBe(true);
    expect(first.stats).toEqual({ coins: 2, streakDays: 1, dayNumber: 1 });
    expect(first.lesson).toBeTruthy();
    expect(first.lesson.id).toBe('sm.rbv');
    // عنوان‌های فارسی در دلتاهای تسلط برای نمایش کلاینت
    const delta = first.report.masteryDeltas[0];
    expect(delta.topic).toBeTruthy();
    expect(delta.course).toBeTruthy();

    const replay = await json(
      await app.request(
        '/api/answers',
        authed(token, {
          method: 'POST',
          body: JSON.stringify({
            attemptId: 'att-contract-1',
            questionId: question.id,
            selectedOption: question.correctOption,
          }),
        }),
      ),
    );
    expect(replay.replay).toBe(true);
    expect(replay.wasCorrect).toBe(true);
    expect(replay.stats).toEqual(first.stats);
    expect(replay.lesson?.id).toBe('sm.rbv');
  });

  // PR#3 port (83b6ab4): کلاینت نمی‌تواند تلاش تمرینی را به اثبات تسلط ارتقا دهد
  it('نوع تلاش از بلیت سرور می‌آید و attemptType جعلی کلاینت نادیده گرفته می‌شود', async () => {
    const token = await login();
    const queue = await json(await app.request('/api/queue?limit=20', authed(token)));
    const item = queue.items.find((candidate: any) => candidate.attemptType === 'practice' && candidate.question);
    expect(item).toBeDefined();
    const realQ1 = store.questions.find((x) => x.id === item.question.id)!;

    const response = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: item.attemptId,
          questionId: item.question.id,
          selectedOption: realQ1.correctOption,
          responseTimeMs: 20_000,
          confidenceRating: 3,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const result = await json(response);
    expect(result.report.attemptType).toBe('practice');
    expect(result.report.coverageStatus).not.toBe('proven');

    // حتی با فیلد attemptType: 'proof' در body — از بلیت خوانده می‌شود، نه از client
    const item2 = queue.items.filter((candidate: any) => candidate.attemptType === 'practice' && candidate.question)[1];
    const realQ2 = store.questions.find((x) => x.id === item2.question.id)!;
    const escalated = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: item2.attemptId,
          questionId: item2.question.id,
          selectedOption: realQ2.correctOption,
          attemptType: 'proof',
        }),
      }),
    );
    expect(escalated.status).toBe(200);
    expect((await json(escalated)).report.attemptType).toBe('practice');
  });

  it('بدون بلیت صادرشده، ثبت پاسخ رد می‌شود (۴۰۰)', async () => {
    const token = await login();
    const queue = await json(await app.request('/api/queue?limit=3', authed(token)));
    const item = queue.items.find((i: any) => i.question);
    const res = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: 'att-never-issued', questionId: item.question.id, selectedOption: 0 }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('کوییز شبانه: بلیت تلاش صادر می‌شود و با همان attemptId قابل پاسخ است', async () => {
    const token = await login();
    const queue = await json(await app.request('/api/queue?limit=1', authed(token)));
    const item = queue.items[0];
    const question = store.questions.find((q) => q.id === item.question.id)!;
    const wrongOption = (question.correctOption + 1) % question.options.length;

    await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: item.attemptId,
          questionId: question.id,
          selectedOption: wrongOption,
        }),
      }),
    );

    const night = await json(await app.request('/api/night-quiz', authed(token)));
    expect(night.items.length).toBe(1);
    const nightItem = night.items[0];
    expect(nightItem.attemptType).toBe('verification');
    expect(typeof nightItem.attemptId).toBe('string');
    expect(nightItem.attemptId.startsWith('att-')).toBe(true);

    const answered = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: nightItem.attemptId,
          questionId: nightItem.card.questionId,
          selectedOption: question.correctOption,
          attemptType: 'verification',
        }),
      }),
    );
    expect(answered.status).toBe(200);
    const body = await json(answered);
    expect(body.wasCorrect).toBe(true);
  });

  it('نقشهٔ تسلط: آرایهٔ مسطح nodes و شیء mastery با ساختار گروهی سازگار است', async () => {
    const token = await login();
    const map = await json(await app.request('/api/map', authed(token)));
    expect(Array.isArray(map.nodes)).toBe(true);
    expect(map.nodes.length).toBeGreaterThan(0);
    expect(map.mastery).toBeTypeOf('object');

    const grouped = map.courses.flatMap((c: any) => c.chapters.flatMap((ch: any) => ch.nodes));
    expect(map.nodes.map((n: any) => n.id).sort()).toEqual(grouped.map((n: any) => n.id).sort());
    const first = grouped[0];
    expect(map.mastery[first.id].mastery).toBe(first.mastery);
    expect(map.mastery[first.id].status).toBe(first.status);
  });

  it('محدودیت صف: مقادیر منفی و غیرعددی سرور را از کار نمی‌اندازند و در بازهٔ ۱ تا ۵۰ مهار می‌شوند', async () => {
    const token = await login();
    for (const query of ['limit=-5', 'limit=abc', 'limit=1000', 'limit=0']) {
      const res = await app.request(`/api/queue?${query}`, authed(token));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.length).toBeLessThanOrEqual(50);
    }
  });

  it('خوداظهاری برای پاسخ درست رد می‌شود (۴۰۰)', async () => {
    const token = await login();
    const question = store.questions.find((q) => q.nodeId === 'sm.rbv')!;
    const me = await json(await app.request('/api/me', authed(token)));
    const attemptId = 'att-self-report-correct';
    await store.issueAttemptTickets(me.user.id, [
      { attemptId, questionId: question.id, attemptType: 'practice' },
    ]);
    await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          attemptId,
          questionId: question.id,
          selectedOption: question.correctOption,
        }),
      }),
    );
    const res = await app.request(
      '/api/self-report',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId, questionId: question.id, selfReport: 'slip' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('خوداظهاری بی‌دقتی: ثبت می‌شود و نوع خطای غالب به slip تغییر می‌کند', async () => {
    const token = await login();
    const queue = await json(await app.request('/api/queue?limit=5', authed(token)));
    const item = queue.items.find((i: any) => i.question);
    const question = store.questions.find((x) => x.id === item.question.id)!;
    const wrongOption = (question.correctOption + 1) % question.options.length;
    const ansRes = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: item.attemptId,
          questionId: question.id,
          selectedOption: wrongOption,
        }),
      }),
    );
    expect(ansRes.status).toBe(200);
    const ans = await json(ansRes);
    expect(ans.report.wasCorrect).toBe(false);

    const report = await app.request(
      '/api/self-report',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: item.attemptId, questionId: question.id, selfReport: 'slip' }),
      }),
    );
    expect(report.status).toBe(200);
    const body = await json(report);
    expect(body.ok).toBe(true);
    expect(body.selfReport).toBe('slip');

    const me = await json(await app.request('/api/me', authed(token)));
    const skillStates = await store.getSkillStates(me.user.id);
    const updated = skillStates.find((s) => s.dominantErrorType === 'slip');
    expect(updated).toBeTruthy();
  });
});

describe('R-020 — جداول دامنهٔ جدید (exam_selections، audit_logs، daily_queue_items، mastery_history)', () => {
  it('ذخیره و بازیابی انتخاب کنکور (PUT/GET round-trip)', async () => {
    const token = await login();
    const put = await app.request(
      '/api/exam-selection',
      authed(token, {
        method: 'PUT',
        body: JSON.stringify({ examYear: 1405, subGroupId: 'mgr-1', combinationCode: '3', setCode: '2162' }),
      }),
    );
    expect(put.status).toBe(200);
    const got = await json(await app.request('/api/exam-selection', authed(token)));
    expect(got.selection.examYear).toBe(1405);
    expect(got.selection.subGroupId).toBe('mgr-1');
    expect(got.selection.combinationCode).toBe('3');
    expect(got.selection.setCode).toBe('2162');
    // PUT دوم همان سال → جایگزین (یک انتخاب فعال به ازای سال)
    await app.request(
      '/api/exam-selection',
      authed(token, { method: 'PUT', body: JSON.stringify({ examYear: 1405, subGroupId: 'mgr-2' }) }),
    );
    const after = await json(await app.request('/api/exam-selection', authed(token)));
    expect(after.selection.subGroupId).toBe('mgr-2');
  });

  it('اعتبارسنجی ورودی انتخاب کنکور: سال و زیرگروه نامعتبر رد می‌شوند', async () => {
    const token = await login();
    const badYear = await app.request(
      '/api/exam-selection',
      authed(token, { method: 'PUT', body: JSON.stringify({ examYear: 2027, subGroupId: 'x' }) }),
    );
    expect(badYear.status).toBe(400);
    const badGroup = await app.request(
      '/api/exam-selection',
      authed(token, { method: 'PUT', body: JSON.stringify({ examYear: 1404, subGroupId: '   ' }) }),
    );
    expect(badGroup.status).toBe(400);
    const unauth = await app.request('/api/exam-selection');
    expect(unauth.status).toBe(401);
  });

  it('صدور صف، آیتم‌ها را در daily_queue_items با attemptId یکتا ثبت می‌کند', async () => {
    const token = await login();
    const queue = await json(await app.request('/api/queue?limit=4', authed(token)));
    expect(queue.items.length).toBeGreaterThan(0);
    // persist best-effort است؛ در MemoryStore هم‌زمان انجام می‌شود
    await new Promise((r) => setTimeout(r, 0));
    const issuedAttemptIds = queue.items.map((i: any) => i.attemptId).filter(Boolean);
    const persisted = store.queueItems.map((q) => q.attemptId);
    for (const id of issuedAttemptIds) expect(persisted).toContain(id);
    expect(new Set(persisted).size).toBe(persisted.length);
    for (const q of store.queueItems) expect(['scheduled', 'proof']).toContain(q.reason);
  });

  it('کوییز شبانه آیتم‌ها را با reason=night_quiz persist می‌کند', async () => {
    const token = await login();
    const me = await json(await app.request('/api/me', authed(token)));
    const q = store.questions[0];
    await store.issueAttemptTickets(me.user.id, [{ attemptId: 'att-r020-night', questionId: q.id, attemptType: 'practice' }]);
    await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: 'att-r020-night', questionId: q.id, selectedOption: (q.correctOption + 1) % q.options.length }),
      }),
    );
    const night = await json(await app.request('/api/night-quiz', authed(token)));
    await new Promise((r) => setTimeout(r, 0));
    expect(night.items.length).toBe(1);
    const row = store.queueItems.find((x) => x.attemptId === night.items[0].attemptId);
    expect(row).toBeTruthy();
    expect(row!.reason).toBe('night_quiz');
  });

  it('پاسخ با بلیت صادرنشده، ردیف audit_logs ثبت می‌کند', async () => {
    const token = await login();
    const queue = await json(await app.request('/api/queue?limit=2', authed(token)));
    const item = queue.items.find((i: any) => i.question);
    const res = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: 'att-ghost-9', questionId: item.question.id, selectedOption: 0 }),
      }),
    );
    expect(res.status).toBe(400);
    const audit = store.auditLog.find((a) => a.action === 'answer_ticket_not_found');
    expect(audit).toBeTruthy();
    expect(audit!.entityId).toBe('att-ghost-9');
  });

  it('ثبت پاسخ، تاریخچهٔ تسلط (mastery_history معادل trigger) را پر می‌کند', async () => {
    const token = await login();
    const queue = await json(await app.request('/api/queue?limit=3', authed(token)));
    const item = queue.items.find((i: any) => i.question);
    const question = store.questions.find((x) => x.id === item.question.id)!;
    await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: item.attemptId, questionId: question.id, selectedOption: question.correctOption }),
      }),
    );
    expect(store.masteryHistory.length).toBeGreaterThan(0);
    expect(store.masteryHistory.every((h) => typeof h.newScore === 'number')).toBe(true);
    expect(await store.countMasteryHistoryRows((await json(await app.request('/api/me', authed(token)))).user.id)).toBeGreaterThan(0);
  });
});

describe('Phase 4 §8.1 — آزمون تشخیصی و وضعیت اولیه UNKNOWN', () => {
  it('/api/diagnostic بدون احراز هویت 401 می‌دهد', async () => {
    const res = await app.request('/api/diagnostic');
    expect(res.status).toBe(401);
  });

  it('آیتم‌های تشخیصی بلیت diagnostic دارند و کلید پاسخ افشا نمی‌شود', async () => {
    const token = await login();
    const diag = await json(await app.request('/api/diagnostic?count=3', authed(token)));
    expect(diag.items.length).toBeGreaterThan(0);
    expect(diag.items.length).toBeLessThanOrEqual(3);
    for (const item of diag.items) {
      expect(item.attemptType).toBe('diagnostic');
      expect(typeof item.attemptId).toBe('string');
      expect(item.question.correctOption).toBeUndefined();
      expect(item.question.explanation).toBeUndefined();
      expect(item.question.trapNote).toBeUndefined();
      expect(['assessed', 'unknown']).toContain(item.assessmentState);
      expect(item.question.examYear).not.toBe(1404); // قرنطینه هولدآوت از تشخیص آزاد نمی‌شود
    }
  });

  it('صف تازه برای کاربر جدید: وضعیت UNKNOWN با تخمین NULL — نه پیش‌فرض ساختگی ۵۰', async () => {
    const token = await login();
    const queue = await json(await app.request('/api/queue?limit=5', authed(token)));
    expect(queue.items.length).toBeGreaterThan(0);
    for (const item of queue.items) {
      expect(['assessed', 'unknown']).toContain(item.assessmentState);
      if (item.assessmentState === 'unknown') {
        expect(item.masteryEstimate).toBeNull();
        expect(item.evidenceLevel).toBe('none');
      }
    }
  });

  it('ثبت پاسخ با بلیت تشخیصی پذیرفته می‌شود؛ نوع تلاش از بلیت سرور می‌آید', async () => {
    const token = await login();
    const diag = await json(await app.request('/api/diagnostic?count=1', authed(token)));
    const item = diag.items[0];
    const question = store.questions.find((x) => x.id === item.question.id)!;
    expect(question.options.length).toBeGreaterThan(1);
    const wrongOption = (question.correctOption + 1) % question.options.length;
    const ansRes = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: item.attemptId, questionId: question.id, selectedOption: wrongOption }),
      }),
    );
    expect(ansRes.status).toBe(200);
    const ans = await json(ansRes);
    expect(ans.report.attemptType).toBe('diagnostic');
    expect(ans.wasCorrect).toBe(false);
  });

  it('بلیت جعلی تشخیصی (صدیت‌نشده) رد می‌شود', async () => {
    const token = await login();
    const q = store.questions[0];
    const res = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: 'att-fake-diagnostic', questionId: q.id, selectedOption: q.correctOption }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('آیتم‌های تشخیصی در daily_queue_items با reason=diagnostic ثبت می‌شوند', async () => {
    const token = await login();
    const userId = (await json(await app.request('/api/me', authed(token)))).user.id;
    await app.request('/api/diagnostic?count=2', authed(token));
    const rows = store.queueItems.filter((r) => r.userId === userId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.reason === 'diagnostic')).toBe(true);
  });
});

describe('API نقشهٔ یادگیری — عدم جعل تسلط', () => {
  it('وضعیت مهارت به‌تنهایی mastery عددی ۵۰ برای گره تولید نمی‌کند', async () => {
    const token = await login();
    const userId = (await json(await app.request('/api/me', authed(token)))).user.id as string;
    await store.upsertSkillState(userId, {
      skillId: 'skill.sm.rbv.vrio',
      nodeId: 'sm.rbv',
      state: {
        skillId: 'skill.sm.rbv.vrio',
        proficiencyProbability: 0.81,
        confidence: 0.64,
        evidenceCount: 4,
        memoryRetrievability: 0.88,
        fluencySpeedRatio: 1.1,
        dominantErrorType: 'time_pressure',
        coverageStatus: 'needs_proof',
      },
    });
    const map = await json(await app.request('/api/map', authed(token)));
    const node = map.nodes.find((item: any) => item.id === 'sm.rbv');
    expect(node).toBeDefined();
    expect(node.mastery).toBeNull();
    expect(node.status).toBe('needs_proof');
    expect(map.mastery['sm.rbv'].mastery).toBeNull();
  });
});

describe('Phase 4 §8.5 — صف روزانهٔ ترکیبی با بودجهٔ زمانیِ سازگار', () => {
  const DAY_MS = 86_400_000;

  function seedCard(userId: string, questionId: string, opts: { isRepair?: boolean } = {}) {
    const q = store.questions.find((x) => x.id === questionId)!;
    const nowMs = Date.now();
    const card = {
      id: `card-repair-${questionId}`,
      userId,
      nodeId: q.nodeId,
      cardType: 'question' as const,
      questionId,
      dueAt: new Date(nowMs - DAY_MS).toISOString(),
      intervalDays: 1,
      ease: 2.5,
      isRepair: opts.isRepair === true,
      timesSeen: 1,
      timesCorrect: 0,
    };
    store.cards.set(card.id, card as any);
    return card;
  }

  it('انواع فعالیت در آیتم‌ها و متادیتای بودجه آشکار است (review/practice/proof/remedial)', async () => {
    const token = await login();
    const userId = (await json(await app.request('/api/me', authed(token)))).user.id;
    const q = store.questions.find((x) => x.examYear !== 1404 && !x.nodeId.startsWith('stats.'))!;
    seedCard(userId, q.id, { isRepair: true });
    const queue = await json(await app.request('/api/queue?limit=3', authed(token)));
    const remedial = queue.items.find((i: any) => i.card.id === `card-repair-${q.id}`);
    expect(remedial).toBeDefined();
    expect(remedial.activityType).toBe('remedial');
    expect(remedial.attemptType).toBe('practice');
    expect(typeof queue.proofMinutes).toBe('number');
    expect(typeof queue.spendableMinutes).toBe('number');
    const row = store.queueItems.find((r) => r.userId === userId && r.questionId === q.id);
    expect(row?.reason).toBe('remedial');
  });

  it('سازگاری بودجه: مجموع زمان قابل‌هزینه ≤ بودجه و spentMinutes دقیقاً برابر مجموع آیتم‌ها', async () => {
    const token = await login();
    const BUDGET = 12;
    const queue = await json(await app.request(`/api/queue?limit=30&budgetMinutes=${BUDGET}`, authed(token)));
    expect(queue.budgetMinutes).toBe(BUDGET);
    const sumAll = queue.items.reduce((acc: number, i: any) => acc + i.estimatedMinutes, 0);
    expect(queue.spentMinutes).toBe(sumAll);
    const proofSum = queue.items
      .filter((i: any) => i.attemptType === 'proof')
      .reduce((acc: number, i: any) => acc + i.estimatedMinutes, 0);
    expect(queue.proofMinutes).toBe(proofSum);
    const spendableSum = sumAll - proofSum;
    expect(queue.spendableMinutes).toBe(spendableSum);
    expect(spendableSum).toBeLessThanOrEqual(Math.max(0, BUDGET - proofSum));
    // قاعدهٔ سخت‌گیرانه: بدون آیتهایی که بودجه را می‌شکنند؛ حداقل زمان آیتم ۵ دقیقه
    for (const i of queue.items) expect(i.estimatedMinutes).toBeGreaterThanOrEqual(5);
  });

  it('اثبات تسلط زمانش را از بودجه می‌خورد و باز هم می‌ماند؛ با بودجهٔ کوچک صف خالی ولی سازگار است', async () => {
    const token = await login();
    const me = await json(await app.request('/api/me', authed(token)));
    const userId = me.user.id as string;
    store.questions.push({
      id: 'q-1404-budget-rbv',
      nodeId: 'sm.rbv',
      examYear: 1404,
      text: 'سؤال اثبات برای تست بودجه',
      options: ['الف', 'ب'],
      correctOption: 0,
    } as any);
    store.skillStates.set(`${userId}:skill.sm.rbv.vrio`, {
      skillId: 'skill.sm.rbv.vrio',
      userId,
      proficiencyProbability: 0.8,
      confidence: 0.5,
      evidenceCount: 2,
      memoryRetrievability: 1,
      fluencySpeedRatio: 1,
      dominantErrorType: 'unknown',
      coverageStatus: 'needs_proof',
    } as any);

    // بودجهٔ ۳۰: اثبات (۵ دقیقه) می‌ماند و تا ۲۵ دقیقه باقی‌مانده قابل‌هزینه اضافه می‌شود
    const q30 = await json(await app.request('/api/queue?limit=30&budgetMinutes=30', authed(token)));
    const proof = q30.items.filter((i: any) => i.attemptType === 'proof');
    expect(proof.length).toBeGreaterThan(0);
    expect(q30.proofMinutes).toBe(proof.reduce((a: number, i: any) => a + i.estimatedMinutes, 0));
    expect(q30.spendableMinutes).toBeLessThanOrEqual(Math.max(0, 30 - q30.proofMinutes));
    expect(q30.spentMinutes).toBe(
      q30.items.reduce((a: number, i: any) => a + i.estimatedMinutes, 0),
    );

    // بودجهٔ ۱ (کمتر از حداقل زمان هر آیتم): هیچ آیتم قابل‌هزینه‌ای اضافه نمی‌شود؛
    // فقط تعهدات اثبات حفظ می‌شوند و زمان قابل‌هزینه صفر است (سازگار با قاعدهٔ §8.5).
    const q1 = await json(await app.request('/api/queue?limit=30&budgetMinutes=1', authed(token)));
    expect(q1.items.every((i: any) => i.attemptType === 'proof')).toBe(true);
    expect(q1.spendableMinutes).toBe(0);
    expect(q1.spentMinutes).toBe(q1.proofMinutes);
  });
});

