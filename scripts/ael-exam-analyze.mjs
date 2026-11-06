/**
 * AEL — Exam MD Analysis Pipeline (structural, offline, local-only).
 * Reads pdf/*.md + pdf/_CONVERSION_REPORT.json, classifies with evidence,
 * extracts exam context (year/level/booklet/set), questions, keys, multi-evidence
 * pairing, subject-range topic candidates, quarantine. Writes local staging under
 * .ael-work/exam-analysis/runs/<run-id>/ — NOT committed.
 * Usage: node scripts/ael-exam-analyze.mjs [--run-id <id>]
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  toEnDigits as toEn,
  parseInlineOptions,
  cellText,
  normalizeNumText,
  extractKeyEntries,
  extractSetCodeFromTables,
  extractExamCollectionName,
  detectExamLevel,
  EXAM_LEVEL_VALUES,
  parseSubjectRanges,
  mapQuestionToRange,
  scorePairingEvidence,
} from './ael-exam-utils.mjs';

const root = process.cwd();
const runIdIdx = process.argv.indexOf('--run-id');
const runId = runIdIdx > -1 ? process.argv[runIdIdx + 1] : new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const outDir = join(root, '.ael-work', 'exam-analysis', 'runs', runId);
mkdirSync(outDir, { recursive: true });

const norm = (s) => normalizeNumText(s);
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

/**
 * Booklet code (3 digits + letter, e.g. 103A / 519C) from normalized head text.
 * Returns { value, status, evidence } — null when only merged/ambiguous runs exist.
 */
function extractBooklet(enHead) {
  const m = enHead.match(/(?:^|[^0-9])([0-9]{3}[A-Z])(?![0-9])/);
  if (m) return { value: m[1], status: 'proposed', evidence: [{ rule: 'head_booklet_code', quote: m[1] }] };
  return { value: null, status: 'unknown', evidence: [] };
}

/**
 * Exam-set code: two independent patterns —
 *  (a) "کد 1142" / "کد(1142)"  (b) "1142 - مدیریت" inside set-code tables.
 * Both are candidates with evidence; neither is trusted without pairing.
 */
function extractSetCode(enText) {
  const m1 = enText.match(/کد\s*\(?\s*([12][0-9]{3})\s*\)?/);
  if (m1) return { value: m1[1], status: 'proposed', evidence: [{ rule: 'set_code_label', quote: m1[0].slice(0, 40) }] };
  const m2 = enText.match(/([12][0-9]{3})\s*[-–—]\s*مدیریت/);
  if (m2) return { value: m2[1], status: 'proposed', evidence: [{ rule: 'set_code_management_row', quote: m2[0].slice(0, 40) }] };
  return { value: null, status: 'unknown', evidence: [] };
}

function extractYear(enText) {
  const cands = [...enText.matchAll(/سال\s*(1[0-9]{3})/g)].map((x) => Number(x[1])).filter((y) => y >= 1370 && y <= 1420);
  const uniq = [...new Set(cands)];
  if (!uniq.length) return { value: null, status: 'unknown', evidence: [] };
  if (uniq.length === 1) return { value: uniq[0], status: 'proposed', evidence: [{ rule: 'title_year', quote: `سال ${uniq[0]}` }] };
  return { value: null, status: 'ambiguous', candidates: uniq, evidence: [{ rule: 'title_year_multi', quotes: uniq }] };
}

// ---------- Inventory + Classification ----------
const pdfFiles = readdirSync(join(root, 'pdf')).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
const conv = JSON.parse(readFileSync(join(root, 'pdf', '_CONVERSION_REPORT.json'), 'utf8'));
const convByFile = new Map(conv.map((r) => [r.file.replace(/\.pdf$/, '.md'), r]));
const sources = [];
const quarantine = [];

function firstSubjectTable(text) {
  return text.match(/<table>([\s\S]*?)<\/table>/)?.[1] || '';
}

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
  // unknown papers (management files) -> propose exam_paper when title says آزمون ورودی
  if (docType === 'unknown' && typeEvidence.some((e) => e.rule === 'title_exam')) {
    docType = 'exam_paper';
  }
  const year = extractYear(enHead);
  // filename year hint only for proposals when text unknown
  const fileYearM = (mdFile.match(/(13\d{2}|14\d{2})/) || [])[1];
  if (!year.value && fileYearM && docType !== 'unknown') {
    year.value = Number(fileYearM);
    year.status = 'proposed_filename_only';
    year.evidence = [{ rule: 'filename_hint', value: fileYearM }];
  }
  const booklet = extractBooklet(enHead);
  let setCode = extractSetCode(enHead);
  // fallback: table-cell set code (کد رشته امتحانی | 1142 layouts, reversed headers)
  if (!setCode.value) {
    const fromTable = extractSetCodeFromTables(text);
    if (fromTable) {
      setCode = { value: fromTable.value, status: 'proposed', evidence: [fromTable] };
    }
  }
  // materials-structure evidence: subject table with known management materials
  let subjRanges = null;
  let materialsEvidence = false;
  if (docType === 'exam_paper' || docType === 'unknown') {
    const { ranges, issues } = parseSubjectRanges(firstSubjectTable(text));
    subjRanges = { ranges, issues };
    const knownSections = new Set(ranges.filter((r) => r.sectionId).map((r) => r.sectionId));
    materialsEvidence = knownSections.size >= 3;
  }
  // collection name (عنوان دفترچه / مجموعه امتحانی value cell) — management tie evidence
  const collection = extractExamCollectionName(text);
  const level = detectExamLevel(enHead, {
    setCode: setCode.value,
    filename: mdFile,
    materialsEvidence,
    collectionName: collection?.value ?? null,
  });
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
    exam_level: level,
    exam_year: year,
    booklet_code: booklet,
    exam_set_code: setCode,
    exam_collection_name: collection ? { value: collection.value, evidence: [collection] } : { value: null, evidence: [] },
    subject_ranges: subjRanges,
    rights_status: fm.rights_status || 'unknown',
    verification_status: fm.verification_status || 'unknown',
  });
  if (docType === 'unknown') quarantine.push({ kind: 'unknown_document', file: mdFile, document_id: fm.document_id });
  if (missingHeads.length) quarantine.push({ kind: 'missing_pages', file: mdFile, missing: missingHeads });
  if (level.status === 'ambiguous' || level.value === 'unknown' || !year.value) {
    quarantine.push({
      kind: 'uncertain_metadata',
      file: mdFile,
      level: { value: level.value, status: level.status, confidence: level.confidence },
      year: year.value,
    });
  }
}

// ---------- Question extraction (paper docs only) ----------
// Handles: (a) plain "1- ..." lines with inline options "1) .. 2) ..",
// (b) table rows "<tr><td>11-</td><td>1) in</td>..." , (c) Persian digits.
// Option/cell helpers live in ./ael-exam-utils.mjs (shared with tests).
function extractQuestions(source, mdText, subjectRanges) {
  const out = [];
  const seen = new Map();
  const pages = splitPages(mdText);
  function pushQ(numRaw, num, qtext, opts, page, line, isTable) {
    if (!Number.isInteger(num) || num < 1 || num > 400) return;
    const issues = [];
    if (!qtext || qtext.length < 4) issues.push('short_stem');
    if (opts.length > 0 && opts.length < 4) issues.push('options_not_4');
    if (opts.length === 0) issues.push('no_options_found');
    // topic candidate from the validated subject-range table (never a guess)
    const rng = mapQuestionToRange(subjectRanges ?? [], num);
    const topicCandidates = rng
      ? [{
          section_id: rng.sectionId,
          material_raw: rng.material_raw,
          range: { from: rng.from_question, to: rng.to_question },
          similarity: rng.similarity,
          status: rng.status,
          issues: rng.issues,
        }]
      : [{ section_id: null, material_raw: null, status: 'no_range_found', issues: [] }];
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
      topic_candidates: topicCandidates,
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
          pushQ(qm[1], num, '', opts, pg.page, li + 1, true);
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
      if (/^صفحه|صفه|^V\s*$|^[0-9]{3}[A-Z]/.test(lineEn.trim())) continue;
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
          if (opts.length >= 4) break;
        }
      }
      pushQ(m[1], num, stem, opts, pg.page, li + 1, false);
    }
  }
  out.sort((a, b) => a.question_number - b.question_number);
  return out;
}

// ---------- Key extraction (digit-safe, via shared utils) ----------

// ---------- Multi-evidence pairing (computed after per-source extraction) ----------
const papers = sources.filter((s) => s.document_type.value === 'exam_paper');
const keys = sources.filter((s) => s.document_type.value === 'answer_key');

function buildPairing() {
  const results = [];
  for (const key of keys) {
    const keyMeta = {
      exam_year: key.exam_year?.value ?? null,
      exam_level: key.exam_level?.value ?? null,
      exam_set_code: key.exam_set_code?.value ?? null,
      booklet_code: key.booklet_code?.value ?? null,
      max_question: key.key_max_question ?? null,
    };
    const scored = papers
      .map((p) => ({
        paper: p,
        ...scorePairingEvidence(keyMeta, {
          exam_year: p.exam_year?.value ?? null,
          exam_level: p.exam_level?.value ?? null,
          exam_set_code: p.exam_set_code?.value ?? null,
          booklet_code: p.booklet_code?.value ?? null,
          max_question: p.max_question ?? null,
        }),
      }))
      .filter((c) => c.score > 0 || c.conflicts.length);
    // conflict-free candidates rank above conflicted ones; score breaks ties
    scored.sort((a, b) => (b.conflicts.length === 0) - (a.conflicts.length === 0) || b.score - a.score);
    const best = scored[0] ?? null;
    const paired = best && (best.conflicts.length === 0 || !scored.some((c) => c.conflicts.length === 0 && c.score > 0));
    results.push({
      key_source_id: key.source_id,
      key_file: key.filename,
      key_year: keyMeta.exam_year,
      key_level: keyMeta.exam_level,
      key_set_code: keyMeta.exam_set_code,
      key_max_question: keyMeta.max_question,
      paired_source_id: paired && best ? best.paper.source_id : null,
      paired_file: paired && best ? best.paper.filename : null,
      pairing_status: best ? best.status : 'unresolved',
      pairing_score: best ? best.score : 0,
      evidence: best ? best.evidence : [],
      conflicts: best ? best.conflicts : [],
      other_candidates: scored.slice(1).map((c) => ({ source_id: c.paper.source_id, score: c.score, status: c.status, conflicts: c.conflicts })),
    });
    if (!best || best.status === 'unresolved') {
      quarantine.push({ kind: 'pairing_unresolved', file: key.filename, key_source_id: key.source_id, key_year: keyMeta.exam_year });
    }
    if (best && best.conflicts.length) {
      quarantine.push({
        kind: 'pairing_year_conflict',
        file: key.filename,
        key_source_id: key.source_id,
        key_year: keyMeta.exam_year,
        nearest_paper_year: best.conflicts[0].detail.paper_year,
      });
    }
  }
  return results;
}

// ---------- Topic mapping candidates (subject ranges per paper) ----------
const mappingCandidates = [];
for (const src of papers) {
  const ranges = src.subject_ranges?.ranges ?? [];
  for (const r of ranges) {
    mappingCandidates.push({
      document_id: src.document_id,
      source_id: src.source_id,
      exam_year: src.exam_year?.value ?? null,
      from_question: r.from_question,
      to_question: r.to_question,
      declared_count: r.declared_count,
      material_raw: r.material_raw,
      section_id: r.sectionId,
      similarity: Number(r.similarity?.toFixed(2) ?? 0),
      basis: r.basis,
      issues: r.issues,
      status: r.status,
      evidence: 'subject_table_range',
    });
  }
  if (src.subject_ranges?.issues?.length) {
    quarantine.push({ kind: 'subject_table_issues', file: src.filename, issues: src.subject_ranges.issues.slice(0, 10) });
  }
}

// ---------- Write local staging ----------
function writeJsonl(name, rows) {
  writeFileSync(join(outDir, name), rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}

// pass 2: extract questions/keys and attach per-source maxima for pairing
let totalQ = 0, topicMapped = 0, topicNeedsReview = 0;
const keyResults = new Map();
for (const src of sources) {
  const mdText = readFileSync(join(root, 'pdf', src.filename), 'utf8');
  if (src.document_type.value === 'exam_paper') {
    const qs = extractQuestions(src, mdText, src.subject_ranges?.ranges ?? []);
    src.max_question = qs.length ? qs[qs.length - 1].question_number : null;
    src.extracted_question_count = qs.length;
    totalQ += qs.length;
    topicMapped += qs.filter((q) => q.topic_candidates[0].section_id).length;
    topicNeedsReview += qs.filter((q) => !q.topic_candidates[0].section_id).length;
    writeJsonl(`questions-${src.source_id}.jsonl`, qs);
  }
  if (src.document_type.value === 'answer_key') {
    const k = extractKeyEntries(mdText);
    keyResults.set(src.source_id, k);
    src.key_entry_count = k.entries.length;
    src.key_max_question = k.entries.length ? k.entries[k.entries.length - 1].question_number : null;
    src.key_strategy = k.strategy;
    if (k.conflicts.length) quarantine.push({ kind: 'conflicting_keys', file: src.filename, conflicts: k.conflicts.slice(0, 10) });
    // aggregate anomalies per source: numbers whose answer cell was lost by OCR
    const missingAnswers = [...new Set(
      k.anomalies.filter((a) => a.kind === 'unaligned_number_cell').map((a) => Number(a.raw)).filter(Number.isInteger),
    )].sort((a, b) => a - b);
    if (missingAnswers.length) {
      quarantine.push({
        kind: 'key_missing_answers',
        file: src.filename,
        document_id: src.document_id,
        count: missingAnswers.length,
        question_numbers: missingAnswers.slice(0, 400),
      });
    }
    if (k.anomalies.some((a) => a.kind === 'merged_digit_cell')) {
      quarantine.push({
        kind: 'key_table_corrupted',
        file: src.filename,
        document_id: src.document_id,
        detail: 'merged digit cells — re-OCR from the original PDF is required; no key guessed',
      });
    }
    writeJsonl(`key-${src.source_id}.jsonl`, k.entries);
  }
}
// recompute pairing now that key/paper maxima are known
const pairing2 = buildPairing();

const runManifest = {
  run_id: runId,
  created_at: new Date().toISOString(),
  inputs: sources.map((s) => ({ document_id: s.document_id, sha256_md: s.sha256_md, pages: s.pages })),
  counts: { sources: sources.length, papers: papers.length, keys: keys.length, pairing: pairing2.length },
};
writeFileSync(join(outDir, 'run-manifest.json'), JSON.stringify(runManifest, null, 2));
writeJsonl('source-inventory.jsonl', sources.map((s) => {
  const { subject_ranges, ...rest } = s;
  return { ...rest, subject_range_count: subject_ranges?.ranges?.length ?? null, subject_range_issues: subject_ranges?.issues ?? null };
}));
writeJsonl('document-classification.jsonl', sources.map((s) => ({ document_id: s.document_id, source_id: s.source_id, filename: s.filename, document_type: s.document_type, classification_status: s.document_type.value === 'unknown' ? 'needs_review' : 'classified' })));
writeJsonl('exam-metadata-candidates.jsonl', sources.map((s) => ({
  document_id: s.document_id,
  exam_level: { value: s.exam_level.value, label: s.exam_level.label, confidence: s.exam_level.confidence, status: s.exam_level.status, evidence: s.exam_level.evidence },
  exam_year: s.exam_year,
  booklet_code: s.booklet_code,
  exam_set_code: s.exam_set_code,
})));
writeJsonl('pairing-results.jsonl', pairing2);
writeJsonl('topic-mapping-candidates.jsonl', mappingCandidates);
writeJsonl('quarantine.jsonl', quarantine);

const summary = {
  run_id: runId,
  sources: sources.length,
  papers: papers.length,
  keys: keys.length,
  questions_extracted: totalQ,
  topic_candidates_mapped: topicMapped,
  topic_candidates_needs_review: topicNeedsReview,
  key_entries: [...keyResults.values()].reduce((s, k) => s + k.entries.length, 0),
  key_conflicts: [...keyResults.values()].reduce((s, k) => s + k.conflicts.length, 0),
  keys_with_entries: [...keyResults.values()].filter((k) => k.entries.length > 0).length,
  keys_zero_entries: [...keyResults.values()].filter((k) => k.entries.length === 0).length,
  key_anomalies: [...keyResults.values()].reduce((s, k) => s + k.anomalies.length, 0),
  pairing_candidate_multi_evidence: pairing2.filter((p) => p.pairing_status === 'candidate_multi_evidence').length,
  pairing_candidate_partial: pairing2.filter((p) => p.pairing_status === 'candidate_evidence_partial').length,
  pairing_candidate_weak: pairing2.filter((p) => p.pairing_status === 'candidate_weak').length,
  pairing_year_conflict: pairing2.filter((p) => p.pairing_status === 'needs_review' && p.conflicts.length).length,
  pairing_unresolved: pairing2.filter((p) => p.pairing_status === 'unresolved' || !p.paired_source_id).length,
  mapping_candidates: mappingCandidates.length,
  quarantine: quarantine.length,
};
writeFileSync(join(outDir, 'reports-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
