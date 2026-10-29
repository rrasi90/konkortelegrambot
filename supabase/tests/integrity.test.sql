-- تست‌های یکپارچگی دیتابیس — با psql اجرا می‌شود (run.sh)
-- هر بلوک DO در صورت شکست exception پرتاب می‌کند و تست رد می‌شود.
\set ON_ERROR_STOP on

-- ۱) مقادیر پیش‌فرض و محدودیت‌ها
do $$
begin
  perform set_config('assert.status', 'ok', false);
  if exists (select 1 from knowledge_nodes where track !~ '^[a-z][a-z0-9_-]{1,39}
  if not exists (select 1 from questions where verification_status = 'demo') then
    raise exception 'سؤال‌های نمونه (demo) درون‌ریزی نشده‌اند';
  end if;
  if exists (select 1 from node_dependencies where impact_weight < 0.2 or impact_weight > 0.6) then
    raise exception 'impact_weight خارج از بازه';
  end if;
end
$$;

-- ۲) یال‌ها به گره‌های موجود اشاره می‌کنند (FK تضمین می‌کند؛ بررسی تعداد)
do $$
begin
  if (select count(*) from node_dependencies) = 0 then
    raise exception 'یالی تعریف نشده است';
  end if;
  if exists (select 1 from node_dependencies d where d.source_node_id = d.target_node_id) then
    raise exception 'یال خود-ارجاع وجود دارد';
  end if;
end
$$;

-- ۳) هر سؤال به گره معتبر وصل است و correct_option در محدودهٔ options است
do $$
declare r record;
begin
  for r in select id, options, correct_option from questions loop
    if r.correct_option < 0 or r.correct_option >= jsonb_array_length(r.options) then
      raise exception 'correct_option خارج از محدوده: %', r.id;
    end if;
  end loop;
end
$$;

-- ۴) idempotency: attempt تکراری رد می‌شود
do $$
declare uid uuid; qid text; dummy int;
begin
  insert into app_users (id, display_name) values ('11111111-1111-1111-1111-111111111111', 'تست') on conflict do nothing;
  select id into qid from questions limit 1;
  insert into answer_events (user_id, question_id, selected_option, is_correct, attempt_id)
  values ('11111111-1111-1111-1111-111111111111', qid, 0, true, 'test-attempt-1');
  begin
    insert into answer_events (user_id, question_id, selected_option, is_correct, attempt_id)
    values ('11111111-1111-1111-1111-111111111111', qid, 0, false, 'test-attempt-1');
    raise exception 'attempt تکراری نباید پذیرفته شود';
  exception when unique_violation then
    -- درست: رد شد
  end;
end
$$;

-- ۵) وزن خارج از بازه رد می‌شود
do $$
begin
  insert into node_dependencies (source_node_id, target_node_id, relation, impact_weight)
  values ('sm.rbv', 'sm.portfolio', 'prerequisite', 0.9);
  raise exception 'وزن ۰٫۹ نباید پذیرفته شود';
exception when check_violation then
  -- درست: رد شد
end
$$;

-- ۶) تسلط فقط بین ۰ تا ۱۰۰
do $$
begin
  insert into user_node_mastery (user_id, node_id, mastery_score)
  values ('11111111-1111-1111-1111-111111111111', 'sm.rbv', 250);
  raise exception 'تسلط ۲۵۰ نباید پذیرفته شود';
exception when check_violation then
  -- درست: رد شد
end
$$;

-- ۷) RLS: policy خواندن برای authenticated تعریف شده باشد
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'answer_events' and cmd = 'SELECT' and roles @> '{authenticated}') then
    raise exception 'policy خواندن answer_events برای authenticated تعریف نشده';
  end if;
end
$$;

-- ۸) مرز دسترسی مرورگر: داده‌های کاربر فقط از طریق Worker سرو می‌شوند.
-- در این معماری حتی SELECT مستقیم به نقش authenticated داده نمی‌شود؛ بنابراین
-- آزمون سیاست‌های ردیفی از مسیر SQL مرورگر مجاز نیست و privilege denial قوی‌تر است.
do $$
declare
  private_table text;
begin
  foreach private_table in array array[
    'public.app_users',
    'public.answer_events',
    'public.user_node_mastery',
    'public.review_cards',
    'public.trap_cards',
    'public.question_attempts',
    'public.learner_skill_states',
    'public.learning_evidence_events',
    'public.planner_decision_logs'
  ] loop
    if has_table_privilege('anon', private_table, 'SELECT')
       or has_table_privilege('authenticated', private_table, 'SELECT') then
      raise exception 'دسترسی SELECT مرورگر به جدول خصوصی باید بسته باشد: %', private_table;
    end if;
  end loop;
end
$$;

-- ۹) هیچ نقش مرورگری نباید به کلید پاسخ یا اطلاعات خصوصی کاربر دسترسی مستقیم داشته باشد.
do $$
begin
  if has_table_privilege('anon', 'public.questions', 'SELECT') then
    raise exception 'anon همچنان می‌تواند correct_option را از questions بخواند';
  end if;
  if has_table_privilege('authenticated', 'public.questions', 'SELECT') then
    raise exception 'authenticated همچنان می‌تواند correct_option را از questions بخواند';
  end if;
  if has_table_privilege('anon', 'public.app_users', 'SELECT')
     or has_table_privilege('authenticated', 'public.app_users', 'SELECT') then
    raise exception 'دسترسی مستقیم مرورگر به app_users باید بسته باشد';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_questions'
      and column_name = 'correct_option'
  ) then
    raise exception 'public_questions نباید ستون correct_option داشته باشد';
  end if;
  if to_regclass('public.question_attempts') is null then
    raise exception 'question_attempts ساخته نشده است';
  end if;
end
$$;

-- ۱۰) مسیر کامل RPC: تلاش یک‌بارمصرف، ثبت اتمیک، کارت دام معتبر و replay بدون سکهٔ اضافه.
do $$
declare
  v_uid uuid := '33333333-3333-3333-3333-333333333333';
  v_qid text;
  v_node text;
  v_track text;
  v_correct integer;
  v_attempt text := 'rpc-integration-attempt-0001';
  v_event jsonb;
  v_cards jsonb;
  v_first jsonb;
  v_second jsonb;
  v_count integer;
  v_coins integer;
begin
  insert into app_users(id, display_name, active_tracks)
  values (v_uid, 'تست RPC', array['common','business','technology'])
  on conflict (id) do update set active_tracks = excluded.active_tracks;

  select q.id, q.node_id, q.correct_option, n.track
    into v_qid, v_node, v_correct, v_track
  from questions q
  join knowledge_nodes n on n.id = q.node_id
  where q.verification_status = 'demo' and q.trap_note is not null
  limit 1;
  if v_qid is null then raise exception 'برای تست RPC سؤال demo دارای trap_note موجود نیست'; end if;

  perform public.issue_question_attempt(v_uid, v_qid, v_attempt, 900, false, 'rpc-test-v1');
  v_event := jsonb_build_object(
    'id', '33333333-3333-3333-3333-333333333334',
    'user_id', v_uid,
    'question_id', v_qid,
    'selected_option', v_correct,
    'is_correct', false,
    'attempt_id', v_attempt,
    'answered_at', now(),
    'response_time_ms', 1250,
    'seen_before', false,
    'confidence_before', 4,
    'assistance', '[]'::jsonb,
    'study_mode', 'desk',
    'engine_version', '0.2.0',
    'item_version', 'rpc-test-v1',
    'ripple_report', jsonb_build_object('wasCorrect', false, 'diagnosticRequired', false)
  );
  v_cards := jsonb_build_array(
    jsonb_build_object(
      'id', 'rpc-question-card-' || v_uid::text,
      'user_id', v_uid, 'node_id', v_node, 'card_type', 'question',
      'question_id', v_qid, 'trap_card_id', null, 'due_at', now(),
      'interval_days', 1, 'previous_interval_days', null, 'ease', 2.5,
      'is_repair', false, 'times_seen', 1, 'times_correct', 1
    ),
    jsonb_build_object(
      'id', 'rpc-trap-card-' || v_uid::text,
      'user_id', v_uid, 'node_id', v_node, 'card_type', 'trap_note',
      'question_id', v_qid, 'trap_card_id', null, 'due_at', now(),
      'interval_days', 1, 'previous_interval_days', null, 'ease', 2.5,
      'is_repair', false, 'times_seen', 0, 'times_correct', 0
    )
  );

  v_first := public.commit_answer(v_event, '[]'::jsonb, v_cards);
  if coalesce((v_first->>'replay')::boolean, true) then
    raise exception 'ثبت نخست نباید replay باشد';
  end if;
  if coalesce((v_first->'stats'->>'coins')::integer, -1) <> 2 then
    raise exception 'سکهٔ پاسخ درست باید دقیقاً ۲ شود';
  end if;

  v_second := public.commit_answer(v_event, '[]'::jsonb, v_cards);
  if coalesce((v_second->>'replay')::boolean, false) is not true then
    raise exception 'تلاش تکراری باید replay شود';
  end if;

  select coins into v_coins from app_users where id = v_uid;
  if v_coins <> 2 then raise exception 'replay نباید سکهٔ اضافه بدهد: %', v_coins; end if;
  select count(*) into v_count from answer_events where user_id = v_uid and attempt_id = v_attempt;
  if v_count <> 1 then raise exception 'باید دقیقاً یک answer_event وجود داشته باشد'; end if;
  select count(*) into v_count from review_cards where user_id = v_uid and question_id = v_qid;
  if v_count <> 2 then raise exception 'کارت سؤال و کارت دام باید هم‌زمان ذخیره شوند؛ count=%', v_count; end if;
  if not exists (select 1 from trap_cards where id = 'trap:' || v_qid) then
    raise exception 'دارایی trap_cards به‌صورت خودکار ساخته نشد';
  end if;

  delete from answer_events where user_id = v_uid;
  delete from review_cards where user_id = v_uid;
  delete from question_attempts where user_id = v_uid;
  delete from user_node_mastery where user_id = v_uid;
  delete from app_users where id = v_uid;
end
$$;

-- پاک‌سازی داده‌های تست‌های قبلی
delete from answer_events where attempt_id in ('test-attempt-1', 'test-rls-1');
delete from user_node_mastery where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
delete from app_users where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
