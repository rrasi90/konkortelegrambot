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
import type { AppUser, DataStore } from './store';
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

    const items: (QueueItem & { course?: string; chapter?: string; topic?: string })[] = queue.map(
      (item) => {
        const node = state.nodes.get(item.card.nodeId);
        return {
          ...item,
          // در پاسخ به کلاینت، متن سؤال بدون کلید صحیح ارسال می‌شود
          question: item.question
            ? { ...item.question, correctOption: -1 as unknown as number }
            : undefined,
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
      return c.json({ report: existing.rippleReport, replay: true });
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

    // پایدارسازی اتمی‌شونده: رویداد پاسخ + تسلط‌ها + کارت‌ها
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

    return c.json({ report: result.report, correctOption: question.correctOption, replay: false });
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

  return app;
}

/* برای محیط اجرای Cloudflare Workers */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return createApp(env).fetch(request);
  },
};
