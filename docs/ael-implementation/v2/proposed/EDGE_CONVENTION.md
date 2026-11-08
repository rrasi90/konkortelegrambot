# قرارداد یال (EDGE_CONVENTION) — V2-050 — PROPOSED

> PROPOSED؛ تا تأیید مالک/متخصص در relations.jsonl اعمال نمی‌شود.

## رابطه‌ها

| رابطه | جهت | معنی |
|---|---|---|
| prerequisite | source -> target (target پیش‌نیاز source است) | خطا در source، پیش‌نیاز target |
| cross_course | source -> target (مفهوم هم‌ارز در درس/مسیر دیگر) | پل بین‌درسی؛ فقط برای گرایش‌های فعال |

## ویژگی‌های یال

- weight: 0.2 تا 0.6 (isNodeDependency تأیید می‌کند؛ وزن بیرون از این بازه خطا است)
- verification_status: verified / pending / quarantined — pending هرگز به‌عنوان verified خوانده نمی‌شود
- confidence: 0..1 (در relations فعلی 0.85..0.98)
- source_ref: کتاب/منبع — باید وجود داشته باشد؛ بدون source_ref یال پذیرفته نمی‌شود
- دلیل (reason): جمله فارسی توضیح‌دهنده رابطه؛ خالی نباشد

## جهت

- جهت یال در relations.jsonl: source = مبحث خطادار، target = مبحث اثرپذیر. قرارداد مبتنی بر types در packages/contracts/src/index.ts (NodeDependency: source = مبحث خطا، target = مبحث تحت تأثیر).
- prerequisite: target پیش‌نیاز source است (موارد A→B که B پیش‌نیاز A است).
- cross_course: target هم‌ارز source در درس/گرایش دیگر است.

> هر یال نامعتبر (سر گمشده در nodes/skill) پذیرفته نمی‌شود؛ به‌جای خاموش‌سازی، در GRAPH_missing_skills.md ثبت می‌شود.
