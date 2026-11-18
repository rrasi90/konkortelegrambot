import { describe, expect, it } from 'vitest';
import { DEFAULT_STUDY_SETTINGS, normalizeReviewCap } from '../utils/studySettings';

describe('studySettings — review budget', () => {
  it('uses a bounded default cap', () => {
    expect(DEFAULT_STUDY_SETTINGS.reviewCap).toBe(20);
    expect(normalizeReviewCap(undefined)).toBe(20);
    expect(normalizeReviewCap(0)).toBe(20);
    expect(normalizeReviewCap('not-a-number')).toBe(20);
  });

  it('keeps valid session caps and clamps extremes', () => {
    expect(normalizeReviewCap('10')).toBe(10);
    expect(normalizeReviewCap(30)).toBe(30);
    expect(normalizeReviewCap(1)).toBe(5);
    expect(normalizeReviewCap(999)).toBe(50);
  });

  it('rounds fractional caps to a whole card count', () => {
    expect(normalizeReviewCap(19.6)).toBe(20);
  });
});
