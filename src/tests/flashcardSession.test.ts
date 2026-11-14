import { describe, expect, it } from 'vitest';
import type { StudyCard } from '../data/flashcardDeck';
import {
  MAX_SAME_SESSION_REPEATS,
  appendRepeatedCard,
  removeLastRepeatedCard,
  shouldRepeatCard,
} from '../utils/flashcardSession';

const card: StudyCard = {
  id: 'card-1',
  courseId: 'mkt',
  courseTitle: 'بازاریابی',
  front: 'پرسش',
  back: 'پاسخ',
  source: 'مرور خطا',
  layer: 'L2',
  type: 'question',
  difficulty: 'intermediate',
  origin: 'user',
  tags: ['مرور خطا'],
};

describe('flashcard session repeat', () => {
  it('repeats Again up to the limit and never repeats other ratings', () => {
    expect(shouldRepeatCard(1, 0)).toBe(true);
    expect(shouldRepeatCard(1, MAX_SAME_SESSION_REPEATS - 1)).toBe(true);
    expect(shouldRepeatCard(1, MAX_SAME_SESSION_REPEATS)).toBe(false);
    expect(shouldRepeatCard(2, 0)).toBe(false);
    expect(shouldRepeatCard(3, 0)).toBe(false);
  });

  it('appends the same card once when repeated', () => {
    const next = appendRepeatedCard([card], card, true);
    expect(next).toHaveLength(2);
    expect(next[0].id).toBe('card-1');
    expect(next[1].id).toBe('card-1');
    expect(appendRepeatedCard([card], card, false)).toHaveLength(1);
  });

  it('removes only the last matching repeat during undo', () => {
    const other = { ...card, id: 'card-2' };
    expect(removeLastRepeatedCard([card, other, card], 'card-1')).toHaveLength(2);
    expect(removeLastRepeatedCard([card, other], 'card-1')).toHaveLength(2);
    expect(removeLastRepeatedCard([], 'card-1')).toHaveLength(0);
  });
});
