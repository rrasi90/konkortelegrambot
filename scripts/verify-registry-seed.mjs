/**
 * AEL-107 — اثبات اجرای واقعی Import رجیستری روی DB آزمایشی (Gate P1).
 * اجرا: node scripts/verify-registry-seed.mjs
 * DB: pglite درون‌پردازشی (Disposable) — هیچ DB واقعی لمس نمی‌شود.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const seedSqlPath = join(process.cwd(), 'content', 'registry', 'generated', 'seed-registry.sql');

const db = new PGlite({ extensions: { pgcrypto } });
for (const file of readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
}

async function count(table) {
  const result = await db.query(`select count(*)::int as n from ${table}`);
  return result.rows[0].n;
}

// اجرای اول — Seed کامل
await db.exec(readFileSync(seedSqlPath, 'utf8'));
const firstRun = {
  institutions: await count('institutions'),
  programs: await count('programs'),
  courseDefinitions: await count('course_definitions'),
  syllabusNodes: await count('syllabus_nodes'),
  examEventVersions: await count('exam_event_versions'),
  combinations: await count('exam_combinations'),
  assignments: await count('exam_field_subject_assignments'),
};

// اجرای دوم — Idempotency: همان Seed دوباره، رکورد تکراری نسازد
await db.exec(readFileSync(seedSqlPath, 'utf8'));
const secondRun = {
  institutions: await count('institutions'),
  courseDefinitions: await count('course_definitions'),
  syllabusNodes: await count('syllabus_nodes'),
  examEventVersions: await count('exam_event_versions'),
};

// Gate P1-5: نسخهٔ قدیمی مقررات دست‌نخورده مانده باشد
const v1 = (await db.query(
  `select status, change_reason from exam_event_versions where id = 'eev-mgm-m-1404-v1'`,
)).rows[0];
const coefficientCheck = (await db.query(
  `select a.subject_code, a.coefficient from exam_field_subject_assignments a
     join exam_combinations c on c.id = a.combination_id
    where c.code in ('6168','6169') order by c.code, a.subject_code`,
)).rows;

const fail = [];
// مقایسهٔ Idempotency فقط روی کلیدهای مشترک دو اجرا
const sharedKeys = Object.keys(firstRun).filter(key => key in secondRun);
const idempotent = sharedKeys.every(key => firstRun[key] === secondRun[key]);
if (!idempotent) fail.push(`IDEMPOTENCY_FAIL: ${JSON.stringify({ firstRun, secondRun })}`);
if (v1?.status !== 'superseded' || !v1?.change_reason) fail.push('VERSION_V1_LOST: نسخهٔ ۱ مقررات حفظ نشده است.');
if (coefficientCheck.length !== 4) fail.push(`COEFFICIENTS_FAIL: ${JSON.stringify(coefficientCheck)}`);

console.log(JSON.stringify({ firstRun, secondRun, v1, coefficientCheck, result: fail.length ? 'FAIL' : 'GATE_P1_PASS' }, null, 2));
if (fail.length) {
  for (const line of fail) console.error(line);
  process.exit(1);
}
