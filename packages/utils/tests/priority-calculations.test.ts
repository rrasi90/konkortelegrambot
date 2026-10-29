import { describe, it, expect } from 'vitest';
import {
  calculateUrgency,
  calculateMasteryUrgency,
  calculateExamValue,
  calculateExpectedBenefit,
  calculateUrgencyV2,
} from '../priority-calculations';

describe('Priority Calculations', () => {
  describe('calculateUrgency', () => {
    it('returns higher urgency for overdue items than future items', () => {
      const now = new Date('2026-10-30T12:00:00Z');
      const overdueDate = new Date('2026-10-23T12:00:00Z'); // 7 days overdue
      const futureDate = new Date('2026-11-06T12:00:00Z');  // 7 days in future
      const dueDate = new Date('2026-10-30T12:00:00Z');     // due right now

      const overdueUrgency = calculateUrgency(overdueDate, '2026-10-01', now);
      const dueNowUrgency = calculateUrgency(dueDate, '2026-10-01', now);
      const futureUrgency = calculateUrgency(futureDate, '2026-10-01', now);

      expect(overdueUrgency).toBeGreaterThan(dueNowUrgency);
      expect(dueNowUrgency).toBeGreaterThan(futureUrgency);
      expect(dueNowUrgency).toBe(1.0);
    });
  });

  describe('calculateMasteryUrgency', () => {
    it('returns higher urgency for lower mastery', () => {
      const lowMastery = calculateMasteryUrgency(10);
      const midMastery = calculateMasteryUrgency(50);
      const highMastery = calculateMasteryUrgency(90);

      expect(lowMastery).toBeGreaterThan(midMastery);
      expect(midMastery).toBeGreaterThan(highMastery);
    });

    it('returns maximum urgency for zero mastery', () => {
      const zeroMastery = calculateMasteryUrgency(0);
      expect(zeroMastery).toBe(1.0);
    });

    it('returns 0 urgency for 100 mastery', () => {
      const perfectMastery = calculateMasteryUrgency(100);
      expect(perfectMastery).toBe(0);
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
  });

  describe('calculateUrgencyV2', () => {
    it('computes positive aggregate urgency', () => {
      const card = {
        intervalDays: 3,
        dueAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        nodeId: 'node-1',
      };
      const userState = {
        masteryMap: new Map([['node-1', 30]]),
      };

      const score = calculateUrgencyV2(card, userState);
      expect(score).toBeGreaterThan(0);
    });
  });
});
