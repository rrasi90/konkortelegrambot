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
  calculateRetrievability,
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
  computePriorityV3,
  derivePrereqMultiplier,
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
  APP_URL?: string;
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
    // اگر کاربر در لایهٔ داده نباشد (مثلاً ری‌استارت حافظهٔ موقت) نشست باطل است؛
    // کلاینت با ورود خودکار مجدد پروفایل تازه می‌سازد. ساختن پروفایل جعلی اینجا ممنوع است.
    return store.getUser(userId);
  }

  /** پاسخ استاندارد درس‌نامه — بدون تکرار در چند مسیر */
  function lessonPayload(nodeId: string) {
    const lesson = findLessonForNode(nodeId);
    if (!lesson) return null;
    return {
      id: lesson.id,
      topic: lesson.topic,
      chapter: lesson.chapter,
      course: lesson.course,
      konkoorWeight: lesson.konkoorWeight,
      summary: lesson.summary,
      konkoorTips: lesson.konkoorTips,
      keyTerms: lesson.keyTerms,
    };
  }

  /** افزودن عنوان فارسی گره‌ها به دلتاهای تسلط برای نمایش در کلاینت */
  function enrichMasteryDeltas(
    report: { masteryDeltas?: { nodeId: string }[] } | null | undefined,
    nodes: Map<string, { topic: string; course: string; chapter: string }>,
  ) {
    if (!report?.masteryDeltas) return report;
    return {
      ...report,
      masteryDeltas: report.masteryDeltas.map((d) => {
        const n = nodes.get(d.nodeId);
        return { ...d, topic: n?.topic ?? d.nodeId, course: n?.course, chapter: n?.chapter };
      }),
    };
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
        streakFreezeMonth: null,
      }
    );
  }

  /** سهمیهٔ قفل زنجیره: ۲ بار در هر ماه شمسی/میلادیِ جاری (بر اساس تاریخ تهران) */
  const FREEZE_MONTHLY_LIMIT = 2;
  function freezeUsage(stats: UserStats) {
    const month = tehranDateStr().slice(0, 7);
    const used = stats.streakFreezeMonth === month ? stats.streakFreezeUsed : 0;
    return { used, remaining: Math.max(0, FREEZE_MONTHLY_LIMIT - used), limit: FREEZE_MONTHLY_LIMIT };
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

  const rateLimits = new Map<string,{count:number;resetAt:number}>();
  const RATE_WINDOW_MS = 60_000;
  const RATE_MAX = 30;
  function rateLimit(c:any,next:()=>void){
    const key = (c.req.header('authorization')||c.req.header('x-forwarded-for')||'anon') as string;
    const now = Date.now();
    const entry = rateLimits.get(key);
    if(!entry || now>entry.resetAt){ rateLimits.set(key,{count:1,resetAt:now+RATE_WINDOW_MS}); return next(); }
    if(entry.count>=RATE_MAX) return c.json({error:'درخواست بیش از حد مجاز'},429);
    entry.count++; return next();
  }
  // R-010: محدودکنندهٔ نرخ روی مسیرهای احراز هویت و ثبت پاسخ (قبلاً تعریف‌شده ولی متصل‌نشده بود)
  app.use('/api/auth/*', (c, next) => rateLimit(c, next));
  app.use('/api/answers', (c, next) => rateLimit(c, next));
  app.use('/api/self-report', (c, next) => rateLimit(c, next));
  app.use('/api/telegram/webhook*', (c, next) => rateLimit(c, next));

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
    const appUrl = env.APP_URL || url.origin;

    const replyText = text.startsWith('/start')
      ? 'سلام! به سامانهٔ یادگیری تطبیقی «آموزش کنکور» خوش آمدید 🎓\n\nسامانهٔ هوشمند سنجش و تثبیت تسلط بر سرفصل‌های آزمون دکتری مدیریت.\n\nبرای شروع تمرین و ارزیابی هوشمند، روی دکمهٔ زیر بزنید:'
      : 'برای تمرین و یادگیری تطبیقی، لطفاً از دکمهٔ زیر استفاده کنید:';

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '🚀 باز کردن آموزش کنکور',
            web_app: { url: appUrl },
          },
        ],
      ],
    };

    if (env.TELEGRAM_BOT_TOKEN) {
      try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: replyText,
            reply_markup: replyMarkup,
          }),
        });
      } catch (e) {
        console.error('Failed to send telegram message directly:', e);
      }
    }

    return c.json({
      method: 'sendMessage',
      chat_id: chatId,
      text: replyText,
      reply_markup: replyMarkup,
    });
  });

  // استعلام وضعیت وب‌هوک تلگرام (جهت عیب‌یابی و پایش اتصال)
  app.get('/api/telegram/webhook/info', async (c) => {
    if (!env.TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN تنظیم نشده' }, 500);
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
      return c.json(await res.json());
    } catch (e) {
      return c.json({ ok: false, error: String(e) }, 500);
    }
  });

  // Endpoint تنظیم خودکار وب‌هوک تلگرام (برای اتصال ربات دائمی)
  app.post('/api/telegram/webhook/set', async (c) => {
    if (!env.TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN تنظیم نشده' }, 500);
    const url = new URL(c.req.url);
    const webhookUrl = `${url.origin}/api/telegram/webhook`;
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
      });
      const data = await res.json();
      if (!data.ok) return c.json({ ok: false, error: data.description }, 400);
      return c.json({ ok: true, url: webhookUrl, result: data.result });
    } catch (e) {
      return c.json({ ok: false, error: String(e) }, 500);
    }
  });

  // حذف وب‌هوک (برای عیب‌یابی)
  app.post('/api/telegram/webhook/delete', async (c) => {
    if (!env.TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN تنظیم نشده' }, 500);
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drop_pending_updates: true }),
      });
      return c.json(await res.json());
    } catch (e) {
      return c.json({ ok: false, error: String(e) }, 500);
    }
  });

  app.post('/api/auth/telegram', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      initData?: string;
      telegramUsername?: string;
      telegramUserId?: number | string;
      displayName?: string;
      deviceToken?: string;
    };

    // حالت ۱: ورود رسمی و خودکار از درون تلگرام با initData و اعتبارسنجی رمزنگاری‌شده
    if (body.initData) {
      if (!env.TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN تنظیم نشده' }, 500);
      const result = await verifyTelegramInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
      if (!result.ok) return c.json({ error: 'دادهٔ تلگرام نامعتبر: ' + result.error }, 401);

      let user = await store.getUserByTelegramId(result.userId);
      if (!user) {
        user = await store.createUser({
          telegramUserId: result.userId,
          telegramUsername: result.username,
          displayName: result.firstName || (result.username ? ('@' + result.username) : 'داوطلب دکتری'),
        });
      }
      return c.json({ token: await issueSessionToken(user.id, secret), user });
    }

    // حالت ۲: بازیابی پایدار بر پایه شناسه عددی تلگرام — فقط با پرچم دمو.
    // R-010: شناسه عددی تلگرام عمومی و قابل حدس است؛ پذیرش آن بدون امضای initData
    // یعنی تصاحب حساب هر کاربری. در پروداکشن (ALLOW_DEMO_AUTH=false که خودِ
    // createApp در production throw می‌کند اگر true باشد) این مسیر بسته است و
    // ورود واقعی از حالت ۱ (initData + HMAC) انجام می‌شود.
    if (body.telegramUserId !== undefined && body.telegramUserId !== null && body.telegramUserId !== '') {
      if (!allowDemoAuth) {
        return c.json({ error: 'ورود بدون امضای تلگرام مجاز نیست؛ از initData استفاده کنید' }, 401);
      }
      const numericId = Number(body.telegramUserId);
      if (!Number.isFinite(numericId) || numericId <= 0) {
        return c.json({ error: 'شناسه تلگرام نامعتبر است' }, 400);
      }
      let user = await store.getUserByTelegramId(numericId);
      const isNew = !user;
      if (!user) {
        user = await store.createUser({
          telegramUserId: numericId,
          displayName: body.displayName || 'داوطلب دکتری',
        });
      }
      // R-020 audit trail for demo-auth logins (mode 2)
      store
        .logAudit({
          userId: user.id,
          action: isNew ? 'demo_auth_create_user' : 'demo_auth_existing_user',
          entityType: 'app_user',
          entityId: user.id,
          details: { mode: 'telegramUserId', telegramUserId: numericId },
          sourceIp: c.req.header('x-forwarded-for') ?? null,
        })
        .catch((e) => console.error('[worker] audit log failed:', e));
      return c.json({ token: await issueSessionToken(user.id, secret), user });
    }

    // حالت ۳: ورود بر پایه توکن دستگاه — فقط با پرچم دمو (R-010).
    // توکن دستگاه چیزی است که کلاینت خودش انتخاب می‌کند؛ هر کسی که یک رشتهٔ
    // تصادفی ۱۶+ نویسه بسازد می‌تواند حساب جدید باز کند و در صورت تغییر client
    // روی همان مرورگر، مالک حساب دیگری را جای خود جا بزند. این مسیر برای
    // تست وب/محلی است، نه هویت‌بخشی پروداکشن.
    if (typeof body.deviceToken === 'string') {
      if (!allowDemoAuth) {
        return c.json({ error: 'ورود با توکن دستگاه فقط در دمو مجاز است' }, 401);
      }
      const cleanToken = body.deviceToken.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      // توکن کوتاه/خالی به حساب مشترک «dev_» منتهی می‌شود و مرز امنیتی است.
      if (cleanToken.replace(/^dev_/, '').length < 16) {
        return c.json({ error: 'توکن دستگاه نامعتبر است' }, 400);
      }
      const devUsername = 'dev_' + cleanToken.replace(/^dev_/, '');
      let user = (await store.getUserByTelegramUsername?.(devUsername)) ?? null;
      const isNew = !user;
      if (!user) {
        user = await store.createUser({
          telegramUsername: devUsername,
          displayName: body.displayName || 'داوطلب کنکور',
        });
      }
      store
        .logAudit({
          userId: user.id,
          action: isNew ? 'demo_auth_create_user' : 'demo_auth_existing_user',
          entityType: 'app_user',
          entityId: user.id,
          details: { mode: 'deviceToken' },
          sourceIp: c.req.header('x-forwarded-for') ?? null,
        })
        .catch((e) => console.error('[worker] audit log failed:', e));
      return c.json({ token: await issueSessionToken(user.id, secret), user });
    }

    // حالت ۳: ورود با نام کاربری فقط در محیط دمو مجاز است.
    // در پروداکشن، نام کاربری تلگرام بدون امضای initData قابل جعل است و
    // امکان تصاحب حساب دیگران را می‌دهد؛ بنابراین کاملاً بسته است.
    if (!allowDemoAuth) {
      return c.json({ error: 'ورود معتبر تلگرام یا توکن دستگاه لازم است' }, 401);
    }
    const rawUsername = (body.telegramUsername || body.displayName || '').trim();
    const finalUsername = rawUsername
      ? rawUsername.replace(/^@/, '').trim()
      : 'dev_auto_' + Math.random().toString(36).slice(2, 10);
    let user = (await store.getUserByTelegramUsername?.(finalUsername)) ?? null;
    if (!user) {
      user = await store.createUser({
        telegramUsername: finalUsername,
        displayName: rawUsername
          ? rawUsername.startsWith('@')
            ? rawUsername
            : '@' + finalUsername
          : 'داوطلب کنکور',
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

  // R-020 — انتخاب کنکور داوطلب (exam_selections)؛ اعتبارسنجی ساختاری سمت سرور
  app.get('/api/exam-selection', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const selection = await store.getActiveExamSelection(user.id);
    return c.json({ selection });
  });

  app.put('/api/exam-selection', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as
      | { examYear?: unknown; subGroupId?: unknown; combinationCode?: unknown; setCode?: unknown }
      | null;
    if (!body) return c.json({ error: 'ورودی نامعتبر' }, 400);
    const examYear = Number(body.examYear);
    if (!Number.isInteger(examYear) || examYear < 1390 || examYear > 1420) {
      return c.json({ error: 'سال کنکور نامعتبر است (1390–1420)' }, 400);
    }
    if (typeof body.subGroupId !== 'string' || body.subGroupId.trim().length === 0 || body.subGroupId.length > 64) {
      return c.json({ error: 'شناسه زیرگروه نامعتبر است' }, 400);
    }
    const optionalCode = (v: unknown): string | null | 'invalid' => {
      if (v === undefined || v === null || v === '') return null;
      if (typeof v !== 'string' && typeof v !== 'number') return 'invalid';
      const s = String(v).trim();
      return s.length > 0 && s.length <= 16 ? s : 'invalid';
    };
    const combinationCode = optionalCode(body.combinationCode);
    const setCode = optionalCode(body.setCode);
    if (combinationCode === 'invalid' || setCode === 'invalid') {
      return c.json({ error: 'کد ترکیب/مجموعه نامعتبر است' }, 400);
    }
    const selection = await store.saveExamSelection(user.id, {
      examYear,
      subGroupId: body.subGroupId.trim(),
      combinationCode,
      setCode,
    });
    store
      .logAudit({
        userId: user.id,
        action: 'exam_selection_saved',
        entityType: 'exam_selection',
        entityId: `${examYear}`,
        details: { examYear, subGroupId: body.subGroupId.trim(), combinationCode, setCode },
        sourceIp: c.req.header('x-forwarded-for') ?? null,
      })
      .catch((e) => console.error('[worker] audit log failed:', e));
    return c.json({ ok: true, selection });
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
    if (packs.length === 0) for (const t of ['common', 'business', 'technology', 'strategy', 'industrial'] as TrackId[]) tracks.add(t);
    return c.json({ tracks: [...tracks], packs });
  });

  // ---------- §8.1 آزمون تشخیصی (Phase 4) ----------
  // وضعیت اولیهٔ کاربر جدید UNKNOWN است؛ این مسیر شواهد تشخیصی جمع می‌کند.
  // خروجی: initial_skill_estimate (از state پس از ثبت پاسخ‌ها), evidence_count,
  // confidence, knowledge_gaps, unknown_topics, strengths, weaknesses, recommended_next_actions
  app.get('/api/diagnostic', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const requested = Number(c.req.query('count') ?? 10);
    const count = Number.isFinite(requested) ? Math.max(1, Math.min(20, Math.floor(requested))) : 10;
    const state = await loadEngineState(user.id);

    const allowed = (nodeId: string): boolean => {
      const n = state.nodes.get(nodeId);
      return !!n && (n.track === 'common' || user.activeTracks.includes(n.track));
    };
    const seenQuestionIds = new Set(state.cards.map((card) => card.questionId).filter(Boolean));
    // گره‌های ارزیابی‌نشده اول؛ تنوع با گروهبندی بر حسب course
    const unseen = [...state.questions.values()].filter(
      (q) => allowed(q.nodeId) && !seenQuestionIds.has(q.id) && q.examYear !== 1404,
    );
    const seen = [...state.questions.values()].filter(
      (q) => allowed(q.nodeId) && seenQuestionIds.has(q.id) && q.examYear !== 1404,
    );
    const diversify = (pool: Question[]): Question[] => {
      const byCourse = new Map<string, Question[]>();
      for (const q of pool) {
        const key = state.nodes.get(q.nodeId)?.course ?? 'unknown';
        const list = byCourse.get(key);
        if (list) list.push(q);
        else byCourse.set(key, [q]);
      }
      const queues = [...byCourse.values()];
      const out: Question[] = [];
      while (out.length < count && queues.some((list) => list.length > 0)) {
        for (const list of queues) {
          if (out.length >= count) break;
          const next = list.shift();
          if (next) out.push(next);
        }
      }
      return out;
    };
    const picked = [...diversify(unseen), ...diversify(seen)].slice(0, count);
    if (picked.length === 0) {
      return c.json({ error: 'برای سنجش تشخیصی سؤال قابل‌دسترس نیست؛ گرایش‌ها را بررسی کنید.' }, 409);
    }

    const tickets = picked.map((q) => ({
      attemptId: `att-${crypto.randomUUID()}`,
      questionId: q.id,
      attemptType: 'diagnostic' as const,
    }));
    // fail-closed: بدون بلیت، پاسخ ثبت‌ناپذیر است
    try {
      await store.issueAttemptTickets(user.id, tickets);
    } catch (error) {
      console.error('[worker] failed to issue diagnostic attempt tickets:', error);
      return c.json({ error: 'آزمون تشخیصی آماده نشد؛ لطفاً دوباره تلاش کنید.' }, 503);
    }

    store
      .insertDailyQueueItems(
        user.id,
        tehranMidnightIso().slice(0, 10),
        tickets.map((t, idx) => ({
          attemptId: t.attemptId,
          questionId: t.questionId,
          nodeId: picked[idx]!.nodeId,
          reason: 'diagnostic' as const,
          priority: null,
        })),
      )
      .catch((e) => console.error('[worker] daily_queue_items diagnostic persist failed:', e));

    const assessedNodeIds = new Set<string>();
    state.mastery.forEach((_v, nodeId) => assessedNodeIds.add(nodeId));
    const items = picked.map((q, idx) => {
      const node = state.nodes.get(q.nodeId);
      return {
        question: toPublicQuestion(q),
        course: node?.course,
        chapter: node?.chapter,
        topic: node?.topic,
        attemptId: tickets[idx]!.attemptId,
        attemptType: 'diagnostic' as const,
        masteryBefore: assessedNodeIds.has(q.nodeId) ? state.mastery.get(q.nodeId) ?? null : null,
        assessmentState: assessedNodeIds.has(q.nodeId) ? 'assessed' : ('unknown' as const),
      };
    });
    return c.json({
      items,
      count: picked.length,
      meta: {
        unassessed_node_count: picked.filter((q) => !assessedNodeIds.has(q.nodeId)).length,
        answer_registration: 'POST /api/answers با attemptId این آیتم‌ها (attemptType=diagnostic)',
        confidence_note:
          'خوداظهاری همراه پاسخ ثبت شود (self-report)؛ به‌تنهایی شاهد تسلط نیست.',
      },
    });
  });

  app.get('/api/queue', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const requestedLimit = Number(c.req.query('limit') ?? 10);
    // محدودهٔ امن: مقدار نامعتبر/منفی/کسر اعشار نباید صف را بشکند
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(50, Math.floor(requestedLimit)))
      : 10;
    const mode = c.req.query('mode') === 'commute' ? 'commute' : 'desk';
    const requestedBudget = Number(c.req.query('budgetMinutes') ?? 0);
    const budgetMinutes = Number.isFinite(requestedBudget) && requestedBudget > 0 ? requestedBudget : undefined;
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
    // R-011 (ARC-02): امتیاز اولویت فقط از تابع کاننیکال computePriorityV3 در @ael/utils
    // محاسبه می‌شود؛ خطر فراموشی از منحنی توانی FSRS (@ael/engine) مشتق می‌شود.
    const masteryMap = state.mastery;
    const examDate = stats.examDate ? new Date(`${stats.examDate}T00:00:00Z`) : undefined;
    const proofIds = new Set(proofCards.map((pc) => pc.id));
    // پیش‌نیازهای هر گره (yال ی «prerequisite»: source → target = پیش‌نیازهای source)
    const prereqByNode = new Map<string, string[]>();
    for (const dep of state.dependencies) {
      if (dep.relation !== 'prerequisite') continue;
      const list = prereqByNode.get(dep.source) ?? [];
      list.push(dep.target);
      prereqByNode.set(dep.source, list);
    }
    const scoreNowMs = Date.now();
    const scored = queue
      .filter((item) => isConceptualNode(item.card.nodeId))
      .map((item) => {
        const activityType = item.card.isProof
          ? ('proof' as const)
          : item.card.isRepair
            ? ('remedial' as const)
            : ('review' as const);
        const nodeId = item.card.nodeId;

        // §8.1: گره ارزیابی‌نشده = UNKNOWN، نه پیش‌فرض ساختگی ۵۰.
        // کمبود شاهد → بیشترین شکاف دانش؛ «ندانستن» ضعف نیست، نیاز به سنجش است.
        const masteryRaw = masteryMap.get(nodeId);
        const isUnassessed = masteryRaw === undefined;
        const knowledgeGap01 = isUnassessed ? 1 : Math.min(1, Math.max(0, (100 - masteryRaw!) / 100));

        let forgettingRisk: number;
        if (item.card.fsrs) {
          const elapsedDays = Math.max(
            0,
            (scoreNowMs - new Date(item.card.fsrs.lastReviewedAt).getTime()) / 86400000,
          );
          forgettingRisk = 1 - calculateRetrievability(item.card.fsrs.stability, elapsedDays);
        } else {
          // کارت بدون وضعیت FSRS: تقریب خطی نسبت تأخیر به فاصله (مستند در ARC-02)
          const overdueDays = (scoreNowMs - new Date(item.card.dueAt).getTime()) / 86400000;
          forgettingRisk =
            overdueDays <= 0 ? 0 : Math.min(0.9, overdueDays / Math.max(1, item.card.intervalDays));
        }

        // پیش‌نیاز ارزیابی‌نشده محافظه‌کارانه ۰: کاربر مبتدی بدون پیش‌نیاز به
        // محتوای پیشرفته نرود (خاصیت ۷ §۸.۴)
        const prereqScores = (prereqByNode.get(nodeId) ?? []).map(
          (pid) => masteryMap.get(pid) ?? 0,
        );
        const prereqMultiplier = derivePrereqMultiplier(prereqScores);

        let examProximity01 = 0;
        if (examDate) {
          const daysLeft = Math.max(0, (examDate.getTime() - scoreNowMs) / 86400000);
          examProximity01 = Math.max(0, Math.min(1, 1 - daysLeft / 90));
        }

        const examValue = calculateExamValue(nodeId, {
          examPackWeights: new Map<string, number>(),
          currentPack: '',
          masteryMap,
        });
        const benefit = isUnassessed
          // سود سنجش تشخیصی برای گره ناشناخته (حداکثر) — نه مرور یک حدس
          ? calculateExpectedBenefit('diagnostic', { masteryMap, evidenceLevel: 'none' })
          : calculateExpectedBenefit(activityType, {
              masteryMap,
              evidenceLevel: 'partial',
            });
        const minutes = estimatedMinutesForNode(nodeId);
        return {
          item,
          minutes,
          isProof: proofIds.has(item.card.id) || item.card.isProof === true,
          needsDiagnostic: isUnassessed,
          priority: computePriorityV3({
            examValue,
            knowledgeGap01,
            prereqMultiplier,
            forgettingRisk,
            examProximity01,
            expectedBenefit: benefit,
            minutes,
          }),
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
    // PR#3 port (aa35200): شکست صدور بلیت باید fail-closed باشد — صف بدون بلیت ثبت‌ناپذیر است
    try {
      await store.issueAttemptTickets(user.id, tickets);
    } catch (error) {
      console.error('[worker] failed to issue queue attempt tickets:', error);
      return c.json({ error: 'صف سؤال‌ها آماده نشد؛ لطفاً دوباره تلاش کنید.' }, 503);
    }

    // R-020 daily_queue_items persistence (best-effort, never blocks the response)
    {
      const queueDate = tehranMidnightIso().slice(0, 10);
      const rows: { attemptId: string; questionId: string; nodeId: string | null; reason: 'scheduled' | 'review' | 'new_material' | 'remedial' | 'proof' | 'night_quiz' | 'exam_simulation' | 'diagnostic'; priority: number }[] = [];
      for (const s of selected) {
        const attemptId = attemptIdByCard.get(s.item.card.id);
        const qid = s.item.card.questionId;
        if (!attemptId || !qid) continue;
        rows.push({
          attemptId,
          questionId: qid,
          nodeId: s.item.card.nodeId ?? null,
          reason: s.isProof ? 'proof' : 'scheduled',
          priority: s.priority,
        });
      }
      store
        .insertDailyQueueItems(user.id, queueDate, rows)
        .catch((e) => console.error('[worker] daily_queue_items persist failed:', e));
    }

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
        // نام‌های سازگار با مینی‌اپ (نسخه‌های قبلی از این کلیدها استفاده می‌کنند)
        courseTitle: node?.course,
        chapterTitle: node?.chapter,
        attemptId: attemptIdByCard.get(s.item.card.id),
        attemptType: s.isProof ? ('proof' as const) : ('practice' as const),
        // §8.1: وضعیت دانش پیش از این تلاش — بدون حدس ساختگی
        assessmentState: s.needsDiagnostic ? ('unknown' as const) : ('assessed' as const),
        masteryEstimate: s.needsDiagnostic ? null : masteryMap.get(s.item.card.nodeId) ?? null,
        evidenceLevel: s.needsDiagnostic ? ('none' as const) : ('partial' as const),
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

    // idempotency: تلاش تکراری همان نتیجهٔ قبلی را برمی‌گرداند
    const existing = await store.findAnswerByAttempt(user.id, body.attemptId);
    if (existing) {
      if (existing.questionId !== body.questionId) {
        return c.json({ error: 'شناسه تلاش قبلاً برای سؤال دیگری ثبت شده است' }, 400);
      }
      const state = await loadEngineState(user.id);
      const q = state.questions.get(existing.questionId);
      const stats = await ensureStats(user.id);
      const report = enrichMasteryDeltas(
        existing.rippleReport as { masteryDeltas?: { nodeId: string }[] } | undefined,
        state.nodes,
      );
      return c.json({
        report,
        wasCorrect: existing.isCorrect,
        correctOption: q?.correctOption,
        explanation: q?.explanation,
        trapNote: q?.trapNote,
        lesson: q ? lessonPayload(q.nodeId) : null,
        replay: true,
        stats: { coins: stats.coins, streakDays: stats.streakDays, dayNumber: stats.dayNumber },
      });
    }

    const state = await loadEngineState(user.id);
    const question = state.questions.get(body.questionId);
    if (!question) return c.json({ error: 'سؤال ناشناخته' }, 404);

    // PR#3 port (0d356ab/aa35200): نوع تلاش از بلیت صادرشدهٔ سمت سرور خوانده می‌شود،
    // نه از فیلد client — ارجاع client نمی‌تواند practice را به proof ارتقا دهد.
    let ticket;
    try {
      ticket = await store.getAttemptTicket(user.id, body.attemptId, body.questionId);
    } catch (error) {
      console.error('[worker] failed to read attempt ticket:', error);
      return c.json({ error: 'اعتبار تلاش بررسی نشد؛ صف را تازه‌سازی کنید.' }, 503);
    }
    // R-020 audit trail (best-effort): attempts on unknown/consumed/expired tickets are suspicious
    const auditRejected = (reason: string) =>
      store
        .logAudit({
          userId: user.id,
          action: `answer_ticket_${reason}`,
          entityType: 'attempt_ticket',
          entityId: body.attemptId,
          details: { questionId: body.questionId, path: '/api/answers' },
          sourceIp: c.req.header('x-forwarded-for') ?? null,
        })
        .catch((e) => console.error('[worker] audit log failed:', e));

    if (!ticket) {
      await auditRejected('not_found');
      return c.json({ error: 'بلیت معتبر برای این سؤال پیدا نشد؛ صف را تازه‌سازی کنید.' }, 400);
    }
    if (ticket.consumedAt || new Date(ticket.expiresAt).getTime() <= Date.now()) {
      await auditRejected(ticket.consumedAt ? 'already_consumed' : 'expired');
      return c.json({ error: 'بلیت این تلاش مصرف‌شده یا منقضی است؛ صف را تازه‌سازی کنید.' }, 409);
    }

    const attemptType =
      ticket.attemptType === 'proof' || ticket.attemptType === 'holdout'
        ? 'proof'
        : ticket.attemptType === 'practice' ||
            ticket.attemptType === 'diagnostic' ||
            ticket.attemptType === 'verification'
          ? ticket.attemptType
          : null;
    if (!attemptType) {
      return c.json({ error: 'نوع این تلاش هنوز در موتور یادگیری پشتیبانی نمی‌شود.' }, 400);
    }

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
      // کلید صریح درست/غلط در ریشهٔ پاسخ (کلاینت مینی‌اپ به آن نیاز دارد)
      wasCorrect,
      report: enrichMasteryDeltas(result.report, state.nodes),
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
      lesson: lessonPayload(question.nodeId),
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
    /** نمای تخت سازگار با کلاینت‌های قدیمی (nodes + mastery) */
    const flatNodes: {
      id: string;
      course: string;
      chapter: string;
      topic: string;
      mastery: number | null;
      status: string;
      coverageStatus?: string;
    }[] = [];
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
      flatNodes.push({
        id: n.id,
        course: n.course,
        chapter: n.chapter,
        topic: n.topic,
        mastery,
        status,
        coverageStatus: coverage?.coverageStatus,
      });
    }
    return c.json({
      courses: [...courses.values()].map((c) => ({
        course: c.course,
        chapters: [...c.chapters.values()],
      })),
      nodes: flatNodes,
      mastery: Object.fromEntries(
        flatNodes.map((n) => [n.id, { mastery: n.mastery, status: n.status, coverageStatus: n.coverageStatus }]),
      ),
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
    const overall = (visible.length && masteryRows.length > 0)
      ? visible.reduce((sum, n) => sum + (masteryByNode.get(n.id) ?? 0), 0) / visible.length
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
      nightQuiz: {
        available: wrongToday.length > 0,
        wrongCount: wrongToday.length,
        // نام سازگار با نسخه‌های قبلی مینی‌اپ
        wrongAnswersCount: wrongToday.length,
      },
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
    // خوداظهاری فقط برای پاسخ غلط معنا دارد؛ پاسخ درست نباید نوع خطا ثبت کند
    if (event.isCorrect) {
      return c.json({ error: 'این تلاش درست بوده و نیاز به خوداظهاری خطا ندارد' }, 400);
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
            coverageStatus:
              body.selfReport === 'slip'
                ? (current?.coverageStatus ?? 'diagnosed')
                : 'remediated',
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
    const picked = wrongIds
      .map((id) => questionMap.get(id))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .sort(() => Math.random() - 0.5);

    // برای هر آیتم کوییز شبانه بلیت تلاش صادر می‌کنیم؛ بدون آن ثبت پاسخ ممکن نیست
    const tickets = picked.map((q) => ({
      attemptId: `att-${crypto.randomUUID()}`,
      questionId: q.id,
      attemptType: 'verification' as const,
    }));
    try {
      await store.issueAttemptTickets(user.id, tickets);
    } catch (error) {
      console.error('[worker] failed to issue night-quiz attempt tickets:', error);
      return c.json({ error: 'کوییز شبانه آماده نشد؛ لطفاً دوباره تلاش کنید.' }, 503);
    }

    // R-020 persist night-quiz queue items (best-effort)
    store
      .insertDailyQueueItems(
        user.id,
        tehranMidnightIso().slice(0, 10),
        tickets.map((t, i) => ({
          attemptId: t.attemptId,
          questionId: t.questionId,
          nodeId: picked[i]?.nodeId ?? null,
          reason: 'night_quiz' as const,
          priority: null,
        })),
      )
      .catch((e) => console.error('[worker] daily_queue_items persist failed:', e));

    const items = picked.map((q, i) => {
      const node = nodeMap.get(q.nodeId);
      return {
        card: { questionId: q.id, nodeId: q.nodeId, cardType: 'question' as const },
        question: toPublicQuestion(q),
        course: node?.course,
        chapter: node?.chapter,
        topic: node?.topic,
        courseTitle: node?.course,
        chapterTitle: node?.chapter,
        attemptId: tickets[i]?.attemptId,
        attemptType: 'verification' as const,
      };
    });
    return c.json({ items });
  });

  /* ---------- قفل کردن روز پیوسته (Streak Freeze) ---------- */
  app.post('/api/streak/freeze', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const stats = await ensureStats(user.id);
    if (stats.streakDays < 3) return c.json({ error: 'حداقل ۳ روز پیوسته برای قفل لازم است' }, 400);
    const month = tehranDateStr().slice(0, 7);
    if (stats.streakFreezeMonth !== month) {
      stats.streakFreezeUsed = 0;
      stats.streakFreezeMonth = month;
    }
    if (stats.streakFreezeUsed >= 2) return c.json({ error: 'حداکثر ۲ بار در ماه مجاز است', used: stats.streakFreezeUsed }, 400);
    stats.streakFreezeUsed += 1;
    await store.upsertStats(stats);
    return c.json({ ok: true, streakFreezeUsed: stats.streakFreezeUsed, streakDays: stats.streakDays, month, message: 'روز پیوسته قفل شد؛ اگر امروز مطالعه نکنی، زنجیره حفظ می‌شود' });
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

  /* ---------- خطاها و مسیرهای ناشناخته ---------- */
  app.onError((err, c) => {
    // پیام داخلی به کلاینت نشت نمی‌کند؛ جزئیات فقط در لاگ ورکر
    console.error('[worker] unhandled error:', err instanceof Error ? err.stack : err);
    return c.json({ error: 'خطای داخلی سرور؛ لطفاً دوباره تلاش کنید' }, 500);
  });

  app.notFound((c) =>
    c.req.path.startsWith('/api/')
      ? c.json({ error: 'مسیر API یافت نشد' }, 404)
      : c.text('Not Found', 404),
  );

  return app;
}

/* برای محیط اجرای Cloudflare Workers */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return createApp(env).fetch(request);
  },
};
