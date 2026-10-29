import { describe, expect, it } from 'vitest';
import { buildDailyPlan, scorePlanCandidate, type PlanCandidate } from '../src/planner';

const candidate = (id: string, actionType: PlanCandidate['actionType'], estimatedMinutes: number, scoreFactors = {}): PlanCandidate => ({
  id,
  targetId: id,
  actionType,
  estimatedMinutes,
  examValue: 1,
  expectedBenefit: 1,
  urgency: 1,
  ...scoreFactors,
});

describe('daily budget planner', () => {
  it('uses the documented value-benefit-urgency per-minute heuristic', () => {
    expect(scorePlanCandidate(candidate('a', 'new_material', 4, { examValue: 0.8, expectedBenefit: 0.5, urgency: 0.5 }))).toBeCloseTo(0.05);
  });

  it('never exceeds daily minutes or the item cap', () => {
    const plan = buildDailyPlan([
      candidate('new-a', 'new_material', 5),
      candidate('review-a', 'spaced_review', 4),
      candidate('review-b', 'spaced_review', 4),
      candidate('new-b', 'new_material', 5),
    ], { dailyMinutes: 10, maxItems: 2 });
    expect(plan.usedMinutes).toBeLessThanOrEqual(10);
    expect(plan.selected.length).toBeLessThanOrEqual(2);
  });

  it('reserves new material when eligible candidates and budget allow it', () => {
    const plan = buildDailyPlan([
      candidate('review-a', 'spaced_review', 5, { urgency: 1 }),
      candidate('review-b', 'spaced_review', 5, { urgency: 0.9 }),
      candidate('new-a', 'new_material', 5, { expectedBenefit: 0.2 }),
      candidate('new-b', 'new_material', 5, { expectedBenefit: 0.2 }),
    ], { dailyMinutes: 20, minimumNewMaterialShare: 0.25 });
    expect(plan.newMaterialMinutes).toBeGreaterThanOrEqual(5);
  });

  it('caps remediation burden instead of silently swallowing the entire day', () => {
    const plan = buildDailyPlan([
      candidate('diagnose-a', 'diagnostic_probe', 3),
      candidate('repair-a', 'remediation', 3),
      candidate('new-a', 'new_material', 3),
      candidate('review-a', 'spaced_review', 3),
    ], { dailyMinutes: 10, maximumRemediationShare: 0.4 });
    expect(plan.remediationMinutes).toBeLessThanOrEqual(4);
    expect(plan.selected.some((row) => row.actionType === 'new_material')).toBe(true);
  });

  it('deduplicates candidates by stable id and validates normalized inputs', () => {
    const plan = buildDailyPlan([
      candidate('same', 'new_material', 3),
      candidate('same', 'new_material', 3),
    ], { dailyMinutes: 5 });
    expect(plan.selected.filter((row) => row.id === 'same')).toHaveLength(1);
    expect(() => buildDailyPlan([candidate('bad', 'new_material', 1, { examValue: 2 })], { dailyMinutes: 5 })).toThrow();
  });
});
