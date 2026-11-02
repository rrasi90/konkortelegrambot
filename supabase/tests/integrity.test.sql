-- تست‌های یکپارچگی دیتابیس — با psql اجرا می‌شود (run.sh)
-- هر بلوک DO در صورت شکست exception پرتاب می‌کند و تست رد می‌شود.
\set ON_ERROR_STOP on

-- ۱) مقادیر پیش‌فرض و محدودیت‌ها
do $$
begin
  perform set_config('assert.status', 'ok', false);
  if exists (select 1 from knowledge_nodes where track not in ('common','business','technology')) then
    raise exception 'track نامعتبر در knowledge_nodes';
  end if;
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

-- ۸) ایزولاسیون واقعی RLS (در سطح psql، با تعویض نقش)
insert into app_users (id, display_name) values ('22222222-2222-2222-2222-222222222222', 'تست ۲') on conflict do nothing;
insert into answer_events (user_id, question_id, attempt_id, selected_option, is_correct)
select '22222222-2222-2222-2222-222222222222', id, 'test-rls-1', 1, false from questions limit 1;

-- تعویض نقش بهAuthenticated برای تست RLS
set role authenticated;
set ael.uid = '22222222-2222-2222-2222-222222222222';
-- کاربر ۲ باید رویداد خودش را ببیند (اگر نبود، خطا: تقسیم بر صفر)
select 1/((count(*) > 0)::int) as own_visible
from answer_events where user_id = '22222222-2222-2222-2222-222222222222';
set ael.uid = '11111111-1111-1111-1111-111111111111';
-- کاربر ۱ نباید رویداد کاربر ۲ را ببیند (اگر دید، خطا)
select 1/((count(*) = 0)::int) as foreign_hidden
from answer_events where user_id = '22222222-2222-2222-2222-222222222222';
reset role;


-- ۹) عدم دسترسی مستقیم نقش‌های عمومی به جدول questions و الزام استفاده از v_public_questions
do $$
begin
  if has_table_privilege('authenticated', 'questions', 'SELECT') then
    raise exception 'نقش authenticated نباید دسترسی مستقیم SELECT به جدول questions داشته باشد';
  end if;
  if has_table_privilege('anon', 'questions', 'SELECT') then
    raise exception 'نقش anon نباید دسترسی مستقیم SELECT به جدول questions داشته باشد';
  end if;
  if not has_table_privilege('authenticated', 'v_public_questions', 'SELECT') then
    raise exception 'نمای v_public_questions باید برای authenticated در دسترس باشد';
  end if;
end
$$;

-- ۱۰) آزمون تابع امن submit_answer_secure و مصرف اتمیک بلیت تلاش
do $$
declare
  v_qid text;
  v_res jsonb;
begin
  insert into app_users (id, display_name) values ('33333333-3333-3333-3333-333333333333', 'تست ۳') on conflict do nothing;
  select id into v_qid from questions limit 1;

  insert into attempt_tickets (attempt_id, user_id, question_id, expires_at)
  values ('ticket-test-1', '33333333-3333-3333-3333-333333333333', v_qid, now() + interval '1 hour');

  v_res := submit_answer_secure(
    '33333333-3333-3333-3333-333333333333',
    'ticket-test-1',
    v_qid,
    0
  );

  if not exists (select 1 from attempt_tickets where attempt_id = 'ticket-test-1' and consumed_at is not null) then
    raise exception 'بلیت تلاش باید پس از ثبت پاسخ مصرف شده باشد';
  end if;

  begin
    perform submit_answer_secure(
      '33333333-3333-3333-3333-333333333333',
      'ticket-test-1',
      'different-question-id',
      0
    );
    raise exception 'تلاش با سوال متفاوت روی attempt_id یکسان باید رد شود';
  exception when others then
    -- انتظار خطا داریم: تایید شد
  end;

  delete from answer_events where user_id = '33333333-3333-3333-3333-333333333333';
  delete from attempt_tickets where user_id = '33333333-3333-3333-3333-333333333333';
  delete from learner_skill_states where user_id = '33333333-3333-3333-3333-333333333333';
  delete from app_users where id = '33333333-3333-3333-3333-333333333333';
end
$$;

-- پاک‌سازی دادهٔ تست
delete from answer_events where attempt_id in ('test-attempt-1', 'test-rls-1');
delete from user_node_mastery where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
delete from app_users where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- ۱۱) بلیت الزامی است: پاسخ بدون بلیت صادرشده باید رد شود
do $$
declare v_qid text;
begin
  insert into app_users (id, display_name) values ('44444444-4444-4444-4444-444444444444', 'تست ۴') on conflict do nothing;
  select id into v_qid from questions limit 1;
  begin
    perform submit_answer_secure('44444444-4444-4444-4444-444444444444', 'no-ticket-at-all', v_qid, 0);
    raise exception 'پاسخ بدون بلیت نباید پذیرفته شود';
  exception when others then
    null; -- انتظار خطا داریم
  end;
  delete from app_users where id = '44444444-4444-4444-4444-444444444444';
end
$$;

-- ۱۲) بلیت متعلق به کاربر دیگر رد می‌شود
do $$
declare v_qid text;
begin
  insert into app_users (id, display_name) values ('55555555-5555-5555-5555-555555555555', 'تست ۵') on conflict do nothing;
  insert into app_users (id, display_name) values ('66666666-6666-6666-6666-666666666666', 'تست ۶') on conflict do nothing;
  select id into v_qid from questions limit 1;
  insert into attempt_tickets (attempt_id, user_id, question_id, expires_at)
  values ('ticket-cross-user', '55555555-5555-5555-5555-555555555555', v_qid, now() + interval '1 hour');
  begin
    perform submit_answer_secure('66666666-6666-6666-6666-666666666666', 'ticket-cross-user', v_qid, 0);
    raise exception 'بلیت کاربر دیگر نباید قابل‌استفاده باشد';
  exception when others then
    null;
  end;
  delete from answer_events where user_id in ('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666');
  delete from attempt_tickets where attempt_id = 'ticket-cross-user';
  delete from app_users where id in ('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666');
end
$$;

-- ۱۳) RPC فقط service_role؛ anon/authenticated نباید execute داشته باشند
do $$
begin
  if has_function_privilege('anon', 'submit_answer_secure(uuid,text,text,int,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'anon نباید بتواند RPC ثبت پاسخ را صدا بزند';
  end if;
  if has_function_privilege('authenticated', 'submit_answer_secure(uuid,text,text,int,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'authenticated نباید بتواند RPC ثبت پاسخ را صدا بزند';
  end if;
end
$$;

-- ۱۴) R-020 — جداول دامنه: trigger تاریخچهٔ تسلط، یکتایی exam_selections،
-- attempt_id یکتا در daily_queue_items، درج audit_logs
do $$
declare
  v_uid uuid := '77777777-7777-7777-7777-777777777777';
  v_node text;
  v_q text;
begin
  insert into app_users (id, display_name) values (v_uid, 'تست ۱۴') on conflict do nothing;
  select id into v_node from knowledge_nodes limit 1;
  select id into v_q from questions limit 1;

  -- درج اول user_node_mastery → trigger یک ردیف backfill می‌سازد
  insert into user_node_mastery (user_id, node_id, mastery_score, status)
  values (v_uid, v_node, 60, 'learning');
  if (select count(*) from mastery_history where user_id = v_uid) <> 1 then
    raise exception 'trigger باید دقیقاً یک ردیف backfill ثبت کند';
  end if;

  update user_node_mastery set mastery_score = 75 where user_id = v_uid and node_id = v_node;
  if (select count(*) from mastery_history where user_id = v_uid) <> 2 then
    raise exception 'به‌روزرسانی تسلط باید ردیف دوم تاریخچه بسازد';
  end if;
  if not exists (select 1 from mastery_history where user_id = v_uid and previous_score = 60 and new_score = 75) then
    raise exception 'مقادیر قبلی/بعدی تسلط در تاریخچه ثبت نشد';
  end if;

  -- به‌روزرسانی بدون تغییر امتیاز/وضعیت → ردیف جدیدی نمی‌سازد
  update user_node_mastery set last_error_at = now() where user_id = v_uid and node_id = v_node;
  if (select count(*) from mastery_history where user_id = v_uid) <> 2 then
    raise exception 'تغییر بدون تفاوت نباید ردیف تاریخچه بسازد';
  end if;

  -- constraint: فقط یک انتخاب به ازای هر سال
  insert into exam_selections (user_id, exam_year, sub_group_id) values (v_uid, 1405, 'mgr-a');
  begin
    insert into exam_selections (user_id, exam_year, sub_group_id) values (v_uid, 1405, 'mgr-b');
    raise exception 'دومین انتخاب برای همان سال باید با unique رد شود';
  exception when unique_violation then
    null;
  end;

  -- attempt_id یکتا در daily_queue_items
  insert into daily_queue_items (user_id, queue_date, attempt_id, question_id, reason)
  values (v_uid, '2026-11-01', 'dq-att-1', v_q, 'scheduled');
  begin
    insert into daily_queue_items (user_id, queue_date, attempt_id, question_id, reason)
    values (v_uid, '2026-11-01', 'dq-att-1', v_q, 'review');
    raise exception 'attempt_id تکراری در daily_queue_items باید رد شود';
  exception when unique_violation then
    null;
  end;

  -- audit_logs قابل درج است
  insert into audit_logs (user_id, action, entity_type) values (v_uid, 'test_action', 'unit_test');
  if not exists (select 1 from audit_logs where user_id = v_uid and action = 'test_action') then
    raise exception 'ردیف audit_logs ثبت نشد';
  end if;

  -- §8.1: مقدار reason='diagnostic' باید در چک‌کنstraint daily_queue_items مجاز باشد
  insert into daily_queue_items (user_id, queue_date, attempt_id, question_id, reason)
  values (v_uid, '2026-11-01', 'dq-diag-1', v_q, 'diagnostic');
  if not exists (select 1 from daily_queue_items where attempt_id = 'dq-diag-1' and reason = 'diagnostic') then
    raise exception 'ردیف diagnostic در daily_queue_items ثبت نشد';
  end if;
  -- و مقدار کاملاً نامعتبر باید با check_rejected رد شود
  begin
    insert into daily_queue_items (user_id, queue_date, attempt_id, question_id, reason)
    values (v_uid, '2026-11-01', 'dq-bad-1', v_q, 'not_a_reason');
    raise exception 'reason نامعتبر باید با check رد شود';
  exception when check_violation then
    null;
  end;

  delete from mastery_history where user_id = v_uid;
  delete from user_node_mastery where user_id = v_uid;
  delete from exam_selections where user_id = v_uid;
  delete from daily_queue_items where user_id = v_uid;
  delete from audit_logs where user_id = v_uid;
  delete from app_users where id = v_uid;
end
$$;

-- ۱۵) وضعیت مهارت باید دقیقاً خروجی موتور باشد؛ هیچ heuristic مستقل SQL اجرا نشود
do $$
declare
  v_uid uuid := '88888888-8888-8888-8888-888888888888';
  v_qid text;
  v_node text;
  v_correct int;
  v_skill_id text := 'integrity-engine-authoritative-skill';
  v_result jsonb;
begin
  insert into app_users (id, display_name)
  values (v_uid, 'تست وضعیت موتور') on conflict do nothing;

  select id, node_id, correct_option
  into v_qid, v_node, v_correct
  from questions
  order by id
  limit 1;

  if v_qid is null or v_node is null then
    raise exception 'برای تست وضعیت موتور سؤال و گرهٔ معتبر لازم است';
  end if;

  insert into skills (id, node_id, title, verification_status)
  values (v_skill_id, v_node, 'Integrity engine state', 'unverified')
  on conflict (id) do nothing;

  insert into attempt_tickets (attempt_id, user_id, question_id, attempt_type, expires_at)
  values ('ticket-engine-authoritative-state', v_uid, v_qid, 'practice', now() + interval '1 hour');

  v_result := submit_answer_secure(
    v_uid,
    'ticket-engine-authoritative-state',
    v_qid,
    v_correct,
    jsonb_build_object(
      'skillStateUpdate',
      jsonb_build_object(
        'nodeId', v_node,
        'state', jsonb_build_object(
          'skillId', v_skill_id,
          'proficiencyProbability', 0.8123,
          'confidence', 0.6543,
          'evidenceCount', 7,
          'memoryRetrievability', 0.8765,
          'fluencySpeedRatio', 1.2345,
          'dominantErrorType', 'time_pressure',
          'coverageStatus', 'needs_proof'
        )
      )
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  );

  if not exists (
    select 1 from learner_skill_states
    where user_id = v_uid
      and skill_id = v_skill_id
      and proficiency_probability = 0.8123
      and confidence = 0.6543
      and evidence_count = 7
      and memory_retrievability = 0.8765
      and fluency_speed_ratio = 1.2345
      and dominant_error_type = 'time_pressure'
      and coverage_status = 'needs_proof'
  ) then
    raise exception 'وضعیت مهارت باید بدون تغییر از خروجی موتور ذخیره شود';
  end if;

  if exists (
    select 1 from learner_skill_states
    where user_id = v_uid and skill_id = v_skill_id
      and proficiency_probability in (0.65, 0.35)
  ) then
    raise exception 'heuristic قدیمی SQL نباید وضعیت مهارت بسازد';
  end if;

  delete from answer_events where user_id = v_uid;
  delete from attempt_tickets where user_id = v_uid;
  delete from learner_skill_states where user_id = v_uid;
  delete from skills where id = v_skill_id;
  delete from app_users where id = v_uid;
end
$$;
