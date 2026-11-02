-- Phase 4 §8.7 — verification of migration 0012 against local docker Postgres (ael_test)
-- Transaction is rolled back at the end; only structural/RPC/RLS behavior is proven.
\set ON_ERROR_STOP on
begin;

-- ۰) ساختار: ستون‌های مبدأ محتوا، جدول‌ها، RLS و امنیت تابع
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='questions' and column_name='exam_level') then
    raise exception 'questions.exam_level is missing';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='questions' and column_name='content_origin') then
    raise exception 'questions.content_origin is missing';
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='exam_sessions') then
    raise exception 'exam_sessions is missing';
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='exam_session_items') then
    raise exception 'exam_session_items is missing';
  end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='exam_session_responses') then
    raise exception 'exam_session_responses is missing';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.exam_sessions'::regclass) then
    raise exception 'RLS is not enabled on exam_sessions';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.exam_session_items'::regclass) then
    raise exception 'RLS is not enabled on exam_session_items';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.exam_session_responses'::regclass) then
    raise exception 'RLS is not enabled on exam_session_responses';
  end if;
  if not (select prosecdef from pg_proc where oid='public.record_exam_simulation_response(uuid,uuid,text,text,int,int)'::regprocedure) then
    raise exception 'RPC is not SECURITY DEFINER';
  end if;
end $$;

-- ۱) دادهٔ آزمون: دو کاربر، جلسه‌ها، بلیت‌ها و آیتم‌ها
do $$
declare
  u1 uuid := '11111111-1111-1111-1111-111111111111';
  u2 uuid := '22222222-2222-2222-2222-222222222222';
  s1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  s2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  s3 uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  q1 text; q2 text; q3 text; q4 text; q5 text; q6 text; q7 text; q8 text;
  v_len int;
begin
  insert into app_users (id, display_name) values (u1, 'rpc-owner'), (u2, 'rpc-other');

  select id into q1 from (select id, row_number() over (order by id) rn from questions) t where rn = 1;
  select id into q2 from (select id, row_number() over (order by id) rn from questions) t where rn = 2;
  select id into q3 from (select id, row_number() over (order by id) rn from questions) t where rn = 3;
  select id into q4 from (select id, row_number() over (order by id) rn from questions) t where rn = 4;
  select id into q5 from (select id, row_number() over (order by id) rn from questions) t where rn = 5;
  select id into q6 from (select id, row_number() over (order by id) rn from questions) t where rn = 6;
  select id into q7 from (select id, row_number() over (order by id) rn from questions) t where rn = 7;
  select id into q8 from (select id, row_number() over (order by id) rn from questions) t where rn = 8;
  select jsonb_array_length(options) into v_len from questions where id = q1;
  if v_len < 2 then raise exception 'need question with >=2 options'; end if;

  insert into exam_sessions (id, user_id, level, exam_year, sub_group_id, booklet_code, plan_snapshot, disclosures)
  values (s1, u1, 'doctorate', 1405, 'business', '2162', '{"source":"verify"}'::jsonb, '["verify"]'::jsonb),
         (s2, u1, 'doctorate', 1405, 'business', '2162', '{}'::jsonb, '[]'::jsonb),
         (s3, u1, 'doctorate', 1405, 'business', '2162', '{}'::jsonb, '[]'::jsonb);
  update exam_sessions set expires_at = now() - interval '1 minute' where id = s2;
  update exam_sessions set status = 'submitted' where id = s3;

  insert into attempt_tickets (attempt_id, user_id, question_id, attempt_type) values
    ('t-correct',  u1, q1, 'exam_simulation'),
    ('t-wrong',    u1, q2, 'exam_simulation'),
    ('t-other',    u1, q3, 'exam_simulation'),
    ('t-mismatch', u1, q4, 'exam_simulation'),
    ('t-practice', u1, q6, 'practice'),
    ('t-range',    u1, q7, 'exam_simulation'),
    ('t-expired',  u1, q8, 'exam_simulation'),
    ('t-submitted',u1, q8, 'exam_simulation'),
    ('t-notins',   u1, q8, 'exam_simulation'),
    ('t-unknown',  u1, q8, 'exam_simulation');

  insert into exam_session_items (session_id, question_id, section_id, question_number, attempt_id) values
    (s1, q1, 'specialization', 1, 't-correct'),
    (s1, q2, 'specialization', 2, 't-wrong'),
    (s1, q3, 'specialization', 3, 't-other'),
    (s1, q5, 'specialization', 4, 't-q5-item'),
    (s1, q6, 'specialization', 5, 't-practice'),
    (s1, q7, 'language',       6, 't-range'),
    (s2, q8, 'specialization', 1, 't-expired'),
    (s3, q8, 'specialization', 1, 't-submitted');
  -- آیتم q5 برای آزمایش ناهم‌خوانی سؤال بلیت؛ بلیت مربوطه صادر نمی‌شود
  insert into attempt_tickets (attempt_id, user_id, question_id, attempt_type)
  values ('t-q5-item', u1, q5, 'exam_simulation');
end $$;

-- ۲) مسیر موفق: درستی سمت سرور + مصرف بلیت
do $$
declare
  r jsonb;
  v_correct int;
  v_len int;
  v_consumed timestamptz;
  v_is_correct boolean;
  q1 text;
begin
  select id into q1 from (select id, row_number() over (order by id) rn from questions) t where rn = 1;
  select correct_option, jsonb_array_length(options) into v_correct, v_len from questions where id = q1;

  r := record_exam_simulation_response(
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    't-correct', q1, v_correct, 1234);
  if r <> '{"recorded": true}'::jsonb then raise exception 'unexpected RPC result: %', r; end if;

  select is_correct into v_is_correct from exam_session_responses
   where session_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and question_id = q1;
  if v_is_correct is distinct from true then raise exception 'correct answer not scored as correct'; end if;

  select consumed_at into v_consumed from attempt_tickets where attempt_id = 't-correct';
  if v_consumed is null then raise exception 'ticket was not consumed'; end if;

  -- پاسخ غلط: گزینهٔ بعدی (modulo) همیشه متفاوت از کلید است
  r := record_exam_simulation_response(
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    't-wrong',
    (select id from (select id, row_number() over (order by id) rn from questions) t where rn = 2),
    (select (correct_option + 1) % jsonb_array_length(options) from questions
      where id = (select id from (select id, row_number() over (order by id) rn from questions) t where rn = 2)),
    null);
  select is_correct into v_is_correct from exam_session_responses
   where session_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and question_id = (select id from (select id, row_number() over (order by id) rn from questions) t where rn = 2);
  if v_is_correct is distinct from false then raise exception 'wrong answer not scored as wrong'; end if;
end $$;

-- ۳) ردّ خطاها با کد مشخص
do $$
declare
  u1 uuid := '11111111-1111-1111-1111-111111111111';
  u2 uuid := '22222222-2222-2222-2222-222222222222';
  s1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  s2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  s3 uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  q1 text; q2 text; q3 text; q4 text; q5 text; q6 text; q7 text; q8 text;
  v_ok boolean;
begin
  select id into q1 from (select id, row_number() over (order by id) rn from questions) t where rn = 1;
  select id into q2 from (select id, row_number() over (order by id) rn from questions) t where rn = 2;
  select id into q3 from (select id, row_number() over (order by id) rn from questions) t where rn = 3;
  select id into q4 from (select id, row_number() over (order by id) rn from questions) t where rn = 4;
  select id into q5 from (select id, row_number() over (order by id) rn from questions) t where rn = 5;
  select id into q6 from (select id, row_number() over (order by id) rn from questions) t where rn = 6;
  select id into q7 from (select id, row_number() over (order by id) rn from questions) t where rn = 7;
  select id into q8 from (select id, row_number() over (order by id) rn from questions) t where rn = 8;

  -- 45003: جلسهٔ کاربر دیگر
  v_ok := false;
  begin
    perform record_exam_simulation_response(u2, s1, 't-other', q3, 0, null);
  exception when others then
    if sqlstate = '45003' then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'foreign session was accepted'; end if;

  -- 45004: بلیت برای سؤال دیگر صادر شده
  v_ok := false;
  begin
    perform record_exam_simulation_response(u1, s1, 't-mismatch', q5, 0, null);
  exception when others then
    if sqlstate = '45004' then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'mismatched ticket question was accepted'; end if;

  -- 45010: بلیت غیر شبیه‌سازی
  v_ok := false;
  begin
    perform record_exam_simulation_response(u1, s1, 't-practice', q6, 0, null);
  exception when others then
    if sqlstate = '45010' then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'practice ticket was accepted by exam simulation'; end if;

  -- 45005: بلیت مصرف‌شده
  v_ok := false;
  begin
    perform record_exam_simulation_response(u1, s1, 't-correct', q1, 0, null);
  exception when others then
    if sqlstate = '45005' then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'consumed ticket was accepted'; end if;

  -- 45012: سؤال تکراری در همان جلسه (بلیت تازه، آیتم موجود)
  update attempt_tickets set consumed_at = null where attempt_id = 't-correct';
  v_ok := false;
  begin
    perform record_exam_simulation_response(u1, s1, 't-correct', q1, 0, null);
  exception when others then
    if sqlstate = '45012' then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'duplicate answer was accepted'; end if;
  update attempt_tickets set consumed_at = now() where attempt_id = 't-correct';

  -- 45008: گزینه خارج از محدوده
  v_ok := false;
  begin
    perform record_exam_simulation_response(u1, s1, 't-range', q7, 99, null);
  exception when others then
    if sqlstate = '45008' then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'out-of-range option was accepted'; end if;

  -- 45006: جلسهٔ منقضی
  v_ok := false;
  begin
    perform record_exam_simulation_response(u1, s2, 't-expired', q8, 0, null);
  exception when others then
    if sqlstate = '45006' then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'expired session was accepted'; end if;

  -- 45009: جلسهٔ ارسال‌شده
  v_ok := false;
  begin
    perform record_exam_simulation_response(u1, s3, 't-submitted', q8, 0, null);
  exception when others then
    if sqlstate = '45009' then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'submitted session was accepted'; end if;

  -- 45011: سؤال بیرون از برگهٔ همین جلسه
  v_ok := false;
  begin
    perform record_exam_simulation_response(u1, s1, 't-notins', q8, 0, null);
  exception when others then
    if sqlstate = '45011' then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'question outside session was accepted'; end if;

  -- 45001: جلسهٔ ناموجود
  v_ok := false;
  begin
    perform record_exam_simulation_response(u1, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 't-unknown', q8, 0, null);
  exception when others then
    if sqlstate = '45001' then v_ok := true; else raise; end if;
  end;
  if not v_ok then raise exception 'unknown session was accepted'; end if;
end $$;

-- ۴) RLS: کاربر فقط rows خودش را می‌بیند و اجازهٔ نوشتن/اجرای مستقیم ندارد
set local role authenticated;
select set_config('ael.uid', '11111111-1111-1111-1111-111111111111', true);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from exam_sessions;
  if v_count <> 3 then raise exception 'RLS owner sees % sessions, expected 3', v_count; end if;
  select count(*) into v_count from exam_session_items;
  if v_count <> 8 then raise exception 'RLS owner sees % items, expected 8', v_count; end if;
  select count(*) into v_count from exam_session_responses;
  if v_count <> 2 then raise exception 'RLS owner sees % responses, expected 2', v_count; end if;
end $$;

select set_config('ael.uid', '22222222-2222-2222-2222-222222222222', true);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from exam_sessions;
  if v_count <> 0 then raise exception 'RLS leak: other user sees % sessions', v_count; end if;
end $$;

do $$
begin
  begin
    insert into exam_sessions (user_id, level, exam_year, sub_group_id, booklet_code)
    values ('22222222-2222-2222-2222-222222222222', 'master', 1405, 'business', '1142');
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'authenticated direct insert into exam_sessions was allowed';
end $$;

do $$
begin
  begin
    perform record_exam_simulation_response(
      '22222222-2222-2222-2222-222222222222',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      't-other', 'dummy', 0, null);
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'authenticated direct RPC execution was allowed';
end $$;

reset role;
rollback;
