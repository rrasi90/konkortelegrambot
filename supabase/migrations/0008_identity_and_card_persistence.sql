-- 0008_identity_and_card_persistence.sql
-- ۱) هویت پایدار کاربران وب/تلگرام: نام کاربری تلگرام و ستون قفل زنجیره
-- ۲) اجازهٔ ذخیرهٔ کارت مقایسه (comparison_card) در review_cards
-- ۳) پایدارسازی کامل وضعیت FSRS و متادیتای اثبات در RPC امن ثبت پاسخ

-- ۱) ستون‌های هویتی و انگیزشی روی app_users
alter table app_users add column if not exists telegram_username text;
alter table app_users add column if not exists streak_freeze_used int not null default 0;

-- نام کاربری همیشه با حروف کوچک ذخیره می‌شود (worker آن را نرمال می‌کند)
create unique index if not exists app_users_telegram_username_key
  on app_users (telegram_username)
  where telegram_username is not null;

-- ۲) کارت مقایسه در CHECK قدیمی مجاز نبود و درج آن با خطا شکست می‌خورد
alter table review_cards drop constraint if exists review_cards_card_type_check;
alter table review_cards
  add constraint review_cards_card_type_check
  check (card_type in ('question', 'trap_note', 'comparison_card'));

-- هر گره حداکثر یک کارت مقایسه دارد (question_id این کارت‌ها NULL است و
-- قید یکتای قبلی نمی‌تواند جلوی تکرار را بگیرد)
create unique index if not exists review_cards_one_comparison_per_node
  on review_cards (user_id, node_id)
  where card_type = 'comparison_card';

-- ۳) بازنویسی RPC امن: ذخیرهٔ fsrs_state / is_proof / comparison_skills
create or replace function submit_answer_secure(
  p_user_id uuid,
  p_attempt_id text,
  p_question_id text,
  p_selected_option int,
  p_ripple_report jsonb default null,
  p_mastery_updates jsonb default null,
  p_card_upserts jsonb default null,
  p_card_inserts jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question record;
  v_ticket record;
  v_existing uuid;
  v_existing_qid text;
  v_is_correct boolean;
  v_result jsonb;
  v_skill_rec record;
begin
  -- Idempotency check: if already answered with this attempt_id
  select id, question_id, is_correct, ripple_report into v_existing, v_existing_qid, v_is_correct, v_result
  from answer_events
  where user_id = p_user_id and attempt_id = p_attempt_id
  limit 1;

  if v_existing is not null then
    if v_existing_qid <> p_question_id then
      raise exception 'Attempt ID already registered for a different question' using errcode = '45002';
    end if;

    select q.correct_option, q.explanation, q.trap_note into v_question
    from questions q where q.id = p_question_id;

    return jsonb_build_object(
      'replay', true,
      'wasCorrect', v_is_correct,
      'correctOption', v_question.correct_option,
      'explanation', v_question.explanation,
      'trapNote', v_question.trap_note,
      'rippleReport', v_result
    );
  end if;

  select q.id, q.correct_option, q.explanation, q.trap_note, q.node_id, q.exam_pack_id, q.item_version
  into v_question
  from questions q
  where q.id = p_question_id;

  if v_question.id is null then
    raise exception 'Question not found' using errcode = '45001';
  end if;

  -- Attempt ticket strict validation (if ticket exists in attempt_tickets)
  select * into v_ticket
  from attempt_tickets
  where attempt_id = p_attempt_id;

  if v_ticket.attempt_id is not null then
    if v_ticket.user_id <> p_user_id then
      raise exception 'Attempt ticket belongs to another user' using errcode = '45003';
    end if;
    if v_ticket.question_id <> p_question_id then
      raise exception 'Attempt ticket question mismatch' using errcode = '45004';
    end if;
    if v_ticket.consumed_at is not null then
      raise exception 'Attempt ticket already consumed' using errcode = '45005';
    end if;
    if v_ticket.expires_at < now() then
      raise exception 'Attempt ticket expired' using errcode = '45006';
    end if;

    update attempt_tickets set consumed_at = now() where attempt_id = p_attempt_id;
  end if;

  -- Server-side key verification: compare selected_option with database correct_option
  v_is_correct := (p_selected_option = v_question.correct_option);

  insert into answer_events (
    user_id, question_id, selected_option, is_correct, attempt_id,
    answered_at, ripple_report, pack_id, item_version, started_at, completed_at
  ) values (
    p_user_id, p_question_id, p_selected_option, v_is_correct, p_attempt_id,
    now(), p_ripple_report, v_question.exam_pack_id, coalesce(v_question.item_version, '1.0'), now(), now()
  );

  -- Apply 6D learner skill state updates for all mapped skills
  for v_skill_rec in
    select skill_id, is_primary from question_skill_mappings where question_id = p_question_id
  loop
    insert into learner_skill_states (
      user_id, skill_id, proficiency_probability, confidence, evidence_count,
      memory_retrievability, coverage_status, last_evaluated_at, updated_at
    ) values (
      p_user_id,
      v_skill_rec.skill_id,
      case when v_is_correct then 0.65 else 0.35 end,
      0.25,
      1,
      case when v_is_correct then 1.0 else 0.8 end,
      case when v_is_correct then 'learning' else 'remediated' end,
      now(),
      now()
    )
    on conflict (user_id, skill_id) do update set
      proficiency_probability = case
        when v_is_correct then least(1.0, learner_skill_states.proficiency_probability + 0.10 * (1.0 - learner_skill_states.proficiency_probability))
        else greatest(0.0, learner_skill_states.proficiency_probability - 0.15 * learner_skill_states.proficiency_probability)
      end,
      confidence = least(1.0, learner_skill_states.confidence + 0.05),
      evidence_count = learner_skill_states.evidence_count + 1,
      memory_retrievability = case when v_is_correct then 1.0 else 0.8 end,
      coverage_status = case
        when v_is_correct and learner_skill_states.evidence_count >= 3 and learner_skill_states.proficiency_probability >= 0.85 then 'mastered'
        when v_is_correct then 'learning'
        else 'remediated'
      end,
      last_evaluated_at = now(),
      updated_at = now();
  end loop;

  -- Apply mastery updates
  if jsonb_typeof(p_mastery_updates) = 'array' then
    insert into user_node_mastery (user_id, node_id, mastery_score, status, last_error_at)
    select p_user_id, (item->>'nodeId')::text, (item->>'mastery')::numeric, item->>'status', (item->>'lastErrorAt')::timestamptz
    from jsonb_array_elements(p_mastery_updates) as item
    on conflict (user_id, node_id) do update set
      mastery_score = excluded.mastery_score,
      status = excluded.status,
      last_error_at = excluded.last_error_at,
      updated_at = now();
  end if;

  -- Upsert existing cards (including FSRS metadata)
  if jsonb_typeof(p_card_upserts) = 'array' then
    update review_cards rc
    set
      due_at = u.due_at,
      interval_days = u.interval_days,
      previous_interval_days = u.previous_interval_days,
      ease = u.ease,
      is_repair = u.is_repair,
      times_seen = u.times_seen,
      times_correct = u.times_correct,
      fsrs_state = u.fsrs_state,
      is_proof = u.is_proof,
      comparison_skills = u.comparison_skills,
      updated_at = now()
    from (
      select
        (item->>'id')::text as id,
        (item->>'userId')::uuid as user_id,
        (item->>'dueAt')::timestamptz as due_at,
        (item->>'intervalDays')::int as interval_days,
        (item->>'previousIntervalDays')::int as previous_interval_days,
        (item->>'ease')::numeric as ease,
        (item->>'isRepair')::boolean as is_repair,
        (item->>'timesSeen')::int as times_seen,
        (item->>'timesCorrect')::int as times_correct,
        (item->>'fsrsState')::jsonb as fsrs_state,
        coalesce((item->>'isProof')::boolean, false) as is_proof,
        (item->>'comparisonSkills')::jsonb as comparison_skills
      from jsonb_array_elements(p_card_upserts) as item
    ) u
    where rc.id = u.id and rc.user_id = u.user_id;
  end if;

  -- Insert newly created cards (including comparison cards)
  if jsonb_typeof(p_card_inserts) = 'array' then
    insert into review_cards (
      id, user_id, node_id, card_type, question_id, trap_card_id,
      comparison_skills, due_at, interval_days, previous_interval_days,
      ease, is_repair, times_seen, times_correct, fsrs_state, is_proof
    )
    select
      (item->>'id')::text,
      (item->>'userId')::uuid,
      (item->>'nodeId')::text,
      item->>'cardType',
      (item->>'questionId')::text,
      (item->>'trapCardId')::text,
      (item->>'comparisonSkills')::jsonb,
      (item->>'dueAt')::timestamptz,
      (item->>'intervalDays')::int,
      (item->>'previousIntervalDays')::int,
      (item->>'ease')::numeric,
      (item->>'isRepair')::boolean,
      (item->>'timesSeen')::int,
      (item->>'timesCorrect')::int,
      (item->>'fsrsState')::jsonb,
      coalesce((item->>'isProof')::boolean, false)
    from jsonb_array_elements(p_card_inserts) as item
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'replay', false,
    'wasCorrect', v_is_correct,
    'correctOption', v_question.correct_option,
    'explanation', v_question.explanation,
    'trapNote', v_question.trap_note,
    'rippleReport', p_ripple_report
  );
end;
$$;

grant execute on function submit_answer_secure to authenticated, service_role;
