/** قواعد کوچک جلسهٔ مرور: برگشت «دوباره» و حذف تکرار در واگرد. */
import type { StudyCard } from '../data/flashcardDeck';
import type { FlashcardRating } from './flashcardSchedule';

export const MAX_SAME_SESSION_REPEATS = 2;

export function shouldRepeatCard(
  rating: FlashcardRating,
  repeatsSoFar: number,
  limit = MAX_SAME_SESSION_REPEATS,
): boolean {
  return rating === 1 && repeatsSoFar < Math.max(0, limit);
}

export function appendRepeatedCard(
  cards: StudyCard[],
  card: StudyCard,
  repeated: boolean,
): StudyCard[] {
  return repeated ? [...cards, card] : cards;
}

export function removeLastRepeatedCard(cards: StudyCard[], cardId: string): StudyCard[] {
  if (cards.length === 0 || cards[cards.length - 1]?.id !== cardId) return cards;
  return cards.slice(0, -1);
}
