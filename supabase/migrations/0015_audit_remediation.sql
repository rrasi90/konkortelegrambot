-- ۰۰۱۵: رفع نقص‌های یافت‌شده در ممیزی جامع ۱۴۰۴-۰۸-۱۱ (UI/منطق/موتور/داده)
-- این مهاجرت فقط چیزهای افزودهٔ ایمن است؛ هیچ دادهٔ موجودی پاک نمی‌شود.
--
-- ۱) ستون streak_freeze_month در کد Worker خوانده/نوشته می‌شد ولی هیچ مهاجرتی
--    آن را نمی‌ساخت. نتیجه روی Supabase: هر درخواست PostgREST با ۴۰۰ و هر ثبت
--    پاسخ با ۵۰۰ (پاسخ ذخیره می‌شد ولی کاربر خطا می‌دید).
-- ۲) RPC قدیمی submit_answer_atomic (مهاجرت ۰۰۰۳) هم‌چنان EXECUTE به PUBLIC و
--    authenticated داشت، security-definer است و p_user_id دلخواه می‌پذیرد؛
--    یعنی هر دارندهٔ anon key می‌توانست پاسخ/تسلط هر کاربری را جعل کند.
--    مسیر جایگزین و بلیت‌محور submit_answer_secure است (۰۰۱۰/۰۰۱۴) و هیچ کدی
--    دیگر از تابع قدیمی استفاده نمی‌کند.
-- ۳) app_users تنها جدول RLS-دار بدون هرگونه policy بود؛ grant موجود عملاً
--    هیچ ردی برنمی‌گرداند. policy خواندن-خودی اضافه می‌شود.
-- ۴) grant روی جدول‌های آینده: `grant all on all tables in schema public` فقط
--    جدول‌های زمانِ اجرای مهاجرت را پوشش می‌دهد، پس جدول جدید بعدی بدون grant
--    مجدد برای service_role قابل استفاده نخواهد بود.

-- ---------- ۱) ستون گمشده ----------
alter table app_users add column if not exists streak_freeze_month text;

comment on column app_users.streak_freeze_month is
  'شناسهٔ ماه (YYYY-MM) که آخرین انجماد زنجیره در آن مصرف شده است';

-- ---------- ۲) بستن راه‌فرار RPC قدیمی ----------
revoke all on function submit_answer_atomic(
  uuid, text, int, text, boolean, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;

-- فقط service_role (کلید سرویس سمت Worker) اجازهٔ اجرای اداری می‌ماند
grant execute on function submit_answer_atomic(
  uuid, text, int, text, boolean, jsonb, jsonb, jsonb, jsonb
) to service_role;

comment on function submit_answer_atomic(
  uuid, text, int, text, boolean, jsonb, jsonb, jsonb, jsonb
) is
  'منسوخ: بدون بررسی بلیت/مالکیت و با p_user_id دلخواه. مسیر عادی فقط submit_answer_secure است.';

-- ---------- ۳) policy خواندن-خودی برای app_users ----------
alter table app_users enable row level security;

drop policy if exists read_own_app_users on app_users;
create policy read_own_app_users on app_users
  for select to authenticated
  using (auth.uid() = id);

-- ---------- ۴) پوشش جدول‌ها/sequenceهای آینده ----------
-- اجرا به‌عنوان مالک اسکیما؛ برای objects بعد از این مهاجرت اعمال می‌شود.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
