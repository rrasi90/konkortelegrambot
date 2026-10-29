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
import { readFileSync, existsSync } from 'node:fs';

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

  // 1. ثبت بستهٔ آزمون در exam_packs
  const packId = pack.meta?.name ?? 'unknown-pack';
  lines.push(
    `INSERT INTO exam_packs (id, name, version, track, syllabus_version, is_active, status, rights_status) ` +
    `VALUES (${sqlStr(packId)}, ${sqlStr(pack.meta?.name)}, ${sqlStr(pack.meta?.version ?? '1.0.0')}, 'common', '1.0.0', true, 'published', 'authorized') ` +
    `ON CONFLICT (id) DO UPDATE SET is_active = true, status = 'published';`
  );
  lines.push('');

  // 2. گره‌های دانش
  for (const n of pack.nodes ?? []) {
    lines.push(
      `INSERT INTO knowledge_nodes (id, track, course, chapter, topic) VALUES (${sqlStr(n.id)}, ${sqlStr(n.track)}, ${sqlStr(n.course)}, ${sqlStr(n.chapter)}, ${sqlStr(n.topic)}) ON CONFLICT (id) DO NOTHING;`,
    );
  }
  lines.push('');

  // 3. وابستگی‌ها
  for (const d of pack.dependencies ?? []) {
    lines.push(
      `INSERT INTO node_dependencies (source_node_id, target_node_id, relation, impact_weight) VALUES (${sqlStr(d.source)}, ${sqlStr(d.target)}, ${sqlStr(d.relation)}, ${d.weight}) ON CONFLICT (source_node_id, target_node_id) DO NOTHING;`,
    );
  }
  lines.push('');

  // 4. جدول مهارت‌ها (در صورت وجود skills.json)
  if (existsSync('content/knowledge/skills.json')) {
    const skills = JSON.parse(readFileSync('content/knowledge/skills.json', 'utf8'));
    for (const s of skills) {
      lines.push(
        `INSERT INTO skills (id, title, course, chapter, topic, track, difficulty_estimate) ` +
        `VALUES (${sqlStr(s.id)}, ${sqlStr(s.title)}, 'مدیریت', NULL, ${sqlStr(s.node_id)}, 'common', ${s.difficulty_estimate ?? 50}) ` +
        `ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;`
      );
    }
    lines.push('');
  }

  // 5. سؤال‌ها
  const status = pack.meta?.synthetic ? 'demo' : 'verified';
  for (const q of pack.questions ?? []) {
    lines.push(
      `INSERT INTO questions (id, node_id, exam_year, question_text, options, correct_option, explanation, trap_note, verification_status, exam_pack_id) ` +
      `VALUES (${sqlStr(q.id)}, ${sqlStr(q.nodeId)}, ${q.examYear ?? 'NULL'}, ${sqlStr(q.text)}, '${JSON.stringify(q.options).replace(/'/g, "''")}'::jsonb, ${q.correctOption}, ${sqlStr(q.explanation)}, ${sqlStr(q.trapNote)}, ${sqlStr(status)}, ${sqlStr(packId)}) ` +
      `ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, options = EXCLUDED.options, correct_option = EXCLUDED.correct_option;`,
    );

    // نگاشت بسته به سؤال در exam_pack_questions به همراه تفکیک Holdout
    const isHoldout = q.examYear === 1404;
    const holdoutStatus = isHoldout ? 'active' : 'inactive';
    const usageType = isHoldout ? 'holdout' : 'practice';
    lines.push(
      `INSERT INTO exam_pack_questions (exam_pack_id, question_id, is_holdout, holdout_status, usage_type) ` +
      `VALUES (${sqlStr(packId)}, ${sqlStr(q.id)}, ${isHoldout}, ${sqlStr(holdoutStatus)}, ${sqlStr(usageType)}) ` +
      `ON CONFLICT (exam_pack_id, question_id) DO UPDATE SET is_holdout = EXCLUDED.is_holdout, holdout_status = EXCLUDED.holdout_status;`
    );
  }
  lines.push('');

  // 6. نگاشت سؤال به مهارت (در صورت وجود question-skill-mappings.jsonl)
  if (existsSync('content/knowledge/question-skill-mappings.jsonl')) {
    const qIds = new Set((pack.questions ?? []).map((q) => q.id));
    const linesMapping = readFileSync('content/knowledge/question-skill-mappings.jsonl', 'utf8')
      .trim()
      .split('\n');
    for (const l of linesMapping) {
      if (!l.trim()) continue;
      const m = JSON.parse(l);
      if (qIds.has(m.question_id)) {
        lines.push(
          `INSERT INTO question_skill_mappings (question_id, skill_id, is_primary, bloom_level) ` +
          `VALUES (${sqlStr(m.question_id)}, ${sqlStr(m.primary_skill_id)}, true, ${m.bloom_level ?? 3}) ` +
          `ON CONFLICT (question_id, skill_id) DO NOTHING;`
        );
        for (const sec of m.secondary_skill_ids ?? []) {
          lines.push(
            `INSERT INTO question_skill_mappings (question_id, skill_id, is_primary, bloom_level) ` +
            `VALUES (${sqlStr(m.question_id)}, ${sqlStr(sec)}, false, ${m.bloom_level ?? 3}) ` +
            `ON CONFLICT (question_id, skill_id) DO NOTHING;`
          );
        }
      }
    }
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
    verification_status: pack.meta?.synthetic ? 'demo' : 'verified',
    exam_pack_id: pack.meta?.name ?? null,
  })),
);

console.log(`بستهٔ «${pack.meta?.name}» با موفقیت در پایگاه داده درون‌ریزی شد.`);
