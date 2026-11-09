# Authored Question Policy — consolidation 20261107

**مأموریت:** AEL-HISTORICAL-EXAM-RECOVERY + library-10y-consolidation

## ۱. طبقه‌بندی منشأ سؤال (الزامی و صریح)

هر سؤال دقیقاً یکی از برچسب‌های `origin` زیر را دارد:

| origin | معنی | نمونه در repo |
|---|---|---|
| `official_exam` | سؤال واقعی دفترچهٔ رسمی با provenance کامل | `YEARLY_KONKOR_QUESTIONS` (۸۵ سؤال ارشد ۱۳۹۱-۱۴۰۵ با سال/کد دفترچه/شماره) |
| `authored_textbook` | تألیفی بر اساس فصل کتاب مشخص | `phdExpansionContent.ts` (۲۷ سؤال با sourceReference کتاب) |
| `authored_concept` | تألیفی برای سنجش یک مفهوم | اکثر `INITIAL_QUESTION_BANK` پایه |
| `authored_exam_style` | سبک کنکور اما غیررسمی | برخی سناریوهای تألیفی |
| `diagnostic` / `formative` / `proof` | نوع کاربرد سنجشی | `isDiagnosticProbe`، `isQuarantinedProof` flags |

**قاعدهٔ طلایی:** هیچ‌گاه `authored` با `official` در یک badge/filter جمع نمی‌شود. برچسب UI فارسی صریح: «تألیفی — منبع: کتاب X — سؤال کنکور نیست».

## ۲. شمارش واقعی فعلی (2026-11-07)

| دسته | تعداد | pending_sme | official |
|---|---|---|---|
| ارشد رسمی کنکور (yearlyKonkorExams) | 85 | 85 pending_sme | ✅ official (year/booklet/number دارند) |
| دکتری تألیفی expansion | 27 | 27 pending_sme | ❌ authored (sourceReference کتاب) |
| دکتری پایه (legacy) | 11 | 11 pending_sme | ❌ authored/تألیفی |
| ارشد پایه تألیفی | ~156 | pending_sme | ❌ authored |
| **جمع** | **~279** | **همه pending_sme** | **85 official** |

## ۳. قواعد الزامی

1. هیچ سؤال تألیفی به‌عنوان «سؤال کنکور» معرفی نمی‌شود (badge/filter جدا).
2. `verification_status: pending_sme` تا بازبینی متخصص مستقل — بدون آن هرگز `verified` نمی‌شود.
3. هر سؤال تألیفی باید `sourceReference` یا `sourceIds` داشته باشد (کتاب/فصل یا paper DOI).
4. `optionReasons` برای هر ۴ گزینه (علت درست/غلط) الزامی است — در پک expansion موجود است.
5. کلید و explanation در client bundle نشت نمی‌کند (PR #9 gate).
6. هیچ سؤالِ استخراج‌نشده از دفترچه به‌عنوان official برچسب نمی‌خورد؛ `unverified_provenance` یعنی سند اصلی باید بازیابی و تطبیق شود.
7. duplicate detection: `ael-question-dedup.mjs` با exact hash + fuzzy ≥0.92 اجرا شده (10 exact, 16 near) — همه `sme_required`.
