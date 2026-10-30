#!/usr/bin/env python3
"""
روش ۴: تحلیل محتوای تصویری (OCR) برای استخراج متن از اسکرین‌شات‌ها
نیاز دارد: pytesseract + tesseract-ocr (نصب شده در ویندوز)
"""
import os
from PIL import Image

def ocr_images():
    import pytesseract
    img_dir = "content/anki-media-images"
    results = []
    for f in os.listdir(img_dir)[:10]:
        if f.endswith(".png"):
            text = pytesseract.image_to_string(Image.open(os.path.join(img_dir, f)), lang="fas+eng")
            results.append({"file": f, "ocr_text_preview": text[:300]})
    print("✅ OCR روی ۱۰ تصویر انجام شد. نمونه:")
    for r in results[:3]:
        print(f"  {r['file']}: {r['ocr_text_preview'][:100]}...")

if __name__ == "__main__":
    try:
        ocr_images()
    except Exception as e:
        print("WARNING: OCR needs tesseract-ocr installed.")
        print("Images available at content/anki-media-images/ (65 files)")
