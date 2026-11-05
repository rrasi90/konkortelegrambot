import { describe, expect, it } from 'vitest';
import { findDuplicateCandidates, validateAnswerKeys } from '../src/analysis';

describe('AEL-405 — Duplicate Detection (AT-AEL-11)', () => {
  it('تکرار قطعی exact را می‌یابد و هیچ Merge خودکاری انجام نمی‌دهد', () => {
    const report = findDuplicateCandidates([
      { id: 'q1', prompt: 'سرمایه در گردش چیست؟' },
      { id: 'q2', prompt: 'سرمایه در گردش چیست؟' },
      { id: 'q3', prompt: 'تعریف NPV را بنویسید.' },
    ]);
    expect(report.exactGroups).toHaveLength(1);
    expect(report.exactGroups[0]!.ids.sort()).toEqual(['q1', 'q2']);
    expect(report.autoMergedCount).toBe(0);
  });

  it('نرمال‌سازی فارسی (نیم‌فاصله/ی/ک/ارقام) تکرار معنایی-متنی را می‌یابد', () => {
    const report = findDuplicateCandidates([
      { id: 'a', prompt: 'كاربرد NPV در بودجه‌بندی چیست؟' },
      { id: 'b', prompt: 'کاربرد NPV در بودجه بندی چیست؟' },
      { id: 'c', prompt: 'سؤال کاملاً متفاوت دیگر' },
    ]);
    expect(report.nearCandidates.some(group => group.kind === 'normalized' && group.ids.sort().join() === 'a,b')).toBe(true);
  });

  it('near-duplicate فقط «کاندید» است با شباهت زیر ۱', () => {
    const report = findDuplicateCandidates([
      { id: 'x', prompt: 'فرمول ارزش حالی جریان سالانه چه می‌شود و چرا؟' },
      { id: 'y', prompt: 'فرمول ارزش حالی جریان سالانه چه می‌شود و چگونه؟' },
    ], { nearThreshold: 0.8 });
    const near = report.nearCandidates.find(group => group.kind === 'near_candidate');
    expect(near).toBeDefined();
    expect(near!.similarity).toBeLessThan(1);
    expect(near!.similarity).toBeGreaterThanOrEqual(0.8);
  });

  it('دو عبارت متفاوت کاندید نمی‌شود', () => {
    const report = findDuplicateCandidates([
      { id: 'p', prompt: 'تعریف عرضه در اقتصاد خرد' },
      { id: 'q', prompt: 'محاسبهٔ نرخ تنزیل مؤثر سالانه' },
    ]);
    expect(report.exactGroups).toHaveLength(0);
    expect(report.nearCandidates).toHaveLength(0);
  });
});

describe('AEL-406 — Answer Key Validation (AT-AEL-12)', () => {
  it('کلید خارج از محدوده رد می‌شود', () => {
    const findings = validateAnswerKeys([{ id: 'q1', choices: ['الف', 'ب', 'ج', 'د'], answerIndex: 4 }]);
    expect(findings[0]!.code).toBe('ANSWER_OUT_OF_RANGE');
  });

  it('گزینهٔ تکراری را علامت می‌زند', () => {
    const findings = validateAnswerKeys([{ id: 'q2', choices: ['الف', 'الف', 'ج'], answerIndex: 0 }]);
    expect(findings[0]!.code).toBe('DUPLICATE_CHOICES');
  });

  it('اختلاف کلید ثبت‌شده با کلید منبع = ANSWER_KEY_CONFLICT (قرنطینه)', () => {
    const findings = validateAnswerKeys([{ id: 'q3', choices: ['الف', 'ب', 'ج', 'د'], answerIndex: 1, sourceAnswerIndex: 2 }]);
    expect(findings[0]!.code).toBe('ANSWER_KEY_CONFLICT');
    expect(findings[0]!.detail).toContain('بازبینی');
  });

  it('کلید سالم بدون یافته است', () => {
    const findings = validateAnswerKeys([{ id: 'q4', choices: ['الف', 'ب', 'ج', 'د'], answerIndex: 2, sourceAnswerIndex: 2 }]);
    expect(findings).toHaveLength(0);
  });
});
