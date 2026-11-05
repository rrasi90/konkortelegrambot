# ریشه‌یابی قطعی پیام تکراری تلگرام — `AEL-ADMIN-EDU-CATALOG-002` Phase 1

## فرمان موردنظر
از Handler کد: تنها فرمانی که پاسخ اختصاصی دارد **`/start`** است (`apps/worker/src/index.ts`، مسیر `POST /api/telegram/webhook`). `/stats` وجود ندارد. سرویس polling جدا (`scripts/telegram-bot-service.mjs`) هم به `/start` پاسخ می‌دهد.

## ریشهٔ قطعی دو پیام (Evidence از کد)
Handler قدیمی برای هر Update **دو ارسال مستقل** انجام می‌داد:

1. `fetch('https://api.telegram.org/bot…/sendMessage', …)` — ارسال مستقیم از درون Worker.
2. بدنهٔ پاسخ HTTP به Webhook: `c.json({ method: 'sendMessage', chat_id, text, reply_markup })`.

طبق Telegram Bot API، تلگرام اگر بدنهٔ پاسخ webhook یک JSON با `method` معتبر باشد آن را **اجرا می‌کند** (Webhook responses). نتیجه: هر `/start` = ۲ پیام قطعی و تکرارپذیر. این دو effect در کد قدیمی هم‌زمان و بدون شرط بودند.

## علل ثانویه (بررسی و نتیجه)
- **Polling موازی:** سرویس `telegram-bot-service.mjs` با `getUpdates` کار می‌کند و برای این کار **webhook را حذف می‌کند** (خط ۲۹) → دو مسیر توسط طراحی انحصاری‌اند؛ تا وقتی هر دو فعال نشوند علت مستقل نیست. ریسک پیکربندی نادرست = TG-06 (در Health بررسی می‌شود).
- **Retry تلگرام:** Handler قدیمی حتی در شکستِ ارسال مستقیم، باز پاسخ `method:sendMessage` می‌داد → شکست اول + موفقیت دوم هم دو پیام می‌ساخت.
- **edited_message:** قدیمی برای ویرایش هم پاسخ کامل می‌فرستاد.

## رفع انجام‌شده
1. **یک مسیر ارسال:** بدنهٔ پاسخ Webhook فقط `{ok:true}` است؛ ارسال فقط از `sendTelegram` داخلی.
2. **Inbox پایدار:** Migration `0024` — `telegram_updates` با `UNIQUE(bot_id, update_id)`؛ Update تکراری = فقط Ack بدون effect (TG-02/03 سمت DB، نه حافظه).
3. **Reply Intent یکتا:** `telegram_reply_effects` با `UNIQUE(bot_id, update_id, intent_key)` — هر Update فقط یک intent منطقی (`start_welcome`، `feedback_ack`، `admin_entry_*`).
4. **مدیریت ابهام:** 429 → `retryable_rejected` با `retry_after`؛ خطای 5xx/Timeout → `delivery_uncertain` بدون Retry کور؛ 4xx قطعی → `failed_permanent`.
5. **پیام ویرایش‌شده:** بدون پاسخ تازه.
6. **تست‌های Regression:** `apps/worker/tests/telegram-inbox.test.ts` — ۱۳ تست (TG-01..TG-12 قابل‌تست محلی + F-01).

## ادعای نهایی
Exactly-once مطلق در مرز `sendMessage` ادعا **نمی‌شود** (تلگرام idempotency key ندارد). تضمین‌شده: یک Update → یک intent منطقی → حداکثر یک ارسال با ثبت وضعیت قابل ممیزی.

## تست واقعی Runtime (HUMAN_REQUIRED)
تأیید روی Telegram واقعی نیازمند Bot Token فعال و امکان تست است — به‌عنوان HUMAN در گزارش نهایی ثبت شده است (سناریوی بخش ۲۰، بند ۱ و ۳۵-۳۶).
