# قرارداد مدل آزمون — محورهای مقدار/شواهد و وزن‌دهی (V3-Hardening)

به‌روزرسانی: ۲۰۲۶-۱۱-۱۰ · مرجع پیاده‌سازی: `packages/contracts/src/exam-model.ts`، `packages/learning-engine/src/target-weights.ts`

## ۱. دو محور مستقل ضریب (B4)

| محور | مقادیر | معنی | جایی که زندگی می‌کند |
|---|---|---|---|
| **مقدار** (`valueState`) | `positive` / `zero` / `unknown` / `not_applicable` | فقط معنای عددی؛ هرگز دربارهٔ منبع قضاوت نمی‌کند | `ExamCoefficientValue.valueState` (یا legacy `state`) |
| **شواهد** (`evidence`) | `official_verified` / `reported` / `inferred` / `pending_verification` | فقط اعتبار منبع؛ هرگز معنای عددی نمی‌دهد | `ExamCoefficientValue.evidence` یا نگاشت از `verification` بردار |

قواعد:
1. `positive` به‌خودی‌خود رسمی نیست؛ `positive+reported` = مثبت گزارش‌شده.
2. صفر (`zero`) فقط با `official_verified` صفر رسمی است؛ در غیر این صورت هشدار `zero_pending_official_evidence` (دادهٔ legacy نیازمند بازبینی — GAP-018).
3. `unknown` همیشه value=null؛ تبدیل به صفر ممنوع.
4. `not_applicable` ≠ `unknown`: اولی «خارج از دامنهٔ این هدف»، دومی «مقدار نمی‌دانیم».
5. statusهای قدیمی (`official_positive` و …) aliasهای فقط-خواندنی‌اند و فقط از `normalizeCoefficientValueState` می‌گذرند؛ نگاشت وضعیت بردار به شواهد با `mapAssignmentVerificationToEvidence` و needs_check/draft هرگز official_verified نمی‌شوند.

## ۲. کد مجموعه و سقف انتخاب (B2/B3)

- `examSetCode` = کد **منتشرشدهٔ رسمی** دقیقاً به شکل منبع (۱ تا ۶ رقم، بدون صفر ابتدایی — `001` برای `1` رد می‌شود). شناسه داخلی پایدار فیلد جداگانهٔ `id` است؛ هیچ تبدیل ضمنی وجود ندارد.
- `selectionLimitState`: `limited` (عدد الزامی) | `unlimited` (null الزامی) | `unknown` (null الزامی — نامعلوم هرگز صفر یا بی‌سقف تفسیر نمی‌شود). غایب = رفتار legacy.
- خطای «مجموعهٔ ناشناخته» (`unknown_exam_set`) و «عبور از سقف» (`selection_limit_exceeded`) مستقل‌اند.

## ۳. وزن‌دهی عمومی و Unknown ≠ Zero (B5)

`computeSubjectWeights(rows, targets)` → `SubjectWeight[]`:

| وضعیت ورودی | weight | weightStatus | planningStatus | پرچم |
|---|---|---|---|---|
| positive (سهم مثبت) | محاسبه‌شده (max + bump چندهدفه) | `computed` | `ready` یا `partial` (اگر سطر unknown دیگر هدف) | — |
| فقط zero معلوم | `0` (واقعی) | `computed` | `excluded` | `zero_coefficient:<t>` |
| فقط not_applicable | null | `not_applicable` | `excluded` | `not_applicable:<t>` |
| unknown (هر ترکیب بدون سهم مثبت) | **null** (هرگز صفر) | `unknown` | `needs_review` | `unknown_coefficient:<t>` |

- ضرایب هدف‌ها جمع/میانگین نمی‌شوند؛ فقط max با bump `1+0.2×(k−1)` فقط برای وزن مثبت.
- درس نامعلوم هرگز خاموش حذف نمی‌شود؛ در گزارش باقی می‌ماند و وارد صف محاسبه‌شده نمی‌شود.
- تست‌های الزامی: `src/tests/v3/unknown-not-zero-weights.test.ts` (ماتریس B4 + سناریوهای ۱–۹ B5).

## ۴. سازگاری legacy

- دادهٔ موجود `exam-model.v1.json` بدون تغییر می‌ماند: `state`های قدیمی با normalize خوانده می‌شوند.
- مصرف‌کنندگان قدیمی که خروجی resolver را می‌خوانند باید از `valueState/evidence` استفاده کنند (فیلد `state` در خروجی resolver حذف شد — تنها مصرف‌کنندگان تست بودند و به‌روزرسانی شدند).
- `computeTargetWeights` (خانواده‌محور قدیمی) فقط برای سازگاری تست خودش باقی است؛ مسیرهای جدید از `computeSubjectWeights` استفاده می‌کنند.
