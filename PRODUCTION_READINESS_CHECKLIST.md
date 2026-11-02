# PRODUCTION READINESS CHECKLIST

> **STATUS CORRECTION (Phase 0 audit, 2026-11-01 — commit d7c8dd0):** the original ✅ / "ready for
> final release" claims were unsupported and contradicted the evidence.
>
> **Phase 5 update (2026-11-02):** E2E local flow and local performance are now measured, but
> production read-only gates (pilot, SME content validation, staging, monitoring, rollback) are not.
> **Overall status remains `BLOCKED` / `DEFER`. Release is NOT approved.**
>
> **Comprehensive audit (2026-11-03):** a four-track audit (UI, Worker logic, learning engine, data
> layer) found and fixed 17 defects with regression tests, and recorded 7 further items as
> DEFERRED / NOT_STARTED / BLOCKED. See `docs/audit/COMPREHENSIVE_AUDIT_20261102.md` and the
> `A-01…A-24` block in `docs/audit/REMEDIATION_REGISTER.md`. This raises confidence in what was
> already built; it does not remove any external release blocker.

Statuses follow the standard set only. A row without a linked artifact is not a pass.

> **Client persistence correction (PR #8):** Telegram CloudStorage now stores complete chunked learner snapshots and is read on startup. This is a transitional React backup path only; it does not satisfy R-025 (React→Worker/Supabase canonical store), and the mistake notebook remains device-local.

## 1. Scientific validation

| Item | Status | Evidence / limitation |
|---|---|---|
| Content validation script run | PASS_WITH_EVIDENCE | `evidence/phase-4/content-validate-exam87.txt` — 2 packs, 0 warnings |
| Scientific content quality report | IMPLEMENTED_UNVERIFIED | `docs/phase-2/CONTENT_QUALITY_REPORT.md`, derived from bank data |
| Psychometric analysis (CTT/IRT) | BLOCKED | No response data; no assumed parameters were invented |
| Question quality verified | IMPLEMENTED_UNVERIFIED | Structural checks pass; distractor/ difficulty quality not empirically validated |
| Curriculum coverage confirmed | BLOCKED | Topic matrix is `pending_sme_review` (R-004); SME is external |
| Source integrity verified | BLOCKED | Official PDFs return HTTP 403; hashes cannot be attached (R-005) |

## 2. Question quality

| Item | Status | Evidence / limitation |
|---|---|---|
| Official question bank populated | PASS_WITH_EVIDENCE (scoped) | 156 traced items, 0 empty options, provenance fields (R-006) |
| Authored/demo questions labeled | PASS_WITH_EVIDENCE | `examLevel` + `contentOrigin` on demo seed/import; disclosed in simulation |
| SME review of items | BLOCKED | No SME sign-off artifact exists |
| AI-reviewed questions validated | NOT_STARTED | No review pipeline artifact |
| Distractor quality | NOT_STARTED | No empirical distractor analysis |
| Difficulty calibration | BLOCKED | Requires response data |
| English item bank | BLOCKED | 0 labeled English questions; §8.8 reports `operational=false` |

## 3. System reliability

| Item | Status | Evidence / limitation |
|---|---|---|
| Migrations apply from scratch | PASS_WITH_EVIDENCE | Docker PostgreSQL 16: **0001–0015 + seeds recreated from scratch** on a throwaway DB; 16-block integrity suite EXIT=0 (`evidence/audit-20261102/db-integrity-0015.txt`). Audit A-19 records that migrations 0001/0005/0006/0007 still lack `drop policy if exists`, so re-running them on an applied database fails — fresh application is green, in-place re-run is not |
| Data integrity constraints verified | PASS_WITH_EVIDENCE | Integrity suite incl. tickets, RLS/RPC checks (R-010, R-020, R-023) and the new block 16 (A-01/A-02: missing stats columns present, legacy RPC no longer executable by PUBLIC/anon/authenticated, `app_users` owner-read policy, default privileges) |
| Telegram learner snapshot backup/recovery | PASS_WITH_EVIDENCE (scoped client tests) | PR #8 verifies complete React nodeStates/cards/stats backup, cloud restore, two-slot failure safety, version selection and Zero-State invalidation. Not a Supabase backup, not mistake-notebook backup and not staging Telegram-host E2E |
| Backup and restore tested | PASS_WITH_EVIDENCE (scoped local DB) | `scripts/db-backup-restore.sh`: pg_dump → restore into fresh DB, all 6 key row counts match, index preserved (`evidence/phase-5/db-backup-restore.txt`); deployment artifact rollback still NOT_STARTED |
| Availability SLA | NOT_STARTED | Not defined or measured |
| Disaster recovery | NOT_STARTED | No DR plan/runbook |
| Production database parity | BLOCKED | No Supabase credentials; local plain Postgres only (RK-07) |

## 4. Security

| Item | Status | Evidence / limitation |
|---|---|---|
| Authentication hardened | PASS_WITH_EVIDENCE | Prod unsigned modes 401; rate limiter wired; cross-user/ticket tests (R-010) |
| Attempt-ticket enforcement | PASS_WITH_EVIDENCE | Server-issued single-use tickets; RPC/RLS verified (§8.7, R-010) |
| SQL injection posture | PASS_WITH_EVIDENCE (scoped) | Parameterized REST/RPC paths; no raw user SQL found in reviewed endpoints |
| Rate limiting | PASS_WITH_EVIDENCE (scoped, corrected) | Audit A-04: the limiter was a **no-op in production** (counter created inside `createApp`, which the Workers entrypoint calls per request). Counter moved to module scope with a production-path regression test. Still in-memory per isolate; distributed/edge limits not configured |
| Token generation | PASS_WITH_EVIDENCE | `crypto.getRandomValues`/UUID; no `Math.random` session tokens |
| OWASP Top 10 full assessment | IMPLEMENTED_UNVERIFIED | Partial audit; no external pentest |
| Public client answer-key exposure (R-036) | BLOCKED — fail-closed deploy gate | React Vite currently bundles correctOption/correctIndex. PR #9 adds a bundle scanner and blocks Pages/guarded Worker deploy until the React UI uses authenticated Worker answer endpoints. This PR is a release mitigation, not removal of keys from the current bundle |
| Encryption at rest/in transit | NOT_STARTED | Depends on deployment configuration; unverified |
| Security test report | PASS_WITH_EVIDENCE (scoped local) | `SECURITY_TEST_REPORT.md`: 332/332 tests (audit revision), incl. A-02 legacy security-definer RPC revoked from PUBLIC/anon/authenticated, A-04 production rate limiting, A-05 coin-farming loop closed, A-06 queue payload exposure removed, A-15 self-report no longer invents evidence; initData signature/staleness, token forgery, ticket replay/cross-user, RLS/RPC, PostgREST encoding fix; staging/pentest/encryption and a comprehensive XSS audit NOT_VERIFIED (`evidence/audit-20261102/vitest-final.txt`, `evidence/phase-5/security-local-suite.txt`) |

## 5. Operational readiness

| Item | Status | Evidence / limitation |
|---|---|---|
| E2E local flow | PASS_WITH_EVIDENCE | **20/20 checks in Chrome and 20/20 in Edge**, screenshots + JSON (`evidence/phase-5/`, logs in `evidence/audit-20261102/`) — MemoryStore only. Audit A-11 also fixed silent surface drift where a stale React `dist` could be served instead of the mini-app |
| Telegram-host E2E | NOT_STARTED | Requires bot/staging; not run |
| Exam-simulation UI E2E | NOT_STARTED | Mini-app has no simulation screen |
| Pilot (technical/educational/extended) | BLOCKED | No real participants (R-012); no pilot data |
| A/B testing | NOT_STARTED | No experiment harness/data |
| Deployment runbook | NOT_STARTED | Only a `wrangler deploy` mention exists |
| Rollback procedure | NOT_STARTED | Not rehearsed |
| Monitoring/alerts | NOT_STARTED | No dashboards or alert configuration |
| Structured logging | IMPLEMENTED_UNVERIFIED | Console logs only; no aggregation/retention policy |

## 6. Performance

| Item | Status | Evidence / limitation |
|---|---|---|
| Local API benchmark | PASS_WITH_EVIDENCE (scoped) | 20 concurrent, 0% errors, p99 ≤21 ms (`evidence/phase-4/bench-worker-local.txt`) |
| Template thresholds (local) | PASS_WITH_EVIDENCE (scoped) | Queue/answer/simulation/dashboard within limits; auth/content not isolated |
| Database query latency (local/synthetic) | PASS_WITH_EVIDENCE (scoped) | 200k answer events; 30-day evidence query p95 10.6→3.4 ms after index 0013; other hot queries p95 ≤1.3 ms (`evidence/phase-5/db-bench-*`, `db-integrity-0013.txt`) |
| Database concurrency/locks/pool | NOT_STARTED | No concurrent-session, lock-wait or PostgREST path measurement |
| Stress (2×–10×) | NOT_STARTED | Not run |
| Cloudflare Worker runtime | NOT_STARTED | Benchmarked in Node, not `workerd` |
| Cross-platform performance | NOT_STARTED | Not measured |

## 7. Content and localization

| Item | Status | Evidence / limitation |
|---|---|---|
| Persian RTL UI | PASS_WITH_EVIDENCE (scoped) | Chrome 430×900 E2E rendered Persian flow |
| UTF-8 content | PASS_WITH_EVIDENCE | Import/validation scripts + E2E text rendering |
| Mathematical rendering | NOT_STARTED | Not exercised in E2E |
| Image/media handling | NOT_STARTED | Not exercised |
| Versioned content files | PASS_WITH_EVIDENCE | Repo packs + provenance-aware importer |
| Content change audit trail | PASS_WITH_EVIDENCE | Git history + bank metadata |

## 8. Documentation

| Item | Status | Evidence / limitation |
|---|---|---|
| Phase trackers current | PASS_WITH_EVIDENCE | Phase 1–4 trackers + register updated with evidence links |
| API contracts documented | PASS_WITH_EVIDENCE | `docs/api/api.md` now covers auth, tracks, diagnostic (§8.1), exam-selection (R-020), exam-structure + simulation start/answer/submit/get (§8.7), english skills (§8.8) and learning analytics (§8.10), matching route handlers |
| Developer onboarding | NOT_STARTED | No verified onboarding run |
| User documentation | NOT_STARTED | No user-facing guide verified |
| Analytics metric catalog | PASS_WITH_EVIDENCE | `docs/phase-4/LEARNING_ANALYTICS_METRICS.md` |

## 9. Legal and compliance

| Item | Status | Evidence / limitation |
|---|---|---|
| Data privacy / PII handling | NOT_STARTED | No privacy audit artifact |
| Terms of service | NOT_STARTED | Not reviewed |
| Privacy policy | NOT_STARTED | Not reviewed |
| Age restrictions | NOT_STARTED | Not assessed |

## 10. Gate 5 decision

| Criterion | Required | Current | Verdict |
|---|---|---|---|
| Pilot scientific validation | Complete | BLOCKED (no participants/SME) | NOT MET |
| Question quality | Verified | Structural only | NOT MET |
| Pilot tiers | All 3 | BLOCKED | NOT MET |
| E2E | Passed | Local mini-app 15/15 in Chrome and Edge; staging/Telegram absent | PARTIAL |
| Security test | Passed | Local suites; no staging/pentest | PARTIAL |
| Performance test | Passed | Local API + local PostgreSQL/synthetic only | PARTIAL |
| Rollback tested | Yes | DB dump/restore passed; deployment rollback NOT_STARTED | NOT MET |
| Monitoring configured | Yes | NOT_STARTED | NOT MET |

**Decision: NO-GO / DEFER.** The product is not release-ready. The remaining blockers are external
or require owner approval: real pilot participants, SME content validation, retrievable official
sources, production credentials/staging, and a rehearsed rollback/monitoring plan. The remediation was merged to `main` via PR #5 (`d962df03dd5157a6a8af0083c92a0d958e3a7ec6`); no production deployment has been performed.
