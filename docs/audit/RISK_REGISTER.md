# Risk Register — Phase 0

| ID | Risk | Likelihood | Impact | Trigger | Mitigation | Owner phase | Status |
|---|---|---|---|---|---|---|---|
| RK-01 | False "release-ready" docs get trusted; product shipped with broken exam weights & auth backdoors | High (already asserted in PRODUCTION_READINESS_CHECKLIST) | Critical | Any deploy decision based on current docs | Demote all unsupported claims to NOT_STARTED now; gates recomputed from evidence | 0→5 | IN_PROGRESS |
| RK-02 | Official 1406 booklet PDF unreachable (sanjesh HTTP 403 from audit env) → exam structure can't reach `official_verified` | High | High | Phase 1 sources | Use 1405 handbook (verified mirror) as baseline; mark 1406 deltas UNVERIFIED until retrievable; record BLOCKED per source | 1 | OPEN (documented in PR#4 registry) |
| RK-03 | Cherry-picking 46 PR#3 commits into diverged main introduces regressions | Medium | High | Phase 3 porting | Cluster-by-cluster picks with vitest run after each; conflicts resolved deliberately | 3 | OPEN |
| RK-04 | React/Worker dual engines drift further while new features added | High | Critical | Any feature work on either path | Freeze feature additions (mission rule 11); unify first (R-009/R-025) | 3 | OPEN |
| RK-05 | No real SME available → scientific review stays unmet | High | High | Phase 1/2 acceptance | Record every SME-dependent item as BLOCKED with exact list; self-review can only reach IMPLEMENTED_UNVERIFIED | 1-5 | OPEN |
| RK-06 | No real candidates for pilot tiers | Certain | Medium | Phase 5 | Instrumentation ready + synthetic-data tests clearly labeled; pilot declared BLOCKED, never simulated | 5 | ACCEPTED |
| RK-07 | Supabase/Cloudflare/Traefik (esc) secrets absent → live integration & deploy tests impossible | High | Medium | Phase 3/5 tests | memory-store integration harness + docker Postgres harness; live checks BLOCKED with reasons | 3-5 | OPEN |
| RK-08 | Lockfile drift (88 extraneous pkgs) breaks future installs | Medium | Medium | Next clean install | R-021 cleanup; verify `npm ci` in scratch clone | 3 | OPEN |
| RK-09 | Copyright exposure if real Sanjesh questions republished | Medium | High | Phase 2 bank build | Register `copyrightStatus` per question; keep official items metadata+explanation-only if license unclear | 2 | OPEN |
| RK-10 | Mission duration large; context/attention loss across phases | Medium | Medium | Continuous | This register + REMEDIATION_REGISTER + evidence/ dir as durable state; every phase commits logical units | all | MITIGATED |
| RK-11 | Data loss during DB schema changes | Low | Critical | Phase 3 migrations | Only additive migrations; docker rollback rehearsal before touching prod; never run destructive SQL on live Supabase without explicit owner approval | 3 | MITIGATED (no prod access anyway) |
