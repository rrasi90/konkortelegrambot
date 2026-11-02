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

/** Retention factor constant: 19 / 81 ensures R(S, S) = 0.90 (see DECAY below) */
export const FSRS_FACTOR = 19 / 81;

/**
 * Forgetting-curve decay (FSRS-5 `DECAY` / `w[20]`).
 * With FACTOR = 19/81 this makes R(S, S) = (1 + 19/81)^(-1/2) = 9/10 = 0.90,
 * which is the definition of stability in FSRS.
 */
export const FSRS_DECAY = -0.5;

function getW(w: readonly number[], index: number): number {
  return w[index] ?? (DEFAULT_FSRS_WEIGHTS as readonly number[])[index] ?? 1.0;
}

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

/** Compute retrievability R(t, S) = (1 + FACTOR * (t / S))^DECAY */
export function calculateRetrievability(stability: number, daysElapsed: number): number {
  if (stability <= 0) return 0;
  if (daysElapsed <= 0) return 1.0;
  const value = Math.pow(1 + FSRS_FACTOR * (daysElapsed / stability), FSRS_DECAY);
  return Math.max(0, Math.min(1.0, value));
}

/**
 * Calculate interval in days for a given stability and target retention.
 * Inverse of the forgetting curve: t = S * (R^(1/DECAY) - 1) / FACTOR, i.e. t = S * (R^-2 - 1) / (19/81).
 * For the FSRS default target R = 0.90 this reduces to t = S.
 */
export function calculateNextInterval(
  stability: number,
  requestedRetention = 0.90,
  maximumInterval = 365
): number {
  const target = Math.max(0.70, Math.min(0.98, requestedRetention));
  const rawInterval = (stability * (Math.pow(target, 1 / FSRS_DECAY) - 1)) / FSRS_FACTOR;
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

/**
 * §8.6 — ده علت خطا (mission Phase 4 §8.6).
 * هر پاسخ غلط در حد امکان علت‌یابی می‌شود؛ هر خطا الزاماً ضعف قطعی یک فصل نیست.
 */
export type ErrorTypeClassification =
  | 'slip'                 // Careless slip on high-mastery concept (موجه توقف موج)
  | 'concept_gap'          // شکاف در خود مفهومی که سؤال هدفش بود
  | 'knowledge_gap'        // شکاف در پیش‌نیاز/دانش زیربنایی
  | 'misconception'        // باور غلط — انتخاب دامِ تستی
  | 'calculation_error'    // خطای محاسباتی در سؤال محاسباتی
  | 'reading_error'        // بی‌دقتی در صورت سؤال (اطمینان بالا + پاسخ غلط)
  | 'theory_confusion'     // خلط نظریه‌ها — دام با ضعف هم‌خانوادهٔ مفهومی
  | 'recall_failure'       // فراموشی — بازیابی پایین با شایستگی پیشین بالا
  | 'time_pressure'        // فشار زمان — پاسخ بسیار کندتر از زمان مجاز
  | 'guessing'             // حدس — اطمینان خوداظهاری بسیار پایین
  | 'unknown'              // شواهد برای علت‌یابی کافی نیست (هرگز به‌عنوان ضعف قطعی تفسیر نشود)
  | 'none';                // پاسخ صحیح — خطایی برای طبقه‌بندی نیست

/** ده علت خطای مأموریت — ترتیب پایدار برای گزارش تحلیلی */
export const ERROR_TYPE_CAUSES = [
  'slip',
  'time_pressure',
  'recall_failure',
  'theory_confusion',
  'misconception',
  'calculation_error',
  'reading_error',
  'guessing',
  'knowledge_gap',
  'concept_gap',
] as const satisfies readonly ErrorTypeClassification[];

export interface SkillEvidenceInput {
  wasCorrect: boolean;
  responseTimeMs?: number;
  expectedTimeMs?: number;
  currentMastery: number; // 0-100
  prerequisiteMastery?: number; // 0-100
  confidenceRating?: number; // 1-5
  /** خوداظهاری لغزش (slip): شاهد شکاف نیست — از کسر شایستگی می‌کاهد */
  isSlip?: boolean;
  /** §8.6: آیا سؤال محاسباتی است (از قرارداد کانترکت/کلمات کلیدی مشتق می‌شود) */
  requiresCalculation?: boolean;
  /** §8.6: نکتهٔ دام تستی سؤال — منبع طبقه‌بندی misconception/theory_confusion */
  trapNote?: string;
  /** §8.6: تسلط گره‌های هم‌خانوادهٔ مفهومی (برای تشخیص خلط نظریه‌ها) */
  siblingMasteries?: number[];
  /** §8.6: بازیابی حافظه از FSRS (برای تشخیص فراموشی) */
  memoryRetrievability?: number;
}

/** §8.6 — قواعد علت‌یابی: صریح، اولویت‌دار و فقط از شاهد قابل‌مشاهده.
 * «هر خطا الزاماً ضعف قطعی یک فصل نیست»: نبودِ شاهد → unknown، نه concept_gap. */
export function classifyErrorType(
  evidence: SkillEvidenceInput,
  ctx?: { requiresCalculation?: boolean }
): ErrorTypeClassification {
  if (evidence.wasCorrect) return 'none';

  const fast =
    evidence.responseTimeMs !== undefined &&
    evidence.expectedTimeMs !== undefined &&
    evidence.expectedTimeMs > 0 &&
    evidence.responseTimeMs < evidence.expectedTimeMs * 0.5;
  const verySlow =
    evidence.responseTimeMs !== undefined &&
    evidence.expectedTimeMs !== undefined &&
    evidence.expectedTimeMs > 0 &&
    evidence.responseTimeMs > evidence.expectedTimeMs * 1.5;
  const hasTrap = !!evidence.trapNote;

  // 1) لغزش: شایستگی بالا + پاسخ بسیار سریع — موجه توقف موج سرایت
  if (evidence.currentMastery >= 75 && fast) return 'slip';
  if (evidence.isSlip) return 'slip';

  // 2) فشار زمان: پاسخ بسیار کندتر از زمان مجاز
  if (verySlow) return 'time_pressure';

  // 3) فراموشی: شایستگی پیشین بالا ولی بازیابی حافظه پایین
  if (
    evidence.currentMastery >= 60 &&
    evidence.memoryRetrievability !== undefined &&
    evidence.memoryRetrievability < 0.7
  ) {
    return 'recall_failure';
  }

  // 4) خلط نظریه‌ها: دامِ تستی + ضعف هم‌خانوادهٔ مفهومی (حداقل دو شواهد)
  if (hasTrap && (evidence.siblingMasteries ?? []).some((m) => m < 60)) {
    return 'theory_confusion';
  }

  // 5) باور غلط: انتخاب پاسخِ دامِ مستند (دامنهٔ دام در بانک ثبت شده)
  if (hasTrap) return 'misconception';

  // 6) خطای محاسباتی: سؤال محاسباتی + پاسخ سریع/عادی بدون نشانگر شکاف
  if (evidence.requiresCalculation === true && (fast || evidence.responseTimeMs !== undefined)) {
    return 'calculation_error';
  }

  // 7) بی‌دقتی در صورت: اطمینان خوداظهاری بسیار بالا ولی پاسخ غلط
  if (evidence.confidenceRating !== undefined && evidence.confidenceRating >= 5) {
    return 'reading_error';
  }

  // 8) حدس: اطمینان خوداظهاری بسیار پایین
  if (evidence.confidenceRating !== undefined && evidence.confidenceRating <= 1) {
    return 'guessing';
  }

  // 9) شکاف دانش: پیش‌نیاز ضعیف
  if (evidence.prerequisiteMastery !== undefined && evidence.prerequisiteMastery < 50) {
    return 'knowledge_gap';
  }

  // 10) شکاف مفهومی: خودِ گره ضعیف بوده و پاسخ هم منطقیِ همان شکاف است
  if (evidence.currentMastery < 60) return 'concept_gap';

  // شواهد ناکافی — ضعف قطعی فرض نمی‌شود
  return 'unknown';
}

/** Classify error type from learner answer evidence */
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
  /** §8.2: holdout تنها مسیر به proven/mastered — از تلاش attemptType='proof' */
  provenViaHoldout?: boolean;
  /** زمان آخرین شاهد (برای سنجش تازگی در اطمینان) */
  lastEvidenceAt?: string;
  /** تعداد شواهد صحیح (برای سازگاری در اطمینان) */
  correctCount?: number;
  /** انواع مستقل تلاش که شاهد جمع شده‌اند (برای تنوع در اطمینان) */
  distinctAttemptTypes?: string[];
  // Synthesis Lifecycle Status
  coverageStatus: 'unseen' | 'diagnosed' | 'learning' | 'remediated' | 'needs_proof' | 'proven' | 'mastered';
}

/** §8.2 زمینهٔ شواهد — نوع تلاش و زمان، برای اطمینان چندعاملی و دروازهٔ holdout */
export interface SixDUpdateContext {
  attemptType?: 'practice' | 'diagnostic' | 'verification' | 'proof' | 'holdout' | 'exam_simulation';
  answeredAt?: string;
  now?: string;
}

/** Apply Bayesian evidence update to the 6D learner skill state */
export function update6DLearnerSkillState(
  prior: SixDimensionalLearnerState | null,
  evidence: SkillEvidenceInput,
  fsrsState?: FSRSState,
  ctx?: SixDUpdateContext
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
  const isSlip = evidence.isSlip === true;
  const newEvidenceCount = current.evidenceCount + 1;
  const isProof = ctx?.attemptType === 'proof' || ctx?.attemptType === 'holdout';
  const provenViaHoldout = current.provenViaHoldout === true || (isProof && wasCorrect);

  // شمارندهٔ شواهد صحیح و انواع مستقل تلاش (پایهٔ سازگاری و تنوع در اطمینان)
  const prevCorrect = current.correctCount ?? Math.round((current.confidence ?? 0.1) * current.evidenceCount);
  const newCorrectCount = Math.min(newEvidenceCount, prevCorrect + (wasCorrect || isSlip ? 1 : 0));
  const prevTypes = current.distinctAttemptTypes ?? [];
  const newTypes = ctx?.attemptType && !prevTypes.includes(ctx.attemptType)
    ? [...prevTypes, ctx.attemptType]
    : prevTypes;

  /* ---------- §8.2 اطمینان چندعاملی ----------
   * چگالی شاهد × سازگاری پاسخ‌ها × تنوع نوع تلاش × تازگی.
   * خوداظهاری (confidenceRating) در این محاسبه نقشی ندارد — شاهد مستقل، نه حس کاربر. */
  const density = Math.min(1, newEvidenceCount / 5);
  const accuracy = newCorrectCount / newEvidenceCount;
  const variety = Math.min(1, Math.max(1, newTypes.length) / 3);
  const answeredAtMs = ctx?.answeredAt ? new Date(ctx.answeredAt).getTime() : NaN;
  const nowMs = ctx?.now ? new Date(ctx.now).getTime() : Date.now();
  const daysSince = Number.isFinite(answeredAtMs) ? Math.max(0, (nowMs - answeredAtMs) / 86_400_000) : 0;
  const recency = Math.exp(-daysSince / 14); // عمر متوسط ۱۴ روز
  const newConfidence = Math.min(0.95, Math.max(0.05, 0.35 * density + 0.35 * accuracy + 0.15 * variety + 0.15 * recency));

  // Bayesian update on competence — لغزش (خوداظهاری) شایستگی را کم نمی‌کند
  let newProficiency: number;
  if (wasCorrect) {
    const gain = 0.18 * (1.0 - current.proficiencyProbability);
    newProficiency = Math.min(0.99, current.proficiencyProbability + gain);
  } else if (isSlip) {
    newProficiency = current.proficiencyProbability;
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

  // Lifecycle Coverage Status — §8.2: «proven»/«mastered» فقط با شاهد هولدآوت؛
  // توالی تمرین/خودارزیابی به‌تنهایی نمی‌تواند اثبات تولید کند.
  let status: SixDimensionalLearnerState['coverageStatus'];
  if (provenViaHoldout) {
    status = 'proven';
  } else if (newEvidenceCount < 2) {
    status = 'diagnosed';
  } else if (!wasCorrect && !isSlip) {
    status = 'remediated';
  } else if (newProficiency >= 0.65 && newEvidenceCount >= 3) {
    status = 'needs_proof';
  } else {
    status = 'learning';
  }

  return {
    proficiencyProbability: Math.round(newProficiency * 1000) / 1000,
    confidence: Math.round(newConfidence * 1000) / 1000,
    evidenceCount: newEvidenceCount,
    memoryRetrievability: Math.round(newRetrievability * 100) / 100,
    fluencySpeedRatio: newSpeedRatio,
    dominantErrorType: newDominantError,
    provenViaHoldout,
    lastEvidenceAt: ctx?.answeredAt,
    correctCount: newCorrectCount,
    distinctAttemptTypes: newTypes,
    coverageStatus: status,
  };
}
