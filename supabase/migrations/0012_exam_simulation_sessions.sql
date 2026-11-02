-- 0012_exam_simulation_sessions.sql — Phase 4 §8.7 شبیه‌سازی آزمون بر پایهٔ ساختار رسمی
-- جلسه، برگهٔ پاسخ و پاسخ‌های آزمون دکتری/ارشد جدا نگه داشته می‌شوند؛
-- پاسخ شبیه‌سازی شاهدِ تسلط نیست و در تسلط کاربر دست نمی‌خورد.
-- نوشتن فقط از سمت Worker (service_role) انجام می‌شود؛ کاربر فقط rows خودش را می‌خواند (RLS).

-- ۱) مبدأ محتوای سؤال — بدون این برچسب‌ها، جلسه «ساخته‌شده از دفترچهٔ رسمی» معرفی نمی‌شود
alter table questions add column if not exists exam_level text check (exam_level in ('doctorate','master'));
alter table questions add column if not exists content_origin text check
  (content_origin in ('official_booklet','textbook_designed','synthetic_demo'));

-- ۲) جلسهٔ شبیه‌سازی
create table if not exists exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  level text not null check (level in ('doctorate','master')),
  exam_year int not null check (exam_year between 1390 and 1420),
  sub_group_id text not null,
  booklet_code text not null,
  status text not null default 'active' check (status in ('active','submitted','scored')),
  -- عکسِ برنامهٔ جلسه (ساختار رسمی + تخصیص + افشاها) تا نمره‌دهی بازتولیدپذیر بماند
  plan_snapshot jsonb not null default '{}'::jsonb,
  disclosures jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 hours'),
  submitted_at timestamptz,
  report jsonb,
  created_at timestamptz not null default now()
);
create index if not exists exam_sessions_user_idx on exam_sessions (user_id, created_at desc);

-- ۳) برگهٔ پاسخ جلسه (هر آیتم یک بلیتِ تک‌مصرف دارد)
create table if not exists exam_session_items (
  session_id uuid not null references exam_sessions(id) on delete cascade,
  question_id text not null references questions(id) on delete cascade,
  section_id text not null check (section_id in ('specialization','language','aptitude')),
  question_number int not null,
  attempt_id text not null unique,
  primary key (session_id, question_id)
);
create index if not exists exam_session_items_session_idx on exam_session_items (session_id);

-- ۴) پاسخ‌های ثبت‌شدهٔ جلسه (درستی سمت سرور محاسبه می‌شود)
create table if not exists exam_session_responses (
  session_id uuid not null references exam_sessions(id) on delete cascade,
  question_id text not null references questions(id) on delete cascade,
  selected_option int not null,
  is_correct boolean not null,
  response_time_ms int,
  answered_at timestamptz not null default now(),
  primary key (session_id, question_id)
);

-- ۵) ثبت اتمیک پاسخ شبیه‌سازی: بلیت تک‌مصرف + مالکیت + انقضا + کلید سمت سرور
create or replace function record_exam_simulation_response(
  p_user_id uuid,
  p_session_id uuid,
  p_attempt_id text,
  p_question_id text,
  p_selected_option int,
  p_response_time_ms int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket attempt_tickets%rowtype;
  v_session exam_sessions%rowtype;
  v_item exam_session_items%rowtype;
  v_correct int;
  v_options jsonb;
begin
  select * into v_session from exam_sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Exam session not found' using errcode = '45001';
  end if;
  if v_session.user_id <> p_user_id then
    raise exception 'Exam session belongs to another user' using errcode = '45003';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Exam session is not active' using errcode = '45009';
  end if;
  if v_session.expires_at < now() then
    raise exception 'Exam session expired' using errcode = '45006';
  end if;

  select * into v_ticket from attempt_tickets where attempt_id = p_attempt_id for update;
  if v_ticket.attempt_id is null then
    raise exception 'Attempt ticket not found' using errcode = '45007';
  end if;
  if v_ticket.user_id <> p_user_id then
    raise exception 'Attempt ticket belongs to another user' using errcode = '45003';
  end if;
  if v_ticket.question_id <> p_question_id then
    raise exception 'Attempt ticket question mismatch' using errcode = '45004';
  end if;
  if v_ticket.attempt_type <> 'exam_simulation' then
    raise exception 'Attempt ticket is not an exam simulation ticket' using errcode = '45010';
  end if;
  if v_ticket.consumed_at is not null then
    raise exception 'Attempt ticket already consumed' using errcode = '45005';
  end if;
  if v_ticket.expires_at < now() then
    raise exception 'Attempt ticket expired' using errcode = '45006';
  end if;

  select * into v_item from exam_session_items
    where session_id = p_session_id and question_id = p_question_id;
  if v_item.question_id is null then
    raise exception 'Question is not part of this exam session' using errcode = '45011';
  end if;
  if v_item.attempt_id <> p_attempt_id then
    raise exception 'Attempt ticket does not match session item' using errcode = '45004';
  end if;

  if exists (select 1 from exam_session_responses
             where session_id = p_session_id and question_id = p_question_id) then
    raise exception 'Question already answered in this exam session' using errcode = '45012';
  end if;

  select q.correct_option, q.options into v_correct, v_options from questions q where q.id = p_question_id;
  if v_correct is null then
    raise exception 'Question not found' using errcode = '45001';
  end if;
  if p_selected_option is null
     or p_selected_option < 0
     or p_selected_option >= jsonb_array_length(v_options) then
    raise exception 'Selected option is outside the question options' using errcode = '45008';
  end if;

  insert into exam_session_responses (
    session_id, question_id, selected_option, is_correct, response_time_ms, answered_at
  ) values (
    p_session_id, p_question_id, p_selected_option, (p_selected_option = v_correct), p_response_time_ms, now()
  );

  update attempt_tickets set consumed_at = now() where attempt_id = p_attempt_id;

  return jsonb_build_object('recorded', true);
end
$$;

-- RLS: کاربر فقط rows خودش را می‌خواند؛ نوشتن فقط service_role (از لایهٔ worker)
alter table exam_sessions enable row level security;
alter table exam_session_items enable row level security;
alter table exam_session_responses enable row level security;

drop policy if exists read_own_exam_sessions on exam_sessions;
create policy read_own_exam_sessions on exam_sessions for select to authenticated using (auth.uid() = user_id);
drop policy if exists read_own_exam_session_items on exam_session_items;
create policy read_own_exam_session_items on exam_session_items for select to authenticated
  using (exists (select 1 from exam_sessions s where s.id = session_id and s.user_id = auth.uid()));
drop policy if exists read_own_exam_session_responses on exam_session_responses;
create policy read_own_exam_session_responses on exam_session_responses for select to authenticated
  using (exists (select 1 from exam_sessions s where s.id = session_id and s.user_id = auth.uid()));

grant select on exam_sessions, exam_session_items, exam_session_responses to authenticated;
revoke all on function record_exam_simulation_response(uuid, uuid, text, text, int, int) from public, anon, authenticated;
grant execute on function record_exam_simulation_response(uuid, uuid, text, text, int, int) to service_role;
grant all on all tables in schema public to service_role;
