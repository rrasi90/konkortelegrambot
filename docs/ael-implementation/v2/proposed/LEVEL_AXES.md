# محورهای سطح (LEVEL_AXES) — V2-032 — PROPOSED

> این سند پیشنهاد محورهای سطح‌بندی است؛ تا تأیید مالک/متخصص، در کد اعمال نمی‌شود.

## محورها

| محور | مقادیر | کاربرد |
|---|---|---|
| examLevel | doctorate, master | کلید هرگز مشترک نیست؛ هیچ سؤالی بین سطوح مهاجرت نمی‌کند |
| educationLevel | secondary, bachelor, master, phd, free | مسیر آینده دبیرستان/دانشگاه |
| courseLevel | undergraduate_core, graduate_specialized | مثل courses.json |
| bloom | 1..5 (Knowledge..Evaluation) + cognitive_level | مهارت‌ها: difficulty_estimate 0..100 جداست |
| difficulty | basic, applied (بسته) / 0..100 (مهارت) | دو مقیاس متفاوت؛ هرگز یکی نکنید |

## قانون

- هیچ محور سطحی به‌صورت Enum سخت‌گیت در فرانت‌اند تکثیر نمی‌شود؛ منبع: exam-structure.ts + registry.
- «متوسط» فارسی برای دو محور متفاوت استفاده نشود؛ برچسب‌ها کامل نوشته شوند (مثلاً «سطح کارشناسی» در برابر «دشواری پایه»).
