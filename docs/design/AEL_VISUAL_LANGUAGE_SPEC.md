# AEL Visual Language Spec — Crouton Alpha

**منبع الهام بصری:** تصویر مرجع Vajerah (وضعیت: تحلیل مستقل در §1)  
**محصول:** مینی‌اپ تلگرام AEL — سامانه یادگیری تطبیقی کنکور ارشد/دکتری مدیریت  
**فونت:** `Vazirmatn FD` (موجود در `index.html` و `src/index.css`)  
**وضعیت اجرا:** Design System رسمی AEL — استخراج‌شده از مرجع، تطبیق‌یافته با داده و هویت واقعی AEL (نه کپی برند/محتوا)

---

## 1. تحلیل تصویر مرجع (Reference Design Extraction)

### 1.1 Overall Visual Language
- **Dark immersive** با پس‌زمینه چارتری گرم (نه مشکی خالص `#000` و نه گِرافیت سرد)
- **کارت‌های لایه‌ای** با روشنایی تدریجی: پایه → سطح اصلی → سطح برجسته
- **Radius بزرگ و نرم:** کارت برجسته ~۲۴px، کارت معمولی ~۱۸px — مرز سخت وجود ندارد
- **Gradient ملایم در Hero:** بافت کرم/هلویی با Illustration سمت راست (به‌جای آن در AEL: گرادیان فیروزه/کهربایی آکادمیک با آیکون Lucide)
- **سایه نرم + Border کم‌کنتراست:** سایه سنگین نیست؛ تفکیک با اختلاف روشنایی Surface + خط `rgba(255,255,255,0.07)`
- **Accent کنترل‌شده و معنادار:** هر دسته یک رنگ (فیروزه=اقدام، بنفش=مرور، سبز=تسلط، کهربایی=هشدار)
- **ترکیب RTL تمیز:** همه‌چیز به‌جز اعداد/کد از راست شروع می‌شود؛ آیکون هدایت (chevron) رو به چپ است

### 1.2 معماری چیدمان مرجع (از بالا به پایین)
1. Header جمع‌وجور (نام کاربر + آواتار + Stat chips)
2. Hero Featured Card تمام‌عرض (پیام مستقیم + Illustration)
3. Progress Summary Card (عدد بزرگ + رینگ + دو ستون توضیح)
4. Daily Task Card (چیک + نوارهای پیشرفت کوتاه + پیل‌های انتخاب مقدار)
5. دو Metric Card کنار هم (۱۴۰ روز / ۴۹ لغت + مینی‌بارگراف)
6. دو کارت افقی تمام‌عرض (کتاب‌ها + آخرین فنجان)
7. بخش «رویدادها» — کارت افقی برجسته
8. بخش «با دوستان/بازی» — گرید ۲ستونه رنگی (مسابقات زنده / دوئل لغت)
9. بخش «تمرین آزاد» — گرید ۲ستونه (هم‌معنی‌ها / شنیداری)
10. کارت Promotional تمام‌عرض بنفش + کارت دوم
11. Bottom Navigation شناور (شیشه‌ای تیره، گوشه گرد، Active فیروزه‌ای)

**اصل مرجع:** صفحه از «بخش‌های مستقل با عنوان جدا» تشکیل شده ولی همه یک Design System هستند. هیچ بخش برای جلب‌توجه، سیستم خودش را نمی‌سازد.

### 1.3 انواع کارت مرجع (و تطبیق به AEL)
| نوع مرجع | تطبیق AEL | داده واقعی |
|---|---|---|
| Header + کاربر | سلام + گرایش فعال + Streak/XP | `stats.streakDays`, `stats.xp`, `BRANCH_LABELS[stats.selectedMajorBranch]` در `src/components/DashboardView.tsx` |
| Hero Card | **مرور امروز** — تعداد گام صف هوشمند | `queue.length` از `dailyQueue` در `src/App.tsx` |
| Progress Card | **تسلط کل گراف دانش** — رینگ + تثبیت‌شده | `overallMastery`, `masteredOrProvenCount / nodes.length` |
| Daily Task | **کوئیزهای روزانه** — لیست `dailyQuests` + CTA شروع | `stats.dailyQuests` از `src/engine/aelEngine.ts`, `onStartDailySession` |
| Metric دوتایی | **صحیح/غلط/نزده + درصد خالص کنکور** | `stats.correctCount/wrongCount/skippedCount`, `netKonkorPercent = (3*correct - wrong) / (3*total)` |
| Horizontal Cards | **آرشیو کنکور ۱۳۹۱-۱۴۰۵ + درخت مهارت** | `YEARLY_KONKOR_BOOKLETS`, `SkillTreeGraph` |
| Feature Grid ۲ستونه | **درسنامه‌ها + دفتر خطا** | `LessonsLibraryView`, `MistakeNotebookView` |
| Practice Grid | **۸ درس رسمی ضریب‌دار** | `SUBJECT_COURSE_DEFINITIONS` در `src/data/subjectHubMeta.ts` |
| Promotional | **کوییز شبانه** (قابلیت واقعی) | `handleStartNightQuiz` — نه مسابقه ساختگی |

**Gapهای صادقانه (بدون Mock):** آواتار تلگرام واقعی نداریم → آیکون گرایش؛ سیستم Event/League نداریم → جای آن با کوییز شبانه؛ «مسابقه زنده» نداریم → جای آن با «اولویت‌ ROI» و «فصول پرتکرار» پر می‌شود (هم در `roiRankings` و `examFrequencyList` موجود است).

---

## 2. Color Architecture (Warm Charcoal)

به‌جای مشکی خالص — طیف چارتری گرم، سازگار با «جوهر و کاغذ» AEL در `src/index.css` (`--paper #f6f2e9`).

```css
:root {
  --app-bg: #1b1a17;          /* پس‌زمینه اصلی گرم */
  --app-bg-deep: #141312;     /* عمق جزیی */
  --surface-primary: #262524;
  --surface-secondary: #2e2d2b;
  --surface-elevated: #3a3937;

  --border-subtle: rgba(255,255,255,0.07);
  --border-active: rgba(255,255,255,0.14);

  --text-primary: #f4f3f1;
  --text-secondary: #b1b0b0;
  --text-muted: #7a7a7c;

  --accent-teal: #36c4bd;     /* اقدام اصلی / مرور امروز */
  --accent-blue: #658ff2;     /* آزمون */
  --accent-purple: #9274dc;   /* مرور / FSRS */
  --accent-green: #55b995;    /* تسلط / صحیح */
  --accent-amber: #d6a45f;    /* هشدار / دفتر خطا */
  --accent-orange: #dc805d;   /* رویداد / کوییز شبانه */
}
```

قاعده استفاده: Accent برای **معنا** است، نه تزئین بی‌منطق. هر کارت دقیقاً یک Accent دارد که از دسته‌اش گرفته شده.

### معادل Tailwind v4 (در `src/index.css`)
توکن‌های `--color-*` فعلی (`--color-blue-*` پترولی و `--color-slate-*` گرم) دست نمی‌خورند (ریسک رگرسیون)؛ توکن‌های جدید AEL به‌صورت `--color-ael-*` کنار آن‌ها اضافه می‌شوند و در کامپوننت‌های جدید مصرف می‌شوند.

---

## 3. Background
پس‌زمینه تخت ممنوع. ترکیب:
- `radial-gradient` فوق‌ملایم فیروزه در بالای صفحه (شفافیت ~۶٪) و بنفش در سمت چپ (~۴٪) — تمرکز را از کارت نمی‌گیرد
- `linear-gradient` عمودی `#1b1a17 → #141312` برای عمق
- هیچ Pattern نقطه‌ای/گرید (برخلاف `ambient-bento-bg` فعلی که برای تم کاغذی بود)

---

## 4. Radius / Elevation / Spacing

| توکن | مقدار | کاربرد |
|---|---|---|
| `--radius-card-lg` | `24px` | Hero، کارت Promotional |
| `--radius-card-md` | `20px` | کارت Progress، Daily Task |
| `--radius-card-sm` | `16px` | کارت Metric، کارت درسی |
| `--radius-pill` | `999px` | چیپ، پیل، ناوبری |
| `--radius-button` | `14px` | دکمه‌ها |

**Elevation:** `border: 1px solid var(--border-subtle)` + اختلاف روشنایی Surface + `box-shadow: 0 8px 24px rgba(0,0,0,0.35)` نرم. بدون دیده‌شدن سایه در لبهٔ موبایل.

**۴px Grid:** `4 / 8 / 12 / 16 / 20 / 24 / 32` — Gap کارت `12px`، Padding داخلی `16px`، فاصلهٔ بخش `28px`.

---

## 5. Typography (فارسی)

| نقش | اندازه | وزن | خط |
|---|---|---|---|
| عنوان کارت | `15-17px` | ۷۰۰ | ۱.۶ |
| توضیح | `12-13px` | ۴۰۰ | ۱.۹-۲.۰ |
| Metric بزرگ | `28-36px` | ۸۰۰ `tabular-nums` | ۱.۱ |
| لیبل بخش | `12px` | ۷۰۰ | ۱.۵ |

اعداد فارسی با ارقام شرقی (`۷۶` نه `76`)، نیم‌فاصله اجباری (`می‌شود`)، وزن‌بندی محدود (فقط ۴۰۰/۶۰۰/۷۰۰/۸۰۰).

---

## 6. Grid و Section Architecture

- **موبایل (≤640px):** تک‌ستون، Metric‌ها ۲ستونه، دروس ۲ستونه، ریل افقی برای ۸ درس (scroll-snap)
- **تبلت (641-1023px):** Hero تمام‌عرض + Grid دوتایی، دروس ۴ستونه
- **دسکتاپ (≥1024px):** Hero + Progress در کنار هم (۷/۵)، Grid چهارتایی — هم‌خانواده با `bento-span-*` فعلی ولی با Radius و Surface جدید

---

## 7. Navigation Design

Bottom Nav شناور (شبیه مرجع):
- `position: fixed; bottom: 12px; inset-inline: 12px; border-radius: 22px; backdrop-filter: blur(12px)`
- آیکون + لیبل ۱۰px، Active با پس‌زمینه `teal/12%` و آیکون فیروزه‌ای
- `padding-bottom: env(safe-area-inset-bottom)`
- ۴ مقصد اصلی از `src/App.tsx` فعلی: `میز کار / جلسه تست / کنکورها / درسنامه` + دکمهٔ «بیشتر» (نقشه/دفتر خطا)

---

## 8. Motion Rules
- Press: `scale(0.97)` در ۱۲۰ms
- Card hover: `translateY(-1px)` + روشنایی Border (فقط اشاره‌گر واقعی)
- Progress Ring: انیمیشن ۶۰۰ms ease-out
- Progress Bar: ۴۰۰ms
- Carousel: scroll-snap + `scroll-behavior: smooth`
- `prefers-reduced-motion`: همه انیمیشن‌ها به ۰.۰۱ms (موجود در `src/index.css`)

---

## 9. RTL و Mobile-First (الزامی — از Mission §7)

- `dir=rtl` در سطح document (موجود در `index.html` و `apps/miniapp/index.html`)
- Chevron هدایت در RTL: `<` (سمت چپ) — از `ArrowLeft` در Lucide استفاده می‌شود
- Carousel در RTL: اسکرول به‌چپ، `scroll-snap-type: x proximity`
- حداقل ۳۲۰px بدون Overflow افقی: `min-width: 0` در همهٔ Flex فرزندان، `word-break: keep-all` برای فارسی
- اعداد و فرمول‌ها: اعداد فارسی جدا از کلمات لاتین/کد با `<bdi>` یا `dir=ltr` روی خود عدد
- Safe Area تلگرام: `env(safe-area-inset-*)` در Bottom Nav و Header

---

## 10. Asset و Illustration Strategy
- Asset موجود پروژه بررسی شد: هیچ Illustration برند نداریم → از **آیکون Lucide** (یک خانواده) استفاده می‌شود، نه Emoji و نه Stock
- هر دستهٔ محتوایی یکی زبان تصویری: 
  - مرور امروز → Play (فیروزه)، آزمون → Award (آبی)، درخت مهارت → Network (سبز)، دفتر خطا → BookMarked (کهربایی)، زبان → Languages (بنفش)

---

## 11. فازبندی اجرا (اشاره — جزئیات در Implementation Report)
- **Phase A:** Audit انجام شد (دو پیاده‌سازی: `apps/miniapp` و `src/`)
- **Phase B:** همین سند
- **Phase C:** توکن‌ها + کامپوننت‌های پایه (`src/components/ui/`)
- **Phase D:** Home (`DashboardView`) با این زبان
- **Phase E:** سایر صفحات (`LessonsLibraryView`, `MistakeNotebookView`, `YearlyKonkorExamView`, `SubjectDedicatedHubView`, `SkillTreeGraph`, `StudySessionView`)
- **Phase F:** اسکرین‌شات QA با Playwright در ۵ عرض
- **Phase G:** Regression — هر دکمه تست می‌شود، Back Button تلگرام چک می‌شود
