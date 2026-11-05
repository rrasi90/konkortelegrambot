# Baseline Reconciliation — AEL-003 v2 (فاز ۰)

**تاریخ:** ۵ نوامبر ۲۰۲۶ · **محیط:** local, Windows 10, Git Bash, Node v24.18.0

| موضوع | ادعای گزارش 002 | شاهد فعلی (زنده) | SHA/محیط | نتیجه | اقدام |
|---|---|---|---|---|---|
| Default Branch | main | `git remote show` / branches: main + 3 feature | f8ec302 شاخهٔ کاری | ✅ | dependency موقت از 002 |
| ادغام 002 در main | «NO-GO، PR باز» | `main..feat/ael-admin-edu-catalog-002` = ۱۹ کامیت، **merge نشده** | f8ec302 | ✅ تأیید | Branch 003 از 002 ساخته شد (§2.2) |
| تعداد کامیت‌ها | — | ۱۹ (راستی‌آزمایی `rev-list --count`) | — | ✅ | — |
| تست‌ها | «۵۳۹ تست، ۴۶ فایل» | اجرا در self-review قبلی: ۵۳۹/۵۳۹ | f8ec302 | ✅ | Baseline اجرای مجدد در گام ۹ |
| Migrationها | «۲۵» | `ls supabase/migrations` → آخرین 0025_books_mappings | f8ec302 | ✅ | Migration بعدی = **0026** (نه حدس) |
| دو بستهٔ درس | «۲ Topic و ۵ سؤال / ۸ Topic و ۲۴ سؤال، pending_sme» | Inventory مرحلهٔ ۱ → شمارش واقعی | — | ⬇ | §6.5 سند: بازشماری |
| Static Registry | learning-catalog.ts | موجود (legacy) | — | ✅ | حفظ تا Parity (§24) |
| Importerهای قدیمی | ۴ مسیر شناخته‌شده | موجود در شاخه | — | ✅ | Inventory مرحلهٔ ۱ |
| Remote DB | — | دسترسی Remote نداریم | — | `REMOTE_SCHEMA_NOT_VERIFIED` | فقط pglite محلی — صفر Write روی Remote |
| CI روی SHA | — | gh بدون auth | — | `UNVERIFIED_BY_AGENT_PERMISSION` | معادل محلی CI اجرا می‌شود |

**Gate فاز ۰:** Branch ancestry روشن (002→003)، Migration history روشن (۲۵→0026 بعدی)، مسیرهای داده شناخته‌شده → مجاز به مرحلهٔ ۱.
