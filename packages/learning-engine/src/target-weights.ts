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
