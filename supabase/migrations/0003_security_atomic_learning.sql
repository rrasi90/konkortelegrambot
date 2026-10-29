-- 0003_security_atomic_learning.sql
-- Close answer-key/user-data exposure, support valid trap cards, and atomically commit answers.
-- Apply after 0001 and 0002. RPCs are server-only and called using the Supabase service-role key.

begin;

-- Browser clients must never read answer keys or the private user table.
revoke all on public.questions from public, anon, authenticated;
revoke all on public.app_users from public, anon, authenticated;

drop view if exists public.public_questions;
create view public.public_questions
with (security_barrier = true)
as
select id, node_id, exam_year, question_text, options, explanation, trap_note, verification_status
from public.questions
where verification_status in ('verified', 'demo');
revoke all on public.public_questions from public;
grant select on public.public_questions to anon, authenticated;

-- A question card and a trap-note card may refer to the same source question.
alter table public.review_cards
  drop constraint if exists one_owner_per_question_card;
create unique index if not exists one_owner_per_question_card_idx
  on public.review_cards(user_id, question_id)
  where card_type = 'question' and question_id is not null;

-- Keep the immutable/raw answer log useful for diagnosis and model replay.
alter table public.answer_events add column if not exists response_time_ms integer
  check (response_time_ms is null or response_time_ms between 0 and 3600000);
alter table public.answer_events add column if not exists seen_before boolean not null default false;
alter table public.answer_events add column if not exists confidence_before integer
  check (confidence_before is null or confidence_before between 1 and 5);
alter table public.answer_events add column if not exists assistance jsonb not null default '[]'::jsonb;
alter table public.answer_events add column if not exists study_mode text not null default 'desk'
  check (study_mode in ('desk', 'commute', 'exam'));
alter table public.answer_events add column if not exists engine_version text not null default '0.2.0';
alter table public.answer_events add column if not exists item_version text not null default '1';

create table if not exists public.question_attempts (
  id text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  seen_before boolean not null default false,
  item_version text not null default '1',
  constraint question_attempt_expiry check (expires_at > issued_at)
);
create index if not exists question_attempts_user_question_idx
  on public.question_attempts(user_id, question_id, issued_at desc);
create index if not exists question_attempts_expiry_idx
  on public.question_attempts(expires_at) where used_at is null;
alter table public.question_attempts enable row level security;
revoke all on public.question_attempts from public, anon, authenticated;

-- Trap cards are globally stored learning assets with user-specific review schedules.
-- Insert the asset before the review-card FK is checked.
create or replace function public.ensure_trap_asset_for_review_card()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trap_note text;
  v_trap_asset_id text;
begin
  if new.card_type <> 'trap_note' then
    return new;
  end if;
  if new.question_id is null then
    raise exception 'trap_note review card must reference its source question';
  end if;

  select q.trap_note into v_trap_note
  from public.questions q
  where q.id = new.question_id and q.node_id = new.node_id;

  if v_trap_note is null or length(trim(v_trap_note)) = 0 then
    raise exception 'source question % has no trap note', new.question_id;
  end if;

  v_trap_asset_id := 'trap:' || new.question_id;
  insert into public.trap_cards(id, question_id, node_id, content)
  values (v_trap_asset_id, new.question_id, new.node_id, v_trap_note)
  on conflict (id) do update
    set content = excluded.content, node_id = excluded.node_id;
  new.trap_card_id := v_trap_asset_id;
  return new;
end;
$$;

drop trigger if exists trg_ensure_trap_asset on public.review_cards;
create trigger trg_ensure_trap_asset
before insert or update of card_type, question_id, trap_card_id, node_id
on public.review_cards
for each row execute function public.ensure_trap_asset_for_review_card();

-- Issue one short-lived attempt per question. Repeated queue refreshes reuse an
-- already-open attempt rather than minting unlimited answer attempts.
create or replace function public.issue_question_attempt(
  p_user_id uuid,
  p_question_id text,
  p_attempt_id text,
  p_ttl_seconds integer default 900,
  p_seen_before boolean default false,
  p_item_version text default '1'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_tracks text[];
  v_track text;
  v_existing public.question_attempts%rowtype;
  v_recent_used integer;
begin
  if p_attempt_id is null or length(p_attempt_id) < 8 or length(p_attempt_id) > 128 then
    raise exception 'invalid attempt id';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds < 30 or p_ttl_seconds > 3600 then
    raise exception 'invalid attempt ttl';
  end if;

  -- Serialize queue refreshes for the same learner/item so concurrent requests
  -- cannot issue parallel unused attempts for the exact same question.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_question_id, 0));

  select u.active_tracks, n.track
    into v_active_tracks, v_track
  from public.app_users u
  join public.questions q on q.id = p_question_id
  join public.knowledge_nodes n on n.id = q.node_id
  where u.id = p_user_id
    and q.verification_status in ('verified', 'demo');
  if not found then
    raise exception 'user or active question not found';
  end if;
  if v_track <> 'common' and not (v_track = any(coalesce(v_active_tracks, array['common']::text[]))) then
    raise exception 'question is outside active tracks';
  end if;

  select * into v_existing
  from public.question_attempts
  where user_id = p_user_id and question_id = p_question_id
    and used_at is null and expires_at > now()
  order by issued_at desc
  limit 1
  for update;
  if found then
    return v_existing.id;
  end if;

  select count(*) into v_recent_used
  from public.question_attempts
  where user_id = p_user_id and question_id = p_question_id
    and used_at >= now() - interval '1 hour';
  if v_recent_used >= 2 then
    raise exception 'attempt issuance limit reached';
  end if;

  insert into public.question_attempts(
    id, user_id, question_id, expires_at, seen_before, item_version
  ) values (
    p_attempt_id, p_user_id, p_question_id,
    now() + make_interval(secs => p_ttl_seconds),
    coalesce(p_seen_before, false),
    coalesce(nullif(p_item_version, ''), '1')
  );
  return p_attempt_id;
end;
$$;

-- Single transaction: consume the attempt, append the event, project mastery/cards,
-- and increment coins/streak. A consumed attempt replays without reapplying effects.
create or replace function public.commit_answer(
  p_event jsonb,
  p_mastery jsonb,
  p_cards jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (p_event->>'user_id')::uuid;
  v_question_id text := p_event->>'question_id';
  v_attempt_id text := p_event->>'attempt_id';
  v_selected integer := (p_event->>'selected_option')::integer;
  v_correct_option integer;
  v_is_correct boolean;
  v_attempt public.question_attempts%rowtype;
  v_existing public.answer_events%rowtype;
  v_inserted_id uuid;
  v_row jsonb;
  v_today date := (now() at time zone 'Asia/Tehran')::date;
  v_stats public.app_users%rowtype;
  v_report jsonb := coalesce(p_event->'ripple_report', '{}'::jsonb);
  v_event_state jsonb := p_event->'learner_skill_state';
  v_question_is_holdout boolean := false;
begin
  if v_user_id is null or v_question_id is null or v_attempt_id is null then
    raise exception 'missing answer identity';
  end if;

  select * into v_existing
  from public.answer_events
  where user_id = v_user_id and attempt_id = v_attempt_id;
  if found then
    select * into v_stats from public.app_users where id = v_user_id;
    return jsonb_build_object(
      'replay', true, 'report', v_existing.ripple_report,
      'stats', jsonb_build_object(
        'userId', v_stats.id, 'coins', v_stats.coins,
        'streakDays', v_stats.streak_days, 'lastStudyDate', v_stats.last_study_date,
        'dayNumber', v_stats.day_number, 'examDate', v_stats.exam_date
      )
    );
  end if;

  select * into v_attempt
  from public.question_attempts
  where id = v_attempt_id and user_id = v_user_id and question_id = v_question_id
  for update;
  if not found then
    raise exception 'attempt missing or does not match user/question';
  end if;

  if v_attempt.used_at is not null then
    select * into v_existing from public.answer_events
    where user_id = v_user_id and attempt_id = v_attempt_id;
    if found then
      select * into v_stats from public.app_users where id = v_user_id;
      return jsonb_build_object(
        'replay', true, 'report', v_existing.ripple_report,
        'stats', jsonb_build_object(
          'userId', v_stats.id, 'coins', v_stats.coins,
          'streakDays', v_stats.streak_days, 'lastStudyDate', v_stats.last_study_date,
          'dayNumber', v_stats.day_number, 'examDate', v_stats.exam_date
        )
      );
    end if;
    raise exception 'attempt already consumed';
  end if;
  if v_attempt.expires_at <= now() then
    raise exception 'attempt expired';
  end if;

  select q.correct_option, q.is_holdout into v_correct_option, v_question_is_holdout
  from public.questions q
  join public.knowledge_nodes n on n.id = q.node_id
  join public.app_users u on u.id = v_user_id
  where q.id = v_question_id
    and q.verification_status in ('verified', 'demo')
    and (n.track = 'common' or n.track = any(u.active_tracks));
  if not found then
    raise exception 'question is unavailable to this user';
  end if;
  if v_selected < 0 or v_selected >= (
    select jsonb_array_length(options) from public.questions where id = v_question_id
  ) then
    raise exception 'selected option out of range';
  end if;
  v_is_correct := v_selected = v_correct_option;

  update public.question_attempts set used_at = now() where id = v_attempt_id;

  insert into public.answer_events(
    id, user_id, question_id, selected_option, is_correct, attempt_id, answered_at,
    ripple_report, response_time_ms, seen_before, confidence_before, assistance,
    study_mode, engine_version, item_version
  ) values (
    coalesce(nullif(p_event->>'id','')::uuid, gen_random_uuid()),
    v_user_id,
    v_question_id,
    v_selected,
    v_is_correct,
    v_attempt_id,
    coalesce(nullif(p_event->>'answered_at','')::timestamptz, now()),
    v_report || jsonb_build_object('wasCorrect', v_is_correct),
    nullif(p_event->>'response_time_ms','')::integer,
    v_attempt.seen_before,
    nullif(p_event->>'confidence_before','')::integer,
    coalesce(p_event->'assistance', '[]'::jsonb),
    coalesce(nullif(p_event->>'study_mode',''), 'desk'),
    coalesce(nullif(p_event->>'engine_version',''), '0.2.0'),
    coalesce(nullif(p_event->>'item_version',''), v_attempt.item_version)
  )
  on conflict on constraint unique_attempt do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_existing from public.answer_events
    where user_id = v_user_id and attempt_id = v_attempt_id;
    select * into v_stats from public.app_users where id = v_user_id;
    return jsonb_build_object(
      'replay', true, 'report', v_existing.ripple_report,
      'stats', jsonb_build_object(
        'userId', v_stats.id, 'coins', v_stats.coins,
        'streakDays', v_stats.streak_days, 'lastStudyDate', v_stats.last_study_date,
        'dayNumber', v_stats.day_number, 'examDate', v_stats.exam_date
      )
    );
  end if;

  -- Only evidence-approved mastery updates arrive here; the engine omits mastery
  -- updates for a wrong answer or an already-seen question.
  for v_row in select value from jsonb_array_elements(coalesce(p_mastery, '[]'::jsonb))
  loop
    insert into public.user_node_mastery(
      user_id, node_id, mastery_score, status, last_error_at
    ) values (
      v_user_id,
      v_row->>'nodeId',
      (v_row->>'mastery')::numeric,
      v_row->>'status',
      nullif(v_row->>'lastErrorAt','')::timestamptz
    )
    on conflict (user_id, node_id) do update
      set mastery_score = excluded.mastery_score,
          status = excluded.status,
          last_error_at = coalesce(excluded.last_error_at, public.user_node_mastery.last_error_at),
          updated_at = now();
  end loop;

  for v_row in select value from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb))
  loop
    insert into public.review_cards(
      id, user_id, node_id, card_type, question_id, trap_card_id, due_at,
      interval_days, previous_interval_days, ease, is_repair, times_seen, times_correct
    ) values (
      v_row->>'id',
      v_user_id,
      v_row->>'node_id',
      v_row->>'card_type',
      nullif(v_row->>'question_id',''),
      nullif(v_row->>'trap_card_id',''),
      coalesce(nullif(v_row->>'due_at','')::timestamptz, now()),
      coalesce(nullif(v_row->>'interval_days','')::integer, 1),
      nullif(v_row->>'previous_interval_days','')::integer,
      coalesce(nullif(v_row->>'ease','')::numeric, 2.5),
      coalesce((v_row->>'is_repair')::boolean, false),
      coalesce(nullif(v_row->>'times_seen','')::integer, 0),
      coalesce(nullif(v_row->>'times_correct','')::integer, 0)
    )
    on conflict (id) do update
      set due_at = excluded.due_at,
          interval_days = excluded.interval_days,
          previous_interval_days = excluded.previous_interval_days,
          ease = excluded.ease,
          is_repair = excluded.is_repair,
          times_seen = excluded.times_seen,
          times_correct = excluded.times_correct,
          question_id = excluded.question_id,
          trap_card_id = excluded.trap_card_id;
  end loop;

  -- Persist the six-dimensional skill projection and evidence event in the same transaction.
  if jsonb_typeof(p_event->'learner_skill_state') = 'object' then
    insert into public.learner_skill_states(
      user_id, skill_id, proficiency_probability, estimate_confidence, evidence_count,
      correct_evidence_count, assessed_gap_evidence_count, memory_retrievability,
      fluency_score, dominant_error_type, coverage_state, updated_at
    ) values (
      v_user_id,
      v_event_state->>'skillId',
      (v_event_state->>'proficiencyProbability')::numeric,
      (v_event_state->>'estimateConfidence')::numeric,
      (v_event_state->>'evidenceCount')::integer,
      (v_event_state->>'correctEvidenceCount')::integer,
      (v_event_state->>'assessedGapEvidenceCount')::integer,
      (v_event_state->>'memoryRetrievability')::numeric,
      (v_event_state->>'fluencyScore')::numeric,
      v_event_state->>'dominantErrorType',
      case
        when v_question_is_holdout and not v_attempt.seen_before and v_is_correct then 'verified_by_unseen'
        else v_event_state->>'coverageState'
      end,
      now()
    )
    on conflict (user_id, skill_id) do update set
      proficiency_probability = excluded.proficiency_probability,
      estimate_confidence = excluded.estimate_confidence,
      evidence_count = excluded.evidence_count,
      correct_evidence_count = excluded.correct_evidence_count,
      assessed_gap_evidence_count = excluded.assessed_gap_evidence_count,
      memory_retrievability = excluded.memory_retrievability,
      fluency_score = excluded.fluency_score,
      dominant_error_type = case
        when excluded.dominant_error_type = 'unknown' then public.learner_skill_states.dominant_error_type
        else excluded.dominant_error_type
      end,
      coverage_state = case
        when v_question_is_holdout and not v_attempt.seen_before and v_is_correct then 'verified_by_unseen'
        when excluded.coverage_state = 'unseen' then public.learner_skill_states.coverage_state
        else excluded.coverage_state
      end,
      updated_at = now();

    insert into public.learning_evidence_events(
      user_id, skill_id, question_id, client_event_id, event_type, payload,
      engine_version, item_version, occurred_at
    ) values (
      v_user_id, v_event_state->>'skillId', v_question_id,
      'answer:' || v_attempt_id, 'learner_state_updated',
      jsonb_build_object('state', v_event_state, 'wasCorrect', v_is_correct, 'seenBefore', v_attempt.seen_before),
      coalesce(nullif(p_event->>'engine_version',''), '0.2.0'),
      coalesce(nullif(p_event->>'item_version',''), v_attempt.item_version),
      coalesce(nullif(p_event->>'answered_at','')::timestamptz, now())
    ) on conflict (user_id, client_event_id) do nothing;

    if v_question_is_holdout and not v_attempt.seen_before and v_is_correct then
      insert into public.learning_evidence_events(
        user_id, skill_id, question_id, client_event_id, event_type, payload,
        engine_version, item_version, occurred_at
      ) values (
        v_user_id, v_event_state->>'skillId', v_question_id,
        'proof:' || v_attempt_id, 'unseen_verification',
        jsonb_build_object('source','holdout_question','verified',true,'attemptId',v_attempt_id),
        coalesce(nullif(p_event->>'engine_version',''), '0.2.0'),
        coalesce(nullif(p_event->>'item_version',''), v_attempt.item_version),
        coalesce(nullif(p_event->>'answered_at','')::timestamptz, now())
      ) on conflict (user_id, client_event_id) do nothing;
    end if;
  end if;

  update public.app_users u
  set coins = u.coins + case when v_is_correct then 2 else 1 end,
      streak_days = case
        when u.last_study_date = v_today then u.streak_days
        when u.last_study_date = v_today - 1 then u.streak_days + 1
        else 1
      end,
      day_number = u.day_number + case when u.last_study_date = v_today then 0 else 1 end,
      last_study_date = v_today
  where u.id = v_user_id
  returning * into v_stats;

  return jsonb_build_object(
    'replay', false, 'report', v_report || jsonb_build_object('wasCorrect', v_is_correct),
    'stats', jsonb_build_object(
      'userId', v_stats.id, 'coins', v_stats.coins,
      'streakDays', v_stats.streak_days, 'lastStudyDate', v_stats.last_study_date,
      'dayNumber', v_stats.day_number, 'examDate', v_stats.exam_date
    )
  );
end;
$$;

revoke all on function public.ensure_trap_asset_for_review_card() from public, anon, authenticated;
revoke all on function public.issue_question_attempt(uuid, text, text, integer, boolean, text) from public, anon, authenticated;
revoke all on function public.commit_answer(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.issue_question_attempt(uuid, text, text, integer, boolean, text) to service_role;
grant execute on function public.commit_answer(jsonb, jsonb, jsonb) to service_role;

commit;
