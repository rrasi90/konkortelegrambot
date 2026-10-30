#!/usr/bin/env python3
"""
روش ۱: استخراج متن کارت‌ها، سؤال‌ها و فیلدها از collection.anki2
خروجی: JSON آماده برای سیستم محتوا
"""
import sqlite3, os, json, shutil
from pathlib import Path

def extract_anki_cards():
    src = Path.home() / "AppData/Roaming/Anki2/User 1/collection.anki2"
    tmp = Path(r"C:\Users\rrasi_oorj8fq\AppData\Local\Temp\anki_extract.anki2")
    shutil.copy2(str(src), str(tmp))

    conn = sqlite3.connect(str(tmp))
    cursor = conn.cursor()

    # استخراج فیلدها از جدول notes
    cursor.execute("SELECT id, flds FROM notes WHERE flds IS NOT NULL AND flds != ''")
    notes_raw = cursor.fetchall()

    # استخراج نوع کارت‌ها از cards
    cursor.execute("SELECT id, nid, type, queue FROM cards")
    cards_raw = cursor.fetchall()

    cards = []
    note_map = {n[0]: n[1].split("\x1f") for n in notes_raw}

    for c in cards_raw:
        card_id, nid, card_type, queue = c
        fields = note_map.get(nid, [])
        if len(fields) >= 2:
            cards.append({
                "card_anki_id": card_id,
                "note_anki_id": nid,
                "front_text": fields[0],
                "back_text": fields[1] if len(fields) > 1 else "",
                "extra_fields": fields[2:] if len(fields) > 2 else [],
                "anki_type": card_type,
                "queue_status": queue,
            })

    # نوشتن خروجی JSON
    out_path = Path("content/anki-extracted-cards.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({
        "extraction_method": "sqlite_notes_cards",
        "source_db": str(src),
        "cards_extracted": len(cards),
        "cards": cards[:30],  # نمونه ۳۰ کارت
        "all_notes_count": len(notes_raw),
        "media_files": 65,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print("OK: %d cards extracted -> %s" % (len(cards), out_path))
    return cards

if __name__ == "__main__":
    extract_anki_cards()
