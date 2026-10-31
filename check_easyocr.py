try:
    import easyocr
    print("easyocr installed")
except Exception as e:
    print("easyocr NOT installed:", str(e)[:200])

try:
    import pytesseract
    print("pytesseract installed")
except Exception as e:
    print("pytesseract NOT installed")

import os
media = os.listdir("content/anki-media-images") if os.path.exists("content/anki-media-images") else []
print("media files available:", len(media))
