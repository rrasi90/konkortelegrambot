# بررسی مستقیم ویژگی‌ها — ربات/مینی‌اپ

## ✅ کار می‌کنه (تست/کد)
- ورود تلگرام (`initData`) — `index.ts:287`
- ورود دستگاه (`deviceToken`) — `index.ts:313`
- صف + بلیت (`attemptId`) — `index.ts:538`
- پاسخ + درس (`/api/answers`) — `wasCorrect` + `lesson` + `stats`
- کوییز شبانه — `/api/night-quiz` بلیت + پاسخ
- نقشه + mastery — `/api/map` تخت + `mastery`
- درس — `/api/lessons` با `summary`/`tips`/`terms`
- خوداظهاری — `self-report` (فقط غلط)
- قفل زنجیره — ماهانه (`streakFreezeMonth`)
- تنظیمات — tracks + exam
- سکه/روز — `stats`

## ⚠️ نکته دروس
- `renderLessonsList` (app.js خط 692-708) `summary`/`konkoorTips`/`keyTerms` را چاپ می‌کند.
- اگر خالی است → `COURSES_LESSONS` داده ندارد (در `lessons-data.ts` داده کامل هست).
- درس در بازخورد (`feedback`) کامل (`lessonPayload`) کار می‌کند.

## ❌ باقی‌مانده (کوچک)
- `src/` React صرفاً پروژه جداست، ربات از `miniapp/` استفاده می‌کند.
- `vite.config.ts` ESM (`import.meta.url`) اعمال شد.

همه ویژگی‌ها مستقیماً چک و کار می‌کنند.
