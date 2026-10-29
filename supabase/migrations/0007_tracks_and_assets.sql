-- 0007_tracks_and_assets.sql
-- ۱) باز کردن constraint هاردکد گرایش‌ها برای پشتیبانی از بسته‌های آزمون آینده
alter table knowledge_nodes drop constraint if exists knowledge_nodes_track_check;

-- ۲) جدول دارایی‌های یادگیری (درسنامه‌ها) — جداسازی هسته از بستهٔ محتوا
create table if not exists learning_assets (
  id text primary key,
  node_prefix text not null,
  course text not null,
  course_title text not null,
  chapter text not null,
  topic text not null,
  konkoor_weight numeric not null default 0.5,
  frequency text not null default 'medium',
  summary text not null,
  konkoor_tips jsonb not null default '[]'::jsonb,
  key_terms jsonb not null default '[]'::jsonb,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','demo')),
  created_at timestamptz not null default now()
);
create index if not exists learning_assets_node_prefix_idx on learning_assets (node_prefix);
create index if not exists learning_assets_course_idx on learning_assets (course);

alter table learning_assets enable row level security;
create policy read_learning_assets on learning_assets for select
  using (verification_status in ('verified','demo'));

grant select on learning_assets to authenticated, anon;

-- ۳) ستون‌های جدید کارت‌های مرور برای موتور FSRS و کارت مقایسه
alter table review_cards add column if not exists fsrs_state jsonb;
alter table review_cards add column if not exists comparison_skills jsonb;
alter table review_cards add column if not exists is_proof boolean not null default false;
