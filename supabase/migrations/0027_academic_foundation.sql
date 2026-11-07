-- AEL Layer 1: taxonomy, semantic relations and academic mappings.
-- Existing education registry tables remain canonical for program/course/syllabus/exam identity.
-- JSON arrays are used for ordered multi-value mappings; entity endpoints are validated by contracts.

create table if not exists academic_tag_namespaces (
  id text primary key,
  title text not null,
  description text not null,
  selection_mode text not null check (selection_mode in ('single','multiple')),
  applicable_to jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(applicable_to) = 'array')
);

create table if not exists academic_tag_definitions (
  id text primary key,
  namespace_id text not null references academic_tag_namespaces(id),
  slug text not null,
  label text not null,
  aliases jsonb not null default '[]'::jsonb,
  parent_tag_id text references academic_tag_definitions(id),
  description text not null default '',
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (namespace_id, slug),
  check (jsonb_typeof(aliases) = 'array'),
  check (parent_tag_id is null or parent_tag_id <> id)
);
create index if not exists idx_academic_tags_namespace on academic_tag_definitions(namespace_id);
create index if not exists idx_academic_tags_parent on academic_tag_definitions(parent_tag_id);

create table if not exists academic_tag_assignments (
  tag_id text not null references academic_tag_definitions(id),
  target_kind text not null check (target_kind in (
    'course','syllabus_node','skill','learning_outcome','question','lesson_topic',
    'flashcard','exam_event','exam_combination'
  )),
  target_id text not null,
  note text,
  assigned_at timestamptz not null default now(),
  primary key (tag_id, target_kind, target_id)
);
create index if not exists idx_academic_tag_assignments_target
  on academic_tag_assignments(target_kind, target_id);

create table if not exists academic_knowledge_relations (
  id text primary key,
  from_kind text not null check (from_kind in (
    'course','syllabus_node','skill','learning_outcome','question','lesson_topic',
    'flashcard','exam_event','exam_combination'
  )),
  from_id text not null,
  to_kind text not null check (to_kind in (
    'course','syllabus_node','skill','learning_outcome','question','lesson_topic',
    'flashcard','exam_event','exam_combination'
  )),
  to_id text not null,
  relation text not null check (relation in (
    'related_to','cross_course_related','confusable_with','contrasts_with',
    'equivalent_to','teaches','illustrates','assesses','supports_outcome'
  )),
  strength numeric not null default 1 check (strength >= 0 and strength <= 1),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','retired')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_kind <> to_kind or from_id <> to_id),
  unique (relation, from_kind, from_id, to_kind, to_id)
);
create index if not exists idx_academic_relations_from
  on academic_knowledge_relations(from_kind, from_id, relation);
create index if not exists idx_academic_relations_to
  on academic_knowledge_relations(to_kind, to_id, relation);

create table if not exists academic_question_mappings (
  question_id text primary key,
  primary_node_id text not null,
  secondary_node_ids jsonb not null default '[]'::jsonb,
  primary_skill_id text,
  secondary_skill_ids jsonb not null default '[]'::jsonb,
  learning_outcome_ids jsonb not null default '[]'::jsonb,
  tag_ids jsonb not null default '[]'::jsonb,
  bloom_level smallint check (bloom_level between 1 and 6),
  difficulty text check (difficulty in ('basic','intermediate','advanced','expert')),
  format text not null check (format in (
    'single_choice','multiple_select','calculation','short_answer',
    'essay','case_analysis','matching','true_false'
  )),
  purpose jsonb not null default '[]'::jsonb,
  estimated_time_seconds integer check (estimated_time_seconds is null or estimated_time_seconds > 0),
  status text not null default 'needs_review' check (status in ('mapped','needs_review')),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(secondary_node_ids) = 'array'),
  check (jsonb_typeof(secondary_skill_ids) = 'array'),
  check (jsonb_typeof(learning_outcome_ids) = 'array'),
  check (jsonb_typeof(tag_ids) = 'array'),
  check (jsonb_typeof(purpose) = 'array')
);

create table if not exists academic_unmapped_questions (
  question_id text primary key,
  reason text not null check (reason in ('no_skill_mapping','needs_concept_review','missing_node','other')),
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists academic_lesson_topic_mappings (
  course_pack_id text not null,
  topic_id text not null,
  syllabus_node_id text,
  skill_ids jsonb not null default '[]'::jsonb,
  learning_outcome_ids jsonb not null default '[]'::jsonb,
  tag_ids jsonb not null default '[]'::jsonb,
  status text not null default 'needs_mapping' check (status in ('mapped','needs_mapping','needs_review')),
  updated_at timestamptz not null default now(),
  primary key (course_pack_id, topic_id),
  check (jsonb_typeof(skill_ids) = 'array'),
  check (jsonb_typeof(learning_outcome_ids) = 'array'),
  check (jsonb_typeof(tag_ids) = 'array')
);

create table if not exists academic_exam_course_assignments (
  id text primary key,
  exam_level text not null check (exam_level in ('master','doctorate')),
  exam_set_code text not null,
  combination_code text,
  subject_code text not null,
  course_definition_code text not null,
  coefficient_scope text not null check (coefficient_scope in ('exam_component','subject','course','learning_only')),
  official_coefficient numeric check (official_coefficient is null or official_coefficient >= 0),
  learning_priority_weight numeric check (learning_priority_weight is null or (learning_priority_weight >= 0 and learning_priority_weight <= 100)),
  valid_from_year integer not null check (valid_from_year >= 1300),
  valid_until_year integer check (valid_until_year is null or valid_until_year >= valid_from_year),
  status text not null check (status in ('official_verified','reported','needs_check','proposed')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_academic_exam_assignments_lookup
  on academic_exam_course_assignments(exam_level, exam_set_code, combination_code, valid_from_year);

comment on table academic_tag_namespaces is 'AEL taxonomy namespaces; static content classification only.';
comment on table academic_tag_assignments is 'Tag-to-entity assignments; learner-specific state is stored elsewhere.';
comment on table academic_knowledge_relations is 'Semantic graph edges; curricular prerequisites remain in prerequisite_edges.';
comment on table academic_exam_course_assignments is 'Time-bounded mapping between exam scope, subject, course and separately scoped weights.';
