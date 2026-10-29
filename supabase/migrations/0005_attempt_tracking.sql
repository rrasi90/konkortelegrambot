-- supabase/migrations/0005_attempt_tracking.sql -- Attempt type tracking

-- 1. Add attempt_type to answer_events
alter table answer_events add column if not exists attempt_type text not null default 'practice'
  check (attempt_type in ('practice','diagnostic','verification','exam_simulation'));

-- 2. Add pack_id and item_version for edition tracking
alter table answer_events add column if not exists pack_id uuid references exam_packs(id);
alter table answer_events add column if not exists item_version text not null default '1.0';

-- 3. Add target_skill_id for skill mapping
alter table answer_events add column if not exists target_skill_id text references knowledge_nodes(id);

-- 4. Add duration and correctness timing
alter table answer_events add column if not started_at timestamptz not null default now();
alter table answer_events add column if not completed_at timestamptz;

-- 5. Add evidence_level
alter table answer_events add column if not exists evidence_level text not null default 'none'
  check (evidence_level in ('none','partial','complete','certified'));

-- 6. Indexes for performance
create index if not exists ix_ae_user_pack on answer_events(user_id, pack_id);
create index if not exists ix_ae_attempt_type on answer_events(attempt_type);
create index if not exists ix_ae_evidence_level on answer_events(evidence_level);

-- 5. View for easy querying
create or replace view v_user_attempts_summary as
select
  ue.*,
  q.node_id,
  q.exam_pack_id,
  q.item_version,
  s.id as target_skill_id,
  s.status as skill_status,
  ue.evidence_level
from answer_events ue
left join questions q on ue.question_id = q.id
left join user_skill_mastery s on ue.target_skill_id = s.user_id and ue.target_skill_id = s.skill_id;
