#!/usr/bin/env python3
"""EasyOCR روی ۶۵ عکس درس فارسی + انگلیسی"""
import easyocr, os, json

reader = easyocr.Reader(['fa', 'en'], gpu=False, verbose=False)
img_dir = "content/anki-media-images"
results = []

files = [f for f in os.listdir(img_dir) if f.endswith('.png')]
print("Starting OCR on", len(files), "images...")

for i, f in enumerate(files):
    path = os.path.join(img_dir, f)
    result = reader.readtext(path)
    text_parts = [r[1] for r in result if r[2] > 0.3]
    combined = " | ".join(text_parts)
    results.append({"file": f, "ocr_text": combined, "confidence_avg": sum([r[2] for r in result])/max(len(result),1)})
    print("  [%d/%d] %s: chars=%d conf=%.2f" % (i+1, len(files), f, len(combined), (sum([r[2] for r in result])/max(len(result),1)) if result else 0))

with open("content/anki-ocr-results.json", "w", encoding="utf-8") as out:
    json.dump({"method": "easyocr_fa_en", "total_images": len(files), "results": results}, out, ensure_ascii=False, indent=2)

print("=== DONE ===")
print("Results saved to: content/anki-ocr-results.json")
print("Total images processed:", len(results))
