/**
 * V2-075 (PLAN-02) — Scheduler: order due cards deterministically.
 * Pure; respects FSRS due dates and budget. Does not reschedule or mutate cards.
 */

export interface SchedulableCard {
  id: string;
  dueAt: string;
  intervalDays: number;
  isRepair: boolean;
}

export function scheduleDueCards(
  cards: SchedulableCard[],
  now: Date,
  limit: number,
): SchedulableCard[] {
  if (!Number.isInteger(limit) || limit < 0) throw new Error('limit must be an integer >= 0');
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('invalid now');
  const due = cards.filter(c => {
    const t = Date.parse(c.dueAt);
    return Number.isFinite(t) && t <= nowMs;
  });
  due.sort((a, b) => {
    // repair cards first (they are overdue), then oldest due, then interval, then id
    if (a.isRepair !== b.isRepair) return a.isRepair ? -1 : 1;
    const da = Date.parse(a.dueAt), db = Date.parse(b.dueAt);
    if (da !== db) return da - db;
    if (a.intervalDays !== b.intervalDays) return a.intervalDays - b.intervalDays;
    return a.id.localeCompare(b.id);
  });
  return due.slice(0, limit);
}
