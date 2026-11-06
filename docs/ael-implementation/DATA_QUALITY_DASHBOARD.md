# Data Quality Dashboard

**Mission:** `AEL-HISTORICAL-EXAM-RECOVERY-AND-VERIFICATION-002` · 2026-11-07
Base run: `structural-20261106f` (deterministic: `npm run ael:exam:analyze`)

## 1. Headline before/after

| Metric | Before mission | After mission | Δ |
|---|---|---|---|
| Key entries (OCR only) | 3,868 | 3,868 (unchanged source layer) | — |
| Key entries incl. text-layer union | 3,868 | **4,449** | +581 |
| Missing key numbers | 676 + 8 suspect | **63** (1400: 48, 1402: 15) | −613 (−91%) |
| 1404 suspect out-of-range entries | 8 unresolved | **0** (resolved as misreads; kept flagged for audit) | −8 |
| 1405 key | unusable | unusable (blocked: source quality) | — |
| Years with complete key coverage (declared span) | 6/15 | **12/15** (1390–1399 excl. 1400, 1401, 1403, 1404) | +6 |
| Question appearances | 2,512 | 2,512 | — |
| Appearances `ok` | 1,646 | 1,632 (+14 cloze re-classified honestly, +20 stems recovered) | −14 ok / +20 stems |
| Table-embedded rows with real stem | 0 | **20/42** | +20 |
| Question-number holes (declared span) | unmeasured | 2,278 measured & quarantined | new visibility |
| Exact cross-year repeat groups | unknown | 9 (18 appearances) | new |
| Near-duplicate pairs | unknown | 16 | new |
| Subject-range candidates | 183 | 183 (133 proposed / 50 needs_review) | — |
| Questions with section candidate | 1,736 (69%) | 1,736 (69%) | — |

## 2. Recovery rate

- Recoverable key gaps (had an embedded text layer): 613 of 676 → **90.7% closed**.
- Whole-corpus key coverage: 4,449 / (4,449+63+~285 for 1405) ≈ **92.6%** of all declared
  spans, with the rest explicitly blocked on source quality (not on tooling).

## 3. Confidence distribution (key entries)

| Provenance | Entries |
|---|---|
| `ocr+text_layer_agree` (highest) | 2,666 |
| `ocr` only (keys without text layer / OCR-side) | ~1,202 |
| `text_layer_gap_fill` (recovered) | 581 |
| `out_of_range_suspect` (audit) | 8 |
| disputed (SME required) | 0 |

## 4. Unresolved rate (explicit, never hidden)

- Keys: 63 holes (1400, 1402) + 1405 full key (~285) — blocked on source quality.
- Papers: 2,278 question-number holes + 880 needs_review appearances — blocked on
  OCR-level repair, rights-gated external processing.
- Pairing: 9 multi-evidence / 4 partial / 1 weak / 2 year-conflict — **0 verified by design**.

## 5. Reproducibility

```powershell
npm run ael:exam:analyze      # structural run
npm run ael:exam:recovery     # text-layer recovery (needs local PDF archive)
npm run ael:exam:merge-keys   # provenance-preserving union
npm run ael:exam:dedup        # cross-year matching (metadata only)
npx vitest run src/tests/exam-analyze.test.ts
```
