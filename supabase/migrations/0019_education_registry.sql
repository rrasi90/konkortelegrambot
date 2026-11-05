-- 0019_education_registry.sql — AEL فاز ۱ (AEL-101..108)
-- رجیستری داده‌محور نظام آموزشی، برنامهٔ درسی و آزمون با نسخه‌دهی صریح.
-- اصل: افزودن رشته/نظام/مقررات جدید = داده، نه تغییر کد (ADR-002).
-- RLS: همهٔ جداول RLS روشن و بدون policy برای anon (Default Deny)؛
-- سرویسِ Worker با service_role (bypass RLS) کار می‌کند.

-- ============ ۱. نظام آموزشی و مراجع ============
create table if not exists education_authorities (
  code text primary key,
  name text not null,
  kind text not null default 'government' check (kind in ('government','agency','university','council','other')),
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists education_systems (
  code text primary key,
  authority_code text not null references education_authorities(code),
  name text not null,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists education_levels (
  code text primary key,
  system_code text not null references education_systems(code),
  name text not null,
  level_order smallint not null,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists education_stages (
  code text primary key,
  level_code text not null references education_levels(code),
  name text not null,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists education_tracks (
  code text primary key,
  level_code text not null references education_levels(code),
  name text not null,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fields_of_study (
  code text primary key,
  track_code text not null references education_tracks(code),
  name text not null,
  aliases jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists majors (
  code text primary key,
  field_code text not null references fields_of_study(code),
  name text not null,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subfields (
  code text primary key,
  major_code text not null references majors(code),
  name text not null,
  exam_code text,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists institutions (
  code text primary key,
  name text not null,
  kind text not null default 'university' check (kind in ('university','institute','school','other')),
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists faculties (
  code text primary key,
  institution_code text not null references institutions(code),
  name text not null,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ ۲. برنامه و نسخهٔ آن ============
create table if not exists programs (
  code text primary key,
  institution_code text not null references institutions(code),
  level_code text not null references education_levels(code),
  field_code text not null references fields_of_study(code),
  major_code text references majors(code),
  name text not null,
  status text not null default 'active' check (status in ('active','retired','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists program_versions (
  id text primary key,
  program_code text not null references programs(code),
  version_number int not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  effective_from date,
  effective_until date,
  content_hash text,
  previous_version_id text references program_versions(id),
  change_reason text,
  source_ids jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_code, version_number)
);

create table if not exists academic_years (
  id text primary key,  -- مثل: 1404-1405
  year_label text not null,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year_label)
);

create table if not exists curricula (
  code text primary key,
  program_version_id text not null references program_versions(id),
  name text not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists curriculum_versions (
  id text primary key,
  curriculum_code text not null references curricula(code),
  version_number int not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  effective_from date,
  effective_until date,
  content_hash text,
  previous_version_id text references curriculum_versions(id),
  change_reason text,
  source_ids jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_code, version_number)
);

-- ============ ۳. درس، سرفصل، خروجی و گراف ============
create table if not exists course_definitions (
  code text primary key,
  name text not null,
  aliases jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists course_offerings (
  id text primary key,
  definition_code text not null references course_definitions(code),
  program_version_id text references program_versions(id),
  academic_year_id text references academic_years(id),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists course_units (
  id text primary key,
  definition_code text not null references course_definitions(code),
  unit_kind text not null check (unit_kind in ('lecture','practical','workshop','lab')),
  hours numeric not null default 0 check (hours >= 0),
  position smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists syllabus_nodes (
  id text primary key,
  definition_code text not null references course_definitions(code),
  parent_id text references syllabus_nodes(id),
  position smallint not null default 1,
  title text not null,
  node_kind text not null check (node_kind in ('chapter','section','topic','concept')),
  -- سرفصل رسمی مرجع با سرفصل پیشنهادی/تألیفی تفکیک می‌شود (سند ۸٫۳)
  officiality text not null default 'proposed' check (officiality in ('official','proposed','authored')),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  knowledge_node_id text references knowledge_nodes(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_syllabus_nodes_definition on syllabus_nodes(definition_code);

create table if not exists learning_outcomes (
  id text primary key,
  definition_code text not null references course_definitions(code),
  statement text not null,
  bloom_level smallint check (bloom_level between 1 and 6),
  competency_code text,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists curriculum_courses (
  id text primary key,
  curriculum_version_id text not null references curriculum_versions(id),
  definition_code text not null references course_definitions(code),
  term smallint not null default 1,
  is_elective boolean not null default false,
  position smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_version_id, definition_code)
);

-- یال‌های عمومی پیش‌نیاز/هم‌نیاز — قابل استفاده برای درس، مهارت و خروجی (AEL-408)
create table if not exists prerequisite_edges (
  id text primary key,
  source_kind text not null check (source_kind in ('course','skill','outcome','node')),
  source_id text not null,
  target_kind text not null check (target_kind in ('course','skill','outcome','node')),
  target_id text not null,
  edge_kind text not null check (edge_kind in ('prerequisite','corequisite','recommended')),
  scope text,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_kind, source_id, target_kind, target_id, edge_kind)
);

-- ============ ۴. آزمون و پذیرش ============
create table if not exists exam_families (
  code text primary key,
  name text not null,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exam_events (
  id text primary key,
  family_code text not null references exam_families(code),
  academic_year_id text references academic_years(id),
  year_label text not null,
  session smallint not null default 1,
  name text not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_code, year_label, session)
);

create table if not exists exam_event_versions (
  id text primary key,
  event_id text not null references exam_events(id),
  version_number int not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  effective_from timestamptz,
  effective_until timestamptz,
  content_hash text,
  rules_hash text,
  previous_version_id text references exam_event_versions(id),
  change_reason text,
  source_ids jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, version_number)
);

create table if not exists exam_subjects (
  code text primary key,
  name text not null,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exam_sets (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_version_id, code)
);

create table if not exists exam_combinations (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  code text not null,
  name text not null,
  subfield_code text references subfields(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_version_id, code)
);

create table if not exists exam_field_subject_assignments (
  id text primary key,
  combination_id text not null references exam_combinations(id),
  subject_code text not null references exam_subjects(code),
  coefficient numeric not null default 0 check (coefficient >= 0),
  weight numeric not null default 0 check (weight >= 0),
  negative_marking text not null default 'none' check (negative_marking in ('none','per_question','custom')),
  time_limit_minutes int,
  position smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (combination_id, subject_code)
);

create table if not exists admission_rules (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  rule_json jsonb not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  source_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assessment_components (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  kind text not null check (kind in ('exam','records','interview','research','language','other')),
  weight numeric not null default 0 check (weight >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assessment_rubrics (
  id text primary key,
  component_id text not null references assessment_components(id),
  version_number int not null,
  criteria jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (component_id, version_number)
);

create table if not exists exam_booklets (
  id text primary key,
  event_version_id text not null references exam_event_versions(id),
  code text not null,
  form smallint not null default 1,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_version_id, code, form)
);

-- ============ ۵. اعمال RLS (Default Deny برای anon) ============
do $$
declare
  t text;
  tables text[] := array[
    'education_authorities','education_systems','education_levels','education_stages','education_tracks',
    'fields_of_study','majors','subfields','institutions','faculties',
    'programs','program_versions','academic_years','curricula','curriculum_versions',
    'course_definitions','course_offerings','course_units','syllabus_nodes','learning_outcomes',
    'curriculum_courses','prerequisite_edges',
    'exam_families','exam_events','exam_event_versions','exam_subjects','exam_sets','exam_combinations',
    'exam_field_subject_assignments','admission_rules','assessment_components','assessment_rubrics','exam_booklets'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- ============ ۶. اعتبارسنجی چرخهٔ پیش‌نیاز (DAG) در سطح DB ============
create or replace function assert_no_prerequisite_cycle() returns trigger as $$
-- تذکر: چرخه‌یابی کامل DAG در Import CLI و لایهٔ Engine انجام می‌شود
-- (packages/learning-engine data-versioning findPrerequisiteCycle)؛ این تریگر
-- فقط self-edge و تکرار سادهٔ یال را می‌بندد.
begin
  if new.source_kind = new.target_kind and new.source_id = new.target_id then
    raise exception 'PREREQUISITE_SELF_EDGE: %/% نمی‌تواند پیش‌نیاز خودش باشد', new.source_kind, new.source_id;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_no_prereq_self_edge on prerequisite_edges;
create trigger trg_no_prereq_self_edge
  before insert or update on prerequisite_edges
  for each row execute function assert_no_prerequisite_cycle();
