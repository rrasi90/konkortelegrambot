import { describe, expect, it } from 'vitest';
import {
  calculateCardRetrievability,
  initFSRS,
  stepFSRS,
} from '../engine/aelEngine';
import {
  Rating,
  calculateRetrievability,
  initializeFSRSState,
  scheduleNextFSRS,
} from '@ael/engine';

const NOW = new Date('2026-11-02T12:00:00.000Z');

describe('React legacy FSRS adapter — canonical engine parity', () => {
  it.each([1, 2, 3, 4] as const)(
    'first review rating=%i initializes exactly as @ael/engine',
    (grade) => {
      expect(stepFSRS(initFSRS(NOW), grade, NOW)).toEqual(
        initializeFSRSState(grade, NOW),
      );
    },
  );

  it.each([1, 2, 3, 4] as const)(
    'subsequent review rating=%i delegates the exact shared DSR transition',
    (grade) => {
      const previous = initializeFSRSState(Rating.Good, NOW);
      const reviewAt = new Date(NOW.getTime() + 7 * 86_400_000);
      expect(stepFSRS(previous, grade, reviewAt)).toEqual(
        scheduleNextFSRS(previous, grade, reviewAt),
      );
    },
  );

  it.each([
    [1.5, 1],
    [1.5, 4],
    [3, 1],
    [3, 4],
    [7, 1],
    [7, 4],
  ])(
    'retrievability uses the canonical FSRS curve for S=%s and elapsed=%s days',
    (stability, elapsedDays) => {
      expect(calculateCardRetrievability(stability, elapsedDays)).toBe(
        calculateRetrievability(stability, elapsedDays),
      );
    },
  );

  it('keeps the zero-stability sentinel until the first real review', () => {
    const fresh = initFSRS(NOW);
    expect(fresh.stability).toBe(0);
    expect(fresh.intervalDays).toBe(0);
    expect(fresh.dueAt).toBe(NOW.toISOString());
  });
});
