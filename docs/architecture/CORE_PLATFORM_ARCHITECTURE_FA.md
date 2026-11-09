# معماری هستهٔ مرکزی AEL — یک هسته، چند خانوادهٔ آزمون

> وضعیت: `implemented-partial` — نقشهٔ معماری بر پایهٔ ماژول‌های واقعی روی main (SHA `c4ceddf`)؛ موارد پیاده‌نشده صریحاً علامت خورده‌اند. این سند قابلیت برنامه‌ریزی‌شده را پیاده‌شده معرفی نمی‌کند.

تاریخ: ۲۰۲۶-۱۱-۰۹ · کار: V3-010

## ۱. اصل غیرقابل مذاکره

AEL یک هستهٔ مرکزی دارد. افزودن خانوادهٔ آزمون جدید باید با **داده و پیکربندی** انجام شود، نه با رجیستری/موتور/بانک سؤال جدید. Adapter فقط برای تفاوت واقعی قواعد مجاز است.

## ۲. ماژول‌های هسته — نگاشت به کد واقعی

| جزء هسته | ماژول واقعی | وضعیت | مسئولیت فعلی |
|---|---|---|---|
| قراردادها (Contracts) | `packages/contracts/src/` — registry.ts، exam-model.ts، exam-selection.ts، academic-foundation.ts، exam-structure.ts (legacy) | ✓ پیاده‌شده | انواع، اعتبارسنج‌ها، resolver چندهدف |
| Education Registry | registry.ts + `supabase/migrations/0019_education_registry.sql` | ✓ | نهاد/مقطع/رشته/درس/سرفصل |
| Exam Catalog / Resolver | `exam-model.ts` → `validateExamModelBundle`، `resolveCandidatePreparationPlan` | ✓ (دامنهٔ داده: فقط مدیریت) | resolve مواد، ضرایب، eligibility ضمنی |
| Candidate Profile | Worker store (`saveExamSelection`) + `exam-selection.ts` | ◐ ناقص | examYear/setCode/combinationCode؛ **بدون current-education** (GAP-002) |
| Learning Engine | `packages/learning-engine/src/` — fsrs، fsrs-policy، mastery (v2)، planner (v2)، scheduler (v2)، target-weights (v2)، readiness-copy (v2) | ✓ | مستقل از نام آزمون — verify شده با اسکن hardcode (V3-012) |
| Question Repository | قرارداد PR#13 (Question/Appearance/Key) + `content/questions/bank-*.json` + index | ◐ ناقص | بانک رسمی هست؛ **جریان سؤال کاربر غایب** (GAP-003) |
| Assessment | `exam-simulation.ts` + `formative-quiz.ts` + `multi-course-quiz.ts` | ✓ (دامنه: مدیریت) | ساختار/تعداد/نمره‌دهی از exam-structure |
| Content Authoring | `content/learning-courses/*.json` + linterهای v2 | ✓ (۳ بسته، pending_sme) | سقف L5 تا بازبینی علمی |
| Analytics / Coverage | `coverage-matrix.ts` + `scripts/v2/coverage-matrix.mjs` | ✓ | P1..P6 با مخرج رسمی |
| **Adapter Registry** | **وجود ندارد** | ✗ | V3-011 قراردادش را تعریف می‌کند |

## ۳. مرز Adapter

```
                        هسته (contracts + learning-engine + worker store)
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
  sanjesh-phd (فعال)            sanjesh-master (فعال)          family جدید = JSON فقط
  exam-model.v1.json            exam-model.v1.json             تا قاعدهٔ قابل‌انعطاف
  ۱۴۰۶/۲۱۶۲                     ۱۴۰۵/۱۱۴۲                     نباشد → Adapter کوچک
```

- دو خانوادهٔ فعلی **بدون Adapter اختصاصی** کار می‌کنند — همه از یک resolver عمومی می‌روند.
- قاعدهٔ آینده: هر قاعدهٔ خانواده که در resolver عمومی قابل بیان نیست (مثلاً ارزیابی چندمرحله‌ای پزشکی، نمرهٔ ترکیبی مصاحبه+کتبی) → Adapter در `ExamFamilyAdapter` (سند قرارداد: `EXAM_FAMILY_ADAPTER_CONTRACT_FA.md`).

## ۴. جریان دادهٔ افزودن خانوادهٔ جدید (هدف معماری)

1. ثبت ExamFamily/Authority در `EXAM_UNIVERSE_REGISTER.csv` (V3-021)
2. ثبت Event/Version با منابع و hash در source register (V3-020)
3. ورود مجموعه‌ها/مواد/اهداف/ضرایب به `content/knowledge/exam-model.vN.json` (نسخه‌دار — هرگز overwrite)
4. اجرای `validateExamModelBundle` + coverage
5. نگاشت مواد به Course یا `needs_mapping` (V3-025)
6. فقط در صورت قاعدهٔ خاص: Adapter کوچک نسخه‌دار
7. تست سازگاری + fixture عمومی (V3-013)

**ممنوع:** `if (examCode === '...')` در UI/موتور/API. وضعیت فعلی: به‌جز mirrorهای legacy و onboarding (V3-012)، هسته تمیز است.

## ۵. رابط‌ها (Surfaces) و ماتریس availability

| قابلیت | React | Mini App (worker) | Bot |
|---|---|---|---|
| onboarding سطح‌محور + جلالی | ✓ | ◐ (seed داخلی) | ✗ |
| انتخاب آزمون (exam-selection API) | ✓ | ✓ | ✗ |
| تمرین/فرمتیو | ✓ | ✓ | ✗ |
| شبیه‌ساز آزمون | ✓ | ✓ | ✗ |
| سؤال‌ساز کاربر | ✗ | ✗ | ✗ |

هر قابلیت در یک رابط به معنی وجود در بقیه نیست (بخش ۲۶٫۵).

## ۶. محدودیت‌های شواهد

- «تمیز بودن هسته» فقط با اسکن متنی (V3-012) تأیید شده، نه با اثبات اجرایی fixture — V3-013 آن را می‌بندد.
- دامنهٔ دادهٔ کاتالوگ فعلی فقط مدیریت است؛ عمومی‌بودن معماری با دادهٔ واقعی خانوادهٔ دوم آزموده نشده (HR-01).
