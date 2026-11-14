import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestionItem } from '../data/konkorData';
import { queueMistakeReview } from '../utils/mistakeReview';
import { countDueMistakeCards, loadDueMistakeReviewQueue } from '../utils/reviewToday';
import {
  loadUserFlashcards,
  removeMistakeReviewCard,
  setMistakeReviewCardSuspended,
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

const question: QuestionItem = {
  id: 'q-review-today-1',
  nodeId: 'mkt.segmentation',
  examYear: 1405,
  bookletQuestionNumber: 12,
  courseSectionId: 'marketing',
  courseSectionTitle: 'بازاریابی',
  text: 'کدام معیار بخش‌بندی، اندازه‌پذیری و دسترسی‌پذیری را هم‌زمان می‌سنجد؟',
  options: ['جمعیت‌شناختی', 'اثربخشی بخش', 'جغرافیایی', 'روان‌شناختی'],
  expectedTimeMs: 60_000,
};

const reveal = {
  correctOption: 1,
  explanation: 'بخش باید قابل اندازه‌گیری و دسترسی باشد.',
  trapNote: 'جمعیت‌شناختی فقط روش توصیف است.',
};

describe('shared review today queue', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('counts a new mistake card in the daily queue', () => {
    const outcome = queueMistakeReview(question, 0, reveal);
    const queue = loadDueMistakeReviewQueue();

    expect(outcome.queued).toBe(true);
    expect(queue.total).toBe(1);
    expect(queue.cards[0]?.tags).toContain('مرور خطا');
    expect(countDueMistakeCards()).toBe(1);
  });

  it('removes a resolved mistake card from the daily queue without deleting it', () => {
    queueMistakeReview(question, 0, reveal);
    expect(setMistakeReviewCardSuspended(question.id, true)).toBe(true);

    expect(loadUserFlashcards()).toHaveLength(1);
    expect(countDueMistakeCards()).toBe(0);
    expect(loadDueMistakeReviewQueue().cards).toHaveLength(0);
  });

  it('removes the derived card when the notebook entry is deleted', () => {
    queueMistakeReview(question, 0, reveal);
    expect(removeMistakeReviewCard(question.id)).toBe(true);
    expect(loadUserFlashcards()).toHaveLength(0);
    expect(countDueMistakeCards()).toBe(0);
  });
});
