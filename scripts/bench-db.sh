#!/usr/bin/env bash
# Local Postgres benchmark for analytics/queue query shapes.
# Creates a throwaway database (default ael_bench) inside the test container,
# applies every migration + seed from scratch, loads synthetic data and runs
# scripts/bench-db.sql. Requires the ael-pg-test container (Docker).
set -euo pipefail

CONTAINER="${PG_CONTAINER:-ael-pg-test}"
DB="${BENCH_DB:-ael_bench}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

psql_db() {
  docker exec -i "$CONTAINER" psql -U ael -d "$DB" -v ON_ERROR_STOP=1 "$@"
}

echo "== container: $CONTAINER, database: $DB =="
docker exec "$CONTAINER" psql -U ael -d postgres -v ON_ERROR_STOP=1 \
  -c "drop database if exists $DB with (force)" \
  -c "create database $DB" >/dev/null

echo "== migrations (from scratch) =="
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  psql_db -q -f - < "$f" >/dev/null
done

echo "== seeds =="
for f in "$ROOT"/supabase/seeds/*.sql; do
  echo "→ $(basename "$f")"
  psql_db -q -f - < "$f" >/dev/null
done

echo "== synthetic load =="
psql_db -q -f - < "$HERE/bench-db-seed.sql" >/dev/null

echo "== query latency (server-side, synthetic data) =="
psql_db -q -f - < "$HERE/bench-db.sql"

echo "== explain: answer_events 30-day filter =="
psql_db -c "explain (analyze, buffers)
select * from answer_events
where user_id = '00000000-0000-0000-0000-000000000001'
  and answered_at >= now() - interval '30 days';"

echo "== done =="
