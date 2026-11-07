# Branch Merge Plan — consolidation 20261107

**Base:** main `718c54c` · **Working branch:** `mission/library-10y-repository-consolidation-20261107`
**Rule applied:** no blind merge of 3 divergent branches; content-level review first.

## Merge order (dependency-first)

| Step | Action | Source | Risk | Verification gate |
|---|---|---|---|---|
| M1 | ✅ DONE — P0 data fixes on consolidation branch (exam codes, provenance downgrade, reconciliation) | direct commits `0eef570` | low | 606 tests green; ael003-inventory runs |
| M2 | ✅ RESOLVED — `content/pdf-ingest-20261106-batch26` (886 insertions: AgentSkill docs + MinerU→MD converter + PaddleOCR pilot). **Content-level verdict: SUPERSEDED** — main's production pdf-ingest pipeline (ael-pdf-scan/ingest/ocr.mjs) covers the function; tooling is duplicate documentation. DELETE_ELIGIBLE | `3de3b45` | low | esbuild green; no runtime overlap |
| M3 | ✅ RESOLVED — `design/ael-visual-card-redesign`: diff shows main REMOVES 422 lines vs branch (branch has 94-line design-tokens.css that main deleted; AelCard.tsx old prototype). The merged `feat/ael-design-integration` is the evolved version. **Content-level verdict: SUPERSEDED** — branch is the pre-merge prototype. DELETE_ELIGIBLE | `5db8186` | low | 606 tests green on main |
| M4 | ✅ RESOLVED — `fix/a19-replayable-migrations`: cherry-pick of `4103dcb` conflicted because **main already contains the a19 content** via the direct main push documented in the runbook (`d3e640d..0939e20`). Content-level diff confirms: a19 is MISSING migrations 0022-0026 (1545 lines) and telegram-inbox tests (234 lines) that main has; a19's worker diff is 6981 deletions = main has more. The 97 "unique commits" are parallel-history artifacts of the same session's work landed directly on main. **Content-level verdict: SUPERSEDED** — main is the authoritative continuation. DELETE_ELIGIBLE | `56d3149` | low | 606 tests green; migrations 0001-0026 all in main; runbook in main |
| M5 | Post-merge cleanup: `DELETE_ELIGIBLE` for the 6 fully-merged feat branches + 3 closed-no-merge branches **only after** M2–M4 land and ledger row is written per branch | — | low | ledger entries in BRANCH_ARCHIVE_AND_DELETION_LEDGER.md |

## Delete ledger (pre-filled, activation deferred to M5)

| Branch | Final SHA | Reason | Guard |
|---|---|---|---|
| feat/ael-000-mission-baseline | 21f922f | 0 unique commits vs main | after M5 evidence |
| feat/ael-admin-edu-catalog-002 | f8ec302 | 0 unique commits | after M5 |
| feat/ael-003-historical-data-modernization | f410979 | 0 unique commits | after M5 |
| feat/ael-313-pdf-ingestion | c5dd3da | 0 unique commits | after M5 |
| feat/ael-design-integration | 10ad233 | 0 unique commits | after M5 |
| feat/ael-question-explanations-001 | e86f8ca | PR #13 merged | after M5 |
| content/pdf-ingest-20261106-batch26 | 3de3b45 | SUPERSEDED: main's ael-pdf pipeline covers function | M5 activation |
| design/ael-visual-card-redesign | 5db8186 | SUPERSEDED: merged design-integration is evolved version | M5 activation |
| fix/a19-replayable-migrations | 56d3149 | SUPERSEDED: content landed on main via direct push (runbook); a19 missing 0022-0026 migrations | M5 activation |

## P0 items landed (this branch)

- exam_code 2164→2162 (courses.json ×6, exam-pack meta)
- OFFICIAL_PHD_QUESTION_BANK reconciled (38 Qs, pending_sme)
- exams/business/1404 markdown provenance downgraded (fake verified/authorized)
- 1406 spec verified honest (combinations empty, pending verification) — untouched

## Open P0/B0 (external dependency)

- `B-1` Migration replay port (M4) needs `supabase/tests/run.sh` review against local Supabase staging — defer runbook's Supabase connection requirement (unresolved since 2026-11-03 runbook).
- `B-2` Reminder crons: `wrangler.jsonc` has no triggers — P3 implements or UI disables honestly.
