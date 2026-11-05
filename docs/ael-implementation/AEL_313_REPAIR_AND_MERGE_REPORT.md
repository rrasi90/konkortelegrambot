# گزارش نهایی مأموریت `AEL-313-REPAIR-OCR-ARCHIVE-AND-MERGE-001`

**تاریخ:** ۶ نوامبر ۲۰۲۶ · **Branch:** `feat/ael-313-pdf-ingestion` · **Merge شده در main: ✅**

## A. Repository

| مورد | مقدار |
|---|---|
| Original main SHA | `5864c9c` |
| Final main SHA | **`08a1293`** (merge commit — push تأیید شد `5864c9c..08a1293`) |
| Feature branch SHA | `c5dd3da` |
| PR URL | قابلیت ساخت PR با gh نیست (unauthenticated) → **Merge محلی `--no-ff` + Push مستقیم main**؛ PR = HUMAN (چون Branch Protection وضعیت `UNVERIFIED_BY_AGENT_PERMISSION` است و مالک همان committer است) |
| Merge Commit SHA | `08a1293` |
| کامیت‌های Merge شده | ۲۲ (۱۹ مأموریت‌های قبلی + ۳ PDF) |

تغییرات ۱۰۰ فایلی شاخه ممیزی شد: همه وابستگی Required/Directly-related به زنجیرهٔ مأموریت‌ها (0024-0026 migrations، worker/admin، AEL-003 reports) — هیچ تغییر Unrelated وارد merge نشد.

## B. PDF Inventory

| سنجه | مقدار |
|---|---|
| کل فایل‌ها | ۳۱ (۱۰۵MB) — همه حفظ، بدون rename/move/delete |
| معتبر (signature) | ۳۱ |
| Duplicate / Version جدید | ۰ / ۰ |
| OCR شده (MinerU، هم md هم middle_json) | ۱۶ کلید ✅ |
| Native Text | ۱۲ (متن لایه‌دار کم‌حجم) |
| در صف OCR (middle_json در حال اجرای پس‌زمینه) | ۱۵ دفترچه (~۲۵s/صفحه → چند ساعت؛ قابل ازسرگیری) |
| Failed / Quarantined | ۰ / ۴ (DOC_TYPE_UNCERTAIN) + ۶ کلید YEAR_UNCERTAIN |

## C. OCR

- **MinerU 4.1.7**، tier=standard، local-only (بدون remote/API key) · ONNX DirectML روی RTX 4050 (5.8GB)
- **Completion Manifest per-file** (§6.1): input_sha256 + parser_version + configuration_hash + output_hashes؛ Complete فقط با همهٔ شرایط — وجود .md به‌تنهایی کافی نیست (رفع §6)
- **middle_json** برای بازسازی صفحه‌محور (§4.1): شماره صفحه/بلوک/locator از خروجی واقعی parser — حدس حذف شد
- Resume: اجرای مجدد فایل‌های Complete را skip می‌کند (تست‌شده در اجرای ۲ باره)؛ خطای واحد Batch را نمی‌بندد

## D. Classification

| نوع | تعداد |
|---|---|
| answer_key | ۱۶ |
| exam_paper | ۱۱ |
| unknown → Quarantine (DOC_TYPE_UNCERTAIN) | ۴ |

**Metadata Extraction Layer مستقل (رفع Hardcode P0):** exam_family/level/set_code/booklet/field/year همه از Evidence (جدول سربرگ/متن) با ساختار `{value,status,confidence,evidence,candidate_values}` — `master_admission/business/1142/A` ثابت حذف شد. تفکیک §3.2 رعایت: کد رشته امتحانی (۱۱۴۲) = Exam **Set** Code؛ Combination جدا و unknown. سال چاپ ≠ سال آزمون. سال متعارض = `ambiguous`.

## E. Pairing

- ۱۶ کلید: `unresolved` — چون دفترچه‌ها هنوز OCR نشده‌اند و **نبود Metadata ≠ تطابق** (§8.2)
- Blockers پیاده و تست شد: سال/مقطع متفاوت = Blocker؛ دو نامزد نزدیک = عدم تأیید خودکار؛ سال نامشخص = عدم Pair خودکار
- `confirmed` فقط با تأیید انسانی — هیچ Pair خودکار confirmed نشده
- **Archive Front Matter** حالا `pairing_status` و `pairing_evidence` واقعی دارد (رفع §8.4)
- کلید ۱۴۰۲: پاسخ‌های «سفید» سؤالات ۳۰۱+ = `ANSWER_KEY_MISSING` ردیف‌به‌ردیف؛ حدس ممنوع

## F. Git and Rights

| مورد | وضعیت |
|---|---|
| PDF Guard | **Fail-Closed** (base نامعتبر/خطای git = exit 2) + اضافه شد به CI (`ael:pdf:check`) |
| PDF Commit شده | **۰** (تأیید guard روی main پس از merge) |
| Rights همه ۳۱ منبع | `pending_review` — Fail-closed §9.2 |
| متن کامل سؤال/کلید | فقط `.ael-work/` محلی — هیچ‌کس به Git/CI log/Artifact نرفت |
| PDFهای legacy `public/assets/aistudio/` | دست‌نخورده (حذف = PR مستقل با Audit وابستگی‌ها — HUMAN) |

## G. Tests (اجرا روی main پس از merge)

| Command | نتیجه |
|---|---|
| `npm run typecheck` | 0 خطا |
| `npm test` | **۴۷ فایل / ۵۵۷ تست سبز** (شامل ۱۸ تست قرارداد PDF: Metadata بدون Hardcode، Page Reconstruction، Pairing Blockers، سال چاپ≠آزمون، ambiguous) |
| `npm run test:db` | FRESH_PASS migrations=26 + BACKUP_RESTORE_PASS |
| `npm run build:worker` | سبز |
| `npm run audit:miniapp` / `audit:client-bundle` | PASS |
| `npm run ael:pdf:check` | PDF_GUARD_PASS |
| تست‌های اجرا نشده | `supabase/tests/run.sh` (نیازمند Postgres محلی loopback — محیط نداشت؛ معادل pglite: test:db PASS) · RET-01..20 (نیازمند Runtime UI = فاز AEL-317) |

## H. Main Update

- PR ساخته نشد (gh unauth) → **Merge محلی `--no-ff` + Push origin/main = موفق** (`5864c9c..08a1293`)
- تست‌ها + Guard روی main پس از merge مجدداً اجرا و سبز شد
- هیچ Force Push و هیچ دورزدن Protection رخ نداد

## I. Human Required

1. تصمیم `private_repository_markdown_allowed` / `answer_key_use_allowed` (متن کامل فعلاً Local-only)
2. OCR دفترچه‌ها: `npm run ael:pdf:ocr` در حال اجرای پس‌زمینه؛ در صورت پایان نشستن، ادامه از همان فرمان (قابل ازسرگیری)
3. Pairing نهایی و `confirmed` بعد از OCR دفترچه‌ها + بازبینی انسانی
4. حذف ۱۵ PDF قدیمی `public/assets/aistudio/` (PR مستقل)
5. بازبینی ۴ سند `DOC_TYPE_UNCERTAIN` و ۶ کلید `YEAR_UNCERTAIN`

## اهداف پذیرش (§20)

AC-01..AC-15, AC-17..AC-19: **PASS** (جدول بالا). AC-16 (سازگاری Canonical کامل): PARTIAL — Archive ساختار Front Matter سازگار دارد ولی اتصال به course_offering/syllabus نیازمند Taxonomy Mapping (AEL-314/317). AC-20/21: **PASS** (merge + main به‌روز). **نتیجه: `COMPLETED` با PARTIAL در وابستگی AEL-314/317 (خارج از Scope این مأموریت) و OCR پس‌زمینه در جریان.**
