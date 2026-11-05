# گزارش نهایی مأموریت `AEL-ADMIN-EDU-CATALOG-002`

**Branch:** `feat/ael-admin-edu-catalog-002` (از `feat/ael-000-mission-baseline@21f922f`) — push شده
**SHA پایانی:** آخرین کامیت این شاخه (بخش شواهد Git پایین) — `main` دست‌نخورده؛ PR = HUMAN_REQUIRED

## ۱. پاسخ پرسش‌های مالک (بخش ۰٫۱ سند)

| # | پرسش | پاسخ سامانه |
|---|---|---|
| ۱-۴ | درس‌ها/مواد، کتاب‌ها، ویرایش‌ها، فصل‌ها | exam_subjects + books/book_editions/book_structure_nodes — CRUD از `/api/admin/domain/*` و پنل |
| ۵ | مطالب فصل | content_items با kindهای ماده (lesson/summary/…) + book_node_id — Material با حقوق export |
| ۶-۸ | سؤال کدام فصل؟ چند تست؟ | question_appearances + question_chapter_mappings + آمار فصل با شمارش یکتا/ارتباط جدا |
| ۹ | ناقص‌ها | `/api/admin/coverage` (openReviewTasks، نسبت‌های unknown) |
| ۱۰ | خروجی Markdown | `/api/admin/panel/export/book/:id` (JSON/ZIP فقط-md) |
| ۱۱ | ورود مخفی با کد ۱۰رقمی | پیام کد در چت خصوصی → Ticket ۱۲۰ثانیه‌ای → دکمهٔ Mini App (فقط Inline Button) |
| ۱۲-۱۳ | آمار/فیدبک/پاسخ | coverage + feedback inbox + reply به چت کاربر از پنل |
| ۱۴ | دو پیام؟ | **ریشه قطعی: دو effect در Handler** (ارسال مستقیم + پاسخ webhook با method) — رفع شد + Inbox پایدار |

## ۲. شواهد تست (اجرا شده، SHA پایانی)

| فرمان | نتیجه |
|---|---|
| `npm run typecheck` | 0 خطا |
| `npm test` | **۴۶ فایل / ۵۳۹ تست سبز** (شروع مأموریت: ۵۱۲ → +۲۷) |
| `npm run test:db` | FRESH_PASS migrations=25 + BACKUP_RESTORE_PASS |
| `npm run build:worker` | سبز |
| `npm run audit:miniapp` | PASS (۵ فایل ممیزی‌شده + scan admin.html) |
| `npm run audit:client-bundle` | PASS |
| تست‌های جدید | ۱۳ TG (رفع تکرار/ورود ادمین) + ۳ E/Q + ۷ M (Export/Import) + ۴ F (فیدبک) = **۲۷ تست جدید** |

## ۳. قابلیت‌ها — وضعیت واقعی

| قابلیت | وضعیت |
|---|---|
| رفع پیام تکراری + Outbox پایدار | **PASS** (کد/تست) — Runtime تلگرام واقعی = HUMAN |
| Book/Edition/Chapter Tree/Relations | **PASS** (API+تست) |
| Question/Appearance/Mapping + آمار فصل | **PASS** (API+تست) |
| Markdown Export/Import Round-trip | **PASS** — Signed URL = PARTIAL |
| Feedback Inbox + Reply + Internal Note | **PASS** (API+تست+UI) |
| Admin Entry (کد ۱۰رقمی + Ticket + initData) | **PASS** (کد/تست) — تست Telegram Android = HUMAN |
| Admin Mini App واقعی (RTL) | **PASS هسته‌ای** (ورود/Overview/Books/Releases/Feedback/Export) — Editor کامل Material = PARTIAL |
| Dashboard کامل یادگیری (DAU/دقت) | **PARTIAL** — بدون Instrumentation، «Not tracked» (عدد ساختگی ممنوع) |
| OCR/DOCX/PDF کامل (P2) | NOT_STARTED (طبق سند، بعد از تثبیت) |

## ۴. اقدام‌های HUMAN_REQUIRED (سند ۲۴)

| موضوع | اقدام دقیق | اگر انجام نشود |
|---|---|---|
| ادغام PR | PR از `feat/ael-admin-edu-catalog-002` به `main` (gh بدون auth = BLOCKED) | تغییرات روی main نمی‌نشیند |
| Telegram Owner ID | Bootstrap OWNER با ADMIN_API_TOKEN + initData | ورود اولیه Blocked |
| ADMIN_ENTRY_CODE | تنظیم Secret (wrangler secret put) | ورود کد غیرفعال (fail-closed) |
| BotFather Mini App URL | تنظیم Menu Button / دکمهٔ Inline | Runtime ورود آزمایش نشده |
| تست دستگاه واقعی | Telegram Android: /start یک پیام، کد، باز کردن پنل | Claim Runtime PASS نداریم |
| منابع رسمی/حقوق کتاب‌ها | Evidence + rights decisions | Official label و Publish ممنوع |
| بازبینی علمی نگاشت‌ها | بازبین متخصص | verified ممنوع |
| Production cutover | Approval مالک زیرساخت | فقط Staging |

## ۵. Go/No-Go (سند ۲۵)

- **رفع دو پیام:** PASS (کد/تست/regression) — Runtime = HUMAN
- **ورود ادمین + CRUD + Material + Publish پویا + Export:** هسته PASS از مسیر API + UI واقعی؛ Editor Material کامل و تست دستگاه = باز
- **تحلیل تست‌ها:** مدل/شمارش PASS؛ دادهٔ واقعی رسمی = HUMAN (بخش ۲۵٫۳ بند آخر)
- **عملیات:** Inbox/Reply PASS؛ داشبورد کامل PARTIAL
- **نتیجه: `NO-GO` برای Release عمومی** — دقیقاً به‌دلیل بندهای HUMAN بالا (تست دستگاه واقعی، PR/CI روی main، دادهٔ رسمی تأییدشده). هیچ ادعای Complete برای قابلیت ناقص ثبت نشده است.

## ۶. Rollback
تمام تغییرات additive (۲ Migration جدید 0024/0025 + کد جدید)؛ بازگشت = بستن PR. Force push انجام نشده.
