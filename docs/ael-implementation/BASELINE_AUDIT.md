# AEL-BASE-01 — ممیزی مبنا (Baseline Audit)

> **Snapshot مأموریت `AEL-AGENT-MISSION-001` (بخش ۰ سند Playbook) — ۵ نوامبر ۲۰۲۶:**
> - `git fetch origin` + مقایسه: `main` و `origin/main` دقیقاً هم‌سطح (`0 0`)، working tree تمیز، SHA شروع مأموریت: `5864c9c9b68a537899de1f0cc0548c512090f582`.
> - شاخه‌های محلی/ریموت: `main` + `fix/a19-replayable-migrations`. PR باز: نامشخص با API (به‌روزرسانی: `gh` بدون احراز هویت — ثبت به‌عنوان `BLOCKED_BY_GITHUB_PERMISSION` برای Branch Protection و مشاهده PR/CI؛ کار مستقل ادامه دارد).
> - محیط محلی: Node `v24.18.0`، npm `12.0.1`، Windows 10 x64، Git Bash.
> - پایگاه داده: ۱۸ Migration موجود (`0001_init` … `0018_exam_response_retry`). موتور تست DB محلی: pglite (`scripts/db-test-embedded.mjs`) + harness `supabase/tests/run.sh` با `AEL_DISPOSABLE_DB=1`.
> - راستی‌آزمایی مجدد مشکلات سند Playbook در کد: (A) رجیستری ثابت `learning-catalog.ts` = Import مستقیم دو JSON — تأیید. (B) `createQuiz` فیلتر مؤثر `review: 'pending_sme'` ندارد — تأیید. (C) پاسخ مسیر تألیفی (`learning-paths.ts`) فقط in-memory/امضاشده است؛ به `answer_events`/FSRS وصل نیست — تأیید. (D) فقط `ADMIN_API_TOKEN` — تأیید. (E) Pipeline ورود محدود — تأیید. (F) مدل Course محدود — تأیید.
> - CI روی SHA مبنا طبق کامیت قبلی هر دو Job موفق اعلام شده (تأیید مجدد UI نیازمند دسترسی — HUMAN-1 قبلی پابرجاست).

- **تاریخ:** ۵ نوامبر ۲۰۲۶ / ۱۴ آبان ۱۴۰۵
- **مأموریت حاکم:** [AEL_MASTER_EXECUTION_PLAN.md](AEL_MASTER_EXECUTION_PLAN.md) نسخهٔ ۲٫۱ + [AEL_SYSTEM_BLUEPRINT.md](AEL_SYSTEM_BLUEPRINT.md) + [README_AGENT_MISSION.txt](README_AGENT_MISSION.txt) — هر سه در همین پوشه نگهداری می‌شوند.
- **SHA شروع مأموریت:** `b01b3fe` (main) — **SHA پس از P0:** `454709b` + این کامیت.

## ۱. وضعیت اولیه خوانده‌شده از سند مادر — راستی‌آزمایی شد

| مورد سند مادر | راستی‌آزمایی | نتیجه |
|---|---|---|
| CI شکست: `formative-quiz.ts:170/173` TS2532/TS2322 در Worker build | ریشه‌یابی: `recommendNextActivity` تحت `noUncheckedIndexedAccess` (tsconfig.base) — typecheck ریشه غیرstrict بود و از آن می‌گذرد | **رفع شد** (AEL-BASE-02، کامیت `68c6c45`) |
| تست‌ها موفق | اجرا | ✅ ۴۳۲ → **۴۴۵** پس از مقاوم‌سازی |
| PR باز #1، #3، #4 | ممیزی سه‌طرفه با git محلی | تصمیم گرفته شد — بخش ۴ |
| Branch Protection غیرفعال | تأیید از سند؛ تنظیم نیازمند دسترسی | **BLOCKED_BY_GITHUB_PERMISSION** — HUMAN-2 |
| Admin RBAC ناقص | تأیید؛ فقط `ADMIN_API_TOKEN` | طراحی در سند ۲۰؛ پیاده‌سازی = Phase 2 (AEL-201..209) |
| Ingestion فقط JSON، OCR باز | تأیید | Phase 3 (AEL-301..312) |
| کاتالوگ استاتیک دو بسته | تأیید (`learning-catalog.ts`) | AEL-509/701 — Phase 5/7 |
| UI ورود محلی توهمی | تأیید کامل (State-only، بدون persist، پیام گمراه‌کننده) | **حذف کامل شد** (AEL-005) |
| `import-content.mjs` با پیش‌فرض خطرناک | تأیید: خطوط ۹۹/۲۰۱ (`verified` از غیبت synthetic)، ۵۲–۵۳ (hardcode published/authorized) | **اصلاح شد** (AEL-004) با ماژول سیاست + ۵ تست |
| Human review باز (SRC-04/FIN-01/HIST-01) | تأیید — همچنان باز | بسته‌ها در `docs/ael-next/18_REVIEW_BUNDLES_FA.md` |

## ۲. ماتریس راستی‌آزمایی محلی (معادل CI، ۵ نوامبر ۲۰۲۶)

| # | فرمان (گام CI) | نتیجه |
|---|---|---|
| 1 | `npm run typecheck` | ✅ PASS |
| 2 | `npm test` | ✅ **۴۴۵/۴۴۵** (۳۵ فایل) |
| 3 | `npm run test:db` (embedded PG — معادل محلی گام database) | ✅ PASS |
| 4 | `npm run build` (vite) | ✅ PASS |
| 5 | `npm run audit:client-bundle` | ✅ PASS |
| 6 | `npx tsx scripts/engine-parity-harness.mts` | ✅ **۲۷/۲۷ سناریو، ۰ واگرایی** |
| 7 | `npm run validate:content` | ✅ PASS |
| 8 | `npm run validate:learning` | ✅ PASS |
| 9 | `npm run build:worker` (`tsc -b`، strict + noUncheckedIndexedAccess) | ✅ PASS — **قبلاً شکست CI همین بود** |
| 10 | `npm run audit:miniapp` | ✅ PASS |
| 11 | wrangler deploy --dry-run | ✅ PASS |
| 12 | گام `database` (Postgres service در CI) | معادل محلی: گام ۳ — اجرای کامل با سرویس Postgres فقط در CI |

## ۳. PR و شاخه‌ها — تصمیم نهایی

جدول کامل + شواهد: [docs/audit/BRANCH_AND_PR_AUDIT.md](../audit/BRANCH_AND_PR_AUDIT.md). خلاصه:

| PR | تصمیم | محتوای یکتا |
|---|---|---|
| #1 feat/adaptive-engine-foundation | بستن بدون merge | ۳ سند + ۲ مادهٔ خام منتقل شد (با سربرگ منشأ)؛ اسکلت pnpm قدیمی وارد نشد |
| #3 fix/critical-learning-integrity | بستن بدون merge | هر ۵ خوشهٔ اصلاحی از قبل در main (با تست) — merge کل ممنوع بود |
| #4 phase-1/scientific-foundation | بستن بدون merge | اسناد در main؛ validator main کامل‌تر؛ کدش fallback `nodes[0]` دارد |

**آرشیو:** ۱۸ تگ `archive/*` push شد؛ ۱۸ شاخهٔ ریموت و ۹ شاخهٔ لوکال حذف شد؛ فقط `main` + `fix/a19-replayable-migrations` (کار A19 منتظر port طبق §۵ مأموریت) باقی است. بدون force push.

## ۴. موارد HUMAN_REQUIRED

| ID | اقدام | راهنمای دقیق |
|---|---|---|
| HUMAN-1 | تأیید CI سبز روی SHA `454709b`+ | GitHub → Actions → run مربوط به push بعد از `454709b` → هر دو job (quality، database) سبز. اگر شکست: لاگ گام مشکل را همین‌جا ثبت کنید |
| HUMAN-2 | Branch Protection برای main | Settings → Branches → Add rule: require PR، required checks: `quality` و `database`، block force pushes، block deletions، require conversation resolution. (فعلاً BLOCKED_BY_GITHUB_PERMISSION) |
| HUMAN-3 | بستن PR #1/#3/#4 با کامنت‌های آماده | متن کامنت‌ها: [docs/audit/BRANCH_AND_PR_AUDIT.md](../audit/BRANCH_AND_PR_AUDIT.md) بخش HUMAN_REQUIRED |
| HUMAN-4 | امضاهای انسانی بازبینی محتوا (SRC-04/FIN-01/HIST-01) و تصمیم حقوق (SRC-02) | `docs/ael-next/18_REVIEW_BUNDLES_FA.md` و `15_RIGHTS_MATRIX_FA.md` |

## ۵. شکاف‌های شناخته‌شدهٔ باقی‌مانده (فازهای بعدی)

- Rate limit per-isolate (AEL-804)، توکن نشست بدون انقضا (SEC-01-F4) — Phase 8/بستهٔ جدا.
- OCR واقعی و خط ورود کامل (AEL-304..309) — Phase 3.
- Admin Console و RBAC (AEL-201..209) — Phase 2.
- رجیستری آموزشی/آزمون و مدل دادهٔ پنج‌لایه (AEL-101..108) — Phase 1.
- Published Catalog و افزودن درس بدون Deploy (AEL-507..509) — Phase 5.
- پوشش ۱۰ ساله و بازبینی BCG/کشش (HIST-01/02) — مسدود به امضای انسانی.

فهرست کامل با شناسه: BACKLOG_FA.md بخش «مأموریت AEL-implementation».

## ۶. Definition of Done برای P0 — وضعیت

- [x] SHA مبنا و شواهد ثبت شد (این سند)
- [x] شکست CI ریشه‌یابی و رفع شد (بدون non-null assertion/weakening)
- [x] کل ماتریس CI محلی سبز
- [x] مسیرهای ورود قدیمی ایمن/حذف شدند (importer + تب توهمی)
- [x] تصمیم PR#1/#3/#4 با شواهد ثبت شد؛ اسناد یکتا منتقل شدند
- [x] شاخه‌ها آرشیو/حذف شدند با تگ؛ بدون force push
- [ ] **تأیید CI روی GitHub** — HUMAN-1
- [ ] **Branch Protection** — HUMAN-2 (مسدود به مجوز)
- [ ] **بستن PRها** — HUMAN-3
