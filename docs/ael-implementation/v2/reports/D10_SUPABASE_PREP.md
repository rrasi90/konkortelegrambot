# آماده‌سازی Supabase (D-10/V2-092) — 2026-11-08

- تصمیم مالک: آماده‌سازی کامل؛ اجرای عملیاتی پس از بررسی جداگانه. کلیهٔ آیتم‌های زیر آماده‌سازی است، نه تغییر محیط عملیاتی.

## 1. موجودی مسیرهای ذخیره و مصرف‌کننده‌ها

| مسیر | منبع اصلی داده | مصرف‌کننده |
|---|---|---|
| Worker + Supabase (REST, service_role فقط سرور) | جدول‌های Supabase (0026 تکمیل شده) | apps/worker/src/store.ts و admin/store.ts |
| Worker + MemoryStore | حافظه isolate (dev/test) | apps/worker/src/memory-store.ts (فقط dev) |
| Miniapp Telegram CloudStorage v4 | Snapshot دانش‌آموز | React client |
| LocalStorage | فقط دفترچه اشتباه | React client |
| Static content (JSON) | content/knowledge + learning-courses | Worker/offline |

## 2. مهاجرت‌های موجود و کمبود واقعی

- موجود (main/plan): 0001..0026 (آخر 0026_import_ledger.sql).
- فقط در PR15: 0027_academic_foundation.sql و 0028_comprehensive_exam_model.sql.
- کمبود: روی مقصد عملياتي، اعمال 0019..0026 و سپس 0027/0028 پس از تأیید PR15 لازم است؛ بدون تأیید PR، مهاجرت اجرا نمی‌شود.

## 3. آزمون محلی

- `npm run test:db` → exit 0: INTEGRITY_PASS + BACKUP_RESTORE_PASS (logs/vs-5-db.txt).
- انتقال هر مسیر به یک منبع مرکزی هنوز انجام نشده (R-025 باز)؛ تغییر خودکار مسیر فعال انجام نشد.

## 4. برنامه انتقال / پذیرش / بازگشت

- انتقال: به‌مرور مصرف‌کننده React به Worker API (Supabase-via-API) طبق ADR؛ هر مهاجرت فقط پس از dry-run روی DB موقت.
- پذیرش: replay/idempotency + tape backup/restore همانند vs-5-db.
- بازگشت: rollback با اجرای مهاجرت برگشتی + بازیابی از dump؛ بدون اجرای روی DB عملیاتی تا پذیرش.

## درخواست مشخص مجوز اجرا

- محیط هدف: [مشخص شود — staging Supabase]
- مهاجرت‌های دقیق: [0027/0028 پس از ادغام PR15]
- تغییر رفتار: [انتقال R-025]
- نتایج آزمون: [vs-5-db PASS پیوست شود]
- سؤال مبهم «چه زمانی Supabase؟» کافی نیست؛ این بند جایگزین پاسخ مشخص مالک نمی‌شود.
