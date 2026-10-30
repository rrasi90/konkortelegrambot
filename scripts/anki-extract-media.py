#!/usr/bin/env python3
"""
روش ۲: کپی عکس‌های درس‌نامه از Anki media به پروژه
"""
import os, shutil
from pathlib import Path

src_media = Path.home() / "AppData/Roaming/Anki2/User 1/collection.media"
dest = Path("content/anki-media-images")
dest.mkdir(parents=True, exist_ok=True)

files = list(src_media.glob("*.png")) if src_media.exists() else []
for f in files:
    shutil.copy2(str(f), str(dest / f.name))

print("OK:", len(files), "images copied to", dest)
print("Sample files:", [f.name for f in files[:5]])
