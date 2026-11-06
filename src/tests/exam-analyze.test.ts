import { describe, expect, it } from 'vitest';
import {
  cellText,
  parseInlineOptions,
  toEnDigits,
  normalizeNumText,
  parseKeyRowPairs,
  extractKeyEntries,
  findKeyGaps,
  detectExamLevel,
  parseSubjectRanges,
  mapQuestionToRange,
  scorePairingEvidence,
} from '../../scripts/ael-exam-utils.mjs';

/**
 * AEL exam MD analysis — isolated parser tests (synthetic fixtures only,
 * no real exam text, no PDF content).
 */
describe('AEL exam parser — digits and inline options', () => {
  it('Persian digits normalize to Latin for number matching', () => {
    expect(toEnDigits('۳۲')).toBe('32');
    expect(toEnDigits('۱)')).toBe('1)');
  });

  it('Arabic-Indic digits also normalize (U+0660-0669)', () => {
    expect(toEnDigits('٣٤')).toBe('34');
  });

  it('normalization folds Arabic ي/ك to Persian ی/ک and strips bidi marks', () => {
    expect(normalizeNumText('۱۱۴۲ - مديريت')).toBe('1142 - مدیریت');
    expect(normalizeNumText('\u200fسال ۱۴۰۴\u200e')).toBe('سال 1404');
  });

  it('parses inline paren options', () => {
    const opts = parseInlineOptions('1) red 2) green 3) blue 4) black');
    expect(opts.map((o) => o.label)).toEqual(['1', '2', '3', '4']);
  });

  it('parses Persian paren options', () => {
    const opts = parseInlineOptions('(۱) الف (۲) ب (۳) ج (۴) د');
    expect(opts).toHaveLength(4);
    expect(opts[0].label).toBe('1');
  });

  it('parses bare RTL inline options only when >=3 distinct markers', () => {
    const opts = parseInlineOptions('1 alpha 2 beta 3 gamma 4 delta');
    expect(opts).toHaveLength(4);
    // a single bare number must not become an option
    expect(parseInlineOptions('step 2 continues')).toEqual([]);
  });

  it('cellText strips tags and collapses whitespace', () => {
    expect(cellText('<td class="x">  hello   world </td>')).toBe('hello world');
  });
});

describe('AEL answer-key parsing — Persian/Arabic digit tables', () => {
  it('extracts (number, option) pairs from Persian-digit key rows', () => {
    const { pairs, anomalies } = parseKeyRowPairs(['۱', '۲', '۳۱', '۲', '۶۱', '۱', '۹۱', '۱']);
    expect(pairs).toEqual([
      { n: 1, a: 2 },
      { n: 31, a: 2 },
      { n: 61, a: 1 },
      { n: 91, a: 1 },
    ]);
    expect(anomalies).toEqual([]);
  });

  it('extracts pairs from Latin-digit key rows (legacy format)', () => {
    const { pairs } = parseKeyRowPairs(['10', '3', '11', '4']);
    expect(pairs).toEqual([{ n: 10, a: 3 }, { n: 11, a: 4 }]);
  });

  it('skips header label cells and dangling trailing empty cells', () => {
    const { pairs } = parseKeyRowPairs(['شماره سوال', 'گزینه صحیح', '1', '4', '']);
    expect(pairs).toEqual([{ n: 1, a: 4 }]);
  });

  it('flags merged digit blobs instead of guessing an answer', () => {
    const { pairs, anomalies } = parseKeyRowPairs(['18010990000000000000000000', '1']);
    expect(pairs).toEqual([]);
    expect(anomalies.map((a) => a.kind)).toContain('merged_digit_cell');
  });

  it('flags unaligned number cells (option dropped by OCR)', () => {
    const { anomalies } = parseKeyRowPairs(['5', '6', '7']);
    expect(anomalies.filter((a) => a.kind === 'unaligned_number_cell').length).toBeGreaterThan(0);
  });

  it('extractKeyEntries parses a full Persian-digit table document', () => {
    const md = [
      '<table>',
      '<tr><td>شماره سوال</td><td>گزینه صحیح</td><td>شماره سوال</td><td>گزینه صحیح</td></tr>',
      '<tr><td>۱</td><td>۲</td><td>۳۱</td><td>۴</td></tr>',
      '<tr><td>۲</td><td>۱</td><td>۳۲</td><td>۳</td></tr>',
      '</table>',
    ].join('');
    const { entries, conflicts, strategy } = extractKeyEntries(md);
    expect(strategy).toBe('table_pairs');
    expect(entries).toEqual([
      { question_number: 1, correct_option: 2 },
      { question_number: 2, correct_option: 1 },
      { question_number: 31, correct_option: 4 },
      { question_number: 32, correct_option: 3 },
    ]);
    expect(conflicts).toEqual([]);
  });

  it('extractKeyEntries falls back to plain-text pairs only when tables fail', () => {
    const md = 'کلید سوالات: 10 3 11 4 12 1 13 2 14 3 15 4 16 1 17 2 18 3 19 4 20 2 21 1';
    const { strategy, entries } = extractKeyEntries(md);
    expect(strategy).toBe('plain_text');
    expect(entries).toHaveLength(12);
  });

  it('detects conflicting key entries and reports them', () => {
    const md = [
      '<tr><td>1</td><td>2</td></tr><tr><td>2</td><td>4</td></tr>',
      '<tr><td>3</td><td>1</td></tr>',
      '<tr><td>4</td><td>3</td></tr>',
      '<tr><td>5</td><td>2</td></tr>',
      '<tr><td>6</td><td>4</td></tr>',
      '<tr><td>7</td><td>1</td></tr>',
      '<tr><td>8</td><td>3</td></tr>',
      '<tr><td>9</td><td>2</td></tr>',
      '<tr><td>10</td><td>4</td></tr>',
      '<tr><td>1</td><td>3</td></tr>', // conflict for n=1
      '<tr><td>11</td><td>1</td></tr>',
      '<tr><td>12</td><td>4</td></tr>',
      '<tr><td>13</td><td>2</td></tr>',
      '<tr><td>14</td><td>3</td></tr>',
      '<tr><td>15</td><td>4</td></tr>',
      '<tr><td>16</td><td>1</td></tr>',
      '<tr><td>17</td><td>2</td></tr>',
      '<tr><td>18</td><td>3</td></tr>',
      '<tr><td>19</td><td>4</td></tr>',
      '<tr><td>20</td><td>2</td></tr>',
    ].join('<table></table>'.replace('<table></table>', ''));
    const { conflicts } = extractKeyEntries(`<table>${md}</table>`);
    expect(conflicts).toEqual([{ question_number: 1, first: 2, second: 3 }]);
  });

  it('findKeyGaps reports whole OCR-lost ranges without interpolating answers', () => {
    const entries = [
      ...Array.from({ length: 20 }, (_, i) => ({ question_number: i + 1, correct_option: (i % 4) + 1 })),
      ...Array.from({ length: 10 }, (_, i) => ({ question_number: i + 31, correct_option: (i % 4) + 1 })),
    ];
    const g = findKeyGaps(entries);
    expect(g.max).toBe(40);
    expect(g.missing_count).toBe(10);
    expect(g.ranges).toEqual([{ from: 21, to: 30 }]);
  });

  it('findKeyGaps returns nulls for an empty key (never zeros-as-fact)', () => {
    expect(findKeyGaps([])).toEqual({ max: null, missing_count: null, ranges: [] });
  });
});

describe('AEL exam-level detection — evidence and confidence', () => {
  it('title phrase (degree + مدیریت) → msc_management, high, proposed', () => {
    const r = detectExamLevel('آزمون ورودی کارشناسی ارشد مدیریت – سال ۱۴۰۱', {});
    expect(r.value).toBe('msc_management');
    expect(r.confidence).toBe('high');
    expect(r.status).toBe('proposed');
    expect(r.evidence.some((e) => e.rule === 'title_degree_management_phrase')).toBe(true);
  });

  it('official set code 2162 → phd_management with strong evidence', () => {
    const r = detectExamLevel('آزمون دکتری سال ۱۴۰۵', { setCode: '2162' });
    expect(r.value).toBe('phd_management');
    expect(r.confidence).toBe('high');
  });

  it('official set code 1142 upgrades an otherwise untied title to msc_management', () => {
    const r = detectExamLevel('کلید سوالات آزمون کارشناسی ارشد – سال ۱۴۰۵', { setCode: '1142' });
    expect(r.value).toBe('msc_management');
    expect(r.confidence).toBe('high');
    expect(r.evidence.some((e) => e.rule === 'exam_set_code')).toBe(true);
  });

  it('degree word + known management materials → msc_management, medium, needs_review', () => {
    const r = detectExamLevel('آزمون ورودی دوره‌های کارشناسی ارشد ناپیوسته – سال ۱۴۰۴', { materialsEvidence: true });
    expect(r.value).toBe('msc_management');
    expect(r.confidence).toBe('medium');
    expect(r.status).toBe('needs_review');
    expect(r.evidence.some((e) => e.rule === 'materials_structure')).toBe(true);
  });

  it('degree word alone (no management tie) → سایر آزمون‌ها, never assumed مدیریت', () => {
    const r = detectExamLevel('آزمون کارشناسی ارشد مهندسی کامپیوتر', {});
    expect(r.value).toBe('other');
    expect(r.label).toContain('سایر');
    expect(r.confidence).toBe('medium');
  });

  it('weak filename-only evidence stays unknown', () => {
    const r = detectExamLevel('کلیید سوالات آزمون', { filename: 'arshd unknown-1402.md' });
    expect(r.value).toBe('unknown');
    expect(r.confidence).toBe('low');
  });

  it('contradicting strong evidence → unknown, ambiguous', () => {
    const r = detectExamLevel('دکتری مدیریت', { setCode: '1142' });
    expect(r.value).toBe('unknown');
    expect(r.status).toBe('ambiguous');
  });
});

describe('AEL subject-range parsing — fine topic mapping', () => {
  const table = [
    '<table>',
    '<tr><td>تا شماره</td><td>از شماره</td><td>تعداد سوال</td><td>مواد امتحانی</td><td>ردیف</td></tr>',
    '<tr><td>۳۰</td><td>۱</td><td>۳۰</td><td>زبان عمومی و تخصصی</td><td>۱</td></tr>',
    '<tr><td>۶۵</td><td>۳۱</td><td>۳۵</td><td>تئوری‌های مدیریت</td><td>۲</td></tr>',
    '<tr><td>۸۰</td><td>۶۶</td><td>۳۵</td><td>تحقیق در عملیات</td><td>۳</td></tr>',
    // OCR-garbled material (similarity fallback) and count mismatch row
    '<tr><td>۱۰۰</td><td>۸۱</td><td>۲۲</td><td>اقتصاد خرد و کلان</td><td>۴</td></tr>',
    '<tr><td>۱۲۰</td><td>۱۰۱</td><td>۳۰</td><td>پزاریلی</td><td>۵</td></tr>',
    '</table>',
  ].join('');

  const { ranges, issues } = parseSubjectRanges(table);

  it('parses ranges with Persian digits into from/to pairs', () => {
    expect(ranges[0].from_question).toBe(1);
    expect(ranges[0].to_question).toBe(30);
    expect(ranges[1].material_raw).toContain('تئوری');
  });

  it('matches canonical sections for clean materials', () => {
    expect(ranges[0].sectionId).toBe('english');
    expect(ranges[1].sectionId).toBe('management_theories');
    expect(ranges[2].sectionId).toBe('operations_research');
    expect(ranges[3].sectionId).toBe('economics');
  });

  it('flags count mismatch (declared != to-from+1) as needs_review without guessing', () => {
    expect(ranges[3].issues.some((i) => i.kind === 'count_mismatch')).toBe(true);
    expect(ranges[3].status).toBe('needs_review');
  });

  it('unmatched material stays null section (candidate, never guessed)', () => {
    const unmatched = ranges.find((r) => r.material_raw === 'پزاریلی');
    if (unmatched.sectionId === null) {
      expect(unmatched.status).toBe('needs_review');
      expect(unmatched.issues.some((i) => i.kind === 'material_unmatched')).toBe(true);
    } else {
      // acceptable only via explicit pattern in the dictionary (no hidden guessing)
      expect(unmatched.basis).toBe('pattern');
    }
  });

  it('maps each question number to its range', () => {
    expect(mapQuestionToRange(ranges, 1)?.sectionId).toBe('english');
    expect(mapQuestionToRange(ranges, 31)?.sectionId).toBe('management_theories');
    expect(mapQuestionToRange(ranges, 80)?.sectionId).toBe('operations_research');
    expect(mapQuestionToRange(ranges, 81)?.sectionId).toBe('economics');
    expect(mapQuestionToRange(ranges, 121)).toBeNull();
  });

  it('missing table is recorded, never defaulted', () => {
    const r = parseSubjectRanges('');
    expect(r.ranges).toEqual([]);
    expect(r.issues).toContainEqual({ kind: 'no_subject_table' });
  });
});

describe('AEL multi-evidence pairing — scored, never auto-verified', () => {
  const paperMeta = {
    exam_year: 1404,
    exam_level: 'msc_management',
    exam_set_code: '1142',
    booklet_code: '519C',
    max_question: 200,
  };
  const keyMeta = {
    exam_year: 1404,
    exam_level: 'msc_management',
    exam_set_code: '1142',
    booklet_code: '519C',
    max_question: 200,
  };

  it('full evidence agreement → candidate_multi_evidence, not verified', () => {
    const r = scorePairingEvidence(keyMeta, paperMeta);
    expect(r.status).toBe('candidate_multi_evidence');
    expect(r.score).toBeGreaterThanOrEqual(6);
    expect(r.evidence.map((e) => e.rule)).toEqual(
      expect.arrayContaining(['year_match', 'level_match', 'set_code_match', 'booklet_code_match', 'question_count_match']),
    );
  });

  it('year-only match stays a weak candidate', () => {
    const r = scorePairingEvidence({ exam_year: 1404, exam_level: null, exam_set_code: null, booklet_code: null, max_question: null }, {
      exam_year: 1404, exam_level: 'msc_management', exam_set_code: '1142', booklet_code: '519C', max_question: 200,
    });
    expect(r.status).toBe('candidate_weak');
    expect(r.score).toBe(2);
  });

  it('no shared evidence → unresolved', () => {
    const r = scorePairingEvidence({ exam_year: null, exam_level: null, exam_set_code: null, booklet_code: null, max_question: null }, {
      exam_year: 1404, exam_level: 'msc_management', exam_set_code: '1142', booklet_code: '519C', max_question: 200,
    });
    expect(r.status).toBe('unresolved');
    expect(r.score).toBe(0);
  });

  it('known but different years are a conflict: never promoted even with strong evidence', () => {
    const r = scorePairingEvidence({ exam_year: 1390, exam_level: 'msc_management', exam_set_code: '1142', booklet_code: null, max_question: 200 }, {
      exam_year: 1391, exam_level: 'msc_management', exam_set_code: '1142', booklet_code: null, max_question: 200,
    });
    expect(r.status).toBe('needs_review');
    expect(r.conflicts.some((c) => c.rule === 'year_conflict')).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(6); // strong agreement still recorded, promotion blocked
  });

  it('question-count mismatch beyond ±2 does not count', () => {
    const r = scorePairingEvidence({ ...keyMeta, max_question: 205, booklet_code: null }, paperMeta);
    expect(r.evidence.some((e) => e.rule === 'question_count_match')).toBe(false);
  });
});
