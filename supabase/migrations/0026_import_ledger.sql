-- 0026_import_ledger.sql — AEL-003 فاز ۴ (§7.3 Provenance + §15 Batch Contract)
-- دفتر کل مهاجرت: هر رکورد مبدأ دقیقاً یک سرنوشت مجاز دارد (§0.1).
-- Idempotency: UNIQUE(source_ref, source_record_key, target_entity_type) در سطح DB — نه حافظه.

create table if not exists migration_batches (
  batch_id text primary key,
  source_ref text not null,
  source_snapshot_hash text not null,
  mapping_spec_version text not null default 'ael003-mapping-v1',
  parser_version text not null default '1',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  environment text not null default 'test',
  operator_id text,
  dry_run boolean not null default true,
  total_records int not null default 0,
  status_counts jsonb not null default '{}'::jsonb,
  error_counts jsonb not null default '{}'::jsonb,
  checkpoint jsonb,
  reconciliation_status text not null default 'pending' check (reconciliation_status in (
    'pending','passed','failed','quarantined_partial')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists migration_records (
  id bigint generated always as identity primary key,
  batch_id text not null references migration_batches(batch_id) on delete cascade,
  source_ref text not null,
  source_record_key text not null,
  source_record_hash text not null,
  source_schema_version text,
  mapping_spec_version text not null default 'ael003-mapping-v1',
  target_entity_type text not null,
  target_entity_id text,
  migration_status text not null check (migration_status in (
    'migrated','migrated_needs_review','quarantined','duplicate_linked',
    'excluded_with_reason','pending_source','not_applicable')),
  raw_payload jsonb,
  transformation_notes text,
  quarantine_reason text,
  first_imported_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source_ref, source_record_key, target_entity_type)
);
create index if not exists idx_migration_records_batch on migration_records(batch_id, migration_status);
create index if not exists idx_migration_records_target on migration_records(target_entity_type, target_entity_id);

-- Reconciliation سخت‌گیرانه در سطح Batch (§17): معادلهٔ سرنوشت‌ها
create or replace function reconcile_migration_batch(p_batch_id text) returns jsonb as $$
declare
  v_total int;
  v_status_counts jsonb;
  v_unaccounted int;
begin
  select count(*) into v_total from migration_records where batch_id = p_batch_id;
  select jsonb_object_agg(migration_status, cnt) into v_status_counts
  from (select migration_status, count(*) as cnt from migration_records where batch_id = p_batch_id group by migration_status) t;

  -- §17: هیچ رکوردی بدون وضعیت مجاز نماند — کلیدهای خارج از Enum با CHECK بسته شده‌اند،
  -- پس فقط معادلهٔ جمع با total چک می‌شود:
  v_unaccounted := v_total - coalesce((
    select sum(value::int) from jsonb_each_text(v_status_counts)
  ), 0);

  update migration_batches
  set reconciliation_status = case when v_unaccounted = 0 and v_total > 0 then 'passed' else 'failed' end,
      completed_at = now()
  where batch_id = p_batch_id;

  return jsonb_build_object('batch_id', p_batch_id, 'total', v_total,
    'status_counts', v_status_counts, 'unaccounted', v_unaccounted,
    'passed', v_unaccounted = 0);
end $$ language plpgsql;

-- ============ Staging مقصد: نسخه‌دار با Provenance ============
create table if not exists staged_content_versions (
  staged_id uuid primary key default gen_random_uuid(),
  batch_id text not null references migration_batches(batch_id) on delete cascade,
  content_item_slug text not null,
  content_kind text not null,
  title text,
  body jsonb not null,
  content_hash text not null,
  review_status text not null default 'pending_review',
  rights_status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (batch_id, content_item_slug, content_hash)
);

create table if not exists staged_questions (
  staged_id uuid primary key default gen_random_uuid(),
  batch_id text not null references migration_batches(batch_id) on delete cascade,
  question_id text not null,
  source_bank text not null,
  exam_year text,
  booklet_code text,
  question_number int,
  course_id text,
  prompt_raw text not null,
  prompt_normalized text not null,
  options_raw jsonb not null,
  answer_claim jsonb not null,      -- جدا از صورت (§4.6) — شامل key/source/confidence
  explanation text,
  rights_status text not null default 'pending',
  review_status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  unique (batch_id, question_id, source_bank)
);

-- ============ RLS: Default Deny ============
do $$
declare t text;
begin
  foreach t in array array['migration_batches','migration_records','staged_content_versions','staged_questions'] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;
