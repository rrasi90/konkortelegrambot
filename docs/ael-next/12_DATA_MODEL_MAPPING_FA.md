# DATA-01 — ممیزی موجودیت‌ها و نگاشت مدل فعلی به مدل هدف

- **تاریخ:** ۵ نوامبر ۲۰۲۶ / ۱۴ آبان ۱۴۰۵
- **مبنا:** بخش ۶٫۲ نقشهٔ راه ([docs/roadmap/AEL_Master_Roadmap_FA_2026-11-05.md](../roadmap/AEL_Master_Roadmap_FA_2026-11-05.md)) و شمارش واقعی SRC-01 ([11_SOURCE_INVENTORY_FA.md](11_SOURCE_INVENTORY_FA.md))
- **قاعده:** این سند هیچ داده‌ای را تغییر نمی‌دهد و هیچ جدول/ستونی نمی‌سازد؛ قرارداد پیشنهادی برای DATA-02 است. مجهول‌ها «نامشخص» می‌مانند. **شناسه‌های قدیمی هرگز بازیافت یا تغییر معنا نمی‌گیرند.**

## ۱. موجودی لایه‌های دادهٔ فعلی و مصرف‌کنندگان

| لایه | محل | ساختار فعلی | مصرف‌کنندهٔ اصلی |
|---|---|---|---|
| بستهٔ درس تألیفی | `content/learning-courses/*.json` | `schemaVersion:1`؛ course→sources/topics/questions؛ سؤال با `origin/rights/review/readingBlock`، essay با `rubric` | `apps/worker/src/learning-catalog.ts` (رجیستری)، موتور `formative-quiz.ts`، آداپتور آفلاین `tools/offline/adapter.ts`، اعتبارسنج `scripts/validate-learning-courses.ts`، ایندکس‌ساز `scripts/build-question-index.mjs` |
| بانک تاریخی | `content/questions/bank-*.json` | سؤال با `examYear/bookletCode/bookletQuestionNumber/verificationStatus/sourceNodeId`؛ بدون فیلد rights | ایندکس‌ساز، موتور شبیه‌ساز (`exam-simulation.ts`)، `content/questions/bank-quarantine.json` با `tier` |
| شناسنامهٔ متادیتا | `content/learning-evidence/question-index.json` | ۱۶۸ رکورد فقط‌متادیتا (`verification/review/rights/auditStatus`) | `learning-paths.ts` (نمای overview)، آفلاین |
| شواهد | `source-audit.json`، `recurrence.json`، `concept-rules.json` | وضعیت ممیزی، الگوها، قواعد regex | `verify-source-audit.mjs`، `extract-learning-recurrence.mjs`، نمای شواهد |
| دانش/سرفصل | `content/knowledge/*` | courses/syllabus-nodes(۲۴)/skills(۲۳)/mappings(۱۸)/relations(۱۴) | گراف مهارت، نگاشت سؤال←مهارت |
| ذخیره‌سازی کاربر | Supabase (۱۸ مهاجرت) | app_users، answer_events، exam_sessions/items/responses، learner_skill_states و… با RLS | `apps/worker/src/store.ts` (service role) |
| سابقهٔ قدیمی Anki/کتاب | `content/anki-*`، `content/markdown/books` | کارت نمونه؛ کتاب با `rights_status: licensed` | فعلاً مصرف محصولی ندارند |

## ۲. جدول نگاشت: مدل فعلی ← موجودیت هدف (بخش ۶٫۲)

| موجودیت هدف | پوشش فعلی | فاصلهٔ اصلی برای DATA-02 | نگاشت پیشنهادی |
|---|---|---|---|
| Source | sources داخل بستهٔ درس (kind=concept_reference، checkedOn) | هش نسخه، مجوز دسته‌ای، ناشر رسمی | هر `source.id` → `source_id` با حفظ شناسه؛ فیلدهای جدید اختیاری با مقدار پیش‌فرض `unknown` |
| ExamProgram / Booklet | فیلدهای پراکنده `examYear/bookletCode` در بانک | جدول مستقل، نوبت، فرم، سند کلید، تاریخ نسخه | رخدادها با کلید ترکیبی (سال، نوبت، فرم، شماره) یکتا شوند؛ `bookletCode` فعلی به فرم نگاشت و ثبت می‌شود |
| Question / QuestionVersion | id مسطح بدون نسخه | نسخه‌بندی، زبان، قالب، سطح دشواری نسخه‌دار | `id` فعلی → `question_id` + `question_version:1`؛ ویرایش بعدی نسخهٔ ۲ با نگاشت، بدون بازیافت id (AT-18) |
| QuestionAppearance | `bookletCode + bookletQuestionNumber` داخل سؤال | جدول رخداد مستقل؛ چند ظهور برای یک سؤال | استخراج به جدول رخداد؛ کلید ترکیبی یکتا (AT-19) |
| Course/Topic/Skill | topics بستهٔ درس + syllabus-nodes + skills | والد، نسخهٔ رده‌بندی، چرخهٔ پیش‌نیاز | نگاشت ۱:۱ با حفظ id؛ اعتبارسنج چرخهٔ پیش‌نیاز در DATA-02 |
| BookEdition / Section | فقط `content/markdown/books` (rights_status, isbn) | چاپ‌ها جدا، صفحهٔ چاپی/PDF، لنگر | هر چاپ رکورد جدا؛ محل فقط با شاهد ثبت شود (AT-03) |
| LearningUnit / Block | `readingBlock {type,index}` در سؤال تألیفی | واحد نسخه‌دار، پیش‌نیاز، ارجاع پایدار | بند فعلی → `block_id` پایدار (course.topic.unit.block)؛ نشانی قدیمی با نگاشت نسخه هدایت شود |
| QuestionTopic | `sourceNodeId` (تاریخی) / `topicId` (تألیفی) | مفهوم اصلی/فرعی، شاهد، بازبین | در نسخهٔ اول فقط **یک مبحث اصلی**؛ فرعی‌ها فیلد اختیاری |
| ReadingLink / OptionErrorTag | `optionReasons[4]` تألیفی | لینک به واحد/بند + اولویت + تأیید | از optionReasons استخراج؛ مقصد عمومی ≠ مقصد گزینه |
| VariantGroup | پشتیبانی موتور/اعتبارسنج؛ **۰ رکورد در داده** | گروه‌بندی کارشناسی | فیلد اختیاری می‌ماند؛ ثبت فقط با تصمیم بازبین (AT-06) |
| ImportBatch / ReviewDecision | source-audit.json (دستی) | هش فایل، ابزار، زمان، فرد بازبین | ساختار batch/decision برای SRC-03 |
| ExamBlueprint/Session/Response | exam_sessions/items/responses (0012) + بستن 0017/0018 | snapshot بانک، seed، نسخهٔ سیاست | ستون‌های snapshot/seed به طرح DATA-02 اضافه شود |
| CoverageRecord | پراکنده در recurrence.json | دامنهٔ مورد انتظار و مخرج | جدول/فایل پوشش با مخرج صریح برای SRC-05 |

## ۳. قواعد مهاجرت افزایشی (برای DATA-03)

1. خواندن دادهٔ قدیمی حفظ شود؛ انتشار با پرچم قابلیت.
2. تبدیل dry-run روی کپی: تطبیق شمارش (۱۶۸ شناسه، ۱۳۹+۲۹، ۱۰۱/۳۸/۱۷)، کلید نمونه، روابط.
3. تبدیل تکراری رکورد اضافه نسازد (AT-04)؛ مقدار نامشخص خالی بماند، حدس ممنوع.
4. حذف مدل قدیمی فقط پس از اثبات مهاجرت، پشتیبان و طرح بازگشت.
5. فیلدهای تازه (`bookEdition`, `quality`, `session`, `form_code`, …) در JSON فعلی نیستند و تا DATA-02 الزامی نمی‌شوند.
