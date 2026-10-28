# سامانه یادگیری تطبیقی کنکور

هسته مستقل از رشته و مقطع است. موتور با توجه به هدف آزمون، زمان، حالت مطالعه و شواهد یادگیری بهترین اقدام بعدی را انتخاب می‌کند و یادگیری با سؤال تازه سنجیده می‌شود.

## اسناد مرجع
- [سند جامع محصول و تصمیم‌های ثبت‌شده](docs/product/complete-product-spec.md)
- [دفتر اجرایی و TODO](docs/roadmap/TODO.md)
- [معماری سامانه](docs/architecture/system-architecture.md)
- [مدل دامنه و داده](docs/architecture/domain-and-data-model.md)
- [قواعد موتور یادگیری](docs/learning/learning-engine.md)
- [حاکمیت محتوا و هوش مصنوعی](docs/governance/content-and-ai-governance.md)
- [قرارداد امنیتی تحویل سؤال](docs/security/content-delivery.md)
- [سناریوهای پذیرش](docs/testing/acceptance-scenarios.md)
- [ثبت تصمیم‌ها](docs/decisions/decision-log.md)
- [آرشیو منابع اصلی گفتگو](docs/source-materials/README.md)
- [طرح بستهٔ آزمون](schemas/exam-pack.schema.json)

## اجرای محلی
نیازمندی پیشنهادی: Node.js 24 و pnpm 10. دستورات: pnpm install، pnpm typecheck، pnpm test، pnpm build. اجرای رابط: pnpm --filter @konkor/miniapp dev. اجرای Worker: pnpm --filter @konkor/api-worker dev.

رازها را در Git یا bundle فرانت‌اند قرار ندهید. API/Mini App فعلی اسکلت‌اند؛ تلگرام واقعی، initData، دیتابیس، FSRS و grading هنوز متصل نیستند. CI سبز، اجرای migration و E2E تأیید نشده‌اند؛ وضعیت در TODO ثبت شده است. main پیش از بررسی موفق ادغام نمی‌شود.
