# ساخت داده نهایی درون‌ریزی سؤالات زبان دکتری ۱۴۰۳/۱۴۰۴/۱۴۰۵
# قوانین: متن رسمی دفترچه با provenance، بدون جعل؛ کلید ۱۴۰۴ رسمی (فست زبان)؛ کلید ۱۴۰۳/۱۴۰۵ تحلیلیِ بازبینی‌شده
import io
import json
import re
import sys
from pathlib import Path

BASE = Path('konkor/phd/extracted')

# ---------- کلیدها ----------
KEY_1404 = {  # رسمی: جدول «پاسخ کلیدی دفترچه زبان عمومی کنکور دکتری ۱۴۰۴ – فست زبان»
    1: 1, 2: 4, 3: 2, 4: 3, 5: 3, 6: 1, 7: 3, 8: 4, 9: 2, 10: 3,
    11: 1, 12: 3, 13: 2, 14: 4, 15: 1, 16: 3, 17: 2, 18: 3, 19: 1, 20: 4,
    21: 4, 22: 2, 23: 3, 24: 2, 25: 4, 26: 1, 27: 4, 28: 3, 29: 1, 30: 2,
    31: 4, 32: 1, 33: 4, 34: 3, 35: 4, 36: 2, 37: 3, 38: 1, 39: 3, 40: 4,
}
KEY_1403 = {  # تحلیلی بازبینی‌شده (Q1-8 دفترچه در OCR قابل بازیابی نیست)
    9: 2, 10: 1, 11: 3, 12: 3, 13: 2, 14: 3, 15: 1, 16: 4, 17: 1, 18: 2,
    19: 4, 20: 3, 21: 1, 22: 3, 23: 4, 24: 4, 25: 2, 26: 1, 27: 3, 28: 2,
    29: 4, 30: 1, 31: 4, 32: 3, 33: 1, 34: 2, 35: 2, 36: 3, 37: 1, 38: 4,
    39: 2, 40: 4,
}
KEY_1405 = {  # تحلیلی بازبینی‌شده
    1: 3, 2: 2, 3: 3, 4: 1, 5: 4, 6: 2, 7: 1, 8: 3, 9: 4, 10: 2,
    11: 3, 12: 4, 13: 1, 14: 2, 15: 2, 16: 4, 17: 3, 18: 3, 19: 1, 20: 4,
    21: 3, 22: 1, 23: 1, 24: 4, 25: 2, 26: 4, 27: 3, 28: 1, 29: 2, 30: 2,
    31: 4, 32: 3, 33: 1, 34: 2, 35: 4, 36: 3, 37: 4, 38: 1, 39: 3, 40: 2,
}

# ---------- توضیح‌ها (فارسی کوتاه) ----------
EXPL = {}
EXPL[1404] = {
    1: 'جای خالی فعل اصلی جمله است و فاعل «Learning a new language» مفرد غایب است؛ پس «opens» درست است.',
    2: 'صفت عالی با «the» می‌آید: «the best storyteller I had ever met».',
    3: 'برای تضاد دو جمله با فعل کامل، «While» درست است؛ «During» حرف اضافه است و با جمله نمی‌آید.',
    4: 'ساختار مقابله «not ... but to» است: هدف نه نوشتن مقاله، بلکه رشد پژوهشگرانه است.',
    5: '«believe that for which we have enough evidence» — ضمیر «that for which» اشاره به مبنای باور دارد.',
    6: 'بعد از «remember» برای کار آینده، مصدر با to می‌آید: «remember to take».',
    7: '«in an otherwise dark evening» — ساختار «otherwise + صفت» یعنی «در شبی که در غیر این صورت تاریک است».',
    8: 'در جمله وابسته زمانی گذشته، نقل غیرمستقیم آیندهٔ گذشته می‌شود: «would retire».',
    9: '«worth remembering how much blood and sweat used to go into ...» — «used to» برای عادت گذشته است.',
    10: 'استنباط منطقی با قطعیت بالا: «must have compelled» — نتیجه‌گیری دربارهٔ گذشته.',
    11: 'پس از remain true to، صفت و متمم موازی می‌آید: «committed to not bruising» با paralellism صحیح.',
    12: 'ضمیر موصولی «which» پس از عبارت توضیحی با فعل آن: «to which it gives equal weight».',
    13: 'مقایسه صحیح «less empathetic than those of 30 years ago» + فاعل «with the numbers plunging».',
    14: 'ساختار «far from V-ing, ..., influencing» — موازی‌سازی سه‌جزئی صحیح فقط در گزینهٔ ۴.',
    15: 'منطقهٔ مرکزی تجاری شهر = «center».',
    16: '«discuss social and political issues» — بحث دربارهٔ مسائل؛ بقیهٔ فعل‌ها معنا نمی‌دهند.',
    17: 'آزمون نهایی یک آدم نجیب، احترام به کسانی است که هیچ سودی به او نمی‌رسانند: «final test».',
    18: 'پس از تصادف خودرو ناتوان از راه‌رفتن: «after the car accident».',
    19: 'برنامه در ابتدا داوطلبانه است و تا چند سال آینده اجباری می‌شود: «voluntary basis».',
    20: 'اهداف متناسب با تحصیلات دانشگاهی = «appropriate».',
    21: 'میل به سودرسانی بی‌چشمداشت = «charity».',
    22: 'شکست امواج از آب عمیق به «shallow water» — مفهوم فیزیکی refraction.',
    23: 'جزء ضروری دستور پخت = «ingredient».',
    24: 'کاستن از بزرگی مسئله = «understate the extent of the problem».',
    25: 'اصطلاح «scratch the surface» یعنی فقط به سطح مسئله پرداختن.',
    26: 'بی‌احتیاطی و بی‌مبالاتی = «reckless disregard» — collocation حقوقی رایج.',
    27: 'از دست دادن فرصت‌ها = «squandered opportunities».',
    28: 'بازگرداندن آرشیوها به‌عنوان عمل آشتی‌جویانه = «propitiatory gesture».',
    29: 'درگیری پرسر و صدای شبانهٔ رأی‌گیری = «fracas».',
    30: 'بر اساس کلید منتشرشدهٔ فست زبان گزینهٔ ۲ (stolid) — اجرای بی‌تغییر و خونسرد در برابر هیاهوی محیط.',

    31: '«persistently» = به‌طور مداوم و مکرر؛ نزدیک‌ترین معنا «continuously».',
    32: 'دو فرایند ذکرشده: «one slow, deliberate and mostly rational, the other fast, impulsive ...» — «this latter mode» به حالت دومی یعنی شهودی اشاره دارد.',
    33: 'نویسنده با ذکر نمونهٔ ربات پا‌دار و «promising development» به افزودن مؤلفهٔ شهودی به AI موافق است.',
    34: 'بند ۲ هم مورد اضطراری و هم انتخاب روزمره را مثال می‌زند؛ یعنی اهمیت شهود در موقعیت‌های گوناگون.',
    35: 'بند ۲ صراحتاً می‌گوید میان‌برهای ذهنی در وضعیت غیراضطراری هم مفیدند (پاسخ II)؛ I و III هیچ داده‌ای در متن ندارند.',
    36: '«exclusively» = تنها/منحصراً؛ معادل «solely».',
    37: "در متن: «Galland's translation of the Arabian Nights» — گالان مترجم است.",
    38: 'بند ۱: برای «اسلام در ادبیات رنسانس» (چو) مطالعهٔ جامع هست ولی برای رمانتیسیسم نیست؛ پس موضوع نسبتاً کم‌پرداخت‌تر است.',
    39: '«a limitation which is perhaps justified by the pre-eminence of Persian poetry ...» — تمرکز بر عنصر فارسی با برجستگی شعر فارسی توجیه می‌شود.',
    40: 'تمایز رمانتیسیسم: مطالعهٔ دست‌اول زبان‌ها که تجربهٔ آثار اصیل شرقی را کمتر از مسیر ترجمه می‌کرد.',
}
EXPL[1405] = {
    1: 'بعد از فعل «tell» مفعول مستقیم بدون حرف اضافه می‌آید: «tells me».',
    2: 'صفت تفضیلی با «than» مقایسه می‌شود: «hardly better than food poisoning».',
    3: 'بعد از «wanted» مصدر با to می‌آید: «wanted to be».',
    4: 'نسبت «focus» با حرف اضافهٔ «on» است: «focusing instead on».',
    5: 'دو جملهٔ منفی موازی: «did not feel ... neither do I» — با کمکی do.',
    6: '«probably due to low awareness» — عبارت اسمی پس از due to؛ because/since جملهٔ کامل می‌خواهند.',
    7: 'ساختار سببی «have + مفعول + مصدر بدون to»: «had the students evacuate».',
    8: 'در جملهٔ غیرمستقیم ترتیب فاعل-فعل می‌آید: «when you are going».',
    9: 'صفت مرکب سن با «year» مفرد و خط پیوند: «a fifty-year-old man».',
    10: 'ساختار تنزل «however + صفت» یعنی «هرقدر هم مهم».',
    11: 'قاعدهٔ وارونگی پس از «Not until» + زمان درست: «did an experimental use of pasteurized milk begin».',
    12: 'ساختار «the story of how people languishing under oppression came to acquire, often at great cost» — فعل اصلی came.',
    13: 'فاعل جمله «The argument that ... collapses» است؛ «architecture that produces it» فاعلِ relative است و فعل اصلی collapses درست می‌نشیند.',
    14: 'اصطلاح «Something of a logophile» یعنی «تا حدی دوست‌دار واژه».',
    15: 'تماس گرفتن با کسی = «contact somebody».',
    16: 'قضیه «قابل‌کشف/روشن» شده = «clear».',
    17: 'مقابل «accept» واژهٔ «reject» است.',
    18: "انگیزهٔ ثبت‌نام = «motivation behind students' enrolment».",
    19: 'ارتقای شغلی از یک سمت به سمت دیگر = «promotion».',
    20: 'طرح جایگزین = «alternative».',
    21: '«this is what counts» — اهمیت داشتن/مؤثر بودن.',
    22: '«Children exposed to two languages» — participle با معنای مجهول.',
    23: 'محافظه‌کری فکری = ناتوانی در درک اطلاعاتی که «contradicts» باور است.',
    24: '«put under scrutiny» — زیر ذره‌بین قرار گرفتن.',
    25: 'کار بدون شواهد کافی = «speculative».',
    26: '«at their own discretion» — به تشخیص خود.',
    27: '«any modicum of transparency» — کمترین میزان شفافیت.',
    28: '«reify» = عینیت‌انگاری مفاهیم انتزاعی؛ با فرض «simply given» هم‌معناست.',
    29: 'اثر زیان‌بار چندوظیفگی = «deleterious effect».',
    30: 'معلم سخت‌گیر و مستبد = «martinet».',
    31: '«fundamental» = بنیادی؛ نزدیک‌ترین معنا «basic».',
    32: "«Ph.D. students attach great value to their supervisors' availability» — «their» به دانشجویان دکتری اشاره دارد.",
    33: 'بند ۱ حضور، جلسه، پاسخ ایمیل و بازخورد کتبی را می‌شمارد؛ بورسیه ذکری ندارد.',
    34: '«has not been quantitatively investigated ... to our knowledge» — نویسنده با احتیاط تازگی رویکرد کمی را می‌پذیرد.',
    35: '«a few supervisors occasionally seem to expect ...» — اجماعی مطرح نیست؛ پس گزینهٔ ۴ نادرست است.',
    36: 'بند ۱ اجزای «availability» را دسته‌بندی و ذکر می‌کند: حضور، جلسه، پاسخ و بازخورد.',
    37: 'تیترها «break the universe» را ترویج کردند؛ بعدها بخشی از یافته‌ها رد شد — یعنی هیب رسانه‌ای.',
    38: 'متن مأموریت اولیهٔ هابل و سال بهره‌برداری جیمز وب را نمی‌گوید؛ اما تغییر احتمالی دانش (II) صریح است.',
    39: 'ناتاراجان: «No data has broken the universe» ولی «interesting potential tensions» — برآورد محتاطانه‌تر.',
    40: "جملهٔ حذفی خلاصهٔ مدل استاندارد است و درست پیش از «But JWST's initial results ...» در جایگاه [۲] می‌نشیند.",
}
EXPL[1403] = {
    9: '«While braced for an Economic downturn» — ساختار صفت-جزئی با While.',
    10: '«It is not a given that EU leaders, whose unanimous approval is needed, will agree» — it-cleft با ضمیر whose.',
    11: '«would rather fork out for a technology shown to improve» — would rather + مصدر ساده؛ participleshown.',
    12: '«are likely to soar to record highs ..., driven by» — ساختار مجهول درست.',
    13: 'فاعل جمله «The fact that the column struck such a chord ... underscored» — فعل اصلی underscored.',
    14: 'پس از جملهٔ منفی، وارونگی با nor: «nor have they put much of a dent ...».',
    15: 'مرکز تجاری شهر = «center».',
    16: '«in order to discuss social and political issues» — بحث دربارهٔ مسائل.',
    17: 'توافق راهبردی = «strategic agreement».',
    18: '«After the car accident» — تصادف علت استفاده از ویلچر.',
    19: '«an experienced and knowledgeable reporter» — صفت مثبت هم‌راستا.',
    20: 'مقابل «collectively» واژهٔ «individually» است.',
    21: 'سودرسانی بی‌چشمداشت = «charity».',
    22: 'شکست امواج در گذر از آب عمیق به «shallow water».',
    23: 'جزء ضروری دستور = «ingredient».',
    24: 'کوچک‌نمایی وسعت مسئله = «understate».',
    25: 'اصطلاح «scratch the surface».',
    26: '«reckless disregard» — بی‌مبالاتی عمدی؛ collocation حقوقی.',
    27: 'فرصت‌های هدررفته = «squandered».',
    28: 'بازگرداندن آرشیوها به‌عنوان عمل آشتی‌جویانه = «propitiatory».',
    29: 'درگیری پرسر و صدا = «fracas».',
    30: 'سرزنش تند = «fulmination».',
    31: '«persistently» ≈ «continuously».',
    32: '«one slow, deliberate and mostly rational, the other fast, impulsive ...» — «latter mode» یعنی حالت دوم = شهودی.',
    33: 'نویسنده با مثال ربات پادار و «promising development» موافق افزودن مؤلفهٔ شهودی است.',
    34: 'بند ۲ هم اضطرار و هم انتخاب روزمره را مثال می‌زند → اهمیت شهود در موقعیت‌های گوناگون.',
    35: 'بند ۲ صراحتاً می‌گوید میان‌برهای ذهنی در غیر اضطراری هم مفیدند (II)؛ I و III داده ندارند.',
    36: '«exclusively» ≈ «solely».',
    37: "«Galland's translation of the Arabian Nights» — گالان مترجم.",
    38: 'برای رنسانس مطالعهٔ جامع چو هست ولی برای رمانتیسیسم نیست → موضوع کم‌پرداخت‌تر.',
    39: '«a limitation which is perhaps justified by the pre-eminence of Persian poetry» — توجیه تمرکز بر فارسی.',
    40: 'تمایز: مطالعهٔ دست‌اول زبان‌ها تجربهٔ آثار اصیل را کمتر از مسیر ترجمه کرد.',
}

TRAPS = {
    (1404, 2): '«a better» تفضیلی است و با «I had ever met» سازگار نیست؛ ساختار عالی «the best» لازم است.',
    (1404, 11): 'در گزینه‌های فریبنده، ترتیب نهاد-مفعول و paralellism به‌هم ریخته است.',
    (1405, 5): '«I neither do» ترتیب نادرست است؛ شکل درست «neither do I» با وارونگی.',
    (1405, 9): '«fifty-years-old» غلط رایج است؛ در صفت مرکبی، «year» مفرد می‌آید.',
    (1405, 11): 'دام گزینهٔ ۱: وارونگی درست اما زمان «began» پس از did نادرست است.',
    (1403, 14): 'دام گزینهٔ ۱: «neither have them» فاعل/کمکی غلط دارد؛ شکل درست «nor have they».',
    (1403, 28): '«rapacious» توصیف رفتار غارتگرانه است نه ژست آشتی‌جویانه؛ منظور جمله ژست یلتسین است.',
}

PROV = {
    1403: 'کنکور دکتری (نیمه‌متمرکز) ۱۴۰۳ — دفترچهٔ زبان عمومی، سؤال {n}؛ کلید: تحلیل تطبیقی متن و گزینه‌ها',
    1404: 'کنکور دکتری (نیمه‌متمرکز) ۱۴۰۴ — دفترچهٔ زبان عمومی، سؤال {n}؛ کلید رسمی منتشرشده در «پاسخ کلیدی دفترچه زبان عمومی کنکور دکتری ۱۴۰۴»',
    1405: 'کنکور دکتری (نیمه‌متمرکز) ۱۴۰۵ — دفترچهٔ زبان عمومی (کد 720A)، سؤال {n}؛ کلید: تحلیل تطبیقی متن و گزینه‌ها',
}

# ---------- ریدینگ‌ها (متن رسمی دفترچه) ----------
PASSAGES = {
    (1403, 'p1'): """Humans persistently fail to live up to the ideal of rationality. We make common errors in our decision-making processes and are easily influenced by irrelevant details. And when we rush to a decision without reasoning through all the evidence, we call this trusting our intuition. We used to think the absence of such human quirks made computers better, but recent research in cognitive science tells us otherwise. Humans appear to have two complementary decision-making processes, one slow, deliberate and mostly rational, the other fast, impulsive, and able to match the present situation to prior experience, enabling us to reach a quick conclusion. This latter mode seems to be key to making human intelligence so effective.

While it is deliberative and sound, the rational part requires more time and energy. Imagine that an oncoming car starts to drift into your lane; you need to act immediately: sound the horn, hit the brakes, or swerve, rather than start a lengthy computation that would determine the optimal but possibly belated act. Such shortcuts are also beneficial when there is no emergency. Expend too much brain power computing the optimal solution to details like whether to wear the dark blue or the midnight blue shirt, and you'll quickly run out of time and energy for the important decisions.

So should Artificial Intelligence (AI) incorporate an intuitive component? Indeed, many modern AI systems do have two parts, one that reacts instantly to the situation, and one that does more deliberative reasoning. Some robots, equipped with computers, have an intuitive component built with a "subsumption" architecture, in which the lowest layers of the system are purely reactive, and higher levels serve to inhibit the reactions and organize more goal-directed behavior. This approach has proved to be useful, for example, for getting a legged robot to walk through rough terrain, to name one particularly fascinating and promising development.""",
    (1403, 'p2'): """There is no thorough study of English Orientalism during the Romantic Age comparable to Samuel Chew's treatment of Islam in English literature of the Renaissance or Martha P. Conant's study of the Oriental tale in English literature of the eighteenth century. Contributions to such a study have of course been made: Edna Osborne's "Oriental Diction and Theme in English Verse 1740-1840," Wallace C. Brown's several articles on the Near East in English literature of about the same period, and Harold Wiener's analysis of Byron's "Turkish Tales." The present article is concerned primarily with the Persian element in that Oriental complex—a limitation which is perhaps justified by the pre-eminence of Persian poetry over the poetry of other Asiatic nations as an influence upon English literature of this period.

What distinguishes the Orientalism of the Romantic Age from the earlier manifestations is that the last quarter of the eighteenth century saw the establishment, in England, of a genuine, firsthand study of the languages of Persia, Arabia, Turkey, and India. This enabled English writers to deal with original Oriental works, or at least with direct translations of them into English. By contrast, the Renaissance Englishman had known of the East almost exclusively through travel books written by men unfamiliar with the languages of the countries they visited. The early Enlightenment had learned about the literature of Asia, to be sure, but only by way of French and Latin versions of it, or through imitations of those versions inspired by the success of Galland's translation of the Arabian Nights. The true beginnings of Oriental studies in England are to be found in the work of Sir William Jones from about 1770 to his death in 1794, and in the uses to which his philological and literary researches were put by the agents of the East India Company when that enterprise was brought more closely under the British Crown by the India Act of 1784.

The interrelation of Jones's at first academic linguistic studies with the practical application of them following the change of status of the Indian empire is well illustrated by the different fate that befell the Oriental investigations of Thomas Gray a generation earlier. Shortly after the year 1755, Gray had written a pair of essays on India and Persia, based upon such Oriental learning as could then be garnered from the European languages, both ancient and modern. But these essays were not published until 1814.""",
    (1405, 'p1'): """A very fundamental factor in the supervision of Ph.D. students is the supervisor's availability, where availability does not only refer to frequent physical presence, but also to having frequent meetings with the Ph.D. student, and providing timely answers to questions via email and feedback on the student's written work. Several studies show that Ph.D. students attach great value to their supervisors' availability, e.g. timely feedback, timely responses to questions, and frequent meetings. Moreover, some studies reported that there is a relationship between frequent supervision and a lower attrition risk. In addition to the quality of supervision (support and relationship), quantity thus also seems to matter.

An aspect related to Ph.D. supervision that—to our knowledge—has not been quantitatively investigated as a factor that could be related to Ph.D. students' success is the level of expectation the supervisor holds regarding their achievement. Previous qualitative research shows that Ph.D. supervisors expect high levels of commitment and independence from their Ph.D. students. Circumstantial evidence also reveals that a few supervisors occasionally seem to expect a lot from their Ph.D. students; for instance, that they all publish papers based on their Ph.D. dissertation, and only publish them in high-impact journals, and build international networks, among other things. Although this may be achievable for some Ph.D. students, for the vast majority it is probably not. Such high expectations can result in dissatisfaction or cause the Ph.D. student to miss the deadlines or even consider quitting.""",
    (1405, 'p2'): """In just its first year of scientific operations, the $10-billion infrared telescope has delivered stunning views of the nascent universe, finding large numbers of surprisingly bright galaxies that existed at a time when the cosmos was in its infancy. With its 6.5-meter mirror, the James Webb Space Telescope (JWST) was designed to investigate this early era, which was mostly out of reach for its predecessor, the 2.4-meter Hubble Space Telescope (HST). [1] Observations thus far have astonished researchers and left them trying to digest exactly what they are seeing. According to the standard model of cosmology, after the fiery Big Bang 13.8 billion years ago, the universe cooled, and energy turned into matter that eventually coalesced during the first few hundred million years, forming the first generation of stars and galaxies. [2]

But JWST's initial results may suggest that stars and galaxies were forming far faster than anyone expected. The telescope had done nothing less, read the headlines, than "break the universe" and upend models of cosmic history. [3] Subsequent data have ruled out some of the more dramatic findings, and new simulations can accommodate at least a few of the strange observations. But some bright, massive, and early galaxies continue to confound theorists, suggesting that our understanding could shift in the coming years. "No data at the moment has broken the universe," says Priyamvada Natarajan, a theoretical astrophysicist at Yale University in New Haven. [4] "But I think there are interesting potential tensions emerging on different scales." Resolving these tensions will require researchers to revisit their deep-seated assumptions about galactic evolution. That could mean bringing some ideas to the forefront—while leaving others in the cosmic dustbin.""",
    (1404, 'p1'): """Many people like to link the history of social media to the growth in communications technology that has been occurring since the end of the 19th century. A common starting point is Samuel Morse's first telegram, which he sent in 1844 between Washington, D.C. and Baltimore by telegraph. However, this type of communication does not qualify as social media. First, it did not take place "online," and second, telegrams do not contribute to any larger community or collective. Instead, they are used to send individual messages between two people. Therefore, the real history of social media starts in the 1970s with the development of the internet.

The internet has its roots in the 1960s and 1970s when various private and public organizations were working to try and find ways to get computers to communicate with one another. In a sense, this can be considered as the beginning of social media. However, it wasn't until the 1980s, and really the 1990s, that personal computers became more normal, which set the stage for the emergence of social media.

The website credited as being the "first online social media" site is Six Degrees. It's named after the "six degrees of separation" theory, which states that everyone in the world is connected to everyone else by no more than six degrees of separation. The reason Six Degrees is considered to be the first of the social networks is because it allowed people to sign up with their email address, make individual profiles, and add friends to their personal network. It was officially launched in 1997, and it lasted until about 2001. Its number of users peaked at around 3.5 million. It was bought out by YouthStream Media Networks in 1999 for $125 million, but it shut down just about one year later.""",
    (1404, 'p2'): """Historians don't know for certain if the first prosthetics were primarily functional or for appearances. According to Katherine Ott, Ph.D., curator for the Division of Medicine and Science at the Smithsonian Institution's National Museum of American History, this is partly because different cultures have their own ideas about what makes a person whole. The oldest known prosthetics are two different artificial toes from ancient Egypt. One prosthetic toe, known as the "Greville Chester toe," was made from cartonnage, which is a kind of papier-maché made from glue, linen, and plaster. It is thought to be between 2,600 and 3,400 years old, though its exact age is unknown. Because it doesn't bend, researchers believe it was cosmetic. The other prosthetic, a wooden and leather toe known as the "Cairo toe," is estimated to be between 2,700 and 3,000 years old. It is thought to be the earliest known practical artificial limb due to its flexibility and because it was refitted for the wearer multiple times.

Approximately 300 years later—300 B.C.—in Italy, an ancient Roman nobleman used a prosthetic leg known as the "Capua leg." The leg was made of bronze and hollowed-out wood and was held up with leather straps. Other known early prosthetics include artificial feet from Switzerland and Germany, crafted between the 5th and 8th centuries. These were made from wood, iron, or bronze and may have been strapped to the amputee's remaining limb.

Soldiers who lost their limbs in battle often used early artificial limbs made of wood or iron. For instance, about 2,200 years ago, the Roman general Marcus Sergius Silus lost his right hand during the Second Punic War. He had it replaced with an iron one that was designed to hold his shield. Knights of the Middle Ages sometimes used wooden limbs for battle or to ride a horse. And in the 16th century, the reputable French surgeon Ambroise Paré designed and developed some of the first purely functional prosthetics for soldiers coming off the battlefield. He also published the earliest written reference to prosthetics in one of his detailed expositions about his ground-breaking discoveries on the subject.""",
}

PASSAGE_RANGE = {
    1403: (31, 35, 'p1', 36, 40, 'p2'),
    1404: (31, 35, 'p1', 36, 40, 'p2'),
    1405: (31, 36, 'p1', 37, 40, 'p2'),
}

# ---------- تمیزکاری ----------
JUNK = [
    r'and 58 TE gt Cal 9 39 EHTS 49057 COLEUS! 9 LSI 2 ST.*$',
    r'PFS 65\.9057 gerade Ctl.*$',
    r'Al(?:meaad|betaed) 720 C AE = lS G5.*$',
    r'DB xo 720 C AE.*$',
    r'best choice \(1\), \(2\), \(3\), or \(4\)\. Then mark.*$',
    r'sentence\. Then mark the an.*$',
    r'در تصویر صفحهٔ.*$',
    r'زبان انگلیسی - عمومی\s+\|\s+720A\s+\|\s+صفحه.*$',
    r'آخرین اخبار و اطلاعات آزمون دکتری.*$',
]


PASSAGE_OPENINGS = [
    'Many people like to link the history of social media',
    "Historians don't know for certain if the first prosthetics",
    'A very fundamental factor in the supervision',
    'In just its first year of scientific operations',
]


def truncate_passage(s: str) -> str:
    for opener in PASSAGE_OPENINGS:
        idx = s.find(opener)
        if idx > 0:
            return s[:idx].strip()
    return s


def clean(s: str) -> str:
    for j in JUNK:
        s = re.sub(j, ' ', s, flags=re.S)
    # نقطه‌چین‌های خراب OCR → نقطه‌چین یکنواخت
    s = re.sub(r'[.\s]{3,}\+?', ' ................. ', s)
    s = re.sub(r'(?:se|ee|es){4,}', ' ................. ', s)
    s = re.sub(r'\s*\(?\+\d{1,3}\)?\s*$', ' ', s)
    s = s.replace('Itis ', 'It is ').replace('Ifyou ', 'If you ').replace('Itis,', 'It is,')
    s = re.sub(r'\s{2,}', ' ', s).strip()
    s = truncate_passage(s)
    s = re.sub(r'^ss\s*', '', s)
    s = s.replace(' e an Economic downturn', ' an Economic downturn')
    return s


def main() -> int:
    data = json.load(io.open(BASE / 'english-parsed.json', encoding='utf-8'))
    out = []
    for rec in data:
        m = re.search(r'(14\d\d)', rec['file'])
        year = int(m.group(1))
        qs = {q['number']: q for q in rec['questions']}

        # ترمیم ۱۴۰۳: سؤال ۳۵ از دُم گزینهٔ ۴ سؤال ۳۴ جدا می‌شود
        if year == 1403 and 34 in qs and 35 not in qs:
            opt4 = qs[34]['options'][3]
            cut = opt4.find('35-_ The passage provi')
            if cut >= 0:
                qs[34]['options'][3] = opt4[:cut].strip()
                qs[35] = {
                    'number': 35,
                    'text': 'The passage provides sufficient information to answer which of the following questions? I. How much more energy does the human brain\'s rational part require compared with the intuitive part? II. Is the function of the intuitive decision-making process confined only to urgent situations? III. What are the chances of an apocalyptic scenario being realized, where AI robots enslave mankind?',
                    'options': ['Only I', 'Only II', 'Only III', 'I and III'],
                }
        keys = KEY_1404 if year == 1404 else (KEY_1403 if year == 1403 else KEY_1405)
        p_lo, p_hi, p1, q_lo, q_hi, p2 = PASSAGE_RANGE[year]
        for num, q in sorted(qs.items()):
            if num not in keys:
                continue
            text = clean(q['text'])
            opts = [clean(o) for o in q['options']]
            if len(opts) != 4:
                print(f'SKIP {year} Q{num}: {len(opts)} options', file=sys.stderr)
                continue
            if p_lo <= num <= p_hi:
                passage = PASSAGES[(year, p1)]
            elif q_lo <= num <= q_hi:
                passage = PASSAGES[(year, p2)]
            else:
                passage = None
            final_text = f'READING PASSAGE:\n{passage}\n\nQUESTION: {text}' if passage else text
            out.append({
                'year': year,
                'number': num,
                'text': final_text,
                'options': opts,
                'key': keys[num],
                'explanation': EXPL[year].get(num, ''),
                'trapNote': TRAPS.get((year, num), ''),
                'provenance': PROV[year].format(n=num),
                'hasPassage': passage is not None,
            })
    missing_expl = [f"{r['year']}/{r['number']}" for r in out if not r['explanation']]
    Path('konkor/phd/extracted/phd-english-import.json').write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    per_year = {}
    for r in out:
        per_year[r['year']] = per_year.get(r['year'], 0) + 1
    print('imported:', per_year, '| explanations missing:', missing_expl)
    return 0


if __name__ == '__main__':
    sys.exit(main())
