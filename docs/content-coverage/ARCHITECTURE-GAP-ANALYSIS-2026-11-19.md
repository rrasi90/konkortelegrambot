# تحلیل شکاف معماری بانک آزمون با مفاهیم مأموریت — ۱۴۰۵/۰۸/۲۸

**مبنای بررسی:** `packages/contracts/src/` (exam-model، question-model، question-lifecycle، academic-foundation، registry) و staging جاری.
**قاعدهٔ مأموریت:** مدل موجود با طراحی موازی جایگزین نمی‌شود؛ فقط شکاف‌ها به‌صورت افزایشی طرح می‌شوند. هیچ Migration در این مرحله اجرا نشده است.

## ۱. مفاهیم موجود (بدون تغییر)

| مفهوم مأموریت | معادل موجود | محل |
|---|---|---|
| ExamSet / ExamFamily | `ExamModelSet` (+ family در exam-catalog) | exam-model.ts |
| CourseCombination | `ExamModelCombination` | exam-model.ts |
| Subject / Component | `ExamModelSubject`, `ExamSetSubject` | exam-model.ts |
| Question / QuestionAppearance | `QuestionAppearance` | question-model.ts |
| AnswerKey / AnswerKeyRevision / OfficialAnswer | `AnswerKeyRevision` + dispute flow | question-lifecycle.ts |
| ReviewDecision | `ReviewDecision` | question-model.ts |
| ContentRights (trust/allowedUse) | trustLevel/verificationStatus/rightsStatus/allowedUse | question-model.ts |

سه محور مستقل trust/verification/rights و سیاست «منبع نامعلوم هرگز وارد verification/proof/timed_exam نمی‌شود» با بخش ششم مأموریت (حقوق نشر) همسو است؛ کلیدها در سمت سرور و جدا از بانک کلاینت نگه داشته می‌شوند (R-036 موجود).

## ۲. شکاف‌های شناسایی‌شده (طرح افزایشی، بدون اجرا)

1. **Booklet و BookletVariant:** هویت «سال × کد مجموعه × کد ترکیب × کد کنترل × نوع دفترچه × نسخه» الان در هیچ تایپی به‌عنوان یک واحد مستقل وجود ندارد؛ این هویت فقط داخل staging به‌صورت فیلدهای پراکنده است. طرح: entity جدید `Booklet` با فیلدهای مأموریت + `BookletVariant` برای scanهای جایگزین (مثل 620C/3258 در دکتری ۱۴۰۳).
2. **SourceDocument / SourceRevision:** provenance فایل‌ها (URL، SHA-256، تاریخ دریافت، وضعیت حقوق) در staging JSONها است نه در مدل. طرح: `SourceDocument` با `sha256` و `rightsStatus` که QuestionAppearance به آن ارجاع می‌دهد؛ نسخه‌ها به‌صورت رکورد جدید، بدون بازنویسی.
3. **Crosswalk تاریخی کدها:** تغییر عنوان/تجمیع زیر ۲۱۶۲ (۱۴۰۳+) فقط در crosswalk staging ثبت شده؛ مدل به آن لایه نیاز دارد تا «کد امتحانی تاریخی هر سؤال» حفظ شود بدون ادغام Appearanceها.
4. **courseCombinationCode روی Appearance:** در ساختار دکتری ۱۴۰۳ تا ۱۴۰۵ کد ترکیب بخشی از هویت منبع است و باید فیلد اختیاری Appearance شود (back-compatible: فیلد اختیاری، بدون تغییر شکل دادهٔ موجود).
5. **کلید اولیه/نهایی:** `AnswerKeyRevision` مفهوم نسخه دارد اما برچسب `initial|final` به‌صورت صریح مدل نشده؛ داده‌های این هفته (کلیدهای اولیهٔ سنجش) این نیاز را عملی نشان دادند.

## ۳. سازگاری معکوس و مسیر Migration

- همهٔ تغییرهای بالا به‌صورت فیلد/entity اختیاری و افزودنی‌اند؛ هیچ ستون یا شکل دادهٔ فعلی حذف یا بازنویسی نمی‌شود.
- Migration پیشنهادی دو مرحله‌ای است: (۱) افزودن جدول‌های booklet/source-document به‌همراه backfill از رجیسترهای staging (قابل‌بازگشت با rollback ساده)، (۲) اتصال تدریجی Appearanceها. پیش از هر اجرا: snapshot/checksum رکوردهای کاربر و اجرای تست‌های `supabase/tests/`.
- طبق مأموریت، هیچ Migration بدون تست و مسیر بازگشت وارد Production نمی‌شود؛ این سند فقط طرح است.

## ۴. پیوند با وضعیت داده

رجیستر سال‌به‌سال (`exam-code-register-1396-1405.json`)، رجیستر دریافت منابع (`manual-review/2026-11-19-source-acquisition-register.json`) و کلیدهای اولیهٔ رونویسی‌شده دقیقاً همان ورودی‌هایی هستند که backfill مرحلهٔ ۱ از آن‌ها استفاده می‌کند؛ بنابراین فاز داده و فاز معماری هم‌تراز مانده‌اند.
