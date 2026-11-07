# NEXT ACTIONS — اولویت‌بندی بعد از consolidation 20261107

**Base:** main `718c54c` / branch `7ceb5f7` (consolidation)
**Updated:** 2026-11-07

## Immediate (P0 — needs owner action)

| # | Action | Command/Input | Blocked on |
|---|---|---|---|
| 1 | Start Telegram bot with new /start message | `export TELEGRAM_BOT_TOKEN=<from @BotFather>` then `npm run bot` | TELEGRAM_BOT_TOKEN |
| 2 | Approve branch deletions (M5) | review `docs/audit/BRANCH_MERGE_PLAN.md` ledger → `git push origin --delete <branch>` × 9 | owner decision |
| 3 | Supabase connection (RK-13) | `npx wrangler secret put SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `ENVIRONMENT=production`; delete `ALLOW_DEMO_AUTH` | Supabase credentials |
| 4 | Migration 0015 on real DB | SQL Editor per ACTIVATION_RUNBOOK_20261103.md گام ۱ | DB access |
| 5 | Resolve PhD code discrepancy 2162 vs 2171 | official document (کارنامه/دفترچه) | official source |

## High priority (P1 — exam content)

| # | Action | Priority | Blocked on |
|---|---|---|---|
| 6 | 1405 msc key: official retrieval from sanjesh noet_tk | P1 | applicant credentials |
| 7 | 1400 key 48 holes: image OCR column-aware pairing | P1 | OCR tooling decision |
| 8 | 1402 key 15 holes: targeted image OCR + SME | P1 | OCR tooling |
| 9 | 1402 paper: re-OCR from mastertest scan | P1 | OCR tooling |
| 10 | PhD booklets 1396-1405: download from phdtest/irantest/heyvagroup | P1 | retrieval + rights check |
| 11 | 1390 paper: retrieve from mastertest/noandishaan | P1 | retrieval |
| 12 | ~50% question-number holes: OCR-level repair or re-ingestion | P1 | OCR engine decision |

## Medium priority (P2 — content depth)

| # | Action | Priority |
|---|---|---|
| 13 | OR/تولید authored questions +۳ سطح per topic | P2 |
| 14 | زبان تألیفی +۱۰ (به سمت ۴۰ سؤال آزمون) | P2 |
| 15 | آمار کمی دکتری‌سطح +۵ | P2 |
| 16 | deep-dive درسنامه ۱۲ گره جدید (قالب §5.3: ۱۴ بند) | P2 |
| 17 | SME review ۲۷۹ سؤال | blocked on reviewer |

## Low priority (P3 — UX/automation/E2E)

| # | Action | Priority |
|---|---|---|
| 18 | Reminder auto-delivery (crons + DO/queue) | P3 |
| 19 | CloudStorage recovery E2E, device switch, offline | P3 |
| 20 | ≥35 more journeys to reach 50 | P3 |
| 21 | Accessibility (screen reader, keyboard, contrast) | P3 |
| 22 | Telegram webhook E2E (needs token) | P3 |
