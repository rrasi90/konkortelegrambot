# AEL Question Entity Model — Question / QuestionAppearance / AnswerKeyEntry / Explanation

**Mission:** `AEL-EXAM-MD-ANALYSIS-AND-EXPLANATION-001`
**وضعیت:** سند طراحی — قبل از هر Migration یا کد Production، این مدل با ممیزی §3.2 سند مادر و `docs/architecture/domain-and-data-model.md` هماهنگ می‌شود.
**مبنای تصمیم:** بازبینی مالک محصول ۱۴۰۵/۰۸/۱۵ — تفکیک هویت علمی سؤال از ظهور آزمونی، کلید رسمی و توضیح.

## 1. چرا چهار موجودیت جدا؟

اگر «سؤال» و «ظهور آزمونی» و «کلید» و «توضیح» یکی باشند، تکرار یک سؤال در سه سال
سه رکورد مستقل و سه توضیح متفاوت می‌سازد و پاسخ علمی به یک آزمون خاص چسبیده می‌شود.
با تفکیک زیر، یک سؤال تکراری یک هویت علمی و یک پاسخ نسخه‌بندی‌شده مشترک دارد و
هر سال فقط یک «ظهور» جدید است:

```
Question 1───* QuestionAppearance *───1 ExamDocument
                    │
                    └──* AnswerKeyEntry   (کلید رسمی همان ظهور)
Question 1───* Explanation            (پاسخ علمی نسخه‌بندی‌شده، مستقل از ظهور)
```

## 2. موجودیت‌ها

### 2.1 Question — هویت علمی سؤال

| فیلد | نوع | یادداشت |
|---|---|---|
| `question_id` | id | پایدار و مستقل از آزمون‌ها |
| `stem_normalized` | text | متن م normalized نهایی (پس از SME) |
| `stem_raw` | text | متن خام استخراج‌شده (حفظ همیشه) |
| `options` | jsonb | چهار گزینه: `{label, text_raw, text_normalized}` |
| `answer_option` | enum(1..4) | پاسخ علمی نهایی — فقط با Authoring+SME پر می‌شود، از کلید رسمی کپی نمی‌شود |
| `content_hash` | sha256 | مبنای Deduplication (بخش 4) |
| `verification_status` | draft/needs_review/sme_approved/published | Gate مستقل |
| `rights_status` | unknown/pending_official_check/authorized | Gate حقوق (H-CONK/SRC-02) |

- سؤالِ بدون ظهور آزمونی مجاز است (سؤال دست‌ساز در آینده).
- `answer_option` هرگز از `AnswerKeyEntry` کپی نمی‌شود؛ اختلاف با کلید یک دادهٔ ارزشمند است نه خطا.
- اختلاف پاسخ علمی و کلید، ویژگی ثابت `Question` نیست؛ باید در رابطه/موجودیت
  `KeyDisagreement` با ارجاع به `appearance_id` و `answer_key_entry_id` ثبت شود.
  یک سؤال تکراری ممکن است در دو سال کلیدهای متفاوت یا اصلاحیه داشته باشد.

### 2.2 QuestionAppearance — ظهور تاریخی

| فیلد | نوع | یادداشت |
|---|---|---|
| `appearance_id` | id | شناسه پایدار مبتنی بر source/version + page + line/block + occurrence؛ شماره سؤال به‌تنهایی کافی نیست |
| `question_id` | FK → Question | بعد از Dedup مقدار می‌گیرد |
| `exam_document_id` | FK → ExamDocument | دفترچهٔ حاوی ظهور |
| `exam_year` / `exam_level` / `exam_set_code` / `booklet_code` | متادیتا | کپی از سند با Evidence و status (proposed/needs_review) — منبع حقیقت، ExamDocument است |
| `question_number` | int | شمارهٔ سؤال در آن دفترچه |
| `topic_candidates` | jsonb | کاندیداهای بخش/درس از جدول مواد امتحانی + status |
| `source_locator` | jsonb | صفحه/خط MD و صفحهٔ PDF |
| `ocr_issues` | jsonb | `short_stem` / `options_not_4` / `no_options_found` / … |
| `context_links` | relation → `QuestionContext` | متن مشترک، جدول، شکل، نمودار یا قطعهٔ صفحهٔ مجاور موردنیاز برای فهم سؤال |

- ظهورها هرگز به هم merge نمی‌شوند؛ Dedup فقط `question_id` را به چند ظهور وصل می‌کند.
- در فاز فعلی، سؤال‌های استخراج‌شده (`questions-*.jsonl`) فقط «ظهور» هستند؛ تا قبل از
  Dedup هر ظهور یک Question موقت یک‌به‌یک دارد.

### 2.3 AnswerKeyEntry — کلید رسمی برای همان ظهور

| فیلد | نوع | یادداشت |
|---|---|---|
| `entry_id` | id | |
| `appearance_id` | FK → QuestionAppearance | نه به Question — کلید به شمارهٔ آن دفترچه می‌چسبد |
| `official_option` | enum(1..4) | پاسخ اعلام‌شدهٔ سازمان |
| `key_document_id` | FK → ExamDocument | فایل کلید (نسخهٔ اولیه/نهایی جدا می‌شوند) |
| `key_status` | initial/official | کلید اولیه بعضی سال‌ها بعد اصلاح شده |
| `extraction_status` | ok/needs_review | + منبع (table/plain_text) و anomalies |

- اگر یک ظهور کلید ندارد (مثلاً ۳۰ سؤال گم‌شدهٔ OCR در کلید ۱۳۹۲)، رکوردی ساخته نمی‌شود؛
  غیاب کلید با لیست `key_missing_answers` قرنطینه ثبت می‌شود، نه با حدس.
- اختلاف کلید اولیه و نهایی در همان ظهور → دو رکورد + پرچم.

### 2.4 Explanation — پاسخ علمی نسخه‌بندی‌شده

| فیلد | نوع | یادداشت |
|---|---|---|
| `explanation_id` | id | |
| `question_id` | FK → Question | به هویت علمی وصل است، نه به ظهور |
| `version` | int | هر ویرایش نسخهٔ جدید؛ تاریخچه حفظ می‌شود |
| `scientific_answer` | enum(1..4) | پاسخ پیشنهادی علمی |
| `option_analysis` | jsonb | تحلیل تک‌تک چهار گزینه (چرا درست/چرا غلط) |
| `solution_method` | text | روش حل گام‌به‌گام |
| `references` | jsonb | منابع علمی و ارجاعات |
| `difficulty_level` | enum | آسان/متوسط/دشوار (SME تأیید می‌کند) |
| `key_disagreement` | relation → `KeyDisagreement` | اختلاف با کلید رسمی، به‌ازای هر ظهور/نسخه کلید؛ نه یک فیلد مبهم در Explanation |
| `sme_review_status` | draft/pending_review/approved/rejected | هویت بازبین ثبت می‌شود |
| `published_status` | draft/published | انتشار کنترل‌شده، Gate جدا |

- توضیح روی Question سوار است؛ اگر سؤال در سه سال تکرار شده باشد، یک Explanation
  (با نسخه‌ها) سه ظهور را پوشش می‌دهد و `key_disagreement` می‌تواند به‌ازای هر ظهور
  کلید متفاوت را ثبت کند.


### 2.5 QuestionContext — زمینهٔ مشترک یا مرجع سؤال

| فیلد | نوع | یادداشت |
|---|---|---|
| `context_id` | id | شناسه پایدار قطعه زمینه |
| `context_type` | passage/table/figure/chart/formula/other | نوع زمینه |
| `raw_content` | text/jsonb | متن خام یا توصیف ساختاری؛ تصویر/فایل در Storage با ارجاع نگهداری می‌شود |
| `source_locator` | jsonb | سند، نسخه، صفحه، بلوک/خط و محدوده |
| `extraction_status` | proposed/needs_review/approved | استخراج زمینه به‌تنهایی تأیید علمی نیست |

- یک قطعه زمینه می‌تواند به چند QuestionAppearance متصل باشد؛ برای مثال یک متن درک مطلب
  ممکن است مرجع سه سؤال باشد.
- اگر زمینه از صفحه قبل یا بعد می‌آید، اتصال باید صریح و قابل ردیابی باشد.
- سؤال بدون زمینهٔ ضروری، حتی اگر stem و گزینه‌هایش استخراج شده باشند، برای Authoring
  و انتشار آماده نیست.

### 2.6 KeyDisagreement — اختلاف پاسخ علمی و کلید

| فیلد | نوع | یادداشت |
|---|---|---|
| `disagreement_id` | id | |
| `appearance_id` | FK → QuestionAppearance | ظهور دقیق آزمونی |
| `answer_key_entry_id` | FK → AnswerKeyEntry | نسخه دقیق کلید مورد مقایسه |
| `scientific_answer` | enum(1..4) | پاسخ علمی تأییدشده در نسخه Explanation |
| `official_option` | enum(1..4) | مقدار رسمی از AnswerKeyEntry؛ کپی مستقل نشود |
| `classification` | extraction_error/key_revision/official_key_error/ambiguous/unresolved | علت اختلاف؛ تا زمان بررسی می‌تواند unresolved باشد |
| `evidence` | jsonb | استدلال، منبع، تصمیم و بازبین |

- اختلاف فقط پس از وجود پاسخ علمی مستقل قابل ثبت است.
- اختلاف کلید اولیه و نهایی باید با دو AnswerKeyEntry جدا و ارتباط با نسخه سند حفظ شود.

### 2.7 SourceCitation و ReviewDecision — شواهد و ممیزی

هر ارجاع علمی باید حداقل عنوان، نویسنده/سازمان، ویرایش، سال، ناشر، شناسه پایدار
(ISBN/DOI/URL در صورت وجود)، فصل/صفحه و ادعایی را که پشتیبانی می‌کند ثبت کند.
نام کتاب بدون محل ارجاع، شاهد کافی برای تأیید پاسخ نیست.

هر تصمیم بازبینی باید reviewer identity، نقش، زمان، وضعیت قبل/بعد، دلیل، شواهد،
نسخه محتوا و در صورت رد، reason code داشته باشد. هویت بازبین نباید از روی نقش فنی
یا دسترسی ادمین استنتاج شود.

## 3. مسیر داده از تحلیل ساختاری تا این مدل

1. خروجی فعلی `questions-<source_id>.jsonl` → **QuestionAppearance**؛ `question_id` فعلی فقط provisional/staging identity است و تا Dedup نباید به‌عنوان هویت علمی پایدار تلقی شود.
2. خروجی `key-<source_id>.jsonl` + `pairing-results.jsonl` → **AnswerKeyEntry** فقط وقتی pairing بدون تعارض باشد و وضعیت آن `candidate_multi_evidence` یا تصمیم انسانیِ ثبت‌شده باشد؛ `needs_review`، `unresolved` و هر pairing دارای `conflicts` قرنطینه می‌شوند و FK اتصال نمی‌گیرند.
3. مرحلهٔ Deduplication → ادغام هویت علمی، چند ظهور → یک Question.
4. مرحلهٔ Authoring + SME → Explanation.

قفل‌های نافرمانی‌ناپذیر (از سند مادر §0.1):
- هیچ ظهورِ با `extraction_status: needs_review` وارد Authoring نمی‌شود.
- هیچ Question بدون SME تأیید `published` نمی‌شود.
- هیچ داده‌ای تا تصمیم Gate حقوق (H-CONK / SRC-02) منتشر نمی‌شود.
- کلید رسمی هرگز مستقیماً `scientific_answer` نمی‌شود؛ فقط مرجع مقایسه است.

## 4. Deduplication — قاعدهٔ پیشنهادی

- `content_hash` از stem normalized + گزینه‌های normalized (بدون شماره سؤال و سال) ساخته می‌شود.
- تطابق hash == کاندیدای «تکرار» با `confidence: high`.
- تطابق فازی (نرخ شباهت ≥ آستانه، مثلاً ۰٫۹۲ پس از نرمال‌سازی ارقام/فاصله) ==
  کاندیدای `needs_review` برای SME.
- تکرارهای هر سالِ یکسان در همان دفترچه (دو ظهور با شمارهٔ متفاوت) دستهٔ جدا دارند
  («تکرار درون‌دفترچه‌ای») و با Evidence گزارش می‌شوند.
- هیچ ادغامی خودکار نیست؛ خروجی، فهرست کاندیداست و تصمیم با SME است.

## 5. قیود یکپارچگی تکمیلی پیش از Migration

1. یکتایی `(exam_document_version_id, source_locator, occurrence_index)` برای ظهور؛
   یکتایی صرفاً بر اساس `question_number` یا `page + question_number` کافی نیست.
2. هر `AnswerKeyEntry` باید به یک `QuestionAppearance` و یک نسخه `ExamDocument`
   از نوع answer_key متصل شود؛ نوع سند و pairing باید در سطح سرویس اعتبارسنجی شود.
3. `official_option` و `scientific_answer` دو مفهوم مستقل‌اند؛ هیچ trigger یا importer
   نباید یکی را به دیگری کپی کند.
4. `QuestionContext` می‌تواند چند ظهور را پوشش دهد؛ حذف یا اصلاح زمینه نباید سابقه
   appearanceها را بازنویسی کند.
5. گزینه‌ها در لایه استخراج می‌توانند ناقص یا بیش از چهار مورد باشند و با وضعیت
   بازبینی ذخیره شوند؛ محدودیت نهایی نوع آزمون در مرحله تأیید اعمال می‌شود، نه با
   truncate خاموش گزینه‌ها.
6. هیچ وضعیت `ok` استخراجی به معنی `sme_approved`، `rights_authorized` یا
   `published` نیست.
7. پیش از ساخت Migration، این طراحی باید با جدول `questions` فعلی، قراردادهای
   importer، Data Dictionary و §3.2 سند مادر تطبیق داده شود؛ این سند به‌تنهایی
   مجوز ایجاد schema موازی نیست.
