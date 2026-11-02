import { describe, it, expect } from 'vitest';
import {
  Rating,
  FSRS_DECAY,
  FSRS_FACTOR,
  calculateRetrievability,
  calculateNextInterval,
  initializeFSRSState,
  scheduleNextFSRS,
  classifyErrorType,
  update6DLearnerSkillState,
} from '../src/fsrs';

describe('FSRS Memory Model & 6D Learner State Engine', () => {
  describe('calculateRetrievability', () => {
    it('returns 1.0 immediately upon review (0 days elapsed)', () => {
      expect(calculateRetrievability(5.0, 0)).toBe(1.0);
    });

    it('returns exactly 0.90 at elapsed time equal to stability (R(S, S) = 0.90)', () => {
      // This is the definition of stability in FSRS: the interval at which recall
      // probability decays to 90%. (1 + 19/81)^(-0.5) = (100/81)^(-0.5) = 9/10.
      const stability = 10.0;
      expect(calculateRetrievability(stability, stability)).toBeCloseTo(0.9, 6);
      expect(calculateRetrievability(4.0, 4.0)).toBeCloseTo(0.9, 6);
      expect(calculateRetrievability(120.0, 120.0)).toBeCloseTo(0.9, 6);
    });

    it('follows the FSRS power curve, not a hyperbolic curve', () => {
      // Half a stability later the true value is (1 + 19/162)^-0.5 ≈ 0.9465,
      // whereas the old 1/(1+factor*t/S) form gave ≈ 0.8949.
      expect(calculateRetrievability(10.0, 5.0)).toBeCloseTo(0.9465, 3);
      // Twice the stability: (1 + 38/81)^-0.5 = 9/sqrt(119) ≈ 0.8250
      expect(calculateRetrievability(10.0, 20.0)).toBeCloseTo(0.825, 3);
    });

    it('monotonically decays as time passes', () => {
      const stability = 10.0;
      const r1 = calculateRetrievability(stability, 1);
      const r5 = calculateRetrievability(stability, 5);
      const r20 = calculateRetrievability(stability, 20);

      expect(r1).toBeGreaterThan(r5);
      expect(r5).toBeGreaterThan(r20);
    });
  });

  describe('calculateNextInterval', () => {
    it('increases interval with higher stability', () => {
      const iSmall = calculateNextInterval(2.0, 0.90);
      const iLarge = calculateNextInterval(20.0, 0.90);

      expect(iLarge).toBeGreaterThan(iSmall);
      expect(iSmall).toBeGreaterThanOrEqual(1);
    });

    it('is the exact inverse of the forgetting curve at every target retention', () => {
      const stability = 30.0;
      for (const target of [0.8, 0.85, 0.9, 0.95]) {
        const interval = calculateNextInterval(stability, target);
        // Feed the interval back through R(t, S) and land on the requested retention.
        expect(calculateRetrievability(stability, interval)).toBeCloseTo(target, 2);
      }
    });

    it('schedules at exactly the stability when target retention is the FSRS default 0.90', () => {
      expect(calculateNextInterval(1.0, 0.9)).toBe(1);
      expect(calculateNextInterval(10.0, 0.9)).toBe(10);
      expect(calculateNextInterval(90.0, 0.9)).toBe(90);
    });

    it('shortens the interval as requested retention rises', () => {
      const stability = 40.0;
      const i80 = calculateNextInterval(stability, 0.8);
      const i85 = calculateNextInterval(stability, 0.85);
      const i90 = calculateNextInterval(stability, 0.9);
      const i95 = calculateNextInterval(stability, 0.95);

      expect(i80).toBeGreaterThan(i85);
      expect(i85).toBeGreaterThan(i90);
      expect(i90).toBeGreaterThan(i95);
    });

    it('keeps the documented constants consistent', () => {
      // FACTOR and DECAY must satisfy R(S, S) = 0.9 together.
      expect(Math.pow(1 + FSRS_FACTOR, FSRS_DECAY)).toBeCloseTo(0.9, 10);
    });
  });

  describe('FSRS State Transition', () => {
    it('initializes higher stability for Good/Easy than Again/Hard', () => {
      const now = new Date('2026-10-30T10:00:00Z');
      const againState = initializeFSRSState(Rating.Again, now);
      const goodState = initializeFSRSState(Rating.Good, now);
      const easyState = initializeFSRSState(Rating.Easy, now);

      expect(goodState.stability).toBeGreaterThan(againState.stability);
      expect(easyState.stability).toBeGreaterThan(goodState.stability);
      expect(againState.lapses).toBe(1);
      expect(goodState.reps).toBe(1);
    });

    it('advances stability on successful consecutive recall', () => {
      const day0 = new Date('2026-10-30T10:00:00Z');
      const state0 = initializeFSRSState(Rating.Good, day0);

      const day3 = new Date('2026-11-02T10:00:00Z');
      const state1 = scheduleNextFSRS(state0, Rating.Good, day3);

      expect(state1.stability).toBeGreaterThan(state0.stability);
      expect(state1.reps).toBe(2);
      expect(state1.intervalDays).toBeGreaterThan(state0.intervalDays);
    });

    it('penalizes stability and increments lapses on forgetting (Rating.Again)', () => {
      const day0 = new Date('2026-10-30T10:00:00Z');
      const state0 = initializeFSRSState(Rating.Good, day0);

      const day10 = new Date('2026-11-09T10:00:00Z');
      const stateLapse = scheduleNextFSRS(state0, Rating.Again, day10);

      expect(stateLapse.lapses).toBe(1);
      expect(stateLapse.stability).toBeLessThanOrEqual(state0.stability);
      expect(stateLapse.intervalDays).toBeLessThanOrEqual(state0.intervalDays);
    });
  });

  describe('classifyErrorType (§8.6 — ده علت خطا با قواعد صریح)', () => {
    it('returns "none" on correct answer', () => {
      expect(classifyErrorType({ wasCorrect: true, currentMastery: 80 })).toBe('none');
    });

    it('classifies fast error on high mastery as "slip"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 85,
          responseTimeMs: 15_000,
          expectedTimeMs: 60_000,
        })
      ).toBe('slip');
    });

    it('self-reported slip is slip regardless of other signals', () => {
      expect(
        classifyErrorType({ wasCorrect: false, currentMastery: 20, isSlip: true })
      ).toBe('slip');
    });

    it('classifies very slow answer as "time_pressure"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 40,
          responseTimeMs: 100_000,
          expectedTimeMs: 60_000,
        })
      ).toBe('time_pressure');
    });

    it('classifies high-mastery/low-retrievability as "recall_failure"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 80,
          memoryRetrievability: 0.5,
        })
      ).toBe('recall_failure');
    });

    it('classifies trap-note error with weak confusable sibling as "theory_confusion"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 55,
          trapNote: 'خلط مدل هرسبرگ با منتزکیو',
          siblingMasteries: [70, 40],
        })
      ).toBe('theory_confusion');
    });

    it('classifies trap-note error without sibling evidence as "misconception"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 45,
          trapNote: 'دام انحرافی گزینهٔ ۳',
        })
      ).toBe('misconception');
    });

    it('classifies wrong answer on calculation question as "calculation_error"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 55,
          requiresCalculation: true,
          responseTimeMs: 50_000,
          expectedTimeMs: 60_000,
        })
      ).toBe('calculation_error');
    });

    it('classifies max-confidence wrong answer as "reading_error"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 60,
          confidenceRating: 5,
        })
      ).toBe('reading_error');
    });

    it('classifies min-confidence wrong answer as "guessing"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 60,
          confidenceRating: 1,
        })
      ).toBe('guessing');
    });

    it('classifies error with weak prerequisite as "knowledge_gap"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 55,
          prerequisiteMastery: 30,
        })
      ).toBe('knowledge_gap');
    });

    it('classifies low-mastery error as "concept_gap"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 25,
          prerequisiteMastery: 70,
        })
      ).toBe('concept_gap');
    });

    it('returns "unknown" when evidence is insufficient — هر خطا ضعف قطعی فصل نیست', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 70,
          prerequisiteMastery: 80,
        })
      ).toBe('unknown');
    });

    it('ده علت همگی مقدار متمایز تولید می‌کنند (پوشش کامل §8.6)', () => {
      const causes = new Set([
        classifyErrorType({ wasCorrect: false, currentMastery: 85, responseTimeMs: 10_000, expectedTimeMs: 60_000 }),
        classifyErrorType({ wasCorrect: false, currentMastery: 40, responseTimeMs: 100_000, expectedTimeMs: 60_000 }),
        classifyErrorType({ wasCorrect: false, currentMastery: 80, memoryRetrievability: 0.5 }),
        classifyErrorType({ wasCorrect: false, currentMastery: 55, trapNote: 'دام', siblingMasteries: [40] }),
        classifyErrorType({ wasCorrect: false, currentMastery: 45, trapNote: "دام" }),
        classifyErrorType({ wasCorrect: false, currentMastery: 55, requiresCalculation: true, responseTimeMs: 50_000, expectedTimeMs: 60_000 }),
        classifyErrorType({ wasCorrect: false, currentMastery: 60, confidenceRating: 5 }),
        classifyErrorType({ wasCorrect: false, currentMastery: 60, confidenceRating: 1 }),
        classifyErrorType({ wasCorrect: false, currentMastery: 55, prerequisiteMastery: 30 }),
        classifyErrorType({ wasCorrect: false, currentMastery: 25, prerequisiteMastery: 70 }),
      ]);
      expect(causes.size).toBe(10);
    });
  });

  describe('update6DLearnerSkillState', () => {
    it('§8.2: توالی تمرین به‌تنهایی هرگز proven/mastered نمی‌سازد — فقط needs_proof', () => {
      let state = update6DLearnerSkillState(null, { wasCorrect: true, currentMastery: 50 });
      expect(state.coverageStatus).toBe('diagnosed');
      expect(state.evidenceCount).toBe(1);

      state = update6DLearnerSkillState(state, { wasCorrect: true, currentMastery: 65 });
      expect(state.evidenceCount).toBe(2);

      for (const m of [75, 90, 95, 97, 98]) {
        state = update6DLearnerSkillState(state, { wasCorrect: true, currentMastery: m });
        expect(['learning', 'needs_proof']).toContain(state.coverageStatus);
        expect(state.coverageStatus).not.toBe('proven');
        expect(state.coverageStatus).not.toBe('mastered');
      }
      expect(state.proficiencyProbability).toBeGreaterThan(0.80);
    });

    it('§8.2: پاسخ درستِ هولدآوت (attemptType=proof) تنها مسیر به proven است', () => {
      let state = update6DLearnerSkillState(null, { wasCorrect: true, currentMastery: 40 });
      state = update6DLearnerSkillState(state, { wasCorrect: true, currentMastery: 55 }, undefined, {
        attemptType: 'proof',
      });
      expect(state.coverageStatus).toBe('proven');
      expect(state.provenViaHoldout).toBe(true);
      // پس از اثبات، پاسخ غلطِ تمرینی هم وضعیت اثبات‌شده را از بین نمی‌برد
      state = update6DLearnerSkillState(state, { wasCorrect: false, currentMastery: 60 });
      expect(state.provenViaHoldout).toBe(true);
      expect(state.coverageStatus).toBe('proven');
    });

    it('§8.2: تلاش اثباتِ غلط proven نمی‌سازد', () => {
      const state = update6DLearnerSkillState(null, { wasCorrect: false, currentMastery: 70 }, undefined, {
        attemptType: 'proof',
      });
      expect(state.provenViaHoldout === true).toBe(false);
      expect(state.coverageStatus).not.toBe('proven');
    });

    it('§8.2: خوداظهاری اطمینان (confidenceRating) شایستگی را تغییر نمی‌دهد', () => {
      const withSelfConfidence = update6DLearnerSkillState(null, {
        wasCorrect: true,
        currentMastery: 50,
        confidenceRating: 5,
      });
      const without = update6DLearnerSkillState(null, { wasCorrect: true, currentMastery: 50 });
      expect(withSelfConfidence.proficiencyProbability).toBe(without.proficiencyProbability);

      const seeded = update6DLearnerSkillState(null, { wasCorrect: true, currentMastery: 50 });
      const slipWrong = update6DLearnerSkillState(seeded, {
        wasCorrect: false,
        currentMastery: 80,
        isSlip: true,
      });
      const plain = update6DLearnerSkillState(seeded, { wasCorrect: false, currentMastery: 80 });
      expect(slipWrong.proficiencyProbability).toBe(seeded.proficiencyProbability); // بدون کسر
      expect(plain.proficiencyProbability).toBeLessThan(seeded.proficiencyProbability);
    });

    it('§8.2: اطمینان با چگالی شاهد و تنوع نوع تلاش رشد می‌کند', () => {
      const t0 = '2026-11-01T12:00:00Z';
      const one = update6DLearnerSkillState(null, { wasCorrect: true, currentMastery: 50 }, undefined, {
        attemptType: 'practice',
        answeredAt: t0,
        now: t0,
      });
      const twoSameKind = update6DLearnerSkillState(one, { wasCorrect: true, currentMastery: 60 }, undefined, {
        attemptType: 'practice',
        answeredAt: t0,
        now: t0,
      });
      expect(twoSameKind.confidence).toBeGreaterThan(one.confidence);

      const twoVaried = update6DLearnerSkillState(one, { wasCorrect: true, currentMastery: 60 }, undefined, {
        attemptType: 'diagnostic',
        answeredAt: t0,
        now: t0,
      });
      expect(twoVaried.confidence).toBeGreaterThan(twoSameKind.confidence);
      expect(twoVaried.distinctAttemptTypes).toEqual(['practice', 'diagnostic']);
    });

    it('§8.2: اطمینان با کهنگی شاهد کاهش می‌یابد', () => {
      const old = '2026-06-01T12:00:00Z';
      const fresh = update6DLearnerSkillState(null, { wasCorrect: true, currentMastery: 50 }, undefined, {
        attemptType: 'practice',
        answeredAt: old,
        now: old,
      });
      const stale = update6DLearnerSkillState(null, { wasCorrect: true, currentMastery: 50 }, undefined, {
        attemptType: 'practice',
        answeredAt: old,
        now: '2026-11-01T12:00:00Z',
      });
      expect(stale.confidence).toBeLessThan(fresh.confidence);
    });

    it('transitions to "remediated" upon error', () => {
      const state = update6DLearnerSkillState(null, { wasCorrect: false, currentMastery: 40 });
      const next = update6DLearnerSkillState(state, { wasCorrect: false, currentMastery: 30 });

      expect(next.coverageStatus).toBe('remediated');
      expect(next.dominantErrorType).toBe('concept_gap');
    });
  });
});
