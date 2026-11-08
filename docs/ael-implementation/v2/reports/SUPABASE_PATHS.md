# نقشهٔ مسیر ذخیره‌سازی Supabase (بررسی کد، بدون اثر محیطی خارجی)

## هر نوع داده کجا خوانده/نوشته می‌شود

| داده | نوشتن | خواندن | منبع اصلی پیشرفت |
|---|---|---|---|
| Learner state / cards | Worker via SupabaseStore (service_role) | Worker + کپی React LocalStorage | Supabase primary؛ LocalStorage فقط fallback دستگاه |
| CloudStorage v4 | React client (snapshot) | React client | مکمل انتقال، جایگزین دائمی نیست |
| MemoryStore | Worker dev/test | همان | هیچ‌وقت primary نیست |

## مهاجرت‌ها

- فقط در مخزن: 0001..0026 روی main (اثبات اجرا با test:db FAIL در محیط مقصد جداست).
- فقط در PR15: 0027/0028 (هنوز main نیست).
- وضعیت «اجرا روی مقصد» را validator عام نمی‌شود؛ فقط اجرای test:db روی DB موقت اثبات است.

## تست‌ها

- test:db PASS محلی (INTEGRITY + BACKUP_RESTORE) — فایل SQL یا تست عام ≠ اثبات اتصال واقعی محصول.
- اتصال/قطع/تکراری/بازیابی: بدون محیط واقعی Supabase قابل آزمودن نیست؛ همان نیاز محیطی باز برای مجوز اجرا وجود دارد.
