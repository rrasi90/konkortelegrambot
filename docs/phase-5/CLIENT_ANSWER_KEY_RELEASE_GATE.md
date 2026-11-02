# Public client answer-key exposure — release gate

**Finding:** R-036 — Critical
**Status:** IN_PROGRESS; guarded deployment commands, not a full source remediation.
**Scope:** Root Vite/React app built into dist, which is also configured as the Worker static asset directory.

## Evidence

The root React app imports INITIAL_QUESTION_BANK and YEARLY_KONKOR_QUESTIONS into its browser bundle. StudySessionView receives the full QuestionItem[] and invokes the legacy evaluateAnswerAndRipple client engine. YearlyKonkorExamView uses question.correctOption and lesson conceptCheck.correctIndex to reveal and score answers in the browser.

Consequently, a person can download the Vite JavaScript and inspect the correct options before answering. Obfuscation or hiding the answer in UI state would not fix this because the browser must receive the underlying data to execute the legacy evaluator.

## Secure server-side path already available

The Hono Worker already exposes the safer pattern:

- GET /api/queue returns public questions without correctOption.
- POST /api/answers derives correctness from the server-side question bank, requires a user-bound, single-use attempt ticket and persists the answer atomically. Correctness and explanation are returned only after submission.
- POST /api/exam-simulation/start sends toPublicQuestion(question), without the key, and issues attempt tickets.
- POST /api/exam-simulation/answer records a response without revealing correctness; final scoring is server-side at submit.

## Immediate mitigation in PR #9

- Add scripts/audit-client-bundle.ts, scanning deployable JS/MJS/CJS/JSON/HTML assets for numeric object literals under correctOption or correctIndex.
- Add unit tests proving that answer-key literals are detected, while normal property reads such as q.correctOption are not treated as embedded key data.
- Add the audit after Vite build in the GitHub Pages workflow. A public bundle containing answer-key literals fails before upload/deploy.
- Change the supported Worker deploy script to build the web asset, run the same audit and only then invoke Wrangler.

## Release behavior

The current React bundle is expected to fail this audit until it is migrated. This failure is intentional and fail-closed: do not bypass the audit or deploy the legacy React bundle to production.

The scan is a regression guard, not a security proof by itself. It checks known answer-key object-literal shapes; a future data schema change must update both the scanner and tests.

## Work still required to close R-036

1. Replace static client imports of INITIAL_QUESTION_BANK and YEARLY_KONKOR_QUESTIONS with public content fetched from the authenticated Worker.
2. Refactor StudySessionView to submit asynchronously to POST /api/answers; render the server report and never calculate correctness locally.
3. Migrate yearly exam sessions to /api/exam-simulation/start, /answer and /submit; do not provide answer keys in the session payload.
4. Remove correctOption and correctIndex from every browser-deliverable seed/content import, including source maps and alternate entry points.
5. Build and scan the exact Pages artifact and Worker asset artifact; add a deployment E2E assertion that no key is exposed before answer submission.

**This remediation does not close R-009/R-025.** The broader React learning engine and learner-store migration remain independent work. Production release remains **NO-GO / DEFER**.