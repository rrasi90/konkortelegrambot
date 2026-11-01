# MASTER_EXECUTION_TRACKER

> **Phase 0 (Repository Baseline & Evidence Audit): PASS_WITH_EVIDENCE — 2026-11-01, branch
> `fix/mission-remediation-20261101`.** Deliverables in `docs/audit/`
> (baseline, feature matrix, claim-evidence matrix, branch/PR audit, technical test baseline,
> remediation register R-001…R-025, risk register). Raw outputs in `evidence/phase-0/`.
> KPI rows below remain the ground truth until each phase produces evidence.
> **Phase 1 (Scientific Foundation): PASS_WITH_EVIDENCE — 2026-11-01.** Combination model fixed in
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
> 21-scenario parity harness (**16 diverged / 5 matched**) and `@ael/engine` designated sole runtime (ARC-01). **True engine
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
> mini-app + worker (headless Chrome and Edge via CDP): 15/15 checks each, 0 console errors, 0 local HTTP errors (`evidence/phase-5/`).
> Local worker benchmark: 20 concurrent users, 1,380 requests, 0 errors, p99 ≤ 21 ms on MemoryStore
> (`evidence/phase-4/bench-worker-local.txt`). Local PostgreSQL benchmark with 200k synthetic answer events:
> the 30-day evidence query improved from p95 10.6 ms to 3.4 ms after migration 0013 added the missing
> `(user_id, answered_at)` index; DB integrity suite `EXIT=0` and a pg_dump→restore drill matched all six
> key tables and preserved the index (`evidence/phase-5/db-bench-*`, `db-backup-restore.txt`).
> Security local suite 266/266 adds initData signature/staleness coverage and fixes two Phase 5
> findings (constant-time signature compare, encoded PostgREST `attemptId`) — R-032.
> `E2E_TEST_REPORT.md`, `PERFORMANCE_TEST_REPORT.md`, `SECURITY_TEST_REPORT.md` and
> `PRODUCTION_READINESS_CHECKLIST.md` now report only measured scope; the full gate table is in
> `docs/phase-5/PHASE_5_EXECUTION_TRACKER.md`; release decision is **NO-GO / DEFER**.
> **BLOCKED/NOT_STARTED:** real pilot (no participants), SME content validation, staging/Telegram-host E2E,
> Worker-runtime/concurrent-DB/stress performance, rollback drill, monitoring and legal/privacy review. No merge or deploy performed.

| شاخص کلان              | مرحله | وضعیت        | تعریف موفقیت                             |
| ---------------------- | ----- | ------------ | ---------------------------------------- |
| Exam Coverage          | ۱ و ۲ | IN_PROGRESS  | تمام سرفصل‌های مصوب قابل ردیابی‌اند      |
| Verified Content       | ۲     | IMPLEMENTED_UNVERIFIED | بانک ساختاری آماده؛ تأیید علمی (SME/کلید رسمی) BLOCKED |
| Question Quality       | ۲ و ۵ | IN_PROGRESS  | قواعد ساختاری تست‌شده؛ CTT/IRT بدون داده پاسخ BLOCKED |
| Architecture Parity    | ۳     | IN_PROGRESS  | یک موتور و یک منبع محتوا — موجودی انحراف ۱۶/۲۱ بلیت‌شده؛ مهاجرت legacy باقی |
| Learning Effectiveness | ۴ و ۵ | IN_PROGRESS  | مکانیزم‌ها تست‌شده؛ سنجش بهبود واقعی بدون پایلوت BLOCKED |
| Exam Readiness         | ۴ و ۵ | IN_PROGRESS  | شبیه‌سازی و نمره‌دهی تست‌شده؛ آمادگی واقعی کاربر سنجیده نشده |
| System Reliability     | ۳ و ۵ | IN_PROGRESS  | E2E و benchmark محلی سبز؛ staging/DB/stress/rollback NOT_STARTED |
| Security               | ۳ و ۵ | IN_PROGRESS  | امنیت احراز هویت و داده‌ها تأیید شده است — R-010/R-017/R-019 با شواهد؛ pentest/تأیید پروداکشن باقی |

---
## مراحل اجرای پروژه
- [x] مرحله ۱: تثبیت بنیاد علمی و مشخصات آزمون — PASS_WITH_EVIDENCE
- [x] مرحله ۲: ساخت دایرةالمعارف آموزشی و بانک سؤال معتبر — PASS_WITH_EVIDENCE (scoped؛ تأیید علمی SME/کلید رسمی BLOCKED)
- [x] مرحله ۳: یکپارچه‌سازی معماری و موتور هوشمند — PASS_WITH_EVIDENCE (scoped؛ مهاجرت legacy موتور R-009 باقی)
- [ ] مرحله ۴: تکمیل سیستم آموزش تطبیقی و آمادگی آزمون — PASS_WITH_EVIDENCE (scoped) در کد/تست؛ §8.8 و §8.9 BLOCKED
- [ ] مرحله ۵: اعتبارسنجی علمی، آزمایش واقعی و انتشار محصول نهایی — IN_PROGRESS (scoped local)؛ انتشار NO-GO/DEFER
