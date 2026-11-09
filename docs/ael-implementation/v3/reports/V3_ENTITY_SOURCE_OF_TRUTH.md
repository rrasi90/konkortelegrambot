# V3 Entity Source of Truth — نقشهٔ مالکیت منبع حقیقت

تاریخ: ۲۰۲۶-۱۱-۰۹ · base: `c4ceddf`

قاعده: هر مفهوم فقط یک canonical owner دارد. این سند بر پایهٔ V2-011 (T11_content_stores.md) و ممیزی زندهٔ همین اجرا نوشته شده است.

## ۱. جدول مالکیت

| مفهوم | Source of Truth | Derived / Cache | Legacy / Import | نکته |
|---|---|---|---|---|
| Education Registry (نهاد، مقطع، رشته، درس، سرفصل) | `packages/contracts/src/registry.ts` + `supabase/migrations/0019_education_registry.sql` | `content/registry/` (staging) | — | قرارداد TS مرجع؛ DB از migration |
| Exam Model (family/event/version/set/subject/combination/target/coefficient) | `packages/contracts/src/exam-model.ts` | `content/knowledge/exam-model.v1.json` (دادهٔ seed) | — | JSON دادهٔ مدل است نه کد؛ هر دو با هم جفت رسمی‌اند |
| ساختار آزمون legacy (شاخهٔ دکتری، ضرایب اعداد) | `packages/contracts/src/exam-structure.ts` | — | — | ثابت 1142/2162؛ فقط برای سازگاری قدیمی — منطق جدید باید از exam-model بخواند |
| Taxonomy/Tag/KnowledgeRelation | `packages/contracts/src/academic-foundation.ts` | `content/knowledge/academic-foundation.v1.json` | — | — |
| بانک سؤال رسمی (رسمی traced) | `content/questions/bank-*.json` | index تولیدی `question-metadata` | — | هویت سؤال از PR#13: Question/Appearance/Key جدا |
| محتوای تألیفی درس‌ها (LearningCourse) | `content/learning-courses/*.json` (۳ بسته) | seed ورکر، miniapp | — | همه pending_sme؛ سقف L5 |
| گراف دانش مدیریت | `content/knowledge/relations.jsonl` | — | — | جهت: source وابسته به target |
| Skills / syllabus-nodes / courses.json | `content/knowledge/` | `src/data/examStructure.ts` (mirror برای UI) | — | mirror با گیت `--check` به‌روزرسانی می‌شود |
| کلید پاسخ سؤال‌های رسمی | Worker (`apps/worker/src/`) | — | `src/data/comprehensiveCourseEncyclopedia.ts` (استثنای R-036) | GAP-004؛ باید server-delivered شود |
| پروفایل داوطلب / exam-selection | Worker store (`saveExamSelection`) | — | localStorage در React (آفلاین adapter) | هنوز current-education ندارد (GAP-002) |
| درس‌های تلگرام legacy | `apps/worker/src/lessons-data.ts` | — | legacy | فقط برای ربات قدیمی |
| دادهٔ فلش‌کارت | `src/data/flashcards*.ts` | تولیدی از importer | — | anki import جدید pending review |

## ۲. رجیستری‌های موازی شناسایی‌شده

1. **exam-structure.ts (legacy) در برابر exam-model.v1.json (جدید)** — دو منبع با دامنهٔ متفاوت؛ V2-031 parity را اندازه گرفت. قاعده: منطق جدید فقط از exam-model؛ exam-structure فقط legacy. Reconciliation در V2-031 انجام شد (C03_exam_parity.md).
2. **src/data/examStructure.ts** — mirror کلاینت از قرارداد؛ با validator گیت‌دار. Derived است، مرجع نیست.
3. **آفلاین adapter** — snapshot از دادهٔ زنده برای PWA؛ derived cache.

## ۳. موجودیت‌های بدون canonical owner (نیازمند تصمیم در این مأموریت)

| موجودیت | وضعیت | گشاینده |
|---|---|---|
| CandidateEducationHistory (سوابق چندمدرکی) | ندارد | V3-030 |
| ExamFamily registry (متادیتای خانواده‌ها: برگزارکننده، وضعیت) | فقط داخل exam-model.json به‌صورت ضمنی | V3-021 |
| Source Register رسمی (منابع آزمون‌ها با hash) | `content/sources/` نیمه‌کاره | V3-020 |
| Question contribution (کاربرساخته) | ندارد | QST-002/003 |
| Adapter registry خانواده‌ها | ندارد | V3-011 |

## ۴. قاعدهٔ اجرا برای این مأموریت

- هر موجودیت جدید فقط از طریق قرارداد موجود (`packages/contracts`) یا migration نسخه‌دار اضافه می‌شود.
- هیچ رجیستری موازی برای رشته/گرایش/درس/آزمون/سؤال ساخته نمی‌شود (بخش ۲٫۴ سند مادر).
- Derivedها با گیت `--check` تازگی سنجیده می‌شوند.
