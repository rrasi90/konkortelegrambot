#!/usr/bin/env bash
# اجرای تست‌های یکپارچگی دیتابیس روی یک PostgreSQL در دسترس
# فقط برای PostgreSQL موقت و خالی روی loopback.
set -euo pipefail

if [[ "${AEL_DISPOSABLE_DB:-}" != 1 ]]; then
  echo 'DB_TEST_REFUSED: set AEL_DISPOSABLE_DB=1 for an empty disposable database.' >&2
  exit 2
fi

if ! node --input-type=module <<'JS'
try {
  const db = new URL(process.env.DATABASE_URL);
  const local = db.hostname === '127.0.0.1' || db.hostname === '[::1]';
  const testName = /^\/[A-Za-z0-9_]+_test$/.test(db.pathname);
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || !local ||
      !testName || db.search || db.hash || !db.port) process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
JS
then
  echo 'DB_TEST_REFUSED: DATABASE_URL must name a loopback *_test database with an explicit port.' >&2
  exit 2
fi

# Prevent libpq from overriding the validated target.
unset PGHOSTADDR PGSERVICE PGSERVICEFILE
db_psql() {
  psql -X --dbname "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
}

if [[ "$(db_psql -Atc "
  select current_database() ~ '^[A-Za-z0-9_]+_test$'
    and to_regnamespace('supabase_migrations') is null
    and to_regclass('auth.users') is null
    and not exists (
      select 1 from pg_tables where schemaname not in ('pg_catalog', 'information_schema')
    );
")" != t ]]; then
  echo 'DB_TEST_REFUSED: target could not be verified as a fresh test database.' >&2
  exit 2
fi

MIGRATIONS=$(ls "$(dirname "$0")/../migrations/"*.sql | sort)
SEEDS=$(ls "$(dirname "$0")/../seeds/"*.sql 2>/dev/null | sort || true)

echo "== اعمال مهاجرت‌ها =="
for f in $MIGRATIONS; do
  echo "→ $f"
  db_psql --single-transaction -f "$f" >/dev/null
done

echo "== اعمال بذرها =="
for f in $SEEDS; do
  echo "→ $f"
  db_psql -f "$f" >/dev/null
done

echo "== تست‌های یکپارچگی =="
db_psql -f "$(dirname "$0")/public-questions.test.sql"
db_psql -f "$(dirname "$0")/integrity.test.sql"

echo "== همهٔ تست‌های دیتابیس سبز شد =="
