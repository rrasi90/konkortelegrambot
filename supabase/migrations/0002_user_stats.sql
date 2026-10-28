-- ۰۰۰۲: آمار و انگیزش کاربر (الهام از بنچمارک واژه‌راه)
-- سکه، روزهای پیوسته، شمارهٔ روز مطالعه و تاریخ کنکور روی خود app_users.
-- منطق به‌روزرسانی (streak/سکه) در worker است؛ این‌جا فقط اسکیماست.

alter table app_users add column if not exists coins int not null default 0;
alter table app_users add column if not exists streak_days int not null default 0;
alter table app_users add column if not exists last_study_date date;
alter table app_users add column if not exists day_number int not null default 0;
alter table app_users add column if not exists exam_date date;
