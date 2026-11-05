-- 0024_telegram_inbox_feedback.sql — مأموریت v2 (Phase 1 + 7 + ورود ادمین)
-- ریشهٔ دو پیام: ارسال مستقیم + پاسخ webhook با {method:sendMessage} (دو effect).
-- راه‌حل: Update Inbox پایدار (UNIQUE bot+update_id) + Reply Intent یکتا + Outbox اثر.
-- Exactly-once در مرز sendMessage ادعا نمی‌شود؛ در ابهام delivery_uncertain ثبت می‌شود.

-- ============ Update Inbox — Dedup پایدار سمت DB ============
create table if not exists telegram_updates (
  id bigint generated always as identity primary key,
  bot_id text not null default 'default',
  update_id bigint not null,
  chat_id bigint,
  sender_telegram_id bigint,
  is_edit boolean not null default false,
  kind text not null default 'message' check (kind in ('message','edited_message','callback_query','other')),
  payload_digest text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (bot_id, update_id)
);
create index if not exists idx_telegram_updates_received on telegram_updates(received_at);

-- ============ Reply Outbox — یک Intent منطقی به ازای Update ============
create table if not exists telegram_reply_effects (
  id bigint generated always as identity primary key,
  bot_id text not null default 'default',
  update_id bigint not null,
  intent_key text not null,               -- مثل start_welcome / fallback_help / admin_entry
  chat_id bigint not null,
  status text not null default 'pending' check (status in (
    'pending','sending','sent','retryable_rejected','failed_permanent','delivery_uncertain','cancelled')),
  attempts int not null default 0,
  telegram_message_id bigint,
  last_error text,
  retry_after_seconds int,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (bot_id, update_id, intent_key)
);
create index if not exists idx_reply_effects_status on telegram_reply_effects(status);

-- ============ ورود ادمین با کد ۱۰رقمی (Phase 3) ============
create table if not exists admin_login_attempts (
  id bigint generated always as identity primary key,
  telegram_user_id bigint not null,
  success boolean not null,
  attempted_at timestamptz not null default now(),
  correlation_id text
);
create index if not exists idx_admin_login_attempts on admin_login_attempts(telegram_user_id, attempted_at);

-- Launch Ticket: فقط Hash ذخیره می‌شود؛ عمر ۱۲۰ ثانیه؛ یک‌بارمصرف (سند ۹٫۵)
create table if not exists admin_launch_tickets (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  telegram_user_id bigint not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_session_id uuid,
  created_at timestamptz not null default now()
);

-- ============ Feedback Inbox (Phase 7) ============
create table if not exists feedback_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  telegram_user_id bigint,
  chat_id bigint,
  category text not null default 'general' check (category in (
    'general','question_report','content_issue','technical','suggestion')),
  severity text not null default 'normal' check (severity in ('low','normal','high','critical')),
  status text not null default 'new' check (status in (
    'new','triaged','in_progress','waiting_for_user','answered','resolved','closed','rejected')),
  related_entity_type text,
  related_entity_id text,
  assignee text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_feedback_threads_status on feedback_threads(status);

create table if not exists feedback_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references feedback_threads(id) on delete cascade,
  author_kind text not null check (author_kind in ('user','admin')),
  author_id text,
  body text not null,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ RLS: Default Deny برای anon ============
do $$
declare t text;
begin
  foreach t in array array[
    'telegram_updates','telegram_reply_effects','admin_login_attempts',
    'admin_launch_tickets','feedback_threads','feedback_messages'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;
