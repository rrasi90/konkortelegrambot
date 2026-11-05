-- 0022_review_release_catalog.sql — AEL فاز ۵ (AEL-501..509)
-- محتوای نسخه‌دار، صف بازبینی، Immutable Release و کاتالوگ پویا (ADR-006/003).
-- RLS: Default Deny برای anon؛ دانش‌آموز فقط از Published Snapshot/نما می‌خواند.

-- ============ محتوا و نسخهٔ آن ============
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'course','lesson','topic_note','concept','mcq','essay','worked_example',
    'formula_card','flashcard','remedial_explanation','rubric','study_guide')),
  slug text not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','superseded','rejected')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  version_number int not null,
  status text not null default 'draft' check (status in (
    'draft','proposed','pending_review','approved','published','superseded','rejected','quarantined','revoked')),
  body jsonb not null,
  content_hash text not null,
  previous_version_id uuid references content_versions(id),
  change_reason text,
  source_ids jsonb not null default '[]'::jsonb,
  scientific_approved_by text,
  scientific_approved_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_item_id, version_number)
);
create index if not exists idx_content_versions_status on content_versions(status);

-- ============ صف‌های بازبینی (AEL-501) ============
create table if not exists review_tasks (
  id uuid primary key default gen_random_uuid(),
  task_kind text not null check (task_kind in (
    'scientific','answer_key','mapping','rights','ocr_structure','editorial','publish','user_report')),
  content_version_id uuid references content_versions(id) on delete cascade,
  source_version_id uuid references source_versions(id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending','in_progress','approved','needs_changes','rejected','escalated','cancelled')),
  severity text not null default 'normal' check (severity in ('low','normal','high','critical')),
  payload jsonb not null default '{}'::jsonb,
  assigned_to text,
  decided_by text,
  decision_note text,
  decided_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_review_tasks_kind_status on review_tasks(task_kind, status);

-- ============ Release immutable (AEL-507) ============
create table if not exists content_releases (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'draft' check (status in ('draft','staged','published','superseded','rolled_back')),
  notes text,
  created_by text,
  staged_at timestamptz,
  published_at timestamptz,
  published_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists release_items (
  release_id uuid not null references content_releases(id) on delete cascade,
  content_version_id uuid not null references content_versions(id) on delete cascade,
  added_by text,
  added_at timestamptz not null default now(),
  primary key (release_id, content_version_id)
);

-- اشاره‌گر فعال کاتالوگ — Rollback فقط این اشاره‌گر را جابه‌جا می‌کند (ADR-006)
create table if not exists catalog_state (
  id int primary key default 1 check (id = 1),
  active_release_id uuid references content_releases(id),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Snapshot انتشارشده — مبنای Offline Bundle و Fallback در outage (AEL-508)
create table if not exists published_snapshots (
  release_id uuid primary key references content_releases(id) on delete cascade,
  content_hash text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- ============ اعتبارسنجی Publish سمت DB ============
create or replace function assert_release_publishable(p_release_id uuid) returns text as $$
declare
  unapproved int;
  unknown_rights int;
begin
  select count(*) into unapproved
  from release_items ri
  join content_versions cv on cv.id = ri.content_version_id
  where ri.release_id = p_release_id
    and cv.scientific_approved_by is null;
  if unapproved > 0 then
    raise exception 'PUBLISH_GATE_SCIENTIFIC: % ماده بدون تأیید علمی است', unapproved;
  end if;

  -- حقوق منابع هر ماده باید authorized باشد (ADR-004 — Fail-closed)
  select count(*) into unknown_rights
  from release_items ri
  join content_versions cv on cv.id = ri.content_version_id,
  jsonb_array_elements_text(cv.source_ids) as sid
  where ri.release_id = p_release_id
    and not exists (
      select 1 from source_rights_decisions rd
      where rd.source_version_id::text = sid and rd.status = 'authorized'
    );
  if unknown_rights > 0 then
    raise exception 'PUBLISH_GATE_RIGHTS: % ارجاع منبع با حقوق authorized نیست', unknown_rights;
  end if;
  return 'ok';
end $$ language plpgsql;

-- ============ RLS ============
do $$
declare
  t text;
  tables text[] := array[
    'content_items','content_versions','review_tasks',
    'content_releases','release_items','catalog_state','published_snapshots'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- دانش‌آموز فقط Snapshot منتشرشده را می‌خواند؛ جداول مدیریتی برای anon بسته‌اند.
create policy read_published_snapshots on published_snapshots
  for select using (true);
