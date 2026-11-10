# گزارش نهایی مأموریت AEL v5 — اصلاح شواهد، مدل سؤال و هستهٔ چندآزمونی

تاریخ: ۲۰۲۶-۱۱-۱۱ · Branch: `mission/ael-v5-evidence-question-catalog-20261111` · PR #20 (MERGED `f11ba33`)

## A. Executive Summary

- **نتیجه: PARTIAL_RELEASE_SAFE** (توضیح در بخش L)
- SHA شروع: `6f7cee8` → SHA نهایی main: `f11ba33` (+ کامیت گزارش)
- PR ساخته/ادغام‌شده: **#20** (سه PR منطقی در یک branch ترتیبی: PR-A/B/C) · باز: هیچ
- مهم‌ترین پیشرفت‌ها: (۱) مغایرت‌های شمارش گزارش v4 با parser استاندارد اصلاح و به تست enforce شد، (۲) semantics `correctIndex` تعیین تکلیف و اسکنر سخت‌تر شد، (۳) **V3-040 مدل canonical سؤال با validator و policy پیاده و DONE شد**
- ریسک‌های باز: کاتالوگ رسمی نیازمند منبع اولیه (NEEDS_HUMAN per HR-02)، lifecycle API و پروفایل داوطلب پیاده‌نشده

## B. Source-of-Truth Reconciliation

- **Ledger (۴۵ ردیف)**: V3 = DONE **۱۱** / DONE_WITH_DEFAULT **۳** / PARTIAL **۴** / NOT_STARTED **۱۴**؛ FX = ۵ DONE؛ HD = ۸ DONE
- **Gap Register (۱۹ ردیف)**: OPEN **۹** / CLOSED **۱۰**؛ status نرمال به enum و دلیل به ستون `resolution`
- اصلاحات گزارش v4: DONE 24→۲۳ (مخلوط با FX/HD)، NOT_STARTED 13→۱۵ (جاافتادن 040..044)، Gap OPEN 8→۹/CLOSED 15→۱۰؛ ثبت صریح V3-040؛ تفکیک نقش PR #18 (کد) از #19 (گزارش) — سند: `MISSION_V4_FINAL_REPORT_ADDENDUM.md`
- parser/validator/CLI: `scripts/ledger-gap-reconcile.mts`؛ تست enforce: `ledger-gap-register.test.ts` (۵ تست — شمارش‌ها fail-closed)

## C. Security R-036 / Offline

- **Audit scope**: سه مقصد واقعی (dist، apps/miniapp، tools/offline) پس از build تازه؛ خروجی خالی/نبود فایل = خطا؛ بدون Allowlist
- **correctIndex semantics**: قرارداد **دودویی** (conceptCheck دقیقاً ۲ گزینه — validator `aelEngine.ts:1643,1726-1728`)؛ اسکنر ۰..۳ به‌عنوان defense-in-depth با مستندسازی؛ خواندن خصوصیت معاف؛ تست ۰/۱/۲/۳
- تعداد تست‌های امنیتی: clientBundleSecurity **۱۲**، practice-answer-security + question-key-delivery + sec02-failclosed + auth **۲۷/۲۷** (re-run)
- اسکن artifacts: dist PASS · miniapp PASS (۰ کلید) · offline PASS (۰ کلید)
- CI evidence: run `42921684283` (PR، هر دو Job) و `42922063210` (main `f11ba33`)
- **محدودیت خارج از scope**: ادعای «۰ نشتی» فقط خروجی‌های قابل اسکن را می‌پوشاند؛ رجیستری کلید روی سرور باقی است؛ migration دیتابیس و مقاوم‌سازی CORS/cache جداگانه‌اند

## D. V3 Task Matrix (فقط تغییرات این سشن — بقیه طبق Ledger)

| Task | قبل | بعد | فایل/شاهد |
|---|---|---|---|
| V3-040 | NOT_STARTED | **DONE** | `packages/contracts/src/question-model.ts` + ۸ تست §5.4؛ commit در PR #20 |
| شمارش‌ها | (گزارش v4 نادرست) | تصحیح شد | addendum + تست reconcile |

بقیهٔ ۳۱ ردیف V3 بدون تغییر: 10 DONE قبلی + 3 DONE_WITH_DEFAULT + 4 PARTIAL (052/053/070/071) + 14 NOT_STARTED (022..027، 030..033، 041..044)

## E. Catalog and Provenance
بدون تغییر این سشن: official_verified = **۰**؛ همهٔ مقادیر رسمی reported/unknown (HR-02)؛ V3-022..027 باز — مانع: سند رسمی

## F. Candidate and Onboarding — NOT_STARTED (V3-030..033)
## G. Question Lifecycle — **V3-040 DONE** (مدل+validator+policy)؛ V3-041..044 باز (روی همین مدل)

## H. Learning Engine / E2E / Readiness
بدون تغییر: PARTIAL (052/053/070/071) — جزئیات در Ledger و گزارش v4

## I. Open Gaps and Human Requirements

| Gap | شدت | blocker | کمترین اقدام مالک |
|---|---|---|---|
| GAP-006/008-باقی‌مانده/010/012/013/014/018 + 001..003 | متوسط | سند رسمی یا تصمیم محصول | تأمین دفترچه رسمی / تعیین URL ادمین / میزبان PDF |
| V3-022..027 | بالا | HR-02 | تأمین منبع رسمی یا تأیید ادامه با reported |
| Branch protection | کم | پلن GitHub (403: Upgrade needed) | ارتقای پلن یا public کردن ریپو |

## J. CI and Deployment

- PR CI: [42921684283](https://github.com/rrasi90/konkortelegrambot/actions/runs/42921684283) — هر دو Job pass — **۷۳۳/۷۳۳** تست (۶۸ فایل)
- main CI پس از merge: [42922063210](https://github.com/rrasi90/konkortelegrambot/actions/runs/42922063210) — هر دو Job pass — SHA `f11ba33`
- Deploy: **لازم نبود** — هیچ فایل `apps/worker/src` یا `apps/miniapp` تغییر نکرد؛ نسخهٔ مستقر (`79510811-...`، باندل `index-CMfhsezy.js` ۰ کلید) معتبر می‌ماند. **dry-run ≠ deployment** — build verified only.
- Rollback reference: `1131f2f` (باندل قبلی اسکن‌شده) و نسخهٔ Worker مستقر فعلی

## K. Remaining Work (به ترتیب dependency)

1. **V3-022..027** — pipeline کاتالوگ + گزارش/fixture ریاضی reported (schema آماده‌یِ مصرف از V3-040 هست)
2. **V3-030..033** — CandidateEducationHistory + onboarding داده‌محور + eligibility + مهاجرت legacy
3. **V3-041..044** — lifecycle API روی مدل canonical تازه (authoring/moderation/trust/dispute)
4. **V3-052/053** — گراف typed با cycle detection + پاکسازی hardcode UI (وابسته به 031)
5. **V3-070/071 + GAP-010/012/013/014** — E2E کامل، readiness gate، admin/PDF

## L. Release Decision

**PARTIAL_RELEASE_SAFE** — نسخهٔ مستقر امن است (R-036 بسته با شاهد، آفلاین بدون کلید، CI سبز روی آخرین SHA، Worker/مینی‌اپ راستی‌آزمایی‌شده) اما «کل محصول کامل و release-ready» نیست: کاتالوگ رسمی (نیازمند منبع)، پروفایل داوطلب و lifecycle سؤال هنوز پیاده‌نشده‌اند و V3-070/071 کامل نشده‌اند. «بخشی امن مستقر شده» ≠ «کل محصول release-ready».
