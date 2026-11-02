# SECURITY TEST REPORT

> **STATUS CORRECTION (Phase 5, 2026-11-02; extended by the comprehensive audit 2026-11-03):** the
> previous content was an unchecked template (`⬜` on every row) with no executed results. This
> version records only commands that were actually run on branch `fix/comprehensive-audit-20261102`.
> **Scope is local code/test only:** no staging deployment, no external penetration test, no
> encryption-at-rest verification and no Supabase/Cloudflare production configuration were examined.
>
> The 2026-11-03 audit changed two claims that had been recorded too favourably here: the rate
> limiter (A-04) and the queue payload exposure (A-06). Both are documented in
> `docs/audit/COMPREHENSIVE_AUDIT_20261102.md`.

## 1. Method and environment

- Runtime: Node v24.18.0, Vitest 5.0.5, Hono worker with `MemoryStore` for API tests.
- Database: PostgreSQL 16 in Docker (`ael-pg-test`) with migrations 0001–0015 and seeds.
- Suites: full `npm test -- --run` (333 tests), worker typecheck and build; 16-block psql
  integrity suite; targeted code review of auth, ticket and PostgREST query paths.
- Evidence: `evidence/audit-20261102/vitest-final.txt` (332/332) و `evidence/deploy-20261103/vitest-final.txt` (333/333),
  `evidence/audit-20261102/db-integrity-0015.txt` (migrations 0001→0015 + seeds + 16 blocks on a
  fresh scratch DB, `INTEGRITY_EXIT=0`), `evidence/audit-20261102/db-migration-0015.txt`,
  plus the earlier `evidence/phase-5/security-local-suite.txt` (266/266).

## 2. Authentication and session integrity

| Test | Result | Evidence / note |
|---|---|---|
| No token → protected routes rejected | PASS | Worker suite: `/api/diagnostic`, `/api/english/skills`, `/api/analytics/learning` expect 401 |
| Forged/tampered session token rejected | PASS | `apps/worker/tests/auth.test.ts` — changed suffix, different secret, malformed token |
| Unsigned Telegram-ID login (mode 2) rejected in production | PASS | R-010 worker test expects 401 without `ALLOW_DEMO_AUTH` |
| Device-token login (mode 3) rejected in production | PASS | R-010 worker test expects 401 without `ALLOW_DEMO_AUTH` |
| Demo login disabled when flag off | PASS | Worker test expects rejection |
| Signed Telegram `initData` accepted | PASS | New auth tests build the documented HMAC chain and verify `userId`/name |
| Tampered `initData` field rejected | PASS | Signature mismatch test |
| Payload signed with another bot token rejected | PASS | Signature mismatch test |
| Stale `auth_date` (> 24 h) rejected | PASS | Returns `auth_date stale` |
| Missing hash / missing user id rejected | PASS | Returns explicit errors |
| Session-token comparison constant-time | PASS | `constantTimeEqual` used for session tokens and initData hash (hardening in this phase) |
| Rate limit on auth path | PARTIALLY FIXED + MEASURED (A-04, A-26, A-27) | Two separate problems were found. (۱) The counter Map was created inside `createApp`, which the Workers entrypoint calls per request, so 429 could never fire at all — fixed by moving it to module scope. Confirmed live: `X-RateLimit-*` headers now show a decreasing counter. (۲) A 120-request burst against the deployed Worker was first throttled at request **#61** with `RATE_MAX=30`, i.e. exactly 2 isolates split the load (`evidence/deploy-20261103/live-rate-limit-isolates.txt`). The limiter is therefore a **per-isolate approximation, not a global limit**: its effective threshold is ~30×N and grows with concurrency. Enforcing a real limit requires a Durable Object or KV counter — recorded as A-27, NOT_STARTED |

## 3. Authorization and resource isolation

| Test | Result | Evidence / note |
|---|---|---|
| Attempt ticket is single-use | PASS | Integrity block 10: ticket consumed after submit; replay rejected |
| Answer with unissued ticket rejected | PASS | Integrity block 11 + worker test (`۴۰۰`) |
| Another user's ticket rejected | PASS | Integrity block 12 |
| RLS isolation between users | PASS | Integrity block 8 switches role/session and verifies row visibility |
| Direct read of `questions` table denied; `v_public_questions` only | PASS | Integrity block 9 for `anon` and `authenticated` |
| Answer RPC executable only by `service_role` | PASS | Integrity block 13 |
| Legacy `submit_answer_atomic` RPC (0003) was `security definer`, took an arbitrary `p_user_id`, checked no ticket/ownership, **and granted EXECUTE to PUBLIC** | FIXED + TESTED (A-02) | Migration 0015 revokes it from `public/anon/authenticated`; integrity block 16 asserts the ACL and `has_function_privilege('anon', …) = false`. This was the most severe finding of the audit: any anon-key holder could forge answers/mastery for any user |
| Client cannot set `attemptType`/proof status | PASS | Worker test: forged client `attemptType` ignored; ticket is server-issued |
| Self-reported confidence cannot manufacture mastery | PASS | Worker tests reject self-report for a correct answer and keep it non-probative |
| Self-report cannot invent skill evidence or demote `proven` | FIXED + TESTED (A-15) | `/api/self-report` used to write `evidenceCount: 1` and `coverageStatus: 'remediated'` even when the engine had produced no skill state; it now only relabels `dominantErrorType` on engine-created state and audits the no-state case |
| Exam-session retrieval scoped to owner | PARTIAL | Store query includes `user_id` + RLS owner-read (0012), but no dedicated cross-user API test yet |
| `app_users` had RLS enabled with zero policies | FIXED (migration 0015) | 0015 adds `read_own_app_users`; the dead `grant select` is now meaningful |

## 4. Input validation and injection

| Test | Result | Evidence / note |
|---|---|---|
| Unknown question → 404 | PASS | Worker suite |
| Invalid exam-selection year/sub-group → 400 | PASS | R-020 worker tests |
| Queue limit clamped to 1–50; negative/non-numeric safe | PASS | Worker suite |
| Self-report values restricted to `slip` / `didnt_know` | PASS | Route validation + tests |
| PostgREST filter injection via `attemptId` | FIXED + TESTED | Client `attemptId` was interpolated unencoded into `findAnswerByAttempt`; now `encodeURIComponent` with a regression test (`supabase-store.test.ts`) |
| SQL injection in database RPCs | PASS (reviewed) | Answer writes go through parameterized `submit_answer_secure`; ticket/attempt checks use bound parameters |
| XSS in Telegram mini-app | FIXED + PARTIALLY VERIFIED | Manual sink review found a data-driven inline handler (`onclick="renderFullBook('…')"`); HTML escaping decodes `&#39;` before JS parsing, so a crafted `courseId` could break out. Replaced with `data-book-id` + `addEventListener`; E2E clicks the generated button and opens the full-book view (20/20 local checks in Chrome and Edge). A new wiring test also fails if any inline `onclick` is rebuilt with string-concatenated data, if an interactive control in `index.html` has no binding, or if a CSS `display` rule overrides `[hidden]` again. A comprehensive DOM-sink audit is still NOT_STARTED |

## 5. Data exposure

| Test | Result | Evidence / note |
|---|---|---|
| Answer key absent from queue/diagnostic items | PASS + EXTENDED | Worker tests assert `correctOption` is not returned; `toPublicQuestion` used. **Audit finding A-06:** the queue response spread the whole internal `QueueItem`, so the designer trap note and card internals (`ease`, `fsrs`, `timesSeen`, `userId`) reached the client before an answer — items are now built field-by-field and a test asserts the absence of every one of those keys |
| Simulation does not reveal correctness while active | PASS | `/api/exam-simulation/answer` returns only `{ recorded: true }`; scoring on submit |
| Answer key returned only after answer submission/replay | PASS | `POST /api/answers` response contract |
| Secrets in repository | PASS (scan) | No bot token/service key literals in tracked source; scripts use demo auth only |
| Encryption at rest / in transit | NOT_VERIFIED | Depends on Supabase/Cloudflare deployment configuration; not inspectable here |

## 6. Not performed — explicit gate gaps

- **OWASP Top 10 full assessment and external penetration test:** NOT_STARTED. `SECURITY_AUDIT.md`
  is a planning document, not an executed audit.
- **Staging/production security testing:** NOT_STARTED (no credentials or deploy target, RK-07).
- **Distributed rate limiting / DDoS protection:** NOT_STARTED (only in-memory limiter tested).
- **CSRF/CORS/headers review:** NOT_STARTED for a deployed origin.
- **Dependency and secret scanning in CI:** NOT_STARTED (no CI secret store verified).
- **Comprehensive XSS/HTML sanitization audit of the mini-app:** NOT_STARTED. One data-driven
  inline-handler sink was found by manual review and fixed (R-033), and the fixed path is exercised
  by the E2E run; this is not a systematic review of every DOM sink or a sanitizer test suite.
- **Telegram `initData` replay window:** accepted limitation — the 24-hour `auth_date` window is
  enforced, but captured initData is not one-time-use (standard Telegram behavior).

- **Anti-abuse coverage of ticket-issuing routes:** the limiter now also wraps
  `/api/night-quiz`, `/api/diagnostic` and `/api/exam-simulation*`; before this they were
  unlimited, which combined with A-05 made a coin-farming loop possible.
- **Concurrency semantics:** `submitAnswerAtomic` return value was ignored, so a concurrent
  duplicate submission double-awarded stats in production and returned a generic 500 locally; now
  the replay is recognised (no second award) and a consumed ticket maps to 409 (A-14).
- **Error-message leakage:** raw `store`/RPC error strings were echoed to clients on the
  exam-simulation path; they are now classified into generic 400/409 messages (A-14).

## 7. Conclusion

Local authentication, ticket enforcement, RLS/RPC isolation, answer-key containment and the tested
input-validation paths pass with executable evidence. The 2026-11-03 audit additionally closed one
privilege-escalation path that had been open since migration 0003 (public execute on a security-definer
answer RPC, A-02), one production-only control failure that unit tests could not see (rate limiting,
A-04), one information exposure in the queue payload (A-06) and one reward-farming loop (A-05), and
recorded the remaining items honestly as DEFERRED / NOT_STARTED / BLOCKED in
`docs/audit/COMPREHENSIVE_AUDIT_20261102.md` (A-18…A-24).

This is still **not** a clean bill of health: external pentest, staging configuration, encryption at
rest/in transit, distributed rate limiting and a comprehensive client-side XSS audit remain open, and
all evidence is local (MemoryStore + Docker PostgreSQL). The Gate 5 security criterion is therefore
only partially met.
