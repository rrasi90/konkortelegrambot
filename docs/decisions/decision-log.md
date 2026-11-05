# گزارش تصمیم‌ها و پرسش‌های باز

قالب: هر تصمیم با زمینه، انتخاب و عاقبت. تصمیم‌های باز با ❓.

## D1 — فرمول‌های عددی کدام‌اند؟ (متن طرح دو نسخه داشت)

**زمینه:** متن اولیه در یک جا «سقوط ۱۵٪ تسلط فصل» و «نصف‌کردن بی‌قید و شرط کارت‌های هم‌خانواده» گفته بود و در جای دیگر فرمول `M × 0.75` و آستانهٔ ۶۰.

**تصمیم:** فرمول‌های عددیِ بخش ۴ طرح مبناست (۰٫۷۵ و آستانهٔ ۶۰)؛ عدد ۱۵٪ به‌عنوان «سقوط» کنار گذاشته شد چون با فرمول ناسازگار است. همهٔ ثابت‌ها در `EngineConfig` قابل تنظیم‌اند تا با دادهٔ واقعی کالیبره شوند.

**عاقبت:** رفتار سیستم قابل تست و قطعی است؛ عدد ۱۵٪ فقط به‌عنوان سهم رشد (`masteryGain`) باقی ماند.

## D2 — سرایت بازگشتی یا تک‌پرش؟

**تصمیم:** فقط یال‌های مستقیم از مبحث خطادار (تک‌پرش). سرایت زنجیره‌ای در گرافی که چرخه دارد، کل نقشه را جریمه می‌کند و قابل مهار نیست.

**باز:** اگر ضعف مزمن در یک زنجیره دیده شد، اقدام «مسیر ترمیم» به‌صورت صریح و با سقف جدا اضافه شود.

## D3 — پاسخ درست چه موجی دارد؟

**تصمیم:** هیچ. موج فقط برای خطا است؛ پاسخ درست فقط رشد می‌دهد (و کارت ترمیمی را ترمیم می‌کند). جریمه‌کردن موفقیت، انگیزه را نابود می‌کند.

## D4 — چرا TSAL خودمان و نه FSRS/Anki مستقیم؟

**تصمیم:** زمان‌بندی کارت، سبک SM-2 ساده‌شده است. FSRS به رویدادهای تکراری زیاد نیاز دارد و ما برای نسخهٔ اول شواهد کافی نداریم. ساختار کارت‌ها طوری است که مهاجرت به FSRS بعداً ممکن باشد.

## D5 — وضعیت نشست و امنیت

**تصمیم:** توکن نشست = `userId.HMAC(secret, userId)`؛ کلاینت user_id تعیین نمی‌کند. initData تلگرام سمت سرور با HMAC و بررسی تازگی `auth_date` تأیید می‌شود. کلید سرویس Supabase فقط در worker.

## D6 — محتوای نمایشی چگونه برچسب می‌خورد؟

**تصمیم:** `verification_status = 'demo'` برای محتوای ساختگی؛ فقط `verified` و `demo` به صف می‌روند. هیچ محتوای ساختگی‌ای «تأییدشده» خوانده نمی‌شود.

## ❓ پرسش‌های باز

1. **تعریف عملیاتی تسلط:** آیا عدد تسلط باید «احتمال موفقیت در سؤال تازه از این مبحث» باشد؟ فعلاً عدد تجربی است؛ برای ادعای علمی باید کالیبره شود.
2. **سقف بار روزانه:** عدد ثابت (۳۰) یا تابع زمان در دسترس داوطلب؟ جدول `daily_plan` آماده است ولی policy نهایی نشده.
3. **مقیاس گره:** مبحث در فصلِ درس کافی است یا به «مفهوم» ریزتر شود؟ فعلاً مبحث؛ ریزترشدن یعنی یال‌های بیشتر و هزینهٔ نگهداری محتوا.
4. **مالکیت محتوای آزمون:** حقوق استفاده از سؤالات رسمی قبل از انتشار عمومی باید بررسی شود.

---

# ضمیمهٔ مأموریت AEL — ADR-001 تا ADR-012

قالب هر ADR: زمینه / گزینه‌ها / تصمیم / پیامد / امنیت / مهاجرت / وضعیت. این ADRها الزامات ضمیمهٔ A سند `AEL_AGENT_EXECUTION_PLAYBOOK_FA.md` را پوشش می‌دهند.

## ADR-001 — Modular Monolith و مرز ماژول‌ها
**زمینه:** یک Worker واحد (Hono) + Packageهای TS (`@ael/engine`, `@ael/contracts`, `@ael/utils`) + Supabase/Postgres. مقیاس فعلی توجیه میکروسرویس ندارد.
**گزینه‌ها:** (الف) Workerهای جدا برای Admin/Ingestion/Catalog؛ (ب) ماژول‌های مرزبندی‌شده در یک Worker.
**تصمیم:** (ب) Modular Monolith. ماژول‌های ۱۵گانهٔ سند ۵٫۱ به‌صورت پوشه/ماژول جدا در `apps/worker/src/` و Packageهای مشترک، با مرز تایپی از طریق `@ael/contracts`.
**پیامد:** Deploy واحد؛ خطر چرب‌شدن `index.ts` با تست مقیاس‌پذیری نظارت می‌شود؛ جداسازی فقط با اندازه‌گیری واقعی و ADR جدید.
**امنیت:** مرز اعتماد (Admin/Student API، Service Role فقط در Repository) درون همان پروسه صریح نگه داشته می‌شود.
**مهاجرت:** ندارد. **وضعیت:** پذیرفته‌شده.

## ADR-002 — Canonical Education Taxonomy و Versioning
**زمینه:** مقطع/پایه/شاخه/رشته/گرایش/دانشگاه/برنامه باید داده‌محور و نسخه‌دار باشد، نه Enum ثابت کد.
**تصمیم:** جداول `education_*`، `fields_of_study`، `institutions`، `programs(_versions)` با `id` پایدار، `slug`، `aliases`، `effective_from/until`، `status`، `source_ids`. رابطهٔ والد/فرزند با `parent_id`. Enum فقط برای دسته‌های فنی محدود (مثل نوع رابطه).
**پیامد:** افزودن رشته/نظام جدید = داده، نه تغییر کد.
**امنیت:** مقادیر مقرراتی فقط از مسیر Import/پنل با منبع رسمی؛ حدس ممنوع.
**مهاجرت:** جدول جدید، بدون تغییر جداول موجود. **وضعیت:** پذیرفته‌شده.

## ADR-003 — DB-backed Catalog و Offline Snapshot
**زمینه:** `learning-catalog.ts` دو JSON را ثابت Import می‌کند (مشکل A سند).
**تصمیم:** منبع حقیقت Runtime = `PublishedCatalogService` که Release فعال را از DB می‌خواند و به شکل `LearningCourse` پروجکت می‌کند. Import ثابت فقط برای Offline Builder (Snapshot نسخه‌دار از Release منتشرشده) باقی می‌ماند و نامش به `legacy-static-catalog` تغییر می‌کند.
**پیامد:** افزودن درس از پنل بدون Build/Deploy ممکن می‌شود (AT-AEL-18).
**امنیت:** کاتالوگ Student فقط از Release فعال و مجاز می‌خواند؛ Draft هرگز Fallback نمی‌شود.
**مهاجرت:** دو بستهٔ فعلی به‌عنوان Seed اولین Release وارد DB می‌شوند (AEL-312). **وضعیت:** پذیرفته‌شده.

## ADR-004 — Source Rights و AI Processing Gate
**زمینه:** حقوق برای هر نوع مصرف جدا است؛ مجوز ارجاع ≠ مجوز بازنشر/ارسال به AI.
**تصمیم:** `source_rights_decisions` با `use_type` مستقل (metadata/internal_extraction/derived/display/offline/external_ai/…)، `status` شامل `unknown`، Fail-closed: حقوق `unknown`/`pending` = عدم نمایش، عدم ارسال به LLM، عدم انتشار. تصمیم حقوقی فقط انسان (HUMAN_REQUIRED).
**پیامد:** مسیر AI بدون تصمیم مالک هرگز فعال نمی‌شود (Provider پشت Interface، خاموش).
**وضعیت:** پذیرفته‌شده.

## ADR-005 — OCR/LLM Provider Abstraction و Async Jobs
**تصمیم:** Interface `OcrProvider`/`AiProvider` با پیاده‌سازی `manual`/`local` پیش‌فرض؛ Provider پولی فقط با تأیید مالک. کار سنگین در Job غیرهم‌زمان (`ingestion_jobs`)، نه در درخواست Worker؛ Lease/Heartbeat/Retry/Dead-letter طبق سند ۹٫۳.
**وضعیت:** پذیرفته‌شده.

## ADR-006 — Content Versioning و Immutable Releases
**تصمیم:** هر تغییر معنایی محتوا = `content_versions` جدید؛ Release = مجموعهٔ immutable از Version IDها + `content_hash`؛ Publish پس از Checklist؛ Rollback فقط جابه‌جایی Active Pointer؛ تاریخچه حذف/بازنویسی نمی‌شود.
**وضعیت:** پذیرفته‌شده.

## ADR-007 — Admin RBAC و Separation of Duties
**زمینه:** فقط `ADMIN_API_TOKEN` وجود دارد (مشکل D).
**تصمیم:** جدول‌های `admin_users/roles/permissions/role_assignments` + Permission به شکل `resource:action` + Scope. Default Deny سمت سرور. Author نمی‌تواند خودش را تأیید کند؛ Rights Reviewer مستقل از Scientific؛ Publisher بدون هر دو Gate نمی‌تواند Publish کند. `ADMIN_API_TOKEN` فقط برای Bootstrap نقش `OWNER` اول.
**وضعیت:** پذیرفته‌شده.

## ADR-008 — Coverage Denominators و Officiality Labels
**تصمیم:** هر نسبت شامل `numerator/denominator/scope/source_version/computed_at` است؛ مخرج نامعلوم ⇒ `denominator: 'unknown'` و بدون درصد. برچسب رسمی/تألیفی/مشتق فیلد مجزای صریح است.
**وضعیت:** پذیرفته‌شده.

## ADR-009 — Migration از Static JSON و Legacy Catalog
**تصمیم:** مسیر Expand → Migrate → Verify → Contract. Snapshots/Checksum از داده‌های فعلی (`question-index.json`، بانک‌ها، دو درس) قبل از انتقال؛ هر رکورد `migrated|merged_duplicate|quarantined|skipped_with_reason`؛ هیچ ID بازیافت نمی‌شود؛ مهاجرت Idempotent و تمرین‌شده روی DB آزمایشی.
**وضعیت:** پذیرفته‌شده.

## ADR-010 — Learning Evidence، FSRS و Exam Session Pinning
**تصمیم:** انواع شواهد (study/practice/diagnostic/exam/self-rating/transfer/proof) در `answer_events.evidence_type` جدا می‌مانند؛ Self-rating به‌تنهایی تسلط را ارتقا نمی‌دهد. Engine مرجع محاسبهٔ Skill/Mastery است (SQL الگوریتم دوم نمی‌سازد). نشست آزمون/تمرین به Question Version + Release Version + Rule Version Pin می‌شود و Publish تازه، نشست قدیمی را نمی‌شکند.
**وضعیت:** پذیرفته‌شده.

## ADR-011 — Durable Idempotency و Answer Event Transaction
**زمینه:** `operationFingerprints` فقط در حافظهٔ Isolate است (مشکل C).
**تصمیم:** `operationId` با UNIQUE در `answer_events` + RPC اتمیک سمت DB؛ تکرار همان opId+payload همان نتیجهٔ قبلی را می‌دهد؛ opId+payload متفاوت = Conflict؛ خطای میانهٔ تراکنش = rollback کامل. حافظهٔ Isolate فقط بهینه‌سازی است، نه مرجع حقیقت.
**وضعیت:** پذیرفته‌شده.

## ADR-012 — Storage، Backup، Retention و Restore
**تصمیم:** فایل‌های منبع خصوصی با Hash و Access مستند (Policy واقعی Object Storage در AEL-802 اثبات می‌شود)؛ حذف فایل فقط با Audit و حفظ Metadata. تا اثبات Restore واقعی (AT-AEL-30)، Production انتشار عمومی نمی‌گیرد.
**وضعیت:** پذیرفته‌شده (در انتظار اثبات عملیاتی).
