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

بدنه: `{ "tracks": ["technology"] }` — هستهٔ مشترک خودکار اضافه می‌شود. مقادیر مجاز: `common`, `business`, `technology`, `strategy`, `industrial`. ورودی تکراری حذف می‌شود و فهرست بیش از ۵۰ عنصر `400` می‌گیرد (ممیزی A-14).

### `GET /api/tracks`

گرایش‌های موجود بر اساس پک‌های نصب‌شده (و `packs`).

### `GET /api/queue?limit=10`

صف امروز: کارت‌های سررسیدشدهٔ گرایش‌های فعال؛ در صورت کمبود، کارت تازه برای سؤال‌های دیده‌نشده ساخته می‌شود.

هر آیتم: `card` (فیلدهای نمایشی: `id`, `nodeId`, `cardType`, `questionId`, `trapCardId`, `isRepair`, `isProof`, و برای کارت `trap_note` همان `trapNote`)، `question` (بدون `correctOption`/`explanation`/`trapNote`)، `course/chapter/topic`، `attemptId`, `attemptType`, `activityType`, `assessmentState`, `masteryEstimate`, `evidenceLevel`, `estimatedMinutes`, `priority`, `courseTitle/chapterTitle`.

> ممیزی A-06: پیش‌تر آیتم با spread کامل `QueueItem` ساخته می‌شد و یادداشت دامِ سؤال‌های تستی و جزئیات داخلی کارت (`ease`, `fsrs`, `timesSeen`, `userId`) پیش از پاسخ به کلاینت می‌رفت. اکنون ساختار فیلدبه‌فیلد است و تست رگرسیون دارد.

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

> ممیزی A-17: `progress.overall` وقتی هیچ گرهٔ سنجیده‌شده‌ای وجود ندارد `null` است (نه ۰) و میانگین فقط روی `assessedNodes` گرفته می‌شود. کلاینت در این حالت «هنوز سنجیده نشده» نمایش می‌دهد.

```json
{
  "user": { "displayName": "…", "activeTracks": ["common", "technology"] },
  "stats": { "coins": 1, "streakDays": 1, "dayNumber": 1, "examDate": "2027-02-19", "daysLeft": 113 },
  "progress": { "overall": 48, "assessedNodes": 6, "nodes": 10 },
  "today": { "answered": 1, "correct": 0 },
  "reviewDue": 4,
  "nightQuiz": { "available": true, "wrongCount": 1 },
  "mentorMessage": "…"
}
```

### `GET /api/night-quiz`

کوییز شبانه: سؤال‌هایی که کاربر امروز غلط جواب داده (ترتیب شانسی، بدون کلید صحیح). پاسخ‌ها از همان `POST /api/answers` با `attemptId` تازه عبور می‌کنند — یعنی ثبت مجدد واقعی است و تسلط را به‌روز می‌کند.

### `PUT /api/settings`

تنظیم تاریخ کنکور: `{ "examDate": "YYYY-MM-DD" }` (یا `null` برای حذف). فرمت نامعتبر ۴۰۰ می‌دهد؛ تاریخِ وجودنداشته مثل `2026-02-30` هم رد می‌شود (ممیزی A-14 — regex تنها کافی نبود و `daysLeft` را NaN/خاموش می‌کرد).

### آمار در پاسخ ثبت

پاسخ `POST /api/answers` حالا `stats` هم دارد: `{ "coins": 3, "streakDays": 1, "dayNumber": 1 }` — سکهٔ زنده برای هدر اپ (پاسخ درست ۲ سکه، غلط ۱ سکه؛ روز پیوسته با تقویم تهران محاسبه می‌شود). این اعداد شاخص یادگیری نیستند و در `/api/analytics/learning` شمرده نمی‌شوند.

> ممیزی A-05: سکه فقط برای **اولین حل درست** هر سؤال در هر روز صادر می‌شود. اثر موتور حافظه (FSRS) روی تکرار مرور همچنان اعمال می‌شود. پاسخ تکراریِ همان `attemptId` با `replay: true` برمی‌گردد و آمار را دوباره افزایش نمی‌دهد؛ اگر بلیت در مسابقهٔ هم‌زمان مصرف شده باشد `409` داده می‌شود (نه `500`).

## Phase 4 — تشخیص، ساختار آزمون و شبیه‌سازی

### `GET /api/diagnostic?count=10`

آزمون تشخیصی (§8.1). `count` بین ۱ و ۲۰ (پیش‌فرض ۱۰). سؤال‌های سال ۱۴۰۴ قرنطینه‌اند. ابتدا گره‌های ارزیابی‌نشده و سپس دیده‌شده‌ها، با تنوع بر حسب درس انتخاب می‌شوند.

- برای هر آیتم بلیت تک‌مصرف `attemptType=diagnostic` صادر می‌شود؛ بدون بلیت، ثبت پاسخ ممکن نیست (fail-closed).
- وضعیت اولیهٔ گرهٔ ارزیابی‌نشده `assessmentState: "unknown"` و `masteryBefore: null` است؛ مقدار پیش‌فرض ۵۰ به‌عنوان سنجش گزارش نمی‌شود.
- اگر هیچ سؤالی در دسترس نباشد: `409`. خطای صدور بلیت: `503`.

پاسخ: `{ items: [{ question, course, chapter, topic, attemptId, attemptType, masteryBefore, assessmentState }], count, meta }` — پاسخ‌ها از همان `POST /api/answers` با `attemptId` آیتم‌ها ثبت می‌شوند.

### `GET /api/exam-selection`

انتخاب فعال کنکور داوطلب (`exam_selections`) یا `null`.

### `PUT /api/exam-selection`

بدنه: `{ "examYear": 1406, "subGroupId": "…", "combinationCode": "…", "setCode": "…" }`.

- `examYear` عدد صحیح ۱۳۹۰–۱۴۲۰؛ `subGroupId` رشتهٔ غیرخالی حداکثر ۶۴ کاراکتر.
- `combinationCode` و `setCode` اختیاری‌اند (رشته/عدد تا ۱۶ کاراکتر)؛ مقدار نامعتبر `400`.
- ذخیره‌سازی و ثبت `audit_logs` انجام می‌شود. دومین ثبت برای همان سال، همان ردیف را به‌روز می‌کند (upsert روی قید `(user_id, exam_year)`؛ ممیزی A-03). پاسخ: `{ ok: true, selection }`.

### `GET /api/exam-structure?level=doctorate&year=1405`

ساختار رسمی آزمون (§8.7). `level` یکی از `doctorate` یا `master`؛ `year` بین ۱۳۹۰ و ۱۴۲۰ (پیش‌فرض آخرین سال مدل‌شده). سطح/سال نامعتبر `400`.

پاسخ شامل `path` (مسیر سطح)، `available`, `structure` (یا `null`), `warnings`, `subGroups`, `combinations` است. اگر شبیه‌سازی سروری آن سطح در دسترس نباشد، `available: false` با `reason` صریح برگردانده می‌شود و ساختار جعلی ساخته نمی‌شود.

### `POST /api/exam-simulation/start`

شروع جلسهٔ شبیه‌سازی رسمی. بدنه: `{ "level": "doctorate", "examYear": 1405, "subGroupId": "…", "combinationCode": "…", "scale": 1 }`.

- `level` نامعتبر `400`؛ سطح بدون شبیه‌سازی سروری `503` با `path`.
- نبود سؤال قابل‌استفاده برای سال/گرایش: `409` همراه `disclosures`.
- برای هر جای پاسخ‌برگ، بلیت `attemptType=exam_simulation` صادر می‌شود؛ خطای بلیت/ذخیره‌سازی `503`.
- پاسخ شامل `session` (ساختار، تخصیص دروس، `coverageRatio`، `negativeMarkingRatio`، `officiality`, `contentOrigins`, زمان شروع/انقضا) و `items` است.
- **کلید پاسخ در پاسخ API نیست**؛ `question` از `toPublicQuestion` می‌آید. درست‌بودن پاسخ تا `submit` اعلام نمی‌شود.
- سؤال‌های غیررسمی هرگز با عنوان آزمون رسمی دکتری ارائه نمی‌شوند؛ `officiality` و `contentOrigins` این مرز را افشا می‌کنند.

### `POST /api/exam-simulation/answer`

بدنه: `{ "sessionId": "…", "attemptId": "…", "questionId": "…", "selectedOption": 2, "responseTimeMs": 45000 }`.

- شناسهٔ جلسه/تلاش/سؤال الزامی و `selectedOption` عدد صحیح؛ وگرنه `400`.
- جلسهٔ ناشناس `404`؛ جلسهٔ غیرفعال یا منقضی `409`؛ بلیت مصرف‌شده/پاسخ تکراری `409`.
- پاسخ همیشه `{ "recorded": true }` است — **درستی پاسخ عمداً اعلام نمی‌شود** (رفتار آزمون رسمی).

### `POST /api/exam-simulation/submit`

بدنه: `{ "sessionId": "…" }`. نمره‌دهی سمت سرور با `scoreExamSession` (نمرهٔ خام/تراز، نمرهٔ منفی، تفکیک دروس، پاسخ‌برگ) انجام می‌شود. ارسال دوبارهٔ جلسهٔ نمره‌دهی‌شده همان گزارش را با `already_scored: true` برمی‌گرداند. جلسهٔ ناشناس `404`؛ برنامهٔ غیرقابل‌بازتولید `500`.

پاسخ: `{ report, answered, total }`.

### `GET /api/exam-simulation/:id`

وضعیت و آیتم‌های جلسه (بدون کلید پاسخ) به‌همراه `report` در صورت نمره‌دهی و `disclosures`. جلسهٔ ناشناس `404`.

## Phase 4 — ماژول زبان و تحلیل یادگیری

### `GET /api/english/skills`

۱۰ مهارت مستقل زبان انگلیسی (§8.8) به‌همراه `prerequisiteIds`, `verification: "proposed_curriculum_pending_sme"`, `nodePresent`, `questionCount` (بدون ۱۴۰۴), `assessed`, `mastery` (فقط با شاهد؛ وگرنه `null`), `evidenceCount`, `coverageStatus`.

پاسخ شامل `skillCount`, `englishQuestionCount`, `assessableSkillCount`, `contentGap` (مهارت‌های بدون سؤال برچسب‌خورده), `operational` (تنها وقتی `contentGap` خالی باشد), `masterySource` و `taxonomy` است. تا تأیید کارشناس موضوع و افزودن محتوا، `taxonomy.status = proposed_curriculum_pending_sme` می‌ماند و شکاف محتوا صریح گزارش می‌شود.

### `GET /api/analytics/learning`

۱۳ شاخص یادگیری مبتنی بر شاهد (§8.10) در `metrics`:

`assessedNodeCount`, `assessableNodeCount`, `diagnosticCoverageRatio`, `masteryDistribution`, `meanMasteryAssessed`, `medianMasteryAssessed`, `recentAccuracy30d`, `recentEvidenceCount30d`, `dueReviewCount`, `meanRetrievability`, `errorTypeDistribution`, `proofCoverage`, `learningVelocity7d`.

- گره‌های دیدنی = هستهٔ مشترک + گرایش‌های فعال؛ سؤال‌های ۱۴۰۴ در هیچ شاخصی شمرده نمی‌شوند.
- شاخص بدون شاهد `null` است (نه صفر و نه ۵۰). `errorTypeDistribution` دارای ۱۰ علت + `unknown` + `none` است.
- `metricCatalog` تعریف/منبع هر ۱۳ شاخص را می‌دهد؛ `excludedVanityMetrics = [login_count, streak_days, xp, coins, session_count]` صریحاً از پاسخ حذف شده‌اند.
- تمرکز شاخص‌ها بر شاهد ذخیره‌شده است: پاسخ‌های ۳۰ روز، `mastery_history` هفت روز، کارت‌های FSRS و وضعیت مهارت‌ها.

## انگیزش و قفل زنجیره

### `POST /api/streak/freeze`

خرید قفل روز پیوسته. حداقل ۳ روز پیوسته لازم است و حداکثر ۲ قفل در هر ماه (تقویم تهران).
پاسخ: `{ ok, streakFreezeGranted, streakFreezeUsed, streakDays, month, message }`.

> ممیزی A-16: `streakFreezeGranted` (خرید) و `streakFreezeUsed` (مصرف) دو شمارندهٔ جدا هستند؛
> با یک شمارنده مشترک، خرید قفل هیچ اثری روی زنجیره نداشت. قفل موجود، **یک** روز جاافتاده
> (فاصلهٔ دقیقاً ۲ روزه بین دو روز مطالعه) را پل می‌زند و آنگاه مصرف ثبت می‌شود؛ فاصله‌های
> بزرگ‌تر با قفل جبران نمی‌شوند.

### `PUT /api/settings`

(بالا) تنظیم تاریخ کنکور.

## کدهای وضعیت

| کد | معنی |
|---|---|
| 200 | موفق |
| 400 | ورودی نامعتبر |
| 401 | نشست نامعتبر یا نبودن توکن |
| 403 | عملیات غیرمجاز (مثل دموی غیرفعال) |
| 404 | سؤال ناشناخته |
