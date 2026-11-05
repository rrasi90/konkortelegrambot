# Spec Export/Import Markdown (نسخه ۲)
- Front Matter: format=ael-markdown-export-v2 + entity_type/entity_id/title الزامی (Parser رد می‌کند).
- Export: book → book.md + editions/*/edition.md + chapters/<id>.md؛ Material با rights_export≠allowed فقط Metadata (M-07).
- ZIP: روش STORE بدون وابستگی، فقط فایل .md + MANIFEST.md (M-04). شناسهٔ پایدار در مسیر.
- ممنوع در خروجی: Secret، PII، Internal Note، کلید (تست M-06).
- Import: Dry-run پیش‌فرض (committed:false)، گزارش create/update/skip/duplicate/errors؛ بدون Overwrite؛ تطبیق entity_id (M-08/M-09).
- Round-trip: Export → Parse → Dry-run = صفر Duplicate (تست).
- Signed URL کوتاه‌عمر برای ZIP = PARTIAL (نیازمند Object Storage عملیاتی — HUMAN).
