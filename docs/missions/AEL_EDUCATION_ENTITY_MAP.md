# Entity Map — مأموریت v2 (تطبیق مفهوم → جدول)
| مفهوم | جدول/منبع | وضعیت |
|---|---|---|
| ExamProgram | programs/program_versions (0019) | موجود |
| ExamEvent/Set/Subject | exam_events/sets/combinations/subjects (0019) | موجود |
| LearningCourse | content_items(kind=course) + PublishedCatalog (0022) | موجود |
| Book | books (0025) | جدید |
| BookEdition | book_editions (0025) | جدید |
| BookStructureNode | book_structure_nodes + history (0025) | جدید — Tree بی‌نهایت سطح |
| Topic/Concept/Skill | knowledge_nodes/skills (0001/0005) | موجود — اتصال با topic_id/skill_id |
| LearningMaterial | content_items(kindهای ماده + book_node_id) (0022+0025) | گسترش موجود |
| Question | questions (0001) | موجود |
| QuestionAppearance | question_appearances (0025) | جدید |
| QuestionChapterMapping | question_chapter_mappings (0025) + Trigger Evidence/SoD | جدید |
| SubjectBookRelation | subject_book_relations (0025) — ۵ نوع رابطه | جدید |
| SourceEvidence | sources/source_versions/rights (0021) | موجود |
| Review/Release | review_tasks/content_releases/published_snapshots (0022) | موجود |
| Feedback | feedback_threads/messages (0024) | جدید |
| Telegram Inbox/Outbox | telegram_updates/telegram_reply_effects (0024) | جدید |
| Admin Entry | admin_users/sessions (0020) + admin_launch_tickets/login_attempts (0024) | تکمیل |
