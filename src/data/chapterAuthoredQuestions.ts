import type { QuestionItem } from './konkorData';

/**
 * تست‌های تألیفی فصل‌ها — «هیچ فصل بدون سؤال».
 *
 * هر فصلی از فصل‌های کلیدی کتاب‌ها که سؤال کنکور شناسنامه‌دار نداشت، سه تست
 * چهارگزینه‌ای تألیفی هم‌سطح آزمون ارشد (کد ۱۱۴۲) گرفته است؛ صورت سؤال و گزینه‌ها
 * از نکات و فرمول‌های همان فصل در bookChaptersBusiness / bookChaptersIndustrialTech
 * ساخته شده و با منابع شناخته‌شدهٔ همان کتاب هم‌خوان است.
 *
 * قواعد صداقت:
 * - این سؤال‌ها ترجمهٔ دفترچهٔ سازمان سنجش نیستند و نباید ادعای «کنکور سال X» داشته باشند؛
 *   برچسب آن‌ها در رابط کاربری «تست تألیفی فصل» است.
 * - کلید پاسخ، تشریح و دام هر سؤال فقط در رجیستری کلید سمت سرور worker
 *   (پوشهٔ apps/worker/src/data) زندگی می‌کند و هرگز به
 *   Bundle کلاینت نمی‌رود (R-036/R-025).
 * - sourceReference عمداً کلمهٔ «دکتری» ندارد تا شمارندهٔ پوشش دکتری دست‌کاری نشود.
 */

export const AUTHORED_QUESTION_PREFIX = 'q.auth.';

/** تشخیص تست تألیفی فصل از ترنسکریپت‌های دفترچهٔ کنکور */
export const isAuthoredQuestion = (question: Pick<QuestionItem, 'id'>): boolean =>
  question.id.startsWith(AUTHORED_QUESTION_PREFIX);

const ARSHAD_SOURCE = 'تألیف داخلی، هم‌سطح آزمون کارشناسی ارشد (کد ۱۱۴۲)';

/** قالب استاندارد هر مدخل تألیفی؛ هر جا که متفاوت نوشته نشده، همین پیش‌فرض‌ها اعمال می‌شوند. */
const authored = (
  id: string,
  overrides: {
    nodeId: string;
    referenceChapterId: string;
    text: string;
    options: [string, string, string, string];
    courseSectionId?: QuestionItem['courseSectionId'];
    expectedTimeMs?: number;
  }
): QuestionItem => ({
  id: `${AUTHORED_QUESTION_PREFIX}${id}`,
  nodeId: overrides.nodeId,
  examYear: 1405,
  sourceReference: ARSHAD_SOURCE,
  referenceChapterId: overrides.referenceChapterId,
  courseSectionId: overrides.courseSectionId,
  text: overrides.text,
  options: overrides.options,
  expectedTimeMs: overrides.expectedTimeMs ?? 50000,
});

export const CHAPTER_AUTHORED_QUESTIONS: QuestionItem[] = [
  /* ============================ بازاریابی (کاتلر) ============================ */

  // فصل ۱ — مفاهیم پایه، فلسفه‌های پنج‌گانه و هشت حالت تقاضا
  authored('kotler.1.1', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.1',
    courseSectionId: 'marketing',
    text: 'در کدام گزینه، حالت تقاضا و استراتژی متناظر آن به‌درستی جفت شده است؟',
    options: [
      "فقدان تقاضا ← بازاریابی ضدّی",
      "تقاضای بیش از حد ← بازاریابی تبدیلی",
      "تقاضای نامنظم ← بازاریابی هم‌زمان‌سازی (تعادل‌بخشی زمانی)",
      "تقاضای منفی ← بازاریابی تثبیتی",
    ],
  }),
  authored('kotler.1.2', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.1',
    courseSectionId: 'marketing',
    text: 'مفهوم «بازاریابی کل‌نگر» کدام چهار جزء را در کنار هم قرار می‌دهد؟',
    options: [
      "بخش‌بندی، هدف‌گذاری، جایگاه‌یابی و ترویج",
      "محیط خرد، محیط کلان، نظام اطلاعات و تحقیقات بازار",
      "محصول، قیمت، توزیع و ترویج",
      "بازاریابی رابطه‌مند، یکپارچه، درونی و عملکردی/اجتماعی",
    ],
  }),
  authored('kotler.1.3', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.1',
    courseSectionId: 'marketing',
    text: 'خطای «نزدیک‌بینی بازاریابی» لویت، خطر اصلی کدام فلسفهٔ مدیریت بازاریابی است؟',
    options: [
      "فلسفهٔ تولید؛ عشق به محصول و تولید، نیاز واقعی بازار را پنهان می‌کند",
      "فلسفهٔ فروش؛ فقط مسئله، ناتوانی در فروش است نه تولید",
      "فلسفهٔ بازاریابی؛ تمرکز بیش از حد بر نیاز مشتری",
      "فلسفهٔ بازاریابی کل‌نگر؛ پیچیدگی بیش از حد تصمیم‌گیری",
    ],
  }),

  // فصل ۸ — کانال توزیع، خرده‌فروشی و عمده‌فروشی
  authored('kotler.8.1', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.8',
    courseSectionId: 'marketing',
    text: 'در «کانال توزیع سطح صفر» چه اتفاقی می‌افتد؟',
    options: [
      "محصول فقط از طریق کانال‌های دیجیتال توزیع می‌شود",
      "تولیدکننده مستقیماً به مصرف‌کنندهٔ نهایی می‌فروشد و هیچ واسطه‌ای ندارد",
      "یک واسطهٔ خرده‌فروش میان تولیدکننده و مصرف‌کننده قرار می‌گیرد",
      "هم خرده‌فروش و هم عمده‌فروش در مسیر محصول قرار می‌گیرند",
    ],
  }),
  authored('kotler.8.2', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.8',
    courseSectionId: 'marketing',
    text: 'کدام گزینه کارکردهای اصلی کانال توزیع را به‌درستی فهرست می‌کند؟',
    options: [
      "تبلیغات، فروش شخصی، پیشبرد فروش و روابط عمومی",
      "تولید، انبارداری، بسته‌بندی و برچسب‌گذاری",
      "مذاکره، توزیع فیزیکی، تأمین مالی و پذیرش ریسک",
      "تحقیق بازار، بخش‌بندی، هدف‌گذاری و جایگاه‌یابی",
    ],
  }),
  authored('kotler.8.3', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.8',
    courseSectionId: 'marketing',
    text: 'سازنده‌ای که همهٔ بودجهٔ ترویج را صرف تبلیغات به مصرف‌کنندهٔ نهایی می‌کند تا او از واسطه بخواهد، کدام استراتژی را دنبال می‌کند؟',
    options: [
      "استراتژی فشاری (Push)",
      "استراتژی اختلاطی کانال",
      "استراتژی توزیع انحصاری",
      "استراتژی کششی (Pull)",
    ],
  }),

  // فصل ۹ — ارتباطات بازاریابی یکپارچه (IMC) و ترویج
  authored('kotler.9.1', {
    nodeId: 'mkt.consumer',
    referenceChapterId: 'ch.kotler.9',
    courseSectionId: 'marketing',
    text: 'برای آگاهی‌سازی گستردهٔ مخاطب با کنترل کم بر پیام، مناسب‌ترین ابزار ترویج کدام است؟',
    options: [
      "پیشبرد فروش",
      "بازاریابی مستقیم",
      "تبلیغات",
      "فروش شخصی",
    ],
  }),
  authored('kotler.9.2', {
    nodeId: 'mkt.consumer',
    referenceChapterId: 'ch.kotler.9',
    courseSectionId: 'marketing',
    text: 'روش بودجه‌بندی ترویج «هدف و وظیفه» چه منطقی دارد؟',
    options: [
      "بودجه بر پایهٔ درصدی ثابت از فروش گذشته تعیین می‌شود",
      "بودجه هم‌سطح هزینهٔ ترویج رقبای اصلی بسته می‌شود",
      "مبلغی که پس از پوشش همهٔ هزینه‌های دیگر باقی می‌ماند",
      "اول هدف ترویجی تعریف می‌شود، سپس وظایف لازم برای رسیدن به آن و در پایان هزینهٔ انجام وظایف برآورد می‌شود",
    ],
  }),
  authored('kotler.9.3', {
    nodeId: 'mkt.consumer',
    referenceChapterId: 'ch.kotler.9',
    courseSectionId: 'marketing',
    text: 'مدل AIDA ترتیب کدام مراحل را بیان می‌کند؟',
    options: [
      "توجه ← علاقه ← تمایل (اشتیاق) ← اقدام",
      "آگاهی ← ارزیابی ← تصمیم ← بازگشت",
      "نیاز ← جست‌وجو ← خرید ← وفاداری",
      "انگیزه ← توانایی ← فرصت ← رفتار",
    ],
  }),

  // فصل ۱۰ — بازاریابی خدمات، رابطه‌مند و دیجیتال
  authored('kotler.10.1', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.10',
    courseSectionId: 'marketing',
    text: 'ویژگی «تفکیک‌ناپذیری» در خدمات به معنای چیست؟',
    options: [
      "خدمت را نمی‌توان پیش از مصرف انبار کرد",
      "خدمت قابل لمس و مشاهدهٔ فیزیکی نیست",
      "تولید و مصرف خدمت هم‌زمان رخ می‌دهند و قابل جدا شدن از هم نیستند",
      "کیفیت خدمت از ارائه‌دهنده‌ای به ارائه‌دهندهٔ دیگر تغییر می‌کند",
    ],
  }),
  authored('kotler.10.2', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.10',
    courseSectionId: 'marketing',
    text: 'در مدل شکاف‌های کیفیت خدمت پاراسورامان، شکاف نخست (شکاف ۱) کجاست؟',
    options: [
      "میان مشخصات خدمت تعیین‌شده و کیفیت خدمت رسانی‌شده",
      "میان خدمت رسانی‌شده و آنچه به بیرون اعلام می‌شود",
      "میان خدمت ادراک‌شده و خدمت مورد انتظار مشتری",
      "میان انتظار واقعی مشتری و درک مدیریت از همان انتظار",
    ],
  }),
  authored('kotler.10.3', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.10',
    courseSectionId: 'marketing',
    text: 'در بازاریابی رابطه‌مند، «ارزش عمر مشتری (CLV)» چه چیزی را می‌سنجد؟',
    options: [
      "مجموع حاشیهٔ سود یک مشتری در کل طول رابطه، منهای هزینهٔ جذب و نگهداشت او",
      "سهم یک مشتری از کل فروش بازار در یک سال مالی",
      "درصد مشتریانی که پس از اولین خرید دوباره خرید می‌کنند",
      "میزان افزایش قیمت که مشتری حاضر است بپذیرد",
    ],
  }),

  /* ============================ زبان تخصصی مدیریت ============================ */

  // فصل ۲ — هم‌آیندها (Collocations) و اصطلاحات ثابت
  authored('eng.2.1', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.2',
    courseSectionId: 'english',
    text: 'کدام گزینه یک ترکیب ثابت درست (Collocation) در متون مدیریت است؟',
    options: [
      "meet a deadline",
      "catch a deadline",
      "win a deadline",
      "succeed a deadline",
    ],
    expectedTimeMs: 40000,
  }),
  authored('eng.2.2', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.2',
    courseSectionId: 'english',
    text: 'فعل عبارتی «phase out» در متون مدیریت چه معنایی دارد؟',
    options: [
      "برنامه‌ریزی مرحله‌به‌مرحله برای عرضهٔ محصول",
      "حذف یا کنار گذاشتن تدریجی یک محصول یا فرایند",
      "گسترش سریع فعالیت در بازارهای جدید",
      "شروع رسمی و هم‌زمان یک طرح در کل سازمان",
    ],
  }),
  authored('eng.2.3', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.2',
    courseSectionId: 'english',
    text: 'ترکیب ثابت «bear the cost» در ترجمهٔ دقیق چه مفهومی دارد؟',
    options: [
      "تحمیل هزینه به طرف مقابل",
      "کاهش تدریجی یک هزینهٔ ثابت",
      "بر عهده گرفتن و متقبل شدن هزینه",
      "حمل فیزیکی بار و هزینهٔ حمل",
    ],
  }),

  // فصل ۳ — زمان‌ها و تطابق فاعل و فعل
  authored('eng.3.1', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.3',
    courseSectionId: 'english',
    text: 'جای خالی کدام گزینه است؟ «Since 2020, the company ______ its product line.»',
    options: [
      "was expanding",
      "has expanded",
      "expands",
      "is expanding",
    ],
    expectedTimeMs: 45000,
  }),
  authored('eng.3.2', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.3',
    courseSectionId: 'english',
    text: 'کدام گزینه تطابق فاعل و فعل درست است؟',
    options: [
      "A number of applicants is applying today.",
      "Neither the managers nor the CEO were informed.",
      "The number of applicants is increasing.",
      "The number of applicants are increasing.",
    ],
  }),
  authored('eng.3.3', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.3',
    courseSectionId: 'english',
    text: 'در ساختار «neither … nor» فعل مطابق کدام فاعل است؟',
    options: [
      "مطابق فاعل اول جمله",
      "همیشه مفرد، بدون توجه به فاعل‌ها",
      "همیشه جمع، بدون توجه به فاعل‌ها",
      "مطابق فاعل نزدیک‌تر به فعل (دومین فاعل)",
    ],
  }),

  // فصل ۴ — وارونگی و ساختارهای تأکیدی
  authored('eng.4.1', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.4',
    courseSectionId: 'english',
    text: 'جای خالی کدام گزینه است؟ «Rarely ______ such a rapid decline in consumer demand.»',
    options: [
      "the market did see",
      "did the market saw",
      "has the market seen",
      "the market has seen",
    ],
  }),
  authored('eng.4.2', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.4',
    courseSectionId: 'english',
    text: 'جای خالی کدام گزینه است؟ «No sooner had the merger been announced ______.»',
    options: [
      "when the shares rose sharply",
      "that the shares rose sharply",
      "then the shares rose sharply",
      "than the shares rose sharply",
    ],
  }),
  authored('eng.4.3', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.4',
    courseSectionId: 'english',
    text: 'کدام جمله با ساختار «Not only … but also» درست نوشته شده است؟',
    options: [
      "Not only did they miss the deadline, but they also lost the client.",
      "Not only they missed the deadline, but they also lost the client.",
      "Not only did they missed the deadline, but they also lost the client.",
      "Not only did they miss the deadline, but they also did lose of the client.",
    ],
  }),

  // فصل ۶ — معلوم، مجهول و نقل قول
  authored('eng.6.1', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.6',
    courseSectionId: 'english',
    text: 'در جملهٔ «The data were collected over six months.» چرا فعل جمع است؟',
    options: [
      "چون در انگلیسی آکادمیک، «data» همیشه جمع به حساب می‌آید",
      "چون «data» در انگلیسی همیشه مفرد است و این جمله غلط است",
      "چون فعل مجهول همیشه جمع می‌گیرد",
      "چون قید زمان گذشته جمع است",
    ],
  }),
  authored('eng.6.2', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.6',
    courseSectionId: 'english',
    text: 'معادل نقل قول غیرمستقیم درست کدام است؟ «She said, “I am busy today.”»',
    options: [
      "She said (that) I am busy that day.",
      "She said (that) she was busy that day.",
      "She said (that) she is busy today.",
      "She said (that) she was busy today.",
    ],
  }),
  authored('eng.6.3', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.6',
    courseSectionId: 'english',
    text: 'افعال گزارشی مانند «claim»، «argue» و «suggest» پس از خود چه ساختاری می‌پذیرند؟',
    options: [
      "حرف اضافهٔ «to» و سپس اسم",
      "جملهٔ شرطی نوع دوم",
      "جملهٔ موصولی با «that» (that-clause)",
      "مصدر با «to» به‌صورت اجباری در همهٔ حالت‌ها",
    ],
  }),

  // فصل ۷ — کلوز تست: تکنیک و حذف گزینه
  authored('eng.7.1', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.7',
    courseSectionId: 'english',
    text: 'اولین گام صحیح برای حل یک کلوز تست چیست؟',
    options: [
      "شمارش جای خالی‌ها برای برآورد زمان پاسخ‌دهی",
      "خواندن کل پاراگراف برای تشخیص موضوع کلی متن",
      "پر کردن فوری جای خالی‌های نزدیک به ابتدای متن",
      "بررسی گزینه‌ها قبل از هرگونه خواندن متن",
    ],
  }),
  authored('eng.7.2', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.7',
    courseSectionId: 'english',
    text: 'در کلوز تست، نوع کلمهٔ لازم برای هر جای خالی بر چه مبنایی تعیین می‌شود؟',
    options: [
      "بر طول کلمه‌های اطراف جای خالی",
      "بر ترتیب الفبایی گزینه‌های ارائه‌شده",
      "بر جایگاه دستوری آن در جمله: اسم، فعل، صفت یا حرف اضافه",
      "بر بسامد استفادهٔ آن واژه در متون مدیریت",
    ],
  }),
  authored('eng.7.3', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.7',
    courseSectionId: 'english',
    text: 'شایع‌ترین دام گزینه‌ها در کلوز تست کدام است؟',
    options: [
      "گزینه‌های دارای غلط املایی آشکار",
      "گزینه‌هایی که طولانی‌تر از بقیه‌اند",
      "گزینه‌های تکراری با معادل فارسی یکسان",
      "گزینه‌های هم‌معنا با حرف اضافهٔ متفاوت",
    ],
  }),

  // فصل ۹ — درک مطلب: ایدهٔ اصلی، عنوان و نگرش نویسنده
  authored('eng.9.1', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.9',
    courseSectionId: 'english',
    text: 'یک عنوان خوب برای متن درک مطلب باید کدام ویژگی را داشته باشد؟',
    options: [
      "کوتاه‌ترین گزینهٔ فهرست عنوان‌ها باشد",
      "کلمه‌های عین متن را بدون تغییر تکرار کند",
      "دیدگاه شخصی داوطلب دربارهٔ موضوع را نشان دهد",
      "کل متن را پوشش دهد، نه فقط یک جزئیات را",
    ],
  }),
  authored('eng.9.2', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.9',
    courseSectionId: 'english',
    text: 'ایدهٔ اصلی یک پاراگراف آکادمیک معمولاً کجا قرار دارد؟',
    options: [
      "در جملهٔ اول یا آخر پاراگراف",
      "فقط در وسط پاراگراف، زیر مثال‌ها",
      "پراکنده در همهٔ جمله‌ها با وزن یکسان",
      "همیشه در پاراگراف آخر متن",
    ],
  }),
  authored('eng.9.3', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.9',
    courseSectionId: 'english',
    text: 'قید «unfortunately» در متن نشانگر کدام ویژگی نویسنده است؟',
    options: [
      "تردید در اعتبار ادعا",
      "نگرش منفی نسبت به موضوع",
      "نگرش خنثی و بی‌طرف کاملاً علمی",
      "نگرش مثبت و تأییدکننده",
    ],
  }),

  /* ============================ تئوری‌های مدیریت ============================ */

  // فصل ۱ — مکاتب مدیریت: کلاسیک تا اقتضایی
  authored('th.1.1', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.1',
    courseSectionId: 'management_theories',
    text: 'بوروکراسی وبر بر کدام نوع اقتدار استوار است؟',
    options: [
      "اقتدار مبتنی بر مالکیت سرمایه",
      "اقتدار قانونی-عقلایی",
      "اقتدار سنتی",
      "اقتدار کاریزماتیک",
    ],
    expectedTimeMs: 40000,
  }),
  authored('th.1.2', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.1',
    courseSectionId: 'management_theories',
    text: 'ترتیب تاریخی صحیح مکاتب مدیریت کدام است؟',
    options: [
      "کلاسیک ← کمی ← نئوکلاسیک ← اقتضایی ← سیستمی",
      "سیستمی ← کلاسیک ← کمی ← نئوکلاسیک ← اقتضایی",
      "کلاسیک ← نئوکلاسیک (روابط انسانی) ← کمی ← سیستمی ← اقتضایی",
      "نئوکلاسیک ← کلاسیک ← سیستمی ← کمی ← اقتضایی",
    ],
  }),
  authored('th.1.3', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.1',
    courseSectionId: 'management_theories',
    text: 'کدام گزینه چهار ویژگی اصلی بوروکراسی وبر را به‌درستی فهرست می‌کند؟',
    options: [
      "انعطاف، تمرکززدایی، تیم‌محوری و نوآوری",
      "شهود، رضایت‌بخشی، عقلانیت محدود و مشارکت",
      "تفکیک، یکپارچگی، تناسب و بازخورد",
      "تقسیم کار، سلسله‌مراتب، قواعد مکتوب و غیرشخصی بودن",
    ],
  }),

  // فصل ۳ — برنامه‌ریزی، تصمیم‌گیری و مدل‌های آن
  authored('th.3.1', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.3',
    courseSectionId: 'management_theories',
    text: 'مدل رفتاری تصمیم‌گیری سایمون، مدل عقلایی را به چه دلیلی رد می‌کند؟',
    options: [
      "اطلاعات در محیط همیشه کامل و بی‌نقص است",
      "مدیر همیشه گزینهٔ بهینه را از میان گزینه‌های شناخته‌شده انتخاب می‌کند",
      "تصمیم‌گیری فقط یک فرایند سیاسی است و هیچ چارچوب عقلی ندارد",
      "عقلانیت انسان محدود است و مدیر به‌جای بهینه‌یابی، گزینهٔ رضایت‌بخش را انتخاب می‌کند",
    ],
  }),
  authored('th.3.2', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.3',
    courseSectionId: 'management_theories',
    text: '«مدیریت بر پایهٔ هدف‌گذاری (MBO)» را کدام گزینه به‌درستی توصیف می‌کند؟',
    options: [
      "هدف‌گذاری مشترک مدیر و کارمند و سنجش عملکرد بر اساس همان اهداف",
      "برنامه‌ریزی بر پایهٔ مدیریت موارد استثنا از روال عادی",
      "برنامه‌ریزی سناریو برای محیط‌های پرنوسان",
      "تصمیم‌گیری گروهی بدون نقش مدیر در تعیین هدف",
    ],
  }),
  authored('th.3.3', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.3',
    courseSectionId: 'management_theories',
    text: 'نخستین گام مدل عقلایی تصمیم‌گیری کدام است؟',
    options: [
      "اجرا و ارزیابی نتیجه",
      "شناخت و تعریف مسئله",
      "تولید و ارزیابی گزینه‌ها",
      "وزن‌دهی به معیارها",
    ],
  }),

  // فصل ۴ — ساختار سازمانی: پیچیدگی، رسمیت و تمرکز
  authored('th.4.1', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.4',
    courseSectionId: 'management_theories',
    text: 'سه بُعد اصلی ساختار سازمانی از دید رابینز کدام‌اند؟',
    options: [
      "پیچیدگی، رسمیت و تمرکز",
      "اندازه، فناوری و محیط",
      "استراتژی، فرهنگ و قدرت",
      "بخش‌بندی، سلسله‌مراتب و درجهٔ رسمی بودن قواعد",
    ],
  }),
  authored('th.4.2', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.4',
    courseSectionId: 'management_theories',
    text: 'در پیکربندی ادهوکراسی مینتزبرگ، مکانیزم هماهنگی غالب کدام است؟',
    options: [
      "استانداردسازی برون‌داد",
      "هماهنگی متقابل",
      "نظارت مستقیم",
      "استانداردسازی کار",
    ],
  }),
  authored('th.4.3', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.4',
    courseSectionId: 'management_theories',
    text: '«تفکیک افقی» در ساختار سازمانی به معنای چیست؟',
    options: [
      "پراکنده‌سازی واحدها در مکان‌های جغرافیایی مختلف",
      "تفکیک واحد تصمیم‌گیری از واحد اجرا",
      "تقسیم کار در سطح وظایف و تخصص‌ها",
      "تفکیک قدرت در سطوح عمودی سلسله‌مراتب",
    ],
  }),

  // فصل ۶ — فرهنگ سازمانی: شاین، دنیسون و اوچی
  authored('th.6.1', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.6',
    courseSectionId: 'management_theories',
    text: 'سه سطح فرهنگ سازمانی از دید شاین کدام‌اند؟',
    options: [
      "قوی، ضعیف و میانه",
      "اعتقادی، اخلاقی و رفتاری",
      "مصنوعات، ارزش‌های حمایت‌شده و فرض‌های بنیادین",
      "پایه، کلیدی، پیشرو",
    ],
  }),
  authored('th.6.2', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.6',
    courseSectionId: 'management_theories',
    text: 'تغییرناپذیرترین لایهٔ فرهنگ سازمانی کدام است؟',
    options: [
      "مصنوعات",
      "شعارها و نمادهای ظاهری",
      "ارزش‌های اعلام‌شده در بروشورها",
      "فرض‌های بنیادین",
    ],
  }),
  authored('th.6.3', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.6',
    courseSectionId: 'management_theories',
    text: 'در چارچوب ارزش‌های رقابتی، چهار فرهنگ کدام‌اند؟',
    options: [
      "قبیله‌ای، ادهوکراسی، بازاری و سلسله‌مراتبی",
      "مأموریتی، کارآفرینانه، سیستمی و آینده‌نگر",
      "کلان، خرد، میانی و گروهی",
      "مکانیکی، ارگانیک، ماتریسی و شبکه‌ای",
    ],
  }),

  // فصل ۷ — انگیزش: نظریه‌های محتوایی و فرایندی
  authored('th.7.1', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.7',
    courseSectionId: 'management_theories',
    text: 'در نظریهٔ هرزبرگ، حقوق و شرایط کاری جزو کدام دسته‌اند؟',
    options: [
      "عوامل انگیزاننده که مستقیماً رضایت ایجاد می‌کنند",
      "نیازهای سطح پایین مازلو",
      "عوامل پیشرفت و قدردانی",
      "عوامل بهداشتی که نارضایتی را از بین می‌برند اما انگیزه نمی‌سازند",
    ],
  }),
  authored('th.7.2', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.7',
    courseSectionId: 'management_theories',
    text: 'هستهٔ نظریهٔ برابری آدامز چیست؟',
    options: [
      "مقایسهٔ نسبت داده و ستاندهٔ خود با نسبت داده و ستاندهٔ دیگران",
      "محاسبهٔ احتمال موفقیت ضرب در ارزش پاداش",
      "رتبه‌بندی نیازها در هرم پنج‌طبقه‌ای",
      "تقویت رفتار مثبت با پاداش بیرونی",
    ],
  }),
  authored('th.7.3', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.7',
    courseSectionId: 'management_theories',
    text: 'سه مؤلفهٔ نظریهٔ انتظار وروم کدام‌اند؟',
    options: [
      "قابلیت، تعهد و بازخورد",
      "انتظار، وسیلهٔ ارتباط (instrumentality) و ارزش (valence)",
      "نیاز، انگیزه و رفتار",
      "خطا، مکمل و پیامد",
    ],
  }),

  // فصل ۸ — رهبری: اقتضایی تا تحول‌آفرین
  authored('th.8.1', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.8',
    courseSectionId: 'management_theories',
    text: 'الگوی هرسی و بلانچارد سبک رهبری را بر پایهٔ کدام متغیر تعیین می‌کند؟',
    options: [
      "بلوغ (آمادگی) پیرو",
      "قدرت جایگاه رهبر",
      "پیچیدگی فناوری سازمان",
      "درجهٔ رسمیت ساختار",
    ],
  }),
  authored('th.8.2', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.8',
    courseSectionId: 'management_theories',
    text: 'هستهٔ رهبری تعاملی (تبادلی) چیست؟',
    options: [
      "حذف کامل مذاکره و قرارداد شفاهی",
      "تبادل پاداش و منفعت در برابر عملکرد و پیروی از کارکنان",
      "الهام‌بخشی با چشم‌انداز و انگیزش فراتر از منافع فردی",
      "ملاحظات فردی و محرک فکری پیروان",
    ],
  }),
  authored('th.8.3', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.8',
    courseSectionId: 'management_theories',
    text: 'در الگوی فیدلر، «کنترل موقعیتی» از کدام سه عنصر ساخته می‌شود؟',
    options: [
      "اندازه گروه، فناوری و محیط رقابتی",
      "فرهنگ سازمان، استراتژی و ساختار",
      "روابط رهبر-عضو، ساختار وظیفه و قدرت جایگاه",
      "بلوغ پیرو، انگیزهٔ رهبر و منابع سازمان",
    ],
  }),

  // فصل ۹ — گروه‌ها، تیم‌ها، ارتباطات و تعارض
  authored('th.9.1', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.9',
    courseSectionId: 'management_theories',
    text: 'ترتیب صحیح مراحل شکل‌گیری تیم از دید تاکمن کدام است؟',
    options: [
      "هنجارسازی ← تشکیل ← اجرا ← طوفانی ← انحلال",
      "تشکیل ← طوفانی ← هنجارسازی ← اجرا ← انحلال",
      "طوفانی ← تشکیل ← اجرا ← هنجارسازی ← انحلال",
      "تشکیل ← هنجارسازی ← طوفانی ← انحلال ← اجرا",
    ],
  }),
  authored('th.9.2', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.9',
    courseSectionId: 'management_theories',
    text: 'کدام شیوهٔ برخورد با تعارض راه‌حل «برد-برد» با تمرکز بر منافع هر دو طرف است؟',
    options: [
      "سازش",
      "اجتناب",
      "همکاری",
      "رقابت",
    ],
  }),
  authored('th.9.3', {
    nodeId: 'mb.culture',
    referenceChapterId: 'ch.th.9',
    courseSectionId: 'management_theories',
    text: 'شبکهٔ ارتباط غیررسمی در سازمان چه نقشی دارد؟',
    options: [
      "جایگزین رسمی برای کل سلسله‌مراتب ارتباطی",
      "مکانیزم کنترلی ثبت‌شدهٔ رسمی سازمان",
      "مسیر اصلی توزیع دستورهای اجرایی",
      "مکمل ارتباط رسمی و مسیر سریع انتقال اطلاعات (حتی به شکل شایعه)",
    ],
  }),

  /* ============================ اقتصاد خرد و کلان ============================ */

  // فصل ۱ — عرضه، تقاضا و تعادل بازار
  authored('econ.1.1', {
    nodeId: 'bus.econ_nazari',
    referenceChapterId: 'ch.econ.1',
    courseSectionId: 'economics',
    text: 'کدام عامل منحنی تقاضا را جابه‌جا می‌کند (نه حرکت روی منحنی)؟',
    options: [
      "افزایش مقدار عرضه در تعادل",
      "کاهش قیمت کالای مکمل بدون تغییر هیچ متغیر دیگری از تقاضا",
      "افزایش درآمد مصرف‌کننده",
      "کاهش قیمت خود کالا",
    ],
  }),
  authored('econ.1.2', {
    nodeId: 'bus.econ_nazari',
    referenceChapterId: 'ch.econ.1',
    courseSectionId: 'economics',
    text: 'تعیین سقف قیمت زیر قیمت تعادل چه پیامدی دارد؟',
    options: [
      "مازاد عرضه",
      "حذف صف‌ها و انتظار",
      "افزایش تولید در تعادل",
      "کمبود کالا در بازار",
    ],
  }),
  authored('econ.1.3', {
    nodeId: 'bus.econ_nazari',
    referenceChapterId: 'ch.econ.1',
    courseSectionId: 'economics',
    text: 'تعیین کف قیمت بالاتر از قیمت تعادل چه نتیجه‌ای دارد؟',
    options: [
      "مازاد عرضه و کاهش مقدار خریداری‌شده",
      "کمبود و صف خریدار",
      "کاهش هزینهٔ دولت برای حمایت",
      "افزایش رفاه مصرف‌کننده در همهٔ حالت‌ها",
    ],
  }),

  // فصل ۶ — رقابت انحصاری، انحصار چندجانبه و نظریهٔ بازی
  authored('econ.6.1', {
    nodeId: 'bus.econ_nazari',
    referenceChapterId: 'ch.econ.6',
    courseSectionId: 'economics',
    text: 'در رقابت انحصاری در بلندمدت، سود اقتصادی صفر می‌شود اما بنگاه «ظرفیت مازاد» دارد؛ علت کدام است؟',
    options: [
      "هزینهٔ ثابت بنگاه صفر است",
      "قیمت بنگاه همیشه برابر هزینهٔ نهایی است",
      "ورود بنگاه‌های جدید ناممکن است",
      "منحنی تقاضای شیب‌دار بنگاه در سمت چپ حداقل میانگین هزینه با آن مماس می‌شود",
    ],
  }),
  authored('econ.6.2', {
    nodeId: 'bus.econ_nazari',
    referenceChapterId: 'ch.econ.6',
    courseSectionId: 'economics',
    text: 'منحنی تقاضای شکسته در انحصار چندجانبه چه مفهومی دارد؟',
    options: [
      "رقبا با کاهش قیمت همراهی می‌کنند اما با افزایش قیمت همراهی نمی‌کنند؛ پس قیمت به‌سختی تغییر می‌کند",
      "رقبا با افزایش قیمت همراهی می‌کنند اما با کاهش قیمت همراهی نمی‌کنند",
      "تقاضای بازار همیشه کشش بی‌نهایت دارد",
      "قیمت رقبا مستقل از تصمیم بنگاه تعیین می‌شود",
    ],
  }),
  authored('econ.6.3', {
    nodeId: 'bus.econ_nazari',
    referenceChapterId: 'ch.econ.6',
    courseSectionId: 'economics',
    text: '«تعادل نش» را کدام گزینه به‌درستی تعریف می‌کند؟',
    options: [
      "نقطه‌ای که بازیگر با انحراف، بیشترین سود ممکن را می‌گیرد",
      "مجموعه‌ای از استراتژی‌ها که هیچ بازیگری با انحراف یک‌طرفه از آن بهبود نمی‌یابد",
      "نقطه‌ای که همهٔ بازیگران سود صفر دارند",
      "همکاری کامل بازیگران برای بیشینه‌سازی سود مشترک",
    ],
  }),

  // فصل ۹ — AD-AS، تورم، بیکاری و منحنی فیلیپس
  authored('econ.9.1', {
    nodeId: 'bus.econ_nazari',
    referenceChapterId: 'ch.econ.9',
    courseSectionId: 'economics',
    text: 'شوک منفی عرضه (مثلاً افزایش جهانی قیمت نفت) چه پیامدی دارد؟',
    options: [
      "کاهش بیکاری با ثابت‌ماندن قیمت",
      "افزایش تولید با نرخ طبیعی بیکاری",
      "رکود تورمی: افزایش سطح قیمت هم‌زمان با کاهش تولید",
      "رشد تولید همراه با کاهش قیمت",
    ],
  }),
  authored('econ.9.2', {
    nodeId: 'bus.econ_nazari',
    referenceChapterId: 'ch.econ.9',
    courseSectionId: 'economics',
    text: 'منحنی فیلیپس بلندمدت چه شکلی دارد؟',
    options: [
      "نزولی با شیب ثابت",
      "افقی در سطح تورم صفر",
      "صعودی با شیب افزایشی",
      "عمودی در نرخ طبیعی بیکاری",
    ],
  }),
  authored('econ.9.3', {
    nodeId: 'bus.econ_nazari',
    referenceChapterId: 'ch.econ.9',
    courseSectionId: 'economics',
    text: 'بیکاری ادواری ناشی از چیست؟',
    options: [
      "افت تقاضای کل و رکود اقتصاد در دورهٔ نزولی",
      "ناهماهنگی مهارت کارکنان با شغل‌های موجود",
      "انتقال بین‌شغلی کارجویان و زمان جست‌وجو",
      "ساختار فناوری تولید در بلندمدت",
    ],
  }),

  /* ============================ ریاضی و آمار ============================ */

  // فصل ۳ — مشتق و کاربرد اقتصادی آن
  authored('math.3.1', {
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    referenceChapterId: 'ch.math.3',
    courseSectionId: 'math_stats',
    text: 'شرط بهینه‌بودن سود یک بنگاه کدام است؟',
    options: [
      "$TR = TC$",
      "$MR = MC$ همراه با آزمون مرتبهٔ دوم",
      "$MR = 0$",
      "$MC = AC$",
    ],
  }),
  authored('math.3.2', {
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    referenceChapterId: 'ch.math.3',
    courseSectionId: 'math_stats',
    text: 'کشش قیمتی تقاضا ($E$) برای کالای معمولی چه علامتی دارد و چرا؟',
    options: [
      "صفر؛ چون تقاضا مستقل از قیمت است",
      "بی‌نهایت؛ چون هر تغییر قیمت تقاضا را حذف می‌کند",
      "منفی؛ چون تقاضا با قیمت رابطهٔ معکوس دارد",
      "مثبت؛ چون افزایش قیمت تقاضا را افزایش می‌دهد",
    ],
  }),
  authored('math.3.3', {
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    referenceChapterId: 'ch.math.3',
    courseSectionId: 'math_stats',
    text: 'مشتق‌گیری لگاریتمی بیشتر برای کدام نوع تابع کاربرد دارد؟',
    options: [
      "توابع خطی ساده مانند $y = 3x + 2$",
      "توابع چندجمله‌ای معمولی مانند $y = x^3$",
      "توابع ثابت مانند $y = 5$",
      "توابعی که متغیر در پایه و در توان هر دو ظاهر می‌شوند، مانند $y = x^x$",
    ],
  }),

  // فصل ۴ — انتگرال و کاربرد آن
  authored('math.4.1', {
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    referenceChapterId: 'ch.math.4',
    courseSectionId: 'math_stats',
    text: 'هزینهٔ کل از تابع هزینهٔ نهایی چگونه بازیابی می‌شود؟',
    options: [
      "با انتگرال‌گیری از درآمد کل",
      "با ضرب هزینهٔ نهایی در مقدار تولید",
      "با انتگرال‌گیری از هزینهٔ نهایی و افزودن ثابت هزینهٔ ثابت",
      "با مشتق‌گیری از هزینهٔ نهایی",
    ],
  }),
  authored('math.4.2', {
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    referenceChapterId: 'ch.math.4',
    courseSectionId: 'math_stats',
    text: '«مازاد مصرف‌کننده» در نمودار تقاضا کدام ناحیه است؟',
    options: [
      "سطح زیر منحنی عرضه تا قیمت بازار",
      "فاصلهٔ میان قیمت و هزینهٔ نهایی در نقطهٔ تعادل",
      "کل سطح زیر منحنی تقاضا بدون کسر پرداخت",
      "سطح زیر منحنی تقاضا تا قیمت بازار، منهای هزینهٔ واقعی پرداختی مصرف‌کننده",
    ],
  }),
  authored('math.4.3', {
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    referenceChapterId: 'ch.math.4',
    courseSectionId: 'math_stats',
    text: 'برای $n \\neq -1$ حاصل $\\int x^n dx$ کدام است؟',
    options: [
      "$\\dfrac{x^{n+1}}{n+1} + C$",
      "$\\dfrac{x^{n-1}}{n-1} + C$",
      "$n x^{n-1} + C$",
      "$\\ln(x) + C$",
    ],
  }),

  // فصل ۸ — توزیع‌های گسسته و پیوسته
  authored('math.8.1', {
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    referenceChapterId: 'ch.math.8',
    courseSectionId: 'math_stats',
    text: 'برای مدل‌سازی «تعداد رخداد یک اتفاق در واحد زمان با نرخ ثابت» کدام توزیع مناسب است؟',
    options: [
      "توزیع نرمال",
      "توزیع یکنواخت",
      "توزیع پواسون",
      "توزیع دوجمله‌ای",
    ],
  }),
  authored('math.8.2', {
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    referenceChapterId: 'ch.math.8',
    courseSectionId: 'math_stats',
    text: 'شرط کاربرد توزیع دوجمله‌ای کدام است؟',
    options: [
      "نرخ رخداد در زمان ثابت است و آزمایش بی‌پایان ادامه دارد",
      "فقط دو نتیجهٔ ممکن در یک آزمایش واحد وجود دارد",
      "میانگین و واریانس متغیر تصادفی برابرند",
      "تعداد آزمایش‌ها ثابت، نتیجهٔ هر آزمایش دوحالته و آزمایش‌ها مستقل با احتمال ثابت",
    ],
  }),
  authored('math.8.3', {
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    referenceChapterId: 'ch.math.8',
    courseSectionId: 'math_stats',
    text: 'رابطهٔ استانداردسازی $Z = (X - \\mu)/\\sigma$ چه کاربردی دارد؟',
    options: [
      "تبدیل هر متغیر نرمال به توزیع نرمال استاندارد برای استفاده از جدول Z",
      "تبدیل هر توزیع به توزیع پواسون",
      "محاسبهٔ واریانس نمونه از دامنهٔ داده‌ها",
      "برآورد میانگین جامعه از میانگین نمونه",
    ],
  }),

  /* ============================ مدیریت اسلامی ============================ */

  // فصل ۲ — انسان‌شناسی و نظام ارزش‌ها
  authored('isl.2.1', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.2',
    courseSectionId: 'islamic',
    text: 'سه لایهٔ نظام ارزش‌ها در مدیریت اسلامی کدام‌اند؟',
    options: [
      "فردی، گروهی و سازمانی",
      "مادی، حقوقی و سیاسی",
      "اعتقادی، اخلاقی و رفتاری",
      "اقتصادی، اجتماعی و فرهنگی",
    ],
  }),
  authored('isl.2.2', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.2',
    courseSectionId: 'islamic',
    text: 'نقش نیت در نظام ارزش‌گذاری عمل چیست؟',
    options: [
      "نیت تنها در عبادت‌های فردی نقش دارد",
      "نیت پس از نتیجهٔ عمل اهمیت پیدا می‌کند",
      "نیت جایگزین خود عمل می‌شود",
      "مبنای ارزش‌گذاری هر عمل، نیت فاعل آن است نه صرفاً ظاهر رفتار",
    ],
  }),
  authored('isl.2.3', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.2',
    courseSectionId: 'islamic',
    text: 'نگاه به انسان دو بعدی (مادی و معنوی) در مدیریت اسلامی چه پیامد عملی دارد؟',
    options: [
      "سازوکارهای انگیزش و کنترل باید هم نیازهای مادی و هم نیازهای معنوی را پوشش دهند",
      "نیازهای مادی به‌کلی نادیده گرفته می‌شوند",
      "تنها بهره‌وری اقتصادی ملاک ارزیابی کار است",
      "کنترل بیرونی جایگزین کامل خودکنترلی می‌شود",
    ],
  }),

  // فصل ۳ — برنامه‌ریزی و تصمیم‌گیری در مدیریت اسلامی
  authored('isl.3.1', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.3',
    courseSectionId: 'islamic',
    text: 'بر اساس الگوی تصمیم‌گیری قرآنی، پس از انجام مشورت با خبرگان، مسئولیت عزم و تصمیم نهایی با کیست؟',
    options: [
      "با رأی اکثریت اعضای شورا به‌صورت الزام‌آور",
      "با کارشناسانی که مشورت را اجرا کرده‌اند",
      "با هیچ‌کس؛ تصمیم باید به زمان حواله شود",
      "با شخص مدیر و رهبر سازمان، همراه با توکل بر خداوند",
    ],
  }),
  authored('isl.3.2', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.3',
    courseSectionId: 'islamic',
    text: 'برنامه‌ریزی در مدیریت اسلامی بر چه سه پایه‌ای استوار است؟',
    options: [
      "شناخت واقعیت، هدف‌گذاری ارزشی و مشورت",
      "سود حداکثری، بازار رقابتی و فروش",
      "دستور بالادستی، نظارت بیرونی و بازرسی",
      "شهود فردی، تجربهٔ شخصی و رسمیت ساختاری",
    ],
  }),
  authored('isl.3.3', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.3',
    courseSectionId: 'islamic',
    text: '«توکل» در مدیریت اسلامی را کدام گزینه به‌درستی تعریف می‌کند؟',
    options: [
      "اتکای صرف به تجربهٔ گذشته مدیران",
      "اعتماد به خداوند پس از تدبیر و تلاش، نه به‌جای آن",
      "واگذاری کامل برنامه‌ریزی به سرنوشت",
      "پرهیز از هرگونه پیش‌بینی و سناریوسازی",
    ],
  }),

  // فصل ۴ — سازماندهی: تقسیم کار، وحدت فرماندهی و اخوت
  authored('isl.4.1', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.4',
    courseSectionId: 'islamic',
    text: 'اصل «تکلیف به قدر وسع» در سازماندهی اسلامی یعنی چه؟',
    options: [
      "مسئولیت هر فرد متناسب با توان او تعیین می‌شود",
      "همهٔ افراد مسئولیت یکسانی می‌گیرند",
      "مسئولیت بر پایهٔ روابط شخصی توزیع می‌شود",
      "بار کاری افراد بی‌نهایت و آزادانه تعیین می‌شود",
    ],
  }),
  authored('isl.4.2', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.4',
    courseSectionId: 'islamic',
    text: 'سپردن مسئولیت در الگوی اسلامی بر چه اساسی انجام می‌شود؟',
    options: [
      "قرعه و تناوب میان همهٔ کارکنان",
      "اصل شایستگی و امانت‌داری متقاضی مسئولیت",
      "قدمت استخدام و سابقهٔ کاری صرف",
      "توصیه و رابطهٔ فامیلی",
    ],
  }),
  authored('isl.4.3', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.4',
    courseSectionId: 'islamic',
    text: 'در الگوی اسلامی، «وحدت فرماندهی» با کدام نگرش هم‌سو است؟',
    options: [
      "حذف کامل سلسله‌مراتب و برابری همهٔ مناصب",
      "افزایش تعداد مراجع فرماندهی برای تسریع کار",
      "پرهیز از تضاد مراجع دستور، همراه با اخوت و پرهیز از تکبر مدیریتی",
      "تمرکز مطلق قدرت در دست یک نفر بدون نظارت",
    ],
  }),

  // فصل ۵ — مدیریت منابع انسانی اسلامی و شایسته‌سالاری
  authored('isl.5.1', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.5',
    courseSectionId: 'islamic',
    text: 'گزینش کارگزار در سیرهٔ علوی بر پایهٔ کدام ویژگی است؟',
    options: [
      "سن و قدمت در خدمت",
      "صلاحیت علمی و اخلاقی (قدرت و امانت‌داری)",
      "وابستگی سیاسی به دستگاه حاکم",
      "داشتن پشتوانهٔ مالی شخصی",
    ],
  }),
  authored('isl.5.2', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.5',
    courseSectionId: 'islamic',
    text: 'پرداخت مزد پیش از کار چه پیام عملی دارد؟',
    options: [
      "جایگزین کامل نظارت بر کیفیت کار",
      "مستلزم حذف قرارداد مکتوب است",
      "رفع اضطراب معیشت کارگزار و بهبود تمرکز و اثربخشی او",
      "کاهش انگیزهٔ کارگزار برای اتمام کار",
    ],
  }),
  authored('isl.5.3', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.5',
    courseSectionId: 'islamic',
    text: '«تکلیف مالایطاق» به معنای چیست و چه وضعیتی دارد؟',
    options: [
      "سپردن کار به فرد توانمند و ماهر؛ پسندیده است",
      "افزایش تدریجی بار کاری برای آموزش؛ بی‌اشکال است",
      "تقسیم کاری سخت میان همهٔ اعضا؛ واجب است",
      "سپردن کاری فراتر از توان فرد؛ در الگوی اسلامی ممنوع است",
    ],
  }),

  // فصل ۶ — انگیزش: مادی و معنوی
  authored('isl.6.1', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.6',
    courseSectionId: 'islamic',
    text: 'ساختار انگیزش در مدیریت اسلامی کدام گزینه را در بر می‌گیرد؟',
    options: [
      "فقط انگیزه‌های معنوی بدون توجه به معیشت",
      "تنبیه بیرونی به‌عنوان محرک اصلی",
      "پاداش مادی مشروع همراه با انگیزه‌های معنوی مانند رضایت الهی و پاداش اخروی",
      "فقط پاداش مادی بر پایهٔ عملکرد",
    ],
  }),
  authored('isl.6.2', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.6',
    courseSectionId: 'islamic',
    text: 'نقد مدیریت اسلامی به نظریه‌های صرفاً مادی انگیزش چیست؟',
    options: [
      "این نظریه‌ها بیش از حد به انگیزهٔ اخروی توجه دارند",
      "این نظریه‌ها کنترل درونی را بیش از حد پررنگ می‌کنند",
      "این نظریه‌ها سهم مشورت را دست‌کم نمی‌گیرند",
      "این نظریه‌ها بعد معنوی و دو بعدی بودن انسان را نادیده می‌گیرند",
    ],
  }),
  authored('isl.6.3', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.6',
    courseSectionId: 'islamic',
    text: 'نقش رهبر در برانگیختن انگیزهٔ کارکنان در الگوی اسلامی چیست؟',
    options: [
      "الگو بودن عملی و پرورش انگیزهٔ معنوی در کنار جبران خدمات عادلانه",
      "تنظیم جدول پاداش و توقف در همان حد",
      "حذف مکانیزم‌های ارزیابی عملکرد",
      "فقط تبلیغ شفاهی ارزش‌های سازمان",
    ],
  }),

  // فصل ۷ — رهبری در مدیریت اسلامی و سیرهٔ علوی
  authored('isl.7.1', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.7',
    courseSectionId: 'islamic',
    text: 'کدام گزینه صفات رهبر در مدیریت اسلامی را به‌درستی فهرست می‌کند؟',
    options: [
      "خودکم‌بینی، محافظه‌کاری و پرهیز از تصمیم",
      "خشونت اجرایی، رازداری مطلق و بی‌رحمی",
      "محبوبیت عمومی، ثروت شخصی و روابط سیاسی",
      "عدالت، تقوا، علم، شجاعت و رفق و مدارا",
    ],
  }),
  authored('isl.7.2', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.7',
    courseSectionId: 'islamic',
    text: 'نامهٔ امام علی (ع) به مالک اشتر بیش از همه بر کدام محورها تأکید دارد؟',
    options: [
      "انتخاب کارگزار شایسته، نظارت بر او، رفق به رعیت و پرهیز از استبداد",
      "افزایش مالیات‌ها برای تقویت خزانه",
      "حذف مشورت و تمرکز تصمیم‌گیری",
      "حفظ موقعیت شخصی فرمانروا در برابر مردم",
    ],
  }),
  authored('isl.7.3', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.7',
    courseSectionId: 'islamic',
    text: 'تفاوت «رهبری خدمتگزار» با «رهبری قدرت‌محور» در مدیریت اسلامی چیست؟',
    options: [
      "هر دو تمرکز یکسان بر قدرت شخصی دارند",
      "تمرکز نخستین بر خدمت به رعیت و پاسخگویی است و دومی بر منفعت و اقتدار شخصی",
      "نخستین بدون نظارت است و دومی با نظارت کامل",
      "نخستین فقط در حکومت کاربرد دارد و دومی فقط در بنگاه",
    ],
  }),

  /* ============================ تحقیق در عملیات (فدوی) ============================ */

  // فصل ۲ — حل ترسیمی و حالات خاص جواب
  authored('or.2.1', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.or.2',
    courseSectionId: 'operations_research',
    text: 'نشانهٔ وجود «جواب بهینهٔ چندگانه» در LP کدام است؟',
    options: [
      "ناحیهٔ شدنی در جهت بهبود تابع هدف باز است",
      "قیود همدیگر را برآورده نمی‌کنند",
      "مقدار بهینه تابع هدف منفی است",
      "خط هم‌مقدار موازی با یک ضلع ناحیهٔ شدنی قرار می‌گیرد",
    ],
  }),
  authored('or.2.2', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.or.2',
    courseSectionId: 'operations_research',
    text: 'مسئلهٔ LP با «جواب نامحدود» چه ویژگی‌ای دارد؟',
    options: [
      "ناحیهٔ شدنی در جهت بهبود تابع هدف باز است و مقدار بهینه بالا نمی‌رود",
      "ناحیهٔ شدنی تهی است",
      "تمام قیدها فعال هستند",
      "تنها یک رأس بهینه وجود دارد",
    ],
  }),
  authored('or.2.3', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.or.2',
    courseSectionId: 'operations_research',
    text: 'قیمت سایهٔ یک قید غیرفعال در جواب بهینه چه مقدار است؟',
    options: [
      "منفی و برابر جواب بهینه",
      "صفر",
      "برابر ضریب تابع هدف",
      "برابر مقدار سمت راست قید",
    ],
  }),

  // فصل ۵ — تحلیل حساسیت
  authored('or.5.1', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.or.5',
    courseSectionId: 'operations_research',
    text: 'در بازهٔ مجاز تغییر ضریب تابع هدف یک متغیر پایه، کدام چیز ثابت می‌ماند؟',
    options: [
      "قیمت‌های سایه بدون هیچ تغییری در بازهٔ قیدها",
      "ترتیب جدول سیمپلکس به‌طور کامل",
      "جواب بهینه (متغیرهای پایه) و فقط مقدار بهینه تابع هدف تغییر می‌کند",
      "همهٔ جواب و مقدار بهینه",
    ],
  }),
  authored('or.5.2', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.or.5',
    courseSectionId: 'operations_research',
    text: '«هزینهٔ کاهش‌یافته» یک متغیر غیرپایه چه چیزی را می‌گوید؟',
    options: [
      "میزان تغییر سمت راست قیدها",
      "نرخ کاهش قیمت سایه در هر تکرار",
      "فاصلهٔ جواب فعلی تا جواب دوگان",
      "میزان تغییر تابع هدف در صورت افزایش یک واحد از آن متغیر",
    ],
  }),
  authored('or.5.3', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.or.5',
    courseSectionId: 'operations_research',
    text: 'اگر تغییر سمت راست قید بیرون از بازهٔ مجاز رخ دهد، چه باید کرد؟',
    options: [
      "بازمحاسبهٔ کامل مسئله با جواب پایهٔ جدید لازم است",
      "فقط مقدار تابع هدف را متناسب تغییر می‌دهیم",
      "قیمت‌های سایه همان می‌ماند",
      "مسئله قطعاً نشدنی می‌شود",
    ],
  }),

  // فصل ۷ — مدیریت پروژه: CPM و PERT
  authored('or.7.1', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.or.7',
    courseSectionId: 'operations_research',
    text: 'در فرمول زمان مورد انتظار PERT با $t_e = (a + 4m + b)/6$، وزن برآورد محتمل چه قدر است؟',
    options: [
      "چهار برابر",
      "یک برابر",
      "دو برابر",
      "شش برابر",
    ],
    expectedTimeMs: 40000,
  }),
  authored('or.7.2', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.or.7',
    courseSectionId: 'operations_research',
    text: '«مسیر بحرانی» در شبکهٔ پروژه کدام مسیر است؟',
    options: [
      "مسیری که بیشترین هزینهٔ فشرده‌سازی دارد",
      "مسیری با طولانی‌ترین زمان کل که شناوری صفر دارد",
      "کوتاه‌ترین مسیر میان دو گره شبکه",
      "مسیر با بیشترین شناوری و کمترین ریسک",
    ],
  }),
  authored('or.7.3', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.or.7',
    courseSectionId: 'operations_research',
    text: 'شناوری کل صفر برای یک فعالیت چه پیامدی دارد؟',
    options: [
      "زمان این فعالیت قابل فشرده‌سازی نیست",
      "این فعالیت روی مسیر بحرانی اثری ندارد",
      "هر تأخیر در آن فعالیت، کل پروژه را به همان اندازه تأخیر می‌اندازد",
      "فعالیت می‌تواند بدون اثر با تأخیر جابه‌جا شود",
    ],
  }),

  // فصل ۸ — برنامه‌ریزی عدد صحیح و آرمانی
  authored('or.8.1', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.or.8',
    courseSectionId: 'operations_research',
    text: 'متغیرهای صفر-یک در برنامه‌ریزی عدد صحیح بیشتر برای چه استفاده می‌شوند؟',
    options: [
      "جایگزینی مستقیم برای متغیرهای مازاد سیمپلکس",
      "مدل‌سازی تصمیم «انجام دادن یا انجام ندادن» یک پروژه یا فعالیت",
      "بیشینه‌سازی پیوستهٔ تولید یک محصول",
      "نمایش مقادیر منفی در تابع هدف",
    ],
  }),
  authored('or.8.2', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.or.8',
    courseSectionId: 'operations_research',
    text: 'در برنامه‌ریزی آرمانی، هدف مدل چیست؟',
    options: [
      "حذف کامل قیود برای رسیدن به آرمان‌ها",
      "تبدیل همهٔ اهداف به یک تابع هزینهٔ نهایی واقعی",
      "کمینه‌سازی کل انحراف‌های وزنی از آرمان‌ها، نه بهینه‌سازی یک هدف واحد",
      "بیشینه‌سازی همهٔ اهداف هم‌زمان بدون اولویت",
    ],
  }),
  authored('or.8.3', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.or.8',
    courseSectionId: 'operations_research',
    text: 'گرد کردن جواب LP برای به دست آوردن جواب عدد صحیح چه ایرادی دارد؟',
    options: [
      "همیشه جواب بهینهٔ صحیح می‌دهد",
      "فقط در مسائل حمل‌ونقل خطا دارد",
      "زمان حل را به‌طور نامحدود افزایش می‌دهد",
      "جواب گردشده ممکن است نشدنی یا غیربهینه باشد",
    ],
  }),

  /* ============================ تحقیق در عملیات (مهرگان) ============================ */

  // فصل ۱ — مدل‌سازی و تبدیل به فرم استاندارد
  authored('meh.1.1', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.meh.1',
    courseSectionId: 'operations_research',
    text: 'قید از نوع «≥» در مسئلهٔ بیشینه، در فرم استاندارد سیمپلکس چگونه به تساوی تبدیل می‌شود؟',
    options: [
      "فقط با متغیر کمبود مثبت",
      "با ضرب کل قید در منفی یک بدون افزودن متغیر",
      "با حذف سمت راست قید",
      "با متغیر مازاد منفی‌شده و متغیر مصنوعی",
    ],
  }),
  authored('meh.1.2', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.meh.1',
    courseSectionId: 'operations_research',
    text: 'متغیر آزاد $x$ در فرم استاندارد چگونه بازنویسی می‌شود؟',
    options: [
      "$x = x^+ - x^-$ با شرط $x^+, x^- \\ge 0$",
      "$x = x^+ \\cdot x^-$ با شرط نامنفی",
      "$x$ بدون تغییر باقی می‌ماند",
      "$x$ حذف و در تابع هدف جایگزین می‌شود",
    ],
  }),
  authored('meh.1.3', {
    nodeId: 'ind.or_simplex_duality',
    referenceChapterId: 'ch.meh.1',
    courseSectionId: 'operations_research',
    text: 'متغیر کمبود اضافه‌شده به قید «≤» در مسئلهٔ بیشینه با چه ضریبی وارد تابع هدف می‌شود؟',
    options: [
      "ضریب قید متناظر",
      "صفر",
      "یک",
      "منفی یک",
    ],
    expectedTimeMs: 40000,
  }),

  // فصل ۷ — مدل‌های شبکه: کوتاه‌ترین مسیر و جریان
  authored('meh.7.1', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.meh.7',
    courseSectionId: 'operations_research',
    text: 'الگوریتم دایکسترا برای کدام مسئله کاربرد دارد و چه شرطی لازم دارد؟',
    options: [
      "برنامه‌ریزی زمان‌بندی پروژه با شناوری",
      "کوتاه‌ترین مسیر با وزن‌های غیرمنفی",
      "بیشینه جریان در شبکه",
      "درخت پوشای کمینه با وزن‌های منفی",
    ],
  }),
  authored('meh.7.2', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.meh.7',
    courseSectionId: 'operations_research',
    text: 'روش فورد-فولکرسون مسئلهٔ کدام را حل می‌کند و با چه سازوکاری؟',
    options: [
      "درخت پوشا با مرتب‌سازی صعودی یال‌ها",
      "تخصیص بهینه با پوشش صفرهای ماتریس",
      "بیشینه جریان با افزودن مسیرهای افزایشی تا ناپدید شدن مسیر از مبدأ به مقصد",
      "کوتاه‌ترین مسیر با به‌روزرسانی برچسب‌های گره",
    ],
  }),
  authored('meh.7.3', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.meh.7',
    courseSectionId: 'operations_research',
    text: 'در الگوریتم کروسکال برای درخت پوشای کمینه، ترتیب انتخاب یال‌ها چگونه است؟',
    options: [
      "یال‌ها به ترتیب وزن نزولی حذف می‌شوند",
      "یال‌ها به‌ترتیب نام گره‌های مبدأ انتخاب می‌شوند",
      "یال‌های تصادفی تا برقراری اتصال انتخاب می‌شوند",
      "یال‌ها به ترتیب وزن صعودی بررسی و انتخاب می‌شوند، مگر ایجاد دور کنند",
    ],
  }),

  /* ============================ تولید و عملیات ============================ */

  // فصل ۲ — مدل‌های موجودی: EOQ و EPQ
  authored('pom.2.1', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.2',
    courseSectionId: 'production',
    text: 'در فرمول $Q^* = \\sqrt{2DS/H}$، نماد D نشان‌دهندهٔ چیست؟',
    options: [
      "زمان تأمین سفارش",
      "سطح موجودی ایمنی",
      "تقاضای سالانه",
      "هزینهٔ نگهداری هر واحد",
    ],
    expectedTimeMs: 40000,
  }),
  authored('pom.2.2', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.2',
    courseSectionId: 'production',
    text: 'در نقطهٔ بهینهٔ EOQ کدام دو هزینه برابر می‌شوند؟',
    options: [
      "هزینهٔ ثابت و هزینهٔ متغیر",
      "هزینهٔ کمبود و هزینهٔ خرید",
      "هزینهٔ حمل و هزینهٔ بازرسی",
      "هزینهٔ سالانهٔ سفارش‌دهی و هزینهٔ سالانهٔ نگهداری",
    ],
  }),
  authored('pom.2.3', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.2',
    courseSectionId: 'production',
    text: 'مدل EPQ نسبت به EOQ کدام اصلاح را اعمال می‌کند؟',
    options: [
      "عامل $(1 - d/p)$ برای تولید هم‌زمان با مصرف در مخرج فرمول",
      "افزودن هزینهٔ کمبود به هزینهٔ نگهداری",
      "حذف هزینهٔ راه‌اندازی از تابع هدف",
      "جایگزینی تقاضای قطعی با تقاضای احتمالی",
    ],
  }),

  // فصل ۳ — موجودی با عدم قطعیت: ROP و موجودی ایمنی
  authored('pom.3.1', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.3',
    courseSectionId: 'production',
    text: 'نقطهٔ سفارش مجدد (ROP) بر چه مبنایی تعیین می‌شود؟',
    options: [
      "میانگین تقاضای سالانه تقسیم بر تعداد سفارش‌ها",
      "حداکثر موجودی انبار منهای موجودی فعلی",
      "مقدار اقتصادی سفارش تقسیم بر زمان تأمین",
      "تقاضای میانگین در طول زمان تأمین به‌علاوهٔ موجودی ایمنی",
    ],
  }),
  authored('pom.3.2', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.3',
    courseSectionId: 'production',
    text: 'در فرمول $ROP = \\bar{d}L + z\\sigma_d\\sqrt{L}$، جزء $z\\sigma_d\\sqrt{L}$ نشان‌دهندهٔ چیست؟',
    options: [
      "موجودی ایمنی برای پوشش نوسان تقاضا در زمان تأمین",
      "میانگین تقاضای روزانه",
      "هزینهٔ نگهداری موجودی",
      "زمان تأمین سفارش",
    ],
  }),
  authored('pom.3.3', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.3',
    courseSectionId: 'production',
    text: 'افزایش سطح خدمت از ۹۰٪ به ۹۹٪ چه پیامدی بر موجودی دارد؟',
    options: [
      "حذف کامل نیاز به نقطهٔ سفارش مجدد",
      "افزایش مقدار z و در نتیجه افزایش موجودی ایمنی و هزینهٔ نگهداری",
      "کاهش موجودی ایمنی و هزینه‌ها",
      "بدون تغییر در سطح موجودی",
    ],
  }),

  // فصل ۴ — MRP، MRPII و ERP
  authored('pom.4.1', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.4',
    courseSectionId: 'production',
    text: 'سه ورودی اصلی سیستم MRP کدام‌اند؟',
    options: [
      "فهرست مواد (BOM)، وضعیت و سوابق موجودی و برنامهٔ تولید اصلی (MPS)",
      "پیش‌بینی فروش، بودجهٔ تبلیغات و برنامهٔ کیفیت",
      "زمان‌بندی جانسون، نمودار گانت و قواعد توالی",
      "جدول Cp، سطح خدمت و نقطهٔ سفارش مجدد",
    ],
  }),
  authored('pom.4.2', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.4',
    courseSectionId: 'production',
    text: 'تقاضای وابسته در MRP از کجا مشتق می‌شود؟',
    options: [
      "از میانگین متحرک فروش گذشته",
      "از فهرست مواد و برنامهٔ محصول نهایی",
      "از پیش‌بینی آماری تقاضای بازار",
      "از سفارش‌های شفاهی مشتریان",
    ],
  }),
  authored('pom.4.3', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.4',
    courseSectionId: 'production',
    text: 'سیاست اندازهٔ سفارش «L4L (دقیقاً به‌مقدار نیاز)» چه ویژگی‌ای دارد؟',
    options: [
      "سفارش فقط در پایان افق برنامه انجام می‌شود",
      "موجودی ایمنی جایگزین کامل سفارش‌دهی می‌شود",
      "مقدار سفارش هر دوره دقیقاً برابر نیاز خالص همان دوره است",
      "سفارش‌ها با اندازهٔ ثابت اقتصادی در همهٔ دوره‌ها انجام می‌شود",
    ],
  }),

  // فصل ۵ — زمان‌بندی تولید و الگوریتم جانسون
  authored('pom.5.1', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.5',
    courseSectionId: 'production',
    text: 'قاعدهٔ توالی EDD چه شاخصی را هدف می‌گیرد؟',
    options: [
      "کمینه‌سازی موجودی در جریان کار",
      "کاهش حداکثر و میانگین تأخیر نسبت به زمان تحویل",
      "کاهش زمان بیکاری ماشین‌ها",
      "کمینه‌سازی زمان کل تکمیل",
    ],
  }),
  authored('pom.5.2', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.5',
    courseSectionId: 'production',
    text: 'قاعدهٔ SPT (زمان پردازش کوتاه‌تر اول) کدام شاخص را کمینه می‌کند؟',
    options: [
      "حداکثر زمان تکمیل بدون توجه به صف",
      "هزینهٔ راه‌اندازی ماشین‌ها",
      "میانگین جریان کار (زمان سپری‌شده در سیستم)",
      "میانگین تأخیر تحویل به‌تنهایی",
    ],
  }),
  authored('pom.5.3', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.5',
    courseSectionId: 'production',
    text: 'در الگوریتم جانسون برای دو ماشین، کم‌ترین زمان پردازش اگر روی ماشین دوم رخ دهد، آن کار کجا قرار می‌گیرد؟',
    options: [
      "در ابتدای فهرست توالی",
      "در وسط فهرست توالی",
      "از فهرست حذف می‌شود",
      "در انتهای فهرست توالی",
    ],
  }),

  // فصل ۶ — کنترل کیفیت آماری: Cp و Cpk
  authored('pom.6.1', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.6',
    courseSectionId: 'production',
    text: 'تفاوت اصلی $C_{pk}$ با $C_p$ چیست؟',
    options: [
      "هر دو دقیقاً یک مقدار می‌دهند",
      "نمودار $C_p$ برای ویژگی‌ها و $C_{pk}$ برای متغیرها است",
      "همان‌طور که $C_p$ پراکندگی را می‌سنجد، $C_{pk}$ مرکزیت فرایند نسبت به دامنهٔ مشخصات را هم می‌سنجد",
      "همان‌طور که $C_p$ مرکزیت را می‌سنجد، $C_{pk}$ فقط پراکندگی را می‌سنجد",
    ],
  }),
  authored('pom.6.2', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.6',
    courseSectionId: 'production',
    text: 'مقدار $C_p = 1$ به معنای چیست؟',
    options: [
      "فرایند کاملاً متمرکز روی مقدار هدف است",
      "فرایند خارج از کنترل آماری است",
      "نمونه‌گیری باید متوقف شود",
      "پراکندگی فرایند دقیقاً برابر دامنهٔ مشخصات است",
    ],
  }),
  authored('pom.6.3', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.6',
    courseSectionId: 'production',
    text: 'خطای نوع اول در نمودار کنترل چه وضعیتی است؟',
    options: [
      "هشدار اصلاح وقتی فرایند در واقع تحت کنترل است",
      "ادامهٔ فرایند معیوب بدون هشدار",
      "بازرسانی اضافی روی محصول سالم",
      "نقض حد مشخصات در محصول نهایی",
    ],
  }),

  // فصل ۹ — زنجیرهٔ تأمین و اثر شلاقی
  authored('pom.9.1', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.9',
    courseSectionId: 'production',
    text: '«اثر شلاقی» در زنجیرهٔ تأمین به معنای چیست؟',
    options: [
      "افزایش هم‌زمان تقاضا در همهٔ حلقه‌ها",
      "تشدید نوسان تقاضا هرچه از پایین‌دست به بالادست زنجیره نزدیک‌تر می‌شویم",
      "کاهش نوسان تقاضا در بالادست زنجیره",
      "ثبات قیمت‌ها در طول زنجیرهٔ تأمین",
    ],
  }),
  authored('pom.9.2', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.9',
    courseSectionId: 'production',
    text: 'کدام گزینه علت‌های اثر شلاقی را به‌درستی فهرست می‌کند؟',
    options: [
      "بالا بودن کیفیت، پایین بودن هزینه و ثبات قیمت",
      "استفاده از داده‌های فروش نقطه‌ای و برنامه‌ریزی مشارکتی",
      "پیش‌بینی بر پایهٔ سفارش‌ها، دسته‌بندی سفارش، نوسان قیمت و رفتار بازی و حجم‌دادن به سفارش",
      "کاهش زمان تأمین، اشتراک اطلاعات و VMI",
    ],
  }),
  authored('pom.9.3', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.9',
    courseSectionId: 'production',
    text: 'مدیریت موجودی توسط فروشنده (VMI) چه چیزی را تغییر می‌دهد؟',
    options: [
      "مسئولیت پرداخت از مشتری به دولت منتقل می‌شود",
      "زنجیرهٔ تأمین به یک سطح کاهش می‌یابد",
      "همهٔ سفارش‌ها با قاعدهٔ L4L انجام می‌شود",
      "تصمیم‌گیری دربارهٔ سطح و زمان موجودی از خرده‌فروش به تأمین‌کننده منتقل می‌شود",
    ],
  }),

  // فصل ۱۰ — مدیریت پروژه: CPM و PERT
  authored('pom.10.1', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.10',
    courseSectionId: 'production',
    text: 'تفاوت اصلی CPM و PERT چیست؟',
    options: [
      "CPM هزینه را نادیده می‌گیرد و فقط زمان را می‌بیند",
      "زمان فعالیت‌ها در CPM قطعی است و در PERT احتمالی با سه برآورد",
      "CPM فقط برای پروژه‌های تحقیقاتی کاربرد دارد",
      "PERT مسیر بحرانی ندارد",
    ],
  }),
  authored('pom.10.2', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.10',
    courseSectionId: 'production',
    text: 'در فشرده‌سازی زمان پروژه با کمترین هزینه، فعالیت بر چه اساسی انتخاب می‌شود؟',
    options: [
      "بیشترین هزینهٔ مستقیم فعالیت",
      "کوتاه‌ترین زمان باقی‌ماندهٔ فعالیت",
      "کمترین نسبت هزینهٔ فشرده‌سازی به کاهش زمان",
      "بیشترین شناوری باقی‌مانده",
    ],
  }),
  authored('pom.10.3', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.10',
    courseSectionId: 'production',
    text: 'در PERT واریانس زمان یک فعالیت چگونه محاسبه می‌شود؟',
    options: [
      "$\\sigma^2 = \\dfrac{a + 4m + b}{6}$",
      "$\\sigma^2 = (b - a)^2$",
      "$\\sigma^2 = \\dfrac{b + a}{2}$",
      "$\\sigma^2 = \\left(\\dfrac{b-a}{6}\\right)^2$",
    ],
  }),

  /* ============================ MCDM / DEA / صف ============================ */

  // فصل ۳ — SAW، ELECTRE و VIKOR
  authored('mcdm.3.1', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.3',
    courseSectionId: 'operations_research',
    text: 'روش SAW چه نوع روش تصمیم‌گیری است؟',
    options: [
      "روش جبرانی ساده بر پایهٔ میانگین وزنی نمره‌های نرمال‌شده",
      "روش غیرجبرانی بر پایهٔ روابط برتری",
      "روش بازده نسبی با وزن‌های آزاد",
      "روش شبیه‌سازی مونت‌کارلو",
    ],
  }),
  authored('mcdm.3.2', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.3',
    courseSectionId: 'operations_research',
    text: 'روش ELECTRE بر چه مبنایی گزینه‌ها را مقایسه می‌کند؟',
    options: [
      "نمرهٔ نسبی در مقابل مرز واحدهای همتا",
      "روابط برتری (outranking) با تعریف آستانه‌های توافق و ناسازگاری",
      "میانگین وزنی خطی نمره‌های نرمال‌شده",
      "فاصلهٔ فشردهٔ گزینه از جواب ایده‌آل مثبت",
    ],
  }),
  authored('mcdm.3.3', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.3',
    courseSectionId: 'operations_research',
    text: 'شاخص سازش در VIKOR گزینه را چگونه رتبه‌بندی می‌کند؟',
    options: [
      "بر پایهٔ جمع وزنی ساده بدون نرمال‌سازی",
      "بر پایهٔ تکرار ماتریس مقایسه‌های زوجی تا رسیدن به نرخ ناسازگاری",
      "بر پایهٔ بیشینه‌سازی «فایدهٔ گروه» و کمینه‌سازی «پشیمانی فردی» با نزدیکی به جواب ایده‌آل",
      "بر پایهٔ فاصلهٔ گزینه از جواب ایده‌آل منفی",
    ],
  }),

  // فصل ۵ — DEA: مدل CCR
  authored('mcdm.5.1', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.5',
    courseSectionId: 'operations_research',
    text: 'مدل CCR در تحلیل پوششی داده‌ها (DEA) چه فرضی دربارهٔ بازده به مقیاس دارد؟',
    options: [
      "بازده صعودی به مقیاس",
      "بازده نزولی به مقیاس",
      "بازده ثابت به مقیاس",
      "بازده متغیر به مقیاس",
    ],
    expectedTimeMs: 40000,
  }),
  authored('mcdm.5.2', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.5',
    courseSectionId: 'operations_research',
    text: 'در DEA، واحد تصمیم‌گیری با نمرهٔ کارایی برابر ۱ چه وضعیتی دارد؟',
    options: [
      "مطمئناً بهترین واحد در همهٔ معیارها است",
      "به حذف از تحلیل نیاز دارد",
      "دارای بیشترین ورودی و خروجی است",
      "روی مرز کارایی قرار دارد و در مقایسه با واحدهای همتا کارا است",
    ],
  }),
  authored('mcdm.5.3', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.5',
    courseSectionId: 'operations_research',
    text: 'وزن ورودی‌ها و خروجی‌ها در مدل پایهٔ DEA چگونه تعیین می‌شود؟',
    options: [
      "مدل برای هر واحد بهترین مجموعهٔ وزن‌ها را آزادانه انتخاب می‌کند",
      "وزن‌ها فقط از آرای کارشناسان می‌آیند",
      "همهٔ وزن‌ها برابر یک قرار می‌گیرند",
      "وزن‌ها از مدل AHP گرفته می‌شوند",
    ],
  }),

  // فصل ۹ — صف چندکاناله و اقتصاد ظرفیت
  authored('mcdm.9.1', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.9',
    courseSectionId: 'operations_research',
    text: 'در مدل صف M/M/c، بهره‌برداری سیستم چگونه محاسبه می‌شود؟',
    options: [
      "$\\rho = c\\mu/\\lambda$",
      "$\\rho = c\\lambda/\\mu$",
      "$\\rho = \\lambda/(c\\mu)$",
      "$\\rho = \\lambda/\\mu$",
    ],
  }),
  authored('mcdm.9.2', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.9',
    courseSectionId: 'operations_research',
    text: 'چرا «یک صف مشترک برای چند کانال» به‌طور معمول بهتر از «یک صف برای هر کانال» عمل می‌کند؟',
    options: [
      "تجمیع صف‌ها نرخ خدمت هر کانال را افزایش می‌دهد",
      "چند صف همیشه زمان انتظار کمتری می‌دهد",
      "تجمیع صف‌ها تغییراتی در انتظار ایجاد نمی‌کند",
      "تجمیع صف‌ها از مرگ مشتری پشت کانال خالی یا مشغول‌شدن ناهمسان جلوگیری می‌کند و زمان انتظار را کاهش می‌دهد",
    ],
  }),
  authored('mcdm.9.3', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.9',
    courseSectionId: 'operations_research',
    text: 'در اقتصاد ظرفیت صف، تصمیم بهینه بر چه اساسی گرفته می‌شود؟',
    options: [
      "کمینه‌سازی مجموع هزینهٔ انتظار مشتری و هزینهٔ تأمین ظرفیت",
      "بیشینه‌سازی نرخ ورود مشتری",
      "کمینه‌سازی فقط هزینهٔ ظرفیت",
      "رساندن بهره‌برداری دقیقاً به یک",
    ],
  }),

  /* ============================ مدیریت R&D (تید) ============================ */

  // فصل ۵ — مدیریت R&D و پروژه‌های توسعه
  authored('tidd.5.1', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.5',
    text: 'تفاوت اصلی «تحقیق (R)» و «توسعه (D)» چیست؟',
    options: [
      "تحقیق همیشه هزینه‌برتر و توسعه همیشه سریع‌تر است",
      "تحقیق فقط در دانشگاه‌ها و توسعه فقط در صنعت انجام می‌شود",
      "تحقیق هدفش تولید دانش است و توسعه هدفش ساختن محصول و فرایند",
      "هر دو دقیقاً یک هدف و یک خروجی دارند",
    ],
  }),
  authored('tidd.5.2', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.5',
    text: 'تصمیم «ادامه یا توقف» پروژهٔ توسعه معمولاً در چه نقطه‌ای گرفته می‌شود؟',
    options: [
      "فقط در پایان پروژه با ارزیابی نهایی",
      "در ابتدای پروژه و بدون بازبینی بعدی",
      "با ارزیابی روزانهٔ همهٔ کارکنان تیم",
      "در نقاط راهبردی (دروازه‌ها) با ارزیابی پیشرفت، هزینه و بلوغ فنی",
    ],
  }),
  authored('tidd.5.3', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.5',
    text: 'مدیریت پرتفوی R&D به چه چیزی توجه دارد؟',
    options: [
      "تعادل پروژه‌ها از نظر افق زمانی، ریسک و تمایل اکتشاف در برابر بهره‌برداری",
      "فقط بیشینه‌سازی تعداد پروژه‌های کوتاه‌مدت",
      "انتخاب فقط یک پروژهٔ بلندمدت در هر سال",
      "تخصیص بودجهٔ یکسان به همهٔ پروژه‌ها",
    ],
  }),

  /* ============================ اسپین‌آف و سرمایه‌گذاری شرکتی ============================ */

  // فصل ۹ — اسپین‌آف، استارتاپ و سرمایه‌گذاری شرکتی
  authored('op.9.1', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.9',
    text: 'انگیزهٔ اصلی شرکت مادر برای ایجاد «اسپین‌آف» چیست؟',
    options: [
      "ارزش‌گیری از فناوری یا ایده‌ای که بیرون از هستهٔ کسب‌وکار اصلی مادر است",
      "حذف کامل واحد تحقیق و توسعهٔ داخلی",
      "پرهیز از هرگونه مشارکت با بازار",
      "کاهش تعداد کارکنان واحد فروش",
    ],
  }),
  authored('op.9.2', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.9',
    text: 'کدام گزینه مدل‌های مشارکت شرکت بزرگ با استارتاپ‌ها را به‌درستی فهرست می‌کند؟',
    options: [
      "فقط اتحاد با رقبای مستقیم",
      "شتاب‌دهندهٔ شرکتی، سرمایه‌گذاری خطرپذیر شرکتی (CVC) و پیش‌آمادگاه (incubator)",
      "فقط خرید کامل و ادغام",
      "فقط قرارداد انتقال فناوری با دولت",
    ],
  }),
  authored('op.9.3', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.9',
    text: 'در ارزیابی استارتاپ فناورانه، سرمایه‌گذار خطرپذیر معمولاً به کدام عوامل وزن بیشتری می‌دهد؟',
    options: [
      "میانگین سن کارکنان و سال تأسیس",
      "فقط قیمت تمام‌شدهٔ نمونهٔ اولیه",
      "کیفیت تیم بنیان‌گذار، اندازه و رشد بازار و تمایز فناوری",
      "تعداد وسایل اداری و بزرگی دفتر",
    ],
  }),

  /* ===== هفت فصل باقی‌مانده (استراتژی عمومی، مطالعهٔ زمان، DEA پیشرفته،
     شبیه‌سازی، استانداردها، فرایند نوآوری) ===== */

  // استراتژی عمومی — فصل ۶: استراتژی‌های عمومی پورتر
  authored('str.6.1', {
    nodeId: 'sm.value_chain',
    referenceChapterId: 'ch.str.6',
    courseSectionId: 'management_theories',
    text: 'سه استراتژی عمومی پورتر کدام‌اند؟',
    options: [
      "نفوذ، توسعه و هم‌افزایی",
      "پیشگامی، پیروی و خروج",
      "ادغام افقی، ادغام عمودی و واگذاری",
      "رهبری هزینه، تمایز و تمرکز (هزینه‌ای یا تمایزی)",
    ],
  }),
  authored('str.6.2', {
    nodeId: 'sm.value_chain',
    referenceChapterId: 'ch.str.6',
    courseSectionId: 'management_theories',
    text: '«گیر افتادن در میانه» در الگوی پورتر چه وضعیتی را توصیف می‌کند؟',
    options: [
      "بنگاهی که نه هزینهٔ کم رهبر را دارد و نه تمایز پذیرفته‌شده؛ نتیجه، حاشیهٔ سود پایین است",
      "بنگاهی که در بخش بازار هدف از همه جلوتر است",
      "بنگاهی که هم رهبری هزینه و هم تمایز را هم‌زمان و پایدار به دست آورده است",
      "بنگاهی که از استراتژی تمرکز به استراتژی جهانی کوچ کرده است",
    ],
  }),
  authored('str.6.3', {
    nodeId: 'sm.value_chain',
    referenceChapterId: 'ch.str.6',
    courseSectionId: 'management_theories',
    text: 'تفاوت «تمرکز هزینه‌ای» با «تمرکز تمایزی» در الگوی پورتر چیست؟',
    options: [
      "هر دو فقط در صنایع مبتنی بر فناوری کاربرد دارند",
      "هر دو در بازار باریک عمل می‌کنند؛ نخستین کمترین هزینه در آن بخش را می‌جوید و دومین تمایز متناسب با همان بخش",
      "نخستین در بازار وسیع و دومین در بازار باریک عمل می‌کند",
      "نخستین بر نوآوری محصول و دومین بر کاهش قیمت تکیه دارد",
    ],
  }),

  // تولید و عملیات — فصل ۷: طراحی کار و مطالعهٔ زمان
  authored('pom.7.1', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.7',
    courseSectionId: 'production',
    text: 'زمان استاندارد یک عملیات چگونه تعیین می‌شود؟',
    options: [
      "مستقیماً از میانگین زمان‌های ثبت‌شده بدون هیچ تعدیل",
      "از تقسیم زمان تولید کل بر تعداد کارگران",
      "از نمودار انسان-ماشین بدون ثبت زمان مشاهده",
      "زمان مشاهده‌شده پس از تعدیل با ضریب عملکرد، به‌علاوهٔ افزودنی‌های مجاز",
    ],
  }),
  authored('pom.7.2', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.7',
    courseSectionId: 'production',
    text: 'در طراحی کار، کدام مطالعه باید پیش از «مطالعهٔ زمان» انجام شود و چرا؟',
    options: [
      "مطالعهٔ روش؛ تا ابتدا روش بهینه شود و سپس زمان بر روش بهینه بنشیند",
      "مطالعهٔ زمان؛ تا روش بر پایهٔ زمان‌سنجی طراحی شود",
      "مطالعهٔ هزینه؛ تا روش بر پایهٔ بودجه انتخاب شود",
      "هیچ‌کدام؛ هر دو هم‌زمان و مستقل انجام می‌شوند",
    ],
  }),
  authored('pom.7.3', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.7',
    courseSectionId: 'production',
    text: 'نمودار انسان-ماشین بیشتر برای چه ساخته می‌شود؟',
    options: [
      "تعیین مسیر بحرانی پروژهٔ نصب ماشین",
      "نشان دادن زمان‌های بیکاری انسان و ماشین برای حذف اتلاف و ترکیب بهتر کارها",
      "ثبت کیفی محصولات معیوب هر شیفت",
      "محاسبهٔ اندازهٔ اقتصادی سفارش مواد",
    ],
  }),

  // MCDM — فصل ۶: DEA مدل BCC و کارایی مقیاس
  authored('mcdm.6.1', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.6',
    courseSectionId: 'operations_research',
    text: 'مدل BCC در تحلیل پوششی داده‌ها چه تفاوت اساسی با CCR دارد؟',
    options: [
      "بازده ثابت به مقیاس را می‌پذیرد و مرز کارایی مخروطی است",
      "وزن‌ها را از آرای کارشناسان می‌گیرد",
      "فقط برای واحدهای تک‌ورودی قابل استفاده است",
      "بازده متغیر به مقیاس را می‌پذیرد و مرز کارایی محدب است",
    ],
  }),
  authored('mcdm.6.2', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.6',
    courseSectionId: 'operations_research',
    text: 'در تفکیک کارایی‌ها، کارایی مقیاس چگونه محاسبه می‌شود؟',
    options: [
      "$SE = \\\\theta_{CCR}/\\\\theta_{BCC}$",
      "$SE = \\\\theta_{BCC}/\\\\theta_{CCR}$",
      "$SE = \\\\theta_{CCR} \\\\times \\\\theta_{BCC}$",
      "$SE = 1 - \\\\theta_{BCC}$",
    ],
  }),
  authored('mcdm.6.3', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.6',
    courseSectionId: 'operations_research',
    text: 'واحدی که در BCC کارا است اما در CCR ناکارا، ناکارایی‌اش از کجا می‌آید؟',
    options: [
      "از خطای محاسباتی مدل BCC",
      "از اندازهٔ نادرست (ناکارایی مقیاس)، نه از مدیریت ناکارا",
      "از کیفیت پایین داده‌های ورودی",
      "از تعداد زیاد خروجی‌ها",
    ],
    expectedTimeMs: 45000,
  }),

  // MCDM — فصل ۷: مدل‌های پیشرفتهٔ DEA
  authored('mcdm.7.1', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.7',
    courseSectionId: 'operations_research',
    text: 'مدل «ابرکارایی» در DEA برای چه ساخته شد؟',
    options: [
      "رتبه‌بندی واحدهایی که در مدل پایه همگی کارا و نمرهٔ ۱ گرفته‌اند",
      "افزودن قید وزنی برای واحدهای ناکارا",
      "تبدیل مدل کسری به مدل ضربی",
      "محاسبهٔ ناکارایی مقیاس واحدهای کوچک",
    ],
  }),
  authored('mcdm.7.2', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.7',
    courseSectionId: 'operations_research',
    text: 'مدل SBM نسبت به مدل‌های شعاعی DEA چه ویژگی دارد؟',
    options: [
      "فرض بازده ثابت به مقیاس را اجباری می‌کند",
      "ناکارایی را مستقیم با متغیرهای کمبود و فاصله در همهٔ ورودی و خروجی‌ها می‌سنجد",
      "فقط بزرگ‌ترین انحراف یک خروجی را می‌سنجد",
      "برای واحدهای تک‌ورودی طراحی شده است",
    ],
  }),
  authored('mcdm.7.3', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.7',
    courseSectionId: 'operations_research',
    text: 'به کدام عامل باید در تفسیر نتایج DEA بیشترین توجه را داشت؟',
    options: [
      "بزرگی اعداد در ماتریس داده‌ها",
      "انتخاب واحد پول برای ورودی‌های مالی",
      "حساسیت نتایج به تعداد واحدها و متغیرها (قاعدهٔ تجربی پوشش)",
      "صرفاً ترتیب الفبایی نام واحدها",
    ],
  }),

  // MCDM — فصل ۱۰: شبیه‌سازی و کاربردهای تصمیم
  authored('mcdm.10.1', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.10',
    courseSectionId: 'operations_research',
    text: 'هستهٔ شبیه‌سازی مونت‌کارلو چیست؟',
    options: [
      "رتبه‌بندی گزینه‌ها با مقیاس ساعتی ۱ تا ۹",
      "بیشینه‌سازی جریان در شبکه با مسیرهای افزایشی",
      "تولید اعداد تصادفی از توزیع‌های احتمالی و تکرار آزمایش برای برآورد رفتار سیستم",
      "حل قطعی دستگاه معادلات خطی با روش گاوس",
    ],
  }),
  authored('mcdm.10.2', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.10',
    courseSectionId: 'operations_research',
    text: 'اعتبارسنجی مدل شبیه‌سازی یعنی چه؟',
    options: [
      "افزایش تعداد تکرارها تا رسیدن به نتیجهٔ دلخواه",
      "تغییر توزیع ورودی‌ها برای کاهش هزینهٔ محاسبه",
      "حذف متغیرهای کم‌اهمیت از مدل",
      "مقایسهٔ خروجی مدل با رفتار واقعی سیستم برای اطمینان از بازنمایی درست",
    ],
  }),
  authored('mcdm.10.3', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.10',
    courseSectionId: 'operations_research',
    text: 'ترکیب روش‌های تصمیم چندمعیاره با شبیه‌سازی در چه شرایطی بیشترین سود را دارد؟',
    options: [
      "وقتی ورودی معیارها نامطمئن و تصادفی است و باید توزیع رتبه‌ها سنجیده شود",
      "وقتی همهٔ داده‌ها قطعی و ثابت‌اند",
      "وقتی فقط یک معیار و یک گزینه در تصمیم هست",
      "وقتی محاسبات باید در کمترین زمان انجام شود",
    ],
    expectedTimeMs: 45000,
  }),

  // شیلینگ — فصل ۹: استانداردها، شبکه‌ها و اثر خارجی
  authored('sch.9.1', {
    nodeId: 'inno.s_curve',
    referenceChapterId: 'ch.sch.9',
    text: 'در «جنگ استاندارد»، نقش اصلی اتحادهای صنعتی چیست؟',
    options: [
      "کاهش رقابت از طریق توافق‌های قیمت‌گذاری",
      "حذف کامل رقبای دارای فناوری جایگزین",
      "انتقال دانش محرمانه به رقبا برای هم‌سطح‌سازی",
      "جمع‌آوری مکمل‌ها و ذی‌نفعان حول یک فناوری تا جرم بحرانی بازار ایجاد شود",
    ],
  }),
  authored('sch.9.2', {
    nodeId: 'inno.s_curve',
    referenceChapterId: 'ch.sch.9',
    text: '«اثر شبکه» با چه سازوکاری ارزش فناوری را تقویت می‌کند؟',
    options: [
      "بازخورد مثبت: با افزایش کاربران، ارزش برای هر کاربر بیشتر می‌شود و پذیرش شتاب می‌گیرد",
      "کاهش هزینهٔ تولید با مقیاس بالاتر",
      "افزایش هزینهٔ تغییر (سوئیچینگ) بدون تغییر ارزش ادراکی",
      "انحصار قانونی روی فناوری از طریق پتنت",
    ],
  }),
  authored('sch.9.3', {
    nodeId: 'inno.s_curve',
    referenceChapterId: 'ch.sch.9',
    text: 'نقش «مکمل‌های کلیدی» در پذیرش یک فناوری جدید چیست؟',
    options: [
      "مکمل‌ها فقط در مرحلهٔ افول فناوری اهمیت دارند",
      "بدون مکمل‌های کافی (محصولات و خدمات وابسته)، ارزش کل اکوسیستم شکل نمی‌گیرد و پذیرش کند می‌ماند",
      "مکمل‌ها فقط هزینهٔ تبلیغات را می‌کاهند",
      "مکمل‌ها جایگزین استانداردسازی می‌شوند",
    ],
  }),

  // تید — فصل ۲: فرایند مدیریت نوآوری
  authored('tidd.2.1', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.2',
    text: 'چهار مرحلهٔ فرایند مدیریت نوآوری در چارچوب تید و بسانت کدام‌اند؟',
    options: [
      "ایده ← طرح ← تولید ← فروش",
      "تحلیل ← طراحی ← پیاده‌سازی ← نگهداشت",
      "اکتشاف ← بهره‌برداری ← تلفیق ← گذار",
      "جست‌وجو ← انتخاب ← اجرا ← ارزش‌گیری",
    ],
  }),
  authored('tidd.2.2', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.2',
    text: '«قیف نوآوری» همراه با دروازه‌های مرحله‌ای چه کاری می‌کند؟',
    options: [
      "ایده‌های متعدد را با معیارهای عبور از هر دروازه به تدریج به پروژهٔ انتخاب‌شده می‌رساند",
      "همهٔ ایده‌های ورودی را هم‌زمان به اجرا می‌رساند",
      "ایده‌ها را مستقیم به بازار عرضه می‌کند بدون غربال",
      "فقط ایده‌های بیرونی را به فرایند وارد می‌کند",
    ],
  }),
  authored('tidd.2.3', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.2',
    text: 'نقش «یادگیری بازخوردی» در فرایند مدیریت نوآوری چیست؟',
    options: [
      "یادگیری بازخوردی جایگزین کامل دروازه‌های مرحله‌ای است",
      "نتایج هر مرحله، جست‌وجو و انتخاب مرحلهٔ بعد را به‌روزرسانی می‌کند؛ فرایند خطی یک‌طرفه نیست",
      "یادگیری فقط در پایان پروژه و برای مستندسازی انجام می‌شود",
      "بازخورد فقط از مشتری نهایی و پس از عرضه جمع می‌شود",
    ],
  }),

  /* ===== پوشش نمای کتابخانه: فصل‌هایی که تنها سؤال‌های سالانهٔ درس را
     (از مسیر استنتاج هاب) می‌گرفتند و در استخر خود کتاب سؤالی نداشتند ===== */

  // بازاریابی — فصل ۲: محیط، نظام اطلاعات و تحقیقات بازار
  authored('kotler.2.1', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.2',
    courseSectionId: 'marketing',
    text: 'کدام گزینه اجزای «محیط خرد بازاریابی» را به‌درستی فهرست می‌کند؟',
    options: [
      "نیروهای جمعیتی، اقتصادی، طبیعی و فناورانه",
      "بخش‌بندی، هدف‌گذاری، جایگاه‌یابی و ترویج",
      "محصول، قیمت، کانال توزیع و ترویج",
      "تأمین‌کننده، واسطه‌ها، مشتری، رقیب و مخاطبان عمومی",
    ],
  }),
  authored('kotler.2.2', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.2',
    courseSectionId: 'marketing',
    text: 'ترتیب صحیح مراحل فرایند تحقیقات بازاریابی کدام است؟',
    options: [
      "تعریف مسئله ← طرح تحقیق ← جمع‌آوری داده ← تحلیل ← گزارش",
      "جمع‌آوری داده ← تعریف مسئله ← تحلیل ← طرح ← گزارش",
      "طرح تحقیق ← گزارش ← تعریف مسئله ← جمع‌آوری ← تحلیل",
      "تعریف مسئله ← تحلیل ← جمع‌آوری داده ← طرح ← گزارش",
    ],
  }),
  authored('kotler.2.3', {
    nodeId: 'mkt.plc',
    referenceChapterId: 'ch.kotler.2',
    courseSectionId: 'marketing',
    text: '«دادهٔ ثانویه» در تحقیقات بازاریابی به کدام داده گفته می‌شود؟',
    options: [
      "داده‌ای که پس از تحلیل داده‌های اولیه ساخته می‌شود",
      "داده‌ای که پیش‌تر برای هدف دیگری گردآوری و از منابع موجود گرفته می‌شود",
      "داده‌ای که برای اولین بار و مخصوص همین مسئله گردآوری می‌شود",
      "داده‌ای که فقط از پیمایش میدانی به دست می‌آید",
    ],
  }),

  // زبان — فصل ۱: واژگان پرتکرار متون مدیریت
  authored('eng.1.1', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.1',
    courseSectionId: 'english',
    text: 'در متون مدیریت، فعل «allocate» به معنای چیست؟',
    options: [
      "تفویض اختیار به زیردستان",
      "سنجش و ارزیابی عملکرد",
      "حفظ و نگه‌داشتن مشتریان",
      "تخصیص دادن منابع یا بودجه به فعالیت‌ها",
    ],
    expectedTimeMs: 40000,
  }),
  authored('eng.1.2', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.1',
    courseSectionId: 'english',
    text: 'واژهٔ «mitigate» در جملهٔ «to mitigate the risk» چه معنایی دارد؟',
    options: [
      "کاهش دادن و کمرنگ کردن اثر خطر",
      "انتقال خطر به طرف مقابل",
      "پذیرش کامل خطر بدون اقدام",
      "مستندسازی خطر برای گزارش سالانه",
    ],
  }),
  authored('eng.1.3', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.1',
    courseSectionId: 'english',
    text: 'کدام گزینه معنای درست «leverage» در متون مدیریت است؟',
    options: [
      "انباشت سود در دارایی‌های ثابت",
      "بهره‌برداری از توانایی‌ها و منابع موجود برای دستاورد بیشتر",
      "اعمال قدرت قانونی بر رقبا",
      "حذف تدریجی یک واحد سازمانی",
    ],
  }),

  // زبان — فصل ۸: درک مطلب جزئیات و استنباط
  authored('eng.8.1', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.8',
    courseSectionId: 'english',
    text: 'پاسخ سؤال‌های «جزئیات» در درک مطلب کجا باید پیدا شود؟',
    options: [
      "از عنوان متن و نگرش نویسنده",
      "از جمع‌بندی پاسخ‌های سؤال‌های دیگر",
      "عیناً در متن، با اسکن کلیدواژه‌های سؤال",
      "از دانش عمومی داوطلب دربارهٔ موضوع",
    ],
  }),
  authored('eng.8.2', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.8',
    courseSectionId: 'english',
    text: 'سؤال «استنباط» (inference) معمولاً از کجا نتیجه گرفته می‌شود؟',
    options: [
      "فقط از جملهٔ اول پاراگراف آخر",
      "از عنوان متن بدون خواندن بدنه",
      "از شمارش تکرار کلیدواژه‌ها در متن",
      "از دو یا سه جملهٔ مرتبط متن، نه از یک جزئیات تنها",
    ],
  }),
  authored('eng.8.3', {
    nodeId: 'bus.english_eshraghi',
    referenceChapterId: 'ch.eng.8',
    courseSectionId: 'english',
    text: 'در سؤال استنباط، گزینه‌ای با قیدهایی مانند «always» یا «never» معمولاً چگونه است؟',
    options: [
      "بیش‌تعمیم و معمولاً غلط",
      "همیشه درست، چون پوشش کامل می‌دهد",
      "خنثی و بدون اثر بر درستی",
      "درست فقط در متون مدیریت",
    ],
  }),

  // تئوری‌های مدیریت — فصل ۲: نقش‌های مینتزبرگ و مهارت‌های کتز
  authored('th.2.1', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.2',
    courseSectionId: 'management_theories',
    text: 'ده نقش مدیریتی مینتزبرگ در کدام سه دسته قرار می‌گیرند؟',
    options: [
      "برنامه‌ریزی، سازماندهی و کنترل",
      "خطی، ستادی و کارشناسی",
      "اطلاعاتی، میان‌فردی و تصمیمی",
      "فنی، انسانی و ادراکی",
    ],
  }),
  authored('th.2.2', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.2',
    courseSectionId: 'management_theories',
    text: 'بر پایهٔ مهارت‌های کتز، سهم مهارت‌ها در سطوح مدیریتی چگونه است؟',
    options: [
      "مهارت فنی در همهٔ سطوح به یک اندازه اهمیت دارد",
      "مهارت ادراکی فقط برای سرپرستان خط تولید لازم است",
      "مهارت انسانی فقط برای مدیران ارشد لازم است",
      "مهارت فنی در سطوح پایین مهم‌تر و مهارت ادراکی در سطوح بالا مهم‌تر است",
    ],
  }),
  authored('th.2.3', {
    nodeId: 'mb.structure',
    referenceChapterId: 'ch.th.2',
    courseSectionId: 'management_theories',
    text: 'نقش «نمادین (figurehead)» در دسته‌بندی مینتزبرگ جزو کدام دسته است؟',
    options: [
      "نقش‌های میان‌فردی",
      "نقش‌های اطلاعاتی",
      "نقش‌های تصمیمی",
      "نقش‌های فنی",
    ],
  }),

  // ریاضی و آمار — فصل ۹: برآورد، فاصلهٔ اطمینان و آزمون فرض
  authored('math.9.1', {
    nodeId: 'stats.regression',
    referenceChapterId: 'ch.math.9',
    courseSectionId: 'math_stats',
    text: 'اثر افزایش حجم نمونه بر خطای استاندارد برآوردگر چیست؟',
    options: [
      "خطای استاندارد افزایش می‌یابد",
      "خطای استاندارد تغییری نمی‌کند",
      "خطای استاندارد صفر می‌شود",
      "خطای استاندارد کاهش می‌یابد و دقت برآورد بیشتر می‌شود",
    ],
  }),
  authored('math.9.2', {
    nodeId: 'stats.regression',
    referenceChapterId: 'ch.math.9',
    courseSectionId: 'math_stats',
    text: '«خطای نوع اول» در آزمون فرض چه وضعیتی است؟',
    options: [
      "رد کردن فرض صفر در حالی که درست است",
      "پذیرفتن فرض صفر در حالی که غلط است",
      "انتخاب نمونه‌ای غیرتصادفی",
      "استفاده از آزمون نادرست برای نوع داده",
    ],
  }),
  authored('math.9.3', {
    nodeId: 'stats.regression',
    referenceChapterId: 'ch.math.9',
    courseSectionId: 'math_stats',
    text: 'تفسیر درست «p-value» در آزمون فرض کدام است؟',
    options: [
      "احتمال وقوع خطای نوع دوم",
      "احتمال مشاهدهٔ داده‌ای به این شدت متضاد با فرض صفر، در صورت درستی فرض صفر",
      "احتمال درست بودن فرض صفر",
      "احتمال درست بودن فرض مقابل",
    ],
  }),

  // مدیریت اسلامی — فصل ۱۰: مقایسه با مکاتب
  authored('isl.10.1', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.10',
    courseSectionId: 'islamic',
    text: 'مقایسهٔ مدیریت اسلامی با مکاتب مدیریت بر کدام چهار محور صورت می‌گیرد؟',
    options: [
      "برنامه‌ریزی، سازماندهی، رهبری و بودجه",
      "نگاه به انسان، هدف سازمان، مبنای انگیزش و ابزار کنترل",
      "اندازه سازمان، سود، بازار و رقابت",
      "ساختار، فناوری، محیط و استراتژی",
    ],
  }),
  authored('isl.10.2', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.10',
    courseSectionId: 'islamic',
    text: 'کدام گزینه یک «دام نسبت‌دهی» رایج در سؤال‌های مقایسهٔ مدیریت اسلامی است؟',
    options: [
      "نسبت‌دادن عدالت سازمانی به هر سه بُعد آن",
      "نسبت‌دادن نظارت درونی و بیرونی به هم",
      "نسبت‌دادن انحصار خودکنترلی به مدیریت اسلامی یا پاداش صرفاً مادی به آن",
      "نسبت‌دادن مشورت به الگوی اسلامی",
    ],
  }),
  authored('isl.10.3', {
    nodeId: 'bus.islamic_moghimi',
    referenceChapterId: 'ch.isl.10',
    courseSectionId: 'islamic',
    text: 'تفاوت مبنای انگیزش در مدیریت اسلامی نسبت به نظریه‌های صرفاً مادی چیست؟',
    options: [
      "حذف کامل پاداش مادی از نظام انگیزش",
      "اتکای صرف به تنبیه بیرونی",
      "پذیرش انگیزش فقط برای مدیران ارشد",
      "ترکیب پاداش مادی مشروع با انگیزهٔ معنوی مانند رضایت الهی",
    ],
  }),

  // استراتژی — فصل ۱: ماهیت، سطوح و مدل دیوید
  authored('str.1.1', {
    nodeId: 'sm.rbv',
    referenceChapterId: 'ch.str.1',
    courseSectionId: 'management_theories',
    text: 'سطوح سه‌گانهٔ استراتژی کدام‌اند؟',
    options: [
      "سطح تدوین، اجرا و ارزیابی",
      "سطح ملی، صناعتی و بنگاهی",
      "سطح شرکتی، سطح کسب‌وکار و سطح وظیفه‌ای",
      "سطح کلان، میانی و خرد",
    ],
  }),
  authored('str.1.2', {
    nodeId: 'sm.rbv',
    referenceChapterId: 'ch.str.1',
    courseSectionId: 'management_theories',
    text: 'مدل جامع مدیریت استراتژیک فرد دیوید بر کدام سه فاز بنا شده است؟',
    options: [
      "تجزیه و تحلیل، انتخاب و بازنگری",
      "برنامه‌ریزی، بودجه‌بندی و کنترل",
      "چشم‌انداز، مأموریت و اهداف",
      "تدوین، اجرا و ارزیابی استراتژی",
    ],
  }),
  authored('str.1.3', {
    nodeId: 'sm.rbv',
    referenceChapterId: 'ch.str.1',
    courseSectionId: 'management_theories',
    text: 'تفاوت اصلی استراتژی با تاکتیک چیست؟',
    options: [
      "استراتژی مسیر بلندمدت و کلان است؛ تاکتیک اقدام کوتاه‌مدت برای اجرای همان مسیر",
      "استراتژی کوتاه‌مدت است و تاکتیک بلندمدت",
      "استراتژی فقط مالی است و تاکتیک عملیاتی",
      "تفاوت معناداری میان آن‌ها وجود ندارد",
    ],
  }),

  // استراتژی — فصل ۲: مکاتب ده‌گانه مینتزبرگ
  authored('str.2.1', {
    nodeId: 'sm.rbv',
    referenceChapterId: 'ch.str.2',
    courseSectionId: 'management_theories',
    text: 'سه مکتب «تجویزی» مینتزبرگ کدام‌اند؟',
    options: [
      "کارآفرینی، شناختی و یادگیری",
      "قدرت، فرهنگی و محیطی",
      "پیکربندی، سیاسی و کنجکاوی",
      "طراحی، برنامه‌ریزی و موقعیت‌یابی",
    ],
  }),
  authored('str.2.2', {
    nodeId: 'sm.rbv',
    referenceChapterId: 'ch.str.2',
    courseSectionId: 'management_theories',
    text: 'مکتب «پیکربندی» در دسته‌بندی مینتزبرگ چه نقشی دارد؟',
    options: [
      "مکتب تلفیقی است که سایر مکاتب را در پیکربندی‌های زمانی و موقعیتی یکپارچه می‌کند",
      "مکتب تجویزی نخست و پایهٔ دو مکتب دیگر است",
      "مکتب توصیفی ناظر بر قدرت و سیاست درون‌سازمانی است",
      "مکتبی جدا از نه مکتب دیگر با موضوع رشد بنگاه",
    ],
  }),
  authored('str.2.3', {
    nodeId: 'sm.rbv',
    referenceChapterId: 'ch.str.2',
    courseSectionId: 'management_theories',
    text: 'کدام گزینه دربارهٔ مکتب «موقعیت‌یابی» درست است؟',
    options: [
      "مکتبی تلفیقی میان ده مکتب است",
      "از خانوادهٔ مکاتب تجویزی است، نه توصیفی",
      "از خانوادهٔ مکاتب توصیفی است، نه تجویزی",
      "از مکاتب تصمیمی است",
    ],
  }),

  // استراتژی — فصل ۳: PEST و پنج نیروی پورتر
  authored('str.3.1', {
    nodeId: 'sm.value_chain',
    referenceChapterId: 'ch.str.3',
    courseSectionId: 'management_theories',
    text: 'پنج نیروی مدل پورتر کدام‌اند؟',
    options: [
      "ورود تازه‌واردان، قدرت تأمین‌کننده، قدرت خریدار، تهدید جانشین و شدت رقابت",
      "قوت، ضعف، فرصت، تهدید و رقابت",
      "جمعیتی، اقتصادی، فناورانه، سیاسی و فرهنگی",
      "هزینه، تمایز، تمرکز، نفوذ و هم‌افزایی",
    ],
  }),
  authored('str.3.2', {
    nodeId: 'sm.value_chain',
    referenceChapterId: 'ch.str.3',
    courseSectionId: 'management_theories',
    text: 'تحلیل PESTEL کدام سطح از محیط را بررسی می‌کند؟',
    options: [
      "فقط محیط رقابتی صنعت",
      "محیط کلان و عام",
      "محیط خرد و صنعت",
      "محیط درونی سازمان",
    ],
  }),
  authored('str.3.3', {
    nodeId: 'sm.value_chain',
    referenceChapterId: 'ch.str.3',
    courseSectionId: 'management_theories',
    text: '«نقشهٔ گروه‌های استراتژیک» چه چیزی را نشان می‌دهد؟',
    options: [
      "چرخهٔ حیات محصولات صنعت",
      "سهم بازار یک بنگاه در طول زمان",
      "خوشه‌بندی رقبای صنعت بر پایهٔ ابعاد رقابتی مشابه",
      "زنجیرهٔ تأمین مواد اولیهٔ صنعت",
    ],
  }),

  // استراتژی — فصل ۸: استراتژی سطح شرکت
  authored('str.8.1', {
    nodeId: 'sm.portfolio',
    referenceChapterId: 'ch.str.8',
    courseSectionId: 'management_theories',
    text: 'تفاوت «تنوع مرتبط» با «تنوع ناهمبسته» چیست؟',
    options: [
      "هر دو یک معنا دارند و فقط در نام متفاوت‌اند",
      "تنوع مرتبط بر هم‌افزایی میان واحدها تکیه دارد؛ ناهمبسته به دنبال پراکنده‌سازی بدون پیوند عملیاتی است",
      "تنوع مرتبط فقط در بازار خارجی و ناهمبسته فقط در بازار داخلی رخ می‌دهد",
      "تنوع مرتبط همان ادغام عمودی و ناهمبسته همان ادغام افقی است",
    ],
  }),
  authored('str.8.2', {
    nodeId: 'sm.portfolio',
    referenceChapterId: 'ch.str.8',
    courseSectionId: 'management_theories',
    text: 'ادغام «عمودی رو به جلو» به معنای ورود به کدام بخش زنجیره است؟',
    options: [
      "صنایع کاملاً بی‌ارتباط با کسب‌وکار فعلی",
      "فقط بازارهای صادراتی",
      "بخش‌های پایین‌دست مانند توزیع و فروش",
      "بخش‌های بالادست مانند تأمین مواد اولیه",
    ],
  }),
  authored('str.8.3', {
    nodeId: 'sm.portfolio',
    referenceChapterId: 'ch.str.8',
    courseSectionId: 'management_theories',
    text: '«مزیت والد» در تصمیم نگه‌داشتن یا واگذاری واحد چه معیاری است؟',
    options: [
      "والد همیشه بزرگ‌ترین سهم را از واحد می‌برد",
      "واحد همیشه زیر نظر والد می‌ماند",
      "مزیت والد فقط با هزینهٔ هماهنگی سنجیده نمی‌شود",
      "والد باید افزودهٔ ارزش مشخصی برای واحد ایجاد کند؛ در غیر این صورت واگذاری منطقی‌تر است",
    ],
  }),

  // استراتژی — فصل ۹: استراتژی بین‌الملل و مشارکت‌ها
  authored('str.9.1', {
    nodeId: 'sm.portfolio',
    referenceChapterId: 'ch.str.9',
    courseSectionId: 'management_theories',
    text: 'در ماتریس فشار هزینه و فشار محلی، استراتژی «فراملی» کدام ترکیب را دارد؟',
    options: [
      "فشار هزینه پایین و فشار محلی بالا",
      "فشار هزینه پایین و فشار محلی پایین",
      "فشار هزینه بالا و فشار محلی بالا",
      "فشار هزینه بالا و فشار محلی پایین",
    ],
  }),
  authored('str.9.2', {
    nodeId: 'sm.portfolio',
    referenceChapterId: 'ch.str.9',
    courseSectionId: 'management_theories',
    text: 'کدام گزینه حالت‌های ورود به بازار بین‌الملل را به‌درستی فهرست می‌کند؟',
    options: [
      "بخش‌بندی، هدف‌گذاری، جایگاه‌یابی و توزیع",
      "ادغام افقی، ادغام عمودی و واگذاری",
      "تمرکز، تمایز و رهبری هزینه",
      "صادرات، لایسنس، سرمایه‌گذاری مشترک، نمایندگی و سرمایه‌گذاری مستقیم",
    ],
  }),
  authored('str.9.3', {
    nodeId: 'sm.portfolio',
    referenceChapterId: 'ch.str.9',
    courseSectionId: 'management_theories',
    text: 'کدام گزینه انگیزه‌های بین‌المللی‌شدن بنگاه را می‌پوشاند؟',
    options: [
      "دسترسی به بازار و منابع، صرفه‌جویی هزینه و کاهش ریسک تمرکز",
      "کاهش تنوع محصول و بستن بازارهای صادراتی",
      "افزایش هزینه‌ها برای مصافحهٔ مالیاتی",
      "حذف شرکای محلی از همهٔ بازارها",
    ],
  }),

  // تولید و عملیات — فصل ۸: چیدمان، ظرفیت و برنامه‌ریزی تجمیعی
  authored('pom.8.1', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.8',
    courseSectionId: 'production',
    text: 'انواع چیدمان تولیدی کدام‌اند؟',
    options: [
      "محصولی، فرایندی، سلولی و ثابت",
      "خطی، ستادی، ماتریسی و شبکه‌ای",
      "تعقیبی، سطحی، ترکیبی و جبرانی",
      "قطعی، احتمالی، تصادفی و قطعی‌شده",
    ],
  }),
  authored('pom.8.2', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.8',
    courseSectionId: 'production',
    text: '«گلوگاه» در سنجش ظرفیت چیست؟',
    options: [
      "نقطهٔ شروع خط تولید",
      "ایستگاهی با کمترین ظرفیت که خروجی کل سیستم را محدود می‌کند",
      "ایستگاهی با بیشترین ظرفیت و کمترین صف",
      "محلی برای انبارش مواد اولیه",
    ],
  }),
  authored('pom.8.3', {
    nodeId: 'ind.pom_eoq_mrp',
    referenceChapterId: 'ch.pom.8',
    courseSectionId: 'production',
    text: 'سه استراتژی اصلی برنامه‌ریزی تجمیعی کدام‌اند؟',
    options: [
      "قطعی، احتمالی و شبیه‌سازی",
      "پیش‌نگر، هم‌زمان و پس‌نگر",
      "تعقیبی، سطحی و ترکیبی",
      "هزینه‌ای، تمایزی و تمرکزی",
    ],
  }),

  // MCDM — فصل ۱: فرایند تحلیل سلسله‌مراتبی (AHP)
  authored('mcdm.1.1', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.1',
    courseSectionId: 'operations_research',
    text: 'در مقایسه‌های زوجی AHP از چه مقیاسی استفاده می‌شود؟',
    options: [
      "مقیاس درصدی صفر تا صد",
      "مقیاس لگاریتمی ۱ تا ۱۰۰",
      "مقیاس ساعتی ۱ تا ۹",
      "مقیاس باینری صفر و یک",
    ],
  }),
  authored('mcdm.1.2', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.1',
    courseSectionId: 'operations_research',
    text: 'شرط پذیرش ماتریس مقایسه‌های زوجی در AHP چیست؟',
    options: [
      "$CI = RI/CR < 1$",
      "$CR = 0$ دقیقاً",
      "$RI = 0.1$ و بدون شرط دیگر",
      "$CR = CI/RI < 0.1$",
    ],
  }),
  authored('mcdm.1.3', {
    nodeId: 'ind.mcdm_dea_queue',
    referenceChapterId: 'ch.mcdm.1',
    courseSectionId: 'operations_research',
    text: 'وزن معیارها در AHP از کجا استخراج می‌شود؟',
    options: [
      "از بردار ویژهٔ اصلی ماتریس مقایسه‌های زوجی",
      "از میانگین سادهٔ سطرهای ماتریس بدون نرمال‌سازی",
      "از آرای کارشناسان بدون هیچ محاسبه",
      "از حل مدل پوششی داده‌ها",
    ],
  }),

  // شیلینگ — فصل ۳: زمان‌بندی ورود به بازار
  authored('sch.3.1', {
    nodeId: 'inno.s_curve',
    referenceChapterId: 'ch.sch.3',
    text: 'کدام گزینه مزیت‌های پیشگام بودن در بازار را می‌پوشاند؟',
    options: [
      "استانداردسازی کامل بدون سرمایه‌گذاری",
      "اثر یادگیری، قفل‌شدن مشتری و اثر شبکه",
      "اطلاعات کامل بازار و حذف ریسک",
      "هزینهٔ توسعهٔ کمتر و زمان بازگشت کوتاه‌تر",
    ],
  }),
  authored('sch.3.2', {
    nodeId: 'inno.s_curve',
    referenceChapterId: 'ch.sch.3',
    text: 'بزرگ‌ترین ریسک پیشگام بودن در بازار چیست؟',
    options: [
      "کمبود شدید مشتری وفادار به رقیب",
      "بالا بودن بلوغ فناوری در لحظهٔ ورود",
      "عدم قطعیت بازار و فناوری با هزینهٔ پیشگامی بالا",
      "نبود هیچ رقیب تا پایان چرخهٔ عمر",
    ],
  }),
  authored('sch.3.3', {
    nodeId: 'inno.s_curve',
    referenceChapterId: 'ch.sch.3',
    text: 'زمان بهینهٔ ورود به بازار بر پایهٔ کدام عوامل تعیین می‌شود؟',
    options: [
      "فقط اندازهٔ بودجهٔ تبلیغات",
      "فقط تعداد رقبای فعلی بازار",
      "فقط دستور مدیرعامل و چرخهٔ سالانه",
      "بلوغ فناوری، آمادگی بازار و توان مکمل‌ها",
    ],
  }),

  // شیلینگ — فصل ۵: همکاری، اتحاد و شبکه‌های نوآوری
  authored('sch.5.1', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.sch.5',
    text: 'انواع همکاری در نوآوری کدام‌اند؟',
    options: [
      "فقط خرید سهام و ادغام کامل",
      "فقط قرارداد فروش و توزیع",
      "فقط برون‌سپاری نیروی کار",
      "اتحاد راهبردی، سرمایه‌گذاری مشترک، کنسرسیوم و قرارداد تحقیق",
    ],
  }),
  authored('sch.5.2', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.sch.5',
    text: 'مزیت اصلی اتحادهای نوآوری چیست؟',
    options: [
      "دسترسی به دانش و قابلیت‌های مکمل شریک بدون تملک کامل",
      "حذف کامل نیاز به تحقیق و توسعهٔ داخلی",
      "حذف ریسک از همهٔ قراردادها",
      "تضمین سود ثابت در هر فصل",
    ],
  }),
  authored('sch.5.3', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.sch.5',
    text: 'ریسک اصلی همکاری‌های نوآوری کدام است؟',
    options: [
      "افزایش تعداد مشتریان نهایی",
      "فرصت‌طلبی شریک و نشت دانش اختصاصی",
      "کاهش تعداد گزینه‌های تأمین مالی",
      "کم‌شدن سرعت تصمیم‌گیری هیئت مدیره",
    ],
  }),

  // شیلینگ — فصل ۶: حفاظت از نوآوری (appropriation)
  authored('sch.6.1', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.sch.6',
    text: 'ابزارهای حفاظت از نوآوری کدام‌اند؟',
    options: [
      "پتنت، کپی‌رایت، علامت تجاری، راز تجاری و زمان پیشرو بودن",
      "فقط افزایش قیمت و کاهش عرضه",
      "فقط قرارداد محرمانگی با مشتریان",
      "فقط انحصار کانال توزیع",
    ],
  }),
  authored('sch.6.2', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.sch.6',
    text: 'چرا صنعت دارو بیش از صنعت نرم‌افزار به پتنت تکیه می‌کند؟',
    options: [
      "چون پتنت دارو ارزان‌تر از نرم‌افزار ثبت می‌شود",
      "چون کشف دارو هزینهٔ بالا و بازتولید آسان دارد و راز تجاری در آزمایش‌های بالینی پایدار نمی‌ماند",
      "چون نرم‌افزار قابل ثبت حقوقی نیست",
      "چون دارو فقط در بازارهای انحصاری فروخته می‌شود",
    ],
  }),
  authored('sch.6.3', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.sch.6',
    text: '«دارایی‌های مکمل» در چارچوب تیس چه نقشی در ارزش‌گیری از نوآوری دارند؟',
    options: [
      "جایگزین کامل پتنت می‌شوند",
      "فقط به دوران افول فناوری مربوط‌اند",
      "برنده‌زنی و قدرت چانه‌زنی در تقسیم ارزش نوآوری را تعیین می‌کنند",
      "فقط هزینهٔ تولید محصول نهایی را کاهش می‌دهند",
    ],
  }),

  // تید — فصل ۶: خلق و انتقال دانش
  authored('tidd.6.1', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.tidd.6',
    text: 'چهار سازوکار الگوی SECI نوناکا و تاکوچی کدام‌اند؟',
    options: [
      "جست‌وجو، انتخاب، اجرا و ارزش‌گیری",
      "برنامه‌ریزی، سازماندهی، رهبری و کنترل",
      "تولید، انباشت، بازیابی و حذف دانش",
      "اجتماعی‌سازی، برونی‌سازی، ترکیب و درونی‌سازی",
    ],
  }),
  authored('tidd.6.2', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.tidd.6',
    text: 'تفاوت دانش ضمنی با دانش صریح چیست؟',
    options: [
      "دانش ضمنی در تجربه و مهارت فرد نشسته و به‌سختی مستند می‌شود؛ صریح قابل نوشتن و انتقال است",
      "دانش ضمنی فقط در اسناد رسمی ثبت می‌شود",
      "دانش صریح همیشه ارزشمندتر از ضمنی است",
      "هر دو یک معنا دارند و فقط در نام متفاوت‌اند",
    ],
  }),
  authored('tidd.6.3', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.tidd.6',
    text: '«ظرفیت جذب» چه نقشی در انتقال دانش دارد؟',
    options: [
      "تعداد دوره‌های آموزشی سالانهٔ سازمان",
      "توان شناسایی، همسان‌سازی و بهره‌برداری از دانش بیرونی؛ بدون آن انتقال شکست می‌خورد",
      "فقط ظرفیت انبارش اسناد فنی سازمان",
      "سرعت خرید تجهیزات جدید از بیرون",
    ],
  }),

  // تید — فصل ۷: طبقه‌بندی استراتژیک فناوری (ADL)
  authored('tidd.7.1', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.7',
    text: 'چهار دستهٔ طبقه‌بندی ADL کدام‌اند؟',
    options: [
      "فناوری پایه، کلیدی، پیشرو (سرآمد) و در حال ظهور",
      "پایه، میانی، عالی و نمونه",
      "ظهور، رشد، بلوغ و افول",
      "کلیدی، مکمل، جایگزین و رقیب",
    ],
  }),
  authored('tidd.7.2', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.7',
    text: 'استراتژی متناظر هر دسته در ADL چیست؟',
    options: [
      "برون‌سپاری کلیدی و نگه‌داری پایه",
      "برون‌سپاری پایه، نگه‌داری کلیدی، سرمایه‌گذاری پیشرو و پایش ظهور",
      "سرمایه‌گذاری سنگین روی پایه و حذف بقیه",
      "پایش همهٔ فناوری‌ها بدون تمایز",
    ],
  }),
  authored('tidd.7.3', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.7',
    text: 'مکان‌یابی فناوری در ماتریس ADL بر چه مبنایی است؟',
    options: [
      "تعداد پژوهشگران × بودجهٔ سالانه",
      "سهم بازار محصول × نرخ رشد",
      "اهمیت رقابتی فناوری × بلوغ آن",
      "هزینهٔ ثبت پتنت × عمر فناوری",
    ],
  }),

  // تید — فصل ۸: اطلس فناوری و اجزای چهارگانه
  authored('tidd.8.1', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.8',
    text: 'اجزای چهارگانهٔ اطلس فناوری کدام‌اند؟',
    options: [
      "ورودی، فرایند، خروجی و بازخورد",
      "تکنولوژی‌های در حال ظهور، سرآمد، کلیدی و پایه",
      "محصول، فرایند، جایگاه و پارادایم",
      "جست‌وجو، انتخاب، اجرا و ارزش‌گیری",
    ],
  }),
  authored('tidd.8.2', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.8',
    text: '«حرکت فناوری میان اجزای اطلس» چه پیامدی دارد؟',
    options: [
      "حرکت فقط از پایه به ظهور و بی‌بازگشت است",
      "پیامدی بر تصمیم‌های سرمایه‌گذاری ندارد",
      "فناوری در گذر زمان جابه‌جا می‌شود و سبد R&D باید متناسب با آن بازتنظیم شود",
      "مکان فناوری در اطلس همیشه ثابت می‌ماند",
    ],
  }),
  authored('tidd.8.3', {
    nodeId: 'inno.tidd_4p',
    referenceChapterId: 'ch.tidd.8',
    text: 'فناوری‌های «سرآمد» در اطلس فناوری چه ویژگی‌ای دارند؟',
    options: [
      "فناوری‌هایی که همهٔ رقبا در اختیار دارند",
      "فناوری‌های آینده که هنوز اثبات نشده‌اند",
      "فناوری‌های استاندارد صنعت با دسترسی آسان",
      "پیشرفته‌ترین فناوری‌های در اختیار سازمان‌اند که مزیت امروز را می‌سازند",
    ],
  }),

  // چسبرو — فصل ۴: مدل‌های کسب‌وکار باز
  authored('op.4.1', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.4',
    text: 'سازوکارهای ارزش‌گیری در مدل کسب‌وکار باز کدام‌اند؟',
    options: [
      "فقط فروش مستقیم محصول داخلی",
      "فقط افزایش قیمت لایسنس",
      "فقط بستن دروازهٔ ورود دانش بیرونی",
      "پلتفرم و API، اسپین‌آف/اسپین‌این و سرمایه‌گذاری شرکتی (CVC)",
    ],
  }),
  authored('op.4.2', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.4',
    text: 'انتخاب سازوکار ارزش‌گیری در مدل باز بر چه اساسی انجام می‌شود؟',
    options: [
      "نزدیکی موضوع به شایستگی محوری سازمان",
      "ترتیب الفبایی نام شرکا",
      "بزرگی شرکای تجاری بالقوه",
      "سن تقویمی فناوری",
    ],
  }),
  authored('op.4.3', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.4',
    text: '«اسپین‌این» در ادبیات نوآوری باز یعنی چه؟',
    options: [
      "بستن پروژهٔ داخلی به دلیل شکست فنی",
      "بازگرداندن دانش و ایدهٔ پرورده بیرون به درون سازمان",
      "جداسازی یک واحد داخلی به شرکت مستقل",
      "خرید یک استارتاپ خارجی",
    ],
  }),

  // چسبرو — فصل ۵: نسل‌های پنج‌گانهٔ مدیریت R&D (روث‌ول)
  authored('op.5.1', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.5',
    text: 'ترتیب نسل‌های پنج‌گانهٔ مدیریت R&D از دید روث‌ول چیست؟',
    options: [
      "فشار فناوری ← کشش بازار ← جفت‌شدن ← یکپارچگی با استراتژی ← شبکه‌ای/سیستمی",
      "کشش بازار ← فشار فناوری ← شبکه‌ای ← جفت‌شدن ← یکپارچگی",
      "جفت‌شدن ← فشار فناوری ← کشش بازار ← شبکه‌ای ← یکپارچگی",
      "یکپارچگی ← جفت‌شدن ← کشش بازار ← فشار فناوری ← شبکه‌ای",
    ],
  }),
  authored('op.5.2', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.5',
    text: 'در نسل دوم مدیریت R&D، منبع اصلی ایده‌ها کجاست؟',
    options: [
      "استراتژی کلان شرکت",
      "بازار و نیاز مشتری (کشش بازار)",
      "آزمایشگاه داخلی (فشار فناوری)",
      "شبکهٔ جهانی شرکا",
    ],
  }),
  authored('op.5.3', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.5',
    text: 'ویژگی نسل پنجم مدیریت R&D چیست؟',
    options: [
      "وابستگی صرف به بازار بدون تحقیق",
      "جدا بودن کامل R&D از استراتژی",
      "سازوکار شبکه‌ای و سیستمی با همکاری گسترده در سراسر زنجیره",
      "تمرکز کامل بر آزمایشگاه داخلی",
    ],
  }),

  // چسبرو — فصل ۶: قراردادهای انتقال فناوری
  authored('op.6.1', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.6',
    text: 'اشکال رایج قراردادهای انتقال فناوری کدام‌اند؟',
    options: [
      "فقط توافق‌های شفاهی میان مدیران",
      "لایسنس، فرانشیز، سرمایه‌گذاری مشترک، BOT و قرارداد کلید در دست",
      "فقط خرید و فروش تجهیزات",
      "فقط استخدام کارشناس خارجی",
    ],
  }),
  authored('op.6.2', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.6',
    text: 'چرا «خرید تجهیزات» به‌تنهایی انتقال فناوری محسوب نمی‌شود؟',
    options: [
      "چون تجهیزات وارداتی ممنوع است",
      "چون فقط نرم‌افزار ارزش فناورانه دارد",
      "چون دانش ضمنی و توان بهره‌برداری و نگهداشت با دستگاه منتقل نمی‌شود",
      "چون تجهیزات همیشه مستعمل‌اند",
    ],
  }),
  authored('op.6.3', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.6',
    text: 'انتخاب شکل قرارداد انتقال فناوری بر پایهٔ کدام معیارهاست؟',
    options: [
      "فقط قیمت پیشنهادی فروشنده",
      "فقط نام و اعتبار برند فروشنده",
      "فقط طول مدت قرارداد",
      "میزان انتقال دانش، سطح کنترل، ریسک و سرعت اجرا",
    ],
  }),

  // چسبرو — فصل ۱۰: موانع انتقال فناوری و ارزیابی موفقیت
  authored('op.10.1', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.10',
    text: 'موانع انتقال فناوری در کدام سه سطح طبقه‌بندی می‌شوند؟',
    options: [
      "فردی، سازمانی و بین‌سازمانی",
      "قانونی، مالی و تبلیغاتی",
      "فنی، اداری و حمل‌ونقل",
      "کوتاه‌مدت، میان‌مدت و بلندمدت",
    ],
  }),
  authored('op.10.2', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.10',
    text: 'سنجه‌های موفقیت انتقال فناوری کدام‌اند؟',
    options: [
      "فقط تعداد بازدیدهای فنی از سایت",
      "بهره‌برداری تجاری، زمان رسیدن به بازار و توان نگهداشت فناوری",
      "فقط تعداد قراردادهای امضاشده",
      "فقط هزینهٔ صرف‌شده برای انتقال",
    ],
  }),
  authored('op.10.3', {
    nodeId: 'inno.open_rd_transfer',
    referenceChapterId: 'ch.op.10',
    text: 'چرا انتقال فناوری مبتنی بر دانش ضمنی دشوارتر است؟',
    options: [
      "چون دانش ضمنی مالکیت قانونی ندارد",
      "چون دانش ضمنی فقط در صنایع نظامی دیده می‌شود",
      "چون دانش ضمنی مستندشدنی نیست و با تفاوت بافت فرهنگی و سازمانی انتقالش می‌شکند",
      "چون دانش ضمنی همیشه قدیمی‌تر از دانش صریح است",
    ],
  }),
];

export const AUTHORED_QUESTION_COUNT = CHAPTER_AUTHORED_QUESTIONS.length;
