/**
 * AEL — Exam MD Analysis Pipeline (structural, offline, local-only).
 * Reads pdf/*.md + pdf/_CONVERSION_REPORT.json, classifies with evidence,
 * extracts exam context (year/level/booklet/set), questions, keys, pairing,
 * taxonomy candidates, quarantine. Writes local staging under
 * .ael-work/exam-analysis/runs/<run-id>/ — NOT committed.
 * Usage: node scripts/ael-exam-analyze.mjs [--run-id <id>]
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { FA_DIGITS, toEnDigits as toEn, parseInlineOptions, cellText } from './ael-exam-utils.mjs';

const root = process.cwd();
const runIdIdx = process.argv.indexOf('--run-id');
const runId = runIdIdx > -1 ? process.argv[runIdIdx + 1] : new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const outDir = join(root, '.ael-work', 'exam-analysis', 'runs', runId);
mkdirSync(outDir, { recursive: true });

const FA = FA_DIGITS;
const norm = (s) => toEn(s).replace(/[\u200e\u200f\u202a-\u202e]/g, '');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function parseFrontmatter(text) {
  const parts = text.split('---');
  if (parts.length < 3) return {};
  const fm = {};
  for (const line of parts[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fm;
}

function splitPages(text) {
  const m = [...text.matchAll(/## صفحه (\d+) از (\d+)/g)];
  if (!m.length) return [{ page: 1, text }];
  return m.map((x, i) => ({
    page: Number(x[1]),
    total: Number(x[2]),
    text: text.slice(x.index, i + 1 < m.length ? m[i + 1].index : undefined),
  }));
}

function extractBooklet(enHead) {
  const m = enHead.match(/\b([0-9]{3}[A-Z])\b/);
  return m ? m[1] : null;
}

function extractSetCode(enText) {
  const m = enText.match(/کد\s*\(?1[0-9]{3}\)?/);
  return m ? m[0].replace(/[^\d]/g, '') : null;
}

function extractYear(enText) {
  const cands = [...enText.matchAll(/سال\s*(1[0-9]{3})/g)].map((x) => Number(x[1])).filter((y) => y >= 1370 && y <= 1420);
  const uniq = [...new Set(cands)];
  if (!uniq.length) return { value: null, status: 'unknown' };
  if (uniq.length === 1) return { value: uniq[0], status: 'proposed' };
  return { value: null, status: 'ambiguous', candidates: uniq };
}

function extractLevel(enText) {
  if (/دکتری/.test(enText) && !/کارشناسی ارشد/.test(enText)) return 'phd';
  if (/کارشناسی ارشد/.test(enText)) return 'msc';
  return null;
}

// ---------- Inventory + Classification ----------
const pdfFiles = readdirSync(join(root, 'pdf')).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
const conv = JSON.parse(readFileSync(join(root, 'pdf', '_CONVERSION_REPORT.json'), 'utf8'));
const convByFile = new Map(conv.map((r) => [r.file.replace(/\.pdf$/, '.md'), r]));
const sources = [];
const quarantine = [];

for (const mdFile of pdfFiles) {
  const p = join(root, 'pdf', mdFile);
  const buf = readFileSync(p);
  const text = buf.toString('utf8');
  const fm = parseFrontmatter(text);
  const pages = splitPages(text);
  const enFull = norm(text);
  const enHead = enFull.slice(0, 12000);
  const convRow = convByFile.get(mdFile) ?? {};
  // classify by frontmatter + evidence (filename only hint)
  let docType = fm.document_type || 'unknown';
  const typeEvidence = [];
  if (/کلید/.test(enHead.slice(0, 4000))) typeEvidence.push({ rule: 'title_key', quote: 'کلید' });
  if (/آزمون ورودی/.test(enHead)) typeEvidence.push({ rule: 'title_exam', quote: 'آزمون ورودی' });
  // unknown papers (4 management files) -> propose exam_paper when title says آزمون ورودی
  if (docType === 'unknown' && typeEvidence.some((e) => e.rule === 'title_exam')) {
    docType = 'exam_paper';
  }
  const levelRaw = extractLevel(enHead);
  const year = extractYear(enHead);
  // filename year hint only for proposals when text unknown
  const fileYearM = (mdFile.match(/(13\d{2}|14\d{2})/) || [])[1];
  if (!year.value && fileYearM && docType !== 'unknown') {
    year.value = Number(fileYearM);
    year.status = 'proposed_filename_only';
    year.evidence = [{ rule: 'filename_hint', value: fileYearM }];
  }
  const booklet = extractBooklet(enHead);
  const setCode = extractSetCode(enHead);
  const pageCount = Number(fm.source_page_count) || pages.length;
  const headPages = pages.map((p) => p.page);
  const missingHeads = [];
  for (let i = 1; i <= pageCount; i++) if (!headPages.includes(i)) missingHeads.push(i);
  sources.push({
    document_id: fm.document_id || null,
    source_id: fm.source_id || null,
    source_version_id: fm.source_version_id || null,
    filename: mdFile,
    sha256_pdf: fm.source_pdf_sha256?.replace(/"/g, '') || null,
    sha256_md: sha256(buf),
    pages: pageCount,
    blocks: convRow.blocks ?? null,
    pages_with_head: headPages.length,
    missing_page_heads: missingHeads,
    front_type: fm.document_type,
    document_type: { value: docType, status: docType === 'unknown' ? 'unknown' : 'proposed', evidence: typeEvidence },
    exam_level: levelRaw ? { value: levelRaw, status: 'proposed' } : { value: null, status: 'unknown' },
    exam_year: year,
    booklet_code: booklet ? { value: booklet, status: 'proposed' } : { value: null, status: 'unknown' },
    exam_set_code: setCode ? { value: setCode, status: 'proposed' } : { value: null, status: 'unknown' },
    rights_status: fm.rights_status || 'unknown',
    verification_status: fm.verification_status || 'unknown',
  });
  if (docType === 'unknown') quarantine.push({ kind: 'unknown_document', file: mdFile, document_id: fm.document_id });
  if (missingHeads.length) quarantine.push({ kind: 'missing_pages', file: mdFile, missing: missingHeads });
  if (!levelRaw || !year.value) quarantine.push({ kind: 'uncertain_metadata', file: mdFile, level: levelRaw, year: year.value });
}

// ---------- Question extraction (paper docs only) ----------
// Handles: (a) plain "1- ..." lines with inline options "1) .. 2) ..",
// (b) table rows "<tr><td>11-</td><td>1) in</td>..." , (c) Persian digits.
// Option/cell helpers live in ./ael-exam-utils.mjs (shared with tests).
function extractQuestions(source, mdText) {
  const out = [];
  const seen = new Map();
  const pages = splitPages(mdText);
  function pushQ(numRaw, num, qtext, opts, page, line, isTable) {
    if (!Number.isInteger(num) || num < 1 || num > 400) return;
    const issues = [];
    if (!qtext || qtext.length < 4) issues.push('short_stem');
    if (opts.length > 0 && opts.length < 4) issues.push('options_not_4');
    if (opts.length === 0) issues.push('no_options_found');
    const rec = {
      question_id: `q-${source.source_id}-${num}`,
      question_appearance_id: `qa-${source.source_id}-${num}-p${page}`,
      document_id: source.document_id,
      source_id: source.source_id,
      exam_year: source.exam_year?.value ?? null,
      exam_level: source.exam_level?.value ?? null,
      question_number_raw: String(numRaw),
      question_number: num,
      question_text_raw: (qtext || '').slice(0, 2000),
      options_raw: opts.slice(0, 8),
      source_locator: { pdf_page: page, markdown_page: page, line },
      extraction_status: issues.length ? 'needs_review' : 'ok',
      ocr_issues: issues,
      table_embedded: isTable,
    };
    if (seen.has(num)) {
      // duplicate appearance: keep first, record dup count on first
      seen.get(num).__duplicate__ = (seen.get(num).__duplicate__ || 0) + 1;
      return;
    }
    seen.set(num, rec);
    out.push(rec);
  }
  for (const pg of pages) {
    const lines = pg.text.split(/\r?\n/);
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      // --- table rows ---
      if (line.includes('<tr>') || line.includes('<td')) {
        for (const rm of line.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
          const cells = [...rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => cellText(c[1]));
          if (cells.length < 2) continue;
          const first = toEn(cells[0]);
          const qm = first.match(/^([0-9]{1,3})\s*-?\s*$/);
          if (!qm) continue; // continuation / header rows
          // Guard vs subject table (rows like 350 | 336 | 15 | ...): require dash on number
          // or a paren/bare option marker in following cells.
          const hasDash = /\d\s*-/.test(cells[0]) || /\d\s*-/.test(first);
          const hasOptionMarker = cells.slice(1).some((c) => /\(?\s*[1-4]\s*\)/.test(toEn(c)));
          if (!hasDash && !hasOptionMarker) continue;
          const num = Number(qm[1]);
          // collect options from remaining cells (each cell usually one option, but may hold several)
          let opts = [];
          for (const c of cells.slice(1)) {
            const oo = parseInlineOptions(c);
            if (oo.length) opts.push(...oo);
            else if (c && c.length > 1 && c.length < 200) {
              // bare option text without label (colspan style) — label by position
              opts.push({ label: String(opts.length + 1), text: c });
            }
          }
          opts = opts.slice(0, 4);
          // stem may be in a colspan cell on previous row; we record what we have
          // If stem text appears in cells[1] before options, parseInlineOptions already separates
          pushQ(qm[1], num, '', opts, pg.page, li + 1, true);
          // Try to enrich stem: if any cell contains question text beyond options, keep short
        }
        continue;
      }
      // --- plain lines ---
      if (line.includes('<')) continue;
      const lineEn = toEn(line);
      // Persian stems are often "NN <space> text" without any dash; English often "NN- text".
      const m = lineEn.match(/^\s*([0-9]{1,3})\s*[-.)]?\s+(.+)$/);
      if (!m) continue;
      if (!m[2] || m[2].trim().length < 8) continue;
      // skip headers / page furniture
      if (/^صفحه|صفه|^V\s*$|^107|^103|^116|^316|^517|^716|^818|^141|^319|^519|^719/.test(lineEn.trim())) continue;
      const num = Number(m[1]);
      if (!Number.isInteger(num) || num < 1 || num > 400) continue;
      const qtext = (m[2] || '').trim();
      // if line itself contains inline options, split them out
      let stem = qtext;
      let opts = parseInlineOptions(qtext);
      if (opts.length >= 2) {
        const idx = qtext.search(/(?:^|\s)\(?1\)\s/);
        stem = idx > 0 ? qtext.slice(0, idx).trim() : qtext;
      } else {
        opts = [];
        for (let k = li + 1; k < Math.min(lines.length, li + 6); k++) {
          const nxt = lines[k];
          if (nxt.includes('<')) break;
          const oo = parseInlineOptions(toEn(nxt));
          if (oo.length) opts.push(...oo);
          else if (nxt.trim() && nxt.trim().length < 120 && /^-?\s*$/.test(nxt.trim()) === false && nxt.trim().match(/^[a-zA-Z\(\[]/)) {
            // bare option line — only accept if we already have some options pattern
            // (skip; keeps false positives low)
          }
          if (opts.length >= 4) break;
        }
      }
      pushQ(m[1], num, stem, opts, pg.page, li + 1, false);
    }
  }
  out.sort((a, b) => a.question_number - b.question_number);
  return out;
}

function extractKey(source, mdText) {
  const entries = [];
  // tables: <td>num</td><td>ans</td>
  for (const m of mdText.matchAll(/<td[^>]*>(\d+)<\/td><td[^>]*>([1-4])<\/td>/g)) {
    entries.push({ n: Number(m[1]), a: Number(m[2]), raw: m[0] });
  }
  // plain text pairs (e.g. "190 1 220 2 ...") — only if table count low
  if (entries.length < 20) {
    const plain = mdText.replace(/<[^>]+>/g, ' ').replace(/\n+/g, ' ');
    for (const m of plain.matchAll(/(\b\d{1,3}\b)\s+([1-4])\b/g)) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 400 && !entries.some((e) => e.n === n)) entries.push({ n, a: Number(m[2]), raw: m[0].slice(0, 24) });
    }
  }
  const byNum = new Map();
  const conflicts = [];
  const blanks = [];
  for (const e of entries) {
    if (!Number.isInteger(e.n) || e.n < 1 || e.n > 400) continue;
    if (byNum.has(e.n) && byNum.get(e.n) !== e.a) conflicts.push({ n: e.n, a1: byNum.get(e.n), a2: e.a });
    else byNum.set(e.n, e.a);
  }
  return { entries: [...byNum.entries()].map(([n, a]) => ({ question_number: n, correct_option: a })), conflicts, blanks };
}

// ---------- Pairing (year + level + booklet hint) ----------
const papers = sources.filter((s) => s.document_type.value === 'exam_paper');
const keys = sources.filter((s) => s.document_type.value === 'answer_key');
const pairing = [];
for (const key of keys) {
  const ky = key.exam_year?.value;
  const candidates = papers.filter((p) => ky && p.exam_year?.value === ky);
  let status = 'unresolved';
  let paired = null;
  if (candidates.length === 1) { status = 'candidate'; paired = candidates[0].source_id; }
  else if (candidates.length > 1) status = 'needs_review';
  pairing.push({ key_source_id: key.source_id, key_file: key.filename, key_year: ky, candidates: candidates.map((c) => c.source_id), paired_document_id: paired, pairing_status: status, evidence: candidates.length === 1 ? [{ rule: 'year_match', year: ky }] : [] });
}

// ---------- Taxonomy candidates (subject ranges per paper from first table) ----------
const sectionMap = {
  'english': 'english', 'islamic': 'islamic', 'math_stats': 'math_stats',
  'management_theories': 'management_theories', 'economics': 'economics',
  'operations_research': 'operations_research', 'production': 'production', 'marketing': 'marketing',
};
const mappingCandidates = [];
for (const src of papers) {
  const mdText = readFileSync(join(root, 'pdf', src.filename), 'utf8');
  const firstTable = mdText.match(/<table>([\s\S]*?)<\/table>/)?.[1] || '';
  const rows = [...firstTable.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((c) => c[1].trim())
  );
  for (const row of rows) {
    const subj = row.find((c) => c && /زبان|اسلام|ریاضی|تئوری|اقتصاد|تحقیق|تولید|بازاریابی|حمل|سرمایه|مالیه|منابع|حسابداری|آفرینی/.test(c));
    if (!subj || subj.length < 3) continue;
    // crude section by keyword (candidate only, needs_review)
    let sectionId = null;
    if (/زبان/.test(subj)) sectionId = 'english';
    else if (/اسلام/.test(subj)) sectionId = 'islamic';
    else if (/ریاضی|آمار/.test(subj)) sectionId = 'math_stats';
    else if (/تئوری/.test(subj)) sectionId = 'management_theories';
    else if (/اقتصاد/.test(subj)) sectionId = 'economics';
    else if (/عملیات/.test(subj)) sectionId = 'operations_research';
    else if (/تولید/.test(subj)) sectionId = 'production';
    else if (/بازاریابی/.test(subj)) sectionId = 'marketing';
    if (sectionId) mappingCandidates.push({ document_id: src.document_id, exam_year: src.exam_year?.value ?? null, subject_raw: subj.slice(0, 80), sectionId, status: 'candidate_needs_review', evidence: 'subject_table_row' });
  }
}

// ---------- Write local staging ----------
function writeJsonl(name, rows) {
  writeFileSync(join(outDir, name), rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}
const runManifest = { run_id: runId, created_at: new Date().toISOString(), inputs: sources.map((s) => ({ document_id: s.document_id, sha256_md: s.sha256_md, pages: s.pages })), counts: { sources: sources.length, papers: papers.length, keys: keys.length, pairing: pairing.length } };
writeFileSync(join(outDir, 'run-manifest.json'), JSON.stringify(runManifest, null, 2));
writeJsonl('source-inventory.jsonl', sources);
writeJsonl('document-classification.jsonl', sources.map((s) => ({ document_id: s.document_id, source_id: s.source_id, filename: s.filename, document_type: s.document_type, classification_status: s.document_type.value === 'unknown' ? 'needs_review' : 'classified' })));
writeJsonl('exam-metadata-candidates.jsonl', sources.map((s) => ({ document_id: s.document_id, exam_level: s.exam_level, exam_year: s.exam_year, booklet_code: s.booklet_code, exam_set_code: s.exam_set_code })));
writeJsonl('pairing-results.jsonl', pairing);
writeJsonl('taxonomy-mapping-candidates.jsonl', mappingCandidates);
writeJsonl('quarantine.jsonl', quarantine);

// questions + keys per doc (local only)
let totalQ = 0, totalKeyEntries = 0, totalConflicts = 0;
for (const src of sources) {
  const mdText = readFileSync(join(root, 'pdf', src.filename), 'utf8');
  if (src.document_type.value === 'exam_paper') {
    const qs = extractQuestions(src, mdText);
    totalQ += qs.length;
    writeJsonl(`questions-${src.source_id}.jsonl`, qs);
  }
  if (src.document_type.value === 'answer_key') {
    const k = extractKey(src, mdText);
    totalKeyEntries += k.entries.length;
    totalConflicts += k.conflicts.length;
    writeJsonl(`key-${src.source_id}.jsonl`, k.entries);
    if (k.conflicts.length) quarantine.push({ kind: 'conflicting_keys', file: src.filename, conflicts: k.conflicts.slice(0, 10) });
  }
}
writeJsonl('quarantine.jsonl', quarantine);

const summary = {
  run_id: runId,
  sources: sources.length,
  papers: papers.length,
  keys: keys.length,
  pairing_candidate: pairing.filter((p) => p.pairing_status === 'candidate').length,
  pairing_unresolved: pairing.filter((p) => p.pairing_status === 'unresolved').length,
  questions_extracted: totalQ,
  key_entries: totalKeyEntries,
  key_conflicts: totalConflicts,
  mapping_candidates: mappingCandidates.length,
  quarantine: quarantine.length,
};
writeFileSync(join(outDir, 'reports-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
