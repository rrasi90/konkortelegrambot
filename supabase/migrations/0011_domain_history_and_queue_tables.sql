-- 0011_domain_history_and_queue_tables.sql — R-020 جداول دامنهٔ مفقود
-- exam_selections، mastery_history، audit_logs، daily_queue_items
-- نوشتن در این جداول از طریق Worker (service_role) انجام می‌شود؛
-- کاربر فقط rows خودش را می‌خواند (RLS).

-- ۱) انتخاب کنکور داوطلب (سال + زیرگروه + کد ترکیبی/مجموعه)
create table if not exists exam_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  exam_year int not null check (exam_year between 1390 and 1420),
  sub_group_id text not null,
  combination_code text,
  set_code text,
  is_active boolean not null default true,
  selected_at timestamptz not null default now(),
  constraint exam_selections_one_active_per_year unique (user_id, exam_year)
);
create index if not exists exam_selections_user_idx on exam_selections (user_id);

-- ۲) تاریخچهٔ تغییرات تسلط (append-only، سمت سرور با trigger)
create table if not exists mastery_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  node_id text not null references knowledge_nodes(id) on delete cascade,
  previous_score numeric,
  new_score numeric not null,
  previous_status text,
  new_status text not null,
  change_reason text not null default 'unknown' check
    (change_reason in ('answer_submit','ripple','repair','manual','backfill','unknown')),
  attempt_id text,
  recorded_at timestamptz not null default now()
);
create index if not exists mastery_history_user_time_idx on mastery_history (user_id, recorded_at);

create or replace function record_mastery_history() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into mastery_history (user_id, node_id, previous_score, new_score, previous_status, new_status, change_reason)
    values (new.user_id, new.node_id, null, new.mastery_score, null, new.status, 'backfill');
  elsif tg_op = 'UPDATE' and (new.mastery_score is distinct from old.mastery_score or new.status is distinct from old.status) then
    insert into mastery_history (user_id, node_id, previous_score, new_score, previous_status, new_status, change_reason)
    values (new.user_id, new.node_id, old.mastery_score, new.mastery_score, old.status, new.status, 'answer_submit');
  end if;
  return new;
end
$$;

drop trigger if exists trg_user_node_mastery_history on user_node_mastery;
create trigger trg_user_node_mastery_history
  after insert or update on user_node_mastery
  for each row execute function record_mastery_history();

-- ۳) گزارش رویدادهای حساس (auth، رد attempts، تغییر انتخاب کنکور)
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references app_users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  source_ip text,
  recorded_at timestamptz not null default now()
);
create index if not exists audit_logs_user_time_idx on audit_logs (user_id, recorded_at);

-- ۴) آیتم‌های صف روزانهٔ صادرشده (قابل ممیزی: چه چیزی، چرا، چه اولویتی)
create table if not exists daily_queue_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  queue_date text not null,
  attempt_id text not null unique,
  question_id text not null references questions(id) on delete cascade,
  node_id text references knowledge_nodes(id) on delete set null,
  reason text not null default 'scheduled' check
    (reason in ('scheduled','review','new_material','remedial','proof','night_quiz','exam_simulation','diagnostic')),
  priority numeric,
  status text not null default 'pending' check
    (status in ('pending','answered','skipped','expired')),
  created_at timestamptz not null default now()
);
create index if not exists daily_queue_items_user_date_idx on daily_queue_items (user_id, queue_date);

-- RLS: کاربر فقط rows خودش را می‌خواند؛ نوشتن فقط service_role (از لایهٔ worker)
alter table exam_selections enable row level security;
alter table mastery_history enable row level security;
alter table audit_logs enable row level security;
alter table daily_queue_items enable row level security;

drop policy if exists read_own_exam_selections on exam_selections;
create policy read_own_exam_selections on exam_selections for select to authenticated using (auth.uid() = user_id);
drop policy if exists read_own_mastery_history on mastery_history;
create policy read_own_mastery_history on mastery_history for select to authenticated using (auth.uid() = user_id);
drop policy if exists read_own_audit_logs on audit_logs;
create policy read_own_audit_logs on audit_logs for select to authenticated using (auth.uid() = user_id);
drop policy if exists read_own_daily_queue_items on daily_queue_items;
create policy read_own_daily_queue_items on daily_queue_items for select to authenticated using (auth.uid() = user_id);

grant select on exam_selections, mastery_history, audit_logs, daily_queue_items to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
