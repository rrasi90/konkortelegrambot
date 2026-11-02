-- 0002_english_skills.sql — گره‌های دانش ۱۰ مهارت زبان انگلیسی (§8.8)
-- این گره‌ها فقط ساختار سنجش مهارت را می‌سازند؛ هیچ سؤال رسمی یا محتوای
-- ساختگی با آن‌ها وارد نمی‌شود. تا ورود بانک سؤال برچسب‌خورده، پوشش هر مهارت صفر
-- گزارش می‌شود و API همین کمبود را صریح اعلام می‌کند.
BEGIN;

INSERT INTO knowledge_nodes (id, track, course, chapter, topic) VALUES
  ('english.vocabulary_context', 'common', 'زبان انگلیسی', 'واژگان و ساختواژه', 'واژگان آکادمیک در بافت'),
  ('english.word_formation',     'common', 'زبان انگلیسی', 'واژگان و ساختواژه', 'پیشوند، پسوند، ریشه و هم‌آیندی'),
  ('english.grammar_context',    'common', 'زبان انگلیسی', 'گرامر و انسجام', 'گرامر در بافت جمله'),
  ('english.cohesion_cloze',     'common', 'زبان انگلیسی', 'گرامر و انسجام', 'کلوز تست و پیوندهای منطقی'),
  ('english.main_idea',          'common', 'زبان انگلیسی', 'درک مطلب', 'ایده اصلی و ساختار متن'),
  ('english.detail_scanning',    'common', 'زبان انگلیسی', 'درک مطلب', 'جزئیات صریح و خواندن سریع'),
  ('english.inference_stance',   'common', 'زبان انگلیسی', 'درک مطلب', 'استنباط، لحن و موضع نویسنده'),
  ('english.reference',          'common', 'زبان انگلیسی', 'درک مطلب', 'مرجع ضمیر و ارجاع'),
  ('english.paraphrase',         'common', 'زبان انگلیسی', 'بازگویی و هم‌معنایی', 'پارافریز و تشخیص هم‌معنی'),
  ('english.time_strategy',      'common', 'زبان انگلیسی', 'راهبرد آزمون', 'مدیریت زمان و تصمیم پاسخ')
ON CONFLICT (id) DO UPDATE SET
  track = EXCLUDED.track,
  course = EXCLUDED.course,
  chapter = EXCLUDED.chapter,
  topic = EXCLUDED.topic;

COMMIT;
