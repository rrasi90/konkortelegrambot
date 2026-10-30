#!/usr/bin/env python3
"""
روش ۳: استخراج از فایل .colpkg (بکاپ Anki = ZIP)
"""
import zipfile, shutil, sqlite3
from pathlib import Path

colpkg_path = Path.home() / "AppData/Roaming/Anki2/User 1/backups/backup-2026-10-30-23.29.47.colpkg"
extract_dir = Path("content/anki-backup-unpacked")
extract_dir.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(colpkg_path, 'r') as z:
    z.extractall(extract_dir)
    print("OK: .colpkg files:", z.namelist()[:10])

# اگر collection.anki21 باشد → به .anki2 تغییر نام بده برای SQLite3
for f in extract_dir.rglob("*.anki21"):
    shutil.move(str(f), str(f.with_suffix(".anki2")))
    print("Converted anki21 to anki2:", f)
