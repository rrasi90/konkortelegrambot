-- 0001_init.sql — اسکیمای اولیهٔ سامانهٔ یادگیری تطبیقی
-- PostgreSQL 15+ / Supabase
create extension if not exists pgcrypto;

-- سازگاری با PostgreSQL خام (خارج از Supabase):
-- اگر schema واقعی auth ساپ‌بیس موجود نباشد، یک جایگزین مینیمال می‌سازیم تا
-- policyهای auth.uid() قابل اعمال باشند. در Supabase واقعی این بلوک رد می‌شود.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    execute 'create schema auth';
    execute 'create function auth.uid() returns uuid language sql stable as ''select null::uuid''';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'create role service_role nologin';
  end if;
end
$$;

-- کاربران
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique,
  display_name text,
  active_tracks text[] not null default '{common}',
  daily_capacity int not null default 30,
  created_at timestamptz not null default now()
);

-- گره‌های دانش (فصل/مبحث هر درس)
create table if not exists knowledge_nodes (
  id text primary key,
  track text not null check (track in ('common','business','technology')),
  course text not null,
  chapter text not null,
  topic text not null,
  created_at timestamptz not null default now()
);

-- یال‌های وابستگی
create table if not exists node_dependencies (
  source_node_id text not null references knowledge_nodes(id) on delete cascade,
  target_node_id text not null references knowledge_nodes(id) on delete cascade,
  relation text not null check (relation in ('prerequisite','cross_course')),
  impact_weight numeric not null check (impact_weight between 0.2 and 0.6),
  primary key (source_node_id, target_node_id),
  constraint no_self_edge check (source_node_id <> target_node_id)
);

-- سؤال‌ها و کارت‌ها
create table if not exists questions (
  id text primary key,
  node_id text not null references knowledge_nodes(id) on delete cascade,
  exam_year int,
  question_text text not null,
  options jsonb not null,
  correct_option int not null,
  explanation text,
  trap_note text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','quarantined','demo')),
  created_at timestamptz not null default now()
);

-- رویداد خام پاسخ (تغییرناپذیر؛ idempotent با attempt_id)
create table if not exists answer_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  question_id text not null references questions(id),
  selected_option int not null,
  is_correct boolean not null,
  attempt_id text not null,
  answered_at timestamptz not null default now(),
  ripple_report jsonb,
  constraint unique_attempt unique (user_id, attempt_id)
);

-- تسلط کاربر بر هر گره
create table if not exists user_node_mastery (
  user_id uuid not null references app_users(id) on delete cascade,
  node_id text not null references knowledge_nodes(id) on delete cascade,
  mastery_score numeric not null default 50 check (mastery_score between 0 and 100),
  status text not null default 'learning' check (status in ('learning','weak','unstable','mastered')),
  last_error_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, node_id)
);

-- کارت دام تستی (برگرفته از trap_note سؤال)
create table if not exists trap_cards (
  id text primary key,
  question_id text not null unique references questions(id) on delete cascade,
  node_id text not null references knowledge_nodes(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- وضعیت مرور هر کاربر (کارت سؤال یا کارت دام)
create table if not exists review_cards (
  id text primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  node_id text not null references knowledge_nodes(id) on delete cascade,
  card_type text not null check (card_type in ('question','trap_note')),
  question_id text references questions(id) on delete cascade,
  trap_card_id text references trap_cards(id) on delete cascade,
  due_at timestamptz not null default now(),
  interval_days int not null default 1 check (interval_days >= 1),
  previous_interval_days int,
  ease numeric not null default 2.5 check (ease between 1.3 and 2.8),
  is_repair boolean not null default false,
  times_seen int not null default 0,
  times_correct int not null default 0,
  updated_at timestamptz not null default now(),
  constraint one_owner_per_question_card unique (user_id, question_id)
);
create index if not exists review_cards_due_idx on review_cards (user_id, due_at);

-- برنامهٔ روزانه (سقف بار مرور)
create table if not exists daily_plan (
  user_id uuid not null references app_users(id) on delete cascade,
  plan_date date not null,
  card_id text not null references review_cards(id) on delete cascade,
  added_reason text not null default 'scheduled' check (added_reason in ('scheduled','direct_reset','sibling_shock','prerequisite_repair','cross_course_bridge','trap_note')),
  added_at timestamptz not null default now(),
  primary key (user_id, plan_date, card_id)
);

-- به‌روزرسانی خودکار updated_at
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_mastery_touch on user_node_mastery;
create trigger trg_mastery_touch before update on user_node_mastery for each row execute function touch_updated_at();
drop trigger if exists trg_review_cards_touch on review_cards;
create trigger trg_review_cards_touch before update on review_cards for each row execute function touch_updated_at();

-- RLS: دفاع در عمق. سرویس با کلید نقش سرویس عبور می‌کند؛
-- مستقیماً از سمت کلاینت فقط خواندن عمومی محتوا مجاز است.
alter table app_users enable row level security;
alter table knowledge_nodes enable row level security;
alter table node_dependencies enable row level security;
alter table questions enable row level security;
alter table answer_events enable row level security;
alter table user_node_mastery enable row level security;
alter table trap_cards enable row level security;
alter table review_cards enable row level security;
alter table daily_plan enable row level security;

create policy read_nodes on knowledge_nodes for select using (true);
create policy read_deps on node_dependencies for select using (true);
create policy read_questions on questions for select using (verification_status in ('verified','demo'));
create policy read_own_answers on answer_events for select to authenticated using (auth.uid() = user_id);
create policy read_own_mastery on user_node_mastery for select to authenticated using (auth.uid() = user_id);
create policy read_own_cards on review_cards for select to authenticated using (auth.uid() = user_id);
create policy read_own_plan on daily_plan for select to authenticated using (auth.uid() = user_id);
-- trap_cards محتوای عمومی است (بدون user_id)؛ فقط خواندن عمومی
create policy read_trap_cards on trap_cards for select using (true);
