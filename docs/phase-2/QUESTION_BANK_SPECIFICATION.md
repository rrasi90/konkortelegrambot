# قرارداد بانک سؤالات — Phase 2

> وضعیت: IMPLEMENTED_UNVERIFIED تا اجرای تست‌های این پوشه با شواهد بایگانی‌شده.
> منبع ساخت: `scripts/build-question-bank.mts` — خروجی‌ها در `content/questions/`.
> این بانک فقط دادهٔ **ردیابی‌شده در مخزن** را استاندارد می‌کند؛ هیچ سؤال ساختگی وارد لایهٔ رسمی نشده است.

## ۱. لایه‌ها (tiers) — جداسازی سخت

| پرونده | tier | معنی | وضعیت تأیید |
|---|---|---|---|
| `bank-official_traced_phd.json` | `official_traced_phd` | سؤالات transcription شده از دفترچه‌های دکتری | `transcribed_pending_key_review` — کلید رسمی سنجش در مخزن پیوست نشده؛ پاسخ‌ها بر پایهٔ تحلیل کتاب‌درسان است و تا بازبینی SME «official» نیست |
| `bank-official_traced_arshad.json` | `official_traced_arshad` | سؤالات ارشد با ارجاع به کلید رسمی مندرج در sourceReference | `official_key_cited_in_reference` |
| `bank-quarantine.json` | `quarantine` | سؤالات علامت‌دار «قرنطینه» در دادهٔ مبدأ | `quarantined` — هرگز به کاربر نمایش داده نمی‌شود |

قواعد جداسازی:
- هیچ سؤال ارشد (`ارشد`) در پروندهٔ دکتری و هیچ سؤال دکتری در پروندهٔ ارشد قرار ندارد.
- جایگاه‌های نمایشی `phd-1405-001..003` (سه سؤال placeholder در مستندات قدیمی) **عمداً** در بانک نیستند؛ بانک placeholder تولید نمی‌کند.
- سؤالات طراحی‌شده توسط مؤلف (authored) در یک لایهٔ مستقل `authored` جای می‌گیرند و هرگز tier رسمی نمی‌گیرند؛ در اجرای فعلی چنین سؤالاتی در دادهٔ ردیابی‌شدهٔ موجود علامت‌گذاری نشده‌اند، پس لایهٔ authored خالی است و در گزارش صریح شده است.

## ۲. قرارداد فیلدهای هر آیتم

| فیلد | نوع | قاعده اعتبارسنجی |
|---|---|---|
| `id` | string | یکتا در کل بانک (هر سه پرونده) |
| `tier` | enum | یکی از سه مقدار جدول بالا، مطابق نام پرونده |
| `examLevel` | `دکتری`/`ارشد`/`نامشخص` | با tier هم‌خوان باشد |
| `examYear` | number | سال شمسی برگزاری |
| `bookletCode` | string\|null | فقط کد کنترل **استخراج‌شده از sourceReference** یا نقشهٔ دفترچه‌های ارشد (`YEARLY_KONKOR_BOOKLETS`). برای دکتری تا اثبات منبع، `null` — هرگز کد ارشد به آیتم دکتری نسبت داده نمی‌شود |
| `bookletQuestionNumber` | number\|null | شماره سؤال در دفترچه در صورت ثبت |
| `courseId` | string\|null | نگاشت best-effort بخش→درس `CURRICULUM_MASTER`؛ `null` = بی‌نگاشت (جعل نمی‌شود) |
| `courseSectionId` | string\|null | بخش مبدأ در دادهٔ اپ |
| `sourceNodeId` | string | گره درخت دانش متصل به بانک |
| `sourceReference` | string | برای هر آیتم traced **باید** پر باشد (ارجاع سال + دفترچه/درس) |
| `questionText` | string | متن کامل سؤال |
| `options` | string[] | حداقل ۲ گزینه |
| `correctOption` | number | **شماره‌گذاری صفر-مبنا**؛ `0 ≤ correctOption < options.length` |
| `explanation` | string | تحلیل پاسخ؛ برای آیتم‌های دکتری «تحلیلی» است نه «کلید رسمی تأییدشده» |
| `trapNote` / `expectedTimeMs` | string / number\|null | اختیاری |
| `difficulty` / `cognitiveLevel` | `unclassified` | تا اجرای تحلیل empiric روی دادهٔ پاسخ واقعی (CTR موجود نیست) — طبق پلن، پارامتر روان‌سنجی فرضی ثبت نمی‌شود |
| `questionType` | `official_traced` / `quarantined_unverified` | با tier هم‌خوان باشد |
| `verificationStatus` | enum | مطابق جدول لایه‌ها |
| `reviewStatus` | `not_reviewed` | تا ورود بازبین SME |
| `copyrightStatus` | `pending_review` |until تصمیم مالکیت؛ در `COPYRIGHT_AND_ATTRIBUTION_REGISTER.csv` |

## ۳. قواعد کلیدی که تست‌ها اعمال می‌کنند
`src/tests/questionBank.test.ts` این‌ها را اجرا می‌کند (vitest):
1. یکتایی `id` در سراسر بانک + ثبت تعداد تکراری‌های ادغام‌شده در متادیتا (`mergedDuplicates`) و نبود تعارض محتوایی (`contentConflicts = 0`).
2. جداسازی لایه‌ها: ارشد∉دکتری، دکتری∉ارشد، قرنطینه جدا.
3. نبود `phd-1405-001..003` و هر آیتم با کلمهٔ «placeholder».
4. برای هر آیتم traced: `sourceReference` ناکافی نیست، `options.length ≥ 2`، `correctOption` در بازهٔ صفر-مبنا.
5. آیتم دکتری هیچ `bookletCode` ارشدی ندارد (قاعدهٔ §۱).
6. مجموع آیتم‌های سه پرونده = `counts.total`.

## ۴. خط لولهٔ بازتولید
```
npx tsx scripts/build-question-bank.mts   # ساخت بانک
npm test                                   # اعتبارسنجی قرارداد
```
بانک بازساخت‌پذیر (deterministic به‌جز `generatedAt`) است؛ ویرایش دستی خروجی ممنوع — مبدأ اصلاح، دادهٔ `src/data/` یا خود اسکریپت است.

## ۵. محدودیت‌های صادقانه (BLOCKED ها)
- **تأیید کلید دکتری**: فایل کلید رسمی سنجش برای دفترچه‌های دکتری در مخزن نیست و دریافت PDF رسمی با 403 مسدود است (evidence/phase-1/official-pdf-fetch-attempts.txt) → تمام دکتری‌ها `transcribed_pending_key_review` باقی می‌مانند. (R-005)
- **بازبینی SME انسانی**: انجام نشده → `reviewStatus: not_reviewed`. (BLOCKED)
- **پارامترهای IRT/CTT**: دادهٔ پاسخ دانش‌آموز در مقیاس کافی وجود ندارد؛ هیچ پارامتر فرضی ثبت نشده است. (R-004 مرتبط)
- **مالکیت/کپی‌رایت**: دفترچه‌های سنجش اثر رسمی‌اند؛ نحوهٔ ارجاع/بازنویسی در رجیستر کپی‌رایت ثبت و منتظر تصمیم مالک.
