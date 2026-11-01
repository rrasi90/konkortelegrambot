#!/usr/bin/env node
// Derives docs/phase-1/CURRICULUM_MASTER.csv from the row-level coverage matrix.
import { readFile, writeFile } from 'node:fs/promises';

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(value); value = ''; }
    else if (ch === '\n') { row.push(value); rows.push(row); row = []; value = ''; }
    else if (ch !== '\r') value += ch;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows;
}

const text = await readFile('docs/phase-1/CURRICULUM_COVERAGE_MATRIX.csv', 'utf8');
const rows = parseCsv(text);
const header = rows[0];
const col = (name) => header.indexOf(name);

const byCourse = new Map();
for (const r of rows.slice(1)) {
  if (!r.some((x) => x)) continue;
  const id = r[col('course_id')];
  if (!byCourse.has(id)) {
    byCourse.set(id, {
      title: r[col('course_title_fa')],
      bundles: new Set(),
      combos: new Set(),
      topics: 0,
      statuses: new Set(),
    });
  }
  const c = byCourse.get(id);
  c.bundles.add(r[col('official_bundle_number_1405')]);
  for (const x of String(r[col('combination_codes_1405')]).split(';')) if (x) c.combos.add(x);
  c.topics += 1;
  c.statuses.add(r[col('curriculum_status')]);
}

const quote = (v) => `"${String(v).replaceAll('"', '""')}"`;
const out = [
  ['course_id', 'course_title_fa', 'official_bundle_numbers_1405', 'combination_codes_1405',
    'topic_count', 'curriculum_status', 'verification_status', 'source_id', 'notes']
    .map(quote).join(','),
];
for (const [id, c] of byCourse) {
  out.push([
    id, c.title,
    [...c.bundles].sort().join(';'),
    [...c.combos].sort().join(';'),
    String(c.topics),
    [...c.statuses].join(';'),
    'pending_sme_review',
    'src-sanjesh-phd-1405-handbook',
    'derived from CURRICULUM_COVERAGE_MATRIX.csv 2026-11-01; per-combination subject counts need the official row-level table',
  ].map(quote).join(','));
}
await writeFile('docs/phase-1/CURRICULUM_MASTER.csv', out.join('\n') + '\n');
console.log(`CURRICULUM_MASTER.csv written: ${byCourse.size} courses`);
