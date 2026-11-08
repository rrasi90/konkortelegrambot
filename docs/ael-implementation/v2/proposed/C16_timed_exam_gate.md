# گیت آزمون زمان‌دار (C16) — V2-077 — PROPOSED

> PROPOSED — تا تأیید مالک/منتخب در exam-simulation اعمال نمی‌شود.

## قانون پیشنهادی

- آزمون زمان‌بندی‌شدهٔ رسمی فقط وقتی «timed» نامیده شود که همه اجزاء رسمی همان سال تأیید شده باشند:
  - counts هر بخش (specialization/language/aptitude) official_verified
  - durationMinutes هر بخش official_verified
  - negativeMarkingRatio official_verified
- در غیر این صورت، شبیه‌ساز بمانید scaled_pool و disclosed؛ هیچ برچسب «دفترچهٔ رسمی» نزند.
- تا زمان دریافت دفترچه 1406، مسیر 1406 هرگز timed محسوب نمی‌شود.

## گیت‌ها (همه باید سبز باشند)

1. structure.verification === official_verified
2. timingVerified === true (plan)
3. coverageRatio !== null
4. همه sectionها poolSize >= target

## کاربرد فعلی

- 1405 بیشترین نزدیکی به این وضعیت را دارد (official_verified برای ساختار، ولی contentOfficiality=scaled_pool باقی) — بنابراین همچنان timed نیست.
- این محافظه‌کاری برای جلوگیری از ادعای دفترچه رسمی بدون محتوای رسمی است.
