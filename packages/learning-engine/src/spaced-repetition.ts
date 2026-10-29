/**
 * FSRS memory scheduler adapter.
 * The scheduler owns retrieval timing; proficiency/diagnosis is handled elsewhere.
 */
import { createEmptyCard, fsrs, Rating, type Card as FsrsCard } from 'ts-fsrs';
import type { FSRSCardState } from '@ael/contracts';

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
});

export interface ScheduledReview {
  state: FSRSCardState;
  dueAt: string;
  intervalDays: number;
}

function restoreCard(saved: FSRSCardState | undefined, now: Date): FsrsCard {
  if (!saved) return createEmptyCard(now);
  return {
    ...createEmptyCard(now),
    due: new Date(saved.due),
    stability: saved.stability,
    difficulty: saved.difficulty,
    elapsed_days: saved.elapsed_days,
    scheduled_days: saved.scheduled_days,
    reps: saved.reps,
    lapses: saved.lapses,
    state: saved.state as FsrsCard['state'],
    last_review: saved.last_review ? new Date(saved.last_review) : undefined,
  };
}

export function scheduleFsrsReview(
  previous: FSRSCardState | undefined,
  wasCorrect: boolean,
  now: Date,
): ScheduledReview {
  const current = restoreCard(previous, now);
  const next = scheduler.next(current, now, wasCorrect ? Rating.Good : Rating.Again).card;
  const state: FSRSCardState = {
    due: next.due.toISOString(),
    stability: next.stability,
    difficulty: next.difficulty,
    elapsed_days: next.elapsed_days,
    scheduled_days: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    last_review: next.last_review?.toISOString() ?? null,
  };
  return {
    state,
    dueAt: state.due,
    intervalDays: Math.max(1, Math.ceil(next.scheduled_days)),
  };
}
