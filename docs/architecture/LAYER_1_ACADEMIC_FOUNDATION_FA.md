# معماری لایه اول AEL — بنیان علمی و مدل داده

**نسخه:** 1.0  
**دامنه:** مدل آزمون، ساختار رشته و درس، درخت سرفصل، Tagging، Knowledge Graph، شناسنامه سؤال و ساختار درسنامه  
**شاخه پیاده‌سازی:** `feat/layer1-academic-foundation-20261107`  
**مبنای ادغام:** شاخه PR #14 با سرآیند `ad728a9fcae59328cfc9650a96eaf2266d0a4734`

---

## ۱. تصمیم معماری اصلی

AEL نباید برای هر قابلیت یک کاتالوگ مستقل بسازد. مدل موجود در `packages/contracts/src/registry.ts` مرجع موجودیت‌های آموزشی و آزمونی است و باید حفظ شود. لایه جدید در `packages/contracts/src/academic-foundation.ts` فقط چیزهایی را اضافه می‌کند که در رجیستری فعلی وجود ندارند یا معنای آن‌ها به‌قدر کافی تفکیک نشده است:

1. Taxonomy و Tag assignment.
2. روابط معنایی گراف دانش، جدا از روابط پیش‌نیاز.
3. نگاشت سؤال به گره دانش، مهارت و خروجی یادگیری.
4. نگاشت مبحث درسنامه به گره دانش، مهارت و برچسب.
5. قرارداد واحدهای ساختاری درسنامه.
6. انتساب درس به ساختار آزمون با دامنه ضریب و وزن یادگیری صریح.

**مرز منبع حقیقت:**

| مفهوم | مرجع |
|---|---|
| نهاد، نظام آموزشی، مقطع تحصیلی، رشته و گرایش | `packages/contracts/src/registry.ts` |
| برنامه تحصیلی، نسخه برنامه، درس و ارائه درس | Education Registry |
| درخت فصل/بخش/مبحث/مفهوم | `SyllabusNode` در Education Registry |
| رویداد آزمون، مجموعه، ترکیب و ساختار سالانه | `packages/contracts/src/exam-structure.ts` و Registry آزمون |
| مهارت قابل سنجش | `content/knowledge/skills.json` |
| گره‌های دانش قدیمی و روابط موتور | `konkorData.ts` و داده‌های Knowledge Graph |
| Tag namespace و Tag definition | `content/knowledge/academic-foundation.v1.json` |
| روابط معنایی غیرپیش‌نیازی | `KnowledgeRelation` در Academic Foundation |
| نگاشت سؤال به مهارت و گره | Academic Foundation؛ با حفظ crosswalk قدیمی |
| بسته‌های درسنامه | `content/learning-courses/*.json` |

از این پس فایل جدیدی برای تعریف دوباره رشته، گرایش یا درس ایجاد نشود. داده‌های قدیمی به‌تدریج به رجیستری متصل می‌شوند؛ شناسه‌های فعلی بدون برنامه مهاجرت تغییر نمی‌کنند.

## ۲. هویت آزمون، رشته، گرایش و درس

### ۲.۱ سلسله‌مراتب آزمون

مدل مفهومی باید این ترتیب را حفظ کند:

`ExamFamily → ExamEvent(year, session) → ExamEventVersion → ExamSet → ExamCombination → Field/Subfield → SubjectAssignment`

این موجودیت‌ها با موجودیت‌های زیر یکی نیستند:

- **Program / Curriculum:** برنامه آموزشی دانشگاهی و نسخه آن.
- **Study Track:** مسیر موضوعی یادگیری در محصول؛ مثلاً common، business یا technology.
- **Exam Level:** مقطع رسمی آزمون؛ کارشناسی ارشد یا دکتری.
- **Exam Set:** مجموعه امتحانی رسمی؛ برای دکتری مدیریت در مدل PR #14 کد ۲۱۶۲.
- **Exam Combination:** کد ترکیب رسمی درون مجموعه؛ کدهای ۱ تا ۷ در ساختار ثبت‌شده ۱۴۰۵.
- **Subgroup / Major:** دسته‌بندی رشته‌ای یا محصولی؛ تا زمانی که کد رسمی مستقل وجود ندارد، کد رسمی فرضی برای آن ساخته نمی‌شود.
- **Booklet / Paper Code:** شناسه دفترچه/ماده‌ای که ممکن است در آرشیو قدیمی متفاوت از کد مجموعه باشد.

بنابراین کد ۲۱۶۲ را نباید با کد ترکیب ۱ تا ۷ یا شناسه دفترچه قدیمی یکی گرفت. مقدار قدیمی `paper_code=2164` در داده نگاشت سؤال‌ها فعلاً حفظ می‌شود؛ معنای آن باید با رکورد منبع و سال خودش تطبیق داده شود و جایگزینی خودکار با ۲۱۶۲ مجاز نیست.

### ۲.۲ تفاوت ارشد و دکتری

PR #14 جریان شروع سطح‌محور را اضافه کرده است: ابتدا مقطع، سپس گرایش‌های ارشد به‌شکل چندانتخابی یا مسیر دکتری به‌شکل انحصاری. این رفتار محصولی نباید به معنای یکسان بودن مدل داده دو سطح تلقی شود.

- آزمون دکتری مدیریت: مجموعه ۲۱۶۲؛ ترکیب‌های آزمون و بسته‌های ۱۴۰۵ در فایل مرجع فعلی ثبت شده‌اند.
- آزمون کارشناسی ارشد: کد مجموعه ۱۱۴۲ در onboarding آمده است، اما `ExamStructure` سالانه سرور برای ارشد هنوز در قرارداد فعلی موجود نیست و مسیر Simulation آن `content_gap` است.
- ترکیب‌های رسمی سالانه باید نسخه‌دار باشند. یک کد ترکیب در سال‌های مختلف می‌تواند دروس یا ضوابط متفاوت داشته باشد.
- ساختار ۱۴۰۶ در بخش‌هایی از مدل فقط `reported` است؛ تعداد سؤال، مدت و نمره منفی نامشخص نباید از ۱۴۰۵ کپی شود.

### ۲.۳ ضرایب: قاعده غیرقابل اغماض

چهار مفهوم جدا هستند:

| فیلد | معنا |
|---|---|
| `officialCoefficient` | ضریب رسمی مستند در ساختار آزمون |
| `coefficientScope` | دامنه‌ای که ضریب به آن تعلق دارد: جزء آزمون، ماده، درس یا یادگیری صرف |
| `learningPriorityWeight` | وزن داخلی موتور برای اولویت مطالعه |
| `historicalWeight` | برآورد اهمیت تاریخی/فراوانی؛ ضریب رسمی نیست |

برای مثال، ضریب ۵ مجموعه تخصصی دکتری را نباید به‌صورت ضریب رسمی ۵ به همه درس‌های داخل بسته کپی کرد. اگر سند فقط ضریب کل بسته را تعیین کرده، دامنه `exam_component` است؛ برای انتساب به یک درس، باید شواهدی وجود داشته باشد که آن مقدار واقعاً ضریب همان درس است.

قرارداد `ExamCourseAssignment` این دو وزن را مستقل نگه می‌دارد. وقتی ضریب رسمی یا دامنه‌اش روشن نیست، `officialCoefficient=null` می‌ماند؛ موتور می‌تواند فقط در صورت تعریف مستقل، `learningPriorityWeight` را داشته باشد.

## ۳. ساختار سلسله‌مراتبی درس و سرفصل

رجیستری موجود `SyllabusNode` را با فیلدهای زیر دارد:

- `id`
- `definitionCode`
- `parentId`
- `position`
- `title`
- `nodeKind`: chapter / section / topic / concept
- `officiality`: official / proposed / authored
- `status`
- `knowledgeNodeId`

این مدل برای درخت سرفصل کافی است؛ مسئله فعلی این است که فایل `content/knowledge/syllabus-nodes.json` تخت است و فقط `id, track, course, chapter, topic` دارد. آن فایل هنوز تبدیل کامل به درخت نسخه‌دار Registry نشده است.

### قرارداد درخت

- یک CourseDefinition می‌تواند چند فصل ریشه داشته باشد.
- هر Chapter می‌تواند Section یا Topic داشته باشد.
- هر Topic می‌تواند Concept داشته باشد.
- والد و فرزند باید متعلق به یک CourseDefinition باشند.
- ترتیب هر فرزند در محدوده والد با `position` تعیین می‌شود؛ عنوان برای مرتب‌سازی به‌کار نرود.
- گره حذف‌شده حذف فیزیکی نمی‌شود؛ وضعیت lifecycle آن تغییر می‌کند.
- Officiality و status دو محور متفاوت هستند: authored بودن محتوا به‌معنای draft بودن آن نیست و published بودن نیز رسمی‌بودن را ثابت نمی‌کند.
- `knowledgeNodeId` پل اتصال درخت سرفصل به گره‌های قدیمی KnowledgeNode است؛ این دو شناسه تا پایان مهاجرت یکی فرض نمی‌شوند.

تابع `validateSyllabusHierarchy` اکنون والد گمشده، والد متعلق به درس دیگر و چرخه را بررسی می‌کند. در داده تخت فعلی، این اعتبارسنج به‌عنوان قرارداد هدف استفاده می‌شود و تا زمان تولید crosswalk کامل، نباید برای همه ۳۷ گره به‌صورت مصنوعی parent تولید کرد.

## ۴. Taxonomy و Tagging

### ۴.۱ چرا Tag با Skill فرق دارد؟

**Tag** برای طبقه‌بندی، فیلتر، جست‌وجو، گزارش و اتصال چندبعدی محتواست.  
**Skill** توانایی مشخص و قابل مشاهده‌ای است که می‌توان با سؤال یا فعالیت آن را سنجید.

مثال:
- Tag: «آمار»، «تحلیل»، «دشواری متوسط»، «دکتری».
- Skill: «اجرای آزمون F و بررسی مفروضات تحلیل واریانس».

یک سؤال می‌تواند چند Tag داشته باشد اما برای سنجش آن معمولاً یک Skill اصلی و تعدادی Skill ثانویه تعیین می‌شود. Tag جایگزین skillIds یا primarySkillId نیست.

### ۴.۲ ساختار Taxonomy

هر Tag متعلق به یک Namespace است. Namespace تعیین می‌کند:
- تگ‌ها چه معنایی دارند؛
- روی چه نوع موجودیت‌هایی قابل اعمال‌اند؛
- انتخاب یک تگ اجباری/تک‌انتخابی است یا چندتایی.

Namespaceهای پایه:

| Namespace | کاربرد |
|---|---|
| discipline | حوزه علمی/درس |
| competency-area | حوزه توانمندی عمومی |
| bloom-level | سطح شناختی |
| difficulty | دشواری طراحی‌شده |
| question-format | قالب سؤال |
| assessment-purpose | هدف ارزیابی |
| exam-level | مقطع آزمون |
| study-track | مسیر موضوعی مطالعه |
| language | زبان محتوا |
| content-format | قالب محتوای آموزشی |

شناسه‌های `study-track` صرفاً مسیرهای محصول‌اند و کد ترکیب رسمی آزمون نیستند. وضعیت‌هایی مثل weak، mastered، due، overdue یا فراموش‌شده Tag ثابت محتوا نیستند؛ این‌ها state شخصی یادگیرنده‌اند و باید در مدل learner نگهداری شوند.

### ۴.۳ قواعد Tagging

- شناسه Tag پایدار و slug یکتا در هر namespace است.
- برچسب فارسی، aliases و description در داده ذخیره می‌شوند.
- یک Tag می‌تواند parent داشته باشد؛ parent باید در همان namespace باشد.
- چرخه در hierarchy تگ ممنوع است.
- اگر namespace تک‌انتخابی باشد، یک موجودیت فقط یک Tag از همان namespace می‌گیرد.
- یکسان‌سازی مترادف‌ها از طریق aliases انجام می‌شود؛ چند Tag هم‌معنی با شناسه مستقل ساخته نمی‌شود.
- TagAssignment از وضعیت کاربر مستقل است.
- Tag بدون تعریف یا assignment به شناسه ناموجود پذیرفته نمی‌شود.

فایل مرجع: `content/knowledge/academic-foundation.v1.json`. تطبیق شناسه‌ها در `content/knowledge/layer1-node-course-crosswalk.v1.json` نگهداری می‌شود. اکنون ۱۰ namespace و ۴۹ Tag پایه تعریف شده و ۸۷ TagAssignment برای ۲۴ گره سرفصل، ۲۳ مهارت، ۱۸ سؤال و ۲۲ مبحث درسنامه ثبت شده است. Tag assignment فقط طبقه‌بندی علمی است و جایگزین اتصال مبحث به Skill یا SyllabusNode نیست.

## ۵. Knowledge Graph

در AEL دو نوع رابطه باید جدا بمانند:

### ۵.۱ روابط آموزشی و پیش‌نیاز

`PrerequisiteEdge` در Registry و `NodeDependency` در مدل قدیمی موتور برای پیش‌نیاز و cross-course bridge وجود دارند. پیش‌نیاز، رابطه‌ای جهت‌دار است: اگر A پیش‌نیاز B باشد، مطالعه B باید بعد از احراز آمادگی A قرار بگیرد.

در مدل قدیمی `NodeDependency` جهت به این معناست:
- source: مبحثی که خطا/نیاز در آن مشاهده شده؛
- target: مبحث پیش‌نیاز یا مقصد پل بین‌درسی.

این جهت باید هنگام تبدیل به Registry حفظ شود؛ تغییر source و target می‌تواند مسیر برنامه‌ریزی را برعکس کند.

### ۵.۲ روابط معنایی غیرپیش‌نیازی

`KnowledgeRelation` برای رابطه‌هایی مانند:
- related_to
- cross_course_related
- confusable_with
- contrasts_with
- equivalent_to
- teaches
- illustrates
- assesses
- supports_outcome

این یال‌ها پیش‌نیاز نیستند. برای مثال «انگیزش» و «رهبری» می‌توانند مرتبط باشند، اما الزاماً یکی پیش‌نیاز دیگری نیست.

روابط متقارن باید با ترتیب canonical ذخیره شوند تا رابطه دوبار ثبت نشود. روابط جهت‌دار جهت خود را حفظ می‌کنند؛ برعکس‌کردن `teaches` یا `supports_outcome` همان مفهوم را ندارد.

قدرت رابطه `strength` بین صفر و یک است و نباید با وزن خطای موتور، تسلط داوطلب یا ضریب آزمون یکی گرفته شود. روابط جدید بدون دلیل قابل توضیح وارد گراف نمی‌شوند.

## ۶. مهارت‌ها و نگاشت سؤال

فایل `content/knowledge/skills.json` اکنون ۲۳ Skill دارد. Skillها operational definition، سطح بلوم، پیش‌نیاز و confusableWith دارند. اما ممیزی نشان داده:
- چهار Skill به node_idهایی وصل‌اند که در `syllabus-nodes.json` وجود ندارند: `ind.or_simplex`، `ind.mcdm`، `ind.production_inv` و `ind.supply_chain`.
- ارجاع پیش‌نیاز `skill.mkt.stp.positioning` در فهرست Skillها موجود نیست.
- ارجاع confusable `skill.stats.nonparam.kruskal` موجود نیست.

این ارجاع‌ها نباید با حدس به شناسه‌های مشابه وصل شوند. سه مورد صنعتی اول احتمالاً به گره‌هایی نزدیک‌اند که در KnowledgeNode با شناسه دیگری نام‌گذاری شده‌اند؛ مورد زنجیره تأمین فعلاً گره هم‌ارز مشخص ندارد.

### QuestionAcademicMapping

هر سؤال باید بتواند این اطلاعات را داشته باشد:
- primaryNodeId و secondaryNodeIds؛
- primarySkillId و secondarySkillIds؛
- learningOutcomeIds؛
- tagIds؛
- bloomLevel؛
- difficulty؛
- format؛
- purpose؛
- estimatedTimeSeconds؛
- status نگاشت.

یک Skill اصلی انتخاب می‌شود تا تحلیل پاسخ‌ها بیش از حد پخش نشود. Skillهای ثانویه صرفاً وقتی ثبت شوند که سؤال واقعاً آن توانایی‌ها را هم می‌سنجد. سؤال بی‌نگاشت با reason ثبت می‌شود؛ نباید Skill یا node ساختگی برای کامل‌شدن آمار تولید کرد.

### وضعیت Crosswalk سؤال

در بسته دکتری PR #14:
- ۲۱ سؤال وجود دارد.
- ۱۸ سؤال در فایل legacy `question-skill-mappings.jsonl` نگاشت دارند.
- سه سؤال `q-1400-001`، `q-1400-002` و `q-1399-001` فاقد نگاشت فعلی مهارت‌اند و به‌صورت unmapped ثبت شده‌اند.
- کد legacy `paper_code=2164` بدون تغییر در منبع قبلی باقی می‌ماند؛ ۲۱۶۲ کد مجموعه است و نباید با آن جایگزین حدسی شود.

فایل `academic-foundation.v1.json` نگاشت‌های ۱۸ سؤال را در قرارداد جدید منعکس می‌کند. زمان پاسخ و دشواری تجربی چون داده‌ای در منبع فعلی ندارند null مانده‌اند.

## ۷. قرارداد درسنامه

بسته‌های آموزشی فعلی در `content/learning-courses/*.json` مدل پایه خوبی دارند:
- ۳ بسته
- ۲۲ Topic
- ۵۶ سؤال/آیتم آموزشی

Topic فعلی دارای هدف، دقیقه، پیش‌نیازهای داخلی بسته، مفاهیم، فرمول، مثال حل‌شده، خطای رایج و sourceIds است. Question نیز به topicId متصل است. اما اتصال مستقیم Topic به syllabusNode و skill وجود ندارد.

### افزوده‌های اختیاری

به Topic:
- `syllabusNodeId`
- `skillIds`
- `learningOutcomeIds`
- `tagIds`
- `blocks`

به Question:
- `skillIds`
- `learningOutcomeIds`
- `tagIds`
- `bloomLevel`
- `questionFormat`
- `assessmentPurpose`
- `estimatedTimeSeconds`

این فیلدها optional هستند؛ بسته‌های قدیمی معتبر می‌مانند. `normalizeLearningTopicBlocks` ساختار تخت فعلی را بدون تغییر داده اصلی به بلوک‌های استاندارد تبدیل می‌کند:
- learning_objective
- concept_explanation
- formula
- worked_example
- common_misconception

بلوک‌های آینده می‌توانند definition، case_study، comparison، summary، retrieval_prompt و practice نیز باشند.

فایل manifest فعلی برای هر ۲۲ Topic یک LessonTopicMapping با وضعیت `needs_mapping` دارد و تا زمانی که نگاشت واقعی بررسی نشده، syllabusNodeId و skillIds خالی می‌مانند.

## ۸. نگاشت داده‌های موجود و شکاف‌ها

| منبع | تعداد فعلی | نکته |
|---|---:|---|
| INITIAL_KNOWLEDGE_NODES | ۲۵ | مدل فعلی موتور |
| PHD_EXPANSION_NODES | ۱۲ | گسترش دکتری |
| اتحاد دو مجموعه گره | ۳۷ | عدد فعلی پس از توسعه |
| syllabus-nodes.json | ۲۴ | تخت و ناقص نسبت به اتحاد ۳۷ گره |
| skills.json | ۲۳ | شامل چهار node_id خارج از فایل سرفصل |
| question-skill-mappings.jsonl | ۱۸ | نگاشت فعلی سؤال به مهارت |
| بسته phd-management-business-v1 | ۱۸ گره، ۱۴ یال، ۲۱ سؤال | snapshot بسته؛ کل سرفصل نیست |
| Learning Courses | ۳ بسته، ۲۲ Topic، ۵۶ آیتم | اتصال به گراف هنوز ناقص |

تفاوت ۳۷ و ۲۴ به معنای حذف ۱۳ گره نیست؛ این دو فایل از دو نسل/هدف مدل داده آمده‌اند. بسته دکتری ۱۸ گره‌ای نیز یک بسته خاص است و نباید به‌عنوان کل Curriculum استفاده شود.

### نگاشت امن شناسه‌ها

برای ادغام:
1. ID قدیمی حفظ شود.
2. crosswalk با oldId، canonicalId و mappingStatus ساخته شود.
3. only exact/confirmed mapping وارد canonical relation شود.
4. موارد ambiguous با needs_review باقی بمانند.
5. مهاجرت فقط پس از گزارش تعداد before/after و unmatched انجام شود.

نمونه‌های نیازمند تصمیم:
- `ind.or_simplex` در Skill در مقابل `ind.or_simplex_duality` در KnowledgeNode؛
- `ind.mcdm` در Skill در مقابل `ind.mcdm_dea_queue`؛
- `ind.production_inv` در Skill در مقابل `ind.pom_eoq_mrp`؛
- `ind.supply_chain` که node هم‌نام متناظر فعلاً دیده نشده است.
- `تئوری‌های نوآوری و فناوری` و `مدیریت فناوری و نوآوری` دو عنوان نزدیک‌اند؛ بدون بررسی محتوا نباید ادغام شوند.

## ۹. وضعیت پیاده‌سازی این تغییر

در این شاخه:
- قرارداد `academic-foundation.ts` اضافه شده است.
- قرارداد در `packages/contracts/src/index.ts` export شده است.
- مدل Topic/Question در `formative-quiz.ts` فیلدهای اختیاری لایه اول را می‌پذیرد.
- normalizer برای تبدیل Topic تخت به LessonBlock اضافه شده است.
- Validator دوره‌ها برای فیلدهای اختیاری و ساختار بلوک‌ها گسترش یافته است.
- taxonomy با ۱۰ namespace و ۴۹ Tag اضافه شده است.
- ۸۷ TagAssignment برای سرفصل‌ها، مهارت‌ها، سؤال‌ها و مبحث‌های درسنامه ثبت شده است.
- Crosswalk مستقل ۴۸ شناسه گره و ۲۳ Skill ساخته شده؛ نامزدهای مبهم به‌صورت candidate/needs_review باقی مانده‌اند.
- ۱۸ mapping موجود به قرارداد جدید crosswalk شده‌اند.
- ۳ سؤال فاقد نگاشت به‌عنوان کار باز ثبت شده‌اند.
- ۲۲ مبحث درسنامه با وضعیت needs_mapping ثبت شده‌اند.
- Migration شماره ۰۰۲۷ برای جداول Tag، relation و mapping اضافه شده است.
- تست‌های قراردادی برای taxonomy، cycle، single-select cardinality، semantic graph، cross-reference و درخت سرفصل اضافه شده‌اند.

## ۱۰. تست و معیار پذیرش

فرمان‌های قابل اجرا در CI:
```sh
npm test -- --run
npm run typecheck
npm run validate:content
npm run validate:learning
npm run build
npm run build:worker
```

پذیرش لایه:
1. بسته taxonomy بدون خطا اعتبارسنجی شود.
2. ID ناموجود، تگ تکراری، چرخه در hierarchy و overflow در namespace تک‌انتخابی رد شود.
3. روابط متقارن canonical و روابط جهت‌دار جهت‌دار باقی بمانند.
4. سؤال و مبحث درسنامه بدون mapping جعل‌شده ثبت‌پذیر باشد.
5. Topicهای قدیمی بدون فیلد blocks همچنان با normalizer نمایش‌پذیر باشند.
6. ضریب رسمی از وزن اولویت مطالعه جدا بماند.
7. داده فعلی و شناسه‌های قدیمی بدون مهاجرت تخریبی باقی بمانند.

**محدودیت فعلی:** ۲۲ Topic هنوز به SyllabusNode و Skill متصل نشده‌اند؛ ۳ سؤال فاقد Skill mapping هستند؛ ۴ Skill نیازمند حل node mapping و ۲ ارجاع Skill ناموجود نیازمند اصلاح‌اند؛ ۱۱ سرفصل موجود هنوز در مجموعه KnowledgeNode موتور تطبیق ندارند و ۲۴ گره موتور هنوز در فایل تخت syllabus تعریف نشده‌اند. روابط معنایی جدید و ExamCourseAssignment رسمی هنوز خالی‌اند. این موارد عمداً تا تعیین نگاشت علمی/ساختار آزمون باقی مانده‌اند.
