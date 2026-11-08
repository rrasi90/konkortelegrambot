# T11 — جدول حقیقت (V2-016)

- تاریخ: 2026-11-08 — مبنا: HEAD 84a5f3c

| ادعا | وضعیت اندازه‌گیری‌شده | شاهد |
|---|---|---|
| تکرار شناسه میان مخازن (C-01) | 0 تکراری از 188 شناسه یکتا | reports/id-map.csv (scripts/v2/id-map.mjs) |
| وضعیت خودکار (STATUS_AUTO) | courses 6 / nodes 24 / skills 23 / relations 14 / mappings 18 / migrations 26 | reports/STATUS_AUTO.md |
| لینک اسناد (C-12) | 83 لینک داخلی، 0 شکسته | reports/C12_miniapp_truth.md (scripts/v2/doc-link-check.mjs) |
| تگ‌های V2 | 70 شناسه لجر؛ 1 ناشناخته: V2-03C در HUMAN_REQUIRED.md | reports/TAG_LINT.md |
| پوشش V1 (COV-01) | syllabus 18/24 (0.75)، skills-mapped 18/23 (0.783)، reviewed 0/56، topics-with-question 22/22 | reports/COVERAGE_V1.md/csv (scripts/v2/coverage-matrix.mjs) |
| موتور (C-05) | 18 فایل @ael/engine؛ legacy در src/engine/aelEngine.ts | reports/C05_engine_inventory.md |
| Graph | relations 14/14 هر دو سر شناخته‌شده (در syllabus)؛ ناهمخوانی نام درس برای 2 درس | reports/GRAPH_AUDIT.md |

## ادعاهای «موجود» که تأیید نشد

- «تکرار شناسه C-01 وجود دارد» با این مقطع رد شد (0/188).
- «paper_code 2164 = کد رسمی 2162» رد شد؛ کدها یکی نیستند (C02).
- «بررسی SME انجام شده» رد شد؛ reviewed = 0/56.
- «skills همه به سؤال وصل‌اند» رد شد؛ 5 مهارت بدون نگاشت (18/23).

> قاعده: هر عدد این جدول از اجرای ابزار روی همین شاخه آمده است. خلق عدد بدون شاهد ممنوع است.
