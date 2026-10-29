-- 0003_security_attempts_atomic_answers.sql
-- Security and consistency hardening. All writes are performed by the Worker service role.
begin;

-- Never expose answer keys through the public PostgREST table endpoint.
revoke select on table public.questions from anon, authenticated;
drop policy if exists read_questions on public.questions;

-- Public question projection without answer keys is defined in 0003_security_atomic_learning.sql.

-- Durable, short-lived attempts. A client may answer only a question the server issued.
create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  attempt_id text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint question_attempts_user_attempt_unique unique (user_id, attempt_id),
  constraint question_attempts_expiry_after_issue check (expires_at > issued_at)
);
create index if not exists question_attempts_recent_idx
  on public.question_attempts(user_id, question_id, issued_at desc);
alter table public.question_attempts add column if not exists seen_before boolean not null default false;
alter table public.question_attempts add column if not exists item_version text not null default '1';
alter table public.question_attempts enable row level security;
revoke all on public.question_attempts from anon, authenticated;
grant all on public.question_attempts to service_role;

-- Normalize existing trap reviews to a stable, shared trap-asset ID.
-- The previous 0003 migration's trigger creates/verifies the asset and preserves
-- question_id; the partial unique index only applies to question-type cards.
insert into public.trap_cards (id, question_id, node_id, content)
select 'trap:' || q.id, q.id, q.node_id, q.trap_note
from public.questions q
where nullif(trim(q.trap_note), '') is not null
on conflict (id) do update
set question_id = excluded.question_id,
    node_id = excluded.node_id,
    content = excluded.content;
update public.review_cards
set trap_card_id = 'trap:' || question_id
where card_type = 'trap_note'
  and question_id is not null;

-- Add evidence fields to the immutable response-event record.
alter table public.answer_events
  add column if not exists response_time_ms integer,
  add column if not exists seen_before boolean not null default false,
  add column if not exists confidence_before smallint,
  add column if not exists assistance jsonb not null default '[]'::jsonb,
  add column if not exists study_mode text not null default 'desk',
  add column if not exists engine_version text not null default '0.2.0',
  add column if not exists item_version text not null default '1';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'answer_events_response_time_ms_check'
  ) then
    alter table public.answer_events add constraint answer_events_response_time_ms_check
      check (response_time_ms is null or response_time_ms between 0 and 3600000);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'answer_events_confidence_before_check'
  ) then
    alter table public.answer_events add constraint answer_events_confidence_before_check
      check (confidence_before is null or confidence_before between 1 and 5);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'answer_events_study_mode_check'
  ) then
    alter table public.answer_events add constraint answer_events_study_mode_check
      check (study_mode in ('desk', 'commute', 'exam'));
  end if;
end $$;

-- Issue/reuse one valid attempt for a queued question. Re-requests do not mint
-- unlimited fresh attempts while an issued token remains valid.
create or replace function public.issue_question_attempt(
  p_user_id uuid,
  p_question_id text,
  p_attempt_id text,
  p_ttl_seconds integer default 900,
  p_seen_before boolean default false,
  p_item_version text default '1'
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_count integer;
begin
  if p_ttl_seconds < 60 or p_ttl_seconds > 3600 then
    raise exception 'invalid attempt TTL' using errcode = '22023';
  end if;

  select qa.attempt_id into v_existing
  from public.question_attempts qa
  where qa.user_id = p_user_id
    and qa.question_id = p_question_id
    and qa.used_at is null
    and qa.expires_at > now()
  order by qa.issued_at desc
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  select count(*) into v_count
  from public.question_attempts qa
  where qa.user_id = p_user_id
    and qa.question_id = p_question_id
    and qa.issued_at > now() - interval '1 hour';
  if v_count >= 5 then
    raise exception 'attempt issuance limit reached' using errcode = 'P0001';
  end if;

  insert into public.question_attempts(user_id, question_id, attempt_id, expires_at, seen_before, item_version)
  values (p_user_id, p_question_id, p_attempt_id, now() + make_interval(secs => p_ttl_seconds), p_seen_before, coalesce(p_item_version, '1'));
  return p_attempt_id;
end;
$$;

-- A single transaction owns attempt consumption, response-event insertion, mastery,
-- cards (including global trap records) and incentive counters. A replay is a no-op.
create or replace function public.commit_answer(
  p_event jsonb,
  p_mastery jsonb,
  p_cards jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (p_event->>'user_id')::uuid;
  v_attempt_id text := p_event->>'attempt_id';
  v_question_id text := p_event->>'question_id';
  v_existing public.answer_events%rowtype;
  v_inserted uuid;
  v_answered_at timestamptz := coalesce((p_event->>'answered_at')::timestamptz, now());
  v_today date := (coalesce((p_event->>'answered_at')::timestamptz, now()) at time zone 'Asia/Tehran')::date;
  v_stats jsonb;
  v_card jsonb;
  v_source_question_id text;
  v_correct_option integer;
  v_options_count integer;
  v_track text;
begin
  select * into v_existing
  from public.answer_events
  where user_id = v_user_id and attempt_id = v_attempt_id;
  if found then
    select jsonb_build_object(
      'replay', true,
      'report', v_existing.ripple_report,
      'event', jsonb_build_object(
        'questionId', v_existing.question_id,
        'isCorrect', v_existing.is_correct,
        'attemptId', v_existing.attempt_id
      )
    ) into v_stats;
    return v_stats;
  end if;

  select q.correct_option, jsonb_array_length(q.options), n.track
    into v_correct_option, v_options_count, v_track
  from public.questions q
  join public.knowledge_nodes n on n.id = q.node_id
  where q.id = v_question_id and q.verification_status in ('verified', 'demo');
  if v_correct_option is null or v_options_count is null then
    raise exception 'question is not available for scoring' using errcode = '22023';
  end if;
  if (p_event->>'selected_option')::integer < 0 or (p_event->>'selected_option')::integer >= v_options_count then
    raise exception 'selected option out of range' using errcode = '22023';
  end if;
  if ((p_event->>'selected_option')::integer = v_correct_option) is distinct from ((p_event->>'is_correct')::boolean) then
    raise exception 'answer correctness does not match server key' using errcode = '22023';
  end if;
  if v_track <> 'common' and not exists (
    select 1 from public.app_users u where u.id = v_user_id and v_track = any(u.active_tracks)
  ) then
    raise exception 'question track is not active for this user' using errcode = '42501';
  end if;

  update public.question_attempts
  set used_at = now()
  where user_id = v_user_id
    and question_id = v_question_id
    and attempt_id = v_attempt_id
    and used_at is null
    and expires_at > now()
  returning id into v_inserted;
  if v_inserted is null then
    raise exception 'attempt missing, expired, or already used' using errcode = '22023';
  end if;

  insert into public.answer_events (
    id, user_id, question_id, selected_option, is_correct, attempt_id, answered_at, ripple_report,
    response_time_ms, seen_before, confidence_before, assistance, study_mode, engine_version, item_version
  ) values (
    coalesce((p_event->>'id')::uuid, gen_random_uuid()),
    v_user_id,
    v_question_id,
    (p_event->>'selected_option')::integer,
    (p_event->>'is_correct')::boolean,
    v_attempt_id,
    v_answered_at,
    p_event->'ripple_report',
    nullif(p_event->>'response_time_ms', '')::integer,
    coalesce((p_event->>'seen_before')::boolean, false),
    nullif(p_event->>'confidence_before', '')::smallint,
    coalesce(p_event->'assistance', '[]'::jsonb),
    coalesce(p_event->>'study_mode', 'desk'),
    coalesce(p_event->>'engine_version', '0.2.0'),
    coalesce(p_event->>'item_version', '1')
  ) returning id into v_inserted;

  for v_card in select value from jsonb_array_elements(coalesce(p_mastery, '[]'::jsonb))
  loop
    insert into public.user_node_mastery(user_id, node_id, mastery_score, status, last_error_at)
    values (
      v_user_id,
      v_card->>'nodeId',
      (v_card->>'mastery')::numeric,
      v_card->>'status',
      nullif(v_card->>'lastErrorAt', '')::timestamptz
    )
    on conflict (user_id, node_id) do update set
      mastery_score = excluded.mastery_score,
      status = excluded.status,
      last_error_at = coalesce(excluded.last_error_at, public.user_node_mastery.last_error_at);
  end loop;

  -- Create global trap content before cards reference it.
  for v_card in
    select distinct value from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb))
    where value->>'card_type' = 'trap_note'
  loop
    v_source_question_id := substring(v_card->>'trap_card_id' from 6);
    insert into public.trap_cards(id, question_id, node_id, content)
    select 'trap:' || q.id, q.id, q.node_id, q.trap_note
    from public.questions q
    where q.id = v_source_question_id
      and nullif(trim(q.trap_note), '') is not null
    on conflict (id) do update set
      content = excluded.content,
      node_id = excluded.node_id,
      question_id = excluded.question_id;
  end loop;

  for v_card in select value from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb))
  loop
    insert into public.review_cards(
      id, user_id, node_id, card_type, question_id, trap_card_id, due_at,
      interval_days, previous_interval_days, ease, is_repair, times_seen, times_correct
    ) values (
      v_card->>'id',
      v_user_id,
      v_card->>'node_id',
      v_card->>'card_type',
      nullif(v_card->>'question_id', ''),
      nullif(v_card->>'trap_card_id', ''),
      coalesce((v_card->>'due_at')::timestamptz, now()),
      coalesce((v_card->>'interval_days')::integer, 1),
      nullif(v_card->>'previous_interval_days', '')::integer,
      coalesce((v_card->>'ease')::numeric, 2.5),
      coalesce((v_card->>'is_repair')::boolean, false),
      coalesce((v_card->>'times_seen')::integer, 0),
      coalesce((v_card->>'times_correct')::integer, 0)
    )
    on conflict (id) do update set
      node_id = excluded.node_id,
      card_type = excluded.card_type,
      question_id = excluded.question_id,
      trap_card_id = excluded.trap_card_id,
      due_at = excluded.due_at,
      interval_days = excluded.interval_days,
      previous_interval_days = excluded.previous_interval_days,
      ease = excluded.ease,
      is_repair = excluded.is_repair,
      times_seen = excluded.times_seen,
      times_correct = excluded.times_correct;
  end loop;

  update public.app_users
  set
    coins = coalesce(coins, 0) + case when (p_event->>'is_correct')::boolean then 2 else 1 end,
    streak_days = case
      when last_study_date = v_today then coalesce(streak_days, 0)
      when last_study_date = v_today - 1 then coalesce(streak_days, 0) + 1
      else 1
    end,
    day_number = coalesce(day_number, 0) + case when last_study_date is distinct from v_today then 1 else 0 end,
    last_study_date = v_today
  where id = v_user_id
  returning jsonb_build_object(
    'userId', id,
    'coins', coalesce(coins, 0),
    'streakDays', coalesce(streak_days, 0),
    'lastStudyDate', last_study_date,
    'dayNumber', coalesce(day_number, 0),
    'examDate', exam_date
  ) into v_stats;

  return jsonb_build_object('replay', false, 'stats', v_stats);
end;
$$;

revoke all on function public.issue_question_attempt(uuid, text, text, integer, boolean, text) from public, anon, authenticated;
revoke all on function public.commit_answer(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.issue_question_attempt(uuid, text, text, integer, boolean, text) to service_role;
grant execute on function public.commit_answer(jsonb, jsonb, jsonb) to service_role;

-- Domain-neutral taxonomy: pack-defined slugs and semantic, provenance-aware edges.
alter table public.knowledge_nodes drop constraint if exists knowledge_nodes_track_check;
alter table public.knowledge_nodes add constraint knowledge_nodes_track_slug_check
  check (track ~ '^[a-z][a-z0-9_-]{1,39}
);
alter table public.node_dependencies drop constraint if exists node_dependencies_relation_check;
alter table public.node_dependencies add constraint node_dependencies_relation_semantic_check
  check (relation in ('prerequisite_of','confusable_with','applied_in','part_of','related_to','prerequisite','cross_course'));
alter table public.node_dependencies add column if not exists verification_status text not null default 'unverified'
  check (verification_status in ('unverified','verified','rejected'));
alter table public.node_dependencies add column if not exists source_ref text;
alter table public.node_dependencies add column if not exists confidence numeric check (confidence is null or confidence between 0 and 1);

commit;
