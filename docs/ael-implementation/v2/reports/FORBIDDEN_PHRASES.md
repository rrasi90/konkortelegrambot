# عبارت‌های ممنوعه (FORBIDDEN_PHRASES) — V2-080

- ابزار: packages/learning-engine/src/readiness-copy.ts + target-weights.ts

| عبارت ممنوعه | چرا ممنوع |
|---|---|
| رتبه‌های برتر، تراز بالای 4200، احتمال قبولی 90٪، تضمین قبولی، دعوت به مصاحبه | ادعای بدون کالیبراسیون (README_AGENT_MISSION 3.3) |
| پوشش 100٪ کنکور | بدون دفترچه کامل و تطبیق هر 4 لایه |
| بسته 2162 لحظه‌ای به‌جای 2164 بدون رأی دفترچه | C02: کدها یکی نیستند |

## Gate UI

- assertReadinessCopyClean(text) در readiness-copy.ts: هر سطر UI فارسی پیش از render باید از این Gate بگذرد؛ در صورت یافتن عبارت، throw می‌کند.
- readinessLabel هرگز رتبه/تراز را در برچسب نمی‌آورد؛ فقط «اطمینان سنجش».

## نتیجه

- متن‌های فعلی engine (mentorMessage) هیچ عبارت ممنوعه‌ای ندارند؛ assertNoForbiddenClaims برای target-weights در دسترس است.
