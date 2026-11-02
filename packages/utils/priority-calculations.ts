// Priority calculation utilities for daily queue generation.
// R-011 (ARC-02): this module holds the ONE canonical priority function used by the
// production scoring path (worker /api/queue). The three formerly-divergent urgency
// formulas (due-ratio `calculateUrgency`, banded `calculateMasteryUrgency`, additive
// `calculateUrgencyV2`) were removed here; their semantics live in the explicit
// multiplicative terms of `computePriorityV3` below.

/** Calculate exam value from pack metadata and user mastery */
export function calculateExamValue(
  targetId: string,
  userState: {
    examPackWeights: Map<string, number>;
    currentPack?: string;
    masteryMap: Map<string, number>;
  }
): number {
  const defaultPackWeight = 1.0;
  const weight = userState.examPackWeights.get(targetId) || defaultPackWeight;
  const mastery = userState.masteryMap.get(targetId) ?? 50;

  // High weight + lower mastery produces higher urgency to learn
  const masteryGap = (100 - Math.min(100, Math.max(0, mastery))) / 100;
  return Math.min(2.0, Math.max(0.5, weight * (0.8 + 0.4 * masteryGap)));
}

/** Calculate expected benefit based on activity type */
export function calculateExpectedBenefit(
  activityType: 'review' | 'diagnostic' | 'remedial' | 'proof' | 'exam',
  userState: {
    masteryMap: Map<string, number>;
    evidenceLevel: 'none' | 'partial' | 'complete' | 'certified';
  },
  targetId?: string
): number {
  const baseMastery =
    (targetId ? userState.masteryMap.get(targetId) : undefined) ??
    userState.masteryMap.get('current') ??
    50;

  switch (activityType) {
    case 'review':
      return Math.min(1.5, 0.5 + (baseMastery / 100) * 0.7);
    case 'diagnostic':
      return Math.min(1.5, 1.5 - (baseMastery / 100) * 0.5);
    case 'remedial':
      return Math.min(1.5, 0.8 + 0.6 * (1 - baseMastery / 100));
    case 'proof': {
      const evidenceMap: Record<string, number> = {
        none: 1.0,
        partial: 1.1,
        complete: 1.2,
        certified: 1.3,
      };
      return evidenceMap[userState.evidenceLevel] || 1.0;
    }
    case 'exam':
      return 1.1;
    default:
      return 1.0;
  }
}

/**
 * Prerequisite multiplier per ADAPTIVE_PLANNER spec:
 * 1.0 when no prerequisite gap, 0.5 with exactly one gap, 0.2 with multiple gaps.
 * `prereqScores` are 0-100 mastery values of direct prerequisites.
 */
export function derivePrereqMultiplier(
  prereqScores: number[],
  opts: { threshold?: number } = {}
): number {
  const threshold = opts.threshold ?? 60;
  const gaps = prereqScores.filter((s) => s < threshold).length;
  if (gaps === 0) return 1.0;
  if (gaps === 1) return 0.5;
  return 0.2;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

export interface PriorityInputsV3 {
  /** ضریب کنکوری آیتم (≥0) */
  examValue: number;
  /** شکاف تسلط ۰..۱ (۱ = صفر تسلط) */
  knowledgeGap01: number;
  /** ضریب پیش‌نیاز (معمولاً 0.2 | 0.5 | 1.0) */
  prereqMultiplier: number;
  /** خطر فراموشی ۰..۱ = ۱ − بازیابی‌پذیری FSRS (منحنی توانی؛ منبع محاسبه: @ael/engine) */
  forgettingRisk: number;
  /** نزدیکی به کنکور ۰..۱ (۱ = کنکور نزدیک/رسیده) */
  examProximity01?: number;
  /** سود مورد انتظار فعالیت (معمولاً 0.5..1.5) */
  expectedBenefit: number;
  /** هزینه زمانی (دقیقه) — مخرج کسر */
  minutes: number;
}

/**
 * THE canonical priority function (R-011; formula == ADAPTIVE_PLANNER.md §Priority).
 * Forgetting risk and exam proximity are MULTIPLICATIVE terms `(1 + x)` —
 * higher risk means HIGHER priority (the old doc divided by risk: inverted; fixed here).
 */
export function computePriorityV3(p: PriorityInputsV3): number {
  const riskTerm = 1 + clamp01(p.forgettingRisk);
  const examTerm = 1 + clamp01(p.examProximity01 ?? 0);
  const numerator =
    Math.max(0, p.examValue) *
    clamp01(p.knowledgeGap01) *
    Math.max(0, p.prereqMultiplier) *
    riskTerm *
    examTerm *
    Math.max(0, p.expectedBenefit);
  return numerator / Math.max(1, Number.isFinite(p.minutes) && p.minutes > 0 ? p.minutes : 1);
}
