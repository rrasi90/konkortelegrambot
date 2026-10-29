-- supabase/migrations/0004_holdout_v2.sql -- Holdout mechanic v2 & Exam Pack foundation
-- Fact truth is exam_pack_questions, not the main questions table

-- 0. Ensure exam_packs and related base columns exist
create table if not exists exam_packs (
  id text primary key,
  name text not null,
  version text not null default '1.0.0',
  track text not null default 'common',
  syllabus_version text not null default '1.0.0',
  is_active boolean not null default true,
  status text not null default 'published' check (status in ('draft', 'review_required', 'approved', 'published', 'active', 'retired', 'blocked')),
  rights_status text not null default 'authorized',
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table questions add column if not exists exam_pack_id text references exam_packs(id) on delete set null;
alter table questions add column if not exists item_version text not null default '1.0';
alter table questions add column if not exists content_hash text;

-- 1. Table exam_pack_questions
create table if not exists exam_pack_questions (
  exam_pack_id text not null references exam_packs(id) on delete cascade,
  question_id text not null references questions(id) on delete cascade,
  item_version text not null default '1.0',
  is_holdout boolean not null default false,
  holdout_status text not null default 'inactive' check (holdout_status in ('inactive', 'active', 'retired')),
  restricted boolean not null default false check (restricted in (true, false)),
  usage_type text not null default 'practice' check (usage_type in ('practice', 'diagnostic', 'verification', 'proof', 'holdout', 'exam_simulation')),
  created_at timestamptz not null default now(),
  primary key (exam_pack_id, question_id)
);

-- 2. Policy function to enforce holdout only on active packs (PostgreSQL syntax)
create or replace function set_holdout_policy()
returns trigger as $$
begin
  -- Only allow holdout_status='active' when exam_pack is active
  if new.holdout_status = 'active' then
    if not exists (select 1 from exam_packs where id = new.exam_pack_id and is_active = true) then
      raise exception 'Cannot set holdout on inactive exam pack' using errcode = '45000';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_holdout_check on exam_pack_questions;
create trigger trg_holdout_check before insert or update on exam_pack_questions
  for each row execute function set_holdout_policy();

-- 3. View for querying active holdout context WITHOUT exposing correct_option
create or replace view v_active_holdout_questions as
select qp.exam_pack_id, qp.question_id, qp.item_version, qp.usage_type, q.question_text, q.options
from exam_pack_questions qp
join questions q on qp.question_id = q.id
where qp.holdout_status = 'active' and qp.restricted = false;

-- 4. Enable RLS and grant read access
alter table exam_packs enable row level security;
alter table exam_pack_questions enable row level security;

drop policy if exists read_exam_packs on exam_packs;
create policy read_exam_packs on exam_packs for select using (true);
grant select on exam_packs to authenticated, anon;

drop policy if exists read_holdout_context on exam_pack_questions;
create policy read_holdout_context on exam_pack_questions for select using (true);
grant select on exam_pack_questions to authenticated;
