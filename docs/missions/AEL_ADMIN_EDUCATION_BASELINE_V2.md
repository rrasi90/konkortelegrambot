# Baseline زندهٔ مأموریت v2 — `AEL-ADMIN-EDU-CATALOG-002`

**تاریخ:** ۵ نوامبر ۲۰۲۶ — همهٔ اعداد از Git زنده استخراج شده، نه از گزارش تاریخی.

## ۱. وضعیت Git

| مورد | مقدار زنده |
|---|---|
| Branch کاری این مأموریت | `feat/ael-admin-edu-catalog-002` (از `feat/ael-000-mission-baseline@21f922f` ساخته شد) |
| `main` | `5864c9c` |
| **کامیت‌های مأموریت قبلی خارج از main** | **۱۱** (`git rev-list --count main..feat/ael-000-mission-baseline`) |
| تناقض ۵/۹ کامیت گزارش قبلی | **حل شد:** خلاصهٔ گزارش «۵» و جدولش «۹/۱۱» گفته بود؛ عدد واقعی **۱۱** است (۲ کامیت docs/fix پایانی شامل گزارش و رفع worker-build). هیچ عددی کپی نشد. |
| ادغام در main | **نشده** — migrationهای 0019..0023 فقط روی شاخه‌اند (main: ۱۸ migration، شاخه: ۲۳). PR = HUMAN_REQUIRED (gh بدون auth). |
| CI | بررسی از API ممکن نیست (repo خصوصی + gh بدون auth) → `BLOCKED_BY_GITHUB_PERMISSION` |

**تصمیم Branch:** چون 0019..0023 روی main نیستند و مأموریت v2 به آن‌ها وابسته است، شاخهٔ v2 از `feat/ael-000-mission-baseline` ساخته شد، نه از main. ادغام هر دو شاخه با یک PR متوالی انجام می‌شود.

## ۲. راستی‌آزمایی زندهٔ گزارش قبلی (اجرا شد، نه کپی)

| ادعای گزارش | راستی‌آزمایی زنده | نتیجه |
|---|---|---|
| ۵۱۲ تست سبز | `npm test` روی 21f922f | ✅ ۴۲ فایل / ۵۱۲ تست |
| ۲۳ Migration | شمارش درخت git | ✅ |
| `GATE_P1_PASS` / `RPC_ATOMIC_PASS` | اجرای مجدد دو اسکریپت | ✅ هر دو PASS |
| typecheck صفر | اجرا | ✅ |
| Admin UI وجود ندارد | `apps/miniapp` = app.js/learning.js دانش‌آموزی؛ هیچ admin.html/panel وجود ندارد | ✅ تأیید نبودِ UI |
| فرمان مشکل‌دار تلگرام | Trace در `apps/worker/src/index.ts` → بخش ۳ همین سند | ⬇ |

## ۳. Trace مسیر تلگرام (Phase 1 — ورودی)

- Webhook: `POST /api/telegram/webhook` در `apps/worker/src/index.ts` (~خط ۵۱۳) با بررسی `X-Telegram-Bot-Api-Secret-Token`.
- مسیر Update → `handleTelegramUpdate` → پاسخ `/start` — تحلیل کامل و ریشهٔ تکرار در `docs/missions/TELEGRAM_DUPLICATE_REPLY_ROOT_CAUSE.md`.
- **یافتهٔ اولیهٔ مهم (بازبینی کد):** Handler فعلی پس از پردازش، پاسخ را با `sendMessage` ارسال و مستقیماً `200` برمی‌گرداند؛ **هیچ ثبت update_id و هیچ Idempotency پایداری وجود ندارد** (جست‌وجوی `update_id` در src = بدون نتیجه). همچنین `getUpdates`/polling در `scripts/telegram-bot-service.mjs` و Webhook در Worker **دو مسیر موازی فعال** هستند — این خودش یکی از علل بالقوهٔ دو پیام است (TG-06).

## ۴. Entityهای فعلی و جدول تطبیق (خلاصه — سند کامل: AEL_EDUCATION_ENTITY_MAP.md)

| مفهوم موردنیاز (سند v2) | موجود فعلی | پوشش | تصمیم |
|---|---|---|---|
| ExamProgram | `programs/program_versions` (0019) | کامل | استفاده |
| ExamEvent/Set/Subject | `exam_events/sets/combinations/subjects` (0019) | کامل | استفاده |
| LearningCourse | `content_items(kind=course)` + Published Catalog (0022) | کامل | استفاده |
| Book | **ندارد** | ناموجود | ایجاد در 0024 |
| BookEdition | **ندارد** | ناموجود | ایجاد در 0024 |
| فصل/ساختار کتاب (Tree) | **ندارد** (syllabus_nodes فقط درس‌محور است) | ناموجود | ایجاد در 0024 |
| Topic/Concept/Skill | `knowledge_nodes` + `skills` (0001/0005) | کامل | اتصال، نه مدل موازی |
| LearningMaterial | `content_items/content_versions` (0022) | ناقص (kind محدود) | گسترش kind + اتصال به node کتاب |
| Question | `questions` (0001) | کامل | استفاده |
| QuestionAppearance | **ندارد** (exam_pack_questions فقط holdout) | ناموجود | ایجاد در 0024 |
| نگاشت سؤال→فصل | **ندارد** | ناموجود | ایجاد در 0024 |
| Source/Evidence | `sources/source_versions` + `source_rights_decisions` (0021) | کامل | استفاده |
| Review/Release | `review_tasks/content_releases/published_snapshots` (0022) | کامل | استفاده |
| Feedback | **ندارد** (فقط audit_logs) | ناموجود | ایجاد در 0025 |
| Update/Outbox تلگرام | **ندارد** | ناموجود | ایجاد در 0025 |
| Admin Session/Entry | `admin_users/admin_sessions` + bootstrap (0020) | ناقص (ورود کد ۱۰رقمی ندارد) | تکمیل در 0025/0026 |

## ۵. تست‌های اجراشده در Baseline

| فرمان | نتیجه |
|---|---|
| `npm run typecheck` | 0 خطا |
| `npm test` | 512/512 سبز (۴۲ فایل) |
| `npm run test:db` | FRESH_PASS migrations=23 + BACKUP_RESTORE_PASS |
| `node scripts/verify-registry-seed.mjs` | GATE_P1_PASS |
| `node scripts/verify-learning-answer-rpc.mjs` | RPC_ATOMIC_PASS |
| `npm run build:worker` | سبز |

## ۶. شکاف‌های P0/P1 (ورودی Phase Plan)

1. Telegram: نبود update-id idempotency + دو مسیر polling/webhook (P0)
2. مدل Book/Edition/Chapter/Appearance/Mapping (P0/P1)
3. Markdown Export/Import (P0)
4. Feedback Inbox + Reply Outbox (P1)
5. Admin Entry با کد ۱۰رقمی + Launch Ticket + Admin UI واقعی (P0)
6. Dashboard با دادهٔ واقعی (P1)
