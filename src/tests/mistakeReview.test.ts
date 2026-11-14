import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestionItem } from '../data/konkorData';
import { queueMistakeReview } from '../utils/mistakeReview';
import {
  loadUserFlashcards,
  removeMistakeReviewCard,
  setMistakeReviewCardReason,
  setMistakeReviewCardSuspended,
  userFlashcardsToStudyCards,
} from '../utils/userFlashcards';
import { loadCardSchedules } from '../utils/flashcardSchedule';
import { buildFlashcardQueue } from '../utils/flashcardQueue';

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
  id: 'q-mkt-1405-12',
  nodeId: 'mkt.segmentation',
  examYear: 1405,
  bookletQuestionNumber: 12,
  courseSectionId: 'marketing',
  courseSectionTitle: 'بازاریابی',
  text: 'کدام критериی برای بخش‌بندی بازار، اندازه‌پذیری و دسترسی‌پذیری را هم‌زمان می‌سنجد؟',
  options: ['معیار جمعیت‌شناختی', 'معیار اثربخشی بخش', 'معیار جغرافیایی', 'معیار روان‌شناختی'],
  expectedTimeMs: 60_000,
};

const reveal = {
  correctOption: 1,
  explanation: 'بخش باید قابل اندازه‌گیری، قابل دسترسی و به‌اندازهٔ کافی بزرگ باشد.',
  trapNote: 'جمعیت‌شناختی فقط یک روش توصیف بخش است، نه معیار کامل اثربخشی.',
};

describe('mistake review queue', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates one due review card for a wrong answer', () => {
    const outcome = queueMistakeReview(question, 0, reveal);
    expect(outcome.queued).toBe(true);
    expect(outcome.created).toBe(true);
    expect(outcome.cardId).toBeTruthy();

    const cards = loadUserFlashcards();
    expect(cards).toHaveLength(1);
    expect(cards[0]?.front).toContain('بخش‌بندی بازار');
    expect(cards[0]?.back).toContain('معیار اثربخشی بخش');
    expect(cards[0]?.layer).toBe('L2');
    expect(cards[0]?.sourceQuestionId).toBe(question.id);
    expect(cards[0]?.sourceNodeId).toBe(question.nodeId);
    expect(cards[0]?.courseId).toBe('mkt');
    expect(cards[0]?.extra).toContain('گزینه‌ها:');
    expect(cards[0]?.extra).toContain('پاسخ شما: گزینهٔ ۱');

    const schedule = loadCardSchedules()[outcome.cardId!];
    expect(schedule).toBeTruthy();
    expect(schedule!.due).toBeLessThanOrEqual(Date.now());

    const studyCard = userFlashcardsToStudyCards(cards, () => 'بازاریابی پیشرفته')[0];
    expect(studyCard?.type).toBe('question');
    expect(studyCard?.source).toContain('مرور خطا');
    expect(studyCard?.tags).toContain('مرور خطا');

    const queue = buildFlashcardQueue(studyCard ? [studyCard] : [], loadCardSchedules(), {
      courseId: 'all',
      layer: 'all',
      mode: 'reveal',
      cap: 20,
    });
    expect(queue.cards.map((card) => card.id)).toContain(outcome.cardId);
    expect(queue.total).toBe(1);

    const typedQueue = buildFlashcardQueue(studyCard ? [studyCard] : [], loadCardSchedules(), {
      courseId: 'all',
      layer: 'all',
      mode: 'type',
      cap: 20,
    });
    expect(typedQueue.cards).toHaveLength(0);
  });

  it('updates the existing card instead of creating a duplicate', () => {
    const first = queueMistakeReview(question, 0, reveal);
    const second = queueMistakeReview(question, 2, { ...reveal, explanation: 'توضیح تازه برای همان پرسش.' });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(loadUserFlashcards()).toHaveLength(1);
    expect(loadUserFlashcards()[0]?.id).toBe(first.cardId);
    expect(loadUserFlashcards()[0]?.extra).toContain('توضیح تازه برای همان پرسش.');
    expect(loadCardSchedules()[first.cardId!]?.due).toBeLessThanOrEqual(Date.now());
  });

  it('does not create a card for correct, skipped, or ungraded answers', () => {
    expect(queueMistakeReview(question, 1, reveal).queued).toBe(false);
    expect(queueMistakeReview(question, null, reveal).queued).toBe(false);
    expect(queueMistakeReview(question, 0, null).queued).toBe(false);
    expect(queueMistakeReview(null, 0, reveal).queued).toBe(false);
    expect(loadUserFlashcards()).toHaveLength(0);
  });

  it('uses the review cap when several mistake cards are due', () => {
    for (let index = 0; index < 3; index += 1) {
      queueMistakeReview({ ...question, id: `q-mkt-${index}`, text: `${question.text} نسخهٔ ${index}` }, 0, reveal);
    }
    const cards = userFlashcardsToStudyCards(loadUserFlashcards(), () => 'بازاریابی پیشرفته');
    const queue = buildFlashcardQueue(cards, loadCardSchedules(), {
      courseId: 'all',
      layer: 'all',
      mode: 'reveal',
      cap: 2,
    });
    expect(queue.total).toBe(3);
    expect(queue.cards).toHaveLength(2);
  });

  it('keeps the full long question and links the card to its concept', () => {
    const longQuestion = {
      ...question,
      id: 'q-long',
      text: `${question.text} ${'شرط تکمیلی صورت پرسش. '.repeat(18)}`,
    };
    queueMistakeReview(longQuestion, 0, reveal);
    const card = loadUserFlashcards()[0];
    expect(card.front.length).toBeGreaterThan(160);
    expect(card.front).toContain('شرط تکمیلی صورت پرسش');
    expect(card.sourceNodeId).toBe(longQuestion.nodeId);
  });

  it('stores the mistake reason and suspends the derived card when resolved', () => {
    queueMistakeReview(question, 0, reveal);
    expect(setMistakeReviewCardReason(question.id, 'misread')).toBe(true);
    expect(loadUserFlashcards()[0]?.reviewReason).toBe('misread');

    const studyCard = userFlashcardsToStudyCards(loadUserFlashcards(), () => 'بازاریابی')[0];
    expect(studyCard?.reviewReason).toBe('misread');
    expect(studyCard?.nodeId).toBe(question.nodeId);

    expect(setMistakeReviewCardSuspended(question.id, true)).toBe(true);
    expect(userFlashcardsToStudyCards(loadUserFlashcards(), () => 'بازاریابی')).toHaveLength(0);
    expect(removeMistakeReviewCard(question.id)).toBe(true);
    expect(loadUserFlashcards()).toHaveLength(0);
  });

  it('returns a safe failure when local storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      ...createStorage(),
      setItem: () => { throw new Error('quota exceeded'); },
    });
    const outcome = queueMistakeReview(question, 0, reveal);
    expect(outcome.queued).toBe(false);
    expect(outcome.reason).toContain('ذخیره');
  });
});
