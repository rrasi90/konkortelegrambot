-- Generated from content/examples/demo-pack.json by scripts/import-content.mjs
-- Pack demo-pack-phd-management@0.1.0; synthetic=true; a demo fixture, not official exam content.
BEGIN;

INSERT INTO exam_packs(id,title,exam_level,syllabus_version,content_version,is_synthetic,rights_status,publication_status,scoring_rules,metadata,source_ref,source_hash)
VALUES ('demo-pack-phd-management@0.1.0','demo-pack-phd-management','doctoral-management-demo','demo-syllabus-v1',1,true,'unknown','draft','{"type":"single_choice","correct":1,"incorrect":0,"unanswered":0,"official":false}'::jsonb,'{"name":"demo-pack-phd-management","version":"0.1.0","synthetic":true,"language":"fa","description":"محتوای نمایشی ساختگی برای توسعه و تست موتور؛ جایگزین بانک سؤالات ۱۱ سال اخیر نیست. پس از تأیید محتوای واقعی از طریق scripts/import-content.mjs وارد می‌شود.","tracks":[{"id":"common","title":"هستهٔ مشترک"},{"id":"business","title":"مدیریت بازرگانی"},{"id":"technology","title":"مدیریت تکنولوژی"}],"syllabusVersion":"demo-syllabus-v1","examLevel":"doctoral-management-demo","scoringRules":{"type":"single_choice","correct":1,"incorrect":0,"unanswered":0,"official":false},"holdoutQuestionIds":["demo-q-014"]}'::jsonb,NULL,NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO exam_pack_syllabi(pack_id,version,source_ref,source_hash,rights_status,verification_status,syllabus_content)
VALUES ('demo-pack-phd-management@0.1.0','demo-syllabus-v1',NULL,NULL,'unknown','unverified','{}'::jsonb)
ON CONFLICT (pack_id,version) DO NOTHING;

INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('mb.structure','common','مبانی سازمان و مدیریت','ساختارهای سازمانی','ساختارهای مکانیکی و ارگانیک') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('mb.contingency','common','مبانی سازمان و مدیریت','تئوری‌های اقتضایی','مدل‌های لارنس و لورش و وودوارد') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('sm.rbv','common','مدیریت استراتژیک پیشرفته','دیدگاه‌های استراتژی','دیدگاه مبتنی بر منابع (بارنی)') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('sm.value_chain','common','مدیریت استراتژیک پیشرفته','تحلیل صنعت','زنجیره ارزش پورتر') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('sm.portfolio','common','مدیریت استراتژیک پیشرفته','استراتژی سطح کسب‌وکار','ماتریس‌های پورتفولیو (BCG و GE)') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('stats.scales','common','آمار و کاربرد آن در مدیریت','مبانی اندازه‌گیری','مقیاس‌های اسمی، رتبه‌ای، فاصله‌ای و نسبتی') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('stats.anova','common','آمار و کاربرد آن در مدیریت','آزمون‌های پارامتریک','تحلیل واریانس دوطرفه (ANOVA)') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('mkt.brand','business','بازاریابی پیشرفته','مدیریت برند','دارایی‌های برند (آکر و کلر)') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('mkt.plc','business','بازاریابی پیشرفته','استراتژی‌های محصول','چرخه عمر محصول و استراتژی‌های کاتلر') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('mkt.consumer','business','بازاریابی پیشرفته','رفتار مصرف‌کننده','انگیزش، ادراک و نگرش خریدار') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('inno.s_curve','technology','تئوری‌های نوآوری و فناوری','چرخه عمر فناوری','منحنی S فناوری (فاستر)') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('inno.ambidextrous','technology','تئوری‌های نوآوری و فناوری','سازمان‌های نوآور','سازمان‌های دوپهلو (Ambidextrous)') ON CONFLICT (id) DO NOTHING;
INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES ('tech.absorptive','technology','مدیریت فناوری و نوآوری','ظرفیت‌های فناورانه','ظرفیت جذب (کوهن و لوینتال)') ON CONFLICT (id) DO NOTHING;

INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES ('sm.rbv','sm.value_chain','prerequisite',0.5,'unverified',NULL,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES ('stats.anova','stats.scales','prerequisite',0.5,'unverified',NULL,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES ('mkt.brand','sm.rbv','prerequisite',0.6,'unverified',NULL,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES ('mkt.plc','sm.portfolio','prerequisite',0.5,'unverified',NULL,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES ('mb.contingency','mb.structure','prerequisite',0.4,'unverified',NULL,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES ('inno.ambidextrous','mb.structure','prerequisite',0.5,'unverified',NULL,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES ('mkt.consumer','mb.contingency','prerequisite',0.3,'unverified',NULL,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES ('sm.value_chain','mkt.brand','cross_course',0.4,'unverified',NULL,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES ('sm.value_chain','tech.absorptive','cross_course',0.4,'unverified',NULL,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES ('sm.portfolio','inno.s_curve','cross_course',0.4,'unverified',NULL,NULL)
ON CONFLICT DO NOTHING;

INSERT INTO exam_pack_courses(pack_id,course_key,title,weight,weight_is_official,source_ref,sort_order)
VALUES ('demo-pack-phd-management@0.1.0','course__d9_85_d8_a8_d8_a7_d9_86_db_8c_20_d8_b3_d8_a7_d8_b2_d9_85_d8_a7_d9_86_20_d9_88_20_d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa','مبانی سازمان و مدیریت',0,false,NULL,0)
ON CONFLICT (pack_id,course_key) DO NOTHING;
INSERT INTO exam_pack_courses(pack_id,course_key,title,weight,weight_is_official,source_ref,sort_order)
VALUES ('demo-pack-phd-management@0.1.0','course__d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa_20_d8_a7_d8_b3_d8_aa_d8_b1_d8_a7_d8_aa_da_98_db_8c_da_a9_20_d9_be_db_8c_d8_b4_d8_b1_d9_81_d8_aa_d9_87','مدیریت استراتژیک پیشرفته',0,false,NULL,1)
ON CONFLICT (pack_id,course_key) DO NOTHING;
INSERT INTO exam_pack_courses(pack_id,course_key,title,weight,weight_is_official,source_ref,sort_order)
VALUES ('demo-pack-phd-management@0.1.0','course__d8_a2_d9_85_d8_a7_d8_b1_20_d9_88_20_da_a9_d8_a7_d8_b1_d8_a8_d8_b1_d8_af_20_d8_a2_d9_86_20_d8_af_d8_b1_20_d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa','آمار و کاربرد آن در مدیریت',0,false,NULL,2)
ON CONFLICT (pack_id,course_key) DO NOTHING;
INSERT INTO exam_pack_courses(pack_id,course_key,title,weight,weight_is_official,source_ref,sort_order)
VALUES ('demo-pack-phd-management@0.1.0','course__d8_a8_d8_a7_d8_b2_d8_a7_d8_b1_db_8c_d8_a7_d8_a8_db_8c_20_d9_be_db_8c_d8_b4_d8_b1_d9_81_d8_aa_d9_87','بازاریابی پیشرفته',0,false,NULL,3)
ON CONFLICT (pack_id,course_key) DO NOTHING;
INSERT INTO exam_pack_courses(pack_id,course_key,title,weight,weight_is_official,source_ref,sort_order)
VALUES ('demo-pack-phd-management@0.1.0','course__d8_aa_d8_a6_d9_88_d8_b1_db_8c_e2_80_8c_d9_87_d8_a7_db_8c_20_d9_86_d9_88_d8_a2_d9_88_d8_b1_db_8c_20_d9_88_20_d9_81_d9_86_d8_a7_d9_88_d8_b1_db_8c','تئوری‌های نوآوری و فناوری',0,false,NULL,4)
ON CONFLICT (pack_id,course_key) DO NOTHING;
INSERT INTO exam_pack_courses(pack_id,course_key,title,weight,weight_is_official,source_ref,sort_order)
VALUES ('demo-pack-phd-management@0.1.0','course__d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa_20_d9_81_d9_86_d8_a7_d9_88_d8_b1_db_8c_20_d9_88_20_d9_86_d9_88_d8_a2_d9_88_d8_b1_db_8c','مدیریت فناوری و نوآوری',0,false,NULL,5)
ON CONFLICT (pack_id,course_key) DO NOTHING;

INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-001','sm.rbv',1401,'کدام گزینه، ویژگی‌های منبع استراتژیک در مدل بارنی را به‌طور کامل توصیف می‌کند؟','["ارزش‌مند، کمیاب، تقلیدناپذیر و جایگزینی‌ناپذیر","فراوان، ارزان و در دسترس","قابل کپی، ملموس و قابل معامله","شهودی، ملموس و ماندگار"]'::jsonb,0,'مدل VRIN بارنی: منبع باید ارزش‌آفرین، کمیاب، تقلیدناپذیر و بدون جایگزین باشد تا مزیت پایدار بسازد.','دام رایج طراح: جایگزینی «جایگزینی‌ناپذیر» با «قابل معامله» یا خلط VRIN با VRIO.','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-002','sm.rbv',1403,'قابلیت‌های پویا (تیس) عمدتاً برای برطرف‌کردن کدام محدودیتِ دیدگاه مبتنی بر منابع مطرح شدند؟','["سکون قابلیت‌ها در محیط‌های به‌سرعت متغیر","تأکید بیش از حد بر مشتری","نادیده‌گرفتن هزینهٔ تولید","تمرکز بر بازارهای محلی"]'::jsonb,0,'قابلیت‌های پویا یعنی توان بازآرایی و بازشکل‌دهی شایستگی‌ها برای پاسخ به تغییرات محیطی.','دام: گزینه‌هایی که «بازآرایی منابع در محیط متغیر» را با «کاهش هزینه» اشتباه می‌گیرند.','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-003','sm.value_chain',1400,'در زنجیرهٔ ارزش پورتر، فعالیت‌های «حاشیه‌ساز» کدام‌اند؟','["زیرساخت سازمان، مدیریت منابع انسانی، توسعهٔ فناوری و خرید","ورودی‌ها، عملیات، خروجی‌ها، بازاریابی و فروش و خدمات","فقط بازاریابی و فروش","فقط عملیات و خدمات"]'::jsonb,0,'فعالیت‌های اصلی مستقیماً محصول/خدمت را می‌سازند؛ حاشیه‌سازها از همهٔ فعالیت‌ها پشتیبانی می‌کنند.','دام کلاسیک: جابه‌جایی فهرست فعالیت‌های اصلی و حاشیه‌ساز.','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-004','sm.portfolio',1402,'در ماتریس BCG، واحدی که سهم بازار کم اما رشد بازار بالا دارد چه نامیده می‌شود؟','["علامت سؤال","ستاره","گاو شیری","سگ"]'::jsonb,0,'Question Mark: رشد بالا، سهم کم؛ تصمیم سرمایه‌گذاری یا کنارگذاری.','دام: خلط «ستاره» با «علامت سؤال» به‌دلیل رشد بالای مشترک.','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-005','stats.scales',1399,'«رتبه‌بندی رضایت کارکنان به‌صورت ضعیف/متوسط/خوب» از چه مقیاسی است؟','["رتبه‌ای (ترتیبی)","اسمی","نسبتی","فاصله‌ای"]'::jsonb,0,'ترتیب معنادار اما فاصلهٔ برابر تضمین‌نشده = مقیاس ترتیبی.','دام: خلط ترتیبی با فاصله‌ای؛ در فاصله‌ای فواصل برابر معنی دارند.','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-006','stats.anova',1401,'کدام مفروض برای اجرای ANOVA پارامتریک ضروری است؟','["همسانی واریانس گروه‌ها و نرمال‌بودن توزیع خطا","همبستگی بالای متغیرها","داده‌های رتبه‌ای بدون توزیع خاص","نمونه‌گیری خوشه‌ای"]'::jsonb,0,'ANOVA پارامتریک: نرمال بودن، همسانی واریانس (Levene) و استقلال مشاهدات.','دام: گزینه‌های مربوط به آزمون‌های ناپارامتریک (مانند Kruskal-Wallis) به‌عنوان مفروض پارامتریک.','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-007','mb.structure',1400,'برنز و استاکر، سازمان‌های با محیط پایدار و فناوری تولید انبوه را کدام نوع ساختار می‌دانند؟','["مکانیکی","ارگانیک","دوپهلو","ماتریسی"]'::jsonb,0,'محیط پایدار + تولید انبوه = ساختار مکانیکی (رسمی، متمرکز، سلسله‌مراتبی).','دام: خلط شرایط محیطی مناسب ارگانیک (محیط متغیر) با مکانیکی.','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-008','mb.contingency',1402,'پژوهش وودوارد نشان داد ارتباط «ساختار و اثربخشی» بستگی دارد به چه عاملی؟','["فناوری تولید سازمان","اندازهٔ ساختمان","شخصیت مدیر عامل","قیمت سهام"]'::jsonb,0,'وودوارد: نوع فناوری تولید (تک‌بشی تا فرایندی) تعیین‌کنندهٔ ساختار اثربخش است.','دام: خلط یافتهٔ وودوارد (فناوری) با لارنس و لورش (محیط و عدم‌قطعیت).','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-009','mkt.brand',1401,'در مدل کاپفرر، کدام عنصر از هرم برند به «روابط مشتری با برند» اشاره دارد؟','["پرکننده","جنس","شخصیت","منعکس‌کننده"]'::jsonb,0,'پرکننده (Relational) لایهٔ بیرونی هرم کاپفرر و مربوط به رابطهٔ مشتری-برند است.','دام: ترتیب لایه‌های هرم کاپفرر (فیزیکی، جنس، شخصیت، منعکس‌کننده، پرکننده).','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-010','mkt.plc',1403,'در مرحلهٔ رشد چرخهٔ عمر محصول، استراتژی پیشنهادی کاتلر برای رهبر بازار چیست؟','["بهبود کیفیت، افزودن ویژگی و مدل‌های جدید","کاهش شدید قیمت برای حذف رقبا","خروج از بازار","حذف توزیع"]'::jsonb,0,'در رشد، تمرکز بر تمایز و گسترش بازار است نه جنگ قیمتی.','دام: خلط استراتژی مرحلهٔ رشد با جنگ قیمتی مرحلهٔ بلوغ.','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-011','mkt.consumer',1398,'کدام نظریهٔ انگیزشی، «نیاز به موفقیت (nAch)» را محور توضیح رفتار می‌داند؟','["مک‌کللند","مزلو","هرزبرگ","وروم"]'::jsonb,0,'مک‌کللند: نیاز به موفقیت، قدرت و وابستگی؛ nAch پیش‌بین رفتار کارآفرینانه.','دام: خلط nAch مک‌کللند با نیازهای بنیادی مزلو.','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-012','inno.s_curve',1402,'مفهوم «هجوم تکنولوژیک» در منحنی S فاستر چه زمانی رخ می‌دهد؟','["هنگام گذار به فناوری نسل بعد در نقطهٔ اشباع منحنی فعلی","در آغاز منحنی اول","پس از رقابت قیمتی","قبل از سرمایه‌گذاری اولیه"]'::jsonb,0,'Discontinuity: وقتی منحنی فعلی به حد اشباع می‌رسد، مزیت به فناوری جدید سمت راست منحنی می‌رسد.','دام: خلط نقطهٔ اشباع منحنی فعلی با شروع منحنی جدید در زمان‌بندی گذار فناوری.','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-013','inno.ambidextrous',1401,'سازمان دوپهلو (O''Reilly و Tushman) به‌طور هم‌زمان چه می‌کند؟','["بهبود تدریجی کسب‌وکار فعلی + اکتشاف فرصت‌های جدید در واحدهای جداگانه","فقط بهینه‌سازی فرایندهای فعلی","فقط تحقیقات بلندمدت بدون تولید","برون‌سپاری تمام نوآوری‌ها"]'::jsonb,0,'Ambidexterity: هم‌زمانی exploitation و exploration از طریق واحدهای ساختاری جدا اما یکپارچهٔ راهبردی.','دام: خلط دوپهلو با «فقط تحقیق» یا «فقط بهبود مستمر».','demo',NULL,NULL,'unknown',NULL,NULL,'1',false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES ('demo-q-014','tech.absorptive',1403,'ظرفیت جذب (Absorptive Capacity) بر اساس تعریف کوهن و لوینتال چیست؟','["توانایی شناسایی، جذب و کاربست دانش بیرونی","میزان سرمایهٔ ثابت شرکت","تعداد پتنت‌های ثبت‌شده","سرعت تولید محصول"]'::jsonb,0,'ظرفیت جذب تابع دانش قبلی مرتبط سازمان است و سه مؤلفهٔ شناسایی، جذب و کاربست دارد.','دام: تعریف ظرفیت جذب به‌صورت موجودی دارایی به‌جای توانایی فرایندی.','demo',NULL,NULL,'unknown',NULL,NULL,'1',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','mb.structure','course__d9_85_d8_a8_d8_a7_d9_86_db_8c_20_d8_b3_d8_a7_d8_b2_d9_85_d8_a7_d9_86_20_d9_88_20_d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','mb.contingency','course__d9_85_d8_a8_d8_a7_d9_86_db_8c_20_d8_b3_d8_a7_d8_b2_d9_85_d8_a7_d9_86_20_d9_88_20_d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','sm.rbv','course__d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa_20_d8_a7_d8_b3_d8_aa_d8_b1_d8_a7_d8_aa_da_98_db_8c_da_a9_20_d9_be_db_8c_d8_b4_d8_b1_d9_81_d8_aa_d9_87',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','sm.value_chain','course__d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa_20_d8_a7_d8_b3_d8_aa_d8_b1_d8_a7_d8_aa_da_98_db_8c_da_a9_20_d9_be_db_8c_d8_b4_d8_b1_d9_81_d8_aa_d9_87',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','sm.portfolio','course__d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa_20_d8_a7_d8_b3_d8_aa_d8_b1_d8_a7_d8_aa_da_98_db_8c_da_a9_20_d9_be_db_8c_d8_b4_d8_b1_d9_81_d8_aa_d9_87',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','stats.scales','course__d8_a2_d9_85_d8_a7_d8_b1_20_d9_88_20_da_a9_d8_a7_d8_b1_d8_a8_d8_b1_d8_af_20_d8_a2_d9_86_20_d8_af_d8_b1_20_d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','stats.anova','course__d8_a2_d9_85_d8_a7_d8_b1_20_d9_88_20_da_a9_d8_a7_d8_b1_d8_a8_d8_b1_d8_af_20_d8_a2_d9_86_20_d8_af_d8_b1_20_d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','mkt.brand','course__d8_a8_d8_a7_d8_b2_d8_a7_d8_b1_db_8c_d8_a7_d8_a8_db_8c_20_d9_be_db_8c_d8_b4_d8_b1_d9_81_d8_aa_d9_87',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','mkt.plc','course__d8_a8_d8_a7_d8_b2_d8_a7_d8_b1_db_8c_d8_a7_d8_a8_db_8c_20_d9_be_db_8c_d8_b4_d8_b1_d9_81_d8_aa_d9_87',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','mkt.consumer','course__d8_a8_d8_a7_d8_b2_d8_a7_d8_b1_db_8c_d8_a7_d8_a8_db_8c_20_d9_be_db_8c_d8_b4_d8_b1_d9_81_d8_aa_d9_87',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','inno.s_curve','course__d8_aa_d8_a6_d9_88_d8_b1_db_8c_e2_80_8c_d9_87_d8_a7_db_8c_20_d9_86_d9_88_d8_a2_d9_88_d8_b1_db_8c_20_d9_88_20_d9_81_d9_86_d8_a7_d9_88_d8_b1_db_8c',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','inno.ambidextrous','course__d8_aa_d8_a6_d9_88_d8_b1_db_8c_e2_80_8c_d9_87_d8_a7_db_8c_20_d9_86_d9_88_d8_a2_d9_88_d8_b1_db_8c_20_d9_88_20_d9_81_d9_86_d8_a7_d9_88_d8_b1_db_8c',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES ('demo-pack-phd-management@0.1.0','tech.absorptive','course__d9_85_d8_af_db_8c_d8_b1_db_8c_d8_aa_20_d9_81_d9_86_d8_a7_d9_88_d8_b1_db_8c_20_d9_88_20_d9_86_d9_88_d8_a2_d9_88_d8_b1_db_8c',NULL,'unreviewed',NULL,'unverified')
ON CONFLICT (pack_id,skill_id) DO NOTHING;

INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-001','1',NULL,1401,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-001','sm.rbv','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-002','1',NULL,1403,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-002','sm.rbv','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-003','1',NULL,1400,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-003','sm.value_chain','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-004','1',NULL,1402,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-004','sm.portfolio','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-005','1',NULL,1399,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-005','stats.scales','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-006','1',NULL,1401,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-006','stats.anova','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-007','1',NULL,1400,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-007','mb.structure','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-008','1',NULL,1402,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-008','mb.contingency','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-009','1',NULL,1401,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-009','mkt.brand','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-010','1',NULL,1403,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-010','mkt.plc','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-011','1',NULL,1398,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-011','mkt.consumer','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-012','1',NULL,1402,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-012','inno.s_curve','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-013','1',NULL,1401,'unknown','demo',false,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-013','inno.ambidextrous','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;
INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES ('demo-pack-phd-management@0.1.0','demo-q-014','1',NULL,1403,'unknown','demo',true,false)
ON CONFLICT (pack_id,question_id,item_version) DO NOTHING;
INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES ('demo-q-014','tech.absorptive','primary',NULL,'unverified',NULL)
ON CONFLICT (question_id,skill_id) DO NOTHING;


-- Ensure the synthetic demonstration question is withheld from ordinary practice and used only as a smoke-test holdout.
UPDATE questions SET is_holdout = true WHERE id = 'demo-q-014';
UPDATE exam_pack_questions SET is_holdout = true WHERE pack_id = 'demo-pack-phd-management@0.1.0' AND question_id = 'demo-q-014';
COMMIT;
