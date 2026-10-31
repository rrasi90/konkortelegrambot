#!/usr/bin/env python3
"""Generate markdown report from OCR results of 65 Anki lesson images"""
import json, os

d = json.load(open('content/anki-ocr-results.json', encoding='utf-8'))
results = d['results']

with open('content/anki-ocr-report.md', 'w', encoding='utf-8') as f:
    f.write('# متن استخراج شده از ۶۵ عکس درس Anki (EasyOCR fa+en)\n\n')
    f.write('**تاریخ:** 2026-10-31\n\n')
    f.write('**روش:** EasyOCR با زبان‌های فارسی و انگلیسی (`fa`, `en`)\n\n')
    f.write('**تعداد تصاویر پردازش شده:** 65\n\n')
    f.write('**میانگین اطمینان:** ~0.66\n\n')
    f.write('---\n\n')

    for i, r in enumerate(results):
        fname = r.get('file', 'unknown')
        text = r.get('ocr_text', '')
        conf = r.get('confidence_avg', 0)
        f.write('## تصویر %d: `%s`\n\n' % (i+1, fname))
        f.write('**اعتماد:** %.2f\n\n' % conf)
        f.write('**متن استخراج شده:**\n\n')
        f.write('```\n' + (text[:3000] if len(text) > 3000 else text) + '\n```\n\n')
        f.write('---\n\n')

print('Report written: content/anki-ocr-report.md (65 images)')
print('File size:', os.path.getsize('content/anki-ocr-report.md'), 'bytes')
