# راهنمای تحویل بهبود یادگیری AEL

این نسخه روی پروژهٔ محلی تحویلی AEL ادامه یافته است. برای آزمون مستقیم، `tools/offline/AEL_OFFLINE.html` را در مرورگر باز کنید. HTML یک فایل مستقل با مسیر مدیریت مالی، تمرین، سنجش شروع، آزمون زمان‌دار، مرور، شواهد تاریخی و خروجی گزارش ایراد است.

برای اجرای Mini App با Worker و دادهٔ آزمایشی، از ریشهٔ پروژه با Node 24 این فرمان‌ها را اجرا کنید.

```sh
npm ci
npm run dev:miniapp
```

نشانی محلی `http://127.0.0.1:8787` است. پس از ورود آزمایشی و انتخاب گرایش، «باز کردن مسیر یادگیری» یا تب «آموزش درس» را انتخاب کنید.

| سند | محتوا |
|---|---|
| [01_PLAN_FA.md](01_PLAN_FA.md) | اولویت، فازها، مسئولیت و معیار پذیرش |
| [02_RESEARCH_FA.md](02_RESEARCH_FA.md) | تحقیق نمونه‌ها و قابلیت‌های منتقل‌شده |
| [03_UI_AND_PATHS_FA.md](03_UI_AND_PATHS_FA.md) | طراحی مسیر، صفحه‌ها، رفتار موبایل و خطا |
| [04_DATA_AND_AGENT_GUIDE_FA.md](04_DATA_AND_AGENT_GUIDE_FA.md) | قرارداد داده و افزودن درس توسط ایجنت |
| [05_TEST_ENGINE_AND_REFERENCES_FA.md](05_TEST_ENGINE_AND_REFERENCES_FA.md) | آزمون، امنیت، کارنامه و رفرنس‌دهی |
| [06_TEN_YEAR_EVIDENCE_FA.md](06_TEN_YEAR_EVIDENCE_FA.md) | روش، شواهد، محدودیت و گام بازبینی |
| [07_FINANCIAL_MANAGEMENT_FA.md](07_FINANCIAL_MANAGEMENT_FA.md) | آموزش مدیریت مالی و نقشهٔ گسترش درس |
| [08_OFFLINE_QA_FA.md](08_OFFLINE_QA_FA.md) | چک‌لیست آزمون دستی و تولید فایل HTML |
| [09_VERIFICATION_FA.md](09_VERIFICATION_FA.md) | نتایج و مرز راستی‌آزمایی |
| [10_EXECUTION_STATUS_FA.md](10_EXECUTION_STATUS_FA.md) | **وضعیت فعلی اجرا (مرجع روزآمد)** |

برای وضعیت کل پروژه، فهرست کارهای باز و تصمیم‌ها، از ریشهٔ مخزن [STATUS_FA.md](../../STATUS_FA.md)، [BACKLOG_FA.md](../../BACKLOG_FA.md) و [DECISIONS_FA.md](../../DECISIONS_FA.md) را ببینید. فهرست منابع و حقوق در [11_SOURCE_INVENTORY_FA.md](11_SOURCE_INVENTORY_FA.md) ثبت شده است.

نسخهٔ نمایشی از سؤال‌های تألیفی مدیریت مالی استفاده می‌کند. پاسخ‌های آن برای اجرای آفلاین داخل همان فایل‌اند و فایل فقط برای آزمون محلی طراحی شده است. مسیر آنلاین پاسخ‌ها را در Worker نگه می‌دارد. بازبینی علمی و حقوق مجموعهٔ تاریخی و آزمون تلگرام واقعی هنوز Gate انتشار عمومی‌اند.
