# Historical Exam Source Discovery Report

**Mission:** `AEL-HISTORICAL-EXAM-RECOVERY-AND-VERIFICATION-002`
**Date:** 2026-11-07 · **Run base:** `structural-20261106f`
**Rights note:** metadata-only report; no protected exam text is included.

## 1. Local archive re-verification (primary source of truth)

The original PDFs were located outside the repo and verified byte-identical to the
ingestion registry:

- Location: `%USERPROFILE%/Downloads/Compressed/Arshad_modiriat_keycafetadris.com_/` (31 PDFs)
- **SHA-256 match: 31/31** against `.ael-work/pdf-ingestion/registry/registry.json`.
- Consequence: all Phase-3 recovery could proceed against *the same bytes* that
  produced the existing archive — no provenance drift.

New acquisition (retrieved during this mission):

| File | Source | Size | SHA-256 (first 16) | Status |
|---|---|---|---|---|
| `1402-paper-1142-mastertest.pdf` | mastertest.ir → `wp-content/soal1402/1142.pdf` | 2,627,037 B | `c0733be9ea419be5` | 40 pages, **no text layer** (scan) — differs from local `arshd modiriat-1402.pdf`? to be compared by hash/provenance; staged local-only |

## 2. Searches performed (ordered per mission §2.2)

| # | Query | Best findings |
|---|---|---|
| 1 | `کلید سوالات آزمون کارشناسی ارشد مدیریت ۱۴۰۵ سازمان سنجش` | Official key system `www8.sanjesh.org/noet_tk/` (کلید اولیه, ۳۱ تیر ۱۴۰۵); mirrors: heyvagroup blog 7579, mastertest.ir |
| 2 | `دفترچه سوالات کنکور ارشد مدیریت ۱۴۰۲ PDF دانلود` | mastertest direct PDF (retrieved ✓), myparseh, modaresanesharif; exam used booklet C, گروه علوم انسانی |
| 3 | `سوالات دکتری مدیریت تخصصی دفترچه کلید ۱۴۰۴ ۱۴۰۵` | phdtest.ir (دکتری ۱۴۰۴), heyvagroup 9587 (از سال ۹۴), irantest (۹۵–۱۴۰۵); **discrepancy found: DBA reported under کد ۲۱۷۱, repo R-001 records ۲۱۶۲ — needs official verification, not overwritten** |
| 4 | `دفترچه سوالات کنکور ارشد مدیریت ۱۳۹۰ دانلود` | mastertest (90), noandishaan forum 42862, cafetadris 15-year archive |
| 5 | `"sanjesh.org" کلید اولیه ارشد 1405 مدیریت 1142` | Official system confirmed (needs شماره داوطلب credentials); ISNA/Mehr coverage for timeline |

Rejected/not-retrievable sources:

- `www8.sanjesh.org/noet_tk/` — HTTP 403 for anonymous fetch; requires applicant
  credentials (شماره داوطلب / کد رشته). **Retrieval instruction:** obtain the official
  key PDF for booklet 519C/1142 year 1405 from the Sanjesh system with valid credentials.
- `heyvagroup.com/blog/7579/` — HTTP 404 at fetch time (link rot); alternative mirror heea.ir.
- Master's 1405 key mirrors — not verified before the local image-OCR attempt (below).

## 3. Year-by-year coverage (metadata matrix)

Full matrix: [`EXAM_YEAR_COVERAGE_MATRIX.csv`](./EXAM_YEAR_COVERAGE_MATRIX.csv).
Summary after Phase-3 recovery (union of OCR + PDF text layer):

- **msc_management papers:** 1391–1401, 1403, 1404, 1405 present (14). 1402 present but
  corrupted; a second 1402 source was retrieved (above) and OCR attempted.
- **msc_management keys:** 1390–1404 present; after text-layer union, **keys 1390–1399
  (except 1400) and 1401–1404 are complete** for their declared span; 1400 has 48 holes
  (embedded font uninterpretable), 1402 has 15 holes, **1405 key: unusable scan** (both
  MinerU re-run and EasyOCR image pass recover only partial content).
- **phd_management:** no documents in the local archive; sources identified (phdtest /
  heyvagroup / irantest) but not yet retrieved. PhD key discrepancy 2162 vs 2171 flagged.

## 4. Rights status of discovered sources

All discovered sources are Sanjesh-produced exam materials (`rights_status:
pending_official_check`). Downloaded files stay in the gitignored local staging
(`.ael-work/exam-recovery/downloads/`); none enter Git. Metadata (URLs, hashes, dates)
is recorded here only.
