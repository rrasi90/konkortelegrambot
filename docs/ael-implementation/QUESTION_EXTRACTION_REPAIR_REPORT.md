# Question Extraction Repair Report

**Mission:** `AEL-HISTORICAL-EXAM-RECOVERY-AND-VERIFICATION-002` · 2026-11-07
**Run base:** `structural-20261106f` (deterministic re-run)

## 1. The 866 `needs_review` appearances — classification (mission §5)

All needs_review items were classified by issue signature over the actual data:

| Signature | Meaning | Handling |
|---|---|---|
| `short_stem` (table-embedded) | stem lives in a colspan cell the MD export dropped | **repaired**: colspan stem capture (see §2) |
| `options_not_4` | 1–3 options on the line; rest cut across cells/lines | honest flag; repair needs per-page image compare |
| `no_options_found` | option column lost in OCR | honest flag |
| `cloze_options_only_item` (**new**) | numbered line IS the four options (cloze/passage items) | re-classified from false-`ok` to explicit category; requires `QuestionContext` attachment |
| page furniture misreads (`صفحه 103C …`) | page furniture parsed as question content | stays flagged |

New status distribution after repairs: **ok 1632 / needs_review 880** (was ok 1646 / 866 —
14 cloze items moved from false-ok to the honest category; 20 table-embedded items gained
stems but their issues list is unchanged until options complete).

## 2. Repairs implemented this mission

1. **Colspan stem capture** — a wide colspan cell holding only text is now attached as the
   stem of the following numbered table row (`stem_source: colspan_prev_row`).
   Result: 20/42 table-embedded rows now carry a real stem (was 0).
2. **Cloze classification** — items whose "stem" is the four options are labelled
   `cloze_options_only_item` instead of silently passing as ok. Mission §5.1 requires
   shared-passage context before authoring (e.g. 1393 q11–13); passage capture is
   registered as the follow-up (`QuestionContext` entity, entity model doc §2.2 note).
3. **Question-number gap quarantine** — for every paper, numbers 1..declared-span with no
   extracted record are quarantined (`question_number_gaps`, span anchored to the subject
   table, not the noisy extracted max). Total: 2,278 holes across 14 papers; the largest
   single cause is two-column RTL layout loss in the MD export (a structural OCR issue,
   not a parser bug) — repair belongs to the ingestion/OCR pass, not to the MD parser.

## 3. Remaining issues (explicit)

- 2,278 question-number holes: the MD layer structurally misses ~50% of stems in
  table-heavy pages; recovery must happen at OCR level (middle_json already checked —
  it carries the same loss) or from the original PDFs with a layout-aware engine.
  The text-layer method that recovered the keys applies to **papers only where the PDF
  has an embedded text layer** — the same 12/16 verdict applies.
- All `options_not_4`/`no_options_found` items stay `needs_review` — no status was
  flipped to `ok` without evidence (mission §5 forbids it).

## 4. Regression fixtures

Parser behavior is covered by 35 isolated tests in `src/tests/exam-analyze.test.ts`
(digits FA/AR, bidi folding, key tables incl. merged blobs, level evidence, subject
ranges, pairing scoring incl. year-conflict, key gaps). New fixtures for the cloze and
colspan paths are part of this suite's synthetic corpus.
