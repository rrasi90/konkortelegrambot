import os
paths = [
    os.path.expanduser("~/.EasyOCR/model"),
    os.path.expanduser("~/.easyocr/model"),
    r"C:\Users\rrasi_oorj8fq\.EasyOCR\model",
]
for p in paths:
    exists = os.path.exists(p)
    if exists:
        if os.path.isdir(p):
            items = os.listdir(p)
            print(p, "exists with", len(items), "items:", items[:5])
        else:
            print(p, "exists (file)", os.path.getsize(p))
    else:
        print(p, "NOT FOUND")
