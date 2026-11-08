# گزارش اصلاح ۱ — ایست ۱ (2026-11-08)

- مبنا: f9891a5 → اصلاح این گام: 4946ded (ابزار/شواهد) + کامیت نهایی همین گام (SHA در پایان گزارش)
- HEAD فعلی: 8f8d49d? نه؛ HEAD واقعی در لاگ v2-verify ثبت شد (git rev-parse HEAD)
- remote-plan: همان HEAD (پس از push)
- git status --short: فقط untracked قدیمی anki/ و scripts/tmp-*.mts (دست‌نخورده) + فایل‌های این گام

## مشکل قبلی → اصلاح → شاهد

| مشکل | اصلاح | شاهد |
|---|---|---|
| لجر 70 شناسه و 24 خطا؛ V2-06/07/018 مفقود | ابزار ledger/verify/reading-notes + تست 9تایی؛ لجر 73 شناسه یکتا، 0 خطا | logs/verify-initial.txt → logs/v2-verify.txt؛ src/tests/v2/ledger-tools.test.ts |
| V2-004 شاهد نام شاخه بود | logs/branch-proof.txt ساخته شد (branch/SHA واقعی) | logs/branch-proof.txt |
| شاخه‌ها ناقص و «Strategy chosen: الف» | بازنویسی کامل: 13 شاخه + SHA/ahead-behind + آزمون ادغام هر دو PR در worktree جدا PASS؛ ادعای تصمیم حذف، فقط توصیه | reports/T11_branches.md |
| 0028 بدون ref خوانده شده بود | اصلاح: روی این شاخه وجود ندارد (تا 0026)، فقط روی PR15 bfe41ad | logs/snapshot-diff.md + reading-notes.md (@ bfe41ad) |
| BACKLOG مرجع V2 معرفی شده بود؛ syllabus پیش‌نیاز/هدف داشت | هر سه اصلاح صریح در reading-notes با لنگر path:lines @ ref | logs/reading-notes.md + reading-notes-check OK |
| V2-005 فقط npm test بود | مجموعه کامل VS: test/test/typecheck/learning/worker/miniapp/offline/db با exit جدا؛ typecheck و learning شکست‌های پیش‌موجود ثبت شد (نه پنهان) | logs/vs-5-*.txt + vs-5-summary.txt |
| courses.json بدون تفکیک PRها؛ ارجاع V2-03B/C | PR14→2162، PR15 بدون diff مستقل؛ V2-03B/C حذف؛ HUMAN_REQUIRED به‌روز (ممنوعیت فقط OWNER_REPLIES) | reports/PR_INVENTORY.md + PR_OVERLAP.md؛ HUMAN_REQUIRED.md |
| پوشش به‌عنوان «پوشش درس» با share کل مخزن | share/scenario با صورت/مخرج/دامنه صریح؛ regenerated COVERAGE_V1 | reports/COVERAGE_V1.md؛ scripts/v2/coverage-matrix.mjs |
| ماژول‌های موتور در src/ نه src/v2/ | اختلاف + imports ثبت شد؛ جابه‌جایی/اتصال تازه انجام نشد | reports/ENGINE_PATH_MISMATCH.md |
| V2-011 تا V2-017 بدون معیار اصلی | بازبینی با معیار اصلی و جدول حقیقت از نتایج اصلاح‌شده | reports/T11_branches.md، T11_TRUTH_TABLE.md |
| status BLOCKED_BY_HUMAN و پیشنهاد به‌جای DONE | BLOCKED→HUMAN_REQUIRED؛ پیشنهادها→PROPOSED_ONLY؛ V2-020 فایل‌های اشتباه حذف | V2_LEDGER.csv (فقط از طریق ledger.mjs) |

## موارد باز (تا فاز بعد)

- V2-03A: نیازمند پاسخ D-05 مالک در OWNER_REPLIES.md (یه بدون PR/merge)
- V2-066/110/111/112: HUMAN_REQUIRED (فایل‌های مالک، پایلوت، SME)
- V2-030: مرجع و دامنهٔ exam_code/paper_code تا دفترچه همان سال
- موتور: انتقال به src/v2/ در این ایست انجام نشد (فقط ثبت اختلاف)
- exam patch: بدون مرجع رسمی اعمال نشد

## معیارهای تحویل این ایست

- دفتر اصلاح‌شده: 73 شناسه یکتا (V2_LEDGER.csv، فقط با ledger.mjs تغییر کرد)
- لاگ کامل npm run v2:verify: logs/v2-verify.txt (0 خطا)
- خروجی npm run v2:summary: در لاگ/سومری
- SHA نهایی: در پایان پاسخ
