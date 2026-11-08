#!/usr/bin/env node
/**
 * V2-012 — ID map: collect stable IDs from content registries (read-only).
 * Scans: content/knowledge/courses.json, syllabus-nodes.json, skills.json,
 *        content/learning-courses/*.json, apps/worker/src/learning-catalog.ts
 * Output: docs/ael-implementation/v2/reports/id-map.csv
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }
function slugify(s) { return String(s).replace(/[",\n\r]/g, ' ').trim(); }

const rows = [];
function add(id, kind, file, title = '') {
  rows.push({ id, kind, file, title });
}

try {
  const courses = readJson(new URL('../../content/knowledge/courses.json', import.meta.url));
  for (const c of courses) add(c.course_id, 'course', 'content/knowledge/courses.json', c.name ?? '');
} catch (e) { console.warn('courses.json:', e.message); }

try {
  const nodes = readJson(new URL('../../content/knowledge/syllabus-nodes.json', import.meta.url));
  for (const n of nodes) add(n.id, 'syllabus-node', 'content/knowledge/syllabus-nodes.json', `${n.course ?? ''} / ${n.topic ?? ''}`);
} catch (e) { console.warn('syllabus-nodes.json:', e.message); }

try {
  const skills = readJson(new URL('../../content/knowledge/skills.json', import.meta.url));
  for (const s of skills) add(s.id, 'skill', 'content/knowledge/skills.json', s.title ?? '');
  for (const s of skills) if (s.node_id) { /* node refs collected below as cross-check */ }
} catch (e) { console.warn('skills.json:', e.message); }

// learning packs
try {
  const fs = await import('node:fs/promises');
  const readdir = fs.readdir;
  const dirUrl = new URL('../../content/learning-courses/', import.meta.url);
  const files = (await readdir(dirUrl)).filter(f => f.endsWith('.json')).sort();
  for (const f of files) {
    const pack = readJson(new URL('../../content/learning-courses/' + f, import.meta.url));
    add(pack.id, 'learning-course', 'content/learning-courses/' + f, pack.title ?? '');
    for (const t of pack.topics ?? []) add(t.id, 'learning-topic', 'content/learning-courses/' + f, t.title ?? '');
    for (const q of pack.questions ?? []) add(q.id, 'learning-question', 'content/learning-courses/' + f, (q.prompt ?? '').slice(0, 80));
    for (const s of pack.sources ?? []) add(s.id, 'learning-source', 'content/learning-courses/' + f, s.title ?? '');
  }
} catch (e) { console.warn('learning-courses:', e.message); }

// relations edges
try {
  const text = readFileSync(new URL('../../content/knowledge/relations.jsonl', import.meta.url), 'utf8');
  for (const line of text.split('\n').filter(l => l.trim())) {
    const r = JSON.parse(line);
    if (r.source) add(`edge:${r.source}->${r.target}`, 'relation-edge', 'content/knowledge/relations.jsonl', `${r.relation ?? ''} w=${r.weight ?? ''}`);
  }
} catch (e) { console.warn('relations.jsonl:', e.message); }

// question-skill mappings
try {
  const text = readFileSync(new URL('../../content/knowledge/question-skill-mappings.jsonl', import.meta.url), 'utf8');
  for (const line of text.split('\n').filter(l => l.trim())) {
    const r = JSON.parse(line);
    const qid = r.question_id ?? r.questionId ?? '(unknown)';
    const sid = r.skill_id ?? r.skillId ?? '(unknown)';
    add(`map:${qid}->${sid}`, 'question-skill-map', 'content/knowledge/question-skill-mappings.jsonl', '');
  }
} catch (e) { console.warn('question-skill-mappings:', e.message); }

// dedupe check
const seen = new Map();
for (const r of rows) {
  const key = r.kind + '|' + r.id;
  if (!seen.has(key)) seen.set(key, r);
}
const uniq = [...seen.values()].sort((a, b) => (a.kind + a.id).localeCompare(b.kind + b.id));

// write CSV
mkdirSync(new URL('../../docs/ael-implementation/v2/reports/', import.meta.url), { recursive: true });
const header = 'id,kind,file,title\n';
const body = uniq.map(r => `"${slugify(r.id)}","${slugify(r.kind)}","${slugify(r.file)}","${slugify(r.title)}"`).join('\n');
const out = header + body + '\n';
writeFileSync(new URL('../../docs/ael-implementation/v2/reports/id-map.csv', import.meta.url), out);

// duplicate report (same id in different kinds/files)
const byId = new Map();
for (const r of uniq) {
  const list = byId.get(r.id) ?? [];
  list.push(r);
  byId.set(r.id, list);
}
const dups = [...byId.entries()].filter(([, l]) => l.length > 1);
console.log(`id-map: ${uniq.length} unique rows, ${dups.length} cross-kind/file duplicates`);
for (const [id, list] of dups) console.log(`  DUP ${id}: ${list.map(r => r.kind + '@' + r.file).join(' | ')}`);
console.log('wrote docs/ael-implementation/v2/reports/id-map.csv');
