# FSRS convergence slice — PR #6

**Status:** CI verified on the PR head; scoped convergence only.  
**PR:** https://github.com/rrasi90/konkortelegrambot/pull/6  
**Head:** `e78eb20418336ef77c048aa55647e996b0f91fb9`  
**Workflow run:** https://github.com/rrasi90/konkortelegrambot/actions/runs/41430029958

## Changes

- React legacy `stepFSRS` now delegates first-review initialization to `initializeFSRSState` and later transitions to `scheduleNextFSRS` from `@ael/engine`.
- The legacy zero-stability value remains a not-yet-reviewed sentinel; it is not treated as an already scheduled review.
- React's retrievability adapter delegates to the canonical FSRS forgetting curve.
- Error classification in `@ael/engine` recomputes current retrievability from stability and elapsed time since `lastReviewedAt`; stale persisted R is no longer used as current memory evidence.
- Lesson self-ratings update learning-path metadata but do not overwrite FSRS stability/retrievability without an actual review.
- Regression tests and CI parity enforcement were added.

## Verification

| Check | Result |
|---|---:|
| `npm ci` | PASS |
| TypeScript typecheck | PASS |
| Vitest | 285/285, 19 files |
| Database migrations and integrity | PASS |
| Content validation | 2 packs valid |
| Engine parity harness | 20 MATCHED / 1 DIVERGED |

The 21 parity scenarios break down as follows: 11/11 FSRS interval/state matched; 6/6 retrievability matched; 3/3 urgency-factor cases matched; queue ordering remains the sole divergent scenario.

## Remaining work — not closed by this PR

- `@ael/engine.buildDailyQueue` still sorts by `dueAt`, while the Worker queue applies the canonical priority score. This is the remaining measured parity divergence.
- The React application still has 16 legacy-engine importers.
- React learner state is still persisted through Telegram/LocalStorage; the React client has not yet converged on the Worker/Supabase learner store.
- Full E2E across Telegram-hosted staging, real participant pilot, SME content approval, stress testing, external pentest and production release remain out of scope.

**Release decision remains NO-GO / DEFER.** This change must not be interpreted as full engine or store unification.
