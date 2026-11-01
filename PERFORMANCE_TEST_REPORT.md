# PERFORMANCE TEST REPORT — Phase 5 (R-014)

**Run date:** 2026-11-02
**Branch:** `fix/mission-remediation-20261101`
**Status:** `PASS_WITH_EVIDENCE` for a local in-memory API benchmark and local PostgreSQL
query latency; production-load, Worker-runtime, stress and cross-platform performance remain
`NOT_STARTED` / `BLOCKED` (no production infra).

## 1. Method (what was measured)

- Harness: `scripts/bench-worker.mjs` (Node global `fetch`, bounded worker pool; no external tool).
- Target: `scripts/dev-server.mjs` → real Hono worker + `MemoryStore` + demo pack, single process.
- Load: 20 users, 20 concurrent, 200 requests per read scenario, 7 scenarios.
- Environment: Windows 10, Node v24.18.0, local loopback. No database or network hops are included.
- Raw output: `evidence/phase-4/bench-worker-local.txt` (JSON with per-scenario status counts).

Command:

```bash
PORT=8787 npx tsx scripts/dev-server.mjs      # terminal 1
node scripts/bench-worker.mjs                 # terminal 2
```

## 2. Results (measured, local MemoryStore)

| Scenario | Requests | Errors | RPS | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| GET /api/health | 200 | 0 | 2788.5 | 6.1 ms | 9.8 ms | 15.9 ms | 16.1 ms |
| GET /api/analytics/learning | 200 | 0 | 2248.7 | 8.1 ms | 10.9 ms | 14.9 ms | 15.1 ms |
| GET /api/queue?limit=10 | 200 | 0 | 1266.1 | 15.3 ms | 17.9 ms | 20.9 ms | 21.0 ms |
| GET /api/map | 200 | 0 | 2749.8 | 6.0 ms | 11.4 ms | 13.4 ms | 14.9 ms |
| GET /api/exam-structure | 200 | 0 | 2994.0 | 5.5 ms | 14.6 ms | 18.4 ms | 18.5 ms |
| POST /api/answers | 160 | 0 | 1707.6 | 11.5 ms | 13.1 ms | 14.6 ms | 14.7 ms |
| POST /api/exam-simulation/start | 20 | 0 | 1234.9 | 13.3 ms | 15.1 ms | 15.3 ms | 15.3 ms |

Error rate: **0%** across 1,380 requests. Answer count is 160 because 20 users × 8 queue items
yielded 160 one-time tickets; it was not padded to 200.

## 3. Database query latency (local PostgreSQL 16, synthetic load)

- Harness: `scripts/bench-db.sh` creates a throwaway `ael_bench` database inside the
  `ael-pg-test` container, applies **all migrations (0001–0013) and seeds from scratch**, then
  loads 500 users, 200,000 answer events (40% owned by one hot user), 100,000 mastery-history
  rows, 7,000 review cards and 15,000 queue items.
- Each query runs 10 warmups + 50 measured executions; timing uses server-side
  `clock_timestamp()`. This measures **query execution only** — the PostgREST hop and network
  are not included.
- `answer_events` previously had only `(user_id, pack_id)`; `EXPLAIN` showed a bitmap scan on
  that index plus a heap filter that removed 26,664 of 40,000 user rows. Migration
  `0013_answer_events_user_time_index.sql` adds `(user_id, answered_at)` for `listAnswersSince`.

| Query | Before fix avg / p95 | After index avg / p95 | Verdict |
|---|---|---|---|
| `answer_events` 30-day count | 9.94 / 10.55 ms | 2.61 / 3.41 ms | PASS (local, < 100 ms) |
| `answer_events` 30-day row fetch | 11.49 / 12.68 ms | 3.97 / 4.93 ms | PASS (local) |
| `mastery_history` 7-day count | 1.05 / 1.31 ms | 1.00 / 1.19 ms | PASS (local) |
| Due review cards | 0.03 / 0.10 ms | 0.02 / 0.07 ms | PASS (local) |
| Today's queue items | 0.02 / 0.06 ms | 0.03 / 0.11 ms | PASS (local) |
| User mastery (PK lookup) | 0.02 / 0.04 ms | 0.02 / 0.04 ms | PASS (local) |

After the index, `EXPLAIN (ANALYZE, BUFFERS)` confirms `Bitmap Index Scan on
answer_events_user_answered_idx` and removes the heap-filtered rows. Evidence:
`evidence/phase-5/db-bench-before-index.txt`, `db-bench-after-index.txt`. Migration 0013 was
applied from scratch in the same run, and the DB integrity suite passed with `EXIT=0`
(`evidence/phase-5/db-integrity-0013.txt`).

These numbers describe a synthetic 200k-row local database, not production data volume or
concurrent database load.

## 4. Threshold check (from the previous template)

| Operation | Threshold | Measured local p99 | Verdict |
|---|---|---|---|
| Registration (`/api/auth/*`) | < 2 s | not isolated in this run | NOT_MEASURED |
| Content load (`/api/lessons`) | < 3 s | not timed in this harness | NOT_MEASURED |
| Question display (`/api/queue`) | < 1 s | 20.9 ms | PASS (local) |
| Answer submission (`/api/answers`) | < 2 s | 14.6 ms | PASS (local) |
| Exam simulation load (`start`) | < 5 s | 15.3 ms | PASS (local) |
| Dashboard update (`/api/analytics/learning`) | < 2 s | 14.9 ms | PASS (local) |

## 5. Not measured — explicitly out of scope

- **Database concurrency, locks and connection pool:** single-query latency is measured above;
  concurrent sessions, lock waits, pool saturation and PostgREST/Supabase path remain
  `NOT_STARTED`.
- **Cloudflare Worker runtime:** tests run in Node, not `workerd`; CPU-time and cold-start behavior
  are unmeasured.
- **Stress beyond 20 concurrent / 2×–10× load:** not run.
- **Resource monitoring (CPU/memory/DB pool):** not instrumented.
- **Cross-platform / cross-browser:** not run.
- **Production SLA:** not claimed; loopback MemoryStore and synthetic PostgreSQL numbers must not
  be presented as production capacity.

## 6. Conclusion

The measured local API latency is comfortably below the template thresholds with zero errors at
20 concurrent users on the in-memory harness, and the measured PostgreSQL query p95 is ≤ 5 ms
after adding the missing evidence-window index. This supports functional and query-level
readiness, **not** a production performance guarantee. Gate 5 performance remains incomplete
until Worker-runtime, concurrent-database, resource and stress measurements exist.
