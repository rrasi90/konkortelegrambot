# Question Resolution Log — پاسخ به ابهام‌ها با GitHub-first

قاعده: هر سؤال فنی اول در مخزن جست‌وجو می‌شود؛ فقط پس از آن منبع بیرونی و سپس HUMAN_REQUIRED.

### Q-001 — آیا OnboardingModal نسخهٔ جدیدتری با تفکیک current/target دارد؟
- تاریخ: ۲۰۲۶-۱۱-۰۹
- چرا ایجاد شد: ادعای تاریخی سند (بخش ۲۲٫۳) می‌گفت onboarding فقط arshad/phd دارد؛ باید با وضعیت زنده تأیید می‌شد چون شاخه‌های v2 تازه روی main مرج شده‌اند.
- جست‌وجوهای GitHub: `grep -n "OnboardLevel" src/components/OnboardingModal.tsx`؛ `grep -rn "currentEducation\|educationLevel" src/ apps/`؛ `git log --all -S "currentEducation" --oneline`
- شاهد: `OnboardingModal.tsx:16` — `OnboardLevel = 'arshad' | 'phd'`؛ هیچ فیلدی به نام current education در src/apps یافت نشد.
- پاسخ مستند: نرفته. تفکیک مقطع فعلی/هدف غایب است (GAP-001/002).
- سطح اطمینان: CONFIRMED_IN_REPO
- تصمیم لازم از مالک؟ خیر — اجرای MX-021/V3-031 وظیفهٔ مأموریت است.

### Q-002 — آیا Worker API برای سؤال کاربر دارد؟
- تاریخ: ۲۰۲۶-۱۱-۰۹
- جست‌وجوها: `grep -n "app\.\(get\|post\|put\|delete\)" apps/worker/src/index.ts` (۳۶ route)؛ `grep -rn "draft\|contribut" apps/worker/src/index.ts`
- پاسخ مستند: ندارد. فقط routes quiz/attempt/exam-selection/feedback/webhook است (GAP-003).
- سطح اطمینان: CONFIRMED_IN_REPO

### Q-003 — آیا PR #15 کد Academic Foundation را با خود آورد یا باید بازسازی شود؟
- تاریخ: ۲۰۲۶-۱۱-۰۹
- جست‌وجوها: `git ls-tree main packages/contracts/src/`؛ `git log --oneline main -- packages/contracts/src/exam-model.ts`
- پاسخ مستند: کد روی main است (`c4ceddf`): exam-model.ts، academic-foundation.ts، exam-selection.ts، migrations 0027/0028. ادعای سند (بخش ۲٫۱: «PR بسته ولی فایل‌ها موجود») تأیید شد؛ دلیل بسته‌شدن #15: merge محتوایی مستقیم در همان گفت‌وگو با مالک.
- سطح اطمینان: CONFIRMED_IN_REPO
