/**
 * V3-022..027 — تست کاتالوگ، ingestion و coverage (مأموریت v5 §6)
 * با fixture گزارش‌شدهٔ کنکور گروه ریاضی (HR-01) — بدون جعل دادهٔ رسمی.
 */
import { describe, expect, it } from 'vitest';
import {
  computeObservedCoverage,
  ingestCatalogEntries,
  normalizePersianSubjectName,
  validateAdmissionRoute,
  validateSubjectCoefficient,
  type SubjectCoefficient,
} from '@ael/contracts';

describe('V3-022 admission routes (سه محور مستقل — مدل canonical exam-family)', () => {
  it('reported route passes; official_verified without a primary source fails', () => {
    // fixture گزارش‌شدهٔ کنکور گروه ریاضی (HR-01) — هرگز official تلقی نمی‌شود:
    const math = { routeCode: 'konkur-bachelor-math-group1', familyCode: null, nameFa: 'کنکور کارشناسی — گروه ریاضی (گروه ۱)', assessmentMode: 'written' as const, status: 'reported' as const, sourceIds: ['src.konkur.1405.secondary'], notes: null };
    expect(validateAdmissionRoute(math).ok).toBe(true);
    const noSource = { ...math, routeCode: 'route-no-source', status: 'official_verified' as const, sourceIds: [] };
    const v = validateAdmissionRoute(noSource);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.code === 'missing_source_reference')).toBe(true);
  });
});

describe('V3-024 materials and coefficients (Unknown ≠ Zero, HD-03)', () => {
  const base: SubjectCoefficient = {
    subjectId: 'sub.stats', title: 'آمار و روش تحقیق', coefficient: 2,
    valueState: 'positive', evidenceStatus: 'reported', scope: { examYear: 1405, setLabel: 'مدیریت ۱۱۴۲' },
  };
  it('positive reported coefficient passes', () => {
    expect(validateSubjectCoefficient(base)).toEqual([]);
  });
  it('unknown must be null, not zero', () => {
    expect(validateSubjectCoefficient({ ...base, valueState: 'unknown', coefficient: null })).toEqual([]);
    expect(validateSubjectCoefficient({ ...base, valueState: 'unknown', coefficient: 0 }).some((e) => e.includes('null'))).toBe(true);
  });
  it('official zero requires a primary source document', () => {
    expect(validateSubjectCoefficient({ ...base, valueState: 'zero_official', coefficient: 0, evidenceStatus: 'official_verified' })).toEqual([]);
    expect(validateSubjectCoefficient({ ...base, valueState: 'zero_official', coefficient: 0, evidenceStatus: 'reported' }).some((e) => e.includes('سند اولیه'))).toBe(true);
  });
});

describe('V3-026 idempotent ingestion', () => {
  interface RouteRow { id: string; evidenceStatus: string; }
  const entryKey = (e: RouteRow) => e.id;
  const validate = (e: RouteRow) => e.evidenceStatus === 'official_verified' && true ? [] : [];
  const valid: RouteRow = { id: 'route.konkur.bachelor.math', evidenceStatus: 'reported' };
  it('first ingest applies; repeating the same input adds nothing', () => {
    const first = ingestCatalogEntries([valid], [], entryKey, validate);
    expect(first.applied.length).toBe(1);
    expect(first.quarantined.length).toBe(0);
    const second = ingestCatalogEntries([valid], [valid], entryKey, validate);
    expect(second.applied.length).toBe(0);
    expect(second.skippedDuplicates.length).toBe(1);
    // تکرار داخل خود batch هم idempotent است:
    const dup = ingestCatalogEntries([valid, { ...valid }], [], entryKey, validate);
    expect(dup.applied.length).toBe(1);
    expect(dup.skippedDuplicates.length).toBe(1);
  });
  it('invalid entries are quarantined and never enter the active catalog', () => {
    const invalid = { ...valid, id: '' }; // id خالی = نامعتبر
    const result = ingestCatalogEntries([invalid], [], entryKey, (e) => (e.id.trim() ? [] : ['id الزامی است']));
    expect(result.applied.length).toBe(0);
    expect(result.quarantined[0].entry.id).toBe('');
    expect(result.quarantined[0].reason).toContain('الزامی');
  });
});

describe('V3-027 observed coverage (never presented as official)', () => {
  it('ratio only when the denominator is defensible; missing/unknown stay independent', () => {
    const official = computeObservedCoverage(12, 8, 2, 0, { kind: 'official_verified', total: 20, sourceId: 'src.booklet.1405' });
    expect(official.observedRatio).toBe(0.6);
    expect(official.unknown).toBe(2);
    const noDenominator = computeObservedCoverage(12, 8, 2, 0, null);
    expect(noDenominator.observedRatio).toBeNull(); // بدون مخرج، درصد جعل نمی‌شود
  });
});

describe('V3-025 Persian subject alias normalization (original preserved)', () => {
  it('normalizes Arabic yeh/keh/alef variants and ZWNJ for matching only', () => {
    expect(normalizePersianSubjectName('رفتار سازماني')).toBe(normalizePersianSubjectName('رفتار سازمانی'));
    expect(normalizePersianSubjectName('مديريت منابع‌انساني')).toBe(normalizePersianSubjectName('مدیریت منابع انسانی'));
    // متن اصلی (raw) هرگز توسط نرمال‌سازی تغییر نمی‌کند — normalized فقط برای تطبیق:
    expect(normalizePersianSubjectName('رفتار  سازماني')).toContain(' ');
  });
});
