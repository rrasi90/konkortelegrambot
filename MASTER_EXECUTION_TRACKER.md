# MASTER_EXECUTION_TRACKER

> **Phase 0 (Repository Baseline & Evidence Audit): PASS_WITH_EVIDENCE — 2026-11-01, branch
> `fix/mission-remediation-20261101`.** Deliverables in `docs/audit/`
> (baseline, feature matrix, claim-evidence matrix, branch/PR audit, technical test baseline,
> remediation register R-001…R-025, risk register). Raw outputs in `evidence/phase-0/`.
> KPI rows below remain the ground truth until each phase produces evidence.
> **Phase 1 (Scientific Foundation): PARTIALLY_ACCEPTED — 2026-11-01.** Combination model fixed in
> code, PR#4 foundation merged into remediation branch, root duplicates deleted, validator extended
> (placeholder-hash / prerequisite-cycle / combination-bundle checks). External blockers itemized in
> `docs/phase-1/PHASE_1_ACCEPTANCE_REPORT.md` appendix. Evidence: `evidence/phase-1/`.
> **Phase 2 (Scientific Content & Assessment Repository): PASS_WITH_EVIDENCE (scoped) — 2026-11-01.**
> Standardized tiered bank built and contract-tested: 156 unique traced items (38 PhD `transcribed_pending_key_review`
> / 101 arshad / 17 quarantine), 96 duplicate IDs merged by content comparison with 0 conflicts, placeholder items
> excluded and their absence asserted. Structural quality verified; **scientific validation of keys/difficulty remains
> BLOCKED** (no official answer-key PDF — 403; no human SME; no response data for CTT/IRT — zero invented parameters).
> Details + honest scope in `docs/phase-2/PHASE_2_ACCEPTANCE_REPORT.md`. Evidence: `evidence/phase-2/`.
> **Phase 3 (Architecture, Security & Data Foundations): PASS_WITH_EVIDENCE (scoped) — 2026-11-01.**
> Auth backdoors closed behind demo flag + production hardening; attempt tickets strictly server-enforced (migration 0010,
> PR#3 clusters ported without blind merge); 14-block psql integrity suite green on plain Postgres; missing domain tables added
> with real write paths (0011); single-lockfile policy proven via fresh-clone `npm ci`; engine divergence inventoried with a
> 21-scenario parity harness (**PR #7 CI: 0 diverged / 21 matched in measured seams; app-wide React/store convergence remains open**) and `@ael/engine` designated sole runtime (ARC-01). **True engine
> unification and the R-025 store-convergence acceptance test are NOT claimed** — carried IN_PROGRESS to Phase 4/5 migration.
> Details in `docs/phase-3/PHASE_3_ACCEPTANCE_REPORT.md`. Evidence: `evidence/phase-3/`.
> **Phase 4 (Adaptive Learning & Exam Readiness): PASS_WITH_EVIDENCE (scoped) — 2026-11-02.**
> §8.1–§8.7 and §8.10 are implemented and tested: diagnostic with UNKNOWN initial state, evidence-layered mastery
> with holdout gate, FSRS reference tests, property-tested planner, budget-consistent queue, 10-cause error taxonomy,
> level-aware official exam simulation (PhD 2162 vs Master 1142 never conflated), and 13 evidence-derived analytics
> metrics with vanity metrics excluded. The doctorate-management operational path (diagnostic → evidence mastery →
> FSRS → budgeted queue → simulation → report) is met at code/test level. **§8.8 English serving and §8.9 research lab
> remain BLOCKED** (zero labeled English questions/passages; no 11-capability spec, source corpus or AI governance), so
> Phase 4 is **not** globally complete. Details in `docs/phase-4/PHASE_4_EXECUTION_TRACKER.md`; evidence `evidence/phase-4/`.
> **Phase 5 (Validation & Release Gate): IN_PROGRESS (scoped local) — 2026-11-02.** Real local browser E2E through the
> mini-app + worker (headless Chrome and Edge via CDP): 15/15 checks each at that step (20/20 after the 2026-11-03 audit), 0 console errors, 0 local HTTP errors (`evidence/phase-5/`).
> Local worker benchmark: 20 concurrent users, 1,380 requests, 0 errors, p99 ≤ 21 ms on MemoryStore
> (`evidence/phase-4/bench-worker-local.txt`). Local PostgreSQL benchmark with 200k synthetic answer events:
> the 30-day evidence query improved from p95 10.6 ms to 3.4 ms after migration 0013 added the missing
> `(user_id, answered_at)` index; DB integrity suite `EXIT=0` and a pg_dump→restore drill matched all six
> key tables and preserved the index (`evidence/phase-5/db-bench-*`, `db-backup-restore.txt`).
> Security local suite 266/266 adds initData signature/staleness coverage and fixes two Phase 5
> findings (constant-time signature compare, encoded PostgREST `attemptId`) — R-032.
> `E2E_TEST_REPORT.md`, `PERFORMANCE_TEST_REPORT.md`, `SECURITY_TEST_REPORT.md` and
> **Comprehensive audit — 2026-11-03 (branch `fix/comprehensive-audit-20261102`).** A four-track audit
> (UI, Worker logic, learning engine, data layer) over `main` found 24 confirmed defects: 17 were fixed with
> regression tests and 7 are recorded as DEFERRED / NOT_STARTED / BLOCKED with reasons
> (`docs/audit/COMPREHENSIVE_AUDIT_20261102.md`, register block `A-01…A-24`). Severity highlights: a
> security-definer answer RPC that any anon key could execute for any user (A-02), a production-only failure
> of the rate limiter (A-04), a reward-farming loop through re-issued tickets (A-05), pre-answer exposure of
> designer trap notes and FSRS card internals (A-06), an FSRS difficulty dimension that was mathematically
> collapsed by mixing 4.5 weights into the FSRS-5 formula (A-08), fabricated "no evidence" states read as
> weakness in error classification (A-07) and in the legacy engine where wrong answers *raised* mastery
> (A-09), and four dead or invisible UI controls (A-10). Evidence: 332/332 vitest
> (`evidence/audit-20261102/vitest-final.txt`), migrations 0001→0015 + seeds + 16-block integrity on a fresh
> scratch DB (`db-integrity-0015.txt`), E2E 20/20 in Chrome and Edge, typecheck and Worker build EXIT=0.
> This strengthens what exists; it removes none of the external release blockers below.
> `PRODUCTION_READINESS_CHECKLIST.md` now report only measured scope; the full gate table is in
> `docs/phase-5/PHASE_5_EXECUTION_TRACKER.md`; release decision is **NO-GO / DEFER**.
> **BLOCKED/NOT_STARTED:** real pilot (no participants), SME content validation, staging/Telegram-host E2E,
> Worker-runtime/concurrent-DB/stress performance, rollback drill, monitoring and legal/privacy review. The remediation branch was merged into `main` via PR #5 (squash commit `d962df03dd5157a6a8af0083c92a0d958e3a7ec6`); no production deploy was performed.


> **2026-11-02 correction after PR #5 CI:** 1406 question counts, durations and negative marking are now `null` until the official handbook is verified; the specialist coefficient is applied once to the complete bundle. The map no longer fabricates mastery=50 when only skill-state evidence exists. Migration 0014 persists the exact engine-computed skill state atomically, with integrity block 15. Question bank files now separate per-tier `counts.total` from `corpusTotal`. PR #5 CI on head `9bdbaf08` passed both jobs: PostgreSQL 16 migrations 0001–0014 + integrity; `npm ci`; TypeScript; 268/268 Vitest; content validation. Engine/React unification (R-009/R-025), 1406 handbook extraction, SME review, English content, Research Lab, pilot, staging, production-runtime load, pentest and legal review remain open; Gate 5 stays **NO-GO / DEFER**.

| شاخص کلان              | مرحله | وضعیت        | تعریف موفقیت                             |
| ---------------------- | ----- | ------------ | ---------------------------------------- |
| Exam Coverage          | ۱ و ۲ | IN_PROGRESS  | تمام سرفصل‌های مصوب قابل ردیابی‌اند      |
| Verified Content       | ۲     | IMPLEMENTED_UNVERIFIED | بانک ساختاری آماده؛ تأیید علمی (SME/کلید رسمی) BLOCKED |
| Question Quality       | ۲ و ۵ | IN_PROGRESS  | قواعد ساختاری تست‌شده؛ CTT/IRT بدون داده پاسخ BLOCKED |
| Architecture Parity    | ۳     | IN_PROGRESS  | ۲۱/۲۱ سناریوی اندازه‌گیری‌شده MATCHED؛ ۱۶ مصرف‌کننده React و مهاجرت learner store باقی |
| Learning Effectiveness | ۴ و ۵ | IN_PROGRESS  | مکانیزم‌ها تست‌شده؛ سنجش بهبود واقعی بدون پایلوت BLOCKED |
| Exam Readiness         | ۴ و ۵ | IN_PROGRESS  | شبیه‌سازی و نمره‌دهی تست‌شده؛ آمادگی واقعی کاربر سنجیده نشده |
| System Reliability     | ۳ و ۵ | IN_PROGRESS  | E2E و benchmark محلی سبز؛ staging/DB/stress/rollback NOT_STARTED |
| Security               | ۳ و ۵ | IN_PROGRESS  | امنیت احراز هویت و داده‌ها تأیید شده است — R-010/R-017/R-019 با شواهد؛ pentest/تأیید پروداکشن باقی |

---
## مراحل اجرای پروژه
- [ ] مرحله ۱: تثبیت بنیاد علمی و مشخصات آزمون — PARTIALLY_ACCEPTED (ساختار داده و ضرایب عمومی اصلاح شده؛ تطبیق جزئیات دفترچه ۱۴۰۶ و بازبینی SME باز)
- [x] مرحله ۲: ساخت دایرةالمعارف آموزشی و بانک سؤال معتبر — PASS_WITH_EVIDENCE (scoped؛ تأیید علمی SME/کلید رسمی BLOCKED)
- [ ] مرحله ۳: یکپارچه‌سازی معماری و موتور هوشمند — IN_PROGRESS (scoped؛ بلیت و امنیت و مسیر SQL مهارت اصلاح شده‌اند؛ مهاجرت ۱۶ مصرف‌کننده موتور legacy در React و همگرایی store هنوز باقی است)
- [ ] مرحله ۴: تکمیل سیستم آموزش تطبیقی و آمادگی آزمون — PASS_WITH_EVIDENCE (scoped) در کد/تست؛ §8.8 و §8.9 BLOCKED
- [ ] مرحله ۵: اعتبارسنجی علمی، آزمایش واقعی و انتشار محصول نهایی — IN_PROGRESS (scoped local)؛ انتشار NO-GO/DEFER


> **2026-11-02 FSRS convergence slice (PR #6):** The React legacy FSRS facade now delegates transitions and elapsed-time retrievability to `@ael/engine`; lesson self-ratings no longer alter memory metrics, and recall classification computes current R from the last-review timestamp. CI run [41430029958](https://github.com/rrasi90/konkortelegrambot/actions/runs/41430029958) passed: 285/285 Vitest across 19 files, typecheck, content validation, DB migration/integrity, and 21-scenario parity (20 MATCHED / 1 DIVERGED). This does **not** close R-009/R-025: queue ordering, 16 React legacy importers and React→Worker/Supabase state convergence remain open.


> **2026-11-02 queue candidate-ranking correction (PR #7):** `buildDailyQueue` now filters and scores the full due-card candidate set before applying its limit. Worker `/api/queue` supplies the cached canonical ROI scorer and filters commute-ineligible nodes before candidate slicing. A Worker integration test verifies that a higher-priority card at the former 51st candidate position is selected. CI run [41431652931](https://github.com/rrasi90/konkortelegrambot/actions/runs/41431652931) passed: 288/288 Vitest (19 files), typecheck, content validation, database migrations/integrity and parity harness 21/21 MATCHED. This closes the measured queue-order seam, not R-009/R-025: 16 React legacy importers and React→Worker/Supabase learner-store migration remain open.


> **2026-11-02 Telegram learner snapshot recovery (PR #8):** React now reads and writes complete learner snapshots in Telegram CloudStorage v4 using 3,000-character chunks, two alternating slots, manifest-last commit, length/checksum validation, batched `getItems` restore, and timestamp-based local/cloud selection. Async hydration blocks study interaction and autosave until restore finishes. Legacy v3 summary recovery is explicitly partial; clients without CloudStorage receive a device-only warning. The mistake notebook remains LocalStorage-only. The PR does **not** close R-025: React still does not use Worker API as its canonical learner store, so React and Supabase histories can remain separate. CI run [41433872695](https://github.com/rrasi90/konkortelegrambot/actions/runs/41433872695) is the current full-gate evidence; verify its final result before treating this entry as accepted. Release remains NO-GO / DEFER.


> **2026-11-02 client answer-key exposure (R-036 / PR #9):** The root React Vite app imports key-bearing question and lesson datasets and performs answer evaluation in the browser. A public visitor can inspect the downloaded bundle before answering. PR #9 adds a fail-closed bundle scanner and wires it into the GitHub Pages workflow and supported Worker deploy script. CI on the PR head passes 300/300 tests and 21/21 measured parity scenarios; this is a **deployment guard, not a source-level fix**. The current bundle is expected to be rejected until React study and yearly exam flows migrate to authenticated Worker answer and exam-simulation APIs. R-036 remains BLOCKED and production remains NO-GO / DEFER.
