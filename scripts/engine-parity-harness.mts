// Phase 3 (R-009): engine parity harness.
// Runs paired deterministic scenarios through BOTH learning runtimes:
//   A) src/engine/aelEngine.ts (React runtime)
//   B) @ael/engine (packages/learning-engine — worker runtime)
// plus packages/utils urgency (third variant) and records MATCHED/DIVERGED per
// scenario. This is a divergence map for the Phase-4 unification, NOT a parity claim.
// Run: npx tsx scripts/engine-parity-harness.mts
import { writeFile, mkdir } from 'node:fs/promises';
import { initFSRS, stepFSRS } from '../src/engine/aelEngine';
import {
  Rating,
  calculateRetrievability,
  initializeFSRSState,
  scheduleNextFSRS,
  type FSRSState,
} from '../packages/learning-engine/src/index';
import { calculateUrgencyV2 } from '../packages/utils/priority-calculations';

type Row = {
  scenario: string;
  seam: string;
  input: string;
  react: string;
  shared: string;
  verdict: 'MATCHED' | 'DIVERGED';
  note: string;
};
const rows: Row[] = [];
const NOW = new Date('2026-11-01T12:00:00Z');
const near = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const rec = (r: Row) => rows.push(r);

// ---------- Seam 1: FSRS scheduling (10 scenarios) ----------
// fresh card rated Easy
{
  const r0 = initFSRS(NOW);
  const react = stepFSRS(r0, 4, NOW);
  const shared = initializeFSRSState(Rating.Easy, NOW);
  rec({
    scenario: 'fsrs-01-fresh-easy', seam: 'fsrs-interval', input: 'brand-new card, rating=Easy(4)',
    react: String(react.intervalDays), shared: String(shared.intervalDays),
    verdict: near(react.intervalDays, shared.intervalDays) ? 'MATCHED' : 'DIVERGED',
    note: 'React: stepFSRS on hand-made init; shared: FSRS-5 init weights',
  });
}
// transitions from known (S,D)
const bases: Array<[number, number, number]> = [
  [2.5, 5.0, 2], // S, D, days since last review
  [8.0, 6.0, 5],
];
let n = 2;
for (const [S, D, elapsed] of bases) {
  for (const grade of [1, 2, 3, 4] as const) {
    const reactPrev = {
      stability: S, difficulty: D, retrievability: 0.9, reps: 3, lapses: 0,
      lastReviewedAt: new Date(NOW.getTime() - elapsed * 86_400_000).toISOString(),
      dueAt: NOW.toISOString(), intervalDays: Math.round(S),
    };
    const react = stepFSRS(reactPrev, grade, NOW);
    const sharedPrev: FSRSState = { ...reactPrev, intervalDays: Math.round(S) } as FSRSState;
    const shared = scheduleNextFSRS(sharedPrev, grade as Rating, NOW);
    rec({
      scenario: `fsrs-${String(n).padStart(2, '0')}-S${S}-g${grade}`,
      seam: 'fsrs-interval',
      input: `S=${S} D=${D} elapsed=${elapsed}d rating=${grade}`,
      react: String(react.intervalDays), shared: String(shared.intervalDays),
      verdict: near(react.intervalDays, shared.intervalDays) ? 'MATCHED' : 'DIVERGED',
      note: react.intervalDays === shared.intervalDays ? 'exact' : 'different growth formulas',
    });
    n++;
  }
  // lapse case
  {
    const grade = 1;
    const reactPrev = {
      stability: S, difficulty: D, retrievability: 0.5, reps: 4, lapses: 1,
      lastReviewedAt: new Date(NOW.getTime() - elapsed * 86_400_000).toISOString(),
      dueAt: NOW.toISOString(), intervalDays: Math.round(S),
    };
    const react = stepFSRS(reactPrev, grade, NOW);
    const shared = scheduleNextFSRS(reactPrev as FSRSState, grade as Rating, NOW);
    rec({
      scenario: `fsrs-${String(n).padStart(2, '0')}-S${S}-lapse`,
      seam: 'fsrs-interval', input: `lapse at S=${S} elapsed=${elapsed}d`,
      react: String(react.intervalDays), shared: String(shared.intervalDays),
      verdict: near(react.intervalDays, shared.intervalDays) ? 'MATCHED' : 'DIVERGED',
      note: 'relearn after failure',
    });
    n++;
  }
}

// ---------- Seam 2: retrievability model (6 scenarios) ----------
for (const S of [1.5, 3, 7]) {
  for (const t of [1, 4]) {
    const shared = calculateRetrievability(S, t);
    // React runtime proxy used inside stepFSRS: 0.88 + 0.01*S (ignores elapsed time)
    const react = Math.min(0.99, 0.88 + 0.01 * S);
    rec({
      scenario: `ret-${String(n++).padStart(2, '0')}-S${S}-t${t}`,
      seam: 'retrievability', input: `S=${S} elapsedDays=${t}`,
      react: react.toFixed(3), shared: shared.toFixed(3),
      verdict: near(react, shared) ? 'MATCHED' : 'DIVERGED',
      note: 'React ignores elapsed time (power curve absent)',
    });
  }
}

// ---------- Seam 3: queue urgency (4 scenarios) ----------
for (const overdueDays of [0, 3, 10]) {
  const dueAt = new Date(NOW.getTime() - overdueDays * 86_400_000).toISOString();
  const R = overdueDays === 0 ? 0.9 : overdueDays === 3 ? 0.7 : 0.4;
  const sharedU = calculateUrgencyV2(
    { intervalDays: 5, dueAt, nodeId: 'n1' },
    { masteryMap: new Map([['n1', 60]]), fsrsRetentionMap: new Map([['n1', R]]), examDate: new Date(NOW.getTime() + 45 * 86_400_000) },
    NOW,
  );
  const reactU = Math.max(0.1, 1 - R); // aelEngine.ts:1532 forgettingUrgency (multiplier form)
  rec({
    scenario: `urg-${String(n++).padStart(2, '0')}-overdue${overdueDays}`,
    seam: 'urgency', input: `overdue=${overdueDays}d R=${R}`,
    react: `1-R=${reactU.toFixed(3)} (multiplied as 1+x)`, shared: `UrgencyV2=${sharedU.toFixed(3)}`,
    verdict: 'DIVERGED',
    note: 'engine queue (buildDailyQueue) ignores urgency entirely — due-time sort only; three different semantics',
  });
}
rec({
  scenario: 'urg-04-engine-order',
  seam: 'urgency', input: 'two due cards, higher-urgency due later',
  react: 'ROI-ordered (priorityScore/urgency)', shared: 'dueAt-ordered (no urgency term)',
  verdict: 'DIVERGED', note: 'unify in Phase 4 (R-011)',
});

// ---------- output ----------
const diverged = rows.filter((r) => r.verdict === 'DIVERGED').length;
const header = 'scenario,seam,input,react_runtime,shared_engine_runtime,verdict,note\n';
const body = rows
  .map((r) => [r.scenario, r.seam, r.input, r.react, r.shared, r.verdict, r.note]
    .map((v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
    .join(','))
  .join('\n');
await mkdir('docs/phase-3', { recursive: true });
await writeFile('docs/phase-3/ENGINE_PARITY_MATRIX.csv', header + body + '\n', 'utf8');
console.log(`PARITY HARNESS: ${rows.length} scenarios, ${diverged} diverged, ${rows.length - diverged} matched`);
console.log('written: docs/phase-3/ENGINE_PARITY_MATRIX.csv');
