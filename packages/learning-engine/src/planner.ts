/**
 * V2-074 (G-01/PLAN-01) — Budget-consistent daily planner.
 * Pure: given due items + minute budget, selects a deterministic subset
 * whose estimated minutes never exceed the budget. No I/O.
 */

export interface PlanCandidate {
  id: string;
  estimatedMinutes: number;
  /** Higher = more urgent (e.g. failed first). Ties break by id for determinism. */
  urgency: number;
}
export interface PlanSlot {
  id: string;
  reason: string;
}

export function planNextActivities(
  candidates: PlanCandidate[],
  budgetMinutes: number,
): PlanSlot[] {
  if (!Number.isFinite(budgetMinutes) || budgetMinutes < 0) throw new Error('budget must be >= 0');
  // Validate candidates
  for (const c of candidates) {
    if (!c.id) throw new Error('candidate id required');
    if (!Number.isFinite(c.estimatedMinutes) || c.estimatedMinutes < 0) throw new Error(`invalid minutes for ${c.id}`);
  }
  // Deterministic order: urgency desc, id asc
  const sorted = [...candidates].sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    return a.id.localeCompare(b.id);
  });
  const slots: PlanSlot[] = [];
  let total = 0;
  for (const c of sorted) {
    if (total + c.estimatedMinutes > budgetMinutes) continue;
    // Zero-minute items always fit; anything else must fit
    if (c.estimatedMinutes === 0 || total + c.estimatedMinutes <= budgetMinutes) {
      slots.push({ id: c.id, reason: `budget ${c.estimatedMinutes}m for ${c.id}` });
      total += c.estimatedMinutes;
    }
  }
  return slots;
}
