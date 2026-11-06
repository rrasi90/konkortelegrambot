import { describe, expect, it } from 'vitest';
import { selectPairingCandidate } from '../../scripts/ael-exam-utils.mjs';

describe('selectPairingCandidate', () => {
  it('does not create a pairing when every candidate has a known conflict', () => {
    const result = selectPairingCandidate([
      { score: 9, status: 'needs_review', conflicts: [{ rule: 'year_conflict' }] },
    ]);
    expect(result.best).not.toBeNull();
    expect(result.paired).toBe(false);
  });

  it('prefers a conflict-free candidate over a higher-scoring conflicted candidate', () => {
    const conflicted = { id: 'wrong-year', score: 12, conflicts: [{ rule: 'year_conflict' }] };
    const valid = { id: 'same-year', score: 2, conflicts: [] };
    const result = selectPairingCandidate([conflicted, valid]);
    expect(result.best).toBe(valid);
    expect(result.paired).toBe(true);
  });

  it('returns no pairing when there are no candidates', () => {
    expect(selectPairingCandidate([])).toEqual({ best: null, paired: false, ranked: [] });
  });

  it('allows a conflict-free multi-evidence candidate without claiming verification', () => {
    const candidate = { score: 8, status: 'candidate_multi_evidence', conflicts: [] };
    const result = selectPairingCandidate([candidate]);
    expect(result.best.status).toBe('candidate_multi_evidence');
    expect(result.paired).toBe(true);
  });
});
