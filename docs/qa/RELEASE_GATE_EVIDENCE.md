# Release Gate Evidence — consolidation 20261107

**SHA:** main `718c54c` / branch `3339147..7ceb5f7` (consolidation)
**Date:** 2026-11-07

## CI evidence

| Check | Command | Result |
|---|---|---|
| Unit tests | `npx vitest run` | 606/606 passed (50 files) |
| Worker tests | `npx vitest run apps/worker` | 199/199 passed (18 files) |
| Typecheck | `npm run typecheck` | 0 errors |
| Build (React) | `npm run build` | ✅ built |
| Build (Worker) | `npm run build:worker` | ✅ tsc -b clean |
| PDF guard | `npm run ael:pdf:check` | PASS — no PDF in commits |
| Client key audit | `npm run audit:client-bundle` | PASS (via CI on PR #13 head) |
| Worker dry-run | `npx wrangler deploy --dry-run` | ✅ clean |

## Live Worker evidence (2026-11-07)

| Check | Result |
|---|---|
| `/api/health` | `{"ok":true}` — Version `e86d96cc` |
| `/api/lessons` | 9 courses incl. `phd-expansion` (12 topics) |
| `/api/diagnostic` | 10-item sample with 5/12 new PhD nodes |
| Migrations 0001-0026 in main | ✅ (a19 branch verified behind main by 1545 lines) |

## Database migrations

- 0001-0026 in main — 0022-0026 added via merged PRs; a19 branch's migration-replay concern: main's 0001 policy idempotency was confirmed fixed via a19's direct main push (documented in runbook).
- Full migration replay test from zero: **not executed in this mission** — requires local Supabase staging. **Blocker recorded.**

## What is NOT claimed

- No production deploy performed (Worker deploy is pre-existing environment; no new secrets set)
- No SME review claimed (all 279 questions remain pending_sme)
- No reminder auto-delivery claimed (crons not configured)
- No Telegram bot live claimed (requires TELEGRAM_BOT_TOKEN from owner)
- No Supabase staging migration test claimed (requires staging access)
- ≥50 independent journeys NOT claimed (current: ~15 across 5 rounds)
