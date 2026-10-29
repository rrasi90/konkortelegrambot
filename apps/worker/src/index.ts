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
import type { ReviewCard, TrackId } from '@ael/contracts';
import { issueSessionToken, verifySessionToken, verifyTelegramInitData } from './auth';
import type { AppUser, DataStore, UserStats } from './store';
import { MemoryStore } from './memory-store';
import { SupabaseStore } from './store';

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SESSION_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  ALLOW_DEMO_AUTH?: string;
}

type AppContext = Context<{ Variables: { store: DataStore; secret: string; allowDemoAuth: boolean } }>;

export interface CreateAppOptions {
  /** برای تست: تزریق لایهٔ داده */
  store?: DataStore;
}

export function createApp(env: Env, options: CreateAppOptions = {}): Hono<{ Variables: { store: DataStore; secret: string; allowDemoAuth: boolean } }> {
  const app: Hono<{ Variables: { store: DataStore; secret: string; allowDemoAuth: boolean } }> = new Hono();
  app.use('*', cors());

  const allowDemoAuth = env.ALLOW_DEMO_AUTH === 'true';
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const secret = env.SESSION_SECRET ?? '';
  // MemoryStore is only allowed when explicitly enabling local/demo authentication.
  const store: DataStore = options.store ??
    (hasSupabase
      ? new SupabaseStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
      : allowDemoAuth
        ? new MemoryStore()
        : new MemoryStore());
  const configurationError = !secret || (!options.store && !hasSupabase && !allowDemoAuth);

  app.use('*', async (c, next) => {
    if (configurationError && c.req.path !== '/api/health') {
      return c.json({ error: 'محیط اجرا پیکربندی نشده است؛ پایگاه دادهٔ پایدار و SESSION_SECRET لازم است.' }, 503);
    }
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


  const MENTOR_MESSAGES = {
    newUser: 'خوش اومدی! هر روز چند سؤال، آرام ولی پیوسته — نقشهٔ تسلطت کم‌کم ساخته می‌شود.',
    streak: 'روز {n} پیوسته! همین آهنگ را حفظ کن؛ مرور و سؤال‌های تازه را ادامه بده.',
    weak: 'یک پاسخ اشتباه به‌تنهایی نشانهٔ ناتوانی نیست؛ اول نوع خطا را تشخیص می‌دهیم.',
    strong: 'پیشرفتت را با شواهد و سؤال‌های دیده‌نشده می‌سنجیم، نه فقط پاسخ‌های تکراری.',
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

  app.get('/api/health', (c) => c.json({ ok: !configurationError, configured: !configurationError }, configurationError ? 503 : 200));

  app.post('/api/auth/telegram', async (c) => {
    const body = (await c.req.json()) as { initData?: string };
    if (!body.initData) return c.json({ error: 'initData لازم است' }, 400);
    if (!env.TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN تنظیم نشده' }, 500);
    const result = await verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
    if (!result.ok) return c.json({ error: 'دادهٔ تلگرام نامعتبر' }, 401);
    let user = await store.getUserByTelegramId(result.userId);
    if (!user) {
      try {
        user = await store.createUser({ telegramUserId: result.userId, displayName: result.firstName });
      } catch (error) {
        // A concurrent first login may win the unique Telegram ID insert.
        user = await store.getUserByTelegramId(result.userId);
        if (!user) throw error;
      }
    }
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
    const requestedLimit = Number(c.req.query('limit') ?? 10);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) return c.json({ error: 'limit نامعتبر است' }, 400);
    const limit = Math.min(requestedLimit, 20);
    const state = await loadEngineState(user.id);

    // کارت‌های تازه: اگر صف سررسیدشده‌ها پر نشد، برای سؤال‌های دیده‌نشدهٔ گرایش‌های فعال کارت بساز
    const engineUser = { userId: user.id, activeTracks: user.activeTracks };
    let queue = buildDailyQueue(state, engineUser, { limit });
    if (queue.length < limit) {
      const seenQuestionIds = new Set(state.cards.filter((card) => card.cardType === 'question').map((card) => card.questionId).filter(Boolean));
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

    const items = await Promise.all(queue.map(async (item) => {
      const node = state.nodes.get(item.card.nodeId);
      const attemptId = item.card.cardType === 'question' && item.question
        ? await store.createQuestionAttempt(user.id, item.question.id, crypto.randomUUID(), 900)
        : undefined;
      return {
        ...item,
        attemptId,
        // Never send the answer key to the Mini App.
        question: item.question
          ? { ...item.question, correctOption: -1 as unknown as number }
          : undefined,
        course: node?.course,
        chapter: node?.chapter,
        topic: node?.topic,
      };
    }));
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
      typeof body.selectedOption !== 'number' || !Number.isInteger(body.selectedOption) || body.selectedOption < 0 ||
      typeof body.attemptId !== 'string' || body.attemptId.length < 8 || body.attemptId.length > 128
    ) {
      return c.json({ error: 'ورودی نامعتبر' }, 400);
    }

    // idempotency: تلاش تکراری همان نتیجهٔ قبلی را برمی‌گرداند
    const existing = await store.findAnswerByAttempt(user.id, body.attemptId);
    if (existing) {
      return c.json({ report: existing.rippleReport, replay: true });
    }

    const state = await loadEngineState(user.id);
    const question = state.questions.get(body.questionId);
    if (!question) return c.json({ error: 'سؤال ناشناخته' }, 404);

    const engineUser = { userId: user.id, activeTracks: user.activeTracks };
    const currentQuestionCard = state.cards.find((card) => card.cardType === 'question' && card.questionId === question.id);
    const result = applyAnswer(
      state,
      {
        userId: user.id,
        questionId: body.questionId,
        attemptId: body.attemptId,
        selectedOption: body.selectedOption,
        seenBefore: (currentQuestionCard?.timesSeen ?? 0) > 0,
      },
      engineUser,
    );

    const wasCorrect = result.report.wasCorrect;
    const answeredAt = new Date().toISOString();
    const commit = await store.commitAnswer({
      id: crypto.randomUUID(),
      userId: user.id,
      questionId: body.questionId,
      selectedOption: body.selectedOption,
      isCorrect: wasCorrect,
      attemptId: body.attemptId,
      answeredAt,
      rippleReport: result.report,
    }, result.masteryUpdates, [...result.cardUpdates, ...result.createdCards]);

    if (commit.replay) return c.json({ report: commit.report ?? result.report, replay: true });
    const stats = commit.stats ?? await ensureStats(user.id);
    return c.json({
      report: result.report,
      correctOption: question.correctOption,
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
    // Unseen skills are unknown, not 50% mastered; show observed evidence only.
    const observedMastery = visible
      .map((n) => masteryByNode.get(n.id))
      .filter((value): value is number => value !== undefined);
    const overall = observedMastery.length
      ? observedMastery.reduce((sum, value) => sum + value, 0) / observedMastery.length
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
      progress: { overall: Math.round(overall), nodes: visible.length, observedNodes: observedMastery.length, isEvidenceBased: true },
      today: { answered: todayAnswers.length, correct: todayAnswers.length - wrongToday.length },
      reviewDue,
      nightQuiz: { available: wrongToday.length > 0, wrongCount: wrongToday.length },
      mentorMessage: mentorMessageFor(stats, overall, todayAnswers.length),
    });
  });

  /* ---------- ثبت مرور کارت دام بدون ثبت پاسخ یا تغییر تسلط ---------- */
  app.post('/api/trap-cards/seen', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as { cardId?: string } | null;
    if (!body || typeof body.cardId !== 'string') return c.json({ error: 'cardId نامعتبر است' }, 400);
    const cards = await store.listCards(user.id);
    const card = cards.find((item) => item.id === body.cardId && item.cardType === 'trap_note');
    if (!card) return c.json({ error: 'کارت دام پیدا نشد' }, 404);
    card.timesSeen += 1;
    card.dueAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await store.upsertCards([card]);
    return c.json({ ok: true, dueAt: card.dueAt });
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
    // Use the latest event per question; a later correct response clears a stale wrong flag.
    const latestByQuestion = new Map<string, typeof todayAnswers[number]>();
    for (const answer of [...todayAnswers].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))) {
      latestByQuestion.set(answer.questionId, answer);
    }
    const wrongIds = [...latestByQuestion.values()].filter((a) => !a.isCorrect).map((a) => a.questionId);
    const items = await Promise.all(wrongIds
      .map((id) => questionMap.get(id))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .filter((q) => {
        const node = nodeMap.get(q.nodeId);
        return !!node && (node.track === 'common' || user.activeTracks.includes(node.track));
      })
      .sort(() => Math.random() - 0.5)
      .map(async (q) => ({
        card: { questionId: q.id, nodeId: q.nodeId, cardType: 'question' as const },
        attemptId: await store.createQuestionAttempt(user.id, q.id, crypto.randomUUID(), 900),
        question: { ...q, correctOption: -1 as unknown as number },
        course: nodeMap.get(q.nodeId)?.course,
        chapter: nodeMap.get(q.nodeId)?.chapter,
        topic: nodeMap.get(q.nodeId)?.topic,
      })));
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
