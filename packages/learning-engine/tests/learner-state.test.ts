import { describe, expect, it } from 'vitest';
import { estimateRetrievability, updateLearnerSkillState } from '../src/learner-state';

const now = new Date('2026-10-29T12:00:00.000Z');
const base = {
  skillId: 'skill.alpha',
  wasCorrect: false,
  seenBefore: false,
  isHoldout: false,
  now,
};

describe('evidence-based learner state', () => {
  it('does not turn one wrong response into a proficiency penalty or confirmed gap', () => {
    const state = updateLearnerSkillState(base);
    expect(state.proficiencyProbability).toBe(0.5);
    expect(state.assessedGapEvidenceCount).toBe(0);
    expect(state.evidenceCount).toBe(0);
    expect(state.coverageState).toBe('unseen');
  });

  it('counts correct evidence only for previously unseen questions', () => {
    const fresh = updateLearnerSkillState({ ...base, wasCorrect: true });
    const repeated = updateLearnerSkillState({ ...base, wasCorrect: true, seenBefore: true });
    expect(fresh.correctEvidenceCount).toBe(1);
    expect(fresh.proficiencyProbability).toBeGreaterThan(0.5);
    expect(repeated.correctEvidenceCount).toBe(0);
  });

  it('requires an explicit diagnosis before counting a conceptual gap', () => {
    const wrong = updateLearnerSkillState(base);
    const slip = updateLearnerSkillState({ ...base, previous: wrong, diagnosedErrorType: 'slip' });
    const conceptual = updateLearnerSkillState({ ...base, previous: wrong, diagnosedErrorType: 'conceptual' });
    expect(slip.assessedGapEvidenceCount).toBe(0);
    expect(conceptual.assessedGapEvidenceCount).toBe(1);
    expect(conceptual.proficiencyProbability).toBeLessThan(0.5);
    expect(conceptual.coverageState).toBe('diagnosed');
  });

  it('requires an unseen holdout item for verification coverage', () => {
    const proof = updateLearnerSkillState({ ...base, wasCorrect: true, isHoldout: true });
    expect(proof.coverageState).toBe('verified_by_unseen');
    const repeated = updateLearnerSkillState({ ...base, wasCorrect: true, seenBefore: true, isHoldout: true });
    expect(repeated.coverageState).toBe('unseen');
  });

  it('estimates memory retrievability from FSRS stability and elapsed time', () => {
    const state = {
      due: now.toISOString(), stability: 10, difficulty: 5, elapsed_days: 5, scheduled_days: 5,
      reps: 2, lapses: 0, state: 2, last_review: new Date(now.getTime() - 10 * 86_400_000).toISOString(),
    };
    const retrieval = estimateRetrievability(state, now);
    expect(retrieval).toBeGreaterThan(0);
    expect(retrieval).toBeLessThan(1);
    expect(estimateRetrievability(state, new Date(now.getTime() + 20 * 86_400_000))).toBeLessThan(retrieval);
  });
});
