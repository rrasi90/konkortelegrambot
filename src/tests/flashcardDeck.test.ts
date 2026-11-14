import { describe, expect, it } from 'vitest';
import {
  ANKI_STUDY_CARDS,
  BUILT_IN_STUDY_DECK,
  DECK_STATS,
  isTypedAnswerCorrect,
  normalizeCardText,
} from '../data/flashcardDeck';

describe('flashcard deck rescue', () => {
  it('keeps only usable text-only Anki cards', () => {
    expect(ANKI_STUDY_CARDS).toHaveLength(430);
    expect(DECK_STATS.ankiRaw).toBe(873);
    expect(DECK_STATS.quarantinedImages).toBe(443);
  });

  it('has no image cards, empty backs, or duplicate fronts', () => {
    const fronts = new Set<string>();
    for (const card of ANKI_STUDY_CARDS) {
      expect(card.back.length).toBeGreaterThanOrEqual(10);
      expect(card.back).not.toMatch(/<img\s/i);
      fronts.add(normalizeCardText(card.front));
    }
    expect(fronts.size).toBe(ANKI_STUDY_CARDS.length);
  });

  it('combines authored and rescued Anki cards', () => {
    expect(BUILT_IN_STUDY_DECK.length).toBeGreaterThan(490);
    expect(BUILT_IN_STUDY_DECK.some((card) => card.origin === 'anki')).toBe(true);
    expect(BUILT_IN_STUDY_DECK.some((card) => card.origin === 'authored')).toBe(true);
  });

  it('accepts a close typed answer but not an unrelated one', () => {
    expect(isTypedAnswerCorrect('نیاز پنهان', 'نیاز پنهان')).toBe(true);
    expect(isTypedAnswerCorrect('نیاز پنهان', 'نیاز آشکار')).toBe(false);
  });
});
