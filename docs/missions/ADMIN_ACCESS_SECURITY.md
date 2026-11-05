# امنیت ورود ادمین (سند ۹ سند مأموریت)
- کد ۱۰رقمی به‌تنهایی مجوز نیست: فقط `admin_users` فعالِ دارای نقش وارد بررسی می‌شود (T-05).
- کد فقط در Private Chat (T-08)؛ نرمال‌سازی ارقام فارسی/عریی (T-09)؛ مقایسهٔ constant-time.
- کد = `ADMIN_ENTRY_CODE` env (Secret Store) — هرگز در کد/Seed/Log. Rotation = تغییر Secret + redeploy.
- Rate limit پایدار: ۵ تلاش ناموفق/۱۵ دقیقه از `admin_login_attempts` (DB، نه حافظه) (T-06).
- Launch Ticket: ۲۵۶ بیت تصادفی، فقط Hash در DB، ۱۲۰ ثانیه، یک‌بارمصرف (consume اتمیک)، پیوند با Telegram ID (T-10/11).
- Ticket فقط در URL **Fragment** (هرگز Query/Log)؛ پنل پس از خواندن History را پاک می‌کند.
- initData با HMAC رسمی تلگرام + `auth_date` ≤ ۱۰ دقیقه سمت سرور (T-12/13)؛ initDataUnsafe هرگز استفاده نمی‌شود.
- Session: توکن تصادفی، Hash در DB، ابطال با logout (T-15)؛ Revocation نقش = بلاک شدن فوری (RBAC هر درخواست).
- باز کردن پنل فقط از Inline Web App Button (initData دار) — Reply Keyboard web_app ممنوع (سند ۹٫۲).
