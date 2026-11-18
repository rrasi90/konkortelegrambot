/** رویدادنگاری مرور — تاریخچهٔ سبک و محلی برای کارنامه و سنجش نگهداشت. */
import type { FlashcardSessionMode } from '../data/flashcardDeck';

export type ReviewLogSource = 'flashcard' | 'question';
export type ReviewLogResult = 'correct' | 'wrong' | 'skipped';

export interface ReviewLogEntry {
  id: string;
  cardId: string;
  source: ReviewLogSource;
  at: string;
  result?: ReviewLogResult;
  rating?: 1 | 2 | 3 | 4;
  durationMs?: number;
  courseId?: string;
  courseTitle?: string;
  nodeId?: string;
  mode?: FlashcardSessionMode;
  confidence?: 1 | 2 | 3;
  intervalDays?: number;
  previousIntervalDays?: number;
}

export const REVIEW_LOG_KEY = 'ael.review.log.v1';
export const MAX_REVIEW_LOG = 1000;

function newId(): string {
  try {
    return `rlog.${crypto.randomUUID()}`;
  } catch {
    return `rlog.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function loadReviewLog(): ReviewLogEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(REVIEW_LOG_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ReviewLogEntry => {
      if (!item || typeof item !== 'object') return false;
      const entry = item as Partial<ReviewLogEntry>;
      return typeof entry.id === 'string' && typeof entry.cardId === 'string' &&
        (entry.source === 'flashcard' || entry.source === 'question') &&
        typeof entry.at === 'string';
    }).slice(0, MAX_REVIEW_LOG);
  } catch {
    return [];
  }
}

export function appendReviewLog(entry: Omit<ReviewLogEntry, 'id'>): ReviewLogEntry | null {
  try {
    const next: ReviewLogEntry = { ...entry, id: newId() };
    const entries = [next, ...loadReviewLog()].slice(0, MAX_REVIEW_LOG);
    localStorage.setItem(REVIEW_LOG_KEY, JSON.stringify(entries));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ael:review-log-changed'));
    }
    return next;
  } catch {
    return null;
  }
}

export function removeReviewLogById(id: string): void {
  if (!id) return;
  try {
    const entries = loadReviewLog().filter((entry) => entry.id !== id);
    localStorage.setItem(REVIEW_LOG_KEY, JSON.stringify(entries));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ael:review-log-changed'));
    }
  } catch {
    // واگرد زمان‌بندی مهم است؛ نبود تاریخچه نباید آن را بشکند.
  }
}

export function removeLatestReviewLog(): void {
  const latest = loadReviewLog()[0];
  if (latest) removeReviewLogById(latest.id);
}

export function clearReviewLog(): void {
  try {
    localStorage.removeItem(REVIEW_LOG_KEY);
  } catch {
    // تاریخچه اختیاری است؛ پاک‌نشدن نباید جلسه را بشکند.
  }
}
