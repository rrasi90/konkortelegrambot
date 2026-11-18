-- 0029_reminder_preferences.sql — ترجیح یادآور روزانه
-- ارسال واقعی در Cloudflare Cron انجام می‌شود؛ این جدول فقط تنظیم کاربر است.
-- زمان‌ها به وقت محلی کاربر ذخیره می‌شوند و last_sent_on برای جلوگیری از
-- ارسال تکراری در یک روز محلی است.

create table if not exists reminder_preferences (
  user_id uuid primary key references app_users(id) on delete cascade,
  enabled boolean not null default false,
  time_local text not null default '21:00',
  timezone text not null default 'Asia/Tehran',
  weekdays smallint[] not null default array[0,1,2,3,4,5,6],
  quiet_start text not null default '23:00',
  quiet_end text not null default '08:00',
  only_when_due boolean not null default false,
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reminder_preferences_enabled
  on reminder_preferences(enabled) where enabled = true;

do $$
begin
  execute 'alter table reminder_preferences enable row level security;';
end $$;
