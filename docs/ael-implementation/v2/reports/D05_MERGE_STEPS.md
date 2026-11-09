# گام‌های ادغام D-05 (گزینه الف) — V2-03A (2026-11-08)

- استراتژی ادغام مرحله‌ای تأیید شده است.
- آماده‌سازی و اصلاح PRها در دامنهٔ مجاز ادامه یابد.
- پیش از ادغام، نتیجهٔ CI باید روی آخرین SHA همان PR بررسی شود.
- سبزشدن CI به‌تنهایی مجوز ادغام در main نیست؛ نتیجهٔ بررسی و تأیید جداگانهٔ مالک نیز لازم است.
- حذف یا آرشیو شاخه‌ها مجاز نیست.

## base/head واقعی و وابستگی

| PR | head | base | SHA head | SHA base |
|---|---|---|---|---|
| #14 | mission/library-10y-repository-consolidation-20261107 | main | ad728a9fcae59328cfc9650a96eaf2266d0a4734 | 718c54c0f6e301fda3d72ffd2fecb02140b6c1bc |
| #15 | feat/layer1-academic-foundation-20261107 | mission/library-10y-… (خودِ PR14) | bfe41ad38570834644294f085ddd342ebac2e88c | ad728a9fcae59328cfc9650a96eaf2266d0a4734 |

- #15 انباشته است: base آن PR14 است، نه main. تغییرات PR والد به فرزند نسبت داده نشد (PR_OVERLAP.md).

## شکست‌های CI (مشخصات اجرای ناموفق، نه عبارت کلی)

- PR14 — SHA تست‌شده همان head ad728a9؛ جاب Typecheck/Unit در اجرای https://github.com/rrasi90/konkortelegrambot/actions/runs/42391086534/job/128458609704 نتیجه FAILURE، جاب Database Migrations آن در همان اجرا SUCCESS.
- PR15 — SHA تست‌شده همان head bfe41ad؛ جاب Typecheck/Unit در اجرای https://github.com/rrasi90/konkortelegrambot/actions/runs/42417911048/job/128539875086 نتیجه FAILURE، جاب Database Migrations آن در همان اجرا SUCCESS.
- تا سبز بودن همان جاب‌ها در آخرین SHA، ادغام متوقف است.

## گام‌ها (آماده‌سازی، بدون ورود تکراری)

1. **گام 1 — PR14 به main:** diff origin/main..ad728a9 = 64 فایل (+9282/−14376). آزمون ادغام در worktree جدا → Automatic merge went well → PASS. ادغام نهایی منوط به CI سبز روی آخرین SHA + بررسی و تأیید جداگانهٔ مالک.
2. **گام 2 — PR15 به base واقعی (mission):** diff ad728a9..bfe41ad = 24 فایل (+14821/−64). آزمون ادغام در worktree جدا → PASS. ادغام نهایی منوط به شرط بالا.
3. **قاعده جلوگیری از تکرار:** چون #15 روی #14 است، تغییرات مشترک دوبار وارد نشود؛ ابتدا #14 (پس از تأیید) و سپس rebase #15 روی main جدید، بعد آزمون مجدد.

## ثبت‌های اجرایی

- فایل‌های هر گام و آزمون ادغام در بالا آمده؛ هیچ شاخه‌ای حذف/آرشیو نشد؛ هیچ PR جدیدی ساخته نشد.
