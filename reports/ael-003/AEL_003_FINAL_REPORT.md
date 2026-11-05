# گزارش نهایی مأموریت `AEL-003 v2` — ممیزی و مهاجرت دادهٔ تاریخی

**Branch:** `feat/ael-003-historical-data-modernization` (از `feat/ael-admin-edu-catalog-002@f8ec302`) — push شده
**SHA شروع:** `f8ec302` · **SHA پایانی:** آخرین کامیت این شاخه · **PR:** HUMAN_REQUIRED (gh بدون auth)

---

## ۱. خلاصهٔ تصمیم

۳۸ منبع دادهٔ تاریخی Inventory شد (۵۷۳ رکورد خام)، ۱۸۷ رکورد دامنه‌ای اصلی (F1+F2) با Pipeline کامل Dry-run → Commit → Reconciliation به Staging نسخه‌دار مهاجرت یافت، **هیچ رکوردی بی‌سرنوشت نماند** و **هیچ ادعای اعتبار جعل نشد**: همهٔ ۱۷۰ رکورد منتقل‌شده `migrated_needs_review` هستند، ۱۷ رکورد بانک قرنطینه با دلیل در Quarantine ماندند، و صفر رکورد بدون بازبینی انسانی «تأیید» یا «Published» شده است.

## ۲. تأیید/رد ادعاهای گزارش 002

| ادعا | نتیجهٔ زنده |
|---|---|
| ۲۹ سؤال پایلوت pending_sme | ✅ تأیید دقیق: مالی ۲۴ + آمار ۵ (شمارش مجدد از فایل) |
| ۲۵ Migration | ✅ → اکنون ۲۶ (0026 این مأموریت) |
| ۵۳۹ تست | ✅ بازتأیید روی SHA پایانی |
| Static Registry / Importerهای قدیمی | ✅ موجود — حفظ تا Parity (§24) |

## ۳. Inventory (§6)

- `01-inventory/source-inventory.csv` — **۳۸ منبع، ۵۷۳ رکورد خام، missingSources = 0**
- به تفکیک provenance: `real_candidate=32`، `derived_evidence=4`، `synthetic=1` (Seed رجیستری — fixture)، `unknown_origin=1` (bank-quarantine)
- شمارش‌های واقعی: درس مالی ۸ topic/۲۴ سؤال · آمار ۲/۵ · بانک arshad 101 · phd 38 · قرنطینه 17 · دانش: courses/syllabus/skills/relations

## ۴. Migration Runs (§14-17)

| سنجه | مقدار |
|---|---|
| Batch | `ael003-commit-2026-11-05` (F1+F2، mapping v1) |
| کل رکورد مبدأ | **۱۸۷** |
| `migrated_needs_review` | ۱۷۰ (۳۱ content_versions شامل ۲ درس + ۱۳۹ staged_questions) |
| `quarantined` | ۱۷ (کل بانک قرنطینه — reason: SOURCE_QUARANTINE_BANK) |
| Reconciliation | **PASS** — معادلهٔ §17: 187 = 170 + 17، unaccounted=0 |
| Idempotency | **IDEMPOTENCY_PASS** — دو گذر روی همان Batch: شمارش جدول ثابت 3/3/3 (اثبات با count واقعی، نه heuristic) |
| Dry-run پیش‌فرض | ✅ — بدون `--commit` هیچ Write رخ نمی‌دهد |
| Effect روی Published Catalog | **صفر** — همه‌چیز در Staging (§14.7) |

## ۵. کیفیت (§8-11)

- **Duplicate**: ۰ گروه exact، ۰ کاندید near (آستانهٔ 0.85) — **هیچ Merge خودکاری انجام نشد**
- **Answer Key**: ۰ تعارض بین بانک‌ها، ۰ خارج از محدوده؛ هر کلید = `answer_claim` با `verified:false` جدا از صورت سؤال
- **QA فارسی (اسکیل `pol-persian-rtl-qa`)**: ۱۵۶ متن بانک واقعی → ۰ خطای واقعی فارسی (ی/ک عربی=0، ارقام عربی=0)؛ ۹۹ «خطای» گزارش‌شده = توکن‌های لاتین مشروع محتوای کنکور (فرمول `x_1`، اصطلاح `BCG/EOQ` — false positive دامنه‌ای برای UI-oriented script)؛ **۵۸ هشدار نیم‌فاصله = کاندید editorial_revision جداگانه، خارج از Scope این Migration (§0 نکتهٔ مهم)**
- Raw Text و prompt_normalized هر دو در `staged_questions` حفظ شده‌اند (§7.2)

## ۶. Schema و Data تغییرکرده

- **0026_import_ledger.sql**: `migration_batches` (قرارداد §15.1) + `migration_records` (UNIQUE source+key+target = Idempotency durable) + `staged_content_versions` / `staged_questions` + `reconcile_migration_batch()` — RLS Default-Deny
- هیچ جدول موجودی تغییر نکرد؛ مدل موازی نساخته شد (staging جدید، مقصد نهایی = content_items/questions موجود پس از Review)

## ۷. تست‌ها و Regression

- ۵۳۹/۵۳۹ تست سبز · ۲۶ Migration FRESH_PASS · Backup/Restore PASS · typecheck صفر · worker build سبز · هر دو audit PASS
- Telegram Regression: ۱۳ تست TG مأموریت 002 بدون تغییر سبز (§26)

## ۸. محدودیت‌ها و HUMAN_REQUIRED

| مورد | توضیح |
|---|---|
| ادغام PR | gh بدون auth — `UNVERIFIED_BY_AGENT_PERMISSION` |
| Staging → مقصد نهایی | Commit به `content_items/questions` واقعی فقط پس از Review انسانی (صف موجود 0022) |
| بازبینی علمی/کلید/حقوق ۱۷۰ رکورد | بازبین انسانی — تا آن زمان هیچ‌کدام Verified/Published نیست |
| ۵۸ هشدار نیم‌فاصله | editorial_revision جداگانه |
| Remote DB | `REMOTE_SCHEMA_NOT_VERIFIED` — مهاجرت فقط روی pglite محلی اثبات شد؛ اجرای Remote = Backup + Approval مالک |
| سناریوی §29 (Pilot درس واقعی) | به اجرای واقعی Student/Admin UI وابسته است = مرحلهٔ بعدی پس از PR و Review |

## ۹. GO/NO-GO (§31)

**`NO-GO` برای انتشار عمومی / Cutover** — چون: (۱) بازبینی انسانی ۱۷۰ رکورد انجام نشده، (۲) PR ادغام نشده، (۳) Remote DB تأیید نشده.
**`CONDITIONAL` برای ادامهٔ داخلی**: Staging کامل، Reconciliation بسته، Idempotency اثبات‌شده، مسیر Review→Publish از زیرساخت 0022 آماده است — هیچ دادهٔ بی‌صدا گم نشده و هیچ اعتباری جعل نشده است.
