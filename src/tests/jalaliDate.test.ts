import { describe, it, expect } from 'vitest';
import { jalaliToIso, gregorianToJalaliFromIso, isLeapJalali, isValidJalaliDate, daysUntilExam, formatJalaliFa, validateExamDate } from '../utils/jalali';

describe('jalali', () => {
  it('Nowruz 1404-01-01 => 2025-03-21', () => {
    expect(jalaliToIso(1404, 1, 1)).toBe('2025-03-21');
  });
  it('roundtrip', () => {
    expect(gregorianToJalaliFromIso('2025-03-21')).toEqual({ jy: 1404, jm: 1, jd: 1 });
  });
  it('Esfand leap: 1403 leap (30 days), 1404 29', () => {
    expect(isLeapJalali(1403)).toBe(true);
    expect(isLeapJalali(1404)).toBe(false);
    expect(isValidJalaliDate(1403, 12, 30)).toBe(true);
    expect(isValidJalaliDate(1404, 12, 30)).toBe(false);
  });
  it('invalid month/day rejected', () => {
    expect(jalaliToIso(1404, 13, 1)).toBeNull();
    expect(jalaliToIso(1404, 1, 32)).toBeNull();
    expect(gregorianToJalaliFromIso('2025-99-99')).toBeNull();
  });
  it('daysUntilExam is timezone-safe (components)', () => {
    expect(daysUntilExam('2026-11-08', '2026-11-08')).toBe(0);
    expect(daysUntilExam('2026-11-09', '2026-11-08')).toBe(1);
    expect(daysUntilExam('2026-11-07', '2026-11-08')).toBe(-1);
  });
  it('formatFa', () => {
    expect(formatJalaliFa('2025-03-21')).toContain('۱۴۰۴');
  });
  it('validate', () => {
    expect(validateExamDate('2026-11-07', '2026-11-08').reason).toBe('past');
    expect(validateExamDate('bad', '2026-11-08').reason).toBe('invalid');
  });
  it('legacy gregorian preserved: 2025-12-31 => jalali', () => {
    const j = gregorianToJalaliFromIso('2025-12-31');
    expect(j?.jy).toBe(1404);
  });
});
