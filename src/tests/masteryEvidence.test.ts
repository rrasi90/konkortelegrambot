import { describe, it, expect } from 'vitest';
import { nextMasteryAfterCorrectAnswer } from '../engine/aelEngine';

/**
 * تسلط باید فقط از شاهد عملکردی (پاسخ مستقل به سؤال) بیاید.
 * این تست‌ها جلوی بازگشت ایرادهای زیر را می‌گیرند:
 *   ۱. جهش ۰ → ۵۵ با یک پاسخ درست.
 *   ۲. بزرگ‌تر شدن رشد با «اعتمادبه‌نفس بالا» (که در امضای تابع اصلاً وجود ندارد).
 */
describe('mastery evidence — تسلط فقط از پاسخ درست', () => {
  it('یک پاسخ درست از صفر، جهش بزرگ نمی‌سازد', () => {
    const after = nextMasteryAfterCorrectAnswer(0, 'practice');

    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(20);
  });

  it('رشد با بالا رفتن تسلط کوچک‌تر می‌شود (بازدهی نزولی)', () => {
    const low = nextMasteryAfterCorrectAnswer(0) - 0;
    const mid = nextMasteryAfterCorrectAnswer(50) - 50;
    const high = nextMasteryAfterCorrectAnswer(85) - 85;

    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(0);
  });

  it('تسلط هرگز از ۱۰۰ بیشتر نمی‌شود', () => {
    expect(nextMasteryAfterCorrectAnswer(99)).toBeLessThanOrEqual(100);
    expect(nextMasteryAfterCorrectAnswer(100)).toBe(100);
    expect(nextMasteryAfterCorrectAnswer(97)).toBeLessThanOrEqual(100);
  });

  it('از تسلط منفی محافظت می‌کند', () => {
    expect(nextMasteryAfterCorrectAnswer(-20)).toBeLessThanOrEqual(20);
  });

  it('رسیدن به آستانهٔ ۷۵ برای «نیاز به اثبات» حداقل چند شاهد مستقل می‌خواهد', () => {
    let mastery = 0;
    let answers = 0;
    while (mastery < 75 && answers < 50) {
      mastery = nextMasteryAfterCorrectAnswer(mastery);
      answers += 1;
    }

    expect(mastery).toBeGreaterThanOrEqual(75);
    expect(answers).toBeGreaterThanOrEqual(5);
  });

  it('سؤال اثبات (proof) ارزش اطلاعاتی بیشتری از تمرین معمولی دارد', () => {
    const practice = nextMasteryAfterCorrectAnswer(40, 'practice');
    const proof = nextMasteryAfterCorrectAnswer(40, 'proof');

    expect(proof).toBeGreaterThan(practice);
    // اما حتی سؤال اثبات هم جهش بزرگ نمی‌سازد
    expect(proof - 40).toBeLessThanOrEqual(25);
  });
});
