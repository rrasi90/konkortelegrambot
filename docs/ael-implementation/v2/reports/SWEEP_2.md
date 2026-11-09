# SWEEP_2 — جاروی ۲ (V2-102 — بخش ۱)

- تاریخ: 2026-11-08

## محتوای تغییریافته در این موج

- scripts/v2/: id-map.mjs، status-snapshot.mjs، doc-link-check.mjs، tag-lint.mjs، coverage-matrix.mjs، objective-lint.mjs، card-lint.mjs، check-aelengine-imports.mjs
- packages/learning-engine/src/: coverage-matrix.ts، mastery.ts، planner.ts، scheduler.ts، target-weights.ts، readiness-copy.ts (+ export در index.ts)
- tests: src/tests/v2/coverage-matrix.test.ts، packages/learning-engine/tests/v2-engine-helpers.test.ts
- docs/ael-implementation/v2/reports/ + proposed/ + templates/ (14 گزارش/پیشنهاد/قالب)
- DECISIONS_FA.md (ردیف‌های PROPOSED V2-017)

## صحت موتور

- تست‌ها: vs-0-before 606 → vs-2-after 621 (+15 تست جدید در این موج). هیچ تستی نشکست.
- رفتار applyAnswer و buildExamSessionPlan دست نخورد؛ فقط ماژول‌های خالص افزوده شدند.

## صحت ادعاها

- هیچ ادعای رتبه/تراز/قبولی/100٪ در کد یا UI جدید نیست؛ assertReadinessCopyClean آن را gate می‌کند (FORBIDDEN_PHRASES.md).
- هیچ بسته‌ای به O2 یا verified ارتقا نیافته است.
- ناهمخوانی کد 2164 در patch پیشنهادی نگه داشته شده، نه اینکه خاموش شود.
