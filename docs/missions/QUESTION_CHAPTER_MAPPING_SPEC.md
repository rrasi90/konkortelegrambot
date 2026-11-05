# Spec نگاشت سؤال→فصل
- relation_kind: direct_source_verified (نیازمند Evidence — Trigger DB رد می‌کند) / curriculum_topic_verified (ارتباط محتوایی، ادعای منشأ نیست) / historical_pattern / candidate_ai_or_editor / conflicted / rejected / unmapped.
- review_status مستقل از relation_kind. similarity_score مدل = Confidence علمی نیست (فیلدهای جدا).
- Evidence: source_version_id + locator + note؛ نگاشت به Edition نامعلوم = edition_known=false.
- SoD: mapped_by ≠ reviewed_by (Trigger DB + API 403).
- تعارض: هر دو شاهد حفظ، status=conflicted؛ رد، تاریخچه را حذف نمی‌کند.
- آمار: uniqueAppearances vs totalMappingLinks + byYear + multiChapterAppearanceIds؛ درصد فقط با مخرج روشن.
