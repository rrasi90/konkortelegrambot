# C07 — ضرایب (V2-033)

- تاریخ: 2026-11-08 — مرجع: exam-structure.ts

## ضرایب رسمی (DOCTORATE_EXAM_YEAR_STRUCTURES)

| سال | تخصصی | زبان | استعداد | وضعیت |
|---|---|---|---|---|
| 1395..1404 | 4 | 1 | 1 | reported |
| 1405 | 5 | 1 | null (حذف) | official_verified |
| 1406 | 5 | 1 | null | reported (counts null) |

- زبان: 30 سؤال تا 1404، 40 سؤال در 1405 (40 دقیقه).
- تخصصی: بازه 80-90 سؤال (regular)؛ مدت 105 دقیقه در 1405.
- نمره منفی رسمی: 1/3 تا 1405؛ 1406 null (تا دفترچه تأیید نشده).

## ضرایب زیرمجموعه (SUB_GROUP_SUBJECTS)

- هر 3 درس مشترک (stats/org/islamic) ضریب 1 و هر 2 تخصصی ضریب 1 — این عدد «وزن رسمی» نیست؛ اولا زیرمجموعه‌ها needs_check هستند، ثانیاً getCoefficientTotal عمداً ضریب 5 را به کل بسته اعمال می‌کند.

## هشدار UI

- زیرمجموعه‌های نیازمند بررسی: business, public, industrial, media, technology, foresight, stpolicy (همه code=null، needs_check).
- کدهای ترکیب 1,2,5 نیازمند بازخوانی بصری‌اند؛ هرگز به‌عنوان پیش‌فرض قطعی نمایش داده نشوند.

## پیشنهاد

- ضرایب زیرمجموعه در UI فقط به‌صورت «پشتیبانی ساختاری» نمایش داده شوند؛ نمره وزنی رسمی فقط با specializationCoefficient/languageCoefficient همان سال محاسبه شود.
- هیچ درصدی از سهم دروس تخصصی بدون ارجاع به getSpecializationSharePercent همان سال منتشر نشود.
