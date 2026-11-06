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
| `answer_conflict_with_official_key` | bool + detail | اگر پاسخ علمی با کلید رسمی هر ظهور اختلاف دارد |
| `content_hash` | sha256 | مبنای Deduplication (بخش 4) |
| `verification_status` | draft/needs_review/sme_approved/published | Gate مستقل |
| `rights_status` | unknown/pending_official_check/authorized | Gate حقوق (H-CONK/SRC-02) |

- سؤالِ بدون ظهور آزمونی مجاز است (سؤال دست‌ساز در آینده).
- `answer_option` هرگز از `AnswerKeyEntry` باقی‌مانده‌ی کپی نمی‌شود؛ اختلاف با کلید
  یک دادهٔ ارزشمند است نه خطا.

### 2.2 QuestionAppearance — ظهور تاریخی

| فیلد | نوع | یادداشت |
|---|---|---|
| `appearance_id` | id | مثلا `qa-<source_id>-<num>-p<page>` (مطابق خروجی فعلی تحلیل ساختاری) |
| `question_id` | FK → Question | بعد از Dedup مقدار می‌گیرد |
| `exam_document_id` | FK → ExamDocument | دفترچهٔ حاوی ظهور |
| `exam_year` / `exam_level` / `exam_set_code` / `booklet_code` | متادیتا | کپی از سند با Evidence و status (proposed/needs_review) — منبع حقیقت، ExamDocument است |
| `question_number` | int | شمارهٔ سؤال در آن دفترچه |
| `topic_candidates` | jsonb | کاندیداهای بخش/درس از جدول مواد امتحانی + status |
| `source_locator` | jsonb | صفحه/خط MD و صفحهٔ PDF |
| `ocr_issues` | jsonb | `short_stem` / `options_not_4` / `no_options_found` / … |

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
| `key_disagreement` | jsonb | اختلاف با کلید رسمی هر ظهور + توضیح |
| `sme_review_status` | draft/pending_review/approved/rejected | هویت بازبین ثبت می‌شود |
| `published_status` | draft/published | انتشار کنترل‌شده، Gate جدا |

- توضیح روی Question سوار است؛ اگر سؤال در سه سال تکرار شده باشد، یک Explanation
  (با نسخه‌ها) سه ظهور را پوشش می‌دهد و `key_disagreement` می‌تواند به‌ازای هر ظهور
  کلید متفاوت را ثبت کند.

## 3. مسیر داده از تحلیل ساختاری تا این مدل

1. خروجی فعلی `questions-<source_id>.jsonl` → **QuestionAppearance** (یک‌به‌یک موقت با Question).
2. خروجی `key-<source_id>.jsonl` + `pairing-results.jsonl` → **AnswerKeyEntry** روی
   ظهورهای همان سند جفت‌شده (فقط pairing با وضعیت `candidate_multi_evidence` یا
   تصمیم انسانی؛ `needs_review`/`unresolved` قرنطینه).
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
