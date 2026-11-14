# AEL — project instructions

## Before changing UI

Read `docs/design/MINIAPP_REDESIGN_PLAN_FA.md`. The mini app is built from `src/` with `npm run build:miniapp` into `dist-miniapp/`, then synced to `apps/miniapp/` with `npm run sync:miniapp`. Do not edit the built bundle by hand.

Before any production deploy, run `npm run check:production`. The Worker deploy script already calls it. It blocks deploys when durable Supabase secrets are missing, `ENVIRONMENT` is not `production`, or the synced mini-app asset set is broken.

For frontend/UI work, read `.agents/skills/elite-frontend-ux/SKILL.md` and apply:

- 60-30-10 color ratio: 60% neutral canvas, 30% text/structure, 10% accent.
- One bold chrome accent only (mint); mango only for attention; green/red only for answer feedback.
- Subject color is content, not chrome: each lesson has one fixed hue; use it only on the flashcard spine, subject chip, session progress and session CTA. Mint is off during review; see plan §5.2.1.
- Body text at least 16px; touch targets at least 44px; one primary CTA per screen.
- No purple/blue gradients, no generic glass/bento card kit, no more than 3 font weights.
- Respect `prefers-reduced-motion`; never animate layout properties.

## Persian copy

For any Persian/Farsi text, read `.agents/skills/persian-writing/SKILL.md` plus `references/orthography.md` and `references/writing-style.md`.

- UI register: formal-but-human. Full verb forms, direct address, short sentences. No `می‌باشد`, `لازم به ذکر است`, `در راستای`, `نقش بسزایی`, em dashes, or rule-of-three filler.
- ZWNJ (نیم‌فاصله), Persian ی/ک, Persian digits (۰-۹), Persian guillemets «...», Persian comma/question mark.
- Every Persian sentence, heading, bullet and table cell starts with a Persian word (bidi rule). Wrap Latin fragments in `<bdi>`; use `dir="ltr"` for formulas/code.
- Lint prose before handover:

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONIOENCODING=utf-8 python .agents/skills/persian-writing/scripts/fa_lint.py --check <file>
```

## Flashcards

For flashcard content or review UI, read `.agents/skills/cognitive-flashcards/SKILL.md`, `references/COGNITIVE_LAYERS.md`, `references/ATOMICITY.md`, and `.agents/skills/flashcard-reasoning/SKILL.md`.

- One concept per card; split at "and".
- Label each card L1 (recall), L2 (understanding) or L3 (boundary).
- No cards for multi-step proofs, worked examples or tightly coupled lists longer than 3 items; send those to practice/lesson.
- L1 answer: one sentence or up to 3 bullets. L2/L3: up to 2 sentences.

## Redesign status

The redesign plan in `docs/design/MINIAPP_REDESIGN_PLAN_FA.md` is **pending owner approval**. Do not start UI restructuring, navigation changes, or token replacement until the owner approves.

The user journey and feature expansion spec is `docs/design/USER_JOURNEY_AND_FEATURE_SPEC_FA.md`. On 2026-11-13 the owner approved and the team implemented slice A + B + C: rescued Anki text cards, personal flashcards, content reports, dual-goal settings and the daily-reminder backend/UI. The 100-mode lab, APKG import, card sync and the visual redesign remain pending. Feature work may add additive tables/API as the spec describes; a UI-only change must still not alter engine, data, auth or storage shape.

When approved, the plan's constraints apply: four top-level destinations (امروز، مطالعه، تمرین، پیشرفت), settings in the header, one card system, radius 12/8/pill, no decorative gradients. The HTML prototype `docs/design/prototypes/ael-today-v2.html` is the visual reference for the new palette.

Do not change engine, data, API, auth or storage shape as part of a UI change. See `.agents/skills/README.md` for skill sources, versions and licenses.
