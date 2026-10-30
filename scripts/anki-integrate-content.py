#!/usr/bin/env python3
"""
روش ۵: اتصال داده‌های Anki با مهارت‌ها و درس‌های کنکور (skills.json + lessons-data.ts)
خروجی: کارت‌های آماده برای موتور یادگیری (4-layer ripple engine)
"""
import json

def integrate_anki_with_content():
    # خواندن کارت‌های استخراج شده
    cards = json.load(open("content/anki-extracted-cards.json", encoding="utf-8"))
    # خواندن مهارت‌ها
    skills = json.load(open("content/knowledge/skills.json", encoding="utf-8"))

    # نقشه‌سازی ساده: اگر متن کارت شامل کلیدواژه مهارت باشد → متصل کن
    connected = []
    for c in cards.get("cards", []):
        text = (c.get("front_text", "") + " " + c.get("back_text", "")).lower()
        for s in skills:
            keyword = s["id"].split(".")[-1].lower()
            if keyword in text or s["title"][:10] in text:
                connected.append({
                    "anki_card": c["card_anki_id"],
                    "skill_id": s["id"],
                    "skill_title": s["title"],
                    "bloom_level": s.get("bloom_level"),
                })
                break

    out = {"integration_method": "anki_skills_map", "mapped_cards": len(connected), "mappings": connected[:10]}
    open("content/anki-content-integration.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=2))
    print("OK:", len(connected), "cards mapped -> content/anki-content-integration.json")

if __name__ == "__main__":
    integrate_anki_with_content()
