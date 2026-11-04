\set ON_ERROR_STOP on
begin;

-- The seeded holdout is deliberately made verified so the test checks the
-- independent membership restriction, not only verification_status.
update questions set verification_status = 'verified' where id = 'demo-q-018';
update exam_pack_questions set restricted = true
where question_id = 'demo-q-017' and exam_pack_id = 'demo-pack-phd-management';

set local role anon;
do $$
begin
  if not exists (select 1 from public.v_public_questions where id = 'demo-q-001') then
    raise exception 'A practice question in an authorized pack should remain visible';
  end if;
  if exists (select 1 from public.v_public_questions where id in ('demo-q-017', 'demo-q-018')) then
    raise exception 'A restricted or holdout question leaked through the public view';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'v_public_questions'
      and column_name in ('correct_option', 'explanation', 'trap_note')
  ) then
    raise exception 'The public question projection includes private columns';
  end if;
end
$$;
reset role;
do $$
begin
  if has_table_privilege('anon', 'public.v_worker_question_access', 'SELECT')
     or has_table_privilege('authenticated', 'public.v_worker_question_access', 'SELECT')
     or not has_table_privilege('service_role', 'public.v_worker_question_access', 'SELECT') then
    raise exception 'Worker answer catalog has incorrect grants';
  end if;
  if not exists (
    select 1 from public.v_worker_question_access where id = 'demo-q-018' and access_type = 'proof'
  ) or exists (
    select 1 from public.v_worker_question_access where id = 'demo-q-017'
  ) then
    raise exception 'Worker catalog misclassified the holdout or restricted item';
  end if;
end
$$;

update exam_packs set rights_status = 'pending' where id = 'demo-pack-phd-management';
set local role authenticated;
do $$
begin
  if exists (select 1 from public.v_public_questions where id = 'demo-q-001') then
    raise exception 'A question from an unauthorized pack leaked through the public view';
  end if;
end
$$;
rollback;
