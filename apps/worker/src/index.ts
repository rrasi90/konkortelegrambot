import { COURSES_LESSONS, findLessonForNode } from './lessons-data';
let globalMemoryStore: DataStore | null = null;

// حالت محدودکنندهٔ نرخ باید ماژول-سطح باشد: entrypoint Workers به‌ازای هر درخواست
// createApp(env) صدا می‌زند، پس Map داخل createApp هیچ‌وقت بیشتر از یک درخواست
// را نمی‌دید و ۴۲9 هرگز صادر نمی‌شد (در تست‌ها یک اپ مشترک reuse می‌شود و همین
// نقص پنهان می‌ماند). این‌جا مثل globalMemoryStore در سطح isolate نگه داشته می‌شود.
const globalRateLimits = new Map<string, { count: number; resetAt: number }>();

/** فقط برای تست: شمارنده‌های مشترک سطح isolate را پاک می‌کند تا هر تست از صفر شروع کند.
 * در پروداکشن صدا زده نمی‌شود (اثری بر رفتار محدودسازی ندارد). */
export function resetRateLimitsForTesting(): void {
  globalRateLimits.clear();
}

/**
 * API اصلی سامانه — Cloudflare Workers (Hono)
 * همهٔ منطق تصمیم در @ael/engine است؛ این لایه فقط ارکستراسیون و پایدارسازی است.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import {
  DEFAULT_ENGINE_CONFIG,
  ERROR_TYPE_CAUSES,
  applyAnswer,
  buildDailyQueue,
  buildExamSessionPlan,
  calculateRetrievability,
  isTrackId,
  questionCardId,
  QUARANTINE_HOLDOUT_YEAR,
  scoreExamSession,
  statusFromMastery,
} from '@ael/engine';
import type { EngineState, ExamSessionPlan, QueueItem } from '@ael/engine';
import type { ReviewCard, TrackId, Question, PublicQuestion } from '@ael/contracts';
import {
  ENGLISH_SKILLS,
  getCombination,
  getExamPath,
  getExamStructure,
  getExamStructureWarnings,
  getSubGroupSubjects,
  getSubGroups,
  isExamLevel,
  LATEST_EXAM_YEAR,
} from '@ael/contracts';
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
  TELEGRAM_WEBHOOK_SECRET?: string;
  ADMIN_API_TOKEN?: string;
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
  /** برای تست: شمارندهٔ مستقل محدودکنندهٔ نرخ */
  rateLimits?: Map<string, { count: number; resetAt: number }>;
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

  /** Token comparison without leaking the matching prefix through timing. */
  function constantTimeTokenEqual(expected: string, provided: string): boolean {
    if (expected.length !== provided.length) return false;
    let difference = 0;
    for (let i = 0; i < expected.length; i++) {
      difference |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
    }
    return difference === 0;
  }

  function isAdminAuthorized(c: AppContext): boolean {
    const expected = env.ADMIN_API_TOKEN;
    const authorization = c.req.header('Authorization') ?? '';
    if (!expected || expected.length < 32 || !authorization.startsWith('Bearer ')) return false;
    return constantTimeTokenEqual(expected, authorization.slice(7));
  }

  function adminAuthError(c: AppContext) {
    // Do not reveal whether the admin token is missing, malformed, or incorrect.
    return c.json({ error: 'دسترسی مدیریت مجاز نیست' }, 403);
  }

  function isValidTelegramWebhookSecret(value: string | undefined): value is string {
    // Telegram allows 1–256 URL-safe characters; require >=32 for operational entropy.
    return typeof value === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(value);
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

  /** تاریخ YYYY-MM-DD واقعی؛ regex تنها «۲۰۲۶-۰۲-۳۰» را رد نمی‌کند و آن مقدار
   * بعداً daysBetween را NaN و «روزهای مانده به کنکور» را خاموش می‌کرد. */
  function isRealISODate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
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
        streakFreezeGranted: 0,
        streakFreezeMonth: null,
      }
    );
  }

  /** سهمیهٔ قفل زنجیره: حداکثر ۲ قفل خریداری‌شده در هر ماه (تاریخ تهران).
   * streakFreezeGranted = قفل‌های خریده‌شده؛ streakFreezeUsed = قفل‌های واقعاً
   * مصرف‌شده برای حفظ زنجیره. تفکیک این دو لازم است وگرنه «خرید قفل» هیچ اثری
   * روی زنجیره ندارد (همان نقصی که در نسخهٔ قبل وجود داشت). */
  const FREEZE_MONTHLY_LIMIT = 2;
  function freezeQuota(stats: UserStats, month: string) {
    const granted = stats.streakFreezeMonth === month ? stats.streakFreezeGranted : 0;
    const used = stats.streakFreezeMonth === month ? stats.streakFreezeUsed : 0;
    return { granted, used, purchasable: Math.max(0, FREEZE_MONTHLY_LIMIT - granted), spendable: Math.max(0, granted - used) };
  }

  /** سکه و روز پیوسته را پس از پاسخ به‌روز می‌کند.
   * سکه فقط برای اولین «حل درست» هر سؤال در هر روز صادر می‌شود.
   * مسیر بسته‌شده: کاربر با یک بار پاسخ غلط، از کوییز شبانه/تشخیصی برای همان
   * سؤال بلیت تازه می‌گیرد و کلید را از پاسخ اول می‌داند؛ بدون این قاعده همان
   * چرخه بی‌نهایت سکه می‌ساخت. اثر موتور حافظه (FSRS) دست‌نخورده است، چون
   * تمرین تکراری از نظر یادگیری مجاز است. */
  async function applyStatsForAnswer(
    userId: string,
    wasCorrect: boolean,
    awardCoins: boolean,
  ): Promise<UserStats> {
    const stats = await ensureStats(userId);
    const today = tehranDateStr();
    if (stats.lastStudyDate !== today) {
      const month = today.slice(0, 7);
      const quota = freezeQuota(stats, month);
      const gap = stats.lastStudyDate ? daysBetween(stats.lastStudyDate, today) : null;
      stats.streakFreezeMonth = month;
      if (stats.lastStudyDate === tehranDateStr(-1)) {
        stats.streakDays += 1;
      } else if (gap === 2 && quota.spendable > 0) {
        // دقیقاً یک روز از دست رفته و قفل خریداری‌شده موجود است ⇒ زنجیره حفظ می‌شود
        stats.streakFreezeUsed = quota.used + 1;
        stats.streakDays += 1;
      } else {
        stats.streakDays = 1;
      }
      stats.dayNumber += 1;
      stats.lastStudyDate = today;
    }
    if (awardCoins) stats.coins += wasCorrect ? 2 : 1;
    await store.upsertStats(stats);
    return stats;
  }

  const MENTOR_MESSAGES = {
    newUser: 'خوش اومدی! هر روز چند سؤال، آرام ولی پیوسته — نقشهٔ تسلطت کم‌کم ساخته می‌شود.',
    streak: 'روز {n} پیوسته! همین آهنگ را حفظ کن؛ موتور موج، جای خالی‌ها را خودش پیدا می‌کند.',
    weak: 'امروز روی گره‌های قرمز نقشه تمرکز کن؛ پیش‌نیازهایشان هم با هم ترمیم می‌شوند.',
    strong: 'نقشه‌ات خوب پیش می‌رود؛ وقتشه گره‌های متزلزل را به تثبیت‌شده برسانی.',
  };

  function mentorMessageFor(stats: UserStats, overall: number | null, answeredToday: number): string {
    if (stats.streakDays === 0 || stats.dayNumber === 0) return MENTOR_MESSAGES.newUser;
    if (answeredToday === 0) return MENTOR_MESSAGES.weak;
    if (stats.streakDays >= 2) return MENTOR_MESSAGES.streak.replace('{n}', String(stats.streakDays));
    // بدون شاهد، ادعای «قوی بودن» ساخته نمی‌شود
    return (overall ?? 0) >= 60 ? MENTOR_MESSAGES.strong : MENTOR_MESSAGES.weak;
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

  // شمارندهٔ نرخ باید سطح isolate (ماژول) باشد: Workers به‌ازای هر درخواست
  // createApp(env) را صدا می‌زند، پس Map داخل createApp هیچ‌وقت بیش از یک
  // درخواست نمی‌بیند و ۴۲۹ هرگز صادر نمی‌شود.
  // نکتهٔ مهم (تأییدشده روی محیط زنده ۲۰۲۶-۱۱-۰۳): این رفتار نباید به
  // ENVIRONMENT مشروط شود — ورکر مستقرشده آن متغیر را ست نکرده بود و نسخهٔ
  // «اصلاح‌شده» همان رفتار بی‌اثر را در پروداکشن نگه داشت. پس پیش‌فرض همیشه
  // شمارندهٔ مشترک است و تست‌ها با options.rateLimits یک Map مستقل تزریق می‌کنند.
  const rateLimits = options.rateLimits ?? globalRateLimits;
  const RATE_WINDOW_MS = 60_000;
  const RATE_MAX = 30;

  /** اثر انگشت کوتاه کلید محدودکننده؛ خودِ کلید (توکن/IP) به کلاینت نشت نمی‌کند */
  async function keyFingerprint(key: string): Promise<string> {
    const bytes = new TextEncoder().encode(key);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest).slice(0, 4))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function rateLimit(c:any,next:()=>Promise<void>){
    const key = (c.req.header('authorization')||c.req.header('x-forwarded-for')||'anon') as string;
    const now = Date.now();
    // پاک‌سازی دوره‌ای: در پروداکشن شمارنده سطح isolate است و بدون این،
    // کلیدهای seen (هر IP/توکن) بی‌نهایت انباشته می‌شدند.
    if (rateLimits.size > 1000) {
      for (const [k, v] of rateLimits) if (now > v.resetAt) rateLimits.delete(k);
    }
    let entry = rateLimits.get(key);
    if(!entry || now>entry.resetAt){ entry = {count:1,resetAt:now+RATE_WINDOW_MS}; rateLimits.set(key,entry); }
    else if(entry.count>=RATE_MAX){
      // ۴۲۹ با هدرهای صریح (نه c.header بعد از ساخت پاسخ) تا در همهٔ runtimeها دیده شوند
      return c.json(
        { error: 'درخواست بیش از حد مجاز' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(RATE_MAX),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Window-Ms': String(RATE_WINDOW_MS),
          },
        },
      );
    }
    else entry.count++;
    // مشاهده‌پذیری (A-26): بدون این سرها نمی‌توان تشخیص داد که در پروداکشن
    // شمارنده واقعاً بین درخواست‌ها share می‌شود یا هر درخواست به isolate تازه می‌افتد.
    c.header('X-RateLimit-Limit', String(RATE_MAX));
    c.header('X-RateLimit-Remaining', String(Math.max(0, RATE_MAX - entry.count)));
    c.header('X-RateLimit-Window-Ms', String(RATE_WINDOW_MS));
    return keyFingerprint(key).then((fp) => {
      c.header('X-RateLimit-Key', fp);
      return next();
    });
  }
  // R-010: محدودکنندهٔ نرخ روی مسیرهای احراز هویت و ثبت پاسخ (قبلاً تعریف‌شده ولی متصل‌نشده بود)
  app.use('/api/auth/*', (c, next) => rateLimit(c, next));
  app.use('/api/answers', (c, next) => rateLimit(c, next));
  app.use('/api/self-report', (c, next) => rateLimit(c, next));
  app.use('/api/telegram/webhook*', (c, next) => rateLimit(c, next));
  // صدور بلیت/صف هم مصرف‌محور است؛ بدون این پوشش یک کاربر می‌تواند بی‌نهایت
  // تلاش جدید برای سؤالات قبلی بگیرد و سکه/تسلط دوباره بسازد.
  app.use('/api/night-quiz', (c, next) => rateLimit(c, next));
  app.use('/api/diagnostic', (c, next) => rateLimit(c, next));
  app.use('/api/exam-simulation*', (c, next) => rateLimit(c, next));

  app.get('/api/lessons', (c) => c.json({ courses: COURSES_LESSONS }));

  app.post('/api/telegram/webhook', async (c) => {
    const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;
    if (!isValidTelegramWebhookSecret(webhookSecret)) {
      return c.json({ error: 'وب‌هوک تلگرام تا زمان تنظیم TELEGRAM_WEBHOOK_SECRET غیرفعال است' }, 503);
    }
    const suppliedSecret = c.req.header('X-Telegram-Bot-Api-Secret-Token') ?? '';
    if (!constantTimeTokenEqual(webhookSecret, suppliedSecret)) {
      return c.json({ error: 'درخواست وب‌هوک نامعتبر است' }, 401);
    }

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
    const appUrl = env.APP_URL || (url.origin + '/?v=' + Date.now());

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
    if (!isAdminAuthorized(c)) return adminAuthError(c);
    if (!env.TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN تنظیم نشده' }, 503);
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
      return c.json(await res.json());
    } catch (e) {
      return c.json({ ok: false, error: String(e) }, 500);
    }
  });

  // Endpoint تنظیم خودکار وب‌هوک تلگرام (برای اتصال ربات دائمی)
  app.post('/api/telegram/webhook/set', async (c) => {
    if (!isAdminAuthorized(c)) return adminAuthError(c);
    if (!env.TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN تنظیم نشده' }, 503);
    if (!isValidTelegramWebhookSecret(env.TELEGRAM_WEBHOOK_SECRET)) {
      return c.json({ error: 'TELEGRAM_WEBHOOK_SECRET باید ۳۲ تا ۲۵۶ نویسهٔ مجاز داشته باشد' }, 503);
    }
    const url = new URL(c.req.url);
    const webhookUrl = `${url.origin}/api/telegram/webhook`;
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Never discard pending Telegram updates during a routine webhook configuration.
        body: JSON.stringify({ url: webhookUrl, secret_token: env.TELEGRAM_WEBHOOK_SECRET }),
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
    if (!isAdminAuthorized(c)) return adminAuthError(c);
    if (!env.TELEGRAM_BOT_TOKEN) return c.json({ error: 'TELEGRAM_BOT_TOKEN تنظیم نشده' }, 503);
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Keep queued updates; deleting the webhook must not silently erase messages.
        body: JSON.stringify({}),
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
    // آرایهٔ بی‌حد (مثلاً ۱۰۰٬۰۰۰ عنصر) نباید مستقیم ذخیره شود؛ سقف کار و
    // سپس حذف تکرارها، نتیجه را خودبه‌خود به اندازهٔ قرارداد محدود می‌کند.
    if (body.tracks.length > 50) {
      return c.json({ error: 'فهرست گرایش‌ها بیش از حد بلند است' }, 400);
    }
    const tracks: TrackId[] = [];
    for (const t of body.tracks) {
      if (!isTrackId(t)) return c.json({ error: `گرایش نامعتبر: ${String(t)}` }, 400);
      if (!tracks.includes(t)) tracks.push(t);
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
      (q) => allowed(q.nodeId) && !seenQuestionIds.has(q.id) && q.examYear !== QUARANTINE_HOLDOUT_YEAR,
    );
    const seen = [...state.questions.values()].filter(
      (q) => allowed(q.nodeId) && seenQuestionIds.has(q.id) && q.examYear !== QUARANTINE_HOLDOUT_YEAR,
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

  /* ---------- §8.7 — ساختار رسمی آزمون و شبیه‌سازی ---------- */

  app.get('/api/exam-structure', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const levelParam = c.req.query('level') ?? 'doctorate';
    if (!isExamLevel(levelParam)) {
      return c.json({ error: 'سطح آزمون نامعتبر است؛ «doctorate» یا «master».' }, 400);
    }
    const path = getExamPath(levelParam);
    const yearParam = c.req.query('year');
    const examYear = yearParam === undefined ? LATEST_EXAM_YEAR : Number(yearParam);
    if (!Number.isInteger(examYear) || examYear < 1390 || examYear > 1420) {
      return c.json({ error: 'سال آزمون نامعتبر است.' }, 400);
    }
    const subGroups = getSubGroups().map((g) => ({
      id: g.id,
      title: g.title,
      verification: g.verification,
      combinationCodes: g.combinationCodes,
      subjects: getSubGroupSubjects(g.id),
    }));

    if (path.serverSimulation !== 'available') {
      // صادقانه: ساختار سالانهٔ این سطح در سرور ثبت نشده و ادعا نمی‌شود
      return c.json({
        path,
        available: false,
        structure: null,
        reason: path.serverSimulationReason,
        subGroups,
      });
    }

    const structure = getExamStructure(levelParam, examYear);
    return c.json({
      path,
      available: true,
      structure,
      warnings: getExamStructureWarnings(levelParam, examYear),
      subGroups,
      combinations: subGroups.flatMap((g) =>
        g.combinationCodes.map((code) => ({
          combinationCode: code,
          subGroupId: g.id,
          titles: getCombination(code)?.titles ?? [],
          verification: getCombination(code)?.verification ?? 'needs_check',
        })),
      ),
    });
  });

  app.post('/api/exam-simulation/start', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as {
      level?: string;
      examYear?: number;
      subGroupId?: string;
      combinationCode?: string;
      scale?: number;
    } | null;
    if (!body) return c.json({ error: 'بدنهٔ درخواست نامعتبر است.' }, 400);
    if (!isExamLevel(body.level)) {
      return c.json({ error: 'سطح آزمون نامعتبر است؛ «doctorate» یا «master».' }, 400);
    }
    const path = getExamPath(body.level);
    if (path.serverSimulation !== 'available') {
      return c.json(
        { error: path.serverSimulationReason ?? 'شبیه‌سازی این سطح در سرور فعال نیست.', path },
        503,
      );
    }
    const examYear = Number(body.examYear ?? LATEST_EXAM_YEAR);
    if (!Number.isInteger(examYear) || examYear < 1390 || examYear > 1420) {
      return c.json({ error: 'سال آزمون نامعتبر است.' }, 400);
    }
    const subGroupId = String(body.subGroupId ?? '');
    const state = await loadEngineState(user.id);

    let plan: ExamSessionPlan;
    try {
      plan = buildExamSessionPlan({
        level: body.level,
        examYear,
        subGroupId,
        combinationCode:
          typeof body.combinationCode === 'string' ? body.combinationCode : undefined,
        questions: [...state.questions.values()],
        nodes: [...state.nodes.values()],
        scale: typeof body.scale === 'number' ? body.scale : undefined,
        newAttemptId: () => `att-${crypto.randomUUID()}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ساخت جلسهٔ شبیه‌سازی ممکن نشد.';
      return c.json({ error: message }, 400);
    }
    if (plan.answerSheet.length === 0) {
      return c.json(
        {
          error: 'برای این سال و گرایش، سؤال قابل‌استفاده‌ای در مخزن سرور نیست.',
          disclosures: plan.disclosures,
        },
        409,
      );
    }

    // fail-closed: بدون بلیت تک‌مصرف، پاسخ ثبت‌ناپذیر است
    try {
      await store.issueAttemptTickets(
        user.id,
        plan.ticketRequests.map((t) => ({ ...t, attemptType: 'exam_simulation' as const })),
      );
    } catch (error) {
      console.error('[worker] failed to issue exam simulation tickets:', error);
      return c.json({ error: 'جلسهٔ شبیه‌سازی آماده نشد؛ لطفاً دوباره تلاش کنید.' }, 503);
    }

    const expiresAt = new Date(
      Date.now() + (plan.durationMinutes ?? 180) * 60_000,
    ).toISOString();
    let session;
    try {
      session = await store.createExamSimulationSession({
        userId: user.id,
        level: plan.level,
        examYear: plan.examYear,
        subGroupId: plan.subGroupId,
        bookletCode: plan.bookletCode,
        plan,
        disclosures: plan.disclosures,
        expiresAt,
        items: plan.answerSheet.map((slot) => ({
          questionId: slot.questionId,
          sectionId: slot.sectionId,
          questionNumber: slot.questionNumber,
          attemptId: slot.attemptId,
        })),
      });
    } catch (error) {
      console.error('[worker] failed to persist exam simulation session:', error);
      return c.json({ error: 'ثبت جلسهٔ شبیه‌سازی ممکن نشد؛ لطفاً دوباره تلاش کنید.' }, 503);
    }

    const questionById = new Map([...state.questions.values()].map((q) => [q.id, q]));
    const items = plan.answerSheet.map((slot) => {
      const question = questionById.get(slot.questionId);
      return {
        questionNumber: slot.questionNumber,
        sectionId: slot.sectionId,
        attemptId: slot.attemptId,
        question: question ? toPublicQuestion(question) : null,
      };
    });

    return c.json({
      session: {
        id: session.id,
        level: plan.level,
        examYear: plan.examYear,
        subGroupId: plan.subGroupId,
        combinationCode: plan.combinationCode,
        subjects: plan.subjects,
        subjectAllocation: plan.subjectAllocation,
        bookletCode: plan.bookletCode,
        pathTitle: plan.pathTitle,
        status: session.status,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        durationMinutes: plan.durationMinutes,
        timingVerified: plan.timingVerified,
        officialTotalQuestions: plan.officialTotalQuestions,
        allocatedTotalQuestions: plan.allocatedTotalQuestions,
        coverageRatio: plan.coverageRatio,
        negativeMarkingRatio: plan.negativeMarkingRatio,
        sections: plan.sections,
        officiality: plan.contentOfficiality,
        contentOrigins: plan.contentOrigins,
      },
      items,
      disclosures: plan.disclosures,
      warnings: plan.warnings,
      answer_registration: 'POST /api/exam-simulation/answer با attemptId هر آیتم',
    });
  });

  app.post('/api/exam-simulation/answer', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as {
      sessionId?: string;
      attemptId?: string;
      questionId?: string;
      selectedOption?: number;
      responseTimeMs?: number;
    } | null;
    if (!body?.sessionId || !body.attemptId || !body.questionId) {
      return c.json({ error: 'شناسهٔ جلسه، تلاش و سؤال الزامی است.' }, 400);
    }
    if (!Number.isInteger(body.selectedOption)) {
      return c.json({ error: 'گزینهٔ انتخابی نامعتبر است.' }, 400);
    }
    // همان سقف /api/answers: ورودی زمان پاسخ نباید بی‌حد یا منفی ذخیره شود
    const responseTimeMs =
      typeof body.responseTimeMs === 'number' && Number.isFinite(body.responseTimeMs) && body.responseTimeMs >= 0
        ? Math.min(Math.round(body.responseTimeMs), 30 * 60_000)
        : null;
    const session = await store.getExamSimulationSession(user.id, body.sessionId);
    if (!session) return c.json({ error: 'جلسهٔ شبیه‌سازی پیدا نشد.' }, 404);
    if (session.status !== 'active') {
      return c.json({ error: 'این جلسه دیگر فعال نیست.' }, 409);
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return c.json({ error: 'زمان این جلسه به پایان رسیده است.' }, 409);
    }
    try {
      await store.recordExamSimulationResponse({
        userId: user.id,
        sessionId: session.id,
        attemptId: body.attemptId,
        questionId: body.questionId,
        selectedOption: body.selectedOption as number,
        responseTimeMs,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const conflict =
        raw.includes('already consumed') ||
        raw.includes('already answered') ||
        raw.includes('not active');
      // متن خام store (SQL/PostgREST) به کلاینت نشت نمی‌کند
      const message = conflict
        ? 'این تلاش یا جلسه دیگر قابل استفاده نیست.'
        : /outside the question options|invalid|does not exist/i.test(raw)
          ? 'دادهٔ این پاسخ پذیرفته نشد.'
          : 'ثبت پاسخ ممکن نشد.';
      return c.json({ error: message }, conflict ? 409 : 400);
    }
    // درستی پاسخ عمداً اعلام نمی‌شود — رفتار آزمون رسمی
    return c.json({ recorded: true });
  });

  app.post('/api/exam-simulation/submit', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as { sessionId?: string } | null;
    if (!body?.sessionId) return c.json({ error: 'شناسهٔ جلسه الزامی است.' }, 400);
    const session = await store.getExamSimulationSession(user.id, body.sessionId);
    if (!session) return c.json({ error: 'جلسهٔ شبیه‌سازی پیدا نشد.' }, 404);
    if (session.status === 'scored' && session.report) {
      return c.json({ report: session.report, already_scored: true });
    }
    const plan = session.plan as ExamSessionPlan | null;
    if (!plan) return c.json({ error: 'برنامهٔ جلسه بازتولید نشد.' }, 500);

    const [items, responses, questions] = await Promise.all([
      store.listExamSimulationItems(session.id),
      store.listExamSimulationResponses(session.id),
      store.listQuestions(),
    ]);
    const report = scoreExamSession(
      plan,
      questions,
      responses.map((r) => ({ questionId: r.questionId, selectedOption: r.selectedOption })),
    );
    await store.submitExamSimulationSession(session.id, report);
    return c.json({
      report,
      answered: responses.length,
      total: items.length,
    });
  });

  app.get('/api/exam-simulation/:id', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const sessionId = c.req.param('id');
    const session = await store.getExamSimulationSession(user.id, sessionId);
    if (!session) return c.json({ error: 'جلسهٔ شبیه‌سازی پیدا نشد.' }, 404);
    const items = await store.listExamSimulationItems(session.id);
    const questions = await store.listQuestions();
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const plan = session.plan as ExamSessionPlan | null;
    return c.json({
      session: {
        id: session.id,
        level: session.level,
        examYear: session.examYear,
        subGroupId: session.subGroupId,
        combinationCode: plan?.combinationCode ?? null,
        subjects: plan?.subjects ?? [],
        subjectAllocation: plan?.subjectAllocation ?? 'pooled',
        bookletCode: session.bookletCode,
        pathTitle: plan?.pathTitle ?? null,
        status: session.status,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        submittedAt: session.submittedAt,
        officiality: plan?.contentOfficiality ?? null,
        coverageRatio: plan?.coverageRatio ?? null,
        negativeMarkingRatio: plan?.negativeMarkingRatio ?? null,
      },
      items: items.map((item) => {
        const question = questionById.get(item.questionId);
        return {
          questionNumber: item.questionNumber,
          sectionId: item.sectionId,
          attemptId: item.attemptId,
          question: question ? toPublicQuestion(question) : null,
        };
      }),
      report: session.report,
      disclosures: session.disclosures,
    });
  });

  /* ---------- §8.8 — ماژول زبان انگلیسی: ۱۰ مهارت مستقل، نه فهرست لغت ---------- */

  app.get('/api/english/skills', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const state = await loadEngineState(user.id);

    // سؤال‌های سال ۱۴۰۴ قرنطینه‌اند و در هیچ سنجش عملیاتی شمرده نمی‌شوند
    const questionCountByNode = new Map<string, number>();
    for (const q of state.questions.values()) {
      if (q.examYear === QUARANTINE_HOLDOUT_YEAR) continue;
      questionCountByNode.set(q.nodeId, (questionCountByNode.get(q.nodeId) ?? 0) + 1);
    }

    const skills = ENGLISH_SKILLS.map((skill) => {
      const questionCount = questionCountByNode.get(skill.nodeId) ?? 0;
      const nodePresent = state.nodes.has(skill.nodeId);
      const mastery = state.mastery.get(skill.nodeId);
      const skillState = state.skillStates?.get(skill.id);
      // سنجش فقط با شاهد واقعی: mastery فقط برای گرهٔ دیده‌شده، وگرنه null (UNKNOWN)
      const assessed = mastery !== undefined || skillState !== undefined;
      return {
        id: skill.id,
        nodeId: skill.nodeId,
        bucket: skill.bucket,
        title: skill.title,
        description: skill.description,
        prerequisiteIds: skill.prerequisiteIds,
        verification: skill.verification,
        nodePresent,
        questionCount,
        assessed,
        mastery: assessed ? mastery ?? null : null,
        evidenceCount: skillState?.evidenceCount ?? null,
        coverageStatus: skillState?.coverageStatus ?? null,
      };
    });

    const englishQuestionCount = skills.reduce((sum, s) => sum + s.questionCount, 0);
    const contentGap = skills.filter((s) => s.questionCount === 0).map((s) => s.id);
    const assessableSkillCount = skills.filter((s) => s.questionCount > 0).length;

    return c.json({
      skills,
      skillCount: skills.length,
      englishQuestionCount,
      assessableSkillCount,
      contentGap,
      // عملیاتی فقط وقتی هر ۱۰ مهارت سؤال برچسب‌خورده داشته باشند
      operational: contentGap.length === 0,
      masterySource: 'پاسخ‌های واقعی به سؤال‌های زبان؛ خوداظهاری به‌تنهایی تسلط نمی‌سازد.',
      taxonomy: {
        status: 'proposed_curriculum_pending_sme',
        note:
          'تاکسونومی ۱۰ مهارت، پیشنهاد برنامهٔ درسی است و جایگاه رسمی سؤال/ضریب از آن استخراج نمی‌شود؛ تا تأیید کارشناس موضوع و افزودن متن/سؤال برچسب‌خورده، شکاف محتوا صریح گزارش می‌شود.',
      },
    });
  });

  /* ---------- §8.10 — داشبورد تحلیلی: ۱۳ شاخص واقعی یادگیری ----------
   * ورود/استریک/XP/سکه شاخص یادگیری نیستند و در این پاسخ هیچ‌جا محاسبه یا بازگردانده نمی‌شوند.
   * شاخصی که شاهد ندارد null است، نه صفرِ ساختگی. */
  app.get('/api/analytics/learning', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const state = await loadEngineState(user.id);
    const now = Date.now();
    const since30d = new Date(now - 30 * 86_400_000).toISOString();
    const since7d = new Date(now - 7 * 86_400_000).toISOString();

    const [recentAnswers, history7d] = await Promise.all([
      store.listAnswersSince(user.id, since30d),
      store.listMasteryHistorySince(user.id, since7d).catch(() => []),
    ]);

    const visible = [...state.nodes.values()].filter(
      (n) => n.track === 'common' || user.activeTracks.includes(n.track),
    );
    const visibleIds = new Set(visible.map((n) => n.id));
    const questionCountByNode = new Map<string, number>();
    for (const q of state.questions.values()) {
      if (q.examYear === QUARANTINE_HOLDOUT_YEAR) continue; // قرنطینه در هیچ شاخص عملیاتی شمرده نمی‌شود
      questionCountByNode.set(q.nodeId, (questionCountByNode.get(q.nodeId) ?? 0) + 1);
    }
    const assessableNodes = visible.filter((n) => (questionCountByNode.get(n.id) ?? 0) > 0);
    const assessableIds = new Set(assessableNodes.map((n) => n.id));
    const assessedIds = new Set(
      [...state.mastery.keys()].filter((nodeId) => assessableIds.has(nodeId)),
    );

    // ۱۳ شاخص
    const assessedNodeCount = assessedIds.size;
    const assessableNodeCount = assessableIds.size;
    const diagnosticCoverageRatio = assessableNodeCount > 0
      ? Math.round((assessedNodeCount / assessableNodeCount) * 1000) / 1000
      : null;

    const masteryDistribution = { weak: 0, unstable: 0, learning: 0, mastered: 0 };
    const assessedValues: number[] = [];
    for (const nodeId of assessedIds) {
      const value = state.mastery.get(nodeId);
      if (value === undefined) continue;
      assessedValues.push(value);
      masteryDistribution[statusFromMastery(value)] += 1;
    }
    assessedValues.sort((a, b) => a - b);
    const meanMasteryAssessed = assessedValues.length > 0
      ? Math.round((assessedValues.reduce((s, v) => s + v, 0) / assessedValues.length) * 100) / 100
      : null;
    const medianMasteryAssessed = assessedValues.length > 0
      ? (() => {
          const mid = Math.floor(assessedValues.length / 2);
          return assessedValues.length % 2 === 1
            ? assessedValues[mid]!
            : Math.round(((assessedValues[mid - 1]! + assessedValues[mid]!) / 2) * 100) / 100;
        })()
      : null;

    const visibleAnswers = recentAnswers.filter((a) => {
      const nodeId = state.questions.get(a.questionId)?.nodeId;
      return !!nodeId && visibleIds.has(nodeId);
    });
    const recentEvidenceCount30d = visibleAnswers.length;
    const recentAccuracy30d = recentEvidenceCount30d > 0
      ? Math.round((visibleAnswers.filter((a) => a.isCorrect).length / recentEvidenceCount30d) * 1000) / 1000
      : null;

    const visibleCards = state.cards.filter((card) => visibleIds.has(card.nodeId));
    const dueReviewCount = visibleCards.filter((card) => Date.parse(card.dueAt) <= now).length;

    const retrievabilities: number[] = [];
    for (const card of visibleCards) {
      if (!card.fsrs) continue;
      const reviewedAt = Date.parse(card.fsrs.lastReviewedAt);
      if (!Number.isFinite(reviewedAt)) continue;
      const daysElapsed = Math.max(0, (now - reviewedAt) / 86_400_000);
      retrievabilities.push(calculateRetrievability(card.fsrs.stability, daysElapsed));
    }
    const meanRetrievability = retrievabilities.length > 0
      ? Math.round((retrievabilities.reduce((s, v) => s + v, 0) / retrievabilities.length) * 1000) / 1000
      : null;

    const errorTypeDistribution: Record<string, number> = {};
    for (const cause of ERROR_TYPE_CAUSES) errorTypeDistribution[cause] = 0;
    errorTypeDistribution['unknown'] = 0;
    errorTypeDistribution['none'] = 0;
    let evidenceBackedSkillCount = 0;
    const skillStates = [...(state.skillStates?.values() ?? [])];
    for (const skillState of skillStates) {
      if (skillState.evidenceCount > 0) evidenceBackedSkillCount += 1;
      const type = skillState.dominantErrorType;
      if (Object.prototype.hasOwnProperty.call(errorTypeDistribution, type)) {
        errorTypeDistribution[type] = errorTypeDistribution[type]! + 1;
      }
    }

    const allSkillIds = new Set<string>();
    if (state.skills) for (const skillId of state.skills.keys()) allSkillIds.add(skillId);
    for (const s of skillStates) allSkillIds.add(s.skillId);
    const provenOrMasteredSkills = skillStates.filter(
      (s) => s.coverageStatus === 'proven' || s.coverageStatus === 'mastered',
    ).length;
    const totalSkills = allSkillIds.size;
    const proofCoverage = {
      provenOrMasteredSkills,
      totalSkills,
      ratio: totalSkills > 0 ? Math.round((provenOrMasteredSkills / totalSkills) * 1000) / 1000 : null,
    };

    let masteryDelta = 0;
    const changedNodes = new Set<string>();
    let transitionRows = 0;
    for (const row of history7d) {
      if (row.previousScore === null || !Number.isFinite(row.previousScore) || !Number.isFinite(row.newScore)) continue;
      masteryDelta += row.newScore - row.previousScore;
      changedNodes.add(row.nodeId);
      transitionRows += 1;
    }
    const learningVelocity7d = {
      masteryDelta: Math.round(masteryDelta * 100) / 100,
      changedNodeCount: changedNodes.size,
      historyRowCount: history7d.length,
      transitionRowCount: transitionRows,
    };

    return c.json({
      generatedAt: new Date(now).toISOString(),
      metrics: {
        assessedNodeCount,
        assessableNodeCount,
        diagnosticCoverageRatio,
        masteryDistribution,
        meanMasteryAssessed,
        medianMasteryAssessed,
        recentAccuracy30d,
        recentEvidenceCount30d,
        dueReviewCount,
        meanRetrievability,
        errorTypeDistribution,
        proofCoverage,
        learningVelocity7d,
      },
      metricCatalog: [
        { key: 'assessedNodeCount', label: 'گره‌های سنجیده‌شده', unit: 'count', source: 'user_node_mastery ∩ گره‌های دارای سؤال (بدون ۱۴۰۴)', definition: 'گره‌هایی که شاهد پاسخ واقعی دارند؛ مقدار پیش‌فرض ۵۰ به‌عنوان سنجش شمرده نمی‌شود.' },
        { key: 'assessableNodeCount', label: 'گره‌های قابل‌سنجش', unit: 'count', source: 'knowledge_nodes + questions (examYear ≠ 1404)', definition: 'گره‌های دیدنی گرایش‌های فعال که دست‌کم یک سؤال غیرقرنطینه دارند.' },
        { key: 'diagnosticCoverageRatio', label: 'پوشش تشخیصی', unit: 'ratio', source: 'assessedNodeCount / assessableNodeCount', definition: 'سهم گره‌های قابل‌سنجش که واقعاً سنجیده شده‌اند؛ بدون گره قابل‌سنجش null.' },
        { key: 'masteryDistribution', label: 'توزیع تسلط', unit: 'count', source: 'mastery فقط برای گره‌های سنجیده‌شده', definition: 'weak<40، unstable<60، learning<85، mastered≥85 — فقط روی گره‌های سنجیده.' },
        { key: 'meanMasteryAssessed', label: 'میانگین تسلط سنجیده', unit: 'score', source: 'میانگین mastery گره‌های سنجیده', definition: 'گره‌های ناسنجیده در مخرج نیستند؛ بدون شاهد null.' },
        { key: 'medianMasteryAssessed', label: 'میانهٔ تسلط سنجیده', unit: 'score', source: 'میانهٔ mastery گره‌های سنجیده', definition: 'مقاوم‌تر از میانگین در برابر چند گرهٔ پرت.' },
        { key: 'recentAccuracy30d', label: 'دقت ۳۰ روز', unit: 'ratio', source: 'answer_events ۳۰ روز اخیر، گره‌های دیدنی', definition: 'پاسخ صحیح / کل پاسخ؛ تلاش شبیه‌سازی آزمون در answer_events نیست.' },
        { key: 'recentEvidenceCount30d', label: 'حجم شاهد ۳۰ روز', unit: 'count', source: 'answer_events ۳۰ روز اخیر', definition: 'تعداد پاسخ‌های واقعی ثبت‌شده؛ اعتبار آماری شاخص‌های نرخ به آن وابسته است.' },
        { key: 'dueReviewCount', label: 'مرور سررسید', unit: 'count', source: 'review cards با dueAt ≤ اکنون', definition: 'فقط کارت‌های گره‌های دیدنی؛ بار واقعی مرور امروز.' },
        { key: 'meanRetrievability', label: 'میانگین بازیابی حافظه', unit: 'ratio', source: 'FSRS: calculateRetrievability(stability, elapsed)', definition: 'میانگین R کارت‌های دارای وضعیت FSRS؛ بدون وضعیت null.' },
        { key: 'errorTypeDistribution', label: 'توزیع علت خطا', unit: 'count', source: 'learner_skill_states.dominantErrorType', definition: '۱۰ علت مأموریت + unknown + none؛ unknown ضعف قطعی نیست.' },
        { key: 'proofCoverage', label: 'پوشش اثبات/holdout', unit: 'ratio', source: 'learner_skill_states.coverageStatus ∈ {proven, mastered}', definition: 'سهم مهارت‌های رسیده به اثبات؛ تسلط خوداظهاری این‌جا شمرده نمی‌شود.' },
        { key: 'learningVelocity7d', label: 'سرعت یادگیری ۷ روز', unit: 'score-delta', source: 'mastery_history ۷ روز اخیر', definition: 'مجموع تغییر تسلط ردیف‌های دارای مقدار قبلی؛ ردیف backfill فاقد previous_score حذف می‌شود.' },
      ],
      excludedVanityMetrics: ['login_count', 'streak_days', 'xp', 'coins', 'session_count'],
      notes: [
        'شاخص‌های بدون شاهد null هستند و هرگز با صفر یا ۵۰ پیش‌فرض پر نمی‌شوند.',
        'unknown در توزیع خطا یعنی شواهد کافی نیست؛ به‌عنوان ضعف فصل تفسیر نمی‌شود.',
        'ورود، استریک، XP و سکه شاخص یادگیری نیستند و در این پاسخ وجود ندارند.',
      ],
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

    // در حالت «در مسیر» (مترو)، سؤال‌های محاسباتی آمار پیش از رتبه‌بندی و limit کنار گذاشته می‌شوند.
    const isConceptualNode = (nodeId: string): boolean =>
      mode === 'desk' || !nodeId.startsWith('stats.');

    const now = new Date();
    const masteryMap = state.mastery;
    const examDate = stats.examDate ? new Date(`${stats.examDate}T00:00:00Z`) : undefined;
    const prereqByNode = new Map<string, string[]>();
    for (const dep of state.dependencies) {
      if (dep.relation !== 'prerequisite') continue;
      const list = prereqByNode.get(dep.source) ?? [];
      list.push(dep.target);
      prereqByNode.set(dep.source, list);
    }
    const scoreNowMs = now.getTime();
    type QueueScore = {
      minutes: number;
      activityType: 'proof' | 'remedial' | 'review';
      needsDiagnostic: boolean;
      priority: number;
    };
    const scoreCache = new Map<string, QueueScore>();
    const scoreQueueCard = (card: ReviewCard): QueueScore => {
      const cached = scoreCache.get(card.id);
      if (cached) return cached;

      const activityType: QueueScore['activityType'] = card.isProof
        ? 'proof'
        : card.isRepair
          ? 'remedial'
          : 'review';
      const nodeId = card.nodeId;
      // §8.1: گره ارزیابی‌نشده = UNKNOWN، نه پیش‌فرض ساختگی ۵۰.
      const masteryRaw = masteryMap.get(nodeId);
      const isUnassessed = masteryRaw === undefined;
      const knowledgeGap01 = isUnassessed
        ? 1
        : Math.min(1, Math.max(0, (100 - masteryRaw) / 100));

      let forgettingRisk: number;
      if (card.fsrs && card.fsrs.stability > 0) {
        const lastReviewMs = Date.parse(card.fsrs.lastReviewedAt);
        const elapsedDays = Number.isFinite(lastReviewMs)
          ? Math.max(0, (scoreNowMs - lastReviewMs) / 86400000)
          : 0;
        forgettingRisk = 1 - calculateRetrievability(card.fsrs.stability, elapsedDays);
      } else {
        // کارت بدون وضعیت FSRS: فقط تأخیر واقعی نسبت به موعد، نه فاصلهٔ آینده.
        const dueMs = Date.parse(card.dueAt);
        const overdueDays = Number.isFinite(dueMs)
          ? Math.max(0, (scoreNowMs - dueMs) / 86400000)
          : 0;
        forgettingRisk =
          overdueDays <= 0 ? 0 : Math.min(0.9, overdueDays / Math.max(1, card.intervalDays));
      }

      // پیش‌نیاز ارزیابی‌نشده محافظه‌کارانه ۰ است؛ مجهول را تسلط فرض نمی‌کنیم.
      const prereqScores = (prereqByNode.get(nodeId) ?? []).map(
        (pid) => masteryMap.get(pid) ?? 0,
      );
      const prereqMultiplier = derivePrereqMultiplier(prereqScores);

      let examProximity01 = 0;
      if (examDate && Number.isFinite(examDate.getTime())) {
        const daysLeft = Math.max(0, (examDate.getTime() - scoreNowMs) / 86400000);
        examProximity01 = Math.max(0, Math.min(1, 1 - daysLeft / 90));
      }

      const examValue = calculateExamValue(nodeId, {
        examPackWeights: new Map<string, number>(),
        currentPack: '',
        masteryMap,
      });
      const benefit = isUnassessed
        ? calculateExpectedBenefit('diagnostic', { masteryMap, evidenceLevel: 'none' })
        : calculateExpectedBenefit(activityType, {
            masteryMap,
            evidenceLevel: 'partial',
          });
      const minutes = estimatedMinutesForNode(nodeId);
      const result: QueueScore = {
        minutes,
        activityType,
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
      scoreCache.set(card.id, result);
      return result;
    };

    // امتیازدهی و فیلتر commute داخل builder و پیش از اعمال سقف candidate انجام می‌شود.
    const buildScoredQueue = () =>
      buildDailyQueue(state, engineUser, {
        limit: 50,
        now,
        includeCard: (card) => isConceptualNode(card.nodeId),
        priorityScore: (card) => scoreQueueCard(card).priority,
      });

    // کارت‌های تازه فقط وقتی ساخته می‌شوند که صف واجدشرایط کمتر از limit درخواستی باشد.
    let queue = buildScoredQueue();
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
          q.examYear !== QUARANTINE_HOLDOUT_YEAR &&
          isConceptualNode(q.nodeId),
      );
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
        queue = buildScoredQueue();
      }
    }

    // ---------- گام ۴: آزمونک اثبات تسلط (Holdout Proof) ----------
    // مهارت با احتمال تسلط ≥ ۰٫۷۵ و پوششِ نیازمند اثبات → ۱ سؤال قرنطینهٔ ۱۴۰۴ همان گره
    const proofCards: ReviewCard[] = [];
    for (const st of (state.skillStates ?? new Map()).values()) {
      if (st.coverageStatus !== 'needs_proof') continue;
      const meta = (state.skills ?? new Map()).get(st.skillId);
      if (!meta) continue;
      const proofQuestion = [...state.questions.values()].find(
        (q) => q.nodeId === meta.nodeId && q.examYear === QUARANTINE_HOLDOUT_YEAR,
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
        // An existing candidate may have been scored before it was promoted to proof.
        scoreCache.delete(pc.id);
        if (!queue.some((q) => q.card.id === pc.id)) {
          queue = [...queue, { card: pc, question: state.questions.get(pc.questionId ?? '') }];
        }
      }
    }

    // ---------- گام ۳: برنامه‌ریز بودجه‌محور (ROI Planner) ----------
    const proofIds = new Set(proofCards.map((pc) => pc.id));
    const scored = queue.map((item) => ({
      item,
      ...scoreQueueCard(item.card),
      isProof: proofIds.has(item.card.id) || item.card.isProof === true,
    }));
    const nonProof = scored
      .filter((s) => !s.isProof)
      .sort((a, b) => b.priority - a.priority);
    const proofItems = scored.filter((s) => s.isProof);

    // §8.5 بودجهٔ زمانی روزانه — قاعدهٔ صریح و تست‌پذیر:
    //   1) آیتم‌های اثبات (proof) تعهد قبلی‌اند: همیشه می‌مانند و زمانشان از بودجه کم می‌شود.
    //   2) آیتم‌های قابل‌هزینه (تمرین/مرور/جبرانی) فقط تا سقف «بودجه − زمان اثبات» انتخاب می‌شوند؛
    //      آیتمی که از باقی‌مانده بزرگ‌تر باشد هرگز اضافه نمی‌شود (قاعدهٔ «اولین آیتم حتی اگر بیشتر» حذف شد).
    //   3) guarantee: spentMinutes == مجموع estimatedMinutes آیتم‌های ارسال‌شده
    //      و spendableMinutes ≤ max(0, budgetMinutes − proofMinutes).
    const proofMinutes = proofItems.reduce((acc, s) => acc + s.minutes, 0);
    const remainingBudget = budgetMinutes === undefined ? Infinity : Math.max(0, budgetMinutes - proofMinutes);
    let spendableMinutes = 0;
    const selected: typeof scored = [...proofItems];
    for (const s of nonProof) {
      // سقف تعداد BEFORE افزودن بررسی می‌شود؛ با بررسی پس از push، وقتی
      // آیتم‌های اثبات خودِ limit را پر می‌کردند یک آیتم اضافه (limit+1) می‌ماند.
      if (selected.length >= limit) break;
      if (budgetMinutes !== undefined && spendableMinutes + s.minutes > remainingBudget) {
        continue;
      }
      selected.push(s);
      spendableMinutes += s.minutes;
    }
    const spentMinutes = proofMinutes + spendableMinutes;

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
          reason: s.isProof ? 'proof' : s.activityType === 'remedial' ? 'remedial' : 'scheduled',
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
      const { card, question, trapNote } = s.item;
      // کلاینت فقط همانقدر که برای نمایش لازم است می‌گیرد: spread کاملِ QueueItem
      // هم یادداشت دام را برای سؤال‌های تستی (قبل از پاسخ) و هم جزئیات داخلی
      // کارت (ease/fsrsState/timesSeen/userId) را افشا می‌کرد.
      const publicCard: Record<string, unknown> = {
        id: card.id,
        nodeId: card.nodeId,
        cardType: card.cardType,
        questionId: card.questionId ?? null,
        trapCardId: card.trapCardId ?? null,
        isRepair: card.isRepair === true,
        isProof: s.isProof,
      };
      if (card.cardType === 'trap_note') {
        // برای کارتِ یادداشت، خودِ متن نکته محتوای نمایشی است (منبع: QueueItem.trapNote)
        publicCard.trapNote = trapNote ?? null;
      }
      if (card.cardType === 'comparison_card') {
        publicCard.comparisonSkills = card.comparisonSkills ?? null;
      }
      return {
        card: publicCard,
        // در پاسخ به کلاینت، سؤال بدون کلید پاسخ، بدون توضیح و بدون یادداشت دام ارسال می‌شود
        question: question ? toPublicQuestion(question) : undefined,
        course: node?.course,
        chapter: node?.chapter,
        topic: node?.topic,
        // نام‌های سازگار با مینی‌اپ (نسخه‌های قبلی از این کلیدها استفاده می‌کنند)
        courseTitle: node?.course,
        chapterTitle: node?.chapter,
        attemptId: attemptIdByCard.get(card.id),
        attemptType: s.isProof ? ('proof' as const) : ('practice' as const),
        // §8.5: نوع فعالیت برای هر آیتم (مرور/جبرانی/اثبات) — صف ترکیبی قابل راستی‌آزمایی
        activityType: s.activityType,
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
      // §8.5: تفکیک شفاف هزینهٔ زمان — اثبات از بودجه کسر می‌شود، قابل‌هزینه تا سقف باقی‌مانده
      proofMinutes,
      spendableMinutes,
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

    // سکه فقط برای تلاشی داده می‌شود که همین سؤال را در همین روز «حل نکرده» است.
    // قاعده روی پاسخِ درست است، پس کوییز شبانه (اولین حل درستِ سؤال غلطِ امروز)
    // سکه می‌گیرد، اما تکرارِ پاسخ درست همان سؤال در همان روز سکه نمی‌سازد —
    // همان مسیري که با بلیت تازه + دیدن کلید، بی‌نهایت سکه تولید می‌کرد.
    const answersToday = await store.listAnswersSince(user.id, tehranMidnightIso()).catch(() => []);
    const alreadySolvedToday = answersToday.some((a) => a.questionId === body.questionId && a.isCorrect);

    // ثبت اتمیک و امن در دیتابیس (RPC امن: تعیین کلید سمت سرور + مصرف بلیت تلاش)
    let atomic: { correctOption?: number; replay?: boolean } | null = null;
    try {
      atomic = await store.submitAnswerAtomic({
        userId: user.id,
        questionId: body.questionId,
        selectedOption: body.selectedOption,
        attemptId: body.attemptId,
        wasCorrect,
        // وضعیت مهارت محاسبه‌شده توسط موتور را همراه پاسخ اتمیک ذخیره کن؛
        // SQL نباید با یک الگوریتم ساده‌تر همان وضعیت را دوباره تخمین بزند.
        rippleReport: {
          ...result.report,
          skillStateUpdate: result.skillStateUpdate ?? null,
        },
        masteryUpdates: result.masteryUpdates,
        cardUpserts: result.cardUpdates,
        cardInserts: result.createdCards,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // در مسابقهٔ هم‌زمان بلیت همین حالا مصرف شده است: این ۴۰۹ است، نه ۵۰۰
      if (/already consumed|Attempt ticket|duplicate key/i.test(message)) {
        const existing = await store.findAnswerByAttempt(user.id, body.attemptId);
        if (existing && existing.questionId === body.questionId) {
          const raced = await ensureStats(user.id);
          return c.json({
            wasCorrect: existing.isCorrect,
            report: enrichMasteryDeltas(
              existing.rippleReport as { masteryDeltas?: { nodeId: string }[] } | undefined,
              state.nodes,
            ),
            correctOption: question.correctOption,
            explanation: question.explanation,
            trapNote: question.trapNote,
            lesson: lessonPayload(question.nodeId),
            replay: true,
            stats: { coins: raced.coins, streakDays: raced.streakDays, dayNumber: raced.dayNumber },
          });
        }
        await auditRejected('race_consumed');
        return c.json({ error: 'این تلاش هم‌زمان مصرف شد؛ صف را تازه‌سازی کنید.' }, 409);
      }
      throw err;
    }

    // RPC می‌گوید این attempt از قبل ثبت شده بود (replay) — آمار دوباره صادر نمی‌شود
    const isReplay = atomic?.replay === true;

    // پایدارسازی وضعیت شش‌بعدی مهارت (learner_skill_states)
    if (result.skillStateUpdate && !isReplay) {
      await store
        .upsertSkillState(user.id, {
          skillId: result.skillStateUpdate.state.skillId,
          nodeId: result.skillStateUpdate.nodeId,
          state: result.skillStateUpdate.state,
        })
        .catch(() => undefined);
    }

    // آمار انگیزشی: سکه + روز پیوسته (فقط برای پاسخ‌های تازه، نه replay)
    const stats = isReplay
      ? await ensureStats(user.id)
      : await applyStatsForAnswer(user.id, wasCorrect, !alreadySolvedToday);

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
      replay: isReplay,
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
      // مهارت شش‌بعدی به‌تنهایی نمرهٔ تسلط گره نیست؛ مقدار ۵۰ پیش‌فرض نمی‌سازیم.
      const mastery = row?.mastery ?? null;
      const status = row?.status ?? coverage?.coverageStatus ?? 'unseen';
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
    // §8.1: میانگین فقط روی گره‌های «سنجیده‌شده». قبلاً گره‌های بدون شاهد با ۰
    // جمع می‌شدند و درصد پیشرفت نوپا را مصنوعی پایین نشان می‌داد (نقص null-vs-zero).
    const assessedNodes = visible.filter((n) => masteryByNode.has(n.id));
    const overall = assessedNodes.length > 0
      ? assessedNodes.reduce((sum, n) => sum + (masteryByNode.get(n.id) ?? 0), 0) / assessedNodes.length
      : null;
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
      progress: {
        // null یعنی «هنوز شواهدی نداریم» — نه صفر درصد
        overall: overall === null ? null : Math.round(overall),
        assessedNodes: assessedNodes.length,
        nodes: visible.length,
      },
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

      // ARC-01: خوداظهاری شاهد نیست. فقط نوع خطای غالب روی وضعیتی که موتور
      // ساخته می‌نشیند؛ اگر هنوز هیچ وضعیت skill-ی وجود ندارد، یک وضعیت
      // ساختگی (مثلاً evidenceCount=1 یا coverageStatus=remediated) نمی‌سازیم
      // و خوداظهاری همان «برچسب» روی رویداد پاسخ باقی می‌ماند.
      if (current) {
        await store
          .upsertSkillState(user.id, {
            skillId: skill.id,
            nodeId: question!.nodeId,
            state: {
              ...current,
              skillId: skill.id,
              dominantErrorType: dominant,
            },
          })
          .catch(() => undefined);
      } else {
        // خوداظهاری بدون هیچ وضعیت skill-ی از موتور؛ فقط برای ممیزی ثبت می‌شود
        await store
          .logAudit({
            userId: user.id,
            action: 'self_report_without_skill_state',
            entityType: 'answer_event',
            entityId: body.attemptId,
            details: { skillId: skill.id, selfReport: body.selfReport },
            sourceIp: c.req.header('x-forwarded-for') ?? null,
          })
          .catch(() => undefined);
      }
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
    // Fisher-Yates: مقایسه‌کنندهٔ sort(() => Math.random()-0.5) یکنواخت نیست و
    // ترتیب‌های میانی را ترجیح می‌دهد.
    const shuffled = wrongIds
      .map((id) => questionMap.get(id))
      .filter((q): q is NonNullable<typeof q> => !!q);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = tmp;
    }
    const picked = shuffled;

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
    const quota = freezeQuota(stats, month);
    if (quota.purchasable === 0) {
      return c.json({ error: 'حداکثر ۲ قفل در ماه مجاز است', granted: quota.granted }, 400);
    }
    stats.streakFreezeMonth = month;
    stats.streakFreezeGranted = quota.granted + 1;
    await store.upsertStats(stats);
    return c.json({
      ok: true,
      streakFreezeGranted: stats.streakFreezeGranted,
      streakFreezeUsed: stats.streakFreezeUsed,
      streakDays: stats.streakDays,
      month,
      message: 'روز پیوسته قفل شد؛ اگر یک روز مطالعه نکنی، زنجیره با مصرف این قفل حفظ می‌شود',
    });
  });

  /* ---------- تنظیمات: تاریخ کنکور ---------- */
  app.put('/api/settings', async (c) => {
    const user = await currentUser(c);
    if (!user) return authError(c);
    const body = (await c.req.json().catch(() => null)) as { examDate?: string | null } | null;
    if (!body || !('examDate' in body)) return c.json({ error: 'ورودی نامعتبر' }, 400);
    if (
      body.examDate != null &&
      !isRealISODate(String(body.examDate))
    ) {
      return c.json({ error: 'examDate باید یک تاریخ معتبر YYYY-MM-DD باشد' }, 400);
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
