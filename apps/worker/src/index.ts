/**
 * API اصلی سامانه — Cloudflare Workers (Hono)
 * همهٔ منطق تصمیم در @ael/engine است؛ این لایه فقط ارکستراسیون و پایدارسازی است.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import {
  DEFAULT_ENGINE_CONFIG,
  applyAnswer,
  buildDailyQueue,
  isTrackId,
  questionCardId,
  statusFromMastery,
  DEFAULT_MASTERY,
} from '@ael/engine';
import type { EngineState, QueueItem } from '@ael/engine';
import type { ReviewCard, TrackId, Question, PublicQuestion } from '@ael/contracts';
import { issueSessionToken, verifySessionToken, verifyTelegramInitData } from './auth';
import type { AppUser, DataStore, UserStats } from './store';
import { MemoryStore } from './memory-store';
import { SupabaseStore } from './store';

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SESSION_SECRET: string;
  TELEGRAM_BOT_TOKEN?: string;
  ALLOW_DEMO_AUTH?: string;
}

type AppContext = Context<{ Variables: { store: DataStore; secret: string; allowDemoAuth: boolean } }>;

export function toPublicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    nodeId: q.nodeId,
    examYear: q.examYear,
    text: q.text,
    options: q.options,
  };
}

export interface CreateAppOptions {
  /** برای تست: تزریق لایهٔ داده */
  store?: DataStore;
}

export function createApp(env: Env, options: CreateAppOptions = {}): Hono<{ Variables: { store: DataStore; secret: string; allowDemoAuth: boolean } }> {
  const app: Hono<{ Variables: { store: DataStore; secret: string; allowDemoAuth: boolean } }> = new Hono();
  app.use('*', cors());

  const store: DataStore =
    options.store ??
    (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? new SupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : new MemoryStore());
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' && (!env.SESSION_SECRET || env.SESSION_SECRET === 'dev-secret')) {
    throw new Error('SECURITY: SESSION_SECRET is required and must not use dev default in production');
  }
  const secret = env.SESSION_SECRET || 'dev-secret';
  const allowDemoAuth = env.ALLOW_DEMO_AUTH === 'true';

  app.use('*', async (c, next) => {
    c.set('store', store);
    c.set('secret', secret);
    c.set('allowDemoAuth', allowDemoAuth);
    await next();
  });

  /* ------------------------------ helpers ------------------------------ */


  async function currentUser(c: AppContext): Promise<AppUser | null> {
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const userId = await verifySessionToken(auth.slice(7), secret);
    if (!userId) return null;
    return store.getUser(userId);
  }

  function authError(c: AppContext) {
    return c.json({ error: 'ابتدا وارد شوید' }, 401);
  }

  /* ---------- آمار و انگیزش (الهام از واژه‌راه) ---------- */

  /** تاریخ امروز تهران به شکل YYYY-MM-DD (ایران از ۲۰۲۲ ساعت تابستانی ندارد) */
  function tehranDateStr(offsetDays = 0): string {
    const d = new Date(Date.now() + offsetDays * 86_400_000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d);
  }

  /** نیمه‌شب تهران امروز به‌صورت UTC ISO — مرز «امروز» برای پاسخ‌ها */
  function tehranMidnightIso(): string {
    return new Date(`${tehranDateStr()}T00:00:00+03:30`).toISOString();
  }

  function daysBetween(fromIsoDate: string, toIsoDate: string): number {
    return Math.round(
      (new Date(`${toIsoDate}T00:00:00Z`).getTime() - new Date(`${fromIsoDate}T00:00:00Z`).getTime()) /
        86_400_000,
    );
  }

  async function ensureStats(userId: string): Promise<UserStats> {
    return (
      (await store.getStats(userId)) ?? {
        userId,
        coins: 0,
        streakDays: 0,
        lastStudyDate: null,
        dayNumber: 0,
        examDate: null,
      }
    );
  }

  /** سکه و روز پیوسته را پس از اولین پاسخ روز به‌روز می‌کند */
  async function applyStatsForAnswer(userId: string, wasCorrect: boolean): Promise<UserStats> {
    const stats = await ensureStats(userId);
    const today = tehranDateStr();
    if (stats.lastStudyDate !== today) {
      stats.streakDays = stats.lastStudyDate === tehranDateStr(-1) ? stats.streakDays + 1 : 1;
      stats.dayNumber += 1;
      stats.lastStudyDate = today;
    }
    stats.coins += wasCorrect ? 2 : 1;
    await store.upsertStats(stats);
    return stats;
  }

  const MENTOR_MESSAGES = {
    newUser: 'خوش اومدی! هر روز چند سؤال، آرام ولی پیوسته — نقشهٔ تسلطت کم‌کم ساخته می‌شود.',
    streak: 'روز {n} پیوسته! همین آهنگ را حفظ کن؛ موتور موج، جای خالی‌ها را خودش پیدا می‌کند.',
    weak: 'امروز روی گره‌های قرمز نقشه تمرکز کن؛ پیش‌نیازهایشان هم با هم ترمیم می‌شوند.',
    strong: 'نقشه‌ات خوب پیش می‌رود؛ وقتشه گره‌های متزلزل را به تثبیت‌شده برسانی.',
  };

  function mentorMessageFor(stats: UserStats, overall: number, answeredToday: number): string {
    if (stats.streakDays === 0 || stats.dayNumber === 0) return MENTOR_MESSAGES.newUser;
    if (answeredToday === 0) return MENTOR_MESSAGES.weak;
    if (stats.streakDays >= 2) return MENTOR_MESSAGES.streak.replace('{n}', String(stats.streakDays));
    return overall >= 60 ? MENTOR_MESSAGES.strong : MENTOR_MESSAGES.weak;
  }

  async function loadEngineState(userId: string): Promise<EngineState> {
    const [nodes, deps, questions, masteryRows, cards] = await Promise.all([
      store.listNodes(),
      store.listDependencies(),
      store.listQuestions(),
      store.listMastery(userId),
      store.listCards(userId),
    ]);
    const mastery = new Map<string, number>();
    for (const row of masteryRows) mastery.set(row.nodeId, row.mastery);
    return {
      config: { ...DEFAULT_ENGINE_CONFIG },
      nodes: new Map(nodes.map((n) => [n.id, n])),
      dependencies: deps,
      questions: new Map(questions.map((q) => [q.id, q])),
      mastery,
      cards: cards.map((c) => ({ ...c })),
    };
  }

  /* ------------------------------ routes ------------------------------ */

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.post('/api/auth/telegram', async (c) => {
    const body = (await c.req.json()) as { initData?: string };
    if (!body.initData) return c.json({ error: 'initData لازم است' }, 400);
    if (!env.TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN تنظیم نشده' }, 500);
    const result = await verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
    if (!result.ok) return c.json({ error: 'دادهٔ تلگرام نامعتبر' }, 401);
    let user = await store.getUserByTelegramId(result.userId);
    if (!user) user = await store.createUser({ telegramUserId: result.userId, displayName: result.firstName });
    return c.json({ token: await issueSessionToken(user.id, secret), user });
  });

  app.post('/api/auth/demo', async (c) => {
    if (!allowDemoAuth) return c.json({ error: 'ورود دمو فعال نیست' }, 403);
    const body = (await c.req.json().catch(() => ({}))) as { displayName?: string };
    const user = await store.createUser({ displayName: body.displayName ?? 'داوطلب دمو' });
    return c.json({ token: await issueSessionToken(user.id, secret), user });
  });

  app.get('/api/me', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    return c.json({ user });
  });

  app.put('/api/tracks', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json()) as { tracks?: unknown };
    if (!Array.isArray(body.tracks)) return c.json({ error: 'tracks نامعتبر' }, 400);
    const tracks: TrackId[] = [];
    for (const t of body.tracks) {
      if (!isTrackId(t)) return c.json({ error: `گرایش نامعتبر: ${String(t)}` }, 400);
      tracks.push(t);
    }
    if (!tracks.includes('common')) tracks.unshift('common');
    await store.setActiveTracks(user.id, tracks);
    return c.json({ ok: true, tracks });
  });

  app.get('/api/queue', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const limit = Math.min(Number(c.req.query('limit') ?? 10), 50);
    const state = await loadEngineState(user.id);

    // کارت‌های تازه: اگر صف سررسیدشده‌ها پر نشد، برای سؤال‌های دیده‌نشدهٔ گرایش‌های فعال کارت بساز
    const engineUser = { userId: user.id, activeTracks: user.activeTracks };
    let queue = buildDailyQueue(state, engineUser, { limit });
    if (queue.length < limit) {
      const seenQuestionIds = new Set(state.cards.map((card) => card.questionId).filter(Boolean));
      const allowed = (nodeId: string): boolean => {
        const n = state.nodes.get(nodeId);
        return !!n && (n.track === 'common' || user.activeTracks.includes(n.track));
      };
      const freshQuestions = [...state.questions.values()].filter(
        (q) => allowed(q.nodeId) && !seenQuestionIds.has(q.id),
      );
      const now = new Date();
      const newCards: ReviewCard[] = [];
      for (const q of freshQuestions) {
        if (queue.length + newCards.length >= limit) break;
        const id = questionCardId(user.id, q.id);
        if (state.cards.some((card) => card.id === id)) continue;
        newCards.push({
          id,
          userId: user.id,
          nodeId: q.nodeId,
          cardType: 'question',
          questionId: q.id,
          dueAt: now.toISOString(),
          intervalDays: 1,
          ease: 2.5,
          isRepair: false,
          timesSeen: 0,
          timesCorrect: 0,
        });
      }
      if (newCards.length > 0) {
        await store.upsertCards(newCards);
        for (const card of newCards) state.cards.push(card);
        queue = buildDailyQueue(state, engineUser, { limit });
      }
    }

    const items = queue.map(
      (item) => {
        const node = state.nodes.get(item.card.nodeId);
        return {
          ...item,
          // در پاسخ به کلاینت، سؤال بدون کلید پاسخ، بدون توضیح و بدون یادداشت دام ارسال می‌شود
          question: item.question ? toPublicQuestion(item.question) : undefined,
          course: node?.course,
          chapter: node?.chapter,
          topic: node?.topic,
        };
      },
    );
    return c.json({ items });
  });

  app.post('/api/answers', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as
      | { attemptId?: string; questionId?: string; selectedOption?: number }
      | null;
    if (
      !body ||
      typeof body.questionId !== 'string' ||
      typeof body.selectedOption !== 'number' ||
      typeof body.attemptId !== 'string'
    ) {
      return c.json({ error: 'ورودی نامعتبر' }, 400);
    }

    // idempotency: تلاش تکراری همان نتیجهٔ قبلی را برمی‌گرداند
    const existing = await store.findAnswerByAttempt(user.id, body.attemptId);
    if (existing) {
      const state = await loadEngineState(user.id);
      const q = state.questions.get(existing.questionId);
      return c.json({
        report: existing.rippleReport,
        correctOption: q?.correctOption,
        explanation: q?.explanation,
        trapNote: q?.trapNote,
        replay: true,
      });
    }

    const state = await loadEngineState(user.id);
    const question = state.questions.get(body.questionId);
    if (!question) return c.json({ error: 'سؤال ناشناخته' }, 404);

    const engineUser = { userId: user.id, activeTracks: user.activeTracks };
    const result = applyAnswer(
      state,
      {
        userId: user.id,
        questionId: body.questionId,
        attemptId: body.attemptId,
        selectedOption: body.selectedOption,
      },
      engineUser,
    );

    const wasCorrect = result.report.wasCorrect;

    await store.insertAnswerEvent({
      id: crypto.randomUUID(),
      userId: user.id,
      questionId: body.questionId,
      selectedOption: body.selectedOption,
      isCorrect: wasCorrect,
      attemptId: body.attemptId,
      answeredAt: new Date().toISOString(),
      rippleReport: result.report,
    });
    await store.upsertMastery(user.id, result.masteryUpdates);
    await store.upsertCards([...result.cardUpdates, ...result.createdCards]);

    // آمار انگیزشی: سکه + روز پیوسته (فقط برای پاسخ‌های تازه، نه replay)
    const stats = await applyStatsForAnswer(user.id, wasCorrect);

    return c.json({
      report: result.report,
      correctOption: question.correctOption,
      explanation: question.explanation,
      trapNote: question.trapNote,
      replay: false,
      stats: { coins: stats.coins, streakDays: stats.streakDays, dayNumber: stats.dayNumber },
    });
  });

  app.get('/api/map', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const [nodes, masteryRows] = await Promise.all([
      store.listNodes(),
      store.listMastery(user.id),
    ]);
    const masteryByNode = new Map(masteryRows.map((m) => [m.nodeId, m]));
    const visible = nodes.filter(
      (n) => n.track === 'common' || user.activeTracks.includes(n.track),
    );
    const courses = new Map<
      string,
      {
        course: string;
        chapters: Map<
          string,
          { chapter: string; nodes: { id: string; topic: string; mastery: number; status: string }[] }
        >;
      }
    >();
    for (const n of visible) {
      const row = masteryByNode.get(n.id);
      const mastery = row?.mastery ?? DEFAULT_MASTERY;
      const status = row?.status ?? statusFromMastery(mastery);
      if (!courses.has(n.course)) courses.set(n.course, { course: n.course, chapters: new Map() });
      const course = courses.get(n.course)!;
      if (!course.chapters.has(n.chapter)) course.chapters.set(n.chapter, { chapter: n.chapter, nodes: [] });
      course.chapters.get(n.chapter)!.nodes.push({ id: n.id, topic: n.topic, mastery, status });
    }
    return c.json({
      courses: [...courses.values()].map((c) => ({
        course: c.course,
        chapters: [...c.chapters.values()],
      })),
    });
  });

  /* ---------- داشبورد خانه (الهام از واژه‌راه) ---------- */
  app.get('/api/home', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const [stats, nodes, masteryRows, cards, todayAnswers] = await Promise.all([
      ensureStats(user.id),
      store.listNodes(),
      store.listMastery(user.id),
      store.listCards(user.id),
      store.listAnswersSince(user.id, tehranMidnightIso()),
    ]);
    const masteryByNode = new Map(masteryRows.map((m) => [m.nodeId, m.mastery]));
    const visible = nodes.filter(
      (n) => n.track === 'common' || user.activeTracks.includes(n.track),
    );
    const overall = visible.length
      ? visible.reduce((sum, n) => sum + (masteryByNode.get(n.id) ?? DEFAULT_MASTERY), 0) /
        visible.length
      : 0;
    const now = Date.now();
    const reviewDue = cards.filter((card) => {
      if (new Date(card.dueAt).getTime() > now) return false;
      const node = nodes.find((n) => n.id === card.nodeId);
      return !!node && (node.track === 'common' || user.activeTracks.includes(node.track));
    }).length;
    const wrongToday = todayAnswers.filter((a) => !a.isCorrect);
    return c.json({
      user: { displayName: user.displayName, activeTracks: user.activeTracks },
      stats: {
        coins: stats.coins,
        streakDays: stats.streakDays,
        dayNumber: stats.dayNumber,
        examDate: stats.examDate,
        daysLeft: stats.examDate ? daysBetween(tehranDateStr(), stats.examDate) : null,
      },
      progress: { overall: Math.round(overall), nodes: visible.length },
      today: { answered: todayAnswers.length, correct: todayAnswers.length - wrongToday.length },
      reviewDue,
      nightQuiz: { available: wrongToday.length > 0, wrongCount: wrongToday.length },
      mentorMessage: mentorMessageFor(stats, overall, todayAnswers.length),
    });
  });

  /* ---------- کوییز شبانه: مرور پاسخ‌های غلط امروز ---------- */
  app.get('/api/night-quiz', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const [todayAnswers, questions] = await Promise.all([
      store.listAnswersSince(user.id, tehranMidnightIso()),
      store.listQuestions(),
    ]);
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const nodeMap = new Map((await store.listNodes()).map((n) => [n.id, n]));
    const wrongIds = [...new Set(todayAnswers.filter((a) => !a.isCorrect).map((a) => a.questionId))];
    // ترتیب سؤال‌ها را می‌شکنیم؛ ترتیب گزینه‌ها ثابت می‌ماند (شناسهٔ گزینه کلید ثبت پاسخ است)
    const items = wrongIds
      .map((id) => questionMap.get(id))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .sort(() => Math.random() - 0.5)
      .map((q) => ({
        card: { questionId: q.id, nodeId: q.nodeId, cardType: 'question' as const },
        question: toPublicQuestion(q),
        course: nodeMap.get(q.nodeId)?.course,
        chapter: nodeMap.get(q.nodeId)?.chapter,
        topic: nodeMap.get(q.nodeId)?.topic,
      }));
    return c.json({ items });
  });

  /* ---------- تنظیمات: تاریخ کنکور ---------- */
  app.put('/api/settings', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as { examDate?: string | null } | null;
    if (!body || !('examDate' in body)) return c.json({ error: 'ورودی نامعتبر' }, 400);
    if (body.examDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(body.examDate)) {
      return c.json({ error: 'examDate باید YYYY-MM-DD باشد' }, 400);
    }
    const stats = await ensureStats(user.id);
    stats.examDate = body.examDate ?? null;
    await store.upsertStats(stats);
    return c.json({ ok: true, examDate: stats.examDate });
  });

  return app;
}

/* برای محیط اجرای Cloudflare Workers */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return createApp(env).fetch(request);
  },
};
