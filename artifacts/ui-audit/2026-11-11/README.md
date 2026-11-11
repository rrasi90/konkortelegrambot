# README — ممیزی تصویری کامل UI سامانه AEL

**تاریخ:** 2026-11-12 · **SHA مبنا:** `97a1f2a0e12c342ad5a7b23ac2d26ce1274eb07e` (main)
**ابزار:** Playwright 1.65 + Chrome سیستمی (headless) · dev server محلی (`npm run dev`، پورت 3000)

## خلاصهٔ آماری

| شاخص | مقدار |
|---|---|
| صفحات/حالت‌های شناسایی‌شده | ۱۱ مسیر اصلی + ۲ مسیر بدون مسیر منو (UNROUTED) |
| صفحات تصویربرداری‌شده | **۱۱ صفحه × ۳ viewport** |
| حالت‌های تعاملی ثبت‌شده | onboarding (۳ گام)، ۵ زیرتب داشبورد، placement (سؤال/انتخاب/نتیجه)، شبیه‌ساز ربات، جلسه مطالعه (کارت‌های آموزشی/سنجش/امتیازدهی)، کنکور سالانه (۴ حالت + بودجه‌بندی + پاسخ‌برگ)، درخت مهارت (کلیک نود)، درسنامه (محتوا + سنجش)، هاب تفکیکی (۴ زیرتب)، دفتر خطا (Zero-State)، code-patches (تلاش مسیر) |
| **مجموع اسکرین‌شات** | **۱۵۳** (desktop ۴۵ · mobile ۶۰ · telegram ۴۸) |
| desktop / mobile / telegram | به تفکیک در MANIFEST.csv |
| Overflow افقی | **۰ مورد** (۲۱ ترکیب تب×viewport — `OVERFLOW-REPORT.json`) |
| سلامت فایل | همهٔ ۱۵۳ PNG امضای معتبر دارند؛ orphan = ۰ (پاک‌سازی‌شده) |
| فایل خراب | ۰ (همه PNG با امضای معتبر) |
| وضعیت | همهٔ صفحات قابل‌دسترس کامل؛ موارد NOT-CAPTURED در FINDINGS §14 صریح است |

## ساختار

```
screenshots/desktop|mobile|telegram/<page>/PAGE__STATE__VIEWPORT__SCROLL-XXXX.png
contact-sheets/<viewport>/<page>.html   ← مرور سریع با لینک به نسخهٔ اصلی
gallery/index.html                       ← فهرست کل صفحات + شمارش + لینک Contact Sheetها
MANIFEST.csv                             ← یک ردیف به‌ازای هر تصویر (۱۴ ستون)
FINDINGS.md                              ← مشاهدات اولیه UX/UI (بدون تغییر طراحی)
OVERFLOW-REPORT.json                     ← سند عددی چک overflow
```

## نحوهٔ تولید (تکرارپذیر)

```bash
npm run dev            # پورت 3000
node tools/ui-audit/capture.mjs          # سه viewport پشت‌سرهم
node tools/ui-audit/build-deliverables.mjs   # contact sheets + gallery + overflow
```

هارنس در `tools/ui-audit/` است و از کد محصول جداست (§12 مأموریت).

## روش تصویربرداری (خلاصه §5)

- هر صفحه: ابتدای صفحه ← اسکرول گام‌به‌گام (۷۵٪ ارتفاع viewport، انتظار ۳۵۰-۵۰۰ms برای lazy/chart) ← عکس از هر موقعیت با ثبت scrollY ← تشخیص انتهای واقعی (توقف scrollY / رسیدن به bottom) ← عکس نهایی BOTTOM.
- تعاملی: کلیک واقعی تب‌ها/دکمه‌ها/مودال‌ها؛ هر state با نام واضح ذخیره شد.
- تم پیش‌فرض Dark ثبت شد؛ RTL و zoom ۱۰۰٪ در همهٔ تصاویر.

## موارد کامل / ناقص

- **کامل:** داشبورد (۵ زیرتب)، onboarding (۳ گام)، placement، شبیه‌ساز ربات (سطح اول)، کنکورهای سالانه (حالت‌ها+بودجه‌بندی+پاسخ‌برگ)، درخت مهارت، درسنامه‌ها، هاب تفکیکی (۴ زیرتب)، دفتر خطا (Zero-State) — در هر سه viewport.
- **ناقص/مسدود (صریح):** CodePatches و Flashcards بدون مسیر منو (UNROUTED)، کوییز شبانه، دفتر خطای داده‌دار، SessionReport کامل — جزئیات در `FINDINGS.md` §14.

## ZIP و تحویل

- آرشیو: `AEL_UI_AUDIT_SCREENSHOTS_2026-11-11.zip` (PNGها + MANIFEST + FINDINGS + Contact Sheets + Gallery) — در ریشهٔ مخزن کنار این پوشه ساخته شده و به‌عنوان پیوست نهایی به مالک تحویل داده می‌شود (طبق §11 در مخزن commit نمی‌شود).
- Gallery محلی: [artifacts/ui-audit/2026-11-11/gallery/index.html](../../gallery/index.html) — در مرورگر باز کنید؛ کلیک روی هر تصویر = نسخهٔ اصلی.
