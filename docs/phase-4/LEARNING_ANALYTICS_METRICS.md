# §8.10 — Learning analytics metric catalog

Endpoint: `GET /api/analytics/learning` (authenticated). Implementation:
`apps/worker/src/index.ts`; storage primitives: `listAnswersSince`, `listMasteryHistorySince`,
`listMastery`, `listCards`, `getSkillStates`, `listQuestions`, `listNodes`.

## Rule

Every metric is derived from learning evidence (answers, mastery, FSRS cards, skill states,
mastery history). If the evidence does not exist, the metric is `null` or `0` together with a
zero denominator — never a default mastery of 50 and never an inferred weakness. Logins, streak,
XP, coins and session counts are **not** learning metrics and are not computed; the response lists
them under `excludedVanityMetrics` so their absence is explicit and testable.

## The 13 metrics

| # | Key | Source | Definition / null behavior |
|---|---|---|---|
| 1 | `assessedNodeCount` | `user_node_mastery ∩ assessable visible nodes` | Nodes with real answer evidence. Only mastery rows count; default 50 is not an assessment. |
| 2 | `assessableNodeCount` | `knowledge_nodes` + non-quarantined `questions` | Visible nodes (common or active tracks) with ≥1 question; `examYear = 1404` excluded. |
| 3 | `diagnosticCoverageRatio` | 1 ÷ 2 | 3-decimal ratio. `null` when there are no assessable nodes. |
| 4 | `masteryDistribution` | mastery rows of assessed nodes | Counts for `weak < 40`, `unstable 40–59.99`, `learning 60–84.99`, `mastered ≥ 85`. Unassessed nodes are not counted. |
| 5 | `meanMasteryAssessed` | mastery rows of assessed nodes | Mean over assessed nodes only; `null` when none. |
| 6 | `medianMasteryAssessed` | same | Median (average of middle pair for even counts); `null` when none. |
| 7 | `recentAccuracy30d` | `answer_events` last 30 days | Correct ÷ answered on visible nodes; `null` when no evidence. Exam-simulation responses are stored separately and are not answer events. |
| 8 | `recentEvidenceCount30d` | same | Volume behind metric 7; rates without volume are not interpreted. |
| 9 | `dueReviewCount` | `review_cards` | Visible cards with `dueAt ≤ now`; real review load. |
| 10 | `meanRetrievability` | FSRS card state | Mean `calculateRetrievability(stability, daysSinceReview)`; cards without FSRS state excluded; `null` when none. |
| 11 | `errorTypeDistribution` | `learner_skill_states.dominantErrorType` | Counts for the 10 mission causes plus `unknown` and `none`. `unknown` means insufficient evidence, never a chapter weakness. |
| 12 | `proofCoverage` | skill states | `provenOrMasteredSkills / totalSkills`; proof/holdout-gated statuses only. `ratio` null when no skills exist. |
| 13 | `learningVelocity7d` | `mastery_history` last 7 days | Sum of `new_score − previous_score` for transition rows (backfill rows without `previous_score` excluded), plus changed-node count. |

## Limitations recorded, not hidden

- The mission's itemized 13-metric list is not present in this repository. This catalog was
  authored from data the engine actually stores; it does not claim to reproduce an unavailable
  external list verbatim.
- Metrics 1–6 depend on diagnostic/practice evidence; a new account reports coverage 0 and null
  means, which is correct, not a failure.
- Metric 7 can only be computed from `answer_events`; a learner who only runs exam simulations will
  see `null` accuracy here (simulation reports carry their own scoring).
- No metric is adjusted for selection bias or content difficulty; they are descriptive, not
  psychometric estimates.

## Evidence

- `evidence/phase-4/vitest-analytics810.txt` — 259/259 tests, including 5 endpoint tests:
  13-metric catalog, vanity-key absence, null-on-no-evidence, real-value computation, 1404 exclusion.
- `evidence/phase-4/typecheck-analytics810-*.txt`, `build-worker-analytics810.txt`.
