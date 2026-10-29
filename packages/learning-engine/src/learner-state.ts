/**
 * Evidence-based learner-state projection. This is a transparent initial heuristic,
 * not a calibrated psychometric model. In particular, an unanswered diagnostic or
 * an ordinary wrong answer never counts as a confirmed conceptual gap.
 */
import type {
  DominantErrorType,
  FSRSCardState,
  LearnerSkillState,
} from '@ael/contracts';

export interface LearnerEvidenceInput {
  skillId: string;
  previous?: LearnerSkillState | null;
  wasCorrect: boolean;
  seenBefore: boolean;
  isHoldout: boolean;
  responseTimeMs?: number;
  fsrsState?: FSRSCardState;
  diagnosedErrorType?: Exclude<DominantErrorType, 'unknown'> | 'unknown';
  now?: Date;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/** FSRS forgetting curve: R(t,S) = (1 + (19/81) * t/S)^(-0.5). */
export function estimateRetrievability(state: FSRSCardState | undefined, now = new Date()): number {
  if (!state || !Number.isFinite(state.stability) || state.stability <= 0 || !state.last_review) return 0.5;
  const lastReview = new Date(state.last_review).getTime();
  if (!Number.isFinite(lastReview)) return 0.5;
  const elapsedDays = Math.max(0, (now.getTime() - lastReview) / 86_400_000);
  return clamp01(Math.pow(1 + (19 / 81) * elapsedDays / state.stability, -0.5));
}

export function updateLearnerSkillState(input: LearnerEvidenceInput): LearnerSkillState {
  const now = input.now ?? new Date();
  const previous = input.previous;
  let correctEvidenceCount = previous?.correctEvidenceCount ?? 0;
  let assessedGapEvidenceCount = previous?.assessedGapEvidenceCount ?? 0;

  // A positive answer to an unseen question is classified positive evidence.
  // A wrong answer does not decrement proficiency until a diagnostic confirms a gap.
  if (input.wasCorrect && !input.seenBefore) correctEvidenceCount += 1;
  if (input.diagnosedErrorType && input.diagnosedErrorType !== 'slip' && input.diagnosedErrorType !== 'unknown') {
    assessedGapEvidenceCount += 1;
  }

  // Beta(2,2) prior: stable, interpretable baseline that avoids 0%/100% certainty.
  const alpha = 2 + correctEvidenceCount;
  const beta = 2 + assessedGapEvidenceCount;
  const proficiencyProbability = clamp01(alpha / (alpha + beta));
  const evidenceCount = correctEvidenceCount + assessedGapEvidenceCount;
  const estimateConfidence = clamp01(1 - Math.exp(-evidenceCount / 5));

  const responseSignal = input.responseTimeMs === undefined
    ? (previous?.fluencyScore ?? 0)
    : Math.exp(-Math.max(0, Math.min(input.responseTimeMs, 3_600_000)) / 30_000);
  const fluencyScore = input.responseTimeMs === undefined
    ? (previous?.fluencyScore ?? 0)
    : clamp01((previous?.fluencyScore ?? responseSignal) * 0.7 + responseSignal * 0.3);

  const dominantErrorType: DominantErrorType =
    input.diagnosedErrorType ?? previous?.dominantErrorType ?? 'unknown';
  let coverageState = previous?.coverageState ?? 'unseen';
  if (input.isHoldout && input.wasCorrect && !input.seenBefore) {
    coverageState = 'verified_by_unseen';
  } else if (input.diagnosedErrorType) {
    coverageState = 'diagnosed';
  } else if (coverageState === 'unseen' && previous) {
    coverageState = previous.coverageState;
  }

  return {
    skillId: input.skillId,
    proficiencyProbability,
    estimateConfidence,
    evidenceCount,
    correctEvidenceCount,
    assessedGapEvidenceCount,
    memoryRetrievability: estimateRetrievability(input.fsrsState, now),
    fluencyScore,
    dominantErrorType,
    coverageState,
    updatedAt: now.toISOString(),
  };
}
