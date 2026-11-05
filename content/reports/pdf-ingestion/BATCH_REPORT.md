# گزارش Batch ورود PDF — `ingest-2026-11-05-20-58`

**سند حاکم:** AEL-PDF-ARCHIVE-001 v2 · **Parser:** MinerU 4.1.7 (local-only, ONNX DirectML on RTX 4050) + pdfjs-dist (متنی)

| سنجه | مقدار |
|---|---|
| Scanned files | 31 |
| Valid PDFs (signature %PDF-) | 31 |
| Invalid/rejected | 0 |
| Exact duplicates | undefined |
| Parsed now | 31 (MinerU: 16 · native_text: 0 · needs_ocr: 15) |
| Document types | {"unknown":4,"answer_key":16,"exam_paper":11} |
| Exam years detected (evidence-based) | [1392,1394,1395,1396,1397,1398,1399,1400,1401,1403] |
| Exam papers / Answer keys | 11 / 16 |
| Confirmed pairs | 0 (papers هنوز OCR نشده‌اند — pairing بعد از OCR papers) |
| PDF files added to Git index | **0 (mandatory)** |

## قرنطینه و ابهام‌ها (طبق §6 Stage 9)
- 6 کلید بدون سال مکتوبِ قابل‌تشخیص → `YEAR_UNCERTAIN` — از نام فایل حدس زده نشد.
- ۴ سند نوع‌تشخیص‌نشده → `DOC_TYPE_UNCERTAIN` (نیازمند OCR صفحات اول).
- کلید ۱۴۰۲: پاسخ‌های «سفید» (خالی) برای سؤالات ۳۰۱+ دیده شد → `ANSWER_KEY_MISSING` برای همان ردیف‌ها؛ حدس ممنوع.
- ۱۵ دفترچه `needs_ocr` — هر صفحه ~25s با tier standard → جمعاً چند ساعت؛ اجرای Batch جداگانه (قابل ازسرگیری، skip کش).

## حقوق (§9)
- همهٔ ۳۱ سند: `rights_status: pending_review` (منابع سازمان سنجش = ممنوع تا تصمیم، ماتریس ۱۵).
- Markdown کامل فقط در `.ael-work/` (محلی) تولید شد؛ **هیچ متن کامل سؤال/کلیدی به Git Push نشد.**
- `HUMAN_REQUIRED:` تصمیم `private_repository_markdown_allowed` و `answer_key_use_allowed` توسط مالک.

## اجرای مجدد
- Registry با SHA-256: اجرای دوباره = `already_processed`؛ فایل تغییرکرده = `new_version`؛ هیچ Artifact تکراری ساخته نمی‌شود.
