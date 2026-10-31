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

  insert into attempt_tickets (attempt_id, user_id, question_id, attempt_type, expires_at)
  values ('ticket-test-1', '33333333-3333-3333-3333-333333333333', v_qid, 'verification', now() + interval '1 hour');

  v_res := submit_answer_secure(
    '33333333-3333-3333-3333-333333333333',
    'ticket-test-1',
    v_qid,
    0
  );

  if not exists (select 1 from attempt_tickets where attempt_id = 'ticket-test-1' and consumed_at is not null) then
    raise exception 'بلیت تلاش باید پس از ثبت پاسخ مصرف شده باشد';
  end if;
  if not exists (select 1 from answer_events where attempt_id = 'ticket-test-1' and attempt_type = 'verification') then
    raise exception 'نوع تلاش باید از بلیت سرور در answer_events ثبت شود';
  end if;

  begin
    perform submit_answer_secure(
      '33333333-3333-3333-3333-333333333333',
      'ticket-test-1',
      'different-question-id',
      0
    );
    raise exception 'تلاش با سوال متفاوت روی attempt_id یکسان باید رد شود';
  exception when sqlstate '45002' then
    -- شناسه تلاش قبلاً برای سؤال دیگری ثبت شده است.
    null;
  end;

  -- A valid user/question pair must still be rejected without a server-issued ticket.
  begin
    perform submit_answer_secure(
      '33333333-3333-3333-3333-333333333333',
      'ticket-missing-test',
      v_qid,
      0
    );
    raise exception 'پاسخ بدون بلیت سرور نباید پذیرفته شود';
  exception when sqlstate '45007' then
    null;
  end;
  if exists (select 1 from answer_events where attempt_id = 'ticket-missing-test') then
    raise exception 'نباید برای پاسخ فاقد بلیت رویداد ثبت شود';
  end if;

  delete from answer_events where user_id = '33333333-3333-3333-3333-333333333333';
  delete from attempt_tickets where user_id = '33333333-3333-3333-3333-333333333333';
  delete from learner_skill_states where user_id = '33333333-3333-3333-3333-333333333333';
  if has_function_privilege('authenticated', 'public.submit_answer_secure(uuid,text,text,integer,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'authenticated نباید بتواند RPC ثبت پاسخ را مستقیماً فراخوانی کند';
  end if;
  if has_function_privilege('anon', 'public.submit_answer_secure(uuid,text,text,integer,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'anon نباید بتواند RPC ثبت پاسخ را فراخوانی کند';
  end if;
  if not has_function_privilege('service_role', 'public.submit_answer_secure(uuid,text,text,integer,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'service_role باید مجاز به فراخوانی RPC ثبت پاسخ باشد';
  end if;
  delete from app_users where id = '33333333-3333-3333-3333-333333333333';
end
$$;

-- پاک‌سازی دادهٔ تست
delete from answer_events where attempt_id in ('test-attempt-1', 'test-rls-1');
delete from user_node_mastery where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
delete from app_users where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
