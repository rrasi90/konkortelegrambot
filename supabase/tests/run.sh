#!/usr/bin/env bash
# اجرای تست‌های یکپارچگی دیتابیس روی یک PostgreSQL در دسترس
# نیازمند: DATABASE_URL (مثلاً postgres://ael:ael@localhost:5432/ael_test)
set -euo pipefail

: "${DATABASE_URL:?متغیر DATABASE_URL تنظیم نشده است}"

MIGRATIONS=$(ls "$(dirname "$0")/../migrations/"*.sql | sort)
SEEDS=$(ls "$(dirname "$0")/../seeds/"*.sql 2>/dev/null | sort || true)

echo "== اعمال مهاجرت‌ها =="
for f in $MIGRATIONS; do
  echo "→ $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

echo "== اعمال بذرها =="
for f in $SEEDS; do
  echo "→ $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

echo "== تست‌های یکپارچگی =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/integrity.test.sql"

echo "== همهٔ تست‌های دیتابیس سبز شد =="
