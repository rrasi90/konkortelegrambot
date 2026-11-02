# E2E TEST REPORT — Phase 5 (R-013) + جامع (A-10/A-11)

**Run date:** 2026-11-03 (this revision); first executed 2026-11-02
**Branch:** `fix/comprehensive-audit-20261102`
**Status:** `PASS_WITH_EVIDENCE` for the executed local scenario; cross-platform, Telegram-host and
exam-simulation UI scenarios remain `NOT_STARTED` (see scope gaps).

## 1. What was actually executed

Harness: `scripts/e2e-miniapp.mjs` — dependency-free Chrome DevTools Protocol driver.
Target: `scripts/dev-server.mjs` serving `apps/miniapp` and the real Hono worker with `MemoryStore`
and `content/examples/demo-pack.json`. Headless Google Chrome and Microsoft Edge, 430×900 viewport.

Run command:

```bash
PORT=8787 npx tsx scripts/dev-server.mjs      # terminal 1 (سطح سرو: Mini App)
node scripts/e2e-miniapp.mjs                  # terminal 2
```

Result: **20/20 checks passed in Chrome and 20/20 in Edge**, 0 console errors, 0 local HTTP ≥400
responses in either run.
Raw output: `evidence/phase-5/e2e-miniapp-run.txt` (Chrome),
`evidence/audit-20261102/e2e-chrome.txt`, `evidence/audit-20261102/e2e-edge.txt`;
machine-readable results: `evidence/phase-5/e2e-miniapp-result.json`,
`evidence/phase-5/e2e-miniapp-result-edge.json`.

| # | Check | Result | Evidence / note |
|---|---|---|---|
| 1 | Server is serving the mini app, not the stale React build (A-11) | PASS | `view-app=true reactRoot=false` |
| 2 | Device-token auto-auth reaches track selection | PASS | `e2e-01-tracks.png` |
| 3 | Multi-track selection enables confirm | PASS | screenshot |
| 4 | Entering the app after saving tracks | PASS | screenshot |
| 5 | Home tab loads real `/api/home` content | PASS | 266 chars, `e2e-02-home.png` |
| 6 | Today queue loads a real question | PASS | `e2e-03-question.png` |
| 7 | Question and ≥2 options render | PASS | 4 options |
| 8 | No answer key/explanation leaked before answering | PASS | DOM text scan |
| 9 | Answer submission returns server feedback | PASS | 1528 chars, `e2e-04-feedback.png` |
| 10 | "Next question" enables after submit | PASS | screenshot |
| 11 | Correct/wrong option gets a class **and a visibly different computed colour** (A-10) | PASS | `{"marked":true,"differs":true,"color":"rgb(28, 121, 74)"}` |
| 12 | Map tab loads `/api/map` | PASS | 25 chars, `e2e-05-map.png` |
| 13 | Lessons library loads `/api/lessons` | PASS | 577 elements |
| 14 | Full-book view opens via `data-book-id` listener (no data-driven inline `onclick`) | PASS | 6220 chars, R-033 regression |
| 15 | «بازگشت به لیست کتاب‌ها» works (previously threw `ReferenceError`) (A-10) | PASS | `e2e-07-booklist.png` |
| 16 | Session/progress survives page reload | PASS | `e2e-06-reload.png` |
| 17 | Streak-freeze button has a real attached listener (A-10) | PASS | CDP `DOMDebugger.getEventListeners`: 1 listener |
| 18 | Exam-date save button has a real attached listener | PASS | 1 listener |
| 19 | No local API response ≥400 during flow | PASS | 0 recorded |
| 20 | No console error or uncaught page exception | PASS | 0 recorded |

Checks 11, 15, 17 and 18 were added in this audit precisely because the four UI defects they
cover (unbound freeze button, dead back button, missing option styling, `[hidden]` overridden)
were invisible to the previous 15-check run.

## 2. Scope gaps (not claimed as tested)

- **Telegram hosts** (Android/iOS/Desktop/Web Telegram) — the run used plain Chrome with the
  device-token path, not Telegram `initData`. Telegram-specific behavior is not verified here.
- **Other browsers** (Firefox, Safari) and mobile Telegram hosts — not run. Microsoft Edge was run
  headlessly through the same harness (`E2E_OUTPUT_SUFFIX=-edge`) and passed all 20 checks.
- **Logout / re-login path** — the re-wired «خروج» and «ورود دوباره» controls are verified only by
  the CDP listener-introspection check and the wiring test; the full logout→re-login cycle is not
  exercised end to end in this run.
- **Self-report and streak-freeze server effects** — covered by API tests
  (`apps/worker/tests/audit-fixes.test.ts`), not by browser automation.
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
