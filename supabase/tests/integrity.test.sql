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

-- پاک‌سازی دادهٔ تست
delete from answer_events where attempt_id in ('test-attempt-1', 'test-rls-1');
delete from user_node_mastery where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
delete from app_users where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
