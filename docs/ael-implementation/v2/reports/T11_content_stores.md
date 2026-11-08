# T11 — انبارهای محتوایی (V2-011)

- ابزار: بازبینی دستی + scripts/v2/id-map.mjs و status-snapshot.mjs (همان اجرا)
- تاریخ: 2026-11-08
- مبنا: شاخه plan/ael-v2-impl-20261108، HEAD در زمان اجرا 84a5f3c

## مخزن‌های محتوا

| مخزن | مسیر | نقش |
|---|---|---|
| گراف دانش مدیریت | content/knowledge/ | courses.json (6)، syllabus-nodes.json (24)، skills.json (23)، relations.jsonl (14 یال)، question-skill-mappings.jsonl (18 نگاشت) |
| بسته‌های تألیفی | content/learning-courses/ | 3 بسته: financial-management 1.1.0 (8 مبحث، 24 سؤال)، statistics-foundations 1.2.0 (2 مبحث، 5 سؤال)، phd-management-expansion 1.0.0 (12 مبحث، 27 سؤال)؛ همه pending_sme |
| بانک سؤال تاریخی | content/questions/ | bank-official_traced_phd/arshad + quarantine |
| رجیستری آموزشی | content/registry/ + packages/contracts/src/registry.ts | AEL-101..108 |
| پژوهشی/منابع | content/research/ + content/sources/ | source-registry, book-catalog, annual-coverage |
| گزارش‌های تحلیل | content/reports/ | coverage/graph/integration |
| انکی (موقت/بررسی) | content/anki-extracted-cards.json، anki-ocr-results.json | ورود OCR؛ pending_review، فقط محلی |

## شمارش اندازه‌گیری‌شده

- courses: 6، syllabus-nodes: 24، skills: 23، relations: 14، mappings: 18 (STATUS_AUTO.md)
- شناسه‌های یکتا (id-map.csv): 188، تکراری میان‌مخزنی: 0
- migrations: 26، آخرین: 0026_import_ledger.sql

## نگاشت‌های مهم

- بسته‌های فعال Worker: apps/worker/src/learning-catalog.ts دقیقاً همان 3 بسته را ثبت می‌کند؛ ثبت دوقطعی نیست.
- وضعیت بازبینی بسته‌ها: 56 سؤال (24+27+5) همه pending_sme؛ reviewed = 0 (COVERAGE_V1.csv)
- ناهمخوانی عنوان درس: courses.json «بازاریابی و مدیریت بازار پیشرفته» در برابر syllabus-nodes «بازاریابی پیشرفته» → شمارش بر اساس نام درس برای دو درس 0 می‌دهد؛ شاهد در COVERAGE_V1.md. تحلیل در GRAPH_AUDIT.md.
- کد دفترچه: courses.json exam_code و mappings paper_code همگی 2164، ولی مرجع رسمی exam-structure.ts کد مجموعه را 2162 می‌داند؛ جزئیات در C02_exam_codes.md.

## نتیجه

انبارها از هم جدا اما به هم پیوسته‌اند (id-map شامل edge/map است). هیچ مخزنی به‌عنوان «رسمی» علامت نخورده؛ تولیدکننده بسته‌ها authored_pilot است. تکرار شناسه میان‌مخزنی صفر است، پس C-01ِ تکرار شناسه در این مقطع تأیید نشد.

مراجع: reports/id-map.csv، reports/STATUS_AUTO.md، reports/COVERAGE_V1.md
