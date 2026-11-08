# C04 — نقش مخازن ذخیره (V2-038)

- تاریخ: 2026-11-08

| مخزن | نقش | نوشتن | خواندن |
|---|---|---|---|
| Supabase (مسیر سرور) | مرجع پایدار learner state + سؤال (با service_role سمت سرور) | فقط server-side با Idempotency/Audit | Worker و مینی‌اپ |
| Telegram CloudStorage v4 | snapshot قابل بازیابی دانش‌آموز (3 لایه) | React client (اتحادی/موقت) | React |
| LocalStorage | فقط دفترچه اشتباه (موقت) | React client | React |
| MemoryStore | fallback غیرمولد (فقط dev/test) | Worker dev | Worker dev |
| content/knowledge/*.json | محتوای پایه مدیریت (نسخه‌دار) | import pipeline با Gate | Worker/React/offline |
| content/learning-courses/*.json | بسته‌های تألیفی authored_pilot | authoring با validate:learning | Worker/offline |

## نگاشت C-04

- «React از Worker API به‌عنوان فروشگاه دانش‌آموز استفاده نمی‌کند» (R-025 باز) — یعنی snapshot تلگرام و Supabase می‌توانند جدا بمانند.
- «حفظ داده در CloudStorage == ذخیره پایدار نیست» — CloudStorage راه‌حل انتقالی است (PR #8)، نه جایگزین Persistence.
- پرسش: این جدول به "نقش یکتا" نزدیک نیست؛ هر مخزن نقش و چرخه حیات متفاوت دارد.

## نتیجه

- برای پایلوت، مخرج «داده پایدار» یعنی Supabase متصل + CloudStorage فعال + no-MemoryStore در production (SEC7_MEASURED).
