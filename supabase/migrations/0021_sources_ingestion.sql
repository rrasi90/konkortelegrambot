-- 0021_sources_ingestion.sql — AEL فاز ۳ (AEL-301..312)
-- Source Library خصوصی با نسخه، Hash، حقوق جدا به تفکیک نوع استفاده،
-- و Job Orchestration ورود محتوا (Lease/Retry/Quarantine). RLS = Default Deny برای anon.

-- ============ منبع و نسخه ============
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  kind text not null default 'other' check (kind in ('book','booklet','article','lecture_note','exam_pack','answer_key','other')),
  language text not null default 'fa',
  authors text,
  publisher text,
  isbn_doi text,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  version_number int not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  page_count int,
  content_hash text,
  previous_version_id uuid references source_versions(id),
  change_reason text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, version_number)
);

create table if not exists source_files (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references source_versions(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text not null,
  -- فاز اول: محتوای متنی خصوصی در DB (service-role فقط)؛ انتقال به Object Storage خصوصی = AEL-802
  content_text text,
  content_base64 text,
  storage_path text,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);
create index if not exists idx_source_files_version on source_files(source_version_id);

-- ============ حقوق — هر نوع استفاده جدا (ADR-004) ============
create table if not exists source_rights_decisions (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references source_versions(id) on delete cascade,
  use_type text not null check (use_type in (
    'metadata','internal_extraction','derived_content','excerpt_display','full_text_display',
    'image_reproduction','offline_bundle','external_ai_processing','public_republishing')),
  status text not null default 'unknown' check (status in ('unknown','pending_review','restricted_internal','authorized','denied','expired')),
  license text,
  territory text,
  decided_by text,
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_version_id, use_type)
);

-- ============ صف پردازش ورود ============
create table if not exists ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references source_versions(id) on delete cascade,
  adapter text not null check (adapter in ('markdown','plaintext','json','csv','pdf_text','pdf_scanned_ocr','docx')),
  status text not null default 'queued' check (status in (
    'queued','leased','running','awaiting_external','awaiting_review',
    'succeeded','partial_success','retryable_failed','terminal_failed','cancelled')),
  attempt int not null default 0,
  max_attempts int not null default 5,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  idempotency_key text not null unique,
  settings jsonb not null default '{}'::jsonb,
  last_error text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ingestion_jobs_status on ingestion_jobs(status);

create table if not exists ingestion_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references ingestion_jobs(id) on delete cascade,
  kind text not null check (kind in ('normalized_document','ocr_raw','extraction_report','error_report')),
  content jsonb,
  sha256 text,
  created_at timestamptz not null default now()
);

-- ============ صفحات و بخش‌های نرمال‌شده ============
create table if not exists document_pages (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references source_versions(id) on delete cascade,
  page_number int not null,
  confidence numeric not null default 1 check (confidence between 0 and 1),
  quarantined boolean not null default false,
  quarantine_reason text,
  created_at timestamptz not null default now(),
  unique (source_version_id, page_number)
);

create table if not exists document_segments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references document_pages(id) on delete cascade,
  kind text not null check (kind in ('heading','paragraph','table','figure','formula','footnote','list_item')),
  ordinal int not null,
  text text not null,
  locator jsonb not null,
  confidence numeric not null default 1 check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);
create index if not exists idx_document_segments_page on document_segments(page_id);

-- ============ RLS: Default Deny برای anon (سرویس با service_role) ============
do $$
declare
  t text;
  tables text[] := array[
    'sources','source_versions','source_files','source_rights_decisions',
    'ingestion_jobs','ingestion_artifacts','document_pages','document_segments'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;
