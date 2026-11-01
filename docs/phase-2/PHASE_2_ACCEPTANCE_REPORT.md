# PHASE 2 ACCEPTANCE REPORT — Scientific Content & Assessment Repository

- **PHASE:** 2 — Scientific content & assessment repository
- **START_COMMIT:** `a49f3c9` (Phase 1 close)
- **END_COMMIT:** این کامیت (`fix/mission-remediation-20261101`)
- **BRANCH:** `fix/mission-remediation-20261101` (بدون merge به main — طبق قاعده، نیازمند تأیید صریح مالک)

## §1 DELIVERABLES (همه در مخزن، قابل بازرسی)
| فایل | نقش |
|---|---|
| `scripts/build-question-bank.mts` | سازنده بانک استاندارد، لایه‌بندی + dedup محتوایی + حل کد دفترچه |
| `content/questions/bank-official_traced_phd.json` (38) | آیتم‌های دکتری traced، `transcribed_pending_key_review` |
| `content/questions/bank-official_traced_arshad.json` (101) | آیتم‌های ارشد traced با کلید ارجاع‌دار |
| `content/questions/bank-quarantine.json` (17) | قرنطینه — سرو‌نشدنی |
| `docs/phase-2/QUESTION_BANK_SPECIFICATION.md` | قرارداد فیلدها/لایه‌ها/قواعد |
| `src/tests/questionBank.test.ts` (11 تست) | اجرای ماشین‌ی قواعد قرارداد |
| `docs/phase-2/QUESTION_SOURCE_AUDIT.csv` (156 سطر) | مماری منبع تک‌تک آیتم‌ها |
| `docs/phase-2/SUBJECT_COVERAGE_REPORT.csv` (9 سطر) | پوشش واقعی به‌ازای بخش/درس |
| `docs/phase-2/LESSON_QUALITY_REPORT.csv` (25 سطر) | کیفیت ساختاری درس‌نامه‌ها |
| `docs/phase-2/COPYRIGHT_AND_ATTRIBUTION_REGISTER.csv` (27 گروه منبع) | رجیستر مالکیت/ارجاع |
| `docs/phase-2/CONTENT_QUALITY_REPORT.md` | verdictهای داده‌محور جانشین چکلیست تیک‌خورده |
| `docs/phase-2/ITEM_ANALYSIS_REPORT.md` + بنر تصحیح در فایل ریشه | حذف آمار نمایشی (R-008) |
| `docs/phase-2/SME_REVIEW_REPORT.md` | ثبت صادقانه BLOCKED + صف بازبینی |
| به‌روزرسانی `docs/audit/REMEDIATION_REGISTER.md` | R-006/R-007/R-008 جابه‌جایی وضعیت؛ افزودن R-026/R-027 |

## §2 IMPLEMENTED
- بانک ۱۵۶ آیتمی یکتا از ۲۵۲ ورودی خام با تفکیک سخت سه‌لایه؛ ۹۶ تکراری ادغام‌شده با مقایسه محتوایی، ۰ تعارض.
- رفع دو نقص داده‌ای واقعی کشف‌شده در این فاز: نسبت‌دادن کد دفترچه ارشد به آیتم دکتری (R-027) و شناسه‌های تکراری (R-026، با mitigation).
- placeholderهای `phd-1405-001..003` از بانک بیرون؛ تست «نبود» دارد.
- `difficulty/cognitiveLevel` همه `unclassified` — هیچ پارامتر روان‌سنجی فرضی ثبت نشد.
- آیتم مؤلف‌ساخته (authored) علامت‌دار در داده موجود نبود → لایه authored عمداً ایجاد/ادعا نشد و در spec شفاف‌سازی شد.

## §3 TESTS_EXECUTED (raw outputs in `evidence/phase-2/`)
| فرمان | نتیجه |
|---|---|
| `npm run typecheck` | PASS (exit 0) |
| `npm test` | **140/140 PASS** (11 تست جدید بانک) — `questionbank-vitest.txt`, `gate-evidence.txt` |
| `node scripts/validate-phase-1-foundation.mjs` | PASS (بدون رگرسیون فاز ۱) |
| بازتولید بانک با `npx tsx scripts/build-question-bank.mts` | 38/101/17 = 156؛ شمارش‌ها با گزارش‌ها برابرمی‌کند |

## §4 DEFECTS_FOUND / FIXED
- R-027 کد دفترچه اشتباه روی ۱۱ آیتم دکتری → رفع + تست.
- R-026 شناسه‌های تکراری مبدأ → mitigation در بانک؛ پاک‌سازی مبدأ به فاز ۳ موکول.
- آمار illustrative در ITEM_ANALYSIS_REPORT ریشه → برچسب «fictitious» + سند جایگزین (R-008).

## §5 BLOCKED (صادقانه، بدون جعل)
- تأیید کلید رسمی دکتری: PDF سنجش 403 (R-005) → ۳۸ آیتم pending key review.
- بازبین SME انسانی: انجام‌نشده → همه `not_reviewed` (SME_REVIEW_REPORT).
- تحلیل CTT/IRT: بدون داده پاسخ کاربر → BLOCKED؛ صفر پارامتر فرضی.
- خلبان واقعی: بیرونی (R-012).

## §6 DEVIATIONS
- نگاشت `courseId` بانک best-effort است (۱۹/۱۵۶)؛ ۴۳ آیتم `unmapped` — در گزارش پوشش شفاف، نه پنهان.
- بایگانی `generatedAt` تنها فیلد non-deterministic بانک است.

## §7 GATE_DECISION: **PASS_WITH_EVIDENCE (scoped)**
Green با قلمرو صریح: زیرساخت بانک/مماری/کیفیت با تست‌های اجراشده اثبات شد؛ **صحت علمی محتوا (کلیدها، difficulty، SME verdict) اثبات‌نشده و BLOCKED ثبت شده است**. «content-validated» ادعا نمی‌شود.
