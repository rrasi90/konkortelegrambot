-- 0013_answer_events_user_time_index.sql — Phase 5 performance
-- GET /api/analytics/learning filters answer_events by
-- (user_id, answered_at >= since) via listAnswersSince. The previous indexes
-- only covered (user_id, pack_id), forcing a heap filter over every row of the
-- user. This index serves the 30-day evidence window directly.
create index if not exists answer_events_user_answered_idx
  on answer_events (user_id, answered_at);
