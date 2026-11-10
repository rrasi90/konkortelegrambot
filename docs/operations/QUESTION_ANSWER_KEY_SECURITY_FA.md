# امنیت تحویل سؤال و کلید پاسخ — وضعیت واقعی

به‌روزرسانی: ۲۰۲۶-۱۱-۱۰ (V3-Hardening B7) · مرجع قبلی: `docs/phase-5/CLIENT_ANSWER_KEY_RELEASE_GATE.md`

## ⛔ Security Blocker — R-036: باز است

**کلید پاسخ هنوز در باندل کلاینت React مینی‌اپ قابل دسترسی است** (۲۱۰ `correctOption` + ۲۵ `correctIndex` در `assets/index-*.js`). سبز بودن CI به معنی رفع این مشکل **نیست** — ممیزی `audit:miniapp` با چشم‌پوشی محدود و مستند (رفتار گیت R-036) می‌گذرد و پس از R-025 سخت می‌شود.

**پروژه آمادهٔ انتشار اعلام نمی‌شود تا R-025 کامل شود.**

## مسیر کامل تحویل (ممیزی‌شده در B7)

| مرحله | وضعیت | شاهد |
|---|---|---|
| DB/Store → API: تحویل سؤال | ✅ تمیز | `toPublicQuestion` کلید را حذف می‌کند (`apps/worker/src/index.ts:87`) |
| API: صف روزانه (`GET /api/queue`) | ✅ تمیز | تست اسکن خام: `apps/worker/tests/question-key-delivery.test.ts` |
| API: کوییز شبانه (`GET /api/night-quiz`) | ✅ تمیز | همان تست؛ قبل و بعد از پاسخ غلط |
| API: شروع مسیر یادگیری | ✅ تمیز | همان تست |
| API: افشای کلید پس از submit | ✅ فقط برای همان سؤالِ پاسخ‌داده‌شده | `wasCorrect` + `correctOption` در پاسخ answer |
| API: replay سؤالِ پاسخ‌داده‌شده | ✅ کلید همراه نتیجهٔ ثبت‌شده | تست‌های موجود + B7 |
| **Bundle کلاینت React** | ⛅ **نقض مستند R-036** | ۲۱۰ کلید؛ گیت با چشم‌پوشی محدود می‌گذرد |

## تست‌های این گیت

1. `apps/worker/tests/question-key-delivery.test.ts` — اسکن رشته‌ای خامِ پاسخ‌های API (۴ تست): هیچ پاسخ پیش از submit فیلد کلیدی ندارد؛ کلید فقط پس از ثبت پاسخ همان سؤال.
2. `apps/worker/tests/audit-fixes.test.ts` / `exam-simulation.test.ts` — assertهای نقطه‌ای موجود (بدون تضعیف).
3. `scripts/audit-client-bundle.ts` — گیت باندل با ردپای R-036 مستند؛ هر نشتی دیگری مطلقاً رد می‌شود.

## مسیر بستن R-036 (بدون دور زدن)

1. تحویل سؤال از Worker با `toPublicQuestion` (قبلاً موجود).
2. حذف `correctOption/correctIndex/explanation/trapNote` از داده‌های `src/data/*` که وارد باندل miniapp می‌شوند — یا انتقال آن بانک‌ها به مسیر API-only.
3. تصحیح سمت سرور از طریق `submitLearningAnswerAtomic` (موجود).
4. حذف چشم‌پوشی R-036 از `audit-client-bundle.ts` و بازگشت گیت به حالت سخت.
5. اجرای مجدد ممیزی + CI تا سبز واقعی بدون استثنا.

این کار یک PR مستقل امنیتی است (تغییر معماری تحویل سؤال در React miniapp) — در همین PR انجام نمی‌شود.

---

## به‌روزرسانی ۲۰۲۶-۱۱-۱۰ (مأموریت مستقل R-036 remediation — شاخهٔ `security/answer-key-server-only-delivery`)

### اقدام اجرا شده (گام ۱ از R-025 — زیرساخت server-only delivery)

| مؤلفه | وضعیت | شاهد |
|---|---|---|
| رجیستری کلید سمت سرور | ✅ ساخته شد | `apps/worker/src/data/client-bank-keys.server.ts` (۲۱۲ رکورد = ۲۱۰ واقعی + ۲ canary)؛ مولد: `scripts/generate-answer-key-registry.mts`؛ sha256 در manifest |
| مصرف بلیت تلاش | ✅ در دو Store | `consumeAttemptTicket` در DataStore/MemoryStore/SupabaseStore |
| API تصحیح سمت سرور | ✅ سه endpoint | `POST /api/practice/attempts`، `POST /api/practice/answer`، `GET /api/practice/result` — ownership از بلیت، مصرف قبل از افشا، replay idempotent |
| تست‌های SEC | ✅ ۱۲ تست جدید | `apps/worker/tests/practice-answer-security.test.ts` (SEC-001..010 بخش API) + `src/tests/v3/server-key-registry-guard.test.ts` |
| اسکن Canary باندل | ✅ PASS روی باندل مستقر فعلی | `scripts/scan-bundle-for-canary.mts` → «SEC-010 PASS: no server canary in 4 assets» — رجیستری سرور هرگز وارد کلاینت نشده |

### آنچه هنوز باقی است (شرط بستن R-036 — باز می‌ماند)

۱. **مصرف‌کنندهٔ کلاینت هنوز متصل نشده:** ۸ نمای React (`StudySessionView`، `YearlyKonkorExamView`، `SubjectDedicatedHubView`، `LessonsLibraryView`، `BookLibraryView`، `MistakeNotebookView`، `PlacementModal`، `App.tsx`) هنوز از تصحیح محلی با کلیدِ داخل باندل استفاده می‌کنند. اتصال این نماها به سه endpoint جدید + حذف فیلدهای کلید از بانک‌های `src/data/*` (تبدیل به public-only) گام بعدی است و نیازمند بازنویسی async مسیر پاسخ در همهٔ نماهاست.
۲. استثنای R-036 در `audit-client-bundle.ts` تا زمان صفرشدن افشای باندل باقی می‌ماند (حذف زودهنگام = شکست CI بدون رفع علت).
۳. تصمیم محصول برای حالت offline (`build:offline`): بدون سرور، تصحیح ممکن نیست — نیازمند تصمیم مالک (degradedpractice بدون grading یا حذف offline).

### شمار افشا قبل/بعد این مأموریت

- قبل: ۲۱۰ correctOption + ۲۵ correctIndex در باندل مستقر (بدون هیچ زیرساخت server-only برای بانک کلاینت)
- بعد: باندل تغییر نداده (۲۱۰+۲۵ — رفع در گام ۲ انجام می‌شود) اما **زیرساخت کامل تصحیح سرور-محور + پوشش تستی SEC آماده است** و رجیستری سرور با Canary اثبات‌شده خارج از باندل است.

---

## به‌روزرسانی ۲۰۲۶-۱۱-۱۱ (مأموریت v4 — بستن R-036 و سخت‌سازی گیت)

### R-036: ✅ CLOSED — با شاهد

| گام | وضعیت | شاهد |
|---|---|---|
| گام ۱ — زیرساخت server-only | ✅ | رجیستری ۲۳۷کلیدی + ۳ endpoint + consumeAttemptTicket + ۱۲ تست SEC (کامیت‌های 2180065..03a7b3d، PR #17) |
| گام ۲ — حذف کلید از بانک‌های کلاینت | ✅ | `scripts/strip-client-bank-keys.mts`: ۱۰۰۴ خط کلید از ۵ بانک حذف شد (کامیت 5aa8c1f، merge fa9251c) |
| گام ۲ — اتصال نماها به گریتینگ سرور | ✅ | App/StudySession/YearlyKonkor/SubjectHub/LessonsLibrary/BookLibrary/PlacementModal همه از `src/lib/serverGrading.ts` استفاده می‌کنند؛ دفتر خطا فقط از reveal سرور پر می‌شود (`reveal?.correctOption ?? -1`) |
| گام ۲ — Bundle مستقر | ✅ | بازسازی باندل `apps/miniapp` (کامیت 65c72d5): ۰ کلید داده‌ای — شمارش `correctOption:<digit>` از ۲۱۰ به **۰** |
| گام ۳ — حذف استثنای Audit | ✅ | `knownR036Footprint` کاملاً حذف شد؛ گارد سخت: هر یافته = شکست (این کامیت) |
| گام ۳ — الگوهای مقدار-محور | ✅ | الگوهای جدید: solutionIndex، isCorrect:true/false لفظی، مقدارهای CANARY-R036، ارجاع `client-bank-keys` |
| گام ۳ — تست منفی/مثبت canary | ✅ | `src/tests/clientBundleSecurity.test.ts`: تزریق عمدی canary → Fail؛ باندل تمیز با نام تایپ عمومی → Pass (۱۱ تست) |
| گام ۳ — Offline | ✅ | بازنویسی کامل: Projection عمومی بدون کلید در Build (`tools/offline/offline-payload.ts` + plugin esbuild)، حذف `gradeFormativeAnswer/gradeFormativeQuiz` از آداپتور، UI «مطالعه و مرور — بدون تصحیح»، وضعیت `offline_unverified`، پشتیبان قدیمی با `unverified_legacy_result`؛ خروجی `AEL_OFFLINE.html`: **۰ کلید** (قبل: ۳۴ answerIndex)؛ `audit:offline` به CI اضافه شد |

### شمار افشا نهایی (اندازه‌گیری مستقیم روی خروجی Build)

- باندل Mini App (`apps/miniapp/assets/index-*.js`): ۰
- خروجی Offline (`tools/offline/AEL_OFFLINE.html`): ۰
- گارد Audit: بدون هیچ استثنا/Allowlist — PASS روی `audit:client-bundle`، `audit:miniapp`، `audit:offline`
- Canary منفی: تشخیص داده می‌شود؛ Canary مثبت: باندل تمیز Pass؛ هیچ Canary واقعی در Production نیست (SEC-010 PASS)

### منبع حقیقت نمایش‌ها

`MistakeEntry.correctOption/explanation/trapNote` فقط از نتیجهٔ سرور همان سؤالِ پاسخ‌داده‌شده پر می‌شود (`App.tsx → recordAnswerInNotebook`) و دفتر خطا صرفاً برای مرور است — هیچ مسیر Mastery/FSRS از آن تغذیه نمی‌شود.
