import { describe, expect, it } from 'vitest';
import {
  KONKOR_COURSE_SECTIONS,
  YEARLY_KONKOR_BOOKLETS,
} from '../data/yearlyKonkorExams';

describe('دفترچه ارشد مدیریت ۱۴۰۵ — کد ۱۱۴۲ / کنترل 319A', () => {
  const booklet = YEARLY_KONKOR_BOOKLETS.find((item) => item.year === 1405);

  it('دفترچه و مشخصات جلد از منبع تصویری ثبت شده‌اند', () => {
    expect(booklet).toBeDefined();
    expect(booklet?.bookletCode).toBe('319A');
    expect(booklet?.totalQuestionsInBooklet).toBe(285);
    expect(booklet?.durationMinutes).toBe(150);
  });

  it('تمام ۱۶ درس رسمی را بدون فاصله یا هم‌پوشانی پوشش می‌دهد', () => {
    expect(booklet).toBeDefined();
    if (!booklet) return;

    const ranges = booklet.subjectRanges;
    expect(ranges).toHaveLength(16);
    expect(ranges.map((range) => range.sectionId)).toEqual(
      KONKOR_COURSE_SECTIONS.map((section) => section.id),
    );

    expect(ranges[0].fromQuestion).toBe(1);
    for (let index = 0; index < ranges.length; index += 1) {
      const range = ranges[index];
      expect(range.count).toBe(range.toQuestion - range.fromQuestion + 1);
      expect(range.subjectNumber).toBe(index + 1);
      expect(range.subjectModelId).toBe(`master.1142.s${index + 1}`);
      expect(range.sourcePage).toBe(1);
      expect(range.coefficientsVerified).toBe(false);

      if (index > 0) {
        expect(range.fromQuestion).toBe(ranges[index - 1].toQuestion + 1);
      }
    }

    expect(ranges[ranges.length - 1].toQuestion).toBe(285);
    expect(ranges.reduce((total, range) => total + range.count, 0)).toBe(285);
  });

  it('برای درس‌هایی که گره دانش جامع ندارند، node حدسی نمی‌سازد', () => {
    const unmapped = KONKOR_COURSE_SECTIONS.filter((section) => section.defaultNodeId === null);
    expect(unmapped.map((section) => section.id)).toEqual([
      'public_finance',
      'human_resources',
      'financial_management',
      'investment_risk',
      'entrepreneurship',
      'accounting',
      'transportation',
      'business_transportation',
    ]);
  });
});
