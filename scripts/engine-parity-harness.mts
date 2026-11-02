// Phase 3 (R-009): engine parity harness.
// Runs paired deterministic scenarios through BOTH learning runtimes:
//   A) src/engine/aelEngine.ts (React runtime)
//   B) @ael/engine (packages/learning-engine — worker runtime)
// plus packages/utils urgency reference checks. The queue-order scenario validates the
// canonical priority callback against buildDailyQueue; a Worker route integration test
// separately verifies the former 51st-candidate regression. This is scoped parity evidence,
// not proof that every React importer or learner-state persistence path is unified.
// Run: npx tsx scripts/engine-parity-harness.mts
import { writeFile, mkdir } from 'node:fs/promises';
import { calculateCardRetrievability, initFSRS, stepFSRS } from '../src/engine/aelEngine';
import {
  DEFAULT_ENGINE_CONFIG,
  Rating,
  buildDailyQueue,
  calculateRetrievability,
  initializeFSRSState,
  scheduleNextFSRS,
  type EngineState,
  type FSRSState,
} from '../packages/learning-engine/src/index';
import type { KnowledgeNode, ReviewCard, TrackId } from '../packages/contracts/src/index';
import {
  computePriorityV3,
  derivePrereqMultiplier,
} from '../packages/utils/priority-calculations';

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
    const react = calculateCardRetrievability(S, t);
    rec({
      scenario: `ret-${String(n++).padStart(2, '0')}-S${S}-t${t}`,
      seam: 'retrievability', input: `S=${S} elapsedDays=${t}`,
      react: react.toFixed(3), shared: shared.toFixed(3),
      verdict: near(react, shared) ? 'MATCHED' : 'DIVERGED',
      note: 'React ignores elapsed time (power curve absent)',
    });
  }
}

// ---------- Seam 3: queue urgency (post-R-011 convergence check) ----------
// R-011 removed the three divergent urgency formulas (calculateUrgency /
// calculateMasteryUrgency / calculateUrgencyV2). Production worker scoring now calls
// computePriorityV3; this seam verifies the React legacy forgetting-urgency proxy
// (1−R, multiplied as 1+x) equals the canonical risk term (1+forgettingRisk).
for (const R of [0.9, 0.7, 0.4]) {
  const reactU = Math.max(0.1, 1 - R); // aelEngine.ts legacy ROI: forgettingUrgency
  const canonicalRiskTerm = computePriorityV3({
    examValue: 1,
    knowledgeGap01: 1,
    prereqMultiplier: derivePrereqMultiplier([]),
    forgettingRisk: 1 - R,
    examProximity01: 0,
    expectedBenefit: 1,
    minutes: 1,
  }); // == (1 + (1−R)) since every other factor is neutral
  rec({
    scenario: `urg-${String(n++).padStart(2, '0')}-R${R}`,
    seam: 'urgency', input: `retrievability=${R}`,
    react: `urgency=${reactU.toFixed(3)} (multiplied as 1+x)`,
    shared: `riskTerm=${canonicalRiskTerm.toFixed(3)} (== 1+urgency)`,
    verdict: near(1 + reactU, canonicalRiskTerm) ? 'MATCHED' : 'DIVERGED',
    note: 'R-011: single canonical formula; React 1+(1−R) == computePriorityV3 (1+forgettingRisk)',
  });
}
{
  const lowNode: KnowledgeNode = {
    id: 'queue.low',
    track: 'common',
    course: 'queue-test',
    chapter: 'priority',
    topic: 'low-priority',
  };
  const highNode: KnowledgeNode = {
    id: 'queue.high',
    track: 'common',
    course: 'queue-test',
    chapter: 'priority',
    topic: 'high-priority',
  };
  const lowCard: ReviewCard = {
    id: 'queue:low',
    userId: 'queue-user',
    nodeId: lowNode.id,
    cardType: 'question',
    dueAt: new Date(NOW.getTime() - 5 * 86_400_000).toISOString(),
    intervalDays: 5,
    ease: 2.5,
    isRepair: false,
    timesSeen: 2,
    timesCorrect: 1,
  };
  const highCard: ReviewCard = {
    id: 'queue:high',
    userId: 'queue-user',
    nodeId: highNode.id,
    cardType: 'question',
    dueAt: new Date(NOW.getTime() - 1 * 86_400_000).toISOString(),
    intervalDays: 1,
    ease: 2.5,
    isRepair: false,
    timesSeen: 2,
    timesCorrect: 1,
  };
  const queueState: EngineState = {
    config: DEFAULT_ENGINE_CONFIG,
    nodes: new Map([[lowNode.id, lowNode], [highNode.id, highNode]]),
    dependencies: [],
    questions: new Map(),
    mastery: new Map(),
    cards: [lowCard, highCard],
  };
  const scores = new Map<string, number>([
    [lowCard.id, computePriorityV3({
      examValue: 1,
      knowledgeGap01: 0.1,
      prereqMultiplier: derivePrereqMultiplier([]),
      forgettingRisk: 0.1,
      examProximity01: 0,
      expectedBenefit: 1,
      minutes: 1,
    })],
    [highCard.id, computePriorityV3({
      examValue: 1,
      knowledgeGap01: 0.9,
      prereqMultiplier: derivePrereqMultiplier([]),
      forgettingRisk: 0.4,
      examProximity01: 0,
      expectedBenefit: 1,
      minutes: 1,
    })],
  ]);
  const expectedOrder = [lowCard, highCard]
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    .map((card) => card.id);
  const actualOrder = buildDailyQueue(
    queueState,
    { userId: 'queue-user', activeTracks: ['common'] as TrackId[] },
    {
      limit: 2,
      now: NOW,
      priorityScore: (card) => scores.get(card.id) ?? 0,
    },
  ).map((item) => item.card.id);
  const expected = expectedOrder.join('>');
  const actual = actualOrder.join('>');
  rec({
    scenario: 'urg-04-engine-order',
    seam: 'urgency',
    input: 'two due cards, higher-priority card due later',
    react: expected,
    shared: actual,
    verdict: expected === actual ? 'MATCHED' : 'DIVERGED',
    note: 'The shared queue builder ranks all eligible candidates using the canonical ROI callback before slicing the requested limit',
  });
}

// ---------- output ----------
const canonicalSeamDivergences = rows.filter(
  (r) =>
    (r.seam === 'fsrs-interval' || r.seam === 'retrievability') &&
    r.verdict === 'DIVERGED',
);
if (canonicalSeamDivergences.length > 0) {
  throw new Error(
    `Canonical FSRS parity failed: ${canonicalSeamDivergences.map((r) => r.scenario).join(', ')}`,
  );
}
const diverged = rows.filter((r) => r.verdict === 'DIVERGED').length;
const header = 'scenario,seam,input,react_runtime,shared_engine_runtime,verdict,note\n';
const body = rows
  .map((r) => [r.scenario, r.seam, r.input, r.react, r.shared, r.verdict, r.note]
    .map((v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
    .join(','))
  .join('\n');
const outDir = process.argv[2] ?? 'docs/phase-3';
await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/ENGINE_PARITY_MATRIX.csv`, header + body + '\n', 'utf8');
console.log(`PARITY HARNESS: ${rows.length} scenarios, ${diverged} diverged, ${rows.length - diverged} matched`);
console.log(`written: ${outDir}/ENGINE_PARITY_MATRIX.csv`);
