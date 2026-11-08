# graph patch (پیش‌نویس آماده روی شاخهٔ وابسته، نه main)

- base: bfe41ad38570834644294f085ddd342ebac2e88c (head PR15)
- قبل → بعد:
  - skill.ind.or_simplex: ind.or_simplex → ind.or_simplex_duality (هم‌ارزی crosswalk)
  - skill.ind.mcdm: ind.mcdm → ind.mcdm_dea_queue
  - skill.ind.production_inv: ind.production_inv → ind.pom_eoq_mrp
  - skill.mkt.stp.positioning: مهارت مفقود → تعریف skill جدید با شاهد crosswalk (mkt.stp)
  - skill.stats.nonparam.kruskal: مهارت مفقود → تعریف skill جدید «کروسکال-والیس» با شاهد crosswalk (stats.nonparam)
- اعمال فقط روی آن شاخه؛ تایید نهایی پس از ادغام PR15 و اجرای validator.
