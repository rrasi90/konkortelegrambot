# ARC-01 — تک‌نهادی موتور یادگیری (Single Learning-Engine Runtime)

**شماره اقدام:** R-009 (+ تصمیم R-025 در §5)
**وضعیت:** IN_PROGRESS — PR #6 همگرایی FSRS و PR #7 رتبه‌بندی صف پیش از limit را با CI سبز پوشش داده‌اند؛ مهاجرت کامل مصرف‌کننده‌های React و learner store هنوز انجام نشده است. ادعای «یکپارچه شد» در این سند نمی‌شود.
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
- import‌کنندهٔ مستقیم موتور مشترک `@ael/engine` (5 نقطه):
  `apps/worker/src/index.ts`, `apps/worker/src/skills-data.ts`, `packages/learning-engine/tests/engine.test.ts`, `src/engine/aelEngine.ts` (FSRS adapter), `src/tests/legacyFsrsParity.test.ts`

نتیجهٔ صادقانه: **امروز دو runtime موازی در production‌-مورد-استفاده وجود دارد.** اپ React (سکوی Telegram/مرورگر) از legacy و Worker API از @ael/engine استفاده می‌کند. این سند تصمیم را تثبیت می‌کند، نه نتیجه را.

## ۳) موجودی انحراف‌ها (PARITY MATRIX)

هارنس: `scripts/engine-parity-harness.mts` → خروجی `docs/phase-3/ENGINE_PARITY_MATRIX.csv`

آخرین اجرای CI روی PR #7، head=`382742f2cc57008d5adb30e6e44e40f33c4e23ac`، run=`41431652931`:

```text
PARITY HARNESS: 21 scenarios, 0 diverged, 21 matched
```

تجزیهٔ آزمون‌ها:

1. **FSRS interval/state:** هر ۱۱ سناریو MATCHED است. adapter React برای initialize و transition از توابع canonical در `@ael/engine` استفاده می‌کند.
2. **Retrievability:** هر ۶ سناریو MATCHED است؛ محاسبهٔ بازیابی بر اساس زمان سپری‌شده از آخرین مرور است.
3. **Urgency factor:** هر ۳ سناریوی عددی MATCHED است و term خطر فراموشی در فرمول canonical ضربی است.
4. **Queue ordering:** سناریوی ۲۱ اکنون MATCHED است. `buildDailyQueue` گزینه‌های `includeCard` و `priorityScore` دارد؛ Worker همهٔ کارت‌های سررسیدشدهٔ واجدشرایط را امتیازدهی می‌کند و سپس سقف ۵۰ candidate را اعمال می‌کند. فیلتر حالت commute نیز قبل از limit انجام می‌شود. تست Worker ثابت می‌کند کارت با اولویت بالاتر که قبلاً candidate شمارهٔ ۵۱ بود، از صف نهایی حذف نمی‌شود.

این ۲۱ تطابق فقط همان سناریوهای deterministic تعریف‌شده را پوشش می‌دهد؛ **اثبات یکپارچگی کل برنامه نیست**. ۱۶ مصرف‌کنندهٔ React هنوز در migration backlog هستند و React هنوز به Worker/Supabase learner store مهاجرت نکرده است. گزارش CI: https://github.com/rrasi90/konkortelegrambot/actions/runs/41431652931.

## ۴) مسیر مهاجرت (R-009 → Phase 4/5)

به‌ترتیب، با تست‌های معطوف به هر گام:

1. **R-011 / queue ordering (PR #7):** `buildDailyQueue` اکنون callback امتیاز اولویت و فیلتر candidate می‌پذیرد؛ Worker همان `computePriorityV3` را قبل از محدودیت candidate اعمال می‌کند. تست integration مسیر `/api/queue` این رفتار را تا کارت شمارهٔ ۵۱ پوشش می‌دهد.
2. **FSRS convergence slice (PR #6):** adapter React به توابع canonical متصل شد؛ ۱۱ سناریوی interval/state و ۶ سناریوی retrievability در CI بدون واگرایی‌اند. تست‌های parity در `src/tests/legacyFsrsParity.test.ts` و `scripts/engine-parity-harness.mts` نگهبان این قراردادند.
3. **Phase 5:** ۱۶ فایل import legacy را مرحله‌ای به @ael/engine منتقل کن؛ در پایان، `grep -r "engine/aelEngine"` باید خالی باشد یا فقط به adapterهای نازک migrate-شده اشاره کند.

هارنس فعلی در ۲۱ سناریوی تعریف‌شده انحرافی گزارش نمی‌کند؛ بااین‌حال تا مهاجرت مصرف‌کننده‌های React و اثبات همگرایی store، وضعیت کل معماری «unified» اعلام نمی‌شود.

## ۵) R-025 — تصمیم تک‌فروشگاه (learner store)

**تصمیم:** Supabase از طریق Worker API تنها فروشگاه learner است؛ `MemoryStore` فقط برای تست/CI/توسعهٔ محلی است و نباید در production فعال شود.

شواهد و قیود:

- مسیر واقعی production (`index.ts` → `SupabaseStore`) با بلیت‌های تلاش، RPC امن `submit_answer_secure` و grant‌های محدود روی schema کار می‌کند (شاهد: `evidence/phase-3/ticket-enforcement.txt`, migration 0010).
- `MemoryStore` همان قرارداد `DataStore` را implement می‌کند و برای تست‌های E2E و harness‌های محلی ضروری است؛ این فروشگاه موازی **نه** یک منبع دادهٔ دومی است و **نه** در Worker واقعی فعال می‌شود (ENV flag در production با hardening بررسی شده؛ R-010).
- بنابراین: «حذف MemoryStore» هدف نیست؛ هدف **ممنوعیت استفاده از MemoryStore در production** است. hardening (R-010) این را تضمین می‌کند.

### اصلاح انتقالی PR #8 — پشتیبان React، نه منبع حقیقت دومِ مورد تأیید

- React اکنون snapshot کامل محلی خود را در Telegram CloudStorage v4 نیز پشتیبان می‌گیرد و آن را هنگام شروع، پیش از فعال‌کردن autosave، بازیابی می‌کند.
- این مسیر برای رفع نقص واقعی read/write و جلوگیری از از دست رفتن پیشرفت React در تعویض دستگاه است؛ **تصمیم معماری R-025 را تغییر نمی‌دهد**.
- تا زمانی که React به Worker API مهاجرت نکرده و آزمون برابری state با Supabase اجرا نشده، CloudStorage یک مسیر انتقالی/پشتیبان است و داده‌های React و Worker هنوز می‌توانند از هم جدا باشند.
- دفتر خطا، تم و سایر داده‌های محلی خارج از snapshot این PR هستند.

## ۶) پاک‌سازی مرده (انجام‌شده در این خوشه)

تابع مردهٔ `calculateMasteryDeltaWithInsights` از `apps/worker/src/store.ts` حذف شد (grep هیچ import/usage نشان نمی‌دهد). تأیید پس از حذف:

- `npm run typecheck` → exit 0 (`evidence/phase-3/typecheck-post-deadcode.txt`)
- `npm test` → 145/145 سبز، 12 فایل (`evidence/phase-3/vitest-post-deadcode.txt`)
- `npm run build:worker` → exit 0 (`evidence/phase-3/build-worker-post-deadcode.txt`)

## ۷) آنچه این سند **ادعا نمی‌کند**

- موتور React به‌طور کامل حذف یا یکسان نشده؛ FSRS آن از facade canonical استفاده می‌کند، اما منطق تسلط، ripple، ترتیب صف و مهاجرت state هنوز کامل منتقل نشده‌اند.
- ۲۱ سناریوی فعلی parity همگی MATCHED هستند؛ این عدد پوشش کامل import graph یا state persistence دو کلاینت را ثابت نمی‌کند.
- تصمیم R-025 به معنای حذف `MemoryStore` نیست؛ به معنای ممنوعیت production آن است.
