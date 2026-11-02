-- 0009: سازگاری با PostgreSQL ساده (خارج از Supabase) — R-023
-- در Supabase، نقش‌های anon/authenticated به‌صورت پیش‌فرض USAGE روی schema public دارند؛
-- روی PostgreSQL خام این نقش‌ها ساخته می‌شوند (0001) اما هیچ دسترسی schema نمی‌گیرند،
-- در نتیجه `set role authenticated` + هر کوئری روی answer_events با
-- «relation does not exist» می‌شکند و شغل دیتابیس CI همیشه قرمز است.
-- این مهاجرت همان grant را idempotent اعمال می‌کند؛ در Supabase بی‌اثر/بی‌ضرر است
-- (grant تکراری خطا نمی‌دهد) و عملاً posture امنیتی را تغییر نمی‌دهد:
-- USAGE بدون SELECT روی جداول = هیچ دادهٔ جدیدی قابل‌خواندن نمی‌شود؛
-- دسترسی سطح جدول همچنان فقط grantهای migrationهای قبلی + RLS policyها هستند.

grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;
