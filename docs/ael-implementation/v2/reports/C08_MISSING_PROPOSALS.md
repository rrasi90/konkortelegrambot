# پیشنهادهای ارجاع مفقود C-08 (V2-053) — 2026-11-08

- تصمیم مالک: هیچ ارجاعی برای سبز شدن حذف نشود؛ مهارت از دانش ایجنت ساخته نشود. هر مورد: محل مصرف + جست‌وجو + پیشنهاد مشخص (alias/create/remove/open)، بدون سؤال دوگزینه‌ای خالی.

## موردهای بررسی‌شده (6 شناسه)

| شناسه | محل مصرف (خان) | جست‌وجو | پیشنهاد مشخص |
|---|---|---|---|
| skill.mkt.stp.positioning (prereq of skill.mkt.brand.cbbe_pyramid) | skills.json:163؛ nodes فقط mkt.stp دارد | PR15 crosswalk: nodeId mkt.stp — مهارت لازم از «عنوان STP» می‌آید ولی شناسهٔ کامل وجود ندارد | alias پیشنهاد: نگاشت prereq به مهارت `skill.mkt.stp.(نیاز به ساخت در سطح مهارت)` ندارد → create_skill موقت با شاهد crosswalk پیشنهاد می‌شود ولی تا تأیید متخصص، prereq به `mkt.stp` در سطح گره نگاشت بماند (بدون حذف) |
| skill.stats.nonparam.kruskal (confusable در stats.anova.parametric_assumptions) | skills.json:67 | nodes دارای stats.nonparam؛ نام Kruskal در عنوان topic هست | alias پیشنهاد: مهارت کروسکال به گره stats.nonparam وصل است ولی شناسهٔ مهارت جدا ندارد → create_skill با عنوان «آزمون کروسکال-والیس» از عنوان topic پیشنهاد می‌شود (تأیید متخصص لازم) |
| skill.ind.or_simplex → ind.or_simplex (node مفقود) | skills.json:273 | PR15 crosswalk: ind.or_simplex_duality ↔ ind.or_simplex | alias پیشنهاد: node `ind.or_simplex_duality` جایگزین پیشنهادی؛ create_skill گره فقط پس از تأیید، تا آن زمان مهارت معلق |
| skill.ind.mcdm → ind.mcdm | skills.json:286 | crosswalk: ind.mcdm_dea_queue ↔ ind.mcdm | مشابه بالا؛ alias به `ind.mcdm_dea_queue` پیشنهادی، معلق |
| skill.ind.production_inv → ind.production_inv | skills.json:301 | crosswalk: ind.pom_eoq_mrp ↔ ind.production_inv | alias به `ind.pom_eoq_mrp` پیشنهادی، معلق |
| skill.ind.supply_chain → ind.supply_chain | skills.json:314 | بدون crosswalk مستقیم؛ پره‌نیاز به production_inv و value_chain | open: شواهد کافی برای alias یا create تاییدشده نیست؛ باز بماند |

## قاعده

- هیچ حذف (remove_reference) پیشنهاد نشده چون هر 6 مورد مفهوم موردانتظار قابل‌شناسایی دارند؛ حذف فقط با دلیل «اشتباه/تکراری» و پس از بررسی متخصص مجاز است.

مراجع: PR_OVERLAP.md، crosswalk در PR15، GRAPH_missing_skills.md
