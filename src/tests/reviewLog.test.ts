import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendReviewLog,
  loadReviewLog,
  removeLatestReviewLog,
} from '../utils/reviewLog';

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

describe('review log', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends newest entries first', () => {
    appendReviewLog({
      cardId: 'card-1',
      source: 'flashcard',
      at: '2026-11-14T10:00:00.000Z',
      rating: 3,
      durationMs: 4_000,
    });
    appendReviewLog({
      cardId: 'card-2',
      source: 'flashcard',
      at: '2026-11-14T10:01:00.000Z',
      rating: 1,
      durationMs: 6_000,
    });

    const log = loadReviewLog();
    expect(log).toHaveLength(2);
    expect(log[0].cardId).toBe('card-2');
    expect(log[1].cardId).toBe('card-1');
  });

  it('removes the latest entry for undo', () => {
    appendReviewLog({
      cardId: 'card-1',
      source: 'flashcard',
      at: '2026-11-14T10:00:00.000Z',
      rating: 3,
    });
    appendReviewLog({
      cardId: 'card-2',
      source: 'flashcard',
      at: '2026-11-14T10:01:00.000Z',
      rating: 3,
    });

    removeLatestReviewLog();
    expect(loadReviewLog().map((entry) => entry.cardId)).toEqual(['card-1']);
  });

  it('keeps question results in the same log', () => {
    appendReviewLog({
      cardId: 'question-card',
      source: 'question',
      at: '2026-11-14T10:00:00.000Z',
      result: 'wrong',
      durationMs: 20_000,
      nodeId: 'mkt.segmentation',
    });
    expect(loadReviewLog()[0]).toMatchObject({
      source: 'question',
      result: 'wrong',
      nodeId: 'mkt.segmentation',
    });
  });
});
