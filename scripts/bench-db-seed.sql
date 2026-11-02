-- Synthetic load for the local Postgres benchmark. NOT production data.
-- 500 users, 200k answer events (40% concentrated on one user), 100k mastery
-- history rows, one review card per user/question and 15k queue items.

begin;

insert into app_users (id, telegram_user_id, display_name)
select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
       900000000 + i,
       'bench-user-' || i
from generate_series(1, 500) as i
on conflict (id) do nothing;

insert into answer_events (user_id, question_id, selected_option, is_correct, attempt_id, answered_at)
select
  case
    when g % 5 = 0 then '00000000-0000-0000-0000-000000000001'::uuid
    else ('00000000-0000-0000-0000-' || lpad(((g % 500) + 1)::text, 12, '0'))::uuid
  end,
  (array[
    'demo-q-001','demo-q-002','demo-q-003','demo-q-004','demo-q-005','demo-q-006',
    'demo-q-007','demo-q-008','demo-q-009','demo-q-010','demo-q-011','demo-q-012',
    'demo-q-013','demo-q-014'
  ])[1 + (g % 14)],
  g % 4,
  (g % 3 = 0),
  'bench-ans-' || g,
  now() - ((g % 90) || ' days')::interval
from generate_series(1, 200000) as g
on conflict (user_id, attempt_id) do nothing;

insert into mastery_history
  (user_id, node_id, previous_score, new_score, previous_status, new_status, change_reason, recorded_at)
select
  case
    when g % 5 = 0 then '00000000-0000-0000-0000-000000000001'::uuid
    else ('00000000-0000-0000-0000-' || lpad(((g % 500) + 1)::text, 12, '0'))::uuid
  end,
  (array[
    'mb.structure','mb.contingency','sm.rbv','sm.value_chain','sm.portfolio',
    'stats.scales','stats.anova','mkt.brand','mkt.plc','mkt.consumer',
    'inno.s_curve','inno.ambidextrous','tech.absorptive'
  ])[1 + (g % 13)],
  40, 45, 'weak', 'learning', 'answer_submit',
  now() - ((g % 30) || ' days')::interval
from generate_series(1, 100000) as g;

insert into review_cards (id, user_id, node_id, card_type, question_id, due_at, interval_days)
select
  'bench-card-' || u || '-' || q.qid,
  ('00000000-0000-0000-0000-' || lpad(u::text, 12, '0'))::uuid,
  q.node_id,
  'question',
  q.qid,
  now() + (((u + q.n) % 10) - 5) * interval '1 day',
  1 + (u % 30)
from generate_series(1, 500) as u
cross join (values
  ('demo-q-001','sm.rbv',1), ('demo-q-002','sm.rbv',2), ('demo-q-003','sm.value_chain',3),
  ('demo-q-004','sm.portfolio',4), ('demo-q-005','stats.scales',5), ('demo-q-006','stats.anova',6),
  ('demo-q-007','mb.structure',7), ('demo-q-008','mb.contingency',8), ('demo-q-009','mkt.brand',9),
  ('demo-q-010','mkt.plc',10), ('demo-q-011','mkt.consumer',11), ('demo-q-012','inno.s_curve',12),
  ('demo-q-013','inno.ambidextrous',13), ('demo-q-014','tech.absorptive',14)
) as q(qid, node_id, n)
on conflict do nothing;

insert into daily_queue_items (user_id, queue_date, attempt_id, question_id, node_id, reason, status)
select
  ('00000000-0000-0000-0000-' || lpad(u::text, 12, '0'))::uuid,
  to_char(current_date - (d % 30), 'YYYY-MM-DD'),
  'bench-queue-' || u || '-' || d,
  q.qid,
  q.node_id,
  'review',
  'pending'
from generate_series(1, 500) as u
cross join generate_series(1, 30) as d
cross join lateral (
  select
    (array['demo-q-001','demo-q-002','demo-q-003','demo-q-004','demo-q-005',
            'demo-q-006','demo-q-007'])[1 + (d % 7)] as qid,
    (array['sm.rbv','sm.value_chain','sm.portfolio','stats.scales',
            'stats.anova','mb.structure','mb.contingency'])[1 + (d % 7)] as node_id
) as q
on conflict (attempt_id) do nothing;

analyze app_users;
analyze answer_events;
analyze mastery_history;
analyze review_cards;
analyze daily_queue_items;

commit;
