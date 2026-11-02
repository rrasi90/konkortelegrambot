import { describe, it, expect } from 'vitest';
import {
  MANAGEMENT_EXAM_SET,
  MANAGEMENT_SUB_GROUPS,
  MANAGEMENT_EXAM_COMBINATIONS,
  MANAGEMENT_COURSE_BUNDLES,
  EXAM_YEAR_STRUCTURES,
  LATEST_EXAM_YEAR,
  getExamStructure,
  getExamStructureWarnings,
  getSubGroupSubjects,
  getSpecializationSharePercent,
  getUnverifiedSubGroupCodes,
  getCombination,
  getCombinationsForSubGroup,
} from '../data/examStructure';

describe('ساختار آزمون دکتری — نسخه‌بندی بر اساس سال', () => {
  it('کد مجموعهٔ امتحانی مدیریت ۲۱۶۲ است و هیچ زیرمجموعه‌ای بی‌سند آن را یا کد دیگری ادعا نمی‌کند (R-001)', () => {
    expect(MANAGEMENT_EXAM_SET.code).toBe('2162');
    // تا مستند رسمی (کارنامه/دفترچه) موجود نباشد، کد زیرمجموعه ثبت نمی‌شود
    for (const group of MANAGEMENT_SUB_GROUPS) {
      expect(group.code).toBeNull();
      expect(group.verification).toBe('needs_check');
    }
  });

  it('کد ترکیب ۱ تا ۷ مجزا از کد مجموعه است و بسته‌های معتبر دارد', () => {
    const codes = MANAGEMENT_EXAM_COMBINATIONS.map((k) => k.combinationCode);
    expect(new Set(codes).size).toBe(codes.length);
    for (const combo of MANAGEMENT_EXAM_COMBINATIONS) {
      expect(combo.combinationCode).not.toBe(MANAGEMENT_EXAM_SET.code);
      expect(combo.combinationCode).toMatch(/^[1-7]$/);
      // بستهٔ ۱ (زبان) در همهٔ ترکیب‌های ۱۴۰۵ علامت خورده است
      expect(combo.bundleNumbers).toContain('1');
      for (const bundle of combo.bundleNumbers) {
        expect(MANAGEMENT_COURSE_BUNDLES[bundle], `bundle ${bundle}`).toBeDefined();
      }
    }
  });

  it('هر زیرمجموعه به ترکیب(های) موجود نگاشت می‌شود', () => {
    for (const group of MANAGEMENT_SUB_GROUPS) {
      const combos = getCombinationsForSubGroup(group.id);
      expect(combos.length, group.id).toBeGreaterThan(0);
    }
    expect(getCombination('3')?.bundleNumbers).toEqual(['1', '2', '5']);
    expect(getCombination('8')).toBeUndefined();
  });

  it('تا ۱۴۰۴ استعداد تحصیلی با ضریب ۱ برگزار می‌شد', () => {
    for (const year of [1400, 1402, 1403, 1404]) {
      const s = getExamStructure(year);
      expect(s.hasAptitude).toBe(true);
      expect(s.aptitudeCoefficient).toBe(1);
    }
  });

  it('از ۱۴۰۵ استعداد تحصیلی حذف و ضریب تخصصی ۵ شده است', () => {
    const s = getExamStructure(1405);
    expect(s.hasAptitude).toBe(false);
    expect(s.aptitudeCoefficient).toBeNull();
    expect(s.specializationCoefficient).toBe(5);
    expect(s.languageCoefficient).toBe(1);
  });

  it('الگوی آزمون قدیمی به داوطلب ۱۴۰۵ نسبت داده نمی‌شود', () => {
    const old = getExamStructure(1402);
    const current = getExamStructure(1405);

    expect(old.specializationCoefficient).not.toBe(current.specializationCoefficient);
    expect(old.hasAptitude).not.toBe(current.hasAptitude);
    expect(current.changes.length).toBeGreaterThan(0);
  });

  it('همهٔ سال‌های پشتیبانی‌شده ساختار دارند و آخرین سال حداقل ۱۴۰۵ است', () => {
    expect(LATEST_EXAM_YEAR).toBeGreaterThanOrEqual(1405);
    for (const year of Object.keys(EXAM_YEAR_STRUCTURES).map(Number)) {
      expect(EXAM_YEAR_STRUCTURES[year].year).toBe(year);
      expect(EXAM_YEAR_STRUCTURES[year].source.length).toBeGreaterThan(10);
    }
  });

  it('سال نامعلوم به نزدیک‌ترین ساختار قبل از خودش برمی‌گردد', () => {
    expect(getExamStructure(1410).specializationCoefficient).toBe(
      getExamStructure(LATEST_EXAM_YEAR).specializationCoefficient
    );
    expect(getExamStructure(1380).specializationCoefficient).toBe(
      getExamStructure(1395).specializationCoefficient
    );
  });

  it('هشدار حذف استعداد فقط برای سال‌های بدون استعداد نمایش داده می‌شود', () => {
    const w1402 = getExamStructureWarnings(1402).join(' ');
    const w1405 = getExamStructureWarnings(1405).join(' ');

    expect(w1402).not.toContain('استعداد تحصیلی» از مواد امتحانی حذف');
    expect(w1405).toContain('استعداد تحصیلی');
    expect(w1405).toContain('حذف');
  });

  it('هر زیرمجموعه درس تخصصی و مجموع ضریب معتبر دارد', () => {
    for (const group of MANAGEMENT_SUB_GROUPS) {
      const subjects = getSubGroupSubjects(group.id);
      expect(subjects.length).toBeGreaterThan(0);
      expect(subjects.every((s) => s.title.length > 3)).toBe(true);

      const share = getSpecializationSharePercent(1405, group.id);
      expect(share).toBeGreaterThan(0);
      expect(share).toBeLessThanOrEqual(100);
    }
  });

  it('ضریب ۵ به کل بستهٔ تخصصی تعلق دارد، نه به تعداد درس‌های داخل بسته', () => {
    expect(getCoefficientTotal(1405, 'business')).toBe(6);
    expect(getSpecializationSharePercent(1405, 'business')).toBe(83);
    expect(getCoefficientTotal(1402, 'business')).toBe(6);
    expect(getSpecializationSharePercent(1402, 'business')).toBe(67);
  });

  it('زیرمجموعه‌های بدون کد رسمی به‌عنوان تأییدنشده علامت خورده‌اند', () => {
    const unverified = getUnverifiedSubGroupCodes();
    // آینده‌پژوهی و سیاست‌گذاری علم و فناوری هنوز دفترچهٔ رسمی نگرفته‌اند
    expect(unverified.length).toBeGreaterThan(0);
    expect(unverified.every((g) => g.code === null)).toBe(true);
  });
});
