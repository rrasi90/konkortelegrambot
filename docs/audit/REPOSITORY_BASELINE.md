# Repository Baseline — Phase 0

- **Captured at:** 2026-11-01 (local audit run)
- **Baseline commit (main):** `d7c8dd0365e8af1917c70c3cc4c3c54d21bffa72` — `feat: deliver all 28 Phase 1-5 roadmap artifacts`
- **Working tree at audit start:** clean, `main` in sync with `origin/main`
- **Audit working branch:** `fix/mission-remediation-20261101`

## Repository layout (actual)

| Area | Path | Notes |
|---|---|---|
| React app (dev/product UI) | `src/` | Entry `index.html` → `src/App.tsx`. Uses OLD engine `src/engine/aelEngine.ts` exclusively; state persisted via Telegram CloudStorage (`src/utils/telegramBridge.ts`), not the Worker. |
| Cloudflare Worker API | `apps/worker/` | 15 API endpoints (`apps/worker/src/index.ts`). Uses NEW shared engine `@ael/engine` (`packages/learning-engine`). Client is a second vanilla frontend `apps/miniapp/`. |
| Shared packages | `packages/learning-engine`, `packages/utils` | New engine + priority urgency calculations. **Never imported by the React app.** |
| Content packs | `content/knowledge/` | 2 packs: `phd-management-business-v1` (21 questions), `demo-pack` (18 questions) — validated by `scripts/validate-content.mjs`. |
| Question data in React | `src/data/konkorData.ts` (61 q), `src/data/yearlyKonkorExams.ts` (96 q) | Real extracted questions live here, not in `content/`. |
| Database | `supabase/migrations/0001..0008` | Tables: app_users, knowledge_nodes, node_dependencies, questions, answer_events, user_node_mastery, trap_cards, review_cards, daily_plan, exam_packs(+questions), skills, question_skill_mappings, user_skill_mastery, learner_skill_states, attempt_tickets, learning_assets. |
| Docs claiming Phases 1–5 | root-level `*.md/*.csv/*.json` (17 files, commit d7c8dd0) | Mostly empty frameworks; see `CLAIM_EVIDENCE_MATRIX.csv`. |
| CI | `.github/workflows/ci.yml` | npm ci → typecheck → vitest → validate:content; separate Postgres job runs `supabase/tests/run.sh`. |

## Runtime truth: two disconnected products

1. **React path (`src/`)** — the deployed Vite app: old AEL engine, Telegram CloudStorage persistence, no Worker API calls for learning state.
2. **Worker path (`apps/miniapp/` + Worker)** — new `@ael/engine`, Supabase persistence, attempt tickets.

They implement different mastery, scheduling and priority logic (full comparison in `FEATURE_IMPLEMENTATION_MATRIX.csv` and Phase 3 `ENGINE_PARITY` work). `ENGINE_PARITY_REPORT.md` on main is an unexecuted template.

## Learning-logic implementations found (4)

| # | Location | Used by | Status |
|---|---|---|---|
| 1 | `src/engine/aelEngine.ts` (v3.0, ~1800 lines) | React app runtime | Active |
| 2 | `packages/learning-engine/src/` (`@ael/engine`) | Worker runtime | Active |
| 3 | `apps/worker/src/store.ts:639` `calculateMasteryDeltaWithInsights` | nobody | Dead code |
| 4 | `supabase/migrations/0006_learner_and_security.sql:144-177` `submit_answer_secure` SQL-side Bayesian update | Worker RPC | Active, independent of both engines |

## Toolchain baseline

- Node v24.18.0, npm workspaces (`packages/*`, `apps/*`), vitest 5, TypeScript 7, Vite 8.
- Both `package-lock.json` and `bun.lock` exist (lockfile ambiguity — see `REMEDIATION_REGISTER.md` R-021).

## Evidence index (Phase 0)

All raw outputs under `evidence/phase-0/`:
`typecheck.txt`, `vitest-baseline.txt`, `validate-content.txt`, `vite-build.txt`, `worker-build.txt`, `npm-audit-and-branches.txt`, `db-migrations-integrity.txt`.
