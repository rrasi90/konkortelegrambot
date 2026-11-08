import { describe, it, expect } from 'vitest';
import { coverageRatio, buildCoverageRow } from '@ael/engine';

describe('V2-044 coverage-ratio', () => {
  it('computes simple ratio', () => {
    expect(coverageRatio(18, 24)).toBe(0.75);
  });
  it('returns null for zero denominator', () => {
    expect(coverageRatio(0, 0)).toBeNull();
  });
  it('returns null for non-finite', () => {
    expect(coverageRatio(Number.NaN, 10)).toBeNull();
  });
  it('throws for numerator > denominator', () => {
    expect(() => coverageRatio(5, 1)).toThrow('invalid coverage counts');
  });
  it('builds row objects', () => {
    expect(buildCoverageRow('x', 1, 2)).toEqual({ scope: 'x', numerator: 1, denominator: 2, ratio: 0.5 });
  });
});
