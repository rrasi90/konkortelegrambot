import { describe, expect, it } from 'vitest';
import { importQuestionBatch, importReport, sha256Hex, structuralIssues } from '../import/pipeline.mjs';

const valid = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, prompt: 'صورت سؤال', choices: ['الف', 'ب', 'ج', 'د'], answerIndex: 0, rights: 'pending_review', ...overrides,
});

describe('SRC-03 — اعتبارسنجی ساختاری', () => {
  it('رکورد سالم ایراد ندارد', () => {
    expect(structuralIssues(valid('q.1'))).toEqual([]);
  });
  it('AT-05: گزینهٔ تکراری، کلید نامعتبر و حقوق ثبت‌نشده به قرنطینه می‌رود', () => {
    expect(structuralIssues(valid('q.1', { choices: ['الف', 'الف', 'ج', 'د'] }))).toContain('گزینه‌ها باید دقیقاً چهار مقدار یکتا باشند.');
    expect(structuralIssues(valid('q.1', { answerIndex: 5 }))).toContain('کلید (answerIndex) باید عددی ۰ تا ۳ باشد.');
    const noRights = { ...valid('q.1') } as Record<string, unknown>;
    delete noRights.rights;
    expect(structuralIssues(noRights).join(' ')).toContain('حقوق');
  });
});

describe('SRC-03 — ورود idempotent (AT-04)', () => {
  it('ورود مجدد همان بسته همه را duplicates می‌کند؛ رکورد تازه ساخته نمی‌شود', () => {
    const bank = new Set(['q.1', 'q.2']);
    const batch = [valid('q.1'), valid('q.3')];
    const first = importQuestionBatch(batch, bank);
    expect(first.accepted.map((r: { id: string }) => r.id)).toEqual(['q.3']);
    const second = importQuestionBatch(batch, new Set([...bank, 'q.3']));
    expect(second.accepted).toHaveLength(0);
    expect(second.duplicates.map((r: { id: string }) => r.id)).toEqual(['q.1', 'q.3']);
  });
  it('رکورد ناقص وارد قرنطینه می‌شود و بانک را آلوده نمی‌کند', () => {
    const result = importQuestionBatch([valid('q.1'), { id: 'q.bad', prompt: '' }], new Set());
    expect(result.accepted).toHaveLength(1);
    expect(result.quarantined).toHaveLength(1);
    expect(result.quarantined[0].reasons.length).toBeGreaterThan(0);
  });
  it('گزارش ورود شمار و هش محتوا را دارد و متن سؤال را حمل نمی‌کند', async () => {
    const result = importQuestionBatch([valid('q.1')], new Set());
    const hash = await sha256Hex(new TextEncoder().encode('fixture-bytes'));
    const report = importReport('sample.json', hash, result);
    expect(report.contentSha256).toHaveLength(64);
    expect(report.counts).toEqual({ accepted: 1, quarantined: 0, duplicates: 0 });
    expect(JSON.stringify(report)).not.toContain('صورت سؤال');
  });
});
