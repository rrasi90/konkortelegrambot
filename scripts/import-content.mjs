#!/usr/bin/env node
/**
 * درون‌ریزی بستهٔ محتوا به دیتابیس.
 *
 * حالت‌ها:
 *  - node scripts/import-content.mjs <pack.json> --sql
 *      خروجی SQL قابل اجرا روی PostgreSQL/Supabase (stdout)
 *  - node scripts/import-content.mjs <pack.json>
 *      درون‌ریزی مستقیم از طریق REST Supabase (نیازمند SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY)
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const path = args[0];
const modeSql = args.includes('--sql');
if (!path) {
  console.error('کاربرد: import-content.mjs <pack.json> [--sql]');
  process.exit(2);
}

const pack = JSON.parse(readFileSync(path, 'utf8'));

function sqlStr(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function generateSql() {
  const lines = [];
  lines.push(`-- تولیدشده توسط scripts/import-content.mjs از ${path}`);
  lines.push(`-- بستهٔ: ${pack.meta?.name} نسخه ${pack.meta?.version}${pack.meta?.synthetic ? ' (نمایشی/ساختگی)' : ''}`);
  lines.push('BEGIN;');
  lines.push('');
  for (const n of pack.nodes ?? []) {
    lines.push(
      `INSERT INTO knowledge_nodes (id, track, course, chapter, topic) VALUES (${sqlStr(n.id)}, ${sqlStr(n.track)}, ${sqlStr(n.course)}, ${sqlStr(n.chapter)}, ${sqlStr(n.topic)}) ON CONFLICT (id) DO NOTHING;`,
    );
  }
  lines.push('');
  for (const d of pack.dependencies ?? []) {
    lines.push(
      `INSERT INTO node_dependencies (source_node_id, target_node_id, relation, impact_weight) VALUES (${sqlStr(d.source)}, ${sqlStr(d.target)}, ${sqlStr(d.relation)}, ${d.weight}) ON CONFLICT (source_node_id, target_node_id) DO NOTHING;`,
    );
  }
  lines.push('');
  const status = pack.meta?.synthetic ? 'demo' : 'unverified';
  for (const q of pack.questions ?? []) {
    lines.push(
      `INSERT INTO questions (id, node_id, exam_year, question_text, options, correct_option, explanation, trap_note, verification_status) VALUES (${sqlStr(q.id)}, ${sqlStr(q.nodeId)}, ${q.examYear ?? 'NULL'}, ${sqlStr(q.text)}, '${JSON.stringify(q.options).replace(/'/g, "''")}'::jsonb, ${q.correctOption}, ${sqlStr(q.explanation)}, ${sqlStr(q.trapNote)}, ${sqlStr(status)}) ON CONFLICT (id) DO NOTHING;`,
    );
  }
  lines.push('');
  lines.push('COMMIT;');
  return lines.join('\n') + '\n';
}

if (modeSql) {
  process.stdout.write(generateSql());
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('برای درون‌ریزی مستقیم، SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY لازم است. از حالت --sql استفاده کنید.');
  process.exit(2);
}

async function upsert(table, rows) {
  if (rows.length === 0) return;
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`${table}: ${res.status} ${await res.text()}`);
  }
}

const q = (s) => String(s ?? '');

await upsert(
  'knowledge_nodes',
  (pack.nodes ?? []).map((n) => ({ id: n.id, track: n.track, course: q(n.course), chapter: q(n.chapter), topic: q(n.topic) })),
);
await upsert(
  'node_dependencies',
  (pack.dependencies ?? []).map((d) => ({ source_node_id: d.source, target_node_id: d.target, relation: d.relation, impact_weight: d.weight })),
);
await upsert(
  'questions',
  (pack.questions ?? []).map((x) => ({
    id: x.id,
    node_id: x.nodeId,
    exam_year: x.examYear ?? null,
    question_text: x.text,
    options: x.options,
    correct_option: x.correctOption,
    explanation: x.explanation ?? null,
    trap_note: x.trapNote ?? null,
    verification_status: pack.meta?.synthetic ? 'demo' : 'unverified',
  })),
);
console.log('درون‌ریزی کامل شد.');
