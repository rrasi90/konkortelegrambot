# مدل دامنه (واژه‌نامه سند ۴ → پیاده‌سازی)
- ExamSubject ≠ LearningCourse: Subject در exam_subjects (آزمون/ضریب/سال)، Course در content_items + PublishedCatalog (محصول آموزشی). رابطهٔ اختیاری، بدون الزام ۱:۱.
- Book ≠ BookEdition: اثر مستقل از چاپ؛ Edition نسخه‌دار با حقوق مستقل و بدون بازنویسی روی قبلی.
- فصل ≠ Topic: book_structure_nodes ساختار فیزیکی ویرایش است (Tree بی‌نهایت سطح + History)؛ Topic/Concept در knowledge_nodes/skills و نگاشت جدا.
- Question ≠ Appearance: هویت سؤال در questions؛ ظهور (سال/دفترچه/شماره) در question_appearances با UNIQUE.
- SubjectBookRelation (۵ نوع مستقل: official/recommended/commonly_used/historically_related/supplementary) ≠ QuestionChapterMapping (۷ نوع رابطه + review_status جدا).
- آمار فصل = شمارش Appearance یکتا + شمارش ارتباط جدا (کنترل دوبرابرشماری در /domain/book_structure_nodes/:id/stats).
