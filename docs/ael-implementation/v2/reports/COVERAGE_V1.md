# پوشش V1 — ماتریس اندازه‌گیری‌شده (COVERAGE_V1)

- تولید: 2026-11-08T12:00:25.242Z
- ابزار: scripts/v2/coverage-matrix.mjs
- قاعده: صورت و مخرج صریح است؛ درصدی که مخرجش تأیید نشده، null است نه ۱۰۰٪.

| scope | numerator | denominator | ratio | status |
|---|---|---|---|---|
| course:course-org-theory | 5/24 | nodes_total | 0.208 | measured |
| course:course-stats | 4/24 | nodes_total | 0.167 | measured |
| course:course-islamic-mgmt | 2/24 | nodes_total | 0.083 | measured |
| course:course-strategic-mgmt | 5/24 | nodes_total | 0.208 | measured |
| course:course-marketing | 0/24 | nodes_total | 0 | measured |
| course:course-innovation-mgmt | 0/24 | nodes_total | 0 | measured |
| corpus:syllabus-coverage | 18/24 | nodes_total | 0.75 | measured |
| corpus:relations | 14/14 | edges_total | 1 | measured |
| pack:financial-management:review | 0/24 | questions_total | 0 | measured |
| pack:financial-management:topics-with-question | 8/8 | topics_total | 1 | measured |
| pack:financial-management:sources | 8/8 | topics_total(ref) | 1 | info |
| pack:phd-management-expansion:review | 0/27 | questions_total | 0 | measured |
| pack:phd-management-expansion:topics-with-question | 12/12 | topics_total | 1 | measured |
| pack:phd-management-expansion:sources | 12/12 | topics_total(ref) | 1 | info |
| pack:statistics-foundations:review | 0/5 | questions_total | 0 | measured |
| pack:statistics-foundations:topics-with-question | 2/2 | topics_total | 1 | measured |
| pack:statistics-foundations:sources | 2/2 | topics_total(ref) | 1 | info |
| corpus:skills-mapped | 18/23 | skills_total | 0.783 | measured |
| sec7:doctorate-years | 12/12 | years_supported(1395..1406) | 1 | measured |
| sec7:combinations | 4/7 | combinations_total(7) | 0.571 | measured |

## SEC7 — اندازه‌گیری‌شده

بخش ۷ نقشه‌راه (وضعیت محیط/استقرار) فقط با شواهد اندازه‌گیری (شمارش فایل، مقادیر ساختار آزمون، لاگ تست) گزارش می‌شود؛ ادعای «آماده انتشار» از روی درصد پوشش استنتاج نمی‌شود.

### گره‌های سرفصل به دانه

- کل گره‌های syllabus-nodes: 24
- گره‌های دارای مهارت در skills.json (node_id): 18
- نسبت: 0.75

### یال‌های relations

- کل یال‌ها: 14
- یال‌های هر دو سر شناخته‌شده: 14
- یال‌های با سر/سرهای نامعتبر: 0
- نامعتبرها (نمونه): —

> یال نامعتبر = ناهنجاری گراف؛ تا تصمیم مالک (create_skill/remove_reference) در GRAPH_missing_skills ثبت می‌شود، نه اینکه خاموش شود.
