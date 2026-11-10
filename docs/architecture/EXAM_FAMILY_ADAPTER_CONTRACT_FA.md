# قرارداد خانوادهٔ آزمون و Adapter

> وضعیت: `implemented-contract-first` — لایهٔ داده (exam-model.v1.json) کاملاً نسخه‌دار و عمومی است؛ Adapter هنوز نوع TS رسمی ندارد و فقط در صورت قاعدهٔ غیرقابل‌عمومی‌سازی ساخته می‌شود.

تاریخ: ۲۰۲۶-۱۱-۰۹ · کار: V3-011

## ۱. کجا Adapter لازم است — و کجا لازم نیست

**لازم نیست** (همه با داده حل می‌شود — مسیر اصلی):
- افزودن خانواده/سال/مجموعه/ماده/هدف/ضریب → رکورد در `content/knowledge/exam-model.vN.json`
- قواعد eligibility ساده → `ExamSelectionPolicy` موجود در exam-model.ts
- مواد مشترک چندهدف → resolver موجود `resolveCandidatePreparationPlan`

**لازم است** (فقط وقتی قاعده در resolver عمومی بیان نمی‌شود):
- ارزیابی چندمرحله‌ای (مصاحبه + کتبی + عملی با گیت ورود مرحله به مرحله)
- نمره‌دهی ترکیبی غیرخطی (نظیر تبدیل تراز خانواده‌محور)
- قواعد ثبت‌نام شناور/اصلی متفاوت با معنای متفاوت از SelectionPolicy عمومی

## ۲. قرارداد (نسخهٔ پیشنهادی v1)

```ts
// محل قرارگیری نهایی: packages/contracts/src/exam-family-adapter.ts (فقط هنگام اولین Adapter واقعی)
export interface ExamFamilyAdapter {
  familyCode: string;
  adapterVersion: string;
  // اعتبارسنجی نسخهٔ رویداد این خانواده، پیش از ورود به کاتالوگ
  validateEventVersion(input: unknown): ValidationResult;
  // صلاحیت ثبت‌نام — فقط از قواعد نسخه‌دار همین نسخه
  resolveEligibility(input: EligibilityInput): EligibilityResult;
  // تبدیل هدف‌های رشته‌محل به ردیف‌های ExamTarget
  resolveCandidateTargets(input: TargetResolutionInput): TargetResolutionResult;
  // blueprint آزمون برای Assessment عمومی
  buildAssessmentBlueprint(input: AssessmentBlueprintInput): AssessmentBlueprint;
  // پروفایل نمره‌دهی
  resolveScoring(input: ScoringInput): ScoringProfile;
}
```

قواعد قرارداد:
1. Adapter هرگز به کاتالوگ/DB/موتور دسترسی نمی‌گیرد — تابع خالص ورودی→خروجی است.
2. ورودی ناکافی → `unknown/needs_check`؛ هرگز مقدار جعلی نسازد.
3. Adapter نسخه‌دار است؛ نسخهٔ جدید رویداد قدیمی را بازتفسیر خاموش نمی‌کند (`adapterVersion` در داده ثبت می‌شود).
4. بدون `eval`؛ قواعد پیچیده فقط با DSL محدود JSON + operator allowlist + تست مرزی.
5. هر Adapter باید fixture تست داشته باشد و در `tests/fixtures/exam-families/` ثبت شود.
6. Adapter جایگزین هسته نیست؛ mastery/planner/scheduler در هسته می‌مانند.

## ۳. مسیر عمومی قبل از Adapter (چک‌لیست تصمیم)

پیش از نوشتن Adapter برای هر قاعده، این سه پرسش:
1. آیا قاعده با فیلد جدید نسخه‌دار در exam-model قابل بیان است؟ (ترجیح اول)
2. آیا با `ExamSelectionPolicy`/`EligibilityPolicy` عمومی بیان می‌شود؟ (ترجیح دوم)
3. فقط اگر هر دو نه → Adapter.

## ۴. وضعیت فعلی

- دو خانوادهٔ فعال (ارشد ۱۱۴۲، دکتری ۲۱۶۲) با **صفر Adapter** کار می‌کنند — شاهد: `packages/learning-engine/src/` بدون هیچ branch اختصاصی خانواده (اسکن V3-012).
- اولین Adapter واقعی احتمالاً برای ارزیابی چندمرحله‌ای علوم پزشکی (موج ۴) خواهد بود؛ تا آن زمان نوع TS ساخته نمی‌شود تا بر اساس نیاز واقعی شکل بگیرد.
- fixture ساختگی معماری: `src/tests/v3/generic-family-fixture.test.ts` (V3-013) — بدون دادهٔ production.
