# OCR exam-import staging corpus

This is a private, review-only staging corpus, not the live question bank.
documents.jsonl records all source DOCX metadata and cover audit evidence.
raw-pages.jsonl preserves the full OCR transcript for every source page, including quarantined sources.
appearances-1142.jsonl and appearances-2162.jsonl contain provisional candidates from admitted source documents.
appearances-variants.jsonl keeps year-conflicted or alternate scans separate.
appearances-quarantine.jsonl preserves candidate blocks from mismatched or unresolved sources.
source-quarantine.json, source-variants.json and import-manifest.json record source status and audit counts.

Every candidate has answerKey=null, questionNumber=null and allowedUse=[]. Trust is reported; verification is pending_sme; rights are unknown/pending_official_check; publicationStatus is staging_only.
No answer, question number, chapter, skill, or official verification is inferred. No automatic duplicate merge is applied.
Do not consume this folder from production quiz endpoints.
