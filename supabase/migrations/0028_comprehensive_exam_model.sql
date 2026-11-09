-- 0028_comprehensive_exam_model.sql
-- Normalized, year/version-aware exam model. Existing 0019 registry tables remain
-- the parent identity layer; this migration adds explicit set/combination membership,
-- scoped coefficients, target rows, selection policy and candidate preparation state.
-- Unknown coefficient != official zero. Candidate rows use the application's stable
-- candidate/user identifier as text until the canonical identity table is selected.

-- 1) A combination belongs to one exam set, not just an event version.
alter table exam_combinations
  add column if not exists exam_set_id text references exam_sets(id),
  add column if not exists source_ids jsonb not null default '[]'::jsonb,
  add column if not exists verification_status text not null default 'needs_check'
    check (verification_status in ('official_verified','reported','needs_check','draft'));

alter table exam_combinations
  drop constraint if exists exam_combinations_event_version_id_code_key;
create unique index if not exists uq_exam_combinations_set_code
  on exam_combinations(exam_set_id, code)
  where exam_set_id is not null;
create index if not exists idx_exam_combinations_event_version
  on exam_combinations(event_version_id);

-- 2) Numbered subjects/materials inside a specific versioned exam set.
create table if not exists exam_set_subjects (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  exam_set_id text not null references exam_sets(id),
  subject_code text not null references exam_subjects(code),
  subject_number smallint not null check (subject_number > 0),
  component_kind text not null check (component_kind in ('language','shared_core','specialized','other')),
  subject_level text not null default 'unknown'
    check (subject_level in ('general','bachelor','master','doctoral','mixed','unknown')),
  source_label text,
  source_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_set_id, subject_number),
  unique (exam_set_id, subject_code),
  check (jsonb_typeof(source_ids) = 'array')
);
create index if not exists idx_exam_set_subjects_event on exam_set_subjects(event_version_id,exam_set_id,subject_number);

-- 3) Explicit subject membership of an official doctorate combination.
create table if not exists exam_combination_subjects (
  combination_id text not null references exam_combinations(id) on delete cascade,
  exam_set_subject_id text not null references exam_set_subjects(id),
  required boolean not null default true,
  position smallint not null check (position > 0),
  created_at timestamptz not null default now(),
  primary key (combination_id,exam_set_subject_id),
  unique (combination_id,position)
);

-- 4) Official table target rows. A row is not an admission offering.
create table if not exists exam_target_mappings (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  exam_set_id text not null references exam_sets(id),
  official_target_label text not null,
  field_code text references fields_of_study(code),
  major_code text references majors(code),
  subfield_code text references subfields(code),
  official_target_code text,
  combination_id text references exam_combinations(id),
  coefficient_code text,
  coefficient_assignment_id text,
  admission_status text not null default 'not_guaranteed_by_exam_table'
    check (admission_status in ('not_guaranteed_by_exam_table','restricted','offering_confirmed','unknown')),
  admission_restriction text,
  verification_status text not null default 'needs_check'
    check (verification_status in ('official_verified','reported','needs_check','draft')),
  source_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(source_ids) = 'array'),
  check (admission_status <> 'restricted' or nullif(trim(admission_restriction),'') is not null)
);
create index if not exists idx_exam_target_mappings_lookup
  on exam_target_mappings(event_version_id,exam_set_id,combination_id);
create index if not exists idx_exam_target_mappings_codes
  on exam_target_mappings(field_code,major_code,subfield_code);

-- 5) Target-specific coefficient vector for Master's profile codes.
-- Multiple rows can retain a repeated printed code when the source has row-level
-- differences or an unresolved inconsistency; target_id is the actual row identity.
create table if not exists exam_coefficient_assignments (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  exam_set_id text not null references exam_sets(id),
  target_id text not null references exam_target_mappings(id) on delete cascade,
  coefficient_code text,
  coefficient_scope text not null default 'exam_subject' check (coefficient_scope = 'exam_subject'),
  verification_status text not null default 'needs_check'
    check (verification_status in ('official_verified','reported','needs_check','draft')),
  source_ids jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_id),
  check (jsonb_typeof(source_ids) = 'array')
);
create index if not exists idx_exam_coefficient_assignments_profile
  on exam_coefficient_assignments(event_version_id,exam_set_id,coefficient_code);

create table if not exists exam_coefficient_values (
  assignment_id text not null references exam_coefficient_assignments(id) on delete cascade,
  exam_set_subject_id text not null references exam_set_subjects(id),
  value numeric,
  value_state text not null check (value_state in ('official_positive','official_zero','unknown','not_applicable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assignment_id,exam_set_subject_id),
  check (
    (value_state in ('unknown','not_applicable') and value is null) or
    (value_state = 'official_zero' and value = 0) or
    (value_state = 'official_positive' and value > 0)
  )
);

-- 6) Coefficients assigned to exam components (e.g. PhD language/specialized block).
-- Do NOT fan-out a component coefficient into each contained course or question.
create table if not exists exam_component_coefficients (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  exam_set_id text not null references exam_sets(id),
  component_code text not null,
  component_title text not null,
  value numeric,
  value_state text not null check (value_state in ('official_positive','official_zero','unknown','not_applicable')),
  verification_status text not null default 'needs_check'
    check (verification_status in ('official_verified','reported','needs_check','draft')),
  source_ids jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_version_id,exam_set_id,component_code),
  check (jsonb_typeof(source_ids) = 'array'),
  check (
    (value_state in ('unknown','not_applicable') and value is null) or
    (value_state = 'official_zero' and value = 0) or
    (value_state = 'official_positive' and value > 0)
  )
);
create table if not exists exam_component_subjects (
  component_id text not null references exam_component_coefficients(id) on delete cascade,
  exam_set_subject_id text not null references exam_set_subjects(id),
  primary key(component_id,exam_set_subject_id)
);

-- 7) Link an exam subject to one or more AEL course definitions/content packs.
create table if not exists exam_subject_course_mappings (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  exam_set_subject_id text not null references exam_set_subjects(id),
  course_ref_kind text not null check (course_ref_kind in ('course_definition','legacy_content_course','unresolved')),
  course_definition_code text references course_definitions(code),
  external_course_ref text,
  course_title text not null,
  mapping_status text not null check (mapping_status in ('exact','candidate','needs_mapping')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (course_ref_kind='course_definition' and course_definition_code is not null and external_course_ref is null) or
    (course_ref_kind='legacy_content_course' and course_definition_code is null and nullif(trim(external_course_ref),'') is not null) or
    (course_ref_kind='unresolved' and course_definition_code is null and external_course_ref is null and mapping_status='needs_mapping')
  )
);

-- 8) Official registration policy is versioned by event, level and source.
-- NULL max selections means unknown, never unlimited.
create table if not exists exam_selection_policies (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  exam_level text not null check (exam_level in ('master','doctorate')),
  max_exam_set_selections smallint check (max_exam_set_selections is null or max_exam_set_selections > 0),
  allowed_roles jsonb not null default '[]'::jsonb,
  allow_same_set_multiple_times boolean not null default false,
  status text not null check (status in ('official_verified','reported','needs_check','draft')),
  source_ids jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_version_id),
  check (jsonb_typeof(allowed_roles) = 'array'),
  check (jsonb_typeof(source_ids) = 'array')
);

-- 9) Candidate's official registration is separate from preparation intentions.
-- candidate_id intentionally references the existing application identity as text;
-- do not create a speculative FK to a guessed users table.
create table if not exists candidate_exam_registrations (
  id text primary key,
  candidate_id text not null,
  event_version_id text not null references exam_event_versions(id),
  status text not null default 'draft' check (status in ('draft','submitted','confirmed','cancelled','unknown')),
  source_registration_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_candidate_exam_registrations_candidate
  on candidate_exam_registrations(candidate_id,event_version_id);

create table if not exists candidate_exam_registration_selections (
  id text primary key,
  registration_id text not null references candidate_exam_registrations(id) on delete cascade,
  exam_set_id text not null references exam_sets(id),
  selection_role text not null check (selection_role in ('primary','floating','additional')),
  registration_reference text,
  created_at timestamptz not null default now(),
  unique(registration_id,exam_set_id)
);

-- 10) Study plans can carry multiple target majors, independent of formal
-- registration set limits. Study-track selections never mutate official codes.
create table if not exists candidate_study_plans (
  id text primary key,
  candidate_id text not null,
  event_version_id text not null references exam_event_versions(id),
  registration_id text references candidate_exam_registrations(id),
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  version_number integer not null default 1 check (version_number > 0),
  resolved_structure_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_candidate_study_plans_candidate
  on candidate_study_plans(candidate_id,event_version_id);

create table if not exists candidate_preparation_targets (
  plan_id text not null references candidate_study_plans(id) on delete cascade,
  target_id text not null references exam_target_mappings(id),
  priority_order smallint not null check (priority_order > 0),
  registration_selection_id text references candidate_exam_registration_selections(id),
  note text,
  created_at timestamptz not null default now(),
  primary key(plan_id,target_id),
  unique(plan_id,priority_order)
);
create table if not exists candidate_study_track_selections (
  plan_id text not null references candidate_study_plans(id) on delete cascade,
  study_track_id text not null,
  created_at timestamptz not null default now(),
  primary key(plan_id,study_track_id)
);

-- 11) Actual admission offerings are separate from registration-table labels.
create table if not exists admission_program_offerings (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  target_id text references exam_target_mappings(id),
  institution_code text references institutions(code),
  program_code text references programs(code),
  major_code text references majors(code),
  subfield_code text references subfields(code),
  capacity integer check (capacity is null or capacity >= 0),
  admission_rule jsonb not null default '{}'::jsonb,
  status text not null check (status in ('reported','official_verified','needs_check','closed')),
  source_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(admission_rule)='object'),
  check (jsonb_typeof(source_ids)='array')
);

-- Every table is default-deny for anon/authenticated; the Worker service role
-- must authorize candidate_id ownership before reading/writing candidate rows.
do $$
declare t text;
begin
  foreach t in array array[
    'exam_set_subjects','exam_combination_subjects','exam_target_mappings',
    'exam_coefficient_assignments','exam_coefficient_values',
    'exam_component_coefficients','exam_component_subjects',
    'exam_subject_course_mappings','exam_selection_policies',
    'candidate_exam_registrations','candidate_exam_registration_selections',
    'candidate_study_plans','candidate_preparation_targets',
    'candidate_study_track_selections','admission_program_offerings'
  ] loop
    execute format('alter table %I enable row level security;',t);
  end loop;
end $$;

comment on column exam_combinations.exam_set_id is 'Explicit parent exam set. Null is retained only for legacy rows until crosswalk.';
comment on table exam_target_mappings is 'Official registration-table field/major rows; not admission guarantees or actual program offerings.';
comment on table exam_coefficient_assignments is 'Target-specific coefficient vector; coefficient_code is not exam_set_code or combination_code.';
comment on table exam_component_coefficients is 'Exam component-level coefficient (for example specialized block); do not copy into individual subjects.';
comment on column exam_selection_policies.max_exam_set_selections is 'NULL means official selection limit is unknown, not unlimited.';
comment on table candidate_exam_registrations is 'Official registrations, subject to event-version selection policy.';
comment on table candidate_study_plans is 'Preparation intent; multi-target plans are independent from official registration slot limits.';
