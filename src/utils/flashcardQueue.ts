/** ساخت صف مرور از دِک و زمان‌بندی موجود؛ بدون وابستگی به دادهٔ دِک. */
import type { CardLayer, FlashcardSessionMode, StudyCard } from '../data/flashcardDeck';
import { DEFAULT_SCHEDULE, type CardSchedule } from './flashcardSchedule';
import { isTypedMode, supportsMode } from './studyModes';

export type { FlashcardSessionMode } from '../data/flashcardDeck';

export interface FlashcardQueueOptions {
  courseId: string;
  layer: 'all' | CardLayer;
  mode: FlashcardSessionMode;
  cap: number;
  now?: number;
}

export interface FlashcardQueue {
  cards: StudyCard[];
  total: number;
}

export function buildFlashcardQueue(
  deck: StudyCard[],
  schedules: Record<string, CardSchedule>,
  options: FlashcardQueueOptions,
): FlashcardQueue {
  const now = options.now ?? Date.now();
  const cap = Number.isFinite(options.cap) && options.cap > 0 ? Math.floor(options.cap) : 20;
  const pool = deck.filter((card) => {
    if (options.courseId !== 'all' && card.courseId !== options.courseId) return false;
    if (options.layer !== 'all' && card.layer !== options.layer) return false;
    // هر حالت فقط کارت‌هایی را می‌گیرد که صورت پرسش و پاسخش با آن حالت می‌خواند.
    if (isTypedMode(options.mode) && (card.front.length > 160 || card.back.length > 420)) return false;
    if (!supportsMode(card, options.mode)) return false;
    return true;
  });
  const due = pool.filter((card) => {
    const schedule = schedules[card.id] ?? DEFAULT_SCHEDULE;
    return schedule.due <= now || schedule.reps === 0;
  });
  const sorted = due.sort((a, b) => {
    const sa = schedules[a.id] ?? DEFAULT_SCHEDULE;
    const sb = schedules[b.id] ?? DEFAULT_SCHEDULE;
    if (sa.reps === 0 && sb.reps > 0) return -1;
    if (sb.reps === 0 && sa.reps > 0) return 1;
    return sa.due - sb.due;
  });
  return { cards: sorted.slice(0, cap), total: sorted.length };
}
