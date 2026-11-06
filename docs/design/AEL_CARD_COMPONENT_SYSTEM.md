# AEL Card Component System

**اصل:** کارت‌ها نباید کپی‌های مستقل با CSS متفاوت باشند. همه از یک Base + توکن مشترک می‌آیند، ولی سایز/Accent/Variant مشخص دارند تا تفاوت بصری لازم حفظ شود (تیپ SaaS-کیت ممنوع — هر کارت یک `radius` ندارد).

---

## 1. توکن‌های پایه کارت

```css
.ael-card {
  background: var(--surface-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card-md); /* 20px */
  padding: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.28);
  min-width: 0; /* ضد Overflow در 320px */
}
.ael-card--lg { border-radius: 24px; padding: 20px; }
.ael-card--sm { border-radius: 16px; padding: 14px; }
.ael-card--clickable { cursor: pointer; transition: transform .12s, border-color .18s, background .18s; }
.ael-card--clickable:hover { border-color: var(--border-active); transform: translateY(-1px); }
.ael-card--clickable:active { transform: scale(0.98); }
.ael-card--static { cursor: default; } /* کارت غیرتعاملی نباید ظاهر کلیک داشته باشد */
```

Accent در سطح کارت از CSS Variable محلی گرفته می‌شود:
```css
.ael-card { --accent: var(--accent-teal); }
.ael-card[data-accent="blue"] { --accent: var(--accent-blue); }
.ael-card[data-accent="purple"] { --accent: var(--accent-purple); }
.ael-card[data-accent="green"] { --accent: var(--accent-green); }
.ael-card[data-accent="amber"] { --accent: var(--accent-amber); }
```

---

## 2. Variantها (هرکدام یک تیپ محسوس)

### HeroCard (`--lg`, accent از контекст)
- هدف: مهم‌ترین محتوای روز — **مرور امروز** (`queue.length` گام)
- ساختار: سطر بالا (لیبل گرایش + چیپ تعداد در سمت مخالف) → `h1` ۲۰px → توضیح کوتاه ۲ خط → سه زیرکارت شیشه‌ای (تست/درسنامه/پیش‌نیاز) → فوتور با دکمهٔ اصلی + دو اقدام ثانویه
- گرادیان ملایم فیروزه/آبی در پس‌زمینه (`linear-gradient(135deg, teal/10%, blue/8%)`)
- **تنها کارت با گرادیان برجسته** — بقیه تخت تا سلسله‌مراتب حفظ شود

### ProgressCard (`--md`)
- هدف: **تسلط کل گراف دانش** (`overallMastery`)
- ساختار: هدر (عنوان + لینک پیشرفت) → ردیف (رینگ SVG ۸۸px با Percent وسط + گرید ۲ستونهٔ زیرکارت‌ها) → فوتور `dailyQuests` با چک
- رینگ: `stroke teal`، بک‌گراند `stroke white/8`، انیمیشن ۶۰۰ms

### MetricCard (`--sm`, جفت در گرید ۲ستونه)
- هدف: آمار فشرده و قطعی (صحیح/غلط/نزده، درصد خالص)
- ساختار: آیکن گوشه + لیبل کوچک → عدد بزرگ `۲۸px` → توضیح یک‌خطی
- حجم متنی کم؛ Metric باید از دور خوانده شود

### FeatureCard (`--md`, کلیک‌پذیر)
- هدف: میانبر به بخش‌های اصلی (آرشیو کنکور / درخت مهارت / درسنامه‌ها)
- ساختار: سطر آیکن + لینک متنی، سپس عنوان + توضیح ۲ خطی
- `hover: translateY(-1px)` + Accent Border، `active: scale(0.98)`

### CourseCard (`--sm`)
- هدف: ۸ درس رسمی ضریب‌دار (`SUBJECT_COURSE_DEFINITIONS`)
- ساختار: نام کوتاه (`shortTitle`) + چیپ ضریب/تعداد تست
- Accent از `accentColor` همان درس (emerald، indigo، rose، blue، teal، amber، cyan، violet)

### ActivityCard / EventCard (`--md`, افقی تمام‌عرض)
- هدف: فعالیت جاری یا رویداد (کوییز شبانه، دفتر خطا)
- ساختار: آیکن چپ + عنوان + توضیح + chevron راست، در یک خط فشرده
- کوییز شبانه = `accent-orange`، دفتر خطا = `accent-amber`

### HorizontalCard (ریل افقی)
- همان CourseCard/ActivityCard در ظرف `overflow-x: auto` + `scroll-snap`
- عرض هر آیتم ~۲۲۰px در موبایل؛ در دسکتاپ به گرید تبدیل می‌شود

### PracticeCard (گرید ۲ستونه رنگی)
- هدف: تمرین مهارتی (زبان → `english`، شنیداری/ریدینگ → حالت‌های `studyMode`)
- پس‌زمینه رنگی مستقیم (نه سطح خنثی) برای تفکیک از کارت‌های اطلاعاتی

---

## 3. کامپوننت‌های پایه (React — `src/components/ui/`)

```
AppShell.tsx         — پس‌زمینه گرادیانی + container max-width 1240px / 440px در TMA frame
PageBackground.tsx   — فقط پس‌زمینه (بدون محتوایی)
AppHeader.tsx        — برند + ناوبری + ابزارها (همان App.tsx فعلی با توکن جدید)
SectionHeader.tsx    — عنوان بخش + لینک «نمایش همه» + chevron
HeroCard.tsx / ProgressCard.tsx / MetricCard.tsx / FeatureCard.tsx
CourseCard.tsx / ActivityCard.tsx / PracticeCard.tsx
CardGrid.tsx         — گرید ۱۲ستونه دسکتاپ / ۲ستونه موبایل با gap=12px
CardCarousel.tsx     — ریل افقی RTL با snap
BottomNavigation.tsx — شناور، safe-area aware (جایگزین nav فعلی در App.tsx)
```

همه از `AelCard` Base ارث می‌برند؛ هیچ‌کدام CSS جدا و ناسازگار ندارند.

---

## 4. قواعد امتناع (Anti-Pattern)

1. **کارت غیرتعاملی با ظاهر کلیک** — ممنوع؛ از `--static` استفاده کن.
2. **لینک/دکمهٔ مرده:** هر `onClick` باید به مسیر واقعی AEL برسد (`onStartDailySession`, `onNavigateTab`, `onSelectSubject`, `onStartPracticeNode`, `onOpenLessonNode` و...).
3. **استفاده از Emoji به‌جای آیکون طراحی‌شده** — ممنوع؛ خانوادهٔ Lucide.
4. **Mock به‌جای دادهٔ واقعی** — ممنوع؛ اگر داده نیست، بخش حذف یا Gap گزارش می‌شود.
5. **هر کارت یک `radius`/`shadow` دلخواه** — ممنوع؛ فقط توکن‌های §1.
6. **حرکت دائمی/Parallax سنگین** — ممنوع؛ فقط Micro-interaction هدفمند.

---

## 5. RTL و دسترس‌پذیری هر کارت

- همهٔ کارت‌ها `min-width: 0` + `word-break: keep-all` (ضد شکست متن فارسی)
- Focus visible: `outline: 2px solid var(--accent-teal); outline-offset: 2px`
- اعداد بزرگ با `tabular-nums` و ارقام فارسی
- سایز لمسی حداقل `44px` برای دکمه داخل کارت
