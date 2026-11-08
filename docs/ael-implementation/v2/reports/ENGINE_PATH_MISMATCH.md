# مغایرت مسیر موتور (2026-11-08)

- الزام: packages/learning-engine/src/v2/ (پرامپت ۱.۲)
- وضعیت فعلی: mastery/planner/scheduler/target-weights/readiness-copy/coverage-matrix در packages/learning-engine/src/ (بدون v2/)
- imports وابسته: packages/learning-engine/src/index.ts هر 6 ماژول را export می‌کند؛ هیچ import تازه‌ای به v2/ وجود ندارد.
- اقدام: فعلاً جابه‌جایی یا اتصال تازه انجام نمی‌شود؛ فقط همین اختلاف ثبت شد.
