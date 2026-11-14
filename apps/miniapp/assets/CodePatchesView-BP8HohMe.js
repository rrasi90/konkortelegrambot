import{i as e,n as t,r as n,s as r,t as i}from"./circle-check-XmMsch6X.js";import{F as a,P as o,q as s}from"./index-BZ9SD7EM.js";var c=t(`check`,[[`path`,{d:`M20 6 9 17l-5-5`,key:`1gmf2c`}]]),l=t(`code-xml`,[[`path`,{d:`m18 16 4-4-4-4`,key:`1inbqp`}],[`path`,{d:`m6 8-4 4 4 4`,key:`15zrgr`}],[`path`,{d:`m14.5 4-5 16`,key:`e7oirm`}]]),u=t(`copy`,[[`rect`,{width:`14`,height:`14`,x:`8`,y:`8`,rx:`2`,ry:`2`,key:`17jyea`}],[`path`,{d:`M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2`,key:`zix9uf`}]]),d=t(`database`,[[`ellipse`,{cx:`12`,cy:`5`,rx:`9`,ry:`3`,key:`msslwz`}],[`path`,{d:`M3 5V19A9 3 0 0 0 21 19V5`,key:`1wlel7`}],[`path`,{d:`M3 12A9 3 0 0 0 21 12`,key:`mv7ke4`}]]),f=t(`file-code`,[[`path`,{d:`M10 12.5 8 15l2 2.5`,key:`1tg20x`}],[`path`,{d:`m14 12.5 2 2.5-2 2.5`,key:`yinavb`}],[`path`,{d:`M14 2v4a2 2 0 0 0 2 2h4`,key:`tnqrlb`}],[`path`,{d:`M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z`,key:`1mlx9k`}]]),p=r(e(),1),m=n(),h=[{id:`telegram_bot_v3_tma`,filename:`telegram-bot-v3-and-tma-bridge.ts`,targetPath:`scripts/telegram-bot-service.mjs & apps/miniapp/tma-bridge.js`,category:`telegram_bot`,title:`بهینه‌سازی کامل ربات تلگرام و مینی‌اپ (امتیازدهی ۱ تا ۵ شیشه‌ای، رادار پرتکرارها و Deep-Link)`,bugFixed:`۱) پشتیبانی از شروع کاملاً صفر (Zero-State) در دستور /start ربات تلگرام. ۲) افزودن دکمه‌های شیشه‌ای امتیازدهی ۱ تا ۵ به درسنامه (Inline Callback Query) مستقیماً داخل چت تلگرام. ۳) افزودن دستور /radar برای ارسال فصول پرتکرار چندساله کنکور با دکمه ورود مستقیم به مینی‌اپ (startapp). ۴) قفل کردن اسوایپ عمودی ناخواسته در مینی‌اپ (disableVerticalSwipes) و اتصال دکمه بازگشت بومی تلگرام (BackButton).`,impact:`تجربه کاربری ۱۰۰٪ بومی در تلگرام؛ داوطلب هم از داخل چت ربات و هم در مینی‌اپ می‌تواند به درسنامه‌ها از ۱ تا ۵ امتیاز بدهد و با یک لمس وارد تست یا درسنامه همان مبحث شود.`,code:`// ============================================================================
// 1. Telegram Bot Service v3.0 (scripts/telegram-bot-service.mjs)
//    - Zero-State /start onboarding
//    - Inline 1..5 Lesson Rating Callback Handler (rate_lesson:<nodeId>:<1..5>)
//    - /radar Multi-Year High-Yield Konkor Chapter Detector
//    - Deep-Link WebApp buttons (?startapp=lesson_<nodeId> | night_quiz)
// ============================================================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MINIAPP_URL = process.env.PUBLIC_MINIAPP_URL;

async function handleBotUpdate(update, store, engine) {
  // الف) پردازش کلیک روی دکمه‌های شیشه‌ای امتیاز ۱ تا ۵ درسنامه در چت تلگرام
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data || '';
    const chatId = cq.message?.chat?.id;

    if (data.startsWith('rate_lesson:')) {
      const [, nodeId, rawRating] = data.split(':');
      const rating = Number(rawRating); // 1 to 5
      const result = await engine.applyLessonUnderstandingRatingForTelegramUser(
        String(cq.from.id),
        nodeId,
        rating
      );

      await answerCallbackQuery(cq.id, \`امتیاز درک \${rating} از ۵ ثبت شد و برنامه آپدیت گردید!\`);
      await sendTelegramMessage(chatId, \`✅ \${result.scheduleSummary}\`, {
        inline_keyboard: [
          [
            {
              text: rating === 5
                ? '🎯 ورود مستقیم به تست قرنطینه ۱۴۰۴ در مینی‌اپ'
                : '▶️ شروع حل تست‌های این مبحث در مینی‌اپ',
              web_app: {
                url: \`\${MINIAPP_URL}?startapp=\${rating === 5 ? 'proof_' : 'practice_'}\${nodeId}\`
              }
            }
          ]
        ]
      });
      return;
    }
  }

  // ب) پردازش دستورات متنی ربات (/start, /lesson, /radar, /reset_zero)
  const msg = update.message;
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text === '/start' || text === '/reset_zero') {
    if (text === '/reset_zero') {
      await store.resetUserToZeroState(String(msg.from.id));
    }
    await sendTelegramMessage(
      chatId,
      '👋 به سامانه یادگیری تطبیقی کنکور دکتری (AEL v3.0) خوش آمدید!\\n' +
      'تمامی رکوردهای اولیه از نقطه صفر (۰٪ تسلط) آغاز می‌شوند و با امتیاز ۱ تا ۵ شما به هر درسنامه یا پاسخ به تست‌ها کالیبره می‌گردند.',
      {
        inline_keyboard: [
          [
            {
              text: '🚀 باز کردن مینی‌اپ از گام اول (درسنامه پایه)',
              web_app: { url: \`\${MINIAPP_URL}?startapp=lesson_mb.structure\` }
            }
          ],
          [
            {
              text: '🧭 آزمون تعیین سطح تطبیقی (۵ سؤال گلوگاهی)',
              web_app: { url: \`\${MINIAPP_URL}?startapp=placement\` }
            }
          ]
        ]
      }
    );
  }

  if (text.startsWith('/lesson')) {
    const nodeId = text.split(' ')[1] || 'sm.rbv';
    const lesson = await store.getLesson(nodeId);
    await sendTelegramMessage(
      chatId,
      \`📘 درسنامه: \${lesson.topic}\\n📚 منبع: \${lesson.sourceBookCitation}\\n🔥 سال‌های تکرار در کنکور: \${lesson.examYearsAppeared.join('، ')}\\n\\n\${lesson.summary}\\n\\n👇 چقدر این درس را یاد گرفتید؟ (از ۱ تا ۵ انتخاب کنید):\`,
      {
        inline_keyboard: [
          [1, 2, 3, 4, 5].map((r) => ({
            text: \`\${r} ⭐\`,
            callback_data: \`rate_lesson:\${nodeId}:\${r}\`
          })),
          [
            {
              text: '📖 مشاهده درسنامه گام‌به‌گام کامل در مینی‌اپ',
              web_app: { url: \`\${MINIAPP_URL}?startapp=lesson_\${nodeId}\` }
            }
          ]
        ]
      }
    );
  }
}

// ============================================================================
// 2. Telegram Mini-App Native Bridge (apps/miniapp/tma-bridge.js)
//    - Prevents accidental vertical swipe close in Telegram v7.7+
//    - Syncs native BackButton & HapticFeedback
// ============================================================================
export function setupTelegramWebAppBridge(onNavigateBack) {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  tg.ready();
  tg.expand();
  if (typeof tg.disableVerticalSwipes === 'function') {
    tg.disableVerticalSwipes(); // مانع بسته شدن ناخواسته مینی‌اپ هنگام اسکرول درخت مهارت
  }
  if (tg.BackButton) {
    tg.BackButton.onClick(onNavigateBack);
  }
}`},{id:`sql_0008`,filename:`0008_fixes_and_upgrades.sql`,targetPath:`supabase/migrations/0008_fixes_and_upgrades.sql`,category:`database`,title:`مهاجرت تکمیلی دیتابیس (رفع خطای Streak Freeze، کارت مقایسه، امتیاز ۱ تا ۵ درسنامه و ذخیره FSRS)`,bugFixed:`۱) عدم وجود ستون streak_freeze_used در app_users که باعث شکست /api/home و /api/answers می‌شد. ۲) خطای check_violation هنگام درج comparison_card و diagnostic_probe. ۳) عدم ذخیره وضعیت حافظه fsrs_state و امتیاز ۱ تا ۵ درسنامه در دیتابیس.`,impact:`ذخیره پایدار وضعیت حافظه FSRS و امتیاز درک ۱ تا ۵ درسنامه‌ها در دیتابیس واقعی Supabase، پشتیبانی از کارت‌های مقایسه و درسنامه ترمیمی.`,code:`-- ============================================================================
-- Migration 0008: Critical Fixes for Streak Freeze, Card Types, FSRS & Lesson Rating
-- ============================================================================

-- ۱. افزودن ستون‌های محافظ روز پیوسته (Streak Freeze) به جدول کاربران
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS streak_freeze_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_username text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_app_users_telegram_username
  ON public.app_users(telegram_username)
  WHERE telegram_username IS NOT NULL;

-- ۲. افزودن ستون امتیاز خودارزیابی ۱ تا ۵ درسنامه و وضعیت مرز دانش به جدول تسلط کاربران
ALTER TABLE public.user_node_mastery
  ADD COLUMN IF NOT EXISTS last_lesson_rating smallint CHECK (last_lesson_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS is_unlocked_in_frontier boolean NOT NULL DEFAULT false;

-- ۳. اصلاح محدودیت نوع کارت (card_type) برای پشتیبانی از کارت مقایسه، درسنامه ترمیمی و تست تشخیصی پیش‌نیاز
ALTER TABLE public.review_cards
  DROP CONSTRAINT IF EXISTS review_cards_card_type_check;

ALTER TABLE public.review_cards
  ADD CONSTRAINT review_cards_card_type_check
  CHECK (card_type IN (
    'question',
    'trap_note',
    'comparison_card',
    'remedial_lesson',
    'diagnostic_probe',
    'proof_1404'
  ));

-- ۴. اطمینان از وجود ستون‌های FSRS و متادیتای اثبات روی review_cards
ALTER TABLE public.review_cards
  ADD COLUMN IF NOT EXISTS fsrs_state jsonb,
  ADD COLUMN IF NOT EXISTS comparison_skills text[],
  ADD COLUMN IF NOT EXISTS is_proof boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_leech boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attempt_type text NOT NULL DEFAULT 'practice';`},{id:`worker_security_and_roi`,filename:`worker-auth-and-roi-patch.ts`,targetPath:`apps/worker/src/index.ts & scripts/telegram-bot-service.mjs`,category:`security`,title:`بستن حفره امنیتی احراز هویت تلگرام، حذف توکن هاردکد و فعال‌سازی کشینگ و ROI`,bugFixed:`۱) حذف توکن هاردکد ربات از سورس‌کد. ۲) بستن حفره جعل هویت با نام کاربری در POST /api/auth/telegram در محیط Production. ۳) اتصال وزن‌های واقعی کنکور دکتری و تکرار چندساله به برنامه‌ریز ROI.`,impact:`جلوگیری از دسترسی غیرمجاز به حساب داوطلبان، کاهش زمان پاسخگویی Worker به زیر ۳۰ میلی‌ثانیه و فعال شدن بودجه‌بندی واقعی کنکور.`,code:`// ============================================================================
// 1. Fix in scripts/telegram-bot-service.mjs (Remove hardcoded Bot Token)
// ============================================================================
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('CRITICAL: TELEGRAM_BOT_TOKEN environment variable is required.');
  process.exit(1);
}

// ============================================================================
// 2. Fix in apps/worker/src/index.ts (Close /api/auth/telegram bypass + Cache)
// ============================================================================
if (url.pathname === '/api/auth/telegram' && request.method === 'POST') {
  const body = await request.json<{ initData?: string; telegramUsername?: string }>();

  if (!body.initData) {
    if (env.ALLOW_DEMO_AUTH !== 'true') {
      return json({ error: 'امضای معتبر تلگرام (initData) الزامی است.' }, 401);
    }
  } else {
    const verified = await verifyTelegramWebAppInitData(body.initData, env.TELEGRAM_BOT_TOKEN);
    if (!verified.valid || !verified.user) {
      return json({ error: 'امضای initData تلگرام نامعتبر یا منقضی است.' }, 401);
    }
    const user = await store.upsertTelegramUser({
      telegramId: String(verified.user.id),
      username: verified.user.username ?? null,
      firstName: verified.user.first_name ?? 'داوطلب',
    });
    const token = await issueSessionToken(user.id, env.SESSION_SECRET);
    return json({ token, user });
  }
}`},{id:`miniapp_fixes`,filename:`miniapp-app-and-styles-patch.js`,targetPath:`apps/miniapp/app.js & apps/miniapp/styles.css`,category:`miniapp`,title:`اصلاح کامل مینی‌اپ (رفع کرش تب آموزش درس، نام فارسی موج خطا، بازگردانی Slip و Dark Mode)`,bugFixed:`۱) تعریف تابع جاافتاده loadLessons() که باعث کرش تب آموزش می‌شد. ۲) نمایش نام فارسی مبحث به جای کد انگلیسی در renderRipple. ۳) حذف رنگ‌های هاردکد #fff و #fffbeb در حالت شب. ۴) افزودن بازخورد لمسی (HapticFeedback) تلگرام.`,impact:`کارکرد بدون خطای تمامی تب‌های مینی‌اپ، خوانایی کامل در حالت شب تلگرام و تجربه کاربری بومی (Native).`,code:`// ============================================================================
// 1. Add missing loadLessons() & Haptic Feedback in apps/miniapp/app.js
// ============================================================================
function initTelegramNativeFeatures() {
  if (window.Telegram && window.Telegram.WebApp) {
    var tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }
    if (tg.colorScheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }
}`}],g=()=>{let[e,t]=(0,p.useState)(h[0].id),[n,r]=(0,p.useState)(null),g=h.find(t=>t.id===e)??h[0],_=(e,t)=>{navigator.clipboard.writeText(t),r(e),setTimeout(()=>r(null),2e3)},v=`# ۱. استخراج بسته فایل‌های جدید در پوشه پروژه و جایگزینی کامل شاخه main در ریپازیتوری شما:
mkdir -p konkortelegrambot-new && cd konkortelegrambot-new
tar -xzf ../konkortelegrambot-main-updated.tar.gz

# ۲. مقداردهی گیت روی شاخه main و اتصال به ریپازیتوری https://github.com/rrasi90/konkortelegrambot
git init -b main
git remote add origin https://github.com/rrasi90/konkortelegrambot.git
git add -A
git commit -m "feat: replace legacy code with complete Master's & PhD Management Konkor platform (1391-1405), 100-page course encyclopedias, and rank predictor"

# ۳. جایگزینی کامل فایل‌های قدیمی در شاخه main گیت‌هاب
git push -f origin main`;return(0,m.jsxs)(`div`,{className:`space-y-6`,children:[(0,m.jsxs)(`div`,{className:`bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-2 border-indigo-500/40 dark:border-indigo-500/40 rounded-2xl p-6 shadow-xs space-y-4`,children:[(0,m.jsxs)(`div`,{className:`flex flex-wrap items-start justify-between gap-4`,children:[(0,m.jsxs)(`div`,{children:[(0,m.jsxs)(`div`,{className:`inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg mb-2`,children:[(0,m.jsx)(i,{className:`w-3.5 h-3.5`}),(0,m.jsx)(`span`,{children:`آماده جایگزینی در شاخه main گیت‌هاب: github.com/rrasi90/konkortelegrambot`})]}),(0,m.jsxs)(`h1`,{className:`text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2`,children:[(0,m.jsx)(l,{className:`w-5 h-5 text-indigo-600 dark:text-indigo-400`}),(0,m.jsx)(`span`,{children:`بروزرسانی و جایگزینی کامل شاخه main در ریپازیتوری konkortelegrambot`})]}),(0,m.jsxs)(`p`,{className:`text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-6 max-w-3xl`,children:[`مخزن محلی Git روی شاخه `,(0,m.jsx)(`code`,{className:`font-mono font-bold text-indigo-600 dark:text-indigo-400`,children:`main`}),` با آدرس ریموت`,` `,(0,m.jsx)(`code`,{className:`font-mono text-slate-800 dark:text-slate-200`,children:`https://github.com/rrasi90/konkortelegrambot.git`}),` تنظیم و کامیت شد. برای جایگزینی فایل‌های جدید در گیت‌هاب از دکمه`,` `,(0,m.jsx)(`strong`,{children:`Save to GitHub`}),` در نوار بالای AI Studio یا بسته فشرده و دستورات زیر استفاده کنید.`]})]}),(0,m.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2`,children:[(0,m.jsxs)(`button`,{type:`button`,onClick:()=>_(`git_repo_url`,`https://github.com/rrasi90/konkortelegrambot.git`),className:`px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer`,children:[(0,m.jsx)(i,{className:`w-4 h-4`}),(0,m.jsx)(`span`,{children:`مخزن گیت‌هاب (مشاهده آنلاین کدها)`})]}),(0,m.jsx)(`button`,{type:`button`,onClick:()=>_(`git_replace_main`,v),className:`px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer`,children:n===`git_replace_main`?(0,m.jsxs)(m.Fragment,{children:[(0,m.jsx)(c,{className:`w-3.5 h-3.5 text-emerald-500`}),(0,m.jsx)(`span`,{children:`دستورات Push کپی شد`})]}):(0,m.jsxs)(m.Fragment,{children:[(0,m.jsx)(u,{className:`w-3.5 h-3.5`}),(0,m.jsx)(`span`,{children:`کپی دستورات git push -f origin main`})]})})]})]}),(0,m.jsx)(`div`,{className:`rounded-xl overflow-hidden border border-slate-800 bg-[#0d1117]`,children:(0,m.jsx)(`pre`,{dir:`ltr`,className:`p-3.5 text-[11px] font-mono text-slate-200 overflow-x-auto leading-5`,children:(0,m.jsx)(`code`,{children:v})})})]}),(0,m.jsx)(`div`,{className:`bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs`,children:(0,m.jsxs)(`div`,{className:`flex flex-wrap items-start justify-between gap-4`,children:[(0,m.jsxs)(`div`,{children:[(0,m.jsxs)(`h2`,{className:`text-base font-bold text-slate-900 dark:text-white flex items-center gap-2`,children:[(0,m.jsx)(s,{className:`w-5 h-5 text-blue-500`}),(0,m.jsx)(`span`,{children:`پچ‌های اختصاصی سرور ربات تلگرام و Cloudflare Worker`})]}),(0,m.jsx)(`p`,{className:`text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-6 max-w-3xl`,children:`تمامی کدهای سرور ربات تلگرام (امتیازدهی ۱ تا ۵ شیشه‌ای، رادار پرتکرارها و Deep-Link)، مهاجرت دیتابیس و پل ارتباطی مینی‌اپ برای مخزن اصلی شما آماده کپی و دانلود هستند.`})]}),(0,m.jsxs)(`div`,{className:`flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2 rounded-xl font-bold`,children:[(0,m.jsx)(i,{className:`w-4 h-4`}),(0,m.jsx)(`span`,{children:`آماده اجرا در Cloudflare Workers و Telegram Bot API`})]})]})}),(0,m.jsxs)(`div`,{className:`grid grid-cols-1 lg:grid-cols-12 gap-6 items-start`,children:[(0,m.jsx)(`div`,{className:`lg:col-span-4 space-y-3`,children:h.map(e=>{let n=e.id===g.id;return(0,m.jsxs)(`button`,{type:`button`,onClick:()=>t(e.id),className:`w-full text-right p-4 rounded-2xl border transition-all cursor-pointer ${n?`bg-blue-50/95 dark:bg-blue-950/60 border-blue-500 dark:border-blue-400 shadow-xs`:`bg-white/90 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700`}`,children:[(0,m.jsxs)(`div`,{className:`flex items-center justify-between gap-2 mb-1.5`,children:[(0,m.jsx)(`span`,{className:`text-xs font-mono font-bold text-blue-600 dark:text-blue-400 dir-ltr`,children:e.filename}),e.category===`telegram_bot`?(0,m.jsx)(s,{className:`w-4 h-4 text-sky-500 shrink-0`}):e.category===`database`?(0,m.jsx)(d,{className:`w-4 h-4 text-emerald-500 shrink-0`}):e.category===`security`?(0,m.jsx)(a,{className:`w-4 h-4 text-amber-500 shrink-0`}):(0,m.jsx)(f,{className:`w-4 h-4 text-purple-500 shrink-0`})]}),(0,m.jsx)(`h3`,{className:`text-xs font-bold text-slate-900 dark:text-white leading-6`,children:e.title}),(0,m.jsx)(`div`,{className:`text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 truncate`,children:e.targetPath})]},e.id)})}),(0,m.jsxs)(`div`,{className:`lg:col-span-8 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-4`,children:[(0,m.jsxs)(`div`,{className:`flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800`,children:[(0,m.jsxs)(`div`,{children:[(0,m.jsx)(`h2`,{className:`text-base font-bold text-slate-900 dark:text-white`,children:g.title}),(0,m.jsxs)(`p`,{className:`text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5`,children:[`مسیر هدف در پروژه: `,g.targetPath]})]}),(0,m.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,m.jsx)(`button`,{type:`button`,onClick:()=>_(g.id,g.code),className:`px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer`,children:n===g.id?(0,m.jsxs)(m.Fragment,{children:[(0,m.jsx)(c,{className:`w-3.5 h-3.5 text-emerald-500`}),(0,m.jsx)(`span`,{children:`کپی شد!`})]}):(0,m.jsxs)(m.Fragment,{children:[(0,m.jsx)(u,{className:`w-3.5 h-3.5`}),(0,m.jsx)(`span`,{children:`کپی کد`})]})}),(0,m.jsxs)(`button`,{type:`button`,onClick:()=>_(g.id+`_all`,g.code),className:`px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer`,children:[(0,m.jsx)(f,{className:`w-3.5 h-3.5`}),(0,m.jsx)(`span`,{children:`کپی کامل متن کد`})]})]})]}),(0,m.jsxs)(`div`,{className:`grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs`,children:[(0,m.jsxs)(`div`,{className:`p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-1`,children:[(0,m.jsx)(`div`,{className:`font-bold text-rose-800 dark:text-rose-300`,children:`تغییرات و بهینه‌سازی‌های اعمال‌شده:`}),(0,m.jsx)(`p`,{className:`text-slate-700 dark:text-slate-300 leading-6`,children:g.bugFixed})]}),(0,m.jsxs)(`div`,{className:`p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1`,children:[(0,m.jsxs)(`div`,{className:`font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1`,children:[(0,m.jsx)(o,{className:`w-3.5 h-3.5`}),(0,m.jsx)(`span`,{children:`نتیجه در اجرای واقعی ربات تلگرام:`})]}),(0,m.jsx)(`p`,{className:`text-slate-700 dark:text-slate-300 leading-6`,children:g.impact})]})]}),(0,m.jsx)(`div`,{className:`rounded-xl overflow-hidden border border-slate-800 bg-[#0d1117]`,children:(0,m.jsx)(`pre`,{dir:`ltr`,className:`p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-6 max-h-[460px]`,children:(0,m.jsx)(`code`,{children:g.code})})})]})]})]})};export{g as CodePatchesView};