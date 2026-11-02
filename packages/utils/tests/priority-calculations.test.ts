import { describe, it, expect } from 'vitest';
import {
  calculateExamValue,
  calculateExpectedBenefit,
  computePriorityV3,
  derivePrereqMultiplier,
  type PriorityInputsV3,
} from '../priority-calculations';

const BASE: PriorityInputsV3 = {
  examValue: 1.2,
  knowledgeGap01: 0.6,
  prereqMultiplier: 1.0,
  forgettingRisk: 0.3,
  examProximity01: 0.2,
  expectedBenefit: 1.0,
  minutes: 5,
};

const withOverrides = (overrides: Partial<PriorityInputsV3>): PriorityInputsV3 => ({
  ...BASE,
  ...overrides,
});

/** Sweep one input ascending; assert the non-decreasing sequence is actually increasing. */
function assertMonotonicIncreasing(pick: (v: number) => PriorityInputsV3, values: number[]) {
  const scores = values.map((v) => computePriorityV3(pick(v)));
  for (let i = 1; i < scores.length; i++) {
    expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
  }
  expect(scores[scores.length - 1]).toBeGreaterThan(scores[0]);
}

describe('computePriorityV3 — canonical priority (R-011)', () => {
  it('P1: monotonically increasing in examValue', () => {
    assertMonotonicIncreasing((v) => withOverrides({ examValue: v }), [0.2, 0.5, 1.0, 2.0]);
  });

  it('P2: monotonically increasing in knowledgeGap01', () => {
    assertMonotonicIncreasing((v) => withOverrides({ knowledgeGap01: v }), [0, 0.25, 0.5, 1.0]);
  });

  it('P3: monotonically increasing in prereqMultiplier', () => {
    assertMonotonicIncreasing((v) => withOverrides({ prereqMultiplier: v }), [0.2, 0.5, 1.0]);
  });

  it('P4: monotonically increasing in forgettingRisk (fixed the old inverted division)', () => {
    assertMonotonicIncreasing((v) => withOverrides({ forgettingRisk: v }), [0, 0.25, 0.5, 1.0]);
  });

  it('P5: monotonically increasing in examProximity01', () => {
    assertMonotonicIncreasing((v) => withOverrides({ examProximity01: v }), [0, 0.33, 0.66, 1]);
  });

  it('P6: monotonically increasing in expectedBenefit', () => {
    assertMonotonicIncreasing((v) => withOverrides({ expectedBenefit: v }), [0.4, 0.8, 1.2, 1.5]);
  });

  it('P7: monotonically decreasing in minutes', () => {
    const scores = [1, 3, 6, 12].map((m) => computePriorityV3(withOverrides({ minutes: m })));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
    expect(scores[scores.length - 1]).toBeLessThan(scores[0]);
  });

  it('P8: never negative and zero gap yields zero priority', () => {
    expect(computePriorityV3(withOverrides({ knowledgeGap01: 0 }))).toBe(0);
    expect(computePriorityV3(withOverrides({ examValue: -5, expectedBenefit: -3 }))).toBe(0);
    expect(computePriorityV3(withOverrides({ forgettingRisk: Number.NaN }))).toBeGreaterThan(0);
    const sweep = [-1, 0, 0.5, 2, Number.POSITIVE_INFINITY];
    for (const v of sweep) {
      const score = computePriorityV3(withOverrides({ knowledgeGap01: v, forgettingRisk: v }));
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
    }
  });

  it('clamps out-of-range 0..1 terms instead of trusting callers', () => {
    const over = computePriorityV3(withOverrides({ knowledgeGap01: 5, forgettingRisk: 9 }));
    const atCap = computePriorityV3(withOverrides({ knowledgeGap01: 1, forgettingRisk: 1 }));
    expect(over).toBe(atCap);
  });

  it('falls back to denominator 1 for missing or non-positive minutes', () => {
    expect(computePriorityV3(withOverrides({ minutes: 0 }))).toBe(
      computePriorityV3(withOverrides({ minutes: 1 })),
    );
    expect(computePriorityV3(withOverrides({ minutes: Number.NaN }))).toBe(
      computePriorityV3(withOverrides({ minutes: 1 })),
    );
  });

  it('omitted examProximity01 behaves as 0', () => {
    const without = { ...BASE };
    delete without.examProximity01;
    expect(computePriorityV3(without)).toBe(computePriorityV3(withOverrides({ examProximity01: 0 })));
  });

  it('deterministic: identical inputs give identical output', () => {
    expect(computePriorityV3(BASE)).toBe(computePriorityV3(BASE));
  });
});

describe('derivePrereqMultiplier', () => {
  it('1.0 with no gaps, 0.5 with exactly one, 0.2 with multiple (default threshold 60)', () => {
    expect(derivePrereqMultiplier([70, 85, 60])).toBe(1.0);
    expect(derivePrereqMultiplier([])).toBe(1.0);
    expect(derivePrereqMultiplier([59, 80, 90])).toBe(0.5);
    expect(derivePrereqMultiplier([10, 40, 90])).toBe(0.2);
  });

  it('honours a custom threshold', () => {
    expect(derivePrereqMultiplier([55], { threshold: 50 })).toBe(1.0);
    expect(derivePrereqMultiplier([55, 80], { threshold: 60 })).toBe(0.5);
  });
});

describe('calculateExamValue', () => {
  it('scales with pack weights and penalizes weak mastery with higher value to learn', () => {
    const userState = {
      examPackWeights: new Map([['q1', 1.5], ['q2', 0.8]]),
      masteryMap: new Map([['q1', 20], ['q2', 90]]),
    };

    const val1 = calculateExamValue('q1', userState);
    const val2 = calculateExamValue('q2', userState);

    expect(val1).toBeGreaterThan(val2);
  });

  it('is bounded to [0.5, 2.0] and uses the default weight for unknown items', () => {
    const userState = {
      examPackWeights: new Map<string, number>([['known', 99]]),
      masteryMap: new Map([['known', 0], ['unknown', 0]]),
    };
    expect(calculateExamValue('known', userState)).toBe(2.0);
    const unknown = calculateExamValue('unknown', userState);
    expect(unknown).toBeGreaterThanOrEqual(0.5);
    expect(unknown).toBeLessThanOrEqual(2.0);
  });

  it('decreases as mastery rises for a fixed weight', () => {
    const lowMastery = calculateExamValue('n', {
      examPackWeights: new Map([['n', 1]]),
      masteryMap: new Map([['n', 10]]),
    });
    const highMastery = calculateExamValue('n', {
      examPackWeights: new Map([['n', 1]]),
      masteryMap: new Map([['n', 90]]),
    });
    expect(lowMastery).toBeGreaterThan(highMastery);
  });
});

describe('calculateExpectedBenefit', () => {
  it('returns higher diagnostic benefit for low mastery', () => {
    const userStateLow = {
      masteryMap: new Map([['target', 10]]),
      evidenceLevel: 'none' as const,
    };
    const userStateHigh = {
      masteryMap: new Map([['target', 90]]),
      evidenceLevel: 'complete' as const,
    };

    const diagLow = calculateExpectedBenefit('diagnostic', userStateLow, 'target');
    const diagHigh = calculateExpectedBenefit('diagnostic', userStateHigh, 'target');

    expect(diagLow).toBeGreaterThan(diagHigh);
  });

  it('returns higher remedial benefit for low mastery', () => {
    const benefit = (mastery: number) =>
      calculateExpectedBenefit(
        'remedial',
        { masteryMap: new Map([['t', mastery]]), evidenceLevel: 'partial' as const },
        't',
      );
    expect(benefit(10)).toBeGreaterThan(benefit(80));
  });

  it('returns higher review benefit for high mastery', () => {
    const benefit = (mastery: number) =>
      calculateExpectedBenefit(
        'review',
        { masteryMap: new Map([['t', mastery]]), evidenceLevel: 'none' as const },
        't',
      );
    expect(benefit(80)).toBeGreaterThan(benefit(20));
  });

  it('scales proof benefit with evidence level', () => {
    const proof = (evidenceLevel: 'none' | 'partial' | 'complete' | 'certified') =>
      calculateExpectedBenefit(
        'proof',
        { masteryMap: new Map([['t', 50]]), evidenceLevel },
        't',
      );
    expect(proof('partial')).toBeGreaterThan(proof('none'));
    expect(proof('complete')).toBeGreaterThan(proof('partial'));
    expect(proof('certified')).toBeGreaterThan(proof('complete'));
  });

  it('keeps every activity type within [0.5, 1.5]', () => {
    for (const activityType of ['review', 'diagnostic', 'remedial', 'proof', 'exam'] as const) {
      for (const mastery of [0, 50, 100]) {
        const value = calculateExpectedBenefit(
          activityType,
          { masteryMap: new Map([['t', mastery]]), evidenceLevel: 'certified' },
          't',
        );
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(1.5);
      }
    }
  });
});
