# Technical Test Baseline — Phase 0

Environment: Windows 10.0.26200 x64, Node v24.18.0, npm workspaces, Git Bash. Commit tested: `d7c8dd0` (main; audit branch `fix/mission-remediation-20261101` = same content at run time). All raw outputs in `evidence/phase-0/`.

| # | Command | Result | Status | Evidence |
|---|---|---|---|---|
| 1 | `npm ci` (lockfile-consistent install) | EPERM unlink `node_modules\lightningcss-win32-x64-msvc\*.node` — native module locked by a live process; retried, same result. `npm ls --depth=0` shows **88 extraneous packages** (node_modules drifted from lockfile). | BLOCKED (env file-lock) + defect R-021 confirmed | `npm-ci.txt`, `npm-ls.txt` |
| 2 | `npx tsc --noEmit` | exit 0, no errors | PASS_WITH_EVIDENCE | `typecheck.txt` |
| 3 | `npx vitest run` | 11 files, **128 tests passed**, 0 failed (440ms) | PASS_WITH_EVIDENCE | `vitest-baseline.txt` |
| 4 | `npm run lint` | alias of `tsc --noEmit` (no ESLint configured) | PASS (weak — no real linting; see R-022) | same as 2 |
| 5 | `node scripts/validate-content.mjs --all` | 2 packs valid (17+18 nodes, 18+21 questions, 0 warnings) | PASS_WITH_EVIDENCE | `validate-content.txt` |
| 6 | `npm run build` (Vite production) | exit 0 | PASS_WITH_EVIDENCE | `vite-build.txt` |
| 7 | `npm run build:worker` (esbuild worker) | exit 0 | PASS_WITH_EVIDENCE | `worker-build.txt` |
| 8 | `npm audit` | 0 vulnerabilities (info/low/moderate/high/critical all 0) | PASS_WITH_EVIDENCE | `npm-audit-and-branches.txt` |
| 9 | Migrations 0001–0008 on clean `postgres:16-alpine` | all 8 applied, seed applied | PASS_WITH_EVIDENCE | `db-migrations-integrity.txt` |
| 10 | `supabase/tests/integrity.test.sql` on same DB | **FAILS at line 104** — `authenticated` lacks USAGE on `public` (Supabase-only grant assumption). Tests 1–7 pass. CI `database` job runs on plain postgres:16 → presumed failing there too. | FAILED (real defect R-023) | `db-migrations-integrity.txt`, `db-rls-grant-gap.txt` |
| 11 | Worker integration vs real Supabase | needs project URL + service key secrets | BLOCKED (no credentials in this environment) | — |
| 12 | Telegram initData end-to-end login | needs real Telegram bot token + client | BLOCKED | — |
| 13 | E2E browser flows (miniapp + React) | not yet executed | NOT_STARTED → Phase 5 | — |
| 14 | Performance benchmarks | none exist or measured | NOT_STARTED → Phase 5 | — |
| 15 | CI run history on GitHub | `gh` CLI unauthenticated | BLOCKED (audit done from fetched refs instead) | `npm-audit-and-branches.txt` |

## Notes

- Item 10 is the first **genuine new defect** discovered by actually running the documented test path — the repo's own `run.sh` header claims green DB tests; on plain Postgres it cannot pass as written.
- Item 3: the 128 passing tests cover engine units and worker route logic against `memory-store` (in-memory), not against Postgres/RLS. Coverage claim "integration tested" remains UNVERIFIED.
- Lockfile situation: both `package-lock.json` and `bun.lock` present; CI uses `npm ci`. Ambiguity tracked as R-021.
