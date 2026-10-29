#!/usr/bin/env node
/**
 * تست دیتابیس بدون Docker — با PostgreSQL توکار (embedded-postgres).
 * کاربرد: node scripts/db-test-embedded.mjs
 * اجرای migrations + seeds + تست‌های یکپارچگی (همان supabase/tests/run.sh اما محلی).
 */
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = fileURLToPath(new URL('..', import.meta.url));
const dbDir = join(root, '.embedded-pg');

// همیشه از دیتایرس تازه شروع می‌کنیم (اجرای قبلی ممکن است ناتمام مانده باشد)
rmSync(dbDir, { recursive: true, force: true });

const pg = new EmbeddedPostgres({
  databaseDir: dbDir,
  user: 'ael',
  password: 'ael',
  port: 5434,
  persistent: false,
  onLog: () => {},
  onError: () => {},
});
await pg.initialise();
await pg.start();

const admin = pg.getPgClient();
await admin.connect();
await admin.query('DROP DATABASE IF EXISTS ael_test');
await admin.query("CREATE DATABASE ael_test WITH TEMPLATE template0 ENCODING 'UTF8'");
await admin.end();

const client = pg.getPgClient('ael_test');
await client.connect();
await client.query('SET client_min_messages TO warning');

function stripPsqlMeta(sql) {
  // حذف دستورهای فرا-زبانی psql (مثل \set)
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('\\'))
    .join('\n');
}

async function runFile(label, path) {
  const sql = stripPsqlMeta(readFileSync(path, 'utf8'));
  try {
    await client.query(sql);
    console.log(`✓ ${label}: ${path}`);
  } catch (err) {
    console.error(`✗ ${label} شکست خورد: ${path}`);
    console.error(err.message);
    await client.end();
    await pg.stop();
    process.exit(1);
  }
}

const migrations = readdirSync(join(root, 'supabase/migrations')).sort();
for (const f of migrations) {
  await runFile('migration', join(root, 'supabase/migrations', f));
}

let seeds = [];
try {
  seeds = readdirSync(join(root, 'supabase/seeds')).sort();
} catch {
  /* بذری وجود ندارد */
}
for (const f of seeds) {
  await runFile('seed', join(root, 'supabase/seeds', f));
}

await runFile('integrity tests', join(root, 'supabase/tests/integrity.test.sql'));

await client.end();
await pg.stop();
console.log('\nهمهٔ تست‌های دیتابیس سبز شد (PostgreSQL توکار).');
