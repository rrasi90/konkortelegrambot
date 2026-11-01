# PERFORMANCE TEST REPORT — Phase 5 (R-014)

**Run date:** 2026-11-02
**Branch:** `fix/mission-remediation-20261101`
**Status:** `PASS_WITH_EVIDENCE` for a local in-memory benchmark; production-load, database,
stress and cross-platform performance remain `NOT_STARTED` / `BLOCKED` (no production infra).

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

## 3. Threshold check (from the previous template)

| Operation | Threshold | Measured local p99 | Verdict |
|---|---|---|---|
| Registration (`/api/auth/*`) | < 2 s | not isolated in this run | NOT_MEASURED |
| Content load (`/api/lessons`) | < 3 s | not timed in this harness | NOT_MEASURED |
| Question display (`/api/queue`) | < 1 s | 20.9 ms | PASS (local) |
| Answer submission (`/api/answers`) | < 2 s | 14.6 ms | PASS (local) |
| Exam simulation load (`start`) | < 5 s | 15.3 ms | PASS (local) |
| Dashboard update (`/api/analytics/learning`) | < 2 s | 14.9 ms | PASS (local) |

## 4. Not measured — explicitly out of scope

- **Database performance:** no query/lock/index measurements against PostgreSQL; only migration and
  integrity tests exist.
- **Cloudflare Worker runtime:** tests run in Node, not `workerd`; CPU-time and cold-start behavior
  are unmeasured.
- **Stress beyond 20 concurrent / 2×–10× load:** not run.
- **Resource monitoring (CPU/memory/DB pool):** not instrumented.
- **Cross-platform / cross-browser:** not run.
- **Production SLA:** not claimed; loopback MemoryStore numbers must not be presented as production
  capacity.

## 5. Conclusion

The measured local API latency is comfortably below the template thresholds with zero errors at
20 concurrent users on the in-memory harness. This supports functional readiness, **not** a
production performance guarantee. Gate 5 performance remains incomplete until database, Worker
runtime and stress measurements exist.
