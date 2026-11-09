#!/usr/bin/env node
/**
 * V2-060 — Objective lint: check learning objectives (topics.objective) and
 * skill operational_definitions for vague AI tells and empty text.
 * Scans: content/learning-courses/*.json (topics[].objective),
 *        content/knowledge/skills.json (operational_definition)
 * Exit: 0 always (report only); non-zero only on IO failure.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const issues = [];

// vague phrases (banned AI tells in Persian)
const vague = ['در دنیای امروز', 'نقش بسزایی', 'از اهمیت', 'لازم به ذکر', 'در راستای', 'نشان‌دهنده این است', 'کارشناسان معتقدند'];

function checkText(text, where) {
  if (!text || !text.trim()) { issues.push({ where, kind: 'empty', excerpt: '' }); return; }
  for (const v of vague) if (text.includes(v)) issues.push({ where, kind: 'vague:' + v, excerpt: text.slice(0, 80) });
  if (text.length < 15) issues.push({ where, kind: 'too-short', excerpt: text });
}

const files = readdirSync(resolve(root, 'content/learning-courses')).filter(f => f.endsWith('.json'));
for (const f of files) {
  const pack = JSON.parse(readFileSync(resolve(root, 'content/learning-courses/' + f), 'utf8'));
  for (const t of pack.topics ?? []) checkText(t.objective, `${f}:${t.id}.objective`);
}
const skills = JSON.parse(readFileSync(resolve(root, 'content/knowledge/skills.json'), 'utf8'));
for (const s of skills) checkText(s.operational_definition, `skills.json:${s.id}`);

console.log(`objective-lint: ${issues.length} issues`);
for (const i of issues.slice(0, 50)) console.log(`  ${i.kind} @ ${i.where}: ${i.excerpt}`);
if (!issues.length) console.log('clean');
