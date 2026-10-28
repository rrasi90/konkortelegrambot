# مرجع API

پایه: `apps/worker` (Hono روی Cloudflare Workers). همهٔ پاسخ‌ها JSON. خطاها: `{ "error": "پیام فارسی" }`.

## احراز هویت

همهٔ مسیرهای `/api/*` (به‌جز auth و health) نیازمند هدر:

```
Authorization: Bearer <session_token>
```

### `POST /api/auth/telegram`

ورود با مینی‌اپ تلگرام. بدنه: `{ "initData": "…" }`. initData سمت سرور با توکن ربات تأیید می‌شود (HMAC + تازگی auth_date). پاسخ: `{ "token": "…", "user": {…} }`

### `POST /api/auth/demo`

ورود نمایشی — فقط وقتی `ALLOW_DEMO_AUTH=true` (برای توسعه). پاسخ مانند بالا.

## مسیرها

### `GET /api/health`

`{ "ok": true }`

### `GET /api/me`

کاربر جاری + گرایش‌های فعال.

### `PUT /api/tracks`

بدنه: `{ "tracks": ["technology"] }` — هستهٔ مشترک خودکار اضافه می‌شود. مقادیر مجاز: `common`, `business`, `technology`.

### `GET /api/queue?limit=10`

صف امروز: کارت‌های سررسیدشدهٔ گرایش‌های فعال؛ در صورت کمبود، کارت تازه برای سؤال‌های دیده‌نشده ساخته می‌شود.

هر آیتم: `card` (وضعیت زمان‌بندی)، `question` (بدون `correctOption` — کلید به کلاینت نمی‌رسد)، `course/chapter/topic`.

### `POST /api/answers`

بدنه:

```json
{ "attemptId": "uuid-یکتا-از-کلاینت", "questionId": "demo-q-001", "selectedOption": 2 }
```

رفتار:
- **idempotent:** تلاش تکراری با همان `attemptId` همان گزارش قبلی را با `replay: true` برمی‌گرداند.
- پاسخ درست‌بودن سمت سرور تعیین می‌شود؛ کلاینت نمی‌تواند نتیجه را جعل کند.

پاسخ:

```json
{
  "correctOption": 0,
  "replay": false,
  "report": {
    "wasCorrect": false,
    "directReset": true,
    "trapCardCreated": true,
    "topicMastery": { "nodeId": "sm.rbv", "before": 50, "after": 37.5, "reason": "direct" },
    "siblingShock": { "cardIds": ["…"], "applied": 2, "deferred": 0 },
    "prerequisiteRepairs": [{ "nodeId": "sm.value_chain", "from": 50, "to": 43.8 }],
    "crossCourseBridges": [{ "nodeId": "tech.absorptive", "from": 50, "to": 45 }],
    "masteryDeltas": [ … ],
    "mentorMessage": "این پاسخ نشون می‌ده …",
    "actions": [ … ]
  }
}
```

### `GET /api/map`

نقشهٔ مسیر: درس‌ها → فصل‌ها → مبحث‌ها با تسلط و وضعیت (فقط گرایش‌های فعال).

### `GET /api/home`

داشبورد خانه (الهام از واژه‌راه): سلام، سکه، روز پیوسته، شمارهٔ روز، شمارش معکوس تا کنکور، پیشرفت کل مسیر، خلاصهٔ امروز، تعداد کارت‌های سررسید، وضعیت کوییز شبانه و پیام منتور.

```json
{
  "user": { "displayName": "…", "activeTracks": ["common", "technology"] },
  "stats": { "coins": 1, "streakDays": 1, "dayNumber": 1, "examDate": "2027-02-19", "daysLeft": 113 },
  "progress": { "overall": 48, "nodes": 10 },
  "today": { "answered": 1, "correct": 0 },
  "reviewDue": 4,
  "nightQuiz": { "available": true, "wrongCount": 1 },
  "mentorMessage": "…"
}
```

### `GET /api/night-quiz`

کوییز شبانه: سؤال‌هایی که کاربر امروز غلط جواب داده (ترتیب شانسی، بدون کلید صحیح). پاسخ‌ها از همان `POST /api/answers` با `attemptId` تازه عبور می‌کنند — یعنی ثبت مجدد واقعی است و تسلط را به‌روز می‌کند.

### `PUT /api/settings`

تنظیم تاریخ کنکور: `{ "examDate": "YYYY-MM-DD" }` (یا `null` برای حذف). فرمت نامعتبر ۴۰۰ می‌دهد.

### آمار در پاسخ ثبت

پاسخ `POST /api/answers` حالا `stats` هم دارد: `{ "coins": 3, "streakDays": 1, "dayNumber": 1 }` — سکهٔ زنده برای هدر اپ (پاسخ درست ۲ سکه، غلط ۱ سکه؛ روز پیوسته با تقویم تهران محاسبه می‌شود).

## کدهای وضعیت

| کد | معنی |
|---|---|
| 200 | موفق |
| 400 | ورودی نامعتبر |
| 401 | نشست نامعتبر یا نبودن توکن |
| 403 | عملیات غیرمجاز (مثل دموی غیرفعال) |
| 404 | سؤال ناشناخته |
