/**
 * زمان‌بندی کارت‌های مرور — یک منبع مشترک برای جلسه و کارت‌های خطا.
 *
 * از FSRS موجود در `@ael/engine` استفاده می‌کند تا با صف موتور یک الگوریتم
 * مشترک داشته باشیم. شکل ذخیره‌شدهٔ قبلی حفظ شده است و فیلدهای FSRS اختیاری
 * اضافه شده‌اند؛ دادهٔ قدیمی در اولین امتیاز به FSRS نگاشت می‌شود.
 */
import {
  initializeFSRSState,
  scheduleNextFSRS,
  Rating,
  type FSRSState,
} from '@ael/engine';

export type FlashcardRating = 1 | 2 | 3 | 4;

export interface CardSchedule {
  ease: number;
  interval: number;
  due: number;
  reps: number;
  lapses: number;
  /** وضعیت FSRS؛ برای دادهٔ قدیمی خالی است و در اولین مرور ساخته می‌شود. */
  stability?: number;
  difficulty?: number;
  lastReviewedAt?: string;
}

export const FLASHCARD_SCHEDULE_KEY = 'ael.flashcard-schedule';
export const DEFAULT_SCHEDULE: CardSchedule = { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0 };

const DAY_MS = 86_400_000;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * نگاشت زمان‌بندی قدیمی به FSRS. فاصلهٔ فعلی به‌عنوان تخمین stability و
 * ease به difficulty تبدیل می‌شود تا پیشرفت قبلی دور ریخته نشود.
 */
function legacyToFSRS(previous: CardSchedule, now: Date): FSRSState {
  const interval = Math.max(0.1, previous.interval || 0.1);
  const difficulty = clamp(10 - (clamp(previous.ease, 1.3, 3.5) - 1.3) * (5 / 1.2), 1, 10);
  return {
    stability: interval,
    difficulty,
    retrievability: 1,
    reps: previous.reps,
    lapses: previous.lapses,
    lastReviewedAt: new Date(now.getTime() - interval * DAY_MS).toISOString(),
    dueAt: new Date(previous.due || now.getTime()).toISOString(),
    intervalDays: interval,
  };
}

function currentFSRS(previous: CardSchedule, now: Date): FSRSState {
  if (
    typeof previous.stability === 'number' &&
    previous.stability > 0 &&
    typeof previous.difficulty === 'number'
  ) {
    return {
      stability: previous.stability,
      difficulty: previous.difficulty,
      retrievability: 1,
      reps: previous.reps,
      lapses: previous.lapses,
      lastReviewedAt: previous.lastReviewedAt ?? new Date(now.getTime() - Math.max(0.1, previous.interval) * DAY_MS).toISOString(),
      dueAt: new Date(previous.due || now.getTime()).toISOString(),
      intervalDays: Math.max(0, previous.interval),
    };
  }
  return legacyToFSRS(previous, now);
}

export function loadCardSchedules(): Record<string, CardSchedule> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FLASHCARD_SCHEDULE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, CardSchedule>) : {};
  } catch {
    return {};
  }
}

export function saveCardSchedules(schedules: Record<string, CardSchedule>): void {
  try {
    localStorage.setItem(FLASHCARD_SCHEDULE_KEY, JSON.stringify(schedules));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ael:flashcard-schedule-changed'));
    }
  } catch {
    // زمان‌بندی نباید جلسه را متوقف کند.
  }
}

export function updateCardSchedule(
  previous: CardSchedule,
  rating: FlashcardRating,
  now: Date = new Date(),
): CardSchedule {
  const base = previous.reps > 0 || previous.stability
    ? currentFSRS(previous, now)
    : null;
  const next = base
    ? scheduleNextFSRS(base, rating as Rating, now)
    : initializeFSRSState(rating as Rating, now);

  return {
    ...previous,
    stability: next.stability,
    difficulty: next.difficulty,
    lastReviewedAt: next.lastReviewedAt,
    interval: next.intervalDays,
    due: Date.parse(next.dueAt),
    reps: next.reps,
    lapses: next.lapses,
    ease: clamp(2.5 + (5 - next.difficulty) * 0.15, 1.3, 3.0),
  };
}

/** کارت را همین حالا سررسید می‌کند تا در جلسهٔ بعدی بالای صف دیده شود. */
export function scheduleCardNow(cardId: string): void {
  if (!cardId) return;
  const schedules = loadCardSchedules();
  const previous = schedules[cardId] ?? DEFAULT_SCHEDULE;
  schedules[cardId] = { ...previous, due: Date.now() - 1 };
  saveCardSchedules(schedules);
}
