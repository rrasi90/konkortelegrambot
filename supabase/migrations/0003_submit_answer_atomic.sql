-- 0003_submit_answer_atomic.sql
-- تابع اتمی برای ثبت پاسخ، به‌روزرسانی تسلط و کارت‌ها
-- این تابع همه عملیات را در یک تراکنش انجام می‌دهد و از تکرار جلوگیری می‌کند

create or replace function submit_answer_atomic(
  p_user_id uuid,
  p_question_id text,
  p_selected_option int,
  p_attempt_id text,
  p_was_correct boolean,
  p_ripple_report jsonb,
  p_mastery_updates jsonb,
  p_card_upserts jsonb,
  p_card_inserts jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
begin
  -- 1. بررسی و ثبت رویداد پاسخ (idempotent با attempt_id)
  select id into v_existing
  from answer_events
  where user_id = p_user_id and attempt_id = p_attempt_id
  limit 1;

  if v_existing is not null then
    -- تلاش تکراری: فقط گزارش را برگردان (caller می‌تواند replay را تشخیص دهد)
    return;
  end if;

  -- Server truth: calculate correctness from questions table, do NOT trust p_was_correct
  declare
    v_correct_opt int;
    v_actual_correct boolean;
  begin
    select correct_option into v_correct_opt from questions where id = p_question_id;
    if v_correct_opt is not null then
      v_actual_correct := (p_selected_option = v_correct_opt);
    else
      v_actual_correct := coalesce(p_was_correct, false);
    end if;

    insert into answer_events (user_id, question_id, selected_option, is_correct, attempt_id, ripple_report)
    values (p_user_id, p_question_id, p_selected_option, v_actual_correct, p_attempt_id, p_ripple_report);
  end;

  -- 2. به‌روزرسانی تسلط‌ها (upsert)
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

  -- 3. آپدیت کارت‌های موجود
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
        (item->>'timesCorrect')::int as times_correct
      from jsonb_array_elements(p_card_upserts) as item
    ) u
    where rc.id = u.id and rc.user_id = u.user_id;
  end if;

  -- 4. درج کارت‌های جدید (insert on conflict do nothing برای جلوگیری از تکرار)
  if jsonb_typeof(p_card_inserts) = 'array' then
    insert into review_cards (id, user_id, node_id, card_type, question_id, trap_card_id, due_at, interval_days, previous_interval_days, ease, is_repair, times_seen, times_correct)
    select
      (item->>'id')::text,
      (item->>'userId')::uuid,
      (item->>'nodeId')::text,
      item->>'cardType',
      (item->>'questionId')::text,
      (item->>'trapCardId')::text,
      (item->>'dueAt')::timestamptz,
      (item->>'intervalDays')::int,
      (item->>'previousIntervalDays')::int,
      (item->>'ease')::numeric,
      (item->>'isRepair')::boolean,
      (item->>'timesSeen')::int,
      (item->>'timesCorrect')::int
    from jsonb_array_elements(p_card_inserts) as item
    on conflict (user_id, question_id, card_type) do nothing;
  end if;
end;
$$;

-- Grant برای اجرای تابع
grant execute on function submit_answer_atomic(uuid, text, int, text, boolean, jsonb, jsonb, jsonb, jsonb) to authenticated, service_role;
