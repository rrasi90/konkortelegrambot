import { describe, expect, it } from 'vitest';
import { ANKI_IMPORTED_FLASHCARDS } from '../data/flashcardsAnkiImport';
import { ANKI_STUDY_CARDS, BUILT_IN_STUDY_DECK, DECK_STATS } from '../data/flashcardDeck';
import { FLASHCARD_REWRITES, REWRITTEN_CARD_COUNT } from '../data/flashcardRewrites';

describe('کیفیت کارت‌های مطالعه', () => {
  it('حداقل ۵۰ کارت انکی به پرسش قابل‌بازیابی بازنویسی شده‌اند', () => {
    expect(REWRITTEN_CARD_COUNT).toBeGreaterThanOrEqual(50);
    const rewritten = ANKI_STUDY_CARDS.filter((card) => card.tags.includes('rewritten'));
    expect(rewritten.length).toBe(REWRITTEN_CARD_COUNT);
    for (const [id, rewrite] of Object.entries(FLASHCARD_REWRITES)) {
      const original = ANKI_IMPORTED_FLASHCARDS.find((card) => card.id === id);
      expect(original, `کارت خام ${id}`).toBeTruthy();
      expect(rewrite.front).not.toBe(original?.front);
      expect(rewrite.front.length).toBeGreaterThan(8);
    }
  });

  it('کارت‌های تصویری و ناقص در جلسهٔ مرور نمایش داده نمی‌شوند', () => {
    expect(DECK_STATS.quarantinedImages).toBeGreaterThan(0);
    expect(BUILT_IN_STUDY_DECK.every((card) => !/<img/i.test(card.front + card.back))).toBe(true);
    expect(ANKI_STUDY_CARDS.every((card) => card.front.length > 0 && card.back.length >= 10)).toBe(true);
    const imageCard = ANKI_IMPORTED_FLASHCARDS.find(
      (card) => /<img/i.test(card.front) || /<img/i.test(card.back)
    );
    expect(imageCard).toBeTruthy();
    expect(ANKI_STUDY_CARDS.some((card) => card.id === `anki.${imageCard?.id}`)).toBe(false);
  });

  it('برچسب‌های بی‌صورت‌سؤال در دِک مطالعه نمی‌مانند', () => {
    expect(DECK_STATS.quarantinedIncomplete).toBeGreaterThan(0);
    expect(
      BUILT_IN_STUDY_DECK.every(
        (card) => !/^(نکته|نکته\s*[۰-۹0-9]+|تست|سؤال)$/.test(card.front)
      )
    ).toBe(true);
  });
});
