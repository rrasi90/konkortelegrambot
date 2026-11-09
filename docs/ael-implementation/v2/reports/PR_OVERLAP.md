# هم‌پوشانی PRها — V2-018 (2026-11-08)

## مقایسه سه‌نسخهٔ `courses.json`

| نسخه | exam_code (هر 6 درس) | مرجع |
|---|---|---|
| origin/main (8f8d49d) | 2164 | git show origin/main:content/knowledge/courses.json |
| PR#14 head (ad728a9) | 2162 | git show ad728a9:.../courses.json |
| PR#15 head (bfe41ad) | 2162 (ارث از والد، بدون تغییر مستقل) | git diff ad728a9 bfe41ad -- content/knowledge/courses.json → خالی |

نتیجه: تغییر 2164→2162 فقط متعلق به PR14 است؛ PR15 هیچ diff مستقلی در این فایل ندارد (تفکیک در PR_INVENTORY.md).

## paper_code / legacy

- `question-skill-mappings.jsonl` روی origin/main: paper_code=2164 (هر 18 نگاشت).
- `exam-structure.ts` روی شاخه فعلی: bookletCode/code=2162؛ کامنت آن 2163/2164/2165 را «کد زیرمجموعه، needs_check» می‌نامد.
- قاعده: exam_code، paper_code و legacy یکی نیستند. از روی کامنت کد، صحت رسمی کد آزمون استنتاج نمی‌شود؛ مرجع رسمی دفترچه misma سال لازم است (OWNER_FILE_REQUEST).
- تا تعیین مرجع و دامنهٔ کدها، patch اصلاح کد آزمون اعمال نمی‌شود (C02_courses_json.patch فقط پیشنهاد).

## overlap

- PR14 بزرگ است (64 فایل، miniapp/assets و حذف PDFها)؛ PR15 روی آن انباشته است (24 فایل، academic-foundation + migration 0027/0028).
- فایل‌های هم‌پوشان: `content/knowledge/courses.json` فقط در PR14؛ `packages/contracts/src/exam-structure.ts` در PR14 + تست‌ها در PR15؛ `content/learning-courses/phd-management-expansion.json` در PR15.
