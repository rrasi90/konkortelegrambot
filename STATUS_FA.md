# وضعیت پروژه AEL (STATUS)

- **نسخه:** ۱ — ۵ نوامبر ۲۰۲۶ / ۱۴ آبان ۱۴۰۵
- **مالک به‌روزرسانی:** ایجنت توسعه (طبق بستهٔ GOV-01 نقشهٔ راه)
- **مبنا:** کامیت `c9c3b6c` و نقشهٔ راه جامع [docs/roadmap/AEL_Master_Roadmap_FA_2026-11-05.md](docs/roadmap/AEL_Master_Roadmap_FA_2026-11-05.md)
- **فهرست کارها:** [BACKLOG_FA.md](BACKLOG_FA.md) — **تصمیم‌ها:** [DECISIONS_FA.md](DECISIONS_FA.md)

این سند پاسخ می‌دهد: «الان چه چیزی کار می‌کند، مدرک چیست و چه چیزی باز است؟» هر ادعا باید مسیر و تاریخ داشته باشد. «موجود» یعنی اثر قابلیت یا گزارش آزمون محلی، نه تأیید علمی یا کاربر واقعی.

## ۱. خط پایهٔ راستی‌آزمایی‌شده (اجرای ۵ نوامبر ۲۰۲۶)

| کنترل | فرمان | نتیجه |
|---|---|---|
| نصب تمیز | `npm ci` | ✅ موفق — Node v24.18.0، npm 12.0.1، lockfile نسخهٔ ۳ |
| تست‌ها | `npm test` | ✅ ۴۲۱ تست در ۳۲ فایل (پس از EX/UX) |
| تایپ | `npm run typecheck` | ✅ |
| محتوای یادگیری | `npm run validate:learning` | ✅ ۸ مبحث/۲۴ سؤال مالی + ۲ مبحث/۵ سؤال آمار، ۱۰ منبع، ممیزی ۵ شاهد، ۱۶۸ شناسه |
| فایل آفلاین | `npm run build:offline` | ✅ تولید `tools/offline/AEL_OFFLINE.html` |
| اسکن دارایی | `npm run audit:miniapp` | ✅ بدون کلید جاسازی‌شده |
| دیتابیس | `npm run test:db` | ✅ ۱۸ مهاجرت، replay ledger، بازیابی/پشتیبان |

محیط اجرا: ویندوز (Git Bash)، `core.autocrlf=true`. شواهد کامل‌تر: [docs/ael-next/09_VERIFICATION_FA.md](docs/ael-next/09_VERIFICATION_FA.md).

## ۲. کارکردهای موجود (با مرز ادعا)

- **آزمون تألیفی:** انتخاب چند مبحث از یک بستهٔ درس، سهمیه، ظرفیت، تصادفی بدون تکرار، شناسهٔ بازپخش، عدم افشای کلید قبل از پایان آزمون زمان‌دار. موتور: [packages/learning-engine/src/formative-quiz.ts](packages/learning-engine/src/formative-quiz.ts). **بستهٔ ۴:** آزمون چندبسته‌ای با سهمیهٔ بین درس‌ها و پیش‌نمایش نسخه‌pin ([multi-course-quiz.ts](packages/learning-engine/src/multi-course-quiz.ts))، عملیات تکرارپذیر نشست تألیفی و تمرین انتقالی سرتاسری. گروه‌بندی هم‌ارز در داده فعلاً استفاده نشده.
- **محتوای پایلوت:** مالی (۸ مبحث، ۲۴ سؤال) و آمار (۲ مبحث، ۵ سؤال شامل ۱ تشریحی با روبریک). همه `origin: authored`، `rights: original_ael`، `review: pending_sme` — بازبینی متخصص انجام نشده است.
- **شناسنامه‌ها:** ۱۶۸ رکورد در [content/learning-evidence/question-index.json](content/learning-evidence/question-index.json) = ۱۳۹ رکورد کنکور + ۲۹ تمرین تألیفی؛ فهرست [docs/ael-next/11_SOURCE_INVENTORY_FA.md](docs/ael-next/11_SOURCE_INVENTORY_FA.md). شمار نشان‌دهندهٔ پوشش کل کنکورها نیست.
- **خطای ← مطالعه:** پیوند هر تمرین تألیفی به نکته/فرمول/مثال (`readingBlock`)؛ ارتباط با صفحهٔ کتاب کنکور تأیید نشده.
- **شواهد تاریخی:** یک الگوی کاندید BCG (۱۴۰۲/818C/185 و ۱۴۰۵/319A/188) با وضعیت `trace_pending_review`؛ دو رکورد کشش تقاضا به‌دلیل تعارض از استخراج کنار گذاشته شدند ([content/learning-evidence/source-audit.json](content/learning-evidence/source-audit.json)).
- **شبیه‌ساز استخری سرور:** با بستن اتمیک و تلاش مجدد (مهاجرت‌های 0017 و 0018، اعمال روی محیط مقصد جداست)؛ `contentOfficiality: scaled_pool` — بازسازی رسمی دفترچه ادعا نمی‌شود.
- **آفلاین:** فایل HTML مستقل با ذخیره/پشتیبان/بازیابی نسخه‌دار؛ کلید تمرین‌های تألیفی داخل فایل است و برای آزمون محرمانه مناسب نیست.

## ۳. موارد باز (مسدودکننده‌های مهم)

1. **حقوق و اصالت منابع (SRC-02):** شرایط OpenStax و سایر منابع برای بازنشر، آفلاین و ورود به سامانهٔ هوش مصنوعی تعیین نشده؛ بانک تاریخی بدون فیلد `rights` صریح است.
2. **بازبینی علمی (SRC-04/FIN-01):** هیچ سؤال تألیفی توسط متخصص مستقل بازبینی نشده است.
3. **امنیت محیط مقصد (SEC-02):** اصلاحات fail-closed در کد اعمال و با ۹ تست تأیید شد (پیش‌فرض سخت‌گیرانه، بستن دریبل دمو، رد auth_date آینده، CORS محدود، AT-28) — **اعمال روی ورکر مقصد و حذف `ALLOW_DEMO_AUTH` از secretهای مقصد هنوز انجام نشده**؛ گزارش و طرح بازگشت: [docs/security/SEC01_READ_ONLY_AUDIT_2026-11-05.md](docs/security/SEC01_READ_ONLY_AUDIT_2026-11-05.md) و [docs/deploy/SEC02_ROLLBACK_2026-11-05.md](docs/deploy/SEC02_ROLLBACK_2026-11-05.md).
4. **مهاجرت‌های 0016–0018:** روی محیط مقصد اعمال و تأیید نشده‌اند.
5. **دقت `--check` پس از اصلاح:** چک‌های تازگی فقط CRLF/LF را تحمل می‌کنند؛ هر ویرایش دستی واقعی در فایل‌های تولیدی همچنان شکست می‌خورد (رفتار مطلوب).
6. **کاربر واقعی:** پایلوت، آزمون تلگرام واقعی و سنجش یادگیری انجام نشده‌اند (QA-03، OPS-02).
7. **دامنهٔ پایلوت (GOV-02):** پیش‌فرض موقت ثبت شد ([docs/ael-next/13_PILOT_SCOPE_FA.md](docs/ael-next/13_PILOT_SCOPE_FA.md)) — تصمیم نهایی با مالک محصول.
8. **مدل داده (DATA-01/02/03):** نگاشت، اعتبارسنج نسخه‌بندی و dry-run کامل شد ([12](docs/ael-next/12_DATA_MODEL_MAPPING_FA.md)، [14](docs/ael-next/14_MIGRATION_DRYRUN_FA.md)) — تبدیل واقعی باقی است. ماتریس حقوق SRC-02 آمادهٔ تصمیم است ([15](docs/ael-next/15_RIGHTS_MATRIX_FA.md)).

## ۴. اشکالات شناخته‌شدهٔ این نسخه

| شناسه | شرح | وضعیت |
|---|---|---|
| QA-01-F1 | چک‌های `--check` با `core.autocrlf=true` ویندوز به‌دلیل اختلاف CRLF/LF غلط شکست می‌خوردند | رفع شد: نرمال‌سازی EOL در [scripts/extract-learning-recurrence.mjs](scripts/extract-learning-recurrence.mjs) و [scripts/build-question-index.mjs](scripts/build-question-index.mjs) |
| SEC-01-F1/F2/F3/F6 | دریبل demo وابسته به ENVIRONMENT، سقوط به MemoryStore، CORS wildcard، پذیرش auth_date آینده | **رفع شد در کد (SEC-02):** fail-closed پیش‌فرض + بستن دمو در production + فهرست سفید CORS + رد آینده؛ اعمال روی مقصد باقی است |
| SEC-01-F4/F5 | توکن نشست بدون انقضا، محدودسازی نرخ per-isolate | باز — بستهٔ جدا |
| GOV-01-F1 | اسناد قدیمی (۰۱، ۰۸-Q09، ۰۹، docs/status/implementation-status.md) حاوی ادعاهای منسوخ بودند | رفع شد: تطبیق با دادهٔ فعلی و برچسب منسوخ |

## ۵. قاعدهٔ به‌روزرسانی

هر تغییر مؤثر کد یا داده باید همین سند، سند ۱۰ و ردیف مربوط در BACKLOG را به‌روز کند؛ گزارش درصد فقط با مخرج روشن. قالب وضعیت هر کار: بخش ۱۸٫۴ نقشهٔ راه.
