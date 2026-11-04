#!/usr/bin/env node
/** Fresh apply, ledger replay, content drift, and backup/restore in an isolated in-memory PostgreSQL. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migrations = await readSql('migrations');
const seeds = await readSql('seeds');
const seedTables = ['knowledge_nodes', 'questions', 'skills', 'exam_packs', 'node_dependencies', 'exam_pack_questions'];
const hash = (content) => createHash('sha256').update(content).digest('hex');

async function readSql(directory) {
  const base = new URL(`../supabase/${directory}/`, import.meta.url);
  const files = (await readdir(base)).filter((name) => name.endsWith('.sql')).sort();
  return Promise.all(files.map(async (name) => ({
    name,
    text: await readFile(new URL(name, base), 'utf8'),
  })));
}

async function applyMigrations(db, files) {
  await db.exec(`
    create schema if not exists ael_test_meta;
    create table if not exists ael_test_meta.migrations (
      name text primary key,
      checksum text not null
    );
  `);
  let applied = 0;
  for (const file of files) {
    const checksum = hash(file.text);
    const changed = await db.transaction(async (tx) => {
      await tx.exec('lock table ael_test_meta.migrations in share row exclusive mode');
      const { rows: [record] } = await tx.query(
        'select checksum from ael_test_meta.migrations where name = $1', [file.name],
      );
      if (record) {
        assert.equal(record.checksum, checksum, `Applied migration changed: ${file.name}`);
        return false;
      }
      await tx.exec(file.text);
      await tx.query('insert into ael_test_meta.migrations values ($1, $2)', [file.name, checksum]);
      return true;
    });
    if (changed) applied += 1;
  }
  return applied;
}

async function snapshot(db) {
  const { rows: policies } = await db.query(`
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname = 'public' order by 1, 2, 3
  `);
  const { rows: rls } = await db.query(`
    select relname, relrowsecurity, relforcerowsecurity
    from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')
    order by relname
  `);
  const { rows: ledger } = await db.query('select * from ael_test_meta.migrations order by name');
  const content = {};
  for (const table of seedTables) {
    const { rows } = await db.query(
      `select to_jsonb(t)::text as value from public.${table} t order by to_jsonb(t)::text collate "C"`,
    );
    content[table] = { count: rows.length, hash: hash(JSON.stringify(rows)) };
  }
  return { policies, rls, ledger, content };
}

function withoutPsqlCommands(text) {
  // SQL fixtures use psql's \set to stop on errors. exec already rejects errors.
  return text.replace(/^\\set ON_ERROR_STOP on\s*$/gm, '');
}

const db = new PGlite({ extensions: { pgcrypto } });
let restored;
try {
  const { rows: [version] } = await db.query('select version()');
  console.log(version.version);
  assert.equal(await applyMigrations(db, migrations), migrations.length);
  for (const seed of seeds) await db.exec(seed.text);
  console.log(`FRESH_PASS migrations=${migrations.length} seeds=${seeds.length}`);

  const before = await snapshot(db);
  assert.equal(await applyMigrations(db, migrations), 0);
  for (const seed of seeds) await db.exec(seed.text);
  assert.deepEqual(await snapshot(db), before, 'Migration or seed replay changed the database');
  console.log(`LEDGER_REPLAY_PASS skipped=${migrations.length} policy_count=${before.policies.length} hashed_tables=${seedTables.length}`);

  await assert.rejects(
    applyMigrations(db, [{ ...migrations[0], text: migrations[0].text + '\n-- altered checksum\n' }]),
    /Applied migration changed/,
  );
  await assert.rejects(
    applyMigrations(db, [{ name: 'fixture_atomicity.sql', text: 'create table ael_atomicity_fixture(id int); select 1 / 0;' }]),
    /division by zero/,
  );
  const { rows: [atomicity] } = await db.query(`
    select to_regclass('public.ael_atomicity_fixture') is null
      and not exists (select 1 from ael_test_meta.migrations where name = 'fixture_atomicity.sql') as clean
  `);
  assert.equal(atomicity.clean, true);
  console.log('LEDGER_CHECKSUM_AND_ATOMICITY_CONTROLS_PASS');

  await db.exec('begin');
  try {
    await db.exec(`
      alter policy read_nodes on public.knowledge_nodes using (false);
      update public.questions set question_text = 'A19 test drift' where id = 'demo-q-001';
    `);
    const drift = await snapshot(db);
    assert.notDeepEqual(drift.policies, before.policies);
    assert.equal(drift.content.questions.count, before.content.questions.count);
    assert.notEqual(drift.content.questions.hash, before.content.questions.hash);
  } finally {
    await db.exec('rollback');
  }
  assert.deepEqual(await snapshot(db), before);
  console.log('POLICY_AND_SAME_COUNT_CONTENT_DRIFT_CONTROLS_PASS');

  for (const file of await readSql('tests')) {
    if (!file.name.endsWith('.test.sql')) continue;
    await db.exec(withoutPsqlCommands(file.text));
    console.log('INTEGRITY_PASS', file.name);
  }

  const backupState = await snapshot(db);
  restored = new PGlite({ extensions: { pgcrypto }, loadDataDir: await db.dumpDataDir() });
  assert.deepEqual(await snapshot(restored), backupState);
  assert.equal(await applyMigrations(restored, migrations), 0);
  console.log('BACKUP_RESTORE_PASS matching_rows_policies_and_ledger');
} finally {
  if (restored) await restored.close();
  await db.close();
}
