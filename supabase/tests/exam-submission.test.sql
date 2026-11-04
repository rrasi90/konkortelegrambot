-- Submission freezes responses, can be retried, and keeps the first report.
begin;
insert into app_users (id, display_name) values ('33333333-3333-3333-3333-333333333333', 'exam test');
insert into exam_sessions (id, user_id, level, exam_year, sub_group_id, booklet_code)
values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
        'doctorate', 1405, 'business', '2162');
do $$
declare
  uid uuid := '33333333-3333-3333-3333-333333333333';
  sid uuid := '44444444-4444-4444-4444-444444444444';
  result jsonb;
  qid text;
begin
  if has_function_privilege('authenticated', 'begin_exam_simulation_submission(uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'finalize_exam_simulation_submission(uuid,uuid,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'record_exam_simulation_response_idempotent(uuid,uuid,text,text,integer,integer)', 'execute') then
    raise exception 'client role has direct execution access';
  end if;
  select id into qid from questions where jsonb_array_length(options) >= 2 limit 1;
  insert into attempt_tickets (attempt_id, user_id, question_id, attempt_type)
    values ('atomic-test-ticket', uid, qid, 'exam_simulation');
  insert into exam_session_items (session_id, question_id, section_id, question_number, attempt_id)
    values (sid, qid, 'specialization', 1, 'atomic-test-ticket');
  perform record_exam_simulation_response_idempotent(uid, sid, 'atomic-test-ticket', qid, 0, 12);
  perform record_exam_simulation_response_idempotent(uid, sid, 'atomic-test-ticket', qid, 0, 12);
  if (select count(*) from exam_session_responses where session_id = sid) <> 1 then
    raise exception 'retry created a duplicate response';
  end if;
  begin
    perform record_exam_simulation_response_idempotent(uid, sid, 'atomic-test-ticket', qid, 1, 12);
    raise exception 'different replay was accepted';
  exception when sqlstate '45012' then null;
  end;
  result := begin_exam_simulation_submission(uid, sid);
  if result->>'status' <> 'submitted' then raise exception 'session was not frozen'; end if;
  begin
    perform record_exam_simulation_response(uid, sid, 'not-a-ticket', 'not-a-question', 0, null);
    raise exception 'answer after freeze was accepted';
  exception when sqlstate '45009' then null;
  end;
  result := begin_exam_simulation_submission(uid, sid);
  if result->>'status' <> 'submitted' then raise exception 'retry changed status'; end if;
  result := finalize_exam_simulation_submission(uid, sid, '{"score":1}'::jsonb);
  if result <> '{"score":1}'::jsonb then raise exception 'first report not stored'; end if;
  result := finalize_exam_simulation_submission(uid, sid, '{"score":2}'::jsonb);
  if result <> '{"score":1}'::jsonb then raise exception 'retry overwrote report'; end if;
  begin
    perform begin_exam_simulation_submission('55555555-5555-5555-5555-555555555555', sid);
    raise exception 'foreign user was accepted';
  exception when sqlstate '45001' then null;
  end;
end
$$;
rollback;
