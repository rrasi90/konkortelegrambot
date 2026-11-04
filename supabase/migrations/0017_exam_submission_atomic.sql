-- Freeze the answer set before scoring. The response RPC locks the same row.
create or replace function begin_exam_simulation_submission(p_user_id uuid, p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_session exam_sessions%rowtype;
begin
  select * into v_session from exam_sessions where id = p_session_id for update;
  if v_session.id is null or v_session.user_id <> p_user_id then
    raise exception 'Exam session not found' using errcode = '45001';
  end if;
  if v_session.status = 'active' then
    update exam_sessions set status = 'submitted', submitted_at = now()
      where id = p_session_id returning * into v_session;
  end if;
  return to_jsonb(v_session);
end
$$;

-- The first report wins. A retry returns the already-stored report.
create or replace function finalize_exam_simulation_submission(p_user_id uuid, p_session_id uuid, p_report jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_session exam_sessions%rowtype;
begin
  select * into v_session from exam_sessions where id = p_session_id for update;
  if v_session.id is null or v_session.user_id <> p_user_id then
    raise exception 'Exam session not found' using errcode = '45001';
  end if;
  if v_session.status = 'submitted' then
    update exam_sessions set status = 'scored', report = p_report
      where id = p_session_id returning * into v_session;
  end if;
  if v_session.status <> 'scored' or v_session.report is null then
    raise exception 'Exam session is not submitted' using errcode = '45009';
  end if;
  return v_session.report;
end
$$;

revoke all on function begin_exam_simulation_submission(uuid, uuid) from public, anon, authenticated;
revoke all on function finalize_exam_simulation_submission(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function begin_exam_simulation_submission(uuid, uuid) to service_role;
grant execute on function finalize_exam_simulation_submission(uuid, uuid, jsonb) to service_role;
