# Book Source Discovery Report — consolidation 20261107

**Honest scope:** فهرست پایین از §4.1 سند مأموریت آمده و با جست‌وجوی وب از قبل اجرا‌شده در مأموریت‌های قبلی (`AEL-EXAM-MD-ANALYSIS` + `COURSE_COVERAGE_GAP_REPORT`) cross-check شده است. هر عنوانی که جست‌وجوی وب مستقل برای آن اجرا نشده، صریحاً `not_searched_this_mission` است.

## ۱. کتاب‌های موجود در مخزن (inventory از content/markdown/books + bookChapters*)

| book_id | title | chapters_in_repo | level | status |
|---|---|---|---|---|
| book-daft-org-theory-design | تئوری و طراحی سازمان — ریچارد دفت | bookChaptersBusiness.ts دارد | دکتری/ارشد | partial (بعضی فصل‌ها) |
| book-robbins-ob | رفتار سازمانی — رابینز | bookChaptersBusiness.ts دارد | ارشد | partial |
| book-chernev-marketing-strategy | استراتژی بازاریابی — چرنف | metadata.md فقط | ارشد بازرگانی | absent (فقط metadata) |
| book-azarmomeni-stats | آمار آذر-مؤمنی | comprehensiveCourseEncyclopedia دارد | ارشد/دکتری | partial |
| book-hafaznia-research | روش تحقیق حافظ‌نیا | encyclopedia دارد | ارشد/دکتری | partial |
| book-kotler-marketing | مدیریت بازاریابی کاتلر | encyclopedia دارد | ارشد بازرگانی | partial |
| book-david-strategic | مدیریت استراتژیک فرد دیوید | encyclopedia دارد | ارشد/دکتری | partial |
| book-alvani-public | مدیریت عمومی الوانی | encyclopedia دارد | دکتری دولتی | partial |
| book-laudon-mis | MIS لاودن | encyclopedia دارد | دکتری MIS | partial |
| book-nonaka-km | The Knowledge-Creating Company | encyclopedia دارد | دکتری KM | partial |
| book-bodie-investments | Investments — Bodie et al. | encyclopedia دارد | دکتری مالی | partial |
| book-merce-robbins | مبانی سازمان رضائیان | encyclopedia دارد | ارشد | partial |

**تعداد کتاب‌های inventory شده: ۱۲+** · **فهرست فصل‌های کامل تأییدشده: ۰** (همه partial؛ فهرست فصل واقعی از ناشر/کتابخانه به‌دست نیامده) · **summary sourceهای مستقل: ۳+** (فهرست §4.4 سند مأموریت)

## ۲. جست‌وجوهای وب — اجرا‌شده در مأموریت‌های قبلی (cross-referenced)

- کلید ارشد ۱۴۰۵: sanjesh.org/noet_tk (403 anonymous), heyvagroup (404 link rot)
- دفترچهٔ ارشد ۱۴۰۲: mastertest PDF retrieved ✓
- دکتری مدیریت ۱۴۰۴-۱۴۰۵: phdtest/heyvagroup/irantest — identified, not retrieved
- دفترچهٔ ارشد ۱۳۹۰: mastertest/noandishaan/cafetadris — identified, not retrieved
- کد دکتری: ۲۱۶۲ (R-001) vs ۲۱۷۱ (third-party) — discrepancy flagged, not resolved

## ۳. کتاب‌های مأموریت §4.1 — وضعیت جست‌وجو در این مأموریت

| کتاب | جست‌وجوی مستقل این مأموریت | نتیجه |
|---|---|---|
| رضائیان مبانی سازمان | not_searched_this_mission (جزوه در §4.4 سند مأموریت موجود) | not_searched |
| الوانی مدیریت عمومی | not_searched_this_mission | not_searched |
| Robbins & Coulter Management | not_searched_this_mission | not_searched |
| Daft Organization Theory | not_searched_this_mission | not_searched |
| Robbins & Judge OB | not_searched_this_mission (خلاصه در §4.4) | not_searched |
| Fred David Strategic Mgmt | not_searched_this_mission | not_searched |
| Kotler Marketing Mgmt | not_searched_this_mission | not_searched |
| آذر-مؤمنی آمار ۱-۲ | ✅ (مأموریت recovery: منبع در phdExpansionContent) | found_in_repo |
| حافظ‌نیا روش تحقیق | ✅ (منبع در phdExpansionContent) | found_in_repo |
| Creswell Research Design | not_searched_this_mission | not_searched |
| Varian/Pindyck اقتصاد | not_searched_this_mission | not_searched |
| Parsons/Dye/Kraft خط‌مشی | not_searched_this_mission | not_searched |
| سعادت منابع انسانی | not_searched_this_mission (§4.4 دارد) | not_searched |
| Dessler HRM | not_searched_this_mission | not_searched |
| Laudon MIS | not_searched_this_mission (خلاصه در §4.4) | not_searched |
| Nonaka SECI | ✅ (منبع در phdExpansionContent) | found_in_repo |
| Brealey/Ross/Bodie مالی | ✅ (Bodie منبع در phdExpansionContent) | found_in_repo |
| Taha/Hillier OR | not_searched_this_mission | not_searched |
| Heizer/Russell تولید | not_searched_this_mission | not_searched |
| Schilling نوآوری | not_searched_this_mission | not_searched |

**صادقانه:** این مأموریت جست‌وجوی وب جدید برای کتاب‌ها اجرا نکرده (بودجهٔ context صرف P0 و P1-آزمون شد)؛ فهرست بالا از inventory مخزن + cross-ref سند مأموریت ساخته شده. **هر عنوان `not_searched` به P1-next منتقل می‌شود.**

## ۴. حقوق نشر

- هیچ PDF/خلاصهٔ دارای حق نشر وارد repo نشده است (قاعدهٔ H-CONK/SRC-02).
- فایل‌های `content/markdown/books/**` متادیتا و فصل‌بندی هستند نه متن کامل کتاب.
- خلاصه‌های §4.4 سند مأموریت: فروشگاهی/paid — فقط metadata/ToC ثبت شده، نه دانلود.
