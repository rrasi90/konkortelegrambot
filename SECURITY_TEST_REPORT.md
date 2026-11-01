# SECURITY TEST REPORT

> **STATUS CORRECTION (Phase 5, 2026-11-02):** the previous content was an unchecked template
> (`⬜` on every row) with no executed results. This version records only commands that were
> actually run on branch `fix/mission-remediation-20261101`. **Scope is local code/test only:**
> no staging deployment, no external penetration test, no encryption-at-rest verification and no
> Supabase/Cloudflare production configuration were examined.

## 1. Method and environment

- Runtime: Node v24.18.0, Vitest 5.0.5, Hono worker with `MemoryStore` for API tests.
- Database: PostgreSQL 16 in Docker (`ael-pg-test`) with migrations 0001–0013 and seeds.
- Suites: full `npm test -- --run` (266 tests), worker typecheck and build; 14-block psql
  integrity suite; targeted code review of auth, ticket and PostgREST query paths.
- Evidence: `evidence/phase-5/security-local-suite.txt` (266/266, `TYPECHECK_EXIT=0`,
  `BUILD_EXIT=0`), `evidence/phase-3/r020-integrity.txt` (14 blocks, EXIT=0),
  `evidence/phase-5/db-integrity-0013.txt` (EXIT=0).

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
| Rate limit on auth path | PASS (local) | Test gets 429 after threshold; limiter is in-memory per isolate — edge/distributed limiting NOT configured |

## 3. Authorization and resource isolation

| Test | Result | Evidence / note |
|---|---|---|
| Attempt ticket is single-use | PASS | Integrity block 10: ticket consumed after submit; replay rejected |
| Answer with unissued ticket rejected | PASS | Integrity block 11 + worker test (`۴۰۰`) |
| Another user's ticket rejected | PASS | Integrity block 12 |
| RLS isolation between users | PASS | Integrity block 8 switches role/session and verifies row visibility |
| Direct read of `questions` table denied; `v_public_questions` only | PASS | Integrity block 9 for `anon` and `authenticated` |
| Answer RPC executable only by `service_role` | PASS | Integrity block 13 |
| Client cannot set `attemptType`/proof status | PASS | Worker test: forged client `attemptType` ignored; ticket is server-issued |
| Self-reported confidence cannot manufacture mastery | PASS | Worker tests reject self-report for a correct answer and keep it non-probative |
| Exam-session retrieval scoped to owner | PARTIAL | Store query includes `user_id` + RLS owner-read (0012), but no dedicated cross-user API test yet |

## 4. Input validation and injection

| Test | Result | Evidence / note |
|---|---|---|
| Unknown question → 404 | PASS | Worker suite |
| Invalid exam-selection year/sub-group → 400 | PASS | R-020 worker tests |
| Queue limit clamped to 1–50; negative/non-numeric safe | PASS | Worker suite |
| Self-report values restricted to `slip` / `didnt_know` | PASS | Route validation + tests |
| PostgREST filter injection via `attemptId` | FIXED + TESTED | Client `attemptId` was interpolated unencoded into `findAnswerByAttempt`; now `encodeURIComponent` with a regression test (`supabase-store.test.ts`) |
| SQL injection in database RPCs | PASS (reviewed) | Answer writes go through parameterized `submit_answer_secure`; ticket/attempt checks use bound parameters |
| XSS in Telegram mini-app | NOT_VERIFIED | Persian text is rendered via DOM/HTML paths; no dedicated sanitizer/XSS test suite was run |

## 5. Data exposure

| Test | Result | Evidence / note |
|---|---|---|
| Answer key absent from queue/diagnostic items | PASS | Worker tests assert `correctOption` is not returned; `toPublicQuestion` used |
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
- **XSS/HTML sanitization audit of the mini-app:** NOT_STARTED.
- **Telegram `initData` replay window:** accepted limitation — the 24-hour `auth_date` window is
  enforced, but captured initData is not one-time-use (standard Telegram behavior).

## 7. Conclusion

Local authentication, ticket enforcement, RLS/RPC isolation, answer-key containment and the tested
input-validation paths pass with executable evidence, including two Phase 5 hardening fixes
(constant-time signature comparison and encoded PostgREST filter value). This is **not** a clean
bill of health: external pentest, staging configuration, encryption and client-side XSS review
remain open, so the Gate 5 security criterion is only partially met.
