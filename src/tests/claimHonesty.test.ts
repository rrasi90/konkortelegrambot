import { describe, it, expect } from 'vitest';
import {
  predictKonkorRankAndUniversity,
  RANK_MODEL_LIMITATIONS,
  RANK_PREDICTION_DISCLAIMER,
} from '../data/konkorRankPredictor';
import {
  CHAPTER_FREQUENCY_BASIS,
  CHAPTER_IMPORTANCE_LABEL,
} from '../data/bookChaptersTypes';

/**
 * این تست‌ها جلوی بازگشت ادعاهای «قبولی قطعی» و برچسب‌های گمراه‌کننده را می‌گیرند.
 */
describe('صداقت ادعاها در رابط کاربری', () => {
  it('هیچ آستانه‌ای «قبولی قطعی» یا درصد احتمال قبولی نمی‌دهد', () => {
    const result = predictKonkorRankAndUniversity({
      year: 1405,
      branch: 'business',
      degree: 'master',
      courseInputs: [
        { sectionId: 'management_theories', title: 'تئوری‌های مدیریت', coeff: 3, netPercent: 55 },
        { sectionId: 'marketing', title: 'بازاریابی', coeff: 4, netPercent: 50 },
        { sectionId: 'english', title: 'زبان', coeff: 3, netPercent: 40 },
      ] as never,
    });

    for (const admission of result.universityAdmissions) {
      expect(admission.status).not.toContain('قطعی');
      expect(admission.status).not.toContain('احتمال');
    }
  });

  it('خروجی شبیه‌ساز همیشه محدودیت‌های مدل و سطح اطمینان پایین را همراه دارد', () => {
    const result = predictKonkorRankAndUniversity({
      year: 1405,
      branch: 'business',
      degree: 'master',
      courseInputs: [
        { sectionId: 'management_theories', title: 'تئوری‌های مدیریت', coeff: 3, netPercent: 70 },
      ] as never,
    });

    expect(result.confidence).toBe('very_low');
    expect(result.modelLimitations.length).toBe(RANK_MODEL_LIMITATIONS.length);
    expect(result.modelLimitations.length).toBeGreaterThanOrEqual(4);
  });

  it('سلب مسئولیت صریحاً می‌گوید ابزار پیش‌بینی نیست', () => {
    expect(RANK_PREDICTION_DISCLAIMER).toContain('شبیه‌ساز');
    expect(RANK_PREDICTION_DISCLAIMER).toContain('نه پیش‌بینی');
    expect(RANK_PREDICTION_DISCLAIMER).toContain('اعتبارسنجی');
  });

  it('مبنای فراوانی فصل صریحاً ارشد است و دکتری را رد می‌کند', () => {
    expect(CHAPTER_FREQUENCY_BASIS).toContain('کارشناسی ارشد');
    expect(CHAPTER_FREQUENCY_BASIS).toContain('نه آزمون دکتری');
  });

  it('برچسب اهمیت فصل ادعای اهمیت دکتری نمی‌کند', () => {
    for (const label of Object.values(CHAPTER_IMPORTANCE_LABEL)) {
      expect(label).toContain('ارشد');
    }
  });
});
