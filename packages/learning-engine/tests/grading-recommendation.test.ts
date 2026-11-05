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

describe('AEL-BASE-02 — مقاوم‌سازی recommendNextActivity', () => {
  it('آرایه‌های خالی صریح = حالت دادهٔ کم', () => {
    const empty = recommendNextActivity({ wrongs: [], dueReviews: [], unreadReady: [] }, 20);
    expect(empty).toHaveLength(1);
    expect(empty[0].reason).toContain('اطلاعات ناکافی');
  });

  it('مقصد نامعتبر (رشتهٔ خالی) همانند نبود مقصد است؛ null و undefined هم', () => {
    const invalid = recommendNextActivity({
      wrongs: [
        { topicId: 'a', destination: '' },
        { topicId: 'b', destination: null },
        { topicId: 'c', destination: undefined as unknown as string },
      ],
    }, 20);
    expect(invalid).toHaveLength(0);
  });

  it('count منفی/صفر به حداقل ۱ محدود می‌شود و عدد غلط ساختگی نمی‌سازد', () => {
    const zero = recommendNextActivity({ wrongs: [{ topicId: 'a', destination: 'a.b', count: 0 }] }, 5);
    expect(zero[0].reason).toContain('1 پاسخ نادرست');
    const negative = recommendNextActivity({ wrongs: [{ topicId: 'a', destination: 'a.b', count: -3 }] }, 5);
    expect(negative[0].reason).toContain('1 پاسخ نادرست');
    expect(negative[0].reason).not.toContain('-3');
  });

  it('تساوی countها: اولین عنصر ورودی انتخاب می‌شود (ترتیب پایدار)', () => {
    const tie = recommendNextActivity({
      wrongs: [
        { topicId: 'x', destination: 'x.block-1', count: 2 },
        { topicId: 'y', destination: 'y.block-2', count: 2 },
      ],
    }, 5);
    expect(tie[0].target).toBe('x.block-1');
    const reversed = recommendNextActivity({
      wrongs: [
        { topicId: 'y', destination: 'y.block-2', count: 2 },
        { topicId: 'x', destination: 'x.block-1', count: 2 },
      ],
    }, 5);
    expect(reversed[0].target).toBe('y.block-2');
  });

  it('count بالاتر غالب می‌شود؛ تعادل between با بالاترین شمار', () => {
    const dominated = recommendNextActivity({
      wrongs: [
        { topicId: 'x', destination: 'x.block-1', count: 1 },
        { topicId: 'y', destination: 'y.block-2', count: 4 },
      ],
    }, 5);
    expect(dominated[0].target).toBe('y.block-2');
    expect(dominated[0].reason).toContain('4');
  });

  it('بودجه‌های ۵/۱۰/۲۰ دقیقه: ۱/۲/۳ فعالیت', () => {
    const full = {
      wrongs: [{ topicId: 'a', destination: 'a.b', count: 2 }],
      dueReviews: [{ id: 'q.1' }, { id: 'q.2' }],
      unreadReady: ['c', 'd'],
    };
    expect(recommendNextActivity(full, 5)).toHaveLength(1);
    expect(recommendNextActivity(full, 10)).toHaveLength(2);
    expect(recommendNextActivity(full, 20)).toHaveLength(3);
  });

  it('ترتیب پایدار خروجی: remediate ← review ← study', () => {
    const ordered = recommendNextActivity({
      wrongs: [{ topicId: 'a', destination: 'a.b' }],
      dueReviews: [{ id: 'q.1' }],
      unreadReady: ['c'],
    }, 20);
    expect(ordered.map((s) => s.kind)).toEqual(['remediate', 'review', 'study']);
  });

  it('مقصد null در میان مقصدهای معتبر: فقط معتبرها وارد رقابت می‌شوند', () => {
    const mixed = recommendNextActivity({
      wrongs: [
        { topicId: 'bad', destination: null, count: 9 },
        { topicId: 'good', destination: 'good.block', count: 1 },
      ],
    }, 5);
    expect(mixed[0].target).toBe('good.block');
  });
});
