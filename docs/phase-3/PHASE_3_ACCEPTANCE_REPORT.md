# PHASE 3 ACCEPTANCE REPORT — Architecture, Security & Data Foundations

- **PHASE:** 3 — Architecture, engine parity & security
- **START_COMMIT:** `563b1b4` (اولین کامیت فاز ۳؛ Phase 2 در `093fe48` بسته شد)
- **END_COMMIT:** `c971885` (`fix/mission-remediation-20261101`؛ این سند در کامیت بعد از آن است و تغییر کد ندارد)
- **BRANCH:** `fix/mission-remediation-20261101` — تغییرات از مسیر PR #5 برای merge به main ارائه شده‌اند؛ production deploy همچنان ممنوع است

## §1 DELIVERABLES
| فایل/کامیت | نقش |
|---|---|
| `supabase/migrations/0009_public_schema_grants_compat.sql` (`563b1b4`) | رفع R-023: USAGE روی public برای anon/authenticated/service_role در Postgres خام |
| `apps/worker/src/index.ts` + تست‌ها (`1134fde`) | R-010: حالت‌های ۲/۳ ورود پشت `ALLOW_DEMO_AUTH` (401)، wiring rate limiter (429)، hardening پروداکشن |
| `supabase/migrations/0010_secure_attempt_ticket_enforcement.sql` + خوشه PR#3 (`cfd7384`) | R-017/R-019/R-010: پورت کنترل‌شده PR#3 — بلیت تک‌مصرف اجباری، attemptType سمت سرور، RPC فقط service_role، گارد self-report، فیکس 30e7935 در aelEngine |
| `scripts/engine-parity-harness.mts` + `docs/phase-3/ENGINE_PARITY_MATRIX.csv` (`e224b23`) | R-009: هارنس ۲۱ سناریویی سه درز FSRS/Retrievability/Urgency؛ موجودی انحراف ۱۶/۲۱ |
| `docs/phase-3/ARCHITECTURE_DECISION.md` (`e224b23`) | ARC-01: تک‌نهادی `@ael/engine` + بنر `@deprecated` روی موتور legacy + تصمیم R-025 (Supabase-via-API تنها فروشگاه learner) |
| `supabase/migrations/0011_domain_history_and_queue_tables.sql` + مسیرهای نوشتن worker (`80d8754`) | R-020: exam_selections / mastery_history (trigger سمت سرور) / audit_logs / daily_queue_items + اندپوینت `/api/exam-selection` + persist صف/کوییز + audit رد بلیت و ورود دمو |
| حذف `bun.lock` + §سیاست قفل‌فایل README (`2df9bf8`, `d639204`) | R-021: package-lock.json تنها قفل رسمی؛ `npm ci` روی clone تازه با ۱۵۱ تست سبز |
| `mergeQuestionsUnique` + فیکس دوباره‌شماری دکتری (`c971885`) | R-026: ممیزی مبدأ (۰ تکرار درونی) + ادغام یکتای کاننیکال + تست اینواریانت |
| `docs/audit/REMEDIATION_REGISTER.md` | R-009/R-010/R-017/R-019/R-020/R-021/R-023/R-025/R-026 به‌روز با شواهد |

## §2 IMPLEMENTED
- **امنیت (R-010):** هیچ مسیر ورودی بدون امضا در پروداکشن باز نیست (createApp با `ALLOW_DEMO_AUTH=true` در env پروداکشن throw می‌کند)؛ نوع تلاش فقط از بلیت سروری خوانده می‌شود و `attemptType:'proof'` جعلی client بی‌اثر است.
- **دیتابیس:** ۱۱ مهاجرت روی postgres:16-alpine خام از صفرِ schema سبز اعمال می‌شود؛ suite یکپارچگی به ۱۴ بلوک رسید (بلوک‌های ۱۱–۱۳ گارد بلیت/RPC، بلوک ۱۴ جداول R-020 با semantics trigger).
- **معماری:** موتور رسمی تک‌نهاد شد و legacy عمداً با موجودی کامل انحراف (۱۶/۲۱) و گراف واقعی imports (۱۶ مصرف‌کننده legacy، ۳ مصرف‌کننده @ael/engine) مستند شد — بدون ادعای یکپارچگی.
- **R-020:** جداول با مسیر نوشتن واقعی، نهDDL خالی: trigger تاریخچه تسلط سمت سرور؛ persist آیتم‌های صف با attemptId یکتا؛ audit رد attempt و ورود دمو.

## §3 TESTS_EXECUTED (raw outputs در `evidence/phase-3/`)
| فرمان | نتیجه |
|---|---|
| `npm run typecheck` | PASS exit 0 — `gate-evidence.txt`, `typecheck-r020/r026.txt` |
| `npm test` | **152/152 PASS** (۱۲ فایل؛ +۶ تست R-020، ۱ تست ادغام یکتا، فیکس تست self-report که قبلاً بی‌صدا skip می‌شد) — `vitest-r026.txt`, `gate-evidence.txt` |
| psql docker harness (drop schema → ۱۱ مهاجرت → seed → integrity) | exit 0، ۱۴ بلوک سبز — `r020-harness.txt`, `r020-integrity.txt` |
| `npm run build` (React) | PASS exit 0 — `gate-evidence.txt` |
| `npm run build:worker` | PASS exit 0 — `build-worker-r020.txt`, `gate-evidence.txt` |
| `npm ci --dry-run` (working tree) و `npm ci` + تست در `git archive` scratch clone | exit 0 / 151/151 سبز در clone تازه — `r021-npm-ci-dryrun.txt`, `r021-npm-ci-fresh.txt` |
| `npx tsx scripts/engine-parity-harness.mts` | 21 scenarios / 16 diverged / 5 matched — `parity-harness.txt` |

## §4 DEFECTS_FOUND / FIXED (در این فاز)
- R-023 شکست suite روی Postgres خام CI → migration 0009 + اثبات مجدد.
- ورود بدون امضا حالت‌های ۲/۳ + rateLimit هرگز wired نشده → بسته/فعال‌شدن با تست.
- بلیت‌های تلاش اجباری نبود و attemptType از client پذیرفته می‌شد → enforcement 0010 + تست escalation.
- تابع مرده `calculateMasteryDeltaWithInsights` → حذف؛ چهار جدول دامنه بدون schema → 0011؛ دوباره‌شماری ۹۶ آیتم در coverage دکتری → merge یکتا؛ double-lockfile → حذف bun.lock.
- تست «خوداظهاری بی‌دقتی» با attemptId صادرنشده بی‌صدا return می‌کرد → با بلیت سروری بازنویسی شد (حالا مسیر self-report واقعاً اجرا و dominantErrorType بررسی می‌شود).

## §5 BLOCKED / CARRIED (صادقانه)
- **R-009 یکپارچگی واقعی موتور:** انحراف ۱۶/۲۱ باقی است؛ معیار پذیرش «grep تک‌موتوره» هنوز برقرار نیست → مهاجرت ۱۶ مصرف‌کننده legacy به Phase 4/5 موکول (در ARC-01 و register با وضعیت IN_PROGRESS ثبت).
- **R-025 تست پذیرش** (react client state == store state) وابسته به همان مهاجرت → IN_PROGRESS.
- **تأیید انسانی/کلید رسمی:** بیرونی، بدون تغییر از فاز ۲ (R-005/SME).

## §6 DEVIATIONS
- پورت PR#3 به‌جای git merge، دستی و با renumber (مهاجرت 0010) انجام شد — طبق قاعده «مقایسه و port کنترل‌شده».
- persist `daily_queue_items` و `audit_logs` عمداً best-effort (fail-open) است: جدول ممیزی نباید مسیر کاربر را ۵۰۳ کند؛ در مقابل صدور بلیت fail-closed باقی است.
- هارنس ۲۱ سناریو ساخت (≥۲۰ خواسته gate)؛ سناریوهای اضافی عمداً edge-case lapse بودند.

## §7 GATE_DECISION: **PASS_WITH_EVIDENCE (scoped)**
زیرساخت امنیتی، دیتابیس، جداول دامنه و مماری انحراف موتور با اجرای واقعی تست‌ها اثبات شد. **توحید واقعی موتور و store یکتا اثبات نشده** و به‌صورت IN_PROGRESS با برنامه مهاجرت Phase 4/5 ثبت شده است. هیچ ادعای «architecture unified» یا «production ready» در این فاز نمی‌شود.


## §8 Follow-up verification — 2026-11-02

- Migration `0014_engine_authoritative_skill_state.sql` replaces the simplified SQL proficiency updater with an atomic persist of the exact `skillStateUpdate.state` produced by `@ael/engine`.
- The Worker passes that state inside the signed/server-side answer RPC payload; the RPC remains restricted to `service_role`.
- Integrity block 15 verifies the exact values for proficiency, confidence, evidence count, retrievability, fluency, dominant error type and coverage status.
- GitHub Actions PR #5 applied migrations 0001–0014 on a fresh plain PostgreSQL 16 service and passed the database integrity job. The same run passed `npm ci`, typecheck, 268/268 Vitest tests (18 files) and content validation.
- Remaining architecture work is unchanged: 16 React legacy imports remain and parity is not zero. The SQL duplicate heuristic is removed, but React→Worker state convergence and full engine unification are still open under R-009/R-025.
- No production deployment, external pilot or SME content validation is claimed.

