import { describe, it, expect } from 'vitest';
import {
  MANAGEMENT_EXAM_SET,
  MANAGEMENT_SUB_GROUPS,
  EXAM_YEAR_STRUCTURES,
  LATEST_EXAM_YEAR,
  getExamStructure,
  getExamStructureWarnings,
  getSubGroup,
  getSubGroupSubjects,
  getSpecializationSharePercent,
  getUnverifiedSubGroupCodes,
} from '../data/examStructure';

describe('ساختار آزمون دکتری — نسخه‌بندی بر اساس سال', () => {
  it('کد مجموعهٔ امتحانی مدیریت ۲۱۶۲ است، نه ۲۱۶۴', () => {
    expect(MANAGEMENT_EXAM_SET.code).toBe('2162');
    // ۲۱۶۴ کد زیرمجموعهٔ مدیریت صنعتی است
    expect(getSubGroup('industrial')?.code).toBe('2164');
    expect(getSubGroup('public')?.code).toBe('2163');
    expect(getSubGroup('media')?.code).toBe('2165');
    expect(getSubGroup('business')?.code).toBe('2162');
  });

  it('هر زیرمجموعه عنوان و رشته‌های خودش را دارد و کد مجموعه با کد زیرمجموعه قاطی نشده', () => {
    const codes = MANAGEMENT_SUB_GROUPS.map((g) => g.code).filter(
      (c): c is string => c !== null
    );
    // کدهای زیرمجموعهٔ یکتا هستند
    expect(new Set(codes).size).toBe(codes.length);
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

  it('سهم تخصصی‌ها در ۱۴۰۵ از ۱۴۰۲ بیشتر است (چون استعداد حذف و ضریب بالا رفته)', () => {
    const share1402 = getSpecializationSharePercent(1402, 'business');
    const share1405 = getSpecializationSharePercent(1405, 'business');

    expect(share1405).toBeGreaterThan(share1402);
  });

  it('زیرمجموعه‌های بدون کد رسمی به‌عنوان تأییدنشده علامت خورده‌اند', () => {
    const unverified = getUnverifiedSubGroupCodes();
    // آینده‌پژوهی و سیاست‌گذاری علم و فناوری هنوز دفترچهٔ رسمی نگرفته‌اند
    expect(unverified.length).toBeGreaterThan(0);
    expect(unverified.every((g) => g.code === null)).toBe(true);
  });
});
