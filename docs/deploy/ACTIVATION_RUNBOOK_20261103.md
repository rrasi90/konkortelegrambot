# ران‌بوک فعال‌سازی نسخهٔ جدید — ۱۴۰۴-۰۸-۱۲

این پرونده فقط کارهایی را ثبت می‌کند که **واقعاً** اجرا شده‌اند و آن‌ها را که منتظر ورودی
صاحب محصول هستند صریحاً باز می‌گذارد. **وضعیت امروز:** کد روی `main` merge و publish شد و
ورکر Cloudflare با نسخهٔ جدید deploy و روی دامنهٔ زنده راستی‌آزمایی شد (جدول ۲-ب). مراحل
مانده: اتصال Supabase + مهاجرت ۰۰۱۵ (گام ۱ و ۲) و تنظیم دکمهٔ تلگرام (گام ۴، نیازمند توکن).

## ۰) وضعیت فعلی (تأییدشده با دستور)

| بررسی | نتیجه | شاهد |
|---|---|---|
| merge + push روی `main` | انجام شد (`d3e640d..0939e20`) | خروجی `git push origin main` |
| معادل محلی شغل `quality` در CI | همه EXIT=0: typecheck، ۳۳۲ تست، parity harness، validate:content، build:worker، audit:miniapp | لاگ اجرای محلی |
| شغل `database` در CI (مهاجرت ۰۰۰۱→۰۰۱۵ + بذرها + ۱۶ بلوک یکپارچگی) | EXIT=0 روی دیتابیس تازه | `evidence/audit-20261102/db-integrity-0015.txt` |
| `wrangler deploy --dry-run` | EXIT=0 (۳ فایل asset، ۵۱۴KB/۹۷KB gzip) | لاگ dry-run |
| احراز هویت Wrangler | کاربر `rrasi9999@atomicmail.io`، حساب `e0e320fd8ff853ac94e64227c8bf7b7e`، سطح اجازه `workers (write)` | `wrangler whoami` |
| secretهای موجود روی Worker | `ADMIN_API_TOKEN`, `ALLOW_DEMO_AUTH`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | `wrangler secret list` |
| status مستقرشدهٔ Worker | آخرین deploy: ۲۰۲۶-۱۱-۰۲T۱۸:۴۳:۴۷Z | `wrangler deployments status` |
| وضعیت GitHub Actions از این محیط | **قابل بررسی نیست** — مخزن خصوصی است و `gh auth status` می‌گوید not logged in. نتیجهٔ CI از مرورگر یا با `gh auth login` بررسی می‌شود | پاسخ ۴۰۴ API بدون توکن |

## ۱) دو نقص پیکربندی که پیش از هر deploy باید روشن شوند

1. **ذخیره‌سازی دائمی متصل نیست.** `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` روی Worker وجود
   ندارند و `ENVIRONMENT=production` هم تنظیم نشده. طبق `apps/worker/src/index.ts` در این حالت
   اپ با `MemoryStore` بالا می‌آید: پیشرفت هر کاربر با هر deploy یا با ایزولیت تازه از بین می‌رود.
   به‌علاوه چون `isProduction` فعال نیست، گاردهای fail-closed (اجبار به Supabase، ممنوعیت
   `ALLOW_DEMO_AUTH`، حداقل طول `SESSION_SECRET`) اصلاً اجرا نمی‌شوند.
2. **`ALLOW_DEMO_AUTH` به‌عنوان secret روی محیط زنده تعریف شده است.** اگر مقدارش `true` باشد،
   مسیر `POST /api/auth/telegram` با `telegramUserId` خام (بدون امضای initData) پذیرفته می‌شود و
   چون شناسهٔ تلگرام حدس‌زدنی است، هر کسی می‌تواند وارد حساب دیگری شود. تا وقتی Supabase وصل
   نشده، این حالت عملاً «ورود بدون احراز هویت» است. **پیشنهاد: حذف این secret یا تنظیم روی `false`.**

به همین دلیل، deploy کردن نسخهٔ جدید روی تنظیمات فعلی، «فعال‌سازی» واقعی نیست و ما آن را
انجام ندادیم.

## ۲) ترتیب درست فعال‌سازی

### گام ۱ — مهاجرت ۰۰۱۵ روی دیتابیس واقعی (باید **قبل** از deploy اجرا شود)
کد تازه ستون‌های `app_users.streak_freeze_month` و `app_users.streak_freeze_granted` را می‌خواند
و می‌نویسد؛ نبودشان یعنی هر `POST /api/answers` با ۴۰۰/۵۰۰ (نقص A-01).

- روش پیشنهادی (کم‌ریسک‌ترین): محتوای `supabase/migrations/0015_audit_remediation.sql` را در
  **Supabase Dashboard → SQL Editor** اجرا کنید. این مهاجرت فقط افزودن ستون، پس‌گرفتن اجزای
  یک RPC منسوخ، یک policy خواندن-خودی و default privileges است و هیچ داده‌ای را پاک نمی‌کند.
- راستی‌آزمایی (همین کوئری را بعد از اجرا بزنید؛ هر دو باید `true`/`false` درست بدهند):

```sql
select
  (select count(*) from information_schema.columns
    where table_name='app_users' and column_name in ('streak_freeze_month','streak_freeze_granted')) = 2
    as columns_added,
  has_function_privilege('anon','submit_answer_atomic(uuid,text,integer,text,boolean,jsonb,jsonb,jsonb,jsonb)','EXECUTE')
    as anon_can_still_call_legacy_rpc;
```

انتظار: `columns_added = true` و `anon_can_still_call_legacy_rpc = false`.

اگر دسترسی SQL Editor ندارید، ورودی معادل از شما می‌گیریم: رشتهٔ اتصال مستقیم
(`postgres://…`) یا Supabase Personal Access Token برای CLI.

### گام ۲ — اتصال Worker به Supabase و بستن درب ورود دمو

```bash
cd apps/worker
npx wrangler secret put SUPABASE_URL              # مثال: https://<ref>.supabase.co
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ENVIRONMENT               # مقدار: production
npx wrangler secret delete ALLOW_DEMO_AUTH        # حذف درب دمو از محیط زنده
npx wrangler secret list                          # بررسی نهایی نام‌ها
```

نکته: با `ENVIRONMENT=production`، اگر `SESSION_SECRET` کوتاه‌تر از ۱۶ نویسه باشد یا Supabase
تعریف نباشد، ورکر **عمداً** بالا نمی‌آید (fail-closed). قبل از deploy طول آن را تأیید کنید.

### گام ۳ — build و deploy

```bash
npm run build:worker
npx --yes wrangler deploy --config apps/worker/wrangler.jsonc
```

راستی‌آزمایی پس از deploy (همه باید پاسخ معتبر بدهند، نه ۵۰۰):

```bash
WORKER=https://<worker-url>
curl -s $WORKER/api/health                      # {"ok":true}
curl -s -X POST $WORKER/api/auth/telegram -H 'content-type: application/json' \
     -d '{"telegramUserId":123}' -o /dev/null -w '%{http_code}\n'   # انتظار 401 (درب دمو بسته)
```

### گام ۴ — فعال‌سازی تلگرام (دکمهٔ منو و لینک مینی‌اپ)

`scripts/telegram-bot-service.mjs` با `TELEGRAM_BOT_TOKEN` کار می‌کند و `APP_URL` را به‌عنوان
لینک مینی‌اپ ست می‌کند. مقدار پیش‌فرض `APP_URL` در اسکریپت به GitHub Pages اشاره دارد که
**هم‌اکنون ۴۰۴ است و باندلش هم کلید پاسخ دارد**؛ پس باید روی URL ورکر تنظیم شود:

```bash
export TELEGRAM_BOT_TOKEN=<از پنل تلگرام، نه از secret ورکر استخراج نمی‌شود>
export APP_URL=https://<worker-url>/          # همان آدرس گام ۳
npm run bot
```

اگر وب‌هوک هم لازم است (پاسخ `/start` در ربات):

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<worker-url>/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

بدون `TELEGRAM_WEBHOOK_SECRET` ورکر مسیر وب‌هوک را عمداً ۵۰۳ می‌دهد (رفتار مستندشده).

## ۲-ب) آنچه **انجام شد** (همین تاریخ، با شاهد)

| مرحله | نتیجه | شاهد |
|---|---|---|
| merge + push به `main` | انجام شد (از `d3e640d` تا `b3b9d74`) | خروجی `git push origin main` |
| `wrangler deploy` (سه بار: نسخهٔ اول، رفع A-25، افزودن A-26) | EXIT=0؛ آخرین Version ID `16e3221c-90d5-46d0-9eb3-29f87da26a29` روی `https://adaptive-exam-worker.ael-worker.workers.dev` | لاگ deploy |
| سلامت زنده | `GET /api/health` → `{"ok":true}` با ۲۰۰ | `evidence/deploy-20261103/live-ui-checks.txt` |
| سرو نسخهٔ جدید مینی‌اپ | `/` شامل `id="view-app"` و `btn-relogin`؛ `app.js` شامل `el('btn-book-back')`، `el('btn-freeze-streak')`، `className = 'option'` و بدون onclick داده‌محور | `live-ui-checks.txt`، `live-app.js`، `live-root.html` |
| A-06 زنده | آیتم صف فاقد `trapNote`/`explanation`/`correctOption`/`ease`/`fsrs`/`timesSeen`/`userId`؛ کلیدهای کارت فقط `id,nodeId,cardType,questionId,trapCardId,isRepair,isProof` | `live-api-checks.txt`، `live-queue.json` |
| A-17 زنده | کاربر تازه: `progress = {"overall":null,"assessedNodes":0,"nodes":17}` | `live-home.json` |
| A-14 زنده | `PUT /api/tracks` با ورودی تکراری → `["common","business","technology","strategy","industrial"]`؛ `limit=5` → دقیقاً ۵ آیتم | `live-api-checks.txt` |
| A-28 | پیکربندی زنده قابل مشاهده شد: `GET /api/health/detail` بدون توکن `403` می‌دهد و نوع مخزن/هشدارها را report می‌کند (هیچ مقدار secret فاش نمی‌شود) | `rollback-drill-*.txt`، تست‌های A-28 |
| A-29 | مانور rollback دوجهته روی ورکر زنده (`b72fe023 → 16e3221c → b72fe023`) با مارکر + E2E کامل بعد از مانور (20/20) | `rollback-drill-1-back.txt`, `rollback-drill-2-forward.txt`, `e2e-production-post-drill.txt` |
| A-25/A-26/A-27 | شمارندهٔ نرخ در زنده اجرا می‌شود (`X-RateLimit-Remaining` کاهش می‌یابد)؛ اندازه‌گیری شد که محافظت per-isolate است: با burst ۱۲۰ درخواستی اولین ۴۲۹ در درخواست **#۶۱** با آستانهٔ ۳۰ ⇒ دو ایزولیت | `live-rate-limit-observable.txt`، `live-rate-limit-isolates.txt` |

## ۲-پ) دو مانعی که در اجرای خودِ کار پیدا شد (و حدس نزدیم)

1. **محدودکنندهٔ سراسری از این حساب قابل استقرار نیست.** رفع کامل A-27 به Durable Object نیاز
   دارد؛ `wrangler whoami` این مجوزها را دارد: `workers (write)`, `workers_kv (write)`,
   `workers_routes (write)`, `workers_scripts (write)`, `workers_tail (read)` — و
   `durable_objects` در فهرست مجوز **نیست**. KV هم ابزار درست این کار نیست (سقف تقریبی
   ۱ نوشتار در ثانیه برای هر کلید، در حالی که محدودکننده باید هر درخواست را بنویسد).
   بنابراین A-27 به‌صورت `BLOCKED (مجوز پلتفرم)` ثبت شد، نه «رفع‌شده».
2. **توکن‌ها در پوشهٔ پروژه پیدا نشدند.** جست‌وجوی محتوایی روی تمام درخت پروژه (به‌جز
   `node_modules/`, `.git/`, `dist/`, `.wrangler/`) هیچ رشته‌ای به شکل توکن ربات تلگرام و هیچ
   `SUPABASE_URL` واقعی پیدا نکرد؛ تنها فایل موجود `.env.example` با placeholder بود و
   `.env.local`/`.dev.vars` ساخته نشده‌اند (هر دو در `.gitignore`). جست‌وجو سپس روی
   `C:\Star`، `Desktop`، `Downloads` و `Documents` هم گسترش یافت؛ ۶ تطبیق ظاهری پیدا شد که
   با الگوی دقیق‌تر (`\d{8,10}:AA[A-Za-z0-9_-]{30,}`) همگی رد شدند: چند PDF بی‌ربط و یک
   فایل نمونه در `botocore`. پس گام‌های ۱، ۲ و ۴ بدون دریافت مقدار از شما قابل اجرا نیستند
   و ما چیزی را جعل یا حدس نزدیم.

## ۳) آنچه انجام **نشده** یا عمداً باز مانده

- **انتشار GitHub Pages:** شغل `deploy-pages.yml` روی `main` اجرا می‌شود و در گام
  `npm run audit:client-bundle` **معمولاً FAIL** است: باندل React هنوز ۱۸۵ بار `correctOption` و
  ۲۶ بار `correctIndex` دارد (نقص ثبت‌شدهٔ R-036). این درِ امنیتی عمدی است؛ قرمز بودن آن شغل به
  معنای رگرسیون جدید نیست، و تا مهاجرت رابط React به مسیرهای احرازشدهٔ ورکر (R-025) نباید رد شود.
  **گذراندن آن با `--no-verify` یا حذف گام ممنوع است.**
- **اتصال Supabase و مهاجرت ۰۰۱۵:** انجام نشده. چون دیتابیس اصلاً وصل نبود، deploy انجام‌شده
  ریسک داده‌ای نداشت (نسخهٔ قبلی هم MemoryStore بود)، اما ماندگاری داده همچنان برقرار نیست و
  به‌عنوان RK-13 باز ثبت شده است.
- **بستن `ALLOW_DEMO_AUTH`:** با تأیید صریح صاحب محصول فعلاً باز ماند و به‌عنوان RK-12 (ریسک
  تصاحب حساب با شناسهٔ حدس‌زدنی) ثبت شد؛ بستنش مسیر ورود مرورگر معمولی را می‌بندد.
- **تنظیم دکمهٔ تلگرام:** انجام نشد چون `TELEGRAM_BOT_TOKEN` در این محیط موجود نیست و مقدار
  secret ورکر با wrangler خوانده نمی‌شود.

## ۴) ورودی‌هایی که برای ادامه لازم است

| ورودی | چرا لازم است |
|---|---|
| اجراي مهاجرت ۰۰۱۵ در SQL Editor **یا** رشتهٔ اتصال دیتابیس/توکن Supabase | بدون آن، ثبت پاسخ در محیط زنده می‌شکند (A-01) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | ماندگاری داده و فعال‌شدن گاردهای production |
| تأیید اینکه `ENVIRONMENT=production` ست شود و `ALLOW_DEMO_AUTH` حذف/`false` شود | بستن ورود حدس‌زدنی با شناسهٔ تلگرام |
| `TELEGRAM_BOT_TOKEN` + URL عمومی ورکر | تنظیم دکمهٔ منو/لینک مینی‌اپ و (در صورت نیاز) webhook |
| دسترسی `gh auth login` یا چک کردن Actions در مرورگر | تأیید سبز/قرمز بودن CI پس از merge |
