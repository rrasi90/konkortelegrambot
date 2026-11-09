# V3 Live Baseline — راستی‌آزمایی وضعیت زندهٔ main

تاریخ: ۲۰۲۶-۱۱-۰۹ · شاخه: `feat/ael-multi-exam-platform-20261109` · base: `c4ceddf`

## ۱. وضعیت مخزن

| مورد | شاهد |
|---|---|
| main = origin/main | `c4ceddf` — merge کامل همهٔ شاخه‌ها انجام شده (پیش از شروع این مأموریت، با اجازهٔ صریح مالک در همان گفت‌وگو) |
| شاخه‌های باقی‌مانده | فقط `main` روی local و remote؛ ۱۳ شاخهٔ ادغام‌شده/SUPERSEDED حذف شدند |
| PRها | #14 MERGED، #15 closed (محتوا در merge commit `03cffbf`) |
| migrations | ۲۸ فایل تا `0028_comprehensive_exam_model.sql` |

## ۲. تست و خط پایه

| فرمان | نتیجه |
|---|---|
| `npm run typecheck` | سبز (۰ خطا) |
| `npm test` | ۵۸ فایل، ۶۶۶ تست، همگی سبز |
| `test:db` | اجرا نشد — نیازمند Postgres/Docker محلی؛ NOT_RUN |

## ۳. زیرساخت موجود تأییدشده (reuse نه rebuild)

- `packages/contracts/src/registry.ts` — Education Registry ✓
- `packages/contracts/src/exam-model.ts` — ExamFamily/Event/Version/Set/Combination/Target/Coefficient/SelectionPolicy + resolver چندهدف `resolveCandidatePreparationPlan` ✓
- `packages/contracts/src/academic-foundation.ts` + `content/knowledge/academic-foundation.v1.json` ✓
- `content/knowledge/exam-model.v1.json` — ۳ رویداد، ۲ خانواده، ۳ مجموعه، ۲۵ ماده، ۸۴ هدف ✓
- `supabase/migrations/0027_academic_foundation.sql`, `0028_comprehensive_exam_model.sql` ✓
- موتور: `packages/learning-engine/` + v2 (mastery/planner/scheduler/target-weights/readiness-copy) ✓

## ۴. شکاف‌های تأییدشده در همین snapshot

1. **Onboarding محدود:** `src/components/OnboardingModal.tsx` هنوز `OnboardLevel = 'arshad' | 'phd'` (خط ۱۶) و ۹ گرایش ثابت ارشد (خطوط ۲۹–۳۹) دارد؛ فیلد «مدرک/وضعیت تحصیلی فعلی» مستقل وجود ندارد؛ کارشناسی و سایر خانواده‌ها در انتخاب مقصد نیستند.
2. **Worker بدون جریان سؤال‌ساز:** ۳۶ route در `apps/worker/src/index.ts` — هیچ مسیر draft/submit/review/publish برای سؤال کاربر وجود ندارد.
3. **exam-selection بدون current education:** `PUT /api/exam-selection` فقط `examYear/subGroupId/combinationCode/setCode` می‌گیرد — تفکیک «وضعیت فعلی» از «هدف» روی سرور هم غایب است.
4. **کلید در کلاینت برای بخشی از محتوا:** `src/data/comprehensiveCourseEncyclopedia.ts` حاوی `correctOption` است (استثنای شناخته‌شدهٔ R-036/C-16؛ گیت V2-077 فقط سند است).
5. **EXAM_LEVELS فقط doctorate/master:** `packages/contracts/src/exam-structure.ts` — گسترش کارشناسی نیاز به بررسی مصرف‌کننده دارد (MX-022).
6. **دفترچه/سال جدید:** `exam-model.v1.json` فقط ۱۴۰۵/۱۴۰۶ مدیریت دارد؛ استخراج سایر مجموعه‌ها و سال‌ها نشده (فاز ۳).

## ۵. ادعاهای تاریخی که اکنون معتبرند

- «OnboardingModal گزینهٔ مستقل کارشناسی ندارد» — دوباره تأیید شد با SHA جاری ✓
- «migrationهای 0027/0028 روی main هستند» — تأیید ✓ (برخلاف ادعای قدیمی V2-002 که می‌گفت نیستند؛ آن ادعا در همان زمان اصلاح شد)
- «question model هویت/Appearance/کلید را تفکیک می‌کند» — قرارداد در main هست؛ ممیزی کامل در QST-001/V3-040 ادامه دارد.

## ۶. ثبت عددهای اندازه‌گیری‌شده

| شمارش | مقدار | فرمان |
|---|---|---|
| فایل migration | ۲۸ | `ls supabase/migrations \| wc -l` |
| routeهای worker | ۳۶ | `grep -c "app\.(get|post|put|delete)"` |
| تست | ۶۶۶/۶۶۶ سبز | `npm test` |
| فایل تست | ۵۸ | vitest output |
