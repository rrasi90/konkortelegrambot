-- Assessment payloads may contain correct answers, distractor explanations or unreleased items.
-- RLS policies alone are not enough if a client has table SELECT privileges.
-- All assessment delivery must pass through a trusted API that strips protected fields.

drop policy if exists "published training items are readable" on public.learning_items;
drop policy if exists "published training mappings are readable" on public.item_skill_mappings;

revoke all privileges on table public.learning_items from public, anon, authenticated;
revoke all privileges on table public.item_skill_mappings from public, anon, authenticated;

-- The service role / trusted server remains responsible for fetching protected content.
-- Never send answer keys in an initial question response. Grade only after a validated submission.
