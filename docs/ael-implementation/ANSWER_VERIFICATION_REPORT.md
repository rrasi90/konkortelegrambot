# Answer Verification Report

**Mission:** `AEL-HISTORICAL-EXAM-RECOVERY-AND-VERIFICATION-002` · 2026-11-07
**Scope note:** this mission performed *extraction-level verification*. Independent
scientific solving (mission §4) was **not started** — it is gated by the rights matrix
(H-CONK / SRC-02) and belongs to the authoring phase with SME workflow.

## 1. What was verified, and how

| Verification | Method | Result |
|---|---|---|
| Key-entry correctness (structural) | two independent extraction paths (MinerU OCR vs PDF embedded text layer) cross-checked on 2,666 overlapping entries | **0 disagreements** → both paths read the same official tables |
| 1404 suspect entries (333…399) | text layer is complete 1–285; the 8 OCR numbers do not exist there | resolved as digit misreads; true 233–240 entries recovered |
| 1400 text layer | 8/11 overlap disagreement → broken embedded font | marked unusable, excluded (never trusted) |
| Pairing soundness | multi-evidence scoring + explicit year-conflict blocking | 9 multi-evidence / 4 partial / 1 weak / 2 year-conflict; nothing auto-verified |
| Cross-year corroboration | exact content-hash + ≥0.92 trigram matching, metadata-only | 9 exact groups, 16 near pairs — candidates for SME, not evidence of correctness by themselves |

## 2. Official-key vs scientific-answer policy (unchanged, mission §9)

- The official key (`AnswerKeyEntry`) is never copied into `scientific_answer`.
- `Explanation` records do not exist yet; no explanation was generated in this mission
  (gates closed). No answer is marked `verified`, `approved`, or `published`.

## 3. Independent solving — status and plan

Not performed in this mission. Exact reasons:

1. Rights gate: AI processing of protected question text requires the H-CONK / SRC-02
   decision (see `RIGHTS_AND_SME_BLOCKERS.md`).
2. Solve-order dependency: 2,278 question-number holes and 880 needs_review items must be
   repaired first, otherwise "independent solving" would run on a biased, incomplete
   sample.
3. Reference hierarchy and citation discipline (mission §4.1/§4.2) require the SME
   workflow to be live before any claim can be recorded.

Blocked deliverable items are listed with exact owners in the blockers report.
