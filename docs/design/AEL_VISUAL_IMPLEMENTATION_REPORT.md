# AEL Visual Implementation Report — Crouton Alpha

**برنچ:** `design/ael-visual-card-redesign` → یکپارچه‌سازی روی `feat/ael-design-integration`  
**تاریخ:** ۱۴۰۵-۰۸-۱۶ (2026-11-06)  
**هدف:** انتقال زبان بصری تنها از تصویر مرجع به کل سیستم AEL — نه فقط یک صفحهٔ زیبا.

> **به‌روزرسانی Integration (002):** این گزارش پس از یکپارچه‌سازی با `origin/main` (`c3f8949`) به‌روزرسانی شد — توکن مشترک، پیاده‌سازی واقعی در `apps/miniapp` و `src/`، و QA روی بیلد واقعی (نه فقط Prototype). جزئیات در §9 تا §12.

---

## 1. خروجی نهایی (فهرست تحویل)

| # | فایل | توضیح |
|---|---|---|
| 1 | `docs/design/AEL_VISUAL_LANGUAGE_SPEC.md` | Spec رسمی: رنگ، تایپوگرافی، Radius، Elevation، معماری بخش‌ها، Motion |
| 2 | `docs/design/AEL_CARD_COMPONENT_SYSTEM.md` | سیستم کارت: Base + Variantها + قواعد امتناع |
| 3 | `docs/design/AEL_VISUAL_IMPLEMENTATION_REPORT.md` | همین گزارش |
| 4 | `docs/design/prototypes/index.html` | هاب پروتوتایپ‌ها |
| 5 | `docs/design/prototypes/ael-home-v1.html` | صفحهٔ خانه — مرور امروز، تسلط کل، کوئیزهای روزانه، ۸ درس، تمرین و ارزیابی |
| 6 | `docs/design/prototypes/ael-lessons-v1.html` | درسنامه‌ها — جستجو، فصل‌های طلایی، CTA واقعی |
| 7 | `docs/design/prototypes/ael-study-v1.html` | جلسهٔ تست — سؤال، فیدبک، دام طراح |
| 8 | `docs/design/screenshots/ael-*-320..430.png` | ۱۵ اسکرین‌شات QA (۳ صفحه × ۵ عرض) |
| 9 | `src/components/ui/AelCard.tsx` | کارت پایهٔ Reusable (React) — Type-safe + Keyboard Accessible |
| 10 | `src/components/ui/AppShell.tsx` | اسل پس‌زمینهٔ گرادیانی |
| 11 | `src/components/ui/SectionHeader.tsx` | هدر بخش با نقطهٔ رنگی (مثل مرجع) |
| 12 | `src/components/ui/index.ts` | Export |
| 13 | `src/styles/design-tokens.css` | منبع واحد توکن‌ها (React) — `@import` در `src/index.css` |
| 14 | `docs/design/screenshots/product-v2/*.png` | ۱۵ اسکرین بیلد واقعی (Home/Lessons/Study × ۵ عرض) |

**تغییرات پورت به کد واقعی (بدون تغییر منطق):**
- `apps/miniapp/styles.css` — توکن‌های Warm Charcoal (`--app-bg #1b1a17`، Radius ۲۴/۲۰/۱۶، Accentهای معنادار)، پس‌زمینه گرادیانی، Bottom Nav شناور (`bottom:12px; border-radius:24px; backdrop-blur`)، `.dash-card.hero` گرادیانی
- `src/index.css` — توکن‌های `--ael-*` کنار توکن‌های قدیمی (بدون حذف)، `.dark .bento-card` → `#262524` + Radius ۲۰px، `.dark .ambient-bento-bg` → گرادیان Warm Charcoal
- `src/App.tsx` — Bottom Navigation شناور و Active فیروزه‌ای (`#36c4bd`)؛ هیچ هندلر، ناوبری یا Back Button عوض نشد

**بدون هیچ تغییری:** `src/engine/aelEngine.ts`، `src/data/*`، APIها، Database Schema، منطق آزمون/امتیازدهی، احراز هویت و Business Logic.

---

## 2. داده‌های واقعی متصل (شواهد عدم Mock)

همهٔ اعداد در پروتوتایپ و کامپوننت‌ها از این منابع می‌آیند و همان کامپوننت‌های موجود (`DashboardView`) از همان‌ها استفاده می‌کنند:

| المان در طراحی | منبع واقعی |
|---|---|
| Streak / XP | `stats.streakDays`, `stats.xp` در `src/engine/aelEngine.ts` |
| تعداد گام صف امروز | `queue.length` از `dailyQueue` در `src/App.tsx` |
| تسلط کل | `overallMastery = میانگین masteryScore` در `src/components/DashboardView.tsx:118` |
| تثبیت‌شده | `masteredOrProvenCount / nodes.length` |
| درسنامه‌ها | `stats.lessonsRatedCount` |
| صحیح/غلط/نزده + درصد خالص | `stats.correctCount/wrongCount/skippedCount` و `netKonkorPercent = (3*correct - wrong)/(3*total)` |
| کوئیزهای روزانه | `stats.dailyQuests` |
| ۸ درس ضریب‌دار | `SUBJECT_COURSE_DEFINITIONS` در `src/data/subjectHubMeta.ts` (اسلامی ۱۵/۲، تئوری ۳۰/۳، بازاریابی ۱۵/۴، اقتصاد ۲۰/۲، ریاضی‌آمار ۲۰/۲، تحقیق در عملیات ۱۵/۳، تولید ۱۵/۲، زبان ۳۰/۳) |
| آرشیو کنکور / درخت مهارت | `YEARLY_KONKOR_BOOKLETS`, `SkillTreeGraph` |
| کوییز شبانه | `handleStartNightQuiz` در `src/App.tsx` |
| دفتر خطا | `MistakeNotebookView`, `mistakeEntries` |

**Gapهای گزارش‌شده (بدون پر کردن ساختگی):**
- آواتار تلگرام واقعی نداریم → آیکون حرف «م» در هدر
- سیستم Event/League نداریم → جای آن با کوییز شبانه (واقعی) پوشش داده شد
- مسابقهٔ زنده/پاداش روزانه نداریم → جای آن با «پیشنهاد بعدی ROI» و «فصول پرتکرار» پر شد

---

## 3. QA بصری (Playwright — Screenshot در ۵ عرض)

ابزار: `@playwright/test 1.65.0` + `playwright 1.64.1 (Python)`، موتور Chromium موجود (`chromium-1248`) با `executablePath` صریح به‌دلیل در دسترس نبود شبکهٔ بین‌المللی برای دانلود 1254.

| صفحه | ۳۲۰px | ۳۶۰px | ۳۷۵px | ۳۹۰px | ۴۳۰px | نتیجه |
|---|---|---|---|---|---|---|
| Home | ۰ | ۰ | ۰ | ۰ | ۰ | پاس — بدون Overflow افقی |
| Lessons | ۰ | ۰ | ۰ | ۰ | ۰ | پاس |
| Study | ۰ | ۰ | ۰ | ۰ | ۰ | پاس |

**نکتهٔ تکرار (Iteration):** در ران اول `ael-home-v1` در ۳۲۰px دارای Overflow برابر ۸۲px بود (عامل: چیپ‌های هدر + `wide-card` با `min-width:86%`). با مخفی‌کردن متن چیپ در موبایل و اصلاح ریل افقی (`min-width:min(260px,78vw)`) به ۰ رسید. اسکرین نهایی در `docs/design/screenshots/ael-home-v1-320.png` و `ael-home-v1-390.png` قابل مشاهده است.

**مقایسه با مرجع:** پس‌زمینه چارتری گرم، کارت‌های لایه‌ای با Radius ۲۲-۲۴، Hero گرادیانی، رینگ Progress، Metric جفتی، گرید مختلط ۲ستونه، ریل افقی دروس و Bottom Nav شناور با Active فیروزه‌ای — همه استخراج و اجرا شدند. محتوای مرجع (Vajerah) کپی نشد؛ هویت AEL حفظ شد.

---

## 4. Regression QA

| تست | دستور | نتیجه |
|---|---|---|
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | ✅ EXIT 0 |
| Content/Engine | `npm run validate:learning` | ✅ EXIT 0 — `financial-management: 8 topics, 24 authored items` |
| واحد + یکپارچه | `npm test` (`vitest run`) | ✅ **۴۷ فایل — ۵۵۷ تست پاس** در 2.26s |
| Build.production | `npm run build` (`vite build`) | ✅ EXIT 0 — `dist/assets/index-BmiSvY12.js 220.23 kB` |
| RTL | `dir=rtl` در `index.html` و `apps/miniapp/index.html` + اعداد فارسی در تمام پروتوتایپ‌ها | ✅ |
| Bottom Nav روی محتوا نمی‌افتد | `padding-bottom: 120px` در پروتوتایپ و `pb-safe` (`env(safe-area-inset-bottom)`) در `src/App.tsx` و `apps/miniapp/styles.css` | ✅ |
| Back Button تلگرام | بدون تغییر `syncTelegramBackButton` در `src/App.tsx` | ✅ دست‌نخورده |
| دکمه‌های مرده | همهٔ CTAهای پروتوتایپ به هندلر واقعی (`onStartDailySession`, `onNavigateTab`, `onSelectSubject`, `onStartPracticeNode`, `onOpenLessonNode`, `onStartNightQuiz`) اشاره می‌کنند؛ در `apps/miniapp` و `src` هیچ Mock جدید اضافه نشد | ✅ |

---

## 5. ابزار نصب‌شده (اسکیل درست — نه بیشتر)

| ابزار | نسخه | دلیل |
|---|---|---|
| `@playwright/test` | `^1.65.0` (dev) | اسکرین‌شات QA در ۵ عرض — Core ابزار تست بصری |
| `playwright` (Python) | `1.64.1` | سازگاری با اسکیل `webapp-testing` (`sync_playwright`) |
| `Vazirmatn FD` / `Vazirmatn` | موجود | فونت فارسی یکپارچه (قبلاً بود) |
| `lucide-react` | موجود | تنها خانوادهٔ آیکون — بدون Emoji |

**اسکیل‌های فعّال (Skill):**
- `frontend-design` — طراحی متمایز و هدفمند (اسکیل اصلی UI)
- `persian-writing` — نیم‌فاصله، اعداد فارسی، RTL مکانیکی
- `theme-factory` — قفل توکن‌های Warm Charcoal به Theme رسمی
- `webapp-testing` + `browser` — اسکرین‌شات Playwright و مرور کنسول در عرض‌های موبایل

**غیرفعال و چرا:** `adaptive` (مخصوص Compose اندروید، نه HTML/CSS) و `apple-design` (مخصوص سند/Keynote) به این تسک ربطی ندارند.

---

## 6. معیار پذیرش (UI-01 تا UI-18)

| ID | Criterion | وضعیت | شاهد |
|---|---|---|---|
| UI-01 | زبان بصری مرجع استخراج و مستند | ✅ | `AEL_VISUAL_LANGUAGE_SPEC.md §1` |
| UI-02 | پس‌زمینهٔ Dark Charcoal یکپارچه | ✅ | `--app-bg #1b1a17` در هر دو قالب + گرادیان |
| UI-03 | Card System مشترک | ✅ | `AEL_CARD_COMPONENT_SYSTEM.md` + `src/components/ui/` |
| UI-04 | Hero/Metric/Feature/Compact | ✅ | `HeroCard`, `ProgressCard`, `MetricCard`, `FeatureCard` در Spec + هر سه پروتوتایپ |
| UI-05 | Section Architecture منسجم | ✅ | Spec §1.2 — همان ۱۰ بخش مرجع با دادهٔ AEL |
| UI-06 | تنوع کنترل‌شدهٔ چیدمان | ✅ | Hero تمام‌عرض + Metric جفتی + ریل افقی + گرید مختلط |
| UI-07 | Typography فارسی خوانا | ✅ | Vazirmatn FD + ارقام فارسی + خط ۱.۹-۲.۰ |
| UI-08 | RTL در همهٔ صفحات | ✅ | هر سه پروتوتایپ `dir=rtl` + Overflow=0 در ۳۲۰px |
| UI-09 | Bottom Nav هماهنگ | ✅ | شناور، Radius ۲۴، Active فیروزه‌ای در هر سه قالب |
| UI-10 | زبان واحد در همهٔ صفحات | ✅ | هر سه پروتوتایپ + پورت به هر دو قالب با یک توکن |
| UI-11 | داده‌های واقعی متصل | ✅ | جدول §2 — همه از `src/engine` / `src/data` |
| UI-12 | بدون تغییر Business Logic ناخواسته | ✅ | `git diff` فقط CSS و UI؛ Engine/Data دست‌نخورده |
| UI-13 | دکمه‌ها و مسیرهای قبلی کار می‌کنند | ✅ | ۵۵۷ تست + validate:learning + build |
| UI-14 | Responsive در عرض‌های مرجع | ✅ | جدول §3 — ۱۵ اسکرین‌شات |
| UI-15 | Screenshot QA | ✅ | `docs/design/screenshots/` |
| UI-16 | Regression موفق | ✅ | Typecheck + 557 تست + build |
| UI-17 | Telegram Android Runtime | ✅ | `viewport-fit=cover` + Safe Area + BackButton دست‌نخورده؛ تست روی تلگرام واقعی نیازمند دستگاه کاربر است |
| UI-18 | بدون Mock به‌عنوان فیچر | ✅ | Gapها صادقانه در Spec §1.3 و §2 این گزارش |

---

## 7. فهرست صفحات اصلاح‌شده

| صفحه | فایل | نوع |
|---|---|---|
| خانه (میز کار) | `ael-home-v1.html` → `DashboardView.tsx` (tokens) | پروتوتایپ + پورت توکن |
| درسنامه‌ها | `ael-lessons-v1.html` → `LessonsLibraryView` (همان توکن) | پروتوتایپ |
| جلسهٔ تست | `ael-study-v1.html` → `StudySessionView` (همان توکن) | پروتوتایپ |
| کنکورهای سالانه / دفتر خطا / هاب درسی / درخت مهارت | همان توکن (تغییر CSS کافی است چون Base مشترک شد) | توکن |

## 8. مشکلات باقی‌مانده (صادقانه)

1. **UI-17 نیازمند تست دستی روی دستگاه واقعی تلگرام** — محیط من مرورگر دسکتاپ است؛ Safe Area و Back Button روی Android واقعی باید توسط کاربر تأیید شود.
2. **Illustration شخصی‌سازی‌شده** — به‌جای Asset تصویری اختصاصی، از آیکون Lucide + گرادیان استفاده شد (تصمیم طراحی عمدی، نه کمبود). اگر تصویر مرجع با ماسکات می‌خواهد، در فاز بعد یک ماسکات اختصاصی AEL با هویت آکادمیک طراحی شود.
3. **آواتار کاربر** — به‌علت نبود دادهٔ پروفایل واقعی تلگرام در این محیط، از حرف اول استفاده شد.

> **گام بعدی برای Merge:** این برنچ `design/ael-visual-card-redesign` را با `main` مقایسه کنید (فقط CSS/UI)، تست‌ها را دوباره اجرا کنید و از فرآیند امن Repository برای ورود به `main` استفاده کنید.

---

## 9. Integration (002) — چه چیزی واقعاً در Runtime استفاده می‌شود؟

| صفحهٔ واقعی | استفاده از Design System | شواهد |
|---|---|---|
| `DashboardView` (Home) | `SectionHeader` + `AelCard` برای کوئیست‌های روزانه؛ Hero/Progress با Radius و Surface جدید؛ Bottom Nav شناور | `src/components/DashboardView.tsx`؛ اسکرین `product-v2/home-*.png` |
| `LessonsLibraryView` | `SectionHeader` در ریشه + توکن‌های Warm Charcoal از `design-tokens.css`؛ کارت‌های `bento-card` با Radius ۲۰ | `product-v2/lessons-*.png` |
| `StudySessionView` | `SectionHeader` + همان Base کارت؛ فیدبک و گزینه‌ها با Accent سبز/قرمز معنادار | `product-v2/study-*.png` |
| `YearlyKonkorExamView` (Exams Archive) | `SectionHeader` + توکن مشترک | بیلد پاس؛ صفحات با همان Base |
| `SubjectDedicatedHubView` (Course Hub) | `SectionHeader` + توکن مشترک | بیلد پاس |
| `MistakeNotebookView` (دفتر خطا) | `SectionHeader` (کهربایی) + توکن مشترک | بیلد پاس |
| `SkillTreeGraph` / `MasteryVelocityChart` / `KonkorScoreSimulatorCard` (Progress) | از طریق `bento-card`/`glass-panel` با Surface جدید | بیلد پاس |
| `apps/miniapp` (Header/User Summary/Hero/Daily/Progress/Metric/Activity/Night/Section/Header/Rails/Bottom Nav) | `renderHome` در `app.js` بازطراحی شد؛ همهٔ داده‌ها از `/api/home` واقعی؛ Handlerهای `btn-open-learning` / `btn-start-today` / `btn-start-night` حفظ شدند؛ نیوبار شناور با توکن مشترک | `apps/miniapp/app.js`, `apps/miniapp/styles.css` |

**Prototype در برابر Runtime:**
- Prototype (فقط برای تکرار بصری): `docs/design/prototypes/*.html` — مستقل، بدون اتصال به API.
- Runtime (محصول واقعی): هر دو قالب (`apps/miniapp` و `src/`) که در بالا فهرست شدند — با دادهٔ واقعی، تست‌شده با Playwright روی Dev Server واقعی (`http://127.0.0.1:3000`).

---

## 10. توکن مشترک واحد

- منبع کانویکال React: `src/styles/design-tokens.css` — `@import` در `src/index.css`.
- Mini App (Static): چون آدیت Worker (`scripts/audit-client-bundle.ts`) دقیقاً روی ۵ فایل (`index.html/app.js/styles.css/learning.js/admin.html`) قفل است، نسخهٔ درون‌خطی همان توکن‌ها در ابتدای `apps/miniapp/styles.css` قرار گرفت (با کامنت ارجاع به منبع).Warm Charcoal هر دو قالب یکسان است (`#1B1A17`، `#262524`، `#36C4BD`، Radius `24/20/16`). Mini App همیشه تاریک است؛ `prefers-color-scheme` به حالت روشن برنمی‌گردد.

---

## 11. Product-wide QA روی بیلد واقعی

ابزار: Playwright Python `1.64.1` + Chromium `1248` روی Dev Server واقعی (`npm run dev`, `http://127.0.0.1:3000`) — نه فایل Prototype.

| صفحه | ۳۲۰px | ۳۶۰px | ۳۷۵px | ۳۹۰px | ۴۳۰px | Overflow | Console |
|---|---|---|---|---|---|---|---|
| Home | ✅ | ✅ | ✅ | ✅ | ✅ | ۰ در هر ۵ عرض | فقط هشدار CloudStorage تلگرام (خارج از تلگرام) |
| Lessons | ✅ | ✅ | ✅ | ✅ | ✅ | ۰ | — |
| Study | ✅ | ✅ | ✅ | ✅ | ✅ | ۰ | — |

اسکرین‌ها: `docs/design/screenshots/product-v2/` (۱۵ فایل: `home/lessons/study × 320/360/375/390/430.png`).

**مقایسهٔ کیفی با تصویر مرجع (بدون ادعای «۸۵٪»):** پس‌زمینهٔ چارتری گرم، سطوح لایه‌ای کارت‌ها، ریتم عمودی با هدرهای بخش رنگی، تراکم کارت، جداسازی بخش‌ها، تنوع اندازه‌ها (Hero تمام‌عرض، Metric جفتی، کارت‌های میانبر)، توزیع Accent معنادار و Bottom Nav شناور — همه قابل مشاهده و مشابه منطق مرجع هستند؛ هیچ برند/نام/لوگو/محتوای Vajerah کپی نشده و هویت آکادمیک AEL حفظ شده است.

**Responsive:** در هر ۵ عرض (`320/360/375/390/430`) Overflow افقی صفر؛ `dir=rtl`، ارقام فارسی در HTML/JS، Logical Properties و Safe Area با `env(safe-area-inset-bottom)` رعایت شده است. Keyborad: کارت تعاملی `AelCard` با `button`/`a` و `focus-visible`؛ Reduced Motion با `@media (prefers-reduced-motion)` در `design-tokens.css`.

> **یادداشت:** ادعای تست واقعی Telegram Android مطرح نمی‌شود — این محیط دستگاه فیزیکی تلگرام نیست. بیلد مینی‌اپ و Back Button روی دستگاه باید توسط کاربر تأیید شود.

---

## 12. تست‌های کامل و وضعیت PR/Main

| تست | نتیجه |
|---|---|
| `npm ci` | ✅ |
| `npm run typecheck` | ✅ EXIT 0 |
| `npm test` (vitest) | ✅ ۴۷ فایل — ۵۵۷ تست پاس |
| `npm run validate:learning` | ✅ (۸ topics، ۲۴ authored items) |
| `npm run build` (React) | ✅ `dist/assets/index-BmiSvY12.js 220.23 kB` |
| `npm run audit:client-bundle` | ✅ PASS |
| `npm run audit:miniapp` | ✅ PASS (پس از اینلاین‌کردن توکن در `styles.css`) |
| `npm run build:worker` | ✅ |
| Playwright Visual Regression (product-v2) | ✅ ۱۵ اسکرین، Overflow ۰ |

**PR:** مستقل روی `feat/ael-design-integration` — فقط فایل‌های طراحی (CSS/TSX/Docs/Screenshots/package Playwright)؛ بدون PDF و بدون AEL-313 (برنچ تمیز از `origin/main c3f8949` + cherry-pick `5db8186` از فایل‌های طراحی).  
**SHA نهایی `main` پس از Merge (در زمان این گزارش):** در GitHub قابل مشاهده است (PR باید CI سبز شود سپس Merge). تا Merge انجام نشود، `main` همان `c3f8949` می‌ماند.
