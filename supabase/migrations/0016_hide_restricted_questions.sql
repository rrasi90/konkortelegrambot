-- Content authorization is shared by the public DTO and the Worker catalog.
-- The Worker view contains answer keys and is available only to service_role.
create or replace view public.v_worker_question_access as
select q.*,
  case
    when exists (
      select 1
      from public.exam_pack_questions membership
      join public.exam_packs pack on pack.id = membership.exam_pack_id
      where membership.question_id = q.id and membership.holdout_status = 'active'
        and pack.is_active and pack.status in ('published', 'active')
        and pack.rights_status = 'authorized'
    ) then 'proof'
    else 'practice'
  end as access_type
from public.questions q
where q.verification_status in ('verified', 'demo')
  and (
    q.exam_pack_id is null
    or exists (
      select 1 from public.exam_packs pack
      where pack.id = q.exam_pack_id and pack.is_active
        and pack.status in ('published', 'active') and pack.rights_status = 'authorized'
    )
  )
  and not exists (
    select 1
    from public.exam_pack_questions membership
    join public.exam_packs pack on pack.id = membership.exam_pack_id
    where membership.question_id = q.id
      and (
        membership.restricted or membership.holdout_status = 'retired'
        or (
          (membership.is_holdout or membership.holdout_status = 'active' or membership.usage_type in ('holdout', 'proof'))
          and (membership.holdout_status <> 'active' or not pack.is_active
               or pack.status not in ('published', 'active') or pack.rights_status <> 'authorized')
        )
      )
  );

revoke all on public.v_worker_question_access from public, anon, authenticated;
grant select on public.v_worker_question_access to service_role;

create or replace view public.v_public_questions as
select id, node_id, exam_year, question_text, options, exam_pack_id, item_version
from public.v_worker_question_access
where access_type = 'practice';
