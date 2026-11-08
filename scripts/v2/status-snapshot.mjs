#!/usr/bin/env node
/**
 * V2-013 — Status snapshot: measured repo state (read-only).
 * Produces docs/ael-implementation/v2/reports/STATUS_AUTO.md
 * Counts are computed, never hardcoded.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
function countFiles(dir, ext) {
  try {
    const entries = readdirSync(dir, { recursive: true });
    return entries.filter(f => String(f).endsWith(ext)).length;
  } catch { return 0; }
}
function git(cmd) { try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return '(unavailable)'; } }

const coursesJson = readJson(new URL('../../content/knowledge/courses.json', import.meta.url)) ?? [];
const nodesJson = readJson(new URL('../../content/knowledge/syllabus-nodes.json', import.meta.url)) ?? [];
const skillsJson = readJson(new URL('../../content/knowledge/skills.json', import.meta.url)) ?? [];

let relations = 0;
try { relations = readFileSync(new URL('../../content/knowledge/relations.jsonl', import.meta.url), 'utf8').split('\n').filter(l => l.trim()).length; } catch {}

let mappings = 0;
try { mappings = readFileSync(new URL('../../content/knowledge/question-skill-mappings.jsonl', import.meta.url), 'utf8').split('\n').filter(l => l.trim()).length; } catch {}

let packSummary = [];
try {
  const files = readdirSync(new URL('../../content/learning-courses/', import.meta.url)).filter(f => f.endsWith('.json')).sort();
  for (const f of files) {
    const pack = readJson(new URL('../../content/learning-courses/' + f, import.meta.url));
    packSummary.push({
      file: f,
      id: pack.id, version: pack.version, status: pack.status,
      topics: pack.topics?.length ?? 0,
      questions: pack.questions?.length ?? 0,
      sources: pack.sources?.length ?? 0,
      reviewed: pack.questions?.filter(q => q.review === 'reviewed').length ?? 0,
      pending: pack.questions?.filter(q => q.review === 'pending_sme').length ?? 0,
      origins: [...new Set((pack.questions ?? []).map(q => q.origin))].join(','),
      rights: [...new Set((pack.questions ?? []).map(q => q.rights))].join(','),
    });
  }
} catch {}

const migrations = (() => {
  try {
    return readdirSync(new URL('../../supabase/migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort();
  } catch { return []; }
})();

const testFiles = countFiles(new URL('../../packages/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '.test.ts');

const lines = [];
lines.push('# وضعیت خودکار مخزن (STATUS_AUTO)');
lines.push('');
lines.push(`- تاریخ اندازه‌گیری: ${new Date().toISOString()}`);
lines.push(`- شاخه: ${git('git branch --show-current')}`);
lines.push(`- HEAD: ${git('git rev-parse --short HEAD')}`);
lines.push('');
lines.push('## محتوای پایه مدیریت (content/knowledge)');
lines.push('');
lines.push(`- courses: ${coursesJson.length}`);
lines.push(`- syllabus-nodes: ${nodesJson.length}`);
lines.push(`- skills: ${skillsJson.length}`);
lines.push(`- relations (edges): ${relations}`);
lines.push(`- question-skill mappings: ${mappings}`);
lines.push('');
lines.push('## بسته‌های یادگیری تألیفی (content/learning-courses)');
lines.push('');
lines.push('| فایل | id | version | status | topics | questions | reviewed | pending_sme | sources |');
lines.push('|---|---|---|---|---|---|---|---|---|');
for (const p of packSummary) {
  lines.push(`| ${p.file} | ${p.id} | ${p.version} | ${p.status} | ${p.topics} | ${p.questions} | ${p.reviewed} | ${p.pending} | ${p.sources} |`);
}
lines.push('');
lines.push('## دیتابیس');
lines.push('');
lines.push(`- migrations: ${migrations.length} (last: ${migrations[migrations.length - 1] ?? '—'})`);
lines.push('');
lines.push('## تست‌ها');
lines.push('');
lines.push(`- فایل‌های .test.ts زیر packages/: ${testFiles} (شمارش فایل؛ مجموع تست‌ها از vs-final می‌آید)`);
lines.push('');
lines.push('> این فایل با scripts/v2/status-snapshot.mjs تولید شده و هر شمارنده از خواندن همین فایل‌ها آمده است؛ عدد که بدون شاهد خوانده شود، درج نمی‌شود.');

mkdirSync(new URL('../../docs/ael-implementation/v2/reports/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../docs/ael-implementation/v2/reports/STATUS_AUTO.md', import.meta.url), lines.join('\n') + '\n');
console.log('wrote docs/ael-implementation/v2/reports/STATUS_AUTO.md');
