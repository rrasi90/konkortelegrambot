# گزارش نهایی مأموریت AEL v5 — موج ۲: پیشبرد کامل پلن

تاریخ: ۲۰۲۶-۱۱-۱۱ · Branchهای: `mission/ael-v5-evidence-question-catalog-20261111` (PR #20) و `mission/ael-v5-wave2-engine-profile-catalog` (PR #22) و گزارش‌ها (PR #19/21)

## A. Executive Summary

- **نتیجه: PARTIAL_RELEASE_SAFE** — SHA شروع `6f7cee8` → SHA نهایی main: `256402e`
- PRهای merge‌شده در کل مأموریت v5: **#20** (reconcile + correctIndex + V3-040) و **#22** (wave-2: گراف/پروفایل/lifecycle/کاتالوگ) — باز: هیچ
- **همهٔ ۳۲ ردیف V3 اکنون وضعیت واقعی دارند: NOT_STARTED = ۰** — DONE ۱۳ / DONE_WITH_DEFAULT ۱۱ / PARTIAL ۸
- مهم‌ترین پیشرفت: پیاده‌سازی واقعی و تست‌شدهٔ چهار اولویت باقی (گراف، پروفایل، lifecycle، کاتالوگ) — ۴۷ تست جدید در این موج

## B. Source-of-Truth Reconciliation

- Ledger ۴۵ ردیف: V3 (۱۳ DONE، ۱۱ DONE_WITH_DEFAULT، ۸ PARTIAL) + FX ۵ DONE + HD ۸ DONE
- Gap Register ۱۹ ردیف: OPEN ۹ / CLOSED ۱۰ — status پاک enum + ستون resolution
- تست fail-closed reconcile (`ledger-gap-register.test.ts`) شمارش‌ها را enforce می‌کند

## C. Security R-036 / Offline — بدون تغییر از گزارش قبل (CLOSED با شاهد)
اسکن سه مقصد PASS؛ correctIndex قرارداد دودویی مستند + اسکنر ۰..۳؛ بدون Allowlist

## D. V3 Task Matrix — وضعیت نهایی (۳۲ ردیف)

| ردیف | وضعیت | شاهد تست |
|---|---|---|
| V3-001..003، 010..013، 050/051، 060، **052**، **030**، 040 | DONE (۱۱) | تست‌های v3 موجود |
| V3-020/021، 061، **022**، **024/025**، **032/033**، **042/043/044** | DONE_WITH_DEFAULT (۱۱) | داده/منبع reported (HR-02) یا wiring باقی |
| V3-053، 070، 071، **023**، **026**، **027**، **031**، **041** | PARTIAL (۸) | دامنهٔ باقی‌مانده دقیق در Ledger |
| — | NOT_STARTED: **۰** | — |

جزئیات جدید موج ۲ (همه با تست در `src/tests/v3/`):
- **V3-052** `prereq-graph.ts`: cycle detection یال‌های ترتیبی، dangling/self-loop/duplicate، fail-closed، proposal-only C-08 (۵ تست)
- **V3-030** `candidate-profile.ts`: چندسابقهٔ تحصیلی + حذف نرم/audit + currentEducation (۹ تست مشترک)
- **V3-032** eligibility نسخه‌دار: unknown≠ineligible، بدون داده needs_review، union مواد با unknown=null (مشترک)
- **V3-033** مهاجرت legacy **فقط proposal** (HR-04): arshad→master / phd→phd قطعی؛ بقیه unknown (مشترک)
- **V3-041..044** `question-lifecycle.ts`: ماشین‌حالت با role guard + reason الزامی، **تأیید دوگانه**، eligibility موتور (disputed→quarantine)، dispute با کلید **append-only** و شناسایی متأثران بدون افشای کلید (۱۱ تست)
- **V3-022..027** `exam-catalog.ts`: ضرایب Unknown≠Zero با scope اجباری، ingestion **idempotent** (quarantine)، پوشش مشاهده‌شده با مخرج قابل دفاع، نرمال‌سازی alias فارسی؛ AdmissionRoute از مدل canonical موجود (۸ تست)

## E–H. Catalog / Candidate / Lifecycle / Engine
- کاتالوگ: official_verified = **۰** (HR-02) — همهٔ داده‌های آزمون رسمی reported/unknown
- پروفایل: مدل و policy کامل؛ persist/API و UI wiring باقی (V3-031 PARTIAL)
- lifecycle: مدل+گارد کامل؛ endpointهای Worker باقی (PARTIAL/DONE_WITH_DEFAULT مستند)
- engine: هسته پاک؛ E2E کامل UI/Bot باقی (V3-070/071 PARTIAL)

## I. Open Gaps and Human Requirements
OPEN ۹: GAP-001/002/003/006/010/012/013/014/018 — نیازمندی‌های انسانی: سند رسمی سنجش (HR-02)، تعیین URL ادمین و میزبان PDF، ارتقای پلن برای branch protection (403 ثبت شد)

## J. CI and Deployment
- PR #20: run `42921684283`/`42922063210` ✓ · PR #22: run `42928225181`/`42928672338` ✓ (هر دو Job)
- تست نهایی: **۷۶۶/۷۶۶** (۷۲ فایل) — tsc ✓ — build:worker ✓ (پس از فیکس noUncheckedIndexedAccess)
- Deploy: لازم نبود (بدون تغییر worker/miniapp)؛ نسخهٔ مستقر معتبر — **dry-run ≠ deployment**

## K. Remaining Work
1. wiring Worker/UI: endpointهای lifecycle و profile، onboarding داده‌محور (V3-031/041)
2. V3-053 پاکسازی hardcode UI → V3-070 E2E کامل → V3-071 readiness gate
3. دادهٔ رسمی کاتالوگ پس از تأمین سند (HR-02) → ارتقای coverage به مخرج رسمی
4. GAP-013/014: تصمیم محصول ادمین/PDF

## L. Release Decision
**PARTIAL_RELEASE_SAFE** — مستقر امن (R-036 بسته، آفلاین بدون کلید، CI سبز روی آخرین SHA)؛ محصول کامل release-ready نیست: wiringهای مستندشده و دادهٔ رسمی باقی است.
