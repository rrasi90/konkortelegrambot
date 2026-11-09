# Five-Round User Journey Report — consolidation 20261107

**Evidence base:** previous UX audit session (2026-11-06) — 5 rounds documented in `.ael-work/ux-audit/round1-findings.md`; this report references and extends it. Each round ran in a browser (viewport 420×860 mobile, ZCode IAB) against the dev server with the React app + live Worker miniapp verification.

**Honest scope:** rounds were run in the React app (`src/App.tsx` dev server) with real interaction (DOM snapshot + screenshot evidence); Worker miniapp live checks were API-level, not browser-level. ≥50 independent journeys NOT yet achieved — this report covers ~15 journey segments across 5 rounds. Remaining 35+ journeys → P3-next.

## Round 1 — fresh beginner (onboarding, track selection, placement)

| journey_id | action | expected | actual | pass |
|---|---|---|---|---|
| R1-j01 | fresh localStorage → /start | onboarding modal appears | ✅ (snapshot: 4 track buttons) | ✅ |
| R1-j02 | select دکتری → track becomes phd | queue label changes to دکتری تخصصی مدیریت | ✅ | ✅ |
| R1-j03 | exam date 2027-03-05 → countdown | «۱۱۸ روز تا آزمون» chip appears | ✅ | ✅ |
| R1-j04 | placement auto-opens | 5 سؤال تعیین سطح appears | ✅ | ✅ |
| R1-j05 | answer 5 questions → result | «نتیجه: 3 از 5» + «پاسخ شما گزینه N — کلید: گزینه M» | ✅ (fixed in this session) | ✅ |

## Round 2 — struggling learner (session, wrong answer, report)

| journey_id | action | expected | actual | pass |
|---|---|---|---|---|
| R2-j01 | start review session (20 گام) | گام 1 from 20 with درسنامه | ✅ | ✅ |
| R2-j02 | answer question wrong (deliberately) | ✗ red + ✓ green + explanation + trapNote | ✅ (screenshot evidence) | ✅ |
| R2-j03 | پایان جلسه (early exit) | کارنامه appears with «جلسه را زودتر بستید؛ 1 گام از 22» | ✅ (fixed in this session) | ✅ |
| R2-j04 | error classification «بدخوانی صورت سؤال» | دفتر خطا + مباحث نیازمند ترمیم visible | ✅ | ✅ |
| R2-j05 | CTA تمرین دوباره سؤالات غلط | button present | ✅ | ✅ |

## Round 3 — navigation and alert noise

| journey_id | action | expected | actual | pass |
|---|---|---|---|---|
| R3-j01 | several actions → check alert does not repeat | cloud-sync alert shows once per session | ✅ (fixed: top-14 position, once-per-session ref) | ✅ |
| R3-j02 | بیشتر menu opens without alert blocking | all 5 items accessible | ✅ (fixed: alert no longer covers nav) | ✅ |
| R3-j03 | bot simulator new message | no v3.0/کالیبره/گلوگاهی; no destructive Reset button | ✅ (fixed) | ✅ |

## Round 4 — archive and timer

| journey_id | action | expected | actual | pass |
|---|---|---|---|---|
| R4-j01 | archive timer proportional | 9 سؤال → 00:12:00 (not 02:30:00) | ✅ (fixed: bankCount × 80s) | ✅ |
| R4-j02 | PhD user sees honest archive state | PhD message + ارشد exercise button | ✅ | ✅ |

## Round 5 — full regression + PhD content

| journey_id | action | expected | actual | pass |
|---|---|---|---|---|
| R5-j01 | 606 tests + typecheck 0 + build + PDF guard | all green | ✅ | ✅ |
| R5-j02 | fresh localStorage → full journey sanity (6 checks) | all pass | ✅ | ✅ |
| R5-j03 | Worker /api/lessons shows 9 courses incl. phd-expansion | 12 topics live | ✅ (live API check) | ✅ |
| R5-j04 | Worker /api/diagnostic serves new PhD nodes | 5/12 nodes in 10-item sample | ✅ (live API check) | ✅ |
| R5-j05 | worker tests 199 + main 606 | all green | ✅ | ✅ |

## Defects found and fixed during rounds

1. ~~alert covers nav~~ → fixed (top-14, once-per-session)
2. ~~empty report says «همه پاسخ‌ها درست»~~ → fixed (conditional)
3. ~~end-session skips report~~ → fixed (setIsFinished(true))
4. ~~placement result missing پاسخ شما~~ → fixed

## Remaining journeys (P3-next, ≥35 needed)

- CloudStorage recovery, device switch, offline, network retry, duplicate answer
- reminder timezone, quiet hours, opt-out
- exam-simulation full flow, holdout/proof
- screen reader, keyboard, contrast, font scaling
- Telegram webhook E2E (needs token)
