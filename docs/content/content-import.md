# درون‌ریزی محتوا (Exam Pack)

## قالب بستهٔ محتوا

مرجع زندهٔ قالب: [`content/examples/demo-pack.json`](../../content/examples/demo-pack.json)

```jsonc
{
  "meta": {
    "name": "pack-name",          // الزامی
    "version": "1.0.0",           // الزامی
    "synthetic": true,            // الزامی برای محتوای ساختگی
    "language": "fa",
    "description": "..."
  },
  "nodes": [
    { "id": "sm.rbv",             // الگو: ^[a-z0-9_.-]{2,60}$
      "track": "common",          // common | business | technology
      "course": "مدیریت استراتژیک پیشرفته",
      "chapter": "دیدگاه‌های استراتژی",
      "topic": "دیدگاه مبتنی بر منابع (بارنی)" }
  ],
  "dependencies": [
    { "source": "mkt.brand",       // مبحث خطادار
      "target": "sm.rbv",          // مبحث اثرپذیر (پیش‌نیاز)
      "relation": "prerequisite",   // prerequisite | cross_course
      "weight": 0.6 }               // ۰٫۲ تا ۰٫۶
  ],
  "questions": [
    { "id": "q-001",
      "nodeId": "sm.rbv",
      "examYear": 1401,
      "text": "…",
      "options": ["گزینهٔ ۱", "گزینهٔ ۲", "گزینهٔ ۳", "گزینهٔ ۴"],
      "correctOption": 0,
      "explanation": "…",
      "trapNote": "…" }
  ]
}
```

## اعتبارسنجی

```bash
npm run validate:content        # روی بستهٔ دمو
node scripts/validate-content.mjs path/to/pack.json
```

بررسی‌ها: یکتایی شناسه‌ها، الگوی شناسهٔ گره، مقدار مجاز track/relation، بازهٔ وزن یال، ارجاع درست سؤال به گره، محدودهٔ `correctOption`، هشدار برای متا و توضیح/دام خالی و گره بدون سؤال.

## درون‌ریزی

```bash
# خروجی SQL (برای اجرای دستی یا CI):
npm run seed:sql                # بستهٔ دمو → supabase/seeds/
node scripts/import-content.mjs pack.json --sql > seed.sql

# درون‌ریزی مستقیم از طریق REST (نیازمند متغیرهای محیطی):
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/import-content.mjs pack.json
```

محرمانگی: کلید نقش سرویس فقط در محیط سرور (worker/CI)؛ هرگز در کلاینت.

## وضعیت پس از درون‌ریزی

- محتوای ساختگی با `verification_status = 'demo'` وارد می‌شود.
- محتوای واقعی با `unverified` وارد می‌شود و تا بازبینی انسانی به صف نمی‌رود. جزئیات: [حاکمیت محتوا](../governance/content-and-ai-governance.md)
