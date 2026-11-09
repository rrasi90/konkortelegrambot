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
 * قواعد:
 *  1. share(s,t) = coefficient(s,t) / مجموع ضرایب مثبت رسمی هدف t — فقط official_positive.
 *  2. official_zero و not_applicable → سهم صفر و خارج از servesTargets.
 *  3. unknown → سهم صفر + پرچم unknown_coefficient:<targetId> — هرگز صفر تفسیر نمی‌شود.
 *  4. weight(s) = max_t(priority(t) × share(s,t)) × (1 + 0.2 × (k − 1)) با k تعداد هدف‌های سهم مثبت.
 *  5. ضرایب هدف‌ها جمع/میانگین نمی‌شوند — فقط max.
 *  6. خروجی مرتب بر اساس subjectId.
 */
export type OfficialCoefficientState =
  | 'official_positive'
  | 'official_zero'
  | 'unknown'
  | 'not_applicable';

export interface TargetSubject {
  targetId: string;
  subjectId: string;
  coefficient: number | null;
  state: OfficialCoefficientState;
}

export interface TargetInfo {
  targetId: string;
  priority: number;
}

export interface SubjectWeight {
  subjectId: string;
  weight: number;
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
    if (row.state === 'official_positive' && typeof row.coefficient === 'number' && row.coefficient > 0) {
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
    const weight: SubjectWeight = bySubject.get(row.subjectId) ?? {
      subjectId: row.subjectId,
      weight: 0,
      servesTargets: [],
      flags: [],
    };

    const serve = row.state === 'official_positive'
      && typeof row.coefficient === 'number'
      && row.coefficient > 0
      && target !== undefined
      && (positivesByTarget.get(row.targetId) ?? 0) > 0;

    if (serve && target) {
      const share = row.coefficient! / positivesByTarget.get(row.targetId)!;
      weight.servesTargets.push(target.targetId);
      const targetContribution = target.priority * share;
      if (targetContribution > weight.weight) weight.weight = targetContribution;
    }
    if (row.state === 'unknown' && target) {
      weight.flags.push(`unknown_coefficient:${target.targetId}`);
    }
    bySubject.set(row.subjectId, weight);
  }

  for (const weight of bySubject.values()) {
    const k = weight.servesTargets.length;
    if (k > 1) weight.weight *= 1 + MULTI_TARGET_BUMP * (k - 1);
  }

  return [...bySubject.values()].sort((a, b) => (a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0));
}
