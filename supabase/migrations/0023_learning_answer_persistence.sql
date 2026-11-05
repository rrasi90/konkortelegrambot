-- 0023_learning_answer_persistence.sql — AEL-610/612 + اتصال پایدار Engine (ADR-010/011)
-- رفع مشکل C سند Playbook: پاسخ مسیر تألیفی باید پایدار، Idempotent و نسخه‌پین باشد.
-- تراکنش واحد: بلیت نشست + رخداد پاسخ + تسلط مبحث + کارت مرور FSRS (حداکثر یک‌بار).

create table if not exists learning_quiz_attempts (
  id text primary key,                       -- attemptId صادرشدهٔ سمت سرور
  user_id uuid not null references app_users(id) on delete cascade,
  course_id text not null,
  course_version text not null,              -- Session Pinning (AT-AEL-25)
  release_id text,                           -- Release فعال در لحظهٔ شروع (Pin)
  mode text not null check (mode in ('practice','diagnostic','timed')),
  question_ids jsonb not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'open' check (status in ('open','finished','expired')),
  created_at timestamptz not null default now()
);
create index if not exists idx_learning_attempts_user on learning_quiz_attempts(user_id, status);

create table if not exists learning_answer_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  operation_id text not null,
  attempt_id text not null references learning_quiz_attempts(id) on delete cascade,
  course_id text not null,
  course_version text not null,
  question_id text not null,
  topic_id text not null,
  selected int,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  -- ADR-011: عملیات تکرارپذیر پایدار — نه حافظهٔ Isolate
  unique (user_id, operation_id)
);
create index if not exists idx_learning_answer_events_user_time on learning_answer_events(user_id, answered_at);

-- تسلط مبحث تألیفی — Engine مرجع محاسبه است؛ SQL فقط ثبت می‌کند (ADR-010)
create table if not exists authored_topic_mastery (
  user_id uuid not null references app_users(id) on delete cascade,
  course_id text not null,
  topic_id text not null,
  mastery numeric not null default 50 check (mastery between 0 and 100),
  correct_count int not null default 0,
  wrong_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, topic_id)
);

-- کارت مرور FSRS برای مبحث تألیفی — نسخه‌دار با سیاست FSRS_POLICY
create table if not exists authored_review_cards (
  user_id uuid not null references app_users(id) on delete cascade,
  course_id text not null,
  topic_id text not null,
  stability numeric not null default 0,
  difficulty numeric not null default 5,
  reps int not null default 0,
  lapses int not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  policy_version text not null default 'fsrs-v1',
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, topic_id)
);

-- ============ RPC اتمیک ثبت پاسخ تألیفی ============
create or replace function submit_learning_answer_secure(
  p_attempt_id text,
  p_question_id text,
  p_selected int,
  p_operation_id text,
  p_is_correct boolean,
  p_topic_id text,
  p_mastery numeric,
  p_fsrs_stability numeric default null,
  p_fsrs_difficulty numeric default null,
  p_fsrs_due_days int default null
) returns jsonb as $$
declare
  v_attempt learning_quiz_attempts;
  v_replay boolean := false;
begin
  -- ۱) بلیت متعلق به کاربر فراخوان و باز و معتبر باشد (عدم اعتماد به کلاینت)
  select * into v_attempt from learning_quiz_attempts
    where id = p_attempt_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND_OR_FOREIGN';
  end if;
  if v_attempt.status <> 'open' then
    raise exception 'ATTEMPT_CLOSED';
  end if;
  if now() > v_attempt.expires_at then
    update learning_quiz_attempts set status = 'expired' where id = p_attempt_id;
    raise exception 'ATTEMPT_EXPIRED';
  end if;
  if v_attempt.course_version is null then
    raise exception 'ATTEMPT_UNVERSIONED';
  end if;
  if not (p_question_id = any (select jsonb_array_elements_text(v_attempt.question_ids))) then
    raise exception 'QUESTION_NOT_IN_ATTEMPT';
  end if;

  -- ۲) Idempotency پایدار: همان (user, operation) = همان نتیجه؛ تکرار با محتوای متفاوت ممنوع
  begin
    insert into learning_answer_events (
      user_id, operation_id, attempt_id, course_id, course_version,
      question_id, topic_id, selected, is_correct
    ) values (
      auth.uid(), p_operation_id, p_attempt_id, v_attempt.course_id, v_attempt.course_version,
      p_question_id, p_topic_id, p_selected, p_is_correct
    );
  exception when unique_violation then
    select (is_correct = p_is_correct and selected is not distinct from p_selected)
      into v_replay
      from learning_answer_events
     where user_id = auth.uid() and operation_id = p_operation_id;
    if not v_replay then
      raise exception 'OPERATION_CONFLICT';
    end if;
    return jsonb_build_object('replay', true);
  end;

  -- ۳) تسلط مبحث — فقط یک‌بار در همین تراکنش (ADR-010: بدون الگوریتم دوم SQL)
  insert into authored_topic_mastery (user_id, course_id, topic_id, mastery, correct_count, wrong_count)
  values (auth.uid(), v_attempt.course_id, p_topic_id, p_mastery, case when p_is_correct then 1 else 0 end,
          case when p_is_correct then 0 else 1 end)
  on conflict (user_id, course_id, topic_id) do update set
    mastery = excluded.mastery,
    correct_count = authored_topic_mastery.correct_count + excluded.correct_count,
    wrong_count = authored_topic_mastery.wrong_count + excluded.wrong_count,
    updated_at = now();

  -- ۴) کارت مرور FSRS — فقط با رخداد معتبر و سیاست نسخه‌دار
  if p_fsrs_due_days is not null then
    insert into authored_review_cards (user_id, course_id, topic_id, stability, difficulty, reps, due_at, last_reviewed_at, policy_version)
    values (auth.uid(), v_attempt.course_id, p_topic_id,
            coalesce(p_fsrs_stability, 0), coalesce(p_fsrs_difficulty, 5), 1,
            now() + make_interval(days => greatest(p_fsrs_due_days, 0)), now(), 'fsrs-v1')
    on conflict (user_id, course_id, topic_id) do update set
      stability = excluded.stability,
      difficulty = excluded.difficulty,
      reps = authored_review_cards.reps + 1,
      due_at = excluded.due_at,
      last_reviewed_at = now(),
      updated_at = now();
  end if;

  return jsonb_build_object('replay', false);
end $$ language plpgsql security definer;

-- ============ RLS ============
do $$
declare t text;
begin
  foreach t in array array['learning_quiz_attempts','learning_answer_events','authored_topic_mastery','authored_review_cards'] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

create policy read_own_learning_attempts on learning_quiz_attempts
  for select to authenticated using (user_id = auth.uid());
create policy read_own_learning_answers on learning_answer_events
  for select to authenticated using (user_id = auth.uid());
create policy read_own_topic_mastery on authored_topic_mastery
  for select to authenticated using (user_id = auth.uid());
create policy read_own_review_cards on authored_review_cards
  for select to authenticated using (user_id = auth.uid());
