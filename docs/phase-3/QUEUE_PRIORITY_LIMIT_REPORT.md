# Queue candidate ranking correction — PR #7

**Status:** CI verified on PR head; not a production release.  
**PR:** https://github.com/rrasi90/konkortelegrambot/pull/7  
**Head:** `382742f2cc57008d5adb30e6e44e40f33c4e23ac`  
**Workflow run:** https://github.com/rrasi90/konkortelegrambot/actions/runs/41431652931

## Defect

The Worker previously asked `buildDailyQueue` for 50 due cards sorted by due time, then calculated ROI only for those 50. A high-priority card ranked 51st by due date could therefore never reach the ROI selection stage. Commute-mode filtering also happened after that candidate cap.

## Correction

- `buildDailyQueue` now supports `includeCard` and `priorityScore` callbacks.
- Track/mode eligibility is applied before ranking.
- Every due, eligible candidate receives one score; only then does the builder apply the candidate limit.
- Equal scores retain due-date ordering as a stable tie-breaker.
- Worker uses one cached score function for both initial candidate ranking and final budget selection, avoiding a second score calculation from a slightly different clock reading.
- Proof-card promotion invalidates the corresponding cached score so the activity type is recalculated correctly.

## Regression coverage

- Learning-engine unit test: a later-due card with higher priority wins with `limit=1`; a commute-excluded high-scoring card is filtered before the score callback.
- Tie-break test: equal priorities keep earlier due date first.
- Worker route integration test: 50 low-priority cards are due before one higher-priority card; the higher-priority card is selected from the actual `/api/queue?limit=1` route.
- Parity harness queue scenario now executes the real `buildDailyQueue` priority callback rather than recording a hard-coded divergence.

## CI evidence

| Check | Result |
|---|---:|
| `npm ci` | PASS |
| TypeScript typecheck | PASS |
| Vitest | 288/288, 19 files |
| Engine parity harness | 21/21 MATCHED |
| Content validation | PASS |
| PostgreSQL migrations and integrity | PASS |

## Remaining scope

This closes the measured queue-ordering seam. It does **not** complete the 16 React legacy-importer migration or the React→Worker/Supabase learner-store convergence. Those remain R-009/R-025 work. Production release remains NO-GO / DEFER.
