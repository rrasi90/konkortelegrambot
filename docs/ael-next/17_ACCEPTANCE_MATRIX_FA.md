# QA-02 — ماتریس پذیرش سرتاسری (AT-01..AT-34)

- **تاریخ:** ۵ نوامبر ۲۰۲۶ / ۱۴ آبان ۱۴۰۵
- **مبنا:** بخش ۱۴ نقشهٔ راه. وضعیت‌ها: ✅ تست خودکار سبز · 🔵 آزمون دستی/E2E سبز · 👤 نیازمند اجرای انسانی · ⏳ مسدود به پیش‌نیاز
- **اجرای خودکار:** `npm test` (۴۲۱ تست) + `CHROME_PATH=… node scripts/e2e-learning-ui.mjs offline`

| شناسه | سناریو | وضعیت | شاهد |
|---|---|---|---|
| AT-01 | منشأ/نسخه/مبحث/بازبین جدا | ✅ | ایندکس `verification/review/rights/auditStatus`؛ `validate:learning` |
| AT-02 | سؤال رسمی بدون دفترچه/کلید نام کامل نگیرد | ✅ | `build-question-index` فیلدهای null؛ `contentOfficiality: scaled_pool` |
| AT-03 | دو چاپ کتاب جدا | ✅ | `validateBookEditions` — data-versioning.test |
| AT-04 | ورود دوباره idempotent | ✅ | `partitionImportBatch` + `importQuestionBatch` — data-versioning/import-pipeline tests |
| AT-05 | OCR مبهم → قرنطینه | ✅ (ساختار) | `structuralIssues` → quarantined؛ OCR واقعی با SRC-03 کامل می‌شود |
| AT-06 | یک نسخه از هر گروه | ✅ | multi-course-quiz.test |
| AT-07 | گروه مشترک دو درس، تخصیص ممکن | ✅ | multi-course-quiz.test |
| AT-08 | سهمیهٔ ناممکن → خطا، نه جلسهٔ ناقص | ✅ | multi-course-quiz.test + formative-quiz (کمبود مبحث) |
| AT-09 | بانک/seed یکسان → انتخاب یکسان | ✅ | multi-course-quiz.test |
| AT-10 | ۱۰۰۰ seed بدون نقض فیلتر/تکرار | ✅ | multi-course-quiz.test (حلقهٔ ۱۰۰۰) |
| AT-11 | توزیع بانک متوازن | ✅ | multi-course-quiz.test (۶۰ جلسه) |
| AT-12 | تغییر بانک → پیش‌نمایش نامعتبر | ✅ | multi-course-quiz + ex-session.test (نسخهٔ pin) |
| AT-13 | کلید قبل از پایان در پاسخ API نباشد | ✅ | audit-fixes/worker.test + `audit:miniapp` |
| AT-14 | قطع شبکه/بازخوانی در جلسه | 🔵 | e2e offline (بازیابی نشست)؛ HTTP/HTTPS مسدود |
| AT-15 | تکرار عملیات با opId | ✅ | ex-session.test |
| AT-16 | پایان زمان با ساعت سرور | ✅ | ex-session.test |
| AT-17 | تشریحی در انتظار | ✅ | formative-quiz (status=pending) + e2e |
| AT-18 | اصلاح کلید/نسخه پس از نشست | ✅ | data-versioning (id_reuse) + ex-session (نسخهٔ pin) |
| AT-19 | دو رخداد هم‌مفهوم جدا شمارش | ✅ | data-versioning (duplicate_appearance) |
| AT-20 | تعارض تصویر/متن بانک | ✅ (فرایند) | source-audit.json دو conflict کنارگذاشته |
| AT-21 | غلط با نگاشت → بند درست + سؤال متفاوت | 🔵 | e2e (wrong→lesson→back) + `findTransferQuestion` |
| AT-22 | غلط بدون نگاشت → fallback مبحث | 🔵 | e2e + learning.js fallback |
| AT-23 | خواندن آزاد با صراحت ناموجود | 🔵 | e2e (custom study)؛ چاپ تأییدنشده «هنوز تأیید نشده» |
| AT-24 | فایل آفلاین بدون شبکه | 🔵 | e2e: file:// با HTTP/HTTPS مسدود و ۰ درخواست خارجی |
| AT-25 | localStorage بسته/سهمیه پر | 👤 | راهنمای ۰۸؛ تست مرورگر واقعی لازم |
| AT-26 | بازیابی فایل نامعتبر | 🔵 | آداپتور آفلاین `restoreBackup` نسخه‌سنج |
| AT-27 | RTL/فرمول/کیبورد موبایل | 👤 | پایلوت موبایل واقعی — QA-03 |
| AT-28 | دسترسی بین‌کاربران رد | ✅ | sec02-failclosed + ex-session tests |
| AT-29 | منبع با حق نامشخص | ✅ (فرایند) | rights=pending_review؛ ماتریس ۱۵؛ import بدون rights → قرنطینه |
| AT-30 | درس تازه بدون صفحهٔ سخت‌کدشده | ✅ | `validate-learning-courses` + رجیستری learning-catalog |
| AT-31 | نصب مستقل محیط تمیز | ✅ | QA-01: npm ci + ۴۰۱ تست (۵ نوامبر ۲۰۲۶) |
| AT-32 | بکاپ/مهاجرت آزمایشی | ✅ | `test:db` (backup/restore، ۱۸ مهاجرت) |
| AT-33 | تست واقعی کاربر (۵ وظیفه) | 👤 | QA-03/OPS-02 |
| AT-34 | دفترچه با کلید مفقود «کامل» نشود | ✅ (قرارداد) | disclosures شبیه‌ساز؛ EX-05 مسدود تا حقوق |

**جمع خودکار: ۲۵ ✅ / ۶ 🔵 / ۴ 👤 / ۱ ⏳(EX-05).** موارد 👤 نیازمند دستگاه/کاربر واقعی‌اند و با تست خودکار جایگزین نمی‌شوند.
