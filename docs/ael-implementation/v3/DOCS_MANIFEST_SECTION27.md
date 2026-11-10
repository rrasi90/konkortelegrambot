# مانیفست مستندات — فهرست بخش ۲۷ سند مادر v3.0 (V3-060)

به‌روزرسانی: ۲۰۲۶-۱۱-۱۱ (مأموریت v4) · مرجع فهرست: `AEL_Agent_Execution_Prompt_FA_v3.0_MASTER.md` §27
(سند مادر در مخزن commit نشده — READING_MANIFEST.md این را صریحاً ثبت کرده؛ فهرست Deliverableها
از READING_MANIFEST و Ledger بازتولید شده است.)

قاعده §9.1 مأموریت: هر قابلیت باید وضعیت `implemented / partial / planned / blocked` داشته باشد؛
نوشتن سند به‌تنهایی `implemented` نیست — شاهد تست/مسیر اجرا لازم است.

| # | موضوع مستند | فایل | وضعیت مستند | وضعیت قابلیت (شاهد اجرا) |
|---|---|---|---|---|
| 1 | Core Architecture | `docs/architecture/CORE_PLATFORM_ARCHITECTURE_FA.md` | موجود (V3-010) | implemented — fixture عمومی V3-013 + E2E HD-05 |
| 2 | Exam Family Adapter Contract | `docs/architecture/EXAM_FAMILY_ADAPTER_CONTRACT_FA.md` | موجود (V3-011) | implemented — قرارداد در `packages/contracts/src/exam-family.ts` + اعتبارسنج‌ها (FX-04) |
| 3 | Exam Universe / Authority Registry | `docs/catalog/EXAM_UNIVERSE_REGISTER.csv` · `docs/catalog/EDUCATION_AND_EXAM_AUTHORITIES.csv` | موجود (V3-020/021، DONE_WITH_DEFAULT per HR-02) | partial — مقادیر reported؛ سند اولیه در دسترس نبود |
| 4 | Catalog schema / Source Registry / versioning | `docs/architecture/EXAM_MODEL_DATA_CONTRACT_FA.md` · `packages/contracts/src/ingestion.ts` · `docs/catalog/EXAM_UNIVERSE_REGISTER.csv` | موجود | partial — pipeline ورود آزمون idempotent (V3-026) باقی است |
| 5 | CandidateEducationHistory / Onboarding | — | **مفقود** | planned — V3-030/031 (مدل در `packages/contracts` غایب؛ OnboardModal هنوز ثابت) |
| 6 | ExamIntent / Registration / multi-target | `packages/contracts/src/exam-selection.ts` (purpose/eligibility) | partial (سند جدا ندارد) | partial — مدل لایهٔ قرارداد پیاده؛ اتصال UI باقی است (V3-032) |
| 7 | Question canonical model / authoring / moderation / dispute | `packages/contracts/src/index.ts` (مدل flat Question) · `docs/governance/CONTRIBUTING_AND_QUESTION_AUTHORING_FA.md` (V3-061) | راهنما موجود؛ سند مدل کامل **مفقود** | partial — Revision/AnswerKeyRevision جدا نشده؛ lifecycle API (V3-041..044) باقی است |
| 8 | Trust / AllowedUse / content lifecycle | `docs/governance/content-and-ai-governance.md` + راهنمای مشارکت §5 | موجود | partial — accessType عمومی هست؛ allowedUse تفکیک‌شده در Engine باقی است (V3-043) |
| 9 | Resolver / Planner / Scheduler / Unknown semantics | `docs/architecture/CORE_PLATFORM_ARCHITECTURE_FA.md` | موجود | implemented — `resolveCandidatePreparationPlan` + Unknown≠Zero (HD-04) با تست ماتریسی |
| 10 | API Contracts / auth / ownership | `docs/operations/QUESTION_ANSWER_KEY_SECURITY_FA.md` §auth | موجود (محدود به امنیت کلید) | partial — سند جامع API contracts باقی است |
| 11 | Security / Answer Key release gate | `docs/operations/QUESTION_ANSWER_KEY_SECURITY_FA.md` | موجود + بسته (R-036 CLOSED) | implemented — گارد سخت بدون استثنا + تست منفی canary + audit:offline |
| 12 | Offline behavior | `tools/offline/adapter.ts` (سرِ فایل) · QUESTION_ANSWER_KEY_SECURITY_FA §2026-11-11 | موجود (inline) | implemented — آفلاین فقط مطالعه؛ ۰ کلید؛ `audit:offline` در CI |
| 13 | Data ingestion / idempotency | `packages/contracts/src/ingestion.ts` · `supabase/migrations/0021_sources_ingestion.sql` | موجود | partial — pipeline کتاب/منبع پیاده؛ pipeline کاتالوگ آزمون (V3-026) باقی است |
| 14 | Coverage methodology | `docs/ael-implementation/v3/reports/` (ماتریس‌ها) · `packages/learning-engine/src/coverage-matrix.ts` | موجود | partial — ماتریس دوره‌ها پیاده؛ مخرج رسمی دفترچه (V3-027) باقی است |
| 15 | Migration / rollback | `docs/ael-implementation/v3/HUMAN_REQUIRED.md` (HR-04) | موجود (محدودیت ثبت شده) | blocked-partial — HR-04: تا Staging واقعی، فقط Proposal+Dry Run؛ Production ممنوع |
| 16 | Monitoring / observability | — | **مفقود** | planned — Worker فقط audit_logs؛ سند observability باقی است |
| 17 | Accessibility / UI standards | — | **مفقود** | planned — §10.2 مأموریت معیارها را تعیین کرده؛ سند + تست E2E باقی است |
| 18 | Staging/production deployment / rollback runbook | `docs/operations/` (فقط امنیت) | **مفقود** (runbook کامل) | partial — Worker deploy انجام‌شده با rollback reference در گزارش مأموریت v4؛ سند runbook باقی است |

## Gapهای مستند باقی‌مانده (خروجی این مانیفست)

- سندهای مفقود: ۵ (CandidateEducationHistory/Onboarding)، ۱۶ (Monitoring)، ۱۷ (Accessibility)، ۱۸ (Runbook کامل)، مدل canonical کامل سؤال
- سندهای موجود که متنشان از کد عقب‌اند: بازبینی متن CORE_PLATFORM/EXAM_FAMILY_ADAPTER پس از V3-031/041..044
- قید منبع: سند مادر v3.0 خودش در مخزن نیست (ثبت در READING_MANIFEST)؛ NEEDS_HUMAN برای انتشار آن
