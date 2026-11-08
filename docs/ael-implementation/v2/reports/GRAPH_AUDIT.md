# ممیزی گراف (GRAPH_AUDIT) — V2-051

- تاریخ: 2026-11-08
- ابزار: scripts/v2/coverage-matrix.mjs + خواندن دستی skills.json / syllabus-nodes.json / relations.jsonl

## خلاصه عددی (اندازه‌گیری‌شده)

- کل گره‌ها (syllabus-nodes): 24
- گره‌های دارای مهارت (node_id در skills.json): 18 (0.75)
- کل یال‌ها (relations.jsonl): 14 — هر 14 یال هر دو سر شناخته‌شده در syllabus (ratio=1). این یعنی هیچ یال relations به گره نامعتبر وصل نیست.
- مهارت‌های دارای نگاشت سؤال (primary/secondary در mappings): 18 از 23 (0.783)
- گره‌های بدون مهارت: 6 — mb.decision? (بعضی پوشش دارند)... دقیقاً: از فهرست، گره‌های بدون skill شامل stats.nonparam، islamic.justice، mb.leadership، mb.ob_motivation، mb.decision? — مسیر node_id باید با لیست skills.json تطبیق شود؛ 6 گره برای تکمیل پوشش لازم است.

## ناهنجاری‌های گراف واقعی

1. **مهارت‌های صنعتی بدون گره:** skill.ind.or_simplex (node ind.or_simplex)، skill.ind.mcdm (ind.mcdm)، skill.ind.production_inv (ind.production_inv)، skill.ind.supply_chain (ind.supply_chain) — هیچ‌کدام در syllabus-nodes نیستند. این 4 مهارت صنعت (144?) فعلاً «معلق» هستند و مسیر industrial با گراف آموزشی خالی پوشش می‌دهد. تصمیم مالک برای هر کدام: create_skill (ساخت گره) یا remove_reference (حذف مهارت/یال).
2. **زوج‌های قابل خلط (confusable_with) به مهارتی که node آن وجود ندارد اشاره می‌کنند؟** نه — همه confusable به skill است ولی node آن (ind.*) وجود ندارد؛ همان همان مورد 1 است.
3. **علامت -s?** نیست.

## ولی تناقض: coverage-matrix گفته relations هر دو سر شناخته‌شده = 14/14. درسته؛ relations به گره‌های مسلسل وصل است، ولی skills به گره‌های گمشده وصل است. این دو رجیستری ناسازگارند.

## پیشنهاد

- proposed/relations.proposed.jsonl برای یال‌های missing-skill از نوع prerequisite بین گره‌های موجود پیشنهاد داده شده (جدا از خلق گره؛ خلق گره تصمیم مالک است).
- تا تصمیم مالک، مهارت‌های ind.* معلق می‌مانند و در COVERAGE_V1 شمارنده آن‌ها pending است نه verified.
