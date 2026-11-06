/**
 * AEL — Cross-year question matching / dedup candidates (Phase 8).
 * Works on the local structural run (`.ael-work/exam-analysis/runs/<run-id>/`).
 *
 * Rules (mission §3.2/§8 — never auto-merge):
 *  - exact_repeat: identical normalized stem + identical normalized option set
 *  - near_duplicate: trigram similarity >= 0.92 on stems with same section
 *  - same_concept: same section + option overlap but stem similarity < 0.92 → NOT emitted
 *    (only exact/near candidates are listed; concept-level is SME work)
 *
 * Committed artifact is metadata-only: appearance IDs, document IDs, years,
 * hashes, similarity — NO question text (rights gate H-CONK / SRC-02).
 * Full details stay in .ael-work (local-only).
 *
 * Usage: node scripts/ael-question-dedup.mjs [--run-id structural-20261106f]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const runIdIdx = process.argv.indexOf('--run-id');
const runId = runIdIdx > -1 ? process.argv[runIdIdx + 1] : 'structural-20261106f';
const runDir = join(root, '.ael-work', 'exam-analysis', 'runs', runId);
const outDir = join(root, '.ael-work', 'question-matching', runId);
mkdirSync(outDir, { recursive: true });

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const foldDigits = (s) =>
  String(s ?? '').replace(/[۰-۹٠-٩]/g, (d) => String(FA_DIGITS.indexOf(d) >= 0 ? FA_DIGITS.indexOf(d) : AR_DIGITS.indexOf(d)));

const normalizeText = (s) =>
  foldDigits(String(s ?? ''))
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[\u064a]/g, '\u06cc').replace(/[\u0643]/g, '\u06a9')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, '')
    .toLowerCase();

export function stemHash(stem, options) {
  const stemN = normalizeText(stem);
  const optsN = (options || []).map((o) => normalizeText(o.text)).sort().join(' | ');
  return createHash('sha256').update(stemN + '\n--\n' + optsN).digest('hex').slice(0, 16);
}

function trigrams(s) {
  const t = normalizeText(s).replace(/\s+/g, '');
  const out = new Set();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

export function stemSimilarity(a, b) {
  const ga = trigrams(a);
  const gb = trigrams(b);
  if (!ga.size || !gb.size) return 0;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter += 1;
  return inter / Math.min(ga.size, gb.size);
}

// ---------- load appearances ----------
const appearances = [];
for (const f of readdirSync(runDir).filter((n) => n.startsWith('questions-'))) {
  const rows = readFileSync(join(runDir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  appearances.push(...rows);
}
const okRows = appearances.filter((r) => r.extraction_status === 'ok' && (r.question_text_raw || '').length >= 12);

// ---------- exact repeats ----------
const byHash = new Map();
for (const r of okRows) {
  const h = stemHash(r.question_text_raw, r.options_raw);
  if (!byHash.has(h)) byHash.set(h, []);
  byHash.get(h).push(r);
}
const exactGroups = [...byHash.entries()].filter(([, rows]) => rows.length > 1);

// ---------- near duplicates (same section, similarity >= 0.92) ----------
const nearPairs = [];
const bySection = new Map();
for (const r of okRows) {
  const sec = r.topic_candidates?.[0]?.section_id ?? null;
  if (!sec) continue;
  if (!bySection.has(sec)) bySection.set(sec, []);
  bySection.get(sec).push(r);
}
for (const [sec, rows] of bySection) {
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.source_id === b.source_id && a.question_number === b.question_number) continue;
      const h1 = stemHash(a.question_text_raw, a.options_raw);
      const h2 = stemHash(b.question_text_raw, b.options_raw);
      if (h1 === h2) continue; // already in exact groups
      const sim = stemSimilarity(a.question_text_raw, b.question_text_raw);
      if (sim >= 0.92) nearPairs.push({ sec, a, b, sim: Number(sim.toFixed(3)) });
    }
  }
}

// ---------- outputs ----------
const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csvRows = [['group_kind', 'group_id', 'appearance_id', 'document_id', 'source_id', 'exam_year', 'question_number', 'content_hash', 'similarity', 'section_id', 'review_required']];
let gid = 0;
for (const [h, rows] of exactGroups) {
  gid += 1;
  const group = `ex-${String(gid).padStart(4, '0')}`;
  for (const r of rows) {
    csvRows.push([csvEscape('exact_repeat'), csvEscape(group), csvEscape(r.question_appearance_id), csvEscape(r.document_id), csvEscape(r.source_id), csvEscape(r.exam_year), csvEscape(r.question_number), csvEscape(h), csvEscape('1.0'), csvEscape(r.topic_candidates?.[0]?.section_id ?? ''), csvEscape('sme_required')]);
  }
}
const pairGroups = new Map();
for (const p of nearPairs) {
  const key = [p.a.question_appearance_id, p.b.question_appearance_id].sort().join('~');
  pairGroups.set(key, p);
}
gid = 0;
for (const [, p] of [...pairGroups.entries()].sort()) {
  gid += 1;
  const group = `nd-${String(gid).padStart(4, '0')}`;
  for (const r of [p.a, p.b]) {
    csvRows.push([csvEscape('near_duplicate'), csvEscape(group), csvEscape(r.question_appearance_id), csvEscape(r.document_id), csvEscape(r.source_id), csvEscape(r.exam_year), csvEscape(r.question_number), csvEscape(''), csvEscape(p.sim), csvEscape(p.sec), csvEscape('sme_required')]);
  }
}
writeFileSync(join(outDir, 'CROSS_YEAR_QUESTION_MATCHES.csv'), csvRows.map((r) => r.join(',')).join('\n') + '\n');

const summary = {
  run_id: runId,
  appearances_total: appearances.length,
  appearances_compared: okRows.length,
  exact_repeat_groups: exactGroups.length,
  exact_repeat_appearances: exactGroups.reduce((s, [, rows]) => s + rows.length, 0),
  near_duplicate_pairs: pairGroups.size,
  note: 'Metadata only; no question text committed. Classifications are candidates for SME review — never merged automatically.',
};
writeFileSync(join(outDir, 'dedup-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
