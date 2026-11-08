# C02 — کدهای آزمون (V2-030)

- تاریخ: 2026-11-08 — مرجع: packages/contracts/src/exam-structure.ts

## مرجع رسمی (خوانده‌شده)

- مجموعه مدیریت: bookletCode 2162 (doctorate)، 1142 (master)، هر دو official_verified.
- کد ترکیب 1..7 (دفترچه 1405 ص24-25): 3,4,6,7 official_verified؛ 1,2,5 needs_check.
- کدهای 2163/2164/2165 «کد زیرمجموعه» هستند، نه کد مجموعه؛ در کامنت ماژول (سطر 9-11) صریحاً حذف شده‌اند و زیرمجموعه‌ها code=null دارند (R-001).
- سال‌های دکتری 1395..1406؛ 1405 تنها official_verified کامل؛ 1406 coefficients گزارش‌شده، counts/duration/negativeMarking=null.

## ناهمخوانی‌های موجود (اندازه‌گیری‌شده)

| فایل | مقدار | انتظار مرجع | اثر |
|---|---|---|---|
| content/knowledge/courses.json (هر 6 درس) | exam_code 2164 | 2162 (مجموعه) | کد غلط/زیرمجموعه به‌جای مجموعه؛ COURSE_PROPOSAL در proposed/C02_courses_json.patch |
| content/knowledge/question-skill-mappings.jsonl (هر 18 نگاشت) | paper_code 2164 | 2162 | همان ناهمخوانی در لایه نگاشت |
| packages/contracts SUB_GROUP_SUBJECTS ضرایب | 1 برای مشترکی/تخصصی | ضرایب زیرمجموعه هنوز needs_check | وزن نباید در نمره رسمی ضرب شود |

## تصمیم پیشنهادی (بدون اعمال روی فایل اصلی)

- proposed/C02_courses_json.patch: exam_code 2164 → 2162 برای هر 6 درس + یادداشت «کد زیرمجموعه در کارنامه null است».
- mappings paper_code 2164 → 2162 یا ثبت «زیرمجموعه» جدا؛ تا دفترچه همان سال تأیید نشده، official_booklet صدا زده نمی‌شود.
- contentOfficiality در شبیه‌ساز همچنان scaled_pool؛ بازسازی دفترچه ادعا نمی‌شود.

> هیچ تغییری روی courses.json در این مأموریت اعمال نشد؛ فقط patch پیشنهادی است.
