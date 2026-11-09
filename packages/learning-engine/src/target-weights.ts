/**
 * V2-076 (G-10/D-07) — Target weights from official coefficients.
 * Pure. Never invents weights: unknown (null) stays null.
 */

export interface CoefficientSet {
  specialization: number | null;
  language: number | null;
  aptitude: number | null;
}

export function computeTargetWeights(c: CoefficientSet): { weights: { specialization: number; language: number; aptitude: number }; total: number } {
  const total = Math.max(0, c.specialization ?? 0) + Math.max(0, c.language ?? 0) + Math.max(0, c.aptitude ?? 0);
  return {
    weights: {
      specialization: Math.max(0, c.specialization ?? 0),
      language: Math.max(0, c.language ?? 0),
      aptitude: Math.max(0, c.aptitude ?? 0),
    },
    total,
  };
}

export function specializationSharePercent(c: CoefficientSet): number | null {
  const { total } = computeTargetWeights(c);
  if (total <= 0) return null;
  return Math.round(((c.specialization ?? 0) / total) * 100);
}

/** Forbidden: any rank/taraz/admission claim without calibration. */
export const FORBIDDEN_READINESS_CLAIMS = [
  'رتبه‌های برتر',
  'تراز بالای',
  'احتمال قبولی',
  'تضمین قبولی',
  'دعوت به مصاحبه',
] as const;

export function assertNoForbiddenClaims(text: string): void {
  for (const phrase of FORBIDDEN_READINESS_CLAIMS) {
    if (text.includes(phrase)) throw new Error(`forbidden readiness claim: ${phrase}`);
  }
}

/**
 * V3-011/G-10 — وزن‌دهی عمومی چندهدفه از ضرایب رسمی، مستقل از نام خانواده/ماده.
 * Pure. در مسیرهای جدید جایگزین مدل خانواده‌محور computeTargetWeights است
 * (computeTargetWeights فقط برای سازگاری legacy نگه داشته می‌شود).
 *
 * V3-Hardening B5 — اصل بنیادین: Unknown ≠ Zero.
 *  1. share(s,t) = coefficient(s,t) / مجموع ضرایب مثبت هدف t — فقط سطرهای positive.
 *  2. zero و not_applicable → سهم صفر و خارج از servesTargets (پرچم متمایز هرکدام).
 *  3. unknown → سهم صفر + پرچم unknown_coefficient:<targetId> — اما وزن کل
 *     unknown می‌شود (null)، نه صفر؛ planningStatus 'needs_review'.
 *  4. weight(s) = max_t(priority(t) × share(s,t)) × (1 + 0.2 × (k − 1)) با k تعداد هدف‌های سهم مثبت.
 *  5. ضرایب هدف‌ها جمع/میانگین نمی‌شوند — فقط max.
 *  6. خروجی مرتب بر اساس subjectId.
 *  7. درس نامعلوم هرگز به‌صورت خاموش حذف نمی‌شود؛ وضعیت ناقص داده در
 *     weightStatus/planningStatus قابل مشاهده است.
 */
import {
  normalizeCoefficientValueState,
  type CoefficientValueAxis,
  type CoefficientValueState,
} from '@ael/contracts';

/** ورودی پذیرش هر دو سبک: محور جدید (positive/…) یا alias قدیمی (official_positive/…). */
export type CoefficientStateInput = CoefficientValueState;

export interface TargetSubject {
  targetId: string;
  subjectId: string;
  coefficient: number | null;
  state?: CoefficientStateInput;
  /** محور مقدار صریح — مقدم بر state قدیمی. */
  valueState?: Exclude<CoefficientValueState, 'official_positive' | 'official_zero'>;
  /** محور شواهد صریح؛ غایب یعنی شاهد ورودی تعیین‌نشده (ورودی مسئول شفافیت است). */
  evidence?: 'official_verified' | 'reported' | 'inferred' | 'pending_verification';
}

export interface TargetInfo {
  targetId: string;
  priority: number;
}

export type WeightStatus = 'computed' | 'unknown' | 'not_applicable';
export type PlanningStatus = 'ready' | 'partial' | 'needs_review' | 'excluded';

export interface SubjectWeight {
  subjectId: string;
  /** null فقط برای unknown — صفرِ واقعی صفر گزارش می‌شود (Unknown ≠ Zero). */
  weight: number | null;
  /** 'computed' یعنی وزن از ضرایب معلوم محاسبه شد؛ 'unknown' یعنی مبنای محاسبه نیست. */
  weightStatus: WeightStatus;
  /** وضعیت برنامه‌ریزی: درس نامعلوم needs_review می‌گیرد، نه حذف خاموش. */
  planningStatus: PlanningStatus;
  servesTargets: string[];
  flags: string[];
}

export const MULTI_TARGET_BUMP = 0.2;

export function computeSubjectWeights(
  rows: TargetSubject[],
  targets: TargetInfo[],
): SubjectWeight[] {
  const targetById = new Map(targets.map((t) => [t.targetId, t]));
  const positivesByTarget = new Map<string, number>();
  for (const row of rows) {
    const axis = normalizeCoefficientValueState(row.valueState ?? row.state);
    if (axis === 'positive' && typeof row.coefficient === 'number' && row.coefficient > 0) {
      positivesByTarget.set(row.targetId, (positivesByTarget.get(row.targetId) ?? 0) + row.coefficient);
    }
  }

  const bySubject = new Map<string, SubjectWeight>();
  const seenRowKeys = new Set<string>();
  for (const row of rows) {
    const rowKey = `${row.targetId}\u0000${row.subjectId}`;
    if (seenRowKeys.has(rowKey)) continue;
    seenRowKeys.add(rowKey);
    const target = targetById.get(row.targetId);
    const axis = normalizeCoefficientValueState(row.valueState ?? row.state);
    const weight: SubjectWeight = bySubject.get(row.subjectId) ?? {
      subjectId: row.subjectId,
      weight: null,
      weightStatus: 'unknown',
      planningStatus: 'needs_review',
      servesTargets: [],
      flags: [],
    };
    if (!weight.flags) weight.flags = [];

    if (axis === 'positive' && target
      && typeof row.coefficient === 'number' && row.coefficient > 0
      && (positivesByTarget.get(row.targetId) ?? 0) > 0) {
      const share = row.coefficient / positivesByTarget.get(row.targetId)!;
      weight.servesTargets.push(target.targetId);
      const targetContribution = target.priority * share;
      if (weight.weight === null || targetContribution > weight.weight) weight.weight = targetContribution;
      weight.weightStatus = 'computed';
    } else if (axis === 'unknown' && target) {
      weight.flags.push(`unknown_coefficient:${target.targetId}`);
    } else if (axis === 'zero' && target) {
      weight.flags.push(`zero_coefficient:${target.targetId}`);
      // صفرِ معلوم مقدار معلوم است؛ اگر هیچ سهم مثبتی در کار نباشد وزن ۰ گزارش می‌شود، نه null
      if (weight.weightStatus !== 'computed') {
        weight.weightStatus = 'computed';
        if (weight.weight === null) weight.weight = 0;
      }
    } else if (axis === 'not_applicable' && target) {
      weight.flags.push(`not_applicable:${target.targetId}`);
    }
    bySubject.set(row.subjectId, weight);
  }

  for (const weight of bySubject.values()) {
    const k = weight.servesTargets.length;
    if (k > 1 && weight.weight !== null && weight.weight > 0) weight.weight *= 1 + MULTI_TARGET_BUMP * (k - 1);

    const hasUnknown = weight.flags.some((f) => f.startsWith('unknown_coefficient:'));
    const hasZero = weight.flags.some((f) => f.startsWith('zero_coefficient:'));
    const hasNA = weight.flags.some((f) => f.startsWith('not_applicable:'));

    if (k > 0 && weight.weight !== null && weight.weight > 0) {
      // سهم مثبت دارد: partial فقط وقتی سطر نامعلوم دیگری در کار است (داده ناقص قابل مشاهده)
      weight.planningStatus = hasUnknown ? 'partial' : 'ready';
    } else if (weight.weightStatus === 'computed' && hasZero && !hasUnknown) {
      // همهٔ سهم‌های معلوم صفرند — صفرِ معلوم، excluded با وزن ۰ (نه needs_review)
      weight.planningStatus = 'excluded';
      if (weight.weight === null) weight.weight = 0;
    } else if (k === 0 && hasNA && !hasUnknown && !hasZero) {
      weight.weightStatus = 'not_applicable';
      weight.planningStatus = 'excluded';
      weight.weight = null;
    } else {
      weight.weightStatus = 'unknown';
      weight.planningStatus = 'needs_review';
      weight.weight = null;
    }
  }

  return [...bySubject.values()].sort((a, b) => (a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0));
}
