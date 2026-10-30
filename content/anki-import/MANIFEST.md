# واردات داده‌های Anki به پروژه

## منابع وارد شده (به جز عکس‌ها)

| فایل | منبع | توضیحات |
|---|---|---|
| `cards-sqlite.json` | `anki-extracted-cards.json` | ۲۲۴۶۲ کارت از SQLite (`notes` + `cards`) |
| `skills-map.json` | `anki-content-integration.json` | اتصال کارت‌ها به مهارت‌های `skills.json` |
| `report.md` | `content-analysis-report.md` | گزارش تحلیل Bloom Taxonomy |
| `collection-from-backup.anki2` | `.colpkg` بکاپ | نسخه SQLite از `.colpkg` |
| `media-images/` (فقط مسیر) | `collection.media` | ۶۵ عکس درس‌نامه (XML/Office) — جدا نگهداری شد |

## اطلاعات حذف شده (به جز عکس‌ها)
- عکس‌ها (`media-images`) در مسیر اصلی `content/anki-media-images/` باقی ماندند و در `anki-import/` فقط مسیر آن‌ها ثبت شده است.
- `.colpkg` در `content/anki-backup-unpacked/` باقی ماند.

## تاریخ واردات
2026-10-31
