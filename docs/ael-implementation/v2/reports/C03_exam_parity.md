# C03 — برابری آزمون/سازه (V2-031)

- تاریخ: 2026-11-08
- مقایسه: packages/contracts/src/exam-structure.ts در برابر exam-simulation.ts

## یافته‌ها

1. **مسیر دکتری:** exam-simulation فقط وقتی شبیه‌ساز می‌سازد که getExamPath(level).serverSimulation === 'available' باشد؛ master با content_gap خطای ExamSimulationError می‌دهد. این درست است.
2. **کد مجموعه:** buildExamSessionPlan تأیید می‌کند structure.setCode === path.bookletCode (2162) و در غیر این صورت خطا. courses/mappings با 2164 هرگز به این گیت نمی‌رسند اگر level/codes درست باشد — اما تا C02 اصلاح نشود، داده‌های 2164 مرده‌اند.
3. **تخصیص pooled:** تعداد رسمی هر درس ثبت نشده است؛ تخصیص pooled + افشای صریح (disclosures) انجام می‌شود؛ سهم ساختگی برای هر درس اعمال نمی‌شود.
4. **سطح‌های دیگر:** سؤال‌های ارشد هرگز در جلسه دکتری نمی‌آیند (eligible فیلتر examLevel). correct.
5. **نمره منفی/زمان:** وقتی negativeMarkingRatio یا duration null است، weightedScore/toal null می‌ماند و اعلام می‌شود؛ participant می‌بیند نمره رسمی محاسبه نشده.
6. **کد ترکیب:** اگر combinationCode بدهی، باید به زیرمجموعه نگاشت شده باشد (getCombinationsForSubGroup)؛ در غیر این صورت خطا. زیرمجموعه‌های نیازمند بررسی (needs_check) همچنان قابل انتخاب‌اند اما هشدار verification نشان داده می‌شود.

## مغایرت‌های باقی‌مانده

- ضرایب SUB_GROUP_SUBJECTS (=1) با ضریب رسمی مجموعه (تخصصی 5 در 1405) یکی نیستند؛ getCoefficientTotal عمداً ضریب 5 را به کل بسته اعمال می‌کند، نه به هر درس. C07 این را تفکیک می‌کند.
- پوشش pool: contentOfficiality همواره scaled_pool است؛ هیچ مسیر «official_booklet» وجود ندارد. این صادقانه است.

> نتیجه: Parity ساختاری در گیت‌های اصلی برقرار است؛ مشکل داده‌ای C02 (2164) بیرون از این گیت است و باید در سطح داده تصحیح شود.
