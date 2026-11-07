# Branch Merge Plan — consolidation 20261107

**Base:** main `718c54c` · **Working branch:** `mission/library-10y-repository-consolidation-20261107`
**Rule applied:** no blind merge of 3 divergent branches; content-level review first.

## Merge order (dependency-first)

| Step | Action | Source | Risk | Verification gate |
|---|---|---|---|---|
| M1 | ✅ DONE — P0 data fixes on consolidation branch (exam codes, provenance downgrade, reconciliation) | direct commits `0eef570` | low | 606 tests green; ael003-inventory runs |
| M2 | Evaluate `content/pdf-ingest-20261106-batch26` (`3de3b45`) — tooling commit (AgentSkill + MinerU converter + PaddleOCR pilot). Main already contains the production pdf-ingest pipeline (`scripts/ael-pdf-*.mjs`). **Decision: SUPERSEDED unless the AgentSkill file is wanted** → port only `skill/` folder if useful; otherwise DELETE_ELIGIBLE | `3de3b45` | low | diff review; no runtime overlap |
| M3 | Evaluate `design/ael-visual-card-redesign` (`5db8186`) — pre-dates merged `feat/ael-design-integration` (main already has Warm Charcoal system per commit `10ad233` + `24383b4`). **Decision: diff the design tokens/components; if main's version is the evolved one → SUPERSEDED** | `5db8186` | medium (design regression) | visual diff + component file comparison |
| M4 | `fix/a19-replayable-migrations` (97 commits) — **PARTIAL_PICK, highest value:**<br>a) `2a615b5` migration policy idempotency fix + `b07f2c4` replay harness → port supabase/tests changes<br>b) `4103dcb` rate-limit effective in dev → port apps/worker rate-limit change<br>c) evidence/register/runbook updates already in main — skip duplicates<br>**No PR exists** → create PR for the port or land on consolidation branch | cherry-pick `2a615b5`, `4103dcb` + targeted test files | medium (migrations touch) | replay harness green; 606+199 tests; migration dry-run |
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
| content/pdf-ingest-20261106-batch26 | 3de3b45 | 1 unique commit → M2 decision | after M2 |
| design/ael-visual-card-redesign | 5db8186 | 2 unique commits → M3 decision | after M3 |
| fix/a19-replayable-migrations | 56d3149 | 97 commits → M4 partial port | after M4 |

## P0 items landed (this branch)

- exam_code 2164→2162 (courses.json ×6, exam-pack meta)
- OFFICIAL_PHD_QUESTION_BANK reconciled (38 Qs, pending_sme)
- exams/business/1404 markdown provenance downgraded (fake verified/authorized)
- 1406 spec verified honest (combinations empty, pending verification) — untouched

## Open P0/B0 (external dependency)

- `B-1` Migration replay port (M4) needs `supabase/tests/run.sh` review against local Supabase staging — defer runbook's Supabase connection requirement (unresolved since 2026-11-03 runbook).
- `B-2` Reminder crons: `wrangler.jsonc` has no triggers — P3 implements or UI disables honestly.
