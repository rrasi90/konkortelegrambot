# Exam MD structural analysis — report (metadata only)

**Mission:** `AEL-EXAM-MD-ANALYSIS-AND-EXPLANATION-001` (Phase: Inventory + structural extraction, local-only)
**Run:** `structural-20261106f` (deterministic re-run entry: `npm run ael:exam:analyze`)
**Inputs:** 31 local Markdown files in `pdf/` + `pdf/_CONVERSION_REPORT.json` (local-only, not committed)
**Staging:** `.ael-work/exam-analysis/runs/structural-20261106f/` (gitignored, local-only)

> No full question/key text is included in this report or the repo.
> All per-item JSONL lives only in `.ael-work/` and is prohibited from commit/publish
> until the rights gate (H-CONK / SRC-02) is decided.

## 0. Review-driven fixes in this run (AEL review 2026-11-06)

Four structural-analysis fixes from the reviewer's assessment, before any
explanation authoring:

| # | Review item | Fix |
|---|---|---|
| الف | Degree detection assumed `msc` from filename | `detectExamLevel()` — allowed values `msc_management` / `phd_management` / `other` / `unknown` (labels: کارشناسی ارشد مدیریت / دکتری مدیریت / سایر آزمون‌ها / نامشخص), each with `evidence[]` (rule + quote + weight) and `confidence` (high/medium/low/null). No single-signal promotion: set code 1142/2162, title phrase, collection-name cell, known materials structure, filename. Contradictions → `ambiguous`. |
| ب | 1404/1405 keys extracted 0 entries | Digit-safe key parser: Persian **and** Arabic-Indic digits normalized (`toEnDigits` covers both), bidi markers stripped, Arabic `ي/ك` folded to Persian `ی/ک`, table rows walked as `(شماره سوال, گزینه)` pairs skipping header cells; merged OCR digit blobs are flagged (`merged_digit_cell`), never parsed. |
| ج | Pairing was year-only | `scorePairingEvidence()` — year, level, set code, booklet code, question-count overlap as independent weighted rules; known-but-different years are an explicit `year_conflict` that blocks promotion. Best achievable status is `candidate_multi_evidence` — nothing is ever auto-verified. |
| د | Topic mapping was 8 coarse labels | `parseSubjectRanges()` — parses the per-paper subject table (`تا شماره | از شماره | تعداد سوال | مواد امتحانی`) with digit normalization + validation (`count_mismatch`, `range_overlap`), matches materials to a canonical section dictionary (pattern then bigram similarity ≥0.45; otherwise `section_id: null` + needs_review). Each question now carries `topic_candidates` from its range. |

Additional corrections found while implementing:

- Cover-table rows (`گروه امتحانی / شماره پاسخنامه / کد رشته امتحانی`) are excluded
  from key-row walking (previously produced stray `1` pseudo-entries).
- The old hard-coded page-furniture skip (`^107|^103|^319|…`) silently dropped
  legitimate question lines starting with those numbers — replaced by a
  booklet-code pattern (`^[0-9]{3}[A-Z]`), recovering ~40 real questions.
- Set-code extraction gained two evidence-bearing patterns: the `کد 1142` label
  form and the tabular `کد رشته امتحانی | 1142` form (incl. RTL-reversed headers,
  e.g. `یناحتما هتشر دک` in the 1393 key).

## 1. Inventory and integrity

- `source-inventory.jsonl` — 31 sources with `document_id` / `source_id` / `source_version_id`,
  SHA-256 of PDF (from frontmatter) and MD, page count, block count, subject-range summary.
- Page-head integrity: every source has a `## صفحه N از M` head for each page
  (0 missing heads) — consistent with the conversion report (664 pages, 8690 blocks).
- `run-manifest.json` records input hashes for reproducibility.

## 2. Document classification (evidence-based, `document-classification.jsonl`)

- `exam_paper`: 14 (11 frontmatter `exam_paper` + 3 `unknown` frontmatter re-classified via
  `آزمون ورودی` title evidence — `needs_review`, not `verified`).
- `answer_key`: 16 (matches frontmatter).
- `unknown`: 1 — `arshd modiriat-1402` (corrupted title; probable 1402 booklet 818C).
  Quarantined; not guessed.
- Status values: `classified` vs `needs_review`; nothing is marked `verified` / published.

## 3. Exam metadata candidates (`exam-metadata-candidates.jsonl`)

**Level (evidence + confidence on every value):**

| Value | Sources | Confidence |
|---|---|---|
| `msc_management` (کارشناسی ارشد مدیریت) | 27 (13 papers + 14 keys) | 22 `high` (proposed), 5 `medium` (needs_review) |
| `other` (سایر آزمون‌ها) | 2 (keys 1402/1405) | `medium`, needs_review |
| `unknown` (نامشخص) | 1 (quarantined 1402 doc) | `low` |

- Papers: 12 `msc_management` high, 1 medium (`دفترچه 1400` — no set code in head), the
  corrupted 1402 doc stays `unknown`.
- Keys: set code `1142` recovered from cover tables lifts 10 keys to `high`;
  4 keys (`1399/1400/1401/1403`) carry only the `مجموعه مدیریت` collection-name cell →
  `medium`; `1405`'s table is OCR-corrupted (below) → `other` with degree-word evidence only;
  `1402`'s key shows a degree word with no management tie → `other`.
- No value is asserted from a bare filename; every record lists its rules.

**Year:** from title text (`سال NNNN`) where present; otherwise `proposed_filename_only`
(explicitly weak). Booklet codes `103A…819C` `proposed`; `exam_set_code` `1142` where present.

## 4. Question extraction (`questions-<source_id>.jsonl`)

- **2512** appearances across 14 papers (+40 vs the previous run: the hard-coded
  furniture skip had been dropping real question lines starting with booklet-code
  numbers such as `319-`).
- Each record carries `question_appearance_id`, `question_id`, raw vs normalized
  separation, page/line locators, `extraction_status` (`ok` vs `needs_review`),
  `ocr_issues` (`short_stem` / `options_not_4` / `no_options_found`) **and
  `topic_candidates`** (section candidate + range + evidence status from §7).
- Statuses: `ok` 1646, `needs_review` 866 (~34%) — honest, not hidden; none of this
  is production-ready without SME review.
- Per-paper counts range ~119–237; see local JSONL.

## 5. Answer-key extraction (`key-<source_id>.jsonl`)

- **3868** entries across 15/16 keys (`question_number → correct_option`, sorted, deduped).
- **0** conflicting entries.
- Persian/Arabic-digit tables now parse: the 1404 key went 0 → full (1040 Persian
  digits were invisible to the previous Latin-only regex).
- **1 key extracts zero entries:** `جواب 1405` — its single table is OCR-corrupted
  (booklet-code cell merged into a ~200-digit blob, 15 empty cells; 2156 Persian
  digits in 9 cells). Recorded as `key_table_corrupted` and quarantined; **re-OCR
  from the original PDF is required**, no key was guessed.
- **121 answers genuinely missing** from 8 older keys (OCR lost the last pair-column's
  answer cells): 1392→30 (151–180), 1393→35 (296–330), 1397→11, 1398→7, 1399/1401/1402→8,
  1400→14. Each list is in `quarantine.jsonl` (`key_missing_answers`) — these ranges
  must come from a re-OCR pass or manual entry, never interpolated.

## 6. Paper ↔ key pairing (`pairing-results.jsonl`)

Multi-evidence scored pairing (never `verified`):

| Status | Count | Meaning |
|---|---|---|
| `candidate_multi_evidence` | 9 | score ≥6 with ≥2 strong rules (year+level+set code+count) |
| `candidate_evidence_partial` | 4 | year + level agree, no set/booklet code available |
| `candidate_weak` | 1 | 1405 key ↔ 1405 paper (year only — key table corrupted) |
| `needs_review` (year_conflict) | 2 | 1390 key (no 1390 paper in archive → conflicts with 1391); 1402 key (its paper is the quarantined unknown) |

Known-but-different years are recorded as explicit `conflicts` and block promotion
even when other evidence agrees strongly. Every pairing lists its rules in `evidence`.

## 7. Topic mapping candidates (`topic-mapping-candidates.jsonl`)

- **183** subject-range candidates parsed from the 14 papers' subject tables:
  `133 proposed` / `50 needs_review` (count mismatches, OCR-garbled material names).
- 16 distinct canonical sections observed (`english`, `management_theories`,
  `operations_research`, `public_finance`, `investment_risk`, `entrepreneurship`,
  `math_stats`, `economics`, `production`, `marketing`, `financial_management`,
  `accounting`, `government_accounting`, `islamic`, `law`, `human_resources`) —
  far finer than the previous 8 labels; 9 ranges remain `section_id: null`
  (unmatched OCR material, e.g. `پزاریلی`).
- **1736 / 2512** questions (69%) carry a section candidate from their validated
  range; 776 have none yet (range gaps/needs_review ranges) — recorded, never forced.
- Question-to-topic is still `candidate`/`needs_review` everywhere: connecting to the
  Taxonomy (Course Offering / Curriculum / Syllabus Node / Skill) is the next phase and
  needs the updated knowledge graph.

## 8. Quarantine (`quarantine.jsonl`, local-only)

- 27 records: 1 unknown document, 1 uncertain metadata, 14 subject-table issues,
  8 key-missing-answers (121 question numbers listed), 1 corrupted 1405 key table,
  2 pairing year-conflicts.
- Policy preserved: ambiguous/incomplete items stay quarantined; never auto-verified.

## 9. Gates that remain closed

- **Rights (H-CONK / SRC-02):** AI processing and republication remain forbidden.
  All outputs stay `pending_review` / `pending_official_check`, local-only.
- **SME review:** no explanation is verified or publishable.
- **Production:** no batch explanation generation in this run — per the review, the
  structural layer must be trustworthy first (this run is that step).

## 10. Reproduce

```powershell
npm run ael:exam:analyze   # -> .ael-work/exam-analysis/runs/structural-20261106f/
npx vitest run src/tests/exam-analyze.test.ts
```

`scripts/ael-exam-analyze.mjs` (pipeline, no network) + `scripts/ael-exam-utils.mjs`
(pure helpers shared with tests; 33 isolated parser tests: digits, key tables,
level evidence, subject ranges, pairing scoring). Inputs are read-only; staging is
gitignored. Entity model for the next phases: `docs/ael-implementation/AEL_QUESTION_ENTITY_MODEL.md`.
