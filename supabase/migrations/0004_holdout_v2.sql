-- supabase/migrations/0004_holdout_v2.sql -- Holdout mechanic v2
-- Fact truth is exam_pack_questions, not the main questions table

-- 1. Add holdout_status ONLY to exam_pack_questions (NOT questions table)
--    The question's holdout status is derived from its exam_pack membership

-- 2. Add restricted column for fine-grained control
alter table exam_pack_questions add column if not exists restricted boolean not null default false;
alter table exam_pack_questions add constraint ck_restricted check (restricted in (true, false));

-- 3. Policy function to enforce holdout only on active packs
create or replace function set_holdout_policy()
returns trigger as $$
begin
  -- Only allow holdout_status='active' when exam_pack is active
  if new.holdout_status = 'active' then
    if not exists (select 1 from exam_packs where id = new.exam_pack_id and is_active = true) then
      signal sqlstate '45000' set message_text = 'Cannot set holdout on inactive exam pack';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_holdout_check before insert or update on exam_pack_questions
  for each row execute function set_holdout_policy();

-- 4. View for easy querying of active holdout questions
create or replace view v_active_holdout_questions as
select qp.*, q.question_text, q.correct_option, q.item_version, q.exam_pack_id
from exam_pack_questions qp
join questions q on qp.question_id = q.id
where qp.holdout_status = 'active' and qp.restricted = false;

-- 5. Update RLS policies
-- Allow authenticated to see holdout context but not the answers
create policy read_holdout_context on exam_pack_questions for select using (true);
grant select on exam_pack_questions to authenticated;
