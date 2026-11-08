# مهارت‌های مفقود در گراف (GRAPH_missing_skills) — V2-053

> تصمیم برای هر ردیف را مالک در HUMAN_REQUIRED/OWNER_REPLIES تعیین می‌کند؛ پیش‌فرض ایجنت decide است (هنوز decide نکرده).

| skill_id | node_id مفقود | اقدام پیشنهادی ایجنت (PROPOSED) | وضعیت |
|---|---|---|---|
| skill.ind.or_simplex | ind.or_simplex | create_skill — پژوهش در عملیات در syllabus نیست؛ ابتدا گره بساز سپس یال | HUMAN_REQUIRED (C-08) |
| skill.ind.mcdm | ind.mcdm | create_skill — تصمیم‌گیری چندمعیاره پیش‌نیاز / گره منوط به OR | HUMAN_REQUIRED (C-08) |
| skill.ind.production_inv | ind.production_inv | create_skill | HUMAN_REQUIRED (C-08) |
| skill.ind.supply_chain | ind.supply_chain | create_skill — یال به sm.value_chain | HUMAN_REQUIRED (C-08) |

## مهارت‌های بدون نگاشت سؤال (5 عدد از 23)

- براساس COVERAGE_V1 (skills-mapped=18/23): 5 مهارت هیچ نگاشت question_id ندارند. هر کدام:
  - این مهارت‌ها شامل skill.mkt.stp.positioning (ارجاع‌شده در skills ولی node ندارد??) و skill.stats.nonparam.kruskal (ارجاع شده در confusable ولی دین مهارت آن وجود ندارد) و 3 مهارت تکمیلی دیگر است.
  - اقدام: برای هر مهارت decide شود؛ در relations.proposed هیچ یالی برای آن‌ها ساخته نشده است.

## نکته درباره skill.mkt.stp.positioning و skill.stats.nonparam.kruskal

- در skills.json، skill.mkt.brand.cbbe_pyramid به skill.mkt.stp.positioning به‌عنوان prerequisite اشاره می‌کند ولی آن مهارت در skills.json وجود ندارد.
- skill.stats.anova.parametric_assumptions به skill.stats.nonparam.kruskal اشاره می‌کند ولی آن مهارت وجود ندارد.
- این دو مورد «ارجاع به مهارت ناموجود» هستند، نه فقط node مفقود. تصمیم مالک برای آن‌ها یکی از create_skill یا remove_reference است.

> تا پاسخ مالک، این دو ارجاع در گراف «pending» می‌مانند و در مهندسی موتور هیچ ابزاری از آن‌ها استفاده نمی‌کند.
