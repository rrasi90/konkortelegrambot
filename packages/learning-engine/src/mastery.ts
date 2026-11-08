/**
 * V2-073 (G-04/MAS-01) — Evidence-layered mastery with holdout gate.
 * Pure + deterministic. Does NOT change applyAnswer behavior;
 * it provides a separate, testable computation for analytics.
 */

export type EvidenceKind = 'practice' | 'diagnostic' | 'proof';
export interface MasteryEvidence {
  wasCorrect: boolean;
  evidenceKind: EvidenceKind;
  answerTimeMs?: number;
  expectedTimeMs?: number;
}
export interface EvidenceMasteryResult {
  /** 0..100 evidence mastery (never fabricated from self-report) */
  mastery: number;
  evidenceCount: number;
  /** proven only when holdout evidence exists and mastery >= 85 */
  proven: boolean;
  /** insufficient evidence label instead of a fabricated 50 */
  insufficient: boolean;
}

export function computeEvidenceMastery(evidences: MasteryEvidence[]): EvidenceMasteryResult {
  const evidenceCount = evidences.length;
  if (evidenceCount === 0) {
    return { mastery: 0, evidenceCount: 0, proven: false, insufficient: true };
  }
  const correct = evidences.filter(e => e.wasCorrect).length;
  const ratio = correct / evidenceCount;
  const mastery = Math.round(ratio * 100);
  const hasProof = evidences.some(e => e.evidenceKind === 'proof' && e.wasCorrect);
  const proven = hasProof && mastery >= 85;
  return { mastery, evidenceCount, proven, insufficient: evidenceCount < 3 };
}
