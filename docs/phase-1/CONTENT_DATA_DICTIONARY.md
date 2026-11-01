# فرهنگ دادهٔ محتوا و آزمون (Content Data Dictionary)

## اصول پایه

- همهٔ شناسه‌ها پایدار و مستقل از زبان‌اند.
- تمام داده‌های سالانه versioned هستند.
- نام رسمی آزمون از عنوان آموزشی داخلی جداست.
- هیچ فیلدی با مقادیر مبهم مثل `code` یا `type` بدون qualifier استفاده نشود.
- مقدار `null` با «نامعلوم»، «غیرقابل اعمال» و «صفر» یکی نیست.

## موجودیت‌ها و فیلدهای کلیدی

### 1. ExamSpecification

| فیلد | نوع | الزامی | توضیح |
|---|---|---:|---|
| id | string | بله | ID پایدار؛ نمونه `exam:phd:1406` |
| examType | enum | بله | `phd` یا `msc` |
| examYear | integer | بله | سال شمسی آزمون |
| organizer | string | بله | برگزارکننده |
| sourceIds | string[] | بله | منابع پشتیبان |
| effectiveFrom | date | بله | تاریخ آغاز اعتبار |
| status | enum | بله | draft / pending / verified / superseded |
| changeLog | object[] | بله | تاریخچهٔ تغییرات |

### 2. ExamSet

| فیلد | نوع | الزامی | توضیح |
|---|---|---:|---|
| id | string | بله | شناسهٔ داخلی |
| setCode | string | بله | مثلاً ۲۱۶۲ |
| officialTitle | string | بله | عنوان عین دفترچه |
| experimentalGroup | string | بله | گروه آزمایشی |
| examYear | integer | بله | سال اعتبار |
| verificationStatus | enum | بله | وضعیت منبع |

### 3. ExamCombination

| فیلد | نوع | الزامی | توضیح |
|---|---|---:|---|
| id | string | بله | یکتا در دامنهٔ آزمون/سال |
| examSpecificationId | string | بله | نسخهٔ آزمون |
| examSetId | string | بله | مجموعهٔ امتحانی |
| combinationCode | string | بله | کد ترکیب همان سال |
| fieldIds | string[] | بله | رشته‌ها/گرایش‌های تحت این ترکیب |
| sourceId | string | بله | سند تعیین‌کننده |
| verificationStatus | enum | بله | وضعیت اعتبار |

### 4. ExamSubjectBundle و Course

| فیلد | نوع | الزامی | توضیح |
|---|---|---:|---|
| bundleId | string | بله | شمارهٔ بستهٔ امتحانی در سال/مجموعه |
| officialNumber | string | بله | شمارهٔ ۱ تا ۹ در baseline ۱۴۰۵ |
| officialTitle | string | بله | عنوان عین سند |
| coefficient | number/null | مشروط | فقط اگر منبع صریحاً ضریب مستقل اعلام کند |
| courseIds | string[] | بله | یک بسته ممکن است چند درس داخلی داشته باشد |
| courseId | string | بله | شناسهٔ داخلی درس |
| displayTitleFa | string | بله | عنوان فارسی |
| displayTitleEn | string/null | خیر | معادل انگلیسی |
| level | enum | بله | bachelor / master / doctoral / general |
| curriculumStatus | enum | بله | official_heading / proposed_expansion |

### 5. Topic، Concept، Skill و LearningOutcome

| فیلد | نوع | الزامی | توضیح |
|---|---|---:|---|
| topicId | string | بله | مبحث پایدار |
| courseId | string | بله | درس مادر |
| topicTitleFa | string | بله | عنوان فارسی |
| scopeStatus | enum | بله | proposed / expert_reviewed / accepted |
| conceptId | string | بله | مفهوم مشخص |
| aliases | string[] | خیر | مترادف‌ها و معادل‌های فارسی/انگلیسی |
| skillId | string | بله | مهارت قابل سنجش |
| skillVerb | string | بله | فعل عملکردی: تعریف، مقایسه، محاسبه، تحلیل... |
| cognitiveLevel | enum | بله | remember / understand / apply / analyze / evaluate / create |
| outcomeId | string | بله | نتیجهٔ یادگیری |
| successCriterion | string | بله | معیار مشاهده‌پذیر موفقیت |

### 6. LearningResource و Source

| فیلد | نوع | الزامی | توضیح |
|---|---|---:|---|
| sourceId | string | بله | شناسهٔ منبع |
| sourceType | enum | بله | official_document / book / article / standard / dataset |
| title | string | بله | عنوان |
| authors | string[] | خیر | نویسندگان/سازمان |
| publisher | string/null | خیر | ناشر |
| publicationYear | integer/null | خیر | سال انتشار |
| edition | string/null | خیر | ویرایش |
| isbn | string/null | خیر | ISBN |
| doi | string/null | خیر | DOI |
| url | string | بله | URL یا آدرس رسمی |
| locator | string/null | خیر | صفحه، فصل، بند یا شمارهٔ جدول |
| accessDate | date | بله | تاریخ بررسی |
| sourceReliability | enum | بله | سطح اعتبار منبع |
| rightsNote | string | خیر | وضعیت مجوز/محدودیت استفاده |

### 7. Question

| فیلد | نوع | الزامی | توضیح |
|---|---|---:|---|
| questionId | string | بله | ID پایدار |
| version | integer | بله | شمارهٔ نسخه |
| provenanceType | enum | بله | official_phd / official_msc / human_authored / ai_generated / diagnostic / transfer |
| examYear | integer/null | شرطی | برای سؤال رسمی لازم |
| examSetCode | string/null | شرطی | برای سؤال رسمی لازم |
| combinationCode | string/null | شرطی | برای سؤال رسمی لازم، اگر سند دارد |
| bookletQuestionNumber | string/null | شرطی | شمارهٔ سؤال در دفترچه |
| sourceId | string | بله | سند منبع |
| sourcePage | string/null | شرطی | صفحه/محل سؤال در سند |
| correctOption | integer/null | شرطی | فقط سؤال چهارگزینه‌ای دارای کلید |
| explanation | string | بله برای انتشار | تشریح |
| optionAnalysis | object[] | بله برای انتشار آموزشی | تحلیل هر گزینه |
| skillIds | string[] | بله | یک یا چند مهارت هدف |
| cognitiveLevel | enum | بله | سطح شناختی |
| expertDifficulty | enum/null | خیر | تخمین اولیه |
| empiricalDifficulty | number/null | خیر | برآورد داده‌محور |
| keyVerificationStatus | enum | بله | not_applicable / pending / checked / disputed |
| contentStatus | enum | بله | draft / review / approved / published / retired |

### 8. AdmissionPath

| فیلد | نوع | الزامی | توضیح |
|---|---|---:|---|
| id | string | بله | آموزشی‌ـ‌پژوهشی یا پژوهش‌محور |
| examYear | integer | بله | سال |
| centralizedExamWeight | number | بله | درصد |
| academicResearchRecordWeight | number | بله | درصد |
| interviewWeight | number | بله | درصد |
| proposalWeight | number/null | خیر | درصد در صورت وجود |
| sourceId | string | بله | سند پذیرش |

## enumهای استاندارد

- `VerificationStatus`: `pending_official_check`, `official_verified`, `secondary_reported`, `expert_review_pending`, `verified`, `disputed`, `deprecated`.
- `ProvenanceType`: `official_phd`, `official_msc`, `human_authored`, `ai_generated`, `diagnostic`, `transfer`.
- `CognitiveLevel`: `remember`, `understand`, `apply`, `analyze`, `evaluate`, `create`.
- `ContentStatus`: `draft`, `review`, `approved`, `published`, `retired`.

## قواعد اعتبار

1. برای دادهٔ رسمی، منبع اولیهٔ سازمان سنجش مقدم است.
2. منبع ثانویه فقط در صورت عدم دسترسی به سند اولیه و با برچسب ثانویه استفاده می‌شود.
3. هیچ فیلد coefficient برای ریزموضوع یا کتاب بدون سند صریح پر نمی‌شود.
4. سؤال رسمی با سؤال تألیفی/AI در یک شاخص شمارش نمی‌شود.
5. مقادیر برآوردی و تجربی difficulty دو فیلد مستقل‌اند.
6. متن کامل کتاب‌ها یا مقالات دارای حق نشر در بانک ذخیره نمی‌شود، مگر مجوز استفاده وجود داشته باشد؛ فراداده، یادداشت تألیفی و locator نگهداری می‌شوند.
