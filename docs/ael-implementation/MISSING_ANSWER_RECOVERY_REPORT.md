# Missing Answer Recovery Report

**Mission:** `AEL-HISTORICAL-EXAM-RECOVERY-AND-VERIFICATION-002` · 2026-11-07
**Local staging:** `.ael-work/exam-recovery/` (text-layer/, merged-keys/, ocr-out/) — local-only.
**Rights note:** counts and ranges only; no key content committed.

## 1. Recomputed baseline (from actual data, not previous report)

Baseline figures from `structural-20261106f` re-verified: 676 missing key numbers across
10 keys, plus 8 suspect out-of-range 1404 entries, plus the unusable 1405 key. All ranges
re-validated against `quarantine.jsonl` — matches the reported values (30/84/76/57/69/66/48/66/66/114).

## 2. Recovery strategy executed

**Discovery:** the embedded text layer of the ORIGINAL PDFs (31/31 SHA-256-verified against
the registry) is machine-readable for 12/16 keys — a **different, independent extraction**
from the MinerU OCR, with zero OCR-dependence.

Tools (committed, reusable):

- `scripts/ael-key-text-recovery.py` — layout-mode text extraction + pair walking +
  cross-validation against the OCR run (`npm run ael:exam:recovery`).
- `scripts/ael-key-merge-recovered.py` — provenance-preserving union with trust gates
  (`npm run ael:exam:merge-keys`).

### Trust gates (never fabricate)

1. **Hash gate:** PDF must be byte-identical to the registry, else skipped.
2. **Agreement gate:** text-layer vs OCR overlap must show ≥80% agreement; the broken-font
   1400 text layer (8/11 disagreement) is marked unusable and excluded.
3. **Conflict gate:** disagreements are recorded as `disputed_option_text_layer` +
   `review: sme_required`; OCR value is kept, never overwritten silently.
4. **Range gate:** OCR-only numbers beyond the text layer's complete span are flagged
   `out_of_range_suspect` (this resolved the 8 suspect 1404 entries as digit misreads).

## 3. Results per key (union of OCR + text layer)

| سال | OCR | Text layer | Union entries | Span | Remaining holes | Recovered (gap fills) |
|---|---|---|---|---|---|---|
| ۱۳۹۰ | 320 | — (scan) | 320 | 320 | 0 ✅ | — |
| ۱۳۹۱ | 320 | — (scan) | 320 | 320 | 0 ✅ | — |
| ۱۳۹۲ | 290 | 301 | 320 | 320 | 0 ✅ | 30 |
| ۱۳۹۳ | 295 | 280 | 295 | 295 | 0 ✅ | — |
| ۱۳۹۴ | 310 | 301 | 310 | 310 | 0 ✅ | — |
| ۱۳۹۵ | 225 | 310 | 310 | 310 | 0 ✅ | 85 |
| ۱۳۹۶ | 234 | 310 | 310 | 310 | 0 ✅ | 76 |
| ۱۳۹۷ | 224 | 295 | 295 | 295 | 0 ✅ | 71 |
| ۱۳۹۸ | 208 | 295 | 295 | 295 | 0 ✅ | 87 |
| ۱۳۹۹ | 212 | 295 | 295 | 295 | 0 ✅ | 83 |
| ۱۴۰۰ | 236 | unusable (font) | 236 | 284 | **48** | 1 |
| ۱۴۰۱ | 212 | 295 | 295 | 295 | 0 ✅ | 83 |
| ۱۴۰۲ | 212 | 270 | 270 | 285 | **15** (196–200, 226–230, 256–260) | 58 |
| ۱۴۰۳ | 285 | — (scan) | 285 | 285 | 0 ✅ | — |
| ۱۴۰۴ | 285+8 suspect | 285 complete | 285 | 285 | 0 ✅ + 8 suspects resolved | 8 |
| ۱۴۰۵ | 0 | 0 (scan) | 0 | ~285? | **entire key** | 0 |

- **581 missing answers recovered** with provenance (`text_layer_gap_fill`).
- Cross-validation: **0 disagreements** on every overlapping entry across all usable keys
  (271+225+234+224+208+212+180+180+212+212+277+231 = 2,666 agreeing pairs) — strong
  evidence both extraction paths read the same official tables.
- **Zero disputed entries** remained after trust gating.
- Note (SME): 1395 text layer spans 1–310 while OCR max was 309 — the ±1 boundary needs
  a one-off human check against the paper's subject table.

## 4. Unresolved gaps — explicit, with retrieval instructions

| Gap | Cause | Next action |
|---|---|---|
| 1400 key: 48 holes (195–210, 225–240, 255–270) | PDF embedded font uninterpretable → text layer is garbage; MinerU re-run deterministic (same 236) | Image-OCR (EasyOCR rendered at 300 DPI is available in staging) with column-aware parsing, or manual entry from the PDF page |
| 1402 key: 15 holes (196–200, 226–230, 256–260) | columns partially lost in both OCR and text layer | targeted image OCR of those table regions + SME confirmation |
| 1405 key: entire table | scan is low-quality (booklet-code cell merged into a ~200-digit blob); MinerU re-run → 0; EasyOCR → only 78/285 numbers readable | **retrieval from official source required**: `www8.sanjesh.org/noet_tk/` with applicant credentials, or a higher-quality scan; do NOT guess |
| 1404 entries 233–240 | OCR misread them as 333…399; text layer provides the true values | already resolved (provenance `text_layer_gap_fill`); kept 8 suspects flagged `out_of_range_suspect` for audit |

## 5. Cross-year corroboration (mission §3.3)

Implemented and run (`scripts/ael-question-dedup.mjs`): 9 exact-repeat groups across
years (1392↔1393 English ×6, 1399↔1400 marketing, 1404↔1405, 1401 intra-booklet pair)
plus 16 near-duplicate pairs. Corroborated answers are candidates only; option-order
mapping and transferability decisions belong to the SME phase
(see `CROSS_YEAR_QUESTION_MATCHES.csv` — metadata only).
