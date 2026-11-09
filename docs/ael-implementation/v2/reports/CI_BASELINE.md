# مبنای CI (V2-03A/اختلاط) — 2026-11-08

## خطای پیش‌موجود غیرمرتبط

- `npm run typecheck` → 7 خطا در فایل‌های untracked قدیمی:
  - scripts/anki-import.mts(22,22) TS18046
  - scripts/tmp-inventory.mts / tmp-inventory2.mts / tmp-inventory6.mts: Cannot find module ../src/data/flashcards*
- این فایل‌ها در `git ls-files` نیستند (untracked)؛ خطا از همین شاخه نیست، از تغییرات مأموریت نیست، و اثرش فقط شکست typecheck است (تست‌ها سبزند).
- اثر بر تغییر فعلی: هیچ‌کدام از ماژول‌های جدید V2 (mastery/planner/…) در لاگ خطا نیستند؛ Tracked code تمیز است.

## خطای محتوایی بستهٔ دکتری

- `npm run validate:learning` → phd-management-expansion: 10 منبع URL خالی (ERR_INVALID_URL) — پیش‌موجود است، نه از تغییرات این مأموریت؛ رفع آن با افزودن URL جعلی ممنوع است.

## سبز بودن CI مجوز ادغام نیست

- ادغام نهایی و حذف شاخه‌ها خارج از مجوز فعلی ماند.
