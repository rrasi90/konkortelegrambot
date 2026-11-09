# V3-012 — اسکن شرط‌های خانواده‌محور در هسته

تاریخ: ۲۰۲۶-۱۱-۰۹ · شاخهٔ کاری · لاگ کامل: `docs/ael-implementation/v3/logs/hardcode-scan.txt`

## نتیجهٔ خلاصه

| لایه | وضعیت | شاهد |
|---|---|---|
| `packages/learning-engine/src/` (هستهٔ موتور) | **تمیز** — بدون branch اختصاصی خانواده؛ فقط structural validation عمومی (setCode≠bookletCode) | grep `'business'|'technology'|'public'|examCode ===` → ۰ نتیجهٔ منطقی |
| `packages/contracts/src/exam-model.ts` | تمیز — resolver عمومی | resolver چندهدف بدون نام گرایش |
| `apps/worker/src/index.ts` | یک fallback با TrackIdهای مدیریت (خط ۱۱۵۶: `['common','business',…]`) | خانواده‌محور؛ باید از داده بیاید |
| `src/components/OnboardingModal.tsx` | ۹ گرایش ثابت `ARSHAD_TRACKS` + `OnboardTrack` type ثابت | GAP-001؛ جریان V3-031 |
| `src/data/examStructure.ts` + `LessonsLibraryView.tsx` (MASTER_1142_COEFFICIENTS_TABLE) | mirror legacy ضرایب ۱۱۴۲ در UI | قابل قبول موقتاً به‌عنوان derived؛ باید از exam-model تولید شود |
| `src/data/comprehensiveCourseEncyclopedia.ts` | correctOption در کلاینت | GAP-004 (R-036) |
| `src/tests/exam-analyze.test.ts` | کدها فقط در تست/pairing evidence | مجاز — تست با دادهٔ واقعی |

## اقدام‌ها

1. **مجاز (derived با گیت):** `examStructure.ts` — تا V3-031 روی UI data-driven شود.
2. **باید اصلاح شود (در V3-031):** `ARSHAD_TRACKS` و fallback TrackId در worker — فهرست گرایش از API/کاتالوگ.
3. **باید اصلاح شود (در QST-003/V3-043):** correctOption در باندل کلاینت → server-delivered.
4. **ممنوع در آینده:** افزودن هر `examCode === '...'` جدید — قاعده باید در exam-model JSON یا Adapter ثبت شود.

پatchهای اصلاحی در شاخهٔ کاری این مأموریت (فقط با تست parity) اعمال می‌شوند؛ دادهٔ production دست‌نخورده می‌ماند.
