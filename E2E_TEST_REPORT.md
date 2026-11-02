# E2E TEST REPORT — Phase 5 (R-013)

**Run date:** 2026-11-02
**Branch:** `fix/mission-remediation-20261101`
**Status:** `PASS_WITH_EVIDENCE` for the executed local scenario; cross-platform, Telegram-host and
exam-simulation UI scenarios remain `NOT_STARTED` (see scope gaps).

## 1. What was actually executed

Harness: `scripts/e2e-miniapp.mjs` — dependency-free Chrome DevTools Protocol driver.
Target: `scripts/dev-server.mjs` serving `apps/miniapp` and the real Hono worker with `MemoryStore`
and `content/examples/demo-pack.json`. Headless Google Chrome and Microsoft Edge, 430×900 viewport.

Run command:

```bash
PORT=8787 npx tsx scripts/dev-server.mjs      # terminal 1
node scripts/e2e-miniapp.mjs                  # terminal 2
```

Result: **15/15 checks passed in Chrome and 15/15 in Edge**, 0 console errors, 0 local HTTP ≥400
responses in either run.
Raw output: `evidence/phase-5/e2e-miniapp-run.txt` (Chrome),
`evidence/phase-5/e2e-miniapp-edge-run.txt` (Edge);
machine-readable results: `evidence/phase-5/e2e-miniapp-result.json`,
`evidence/phase-5/e2e-miniapp-result-edge.json`.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Device-token auto-auth reaches track selection | PASS | `e2e-01-tracks.png` |
| 2 | Multi-track selection enables confirm | PASS | screenshot |
| 3 | Entering the app after saving tracks | PASS | screenshot |
| 4 | Home tab loads real `/api/home` content | PASS | 252 chars, `e2e-02-home.png` |
| 5 | Today queue loads a real question | PASS | `e2e-03-question.png` |
| 6 | Question and ≥2 options render | PASS | 4 options |
| 7 | No answer key/explanation leaked before answering | PASS | DOM text scan |
| 8 | Answer submission returns server feedback | PASS | 1528 chars, `e2e-04-feedback.png` |
| 9 | "Next question" enables after submit | PASS | screenshot |
| 10 | Map tab loads `/api/map` | PASS | 25 chars, `e2e-05-map.png` |
| 11 | Lessons library loads `/api/lessons` | PASS | 577 elements |
| 12 | Full-book view opens via `data-book-id` listener (no data-driven inline `onclick`) | PASS | 6220 chars, R-033 regression |
| 13 | Session/progress survives page reload | PASS | `e2e-06-reload.png` |
| 14 | No local API response ≥400 during flow | PASS | 0 recorded |
| 15 | No console error or uncaught page exception | PASS | 0 recorded |

## 2. Scope gaps (not claimed as tested)

- **Telegram hosts** (Android/iOS/Desktop/Web Telegram) — the run used plain Chrome with the
  device-token path, not Telegram `initData`. Telegram-specific behavior is not verified here.
- **Other browsers** (Firefox, Safari) and mobile Telegram hosts — not run. Microsoft Edge was run
  headlessly through the same harness (`E2E_OUTPUT_SUFFIX=-edge`) and passed all 15 checks.
- **Exam simulation UI** — the mini-app does not expose an exam-simulation screen; the API is
  covered by worker tests (§8.7, 19 tests) and DB RPC verification, not by this UI run.
- **Readiness report UI / skill dashboard UI** — not surfaced in the mini-app flow exercised here.
- **Network interruption and resume** — no fault injection was performed; only reload persistence.
- **Cross-user UI access** — authorization is covered by worker/DB tests
  (`evidence/phase-3-security cluster`), not by browser automation.

## 3. Environment and honesty notes

- The server uses `MemoryStore`, not Supabase/Cloudflare. Results demonstrate functional wiring of
  the real worker routes and mini-app, not production infrastructure behavior.
- This report replaces the previous unchecked template. Every PASS above maps to the archived
  run; nothing is inferred.
- The earlier template's "Scenario 1 complete user cycle" (3 days of study, topic/course/cumulative
  tests, readiness report) was **not** executed as a browser E2E; those flows are partially covered
  at API/unit level only.

## 4. Reproduce

1. Start the dev server on port 8787.
2. Run `node scripts/e2e-miniapp.mjs` (Chrome path overridable via `CHROME_PATH`; use
   `E2E_OUTPUT_SUFFIX=-edge` to keep a second browser's artifacts separate).
3. Inspect `evidence/phase-5/e2e-miniapp-result.json` and screenshots.
