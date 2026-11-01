# Branch & PR Audit — Phase 0

Baseline: `main = d7c8dd0` (2026-11-01). Fetch: `git fetch origin --prune` at 18:32 local.

## Remote branches (ahead/behind vs main)

| Branch | Head | Ahead | Behind | Assessment |
|---|---|---|---|---|
| `fix/critical-learning-integrity-20261101` (PR #3) | a2fb50d | 46 | 7 | **Valuable.** Learning-integrity + security fixes (ticket-derived attempt type, forged-proof rejection, self-report cannot clear remediation, `0009_secure_attempt_ticket_enforcement.sql`, honesty fixes to predictor claims). ~10 conflict regions vs main (touches same files as d7c8dd0). **Do not auto-merge; port selectively.** |
| `phase-1/scientific-foundation` (PR #4) | 3cce67b | 2 | 1 | **Valuable.** Restructured Phase-1 docs under `docs/phase-1/`, honest SOURCE_REGISTRY (per-source `accessed`/`contentVerified`/`contentNotVerified`, real URLs, documented HTTP-403 limits), `EXAM_COMBINATIONS_1405_BASELINE.csv` (combination codes 1..7 vs set 2162 properly separated), new real validator `scripts/validate-phase-1-foundation.mjs`. Merges with **zero conflicts**. No code/test for engine; docs+data+validator only. |
| `fix/adaptive-engine-hardening-20261029` | 867e039 | 91 | 49 | Large divergence (Oct 29). Superseded by later integrity work; needs file-by-file archaeology before reuse. LOW merge value vs cost. |
| `feat/adaptive-engine-foundation` | 110a504 | 8 | 54 | Old foundation branch; content already flowed into main-era packages. No unique value found in quick scan. |
| `fix/adaptive-core-hardening-2026-10-29` | 9e38e16 | 0 | 49 | Fully merged into main lineage. No action. |
| `deploy/free-telegram-mvp` | f782488 | 0 | 30 | Fully merged. Deployment-era branch; keep as tag reference. |
| `fix/complete-audit-and-security-hardening` | 32cc35a | 1 | 36 | One stray commit; inspect `git log main..origin/...` when porting Phase-3 security work. |
| `fix/engine-and-phd-knowledge-integration` | bcea09c | 0 | 36 | Fully merged. |
| `feat/phd-management-knowledge-graph` | ba272c3 | 0 | 37 | Fully merged. |

## PR #3 — change inventory vs main (23 files, +1191/−550)

Key substantive changes verified by reading the diff:
- `apps/worker/src/index.ts` (+128): grading attempt-type derived from issued server ticket, not client claim; tests `49a706a`, `83b6ab4`, `03576bc`, `7ea79b0`, `0d356ab`.
- `supabase/migrations/0009_secure_attempt_ticket_enforcement.sql` (+229): RPC-level ticket enforcement (expiry, single-use, attempt/question match).
- `src/engine/aelEngine.ts` (184 changed): remediation not cleared by self-reported confidence (`30e7935`), honesty edits.
- `KonkorScoreSimulatorCard.tsx` (585 changed) + `konkorRankPredictor.ts`: PhD rank/admission predictions disabled as uncalibrated (`7418c67`, `631cbf7`, `e7d3820`).
- `packages/learning-engine/src/fsrs.ts` (10) + tests (27): weight claims softened to "not calibrated".
- `supabase/tests/*`: fail-fast on integrity assertion.

Merge risk: HIGH as a single merge (conflicts with d7c8dd0 root-docs churn). Strategy: cherry-pick logical clusters onto `fix/mission-remediation-20261101` in Phase 3/4; run tests per cluster.

## PR #4 — change inventory vs main (14 files, +1622/−104)

- Replaces the garbled root `EXAM_SPECIFICATION_1406.md` approach with `docs/phase-1/` set: specification (md+json), schema, coverage matrix **173 rows** (topic-level, distinct `combination_code` 1..7 vs set 2162), data dictionary, knowledge-graph spec, gap register, acceptance report.
- `SOURCE_REGISTRY.json`: 12+ sources with honest verification split; **still no file-level SHA-256** (official PDF 403-blocked from audit env — a real, documented blocker, not a placeholder).
- `scripts/validate-phase-1-foundation.mjs` (194 lines): real CSV validator (duplicate ids, unknown combination, topic-without-subject, source linkage).
- Merge risk: LOW (zero conflicts). Overlaps root files created by main's d7c8dd0 → after merge, root duplicates must be removed per the plan's no-parallel-copies rule.

## GitHub API access

`gh` CLI is **unauthenticated** in this environment → PR metadata (CI status, review state, mergeable flag) cannot be read via API. Audited via fetched refs instead. Status: BLOCKED for CI-run history; recorded as limitation.

## Open/unmerged local-only branches
`deploy/free-telegram-mvp`, `feat/phd-management-knowledge-graph`, `fix/complete-audit-and-security-hardening`, `fix/engine-and-phd-knowledge-integration` also exist locally; all are ancestors/merged or mirrored by remotes above. No work-in-progress was found that is absent from remote refs.
