# ARC-01 — تک‌نهادی موتور یادگیری (Single Learning-Engine Runtime)

**شماره اقدام:** R-009 (+ تصمیم R-025 در §5)
**وضعیت:** IMPLEMENTED_UNVERIFIED — تصمیم معماری ثبت و شواهد انحراف جمع‌آوری شده است؛ *توحید واقعی هنوز انجام نشده* و به Phase 4 موکول می‌شود. ادعای «یکپارچه شد» در این سند نمی‌شود.
**تاریخ:** 2026-11-01
**شاخه:** `fix/mission-remediation-20261101`

---

## ۱) تصمیم

`@ael/engine` (بستهٔ `packages/learning-engine`) **تنها موتور رسمی (canonical runtime)** محاسبات یادگیری است: FSRS-5، تسلط، اولویت‌بندی صف، و ریپل.

`src/engine/aelEngine.ts` (موتور legacy داخل اپ React) از این پس **status = deprecated migration backlog** است؛ هیچ منطق جدید محاسباتی نباید به آن اضافه شود.

## ۲) شواهد وضعیت فعلی (گراف واقعی imports)

تأیید شده در `evidence/phase-3/parity-harness.txt`:

- فایل‌های import‌کنندهٔ موتور legacy (16 فایل):
  `src/App.tsx`, `src/components/ContentIngestionStudio.tsx`, `src/components/DashboardView.tsx`, `src/components/KonkorScoreSimulatorCard.tsx`, `src/components/LessonsLibraryView.tsx`, `src/components/MasteryVelocityChart.tsx`, `src/components/PlacementModal.tsx`, `src/components/SkillTreeGraph.tsx`, `src/components/StudySessionView.tsx`, `src/components/TelegramBotSimulatorModal.tsx`, `src/components/YearlyKonkorExamView.tsx`, `src/data/konkorRankPredictor.ts`, `src/data/referenceBooksRepo.ts`, `src/tests/lessonRatingEvidence.test.ts`, `src/tests/masteryEvidence.test.ts`, `src/utils/telegramBridge.ts`
- import‌کنندهٔ موتور مشترک `@ael/engine` (3 نقطه):
  `apps/worker/src/index.ts`, `apps/worker/src/skills-data.ts`, `packages/learning-engine/tests/engine.test.ts`

نتیجهٔ صادقانه: **امروز دو runtime موازی در production‌-مورد-استفاده وجود دارد.** اپ React (سکوی Telegram/مرورگر) از legacy و Worker API از @ael/engine استفاده می‌کند. این سند تصمیم را تثبیت می‌کند، نه نتیجه را.

## ۳) موجودی انحراف‌ها (PARITY MATRIX)

هارنس: `scripts/engine-parity-harness.mts` → خروجی `docs/phase-3/ENGINE_PARITY_MATRIX.csv`
نتیجهٔ اجرا (معمول‌شده در `evidence/phase-3/parity-harness.txt`):

```text
PARITY HARNESS: 21 scenarios, 16 diverged, 5 matched
```

سه درز (seam) سنجیده شد:

1. **FSRS interval/state** — legacy یک heuristic ساده (ضرایب ثابت + افت خطی) است؛ `@ael/engine` FSRS-5 واقعی با توان فراموشی و `calculateNextInterval` را پیاده می‌کند. بازه‌ها در تقریباً همهٔ سناریوها واگردان‌اند؛ در lapse واگرایی شدیدتر است.
2. **Retrievability** — legacy از `proxy = min(0.99, 0.88 + 0.01·S)` استفاده می‌کند که **گذشت زمان را نادیده می‌گیرد**؛ `calculateRetrievability` در @ael/engine طبق curve واقعی با elapsed decay می‌کند. برای هر دو S-base، legacy یا ثابت/خوش‌بینانه‌تر است.
3. **Urgency** — سه معنای متفاوت در سه پیاده‌سازی:
   - legacy (React): `1 + (1 − R)` ضربی
   - `packages/utils` UrgencyV2: **افزوده مبتنی بر تأخیر (overdue-based)**
   - `buildDailyQueue` در @ael/engine: **فقط due-based** (هیچ urgency term ندارد)

نتیجهٔ علمی این موجودی: تا پیش از رفع این ۱۶ انحراف، هر ادعای «یکپارچگی محاسباتی» جعل است.

## ۴) مسیر مهاجرت (R-009 → Phase 4/5)

به‌ترتیب، با تست‌های معطوف به هر گام:

1. **Phase 4، R-011 (توحید فرمول اولویت):** UrgencyV2 در `packages/utils` را تنها منبع «امتیاز فوریت» قرار ده؛ `buildDailyQueue` در @ael/engine باید همان تابع را import کند؛ legacy داخل React حذف یا به wrapper از @ael/engine تبدیل شود.
2. **Phase 4 (diagnostic/mastery evidence layer):** خروجی‌های FSRS legacy در `aelEngine.ts` را با توابع @ael/engine جایگزین کن؛ تست‌های پاریتی (fsrs-01..10) را روی نسخهٔ نهایی re-run و target = انحراف صفر قرار بده.
3. **Phase 5:** ۱۶ فایل import legacy را مرحله‌ای به @ael/engine منتقل کن؛ در پایان، `grep -r "engine/aelEngine"` باید خالی باشد یا فقط به adapterهای نازک migrate-شده اشاره کند.

هر فاز با `PARITY HARNESS` و تست‌های unit مشخص اندازه‌گیری می‌شود؛ تا زمانی که ۲۱ سناریو به انحراف صفر (یا مستندسازی‌شدهٔ «عمداً متفاوت») نرسیده باشد، وضعیت «unified» اعلام نمی‌شود.

## ۵) R-025 — تصمیم تک‌فروشگاه (learner store)

**تصمیم:** Supabase از طریق Worker API تنها فروشگاه learner است؛ `MemoryStore` فقط برای تست/CI/توسعهٔ محلی است و نباید در production فعال شود.

شواهد و قیود:

- مسیر واقعی production (`index.ts` → `SupabaseStore`) با بلیت‌های تلاش، RPC امن `submit_answer_secure` و grant‌های محدود روی schema کار می‌کند (شاهد: `evidence/phase-3/ticket-enforcement.txt`, migration 0010).
- `MemoryStore` همان قرارداد `DataStore` را implement می‌کند و برای تست‌های E2E و harness‌های محلی ضروری است؛ این فروشگاه موازی **نه** یک منبع دادهٔ دومی است و **نه** در Worker واقعی فعال می‌شود (ENV flag در production با hardening بررسی شده؛ R-010).
- بنابراین: «حذف MemoryStore» هدف نیست؛ هدف **ممنوعیت استفاده از MemoryStore در production** است. hardening (R-010) این را تضمین می‌کند.

## ۶) پاک‌سازی مرده (انجام‌شده در این خوشه)

تابع مردهٔ `calculateMasteryDeltaWithInsights` از `apps/worker/src/store.ts` حذف شد (grep هیچ import/usage نشان نمی‌دهد). تأیید پس از حذف:

- `npm run typecheck` → exit 0 (`evidence/phase-3/typecheck-post-deadcode.txt`)
- `npm test` → 145/145 سبز، 12 فایل (`evidence/phase-3/vitest-post-deadcode.txt`)
- `npm run build:worker` → exit 0 (`evidence/phase-3/build-worker-post-deadcode.txt`)

## ۷) آنچه این سند **ادعا نمی‌کند**

- موتور React حذف یا یکسان نشده — فقط به‌عنوان deprecated علامت‌گذاری و موجودی انحراف آن تهیه شده است.
- انحراف صفر در parity matrix نیست؛ عدد واقعی ۱۶ انحراف از ۲۱ سناریو است.
- تصمیم R-025 به معنای حذف `MemoryStore` نیست؛ به معنای ممنوعیت production آن است.
