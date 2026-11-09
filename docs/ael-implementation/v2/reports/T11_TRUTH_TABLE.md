# T11 — جدول حقیقت (بازراستی V2-016، 2026-11-08)

- مبنا: HEAD f9891a5 (plan/ael-v2-impl-20261108)

| ادعا | وضعیت اصلاح‌شده | شاهد |
|---|---|---|
| تکرار شناسه میان مخازن (C-01) | 0 تکراری از 188 شناسه یکتا | reports/id-map.csv |
| وضعیت خودکار (STATUS_AUTO) | courses 6 / nodes 24 / skills 23 / relations 14 / mappings 18 / migrations 26 | reports/STATUS_AUTO.md |
| لینک اسناد (C-12) | 83 لینک داخلی، 0 شکسته | reports/C12_miniapp_truth.md |
| تگ‌های V2 | 73 شناسه پس از اصلاح (قبلاً 70 + V2-006/007/018)؛ ارجاع V2-03C اشتباه بود و حذف شد | reports/TAG_LINT.md |
| پوشش V1 (COV-01) | سهم/مخرج صریح: share هر درس از nodes_total=24 (نه پوشش همان درس)، syllabus 18/24، skills-mapped 18/23، reviewed 0/56 | reports/COVERAGE_V1.md/csv |
| موتور (C-05) | 18 فایل @ael/engine؛ مسیر ماژول‌های جدید src/ است نه src/v2/ (مغایرت ثبت‌شده، بدون جابه‌جایی) | reports/C05_engine_inventory.md + ENGINE_PATH_MISMATCH.md |
| Graph | relations 14/14؛ پوشش share (نه cover) | reports/GRAPH_AUDIT.md |
| شاخه‌ها (V2-010) | 13 شاخه + plan کاری؛ آزمون ادغام هر دو PR در worktree جدا PASS؛ «Strategy chosen: الف» حذف و فقط توصیه ثبت شد | reports/T11_branches.md |
| PRها (V2-007/018) | PR14=ad728a9، PR15=bfe41ad؛ courses.json فقط در PR14 تغییر کرد (2164→2162) | reports/PR_INVENTORY.md + PR_OVERLAP.md |

## ادعاهای اصلاح‌شده

- BACKLOG مرجع V2 نیست؛ مرجع V2 فقط V2_LEDGER.csv + verify-ledger است.
- syllabus-nodes فیلد پیش‌نیاز/هدف ندارد؛ فقط id/track/course/chapter/topic.
- 0028 روی این شاخه وجود ندارد (فقط روی PR15)؛ به‌عنوان «خوانده‌شده در این شاخه» ثبت نشد.
- exam_code/paper_code/legacy یکی نیستند؛ patch 2164→2162 فقط پیشنهاد است.
