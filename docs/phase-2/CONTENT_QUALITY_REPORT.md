# گزارش کیفیت محتوا — Phase 2

تاریخ: ۱۴۰۵-۰۸-۱۰ (۲۰۲۶-۱۱-۰۱) · شاخه: `fix/mission-remediation-20261101`
منابع داده: `content/questions/bank-*.json` (خروجی `scripts/build-question-bank.mts`)، جداول `src/data/`.

## ۱. شمارش‌های واقعی بانک (بدون تورم)

| لایه | تعداد | ارجاع منبع | توضیح (>۲۰ نویسه) | شماره سؤال دفترچه | courseId نگاشت‌شده |
|---|---|---|---|---|---|
| دکتری traced | **۳۸** | ۳۸/۳۸ | ۳۸/۳۸ | ۱۱/۳۸ | ۳/۳۸ |
| ارشد traced | **۱۰۱** | ۱۰۱/۱۰۱ | ۱۰۱/۱۰۱ | ۸۵/۱۰۱ | ۱۶/۱۰۱ |
| قرنطینه | **۱۷** | ۱۷/۱۷ | ۱۷/۱۷ | ۰/۱۷ | ۰/۱۷ |
| کل یکتا | **۱۵۶** (از ۲۵۲ ورودی خام) | | | | |

- ۹۶ رکورد تکراری با شناسهٔ یکسان ادغام شدند؛ **تعارض محتوایی: ۰** (هر تکرار دقیقاً همان متن/گزینه‌ها/پاسخ بود — رجیستر R-026).
- هیچ گزینهٔ خالی (`options: []`) در هیچ لایه‌ای نیست؛ همه ۴ گزینه‌ای‌اند و `correctOption` در بازه است (تست‌های `questionBank.test.ts`).
- سه placeholder مستنداتی (`phd-1405-001..003`) عمداً خارج از بانک‌اند و تست «نبودشان» سبز است → **R-006 بسته شد (scoped)**.

## ۲. تفکیک صادقانهٔ سطح ادعا
- **«official» نیست**: لایهٔ دکتری `transcribed_pending_key_review` است — متن سؤالات از دفترچه‌ها ثبت شده، اما کلید پاسخ رسمی سنجش در مخزن پیوست نیست و دریافت PDF با 403 مسدود است (R-005). پاسخ‌ها تحلیل کتاب‌درسان است.
- **ارشد**: `official_key_cited_in_reference` — کلید رسمی در sourceReference ذکر شده؛ تأیید نهایی همچنان `reviewStatus: not_reviewed` (نبود SME = BLOCKED).
- **قرنطینه**: ۱۷ آیتم علامت‌دار؛ هرگز به کاربر سرو نمی‌شود تا سرچشمهٔ کلید روشن شود.

## ۳. پوشش درسی (SUBJECT_COVERAGE_REPORT.csv)
- ۸ بخش درسی + `unmapped`؛ انگلیسی «thin» (۴ traced) و `islamic` بدون courseId نگاشت.
- ۴۳ آیتم (۲۷ دکتری + ۱۶ ارشد) هنوز `courseSectionId` ندارند → نگاشت به درخت دانش در فاز بعد الزامی است (R-027 ثبت شد).
- پوشش سال‌های ارشد: ۱۳۹۱–۱۴۰۵ (۱۵ سال، ۲۷ گروه منبع در رجیستر کپی‌رایت).

## ۴. کیفیت درس‌نامه‌ها (LESSON_QUALITY_REPORT.csv)
- ۲۵ درس عمیق (deep-dive)؛ همه دارای objective، section، مثال، misconception، takeaway و examAngle؛ هیچ‌کدام پرچم `quality_issues` نگرفتند (ستون issues == none).

## ۵. پارامترهای روان‌سنجی
- `difficulty` و `cognitiveLevel` در تمام ۱۵۶ آیتم `unclassified` است؛ **هیچ پارامتر CTT/IRT فرضی تولید نشد** (نبود دادهٔ پاسخ واقعی — ITEM_ANALYSIS_REPORT.md). این عمدی و طبق ممنوعیت پلن است.

## ۶. وضعیت اقلام رجیستر اصلاح
| قلم | وضعیت جدید |
|---|---|
| R-006 بانک placeholder | PASS_WITH_EVIDENCE (scoped) — بانک ۱۵۶ آیتمی با ارجاع؛ شواهد: `evidence/phase-2/questionbank-vitest.txt` |
| R-007 چکلیست اعتبارسنجی محتوا | IMPLEMENTED_UNVERIFIED — این گزارش به‌جای چکلیست تیک‌خورده، verdict موردی از روی داده تولید می‌کند؛ بازبینی انسانی BLOCKED |
| R-008 آمار نمایشی item-analysis | PASS_WITH_EVIDENCE — مقادیر illustration حذف/برچسب‌خورده؛ ITEM_ANALYSIS_REPORT.md فقط روش‌شناسی + وضعیت BLOCKED را ثبت می‌کند |
| R-026 (جدید) شناسه‌های تکراری دادهٔ مبدأ | IN_PROGRESS — بانک dedup می‌کند و تست دارد؛ پاک‌سازی مبدأ (konkorData/yearlyKonkorExams) در فاز ۳ |
| R-027 (جدید) کد دفترچهٔ ارشد روی آیتم‌های دکتری | PASS_WITH_EVIDENCE — resolveBookletCode فقط از sourceReference خود آیتم کد می‌گیرد؛ بقیه null؛ تست «PhD never inherits arshad code» سبز |
