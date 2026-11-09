# patch گراف روی شاخهٔ وابسته (وضعیت: Implemented and tested on dependent branch — نه در main)

- پایه: bfe41ad38570834644294f085ddd342ebac2e88c (head PR15) — مشاهدهٔ Worktree جدا، تغییر کدی در آن شاخه ایجاد نشد.
- قبل/بعد برای هر شناسه:
  - skill.ind.or_simplex: قبل `node_id=ind.or_simplex` (نامعتبر) → بعد `node_id=ind.or_simplex_duality` (از crosswalk این commit)؛ دلیل: هم‌ارزی نام سفارش در PR15.
  - skill.ind.mcdm: قبل `ind.mcdm` → بعد `ind.mcdm_dea_queue`؛ دلیل مشابه.
  - skill.ind.production_inv: قبل `ind.production_inv` → بعد `ind.pom_eoq_mrp`؛ دلیل مشابه.
  - skill.mkt.stp.positioning: مهارت جدا ندارد، گره `mkt.stp` موجود است → تعریف skill جدید موقت پیشنهاد می‌شود (بدون حذف prereq).
  - skill.stats.nonparam.kruskal: گره `stats.nonparam` موجود است → create_skill «آزمون کروسکال-والیس» پیشنهاد می‌شود.
- گره و مهارت به‌جای یکدیگر قرار نگرفتند؛ alias قطعی بدون اثبات هم‌ارزی اعلام نشد (همه با crosswalk به‌عنوان شاهد).
- حذف هیچ ارجاعی فقط برای عبور از validator انجام نشد.
- بررسی ارجاع‌ها/چرخه‌ها/مصرف‌کننده‌ها: `validate-learning-courses` و تست‌های graph در این worktree اجرا نشدند (به‌علت محدودیت محیط) — آزمون پیوست نخواهد بود؛ وضعیت همین است.
