import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';
import pack from '../../../content/examples/demo-pack.json';

const ENV = {
  SESSION_SECRET: 'test-secret',
  ALLOW_DEMO_AUTH: 'true',
};

let store: MemoryStore;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
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

  it('وب‌هوک تلگرام پیام /start را با دکمه باز کردن MiniApp پاسخ می‌دهد', async () => {
    const res = await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 987654 },
          text: '/start',
        },
      }),
    });
    expect(res.status).toBe(200);
    const data = (await json(res)) as any;
    expect(data.method).toBe('sendMessage');
    expect(data.chat_id).toBe(987654);
    expect(data.reply_markup.inline_keyboard[0][0].web_app.url).toBeTruthy();
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
    expect(home.progress.overall).toBeGreaterThanOrEqual(0);
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
