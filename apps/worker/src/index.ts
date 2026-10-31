import { COURSES_LESSONS, findLessonForNode } from './lessons-data';
let globalMemoryStore: DataStore | null = null;

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
import { skillMetaMap, estimatedMinutesForNode, skillForNode, skillTitle, nodeForSkill } from './skills-data';
import {
  calculateUrgencyV2,
  calculateExamValue,
  calculateExpectedBenefit,
} from '@ael/utils';
import type { LearnerSkillState } from '@ael/contracts';

export interface Env {
  ENVIRONMENT?: string;
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
    isVerified: q.isVerified ?? false,
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
      : (globalMemoryStore ??= new MemoryStore()));
  const isProduction =
    env.ENVIRONMENT === 'production' ||
    (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env?.NODE_ENV === 'production');

  if (isProduction) {
    if (!env.SESSION_SECRET || env.SESSION_SECRET === 'dev-secret' || env.SESSION_SECRET.length < 16) {
      throw new Error('SECURITY VIOLATION: Secure SESSION_SECRET (min 16 chars) is strictly required in production.');
    }
    if (!options.store && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
      throw new Error('CONFIG ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are strictly required in production. In-memory store fallback is prohibited.');
    }
    if (env.ALLOW_DEMO_AUTH === 'true') {
      throw new Error('SECURITY VIOLATION: ALLOW_DEMO_AUTH must not be enabled in production.');
    }
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
    let user = await store.getUser(userId);
    if (!user && !env.SUPABASE_URL) {
      user = { id: userId, displayName: 'داوطلب', activeTracks: ['common', 'business'] };
      if ('users' in (store as any)) {
        (store as any).users.set(userId, user);
      }
    }
    return user;
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
        streakFreezeUsed: 0,
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
    const [nodes, deps, questions, masteryRows, cards, skillStates] = await Promise.all([
      store.listNodes(),
      store.listDependencies(),
      store.listQuestions(),
      store.listMastery(userId),
      store.listCards(userId),
      store.getSkillStates(userId).catch(() => [] as LearnerSkillState[]),
    ]);
    const mastery = new Map<string, number>();
    for (const row of masteryRows) mastery.set(row.nodeId, row.mastery);
    const skillStatesMap = new Map<string, LearnerSkillState>();
    for (const row of skillStates) skillStatesMap.set(row.skillId, row);
    return {
      config: { ...DEFAULT_ENGINE_CONFIG },
      nodes: new Map(nodes.map((n) => [n.id, n])),
      dependencies: deps,
      questions: new Map(questions.map((q) => [q.id, q])),
      mastery,
      cards: cards.map((c) => ({ ...c })),
      skills: skillMetaMap(),
      skillStates: skillStatesMap,
    };
  }

  /* ------------------------------ routes ------------------------------ */

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/lessons', (c) => c.json({ courses: COURSES_LESSONS }));

  app.post('/api/telegram/webhook', async (c) => {
    const update = (await c.req.json().catch(() => null)) as {
      message?: { chat?: { id?: number }; text?: string };
      edited_message?: { chat?: { id?: number }; text?: string };
    } | null;
    if (!update) return c.json({ ok: false }, 400);

    const message = update.message || update.edited_message;
    if (!message || !message.chat?.id) return c.json({ ok: true });

    const chatId = message.chat.id;
    const text = (message.text || '').trim();

    const url = new URL(c.req.url);
    const appUrl = url.origin;

    if (text.startsWith('/start')) {
      return c.json({
        method: 'sendMessage',
        chat_id: chatId,
        text: 'سلام! به سامانهٔ یادگیری تطبیقی «آموزش کنکور» خوش آمدید 🎓\n\nسامانهٔ هوشمند سنجش و تثبیت تسلط بر سرفصل‌های آزمون دکتری مدیریت.\n\nبرای شروع تمرین و ارزیابی هوشمند، روی دکمهٔ زیر بزنید:',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🚀 باز کردن آموزش کنکور',
                web_app: { url: appUrl },
              },
            ],
          ],
        },
      });
    }

    return c.json({
      method: 'sendMessage',
      chat_id: chatId,
      text: 'برای تمرین و یادگیری تطبیقی، لطفاً از دکمهٔ زیر استفاده کنید:',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🚀 باز کردن آموزش کنکور',
              web_app: { url: appUrl },
            },
          ],
        ],
      },
    });
  });

  app.post('/api/auth/telegram', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      initData?: string;
      telegramUsername?: string;
      displayName?: string;
    };

    // حالت ۱: ورود رسمی از درون تلگرام با initData
    if (body.initData) {
      if (!env.TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN تنظیم نشده' }, 500);
      const result = await verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
      if (!result.ok) return c.json({ error: 'دادهٔ تلگرام نامعتبر: ' + result.error }, 401);

      let user = await store.getUserByTelegramId(result.userId);
      if (!user) {
        user = await store.createUser({
          telegramUserId: result.userId,
          displayName: result.firstName || 'داوطلب دکتری',
        });
      }
      return c.json({ token: await issueSessionToken(user.id, secret), user });
    }

    // حالت ۲: ورود از طریق نام کاربری یا شناسه داوطلب در وب
    const rawUsername = (body.telegramUsername || body.displayName || '').trim();
    if (!rawUsername) {
      return c.json({ error: 'لطفاً شناسه یا نام کاربری تلگرام خود را وارد کنید' }, 400);
    }

    const clean = rawUsername.replace(/^@/, '').trim();
    let user = (await store.getUserByTelegramUsername?.(clean)) ?? null;
    if (!user) {
      user = await store.createUser({
        telegramUsername: clean,
        displayName: rawUsername.startsWith('@') ? rawUsername : `@${clean}`,
      });
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

  app.get('/api/tracks', async (c) => {
    const packs = await store.listPacks().catch(() => []);
    const tracks = new Set<TrackId>(['common']);
    for (const p of packs) for (const t of p.tracks) tracks.add(t);
    if (packs.length === 0) for (const t of ['common', 'business', 'technology', 'strategy'] as TrackId[]) tracks.add(t);
    return c.json({ tracks: [...tracks], packs });
  });

  app.get('/api/queue', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const limit = Math.min(Number(c.req.query('limit') ?? 10), 50);
    const mode = c.req.query('mode') === 'commute' ? 'commute' : 'desk';
    const budgetMinutes = Number(c.req.query('budgetMinutes') ?? 0) || undefined;
    const state = await loadEngineState(user.id);
    const engineUser = { userId: user.id, activeTracks: user.activeTracks };
    const stats = await ensureStats(user.id);

    // در حالت «در مسیر» (مترو)، سؤال‌های محاسباتی آمار کنار گذاشته می‌شوند
    const isConceptualNode = (nodeId: string): boolean =>
      mode === 'desk' || !nodeId.startsWith('stats.');

    // کارت‌های تازه: اگر صف سررسیدشده‌ها پر نشد، برای سؤال‌های دیده‌نشدهٔ گرایش‌های فعال کارت بساز
    let queue = buildDailyQueue(state, engineUser, { limit: 50 });
    if (queue.length < limit) {
      const seenQuestionIds = new Set(state.cards.map((card) => card.questionId).filter(Boolean));
      const allowed = (nodeId: string): boolean => {
        const n = state.nodes.get(nodeId);
        return !!n && (n.track === 'common' || user.activeTracks.includes(n.track));
      };
      const freshQuestions = [...state.questions.values()].filter(
        (q) =>
          allowed(q.nodeId) &&
          !seenQuestionIds.has(q.id) &&
          q.examYear !== 1404 && // قرنطینه ۱۴۰۴ فقط از مسیر اثبات تسلط باز می‌شود
          isConceptualNode(q.nodeId),
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
        queue = buildDailyQueue(state, engineUser, { limit: 50 });
      }
    }

    // ---------- گام ۴: آزمونک اثبات تسلط (Holdout Proof) ----------
    // مهارت با احتمال تسلط ≥ ۰٫۷۵ و پوششِ نیازمند اثبات → ۱ سؤال قرنطینهٔ ۱۴۰۴ همان گره
    const now = new Date();
    const proofCards: ReviewCard[] = [];
    for (const st of (state.skillStates ?? new Map()).values()) {
      if (st.coverageStatus !== 'needs_proof') continue;
      const meta = (state.skills ?? new Map()).get(st.skillId);
      if (!meta) continue;
      const proofQuestion = [...state.questions.values()].find(
        (q) => q.nodeId === meta.nodeId && q.examYear === 1404,
      );
      if (!proofQuestion) continue;
      const proofCardId = questionCardId(user.id, proofQuestion.id);
      const existing = state.cards.find((card) => card.id === proofCardId);
      if (existing) {
        // کارت اثبات قبلی همچنان باز است؛ موعدش را به امروز می‌آوریم
        if (!existing.isProof) continue; // قبلاً به‌عنوان تمرین عادی پاسخ داده شده
        existing.isProof = true;
        existing.dueAt = now.toISOString();
        proofCards.push(existing);
      } else {
        const proofCard: ReviewCard = {
          id: proofCardId,
          userId: user.id,
          nodeId: proofQuestion.nodeId,
          cardType: 'question',
          questionId: proofQuestion.id,
          dueAt: now.toISOString(),
          intervalDays: 1,
          ease: 2.5,
          isRepair: false,
          timesSeen: 0,
          timesCorrect: 0,
          isProof: true,
        };
        proofCards.push(proofCard);
        state.cards.push(proofCard);
      }
    }
    if (proofCards.length > 0) {
      await store.upsertCards(proofCards);
      // کارت‌های اثبات به صف جاری اضافه شوند (ساخت queue پیش از تزریق بود)
      for (const pc of proofCards) {
        if (!queue.some((q) => q.card.id === pc.id)) {
          queue = [...queue, { card: pc, question: state.questions.get(pc.questionId ?? '') }];
        }
      }
    }

    // ---------- گام ۳: برنامه‌ریز بودجه‌محور (ROI Planner) ----------
    // Priority = ExamValue × ExpectedBenefit × Urgency ÷ EstimatedMinutes
    const masteryMap = state.mastery;
    const examDate = stats.examDate ? new Date(`${stats.examDate}T00:00:00Z`) : undefined;
    const proofIds = new Set(proofCards.map((pc) => pc.id));
    const scored = queue
      .filter((item) => isConceptualNode(item.card.nodeId))
      .map((item) => {
        const activityType = item.card.isProof
          ? ('proof' as const)
          : item.card.isRepair
            ? ('remedial' as const)
            : ('review' as const);
        const urgency = calculateUrgencyV2(
          { intervalDays: item.card.intervalDays, dueAt: item.card.dueAt, nodeId: item.card.nodeId },
          { masteryMap, examDate },
        );
        const examValue = calculateExamValue(item.card.nodeId, {
          examPackWeights: new Map<string, number>(),
          currentPack: '',
          masteryMap,
        });
        const benefit = calculateExpectedBenefit(activityType, {
          masteryMap,
          evidenceLevel: 'partial',
        });
        const minutes = estimatedMinutesForNode(item.card.nodeId);
        return {
          item,
          minutes,
          isProof: proofIds.has(item.card.id) || item.card.isProof === true,
          priority: (examValue * benefit * urgency) / Math.max(1, minutes),
        };
      });
    const nonProof = scored
      .filter((s) => !s.isProof)
      .sort((a, b) => b.priority - a.priority);
    const proofItems = scored.filter((s) => s.isProof);

    // بودجهٔ زمانی روزانه: آیتم‌های اثبات همیشه می‌مانند؛ بقیه تا سقف بودجه
    let spentMinutes = 0;
    const selected: typeof scored = [...proofItems];
    for (const s of nonProof) {
      if (budgetMinutes !== undefined && spentMinutes + s.minutes > budgetMinutes && selected.length > proofItems.length) {
        continue;
      }
      selected.push(s);
      spentMinutes += s.minutes;
      if (selected.length >= limit) break;
    }

    // ---------- صدور بلیت تلاش (attempt tickets) ----------
    const attemptIdByCard = new Map<string, string>();
    const tickets: { attemptId: string; questionId: string; attemptType: 'practice' | 'proof'; itemVersion?: string }[] = [];
    for (const s of selected) {
      const qid = s.item.card.questionId;
      if (!qid) continue;
      const attemptId = `att-${crypto.randomUUID()}`;
      attemptIdByCard.set(s.item.card.id, attemptId);
      tickets.push({ attemptId, questionId: qid, attemptType: s.isProof ? 'proof' : 'practice' });
    }
    await store.issueAttemptTickets(user.id, tickets).catch(() => undefined);

    const items = selected.map((s) => {
      const node = state.nodes.get(s.item.card.nodeId);
      const skill = skillForNode(s.item.card.nodeId);
      return {
        ...s.item,
        // در پاسخ به کلاینت، سؤال بدون کلید پاسخ، بدون توضیح و بدون یادداشت دام ارسال می‌شود
        question: s.item.question ? toPublicQuestion(s.item.question) : undefined,
        course: node?.course,
        chapter: node?.chapter,
        topic: node?.topic,
        attemptId: attemptIdByCard.get(s.item.card.id),
        attemptType: s.isProof ? ('proof' as const) : ('practice' as const),
        estimatedMinutes: s.minutes,
        priority: Math.round(s.priority * 100) / 100,
        proofLabel: s.isProof ? '🎯 تست اثبات تسلط (سؤال دیده‌نشده)' : undefined,
        comparison: s.item.card.cardType === 'comparison_card'
          ? {
              skills: s.item.card.comparisonSkills ?? [],
              titles: (s.item.card.comparisonSkills ?? []).map((id) => skillTitle(id)).filter(Boolean),
            }
          : undefined,
        skillEvidence: skill ? { skillId: skill.id, estimatedMinutes: skill.estimatedMinutes } : undefined,
      };
    });
    return c.json({
      items,
      mode,
      budgetMinutes: budgetMinutes ?? null,
      spentMinutes,
    });
  });

  app.post('/api/answers', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as
      | {
          attemptId?: string;
          questionId?: string;
          selectedOption?: number;
          responseTimeMs?: number;
          confidenceRating?: number;
          selfReport?: 'slip' | 'didnt_know';
          attemptType?: 'practice' | 'diagnostic' | 'verification' | 'proof';
        }
      | null;
    if (
      !body ||
      typeof body.questionId !== 'string' ||
      typeof body.selectedOption !== 'number' ||
      typeof body.attemptId !== 'string'
    ) {
      return c.json({ error: 'ورودی نامعتبر' }, 400);
    }
    const confidenceRating =
      typeof body.confidenceRating === 'number'
        ? Math.max(1, Math.min(5, Math.round(body.confidenceRating)))
        : undefined;
    const responseTimeMs =
      typeof body.responseTimeMs === 'number' && body.responseTimeMs >= 0
        ? Math.min(body.responseTimeMs, 30 * 60_000)
        : undefined;
    const selfReport =
      body.selfReport === 'slip' || body.selfReport === 'didnt_know' ? body.selfReport : undefined;
    const attemptType =
      body.attemptType === 'proof' || body.attemptType === 'diagnostic' || body.attemptType === 'verification'
        ? body.attemptType
        : 'practice';

    // idempotency: تلاش تکراری همان نتیجهٔ قبلی را برمی‌گرداند
    const existing = await store.findAnswerByAttempt(user.id, body.attemptId);
    if (existing) {
      if (existing.questionId !== body.questionId) {
        return c.json({ error: 'شناسه تلاش قبلاً برای سؤال دیگری ثبت شده است' }, 400);
      }
      const state = await loadEngineState(user.id);
      const q = state.questions.get(existing.questionId);
      const lesson = q ? findLessonForNode(q.nodeId) : null;
      return c.json({
        report: existing.rippleReport,
        correctOption: q?.correctOption,
        explanation: q?.explanation,
        trapNote: q?.trapNote,
        lesson: lesson ? {
          id: lesson.id,
          topic: lesson.topic,
          chapter: lesson.chapter,
          course: lesson.course,
          konkoorWeight: lesson.konkoorWeight,
          summary: lesson.summary,
          konkoorTips: lesson.konkoorTips,
          keyTerms: lesson.keyTerms,
        } : null,
        replay: true,
      });
    }

    const state = await loadEngineState(user.id);
    const question = state.questions.get(body.questionId);
    if (!question) return c.json({ error: 'سؤال ناشناخته' }, 404);

    const engineUser = { userId: user.id, activeTracks: user.activeTracks };
    let result;
    try {
      result = applyAnswer(
        state,
        {
          userId: user.id,
          questionId: body.questionId,
          attemptId: body.attemptId,
          selectedOption: body.selectedOption,
          responseTimeMs,
          confidenceRating,
          selfReport,
          attemptType,
        },
        engineUser,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطای موتور';
      return c.json({ error: message }, 400);
    }

    const wasCorrect = result.report.wasCorrect;

    // ثبت اتمیک و امن در دیتابیس (RPC امن: تعیین کلید سمت سرور + مصرف بلیت تلاش)
    await store.submitAnswerAtomic({
      userId: user.id,
      questionId: body.questionId,
      selectedOption: body.selectedOption,
      attemptId: body.attemptId,
      wasCorrect,
      rippleReport: result.report,
      masteryUpdates: result.masteryUpdates,
      cardUpserts: result.cardUpdates,
      cardInserts: result.createdCards,
    });

    // پایدارسازی وضعیت شش‌بعدی مهارت (learner_skill_states)
    if (result.skillStateUpdate) {
      await store
        .upsertSkillState(user.id, {
          skillId: result.skillStateUpdate.state.skillId,
          nodeId: result.skillStateUpdate.nodeId,
          state: result.skillStateUpdate.state,
        })
        .catch(() => undefined);
    }

    // آمار انگیزشی: سکه + روز پیوسته (فقط برای پاسخ‌های تازه، نه replay)
    const stats = await applyStatsForAnswer(user.id, wasCorrect);

    const lesson = findLessonForNode(question.nodeId);
    // محتوای مقایسه برای کارت مفاهیم متشابه
    const comparison = result.createdCards.find((card) => card.cardType === 'comparison_card');
    return c.json({
      report: result.report,
      correctOption: question.correctOption,
      explanation: question.explanation,
      trapNote: question.trapNote,
      comparison: comparison
        ? {
            skills: comparison.comparisonSkills ?? [],
            titles: (comparison.comparisonSkills ?? []).map((id) => skillTitle(id)).filter(Boolean),
          }
        : undefined,
      proofReady: result.report.proofCandidate ?? undefined,
      lesson: lesson ? {
        id: lesson.id,
        topic: lesson.topic,
        chapter: lesson.chapter,
        course: lesson.course,
        konkoorWeight: lesson.konkoorWeight,
        summary: lesson.summary,
        konkoorTips: lesson.konkoorTips,
        keyTerms: lesson.keyTerms,
      } : null,
      replay: false,
      stats: { coins: stats.coins, streakDays: stats.streakDays, dayNumber: stats.dayNumber },
    });
  });

  app.get('/api/map', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const [nodes, masteryRows, skillStates] = await Promise.all([
      store.listNodes(),
      store.listMastery(user.id),
      store.getSkillStates(user.id).catch(() => [] as LearnerSkillState[]),
    ]);
    const masteryByNode = new Map(masteryRows.map((m) => [m.nodeId, m]));
    const coverageByNode = new Map<string, LearnerSkillState>();
    for (const st of skillStates) {
      const nodeId = nodeForSkill(st.skillId);
      if (nodeId) coverageByNode.set(nodeId, st);
    }
    const visible = nodes.filter(
      (n) => n.track === 'common' || user.activeTracks.includes(n.track),
    );
    const courses = new Map<
      string,
      {
        course: string;
        chapters: Map<
          string,
          {
            chapter: string;
            nodes: {
              id: string;
              topic: string;
              /** null = سنجیده‌نشده — نباید به‌شکل درصد تسلط نمایش داده شود */
              mastery: number | null;
              status: string;
              coverageStatus?: string;
              evidenceCount?: number;
              proficiency?: number;
            }[];
          }
        >;
      }
    >();
    for (const n of visible) {
      const row = masteryByNode.get(n.id);
      const coverage = coverageByNode.get(n.id);
      const assessed = !!row || !!coverage;
      const mastery = assessed ? (row?.mastery ?? DEFAULT_MASTERY) : null;
      const status = row?.status ?? (assessed ? statusFromMastery(mastery!) : 'unseen');
      if (!courses.has(n.course)) courses.set(n.course, { course: n.course, chapters: new Map() });
      const course = courses.get(n.course)!;
      if (!course.chapters.has(n.chapter)) course.chapters.set(n.chapter, { chapter: n.chapter, nodes: [] });
      course.chapters.get(n.chapter)!.nodes.push({
        id: n.id,
        topic: n.topic,
        mastery,
        status,
        coverageStatus: coverage?.coverageStatus,
        evidenceCount: coverage?.evidenceCount,
        proficiency: coverage ? Math.round(coverage.proficiencyProbability * 100) : undefined,
      });
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
  /* ---------- خوداظهاری نوع خطا پس از پاسخ غلط ---------- */
  app.post('/api/self-report', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as
      | { attemptId?: string; questionId?: string; selfReport?: 'slip' | 'didnt_know' }
      | null;
    if (
      !body ||
      typeof body.attemptId !== 'string' ||
      typeof body.questionId !== 'string' ||
      (body.selfReport !== 'slip' && body.selfReport !== 'didnt_know')
    ) {
      return c.json({ error: 'ورودی نامعتبر' }, 400);
    }
    const event = await store.findAnswerByAttempt(user.id, body.attemptId);
    if (!event || event.questionId !== body.questionId) {
      return c.json({ error: 'تلاش یافت نشد' }, 404);
    }
    const state = await loadEngineState(user.id);
    const question = state.questions.get(body.questionId);
    const skill = question ? skillForNode(question.nodeId) : undefined;
    if (skill) {
      const states = await store.getSkillStates(user.id);
      const current = states.find((s) => s.skillId === skill.id);
      const dominant = body.selfReport === 'slip' ? 'slip' : 'concept_gap';
      await store
        .upsertSkillState(user.id, {
          skillId: skill.id,
          nodeId: question!.nodeId,
          state: {
            skillId: skill.id,
            proficiencyProbability: current?.proficiencyProbability ?? 0.5,
            confidence: current?.confidence ?? 0.1,
            evidenceCount: current?.evidenceCount ?? 1,
            memoryRetrievability: current?.memoryRetrievability ?? 1,
            fluencySpeedRatio: current?.fluencySpeedRatio ?? 1,
            dominantErrorType: dominant,
            coverageStatus: current?.coverageStatus ?? 'diagnosed',
          },
        })
        .catch(() => undefined);
    }
    return c.json({
      ok: true,
      selfReport: body.selfReport,
      note:
        body.selfReport === 'slip'
          ? 'ثبت شد؛ فردا یک مرور سریع برای اطمینان در صف توست.'
          : 'ثبت شد؛ جدول مقایسه و مرور مفهومی در راه است.',
    });
  });

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

  /* ---------- قفل کردن روز پیوسته (Streak Freeze) ---------- */
  app.post('/api/streak/freeze', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const stats = await ensureStats(user.id);
    // محدودیت: حداکثر ۲ بار در ماه، فقط اگر streak >= 3 باشد
    if (stats.streakDays < 3) return c.json({ error: 'حداقل ۳ روز پیوسته برای قفل لازم است' }, 400);
    if (stats.streakFreezeUsed >= 2) return c.json({ error: 'حداکثر ۲ بار در ماه مجاز است', used: stats.streakFreezeUsed }, 400);
    stats.streakFreezeUsed += 1;
    await store.upsertStats(stats);
    return c.json({ ok: true, streakFreezeUsed: stats.streakFreezeUsed, streakDays: stats.streakDays, message: 'روز پیوسته قفل شد؛ اگر امروز مطالعه نکنی، زنجیره حفظ می‌شود' });
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
