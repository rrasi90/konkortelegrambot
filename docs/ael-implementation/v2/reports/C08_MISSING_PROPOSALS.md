# پیشنهادهای ارجاع مفقود C-08 (V2-053) — 2026-11-08

- تصمیم: پذیرفته‌شده (پاسخ مالک 2026-11-08: «پذیرش پیشنهادهای گراف»).
- اجرا: هنوز انجام‌نشده. اعمال هیچ‌یک از پیشنهادها در فایل‌های source انجام نشده است.
- وابستگی اعلام‌شده: وجود crosswalk در PR #15.
- پذیرش نهایی اجرا: پس از اعمال تغییر، بررسی شناسه‌ها، ارجاع‌ها و آزمون‌های مرتبط.

## چرا اعمال به ادغام PR #15 وابسته است؟

- هر سه alias صنعتی (`ind.or_simplex`، `ind.mcdm`، `ind.production_inv`) بر گره‌های crosswalk در PR15 (`ind.or_simplex_duality`، `ind.mcdm_dea_queue`، `ind.pom_eoq_mrp`) استوارند که در `main` و شاخهٔ کاری فعلی وجود ندارند (`content/knowledge/syllabus-nodes.json` در این شاخه 24 گره دارد و هیچ‌کدام `ind.*` نیست). اعمال alias قبل از در دسترس بودن آن گره‌ها، ارجاع را از یک نامعتبر به نامعتبر دیگر تبدیل می‌کرد.
- دو مهارت معلق دیگر (`skill.mkt.stp.positioning`، `skill.stats.nonparam.kruskal`) در PR15 به گره `mkt.stp` و `stats.nonparam` اشاره می‌کنند که در این شاخه وجود دارند؛ اما تعریف کامل crosswalk همان PR15 است، پس اعمال منسجم با همان PR انجام می‌شود.

## آماده‌سازی patch روی شاخهٔ وابسته (بدون توقف)

- آماده‌سازی patch روی شاخهٔ وابسته (PR15) ممکن است و متوقف نیست: تغییرات پیشنهادی برای شاخهٔ `feat/layer1-academic-foundation-20261107` آماده می‌شود (نه روی main).
- فایل proposed/relations.proposed.jsonl (دو یال pending) همین آماده‌سازی است؛ اعمال آن روی main انجام نشد.

## موردهای بررسی‌شده (6 شناسه)

| شناسه | محل مصرف | جست‌وجو | پیشنهاد مشخص |
|---|---|---|---|
| skill.mkt.stp.positioning (prereq of skill.mkt.brand.cbbe_pyramid) | skills.json مبتنی بر mkt.stp | PR15 crosswalk: nodeId mkt.stp | تعریف create_skill با شاهد crosswalk پس از ادغام PR15 |
| skill.stats.nonparam.kruskal (confusable در stats.anova.parametric_assumptions) | skills.json | nodes دارای stats.nonparam | create_skill «آزمون کروسکال-والیس» از عنوان topic پس از ادغام |
| skill.ind.or_simplex → ind.or_simplex (node مفقود) | skills.json | PR15 crosswalk: ind.or_simplex_duality | alias به گره PR15 پس از ادغام |
| skill.ind.mcdm → ind.mcdm | skills.json | crosswalk: ind.mcdm_dea_queue | alias به گره PR15 پس از ادغام |
| skill.ind.production_inv → ind.production_inv | skills.json | crosswalk: ind.pom_eoq_mrp | alias به گره PR15 پس از ادغام |
| skill.ind.supply_chain → ind.supply_chain | skills.json | بدون crosswalk مستقیم | open پس از ادغام؛ بدون شواهد کافی |

## قاعده

- هیچ حذف (remove_reference) پیشنهاد نشده؛ حذف فقط با دلیل مستند «اشتباه/تکراری» و پس از بررسی متخصص مجاز است.

مراجع: PR_OVERLAP.md، crosswalk در PR15، GRAPH_missing_skills.md
