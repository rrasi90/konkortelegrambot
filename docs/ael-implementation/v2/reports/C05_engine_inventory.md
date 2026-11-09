# موجودی موتور (C05) — V2-070

- تاریخ: 2026-11-08 — ابزار: scripts/v2/check-aelengine-imports.mjs

## importers @ael/engine (18 فایل)

- apps/worker/src/catalog/service.ts، index.ts، learning-catalog.ts، learning-paths.ts، skills-data.ts
- apps/worker/tests: ex-session, learning-answer-persistence, learning-paths, release-catalog
- packages/learning-engine/tests/engine.test.ts
- packages/utils/priority-calculations.ts
- scripts/migration-dryrun.mjs (مسیر)، validate-data-versioning.mjs (مسیر)، tools/offline/adapter.ts (مسیر)
- src/engine/aelEngine.ts (Legacy adapter → @ael/engine)
- src/tests/legacyFsrsParity.test.ts

## Legacy

- src/engine/aelEngine.ts + src/tests/legacyFsrsParity.test.ts + legacyMasteryDirection.test.ts
- منطق FSRS لغاسی در کناری موتور جدید نیست؛ React به @ael/engine delegate می‌شود (PR #6). با این حال، 16 مصرف‌کننده legacy در React هنوز باقی‌اند (رکورد در MASTER_EXECUTION_TRACKER).

## خلاصه معماری

- یک موتور قدیمی React (src/engine) + یک موتور رسمی @ael/engine (packages/learning-engine) + تاریخچه SQLite در داشبورد (بر اساس README_AGENT_MISSION بخش 3.2).
- انتخاب معماری: Modular Monolith (MASTER_EXECUTION_PLAN 4.1).

## پارامترهای موتور

- FSRS: defaultParams در fsrs-policy.ts (hard 1.3، good 2.5، easy 2.8، once 0.9)
- Engine: masteryGain 0.15، penalty 0.75، rippleThreshold 60

مرجع: proposed/engine-parity-plan.md
