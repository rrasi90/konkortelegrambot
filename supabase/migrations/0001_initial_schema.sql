-- Initial schema for the adaptive exam-learning platform.
-- User-owned projections are read-only to clients; trusted server code writes them.
-- No exam content is seeded until source, correctness and usage rights are reviewed.

create extension if not exists pgcrypto;

create table if not exists public.exam_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  version integer not null check (version > 0),
  title text not null,
  level text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  official_source_url text,
  officially_verified boolean not null default false,
  licensing_status text not null default 'unknown'
    check (licensing_status in ('unknown', 'personal-use-reviewed', 'public-distribution-cleared', 'restricted')),
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (slug, version),
  unique (id, slug)
);

create table if not exists public.exam_tracks (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs(id) on delete restrict,
  slug text not null,
  title text not null,
  scoring_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, exam_pack_id),
  unique (exam_pack_id, slug)
);

create table if not exists public.track_courses (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs(id) on delete restrict,
  track_id uuid not null,
  slug text not null,
  title text not null,
  coefficient numeric check (coefficient is null or coefficient >= 0),
  display_order integer not null default 0,
  official_source_reference text,
  unique (id, exam_pack_id),
  unique (track_id, slug),
  foreign key (track_id, exam_pack_id) references public.exam_tracks(id, exam_pack_id) on delete restrict
);

create table if not exists public.syllabus_topics (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs(id) on delete restrict,
  course_id uuid not null,
  parent_topic_id uuid,
  slug text not null,
  title text not null,
  display_order integer not null default 0,
  official_source_reference text,
  content_status text not null default 'draft'
    check (content_status in ('draft', 'ai_suggested', 'verified', 'published', 'rejected', 'retired')),
  unique (id, exam_pack_id),
  unique (course_id, slug),
  foreign key (course_id, exam_pack_id) references public.track_courses(id, exam_pack_id) on delete restrict,
  foreign key (parent_topic_id, exam_pack_id) references public.syllabus_topics(id, exam_pack_id) on delete restrict
);

create table if not exists public.atomic_skills (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs(id) on delete restrict,
  topic_id uuid,
  slug text not null,
  title text not null,
  description text not null default '',
  success_criterion text not null default '',
  content_status text not null default 'draft'
    check (content_status in ('draft', 'ai_suggested', 'verified', 'published', 'rejected', 'retired')),
  provenance jsonb not null default '{}'::jsonb,
  unique (id, exam_pack_id),
  unique (exam_pack_id, slug),
  foreign key (topic_id, exam_pack_id) references public.syllabus_topics(id, exam_pack_id) on delete restrict
);

create table if not exists public.skill_edges (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs(id) on delete restrict,
  source_skill_id uuid not null,
  target_skill_id uuid not null,
  relation_type text not null
    check (relation_type in ('prerequisite_of', 'confusable_with', 'applied_in', 'part_of', 'related_to')),
  verification_status text not null default 'ai_suggested'
    check (verification_status in ('draft', 'ai_suggested', 'verified', 'rejected')),
  evidence_source text,
  notes text,
  created_at timestamptz not null default now(),
  check (source_skill_id <> target_skill_id),
  unique (exam_pack_id, source_skill_id, target_skill_id, relation_type),
  foreign key (source_skill_id, exam_pack_id) references public.atomic_skills(id, exam_pack_id) on delete restrict,
  foreign key (target_skill_id, exam_pack_id) references public.atomic_skills(id, exam_pack_id) on delete restrict
);

create table if not exists public.learning_items (
  id uuid primary key default gen_random_uuid(),
  exam_pack_id uuid not null references public.exam_packs(id) on delete restrict,
  slug text not null,
  version integer not null check (version > 0),
  item_type text not null
    check (item_type in ('lesson', 'comparison', 'worked_example', 'mcq', 'diagnostic_probe', 'micro_card', 'exam_simulation')),
  pool_type text not null default 'training' check (pool_type in ('training', 'holdout_eval')),
  content_status text not null default 'draft'
    check (content_status in ('draft', 'ai_suggested', 'verified', 'published', 'rejected', 'retired')),
  requires_paper boolean not null default false,
  estimated_minutes numeric not null default 1 check (estimated_minutes > 0),
  exam_year integer,
  payload jsonb not null default '{}'::jsonb,
  source_reference text,
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown', 'review-needed', 'cleared', 'restricted')),
  created_at timestamptz not null default now(),
  unique (id, exam_pack_id),
  unique (exam_pack_id, slug, version)
);

create table if not exists public.item_skill_mappings (
  exam_pack_id uuid not null,
  item_id uuid not null,
  skill_id uuid not null,
  mapping_role text not null default 'primary'
    check (mapping_role in ('primary', 'secondary', 'distractor_concept')),
  verification_status text not null default 'ai_suggested'
    check (verification_status in ('draft', 'ai_suggested', 'verified', 'rejected')),
  evidence_source text,
  primary key (item_id, skill_id),
  foreign key (item_id, exam_pack_id) references public.learning_items(id, exam_pack_id) on delete restrict,
  foreign key (skill_id, exam_pack_id) references public.atomic_skills(id, exam_pack_id) on delete restrict
);

create table if not exists public.study_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_exam_pack_id uuid references public.exam_packs(id) on delete restrict,
  active_track_id uuid,
  target_exam_date date,
  daily_budget_minutes integer not null default 20 check (daily_budget_minutes between 1 and 1440),
  default_study_mode text not null default 'desk' check (default_study_mode in ('desk', 'commute')),
  updated_at timestamptz not null default now(),
  check (active_track_id is null or active_exam_pack_id is not null),
  foreign key (active_track_id, active_exam_pack_id) references public.exam_tracks(id, exam_pack_id) on delete restrict
);

create table if not exists public.learner_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  exam_pack_id uuid not null references public.exam_packs(id) on delete restrict,
  item_id uuid,
  item_version integer,
  skill_id uuid,
  event_type text not null
    check (event_type in ('answer_submitted', 'confidence_recorded', 'diagnostic_completed', 'remediation_completed', 'holdout_assessed', 'activity_skipped')),
  occurred_at timestamptz not null,
  engine_version text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  foreign key (item_id, exam_pack_id) references public.learning_items(id, exam_pack_id) on delete restrict,
  foreign key (skill_id, exam_pack_id) references public.atomic_skills(id, exam_pack_id) on delete restrict
);

create table if not exists public.user_skill_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_pack_id uuid not null references public.exam_packs(id) on delete restrict,
  skill_id uuid not null,
  estimated_proficiency numeric check (estimated_proficiency is null or estimated_proficiency between 0 and 1),
  evidence_confidence numeric not null default 0 check (evidence_confidence between 0 and 1),
  fluency_ms bigint check (fluency_ms is null or fluency_ms >= 0),
  dominant_error text check (dominant_error is null or dominant_error in ('conceptual', 'confusable', 'computational', 'slip', 'unknown')),
  coverage_status text not null default 'unseen'
    check (coverage_status in ('unseen', 'diagnosed', 'remediating', 'verified_by_unseen')),
  projection_revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id),
  foreign key (skill_id, exam_pack_id) references public.atomic_skills(id, exam_pack_id) on delete restrict
);

create table if not exists public.review_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_pack_id uuid not null references public.exam_packs(id) on delete restrict,
  learning_item_id uuid not null,
  fsrs_state jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, learning_item_id),
  foreign key (learning_item_id, exam_pack_id) references public.learning_items(id, exam_pack_id) on delete restrict
);

create table if not exists public.planner_decision_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_pack_id uuid not null references public.exam_packs(id) on delete restrict,
  engine_version text not null,
  daily_budget_minutes integer not null check (daily_budget_minutes between 0 and 1440),
  selected_activities jsonb not null default '[]'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learner_events_user_time_idx on public.learner_events (user_id, occurred_at desc);
create index if not exists learner_events_pack_time_idx on public.learner_events (exam_pack_id, occurred_at desc);
create index if not exists skill_edges_target_verification_idx on public.skill_edges (target_skill_id, verification_status);
create index if not exists skill_edges_source_verification_idx on public.skill_edges (source_skill_id, verification_status);
create index if not exists learning_items_pack_pool_status_idx on public.learning_items (exam_pack_id, pool_type, content_status);
create index if not exists review_states_user_due_idx on public.review_states (user_id, due_at);
create index if not exists planner_logs_user_time_idx on public.planner_decision_logs (user_id, created_at desc);

-- Defence in depth: raw learner events are append-only.
create or replace function public.reject_learner_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'learner_events is append-only';
end;
$$;

drop trigger if exists learner_events_append_only on public.learner_events;
create trigger learner_events_append_only
before update or delete on public.learner_events
for each row execute function public.reject_learner_event_mutation();

alter table public.exam_packs enable row level security;
alter table public.exam_tracks enable row level security;
alter table public.track_courses enable row level security;
alter table public.syllabus_topics enable row level security;
alter table public.atomic_skills enable row level security;
alter table public.skill_edges enable row level security;
alter table public.learning_items enable row level security;
alter table public.item_skill_mappings enable row level security;
alter table public.study_profiles enable row level security;
alter table public.learner_events enable row level security;
alter table public.user_skill_states enable row level security;
alter table public.review_states enable row level security;
alter table public.planner_decision_logs enable row level security;

create policy "published packs are readable" on public.exam_packs
for select to anon, authenticated using (status = 'published');

create policy "published tracks are readable" on public.exam_tracks
for select to anon, authenticated using (
  exists (select 1 from public.exam_packs p where p.id = exam_pack_id and p.status = 'published')
);

create policy "published courses are readable" on public.track_courses
for select to anon, authenticated using (
  exists (select 1 from public.exam_packs p where p.id = exam_pack_id and p.status = 'published')
);

create policy "published topics are readable" on public.syllabus_topics
for select to anon, authenticated using (
  content_status = 'published'
  and exists (select 1 from public.exam_packs p where p.id = exam_pack_id and p.status = 'published')
);

create policy "published skills are readable" on public.atomic_skills
for select to anon, authenticated using (
  content_status = 'published'
  and exists (select 1 from public.exam_packs p where p.id = exam_pack_id and p.status = 'published')
);

create policy "verified skill edges are readable" on public.skill_edges
for select to anon, authenticated using (
  verification_status = 'verified'
  and exists (select 1 from public.exam_packs p where p.id = exam_pack_id and p.status = 'published')
);

create policy "published training items are readable" on public.learning_items
for select to authenticated using (
  pool_type = 'training'
  and content_status = 'published'
  and rights_status = 'cleared'
  and exists (select 1 from public.exam_packs p where p.id = exam_pack_id and p.status = 'published')
);

create policy "published training mappings are readable" on public.item_skill_mappings
for select to authenticated using (
  verification_status = 'verified'
  and exists (
    select 1 from public.learning_items i
    join public.exam_packs p on p.id = i.exam_pack_id
    where i.id = item_skill_mappings.item_id
      and i.exam_pack_id = item_skill_mappings.exam_pack_id
      and i.pool_type = 'training' and i.content_status = 'published'
      and i.rights_status = 'cleared' and p.status = 'published'
  )
);

create policy "users read own study profile" on public.study_profiles
for select to authenticated using (auth.uid() = user_id);
create policy "users insert own study profile" on public.study_profiles
for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own study profile" on public.study_profiles
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users read own learner events" on public.learner_events
for select to authenticated using (auth.uid() = user_id);
create policy "users read own skill projections" on public.user_skill_states
for select to authenticated using (auth.uid() = user_id);
create policy "users read own review states" on public.review_states
for select to authenticated using (auth.uid() = user_id);
create policy "users read own planner logs" on public.planner_decision_logs
for select to authenticated using (auth.uid() = user_id);

revoke update, delete, truncate on public.learner_events from anon, authenticated;
revoke insert, update, delete, truncate on public.user_skill_states from anon, authenticated;
revoke insert, update, delete, truncate on public.review_states from anon, authenticated;
revoke insert, update, delete, truncate on public.planner_decision_logs from anon, authenticated;

-- Writes to learner_events and projections must be mediated by a trusted server path.
