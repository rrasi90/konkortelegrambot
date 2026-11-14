# مهارت‌های نصب‌شدهٔ پروژهٔ AEL

**تاریخ نصب:** ۲۲ آبان ۱۴۰۵ / 2026-11-13
**روش:** دانلود مستقیم فایل‌های متنی از مخازن رسمی؛ بدون اجرای اسکریپت ناشناس.
**وضعیت:** snapshot. برای به‌روزرسانی، SHAهای زیر را عوض کنید و فایل‌ها را دوباره بگیرید.

> این فایل‌ها راهنمای عامل (agent) هستند، نه کد محصول. هیچ‌کدام در باندل مینی‌اپ یا Worker سرو نمی‌شوند.

---

## ۱. `elite-frontend-ux`

| | |
|---|---|
| منبع | <https://gist.github.com/zacdcook/f65fd5057eb84c5109c1fc067c2d303f> |
| نسخه | `0da74866ce5a257213ebe9ca75e8f56bd310bc02` |
| مجوز | در گیت مجوز صریحی ذکر نشده؛ فقط راهنمای طراحی است و بازتوزیع نمی‌شود |
| فایل | `SKILL.md` |

**چه می‌دهد:** قاعدهٔ رنگ ۶۰-۳۰-۱۰، فقط یک اکسنت جسور، مقیاس ۸px، بدنهٔ ≥۱۶px، هدف لمسی ≥۴۴px، یک CTA اصلی در هر viewport، ممنوعیت گرادیان بنفش/آبی روی سفید، ممنوعیت radiusهای ناهمگون، چک‌لیست دسترس‌پذیری و ضدالگوهای موبایل.

**کجا:** فاز ۱ (توکن‌ها)، فاز ۳ (صفحهٔ امروز)، فاز ۸ (QA).

---

## ۲. `persian-writing`

| | |
|---|---|
| منبع | <https://github.com/ali2000hos/persian-writing> |
| نسخه | `75fcdf313fab65d6d205500ca50f9cb52db25783` |
| مجوز | MIT (فونت‌ها و دیکشنری جداگانه، vendoring نشده‌اند) |
| فایل‌ها | `SKILL.md`، `references/writing-style.md`، `references/orthography.md`، `references/html-css.md`، `references/content-structures.md`، `scripts/fa_lint.py`، `scripts/persian_cleanup.py` |

**چه می‌دهد:** تشخیص register (رسمی/اداری/محاوره/علمی)، ۱۸ الگوی «متن هوش مصنوعی»، نیم‌فاصله، ی/ک فارسی، اعداد فارسی، گیومه، هکسره، bidi، RTL در HTML/CSS، پاکسازی و lint.

**کجا:** همهٔ متن‌های UI، پیام‌های خالی/خطا، میکروکپی، فاز ۷ و ۸.

**اجرا:**

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONIOENCODING=utf-8 python .agents/skills/persian-writing/scripts/fa_lint.py --check <file>
PYTHONDONTWRITEBYTECODE=1 PYTHONIOENCODING=utf-8 python .agents/skills/persian-writing/scripts/persian_cleanup.py --edit --in <file> --out <file>
```

**نکته:** `fa_lint.py` روی فایل‌های متنی/Markdown کار می‌کند، نه مستقیماً روی TSX. برای رشته‌های داخل کامپوننت‌ها، چک‌لیست دستی `writing-style.md` و `orthography.md` اعمال می‌شود.

**نصب نشده:** فونت‌های TTF، دیکشنری ۴۵۳ هزار کلمه‌ای و اسکریپت‌های docx/pdf/pptx. این پروژه خروجی Word/PDF تولید نمی‌کند و این حجم لازم نیست.

---

## ۳. `flashcard-reasoning`

| | |
|---|---|
| منبع | <https://github.com/vishnujayvel/flashcard-skill> |
| نسخه | `51971608c2fa0222738917d341a8d383a0026757` |
| مجوز | MIT |
| فایل | `SKILL.md` |

**چه می‌دهد:** سؤال تک‌مفهومی، انواع استدلال/تریدآف/شکست/مقیاس/الگو/قیاس، پاسخ ~۲۰ ثانیه، سقف ۲۵ کارت برای هر مجموعهٔ تولیدی، تعادل دسته‌ها، حداقل ۲۰٪ قیاس، ممنوعیت خلاصه و آموزش مبتدی.

**کجا:** قرارداد محتوای «مرور کتاب» و بازبینی سؤالات درسنامه.

**هشدار:** این مهارت برای محتوای انگلیسی system design نوشته شده. قواعد «کیفیت سؤال» قابل انتقال است؛ نمونه‌ها و دسته‌بندی‌ها باید به مدیریت/کنکور فارسی ترجمه شوند، نه کپی.

---

## ۴. `cognitive-flashcards`

| | |
|---|---|
| منبع | <https://github.com/jalliet/flashcards> |
| نسخه | `cd2d44ca9a000a25da08bedf0d5e22ab26eafce2` |
| مجوز | MIT |
| فایل‌ها | `SKILL.md`، `references/COGNITIVE_LAYERS.md`، `references/ATOMICITY.md` |

**چه می‌دهد:** لایه‌های L1 (یادآوری)، L2 (فهم)، L3 (مرز)، اصل حداقل اطلاعات (Wozniak)، سیاست امتناع برای proof و مثال حل‌شده، چک‌لیست کیفیت کارت.

**کجا:** قرارداد محتوای فلش‌کارت و نمایش برچسب لایه در UI. موتور FSRS موجود دست‌نخورده می‌ماند؛ این مهارت فقط محتوا و نمای مرور را تعریف می‌کند.

**نصب نشده:** گردش‌کارهای Anki/Artifact و قالب‌های React؛ پروژه UI خودش را دارد.

---

## مهارت‌های تکمیلی (قبلی)

| مهارت | نقش |
|---|---|
| `frontend-design` (اسکیل حساب) | جهت هنری، تایپوگرافی، پرهیز از طراحی تکراری |
| [telegram-webapps-skill](https://github.com/yaniv-golan/telegram-webapps-skill) | الگوهای بومی مینی‌اپ، safe-area، BackButton، هدف ۴۴px |
| [Telegram Mini Apps Docs](https://core.telegram.org/bots/webapps) | مرجع رسمی رفتار WebView |

---

## قاعدهٔ استفاده

1. قبل از هر تغییر UI، `docs/design/MINIAPP_REDESIGN_PLAN_FA.md` خوانده شود.
2. برای هر متن فارسی، `persian-writing` و به‌ویژه `orthography.md` اعمال شود.
3. برای هر کارت/مرور، `cognitive-flashcards` و `flashcard-reasoning` با هم.
4. هیچ اسکریپت ناشناسی از این مخازن اجرا نمی‌شود؛ فقط `fa_lint.py` و `persian_cleanup.py` که بازبینی شده‌اند.
