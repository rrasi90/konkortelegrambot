# Rights & SME Blockers

**Mission:** `AEL-HISTORICAL-EXAM-RECOVERY-AND-VERIFICATION-002` · 2026-11-07

## 1. Rights gaps (H-CONK / SRC-02) — exact permissions required per intended use

| # | Intended use | Current permission | Required decision |
|---|---|---|---|
| R1 | Send question/PDF text to an external AI service for solving/explanations | **forbidden** (local-only rule) | explicit authorization for (a) which provider, (b) which content corpus |
| R2 | Republish question text in the AEL product | forbidden (`pending_official_check` on all 31 sources) | rights confirmation per source family (Sanjesh booklets/keys) |
| R3 | Publish AI/SME explanations derived from protected questions | forbidden until R2 resolved | depends on R2 + SME approval chain |
| R4 | Store raw PDFs / extracted dumps in Git | forbidden (kept: registry hashes + metadata only) | unchanged — not requested |
| R5 | Local structural processing (parsers, counts, hashes, OCR on local machine) | **permitted** — what this mission used | no decision needed |

Everything delivered in this mission stayed inside R5 plus metadata publication.

## 2. SME blockers (no human approval can be self-issued)

| # | Blocker | Needs |
|---|---|---|
| S1 | 1,007 dedup/mapping candidate rows (`CROSS_YEAR_QUESTION_MATCHES.csv`, exact repeats + near pairs) | SME identity + decision workflow (ReviewDecision entity) |
| S2 | 2,278 question-number holes + 880 needs_review appearances | repair priority call + spot-check capacity |
| S3 | 1395 key ±1 span question (310 vs 309) | one-off human check against the official booklet |
| S4 | PhD exam-code discrepancy: repo R-001 records 2162, third-party sources report 2171 for DBA | official document (کارنامه/دفترچه) — repo rule R-001 forbids guessing |
| S5 | Any future `verified`/`published` explanation | full SME review chain (identity, date, version, decision, reason) |

## 3. Retrieval blockers (external)

| # | Item | Blocker | Instruction |
|---|---|---|---|
| B1 | 1405 official key (booklet 519C/1142) | `www8.sanjesh.org/noet_tk/` needs applicant credentials; anonymous fetch 403; public scan unusable | supply credentials OR a better-quality scan; local image OCR produced only 78/285 readable numbers (kept as low-confidence evidence, not merged) |
| B2 | 1400 key columns (195–210, 225–240, 255–270) | broken embedded font; MinerU deterministic | image OCR with column-aware pairing (300-DPI render staged) or manual entry |
| B3 | 1402 key columns (196–200, 226–230, 256–260) | partial column loss in both paths | targeted image OCR + SME confirm |
| B4 | PhD booklets/keys 1396–1405 | not yet retrieved; sources identified (phdtest, heyvagroup, irantest) | download into the local staging archive with hash + provenance, then ingest |
| B5 | 1390 paper | not located in archive; sources identified (mastertest, noandishaan, cafetadris) | retrieve + verify against the existing 1390 key |
