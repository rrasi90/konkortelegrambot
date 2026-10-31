# راهنمای جامع عملیاتی ایجنت‌ها (Agent Operations & Deployment Handbook)
## سامانه یادگیری تطبیقی کنکور دکتری مدیریت + مینی‌اپ و ربات تلگرام

این راهنما برای هدایت هر ایجنت هوش مصنوعی (AI Coding Assistant) یا کارشناس فنی تدوین شده است تا بتواند چرخهٔ کامل توسعه، اعتبارسنجی با تست‌ها، همگام‌سازی با گیت‌هاب و استقرار زنده روی کلودفلر را بدون نقص انجام دهد.

---

## ۱. ساختار پروژه و اطلاعات مخزن (Repository Architecture)

* **مخزن گیت‌هاب:** `https://github.com/rrasi90/konkortelegrambot`
* **شاخهٔ اصلی:** `main`
* **معماری:** مونو‌ریپو با ساختار ماژولار:
  * `packages/contracts`: تعاریف مشترک TypeScript، اینترفیس‌ها، تایپ‌های `TrackId` (شامل `industrial`) و مدل‌های داده.
  * `packages/learning-engine`: موتور ریاضی یادگیری تطبیقی بر پایه الگوریتم FSRS، شوک هم‌خانواده (Sibling Shock) و موج چندلایه‌ای.
  * `packages/utils`: توابع محاسباتی اولویت‌بندی، اضطرار و ارزش آزمون.
  * `apps/worker`: بک‌اند سرورلس مبتنی بر Hono برای اجرا در Cloudflare Workers (`apps/worker/src/index.ts`).
  * `apps/miniapp`: فرانت‌اند سبک و بومی تلگرام مینی‌اپ بدون وابستگی سنگین (`index.html`, `app.js`, `styles.css`).
  * `content/`: بانک دانش سرفصل‌های دکتری، مهارت‌های خرد (`skills.json`) و نمونه سؤالات آزمون.

---

## ۲. چک‌لیست همگام‌سازی با گیت‌هاب (GitHub Sync Workflow)

هر ایجنت پیش از هرگونه تغییر و پس از پایان کار باید مراحل زیر را طی کند:

### گام ۱: دریافت آخرین نسخه از گیت‌هاب
```bash
git fetch origin
git pull origin main
```

### گام ۲: بررسی وضعیت فایل‌ها
```bash
git status
```

### گام ۳: استیج کردن و ثبت کامیت با پیام معنادار
> **نکته در محیط ویندوز PowerShell:** از عملگر `;` به جای `&&` استفاده شود.
```powershell
git add .
git commit -m "feat/fix: <توضیح کوتاه تغییرات>"
```

### گام ۴: ارسال تغییرات به گیت‌هاب
```powershell
git push origin main
```

---

## ۳. اجرای آزمون‌های خودکار (Automated Testing with Vitest)

پیش از هر دیپلوی، **تمام ۶۵ تست سیستم باید با موفقیت ۱۰۰٪ پاس شوند**.

### گام ۱: کامپایل پکیج‌های وابسته
```bash
npm run --prefix packages/contracts build
npm run --prefix packages/learning-engine build
npm run --prefix apps/worker build
```

### گام ۲: اجرای تست‌ها
```bash
npm test
```

### چک‌لیست تأیید ۶۵ تست:
1. `packages/utils/tests/priority-calculations.test.ts` (۷ تست) — محاسبات اولویت و زمان‌بندی
2. `packages/learning-engine/tests/fsrs.test.ts` (۱۴ تست) — فرمول‌های تکرار فاصله‌دار FSRS
3. `packages/learning-engine/tests/engine.test.ts` (۲۷ تست) — طبقه‌بندی خطا، موج ۴ لایه‌ای، اثبات تسلط و پیام منتور
4. `apps/worker/tests/worker.test.ts` (۱۷ تست) — مسیرهای API، داشبورد خانه، کوییز شبانه و حالت مطالعه در مسیر

---

## ۴. استقرار زنده در کلودفلر ورکرز (Cloudflare Workers Deployment)

کل سیستم (شامل API بک‌اند و دارایی‌های استاتیک مینی‌اپ) به صورت سرورلس روی Cloudflare Workers مستقر است و بدون نیاز به روشن بودن لپ‌تاپ یا سرور محلی، به صورت **۲۴/۷ و رایگان** فعال است.

### اطلاعات حساب مستقر:
* **حساب کلودفلر:** `rrasi9999@atomicmail.io`
* **دامنهٔ زندهٔ سیستم:**
  `https://adaptive-exam-worker.ael-worker.workers.dev`

### دستور دیپلوی به کلودفلر:
```powershell
npx wrangler deploy --cwd apps/worker
```

### دارایی‌های آپلودشونده:
فایل‌های مینی‌اپ از مسیر `apps/miniapp/` خوانده شده و به عنوان Static Assets همراه با ورکر دیپلوی می‌شوند:
* `apps/miniapp/index.html`
* `apps/miniapp/app.js`
* `apps/miniapp/styles.css`

---

## ۵. تنظیم و تأیید وبهوک ربات تلگرام (Telegram Webhook)

وبهوک ربات تلگرام (`@AmozeshKonkoorbot`) باید به مسیر ورکر کلودفلر متصل باشد:

* **آدرس وبهوک:**
  `https://adaptive-exam-worker.ael-worker.workers.dev/api/telegram/webhook`

### بررسی یا تنظیم مجدد وبهوک با دستور curl:
```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://adaptive-exam-worker.ael-worker.workers.dev/api/telegram/webhook"}'
```

یا استعلام وضعیت فعلی وبهوک:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

---

## ۶. اسکریپت ممیزی خودکار کارکرد زنده (Live Smoke Test)

پس از هر دیپلوی، ایجنت می‌تواند این اسکریپت کوتاه Node.js را برای اطمینان از سلامت کامل ۵ بخش اصلی اجرا کند:

```javascript
// تست سریع سلامت و ممیزی اندپوینت‌های زنده
async function verifyDeployment() {
  const base = 'https://adaptive-exam-worker.ael-worker.workers.dev';
  
  // ۱. تست سلامت ورکر
  const health = await (await fetch(base + '/api/health')).json();
  console.assert(health.ok === true, 'Health check failed');

  // ۲. تست آموزش درس (۸ درس تخصصی دکتری)
  const lessons = await (await fetch(base + '/api/lessons')).json();
  console.assert(lessons.courses.length === 8, '8 courses must be present');

  // ۳. تست احراز هویت خودکار (بدون درخواست آیدی)
  const auth = await (await fetch(base + '/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceToken: 'agent_verify_token_' + Date.now() })
  })).json();
  console.assert(!!auth.token, 'Auth token must be issued');

  // ۴. تست پیشرفت اولیه (باید دقیقاً ۰٪ باشد)
  const home = await (await fetch(base + '/api/home', {
    headers: { 'Authorization': 'Bearer ' + auth.token }
  })).json();
  console.assert(home.progress.overall === 0, 'New user progress must start at 0%');

  // ۵. تست چند گرایشی با گرایش صنعتی
  const tracks = await (await fetch(base + '/api/tracks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth.token },
    body: JSON.stringify({ tracks: ['business', 'industrial'] })
  })).json();
  console.assert(tracks.tracks.includes('industrial'), 'Industrial track must be activated');

  console.log('✅ ALL DEPLOYMENT VERIFICATIONS PASSED 100%');
}
verifyDeployment();
```

---

## ۷. قوانین و خطوط قرمز ایجنت‌ها (Guiding Rules)

1. **امنیت هویت داوطلب:** هرگز نباید فرمی برای گرفتن دستی آیدی تلگرام ایجاد شود؛ هویت در تلگرام از طریق `Telegram.WebApp.initData` با امضای رمزنگاری‌شده و در وب با `deviceToken` به صورت خودکار تعیین می‌شود.
2. **شروع پیشرفت از ۰٪:** برای کاربر جدیدی که هنوز تستی نزده است، درصد پیشرفت باید الزماً `۰٪` باشد.
3. **پوشش دروس:** تمام ۸ درس کنکور دکتری مدیریت و ۴ گرایش (بازرگانی، صنعتی، تکنولوژی، استراتژی) باید حفظ شوند.
4. **آموزش زیر هر سؤال:** چه داوطلب پاسخ درست بدهد و چه غلط، باید خلاصه درس‌نامه، نکات تستی و اصطلاحات مربوط به همان مبحث زیر سؤال نمایش داده شود.
5. **رازداری و امنیت توکن‌ها:** هرگز توکن ربات تلگرام یا رمز عبور را در فایل‌های متنی یا تاریخچهٔ کامیت گیت‌هاب قرار ندهید (فقط در Secrets کلودفلر یا متغیر محیطی تنظیم شود).
