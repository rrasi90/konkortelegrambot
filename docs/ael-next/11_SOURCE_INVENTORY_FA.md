# SRC-01 — فهرست اولیه منابع، حقوق و دسترسی

- **تاریخ:** ۵ نوامبر ۲۰۲۶ / ۱۴ آبان ۱۴۰۵
- **مبنا:** دادهٔ موجود در کامیت `c9c3b6c` — بدون ورود منبع تازه و **بدون حدس هیچ وضعیت حقوق یا اصالتی**؛ مجهول‌ها صریح «نامشخص» یا «در انتظار بررسی» ثبت شده‌اند.
- **قاعده:** در دسترس بودن یک منبع با اجازهٔ انتشار آن یکی نیست (بخش ۶٫۵ نقشهٔ راه). تصمیم نهایی هر دستهٔ استفاده با SRC-02 است.

## ۱. بسته‌های آموزشی تألیفی (content/learning-courses/)

| فایل | محتوا | origin | rights | review | منابع |
|---|---|---|---|---|---|
| financial-management.json (v1.1.0) | ۸ مبحث، ۲۴ سؤال MCQ | authored | original_ael | pending_sme | ۸ مرجع مفهومی OpenStax Principles of Finance (فصل ۶–۱۹)، `checkedOn: 2026-11-04` |
| statistics-foundations.json (v1.2.0) | ۲ مبحث، ۵ سؤال (۴ MCQ + ۱ تشریحی با روبریک) | authored | original_ael | pending_sme | ۲ مرجع NIST Engineering Statistics Handbook |

هش نسخه: هش فایل‌ها در زمان ممیزی بعدی ثبت شود. **باز (SRC-02):** شرایط استفادهٔ OpenStax و NIST برای نمایش ارجاع، بازنشر محتوا و ورود به سرویس هوش مصنوعی تعیین نشده است.

## ۲. شناسنامه‌ها و شواهد (content/learning-evidence/)

- **question-index.json** — ۱۶۸ رکورد (فقط متادیتا؛ بدون متن/کلید): ۱۳۹ `exam_trace` + ۲۹ `authored`. تفکیک verification: ۱۰۱ `official_key_cited_in_reference`، ۳۸ `transcribed_pending_key_review`، ۲۹ `authored`. auditStatus: ۱۳۴ `not_checked`، ۲ `conflict`، ۳ `image_match_pending_key`، ۲۹ `authored`. وضعیت حقوق تاریخی‌ها: `pending_review`.
- **source-audit.json** — ۵ شاهد با هش SHA-256 از PDFهای `public/assets/aistudio/`؛ ۲ `conflict` (کشش ۱۳۹۶ شمارهٔ ۹۹ و ۱۴۰۵ شمارهٔ ۸۷) + ۳ `image_match_pending_key`. تطبیق دیداری؛ **تأیید مستقل اصالت فایل یا کلید رسمی نیست**.
- **recurrence.json** — پنجرهٔ ۱۳۹۶–۱۴۰۵؛ یک الگوی کاندید BCG با `trace_pending_review`.
- **concept-rules.json** — ۲ قاعدهٔ تشخیص (کشش نقطه‌ای، خانه‌های BCG).

## ۳. بانک‌های تاریخی (content/questions/)

| فایل | تعداد | توضیح |
|---|---|---|
| bank-official_traced_arshad.json | ۱۰۱ سؤال | تولیدشده؛ verificationStatus دارد؛ **بدون فیلد rights صریح** |
| bank-official_traced_phd.json | ۳۸ سؤال | همان بالا |
| bank-quarantine.json | ۱۷ سؤال | tier=quarantine (شامل قرنطینهٔ ۱۴۰۴ دکتری) |

مجموع ۱۳۹ رکورد تاریخی = همان شمار شناسنامه‌ها. حقوق از `copyrightStatus` در ایندکس نگاشت می‌شود اما در خود بانک‌ها فیلد نیست → همهٔ رکوردهای تاریخی عملاً «در انتظار بررسی حقوق».

## ۴. دانش، سرفصل و امتحان (content/knowledge/)

courses.json (۶ درس)؛ syllabus-nodes.json (۲۴ گره)؛ skills.json (۲۳ مهارت)؛ question-skill-mappings.jsonl (۱۸ خط)؛ relations.jsonl (۱۴ خط)؛ exam-packs/phd-management-business-v1.json+sql (بستهٔ دکتری ۲۱۶۴، `synthetic: false`). **بدون فیلد حقوق در همه** — وضعیت: نامشخص.

## ۵. کتاب‌ها و آزمون متنی (content/markdown/)

- **books/** — ۱۵ پوشهٔ کتاب، ۴۶ فایل .md، اغلب با ۱ فصل نمونه. تنها لایهٔ قدیمی با فیلد حقوق واقعی: `rights_status: licensed`، `legal_acquisition_url`، `isbn`، `confidence_level`. صحت این اعلان‌ها مستقل بازبینی نشده است.
- **exams/** — ۱ آزمون (business/1404 paper + answer-key). حقوق: نامشخص.
- **syllabi/** — ۱ سرفصل. حقوق: نامشخص.

## ۶. ورودی Anki (content/anki-import/ و مکمل‌ها)

MANIFEST.md اعلان ۲۲,۴۶۲ کارت و ۶۵ تصویر دارد؛ فایل ثبت‌شدهٔ cards-sqlite.json فقط ۳۰ نمونه کارت دارد؛ skills-map.json با ۰ نگاشت. **بدون فیلد حقوق** — حقوق محتوای Anki کاربر (کارت‌ها و تصاویر کتاب) نامشخص است و تا تعیین حق نباید در دارایی عمومی توزیع شود.

## ۷. خلاصهٔ شکاف‌ها برای SRC-02

1. OpenStax (پایهٔ مفهومی بستهٔ مالی) — شرایط بازنشر/تجاری/AI بررسی نشده. پیش‌فرض تا تصمیم: ارجاع داخلی باشد؛ متن/تصویر محدودشده در خروجی عمومی و ورودی AI نرود.
2. بانک تاریخی کنکور (۱۳۹ رکورد) — حق نشر دفترچه‌های سنجش و کلیدها نامشخص؛ نمایش داخلی ≠ بازنشر.
3. کتاب‌های دارای فیلد licensed — صحت اعلان و دامنهٔ مجاز (نمایش متن/آفلاین/AI) جدا بررسی شود.
4. Anki و تصاویر — مالکیت و اجازه نامشخص.
5. هش نسخهٔ منابع: فقط ۵ شاهد ممیزی‌شده هش دارند؛ بقیه فایل‌ها هنوز شناسنامهٔ هش ندارند.

گزارش پوشش با مخرج: برای هر دفترچه «مورد انتظار / دریافتی / دارای کلید / قابل انتشار» در SRC-05 ساخته می‌شود؛ این سند آن ادعا را نمی‌کند.
