# مشخصات GRAPH02 (V2-055) — PROPOSED

> PROPOSED — تا تأیید مالک/متخصص در کد/دیتا اعمال نمی‌شود.

## هدف

افزودن لایه گراف برای:
- نقشه مفاهیم (concept_relations) جدا از prerequisite/cross_course
- ردیابی مفاهیم shared بین دروس
- تشخیص غلط‌های مفهومی فرّی (concept_gap vs knowledge_gap)

## اسکیمای پیشنهادی

- knowledge_concepts(id, title, course_id)
- concept_relations(source_concept, target_concept, relation, weight, verification_status, source_ref)
- course_skill_mappings(course_id, skill_id, coverage_type: dedicated|shared|implicit)

## قاعده

- هر concept بدون source_ref پذیرفته نمی‌شود.
- تا تصمیم مالک، هیچ داده GRAPH02 به موتور وصل نمی‌شود؛ فقط داده پیشنهاد ثبت می‌شود.
