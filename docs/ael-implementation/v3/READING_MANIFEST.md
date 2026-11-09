# Reading Manifest — نسخهٔ ۳٫۰

تاریخ: ۲۰۲۶-۱۱-۰۹
شاخهٔ کاری: `feat/ael-multi-exam-platform-20261109`
base SHA: `c4ceddf7eea1d496541c5364d7eac4bddae32d4c` (main)

## سند مبنا

| فایل | وضعیت خواندن | توضیح |
|---|---|---|
| `AEL_Agent_Execution_Prompt_FA_v3.0_MASTER.md` (نسخهٔ بیرونی، ۴۹۷۰ خط) | کامل، از ابتدا تا انتها | متن کامل v2.0 + پیوست تاریخی v1.2 + الحاقیهٔ ۳٫۰. این سند در مخزن commit نشده است؛ فقط منبع دستور است. |

## بخش‌های خوانده‌شده از سند مبنا

1. راهنمای استفاده، تقدم دستورها، اصل معماری غیرقابل مذاکره، قاعدهٔ GitHub-first (خطوط ۱–۳۴)
2. متن کامل نسخهٔ ۲٫۰ — بخش‌های ۰ تا ۱۵ (خطوط ۳۶–۱۳۷۵)
3. پیوست تاریخی A — متن کامل نسخهٔ ۱٫۲ (خطوط ۱۳۷۹–۳۰۰۰) شامل ۷۳ کار V2 و قالب گزارش
4. الحاقیهٔ ۳٫۰ — بخش‌های ۱۶ تا ۳۹ (خطوط ۳۰۰۳–۴۹۷۰): معماری هستهٔ مرکزی، پروتکل GitHub-first، جهان آزمون‌ها، مدل داده، onboarding، سؤال‌ساز، موتور مستقل، ورود داده، تست‌های الزامی، مستندات الزامی، شناسه‌های V3، سطح‌های E0–E9، واژه‌نامه، Execution Card، موج‌های rollout

## اسناد مخزن خوانده‌شده در همین اجرا

| فایل | SHA/وضعیت | نکتهٔ کلیدی |
|---|---|---|
| `docs/ael-implementation/v2/V2_LEDGER.csv` | روی main | ۷۳ ردیف: ۵۷ DONE، ۱۲ PROPOSED_ONLY، ۴ HUMAN_REQUIRED |
| `docs/ael-implementation/v2/V2_EXECUTION_REPORT.md` | روی main | پایان: مسدودها D-05/C-11/C-08 (تاریخ اجرای V2) |
| `docs/audit/BRANCH_MERGE_PLAN.md` | از شاخهٔ consolidation (پیش از مرج) | ۹ شاخه: SUPERSEDED برای ۳ واگرا، حذف بقیه |
| `packages/contracts/src/exam-model.ts` | main | مدل نسخه‌دار آزمون؛ resolver چندهدف |
| `packages/contracts/src/registry.ts` | main | Education Registry |
| `packages/contracts/src/exam-selection.ts` | main | قرارداد انتخاب داوطلب |
| `src/components/OnboardingModal.tsx` | main `9e873d1` | سطح‌محور ۳گامی؛ هنوز `arshad|phd` + ۹ track ثابت |

## پیمان

پیمان بخش ۱٫۴ نسخهٔ ۱٫۲ پذیرفته شد: هیچ فرمان اجرا‌نشده «موفق» گزارش نمی‌شود؛ هیچ فایل نخوانده توصیف نمی‌شود؛ هیچ تأیید انسانی جعل نمی‌شود؛ هر تغییر با شاهد ثبت می‌شود.

قاعدهٔ جهت یال گراف: «source» به «target» وابسته است.
