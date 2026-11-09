# گزارش منشأ (PROVENANCE_REPORT) — V2-022

- تاریخ: 2026-11-08 — ابزار: خواندن packages/learning-engine/src/formative-quiz.ts + scripts/validate-learning-courses.ts

## سیاست فعلی (خوانده‌شده از کد)

- LearningQuestion.origin باید 'authored' و rights باید 'original_ael' باشد (validate-learning-courses.ts سطر 76-77).
- review مجاز: 'pending_sme' یا 'reviewed' (سطر 78). Current data: هر 56 سؤال pending_sme.
- LearningSource.kind فقط 'concept_reference' است (سطر 32).
- projectFormativeQuestion کلید/دلیل گزینه/توضیح را به کلاینت نمی‌دهد (formative-quiz.ts) — کلید در بسته عمومی نیست.

## طبقه‌بندی O1..O7 (قرارداد پیشنهادی V2-023)

| کلاس | تعریف |
|---|---|
| O1 | رسمی از دفترچه سازمان سنجش (official_booklet) |
| O2 | نوشته ایجنت از فایل‌های مالک + تأیید مالک (هنوز هیچ بسته‌ای بدون امضا O2 نیست) |
| O3 | پیش‌فرض/تأییدنشده (همه بسته‌های فعلی O3) |
| O4..O7 | ترجمه/خلاصه مجاز، نمونه آزمایشی، Holdout، قرنطینه — هر کدام Gate جدا |

> تا پاسخ مالک در HUMAN_REQUIRED (C-11)، هر 3 بسته financial-management، statistics-foundations، phd-management-expansion به‌عنوان O3 پیش‌فرض می‌مانند؛ هیچ بسته‌ای به O2 ارتقا نمی‌یابد.

## نردبان L6

- پوشش skills 18/23 (0.783) سقف نردبان را پایین نگه می‌دارد؛ سرف‌فصل‌های بدون مهارت (6 گره) و 5 مهارت بدون سؤال، بازبینی L6 را محدود می‌کند.
- SEC-01/SEC-02: هیچ مدرک SME وجود ندارد (reviewed=0)؛ L6 تا امضای متخصص باز است.

مراجع: proposed/provenance-defaults.json، templates/OWNER_APPROVAL_TEMPLATE.yaml
