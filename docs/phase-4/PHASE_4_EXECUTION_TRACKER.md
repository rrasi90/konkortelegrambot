# Phase 4 execution tracker — Adaptive Learning & Exam Readiness

Branch: `fix/mission-remediation-20261101`. Statuses use the standard set only; every
`PASS_WITH_EVIDENCE` row links to archived command output or a passing test id.

| Mission § | Scope | Status | Evidence |
|---|---|---|---|
| 8.1 Diagnostic | Server-issued diagnostic attempt tickets, UNKNOWN initial state (no fabricated 50%), diversification across course groups, conservative prerequisite treatment of unassessed nodes, fail-closed issuance | PASS_WITH_EVIDENCE | `apps/worker/src/index.ts` `/api/diagnostic`; worker tests §8.1 describe (6 tests) — `evidence/phase-4/vitest-r011-diagnostic.txt` (173/173); DB reason constraint — `evidence/phase-4/integrity-diagnostic-reason.txt` (EXIT=0) |
| 8.2 Mastery engine | 7 separated evidence layers; self-report never raises proficiency; holdout gate for proven/mastered; multi-factor confidence (density × accuracy × variety × recency); slip protection | PASS_WITH_EVIDENCE | `packages/learning-engine/src/fsrs.ts` `update6DLearnerSkillState`; `packages/learning-engine/tests/fsrs.test.ts` — `evidence/phase-4/vitest-r011-mastery82.txt` (178/178) |
| 8.3 FSRS reference tests | Scheduler pinned to published FSRS-5 spec via independently re-derived constants; oracle library version recorded; deviations documented, not hidden | PASS_WITH_EVIDENCE | `packages/learning-engine/tests/fsrs-reference.test.ts` (20 tests) — `evidence/phase-4/vitest-fsrs83.txt` (198/198 suite), `evidence/phase-4/typecheck-fsrs83.txt`, `evidence/phase-4/build-worker-fsrs83.txt` |
| 8.4 Adaptive planner | Inverted risk division fixed (R-011); 8 monotonicity properties with property tests | PASS_WITH_EVIDENCE | `packages/utils/tests/priority-calculations.test.ts` (22 tests) — `evidence/phase-4/vitest-r011.txt`; register row R-011 |
| 8.5 Daily queue budget | Mixed activity types; total planned time == user budget | NOT_STARTED | — |
| 8.6 Error analysis | 10 error causes; controlled error wave with explicit rules | NOT_STARTED | — |
| 8.7 Exam simulation | Official structure per year (combos, counts, coefficients, time, negative marking, answer sheet, scoring, report); MA vs PhD distinct paths | NOT_STARTED | — |
| 8.8 English module | 10 skills beyond word lists | NOT_STARTED | — |
| 8.9 Research lab | 11 capabilities; AI strictly as sourced assistant | NOT_STARTED | — |
| 8.10 Analytics dashboard | 13 real learning metrics; logins/streak/XP must not substitute | NOT_STARTED | — |

## §8.3 reference-and-deviation registry (mission: "record reference library version and parameters")

- Reference spec: open-spaced-repetition **FSRS-5** constants, re-derived inside the test file
  (DECAY = −0.5, FACTOR = 19/81) — acceptance values are computed independently of the module under test.
- Oracle library: **ts-fsrs@6.0.0** (devDependency; `FSRSVersion` export asserts `v6.0.0`).
  ts-fsrs 6.0.0 ships the **FSRS-6** model (decay −0.1542, short-term w[20] modulation) and cannot run the
  FSRS-5 curve (`preset: 'fsrs5'` does not change the model). Cross-agreement is therefore asserted only at
  the points where both curves coincide by definition (R(S,S) = 0.9 for integral S ≥ 1) and the deviation is
  asserted in-test, not hidden.
- Our parameters: `DEFAULT_FSRS_WEIGHTS` = 17-param FSRS-5 set; `w[0..3] = (0.4, 1.2, 3.2, 8.0)` are a
  deliberate recalibration for academic MCQ versus published FSRS-5 defaults (0.4025, 1.1822, 3.1213, 8.0).
  The test asserts this difference explicitly so it can never be mistaken for agreement with published defaults.
- Storage convention: engine rounds D/S to 2 decimals on persist (documented in ARC-02); reference tests
  reproduce transitions with the same convention.

## "Prevent multiple concurrent FSRS formulas"

Canonical runtime: `packages/learning-engine/src/fsrs.ts` (@ael/engine, ARC-01). The React legacy engine
(`src/engine/aelEngine.ts` `stepFSRS`/retrievability heuristic) remains a **second, divergent formula** in the
codebase; its removal is tracked as R-009 (Phase 5 legacy migration — 16 remaining importers). Until that
migration, parity is monitored through `scripts/engine-parity-harness.mts` (post-R-011 matrix:
`docs/phase-4/ENGINE_PARITY_MATRIX.csv`, 8 matched / 13 diverged, residual divergences all due-sort/legacy-queue).
