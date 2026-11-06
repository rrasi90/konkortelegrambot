# Exam MD structural analysis — report (metadata only)

**Mission:** `AEL-EXAM-MD-ANALYSIS-AND-EXPLANATION-001` (Phase: Inventory + structural extraction, local-only)
**Run:** `structural-20261106f` (deterministic re-run entry: `npm run ael:exam:analyze`)
**Inputs:** 31 local Markdown files in `pdf/` + `pdf/_CONVERSION_REPORT.json` (local-only, not committed)
**Staging:** `.ael-work/exam-analysis/runs/structural-20261106f/` (gitignored, local-only)

> No full question/key text is included in this report or the repo.
> All per-item JSONL lives only in `.ael-work/` and is prohibited from commit/publish
> until the rights gate (H-CONK / SRC-02) is decided.

## 1. Inventory and integrity

- `source-inventory.jsonl` — 31 sources with `document_id` / `source_id` / `source_version_id`,
  SHA-256 of PDF (from frontmatter) and MD, page count, block count.
- Page-head integrity: every source has a `## صفحه N از M` head for each page
  (0 missing heads) — consistent with the conversion report (664 pages, 8690 blocks,
  missing 0).
- `run-manifest.json` records input hashes for reproducibility.

## 2. Document classification (evidence-based, `document-classification.jsonl`)

- `exam_paper`: 14 (11 frontmatter `exam_paper` + 3 `unknown` frontmatter re-classified via
  `آزمون ورودی` title evidence — `needs_review`, not `verified`).
- `answer_key`: 16 (matches frontmatter).
- `unknown`: 1 — `arshd modiriat-1402` (corrupted title; probable 1402 booklet 818C).
  Quarantined; not guessed.
- Status values: `classified` vs `needs_review`; nothing is marked `verified` / published.

## 3. Exam metadata candidates (`exam-metadata-candidates.jsonl`)

- Level candidate: `msc` for all papers; unknown for a subset of keys whose heads lack an
  explicit level string.
- Year candidate: from text (`سال NNNN`) where available; otherwise **filename hint only**
  (`proposed_filename_only`) — explicitly weak evidence, requires human confirmation.
- Booklet code candidate: `NNNA` pattern from head (e.g. 103D/107A/319A/519C/141C/818C…);
  `exam_set_code` 1142 where present. All `proposed`, none `verified`.
- Empty/ambiguous cases (e.g. the unknown 1402 paper, 1390/1393/1402/1405 keys)
  are listed in `quarantine.jsonl` (`uncertain_metadata`).

## 4. Question extraction (`questions-<source_id>.jsonl`)

- **2472** appearances extracted across 14 papers (`questions_extracted`), with
  `question_appearance_id`, `question_id`, raw vs normalized separation, page/line locators,
  `extraction_status` (`ok` vs `needs_review`) and `ocr_issues`
  (`short_stem` / `options_not_4` / `no_options_found`).
- Parser handles plain `NN- …` / `NN …` lines (incl. Persian-digits stems) and table-embedded
  `<tr><td>NN-</td><td>opt…` rows; CRLF (`\r`) handling fixed (was silently dropping most rows).
- Known coverage limits (honest, not hidden):
  - Persian numbering OCR errors (e.g. digit misreads) and two-column RTL order noise
    leave some numbers unmatched vs the official key range.
  - ~25–35% of extracted items are `needs_review` (missing stem in colspan cells or
    inline options split across cells). Not used for production without SME review.
- Per-paper counts range ~116–234; see local JSONL.

## 5. Answer-key extraction (`key-<source_id>.jsonl`)

- **3583** numeric key entries across the 16 keys (sorted `question_number → correct_option`).
- **0** conflicting entries detected.
- Known gap: 2 keys serialize zero entries in this run because their tables use
  Persian-digit cells (`<td>۱۲۳</td>`), which the current regex (Latin `\d`) skips.
  They are recorded in staging as empty (not deleted) and need a Persian-digit pass —
  listed as follow-up, not silently verified.

## 6. Paper ↔ key pairing (`pairing-results.jsonl`)

- Year-match pairing: **14 candidate**, **2 unresolved** (1390 key has no 1390 paper in the
  archive; 1402 key’s paper is the quarantined unknown).
- All pairings are `candidate` with single-evidence (`year_match`) — **no multi-evidence
  verified pairing claimed**. Awaiting booklet-code + title confirmation per §C.

## 7. Taxonomy mapping candidates (`taxonomy-mapping-candidates.jsonl`)

- 57 coarse section candidates from each paper’s first subject table
  (`english` / `islamic` / `math_stats` / `management_theories` / `economics` /
  `operations_research` / `production` / `marketing`), all `candidate_needs_review`.
- No question-to-topic/skill claim is made in this phase; gap analysis belongs to the
  next phase and requires an updated knowledge graph.

## 8. Quarantine (`quarantine.jsonl`, local-only)

- 8 records: 1 unknown document, 7 uncertain-metadata entries (see staging).
- Policy preserved: ambiguous/incomplete items stay quarantined; never auto-verified.

## 9. Gates that remain closed

- **Rights (H-CONK / SRC-02):** AI processing and republication remain forbidden.
  All outputs stay `pending_review` / `pending_official_check`, local-only.
- **SME review:** no explanation is verified or publishable.
- **Production:** no batch explanation generation in this run.

## 10. Reproduce

```powershell
npm run ael:exam:analyze   # -> .ael-work/exam-analysis/runs/structural-20261106f/
npx vitest run src/tests/exam-analyze.test.ts
```

`scripts/ael-exam-analyze.mjs` (pipeline, no network) + `scripts/ael-exam-utils.mjs`
(pure helpers shared with tests). Inputs are read-only; staging is gitignored.
