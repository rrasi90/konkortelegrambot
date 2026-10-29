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
  buildDailyPlan,
  isTrackId,
  questionCardId,
  statusFromMastery,
  DEFAULT_MASTERY,
} from '@ael/engine';
import type { EngineState, PlanCandidate, QueueItem } from '@ael/engine';
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
    const dailyMinutes = Math.max(10, Math.min(480, user.dailyCapacity ?? 30));
    const state = await loadEngineState(user.id);
    const engineUser = { userId: user.id, activeTracks: user.activeTracks };
    const now = new Date();
    const dueQueue = buildDailyQueue(state, engineUser, { limit: Math.max(1, state.cards.length), now });
    const candidates: PlanCandidate[] = [];
    const candidateItems = new Map<string, QueueItem>();
    const newlyCreatedCards = new Map<string, ReviewCard>();

    const allowed = (nodeId: string): boolean => {
      const node = state.nodes.get(nodeId);
      return !!node && (node.track === 'common' || user.activeTracks.includes(node.track));
    };
    const dueQuestionIds = new Set<string>();
    for (const item of dueQueue) {
      candidateItems.set(item.card.id, item);
      if (item.card.cardType === 'question' && item.card.questionId) dueQuestionIds.add(item.card.questionId);
      const overdueDays = Math.max(0, (now.getTime() - new Date(item.card.dueAt).getTime()) / 86_400_000);
      candidates.push({
        id: item.card.id,
        targetId: item.card.id,
        actionType: item.card.isRepair ? 'remediation' : 'spaced_review',
        examValue: 0.5,
        expectedBenefit: item.card.isRepair ? 0.85 : item.card.cardType === 'trap_note' ? 0.55 : 0.65,
        urgency: Math.min(1, 0.55 + overdueDays / 14),
        estimatedMinutes: item.card.cardType === 'trap_note' ? 1 : 2,
        reason: 'مرور سررسیدشده؛ امتیاز رسمی آزمونی برای این مبحث هنوز از بستهٔ تأییدشده دریافت نشده است.',
      });
    }

    // Only non-holdout items may enter the ordinary queue. Holdout questions are
    // reserved for unseen verification and must never leak through the new-material path.
    const seenQuestionIds = new Set(
      state.cards
        .filter((card) => card.cardType === 'question' && card.timesSeen > 0)
        .map((card) => card.questionId)
        .filter((id): id is string => Boolean(id)),
    );
    const nowIso = now.toISOString();
    const freshQuestions = [...state.questions.values()].filter(
      (question) =>
        !question.isHoldout &&
        allowed(question.nodeId) &&
        !seenQuestionIds.has(question.id) &&
        !dueQuestionIds.has(question.id),
    );

    for (const question of freshQuestions) {
      const id = questionCardId(user.id, question.id);
      const existing = state.cards.find((card) => card.id === id);
      const card: ReviewCard = existing ?? {
        id,
        userId: user.id,
        nodeId: question.nodeId,
        cardType: 'question',
        questionId: question.id,
        dueAt: nowIso,
        intervalDays: 1,
        ease: 2.5,
        isRepair: false,
        timesSeen: 0,
        timesCorrect: 0,
      };
      const item: QueueItem = { card, question, ...(question.trapNote ? { trapNote: question.trapNote } : {}) };
      candidateItems.set(card.id, item);
      if (!existing) newlyCreatedCards.set(card.id, card);
      candidates.push({
        id: card.id,
        targetId: card.id,
        actionType: 'new_material',
        examValue: 0.5,
        expectedBenefit: 0.75,
        urgency: 0.55,
        estimatedMinutes: 3,
        reason: 'محتوای جدید؛ تا زمان ثبت ضرایب رسمی، ارزش آزمونی با مقدار خنثی ۰٫۵ برآورد شده است.',
      });
    }

    const plan = buildDailyPlan(candidates, {
      dailyMinutes,
      maxItems: limit,
      minimumNewMaterialShare: 0.25,
      maximumRemediationShare: 0.4,
    });
    const queue = plan.selected
      .map((planned) => candidateItems.get(planned.targetId))
      .filter((item): item is QueueItem => Boolean(item));

    const cardsToPersist = plan.selected
      .map((planned) => newlyCreatedCards.get(planned.targetId))
      .filter((card): card is ReviewCard => Boolean(card));
    if (cardsToPersist.length) {
      await store.upsertCards(cardsToPersist);
      for (const card of cardsToPersist) state.cards.push(card);
    }

    // Persist a compact audit trail: chosen actions plus the most relevant deferred alternatives.
    const decisions = [
      ...plan.selected.map((row) => ({ row, selected: true, note: row.selectionReason })),
      ...plan.deferred.slice(0, 20).map((row) => ({ row: { ...row.candidate, score: row.score }, selected: false, note: row.reason })),
    ].map(({ row, selected, note }) => ({
      id: crypto.randomUUID(),
      actionType: row.actionType,
      targetId: row.targetId,
      examValue: row.examValue,
      expectedBenefit: row.expectedBenefit,
      urgency: row.urgency,
      estimatedMinutes: row.estimatedMinutes,
      score: row.score,
      selected,
      reason: {
        note,
        officialExamWeightKnown: false,
        dailyBudgetMinutes: plan.budgetMinutes,
        plannerFormula: 'examValue * expectedBenefit * urgency / estimatedMinutes',
      },
      plannerVersion: '0.1.0',
    }));
    await store.logPlannerDecisions(user.id, tehranDateStr(), decisions);

    const items = await Promise.all(queue.map(async (item) => {
      const node = state.nodes.get(item.card.nodeId);
      const attemptId = item.card.cardType === 'question' && item.question
        ? await store.createQuestionAttempt(
            user.id,
            item.question.id,
            crypto.randomUUID(),
            900,
            item.card.timesSeen > 0,
            '1',
          )
        : undefined;
      const planned = plan.selected.find((row) => row.targetId === item.card.id);
      return {
        ...item,
        attemptId,
        estimatedMinutes: planned?.estimatedMinutes,
        priorityScore: planned?.score,
        planReason: planned?.selectionReason,
        question: item.question
          ? { ...item.question, correctOption: -1 as unknown as number }
          : undefined,
        course: node?.course,
        chapter: node?.chapter,
        topic: node?.topic,
      };
    }));
    return c.json({
      items,
      plan: {
        budgetMinutes: plan.budgetMinutes,
        usedMinutes: plan.usedMinutes,
        remainingMinutes: Math.max(0, plan.budgetMinutes - plan.usedMinutes),
        newMaterialMinutes: plan.newMaterialMinutes,
        remediationMinutes: plan.remediationMinutes,
        warnings: [
          ...plan.warnings,
          'وزن رسمی آزمونی هنوز به این بسته متصل نشده است؛ مقدار خنثی استفاده شده و امتیاز برنامه‌ریز یک heuristic است.',
        ],
      },
    });
  });

  app.post('/api/answers', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as
      | { attemptId?: string; questionId?: string; selectedOption?: number; responseTimeMs?: number; confidenceBefore?: number; assistance?: string[]; studyMode?: 'desk' | 'commute' | 'exam' }
      | null;
    if (
      !body ||
      typeof body.questionId !== 'string' ||
      typeof body.selectedOption !== 'number' || !Number.isInteger(body.selectedOption) || body.selectedOption < 0 ||
      typeof body.attemptId !== 'string' || body.attemptId.length < 8 || body.attemptId.length > 128 ||
      (body.responseTimeMs !== undefined && (!Number.isInteger(body.responseTimeMs) || body.responseTimeMs < 0 || body.responseTimeMs > 3_600_000)) ||
      (body.confidenceBefore !== undefined && (!Number.isInteger(body.confidenceBefore) || body.confidenceBefore < 1 || body.confidenceBefore > 5)) ||
      (body.assistance !== undefined && (!Array.isArray(body.assistance) || body.assistance.length > 10 || body.assistance.some((v) => typeof v !== 'string' || v.length > 100))) ||
      (body.studyMode !== undefined && !['desk', 'commute', 'exam'].includes(body.studyMode))
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
    const questionNode = state.nodes.get(question.nodeId);
    if (!questionNode || (questionNode.track !== 'common' && !user.activeTracks.includes(questionNode.track))) {
      return c.json({ error: 'این سؤال در مسیر فعال شما نیست' }, 403);
    }
    if (body.selectedOption >= question.options.length) return c.json({ error: 'شمارهٔ گزینه خارج از محدوده است' }, 400);

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
        responseTimeMs: body.responseTimeMs,
        confidenceBefore: body.confidenceBefore,
        assistance: body.assistance ?? [],
        studyMode: body.studyMode ?? 'desk',
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
      responseTimeMs: body.responseTimeMs,
      seenBefore: (currentQuestionCard?.timesSeen ?? 0) > 0,
      confidenceBefore: body.confidenceBefore,
      assistance: body.assistance ?? [],
      studyMode: body.studyMode ?? 'desk',
      engineVersion: '0.2.0',
      itemVersion: '1',
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
    const latestTodayByQuestion = new Map<string, (typeof todayAnswers)[number]>();
    for (const answer of [...todayAnswers].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))) {
      latestTodayByQuestion.set(answer.questionId, answer);
    }
    const wrongToday = [...latestTodayByQuestion.values()].filter((answer) => !answer.isCorrect);
    return c.json({
      user: {
        displayName: user.displayName,
        activeTracks: user.activeTracks,
        dailyCapacity: user.dailyCapacity ?? 30,
      },
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
        attemptId: await store.createQuestionAttempt(user.id, q.id, crypto.randomUUID(), 900, true, '1'),
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
    const body = (await c.req.json().catch(() => null)) as
      | { examDate?: string | null; dailyMinutes?: number }
      | null;
    if (!body || (!('examDate' in body) && !('dailyMinutes' in body))) {
      return c.json({ error: 'حداقل یک تنظیم باید ارسال شود' }, 400);
    }

    if ('examDate' in body && body.examDate != null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.examDate)) {
        return c.json({ error: 'تاریخ باید به شکل YYYY-MM-DD باشد' }, 400);
      }
      const date = new Date(`${body.examDate}T00:00:00Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== body.examDate) {
        return c.json({ error: 'تاریخ واردشده معتبر نیست' }, 400);
      }
    }
    if ('dailyMinutes' in body &&
        (!Number.isInteger(body.dailyMinutes) || body.dailyMinutes! < 10 || body.dailyMinutes! > 480)) {
      return c.json({ error: 'زمان مطالعه باید عدد صحیحی بین ۱۰ تا ۴۸۰ دقیقه باشد' }, 400);
    }

    let examDate: string | null | undefined;
    if ('examDate' in body) {
      const stats = await ensureStats(user.id);
      stats.examDate = body.examDate ?? null;
      await store.upsertStats(stats);
      examDate = stats.examDate;
    }
    if ('dailyMinutes' in body) {
      await store.setDailyCapacity(user.id, body.dailyMinutes!);
      user.dailyCapacity = body.dailyMinutes;
    }
    return c.json({
      ok: true,
      ...(examDate !== undefined ? { examDate } : {}),
      dailyMinutes: user.dailyCapacity ?? 30,
    });
  });

  return app;
}

/* برای محیط اجرای Cloudflare Workers */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const configuredSecret = typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32;
    const configuredDatabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
    if (!configuredSecret || !configuredDatabase) {
      return new Response(
        JSON.stringify({ error: 'پیکربندی امن کامل نیست؛ SUPABASE_URL، کلید سرویس و SESSION_SECRET حداقل ۳۲ نویسه‌ای لازم است.' }),
        { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
      );
    }
    return createApp(env).fetch(request);
  },
};
