# Branch & PR Audit — Phase 0

Baseline: `main = d7c8dd0` (2026-11-01). Fetch: `git fetch origin --prune` at 18:32 local.

> **به‌روزرسانی — AEL-BASE-03، ۵ نوامبر ۲۰۲۶:** این سند با ممیزی جدید روی `main = b01b3fe` (بازنویسی‌شده با اصلاح ایمیل نویسنده، ۱۰۷ کامیت) تکمیل شد. خلاصهٔ تصمیم‌ها در انتهای سند؛ جدول تاریخی بالا حفظ شده است.

## به‌روزرسانی ۲۰۲۶-۱۱-۰۵ — ممیزی مجدد و تصمیم نهایی

ممیزی جدید هر شاخه (ahead/behind نسبت به `b01b3fe`):

| Branch | Head | Ahead | تصمیم نهایی | شاهد |
|---|---|---|---|---|
| `feat/adaptive-engine-foundation` (PR#1) | 110a504 | 8 | **بستن بدون merge**؛ ۳ سند یکتا منتقل شد + ۲ مادهٔ خام تحقیق | `docs/testing/acceptance-scenarios.md`، `docs/security/content-delivery.md`، `docs/roadmap/TODO.md`، `docs/source-materials/*.txt` با سربرگ منشأ؛ اسکلت pnpm/`packages/domain` قدیمی وارد نشد |
| `fix/critical-learning-integrity-20261101` (PR#3) | a2fb50d | 88 | **بستن بدون merge** — هر ۵ خوشهٔ اصلاحی از قبل در main است | self-rating جداسازی: `src/engine/aelEngine.ts:518,553` + `src/tests/lessonRatingEvidence.test.ts`؛ نگاشت فصل: `src/data/bookChaptersRepo.ts:88` + `missionP0.test.ts:77`؛ گیت پیش‌بینی دکتری: `konkorRankPredictor.ts` + `claimHonesty.test.ts`؛ fallback نامعتبر node: غیبت `nodes[0]` در main؛ ادعای پوشش ۱۰۰٪: حذف‌شده |
| `phase-1/scientific-foundation` (PR#4) | 3cce67b | 50 (فقط ۸ کامیت خودش) | **بستن بدون merge** — اسنادش در main (765dc4a)؛ نسخهٔ validator main بلندتر (۲۴۹ در برابر ۱۹۴ خط)؛ کدش fallback خطرناک `nodes[0]` دارد (خطوط ۵۵۶/۸۴۸) | مقایسهٔ `scripts/validate-phase-1-foundation.mjs` بین دو نسخه |
| `fix/adaptive-core-hardening-2026-10-29` | 9e38e16 | 0 | کاملاً merge — حذف با تگ | tag `archive/fix-adaptive-core-hardening-2026-10-29` |
| سایر شاخه‌های PRهای merged (#2، #5..#12) | — | — | حذف با تگ آرشیوی | ۱۸ تگ `archive/*` push شد |
| `fix/adaptive-engine-hardening-20261029` | 867e039 | 91 | نسل معماری قدیمی — حذف با تگ؛ بدون محتوای منحصربه‌فرد قابل‌پورت | tag `archive/fix-adaptive-engine-hardening-20261029` |
| `fix/complete-audit-and-security-hardening` | 32cc35a | 14 | جایگزین‌شده در PRهای بعدی — حذف با تگ | tag `archive/fix-complete-audit-and-security-hardening` |
| `fix/a19-replayable-migrations` | 56d3149 | 97 | **نگه داشته شد** — کار A19 (replay-safe migrations) هنوز باید طبق §۵ مأموریت port شود | ثبت در BACKLOG_FA.md |

## اجرای تصمیم‌ها (۲۰۲۶-۱۱-۰۵)

- **تگ‌های آرشیو:** ۱۸ تگ `archive/*` روی head SHA هر شاخه ساخته و push شد → همهٔ کامیت‌ها قابل‌دسترس می‌مانند.
- **حذف شاخه‌های ریموت:** ۱۸ شاخهٔ بالا حذف شدند. باقی‌مانده روی ریموت: `main` + `fix/a19-replayable-migrations`.
- **حذف شاخه‌های لوکال:** ۹ شاخهٔ لوکال منسوخ حذف شد (کامیت‌ها از طریق تگ‌ها قابل‌دسترس‌اند).
- **بدون force push** — همهٔ عملیات push/tag/delete عادی بود.

## HUMAN_REQUIRED — اقدامات سمت GitHub (بدون gh auth)

1. **بستن PR #1** با کامنت: «اسناد یکتا منتقل شد (docs/testing، docs/security/content-delivery، docs/roadmap/TODO، docs/source-materials)؛ اسکلت معماری قدیمی pnpm وارد نشد؛ شاخه با تگ archive/feat-adaptive-engine-foundation آرشیو شد.»
2. **بستن PR #3** با کامنت: «هر پنج خوشهٔ اصلاحی (جداسازی self-rating، نگاشت referenceChapterId، گیت پیش‌بینی دکتری، رفع fallback node نامعتبر، حذف ادعای پوشش ۱۰۰٪) با تست در main موجود است؛ merge کل شاخه ممنوع بود؛ تگ archive/fix-critical-learning-integrity-20261101 ایجاد شد.»
3. **بستن PR #4** با کامنت: «اسناد phase-1 در main موجود و نسخهٔ validator آن کامل‌تر است؛ کد شاخه fallback ناامن nodes[0] دارد؛ تگ archive/phase-1-scientific-foundation ایجاد شد.»
4. **Branch Protection برای main:** Require PR، required status checks (quality + database)، ممنوعیت force push و حذف، conversation resolution. وضعیت فعلی: BLOCKED_BY_GITHUB_PERMISSION.
5. **تأیید CI سبز** روی SHA پس از push (`68c6c45` به بعد) در تب Actions.

## Remote branches (ahead/behind vs main)

| Branch | Head | Ahead | Behind | Assessment |
|---|---|---|---|---|
| `fix/critical-learning-integrity-20261101` (PR #3) | a2fb50d | 46 | 7 | **Valuable.** Learning-integrity + security fixes (ticket-derived attempt type, forged-proof rejection, self-report cannot clear remediation, `0009_secure_attempt_ticket_enforcement.sql`, honesty fixes to predictor claims). ~10 conflict regions vs main (touches same files as d7c8dd0). **Do not auto-merge; port selectively.** |
| `phase-1/scientific-foundation` (PR #4) | 3cce67b | 2 | 1 | **Valuable.** Restructured Phase-1 docs under `docs/phase-1/`, honest SOURCE_REGISTRY (per-source `accessed`/`contentVerified`/`contentNotVerified`, real URLs, documented HTTP-403 limits), `EXAM_COMBINATIONS_1405_BASELINE.csv` (combination codes 1..7 vs set 2162 properly separated), new real validator `scripts/validate-phase-1-foundation.mjs`. Merges with **zero conflicts**. No code/test for engine; docs+data+validator only. |
| `fix/adaptive-engine-hardening-20261029` | 867e039 | 91 | 49 | Large divergence (Oct 29). Superseded by later integrity work; needs file-by-file archaeology before reuse. LOW merge value vs cost. |
| `feat/adaptive-engine-foundation` | 110a504 | 8 | 54 | Old foundation branch; content already flowed into main-era packages. No unique value found in quick scan. |
| `fix/adaptive-core-hardening-2026-10-29` | 9e38e16 | 0 | 49 | Fully merged into main lineage. No action. |
| `deploy/free-telegram-mvp` | f782488 | 0 | 30 | Fully merged. Deployment-era branch; keep as tag reference. |
| `fix/complete-audit-and-security-hardening` | 32cc35a | 1 | 36 | One stray commit; inspect `git log main..origin/...` when porting Phase-3 security work. |
| `fix/engine-and-phd-knowledge-integration` | bcea09c | 0 | 36 | Fully merged. |
| `feat/phd-management-knowledge-graph` | ba272c3 | 0 | 37 | Fully merged. |

## PR #3 — change inventory vs main (23 files, +1191/−550)

Key substantive changes verified by reading the diff:
- `apps/worker/src/index.ts` (+128): grading attempt-type derived from issued server ticket, not client claim; tests `49a706a`, `83b6ab4`, `03576bc`, `7ea79b0`, `0d356ab`.
- `supabase/migrations/0009_secure_attempt_ticket_enforcement.sql` (+229): RPC-level ticket enforcement (expiry, single-use, attempt/question match).
- `src/engine/aelEngine.ts` (184 changed): remediation not cleared by self-reported confidence (`30e7935`), honesty edits.
- `KonkorScoreSimulatorCard.tsx` (585 changed) + `konkorRankPredictor.ts`: PhD rank/admission predictions disabled as uncalibrated (`7418c67`, `631cbf7`, `e7d3820`).
- `packages/learning-engine/src/fsrs.ts` (10) + tests (27): weight claims softened to "not calibrated".
- `supabase/tests/*`: fail-fast on integrity assertion.

Merge risk: HIGH as a single merge (conflicts with d7c8dd0 root-docs churn). Strategy: cherry-pick logical clusters onto `fix/mission-remediation-20261101` in Phase 3/4; run tests per cluster.

## PR #4 — change inventory vs main (14 files, +1622/−104)

- Replaces the garbled root `EXAM_SPECIFICATION_1406.md` approach with `docs/phase-1/` set: specification (md+json), schema, coverage matrix **173 rows** (topic-level, distinct `combination_code` 1..7 vs set 2162), data dictionary, knowledge-graph spec, gap register, acceptance report.
- `SOURCE_REGISTRY.json`: 12+ sources with honest verification split; **still no file-level SHA-256** (official PDF 403-blocked from audit env — a real, documented blocker, not a placeholder).
- `scripts/validate-phase-1-foundation.mjs` (194 lines): real CSV validator (duplicate ids, unknown combination, topic-without-subject, source linkage).
- Merge risk: LOW (zero conflicts). Overlaps root files created by main's d7c8dd0 → after merge, root duplicates must be removed per the plan's no-parallel-copies rule.

## GitHub API access

`gh` CLI is **unauthenticated** in this environment → PR metadata (CI status, review state, mergeable flag) cannot be read via API. Audited via fetched refs instead. Status: BLOCKED for CI-run history; recorded as limitation.

## Open/unmerged local-only branches
`deploy/free-telegram-mvp`, `feat/phd-management-knowledge-graph`, `fix/complete-audit-and-security-hardening`, `fix/engine-and-phd-knowledge-integration` also exist locally; all are ancestors/merged or mirrored by remotes above. No work-in-progress was found that is absent from remote refs.
