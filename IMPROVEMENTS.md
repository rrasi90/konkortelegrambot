# بهبودها و ویژگی‌های جدید — مستند

## ۱. بهبود موتور یادگیری (Engine)
- پیام منتور با تحلیل عمیق بر اساس نوع خطا (`concept_gap`, `prerequisite_failure`, `misread`)
- اضافه کردن `DEFAULT_PREVIOUS_INTERVAL_DAYS = 1` برای جلوگیری از `undefined` در ترمیم
- بهبود بازیابی فاصلهٔ قبلی پس از ترمیم صحیح

## ۲. ویژگی جدید: قفل کردن روز پیوسته (Streak Freeze)
- endpoint: `POST /api/streak/freeze`
- شرایط: حداقل ۳ روز پیوسته، حداکثر ۲ بار در ماه
- دادهٔ جدید: `streakFreezeUsed` در `UserStats`
- پیام بازخورد: «روز پیوسته قفل شد؛ اگر امروز مطالعه نکنی، زنجیره حفظ می‌شود»

## ۳. بهبود FSRS
- تایید `calculateRetrievability` با `stability <= 0`
- مستند کردن `rippleCapacity: 6`
- اضافه‌شدن `previousIntervalDays` initialization برای کارت‌های جدید

## ۴. طراحی گرافیکی و UI (بر اساس تحقیقات وب)
- **Material 3** با تم تاریک (Dark Mode) برای تجربهٔ شبانهٔ مطالعه
- **Glassmorphism** در کارت‌های روزانه: پس‌زمینهٔ شفاف با `backdrop-filter: blur(12px)`
- **RTL فارسی** با فونت Vazirmatn و Inter
- **کارت‌های موج خطا**: رنگ‌بندی بر اساس شدت خطا (قرمز برای `concept_gap`, نارنجی برای `prerequisite_failure`)
- **نقشهٔ تسلط**: نمودار پیوسته با رنگ‌بندی از `unseen` (خاکستری) تا `mastered` (سبز)
- **دکمهٔ اثبات (Proof)**: آیکون هدف `🎯` با انیمیشن درخشان برای فراخوانی توجه
- **کوییز شبانه**: کارت‌های شب با تم `dark purple` برای آرامش و تمرکز
- **سکه و روز پیوسته**: طراحی با `gradient gold` برای انگیزه

## ۵. امنیت و ایزولاسیون
- `FAIL-CLOSED` در محیط پروداکشن تأیید شده
- `idempotency` برای `attemptId` حفظ شده
- RLS کامل برای دسترسی به سؤالات

## ۶. محتوا (Exam Pack)
- بستهٔ واقعی `phd-management-business-v1` با ۱۸ گره، ۱۴ یال، ۲۱ سؤال
- تثبیت نگاشت مهارت‌ها (`skill.mkt.plc.stages` به `q-1403-002` و `skill.sm.portfolio.bcg_ge` به `q-1402-001`)
