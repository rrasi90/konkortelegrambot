/**
 * AEL — Exam MD Analysis helpers (pure, no IO).
 * Used by scripts/ael-exam-analyze.mjs and isolated tests.
 *
 * Principles (AEL master plan §0.1):
 * - No raw guess is ever promoted to a fact: every value carries evidence + confidence.
 * - Zero / unknown / not-applicable are distinct; ambiguous inputs stay quarantined.
 */

export const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const DIGIT_MAP = new Map();
for (let i = 0; i < 10; i++) {
  DIGIT_MAP.set(FA_DIGITS[i], String(i));
  DIGIT_MAP.set(AR_DIGITS[i], String(i));
}

/** Normalize Persian, Arabic-Indic and Latin digits to Latin '0'-'9'. */
export const toEnDigits = (s) =>
  String(s ?? '').replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP.get(d) ?? d);

/** Strip bidi/format control chars that break digit matching. */
export const stripBidi = (s) =>
  String(s ?? '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');

/**
 * Fold Arabic-script lookalikes to Persian forms (Arabic ي/ك vs Persian ی/ک)
 * so OCR mixes inside one document still match Persian patterns.
 */
export const foldPersian = (s) =>
  String(s ?? '').replace(/\u064a/g, '\u06cc').replace(/\u0643/g, '\u06a9');

/** Full numeric normalization: bidi strip + Persian fold + digit fold + collapse whitespace. */
export const normalizeNumText = (s) =>
  toEnDigits(foldPersian(stripBidi(s))).replace(/\s+/g, ' ').trim();

export function parseInlineOptions(text) {
  const en = toEnDigits(stripBidi(text));
  const opts = [];
  for (const mm of en.matchAll(/(?:^|\s)\(?([1-4])\)\s*([^]*?)(?=(?:\s)\(?[1-4]\)\s|$)/g)) {
    opts.push({ label: mm[1], text: mm[2].trim() });
  }
  if (opts.length >= 2) return opts;
  const bare = [];
  for (const mm of en.matchAll(/(?:^|\s)([1-4])\s+([^]*?)(?=(?:\s)[1-4]\s+|$)/g)) {
    bare.push({ label: mm[1], text: mm[2].trim() });
  }
  if (bare.length >= 3 && new Set(bare.map((o) => o.label)).size === bare.length) return bare;
  return opts;
}

export function cellText(s) {
  return stripBidi(String(s ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Answer-key table parsing (Persian/Arabic digit safe)
// ---------------------------------------------------------------------------

const KEY_HEADER_CELLS = ['شماره سوال', 'شماره سؤال', 'گزینه صحیح', 'پاسخ صحیح', 'پاسخ درست'];

const isHeaderCell = (c) => KEY_HEADER_CELLS.some((h) => c.includes(h));
const isPureNum = (c) => /^\d{1,3}$/.test(c);
const isOption = (c) => /^[1-4]$/.test(c);

/** A long pure-digit run (>=15 chars) means OCR merged several cells — never parse it. */
const isMergedDigitBlob = (c) => /^\d{15,}$/.test(c);

/**
 * Walk one answer-key table row's cells as (question_number, correct_option) pairs.
 * Skips header label cells, dangling empty cells, and merged digit blobs.
 * Returns { pairs: [{n, a}], anomalies: [{kind, raw, cell_index}] }.
 */
export function parseKeyRowPairs(cellsEn) {
  const pairs = [];
  const anomalies = [];
  const cells = cellsEn.map(normalizeNumText);
  let i = 0;
  while (i < cells.length) {
    const c = cells[i];
    if (!c || isHeaderCell(c)) { i += 1; continue; }
    if (isMergedDigitBlob(c)) {
      anomalies.push({ kind: 'merged_digit_cell', raw: c.slice(0, 40), cell_index: i });
      i += 1; continue;
    }
    if (isPureNum(c) && i + 1 < cells.length && isOption(cells[i + 1])) {
      pairs.push({ n: Number(c), a: Number(cells[i + 1]) });
      i += 2; continue;
    }
    // unaligned cell (e.g. a question number whose option cell was dropped by OCR)
    if (isPureNum(c)) anomalies.push({ kind: 'unaligned_number_cell', raw: c, cell_index: i });
    i += 1;
  }
  return { pairs, anomalies };
}

/**
 * Extract key entries from full answer-key markdown.
 * Primary: table rows walked as numeric pairs (Persian/Arabic/Latin digits).
 * Fallback: plain-text "NN M" pairs only when table yield is low (<20).
 * Returns { entries, conflicts, anomalies }.
 */
export function extractKeyEntries(mdText) {
  const tablePairs = [];
  const anomalies = [];
  for (const rm of mdText.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => cellText(c[1]));
    if (!cells.length) continue;
    // cover-table rows (گروه امتحانی / شماره پاسخنامه / کد رشته / مجموعه ...) are not key rows
    if (cells.some((c) => /پاسخانامه|پاسخنامه|گروه امتحانی|کروه امتحانی|امتحانی|مجموعه|هعومجم/.test(c))) continue;
    const { pairs, anomalies: rowAnoms } = parseKeyRowPairs(cells);
    tablePairs.push(...pairs);
    anomalies.push(...rowAnoms);
  }
  // plain-text fallback only when the table yield is too low to trust
  if (tablePairs.length < 20) {
    const plain = mdText.replace(/<[^>]+>/g, ' ').replace(/\n+/g, ' ');
    const plainPairs = [];
    for (const m of toEnDigits(stripBidi(plain)).matchAll(/(\b\d{1,3}\b)\s+([1-4])\b/g)) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 400) plainPairs.push({ n, a: Number(m[2]) });
    }
    if (plainPairs.length > tablePairs.length) {
      return finalizeKey(plainPairs, anomalies, 'plain_text');
    }
  }
  return finalizeKey(tablePairs, anomalies, 'table_pairs');
}

function finalizeKey(pairs, anomalies, strategy) {
  const byNum = new Map();
  const conflicts = [];
  for (const p of pairs) {
    if (!Number.isInteger(p.n) || p.n < 1 || p.n > 400) continue;
    if (!Number.isInteger(p.a) || p.a < 1 || p.a > 4) continue;
    if (byNum.has(p.n) && byNum.get(p.n) !== p.a) {
      conflicts.push({ question_number: p.n, first: byNum.get(p.n), second: p.a });
    } else {
      byNum.set(p.n, p.a);
    }
  }
  return {
    entries: [...byNum.entries()].sort((x, y) => x[0] - y[0]).map(([n, a]) => ({ question_number: n, correct_option: a })),
    conflicts,
    anomalies,
    strategy,
  };
}

/**
 * Analyze coverage holes in extracted key entries: numbers 1..max with no entry
 * (entire OCR-lost columns produce no anomalies — they are simply absent).
 * Returns { max, missing_count, ranges: [{from, to}] } — evidence for quarantine,
 * never interpolated answers.
 */
export function findKeyGaps(entries) {
  if (!entries.length) return { max: null, missing_count: null, ranges: [] };
  const nums = new Set(entries.map((e) => e.question_number));
  const max = Math.max(...nums);
  const ranges = [];
  let run = null;
  for (let n = 1; n <= max; n++) {
    if (!nums.has(n)) {
      if (run && run.to === n - 1) run.to = n;
      else {
        if (run) ranges.push(run);
        run = { from: n, to: n };
      }
    }
  }
  if (run) ranges.push(run);
  const missing_count = ranges.reduce((s, r) => s + (r.to - r.from + 1), 0);
  return { max, missing_count, ranges };
}

// ---------------------------------------------------------------------------
// Exam-level detection (evidence + confidence, never bare filename guess)
// ---------------------------------------------------------------------------

export const EXAM_LEVEL_VALUES = {
  phd_management: 'دکتری مدیریت',
  msc_management: 'کارشناسی ارشد مدیریت',
  other: 'سایر آزمون‌ها',
  unknown: 'نامشخص',
};

/** Official exam-set codes observed in this archive (evidence, not guesses). */
const SET_CODE_LEVEL = { '2162': 'phd_management', '1142': 'msc_management' };

function pushEvidence(evidence, rule, quote, weight) {
  if (quote) evidence.push({ rule, quote: String(quote).slice(0, 120), weight });
}

/**
 * Detect exam level from title text + set code + filename + materials structure.
 * Returns { value, label, confidence: 'high'|'medium'|'low'|null, status, evidence }.
 * Evidence weights: 3 = strong (official set code, explicit degree+مدیریت phrase),
 * 2 = medium (management filename, known management materials structure),
 * 1 = degree word only, 0.5 = filename hint.
 * - Any strong evidence → *_management with confidence 'high'.
 * - Degree word + medium evidence → *_management, 'medium', needs_review.
 * - Degree word without any management tie → 'other' (سایر آزمون‌ها), needs_review.
 * - Weak evidence only → 'unknown', 'low'.
 * - Contradicting degree words with no strong tie → 'unknown', status 'ambiguous'.
 */
/**
 * @param {string} enText
 * @param {{ setCode?: string | null, filename?: string, materialsEvidence?: boolean, collectionName?: string | null }} [options]
 */
export function detectExamLevel(enText, { setCode = null, filename = '', materialsEvidence = false, collectionName = null } = {}) {
  const text = normalizeNumText(enText);
  const evidence = [];
  // bounded RTL-reversal OCR artifacts (e.g. "دشرا" for ارشد, "تيريدم" for مدیریت)
  const reversedMsc = /دشرا|کاسینحراک/.test(text);
  const hasPhd = /دکتری/.test(text);
  const hasMsc = /کارشناسی\s*ارشد|کارشناسی‌ارشد/.test(text) || reversedMsc;
  const mgmtPhrase = text.match(/(?:کارشناسی\s*ارشد|دکتری)[^\n]{0,80}مدیریت|مدیریت[^\n]{0,80}(?:کارشناسی\s*ارشد|دکتری)/);
  if (mgmtPhrase) pushEvidence(evidence, 'title_degree_management_phrase', mgmtPhrase[0], 3);
  if (setCode && SET_CODE_LEVEL[setCode]) pushEvidence(evidence, 'exam_set_code', `کد مجموعه ${setCode}`, 3);
  if (/modiriat|مدیریت/i.test(filename)) pushEvidence(evidence, 'filename_management', filename, 2);
  if (materialsEvidence) pushEvidence(evidence, 'materials_structure', 'مواد امتحانی شناخته‌شده مدیریت', 2);
  if (collectionName && (/مدیریت|مديرت|تيريدم/.test(normalizeNumText(collectionName)) || bigramSimilarity(normalizeNumText(collectionName), 'مدیریت') >= 0.45)) {
    pushEvidence(evidence, 'exam_collection_name', String(collectionName).slice(0, 60), 2);
  }

  const hasMgmtTie = mgmtPhrase || (setCode && SET_CODE_LEVEL[setCode]) || /modiriat|مدیریت/i.test(filename) || materialsEvidence || (collectionName && (/مدیریت|مديرت|تيريدم/.test(normalizeNumText(collectionName)) || bigramSimilarity(normalizeNumText(collectionName), 'مدیریت') >= 0.45));
  if (hasPhd && !mgmtPhrase && !hasMgmtTie) pushEvidence(evidence, 'degree_word_only', 'دکتری', 1);
  if (hasMsc && !mgmtPhrase && !hasMgmtTie) pushEvidence(evidence, 'degree_word_only', 'کارشناسی ارشد', 1);
  if (/arshad|arshd|ارش[اد]/i.test(filename)) pushEvidence(evidence, 'filename_hint', filename, 0.5);

  const strong = evidence.filter((e) => e.weight >= 3);
  const strongLevels = new Set(
    strong.map((e) =>
      e.rule === 'title_degree_management_phrase'
        ? (/دکتری/.test(e.quote) ? 'phd_management' : 'msc_management')
        : SET_CODE_LEVEL[setCode],
    ),
  );
  if (strongLevels.size > 1) {
    return { value: 'unknown', label: EXAM_LEVEL_VALUES.unknown, confidence: null, status: 'ambiguous', evidence };
  }
  if (strongLevels.size === 1) {
    const value = [...strongLevels][0];
    return { value, label: EXAM_LEVEL_VALUES[value], confidence: 'high', status: 'proposed', evidence };
  }
  // medium path: degree word + management tie
  if ((hasPhd || hasMsc) && hasMgmtTie) {
    if (hasPhd && hasMsc) {
      return { value: 'unknown', label: EXAM_LEVEL_VALUES.unknown, confidence: null, status: 'ambiguous', evidence };
    }
    const value = hasPhd ? 'phd_management' : 'msc_management';
    return { value, label: EXAM_LEVEL_VALUES[value], confidence: 'medium', status: 'needs_review', evidence };
  }
  // degree word with no management tie at all → other exams
  if (hasPhd !== hasMsc && (hasPhd || hasMsc)) {
    return { value: 'other', label: EXAM_LEVEL_VALUES.other, confidence: 'medium', status: 'needs_review', evidence };
  }
  if (evidence.length) {
    return { value: 'unknown', label: EXAM_LEVEL_VALUES.unknown, confidence: 'low', status: 'needs_review', evidence };
  }
  return { value: 'unknown', label: EXAM_LEVEL_VALUES.unknown, confidence: null, status: 'unknown', evidence };
}

// ---------------------------------------------------------------------------
// Subject-table parsing → question-number ranges per exam material
// ---------------------------------------------------------------------------

/**
 * Canonical section dictionary for the arshad-management materials observed in
 * this archive. Ordered: specific patterns before generic substrings.
 */
export const SECTION_DICTIONARY = [
  { sectionId: 'public_finance', patterns: ['مالی عمومی', 'مایبه عمومی', 'بودجه'] },
  { sectionId: 'operations_research', patterns: ['تحقیق در عملیات', 'تحقیف در عملیات', 'عملیات'] },
  { sectionId: 'investment_risk', patterns: ['سرمایه گذاری', 'سرمایه‌گذاری', 'سرمایی'] },
  { sectionId: 'entrepreneurship', patterns: ['کارآفرینی', 'کارافریسی', 'آفرینی'] },
  { sectionId: 'government_accounting', patterns: ['حسابداری دولتی', 'حسنداری درلتو'] },
  { sectionId: 'management_theories', patterns: ['تئوری', 'توری', 'نظریه'] },
  { sectionId: 'financial_management', patterns: ['مدیریت مالی', 'مدیرمت مدلی'] },
  { sectionId: 'marketing', patterns: ['بازاریابی', 'پزاریلی'] },
  { sectionId: 'production', patterns: ['مدیریت تولید', 'مدیریت تونید', 'تولید'] },
  { sectionId: 'economics', patterns: ['اقتصاد', 'افتتصاد'] },
  { sectionId: 'math_stats', patterns: ['ریاضی', 'ريضی', 'آمار'] },
  { sectionId: 'accounting', patterns: ['حسابداری', 'حسنداری', 'حسیداری'] },
  { sectionId: 'islamic', patterns: ['اسلام', 'معارف'] },
  { sectionId: 'law', patterns: ['حقوق', 'احوس'] },
  { sectionId: 'human_resources', patterns: ['منابع انسانی', 'منانی'] },
  { sectionId: 'english', patterns: ['زبان', 'زمن'] },
];

/** Character-bigram similarity, tolerant to OCR char errors on short strings. */
export function bigramSimilarity(a, b) {
  const grams = (s) => {
    const t = normalizeNumText(s).replace(/\s+/g, '');
    const out = new Set();
    for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (!ga.size || !gb.size) return 0;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter += 1;
  return inter / Math.min(ga.size, gb.size);
}

/** Character-reverse — used to survive RTL header reversal OCR artifacts. */
export const reverseText = (s) => normalizeNumText(String(s ?? '').split('').reverse().join(''));

// ---------------------------------------------------------------------------
// Exam-set code from key-cover tables (کد رشته امتحانی / مجموعه امتحانی)
// ---------------------------------------------------------------------------

const SET_CONTEXT_HINTS = [/ر[سش][نه]{1,2}\s*امتحانی/, /ر[سش]ته\s*امتحانی/, /امتحانی/, /مجموعه/, /هعومجم/, /مدیریت/, /تيريدم/];

const contextHintsSetCode = (cells) =>
  cells.some((c) => {
    const n = normalizeNumText(c);
    const rv = reverseText(c);
    return SET_CONTEXT_HINTS.some((h) => h.test(n) || h.test(rv));
  });

/**
 * Table-aware set-code extraction: a standalone 4-digit code cell (1xxx/2xxx)
 * counts as an exam-set-code candidate only when its row or the row above it
 * contains an exam-set context hint (رشته امتحانی / مجموعه / مدیریت), in normal
 * or RTL-reversed form. Survives OCR spelling slips (رشنه، مديرت) and the
 * reversed-header layout (e.g. "یناحتما هتشر دک | 1142").
 * Returns { value, rule, quote } or null — never a bare number guess.
 */
export function extractSetCodeFromTables(mdText) {
  const rows = [...mdText.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => cellText(c[1])).filter(Boolean),
  );
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const headers = i > 0 ? rows[i - 1] : [];
    for (let j = 0; j < row.length; j++) {
      const c = normalizeNumText(row[j]);
      if (!/^[12][0-9]{3}$/.test(c)) continue;
      const context = [...row.filter((_, k) => k !== j), ...headers];
      if (contextHintsSetCode(context)) {
        return { value: c, rule: 'set_code_table_cell', quote: c };
      }
    }
  }
  return null;
}

/**
 * Extract the exam-collection name (عنوان دفترچه / مجموعه امتحانی value cell)
 * from key-cover tables. Handles OCR slips (مديرت for مديریت) and RTL reversal.
 * Returns { value, rule, quote } or null; matched names are never rewritten.
 */
export function extractExamCollectionName(mdText) {
  const rows = [...mdText.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => cellText(c[1])).filter(Boolean),
  );
  for (let i = 1; i < rows.length; i++) {
    for (const c of rows[i]) {
      if (/^[1-4]$/.test(c) || /^[0-9]{1,3}$/.test(c) || /^[A-Z]$/.test(c)) continue;
      const n = normalizeNumText(c);
      const rv = reverseText(c);
      if (/مدیریت|مديرت|تيريدم/.test(n) || /مدیریت|مديرت|تيريدم/.test(rv) || bigramSimilarity(n, 'مدیریت') >= 0.45) {
        return { value: n, rule: 'collection_name_cell', quote: c.slice(0, 60) };
      }
    }
  }
  return null;
}

/**
 * Match one raw (possibly OCR-garbled) material name to a canonical section.
 * Pattern substring first, then bigram similarity. Never returns a forced match.
 */
export function matchSection(materialRaw) {
  const mat = normalizeNumText(materialRaw);
  for (const sec of SECTION_DICTIONARY) {
    for (const p of sec.patterns) {
      if (mat.includes(normalizeNumText(p))) {
        return { sectionId: sec.sectionId, similarity: 1, basis: 'pattern' };
      }
    }
  }
  let best = { sectionId: null, similarity: 0 };
  for (const sec of SECTION_DICTIONARY) {
    for (const p of sec.patterns) {
      const sim = bigramSimilarity(mat, p);
      if (sim > best.similarity) best = { sectionId: sec.sectionId, similarity: sim };
    }
  }
  if (best.similarity >= 0.45) return { ...best, basis: 'similarity' };
  return { sectionId: null, similarity: best.similarity, basis: 'none' };
}

/**
 * Parse the per-paper subject table (تا شماره | از شماره | تعداد سوال | مواد امتحانی | ردیف)
 * into validated question-number ranges with evidence.
 * Ranges are candidates only: `count_mismatch` or unmatched material → needs_review.
 */
export function parseSubjectRanges(tableHtml) {
  const ranges = [];
  const issues = [];
  if (!tableHtml) return { ranges, issues: [{ kind: 'no_subject_table' }] };
  const rows = [...tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => cellText(c[1])),
  );
  for (const cells of rows) {
    if (cells.some((c) => c.includes('تا شماره') || c.includes('مواد امتحانی'))) continue; // header
    if (cells.length < 4) continue;
    const en = cells.map(normalizeNumText);
    // expected column order: [to, from, count, material, row#]; tolerate 4-cell rows
    const toNum = Number(en[0]);
    const fromNum = Number(en[1]);
    const countNum = Number(en[2]);
    const material = cells[3];
    if (!Number.isInteger(toNum) || !Number.isInteger(fromNum) || toNum < 1 || fromNum < 1) continue;
    const expected = toNum - fromNum + 1;
    const r = {
      from_question: fromNum,
      to_question: toNum,
      declared_count: Number.isInteger(countNum) ? countNum : null,
      material_raw: material.slice(0, 120),
      ...matchSection(material),
      issues: [],
    };
    if (Number.isInteger(countNum) && countNum !== expected) {
      r.issues.push({ kind: 'count_mismatch', declared: countNum, expected });
    }
    if (r.sectionId === null) {
      r.issues.push({ kind: 'material_unmatched', best_similarity: Number(r.similarity.toFixed(2)) });
    }
    r.status = r.issues.length ? 'needs_review' : 'proposed';
    ranges.push(r);
    if (r.issues.length) issues.push({ from: fromNum, to: toNum, material: material.slice(0, 60), issues: r.issues });
  }
  // range integrity: overlaps / gaps
  const sorted = [...ranges].sort((a, b) => a.from_question - b.from_question);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from_question <= sorted[i - 1].to_question) {
      issues.push({ kind: 'range_overlap', a: sorted[i - 1], b: sorted[i] });
    }
  }
  return { ranges, issues };
}

/** Map one question number to its subject-range candidate (or null). */
export function mapQuestionToRange(ranges, questionNumber) {
  return ranges.find((r) => questionNumber >= r.from_question && questionNumber <= r.to_question) ?? null;
}

// ---------------------------------------------------------------------------
// Pairing selection — conflicts are never materialized as a relationship
// ---------------------------------------------------------------------------

/**
 * Select the best candidate for reporting while allowing a definitive
 * candidate link only when there is no known contradiction.
 * A conflicted best candidate remains visible for review, but paired=false.
 */
export function selectPairingCandidate(scored) {
  const ranked = [...scored].sort(
    (a, b) => (b.conflicts.length === 0) - (a.conflicts.length === 0) || b.score - a.score,
  );
  const best = ranked[0] ?? null;
  return {
    best,
    paired: Boolean(best && best.conflicts.length === 0),
    ranked,
  };
}

// ---------------------------------------------------------------------------
// Multi-evidence paper ↔ key pairing
// ---------------------------------------------------------------------------

/**
 * Score a paper/key candidate pair with independent evidence rules.
 * Never returns 'verified': best case is 'candidate_multi_evidence'.
 * Required fields: { exam_year, exam_level, exam_set_code, booklet_code, max_question }.
 */
export function scorePairingEvidence(keyMeta, paperMeta) {
  const evidence = [];
  const conflicts = [];
  let score = 0;
  const add = (rule, ok, weight, detail) => {
    if (ok) { evidence.push({ rule, detail }); score += weight; }
  };
  const bothYearsKnown = !!keyMeta.exam_year && !!paperMeta.exam_year;
  add('year_match', bothYearsKnown && keyMeta.exam_year === paperMeta.exam_year, 2, { year: keyMeta.exam_year });
  add('level_match', !!keyMeta.exam_level && keyMeta.exam_level === paperMeta.exam_level && keyMeta.exam_level !== 'unknown', 2, { level: keyMeta.exam_level });
  add('set_code_match', !!keyMeta.exam_set_code && !!paperMeta.exam_set_code && keyMeta.exam_set_code === paperMeta.exam_set_code, 3, { set_code: paperMeta.exam_set_code });
  add('booklet_code_match', !!keyMeta.booklet_code && !!paperMeta.booklet_code && keyMeta.booklet_code === paperMeta.booklet_code, 3, { booklet: paperMeta.booklet_code });
  add(
    'question_count_match',
    !!keyMeta.max_question && !!paperMeta.max_question && Math.abs(keyMeta.max_question - paperMeta.max_question) <= 2,
    1,
    { key_max: keyMeta.max_question, paper_max: paperMeta.max_question },
  );
  // explicit contradiction: known years differ — this pair can never be promoted
  if (bothYearsKnown && keyMeta.exam_year !== paperMeta.exam_year) {
    conflicts.push({ rule: 'year_conflict', detail: { key_year: keyMeta.exam_year, paper_year: paperMeta.exam_year } });
  }
  let status;
  if (conflicts.length) status = 'needs_review';
  else {
    const strong = evidence.filter((e) => ['set_code_match', 'booklet_code_match', 'level_match'].includes(e.rule)).length;
    if (score >= 6 && strong >= 2) status = 'candidate_multi_evidence';
    else if (score >= 4) status = 'candidate_evidence_partial';
    else if (score >= 2) status = 'candidate_weak';
    else status = 'unresolved';
  }
  return { evidence, conflicts, score, status };
}
