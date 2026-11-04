# مأموریت جامع ایجنت: ممیزی، بازآشتی، اصلاح، تست و پاک‌سازی مخزن AEL / آموزش کنکور

> **نوع سند:** دستورکار اجرایی برای ایجنت مهندسی نرم‌افزار  
> **مخزن هدف:** `rrasi90/konkortelegrambot`  
> **تاریخ Snapshot ممیزی اولیه:** 2026-11-04  
> **شاخهٔ مرجع در زمان ممیزی:** `main`  
> **SHA مرجع در زمان ممیزی:** `079dc235762e786e3df46df031caffd19cf222a4`  
> **هدف نهایی:** رساندن تغییرات معتبر و قابل‌آزمون به GitHub، بدون از دست‌دادن کارهای مفید، بدون ادغام معماری‌های منسوخ، بدون تضعیف امنیت و بدون ادعای آمادگی انتشار پیش از وجود شواهد.

---

## 0. دستور اصلی و اختیار اجرایی

تو مسئول تکمیل این مأموریت از ابتدا تا انتها هستی. کار را به گزارش‌نویسی محدود نکن. مخزن را باز کن، وضعیت واقعی را بررسی کن، تغییرات لازم را اعمال کن، تست‌ها را اجرا کن، شواهد را در مخزن ثبت کن، Branch و PR بساز، CI را بررسی کن و فقط پس از عبور از معیارهای پذیرش، تغییرات را وارد `main` کن.

کاربر یک ZIP از مخزن نیز در اختیار تو قرار می‌دهد. ZIP فقط **ورودی اولیه و snapshot محلی** است؛ آن را به‌صورت خودکار جدیدترین نسخه فرض نکن. مرجع نهایی کد و وضعیت PRها، GitHub زنده و آخرین SHA شاخهٔ `main` است.

### 0.1. قواعد اجباری

1. **از صفر راستی‌آزمایی کن.** هیچ گزارش، تست، تعداد یا ادعای این سند را بدون تطبیق با ZIP و GitHub فعلی حقیقت تغییرناپذیر فرض نکن. موارد این سند، Snapshot ممیزی 2026-11-04 هستند.
2. **هیچ کار مفیدی را حذف نکن.** پیش از بستن PR یا حذف Branch، Commitها، فایل‌ها و تغییرات اختصاصی آن را با `main` مقایسه کن.
3. **هیچ‌وقت معماری قدیمی را یک‌جا Merge نکن.** تغییرات مفید را به‌صورت گزینشی و روی Branch تازه‌ای که از آخرین `main` ساخته شده منتقل کن.
4. **مستقیماً روی `main` کار نکن.** از Branch کاری مستقل استفاده کن، PR باز کن، CI و Review را بررسی کن و سپس Merge کن.
5. **Force Push ممنوع است.** تاریخچهٔ `main` یا Branch دیگر را بازنویسی نکن. در صورت نیاز به اصلاح، Commit جدید بساز.
6. **دیتابیس Production را برای تست استفاده نکن.** هر Migration، Seed، Replay، Backup/Restore و Integrity Test باید روی PostgreSQL موقت/اختصاصی با نام و دسترسی آزمایشی اجرا شود.
7. **Secretها را نمایش نده.** `.env`، Token، کلید Supabase، Telegram Bot Token، Session Secret و خروجی متغیرهای حساس را چاپ یا Commit نکن.
8. **تست سبز را معادل Production Ready ندان.** وضعیت Production فقط با شواهد محیط واقعی و کنترل‌های عملیاتی اعلام می‌شود.
9. **هیچ اسکنر امنیتی را دور نزن.** به‌خصوص Audit کلید پاسخ در Bundle عمومی را خاموش یا Relax نکن تا فقط CI سبز شود.
10. **دادهٔ آزمون و محتوای علمی را جعل نکن.** عددهای بدون منبع، رتبه، تراز، احتمال قبولی، فراوانی دکتری یا ادعای پوشش ۱۰۰٪ تولید نکن.
11. اگر GitHub یا دسترسی شبکه/مجوزها در دسترس نبود، کار محلی و آماده‌سازی Patch را ادامه بده؛ اما Push، Merge، حذف Branch یا Deploy انجام‌شده را ادعا نکن.
12. در پایان، وضعیت تک‌تک کارها را با یکی از برچسب‌های `DONE`، `PARTIAL`، `BLOCKED` یا `NOT STARTED` گزارش کن و برای هر `DONE` شاهد قابل‌بررسی ارائه بده.

### 0.2. روش کار با ZIP

- ZIP را در یک دایرکتوری کاری مستقل Extract کن؛ فایل ZIP اولیه را دست‌نخورده نگه دار.
- قبل از هر تغییر، فهرست فایل‌ها، اندازه، تاریخ‌ها و SHA-256 فایل ZIP را ثبت کن.
- بررسی کن آیا ZIP شامل `.git`، `package-lock.json`، Migrationها، تست‌ها و مستندات کامل است یا نه.
- اگر `.git` موجود نیست، تاریخچهٔ Git را از GitHub بگیر؛ از روی ZIP نمی‌توان سابقهٔ Branch/Commit را استنتاج کرد.
- SHA و نسخهٔ ZIP را با `main` زنده مقایسه کن. هر فایل موجود در ZIP که با GitHub فرق دارد، باید منشأ تفاوتش مشخص شود.
- ZIP را به‌عنوان مبنای Push مستقیم استفاده نکن. تغییرات نهایی باید روی Clone تازه یا Worktree متصل به Remote و مبتنی بر آخرین `main` ساخته شوند.
- اگر ZIP شامل فایل‌های محلی، Cache، `node_modules`، Build Output یا Secret است، آن‌ها را وارد Commit نکن.

---

## 1. خلاصهٔ پروژه و ستارهٔ قطبی

### 1.1. هویت محصول

AEL / «آموزش کنکور» یک سامانهٔ آموزش تطبیقی برای داوطلبان آزمون‌های مدیریت است. هدف آن صرفاً نمایش درسنامه یا ارسال تست نیست؛ باید چرخه‌ای شواهد‌محور بسازد که از تشخیص وضعیت واقعی یادگیرنده تا ترمیم ضعف و اثبات ماندگار یادگیری ادامه پیدا کند.

### 1.2. چشم‌انداز

ساخت یک همراه آموزشی قابل‌اعتماد که مسیر آمادگی پراکنده و غیرشفاف داوطلبان مدیریت را به یک فرایند علمی، قابل‌ردیابی، شخصی‌سازی‌شده و قابل‌اندازه‌گیری تبدیل کند.

### 1.3. مأموریت

تبدیل ساختار رسمی آزمون و منابع معتبر به نقشهٔ مهارت؛ تشخیص سطح واقعی هر داوطلب با ارزیابی مستقل؛ اتصال آموزش، بازیابی فعال، تحلیل خطا، ترمیم پیش‌نیاز و مرور فاصله‌دار؛ و تأیید یادگیری با شواهد عملکردی در جلسات مستقل.

### 1.4. وعدهٔ محصول

به داوطلب کمک کنیم بداند **چه چیزی** را بخواند، **چرا** آن موضوع مهم است و **از کجا** بفهمد واقعاً آن را یاد گرفته است.

### 1.5. North Star Metric — تسلط پایدارِ تأییدشدهٔ هفتگی

شاخص ستارهٔ قطبی پیشنهادی:

**Weekly Verified Durable Masteries (WVDM)** — تعداد زوج‌های یکتای `(learner_id, skill_id)` که در یک هفته به تسلط پایدار و مستند می‌رسند.

یک مهارت فقط زمانی وارد WVDM شود که تعریف عملیاتی زیر را برآورده کند:

- یادگیری با چند پاسخ مستقل و معتبر ارزیابی شده باشد؛
- شواهد در بیش از یک جلسه ثبت شده باشند؛
- ارزیابی تأخیری/مرور سررسیدشده نیز موفق باشد؛
- حداقل آستانهٔ تسلط Engine و حداقل تعداد شواهد برقرار باشد؛
- یک زوج کاربر/مهارت در بازهٔ گزارش فقط یک بار شمرده شود؛
- محتوای Holdout و آزمون اثبات، طبق سیاست نشت و مجوز محتوا استفاده شده باشد.

آستانهٔ اولیه مانند ۷۵٪ فقط **فرضیهٔ قابل‌اعتبارسنجی** است و نباید بدون تحلیل دادهٔ واقعی به‌عنوان قانون علمی قطعی معرفی شود.

**وضعیت فعلی:** WVDM یک قرارداد راهبردی است، نه KPI عملیاتیِ اندازه‌گیری‌شده. تا وقتی هویت پایدار یادگیرنده، ذخیره‌سازی پایدار، رویداد تسلط و ارزیابی تأخیری واقعاً در Production فعال و پایش نشده‌اند، ادعا نکن که WVDM اندازه‌گیری می‌شود.

### 1.6. شاخص‌های پشتیبان

- نرخ تبدیل تمرین به تسلط پایدار؛
- نرخ حفظ یادگیری در مرور تأخیری؛
- زمان رسیدن به تسلط به تفکیک مهارت و سطح دشواری؛
- پوشش مهارت‌های رسمی آزمون با منشأ معتبر؛
- نرخ سؤال‌های دارای منبع، کلید و بازبینی معتبر؛
- نرخ ترمیم موفق خطاهای پرتکرار؛
- پایداری برنامهٔ روزانه در محدودیت زمان داوطلب؛
- نرخ فعال‌سازی و بازگشت، فقط به‌عنوان شاخص سلامت قیف و نه معیار اصلی موفقیت آموزشی.

زمان حضور، تعداد کلیک، تعداد بازشدن درسنامه، XP یا تعداد سؤال حل‌شده به‌تنهایی معیار موفقیت یادگیری نیستند.

### 1.7. اهداف راهبردی

1. **اثربخشی یادگیری:** اندازه‌گیری پیشرفت واقعی و ماندگار، نه صرفاً تعامل.
2. **پوشش قابل‌اثبات آزمون:** انطباق دقیق با مواد، کد، گرایش، ضریب، سال و منبع رسمی.
3. **یکپارچگی فنی:** حرکت به سمت یک مرجع روشن برای قراردادها، Engine، محتوا و وضعیت کاربر.
4. **اعتماد و امنیت:** حفاظت از پاسخ‌ها، هویت، دادهٔ یادگیرنده، Holdout و محتوای دارای حق نشر.
5. **تجربهٔ یکپارچه:** رابط فارسی و RTL قابل‌دسترس، قابل‌فهم و سازگار در Telegram Mini App و مسیرهای پشتیبانی‌شده.
6. **زیرساخت قابل‌اتکا:** ذخیره‌سازی پایدار، بازیابی، Observability، مدیریت خطا و Deploy قابل‌برگشت.
7. **کیفیت محتوای علمی:** منشأ، نسخه، سطح، بازبین و وضعیت مجوز برای هر آیتم.
8. **رشد هم‌راستا با ارزش آموزشی:** رشد محصول نباید به قیمت کاهش کیفیت سؤال، اعتماد یا اثربخشی تمام شود.

### 1.8. غیرهدف‌ها و ممنوعیت ادعا

- تضمین رتبه، قبولی، دعوت به مصاحبه یا پذیرش دانشگاهی؛
- نمایش رتبه/تراز پیش‌بینی‌شده با دادهٔ نمونه یا آستانهٔ تأییدنشده؛
- اعلام پوشش کامل آزمون بدون تطبیق سند رسمی و بانک سؤال واقعی؛
- تبدیل سؤال تولیدشده با AI به سؤال رسمی؛
- تبدیل خوداظهاری یادگیرنده به شاهد تسلط؛
- استفاده از سؤالات یا متن کتاب بدون تعیین مجوز و حقوق استفاده؛
- بهینه‌سازی صرف برای Engagement یا Gamification؛
- نگهداری دو منطق مستقل Engine به‌عنوان دو مرجع هم‌ارز بدون قرارداد Parity و برنامهٔ حذف؛
- دور زدن اسکن امنیتی Bundle یا کنترل‌های Release.

---

## 2. Snapshot ممیزی GitHub در 2026-11-04

> این بخش وضعیت ثبت‌شده در ممیزی اولیه است. پیش از تصمیم اجرایی، SHA و وضعیت زنده را دوباره دریافت کن.

### 2.1. وضعیت Main

| شاخص | Snapshot اولیه |
|---|---|
| Repository | `rrasi90/konkortelegrambot` |
| Branch | `main` |
| Commit SHA | `079dc235762e786e3df46df031caffd19cf222a4` |
| Remote Branch count | ۲۰، شامل `main` |
| Pull Request count | ۱۲ |
| Merged PR | ۹ |
| Open PR | ۳ |
| Draft PR | ۲ |
| Main CI | موفق |
| Unit/Integration Vitest | ۲۴ فایل تست، ۳۳۷ تست موفق |
| Engine Parity Harness | ۲۱ سناریو، ۲۱ Match، صفر Divergence در سناریوهای انتخاب‌شده |
| Database migration/integrity job | موفق |
| Worker build | موفق |
| Mini App Security Audit | موفق |
| Wrangler deploy dry-run | موفق |

**CI اصلی:** [Run 41706008628](https://github.com/rrasi90/konkortelegrambot/actions/runs/41706008628)

### 2.2. مانع انتشار GitHub Pages

در Snapshot ممیزی، Workflow انتشار Pages شکست خورده بود؛ اسکنر کلید پاسخ در Bundle عمومی React را پیدا می‌کرد.

شواهد ثبت‌شده در ممیزی:

- `correctOption`: حدود ۱۸۵ مورد شناسایی‌شده؛
- `correctIndex`: حدود ۲۶ مورد شناسایی‌شده؛
- مجموع: ۲۱۱ Match اسکنر.

این عدد، تعداد Matchهای اسکنر است و لزوماً به معنی تعداد ۲۱۱ سؤال منحصربه‌فرد نیست.

**تصمیم Release:** تا وقتی پاسخ‌ها و کلیدها از Bundle عمومی حذف و Audit امنیتی سبز نشده است، انتشار مسیر React/Pages باید مسدود بماند. اسکنر، Workflow یا تست را تضعیف نکن.

Mini App مبتنی بر Worker در همان Snapshot، Audit موفق داشته است؛ این موضوع به‌تنهایی تکمیل Production، Supabase یا Telegram واقعی را اثبات نمی‌کند.

### 2.3. محدودیت Parity

عدد ۲۱/۲۱ فقط نشان می‌دهد ۲۱ سناریوی انتخاب‌شده برابر بوده‌اند. این عدد به معنی یکپارچگی کامل تمام مصرف‌کنندگان Engine، یکسانی همهٔ مسیرهای React و Worker یا یکپارچگی Persistence نیست.

---

## 3. وضعیت PRها و تصمیم اولیه

### 3.1. فهرست کامل PRها

| PR | عنوان/حوزه | Snapshot وضعیت | تصمیم اولیه |
|---:|---|---|---|
| #1 | Adaptive Engine Foundation | Open، non-Draft، `dirty` | کد معماری قدیمی Merge نشود؛ مستندات منحصربه‌فرد گزینشی حفظ شود |
| #2 | Telegram Integration، Curriculum و Registration | Merged | Merge مجدد ممنوع؛ Branch پس از کنترل قابل حذف |
| #3 | Learning Integrity، FSRS و Secure Attempts | Open، Draft، `dirty` | اصلاحات منحصربه‌فرد گزینشی منتقل شود؛ کل PR Merge نشود |
| #4 | PhD Management Scientific Foundation | Open، Draft، `dirty` | محتوای اصلی در Main موجود؛ PR پس از تطبیق بسته شود |
| #5 | Critical Exam/Mastery/Data Integrity Remediation | Merged | مرجع بخش عمدهٔ اصلاحات؛ Merge مجدد ممنوع |
| #6 | React FSRS Convergence | Merged | Merge مجدد ممنوع |
| #7 | Priority Before Queue Limit | Merged | Merge مجدد ممنوع |
| #8 | Telegram CloudStorage Snapshot Recovery | Merged | Merge مجدد ممنوع |
| #9 | Client Answer-Key Release Guard | Merged | کنترل امنیتی حفظ شود؛ مشکل Bundle هنوز باید حل شود |
| #10 | Node 24 Runtime Alignment | Merged | Merge مجدد ممنوع |
| #11 | Secure Worker Mini App / Telegram Webhook | Merged | Merge مجدد ممنوع |
| #12 | README، North Star و Product Strategy | Merged | نسخهٔ فعلی README را حفظ کن و فقط در صورت نیاز اصلاح کن |

قبل از بستن هر PR، وضعیت، Commit SHA، Review، Review Thread، Check و Diff زنده را دوباره دریافت کن. `dirty` یا `mergeable=false` را دور نزن.

### 3.2. PR #1 — `feat/adaptive-engine-foundation`

Snapshot ممیزی:

- ۸ Commit؛
- ۴۶ فایل تغییرکرده؛
- حدود ۳,۹۹۵ خط اضافه و ۳۲ خط حذف؛
- آخرین SHA: `110a5047bb1d95e156c5869c9e7039caed9bbb86`؛
- PR باز و در وضعیت `dirty`؛
- CI تاریخی ثبت‌شده برای آن شکست خورده است.

این PR یک نسل قدیمی از معماری را دارد: `packages/domain`، `packages/engine`، `apps/api-worker` و Workspace مبتنی بر pnpm. معماری Main فعلی بر npm workspaces، `packages/contracts`، `packages/learning-engine` و `apps/worker` بنا شده است.

**هیچ‌یک از کدهای قدیمی آن را یک‌جا Merge نکن.** موارد ارزشمند برای حفظ و بازنویسی/ادغام مستنداتی:

- `docs/product/complete-product-spec.md`؛
- `docs/product/product-brief.md`؛
- `docs/governance/content-and-ai-governance.md`؛
- `docs/testing/acceptance-scenarios.md`؛
- `docs/roadmap/TODO.md` و `docs/roadmap/implementation-roadmap.md`؛
- `docs/security/content-delivery.md`؛
- `docs/architecture/*` و `docs/decisions/decision-log.md`، پس از تطبیق با معماری فعلی.

محتوا را با README فعلی، North Star، Audit و Decision Log Main ادغام کن؛ نسخهٔ تکراری یا منسوخ نساز. سپس PR#1 را ببند و Branch را فقط پس از حفظ Commitهای منحصربه‌فرد آرشیو کن.

### 3.3. PR #3 — `fix/critical-learning-integrity-20261101`

Snapshot ممیزی:

- ۴۶ Commit؛
- ۲۳ فایل؛
- حدود ۱,۱۹۱ خط اضافه و ۵۵۰ خط حذف؛
- آخرین SHA: `a2fb50d151aed7270302ce54e2201e2e9a475320`؛
- Open، Draft و `dirty`.

این PR چند خوشهٔ تغییر دارد. همهٔ آن‌ها را جداگانه بررسی کن؛ کد قدیمی را کورکورانه Cherry-pick نکن.

#### تغییرات PR3 که در PRهای بعدی جایگزین یا منتقل شده‌اند

- بخش عمدهٔ Attempt Ticket و Self-report Guard در PR#5 بازپیاده‌سازی شده است؛
- FSRS و همگرایی React در PR#6 توسعه یافته است؛
- Rate Limit و برخی اصلاحات Worker در PRهای بعدی منتقل/تکمیل شده‌اند؛
- برچسب‌گذاری جزوهٔ انتخابی و برخی اصلاحات مستندات در Main فعلی وجود دارند.

این بخش‌ها را از نسخهٔ قدیمی PR3 دوباره وارد نکن. ابتدا Main فعلی را مبنا بگیر و تست‌های موجود را بخوان.

#### تغییر منحصربه‌فرد اول: جداسازی خوداظهاری از شواهد تسلط

در ممیزی اولیه، تابع `applyLessonUnderstandingRating` در Main می‌توانست با Rating خوداظهاری، `coverageStatus`، `rippleAlert` یا مسیر اثبات را تغییر دهد. در Rating برابر ۵، مسیر Holdout/Proof می‌توانست از یک اظهار نظر شخصی فعال شود.

PR3 نسخه‌ای سخت‌گیرانه‌تر دارد:

- خوداظهاری فقط در `lastLessonSelfRating` ذخیره شود؛
- `masteryScore` تغییر نکند؛
- `proficiencyProbability` تغییر نکند؛
- `memoryStability` و `retrievability` تغییر نکنند؛
- `evidenceCount` تغییر نکند؛
- `coverageStatus` و Knowledge Frontier از خوداظهاری تغییر نکنند؛
- خوداظهاری هرگز Holdout/Proof را فعال نکند؛
- Rating بالا فقط سؤال تمرینی معمولی و مستقل را پیشنهاد کند؛
- Rating پایین می‌تواند مسیر مطالعه/ترمیم را تغییر دهد، اما نباید سابقهٔ شکاف را پاک کند.

**اقدام:** منطق فعلی Main را مجدداً بخوان و با این قرارداد تطبیق بده. در صورت تأیید نقص، آن را در فایل‌های فعلی Main اصلاح کن و تست واحد/Integration بنویس. صرفاً Patch قدیمی را کپی نکن.

معیار تست حداقل:

1. Rating 1 تا 5 هرگز Mastery یا evidence count را افزایش نمی‌دهد؛
2. هیچ Rating به‌تنهایی `coverageStatus=proven/mastered` نمی‌سازد؛
3. هیچ Rating به‌تنهایی کارت Holdout/Proof نمی‌سازد؛
4. FSRS state از خوداظهاری تغییر نمی‌کند؛
5. کارت Remedial تشخیص‌داده‌شده با Rating مثبت حذف نمی‌شود؛
6. Rating بالا در صورت نیاز فقط Practice غیر-Holdout را در صف قرار می‌دهد؛
7. رفتار Knowledge Frontier مطابق قرارداد شواهد مستقل باقی می‌ماند.

#### تغییر منحصربه‌فرد دوم: نگاشت دقیق سؤال به فصل کتاب

در Main اولیه، `groupBookQuestionsByChapter` برای گره‌هایی که در چند فصل ظاهر می‌شدند، یک فصل را با Heuristic انتخاب می‌کرد. این می‌تواند سؤال را به فصل اشتباه نسبت دهد.

PR3 از `referenceChapterId` برای نگاشت صریح استفاده می‌کند و Ambiguity را پنهان نمی‌کند.

**اقدام:** این قابلیت را با قرارداد فعلی `BookChapter` و `QuestionItem` بازطراحی/منتقل کن:

- اگر `referenceChapterId` معتبر است، همان فصل را انتخاب کن؛
- اگر ID صریح نامعتبر است، خطای داده/گروه `unassigned` بده؛
- اگر فقط یک فصل ممکن است، نگاشت خودکار مجاز است؛
- اگر چند فصل محتمل است و نگاشت صریح وجود ندارد، سؤال را به یک فصل نسبت نده؛
- اگر یک سؤال چند فصل را پوشش می‌دهد، ابهام/اشتراک را در داده و UI آشکار کن؛
- تست‌های چندنگاشتی، نامعتبر و بدون نگاشت را اضافه کن.

**مهم:** فایل `bookChaptersTypes.ts` و مبنای فراوانی Main را حفظ کن. Main توضیح می‌دهد که `examCount` بر اساس آزمون کارشناسی ارشد مدیریت کد ۱۱۴۲ و سال‌های ۱۳۹۱ تا ۱۴۰۵ است؛ این داده، فراوانی آزمون دکتری نیست.

#### تغییر منحصربه‌فرد سوم: گیت شبیه‌ساز دکتری

در Main اولیه، `KonkorScoreSimulatorCard.tsx` شاخص‌هایی مانند رتبه، تراز، بازهٔ رتبه، مقایسه با رتبه‌های برتر و دانشگاه محل قبولی را حتی در مسیر دکتری Render می‌کرد.

در `src/data/konkorRankPredictor.ts` ادعاهای بدون پشتوانه وجود داشته‌اند؛ نمونه:

- تراز بالای ۴۲۰۰ دعوت به مصاحبهٔ دانشگاه تهران را تضمین می‌کند؛
- تراز بالای ۴۰۰۰ احتمال قبولی روزانه را به بیش از ۹۰٪ می‌رساند؛
- تراز بالای ۴۰۰۰ قبولی مدیریت تکنولوژی را تضمین می‌کند.

این ادعاها را حفظ یا بازنویسی ظاهری نکن؛ باید حذف یا به دادهٔ معتبر، قابل‌ردیابی و کالیبره‌شده متصل شوند.

PR3 برای مسیر PhD:

- فقط میانگین سادهٔ تسلط مباحث نگاشت‌شده را نمایش می‌دهد؛
- رتبه، تراز، درصد دفترچه و احتمال قبولی را نمایش نمی‌دهد؛
- What-If و کنترل نمرهٔ منفی را غیرفعال می‌کند؛
- عدم اعتبارسنجی ضرایب/مواد دکتری را شفاف اعلام می‌کند.

**اقدام پیشنهادی محافظه‌کارانه:**

1. برای PhD تا زمان وجود داده و ضرایب رسمی/ترکیب‌محور، رتبه/تراز/قبولی/احتمال را کاملاً پنهان کن.
2. برای Master نیز پیش‌بینی رتبه و دانشگاه را فقط زمانی فعال کن که Dataset کالیبراسیون معتبر، تعداد نمونه کافی، سال و کد آزمون روشن، روش Validation خارج از نمونه و گزارش خطا وجود داشته باشد.
3. اگر این شواهد نیست، UI را به سناریوی آموزشی/محاسبهٔ درصد با دادهٔ رسمی محدود کن و آن را با پیش‌بینی رتبه اشتباه نگیر.
4. پروفایل‌های نمونه را از خروجی کاربر نهایی جدا کن یا از مسیر محاسبهٔ Production حذف کن.
5. تست کن که هیچ کد PhD به‌طور ضمنی به Branch بازرگانی ارشد Map نشود.

#### مشکل چهارم: Node ID نامعتبر

در ممیزی اولیه، fallbackهایی مانند `nodes[0]` برای Node ID نامعتبر در Engine یا View وجود داشتند. این رفتار ممکن است عملیات را روی مبحث اشتباه اعمال کند.

**اقدام:** ورودی نامعتبر را Fail Closed کن؛ Error قابل‌نمایش/قابل‌ثبت برگردان، State را دست‌نخورده نگه دار و تست بنویس. در مسیرهایی که نبودن Node باید حالت Empty را نشان دهد، Empty State صریح بساز، نه fallback به اولین Node.

#### مشکل پنجم: ادعای پوشش ۱۰۰٪

در ممیزی اولیه، `src/components/LessonsLibraryView.tsx` عبارت «تضمین پوشش ۱۰۰٪ ده تا پانزده سال اخیر» را نشان می‌داد. این عبارت نباید بدون تطبیق کامل دفترچه‌های رسمی، کد آزمون، سال، سؤال، کلید و نگاشت مهارت باقی بماند.

آن را با وضعیت واقعی Evidence جایگزین کن؛ مثلاً درصد پوشش به تفکیک سال/کد، تعداد دفترچهٔ تأییدشده، سؤال‌های نگاشت‌شده و شکاف‌های باز. اگر دادهٔ معتبر کافی نیست، به‌صراحت «پوشش کامل تأیید نشده» بنویس.

#### موارد دیگری که باید از PR3 بازبینی شوند

- `referenceChapterId` و فصل‌های مشترک؛
- برچسب‌گذاری فرکانس فصل و تفکیک ارشد از دکتری؛
- ادعاهای تاریخی `examCount`؛
- توضیح جزوهٔ تولیدشده به‌عنوان جزوهٔ تألیفی/منتخب، نه متن کامل کتاب؛
- تست‌های `lessonSelfRating`، `bookChaptersRepo` و شبیه‌ساز.

**روش انتقال:** Branch تازه از آخرین `main` بساز، منطق را با قرارداد فعلی پیاده‌سازی کن، تست جدید بنویس و PR مستقلی ایجاد کن. پس از ورود موفق این اصلاحات و اطمینان از حفظ Commitهای قدیمی، PR#3 را ببند؛ کل Branch قدیمی را Merge نکن.

### 3.4. PR #4 — `phase-1/scientific-foundation`

Snapshot ممیزی:

- ۲ Commit؛
- ۱۴ فایل؛
- حدود ۱,۶۲۲ خط اضافه و ۱۰۴ خط حذف؛
- آخرین SHA: `3cce67bc60ee0b8bf736af67d5cca4fa5da76eab`؛
- Open، Draft، `dirty`.

مقایسهٔ Blobها نشان داد بخش عمدهٔ اسناد Phase 1 در Main فعلی موجود است. PR#5 نیز دو Commit پایهٔ این PR را به Branch خودش منتقل کرده است. نسخهٔ `scripts/validate-phase-1-foundation.mjs` در Main از نسخهٔ PR4 کامل‌تر است.

CI تاریخی PR4:

- Job دیتابیس موفق؛
- `npm ci` شکست خورده؛
- خطای ثبت‌شده: `vite@8.3.5` به `esbuild@^0.27.0 || ^0.28.0` نیاز داشت، درحالی‌که `esbuild@0.25.12` Resolve شده بود؛
- Typecheck و Test به‌دلیل شکست Install اجرا نشده‌اند.

این تعارض وابستگی در توسعهٔ بعدی Main/PR5 اصلاح شده است.

**اقدام:** اسناد و Validatorهای Phase 1 را در Main با Blob و محتوا تأیید کن. اگر نسخهٔ جدیدتر در Main وجود دارد، آن را حفظ کن. سپس PR#4 را بدون Merge ببند و Branch را پس از کنترل تاریخچه آرشیو/پاکسازی کن.

### 3.5. PRهای ادغام‌شده #2 و #5 تا #12

این PRها در Snapshot ممیزی Merged بودند؛ قبل از هر عملیات فقط Merge SHA و فایل‌های واقعی Main را مجدداً بررسی کن.

- **#2:** Telegram Integration، Mini App اولیه، Curriculum و Registration.
- **#5:** Critical Remediation با ۵۱ Commit و ۲۲۰ فایل؛ شامل بخش بزرگی از اصلاحات علمی، امنیت، Worker، بانک سؤال، Migration و شواهد Phase 0 تا 5؛ همچنین برخی تغییرات PR4 و PR3 را به‌طور گزینشی Port کرده است.
- **#6:** همگرایی FSRS در React با Engine مرجع؛ تست Parity و جلوگیری از ساخت دادهٔ حافظه از خوداظهاری.
- **#7:** اولویت‌بندی همهٔ کارت‌های واجد شرایط قبل از اعمال Queue Limit.
- **#8:** Snapshot کامل وضعیت یادگیرنده در Telegram CloudStorage و تست Recovery؛ این راهکار موقت/انتقالی است، نه جایگزین Persistence پایدار.
- **#9:** اسکن Bundle عمومی و جلوگیری از انتشار در صورت وجود Answer Key؛ کنترل امنیتی را حفظ کن.
- **#10:** Node 24، CI و Lockfile.
- **#11:** Worker-backed Mini App، API-first routing، Telegram Webhook و `secret_token`، کنترل Admin و Dry Run.
- **#12:** README جامع و North Star محصول.

این PRها را دوباره Merge نکن. اگر نقصی از آن‌ها باقی مانده، آن را به‌عنوان نقص جاری Main اصلاح کن.

---

## 4. ممیزی و تصمیم دربارهٔ ۲۰ Branch

Snapshot اولیه شامل ۲۰ Branch زیر بود. پیش از حذف، فهرست زنده و SHA هر کدام را دوباره بگیر.

### 4.1. فهرست Branchهای دیده‌شده

```text
chore/ci-node24-runtime-20261102
deploy/free-telegram-mvp
docs/comprehensive-readme-20261103
feat/adaptive-engine-foundation
feat/phd-management-knowledge-graph
fix/a19-replayable-migrations
fix/adaptive-core-hardening-2026-10-29
fix/adaptive-engine-hardening-20261029
fix/client-answer-key-deploy-guard-20261102
fix/complete-audit-and-security-hardening
fix/comprehensive-audit-20261102
fix/critical-learning-integrity-20261101
fix/engine-and-phd-knowledge-integration
fix/mission-remediation-20261101
fix/phase5-fsrs-convergence-20261102
fix/phase5-priority-before-limit-20261102
fix/secure-worker-miniapp-release-20261102
fix/telegram-cloud-snapshot-20261102
main
phase-1/scientific-foundation
```

### 4.2. Branchهای مرتبط با PRهای ادغام‌شده

در صورت تأیید مجدد عدم وجود Commit/فایل منحصربه‌فرد، این Branchها قابل حذف‌اند:

- `chore/ci-node24-runtime-20261102` — مربوط به PR#10؛
- `deploy/free-telegram-mvp` — مربوط به PR#2؛
- `docs/comprehensive-readme-20261103` — مربوط به PR#12؛
- `fix/client-answer-key-deploy-guard-20261102` — مربوط به PR#9؛
- `fix/mission-remediation-20261101` — مربوط به PR#5؛
- `fix/phase5-fsrs-convergence-20261102` — مربوط به PR#6؛
- `fix/phase5-priority-before-limit-20261102` — مربوط به PR#7؛
- `fix/secure-worker-miniapp-release-20261102` — مربوط به PR#11؛
- `fix/telegram-cloud-snapshot-20261102` — مربوط به PR#8.

### 4.3. Branchهای قدیمی یا دارای ۰ Diff مستقل

در Snapshot اولیه، Branchهای زیر فاقد تغییر مستقل قابل‌انتقال یا عمدتاً جایگزین‌شده بودند:

- `feat/phd-management-knowledge-graph`؛
- `fix/adaptive-core-hardening-2026-10-29`؛
- `fix/comprehensive-audit-20261102`؛
- `fix/engine-and-phd-knowledge-integration`.

**اقدام:** با `git diff`، `git log`، `git cherry`، Patch-ID و مقایسهٔ Blobها تأیید کن که فایل/Commit منحصربه‌فردی از قلم نیفتاده باشد. `ahead/behind` به‌تنهایی برای تصمیم حذف کافی نیست؛ Squash Merge و Rebase می‌تواند تاریخچه را متفاوت نشان دهد.

### 4.4. Branch قدیمی `fix/adaptive-engine-hardening-20261029`

Snapshot اولیهٔ Compare API:

- حدود ۹۱ Commit جلوتر و ۹۰ Commit عقب‌تر از Main در گراف تاریخچه؛
- ۲۷ فایل متفاوت در Compare؛
- یک نسل معماری قدیمی.

نشانه‌های تعارض معماری:

- ساختار `packages/domain` و `packages/engine` در برابر `packages/contracts` و `packages/learning-engine` فعلی؛
- `apps/api-worker` در برابر `apps/worker`؛
- استفادهٔ تاریخی از pnpm در برابر npm workspaces فعلی؛
- دو Migration با شمارهٔ `0003` و دو Migration با شمارهٔ `0004` در آن Branch:
  - `0003_security_atomic_learning.sql`؛
  - `0003_security_attempts_atomic_answers.sql`؛
  - `0004_domain_agnostic_learning_core.sql`؛
  - `0004_domain_generic_exam_packs.sql`.

**Merge کامل این Branch ممنوع است.**

پیش از حذف:

1. SHA Head را ثبت کن؛
2. یک Tag آرشیوی مانند `archive/adaptive-engine-hardening-20261029` روی همان SHA بساز؛
3. Tag را به Remote Push کن؛
4. از قابل‌دسترسی بودن Tag و Commitهای آن مطمئن شو؛
5. فقط پس از آن Branch منسوخ را حذف کن.

اگر این Branch حاوی ایده یا Patch مفیدی است، آن را با معماری و قراردادهای Main از نو پیاده‌سازی کن.

### 4.5. Branch `fix/complete-audit-and-security-hardening`

Snapshot اولیه شامل یک Commit منحصربه‌فرد بود:

`32cc35a95817bb909e905bf8eb0274b420d700f9`

این Commit مواردی مانند Production Fail-Closed، FSRS، Attempt Ticket، Holdout و محتوای علمی را تغییر داده بود. بخش عمدهٔ آن در PRهای بعدی جایگزین/تکمیل شده است.

**Merge نکن.** SHA و Patch آن را ثبت و یک Tag آرشیوی مانند `archive/complete-audit-security-hardening` بساز. پس از تأیید اینکه هیچ تغییر مستقل لازم نیست، Branch را حذف کن.

---

## 5. Branch مهم بدون PR: `fix/a19-replayable-migrations`

این Branch در Snapshot اولیه ۸ Commit جلوتر و یک Commit عقب‌تر از Main بود و ۱۷ فایل تغییر داشت. این مورد باید به‌عنوان یک اصلاح واقعی بررسی شود، نه اینکه چون PR ندارد حذف شود.

### 5.1. مشکل شناسایی‌شده در Main

در نسخهٔ Main هنگام ممیزی، `supabase/tests/run.sh` Migrationها و Seedها را یک بار اجرا می‌کرد و بازاعمال‌پذیری را آزمایش نمی‌کرد.

در Migrationهای زیر، `CREATE POLICY` بدون Guard وجود داشت:

- `supabase/migrations/0001_init.sql`؛
- `supabase/migrations/0005_attempt_tracking.sql`؛
- `supabase/migrations/0006_learner_and_security.sql`؛
- `supabase/migrations/0007_tracks_and_assets.sql`.

در نتیجه، اجرای دوباره ممکن بود با Policy موجود خطا دهد.

### 5.2. اصلاحات A19

Branch A19:

- برای Policyها `DROP POLICY IF EXISTS` اضافه می‌کند؛
- Migrationها و Seedها را بار دوم اجرا می‌کند؛
- تعداد ردیف‌های شش جدول را قبل/بعد مقایسه می‌کند:
  - `knowledge_nodes`؛
  - `questions`؛
  - `skills`؛
  - `exam_packs`؛
  - `node_dependencies`؛
  - `exam_pack_questions`؛
- وضعیت Policyها را قبل/بعد مقایسه می‌کند؛
- در صورت شکست، `REPLAY_FAILED`، `POLICY_DRIFT` یا `SEED_ROW_COUNT_CHANGED` گزارش می‌کند.

شواهد موجود در Branch:

- `evidence/audit-20261103/a19-replay-red.txt`؛
- `evidence/audit-20261103/a19-replay-green.txt`؛
- `evidence/audit-20261103/a19-replay-green-fixwave.txt`؛
- `evidence/audit-20261103/a19-double-apply-enumeration.txt`؛
- `evidence/audit-20261103/a19-integrity-baseline.txt`؛
- `docs/superpowers/specs/2026-11-03-open-register-items-design.md`؛
- `docs/superpowers/plans/2026-11-03-a19-replayable-migrations.md`.

### 5.3. ریسک‌هایی که باید قبل از Port حل شوند

**ریسک A — Policy Gap**  
الگوی Drop سپس Create می‌تواند در صورت اجرا خارج از تراکنش، پنجرهٔ زمانی بدون Policy بسازد. هر تغییر Policy باید در یک تراکنش اتمیک یا Migration Forward سازگار انجام شود. اجرای Migration در زمان Traffic Production بدون این تضمین ممنوع است.

**ریسک B — تغییر Migration اعمال‌شده**  
پیش از تغییر فایل‌های Migration قدیمی، وضعیت واقعی تمام دیتابیس‌های متصل و جدول `supabase_migrations.schema_migrations` را بررسی کن. اگر Migration قبلاً روی دیتابیس واقعی اعمال شده، فایل اعمال‌شده را بی‌صدا Rewrite نکن؛ یک Migration جدید و Forward-only طراحی کن.

**ریسک C — اجرای ناخواسته روی Production**  
`supabase/tests/run.sh` باید Fail-Closed باشد. فقط `DATABASE_URL` کافی نیست. Guard صریح محیط آزمایش، نام دیتابیس تست، منع استفاده از Secretهای Production و تأیید اجرای مخرب لازم است. در CI از DB موقت ساخته‌شده برای همان Job استفاده شود.

**ریسک D — Snapshot ناقص Policy**  
در نسخهٔ اولیهٔ A19، Snapshot اصلی Policyها `tablename`، `policyname`، `cmd` و `qual` را مقایسه می‌کرد. آن را کامل کن تا حداقل `roles`، `permissive`، `cmd`، `qual` و `with_check` نیز پوشش داده شوند.

**ریسک E — شمارش سادهٔ ردیف‌ها**  
تعداد ردیف به‌تنهایی تغییر محتوا یا جایگزینی IDها را تشخیص نمی‌دهد. برای Seedها علاوه بر Count، Snapshot پایدار شناسه‌های کلیدی/Hash ردیف‌ها یا معیار هم‌ارز اضافه کن.

### 5.4. روش اجرایی A19

1. از آخرین Main یک Branch مستقل بساز.
2. تغییرات A19 را Port کن؛ Branch قدیمی را مستقیم Merge نکن.
3. Migrationهای Policy را از نظر تراکنش و ترتیب اجرا بازطراحی کن.
4. Guard تست دیتابیس را اضافه کن.
5. یک PostgreSQL موقت بساز و تست Fresh Apply، Replay و Integrity را اجرا کن.
6. حالت Red را با کنترل آزمایشی اثبات کن؛ یعنی مطمئن شو Harness در صورت ایجاد Drift واقعاً Fail می‌شود.
7. حالت Green را با DB تازه اثبات کن.
8. شواهد Red/Green و محیط اجرا را ثبت کن.
9. PR جداگانه بساز.
10. تا قبل از Review و CI کامل، هیچ‌کدام از Migrationها را روی Production اجرا نکن.

**نکتهٔ طراحی:** هدف اصلی Migrationهای Production معمولاً اجرای یک‌باره و ثبت‌شده در Migration Ledger است. Replay دو بار یک تست مفید برای Idempotency است، اما جایگزین مدیریت Version و Ledger نیست. روشن کن که Replay در Harness فقط روی DB آزمایشی انجام می‌شود.

---

## 6. اولویت‌بندی اصلاحات Main

کارها را در این ترتیب انجام بده. موارد P0 را به دلیل افزایش قابلیت یا زیبایی UI به تعویق نینداز.

### P0 — Learning Integrity و صداقت خروجی

#### P0.1. خوداظهاری مستقل از تسلط

- منطق Rating را اصلاح کن؛
- وضعیت Mastery، Confidence، FSRS و Evidence را فقط از رویدادهای عملکردی معتبر به‌روز کن؛
- Holdout را فقط با Ticket/Policy سرور و معیار مستقل آزاد کن؛
- تست واحد و Integration و Regression بنویس.

#### P0.2. غیرفعال‌کردن پیش‌بینی غیرمعتبر

- ادعاهای «تضمین»، «احتمال ۹۰٪» و آستانه‌های بدون منبع را حذف کن؛
- مسیر PhD تا زمان اعتبارسنجی مستقل فقط میانگین موضوعی/پیشرفت مهارت را نمایش دهد؛
- برای Master نیز رتبه و دانشگاه فقط با دادهٔ واقعی، کافی و کالیبره‌شده نمایش داده شوند؛
- در نبود شواهد، فقط درصد/سناریوی تمرینی قابل‌محاسبه و مستند نمایش بده؛
- تست کن که تغییر Mode به PhD هیچ Rank/Taraz/Admission/Negative Marking نامعتبر را Render نکند.

#### P0.3. نگاشت دقیق سؤال به فصل

- `referenceChapterId` یا قرارداد معادل را در Contract و Data Model فعلی وارد کن؛
- فصل‌های مبهم را به یک فصل دلخواه نسبت نده؛
- منبع فراوانی و مقطع آزمون را نگه دار؛
- تست چندفصلی و ID نامعتبر بنویس.

#### P0.4. خطای Node نامعتبر

- fallback ناامن به `nodes[0]` را در عملیات حساس حذف کن؛
- خطای صریح، Empty State یا Result قابل‌مدیریت ایجاد کن؛
- State کاربر در ورودی نامعتبر بدون تغییر بماند؛
- تمام Callerها بررسی شوند.

#### P0.5. اصلاح ادعای پوشش

- متن «تضمین پوشش ۱۰۰٪» حذف شود؛
- شاخص پوشش بر اساس دفترچهٔ واقعی، سال، کد، سؤال، کلید، منبع و Mapping گزارش شود؛
- وضعیت‌های `verified`، `pending_review`، `demo`، `synthetic`، `holdout` و `quarantined` قاطی نشوند.

### P1 — پایگاه داده و مهاجرت‌ها

- A19 را طبق بخش ۵ به‌صورت PR مستقل اصلاح کن؛
- Migration Ledger و وضعیت واقعی دیتابیس‌ها را بررسی کن؛
- تغییرات اعمال‌شده را بی‌دلیل Rewrite نکن؛
- RLS، RPC privilege، Trigger، Foreign Key، Check Constraint، Idempotency و Atomicity را دوباره تست کن؛
- Backup/Restore را فقط روی محیط تست انجام بده و Row Count/Checksum را مقایسه کن.

### P2 — معماری و منبع حقیقت Engine

- مسیر مرجع Engine را از روی Decision Log و کد فعلی مشخص کن؛
- هیچ منطق جدید FSRS/Planner را در دو محل مستقل کپی نکن؛
- Adapter قدیمی React را در حد نیاز نگه دار و Parity آن را تست کن؛
- فهرست Callerهای Legacy و مسیرهای حذف را مستند کن؛
- Parity Harness را به سناریوهای مهم Regression گسترش بده؛ ۲۱ سناریوی فعلی را پوشش کامل فرض نکن.

### P3 — امنیت Release و Mini App

- اسکنر Answer Key را حفظ کن؛
- دادهٔ عمومی سؤال را با DTO امن و بدون پاسخ/کلید بساز؛
- Source Map، Static Asset، Manifest، JSON و Bundle را اسکن کن؛
- Worker Mini App و React Legacy را دو مسیر مجزا و با Release Gateهای مستقل مستند کن؛
- هیچ Deploy Production بدون Secrets و Environment واقعی انجام نده.

### P4 — کیفیت محتوا و پوشش آزمون

- دفترچه و اطلاعیهٔ رسمی را به‌عنوان منبع نهایی تعریف کن؛
- برای هر محتوا Source ID، URL، نسخه، تاریخ دسترسی، Hash، صفحه، کد آزمون، سال، مقطع و وضعیت حق استفاده ثبت کن؛
- سؤال رسمی، سؤال تألیفی، نمونه، AI Draft و Holdout را جدا کن؛
- تعداد سؤال را از روی رکورد واقعی محاسبه کن، نه Metadata دستی؛
- کلید پاسخ و Explanation را بازبینی انسانی کن؛
- برای PhD تا زمان دسترسی/تأیید دفترچهٔ رسمی، هیچ ادعای پوشش کامل یا فراوانی فصل منتشر نکن.

### P5 — قابلیت‌های محصول و UX

- مسیر ورود کاربر، انتخاب مقطع/کد/گرایش/تاریخ آزمون و Diagnostic را بررسی کن؛
- UX قطع اینترنت، ادامهٔ جلسه، Retry، Idempotency و Conflict را تست کن؛
- Empty State، خطای API، Loading، Accessibility، RTL و موبایل را بررسی کن؛
- UI و API را با Contract واحد هماهنگ نگه دار؛
- قابلیت غیرعملیاتی را به‌عنوان Production Feature معرفی نکن.

---

## 7. Production Readiness و محدودیت‌های استقرار

در Snapshot اولیه، مستندات Runbook وضعیت زیر را نشان می‌دادند؛ همه را در محیط زنده دوباره بررسی کن:

- Worker روی Cloudflare قبلاً Deploy شده بود و `/api/health` پاسخ ۲۰۰ داده بود؛
- Mini App Asset از Worker سرو می‌شد؛
- تست E2E/rollback drill محدود در Runbook ثبت شده بود؛
- Supabase پایدار و Migrationهای نهایی هنوز در محیط واقعی کامل/تأیید نشده بودند؛
- Worker در حالت بدون Supabase به MemoryStore برمی‌گشت؛
- `ENVIRONMENT=production` و Fail-Closed بودن کامل Demo Auth باید بررسی می‌شد؛
- Telegram Bot Menu و E2E واقعی با Token واقعی کامل نشده بود؛
- Distributed Rate Limit به مجوز Durable Objects وابسته بود؛
- Monitoring و Alerting کامل نبودند؛
- `scripts/telegram-bot-service.mjs` از Long Polling استفاده می‌کند و در شروع Webhook را حذف می‌کند؛ آن را هم‌زمان با Webhook Production اجرا نکن.

### 7.1. Gateهای اجباری Production

Production فقط وقتی `GO` می‌گیرد که همهٔ موارد زیر با شواهد قابل‌بررسی تأیید شده باشند:

1. Database پایدار و واقعی متصل باشد؛
2. Migration Ledger و Schema با نسخهٔ کد منطبق باشند؛
3. `MemoryStore` fallback در Production ممنوع باشد؛
4. `ENVIRONMENT=production` به‌درستی تنظیم شود؛
5. Demo Auth در Production غیرفعال و تست منفی آن سبز باشد؛
6. Session Secret امن و Rotation/Storage آن مستند باشد؛
7. Telegram `secret_token`، Webhook و Admin Token تأیید شوند؛
8. Bot Menu و Mini App در حساب واقعی E2E شوند؛
9. Rate Limit مؤثر، پایدار و متناسب با چند Instance باشد؛
10. Backup، Restore و Rollback تست شده باشد؛
11. Logging و Monitoring و Alert عملیاتی باشند؛
12. Answer Key در هیچ Bundle عمومی وجود نداشته باشد؛
13. مجوز و حق استفاده از محتوا ثبت شده باشد؛
14. Smoke Test و مسیر Rollback ثبت شده باشد.

اگر هر Gate باز است، Release را `NO-GO` گزارش کن؛ به‌جای مخفی‌کردن نقص، آن را با مالک اقدام و Evidence ثبت کن.

---

## 8. ساختار و روش پیشنهادی Branch/PR

### 8.1. نقطهٔ شروع

- آخرین `origin/main` را Fetch کن؛
- SHA را در گزارش ثبت کن؛
- مطمئن شو ZIP با آن سازگار است؛
- اگر Main بعد از Snapshot ممیزی تغییر کرده، تمام تصمیم‌ها را روی Main جدید Rebase ذهنی/فنی کن و از SHA قدیمی Patch کورکورانه نساز.

### 8.2. Branchهای تازه

نام‌ها را ابتدا از نظر وجود بررسی کن. در صورت آزادبودن، پیشنهاد:

```text
fix/learning-integrity-and-predictor-trust-20261104
fix/a19-transactional-migration-replay-20261104
 docs/product-governance-and-acceptance-20261104
```

نام Branch سوم را بدون فاصله بساز؛ شکل صحیح:

```text
docs/product-governance-and-acceptance-20261104
```

هر PR فقط یک خوشهٔ منطقی تغییر داشته باشد. تغییرات Learning Integrity را با Migrationهای دیتابیس در یک PR بزرگ و غیرقابل Review مخلوط نکن.

### 8.3. Merge Policy

- PR باید Base = `main` داشته باشد؛
- Branch از آخرین Main ساخته شده باشد؛
- CI کامل سبز باشد؛
- Review و بررسی Diff انجام شود؛
- Conflictها به‌صورت منطقی حل شوند؛
- Force Push و bypass کردن حفاظت ممنوع باشد؛
- بعد از Merge، SHA Main و CI پس از Merge را دوباره بررسی کن.

اگر GitHub Branch Protection فعال نیست، پیشنهاد فعال‌سازی بده یا با مجوز موجود آن را تنظیم کن. حداقل کنترل‌های پیشنهادی:

- Require PR before merging؛
- Require CI checks؛
- Require conversation resolution؛
- منع Force Push؛
- منع حذف `main`؛
- محدودکردن Push مستقیم.

اگر مجوز تنظیمات Repository را نداری، آن را `BLOCKED` ثبت کن و ادعای فعال‌سازی نکن.

---

## 9. پاک‌سازی PR و Branchها

### 9.1. قبل از بستن PR

برای هر PR:

1. Metadata زنده، Head SHA، Base SHA، وضعیت Draft، Merge State، CI و Reviewها را ذخیره کن؛
2. فایل‌های تغییرکرده را فهرست کن؛
3. Diff را با Main مقایسه کن؛
4. Commitهای منحصربه‌فرد و Patch-IDهای معادل را شناسایی کن؛
5. اگر کار مفیدی خارج از Main مانده، آن را ابتدا به Branch جدید Port کن؛
6. تست‌ها و مستندات منتقل‌شده را در Main تأیید کن؛
7. فقط پس از این مراحل PR قدیمی را ببند و دلیل را در Comment بنویس.

### 9.2. قبل از حذف Branch

- Head SHA و Commitهای اختصاصی را ذخیره کن؛
- اطمینان حاصل کن PR/کار جایگزین‌شده است؛
- برای Branchهای معماری قدیمی Tag آرشیوی Push کن؛
- وجود و دسترسی Tag را دوباره Verify کن؛
- فقط سپس Remote Branch را حذف کن؛
- Local Branch و Remote Tracking Ref را جداگانه پاک کن؛
- `main` و Tagهای آرشیوی را هرگز حذف نکن.

### 9.3. قانون حذف محافظه‌کارانه

اگر کوچک‌ترین تردید دربارهٔ Commit یا فایل منحصربه‌فرد وجود دارد، Branch را حذف نکن. آن را `ARCHIVE_REQUIRED` گزارش کن.

Branchی که PR آن Merged است نیز خودکار قابل حذف نیست؛ ممکن است بعد از آخرین Commit ادغام‌شده Commit اضافه داشته باشد. Head SHA و Diff نهایی را بررسی کن.

---

## 10. دستورات تست و شواهد

ابتدا نسخهٔ Node و npm را با `package.json`، `.nvmrc` و `engines` تطبیق بده. Snapshot اولیه Node 24 را Runtime پشتیبانی‌شده معرفی کرده است.

### 10.1. نصب و بررسی پایه

```bash
node --version
npm --version
npm ci
npm run typecheck
npm test
```

`npm ci` را با `--force` یا `--legacy-peer-deps` سبز نکن، مگر اینکه تصمیم فنی مستند، موقت و مورد تأیید باشد. تعارض Dependency را در `package.json` و Lockfile حل کن.

### 10.2. اعتبارسنجی محتوا و Engine

```bash
npm run validate:content
npx tsx scripts/engine-parity-harness.mts
```

گزارش کن چند سناریو اجرا شده‌اند و دقیقاً چه بخش‌هایی را پوشش می‌دهند. Parity محدود را به «تطابق کامل Engine» تعمیم نده.

### 10.3. Database

```bash
node scripts/db-test-embedded.mjs
```

در صورت وجود PostgreSQL موقت و تنظیم Harness:

```bash
bash supabase/tests/run.sh
```

قواعد:

- قبل از اجرا، `DATABASE_URL` را بدون چاپ Secret، از نظر محیط و نام Database کنترل کن؛
- روی Production یا Staging متصل به کاربر واقعی اجرا نکن؛
- Database اختصاصی `*_test` یا Container موقت بساز؛
- `ON_ERROR_STOP` و Fail-Fast فعال باشد؛
- Fresh Apply، Replay، Integrity و Policy Drift را تست کن؛
- خروجی کامل و Red/Green را در `evidence/` ذخیره کن؛
- پس از تست، Container آزمایشی را پاک کن.

### 10.4. Worker و Mini App Security

```bash
npm run build:worker
npm run audit:miniapp
npm run audit:client-bundle
npx wrangler deploy --dry-run --config apps/worker/wrangler.jsonc
```

Dry Run Deploy استقرار Production محسوب نمی‌شود.

### 10.5. E2E

در یک Terminal:

```bash
npm run dev:miniapp
```

در Terminal دیگر:

```bash
node scripts/e2e-miniapp.mjs
```

پیش‌نیاز Browser/Chrome را بررسی کن. اگر محیط Headless یا Browser موجود نیست، تست E2E را `BLOCKED` گزارش کن؛ از روی Unit Test ادعای E2E نکن.

### 10.6. ساخت React و کنترل انتشار

در صورت نیاز:

```bash
npm run build
```

بعد خروجی واقعی را اسکن کن. اگر Answer Key یا دادهٔ حساس در `dist` هست، انتشار عمومی ممنوع است. شکست Security Audit را با حذف دادهٔ حساس حل کن، نه با تغییر Patternهای اسکنر.

### 10.7. Evidence موردنیاز

در هر PR شواهد زیر را اضافه/به‌روزرسانی کن:

- SHA مبنای Main و SHA نهایی Branch؛
- نسخهٔ Node/npm؛
- دستور و Exit Code هر تست؛
- تعداد تست‌ها و فایل‌های تست؛
- نتیجهٔ Typecheck و Build؛
- خروجی Parity Harness؛
- نتیجهٔ Content Validation؛
- نتیجهٔ DB Fresh Apply/Replay/Integrity؛
- نتیجهٔ Security Audit؛
- نتیجهٔ Wrangler Dry Run؛
- نتیجهٔ E2E، همراه با Scope و Limitation؛
- موارد `BLOCKED` و توضیح دقیق آن‌ها.

---

## 11. بررسی ساختار محتوای آزمون و اعتبار علمی

این بخش را بر مبنای اسناد و داده‌های فعلی ZIP/Main دوباره ممیزی کن. اعداد قدیمی را بدون محاسبه از روی فایل‌ها تکرار نکن.

### 11.1. سلسله‌مراتب منابع

1. دفترچه/اطلاعیهٔ رسمی سازمان سنجش برای همان سال و کد آزمون؛
2. نسخهٔ آینه‌ای از سند رسمی، فقط با ثبت صفحه و Hash و توضیح دلیل استفاده؛
3. بازنشر خبرگزاری از اطلاعیهٔ رسمی، فقط برای اطلاعاتی که در اصل سند قابل‌دسترسی نیست؛
4. کتاب و مقالهٔ علمی برای ساخت ریزسرفصل، نه برای تغییر مواد رسمی آزمون؛
5. وب‌سایت مشاوره‌ای/تجاری صرفاً سرنخ تحقیقاتی است، نه مرجع دادهٔ رسمی.

### 11.2. قواعد استخراج سند

- سند PDF راست‌به‌چپ و جدول‌های ادغام‌شده باید از متن و تصویر صفحه بررسی شوند؛
- در صورت تعارض OCR/متن استخراجی و تصویر، مقدار را `needs_manual_review` نگه دار؛
- کد، مقطع، سال، گرایش، ضرایب، نمرهٔ منفی، تعداد سؤال و زمان آزمون را از هم تفکیک کن؛
- جزئیات تأییدنشده را مقداردهی حدسی نکن؛
- URL، Publisher، تاریخ دسترسی، فایل اصلی، SHA-256، صفحه، روش استخراج، وضعیت حقوقی و Reviewer را ثبت کن.

### 11.3. انواع وضعیت محتوا

حداقل این دسته‌ها را جدا نگه دار:

- `official_verified`؛
- `official_source_pending_content_verification`؛
- `authored_reviewed`؛
- `authored_pending_review`؛
- `ai_draft`؛
- `demo` / `synthetic`؛
- `holdout`؛
- `quarantined`؛
- `rejected`.

محتوای Demo یا AI Draft نباید از مسیر سؤال رسمی به کاربر ارائه شود.

### 11.4. پوشش آزمون

گزارش پوشش باید حداقل این ابعاد را جدا کند:

- مقطع؛
- کد/ترکیب آزمون؛
- سال؛
- درس/ماده؛
- فصل/موضوع/مهارت؛
- تعداد سؤال دفترچه؛
- تعداد سؤال استخراج‌شده؛
- تعداد کلید تأییدشده؛
- تعداد سؤال دارای Mapping؛
- تعداد سؤال دارای منبع/حقوق معتبر؛
- وضعیت بازبینی علمی.

از یک عدد تجمیعی برای ادعای پوشش چند سال/کد استفاده نکن، مگر تعریف و مخرج آن روشن باشد.

### 11.5. کتاب و فصل

- `examCount` فعلی Main بر اساس دادهٔ ارشد کد ۱۱۴۲ گزارش شده است؛ آن را به دکتری تعمیم نده؛
- اگر فراوانی دکتری نداریم، «نامعلوم/تأییدنشده» نشان بده؛
- عنوان «جزوهٔ جامع» نباید این برداشت را ایجاد کند که متن کامل کتاب مرجع ارائه می‌شود؛
- خروجی Markdown، فصل منتخب و نکات/تست‌های تألیفی است، مگر واقعاً متن کامل دارای مجوز و منبع باشد.

---

## 12. طراحی تست‌های Regression برای اصلاحات اصلی

حداقل این Test Matrix را در PR اصلاحات Learning Integrity پیاده‌سازی کن:

| ID | سناریو | انتظار |
|---|---|---|
| LI-01 | Rating=1 | Mastery/FSRS/Evidence بدون تغییر؛ مسیر ترمیم مجاز |
| LI-02 | Rating=2 | Mastery/FSRS/Evidence بدون تغییر؛ مقایسه/ترمیم مجاز |
| LI-03 | Rating=3 | فقط Self-rating و Practice معمولی؛ بدون Proof |
| LI-04 | Rating=4 | بدون Mastery یا Frontier ارتقایافته؛ بدون Proof |
| LI-05 | Rating=5 | بدون Mastery/Proven؛ بدون بازشدن Holdout |
| LI-06 | Remedial قبلی + Rating بالا | کارت تشخیص‌داده‌شده حذف نشود |
| LI-07 | Self-rating تکراری | Mastery و Evidence افزایش نیابد؛ XP/Quest طبق سیاست Idempotent باشد |
| LI-08 | Node ID نامعتبر | خطای صریح؛ State دست‌نخورده؛ هیچ Node دیگری تغییر نکند |
| LI-09 | سؤال دارای `referenceChapterId` معتبر | به همان فصل نسبت داده شود |
| LI-10 | `referenceChapterId` نامعتبر | خطای داده/Unassigned؛ هیچ Fallback خاموشی رخ ندهد |
| LI-11 | سؤال با چند فصل محتمل بدون Reference ID | ابهام آشکار؛ نسبت‌دهی تصادفی انجام نشود |
| LI-12 | دکتری | Rank/Taraz/Admission/Probability مخفی باشد |
| LI-13 | دکتری | What-If و Negative-Marking controls نمایش داده نشوند |
| LI-14 | دکتری | میانگین مهارت بدون ضرایب آزمون واضح باشد |
| LI-15 | ارشد فاقد Calibration معتبر | رتبه/دانشگاه غیرقابل‌کالیبره نمایش داده نشود |
| LI-16 | پوشش محتوایی ناقص | هیچ ادعای ۱۰۰٪ یا تضمین دیده نشود |
| LI-17 | سؤال/کلید پاسخ عمومی | هیچ Answer Key در DTO/Bundle عمومی قرار نگیرد |
| LI-18 | Holdout Forgery | Client نتواند Practice را به Proof ارتقا دهد |

تست‌ها باید روی کد فعلی Main نوشته شوند و نباید صرفاً نسخهٔ قدیمی PR3 را ثابت کنند.

---

## 13. ساختار مستندات و ثبت تصمیم‌ها

پس از اصلاحات، مستندات Main را طوری به‌روز کن که وضعیت واقعی کد و Production را نشان دهند.

حداقل:

- `README.md`: معرفی، نصب، معماری، دستورهای توسعه، North Star، وضعیت واقعی و Release Gate؛
- `docs/audit/BRANCH_AND_PR_AUDIT.md`: جدول PR و Branch، Commit SHA، تصمیم و تاریخ؛
- `docs/audit/REMEDIATION_REGISTER.md`: هر نقص، شدت، Owner، وضعیت، تست و Evidence؛
- `docs/audit/RISK_REGISTER.md`: ریسک باز، احتمال/اثر، Mitigation و شرط بسته‌شدن؛
- `docs/decisions/decision-log.md`: تصمیم معماری/محصول، گزینه‌ها و دلیل؛
- `docs/phase-*/` یا مسیر ساختار فعلی: Acceptance و گزارش شواهد فازها؛
- `docs/deploy/`: Runbook، Rollback و Production Readiness؛
- `evidence/`: خروجی واقعی تست، با تاریخ و Scope.

**قانون:** مستندات نباید از کد جلوتر ادعا کنند. اگر یک قابلیت فقط محلی تست شده، برچسب Local/Scoped بزن. اگر Production نشده، آن را Production معرفی نکن.

---

## 14. ترتیب اجرای پیشنهادی از ابتدا تا انتها

### Phase 0 — Intake و حفاظت

- ZIP را Hash و Extract کن؛
- وضعیت `.git` و فایل‌ها را ثبت کن؛
- آخرین Main و PR/Branchها را از GitHub بخوان؛
- SHA مبنا را ثبت کن؛
- یک Clone/Worktree پاک بساز؛
- هیچ تغییر یا حذف نکن تا Snapshot اولیه کامل شود.

**خروجی:** `docs/audit/INITIAL_SNAPSHOT_20261104.md` یا نام تاریخ واقعی اجرای ایجنت.

### Phase 1 — Reconciliation

- ZIP را با Main مقایسه کن؛
- PR#1/#3/#4 را با Main تطبیق بده؛
- PRهای Merged را فقط برای کشف کارهای باقی‌مانده بررسی کن؛
- Branchها را با Patch-ID و Blob مقایسه کن؛
- کارهای منحصربه‌فرد را در فهرست انتقال قرار بده.

**خروجی:** ماتریس `Present / Missing / Superseded / Conflict / Needs Review`.

### Phase 2 — Learning Integrity و Product Truth

- P0.1 تا P0.5 را انجام بده؛
- تست‌های LI-01 تا LI-18 را اضافه کن؛
- شبیه‌ساز دکتری/ارشد را با داده و Evidence اصلاح کن؛
- Coverage Claim و نگاشت فصل را اصلاح کن؛
- مستندات و Test Evidence را به‌روز کن.

**خروجی:** PR مستقل Learning Integrity.

### Phase 3 — A19 و Database Safety

- Ledger و وضعیت واقعی DB را بررسی کن؛
- A19 را با Transaction/Guard/Policy Snapshot کامل Port کن؛
- تست Fresh Apply، Replay، Integrity و Red/Green را اجرا کن؛
- شواهد DB را ذخیره کن.

**خروجی:** PR مستقل Database Migration Safety.

### Phase 4 — Product Governance و مستندات

- محتوا و ایده‌های مفید PR1 را با Main تطبیق بده؛
- Product Spec، AI Governance، Acceptance Scenarios و Decision Log را حفظ/به‌روز کن؛
- PR4 را پس از تطبیق ببند؛
- PR1 را پس از Port اسناد مفید ببند.

**خروجی:** مستندات هم‌راستا با Main و کد.

### Phase 5 — Full Verification

تمام تست‌های بخش ۱۰ را اجرا کن. اگر تستی قابل‌اجرا نیست، دلیل و Scope را ثبت کن. CI باید از روی PR و سپس Main پس از Merge سبز باشد.

**خروجی:** `docs/audit/FINAL_VERIFICATION_REPORT.md` و Evidenceها.

### Phase 6 — PR، Merge و Clean-up

- PRها را Review کن؛
- فقط PRهای آماده را Merge کن؛
- CI پس از Merge را دوباره بررسی کن؛
- PR#1/#3/#4 را فقط پس از Port و حفظ کارهای منحصربه‌فرد ببند؛
- Branchهای ادغام‌شده را پس از بررسی Commitهای انتهایی حذف کن؛
- Branchهای معماری قدیمی را Tag/Archive و سپس در صورت اطمینان حذف کن؛
- Main و Tagهای آرشیوی را حفظ کن.

**خروجی:** فهرست نهایی Branch/PR، Commit SHA، Merge SHA و Tagهای آرشیوی.

### Phase 7 — Release Readiness

- Release Gateهای بخش ۷ را بررسی کن؛
- اگر DB واقعی، Telegram E2E، Secretها، Monitoring، Backup یا Answer-Key Audit ناقص است، وضعیت `NO-GO` بماند؛
- Deploy واقعی فقط با Secretهای موجود در Secret Manager و مجوز صریح انجام شود؛
- هیچ Secretی را از کاربر در متن عمومی درخواست نکن؛ از اتصال/Secret Store امن استفاده کن.

**خروجی:** `GO` یا `NO-GO` با دلایل و Evidence.

---

## 15. Definition of Done

مأموریت فقط وقتی تمام‌شده محسوب می‌شود که تمام موارد قابل‌انجام زیر تأیید شده باشند:

### Git و تاریخچه

- [ ] ZIP و Main زنده تطبیق داده شده‌اند؛
- [ ] SHA مبنای Main و SHA نهایی ثبت شده‌اند؛
- [ ] همهٔ PRها و Branchهای زنده دوباره بررسی شده‌اند؛
- [ ] هیچ Commit یا فایل مفیدی بی‌ردپا حذف نشده است؛
- [ ] اصلاحات منحصربه‌فرد PR3 روی Main اعمال و تست شده‌اند؛
- [ ] محتوای مفید PR1 در اسناد جاری ادغام شده است؛
- [ ] PR4 پس از تأیید جایگزینی بسته شده است؛
- [ ] A19 بعد از رفع ریسک‌ها در PR مستقل بررسی و در صورت Pass ادغام شده است؛
- [ ] PRهای قدیمی و Branchهای منسوخ با دلیل بسته/آرشیو شده‌اند؛
- [ ] هیچ Force Push انجام نشده است؛
- [ ] Main Protection یا وضعیت محدودیت آن مستند شده است.

### Learning Integrity و محتوا

- [ ] خوداظهاری به‌تنهایی تسلط یا Proof نمی‌سازد؛
- [ ] Holdout فقط از مسیر امن سمت سرور قابل‌استفاده است؛
- [ ] Node ID نامعتبر عملیات اشتباه ایجاد نمی‌کند؛
- [ ] سؤال چندفصلی بدون Evidence به فصل اشتباه نسبت داده نمی‌شود؛
- [ ] Rank/Taraz/Admission بدون Dataset کالیبره‌شده نمایش داده نمی‌شود؛
- [ ] PhD تا زمان اعتبارسنجی رسمی، فقط خروجی مجاز و محدود دارد؛
- [ ] ادعای ۱۰۰٪ پوشش حذف یا مستند شده است؛
- [ ] منشأ، سطح، مجوز و وضعیت Review محتوا روشن است.

### تست و امنیت

- [ ] `npm ci` بدون دور زدن Dependency حل شده است؛
- [ ] Typecheck موفق است؛
- [ ] Unit/Integration Test موفق است؛
- [ ] DB Fresh Apply/Replay/Integrity موفق است؛
- [ ] Engine Parity با Scope مشخص موفق است؛
- [ ] Content Validation موفق است؛
- [ ] Worker Build موفق است؛
- [ ] Mini App و Client Bundle Audit مطابق سیاست موفق‌اند؛
- [ ] Wrangler Dry Run موفق است؛
- [ ] E2E یا اجرا و ثبت شده یا به‌صورت دقیق Blocked گزارش شده است؛
- [ ] GitHub CI پس از Merge روی Main سبز است.

### Production

- [ ] تمام Production Gateها ارزیابی شده‌اند؛
- [ ] اگر هر Gate باز است، وضعیت Release `NO-GO` است؛
- [ ] هیچ Deploy یا تغییر Production بدون مجوز و شواهد انجام نشده است.

---

## 16. قالب گزارش نهایی ایجنت

در پایان گزارش را با این قالب تحویل بده. خلاصهٔ کلی مثل «همه‌چیز درست شد» پذیرفته نیست.

### 16.1. Summary

- تاریخ و زمان اجرا:
- GitHub repository:
- SHA اولیهٔ Main:
- SHA نهایی Main:
- تعداد PR بررسی‌شده:
- تعداد PR Merge‌شده در این مأموریت:
- تعداد PR بسته‌شده بدون Merge:
- تعداد Branch آرشیوشده:
- تعداد Branch حذف‌شده:
- وضعیت نهایی CI:
- Release Readiness: `GO` / `NO-GO`.

### 16.2. تغییرات کد

برای هر تغییر:

| موضوع | فایل‌ها | توضیح | تست | Commit/PR | وضعیت |
|---|---|---|---|---|---|

### 16.3. PR و Branch

| PR/Branch | SHA | اقدام | دلیل | Evidence |
|---|---|---|---|---|

### 16.4. تست‌ها

| دستور | Exit Code | نتیجه | شمار تست/سناریو | Evidence |
|---|---:|---|---:|---|

### 16.5. ریسک‌ها و موانع باز

| ID | ریسک | شدت | اثر | اقدام بعدی | وضعیت |
|---|---|---|---|---|---|

### 16.6. موارد انجام‌نشده

برای هر مورد توضیح بده:

- چه کاری باقی مانده؛
- چرا انجام نشد؛
- آیا ابزار/دسترسی/Secret/تصمیم انسانی لازم دارد؛
- گام دقیق بعدی چیست.

### 16.7. Release Decision

یکی از این دو را انتخاب کن:

- `GO`: فقط اگر تمام Release Gateها با شواهد بسته شده‌اند؛
- `NO-GO`: با فهرست دقیق Blockerها و شواهد.

---

## 17. فرمان پایانی

هدف، «سبزکردن CI به هر قیمت» یا «پاک‌کردن Branchها برای مرتب به‌نظر رسیدن GitHub» نیست.

هدف این است که Main به یک نسخهٔ منسجم، امن، قابل‌تست و صادق از محصول تبدیل شود؛ کارهای مفید Branchهای قدیمی حفظ شوند؛ تغییرات تکراری وارد نشوند؛ ادعاهای علمی/آموزشی بی‌پشتوانه حذف شوند؛ دیتابیس و Release بدون ریسک غیرضروری اداره شوند؛ و وضعیت واقعی محصول و محدودیت‌هایش مستند باشد.

**تا زمانی که همهٔ معیارهای Definition of Done و Release Gate بررسی نشده‌اند، مأموریت را کامل اعلام نکن.**

پیش برو، تصمیم‌های قابل‌برگشت را با Evidence بگیر، کار را به PRهای کوچک و قابل‌Review تقسیم کن، تست کن، ثبت کن و در پایان فقط دربارهٔ کارهایی ادعای موفقیت کن که واقعاً اجرا و تأیید شده‌اند.
