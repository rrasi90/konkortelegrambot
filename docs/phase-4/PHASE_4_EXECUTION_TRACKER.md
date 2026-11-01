# Phase 4 execution tracker — Adaptive Learning & Exam Readiness

Branch: `fix/mission-remediation-20261101`. Statuses use the standard set only; every
`PASS_WITH_EVIDENCE` row links to archived command output or a passing test id.

| Mission § | Scope | Status | Evidence |
|---|---|---|---|
| 8.1 Diagnostic | Server-issued diagnostic attempt tickets, UNKNOWN initial state (no fabricated 50%), diversification across course groups, conservative prerequisite treatment of unassessed nodes, fail-closed issuance | PASS_WITH_EVIDENCE | `apps/worker/src/index.ts` `/api/diagnostic`; worker tests §8.1 describe (6 tests) — `evidence/phase-4/vitest-r011-diagnostic.txt` (173/173); DB reason constraint — `evidence/phase-4/integrity-diagnostic-reason.txt` (EXIT=0) |
| 8.2 Mastery engine | 7 separated evidence layers; self-report never raises proficiency; holdout gate for proven/mastered; multi-factor confidence (density × accuracy × variety × recency); slip protection | PASS_WITH_EVIDENCE | `packages/learning-engine/src/fsrs.ts` `update6DLearnerSkillState`; `packages/learning-engine/tests/fsrs.test.ts` — `evidence/phase-4/vitest-r011-mastery82.txt` (178/178) |
| 8.3 FSRS reference tests | Scheduler pinned to published FSRS-5 spec via independently re-derived constants; oracle library version recorded; deviations documented, not hidden | PASS_WITH_EVIDENCE | `packages/learning-engine/tests/fsrs-reference.test.ts` (20 tests) — `evidence/phase-4/vitest-fsrs83.txt` (198/198 suite), `evidence/phase-4/typecheck-fsrs83.txt`, `evidence/phase-4/build-worker-fsrs83.txt` |
| 8.4 Adaptive planner | Inverted risk division fixed (R-011); 8 monotonicity properties with property tests | PASS_WITH_EVIDENCE | `packages/utils/tests/priority-calculations.test.ts` (22 tests) — `evidence/phase-4/vitest-r011.txt`; register row R-011 |
| 8.5 Daily queue budget | Explicit budget rule: proof = prior commitment (counted first), spendable items never break `budget − proofMinutes`; exact sum invariants; per-item activityType + remedial reason persisted; doc rule == code | PASS_WITH_EVIDENCE | `apps/worker/src/index.ts` GET /api/queue; `ADAPTIVE_PLANNER.md` §Daily Queue Budget Rule; worker tests §8.5 (3 tests, 48/48 file) — `evidence/phase-4/vitest-budget85.txt` (201/201), `typecheck-budget85.txt`, `build-worker-budget85.txt` |
| 8.6 Error analysis | 10 mission error causes implemented as an explicit priority-ordered classifier over observable evidence only (slip, time_pressure, recall_failure, theory_confusion, misconception, calculation_error, reading_error, guessing, knowledge_gap, concept_gap) + `unknown` when evidence insufficient — an error is never a definitive chapter weakness; error wave governed by documented rules (slip stops wave, ripple only below mastery 60, capacity 6 with honest deferred count, sibling baseline stored once) | PASS_WITH_EVIDENCE | `packages/learning-engine/src/fsrs.ts` `classifyErrorType`; `packages/learning-engine/src/index.ts` `ERROR_WAVE_RULES` + evidence wiring; tests: classifier 14 tests incl. all-10-distinct coverage, slip-suppression + capacity + threshold wave tests — `evidence/phase-4/vitest-errors86.txt` (210/210), `typecheck-errors86.txt`, `build-worker-errors86.txt` |
| 8.7 Exam simulation | Single level-aware structure source (`@ael/contracts`): PhD 2162 vs Master 1142 have distinct titles/codes; per-year coefficients, official counts (spec range 80–90, language 40), durations (105/40), negative marking (1/3) and aptitude removal from 1405; optional official combination code validated against the sub-group mapping; answer sheet with single-use tickets, out-of-order answering, server-side correctness only, official weighted scoring + confidence report. Master simulation is refused server-side with an explicit content-gap reason; 1404 is quarantined; unlabeled/demo content is disclosed as readiness assessment, never as an official past-paper simulator; per-subject allocation is explicitly pooled because official per-subject counts are not recorded | PASS_WITH_EVIDENCE | `packages/contracts/src/exam-structure.ts`, `packages/learning-engine/src/exam-simulation.ts`, `apps/worker/src/index.ts` (`/api/exam-structure`, `/api/exam-simulation/*`), `supabase/migrations/0012_exam_simulation_sessions.sql`; tests: engine 19 + worker 19 — `evidence/phase-4/vitest-exam87-engine.txt` (99/99), `vitest-exam87-worker.txt` (70/70), `vitest-exam87-all.txt` (248/248), `typecheck-exam87-*.txt`, `build-worker-exam87.txt`, `content-validate-exam87.txt`; DB RPC/RLS all error codes — `db-migration-0012-apply.txt`, `db-verify-exam87.txt`, `db-seed-provenance-exam87.txt`; manifest `exam87-run-manifest.txt` |
| 8.8 English module | 10-skill taxonomy beyond word lists: vocabulary-in-context, word formation/collocation, grammar-in-context, cloze/cohesion, main idea, detail scanning, inference/stance, reference, paraphrase, time strategy — each an independent knowledge node with a proposed prerequisite DAG; `GET /api/english/skills` reports real per-skill question coverage, assessment state and mastery from actual evidence (no default 50), excludes quarantined 1404, and exposes `contentGap`/`operational` flags; self-report never substitutes for assessment | BLOCKED | Code+test IMPLEMENTED and verified: `packages/contracts/src/english-skills.ts`, `supabase/seeds/0002_english_skills.sql`, `apps/worker/src/index.ts` (`/api/english/skills`), `apps/worker/tests/english-skills.test.ts` (6 tests) — `evidence/phase-4/vitest-english88.txt` (254/254), `typecheck-english88-contracts.txt`, `typecheck-english88-worker.txt`, `typecheck-english88-root.txt`, `build-worker-english88.txt`, `db-seed-english88.txt`, `db-verify-english88.txt` (10 nodes, 0 questions, 0 non-common), `verify-english-88.sql`. Operational use BLOCKED: the server pool has zero labeled English questions/passages, so every skill reports `questionCount=0`, `operational=false`, and the taxonomy is `proposed_curriculum_pending_sme`; no mastery or skill performance is fabricated |
| 8.9 Research lab | 11 capabilities; AI strictly as sourced assistant | NOT_STARTED | — |
| 8.10 Analytics dashboard | 13 real learning metrics; logins/streak/XP must not substitute | NOT_STARTED | — |

## §8.8 content boundary (designed vs implemented vs proven)

- **Implemented and proven:** the 10-skill structure is a first-class taxonomy in `@ael/contracts`
  with unique ids/node ids and an acyclic prerequisite list; the seed inserts the 10 nodes; the API
  reports coverage and assessment per skill from real state and explicitly lists missing-content
  skills. Worker tests assert unique ids, valid prerequisites, 1404 exclusion, no fabricated mastery,
  and that a visible question alone does not create assessment.
- **Not proven / external blocker:** there is no labeled English content in the server pool
  (`db-verify-english88.txt`: 0 English questions). The endpoint therefore returns
  `englishQuestionCount=0`, `contentGap` = all 10 skills, `operational=false`. Until graded English
  questions and reading passages are imported and the taxonomy is SME-verified, the module cannot
  teach or assess any skill. The word-list-only alternative is explicitly rejected by the design.
- **No invented numbers:** no official English question count, coefficient, difficulty or skill
  weight is derived from the taxonomy; it is a proposed curriculum, not an official document.


## §8.7 content boundary (designed vs implemented vs proven)

- **Implemented and proven:** the simulator mechanics follow the same-year official structure
  (counts, coefficients, durations, negative marking, weighted scoring, confidence, answer sheet).
  Level separation and ticket enforcement are covered by engine/worker tests and by the DB RPC
  verification (`evidence/phase-4/db-verify-exam87.txt`).
- **Content dependency (not a code gap):** a session is labeled `official_booklet` only when every
  used question carries `examLevel=doctorate` and `contentOrigin=official_booklet`. The current
  server pool is demo/designed, so sessions report `scaled_pool`/`mixed` and state they are
  readiness assessments. Importing a provenance-labeled official pool is required before any
  "official past-paper simulator" claim; the import script now carries these labels.
- **Master (1142):** no server-verified Master question pool exists, so simulation returns 503 with
  the documented content-gap reason; it is never rendered as the PhD path.
- **Per-subject quotas:** the official structure records bundle titles, not per-subject counts.
  Specialization allocation is therefore pooled (`subjectAllocation: 'pooled'`) and disclosed;
  no per-subject share is invented.

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
