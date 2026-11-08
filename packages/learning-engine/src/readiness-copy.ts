/**
 * V2-080 (G-11/D-08) — Readiness copy: honest labels for UI.
 * Pure. Copy must never claim rank/taraz/admission.
 */

export type ReadinessLevel = 'low' | 'medium' | 'high';

export function readinessLabel(level: ReadinessLevel): string {
  if (level === 'low') return 'اطمینان سنجش: پایین — شواهد کافی نیست';
  if (level === 'medium') return 'اطمینان سنجش: متوسط — پوشش/ضرایب ناقص است';
  return 'اطمینان سنجش: بالا — پوشش و ضرایب کامل است (این رتبه یا تراز نیست)';
}

export function readinessDisclosure(): string {
  return 'این گزارش سنجش آمادگی بر اساس جلسات تمرینی است؛ پیش‌بینی رتبه، تراز یا قبولی نیست.';
}

export const FORBIDDEN_PHRASES_READINESS = [
  'رتبه ۱',
  'تراز ۵۰۰۰',
  'قبولی تضمینی',
  'احتمال قبولی ۹۰٪',
  'پوشش ۱۰۰٪ کنکور',
] as const;

export function findForbiddenPhrases(text: string): string[] {
  return FORBIDDEN_PHRASES_READINESS.filter(p => text.includes(p));
}

/** Gate for UI: reject any text containing forbidden readiness phrases. */
export function assertReadinessCopyClean(text: string): void {
  const found = findForbiddenPhrases(text);
  if (found.length) throw new Error(`readiness copy contains forbidden phrase: ${found[0]}`);
}
