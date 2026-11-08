# بسته‌های بازبینی REV-01 (V2-112) — آماده‌سازی کامل

- وضعیت: هر 56 سؤال در سه بسته pending_sme. تأیید علمی تا امضای متخصص باز است. امضا ساخته نشد.

## بسته مالی (financial-management: 24 سؤال)

- نمونه: fm.ratios.q01 در fm.ratios → topicId financial-management، source os.finance.ratios (OpenStax Principles of Finance).
- وضعیت هر سؤال (24 مورد): متن/پاسخ/توضیح در JSON موجود است؛ نگاشت topicId موجود؛ منبع عمومی ثبت شده.
- ابهام: محاسبات اعتبارسنج نشده علمی؛ نیازمند متخصص مالی.
- فرم پذیرش/اصلاح/رد: templates/OWNER_APPROVAL_TEMPLATE.yaml + فرم اصلاح/رد در review-batches/README.md (رد = quarantined، بدون ادعای verified).

## بسته آمار (statistics-foundations: 5 سؤال)

- شامل 1 تسکر با rubric (essay) + 4 MCQ؛ rubric موجود است.
- مبنا: nist.stat.* (NIST Handbook).
- ابهام: تفسیر p-value/شرایط تومان؛ نیازمند متخصص آمار.

## بسته دکتری (phd-management-expansion: 27 سؤال)

- شامل 12 مبحث؛ منابع DOI/کتابی؛ 10 منبع URL خالی (نقص validate) — پیش از ارسال به متخصص باید URLها تکمیل یا «منبع نامشخص» ثبت شود.

## اقدام‌های آماده‌سازی (غیر از امضا)

- رفع ساختاری: تکمیل URLهای خالی phd pack (بدون جعل منبع)؛ سپس بسته‌بندی مجدد.
- فرم پذیرش/اصلاح/رد استاندارد موجود است.

مرجع: reports/review-batches/README.md، C11_ORIGIN_MAP.md
