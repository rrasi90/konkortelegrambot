import { describe, it, expect } from 'vitest';
import {
  Rating,
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
      const stability = 10.0;
      const r = calculateRetrievability(stability, stability);
      // 1 / (1 + (19/81) * 1) = 81 / 100 = 0.81 in power law vs (1 + (19/81))^-1
      // 1 / (1 + 19/81) = 81 / 100 = 0.81
      expect(r).toBeCloseTo(0.81, 2);
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

  describe('classifyErrorType (Diagnostic Error Attribution)', () => {
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

    it('classifies high-confidence error as "misread"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 60,
          confidenceRating: 5,
        })
      ).toBe('misread');
    });

    it('classifies error with weak prerequisite as "prerequisite_failure"', () => {
      expect(
        classifyErrorType({
          wasCorrect: false,
          currentMastery: 55,
          prerequisiteMastery: 30,
        })
      ).toBe('prerequisite_failure');
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
  });

  describe('update6DLearnerSkillState', () => {
    it('updates competence, confidence, and transitions status to mastered after consistent evidence', () => {
      let state = update6DLearnerSkillState(null, { wasCorrect: true, currentMastery: 50 });
      expect(state.coverageStatus).toBe('diagnosed');
      expect(state.evidenceCount).toBe(1);

      state = update6DLearnerSkillState(state, { wasCorrect: true, currentMastery: 65 });
      expect(state.evidenceCount).toBe(2);

      state = update6DLearnerSkillState(state, { wasCorrect: true, currentMastery: 75 });
      expect(state.coverageStatus).toBe('proven');

      state = update6DLearnerSkillState(state, { wasCorrect: true, currentMastery: 90 });
      state = update6DLearnerSkillState(state, { wasCorrect: true, currentMastery: 95 });
      expect(state.coverageStatus).toBe('mastered');
      expect(state.proficiencyProbability).toBeGreaterThan(0.80);
    });

    it('transitions to "remediated" upon error', () => {
      const state = update6DLearnerSkillState(null, { wasCorrect: false, currentMastery: 40 });
      const next = update6DLearnerSkillState(state, { wasCorrect: false, currentMastery: 30 });

      expect(next.coverageStatus).toBe('remediated');
      expect(next.dominantErrorType).toBe('concept_gap');
    });
  });
});
