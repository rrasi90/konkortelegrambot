# ممیزی وضعیت فعلی لایه اول AEL

**تاریخ ممیزی:** ۷ نوامبر ۲۰۲۶  
**شاخه مبنا:** PR #14 — `mission/library-10y-repository-consolidation-20261107`  
**SHA مبنا:** `ad728a9fcae59328cfc9650a96eaf2266d0a4734`

این گزارش موجودی و شکاف‌های داده‌ای را ثبت می‌کند. اعداد از فایل‌های مخزن استخراج شده‌اند؛ «وجود فایل» با «تکمیل علمی یا یکپارچگی کامل» برابر نیست.

## ۱. آزمون، مجموعه، ترکیب و ضرایب

| مورد | آنچه در مخزن موجود است | وضعیت |
|---|---|---|
| مسیر ارشد | کد مجموعه ۱۱۴۲ در onboarding | ساختار سالانه آزمون در قرارداد سرور هنوز `content_gap` است |
| مسیر دکتری مدیریت | کد مجموعه ۲۱۶۲ | در قرارداد آزمون ثبت شده |
| ترکیب‌های دکتری ۱۴۰۵ | کدهای ۱ تا ۷ | تعدادی رکورد و عنوان در baseline نیازمند بازخوانی/تطبیق‌اند |
| بسته‌های درسی | بسته‌های ۱ تا ۹ | mapping موضوعی در قرارداد آزمون موجود است |
| ساختار سال ۱۴۰۶ | ضریب زبان ۱، تخصصی ۵، حذف استعداد در وضعیت reported | تعداد سؤال، زمان و نمره منفی null مانده‌اند؛ از ۱۴۰۵ کپی نشوند |
| ضرایب دروس | بعضی فایل‌های قدیمی ضریب ۵ را روی هر Course نوشته‌اند | دامنه ضریب روشن نیست؛ با ضریب بسته تخصصی اشتباه نشود |

**قاعده پیشنهادی تثبیت‌شده در قرارداد جدید:** انتساب درس به آزمون باید `examLevel`، `examSetCode`، `combinationCode`، `subjectCode`، `coefficientScope`، `officialCoefficient` و `learningPriorityWeight` را جدا نگه دارد. تا وقتی سند دقیق وجود ندارد، ضریب رسمی null می‌ماند.

کد قدیمی `paper_code=2164` در ۱۸ نگاشت سؤال فعلی موجود است. این مقدار به‌صورت خودکار به ۲۱۶۲ تغییر نکرده؛ دو مقدار می‌توانند نقش متفاوتی داشته باشند.

## ۲. کاتالوگ درس و ساختار سرفصل

### شمارش فعلی

| منبع | تعداد |
|---|---:|
| `INITIAL_KNOWLEDGE_NODES` در داده اصلی | ۲۵ |
| `PHD_EXPANSION_NODES` | ۱۲ |
| اتحاد دو مجموعه گره | ۳۷ |
| `content/knowledge/syllabus-nodes.json` | ۲۴ |
| `content/knowledge/courses.json` در PR #14 | ۶ Course |

فایل `syllabus-nodes.json` فعلی تخت است و فیلدهای آن `id, track, course, chapter, topic` هستند؛ parentId، position، nodeKind و definitionCode از قرارداد درختی Registry را ندارد.

### اختلاف شناسه‌ها

**۱۱ گره موجود در syllabus-nodes.json ولی غایب از INITIAL_KNOWLEDGE_NODES:**

`mb.decision`, `mb.ob_motivation`, `mb.leadership`, `stats.nonparam`, `islamic.malik_covenant`, `islamic.justice`, `sm.dynamic_capabilities`, `sm.core_competencies`, `mkt.cobranding`, `mkt.stp`, `tech.absorptive`.

**۱۲ گره INITIAL_KNOWLEDGE_NODES که در syllabus-nodes.json نیستند:**

`mb.culture`, `sm.dynamic`, `rm.validity`, `ind.or_simplex_duality`, `ind.pom_eoq_mrp`, `inno.tidd_4p`, `ind.mcdm_dea_queue`, `inno.open_rd_transfer`, `bus.english_eshraghi`, `bus.econ_nazari`, `bus.math_stats_ranjbaran_tourani`, `bus.islamic_moghimi`.

**۱۲ گره توسعه دکتری که در syllabus-nodes.json نیستند:**

`pa.public_theories`, `pa.policy_theories`, `mis.sims_advanced`, `mis.knowledge_mgmt`, `fin.risk_investment`, `fin.markets_institutions`, `rm.research_design`, `rm.reliability_forms`, `hr.ob_leadership`, `hr.practices_hrm`, `lang.phd_readings`, `stats.nonparametric`.

این اختلاف‌ها نشان می‌دهند `syllabus-nodes.json` مرجع کامل ۳۷ گره نیست. هیچ گرهی در این تغییر حذف یا با حدس یکی نشده است.

### اختلاف عنوان درس

در syllabus file هفت عنوان متمایز دیده می‌شود؛ در `courses.json` شش شناسه Course وجود دارد. موارد نیازمند crosswalk:
- «بازاریابی پیشرفته» در سرفصل در برابر «بازاریابی و مدیریت بازار پیشرفته» در Course؛
- «تئوری‌های نوآوری و فناوری» در سرفصل در برابر «تئوری‌های نوآوری و مدیریت فناوری» در Course؛
- «مدیریت فناوری و نوآوری» در سرفصل، Course مستقل مشخصی در آن فایل ندارد.

عنوان‌های نزدیک ادغام نشده‌اند؛ لازم است هویت مفهومی درس‌ها تأیید شود.

## ۳. مهارت‌ها

`content/knowledge/skills.json` دارای ۲۳ رکورد Skill و ۲۲ شناسه گره یکتا است.

### ارجاع‌های حل‌نشده

چهار Skill به node_idهایی وصل‌اند که در `syllabus-nodes.json` وجود ندارند:
- `skill.ind.or_simplex` → `ind.or_simplex`
- `skill.ind.mcdm` → `ind.mcdm`
- `skill.ind.production_inv` → `ind.production_inv`
- `skill.ind.supply_chain` → `ind.supply_chain`

سه شناسه اول ممکن است معادل مفهومی یکی از گره‌های صنعتی قدیمی باشند، اما نام آن‌ها یکسان نیست. زنجیره تأمین گره متناظر آشکار ندارد. هیچ‌کدام به‌طور خودکار remap نشده‌اند.

دو ارجاع شناسه مهارت نیز در خود فایل مقصد ندارند:
- `skill.mkt.brand.cbbe_pyramid` به `skill.mkt.stp.positioning` به‌عنوان prerequisite اشاره می‌کند؛ این مهارت موجود نیست.
- `skill.stats.anova.parametric_assumptions`، `skill.stats.nonparam.kruskal` را در confusable_with معرفی می‌کند؛ این مهارت موجود نیست.

این دو ارجاع باید با تعریف Skill واقعی یا حذف/اصلاح مستند حل شوند.

## ۴. ارتباط سؤال با دانش

| منبع | تعداد |
|---|---:|
| بسته `phd-management-business-v1` | ۲۱ سؤال |
| گره‌های همان بسته | ۱۸ |
| یال‌های dependencies همان بسته | ۱۴ |
| `question-skill-mappings.jsonl` | ۱۸ نگاشت |
| سؤال‌های فاقد skill mapping | ۳ |

سه سؤال فاقد نگاشت:
- `q-1400-001`
- `q-1400-002`
- `q-1399-001`

۱۸ نگاشت موجود از نظر primaryNodeId و Skillهای ارجاع‌شده با index فعلی سؤال/Skill تطبیق داده شدند. در crosswalk جدید، سه سؤال باقی‌مانده به‌صورت `unmapped` ثبت شده‌اند؛ هیچ مهارت یا مفهوم جدیدی حدس زده نشده است.

تمام ۱۸ نگاشت موجود `paper_code=2164` دارند. این مقدار legacy حفظ شده است تا تکلیف معنای آن روشن شود.

## ۵. بسته‌های درسنامه

| بسته | Topic | سؤال/آیتم |
|---|---:|---:|
| financial-management | ۸ | ۲۴ |
| statistics-foundations | ۲ | ۵ |
| phd-management-expansion | ۱۲ | ۲۷ |
| **مجموع** | **۲۲** | **۵۶** |

ساختار Topic فعلی هدف، مدت، prerequisites داخلی بسته، concepts، formula، workedExample، commonError و sourceIds دارد. نگاشت عمومی به Skill/Outcome/Tag و syllabusNode هنوز در خود بسته‌ها ثبت نشده است.

در manifest جدید ۲۲ رکورد LessonTopicMapping با وضعیت `needs_mapping` قرار گرفته‌اند. این یک صف کار روشن است، نه ادعای اتصال کامل.

## ۶. Tagging و Knowledge Relations

در مخزن فایل taxonomy عمومی که namespace، tag definition و assignment را با قواعد cardinality و hierarchy مدیریت کند، وجود نداشت. فایل جدید پایه شامل:
- ۱۰ namespace
- ۴۳ tag
- ۰ tag assignment
- ۰ رابطه معنایی جدید
- ۱۸ QuestionAcademicMapping
- ۳ UnmappedQuestion
- ۲۲ LessonTopicMapping در وضعیت needs_mapping
- ۰ ExamCourseAssignment

Assignments و KnowledgeRelationها فعلاً خالی‌اند؛ این انتخاب عمدی است. گراف موجود `prerequisite_edges` و `NodeDependency` حفظ می‌شود و برای جلوگیری از تکرار، رابطه پیش‌نیاز در `KnowledgeRelation` تعریف نشده است.

## ۷. تغییرات این بسته

1. قرارداد مستقل `packages/contracts/src/academic-foundation.ts`.
2. export از `packages/contracts/src/index.ts`.
3. مدل‌های اختیاری academic mapping و lesson blocks در `formative-quiz.ts`.
4. `normalizeLearningTopicBlocks` برای سازگاری داده تخت قدیمی با بلوک‌های جدید.
5. اعتبارسنجی فیلدهای اختیاری در `scripts/validate-learning-courses.ts`.
6. taxonomy و crosswalk در `content/knowledge/academic-foundation.v1.json`.
7. Migration `0027_academic_foundation.sql`.
8. تست قرارداد و درخت در `packages/contracts/tests/academic-foundation.test.ts`.
9. مستند معماری در `docs/architecture/LAYER_1_ACADEMIC_FOUNDATION_FA.md`.

## ۸. موارد باقی‌مانده برای تکمیل کامل لایه اول

| مورد | اقدام بعدی |
|---|---|
| ۳۷ گره در برابر ۲۴ syllabus node | تولید crosswalk و تکمیل درخت Registry با حفظ IDها |
| ۴ Skill با node_id ناموجود در فایل سرفصل | تعیین canonical node یا تعریف گره جدید |
| ۲ Skill reference ناموجود | تعریف Skill یا اصلاح رابطه با مدرک محتوایی |
| ۷ عنوان درس در برابر ۶ Course | تطبیق هویت/alias و تفکیک Course مستقل |
| ۲۲ Topic بدون syllabus mapping | نگاشت به گره‌های دقیق و حفظ needs_mapping برای مجهولات |
| ۳ سؤال بدون Skill mapping | انتخاب مهارت اصلی و ثانویه پس از تحلیل سؤال |
| taxonomy دارای صفر assignment | تعریف سیاست tag و تخصیص بر مبنای محتوا |
| روابط معنایی جدید | استخراج فقط رابطه‌های واقعی و جدا از prerequisite |
| ExamCourseAssignment خالی | اتصال رسمی درس/ماده/ترکیب و دامنه ضریب با داده معتبر |
| درخت سرفصل Registry | تبدیل ساختار تخت فعلی به parent/child و position بدون ID بازیافتی |

**وضعیت لایه اول:** قراردادها و زیرساخت اولیه پیاده‌سازی شده‌اند؛ یکپارچگی کامل داده و crosswalk علمی هنوز تکمیل نشده است. این لایه را نباید صرفاً به دلیل اضافه‌شدن قراردادها «Complete» نامید.
