import urllib.request, os, sys
# Try to download tesseract installer
url = "https://digi.bib.uni-mannheim.de/tesseract/tesseract-ocr-w64-setup-5.3.3.20231005.exe"
print("Starting download from:", url)
try:
    urllib.request.urlretrieve(url, "tesseract-installer.exe")
    size = os.path.getsize("tesseract-installer.exe")
    print("Downloaded:", size, "bytes -> tesseract-installer.exe")
except Exception as e:
    print("Download error:", str(e)[:250])
