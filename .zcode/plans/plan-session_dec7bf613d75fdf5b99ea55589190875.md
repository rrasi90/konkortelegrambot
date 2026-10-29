# سیم‌کشی نسل دوم معماری — ۵ گام جراحی (۸ شکاف تأییدشده)

## یافته‌های ممیزی (تأیید عامل‌های اکتشاف)
همه ۸ شکاف با شماره خط دقیق تأیید شد: `applyAnswer` (index.ts:127–368) هنوز `interval*ease` (خط ۲۲۳) و جریمه `before*0.75` (خط ۲۴۹) دارد؛ `fsrs.ts` (۳۱۴ خط، ۱۴ تست سبز) فقط در خط ۴۶۲ re-export شده و هیچ‌جا صدا زده نمی‌شود؛ store.ts:439 هنوز `rpc/submit_answer_atomic` (۰۰۰۳) را صدا می‌زند نه `submit_answer_secure` (۰۰۰۶)؛ priority-calculations.ts فقط توسط تست خودش import می‌شود؛ /api/answers فقط ۳ فیلد می‌گیرد؛ فیلتر ۱۴۰۴ فقط در index.ts:333 است؛ TRACK_IDS و CHECK دیتابیس هاردکد‌اند؛ lessons-data.ts (۵۹۲ خط) در کد سرور هاردکد است و contracts دو تایپ تکراری ReviewCard (خطوط ۱۳۹ و ۱۷۰) و EngineResult (خطوط ۱۶۰ و ۲۵۸) دارد. نکته جدید: skills.json در ۳ آخرین ورودی drift اسکیما دارد (difficulty اعشاری 0–1 به‌جای 0–100 و سه فیلد جاافتاده).

## گام ۱ — یکپارچه‌سازی موتور (packages/learning-engine + packages/contracts)
1. **contracts/index.ts**: به `AnswerInput` فیلدهای اختیاری `responseTimeMs`, `confidenceRating (1–5)`, `selfReport ('slip'|'didnt_know')` اضافه شود؛ به `Question` فیلد `expectedTimeMs?`؛ به `ReviewCard` فیلد `fsrs?` (stability/difficulty/reps/lapses/...) و `isProof?`؛ `CARD_TYPES` شامل `'comparison_card'` شود.
2. **EngineState** فیلد `skills?: Map<skillId, {nodeId, confusableWith, prerequisites, estimatedMinutes}>` بگیرد (worker از skills.json پر می‌کند).
3. **applyAnswer بازنویسی** (index.ts:127–368):
   - طبقه‌بندی خطا با `classifyErrorType` (fsrs.ts:203) — selfReport کاربر اولویت دارد.
   - زمان‌بندی با `scheduleNextFSRS` (fsrs.ts:112): پاسخ درست → Good/Easy، غلط → Again؛ کارت بدون وضعیت FSRS با `initializeFSRSState` آغاز شود؛ `dueAt` از خروجی FSRS.
   - اگر errorType === 'slip' → لایه‌های ۲/۳/۴ کامل متوقف (بدون sibling shock و بدون هرگونه کسر نمره)؛ پیام منتور ملایم.
   - لایه ۳/۴: حذف کسر فوری تسلط پیش‌نیاز/پل بین‌درسی؛ به‌جای آن خروجی `probeTargets: string[]` (گره‌های نیازمند سؤال تشخیصی) در report — worker برای آن‌ها کارت تشخیصی می‌سازد.
   - اگر errorType === 'concept_gap' و مهارتِ سؤال `confusable_with` دارد → ساخت `comparison_card` (id: `cmp:<userId>:<questionId>`) با زوج مهارت.
   - به‌روزرسانی ۶بعدی با `update6DLearnerSkillState` (fsrs.ts:248)؛ اگر `proficiencyProbability ≥ 0.75` و coverage !== 'proven' → `coverageStatus='needs_proof'` و `report.proofCandidate={nodeId, skillId}`.
   - پیام منتور غلط از لحن حکمی («جا نیفتاده») به لحن شاهدی («این پاسخ یک شاهد است...») تغییر کند (index.ts:426).
4. **تست‌ها**: engine.test.ts (۲۱ تست) متناسب با رفتار جدید به‌روزرسانی + تست‌های جدید (سرکوب موج در slip، ساخت comparison_card، صدور needs_proof). fsrs.test.ts دست‌نخورده.

## گام ۲ — اتصال دیتابیس امن (apps/worker/src/store.ts)
1. `submitAnswerAtomic` (خط ۴۳۹) → تغییر به `rpc/submit_answer_secure` با پارامترهای ۰۰۰۶ (p_user_id, p_attempt_id, p_question_id, p_selected_option, p_ripple_report, p_mastery_updates, p_card_upserts, p_card_inserts)؛ پاسخ jsonb بازگشتی (correctOption سمت سرور) استفاده شود.
2. متد جدید `issueAttemptTickets(userId, items)` → POST به `attempt_tickets` (attempt_type: practice|proof، انقضای ۲ ساعته).
3. متدهای جدید `upsertSkillState` / `getSkillStates` روی `learner_skill_states`؛ MemoryStore نیز معادل درون‌حافظه‌ای پیاده شود.
4. /api/queue پس از ساخت صف برای هر آیتم ticket صادر کند و `attemptId` سرور را در آیتم برگرداند؛ miniapp از همین attemptId استفاده کند.

## گام ۳ — برنامه‌ریز بودجه‌محور (/api/queue)
1. `packages/utils/package.json` با نام `@ael/utils` ساخته شود؛ به dependencies اضافه شود؛ vitest include از الگوی `packages/*/tests/**` خودکار تستش را اجرا می‌کند.
2. `/api/queue` پارامترهای `mode=commute|desk` و `budgetMinutes` بگیرد: اولویت = `calculateExamValue × calculateExpectedBenefit × calculateUrgencyV2 ÷ estimatedMinutes` (از skills.json)؛ سقف بودجه زمانی رعایت شود؛ در حالت commute گره‌های `stats.*` حذف و با کارت‌های مفهومی جایگزین شوند؛ آیتم‌های proof همیشه اول صف.
3. `estimatedMinutes` از `estimated_study_minutes` مهارت (پیش‌فرض ۵).

## گام ۴ — آزمونک اثبات تسلط (Holdout Proof)
در /api/queue: هر گره‌ای که در learner_skill_states وضعیت `needs_proof` دارد، یک سؤال `examYear === 1404` همان گره (قرنطینه) با برچسب `🎯 تست اثبات تسلط (سؤال دیده‌نشده)` و `attemptType:'proof'` وارد صف شود؛ پس از پاسخ درست، `coverageStatus='proven'` ذخیره می‌شود.

## گام ۵ — مینی‌اپ و داینامیک‌سازی (apps/miniapp + worker)
1. **app.js**: ثبت `questionShownAt` در renderCurrent (خط ۳۲۰) و ارسال `responseTimeMs`؛ دو دکمه پس از پاسخ غلط «🤦‍♂️ بی‌دقتی در خواندن سوال / 🧠 نیاز به مرور مفهوم» (ارسال selfReport)؛ استفاده از attemptId سرور؛ toggle حالت مطالعه (مترو/میز) در درخواست صف؛ تب نقشه مسیر به‌جای عدد خام ۶۵٪ برچسب وضعیت + «شواهد: n تست» نشان دهد (از /api/map توسعه‌یافته با coverageStatus و evidenceCount).
2. **index.html**: کارت گرایش سوم «strategy» + toggle حالت مطالعه + ظرف دکمه‌های خوداظهاری.
3. **contracts**: TRACK_IDS += 'strategy'؛ **migration 0007**: `alter table knowledge_nodes drop constraint if exists knowledge_nodes_track_check;`
4. **GET /api/tracks** جدید: فهرست گرایش‌ها از `exam_packs` (با fallback پیش‌فرض).

## گام ۶ — پاکسازی ساختاری (شکاف ۸)
1. **contracts**: حذف تعریف تکراری ReviewCard (خطوط ۱۷۰–۱۸۹) و EngineResult (خطوط ۲۵۸–۲۶۶).
2. **skills.json**: نرمال‌سازی ۳ ورودی آخر (افزودن operational_definition/cognitive_level/estimated_study_minutes، تبدیل difficulty به مقیاس ۰–۱۰۰).
3. **migration 0007_learning_assets**: جدول `learning_assets` (node_prefix, course, chapter, topic, konkoor_weight, summary, tips jsonb, key_terms jsonb) + grants؛ اسکریپت `scripts/import-lessons.mjs` (tsx) برای انتقال COURSES_LESSONS به جدول؛ `/api/lessons` ابتدا از store می‌خواند و در نبود دیتابیس به bundled fallback می‌رود (lessons-data.ts فقط منبع seed می‌ماند).

## ترتیب اجرا و پایداری
1. baseline: `npm install && npm test` (وضعیت فعلی ثبت شود) → گام ۶ (پاکسازی بی‌خطر) → گام ۱ (موتور + تست‌ها) → گام ۲ و ۳ و ۴ (worker) → گام ۵ (miniapp) → `npm run typecheck && npm test` سبز ۱۰۰٪ → commit گام‌به‌گام → `git push origin main`.

## معیار پذیرش
- همهٔ تست‌های Vitest سبز (engine به‌روزشده + fsrs ۱۴تایی + utils + worker)؛ typecheck بدون خطای جدید.
- پاسخ slip دیگر موج ۴لایه و کسر نمره ایجاد نکند؛ پیش‌نیاز دیگر کسر فوری نگیرد (فقط probe).
- learner_skill_states و attempt_tickets واقعاً پر شوند (فراخوانی submit_answer_secure در کد).
- صف روزانه با فرمول ROI و بودجه زمانی و mode چیده شود؛ سؤال ۱۴۰۴ فقط از مسیر proof قابل دسترسی باشد.
- هیچ کلید پاسخی به کلاینت نرود (خروجی از v_public_questions منطق سازگار بماند).