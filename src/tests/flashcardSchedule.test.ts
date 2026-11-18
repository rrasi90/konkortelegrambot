import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SCHEDULE,
  loadCardSchedules,
  scheduleCardNow,
  updateCardSchedule,
} from '../utils/flashcardSchedule';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('flashcard FSRS schedule', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes a new card with FSRS interval and state', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    const next = updateCardSchedule(DEFAULT_SCHEDULE, 3, now);

    expect(next.stability).toBeGreaterThan(0);
    expect(next.difficulty).toBeGreaterThanOrEqual(1);
    expect(next.difficulty).toBeLessThanOrEqual(10);
    expect(next.interval).toBeGreaterThanOrEqual(1);
    expect(next.interval).toBeLessThanOrEqual(365);
    expect(next.due).toBeGreaterThan(now.getTime());
    expect(next.reps).toBe(1);
    expect(next.lastReviewedAt).toBe(now.toISOString());
  });

  it('maps a legacy interval into FSRS instead of resetting progress', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    const legacy = {
      ease: 2.5,
      interval: 12,
      due: now.getTime(),
      reps: 4,
      lapses: 1,
    };
    const next = updateCardSchedule(legacy, 3, now);

    expect(next.stability).toBeGreaterThan(0);
    expect(next.reps).toBe(5);
    expect(next.lapses).toBe(1);
    expect(next.interval).toBeGreaterThanOrEqual(1);
    expect(next.lastReviewedAt).toBe(now.toISOString());
  });

  it('treats Again as a lapse through FSRS', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    const first = updateCardSchedule(DEFAULT_SCHEDULE, 3, now);
    const lapsed = updateCardSchedule(first, 1, new Date(now.getTime() + 86_400_000));

    expect(lapsed.lapses).toBe(first.lapses + 1);
    expect(lapsed.stability).toBeGreaterThan(0);
    expect(lapsed.interval).toBeGreaterThanOrEqual(1);
  });

  it('makes a card due immediately without discarding its FSRS state', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    const first = updateCardSchedule(DEFAULT_SCHEDULE, 4, now);
    const schedules = { card: first };
    localStorage.setItem('ael.flashcard-schedule', JSON.stringify(schedules));

    scheduleCardNow('card');
    const stored = loadCardSchedules().card;
    expect(stored.due).toBeLessThanOrEqual(Date.now());
    expect(stored.stability).toBe(first.stability);
    expect(stored.interval).toBe(first.interval);
  });
});
