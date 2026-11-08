# مدل کد آزمون — جدول کامل سه‌نسخه‌ای و patch سازگاری (در حال آماده‌سازی)

## جدول سه‌نسخه‌ای (به‌روزرسانی کامل)

| فیلد | main (8f8d49d) | PR14 (ad728a9) | PR15 (bfe41ad) |
|---|---|---|---|
| exam_code (courses.json) | 2164 | 2162 | 2162 (ارث) |
| paper_code (mappings) | 2164 | — (تغییر main→ همان) | — |
| examSetCode (exam-structure) | 2162 | 2162 | 2162 |

## جدا نگه‌داشتن مفاهیم

- هویت درس: `course_id` (course-org-theory...)
- کد مجموعه: `setCode` (2162/1142)
- هویت دفترچه: exam_year + combination/product path
- مقدار legacy: `exam_code` قدیمی 2164 (فقط با مرجع قدیم می‌ماند)

## مصرف‌کننده‌ها

- packages/contracts/src/exam-structure.ts (مرجع setCode)
- content/knowledge/courses.json + question-skill-mappings.jsonl (legacy)
- exam-simulator (pooled)

## وضعیت

- جایگزینی سراسری انجام نشد؛ مقدار رسمی فقط با سند همان سال (دفترچه همان سال) باز می‌ماند.
- patch سازگاری + تست جلوگیری از تداخل «مقطع/سال» در مسیر آماده‌سازی می‌ماند (با جدول بالا).
