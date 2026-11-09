# ذخیره‌سازی پایدار مینی‌اپ (D10) — V2-092 — PROPOSED

> PROPOSED — چک‌لیست اتصال بدون اجرا؛ تا تأیید مالک هیچ اتصال Supabase در مینی‌اپ اعمال نمی‌شود.

## پرسش

پیکربندی اتصال Supabase برای مینی‌اپ چه زمانی انجام می‌شود و مهاجرت‌های لازم کدام‌اند؟

## چک‌لیست (هنوز اجرا نشده)

- [ ] بررسی مهاجرت‌های 0016-0018 روی محیط مقصد جداست (جدا از این Proposes)
- [ ] تعریف متغیرهای SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY در مقصد (بدون افشای secret در گیت)
- [ ] ENVIRONMENT=production در مقصد (ترد SEC-01/SEC-02) + ALLOW_DEMO_AUTH حذف از secretها
- [ ] Downgrade به MemoryStore در production ممنوع (SEC-01-F2)
- [ ] Telegram secret_token و Webhook تأیید (AGENT_INSTRUCTIONS بخش 5)
- [ ] تست منفی demo در production + smoke test پاسخ 200 برای /api/health

## وقتی

- تا زمان‌بندی مالک و تأیید امنیت (SEC-02) این چک‌لیست فقط نگه داشته می‌شود.
- None استدلال می‌کند که «در production» اتصال بی‌خطر می‌ماند.

## باز کردن

- انتشار مینی‌اپ با حافظه پایدار — منوط به تأیید مالک و CI سبز
