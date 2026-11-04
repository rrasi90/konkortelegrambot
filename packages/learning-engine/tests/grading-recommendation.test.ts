import { describe, expect, it } from 'vitest';
import { recommendNextActivity, recordEssayEvaluation } from '../src/formative-quiz';

describe('EX-06 — تصحیح انسانی تشریحی', () => {
  const pending = { id: 'stat.center.essay01', status: 'pending', kind: 'essay' };

  it('پاسخ در انتظار با مصحح و زمان «ارزیابی‌شده» می‌شود و نتیجهٔ درست/غلط نمی‌گیرد', () => {
    const result = recordEssayEvaluation(pending, { graderId: 'sme-1', verdict: 'acceptable', score: 85 }, 1_700_000_000_000);
    expect(result.status).toBe('evaluated');
    expect(result.evaluation).toMatchObject({ graderId: 'sme-1', verdict: 'acceptable', score: 85, version: 1 });
    expect(result.status).not.toBe('correct');
    expect(result.status).not.toBe('incorrect');
  });

  it('MCQ یا پاسخ غیر در انتظار قابل تصحیح نیست', () => {
    expect(() => recordEssayEvaluation({ id: 'x', status: 'correct' }, { graderId: 'sme-1', verdict: 'acceptable' }))
      .toThrow(/فقط پاسخ تشریحی/);
    expect(() => recordEssayEvaluation({ id: 'y', status: 'evaluated', kind: 'essay' }, { graderId: 'sme-1', verdict: 'acceptable' }))
      .toThrow(/فقط پاسخ تشریحی/);
  });

  it('بدون مصحح و با نمرهٔ خارج از بازه رد می‌شود (AT-18: سوابق مصحح محفوظ)', () => {
    expect(() => recordEssayEvaluation(pending, { graderId: '', verdict: 'acceptable' })).toThrow(/مصحح/);
    expect(() => recordEssayEvaluation(pending, { graderId: 'sme-1', verdict: 'acceptable', score: 150 })).toThrow(/۰ تا ۱۰۰/);
    expect(() => recordEssayEvaluation(pending, { graderId: 'sme-1', verdict: 'perfect' as never })).toThrow(/قابل قبول|نیاز به مرور/);
  });
});

describe('LEARN-03 — پیشنهاد توضیح‌پذیر', () => {
  it('ترتیب پیش‌فرض: غلط دارای مقصد ← موعددار ← خوانده‌نشده', () => {
    const suggestions = recommendNextActivity({
      wrongs: [{ topicId: 'fm.tvm', destination: 'fm.tvm.block-2', count: 2 }],
      dueReviews: [{ id: 'q.1', topicId: 'fm.bonds' }],
      unreadReady: ['fm.wacc'],
    }, 20);
    expect(suggestions.map((s) => s.kind)).toEqual(['remediate', 'review', 'study']);
    expect(suggestions[0].reason).toContain('2 پاسخ نادرست');
  });

  it('بودجهٔ ۵ دقیقه فقط یک فعالیت می‌دهد؛ بدون مقصد، حدس علت نمی‌زند', () => {
    const only = recommendNextActivity({ wrongs: [{ topicId: 'fm.tvm', destination: null }] }, 5);
    expect(only).toHaveLength(0); // غلط بدون مقصد تأییدشده → پیشنهاد علت داده نمی‌شود
    const five = recommendNextActivity({
      wrongs: [{ topicId: 'a', destination: 'a.b' }], dueReviews: [{ id: 'q' }], unreadReady: ['c'],
    }, 5);
    expect(five).toHaveLength(1);
    expect(five[0].kind).toBe('remediate');
  });

  it('دادهٔ کم → حالت «اطلاعات ناکافی» با انتخاب آزاد', () => {
    const suggestions = recommendNextActivity({}, 10);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].reason).toContain('اطلاعات ناکافی');
  });
});
