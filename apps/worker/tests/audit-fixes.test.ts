import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';
import pack from '../../../content/examples/demo-pack.json';

/**
 * رگرسیون‌های ممیزی جامع ۱۴۰۴-۰۸-۱۱ (R-034 تا R-038).
 * هر تست یک نقص تأییدشده را می‌بندد: سکه‌سازی، نشتی محتوای صف، تاریخ نامعتبر،
 * سقف تعداد صف و خوداظهاری شاهدساز.
 */

const ENV = {
  SESSION_SECRET: 'test-secret',
  ALLOW_DEMO_AUTH: 'true',
  TELEGRAM_WEBHOOK_SECRET: 'test_telegram_webhook_secret_2026_secure',
  ADMIN_API_TOKEN: 'test-admin-api-token-with-at-least-32-characters-2026',
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
  return ((await res.json()) as { token: string }).token;
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

// تاریخ تهران — همان کمکی که worker استفاده می‌کند (مرز روز و ماه)
function tehranDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d);
}

describe('R-034 — صف: نشتی و سقف', () => {
  it('آیتم صف برای سؤالِ تستی یادداشت دام و جزئیات داخلی کارت را افشا نمی‌کند', async () => {
    const token = await login();
    await app.request('/api/tracks', authed(token, { method: 'PUT', body: JSON.stringify({ tracks: ['business', 'technology', 'strategy', 'industrial'] }) }));
    const queue = await json(await app.request('/api/queue', authed(token)));
    expect(queue.items.length).toBeGreaterThan(0);

    const questionItem = queue.items.find((i: any) => i.question);
    expect(questionItem).toBeTruthy();
    // یادداشت دام پیش از پاسخ نباید در هیچ مسیری از آیتم باشد
    expect(questionItem.trapNote).toBeUndefined();
    expect(questionItem.question.trapNote).toBeUndefined();
    expect(questionItem.question.explanation).toBeUndefined();
    expect(questionItem.question.correctOption).toBeUndefined();
    // و جزئیات داخلی زمان‌بندی FSRS هم به کلاینت نمی‌رود
    expect(questionItem.card.ease).toBeUndefined();
    expect(questionItem.card.fsrs).toBeUndefined();
    expect(questionItem.card.timesSeen).toBeUndefined();
    expect(questionItem.card.userId).toBeUndefined();
  });

  it('هنگامی که کارت‌های اثبات خودِ limit را پر می‌کنند، صف بیشتر از limit نمی‌شود', async () => {
    const token = await login();
    const me = await json(await app.request('/api/me', authed(token)));
    const userId = me.user.id as string;

    // دو کارت اثبات دقیقاً سقف را پر می‌کنند؛ آیتم غیراثبات نباید اضافه شود
    // (قاعدهٔ §8.5: کارت‌های اثبات تعهد قبلی‌اند و می‌مانند، پس با limit=2 و
    // دو اثبات، خروجی باید همان ۲ بماند نه ۳).
    const baseQuestion = store.questions.find((q) => q.nodeId === 'sm.rbv')!;
    for (let i = 0; i < 2; i++) {
      const q = { ...baseQuestion, id: `q-proof-${i}`, trapNote: undefined };
      store.questions.push(q);
      store.cards.set(`q:${q.id}`, {
        id: `q:${q.id}`,
        userId,
        nodeId: q.nodeId,
        cardType: 'question',
        questionId: q.id,
        dueAt: new Date(Date.now() - 60_000).toISOString(),
        intervalDays: 1,
        ease: 2.5,
        isRepair: false,
        isProof: true,
        timesSeen: 1,
        timesCorrect: 1,
      });
    }

    // یک کارت تمرینیِ رسیده هم اضافه می‌کنیم؛ پیش از رفع نقص، این کارت پس از
    // پر شدن سقف «اول push بعد break» باعث می‌شد صف limit+1 شود
    const extraQuestion = store.questions.find((q) => q.nodeId === 'stats.anova')!;
    store.cards.set(`q:${extraQuestion.id}`, {
      id: `q:${extraQuestion.id}`,
      userId,
      nodeId: extraQuestion.nodeId,
      cardType: 'question',
      questionId: extraQuestion.id,
      dueAt: new Date(Date.now() - 60_000).toISOString(),
      intervalDays: 1,
      ease: 2.5,
      isRepair: false,
      timesSeen: 2,
      timesCorrect: 0,
    });

    const queue = await json(await app.request('/api/queue?limit=2', authed(token)));
    expect(queue.items.length).toBeLessThanOrEqual(2);
  });
});

describe('R-035 — سکه: مسیر چرخه‌ای بسته شد', () => {
  it('پاسخ درستِ دوبارهٔ همان سؤال در همان روز سکهٔ جدید نمی‌سازد', async () => {
    const token = await login();
    await app.request('/api/tracks', authed(token, { method: 'PUT', body: JSON.stringify({ tracks: ['business', 'technology', 'strategy', 'industrial'] }) }));

    const queue = await json(await app.request('/api/queue', authed(token)));
    const item = queue.items[0];
    const question = store.questions.find((q) => q.id === item.question.id)!;
    const wrongOption = (question.correctOption + 1) % question.options.length;

    // ۱) پاسخ غلط ⇒ ۱ سکه
    const wrong = await json(
      await app.request(
        '/api/answers',
        authed(token, { method: 'POST', body: JSON.stringify({ attemptId: item.attemptId, questionId: question.id, selectedOption: wrongOption }) }),
      ),
    );
    expect(wrong.stats.coins).toBe(1);

    // ۲) کوییز شبانه: اولین حل درستِ همان سؤال ⇒ سکه می‌گیرد
    const night1 = await json(await app.request('/api/night-quiz', authed(token)));
    const solved = await json(
      await app.request(
        '/api/answers',
        authed(token, { method: 'POST', body: JSON.stringify({ attemptId: night1.items[0].attemptId, questionId: question.id, selectedOption: question.correctOption }) }),
      ),
    );
    expect(solved.stats.coins).toBe(3);

    // ۳) درخواست دوبارهٔ کوییز شبانه: بلیت تازه می‌گیرد و کلید را می‌داند؛
    //    این چرخه نباید سکهٔ بی‌نهایت بسازد
    const night2 = await json(await app.request('/api/night-quiz', authed(token)));
    const farmed = await json(
      await app.request(
        '/api/answers',
        authed(token, { method: 'POST', body: JSON.stringify({ attemptId: night2.items[0].attemptId, questionId: question.id, selectedOption: question.correctOption }) }),
      ),
    );
    expect(farmed.stats.coins).toBe(3);
  });
});

describe('R-036 — تنظیمات و ورودی‌ها', () => {
  it('تاریخ ناموجود (۲۰۲۶-۰۲-۳۰) پذیرفته نمی‌شود', async () => {
    const token = await login();
    const bad = await app.request('/api/settings', authed(token, { method: 'PUT', body: JSON.stringify({ examDate: '2026-02-30' }) }));
    expect(bad.status).toBe(400);

    const good = await app.request('/api/settings', authed(token, { method: 'PUT', body: JSON.stringify({ examDate: '2026-05-30' }) }));
    expect(good.status).toBe(200);
  });

  it('فهرست گرایش‌ها بدون تکرار و سقف‌دار ذخیره می‌شود', async () => {
    const token = await login();
    const res = await json(
      await app.request(
        '/api/tracks',
        authed(token, { method: 'PUT', body: JSON.stringify({ tracks: ['business', 'business', 'strategy', 'industrial', 'technology', 'business'] }) }),
      ),
    );
    expect(res.tracks).toEqual(['common', 'business', 'strategy', 'industrial', 'technology']);

    const tooMany = await app.request(
      '/api/tracks',
      authed(token, { method: 'PUT', body: JSON.stringify({ tracks: Array.from({ length: 60 }, () => 'business') }) }),
    );
    expect(tooMany.status).toBe(400);
  });
});

describe('R-037 — خوداظهاری شاهد نمی‌سازد', () => {
  it('خوداظهاری «نمی‌دانستم» وضعیت مهارتِ بی‌شاهد نمی‌سازد و proven را تنزل نمی‌دهد', async () => {
    const token = await login();
    const me = await json(await app.request('/api/me', authed(token)));
    const userId = me.user.id as string;

    // یک پاسخ غلط ثبت می‌کنیم تا رویداد و بلیتش وجود داشته باشد
    await app.request('/api/tracks', authed(token, { method: 'PUT', body: JSON.stringify({ tracks: ['business', 'technology', 'strategy', 'industrial'] }) }));
    const queue = await json(await app.request('/api/queue', authed(token)));
    const item = queue.items[0];
    const question = store.questions.find((q) => q.id === item.question.id)!;
    const wrongOption = (question.correctOption + 1) % question.options.length;
    await app.request(
      '/api/answers',
      authed(token, { method: 'POST', body: JSON.stringify({ attemptId: item.attemptId, questionId: question.id, selectedOption: wrongOption }) }),
    );

    const before = await store.getSkillStates(userId);
    const report = await json(
      await app.request(
        '/api/self-report',
        authed(token, { method: 'POST', body: JSON.stringify({ attemptId: item.attemptId, questionId: question.id, selfReport: 'didnt_know' }) }),
      ),
    );
    expect(report.ok).toBe(true);

    const after = await store.getSkillStates(userId);
    // هیچ مهارتی با شاهد ساختگی اضافه نشده است
    for (const s of after) {
      const prev = before.find((b) => b.skillId === s.skillId);
      if (!prev) {
        expect(s.evidenceCount, `skill ${s.skillId} نباید با شاهد ساختگی ساخته شود`).toBe(0);
      }
      // و وضعیت چرخهٔ پوشش تنزل نمی‌یابد
      if (prev) expect(s.coverageStatus).toBe(prev.coverageStatus);
    }
  });
});

describe('R-039 — قفل زنجیره: خریده‌شده باید مصرف شود', () => {
  it('با یک قفل خریداری‌شده و یک روز gap، زنجیره حفظ و یک سهمیه مصرف می‌شود', async () => {
    const token = await login();
    const me = await json(await app.request('/api/me', authed(token)));
    const userId = me.user.id as string;

    const stats = await store.getStats(userId);
    await store.upsertStats({
      ...stats!,
      streakDays: 5,
      // دو روز پیش = دقیقاً یک روز از دست رفته
      lastStudyDate: tehranDate(-2),
      streakFreezeGranted: 1,
      streakFreezeUsed: 0,
      streakFreezeMonth: tehranDate().slice(0, 7),
    });

    const queue = await json(await app.request('/api/queue', authed(token)));
    const item = queue.items[0];
    const res = await json(
      await app.request(
        '/api/answers',
        authed(token, { method: 'POST', body: JSON.stringify({ attemptId: item.attemptId, questionId: item.question.id, selectedOption: 0 }) }),
      ),
    );
    expect(res.stats.streakDays).toBe(6);

    const after = await store.getStats(userId);
    expect(after!.streakFreezeUsed).toBe(1);
  });

  it('بدون قفل خریداری‌شده، همان gap زنجیره را به ۱ برمی‌گرداند', async () => {
    const token = await login();
    const me = await json(await app.request('/api/me', authed(token)));
    const userId = me.user.id as string;

    const stats = await store.getStats(userId);
    await store.upsertStats({
      ...stats!,
      streakDays: 5,
      lastStudyDate: tehranDate(-2),
      streakFreezeGranted: 0,
      streakFreezeUsed: 0,
      streakFreezeMonth: tehranDate().slice(0, 7),
    });

    const queue = await json(await app.request('/api/queue', authed(token)));
    const item = queue.items[0];
    const res = await json(
      await app.request(
        '/api/answers',
        authed(token, { method: 'POST', body: JSON.stringify({ attemptId: item.attemptId, questionId: item.question.id, selectedOption: 0 }) }),
      ),
    );
    expect(res.stats.streakDays).toBe(1);
  });
});

describe('R-038 — پیشرفت خانه: «بی‌شاهد» با صفر یکی نیست', () => {
  it('برای کاربری که فقط یک گره سنجیده شده، میانگین روی همان گره است نه کل گره‌ها', async () => {
    const token = await login();
    const me = await json(await app.request('/api/me', authed(token)));
    const userId = me.user.id as string;

    await store.upsertMastery(userId, [{ userId, nodeId: 'sm.rbv', mastery: 80, status: 'mastered' }]);

    const home = await json(await app.request('/api/home', authed(token)));
    expect(home.progress.assessedNodes).toBe(1);
    expect(home.progress.overall).toBe(80);
    expect(home.progress.nodes).toBeGreaterThan(1);
  });
});
