import { describe, it, expect } from 'vitest';
import {
  computeEvidenceMastery,
  planNextActivities,
  scheduleDueCards,
  computeTargetWeights,
  specializationSharePercent,
  readinessLabel,
  assertReadinessCopyClean,
} from '@ael/engine';

describe('V2-073 mastery', () => {
  it('empty evidence is insufficient, not 50', () => {
    expect(computeEvidenceMastery([])).toEqual({ mastery: 0, evidenceCount: 0, proven: false, insufficient: true });
  });
  it('proven requires proof + >=85', () => {
    expect(computeEvidenceMastery([
      { wasCorrect: true, evidenceKind: 'proof' },
      { wasCorrect: true, evidenceKind: 'practice' },
      { wasCorrect: true, evidenceKind: 'practice' },
    ]).proven).toBe(true);
  });
  it('practice-only never proven', () => {
    expect(computeEvidenceMastery([
      { wasCorrect: true, evidenceKind: 'practice' },
      { wasCorrect: true, evidenceKind: 'practice' },
      { wasCorrect: true, evidenceKind: 'practice' },
    ]).proven).toBe(false);
  });
});

describe('V2-074 planner', () => {
  it('respects budget deterministically', () => {
    const out = planNextActivities([
      { id: 'a', estimatedMinutes: 5, urgency: 1 },
      { id: 'b', estimatedMinutes: 10, urgency: 2 },
    ], 10);
    expect(out.map(x => x.id)).toEqual(['b']);
  });
  it('ties break by id', () => {
    const out = planNextActivities([
      { id: 'b', estimatedMinutes: 1, urgency: 1 },
      { id: 'a', estimatedMinutes: 1, urgency: 1 },
    ], 2);
    expect(out.map(x => x.id)).toEqual(['a', 'b']);
  });
});

describe('V2-075 scheduler', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  it('repairs first, then oldest due', () => {
    const out = scheduleDueCards([
      { id: 'x', dueAt: '2026-11-07T00:00:00Z', intervalDays: 1, isRepair: false },
      { id: 'y', dueAt: '2026-11-07T00:00:00Z', intervalDays: 1, isRepair: true },
    ], now, 2);
    expect(out.map(c => c.id)).toEqual(['y', 'x']);
  });
});

describe('V2-076 target-weights', () => {
  it('5/1/null => 83% specialization', () => {
    expect(specializationSharePercent({ specialization: 5, language: 1, aptitude: null })).toBe(83);
  });
  it('null share when total 0', () => {
    expect(specializationSharePercent({ specialization: null, language: null, aptitude: null })).toBeNull();
  });
});

describe('V2-080 readiness-copy', () => {
  it('labels without rank claim', () => {
    expect(readinessLabel('high')).toContain('رتبه یا تراز نیست');
  });
  it('rejects forbidden claims', () => {
    expect(() => assertReadinessCopyClean('پوشش ۱۰۰٪ کنکور')).toThrow('forbidden phrase');
  });
});
