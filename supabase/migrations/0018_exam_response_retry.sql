-- Retry an identical response without consuming a ticket or creating a second row.
create or replace function record_exam_simulation_response_idempotent(
  p_user_id uuid, p_session_id uuid, p_attempt_id text, p_question_id text,
  p_selected_option int, p_response_time_ms int default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_session exam_sessions%rowtype;
  v_existing exam_session_responses%rowtype;
begin
  select * into v_session from exam_sessions where id = p_session_id for update;
  if v_session.id is null or v_session.user_id <> p_user_id then
    raise exception 'Exam session not found' using errcode = '45001';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Exam session is not active' using errcode = '45009';
  end if;
  if v_session.expires_at < now() then
    raise exception 'Exam session expired' using errcode = '45006';
  end if;
  select r.* into v_existing from exam_session_responses r
    join exam_session_items i on i.session_id = r.session_id and i.question_id = r.question_id
    join attempt_tickets t on t.attempt_id = i.attempt_id
    where r.session_id = p_session_id and r.question_id = p_question_id
      and i.attempt_id = p_attempt_id and t.user_id = p_user_id
      and t.question_id = p_question_id and t.attempt_type = 'exam_simulation'
      and t.consumed_at is not null and t.expires_at > now();
  if v_existing.question_id is not null then
    if v_existing.selected_option = p_selected_option then
      return jsonb_build_object('recorded', true);
    end if;
    raise exception 'Question already answered in this exam session' using errcode = '45012';
  end if;
  return record_exam_simulation_response(p_user_id, p_session_id, p_attempt_id, p_question_id,
    p_selected_option, p_response_time_ms);
end
$$;

revoke all on function record_exam_simulation_response_idempotent(uuid, uuid, text, text, int, int) from public, anon, authenticated;
grant execute on function record_exam_simulation_response_idempotent(uuid, uuid, text, text, int, int) to service_role;
