import { describe, expect, it } from 'vitest';
import { stemHash, stemSimilarity } from '../../scripts/ael-question-dedup.mjs';
import { validateMergedKeyRow, validateMergeSummary, ALLOWED_PROVENANCE } from '../../scripts/ael-recovery-contract.mjs';

/**
 * AEL Phase-8/11 — cross-year matching + recovery contract tests
 * (synthetic fixtures only, no exam text).
 */
describe('cross-year matching helpers', () => {
  it('identical stem+options produce identical content hashes', () => {
    const opts = [{ label: '1', text: 'alpha' }, { label: '2', text: 'beta' }];
    expect(stemHash('What is X?', opts)).toBe(stemHash('what is x ?', opts));
    expect(stemHash('What is X?', opts)).toBe(stemHash('What is X?', [{ label: '2', text: 'beta' }, { label: '1', text: 'alpha' }]));
  });

  it('option order does not change the hash, option content does', () => {
    const a = stemHash('q', [{ label: '1', text: 'alpha' }, { label: '2', text: 'beta' }]);
    const b = stemHash('q', [{ label: '1', text: 'alpha' }, { label: '2', text: 'gamma' }]);
    expect(a).not.toBe(b);
  });

  it('Persian digits and bidi marks are normalized before hashing', () => {
    expect(stemHash('سوال ۳۲؟', [])).toBe(stemHash('\u200fسوال 32؟\u200e', []));
  });

  it('similarity: identical → 1, unrelated → low, ≥0.92 threshold separates near-duplicates', () => {
    expect(stemSimilarity('The manager decided to postpone the meeting today', 'The manager decided to postpone the meeting today')).toBe(1);
    expect(stemSimilarity('The manager decided to postpone the meeting today', 'the manager decided to postpone the meeting today!')).toBeGreaterThanOrEqual(0.92);
    expect(stemSimilarity('انباشت سرمایه و رشد اقتصادی', 'مدیریت زمان و بهره‌وری فردی')).toBeLessThan(0.5);
  });
});

describe('recovery merge contracts — no-fabrication gates', () => {
  it('accepts a well-formed gap-fill row', () => {
    const r = validateMergedKeyRow({ question_number: 155, correct_option: 3, provenance: 'text_layer_gap_fill' });
    expect(r.ok).toBe(true);
  });

  it('rejects unknown provenance and out-of-range values', () => {
    const bad = validateMergedKeyRow({ question_number: 500, correct_option: 7, provenance: 'invented' });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(' ')).toContain('provenance');
  });

  it('disputed rows must carry sme_required', () => {
    const bad = validateMergedKeyRow({ question_number: 10, correct_option: 2, provenance: 'ocr', disputed_option_text_layer: 1 });
    expect(bad.ok).toBe(false);
    const good = validateMergedKeyRow({ question_number: 10, correct_option: 2, provenance: 'ocr', disputed_option_text_layer: 1, review: 'sme_required' });
    expect(good.ok).toBe(true);
  });

  it('gap-fill rows cannot double as out-of-range suspects', () => {
    const r = validateMergedKeyRow({ question_number: 400, correct_option: 1, provenance: 'text_layer_gap_fill', review: 'out_of_range_suspect' });
    expect(r.ok).toBe(false);
  });

  it('merge summary holes must equal span minus normal entries', () => {
    const ok = validateMergeSummary([
      { source_id: 'a', merged: 285, span: 285, holes_in_span: 0, suspect_ocr_only: 0, disputed: 0 },
      { source_id: 'b', merged: 293, span: 399, holes_in_span: 106, suspect_ocr_only: 8, disputed: 0 },
    ]);
    expect(ok.ok).toBe(true);
    const bad = validateMergeSummary([{ source_id: 'c', merged: 100, span: 200, holes_in_span: 50, suspect_ocr_only: 0, disputed: 0 }]);
    expect(bad.ok).toBe(false);
  });

  it('provenance enum is stable', () => {
    expect(ALLOWED_PROVENANCE).toEqual(['ocr', 'ocr+text_layer_agree', 'text_layer_gap_fill']);
  });
});
