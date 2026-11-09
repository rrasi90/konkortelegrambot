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
