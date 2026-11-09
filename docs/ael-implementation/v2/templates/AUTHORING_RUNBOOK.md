# Runbook تألیف بسته درسی (AUTHORING_RUNBOOK) — V2-062

> این قالب آموزشی برای نویسنده/ایجنت است؛ خروجی آن پیش‌نویس تألیفی است و جای امضای SME را نمی‌گیرد.

## مراحل

1. **انتخاب دامنه:** course/topic را از course-definitions.seed.json برگزین؛ مخرج پوشش را بنویس.
2. **نویسندگی:** برای هر topic بنویس: objective (جمله عملیاتی)، 2+ concepts، formula، workedExample، commonError، sourceIds (concept_reference با URL https و checkedOn).
3. **سؤال:** هر topic حداقل 1 سؤال (ترجیحاً 3)؛ 4 گزینه یکتا برای MCQ؛ essay با rubric؛ answerIndex معتبر؛ optionReasons برای هر گزینه.
4. **هزینه:** minutes هر topic بین 1 تا 10 (اعتبارسنج فصل 37).
5. **ثبت:** بسته را در content/learning-courses/<id>.json بگذار، در apps/worker/src/learning-catalog.ts ثبت کن (هر بسته دقیقاً یک بار).
6. **اعتبارسنجی:** npm run validate:learning باید سبز باشد؛ reviewed همیشه pending_sme تا امضای متخصص.
7. **حویل:** بسته‌های SME را در docs/ael-next/18_REVIEW_BUNDLES_FA.md آماده کن؛ روی سقف L6 ننویس تا امضا نیاید.

## ابزارهای لینت

- scripts/v2/objective-lint.mjs — عبارت‌های مبهم در objective
- scripts/v2/card-lint.mjs — کامل‌بودن کارت/پروکسی سؤال
- npm run validate:learning — ساختار کامل بسته
