/**
 * V2-040..044 — Coverage ratio helpers (pure).
 * The .mjs script uses identical rules; this is the TS mirror for tests.
 */
export function coverageRatio(done: number, total: number): number | null {
  if (!Number.isFinite(done) || !Number.isFinite(total)) return null;
  if (total === 0) return null;
  if (done < 0 || done > total) throw new Error(`invalid coverage counts ${done}/${total}`);
  return Math.round((done / total) * 1000) / 1000;
}

export interface CoverageRow {
  scope: string;
  numerator: number;
  denominator: number;
  ratio: number | null;
}

export function buildCoverageRow(scope: string, numerator: number, denominator: number): CoverageRow {
  return { scope, numerator, denominator, ratio: coverageRatio(numerator, denominator) };
}
