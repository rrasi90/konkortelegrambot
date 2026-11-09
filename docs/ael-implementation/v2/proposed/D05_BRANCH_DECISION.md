# پیشنهاد تصمیم D-05 — ادغام شاخه‌ها (V2-015)

> وضعیت: PROPOSED — فقط پیشنهاد است؛ تصمیم نهایی مالک در OWNER_REPLIES.md ثبت می‌شود. ایجنت نباید این فایل را به‌عنوان απόφαση قطعی علامت بزند.

## پرسش دقیق

کدام استراتژی ادغام برای شاخه‌های موجود (T11_branches.md) به کار رود؟

## گزینه‌ها

- **الف (پیشنهاد موقت ایجنت، CI سبز):** ادغام ترتیبی با PR جداگانه، از مبنای origin/main.
- **ب:** ساخت شاخه یکپارچه از پایه علمی (بازگشت‌پذیری بیشتر، هزینه بیشتر).
- **پ:** آرشیو شاخه‌های رهاشده با تگ archive/* و بستن PRها بدون merge.

## دلایل پیشنهاد الف

1. معماری Main (packages/contracts + learning-engine + apps/worker، npm workspaces) با نسل قدیمی PR#1 (packages/domain/engine، apps/api-worker، pnpm) ناسازگار است و merge مستقیم ممنوع است (README_AGENT_MISSION بخش 3.2/3.3).
2. شاخه‌های مرتبط با PRهای ادغام‌شده #2/#5 تا #12 دیگر Commit منحصربه‌فرد ندارند و فقط پس از تأیید با git cherry / مقایسه blob قابل حذف‌اند.
3. هر PR فقط یک خوشه منطقی داشته باشد؛ CI کامل (npm ci، typecheck، vitest، DB integrity، worker build) سبز شود؛ سپس merge به main.
4. هیچ force-push و هیچ بایپس Branch Protection مجاز نیست؛ اگر Permission نباشد، وضعیت BLOCKED_BY_GITHUB_PERMISSION است.

## شرایط اجرای الف

- [ ] git fetch origin + ثبت SHA مرجع
- [ ] بررسی diff/cherry برای هر Branch پیش از archive
- [ ] PR مستقل per cluster + CI سبز (vs-final.txt)
- [ ] پس از merge، بررسی SHA جدید main و CI پس از ادغام

## چه چیزی را باز می‌کند

- V2-03A تا V2-03C (ادغام/آرشیو) — هر سه منوط به جواب در OWNER_REPLIES.md هستند و بدون آن اجرا نمی‌شوند.

## پاسخ لازم مالک

ثبت «الف» یا «ب» یا «پ» در OWNER_REPLIES.md. تا آن زمان پیش‌فرض «الف با شرط CI سبز» فقط در سطح پیشنهاد نگه داشته می‌شود و هیچ PR/merge انجام نمی‌شود.

مراجع: reports/T11_branches.md، HUMAN_REQUIRED.md (D-05)
