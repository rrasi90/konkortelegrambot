-- 0004_domain_agnostic_learning_core.sql
-- Pack-versioned, domain-neutral learning model. Legacy knowledge_nodes remain
-- available for the currently implemented demo UI; new content should use these tables.
begin;

create table if not exists public.exam_packs (
  id text primary key,
  exam_title text not null,
  exam_level text not null,
  pack_version text not null,
  syllabus_version text not null,
  locale text not null default 'fa-IR',
  scoring_rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  rights_status text not null default 'review_required'
    check (rights_status in ('unknown','review_required','authorized','public_domain','licensed','blocked')),
  publication_status text not null default 'draft'
    check (publication_status in ('draft','expert_review','published','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, pack_version)
);

create table if not exists public.syllabus_topics (
  id text primary key,
  pack_id text not null references public.exam_packs(id) on delete cascade,
  parent_id text references public.syllabus_topics(id) on delete set null,
  topic_code text not null,
  title text not null,
  course_weight numeric check (course_weight is null or course_weight between 0 and 1),
  official_source text,
  source_ref text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','rejected')),
  unique (pack_id, topic_code)
);

create table if not exists public.atomic_skills (
  id text primary key,
  pack_id text not null references public.exam_packs(id) on delete cascade,
  syllabus_topic_id text references public.syllabus_topics(id) on delete set null,
  skill_code text not null,
  title text not null,
  definition text not null,
  assessment_criteria jsonb not null default '[]'::jsonb,
  source_ref text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','rejected')),
  created_at timestamptz not null default now(),
  unique (pack_id, skill_code)
);

-- A question can assess multiple skills; a skill can be evidenced by many questions.
create table if not exists public.question_skill_map (
  question_id text not null references public.questions(id) on delete cascade,
  skill_id text not null references public.atomic_skills(id) on delete cascade,
  mapping_role text not null default 'primary'
    check (mapping_role in ('primary','secondary','transfer')),
  mapping_status text not null default 'proposed'
    check (mapping_status in ('proposed','verified','rejected')),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  source_ref text,
  reviewed_by text,
  reviewed_at timestamptz,
  primary key (question_id, skill_id)
);

create table if not exists public.learning_assets (
  id text primary key,
  pack_id text not null references public.exam_packs(id) on delete cascade,
  skill_id text not null references public.atomic_skills(id) on delete cascade,
  asset_type text not null
    check (asset_type in ('diagnostic_probe','mini_lesson','worked_example','contrast_pair','holdout_question','rubric','other')),
  content jsonb not null,
  asset_version text not null default '1',
  source_ref text,
  rights_status text not null default 'review_required'
    check (rights_status in ('unknown','review_required','authorized','public_domain','licensed','blocked')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','expert_verified','rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Six dimensions are stored independently. Proficiency and memory retrievability
-- must never be conflated; one wrong answer is not allowed to hard-reset proficiency.
create table if not exists public.learner_skill_state (
  user_id uuid not null references public.app_users(id) on delete cascade,
  skill_id text not null references public.atomic_skills(id) on delete cascade,
  proficiency_probability numeric not null default 0.5
    check (proficiency_probability between 0 and 1),
  estimate_confidence numeric not null default 0
    check (estimate_confidence between 0 and 1),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  memory_retrievability numeric not null default 0.5
    check (memory_retrievability between 0 and 1),
  last_retrieval_at timestamptz,
  fluency_score numeric not null default 0.5 check (fluency_score between 0 and 1),
  dominant_error_type text not null default 'unknown'
    check (dominant_error_type in ('conceptual','confusable','computational','slip','unknown')),
  coverage_state text not null default 'unseen'
    check (coverage_state in ('unseen','diagnosis_pending','diagnosed','remediating','practice_in_progress','verified_by_unseen')),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

-- Append-only event store. Current state tables are projections that can be rebuilt.
create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  event_type text not null
    check (event_type in ('question_issued','answer_submitted','diagnostic_response','lesson_viewed','holdout_verified','plan_created','study_mode_changed')),
  item_id text,
  item_version text not null default '1',
  is_unseen boolean,
  response_time_ms integer check (response_time_ms is null or response_time_ms between 0 and 3600000),
  confidence_before smallint check (confidence_before is null or confidence_before between 1 and 5),
  payload jsonb not null default '{}'::jsonb,
  engine_version text not null default '0.2.0',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists learning_events_user_time_idx
  on public.learning_events(user_id, created_at desc);
create index if not exists learner_skill_state_coverage_idx
  on public.learner_skill_state(user_id, coverage_state);

-- Planner decision log provides explanations and allows retrospective evaluation.
create table if not exists public.planner_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  plan_date date not null default (now() at time zone 'Asia/Tehran')::date,
  candidate_id text not null,
  action_type text not null,
  exam_value numeric not null default 0 check (exam_value >= 0),
  expected_benefit numeric not null default 0 check (expected_benefit >= 0),
  urgency numeric not null default 0 check (urgency >= 0),
  estimated_minutes numeric not null check (estimated_minutes > 0),
  utility_score numeric not null default 0,
  selected boolean not null default false,
  rationale jsonb not null default '{}'::jsonb,
  engine_version text not null default '0.2.0',
  created_at timestamptz not null default now()
);
create index if not exists planner_decisions_user_date_idx
  on public.planner_decisions(user_id, plan_date desc);

-- Rights, provenance and item version are first-class. Synthetic/demo content stays labelled.
alter table public.questions add column if not exists source_ref text;
alter table public.questions add column if not exists source_hash text;
alter table public.questions add column if not exists item_version text not null default '1';
alter table public.questions add column if not exists rights_status text not null default 'review_required'
  check (rights_status in ('unknown','review_required','authorized','public_domain','licensed','blocked'));
alter table public.questions add column if not exists reviewed_by text;
alter table public.questions add column if not exists reviewed_at timestamptz;
alter table public.review_cards add column if not exists fsrs_stability numeric
  check (fsrs_stability is null or fsrs_stability > 0);
alter table public.review_cards add column if not exists fsrs_difficulty numeric
  check (fsrs_difficulty is null or fsrs_difficulty between 1 and 10);
alter table public.review_cards add column if not exists memory_retrievability numeric
  check (memory_retrievability is null or memory_retrievability between 0 and 1);

-- Keep all new domain data server-only; the Mini App uses the Worker API.
alter table public.exam_packs enable row level security;
alter table public.syllabus_topics enable row level security;
alter table public.atomic_skills enable row level security;
alter table public.question_skill_map enable row level security;
alter table public.learning_assets enable row level security;
alter table public.learner_skill_state enable row level security;
alter table public.learning_events enable row level security;
alter table public.planner_decisions enable row level security;
revoke all on public.exam_packs, public.syllabus_topics, public.atomic_skills,
  public.question_skill_map, public.learning_assets, public.learner_skill_state,
  public.learning_events, public.planner_decisions from anon, authenticated;
grant all on public.exam_packs, public.syllabus_topics, public.atomic_skills,
  public.question_skill_map, public.learning_assets, public.learner_skill_state,
  public.learning_events, public.planner_decisions to service_role;

-- Recreate the public projection to include provenance without including the answer key.
create or replace view public.public_questions
with (security_barrier = true) as
select id, node_id, exam_year, question_text, options, explanation, trap_note,
       verification_status, source_ref, item_version, rights_status
from public.questions
where verification_status in ('verified', 'demo')
  and rights_status <> 'blocked';
grant select on public.public_questions to anon, authenticated;

-- Extend the atomic answer procedure after the event/skill tables exist.
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
  v_skill record;
  v_correct_option integer;
  v_options_count integer;
  v_track text;
begin
  select * into v_existing
  from public.answer_events
  where user_id = v_user_id and attempt_id = v_attempt_id;
  if found then
    return jsonb_build_object('replay', true, 'report', v_existing.ripple_report);
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
    v_user_id, v_question_id, (p_event->>'selected_option')::integer,
    (p_event->>'is_correct')::boolean, v_attempt_id, v_answered_at, p_event->'ripple_report',
    nullif(p_event->>'response_time_ms', '')::integer,
    coalesce((p_event->>'seen_before')::boolean, false),
    nullif(p_event->>'confidence_before', '')::smallint,
    coalesce(p_event->'assistance', '[]'::jsonb),
    coalesce(p_event->>'study_mode', 'desk'),
    coalesce(p_event->>'engine_version', '0.2.0'),
    coalesce(p_event->>'item_version', '1')
  ) returning id into v_inserted;

  insert into public.learning_events(
    user_id, event_type, item_id, item_version, is_unseen, response_time_ms,
    confidence_before, payload, engine_version, idempotency_key, created_at
  ) values (
    v_user_id, 'answer_submitted', v_question_id, coalesce(p_event->>'item_version', '1'),
    not coalesce((p_event->>'seen_before')::boolean, false),
    nullif(p_event->>'response_time_ms', '')::integer,
    nullif(p_event->>'confidence_before', '')::smallint,
    jsonb_build_object('selectedOption', p_event->>'selected_option', 'isCorrect', p_event->>'is_correct',
      'assistance', coalesce(p_event->'assistance', '[]'::jsonb), 'studyMode', coalesce(p_event->>'study_mode', 'desk')),
    coalesce(p_event->>'engine_version', '0.2.0'), v_attempt_id, v_answered_at
  );

  for v_skill in
    select sm.skill_id
    from public.question_skill_map sm
    where sm.question_id = v_question_id and sm.mapping_status = 'verified'
  loop
    insert into public.learner_skill_state(user_id, skill_id, proficiency_probability,
      estimate_confidence, evidence_count, memory_retrievability, fluency_score, dominant_error_type, coverage_state)
    values (
      v_user_id, v_skill.skill_id,
      case when (p_event->>'is_correct')::boolean and not coalesce((p_event->>'seen_before')::boolean, false)
        then 0.55 else 0.5 end,
      0.1, 1, 0.5, 0.5, 'unknown',
      case when (p_event->>'is_correct')::boolean then 'practice_in_progress' else 'diagnosis_pending' end
    )
    on conflict (user_id, skill_id) do update set
      proficiency_probability = case
        when (p_event->>'is_correct')::boolean and not coalesce((p_event->>'seen_before')::boolean, false)
          then least(0.99, public.learner_skill_state.proficiency_probability
            + (1 - public.learner_skill_state.proficiency_probability) * 0.1)
        else public.learner_skill_state.proficiency_probability
      end,
      estimate_confidence = least(0.99, public.learner_skill_state.estimate_confidence + 0.03),
      evidence_count = public.learner_skill_state.evidence_count + 1,
      coverage_state = case
        when not (p_event->>'is_correct')::boolean then 'diagnosis_pending'
        when public.learner_skill_state.coverage_state = 'verified_by_unseen' then 'verified_by_unseen'
        when public.learner_skill_state.coverage_state = 'unseen' then 'practice_in_progress'
        else public.learner_skill_state.coverage_state
      end,
      updated_at = now();
  end loop;

  for v_card in select value from jsonb_array_elements(coalesce(p_mastery, '[]'::jsonb))
  loop
    insert into public.user_node_mastery(user_id, node_id, mastery_score, status, last_error_at)
    values (v_user_id, v_card->>'nodeId', (v_card->>'mastery')::numeric,
      v_card->>'status', nullif(v_card->>'lastErrorAt', '')::timestamptz)
    on conflict (user_id, node_id) do update set
      mastery_score = excluded.mastery_score,
      status = excluded.status,
      last_error_at = coalesce(excluded.last_error_at, public.user_node_mastery.last_error_at);
  end loop;

  for v_card in
    select distinct value from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb))
    where value->>'card_type' = 'trap_note'
  loop
    v_source_question_id := substring(v_card->>'trap_card_id' from 6);
    insert into public.trap_cards(id, question_id, node_id, content)
    select 'trap:' || q.id, q.id, q.node_id, q.trap_note
    from public.questions q
    where q.id = v_source_question_id and nullif(trim(q.trap_note), '') is not null
    on conflict (id) do update set content = excluded.content, node_id = excluded.node_id,
      question_id = excluded.question_id;
  end loop;

  for v_card in select value from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb))
  loop
    insert into public.review_cards(
      id, user_id, node_id, card_type, question_id, trap_card_id, due_at, interval_days,
      previous_interval_days, ease, is_repair, times_seen, times_correct
    ) values (
      v_card->>'id', v_user_id, v_card->>'node_id', v_card->>'card_type',
      nullif(v_card->>'question_id', ''), nullif(v_card->>'trap_card_id', ''),
      coalesce((v_card->>'due_at')::timestamptz, now()),
      coalesce((v_card->>'interval_days')::integer, 1),
      nullif(v_card->>'previous_interval_days', '')::integer,
      coalesce((v_card->>'ease')::numeric, 2.5),
      coalesce((v_card->>'is_repair')::boolean, false),
      coalesce((v_card->>'times_seen')::integer, 0),
      coalesce((v_card->>'times_correct')::integer, 0)
    )
    on conflict (id) do update set node_id = excluded.node_id, card_type = excluded.card_type,
      question_id = excluded.question_id, trap_card_id = excluded.trap_card_id,
      due_at = excluded.due_at, interval_days = excluded.interval_days,
      previous_interval_days = excluded.previous_interval_days, ease = excluded.ease,
      is_repair = excluded.is_repair, times_seen = excluded.times_seen, times_correct = excluded.times_correct;
  end loop;

  update public.app_users
  set coins = coalesce(coins, 0) + case when (p_event->>'is_correct')::boolean then 2 else 1 end,
      streak_days = case when last_study_date = v_today then coalesce(streak_days, 0)
        when last_study_date = v_today - 1 then coalesce(streak_days, 0) + 1 else 1 end,
      day_number = coalesce(day_number, 0) + case when last_study_date is distinct from v_today then 1 else 0 end,
      last_study_date = v_today
  where id = v_user_id
  returning jsonb_build_object('userId', id, 'coins', coalesce(coins, 0),
    'streakDays', coalesce(streak_days, 0), 'lastStudyDate', last_study_date,
    'dayNumber', coalesce(day_number, 0), 'examDate', exam_date) into v_stats;

  return jsonb_build_object('replay', false, 'stats', v_stats);
end;
$$;
revoke all on function public.commit_answer(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_answer(jsonb, jsonb, jsonb) to service_role;

commit;
