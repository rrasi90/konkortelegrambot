import { describe, expect, it } from 'vitest';
import { classifyDocument, extractExamYearFromText } from '../import/pdf/classify.mjs';
import { pairPapersAndKeys } from '../import/pdf/pair-answer-keys.mjs';
import { normalizePersian } from '../import/normalize.mjs';

/**
 * AEL-313/316 — تست‌های قرارداد با Fixture مصنوعی (هیچ PDF واقعی در Git — سند §10.1).
 */

describe('AEL-308 نرمال‌سازی — Raw حفظ، Projection جدا', () => {
  it('ی/ک عربی و ارقام در Projection نرمال می‌شوند', () => {
    expect(normalizePersian('كتاب مديريت ۱۴۰۴')).toBe('کتاب مدیریت 1404');
  });
  it('بومی bidi control حذف ولی معنا تغییر نمی‌کند', () => {
    expect(normalizePersian('سؤال\u200f تست')).toBe('سؤال تست');
  });
});

describe('AEL-313 Classification با Evidence (سند §6 Stage 2/3)', () => {
  it('کلید از متن جلد تشخیص داده می‌شود — نه فقط نام فایل', () => {
    const pages = [{ pageNumber: 1, text: 'مشاهده کلید سوالات آزمون کارشناسی ارشد سال 1392' }];
    const result = classifyDocument('file123.pdf', pages);
    expect(result.document_type).toBe('answer_key');
    expect(result.classification_status).toBe('classified');
    expect(result.exam_year.value).toBe(1392);
    expect(result.exam_year.status).toBe('proposed');
    expect(result.exam_year.evidence[0].pdf_page).toBe(1);
    expect(result.exam_year.evidence[0].quote).toContain('1392');
  });

  it('سال از نام فایل حدس زده نمی‌شود — unknown معتبر است', () => {
    const result = classifyDocument('1390-paper.pdf', [{ pageNumber: 1, text: 'متن بدون سال آزمون' }]);
    expect(result.exam_year.status).toBe('unknown');
    expect(result.exam_year.value).toBeNull();
  });

  it('سال متعارض در صفحات = ambiguous نه حدس', () => {
    const pages = [
      { pageNumber: 1, text: 'آزمون سال 1403' },
      { pageNumber: 2, text: 'آزمون سال 1404' },
    ];
    const result = classifyDocument('x.pdf', pages);
    expect(result.exam_year.status).toBe('ambiguous');
    expect(result.exam_year.value).toBeNull();
  });

  it('سال چاپ ≠ سال آزمون — فقط الگوی آزمون/کنکور پذیرفته می‌شود', () => {
    const pages = [{ pageNumber: 1, text: 'چاپ 1395 از کتاب' }];
    const result = classifyDocument('x.pdf', pages);
    expect(result.exam_year.value).toBeNull();
  });

  it('نام فایل تنها نشانهٔ کمکی است — بدون متن هم unknown می‌ماند اگر امضایی نباشد', () => {
    const result = classifyDocument('random-name.pdf', [{ pageNumber: 1, text: '' }]);
    expect(result.document_type).toBe('unknown');
    expect(result.classification_status).toBe('needs_review');
  });
});

describe('AEL-313 Pairing چندشواهدی (سند §6 Stage 7)', () => {
  const mk = (sourceId: string, basename: string, year: number | null, type: string) => ({
    registry: { source_id: sourceId },
    basename,
    document_type: type,
    frontText: '',
    metadata: { exam_year: year === null ? { value: null, status: 'unknown' } : { value: year, status: 'proposed' } },
  });

  it('سال متفاوت = Blocker؛ حتی نام فایل مشابه Pair نمی‌شود (T: mismatch)', () => {
    const paper = mk('src-paper', 'دفترچه 1403.pdf', 1403, 'exam_paper');
    const key = mk('src-key', 'جواب 1404.pdf', 1404, 'answer_key');
    const pairs = pairPapersAndKeys([paper], [key]);
    expect(pairs[0].pairing_status).toBe('unresolved');
    expect(pairs[0].paired_document_id).toBeNull();
  });

  it('سال یکسان + مقطع سازگار = Pair با needs_review (۰.۷-۰.۸۹ طبق §10.6)', () => {
    const paper = { ...mk('src-paper-93', 'دفترچه 1393.pdf', 1393, 'exam_paper'), frontText: 'کنکور کارشناسی ارشد مجموعه مدیریت' };
    const key = { ...mk('src-key-93', 'جواب 1393.pdf', 1393, 'answer_key'), frontText: 'کلید سوالات آزمون کارشناسی ارشد' };
    const pairs = pairPapersAndKeys([paper], [key]);
    expect(pairs[0].paired_document_id).toBe('src-paper-93');
    expect(pairs[0].pairing_status).toBe('needs_review');
    expect(pairs[0].pair_candidates[0].evidence.some(row => row.rule === 'year_match')).toBe(true);
  });

  it('دو نامزد هم‌امتیاز = Pair خودکار انجام نمی‌شود (سند §6 Stage 7)', () => {
    const key = mk('src-key', 'جواب 1393.pdf', 1393, 'answer_key');
    const paperA = mk('src-paper-A', 'A.pdf', 1393, 'exam_paper');
    const paperB = mk('src-paper-B', 'B.pdf', 1393, 'exam_paper');
    const pairs = pairPapersAndKeys([paperA, paperB], [key]);
    expect(pairs[0].pairing_status).toBe('unresolved');
    expect(pairs[0].pair_candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('Score پایین (<0.70) = unresolved حتی بدون Blocker', () => {
    const key = { ...mk('src-key', 'k.pdf', null, 'answer_key'), frontText: '' };
    const paper = mk('src-paper', 'p.pdf', null, 'exam_paper');
    const pairs = pairPapersAndKeys([paper], [key]);
    expect(pairs[0].pairing_status).toBe('unresolved');
  });
});
