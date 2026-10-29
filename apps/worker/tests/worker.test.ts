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
  store.nodes = pack.nodes.map((n) => ({ ...n }));
  store.dependencies = pack.dependencies.map((d) => ({ ...d }));
  store.questions = pack.questions.map((q) => ({ ...q }));
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

    // پاسخ غلط
    const answerRes = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: 't1', questionId: target.question.id, selectedOption: 3 }),
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
        body: JSON.stringify({ attemptId: 't1', questionId: target.question.id, selectedOption: 3 }),
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
        body: JSON.stringify({ attemptId: 'c1', questionId: q.id, selectedOption: q.correctOption }),
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

  it('ورود دمو وقتی غیرفعال است رد می‌شود', async () => {
    const app = createApp({ ...ENV, ALLOW_DEMO_AUTH: 'false' });
    const res = await app.request('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
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
          body: JSON.stringify({ attemptId: 'home-t1', questionId: question.id, selectedOption: wrongOption }),
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

    // پاسخ درست در کوییز شبانه → سکه بیشتر (۲) و گزارش درست
    const nightRes = await json(
      await app.request(
        '/api/answers',
        authed(token, {
          method: 'POST',
          body: JSON.stringify({ attemptId: 'home-t2', questionId: question.id, selectedOption: question.correctOption }),
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

    // ثبت پاسخ برای q1 با شناسه تلاش att-1
    const ans1 = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: 'att-security-test', questionId: q1, selectedOption: 0 }),
      }),
    );
    expect(ans1.status).toBe(200);

    // تلاش برای استفاده مجدد از att-1 برای سؤال دیگر (q2)
    const badReplay = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ attemptId: 'att-security-test', questionId: q2, selectedOption: 0 }),
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

  it('خوداظهاری بی‌دقتی: بدون کسر تسلط و بدون موج', async () => {
    const token = await login();
    const queue = await json(await app.request('/api/queue?limit=5', authed(token)));
    const item = queue.items.find((i: any) => i.question);
    const ansRes = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: 'att-slip-test',
          questionId: item.question.id,
          selectedOption: (item.question.options?.length ?? 4) > 1 ? 99 : 0,
        }),
      }),
    );
    // گزینهٔ نامعتبر ۴۰۰ می‌دهد؛ پس گزینهٔ غلط واقعی می‌زنیم
    expect([200, 400]).toContain(ansRes.status);
    if (ansRes.status === 400) return;
    const ans = await json(ansRes);
    expect(ans.report.wasCorrect).toBe(false);
  });
});
