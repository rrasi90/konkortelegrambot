import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseFlashcardImport,
  serializeFlashcardBackup,
  type UserFlashcard,
} from '../utils/userFlashcards';

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

const card: UserFlashcard = {
  id: 'user.1',
  front: 'نیاز پنهان',
  back: 'نیازی که مشتری بیان نمی‌کند.',
  extra: 'منبع: کاتلر',
  courseId: 'mkt',
  layer: 'L1',
  createdAt: '2026-11-14T10:00:00.000Z',
  sourceQuestionId: 'q.1',
  sourceNodeId: 'mkt.consumer',
};

describe('personal flashcard import', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses quoted CSV with a comma inside a field', () => {
    const result = parseFlashcardImport(
      '"نیاز، پنهان","نیازی که مشتری، آن را نمی‌گوید."\n"تقاضا","نیاز با قدرت خرید."',
      'mkt',
      'L1',
    );
    expect(result.errors).toHaveLength(0);
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0]?.front).toBe('نیاز، پنهان');
  });

  it('still parses TSV and pipe rows', () => {
    const result = parseFlashcardImport(
      'نیاز پنهان\tنیاز بیان‌نشده.\nتقاضا | نیاز با قدرت خرید.',
      'mkt',
      'L1',
    );
    expect(result.errors).toHaveLength(0);
    expect(result.cards).toHaveLength(2);
  });

  it('round-trips a complete JSON backup', () => {
    const backup = serializeFlashcardBackup([card]);
    const result = parseFlashcardImport(backup, 'bus', 'L1');
    expect(result.errors).toHaveLength(0);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.sourceQuestionId).toBe('q.1');
    expect(result.cards[0]?.sourceNodeId).toBe('mkt.consumer');
    expect(result.cards[0]?.extra).toBe('منبع: کاتلر');
  });

  it('rejects duplicate fronts inside a JSON backup', () => {
    const result = parseFlashcardImport(JSON.stringify({ cards: [card, card] }), 'mkt', 'L1');
    expect(result.cards).toHaveLength(1);
    expect(result.errors[0]).toContain('تکراری');
  });
});
