-- Server-side latency for the queries behind GET /api/analytics/learning and
-- the daily queue. Measures query execution only (not PostgREST/network).
-- 10 warmup + 50 measured runs per query; hot user holds 40% of all rows.

create temp table bench_ctx as
select '00000000-0000-0000-0000-000000000001'::uuid as hot_uid;

create temp table bench_samples (query text not null, ms double precision not null);

do $$
declare
  uid uuid;
  t0 timestamptz;
  i int;
begin
  select hot_uid into uid from bench_ctx;
  for i in 1..10 loop
    perform count(*) from answer_events
      where user_id = uid and answered_at >= now() - interval '30 days';
  end loop;
  for i in 1..50 loop
    t0 := clock_timestamp();
    perform count(*) from answer_events
      where user_id = uid and answered_at >= now() - interval '30 days';
    insert into bench_samples values ('answer_events_30d', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;

do $$
declare
  uid uuid;
  t0 timestamptz;
  i int;
begin
  select hot_uid into uid from bench_ctx;
  for i in 1..10 loop
    perform array_agg(id) from answer_events
      where user_id = uid and answered_at >= now() - interval '30 days';
  end loop;
  for i in 1..50 loop
    t0 := clock_timestamp();
    perform array_agg(id) from answer_events
      where user_id = uid and answered_at >= now() - interval '30 days';
    insert into bench_samples values ('answer_events_30d_rows', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;

do $$
declare
  uid uuid;
  t0 timestamptz;
  i int;
begin
  select hot_uid into uid from bench_ctx;
  for i in 1..10 loop
    perform count(*) from mastery_history
      where user_id = uid and recorded_at >= now() - interval '7 days';
  end loop;
  for i in 1..50 loop
    t0 := clock_timestamp();
    perform count(*) from mastery_history
      where user_id = uid and recorded_at >= now() - interval '7 days';
    insert into bench_samples values ('mastery_history_7d', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;

do $$
declare
  uid uuid;
  t0 timestamptz;
  i int;
begin
  select hot_uid into uid from bench_ctx;
  for i in 1..10 loop
    perform count(*) from review_cards where user_id = uid and due_at <= now();
  end loop;
  for i in 1..50 loop
    t0 := clock_timestamp();
    perform count(*) from review_cards where user_id = uid and due_at <= now();
    insert into bench_samples values ('review_cards_due', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;

do $$
declare
  uid uuid;
  t0 timestamptz;
  i int;
  today text := to_char(current_date, 'YYYY-MM-DD');
begin
  select hot_uid into uid from bench_ctx;
  for i in 1..10 loop
    perform count(*) from daily_queue_items where user_id = uid and queue_date = today;
  end loop;
  for i in 1..50 loop
    t0 := clock_timestamp();
    perform count(*) from daily_queue_items where user_id = uid and queue_date = today;
    insert into bench_samples values ('daily_queue_today', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;

do $$
declare
  uid uuid;
  t0 timestamptz;
  i int;
begin
  select hot_uid into uid from bench_ctx;
  for i in 1..10 loop
    perform count(*) from user_node_mastery where user_id = uid;
  end loop;
  for i in 1..50 loop
    t0 := clock_timestamp();
    perform count(*) from user_node_mastery where user_id = uid;
    insert into bench_samples values ('user_node_mastery', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;

select
  query,
  count(*)::int as runs,
  round(avg(ms)::numeric, 3) as avg_ms,
  round(percentile_cont(0.95) within group (order by ms)::numeric, 3) as p95_ms,
  round(max(ms)::numeric, 3) as max_ms
from bench_samples
group by query
order by query;

select
  'answer_events' as table_name,
  pg_size_pretty(pg_total_relation_size('answer_events')) as total_size,
  (select count(*) from answer_events) as row_count;
