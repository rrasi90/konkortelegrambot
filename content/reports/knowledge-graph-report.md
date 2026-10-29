# گزارش تحلیل گراف دانش، روابط معنایی و مهارت‌ها (Knowledge Graph Report)

## ۱. ساختار گراف
گراف دانش آزمون دکتری مدیریت در این پروژه بر پایه ۴ لایه سرایت موج خطا طراحی شده است:

```
[خطا در مبحث Target]
       │
       ├─► لایه ۱: بازنشانی مستقیم کارت + ساخت کارت نکته دام تستی
       ├─► لایه ۲: شوک به تسلط گره و فراخوانی کارت‌های هم‌فصل (Sibling Shock)
       ├─► لایه ۳: سرایت به پیش‌نیازها از طریق یال‌های prerequisite (کاهش تسلط با ضریب ۰٫۲ تا ۰٫۶)
       └─► لایه ۴: هشدار به مباحث هم‌ارز از طریق یال‌های cross_course بین دروس مشترک و تخصصی
```

## ۲. مشخصات آماری گراف
- **تعداد گره‌های دانش (`nodes`):** ۱۸
- **تعداد مهارت‌های اتمی (`skills`):** ۱۶
- **تعداد یال‌های وابستگی (`dependencies`):** ۱۴
  - یال‌های پیش‌نیازی (`prerequisite`): ۱۰ یال
  - یال‌های پل بین‌درسی (`cross_course`): ۴ یال
- **میانگین وزن وابستگی:** ۰٫۴۷ (در بازه مجاز ۰٫۲ تا ۰٫۶)
- **روابط قابل خلط (`confusable_with`):** مستندشده در مپینگ مهارت‌ها

## ۳. جدول وابستگی‌های تأییدشده

| گره مبدأ (Source) | گره مقصد (Target) | نوع رابطه | وزن اثر | پشتوانه علمی / کتاب مرجع |
|---|---|:---:|:---:|---|
| `sm.rbv` | `sm.value_chain` | `prerequisite` | ۰٫۵ | بارنی (کسب و حفظ مزیت رقابتی) |
| `sm.dynamic_capabilities` | `sm.rbv` | `prerequisite` | ۰٫۵ | تیس و بارنی (قابلیت‌های پویا) |
| `sm.core_competencies` | `sm.rbv` | `prerequisite` | ۰٫۵ | پراهالاد و همل |
| `stats.anova` | `stats.scales` | `prerequisite` | ۰٫۵ | عادل آذر (آمار و کاربرد آن ۲) |
| `stats.regression` | `stats.scales` | `prerequisite` | ۰٫۵ | عادل آذر (آمار و کاربرد آن ۲) |
| `mb.contingency` | `mb.structure` | `prerequisite` | ۰٫۴ | استفن رابینز (تئوری سازمان) |
| `mkt.brand` | `sm.rbv` | `prerequisite` | ۰٫۶ | کاتلر و کلر |
| `mkt.cobranding` | `mkt.brand` | `prerequisite` | ۰٫۵ | کاتلر و کلر |
| `mkt.plc` | `sm.portfolio` | `prerequisite` | ۰٫۵ | کاتلر و فرد دیوید |
| `inno.ambidextrous` | `mb.structure` | `prerequisite` | ۰٫۵ | شیلینگ و رابینز |
| `sm.value_chain` | `mkt.brand` | `cross_course` | ۰٫۴ | پورتر / کاتلر |
| `sm.portfolio` | `inno.s_curve` | `cross_course` | ۰٫۴ | BCG / منحنی S فاستر |
| `sm.dynamic_capabilities` | `tech.absorptive` | `cross_course` | ۰٫۴۵ | تیس / کوهن و لوینتال |
| `mb.structure` | `inno.ambidextrous` | `cross_course` | ۰٫۴ | رابینز / تاشمن و اورایلی |
