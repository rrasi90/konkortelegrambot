# موجودی PR — V2-007 (2026-11-08)

- PR #14: head mission/library-10y-repository-consolidation-20261107 @ ad728a9fcae59328cfc9650a96eaf2266d0a4734، base main @ 718c54c0f6e301fda3d72ffd2fecb02140b6c1bc (gh pr view 14)
- PR #15: head feat/layer1-academic-foundation-20261107 @ bfe41ad38570834644294f085ddd342ebac2e88c، base mission/... @ ad728a9 (gh pr view 15) — **انباشته**: base خودِ PR14 است، نه main.

## diff vs main (PR14)

- 64 فایل، +9282 / −14376 (git diff --stat origin/main ad728a9)
- شامل: courses.json (2164→2162)، exam-structure.ts، App/Dashboard/Flashcards و مستندات.

## diff vs base واقعی (PR15)

- 24 فایل، +14821 / −64 (git diff --stat ad728a9 bfe41ad)
- شامل: academic-foundation.v1.json، exam-model.v1.json، migration 0027/0028، academic-foundation.ts، exam-model.ts و تست‌ها.
- **دقیقاً صفر خط در courses.json**: PR15 تغییر مستقل `courses.json` ندارد؛ نسخه 2162 را از PR والد به ارث می‌برد. (evidence: git diff ad728a9 bfe41ad -- content/knowledge/courses.json → خالی)

## نتیجه آزمون ادغام

- PR14→main: PASS (Automatic merge went well، در worktree جدا، بدون commit واقعی)
- PR15→ad728a9: PASS (متن مشابه)
