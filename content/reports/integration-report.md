# گزارش اتصال به پروژه و آزمون‌های یکپارچگی (Integration Report)

## ۱. وضعیت بسته‌بندی محتوا
بسته محتوای واقعی دکتری مدیریت در مسیر زیر قرار گرفت:
- `content/knowledge/exam-packs/phd-management-business-v1.json`
- نسخه بسته: `1.0.0`
- وضعیت اعتبارسنجی اسکیما: کاملاً معتبر (`code 0`) از طریق `scripts/validate-content.mjs`.

## ۲. وضعیت اسکریپت درون‌ریزی SQL
- فایل SQL تولیدشده: `content/knowledge/exam-packs/phd-management-business-v1.sql`
- شامل تمام دستورات `INSERT INTO knowledge_nodes`، `INSERT INTO node_dependencies` و `INSERT INTO questions`.
- کلیدهای سؤالات و وضعیت تأیید آن‌ها با وضعیت استاندارد `unverified` تنظیم شده است تا مانع از فعال‌سازی زودهنگام در محیط واقعی قبل از بازبینی نهایی کارشناس شود.

## ۳. وضعیت تست‌های واحد و سلامت کدها
- آزمون‌های موتور یادگیری (`packages/learning-engine/tests/engine.test.ts`): **۲۱ تست پاس شد**.
- آزمون‌های ورکر و APIهای ثبت پاسخ (`apps/worker/tests/worker.test.ts`): **۱۰ تست پاس شد**.
- آزمون اعتبارسنجی بسته دمو (`content/examples/demo-pack.json`): **پاس شد بدون تغییر یا مخدوش شدن**.
- آزمون اعتبارسنجی بسته رسمی (`phd-management-business-v1.json`): **پاس شد**.
- **مجموع تست‌های موفق پروژه:** **۳۱ از ۳۱ تست سبز است.**
