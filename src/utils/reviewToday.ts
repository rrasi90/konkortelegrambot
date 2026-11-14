/** صف مشترک «مرور امروز» — کارت‌های خطای سررسید، بدون واردکردن دِک کامل. */
import { buildFlashcardQueue, type FlashcardQueue } from './flashcardQueue';
import { loadCardSchedules } from './flashcardSchedule';
import { loadUserFlashcards, userFlashcardsToStudyCards } from './userFlashcards';

export function loadDueMistakeReviewQueue(
  cap = 50,
  now = Date.now(),
): FlashcardQueue {
  const cards = userFlashcardsToStudyCards(
    loadUserFlashcards(),
    () => 'مرور خطا',
  ).filter((card) => card.tags.includes('مرور خطا'));

  return buildFlashcardQueue(cards, loadCardSchedules(), {
    courseId: 'all',
    layer: 'all',
    mode: 'reveal',
    cap,
    now,
  });
}

export function countDueMistakeCards(cap = 50, now = Date.now()): number {
  return loadDueMistakeReviewQueue(cap, now).total;
}
