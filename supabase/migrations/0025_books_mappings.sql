-- 0025_books_mappings.sql — مأموریت v2 (Phase 2 + 4)
-- مدل واژه‌نامهٔ سند ۴: Book ≠ BookEdition ≠ ChapterStructure ≠ Topic.
-- Question ≠ QuestionAppearance. SubjectBookRelation ≠ QuestionChapterMapping.
-- هیچ مدل موازی: ExamSubject از 0019، skills/knowledge_nodes از 0001/0005،
-- materials از content_items/content_versions (0022) با kindهای تازه.

-- ============ Book — اثر کتاب‌شناختی مستقل از چاپ ============
create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  title_fa text,
  authors text,
  translators text,
  publisher text,
  isbn text,
  language text not null default 'fa',
  biblio_note text,
  merge_status text not null default 'unique' check (merge_status in ('unique','duplicate_candidate','merged_into')),
  merged_into_id uuid references books(id),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ BookEdition — چاپ/ویرایش مشخص (هرگز روی قبلی بازنویسی نمی‌شود) ============
create table if not exists book_editions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  slug text not null unique,
  edition_number int,
  print_number int,
  publication_year text,
  validity_from date,
  validity_until date,
  source_file_hash text,
  source_url text,
  source_retrieved_at timestamptz,
  rights_status text not null default 'unknown' check (rights_status in ('unknown','pending_review','restricted_internal','authorized','denied','expired')),
  diff_note text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, edition_number, print_number)
);

-- ============ ساختار کتاب — Tree چندسطحی بدون عمق ثابت ============
create table if not exists book_structure_nodes (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references book_editions(id) on delete cascade,
  parent_id uuid references book_structure_nodes(id) on delete cascade,
  node_kind text not null check (node_kind in ('part','chapter','section','subsection','appendix','other')),
  display_number text,
  title text not null,
  alternate_title text,
  position int not null default 1,
  page_start int,
  page_end int,
  source_locator text,
  structure_status text not null default 'pending' check (structure_status in ('verified','pending','unknown')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_book_nodes_edition on book_structure_nodes(edition_id);
create index if not exists idx_book_nodes_parent on book_structure_nodes(parent_id);

-- تاریخچهٔ ساختار (جابه‌جایی/تغییر نام/ادغام/تقسیم — سند ۵٫۵)
create table if not exists book_structure_history (
  id bigint generated always as identity primary key,
  node_id uuid not null references book_structure_nodes(id) on delete cascade,
  change_kind text not null check (change_kind in ('created','renamed','moved','merged','split','deleted','status_changed')),
  before jsonb,
  after jsonb,
  changed_by text,
  changed_at timestamptz not null default now()
);

-- ============ رابطهٔ درس آزمون با کتاب (چهار نوع مستقل — سند ۵٫۱) ============
create table if not exists subject_book_relations (
  id uuid primary key default gen_random_uuid(),
  subject_code text not null references exam_subjects(code),
  book_id uuid not null references books(id) on delete cascade,
  edition_id uuid references book_editions(id) on delete set null,
  relation_kind text not null check (relation_kind in (
    'official_reference','recommended_reference','commonly_used_reference',
    'historically_related_reference','supplementary_reference')),
  program_code text references programs(code),
  valid_from_year text,
  valid_until_year text,
  evidence_id uuid references source_versions(id),
  evidence_locator text,
  decision_status text not null default 'pending_review' check (decision_status in (
    'draft','pending_review','approved','rejected','conflicted')),
  rationale text,
  decided_by text,
  decided_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_code, book_id, relation_kind, valid_from_year)
);

-- ============ QuestionAppearance — ظهور سؤال در آزمون ============
create table if not exists question_appearances (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references questions(id),
  event_version_id text references exam_event_versions(id),
  year_label text,
  booklet_code text,
  question_number int,
  section_label text,
  source_id uuid references sources(id),
  source_version_id uuid references source_versions(id),
  entry_status text not null default 'pending_review' check (entry_status in (
    'draft','pending_review','verified','conflicted','rejected')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, event_version_id, booklet_code, question_number)
);

-- ============ نگاشت ظهور سؤال به فصل/مبحث (سند ۶) ============
create table if not exists question_chapter_mappings (
  id uuid primary key default gen_random_uuid(),
  appearance_id uuid not null references question_appearances(id) on delete cascade,
  node_id uuid references book_structure_nodes(id) on delete cascade,
  topic_id text references knowledge_nodes(id),
  skill_id text references skills(id),
  edition_id uuid references book_editions(id),
  edition_known boolean not null default true,  -- نگاشت به Edition نامعلوم = false (Q-06)
  relation_kind text not null default 'candidate_ai_or_editor' check (relation_kind in (
    'direct_source_verified','curriculum_topic_verified','historical_pattern',
    'candidate_ai_or_editor','conflicted','rejected','unmapped')),
  review_status text not null default 'pending_review' check (review_status in (
    'draft','pending_review','approved','needs_changes','rejected','conflicted')),
  similarity_score numeric check (similarity_score between 0 and 1),
  scientific_confidence text check (scientific_confidence in ('low','medium','high')),
  evidence_id uuid references source_versions(id),
  evidence_locator text,
  evidence_note text,
  mapped_by text,
  mapped_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists idx_qcm_appearance on question_chapter_mappings(appearance_id);
create index if not exists idx_qcm_node on question_chapter_mappings(node_id);

-- گارد: verified علمی بدون Evidence ممنوع (E-09 / بخش ۲۰ بند ۲۳)
create or replace function assert_mapping_evidence() returns trigger as $$
begin
  if new.review_status = 'approved' and new.relation_kind = 'direct_source_verified' and new.evidence_id is null then
    raise exception 'MAPPING_EVIDENCE_REQUIRED: منشأ مستقیم بدون Evidence تأیید نمی‌شود';
  end if;
  if new.review_status = 'approved' and new.mapped_by is not null and new.reviewed_by is not null and new.mapped_by = new.reviewed_by then
    raise exception 'MAPPING_SELF_APPROVAL: نگاشت‌دهنده و بازبین باید متفاوت باشند';
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_mapping_evidence on question_chapter_mappings;
create trigger trg_mapping_evidence before insert or update on question_chapter_mappings
  for each row execute function assert_mapping_evidence();

-- ============ LearningMaterial — گسترش content_items موجود (بدون مدل موازی) ============
-- kindهای تازهٔ مادهٔ آموزشی فصل (سند ۷٫۱) + اتصال به node کتاب
alter table content_items drop constraint if exists content_items_kind_check;
alter table content_items add constraint content_items_kind_check check (kind in (
  'course','lesson','topic_note','concept','mcq','essay','worked_example','formula_card','flashcard',
  'remedial_explanation','rubric','study_guide',
  'chapter_intro','summary','definitions','formulas','key_points','exam_traps','practice_questions',
  'flashcards','reading_guide'));

alter table content_items add column if not exists book_node_id uuid references book_structure_nodes(id) on delete set null;
alter table content_items add column if not exists topic_ids jsonb not null default '[]'::jsonb;

-- ============ RLS: Default Deny ============
do $$
declare t text;
begin
  foreach t in array array[
    'books','book_editions','book_structure_nodes','book_structure_history',
    'subject_book_relations','question_appearances','question_chapter_mappings'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;
