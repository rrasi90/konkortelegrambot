# Course & Syllabus Mapping Report

**Mission:** `AEL-HISTORICAL-EXAM-RECOVERY-AND-VERIFICATION-002` · 2026-11-07
**Run base:** `structural-20261106f`

## 1. Chain status

`ExamDocument → QuestionAppearance → Question → Course → SyllabusNode → Skill`

Implemented so far: the first three hops (documents, appearances, per-question section
candidates). The last three hops (Course / SyllabusNode / Skill) are **candidates only** —
the canonical knowledge model (`courses.json`, `syllabus-nodes.json`, `skills.json`) is
not yet linked automatically, by design (mission §7: subject-range tables are evidence,
not truth).

## 2. Subject-range evidence (183 candidates)

- **133 proposed / 50 needs_review** across 14 papers.
- 16 canonical sections observed: production (24), english (17), financial_management (16),
  entrepreneurship (15), marketing (14), accounting (14), investment_risk (13),
  math_stats/management_theories/economics/public_finance/operations_research (9 each),
  islamic (6), human_resources (6), government_accounting (3), law (1).
- Range issues: **42 count_mismatch** (declared ≠ to−from+1 — OCR digit slips in the
  subject tables), **9 material_unmatched** (garbled material names below similarity
  threshold — section stays `null`, never guessed).
- Per-question coverage: **1,736 / 2,512 appearances (69%)** carry a section candidate;
  776 have none (range gaps or needs_review ranges).

## 3. The 776 unmapped appearances (mission §7)

Cause analysis (from `question_number_gaps` quarantine + range data): the unmapped
population is dominated by question numbers inside subject-table holes or inside ranges
flagged `count_mismatch`. The largest contributors are the table-heavy pages of
1391/1395/1398/1399/1400 papers whose two-column RTL layout was lost at OCR level.
Repair belongs to the OCR/ingestion pass (see `QUESTION_EXTRACTION_REPAIR_REPORT.md` §3).

## 4. Rules enforced (no duplicate taxonomy entities, no blind range assignment)

- A question only receives `topic_candidates` when its number falls inside a **validated**
  subject range; ranges with unresolved issues mark their questions `needs_review`.
- No Course/SyllabusNode/Skill record was created or modified in this mission; the
  section IDs above are candidates from the subject tables, mapped 1:1 onto the existing
  canonical dictionary — no second taxonomy was introduced.
- Next phase (SME-enabled): attach `Course Offering / Curriculum / Syllabus Node / Skill`
  per section candidate with per-question evidence review, starting from the 133
  `proposed` ranges.
