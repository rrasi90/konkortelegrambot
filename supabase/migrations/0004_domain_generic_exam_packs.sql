-- 0004_domain_generic_exam_packs.sql
-- Pack-defined exam domains, many-to-many skill mapping, evidence projections, provenance and planner audit.
-- Existing management demo data remains valid; new packs can define any track slug.

begin;

-- Domain / degree track names belong to a versioned pack, never to the application source.
alter table public.knowledge_nodes
  drop constraint if exists knowledge_nodes_track_check;
alter table public.knowledge_nodes
  add constraint knowledge_nodes_track_slug_check
  check (track ~ '^[a-z][a-z0-9_-]{1,39}$');

alter table public.node_dependencies
  drop constraint if exists node_dependencies_relation_check;
alter table public.node_dependencies
  add constraint node_dependencies_semantic_relation_check
  check (relation in (
    'prerequisite_of','confusable_with','applied_in','part_of','related_to',
    'prerequisite','cross_course'
  ));
alter table public.node_dependencies
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','rejected'));
alter table public.node_dependencies
  add column if not exists source_ref text;
alter table public.node_dependencies
  add column if not exists confidence numeric
    check (confidence is null or confidence between 0 and 1);
alter table public.node_dependencies
  add column if not exists verified_at timestamptz;

-- Import provenance and editorial/rights workflow are separate from content correctness.
alter table public.questions add column if not exists source_ref text;
alter table public.questions add column if not exists source_hash text;
alter table public.questions add column if not exists rights_status text not null default 'unknown'
  check (rights_status in ('unknown','review_required','authorized','public_domain','licensed','blocked'));
alter table public.questions add column if not exists verified_by text;
alter table public.questions add column if not exists verified_at timestamptz;
alter table public.questions add column if not exists item_version text not null default '1';
alter table public.questions add column if not exists is_holdout boolean not null default false;

create table if not exists public.exam_packs (
  id text primary key,
  title text not null,
  exam_level text not null,
  syllabus_version text not null,
  content_version integer not null default 1 check (content_version >= 1),
  is_synthetic boolean not null default false,
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown','review_required','authorized','public_domain','licensed','blocked')),
  publication_status text not null default 'draft'
    check (publication_status in ('draft','review','published','retired')),
  scoring_rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source_ref text,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_pack_has_rights check (
    publication_status <> 'published' or is_synthetic or rights_status in ('authorized','public_domain','licensed')
  )
);

create table if not exists public.exam_pack_syllabi (
  pack_id text not null references public.exam_packs(id) on delete cascade,
  version text not null,
  source_ref text,
  source_hash text,
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown','review_required','authorized','public_domain','licensed','blocked')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','rejected')),
  syllabus_content jsonb not null default '{}'::jsonb,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (pack_id, version)
);

create table if not exists public.exam_pack_courses (
  pack_id text not null references public.exam_packs(id) on delete cascade,
  course_key text not null,
  title text not null,
  weight numeric not null default 0 check (weight >= 0),
  weight_is_official boolean not null default false,
  source_ref text,
  sort_order integer not null default 0,
  primary key (pack_id, course_key)
);

create table if not exists public.exam_pack_skills (
  pack_id text not null references public.exam_packs(id) on delete cascade,
  skill_id text not null references public.knowledge_nodes(id) on delete cascade,
  course_key text,
  syllabus_item_ref text,
  atomicity_status text not null default 'unreviewed'
    check (atomicity_status in ('unreviewed','atomic','needs_split','composite')),
  source_ref text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','rejected')),
  primary key (pack_id, skill_id),
  foreign key (pack_id, course_key) references public.exam_pack_courses(pack_id, course_key)
);

create table if not exists public.exam_pack_questions (
  pack_id text not null references public.exam_packs(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  item_version text not null default '1',
  source_ref text,
  source_year integer,
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown','review_required','authorized','public_domain','licensed','blocked')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','quarantined','demo')),
  is_holdout boolean not null default false,
  holdout_reviewed boolean not null default false,
  primary key (pack_id, question_id, item_version)
);

-- One question can assess several atomic skills; a skill can be assessed by many questions.
create table if not exists public.question_skill_mappings (
  question_id text not null references public.questions(id) on delete cascade,
  skill_id text not null references public.knowledge_nodes(id) on delete cascade,
  mapping_role text not null default 'primary'
    check (mapping_role in ('primary','secondary','diagnostic','transfer')),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','rejected')),
  source_ref text,
  verified_by text,
  verified_at timestamptz,
  primary key (question_id, skill_id)
);
insert into public.question_skill_mappings(question_id, skill_id, mapping_role, verification_status)
select q.id, q.node_id, 'primary', 'unverified'
from public.questions q
on conflict (question_id, skill_id) do nothing;

create table if not exists public.learning_assets (
  id text primary key,
  pack_id text references public.exam_packs(id) on delete cascade,
  skill_id text references public.knowledge_nodes(id) on delete set null,
  asset_type text not null
    check (asset_type in ('mini_lesson','worked_example','diagnostic_probe','remediation','comparison','summary','explanation')),
  title text not null,
  content jsonb not null,
  version integer not null default 1 check (version >= 1),
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown','review_required','authorized','public_domain','licensed','blocked')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','rejected')),
  source_ref text,
  source_hash text,
  created_at timestamptz not null default now(),
  verified_by text,
  verified_at timestamptz
);
create index if not exists learning_assets_skill_type_idx
  on public.learning_assets(pack_id, skill_id, asset_type, version desc);

-- Rebuildable 6-dimensional learner projection. A wrong answer alone never writes a skill verdict.
create table if not exists public.learner_skill_states (
  user_id uuid not null references public.app_users(id) on delete cascade,
  skill_id text not null references public.knowledge_nodes(id) on delete cascade,
  proficiency_probability numeric not null default 0.5 check (proficiency_probability between 0 and 1),
  estimate_confidence numeric not null default 0 check (estimate_confidence between 0 and 1),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  memory_retrievability numeric not null default 0.5 check (memory_retrievability between 0 and 1),
  fluency_score numeric not null default 0 check (fluency_score between 0 and 1),
  dominant_error_type text not null default 'unknown'
    check (dominant_error_type in ('conceptual','confusable','computational','slip','unknown')),
  coverage_state text not null default 'unseen'
    check (coverage_state in ('unseen','diagnosed','remediating','verified_by_unseen')),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

-- Append-only cross-event evidence. Answer events retain the graded answer; this table stores probes,
-- self-reported slips, remediation milestones, holdout proofs and diagnostic state transitions.
create table if not exists public.learning_evidence_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  skill_id text references public.knowledge_nodes(id) on delete set null,
  question_id text references public.questions(id) on delete set null,
  client_event_id text,
  event_type text not null
    check (event_type in ('diagnostic_probe','self_report_slip','remediation_started','remediation_completed','unseen_verification','learner_state_updated')),
  payload jsonb not null default '{}'::jsonb,
  engine_version text not null default '0.2.0',
  item_version text,
  occurred_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);
create index if not exists learning_evidence_events_user_time_idx
  on public.learning_evidence_events(user_id, occurred_at desc);

create table if not exists public.planner_decision_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  plan_date date not null,
  action_type text not null
    check (action_type in ('spaced_review','diagnostic_probe','remediation','new_material','unseen_verification','strategic_skip')),
  target_id text not null,
  exam_value numeric not null check (exam_value between 0 and 1),
  expected_benefit numeric not null check (expected_benefit between 0 and 1),
  urgency numeric not null check (urgency between 0 and 1),
  estimated_minutes numeric not null check (estimated_minutes > 0),
  score numeric not null check (score >= 0),
  selected boolean not null default false,
  reason jsonb not null default '{}'::jsonb,
  planner_version text not null default '0.1.0',
  created_at timestamptz not null default now()
);
create index if not exists planner_decision_logs_user_day_idx
  on public.planner_decision_logs(user_id, plan_date, selected);

-- These tables are served only through the backend with the service role.
alter table public.exam_packs enable row level security;
alter table public.exam_pack_syllabi enable row level security;
alter table public.exam_pack_courses enable row level security;
alter table public.exam_pack_skills enable row level security;
alter table public.exam_pack_questions enable row level security;
alter table public.question_skill_mappings enable row level security;
alter table public.learning_assets enable row level security;
alter table public.learner_skill_states enable row level security;
alter table public.learning_evidence_events enable row level security;
alter table public.planner_decision_logs enable row level security;

revoke all on public.exam_packs, public.exam_pack_syllabi, public.exam_pack_courses,
  public.exam_pack_skills, public.exam_pack_questions, public.question_skill_mappings,
  public.learning_assets, public.learner_skill_states, public.learning_evidence_events,
  public.planner_decision_logs from public, anon, authenticated;

commit;
