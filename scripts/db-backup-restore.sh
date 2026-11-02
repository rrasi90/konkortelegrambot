#!/usr/bin/env bash
# Backup/restore rehearsal against the local Postgres test container.
# Dumps the source database, restores into a throwaway database, compares key
# row counts and verifies the Phase 5 index survived, then drops the restore DB.
set -euo pipefail

CONTAINER="${PG_CONTAINER:-ael-pg-test}"
SOURCE="${SOURCE_DB:-ael_bench}"
TARGET="${RESTORE_DB:-ael_bench_restore}"
DUMP="/tmp/${SOURCE}.dump"
export MSYS_NO_PATHCONV=1

counts_sql="select 'app_users='||count(*) from app_users
union all select 'answer_events='||count(*) from answer_events
union all select 'mastery_history='||count(*) from mastery_history
union all select 'review_cards='||count(*) from review_cards
union all select 'daily_queue_items='||count(*) from daily_queue_items
union all select 'questions='||count(*) from questions
order by 1;"

echo "== pg_dump $SOURCE (custom format) =="
docker exec "$CONTAINER" pg_dump -U ael -d "$SOURCE" -Fc -f "$DUMP"

echo "== create $TARGET =="
docker exec "$CONTAINER" psql -U ael -d postgres -v ON_ERROR_STOP=1 \
  -c "drop database if exists $TARGET with (force)" \
  -c "create database $TARGET"

echo "== pg_restore =="
docker exec "$CONTAINER" pg_restore -U ael -d "$TARGET" "$DUMP"

echo "== row counts: source =="
source_counts=$(docker exec "$CONTAINER" psql -U ael -d "$SOURCE" -At -c "$counts_sql")
echo "$source_counts"

echo "== row counts: restore =="
restore_counts=$(docker exec "$CONTAINER" psql -U ael -d "$TARGET" -At -c "$counts_sql")
echo "$restore_counts"

if [ "$source_counts" != "$restore_counts" ]; then
  echo "RESTORE_MISMATCH=1"
  exit 1
fi
echo "RESTORE_COUNTS_MATCH=1"

echo "== index check in restore =="
index_name=$(docker exec "$CONTAINER" psql -U ael -d "$TARGET" -At -c \
  "select indexname from pg_indexes where tablename='answer_events' and indexname='answer_events_user_answered_idx';")
echo "answer_events_user_answered_idx=${index_name:-MISSING}"
if [ "$index_name" != "answer_events_user_answered_idx" ]; then
  exit 1
fi

echo "== cleanup =="
docker exec "$CONTAINER" psql -U ael -d postgres -v ON_ERROR_STOP=1 \
  -c "drop database $TARGET with (force)"
docker exec "$CONTAINER" rm -f "$DUMP"
echo "BACKUP_RESTORE_DRILL=PASS"
