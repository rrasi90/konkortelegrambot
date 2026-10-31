/**
 * Free Spaced Repetition Scheduler (FSRS) Core Algorithm & 6D Learner State Modeling
 * Implements the DSR (Difficulty, Stability, Retrievability) memory model.
 */

export const Rating = {
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4,
} as const;

export type Rating = (typeof Rating)[keyof typeof Rating];

/** Standard FSRS default parameter weights (calibrated for academic multiple-choice) */
export const DEFAULT_FSRS_WEIGHTS = [
  0.4,  // w[0]: initial stability for Rating.Again
  1.2,  // w[1]: initial stability for Rating.Hard
  3.2,  // w[2]: initial stability for Rating.Good
  8.0,  // w[3]: initial stability for Rating.Easy
  4.93, // w[4]: initial difficulty base
  0.94, // w[5]: initial difficulty scaling
  0.86, // w[6]: difficulty step per rating delta
  0.01, // w[7]: difficulty mean-reversion factor
  1.49, // w[8]: stability recall exponent
  0.14, // w[9]: stability power decay
  0.94, // w[10]: retrievability factor in stability increase
  2.18, // w[11]: stability forget base
  0.05, // w[12]: forget difficulty power
  0.34, // w[13]: forget stability power
  1.26, // w[14]: retrievability impact on forget
  0.29, // w[15]: hard rating penalty multiplier
  2.61, // w[16]: easy rating bonus multiplier
] as const;

/** Retention factor constant: 19 / 81 ensures R(S, S) = 0.90 */
export const FSRS_FACTOR = 19 / 81;

function getW(w: readonly number[], index: number): number {
  return w[index] ?? (DEFAULT_FSRS_WEIGHTS as readonly number[])[index] ?? 1.0;
}
 // ~0.2345679

export interface FSRSState {
  stability: number;       // S: days until retrievability drops to 90%
  difficulty: number;      // D: intrinsic difficulty, scale 1.0 to 10.0
  retrievability: number;  // R: current probability of recall (0.0 to 1.0)
  reps: number;            // Total successful reviews
  lapses: number;          // Total forgetting events
  lastReviewedAt: string;  // ISO timestamp of last review
  dueAt: string;           // ISO timestamp of next scheduled review
  intervalDays: number;    // Scheduled interval in days
}

export interface FSRSConfig {
  weights?: readonly number[];
  requestedRetention?: number; // Target retention probability (default: 0.90)
  maximumInterval?: number;    // Interval cap in days (default: 365)
}

/** Compute retrievability R(t, S) = (1 + FACTOR * (t / S))^(-1) */
export function calculateRetrievability(stability: number, daysElapsed: number): number {
  if (stability <= 0) return 0;
  if (daysElapsed <= 0) return 1.0;
  // The 19/81 factor is calibrated for the power-law curve R(S, S) = 0.90.
  return Math.max(0, Math.min(1.0, Math.pow(1 + FSRS_FACTOR * (daysElapsed / stability), -0.5)));
}

/** Calculate interval in days for a given stability and target retention */
export function calculateNextInterval(
  stability: number,
  requestedRetention = 0.90,
  maximumInterval = 365
): number {
  const target = Math.max(0.70, Math.min(0.98, requestedRetention));
  // Invert R(t, S) = (1 + FACTOR * t / S)^(-1/2) for the target retention.
  const rawInterval = stability * (1 / (target * target) - 1) / FSRS_FACTOR;
  return Math.max(1, Math.min(maximumInterval, Math.round(rawInterval)));
}

/** Initialize FSRS state for a brand-new card */
export function initializeFSRSState(
  rating: Rating,
  reviewDate: Date = new Date(),
  config: FSRSConfig = {}
): FSRSState {
  const w = config.weights ?? DEFAULT_FSRS_WEIGHTS;
  const targetRetention = config.requestedRetention ?? 0.90;
  const maxInterval = config.maximumInterval ?? 365;

  // Initial stability: w[rating - 1]
  const initialStability = Math.max(0.1, getW(w, rating - 1));

  // Initial difficulty: clamp(w[4] - exp(w[5] * (rating - 1)) + 1, 1, 10)
  const rawDifficulty = getW(w, 4) - Math.exp(getW(w, 5) * (rating - 1)) + 1;
  const initialDifficulty = Math.max(1.0, Math.min(10.0, rawDifficulty));

  const intervalDays = calculateNextInterval(initialStability, targetRetention, maxInterval);
  const nextDueDate = new Date(reviewDate.getTime() + intervalDays * 86_400_000);

  return {
    stability: initialStability,
    difficulty: initialDifficulty,
    retrievability: 1.0,
    reps: rating === Rating.Again ? 0 : 1,
    lapses: rating === Rating.Again ? 1 : 0,
    lastReviewedAt: reviewDate.toISOString(),
    dueAt: nextDueDate.toISOString(),
    intervalDays,
  };
}

/** Update FSRS state on subsequent review (DSR transition) */
export function scheduleNextFSRS(
  currentState: FSRSState,
  rating: Rating,
  reviewDate: Date = new Date(),
  config: FSRSConfig = {}
): FSRSState {
  const w = config.weights ?? DEFAULT_FSRS_WEIGHTS;
  const targetRetention = config.requestedRetention ?? 0.90;
  const maxInterval = config.maximumInterval ?? 365;

  const lastReviewTime = new Date(currentState.lastReviewedAt).getTime();
  const elapsedDays = Math.max(0, (reviewDate.getTime() - lastReviewTime) / 86_400_000);

  const currentR = calculateRetrievability(currentState.stability, elapsedDays);
  const D = currentState.difficulty;
  const S = currentState.stability;

  // 1. Next Difficulty: mean-reversion towards D0(3)
  const d0Good = getW(w, 4) - Math.exp(getW(w, 5) * 2) + 1;
  const deltaD = -getW(w, 6) * (rating - 3);
  const rawNextD = getW(w, 7) * d0Good + (1 - getW(w, 7)) * (D + deltaD);
  const nextD = Math.max(1.0, Math.min(10.0, rawNextD));

  // 2. Next Stability
  let nextS: number;
  let nextReps = currentState.reps;
  let nextLapses = currentState.lapses;

  if (rating === Rating.Again) {
    // Forgetting event (lapse)
    nextLapses += 1;
    // S'_forget = w[11] * D^(-w[12]) * ((S + 1)^w[13] - 1) * exp(w[14] * (1 - R))
    const sForget =
      getW(w, 11) *
      Math.pow(D, -getW(w, 12)) *
      (Math.pow(S + 1, getW(w, 13)) - 1) *
      Math.exp(getW(w, 14) * (1 - currentR));
    nextS = Math.max(0.1, Math.min(S, sForget));
  } else {
    // Recall event
    nextReps += 1;
    const ratingBonus =
      rating === Rating.Hard ? getW(w, 15) : rating === Rating.Easy ? getW(w, 16) : 1.0;

    // S'_recall = S * (1 + exp(w[8]) * (11 - D) * S^(-w[9]) * (exp(w[10] * (1 - R)) - 1) * bonus)
    const factorIncrease =
      Math.exp(getW(w, 8)) *
      (11 - D) *
      Math.pow(S, -getW(w, 9)) *
      (Math.exp(getW(w, 10) * (1 - currentR)) - 1) *
      ratingBonus;

    nextS = Math.max(0.2, S * (1 + factorIncrease));
  }

  const intervalDays = calculateNextInterval(nextS, targetRetention, maxInterval);
  const nextDueDate = new Date(reviewDate.getTime() + intervalDays * 86_400_000);

  return {
    stability: Math.round(nextS * 100) / 100,
    difficulty: Math.round(nextD * 100) / 100,
    retrievability: 1.0,
    reps: nextReps,
    lapses: nextLapses,
    lastReviewedAt: reviewDate.toISOString(),
    dueAt: nextDueDate.toISOString(),
    intervalDays,
  };
}

/* ------------------------------------------------------------------ */
/* 6-Dimensional Learner Skill Modeling                               */
/* ------------------------------------------------------------------ */

export type ErrorTypeClassification =
  | 'slip'                 // Careless slip on high-mastery concept
  | 'concept_gap'          // Fundamental gap in target concept
  | 'prerequisite_failure' // Failure due to unmastered prerequisite
  | 'misread'              // Confident trap / misreading distractor
  | 'none';

export interface SkillEvidenceInput {
  wasCorrect: boolean;
  responseTimeMs?: number;
  expectedTimeMs?: number;
  currentMastery: number; // 0-100
  prerequisiteMastery?: number; // 0-100
  confidenceRating?: number; // 1-5
}

/** Classify error type from learner answer evidence */
export function classifyErrorType(evidence: SkillEvidenceInput): ErrorTypeClassification {
  if (evidence.wasCorrect) return 'none';

  // If high mastery (> 75) and answered unusually fast (< half expected time) -> slip
  if (
    evidence.currentMastery >= 75 &&
    evidence.responseTimeMs !== undefined &&
    evidence.expectedTimeMs !== undefined &&
    evidence.responseTimeMs < evidence.expectedTimeMs * 0.5
  ) {
    return 'slip';
  }

  // If high confidence (4 or 5) but wrong -> misread or caught by sophisticated trap
  if (evidence.confidenceRating !== undefined && evidence.confidenceRating >= 4) {
    return 'misread';
  }

  // If prerequisite is weak (< 50) -> prerequisite failure
  if (evidence.prerequisiteMastery !== undefined && evidence.prerequisiteMastery < 50) {
    return 'prerequisite_failure';
  }

  // Otherwise fundamental concept gap
  return 'concept_gap';
}

export interface SixDimensionalLearnerState {
  // 1. Competence / Proficiency Probability: P(L) in [0, 1]
  proficiencyProbability: number;
  // 2. Confidence / Measurement Certainty: in [0, 1]
  confidence: number;
  // 3. Evidence Count: valid responses observed
  evidenceCount: number;
  // 4. Memory Retrievability: R(t, S) from FSRS in [0, 1]
  memoryRetrievability: number;
  // 5. Execution Fluency: speed ratio (response_time / baseline)
  fluencySpeedRatio: number;
  // 6. Dominant Error Type: diagnostic classification
  dominantErrorType: ErrorTypeClassification | 'unknown';
  // Synthesis Lifecycle Status
  coverageStatus: 'unseen' | 'diagnosed' | 'learning' | 'remediated' | 'needs_proof' | 'proven' | 'mastered';
}

/** Apply Bayesian evidence update to the 6D learner skill state */
export function update6DLearnerSkillState(
  prior: SixDimensionalLearnerState | null,
  evidence: SkillEvidenceInput,
  fsrsState?: FSRSState
): SixDimensionalLearnerState {
  const current: SixDimensionalLearnerState = prior ?? {
    proficiencyProbability: 0.50,
    confidence: 0.10,
    evidenceCount: 0,
    memoryRetrievability: 1.0,
    fluencySpeedRatio: 1.0,
    dominantErrorType: 'unknown',
    coverageStatus: 'unseen',
  };

  const wasCorrect = evidence.wasCorrect;
  const newEvidenceCount = current.evidenceCount + 1;
  const newConfidence = Math.min(0.95, current.confidence + 0.10);

  // Bayesian update on competence
  let newProficiency: number;
  if (wasCorrect) {
    const gain = 0.18 * (1.0 - current.proficiencyProbability);
    newProficiency = Math.min(0.99, current.proficiencyProbability + gain);
  } else {
    const loss = 0.15 * current.proficiencyProbability;
    newProficiency = Math.max(0.01, current.proficiencyProbability - loss);
  }

  // Fluency speed ratio
  let newSpeedRatio = current.fluencySpeedRatio;
  if (evidence.responseTimeMs && evidence.expectedTimeMs && evidence.expectedTimeMs > 0) {
    const observedRatio = evidence.responseTimeMs / evidence.expectedTimeMs;
    newSpeedRatio = Math.round((current.fluencySpeedRatio * 0.7 + observedRatio * 0.3) * 100) / 100;
  }

  // Error type
  const errorType = classifyErrorType(evidence);
  const newDominantError = errorType === 'none' ? current.dominantErrorType : errorType;

  // Memory retrievability
  const newRetrievability = fsrsState ? fsrsState.retrievability : wasCorrect ? 1.0 : 0.75;

  // Lifecycle Coverage Status
  let status: SixDimensionalLearnerState['coverageStatus'];
  if (newEvidenceCount < 2) {
    status = 'diagnosed';
  } else if (!wasCorrect) {
    status = 'remediated';
  } else if (newProficiency >= 0.80 && newEvidenceCount >= 4) {
    status = 'mastered';
  } else if (newProficiency >= 0.65 && newEvidenceCount >= 3) {
    status = 'proven';
  } else {
    status = 'learning';
  }

  return {
    proficiencyProbability: Math.round(newProficiency * 1000) / 1000,
    confidence: Math.round(newConfidence * 100) / 100,
    evidenceCount: newEvidenceCount,
    memoryRetrievability: Math.round(newRetrievability * 100) / 100,
    fluencySpeedRatio: newSpeedRatio,
    dominantErrorType: newDominantError,
    coverageStatus: status,
  };
}
