# T11 — موجودی شاخه‌ها (بازراستی V2-010، 2026-11-08)

## شاخه کاری فعلی

- plan/ael-v2-impl-20261108 @ f9891a5 (HEAD == remote-plan)؛ 0 behind / 4 ahead از origin/main (8f8d49d)
- local main @ 718c54c (behind 1 از origin/main) — با origin/main خلط نشود.

## همه شاخه‌های کشف‌شده (git branch -a + git rev-parse)

| شاخه | SHA کوتاه | ahead/behind vs origin/main | یادداشت |
|---|---|---|---|
| plan/ael-v2-impl-20261108 (کاری) | f9891a5 | 0 / 4 | همین کار |
| main (local) | 718c54c | — / behind 1 | مبنای تاریخی؛ روی آن ادغام نشد |
| origin/main | 8f8d49d | — | مرجع مقایسه |
| content/pdf-ingest-20261106-batch26 | 3de3b45 | مرتبط با PR14؟ | بدون merge به plan |
| design/ael-visual-card-redesign | 5db8186 | — | مستقل |
| feat/ael-000-mission-baseline | 21f922f | — | baseline |
| feat/ael-003-historical-data-modernization | f410979 | — | زیر شاخه AEL-003 |
| feat/ael-313-pdf-ingestion | c5dd3da | — | زیر AEL-313 |
| feat/ael-admin-edu-catalog-002 | f8ec302 | — | Phase8 docs |
| feat/ael-design-integration | 10ad233 | — | Warm Charcoal |
| feat/ael-question-explanations-001 | e86f8ca | — | PR#13 (ادغام‌شده) |
| feat/layer1-academic-foundation-20261107 | bfe41ad | مستقل (PR15 head) | PR15 |
| fix/a19-replayable-migrations | 56d3149 | — | aislated |
| mission/library-10y-repository-consolidation-20261107 | ad728a9 | مستقل (PR14 head) | PR14 |
| origin/plan/ael-v2-impl-20261108 | f9891a5 | مشابه local |  |

(برای هر شاخه: SHA کامل در لاگ git branch -vv ثبت شد؛ ahead/behind کامل همه شاخه‌ها در git rev-list --left-right --count قابل تکرار است.)

## فایل‌های تغییرکرده plan فرقش با origin/main

git diff --name-only origin/main...HEAD شامل DECISIONS_FA.md، V2_EXECUTION_REPORT.md، V2_LEDGER.csv و 60+ فایل V2 (reports/proposed/templates/logs) + موتور جدید (mastery/planner/…) + تست‌ها + scripts/v2. هیچ تغییر core روی main انجام نشده؛ فقط همین شاخه.

## نتیجه آزمون ادغام در worktree مجزا (بدون ادغام واقعی روی شاخه کاری)

- PR14 (ad728a9) → main: `git merge --no-commit --no-ff ad728a9` در worktree جدا → "Automatic merge went well; stopped before committing" → PASS (با --abort پیوست شد).
- PR15 (bfe41ad) → base ad728a9: همین آزمون → PASS.
- هیچ ادغامی روی plan انجام نشد؛ تست‌ها صرفاً در worktree جدا و پس گرفته شدند.

## PRهای باز

- #14: head mission/library-10y-… @ ad728a9، base main @ 718c54c — عنوان mission(library-10y-consolidation)
- #15: head feat/layer1-… @ bfe41ad، base mission/... @ ad728a9 (انباشته — تغییرات PR والد به فرزند نسبت داده نشوند؛ تفکیک در PR_OVERLAP.md)

## D-05 — توصیه (نه تصمیم)

توصیه مستدل ایجنت: الف (ترتیبی با PR جداگانه و CI سبز) به‌عنوان کم‌ریسک‌ترین مسیر، با شرط CI سبز و بدون force-push. تصمیم نهایی با مالک در OWNER_REPLIES.md است؛ تا آن زمان هیچ PR/merge به نام D-05 اجرا نمی‌شود.

ادعای «Strategy Option chosen: الف» از نسخه قبلی حذف شد.
