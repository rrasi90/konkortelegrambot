# Repository Branch Inventory — 2026-11-07

**Mission:** `library-10y-repository-consolidation-20261107`
**main SHA at snapshot:** `718c54c` (origin/main = local main, clean)
**Method:** `git fetch origin --prune` after inventory; ahead/behind via `git rev-list --left-right --count origin/main...<branch>`; content-level diff for divergent branches.

## ۱. Remote branches (۹ شاخه + main)

| # | Branch | HEAD SHA | vs main (ahead/behind) | Unique work | Classification | Evidence |
|---|---|---|---|---|---|---|
| 1 | `main` | `718c54c` | — | — | REFERENCE | PR #13 merged + direct `718c54c` |
| 2 | `feat/ael-000-mission-baseline` | `21f922f` | 40/0 | none | **SUPERSEDED** (fully merged) | 0 unique commits; content provably in main |
| 3 | `feat/ael-admin-edu-catalog-002` | `f8ec302` | 32/0 | none | **SUPERSEDED** (fully merged) | 0 unique commits |
| 4 | `feat/ael-003-historical-data-modernization` | `f410979` | 31/0 | none | **SUPERSEDED** (fully merged) | 0 unique commits |
| 5 | `feat/ael-313-pdf-ingestion` | `c5dd3da` | 28/0 | none | **SUPERSEDED** (fully merged) | 0 unique commits |
| 6 | `feat/ael-design-integration` | `10ad233` | 22/0 | none | **SUPERSEDED** (fully merged) | 0 unique commits |
| 7 | `feat/ael-question-explanations-001` | `e86f8ca` | 2/0 | none | **SUPERSEDED** (PR #13 merged 2026-11-06T23:28:42Z) | merge commit `0976b18` on main |
| 8 | `content/pdf-ingest-20261106-batch26` | `3de3b45` | 24/**1** | 1 commit: `3de3b45 feat(ael-pdf-archive): AEL Agent Skill + MinerU→Markdown converter + PaddleOCR pilot` | **PARTIAL_PICK** (evaluation pending) | tooling-only (scripts/AgentSkill); runtime impact none; decide: port or supersede by pdf-ingest pipeline already in main (ael-pdf-*.mjs) |
| 9 | `design/ael-visual-card-redesign` | `5db8186` | 24/**2** | 2 commits: `5db8186` (Card-Based Warm Charcoal system) + `3de3b45` (same as #8) | **PARTIAL_PICK** | design system pre-dates merged `feat/ael-design-integration`; diff vs main's merged design needed before pick — recorded as evaluation, not auto-merge |
| 10 | `fix/a19-replayable-migrations` | `56d3149` | 156/**97** | 97 commits: A-19 migration replay fixes, live-deploy runbook, rate-limit fix, rollback drills, register closures | **PARTIAL_PICK — largest unmerged workstream** | merge-base `9e38e16`; 574 files differ branch↔main; ACTIVATION_RUNBOOK & REMEDIATION_REGISTER already present in BOTH (main received a copy via direct main push during that session). Remaining unique value: migration replay harness fixes (`2a615b5`, `b07f2c4`), rate-limit-in-dev fix (`4103dcb`), evidence updates. **No PR exists for this branch.** |

## ۲. Local-only branches

- All 9 remote branches have matching local tracking branches at identical SHAs (clean).
- No stale local-only branches found after `git fetch --prune`.

## ۳. §10 findings — verified against current HEAD

| # | Finding | Status at `718c54c`+P0 |
|---|---|---|
| 1 | `content/knowledge/courses.json` exam_code 2164 + coefficient 5 | **FIXED (P0 commit `0eef570`)**: 6× 2164→2162; coefficient scope issue documented (needs coefficientScope migration — see BRANCH_MERGE_PLAN P0-B) |
| 2 | exam-pack `۲۱۶۴` description | **FIXED (P0)**: meta.description now ۲۱۶۲+needs_check |
| 3 | `EXAM_SPECIFICATION_1406.json` empty combinations | **VERIFIED-CORRECT as-is**: setCode 2162, `pending_official_verification`, combinations `[]` with explicit note — 1406 combos not published yet; honest |
| 4 | `OFFICIAL_PHD_QUESTION_BANK.md` placeholders | **FIXED (P0)**: reconciled with real inventory (38 PhD-level Qs, all pending_sme) |
| 5 | OnboardingModal missing in main | **RESOLVED** in main (`13e1819`) — exists at `src/components/OnboardingModal.tsx` |
| 6 | wrangler.jsonc has no `triggers.crons` | **CONFIRMED OPEN**: reminder auto-delivery not real; `/reminder` bot command is guidance-only — P3 backlog item |
| 7 | miniapp LocalStorage session persistence | **CONFIRMED EXISTS** (`session_token` in `apps/miniapp/app.js`); full tab-close/device-recovery test deferred to P3 E2E |
| 8 | `AEL-MINIAPP-LIVE.html` as production entrypoint | Confirmed it is a build artifact; live entry is Worker miniapp — documented |
| 9 | book content duplicates/editions | Deferred to Stream D (P1) |
| 10 | yearlyKonkorExams provenance | Partially covered: 85 arshad questions carry official year/booklet provenance from archive; PhD-level = 27 authored + 11 prior — correctly labeled. Full audit = P1 |
| 11 | PR-branch integration consistency | PR #13 merged; code/data model consistent (606 tests green) |
| 12 | CI on latest SHA per branch | CI green on `e86f8ca` (head of merged branch) and on main `718c54c` (run 42308036301 success) |

## ۴. Critical P0 data-integrity finding (new)

`content/markdown/exams/business/1404/paper.md` + `answer-key.md` claimed `verification_status: verified` / `rights_status: authorized` with a fabricated `source_url` (`sanjesh.org/exams/phd/1404/2164_*.pdf`) and wrong set code (2164). **DOWNGRADED in P0 commit `0eef570`** to `unverified_provenance` / `rights_status: unknown` with an explicit provenance warning. Only 2 exam md files exist (1404 paper+key) — no other year claims official provenance.
