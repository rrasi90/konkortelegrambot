-- 0003_security_atomic_learning.sql
-- Harden answer-key access, repair trap-card persistence, and atomically persist answers.
-- PostgreSQL 15+ / Supabase. Apply after 0001 and 0002.

begin;

-- A table-level SELECT grant exposes correct_option even when the Worker strips it.
-- Browser clients must use the answer-key-free view instead; grading remains server-only.
revoke select on public.questions from anon, authenticated;
drop view if exists public.public_questions;
create view public.public_questions
with (security_barrier = true)
as
select id, node_id, exam_year, question_text, options, explanation, trap_note, verification_status
from public.questions
where verification_status in ('verified', 'demo');
revoke all on public.public_questions from public;
grant select on public.public_questions to anon, authenticated;

-- Question cards and trap-note cards may reference the same source question. Only
-- question-type review cards should be unique per (user, question).
alter table public.review_cards
  drop constraint if exists one_owner_per_question_card;
create unique index if not exists one_owner_per_question_card_idx
  on public.review_cards(user_id, question_id)
  where card_type = 'question' and question_id is not null;

-- A trap card is a user-specific review schedule over a globally shared trap asset.
-- Create the shared asset before the FK on review_cards.trap_card_id is checked.
create or replace function public.ensure_trap_asset_for_review_card()
returns trigger
language plpgsql
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

  select q.trap_note
    into v_trap_note
    from public.questions q
   where q.id = new.question_id
     and q.node_id = new.node_id;

  if v_trap_note is null or length(trim(v_trap_note)) = 0 then
    raise exception 'source question % has no trap note', new.question_id;
  end if;

  v_trap_asset_id := 'trap:' || new.question_id;
  insert into public.trap_cards(id, question_id, node_id, content)
  values (v_trap_asset_id, new.question_id, new.node_id, v_trap_note)
  on conflict (id) do update
    set content = excluded.content,
        node_id = excluded.node_id;

  new.trap_card_id := v_trap_asset_id;
  return new;
end;
$$;

drop trigger if exists trg_ensure_trap_asset on public.review_cards;
create trigger trg_ensure_trap_asset
before insert or update of card_type, question_id, trap_card_id, node_id
on public.review_cards
for each row execute function public.ensure_trap_asset_for_review_card();

-- The complete response write is one PostgreSQL transaction. A unique attempt is
-- claimed first; a racing/replayed request cannot also update mastery/cards/coins.
create or replace function public.persist_answer_result(
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
  v_inserted_id uuid;
  v_existing public.answer_events%rowtype;
  v_row jsonb;
  v_today date := (now() at time zone 'Asia/Tehran')::date;
  v_stats public.app_users%rowtype;
begin
  insert into public.answer_events(
    id, user_id, question_id, selected_option, is_correct, attempt_id, answered_at, ripple_report
  ) values (
    coalesce(nullif(p_event->>'id','')::uuid, gen_random_uuid()),
    v_user_id,
    p_event->>'question_id',
    (p_event->>'selected_option')::integer,
    (p_event->>'is_correct')::boolean,
    p_event->>'attempt_id',
    coalesce(nullif(p_event->>'answered_at','')::timestamptz, now()),
    p_event->'ripple_report'
  )
  on conflict on constraint unique_attempt do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_existing
      from public.answer_events
     where user_id = v_user_id and attempt_id = p_event->>'attempt_id';
    select * into v_stats from public.app_users where id = v_user_id;
    return jsonb_build_object(
      'replay', true,
      'report', v_existing.ripple_report,
      'stats', jsonb_build_object(
        'coins', v_stats.coins,
        'streakDays', v_stats.streak_days,
        'dayNumber', v_stats.day_number
      )
    );
  end if;

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
      v_row->>'nodeId',
      v_row->>'cardType',
      nullif(v_row->>'questionId',''),
      nullif(v_row->>'trapCardId',''),
      (v_row->>'dueAt')::timestamptz,
      coalesce(nullif(v_row->>'intervalDays','')::integer, 1),
      nullif(v_row->>'previousIntervalDays','')::integer,
      coalesce(nullif(v_row->>'ease','')::numeric, 2.5),
      coalesce((v_row->>'isRepair')::boolean, false),
      coalesce(nullif(v_row->>'timesSeen','')::integer, 0),
      coalesce(nullif(v_row->>'timesCorrect','')::integer, 0)
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

  update public.app_users u
     set coins = u.coins + case when (p_event->>'is_correct')::boolean then 2 else 1 end,
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
    'replay', false,
    'report', p_event->'ripple_report',
    'stats', jsonb_build_object(
      'coins', v_stats.coins,
      'streakDays', v_stats.streak_days,
      'dayNumber', v_stats.day_number
    )
  );
end;
$$;

revoke all on function public.persist_answer_result(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.persist_answer_result(jsonb, jsonb, jsonb) to service_role;

commit;
