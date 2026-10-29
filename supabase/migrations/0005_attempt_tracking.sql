-- supabase/migrations/0005_attempt_tracking.sql -- Attempt type tracking & Skills Schema

-- 1. Ensure skills and question mappings exist before referencing
create table if not exists skills (
  id text primary key,
  node_id text references knowledge_nodes(id) on delete cascade,
  title text not null,
  operational_definition text,
  cognitive_level text,
  bloom_level int check (bloom_level between 1 and 6),
  difficulty_estimate numeric check (difficulty_estimate between 0 and 100),
  estimated_study_minutes int,
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now()
);

create table if not exists question_skill_mappings (
  question_id text not null references questions(id) on delete cascade,
  skill_id text not null references skills(id) on delete cascade,
  is_primary boolean not null default true,
  weight numeric not null default 1.0,
  created_at timestamptz not null default now(),
  primary key (question_id, skill_id)
);

create table if not exists user_skill_mastery (
  user_id uuid not null references app_users(id) on delete cascade,
  skill_id text not null references skills(id) on delete cascade,
  mastery_score numeric not null default 50 check (mastery_score between 0 and 100),
  status text not null default 'unseen' check (status in ('unseen','evidence_gathering','skill_gap','in_remediation','evidence_sufficient','proven_independent')),
  evidence_count int not null default 0,
  memory_retrievability numeric default 1.0,
  fluency text default 'normal' check (fluency in ('slow','normal','fast','exceptional')),
  last_error_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

-- 2. Add attempt_type and audit attributes to answer_events
alter table answer_events add column if not exists attempt_type text not null default 'practice'
  check (attempt_type in ('practice','diagnostic','verification','proof','holdout','exam_simulation'));

alter table answer_events add column if not exists pack_id text references exam_packs(id);
alter table answer_events add column if not exists item_version text not null default '1.0';
alter table answer_events add column if not exists target_skill_id text references skills(id);
alter table answer_events add column if not exists started_at timestamptz not null default now();
alter table answer_events add column if not exists completed_at timestamptz;
alter table answer_events add column if not exists evidence_level text not null default 'none'
  check (evidence_level in ('none','partial','complete','certified'));

-- 3. Indexes for performance
create index if not exists ix_ae_user_pack on answer_events(user_id, pack_id);
create index if not exists ix_ae_attempt_type on answer_events(attempt_type);
create index if not exists ix_ae_evidence_level on answer_events(evidence_level);
create index if not exists ix_ae_target_skill on answer_events(target_skill_id);

-- 4. View for querying attempts summary (WITHOUT leaking question.correct_option)
create or replace view v_user_attempts_summary as
select
  ue.id as attempt_event_id,
  ue.user_id,
  ue.question_id,
  ue.selected_option,
  ue.is_correct,
  ue.attempt_id,
  ue.attempt_type,
  ue.pack_id,
  ue.item_version,
  ue.started_at,
  ue.completed_at,
  ue.evidence_level,
  q.node_id,
  q.exam_pack_id,
  q.question_text,
  s.id as skill_id,
  s.title as skill_title,
  usm.status as user_skill_status,
  usm.mastery_score as user_skill_mastery_score
from answer_events ue
left join questions q on ue.question_id = q.id
left join skills s on ue.target_skill_id = s.id
left join user_skill_mastery usm on ue.user_id = usm.user_id and ue.target_skill_id = usm.skill_id;

-- 5. RLS policies
alter table skills enable row level security;
alter table question_skill_mappings enable row level security;
alter table user_skill_mastery enable row level security;

create policy read_skills on skills for select using (true);
create policy read_question_skill_mappings on question_skill_mappings for select using (true);
create policy user_own_skill_mastery on user_skill_mastery for select using (auth.uid() = user_id);

grant select on skills to authenticated, anon;
grant select on question_skill_mappings to authenticated, anon;
grant select on user_skill_mastery to authenticated;
