# بهترین ایده بر اساس گیت‌هاب (2026-11-08)

وضعیت پایه: HEAD 66f5cba؛ شواهد از کامیت 0eef570 و شاخه‌های PR (ad728a9، bfe41ad). هر تصمیم فقط با همان شواهد مستند است.

## C-02 کد آزمون (شواهد کامیت 0eef570)

- exam_code courses.json به 2162 اصلاح شد (هر 6 درس) + exam-packs و دو فایل 1404 downgrade شد (verified → unverified_provenance، authorized → unknown)؛ consumer ael003-inventory اجرا و سالم ماند.
- paper_code=2164 بماند به‌عنوان legacy/documented (نه جایگزینی سراسری)؛ نگه‌داری مریدی اسناد رسمی 1406 در EXAM_SPECIFICATION_1406.json: کد 2162 با pending_official_verification (یعنی 1406 هنوز منتشر نشده).
- تست جدید: coverage-matrix حالا exam_code=2162 می‌خواند (بدون تکراری)؛ هیچ جایگزینی کورکورانه انجام نشد.

## C-08 گراف (شواهد crosswalk PR15)

- گره‌های crosswalk: ind.or_simplex_duality، ind.mcdm_dea_queue، ind.pom_eoq_mrp، mkt.stp، stats.nonparam؛ شناسهٔ مهارت skill.stats.nonparam.kruskal در داخل همان crosswalk آمده است (یعنی PR15 آن را نگه داشته است).
- بهترین ایده: alias‌های بالا فقط در proposed/graph-patch.pr15.md آماده شوند (نه نوشتن مستقیم روی skills.json تا ادغام PR15)؛ skill جدیدی از دانش ایجنت ساخته نشود.

## D-05 ادغام

- بهترین ایده Shemesh (بدون merge قرمز): ترتیب PR14 سپس PR15، با شرط سبز شدن CI روی آخرین SHA؛ بدون حذف.

## چک‌لیست باقی‌مانده با همان منطق

- Supabase/pilot/SME: هیچ مشاهده‌ای از اجرای واقعی در گیت‌هاب نیست → همان آماده‌سازی و توقف (صداقت).
