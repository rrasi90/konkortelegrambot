import type { KonkorCourseSectionId } from './yearlyKonkorExams';
import type { KnowledgeNode, QuestionItem } from './konkorData';
import { REFERENCE_BOOKS_DATABASE, ReferenceBookItem } from './referenceBooksRepo';
import { BOOK_CHAPTERS, BookChapter } from './bookChaptersRepo';

export interface SubjectCourseDefinition {
  id: KonkorCourseSectionId;
  title: string;
  shortTitle: string;
  englishTitle: string;
  badge: string;
  accentColor: string; // tailwind color token
  gradient: string;
  questionCountInExam: string;
  coefficientMaster: string;
  coefficientDoctorate: string;
  primaryBookId: string;
  primaryBookTitle: string;
  primaryAuthor: string;
  whyImportantInExam: string;
  goldenChaptersSummary: string;
  diagramTags: string[];
}

export const SUBJECT_COURSE_DEFINITIONS: SubjectCourseDefinition[] = [
  {
    id: 'islamic',
    title: 'اصول و مبانی مدیریت از دیدگاه اسلام',
    shortTitle: 'مدیریت اسلامی',
    englishTitle: 'Islamic Management Principles',
    badge: '۱۵ تست در کنکور ارشد · ضریب ۲ بازرگانی و صنعتی · ضریب ۴ دکتری',
    accentColor: 'emerald',
    gradient: 'from-emerald-600 to-teal-700',
    questionCountInExam: '۱۵ سؤال (سؤالات ۳۱ تا ۴۵ دفترچه ارشد)',
    coefficientMaster: 'ضریب ۲ در تمامی گرایش‌های مدیریت بازرگانی، صنعتی و فناوری',
    coefficientDoctorate: 'ضریب ۴ در دروس تخصصی آزمون دکتری مدیریت (کد ۲۱۱۷)',
    primaryBookId: 'book.bus.islamic_moghimi',
    primaryBookTitle: 'اصول و مبانی مدیریت از دیدگاه اسلام',
    primaryAuthor: 'دکتر سید محمد مقیمی (انتشارات راه دان / دانشگاه تهران)',
    whyImportantInExam:
      'بیش از ۹۰٪ سؤالات کنکور ارشد و دکتری در ۸ سال اخیر مستقیماً از کتاب دکتر مقیمی طرح شده است. تمرکز بر عهدنامه مالک اشتر، شاخص‌های تصمیم‌گیری علوی، تقوا در نظارت و تفاوت رویکردهای غربی و اسلامی از کلیدی‌ترین بخش‌های نمره‌آور داوطلبان است.',
    goldenChaptersSummary:
      'فصل ۴ (برنامه‌ریزی و تصمیم‌گیری در اسلام)، فصل ۵ (سازماندهی و هماهنگی)، فصل ۶ (انگیزش و رهبری علوی بر پایه نامه ۵۳)، فصل ۷ (نظارت و کنترل اسلامی)',
    diagramTags: ['maslow', 'رهبری', 'تصمیم‌گیری', 'نظارت'],
  },
  {
    id: 'management_theories',
    title: 'تئوری‌های مدیریت (مبانی سازمان، رفتار سازمانی و تئوری سازمان)',
    shortTitle: 'تئوری‌های مدیریت',
    englishTitle: 'Management Theories & Organizational Behavior',
    badge: '۲۵ تست در آخرین دفترچهٔ ثبت‌شدهٔ ارشد (۱۴۰۵) · ضریب ۳ ارشد · ضریب ۵ دکتری',
    accentColor: 'indigo',
    gradient: 'from-indigo-600 to-blue-700',
    questionCountInExam: '۲۵ سؤال در آزمون ارشد ۱۴۰۵ (سؤالات ۶۱ تا ۸۵ دفترچه)',
    coefficientMaster: 'ضریب ۳ در بازرگانی، صنعتی و فناوری (سنگین‌ترین درس مشترک)',
    coefficientDoctorate: 'ضریب ۵ در دکتری تخصصی مدیریت (تئوری‌های مدیریت پیشرفته)',
    primaryBookId: 'book.bus.org_theories_daft',
    primaryBookTitle: 'تئوری و طراحی سازمان (ریچارد دفت) + مبانی رابینز + رفتار رضائیان',
    primaryAuthor: 'ریچارد دفت (ترجمه پارسائیان و اعرابی) / استیفن رابینز / دکتر علی رضائیان',
    whyImportantInExam:
      'در ساختار ثبت‌شدهٔ آزمون ارشد ۱۴۰۵، این بخش ۲۵ سؤال (۶۱ تا ۸۵ دفترچه) و ضریب ۳ دارد؛ در برخی دفترچه‌های قدیمی‌ترِ مخزن، تعداد سؤالات این بخش ۳۰ بوده است. سؤالات مفهومی، ترکیبی و موردکاوی از ساختار ۵گانه مینتزبرگ، مکاتب کلاسیک و نئوکلاسیک، فرهنگ و رهبری به‌شدت پرتکرارند.',
    goldenChaptersSummary:
      'فصل ابعاد ساختاری و محتوایی سازمان، ساختارهای مکانیکی و ارگانیک برنز و استاکر، ارکان پنج‌گانه مینتزبرگ، نظریه‌های موقعیتی رهبری، فرهنگ سازمانی ادگار شاین',
    diagramTags: ['mintzberg', 'grid', 'ارکان پنج‌گانه', 'رهبری', 'ساختار سازمانی'],
  },
  {
    id: 'marketing',
    title: 'مدیریت بازاریابی',
    shortTitle: 'بازاریابی',
    englishTitle: 'Marketing Management',
    badge: '۱۵ تست در کنکور ارشد · ضریب ۴ بازرگانی (مهم‌ترین درس بازرگانی) · ضریب ۵ دکتری',
    accentColor: 'rose',
    gradient: 'from-rose-600 to-pink-700',
    questionCountInExam: '۱۵ سؤال (سؤالات ۱۹۱ تا ۲۰۵ دفترچه ارشد بازرگانی)',
    coefficientMaster: 'ضریب ۴ در مدیریت بازرگانی (سرنوشت‌سازترین درس بازرگانی)',
    coefficientDoctorate: 'ضریب ۵ در آزمون دکتری مدیریت بازرگانی و راهبردی',
    primaryBookId: 'book.bus.kotler_jalilian',
    primaryBookTitle: 'مرجع کامل مدیریت بازاریابی (دکتر جلیلیان) + کاتلر و کلر + رضا مروج',
    primaryAuthor: 'دکتر حسین جلیلیان / فیلیپ کاتلر و کوین لین کلر / رضا مروج',
    whyImportantInExam:
      'ضریب ۴ بازاریابی باعث شده تا انحراف‌معیار نمرات آن مستقیماً رتبه داوطلبان بازرگانی را تعیین کند. تسلط بر آمیخته 4P و 7P، بخش‌بندی و موقعیت‌یابی (STP)، چرخه عمر محصول (PLC)، ماتریس‌های BCG و آنسوف سوالات ۱۰۰٪ تضمینی هر دوره هستند.',
    goldenChaptersSummary:
      'فصل ۱ و ۲ (مفاهیم تقاضا و فلسفه‌های بازاریابی)، فصل ۳ و ۴ (بخش‌بندی بازار و هدف‌گیری STP)، فصل ۵ و ۶ (مدیریت برند و آمیخته محصول)، فصل ۷ و ۸ (استراتژی‌های قیمت‌گذاری، توزیع و ترویج)',
    diagramTags: ['4p', 'bcg', 'ansoff', 'marketing_mix', 'بازاریابی', 'کاتلر'],
  },
  {
    id: 'economics',
    title: 'اقتصاد خرد و کلان',
    shortTitle: 'اقتصاد خرد و کلان',
    englishTitle: 'Microeconomics & Macroeconomics',
    badge: '۲۰ تست در کنکور ارشد · ضریب ۲ در تمام گرایش‌ها',
    accentColor: 'blue',
    gradient: 'from-blue-600 to-cyan-700',
    questionCountInExam: '۲۰ سؤال (۱۰ تست خرد + ۱۰ تست کلان، سؤالات ۹۶ تا ۱۱۵)',
    coefficientMaster: 'ضریب ۲ در بازرگانی، صنعتی و فناوری',
    coefficientDoctorate: 'مباحث پایه تحلیلی در اقتصادسنجی و مالیه دکتری',
    primaryBookId: 'book.bus.econ_nazari',
    primaryBookTitle: 'اقتصاد خرد و اقتصاد کلان',
    primaryAuthor: 'دکتر محسن نظری (انتشارات نگاه دانش / دانشکده مدیریت دانشگاه تهران)',
    whyImportantInExam:
      'درس اقتصاد با ۲۰ تست یکی از مطمئن‌ترین دروس محاسباتی-تحلیلی است. کتاب دکتر نظری با تشریح تیپ‌های تستی کشش، تعادل مصرف‌کننده و مدل IS-LM، امکان کسب درصد بالای ۷۰٪ را فراهم می‌کند.',
    goldenChaptersSummary:
      'خرد: کشش قیمتی و متقاطع، نظریه رفتار مصرف‌کننده و تعادل، ساختارهای بازار رقابت کامل و انحصار · کلان: درآمد ملی و تعادل، مدل درآمد-مخارج کینزی، مدل IS-LM و سیاست‌های مالی/پولی',
    diagramTags: ['اقتصاد', 'کشش', 'IS-LM', 'تعادل'],
  },
  {
    id: 'math_stats',
    title: 'ریاضیات عمومی و آمار و کاربرد آن در مدیریت',
    shortTitle: 'ریاضی و آمار',
    englishTitle: 'Mathematics & Statistics for Management',
    badge: '۲۰ تست در کنکور ارشد · ضریب ۲ ارشد · ضریب ۴ آمار در دکتری',
    accentColor: 'teal',
    gradient: 'from-teal-600 to-emerald-700',
    questionCountInExam: '۲۰ سؤال (۱۰ تست ریاضی + ۱۰ تست آمار، سؤالات ۴۶ تا ۶۵)',
    coefficientMaster: 'ضریب ۲ در بازرگانی، صنعتی و فناوری',
    coefficientDoctorate: 'ضریب ۴ آمار و روش تحقیق در آزمون دکتری مدیریت (کد ۲۱۱۷)',
    primaryBookId: 'book.bus.math_stats_ranjbaran_tourani',
    primaryBookTitle: 'ریاضیات هادی رنجبران + آمار و احتمال محسن طورانی / دکتر عادل آذر',
    primaryAuthor: 'هادی رنجبران / محسن طورانی / دکتر عادل آذر و منصور مؤمنی',
    whyImportantInExam:
      'اکثر داوطلبان انسانی این درس را رها می‌کنند؛ بنابراین درصد بالای ۳۵٪ در ریاضی و آمار، رتبه داوطلب را صدها شماره ارتقا می‌دهد. در دکتری نیز آمار پیشرفته بالاترین ضریب را دارد.',
    goldenChaptersSummary:
      'ریاضی: مشتق و کاربردها، بهینه‌سازی، ماتریس و انتگرال معین · آمار: مقیاس‌های استیونز، شاخص‌های پراکندگی، احتمال شرطی و بیز، توزیع‌های گسسته و توزیع نرمال استاندارد، آزمون فرض و رگرسیون',
    diagramTags: ['normal', 'stats', 'توزیع نرمال', 'ریاضی', 'آمار'],
  },
  {
    id: 'operations_research',
    title: 'تحقیق در عملیات (پژوهش عملیاتی)',
    shortTitle: 'تحقیق در عملیات',
    englishTitle: 'Operations Research & Linear Programming',
    badge: '۱۵ تست در کنکور ارشد · ضریب ۳ صنعتی · ضریب ۲ بازرگانی و فناوری',
    accentColor: 'amber',
    gradient: 'from-amber-600 to-orange-700',
    questionCountInExam: '۱۵ سؤال (سؤالات ۱۴۶ تا ۱۶۰ دفترچه ارشد)',
    coefficientMaster: 'ضریب ۳ در مدیریت صنعتی (مهم‌ترین تمایز با سایر گرایش‌ها) · ضریب ۲ در بازرگانی',
    coefficientDoctorate: 'ضریب ۴ در دروس تخصصی دکتری مدیریت صنعتی و تصمیم‌گیری',
    primaryBookId: 'book.bus.or_fadavi',
    primaryBookTitle: 'پژوهش عملیاتی (عارفه فدوی) + دکتر محمدرضا مهرگان + دکتر عادل آذر',
    primaryAuthor: 'دکتر عارفه فدوی / دکتر محمدرضا مهرگان / دکتر عادل آذر',
    whyImportantInExam:
      'درس تخصصی رتبه‌ساز داوطلبان صنعتی و ابزار تصمیم‌گیری بازرگانی. سؤالات مدل‌سازی، سیمپلکس، دوگانگی، تحلیل حساسیت و مدل‌های حمل‌ونقل به‌صورت کاملاً ساختاریافته و قابل پیش‌بینی هستند.',
    goldenChaptersSummary:
      'مدل‌سازی خطی و روش ترسیمی، الگوریتم سیمپلکس و متغیرهای کمکی، قضیه دوگان (Duality) و تفسیر اقتصادی متغیرهای سایه، تحلیل حساسیت، مدل‌های حمل‌ونقل و تخصیص',
    diagramTags: ['سیمپلکس', 'دوگان', 'تحقیق در عملیات', 'برنامه‌ریزی خطی'],
  },
  {
    id: 'production',
    title: 'مدیریت تولید و عملیات',
    shortTitle: 'مدیریت تولید',
    englishTitle: 'Production & Operations Management',
    badge: '۱۵ تست در کنکور ارشد صنعتی و فناوری · ضریب ۲',
    accentColor: 'cyan',
    gradient: 'from-cyan-600 to-sky-700',
    questionCountInExam: '۱۵ سؤال (سؤالات ۱۷۶ تا ۱۹۰ دفترچه ارشد صنعتی و فناوری)',
    coefficientMaster: 'ضریب ۲ در مدیریت صنعتی و مدیریت فناوری (در بازرگانی ضریب ۰ دارد)',
    coefficientDoctorate: 'ضریب ۴ در دکتری مدیریت صنعتی (گرایش تولید و عملیات)',
    primaryBookId: 'book.ind.pom_mottaghi_jafarnejad',
    primaryBookTitle: 'مدیریت تولید و عملیات',
    primaryAuthor: 'دکتر هایده متقی / دکتر احمد جعفرنژاد / دکتر عارفه فدوی',
    whyImportantInExam:
      'برای داوطلبان صنعتی و فناوری به‌جای بازاریابی پاسخ داده می‌شود. شامل مباحث کاربردی و فرمول‌های پرپاسخ مانند نقطه سفارش EOQ، کنترل کیفیت آماری و برنامه‌ریزی مواد MRP است.',
    goldenChaptersSummary:
      'مدل‌های کنترل موجودی و مقدار اقتصادی سفارش (EOQ/EPQ)، پیش‌بینی تقاضا (میانگین متحرک و هموارسازی نمایی)، جانمایی تجهیزات و بالانس خط تولید، سیستم برنامه‌ریزی مواد MRP و JIT',
    diagramTags: ['eoq', 'موجودی', 'تولید', 'نقطه سفارش'],
  },
  {
    id: 'english',
    title: 'زبان عمومی و تخصصی مدیریت (انگلیسی)',
    shortTitle: 'زبان انگلیسی',
    englishTitle: 'General & Specialized English for Management',
    badge: '۳۰ تست در کنکور ارشد · ضریب ۳ در تمام گرایش‌ها',
    accentColor: 'violet',
    gradient: 'from-violet-600 to-purple-700',
    questionCountInExam: '۳۰ سؤال (سؤالات ۱ تا ۳۰ دفترچه ارشد)',
    coefficientMaster: 'ضریب ۳ در تمام گرایش‌های بازرگانی، صنعتی و فناوری',
    coefficientDoctorate: 'آزمون زبان عمومی دکتری سنجش (MSRT / EPT / تولیمو)',
    primaryBookId: 'book.bus.english_eshraghi',
    primaryBookTitle: 'زبان تخصصی مدیریت آرمان اشراقی / ناصرزاده + عمومی زیر ذره‌بین',
    primaryAuthor: 'آرمان اشراقی / دکتر ناصرزاده / هادی جهانشاهی و الناز حجازی',
    whyImportantInExam:
      '۳۰ تست اول دفترچه؛ داوطلبانی که از واژگان ۵۰۴، ۱۱۰۰ واژه و متون درک مطلب تخصصی مدیریت نمره می‌گیرند، در تراز نهایی پرش چشمگیری تجربه می‌کنند.',
    goldenChaptersSummary:
      'واژگان پرتکرار مدیریت (استراتژی، بازاریابی، مالی، منابع انسانی)، ساختارهای گرامری مهم، مهارت‌های خواندن سریع و درک مطلب تخصصی (Reading Comprehension) و کلوزتست',
    diagramTags: ['english', 'vocabulary', 'زبان'],
  },
  {
    id: 'public_finance',
    title: 'مالیه عمومی و بودجه',
    shortTitle: 'مالیه عمومی',
    englishTitle: 'Public Finance & Budgeting',
    badge: '۱۵ تست در کنکور ارشد',
    accentColor: 'sky',
    gradient: 'from-sky-700 to-cyan-800',
    questionCountInExam: '۱۵ سؤال (سؤالات ۱۰۶ تا ۱۲۰ دفترچهٔ ۱۴۰۵)',
    coefficientMaster: 'در دفترچهٔ ۱۴۰۵ ضریب صفر ثبت شده؛ اهمیت درس به ترکیب درسی گرایش بستگی دارد',
    coefficientDoctorate: 'ضریب دکتری در مخزن ثبت نشده است',
    primaryBookId: '',
    primaryBookTitle: 'کتاب مرجع اختصاصی در مخزن ثبت نشده؛ منابع دکتری: اندرسون و الوانی',
    primaryAuthor: 'جیمز اندرسون (ترجمهٔ داوود کیانی)؛ دکتر سیدمهدی الوانی',
    whyImportantInExam:
      'این درس در همهٔ دفترچه‌های ۱۳۹۶ تا ۱۴۰۵ حاضر است و سالانه ۱۵ سؤال مستقیم در مجموعهٔ مدیریت دارد.',
    goldenChaptersSummary: 'مرور سطح درس؛ تفکیک مبحثی در گام شش برنامهٔ پوشش افزوده می‌شود',
    diagramTags: ['مالیه', 'بودجه', 'tax'],
  },
  {
    id: 'human_resources',
    title: 'مدیریت منابع انسانی',
    shortTitle: 'منابع انسانی',
    englishTitle: 'Human Resource Management',
    badge: '۱۵ تست در کنکور ارشد',
    accentColor: 'rose',
    gradient: 'from-rose-700 to-red-800',
    questionCountInExam: '۱۵ سؤال (سؤالات ۱۲۱ تا ۱۳۵ دفترچهٔ ۱۴۰۵)',
    coefficientMaster: 'در دفترچهٔ ۱۴۰۵ ضریب صفر ثبت شده؛ اهمیت درس به ترکیب درسی گرایش بستگی دارد',
    coefficientDoctorate: 'ضریب دکتری در مخزن ثبت نشده است',
    primaryBookId: '',
    primaryBookTitle: 'A Handbook of Human Resource Management Practice؛ Human Resource Champions',
    primaryAuthor: 'مایکل آرمسترانگ؛ دیوید اولریش',
    whyImportantInExam:
      'مدل اولریش و مباحث استخدام، جبران خدمات و ارزیابی عملکرد در سؤالات پرتکرار ارشد و دکتری حضور مستمر دارند.',
    goldenChaptersSummary: 'مرور سطح درس؛ تفکیک مبحثی در گام شش برنامهٔ پوشش افزوده می‌شود',
    diagramTags: ['ulrich', 'جبران خدمات', 'استخدام'],
  },
  {
    id: 'financial_management',
    title: 'مدیریت مالی',
    shortTitle: 'مدیریت مالی',
    englishTitle: 'Financial Management',
    badge: '۱۵ تست در کنکور ارشد',
    accentColor: 'cyan',
    gradient: 'from-cyan-700 to-sky-800',
    questionCountInExam: '۱۵ سؤال (سؤالات ۱۵۱ تا ۱۶۵ دفترچهٔ ۱۴۰۵)',
    coefficientMaster: 'در دفترچهٔ ۱۴۰۵ ضریب صفر ثبت شده؛ اهمیت درس به ترکیب درسی گرایش بستگی دارد',
    coefficientDoctorate: 'ضریب دکتری در مخزن ثبت نشده است',
    primaryBookId: '',
    primaryBookTitle: 'اصول مدیریت مالی، گیتمان (ترجمهٔ جهانخانی)؛ Principles of Finance (OpenStax)',
    primaryAuthor: 'لارنس گیتمان؛ تیم جنکینز و همکاران (OpenStax)',
    whyImportantInExam:
      'بخش بزرگی از سؤالات این درس محاسباتی است؛ ارزش زمانی پول و هزینهٔ سرمایه کلیدهای نمره‌آور آن‌اند.',
    goldenChaptersSummary: 'مرور سطح درس؛ تفکیک مبحثی در گام شش برنامهٔ پوشش افزوده می‌شود',
    diagramTags: ['TVM', 'هزینهٔ سرمایه', 'NPV'],
  },
  {
    id: 'investment_risk',
    title: 'مدیریت سرمایه‌گذاری و ریسک',
    shortTitle: 'سرمایه‌گذاری و ریسک',
    englishTitle: 'Investment & Risk Management',
    badge: '۱۵ تست در کنکور ارشد',
    accentColor: 'teal',
    gradient: 'from-teal-700 to-emerald-800',
    questionCountInExam: '۱۵ سؤال (سؤالات ۱۹۶ تا ۲۱۰ دفترچهٔ ۱۴۰۵)',
    coefficientMaster: 'در دفترچهٔ ۱۴۰۵ ضریب صفر ثبت شده؛ اهمیت درس به ترکیب درسی گرایش بستگی دارد',
    coefficientDoctorate: 'ضریب دکتری در مخزن ثبت نشده است',
    primaryBookId: '',
    primaryBookTitle: 'Investments (Bodie, Kane & Marcus)؛ Efficient Capital Markets (Fama, 1970)',
    primaryAuthor: 'زوی بودی، کین و ماکوس؛ یوجین فاما',
    whyImportantInExam:
      'پرتفوی، CAPM و سطوح سه‌گانهٔ کارایی بازار از پرتکرارترین مباحث محاسباتی و تعریفی این درس‌اند.',
    goldenChaptersSummary: 'مرور سطح درس؛ تفکیک مبحثی در گام شش برنامهٔ پوشش افزوده می‌شود',
    diagramTags: ['CAPM', 'پرتفوی', 'کارایی'],
  },
  {
    id: 'entrepreneurship',
    title: 'مبانی کارآفرینی',
    shortTitle: 'کارآفرینی',
    englishTitle: 'Entrepreneurship Fundamentals',
    badge: '۱۵ تست در کنکور ارشد',
    accentColor: 'amber',
    gradient: 'from-amber-600 to-orange-700',
    questionCountInExam: '۱۵ سؤال (سؤالات ۲۱۱ تا ۲۲۵ دفترچهٔ ۱۴۰۵)',
    coefficientMaster: 'در دفترچهٔ ۱۴۰۵ ضریب صفر ثبت شده؛ اهمیت درس به ترکیب درسی گرایش بستگی دارد',
    coefficientDoctorate: 'ضریب دکتری در مخزن ثبت نشده است',
    primaryBookId: '',
    primaryBookTitle: 'کتاب مرجع اختصاصی در مخزن ثبت نشده است',
    primaryAuthor: 'ثبت‌نشده',
    whyImportantInExam:
      'درس ۱۵ سؤالیِ همیشگی دفترچه؛ بخش تعریفی آن با مکتب کارآفرینی مینتزبرگ هم‌پوشانی دارد.',
    goldenChaptersSummary: 'مرور سطح درس؛ تفکیک مبحثی در گام شش برنامهٔ پوشش افزوده می‌شود',
    diagramTags: ['فرصت‌یابی', 'کارآفرینی'],
  },
  {
    id: 'accounting',
    title: 'حسابداری مالی و صنعتی',
    shortTitle: 'حسابداری',
    englishTitle: 'Financial & Cost Accounting',
    badge: '۱۵ تست در کنکور ارشد',
    accentColor: 'slate',
    gradient: 'from-slate-600 to-slate-800',
    questionCountInExam: '۱۵ سؤال (سؤالات ۲۲۶ تا ۲۴۰ دفترچهٔ ۱۴۰۵)',
    coefficientMaster: 'در دفترچهٔ ۱۴۰۵ ضریب صفر ثبت شده؛ اهمیت درس به ترکیب درسی گرایش بستگی دارد',
    coefficientDoctorate: 'ضریب دکتری در مخزن ثبت نشده است',
    primaryBookId: '',
    primaryBookTitle: 'کتاب مرجع اختصاصی در مخزن ثبت نشده است',
    primaryAuthor: 'ثبت‌نشده',
    whyImportantInExam:
      'سؤالات این درس عمدتاً محاسباتی‌اند؛ ترازنامه، بهای تمام‌شده و نسبت‌های مالی ستون‌های اصلی آن‌اند.',
    goldenChaptersSummary: 'مرور سطح درس؛ تفکیک مبحثی در گام شش برنامهٔ پوشش افزوده می‌شود',
    diagramTags: ['ترازنامه', 'نسبت‌ها', 'بهای تمام‌شده'],
  },
  {
    id: 'transportation',
    title: 'دانش حمل‌ونقل',
    shortTitle: 'حمل‌ونقل',
    englishTitle: 'Transportation Knowledge',
    badge: '۱۵ تست در کنکور ارشد',
    accentColor: 'lime',
    gradient: 'from-lime-700 to-green-800',
    questionCountInExam: '۱۵ سؤال (سؤالات ۲۴۱ تا ۲۵۵ دفترچهٔ ۱۴۰۵)',
    coefficientMaster: 'در دفترچهٔ ۱۴۰۵ ضریب صفر ثبت شده؛ اهمیت درس به ترکیب درسی گرایش بستگی دارد',
    coefficientDoctorate: 'ضریب دکتری در مخزن ثبت نشده است',
    primaryBookId: '',
    primaryBookTitle: 'کتاب مرجع اختصاصی در مخزن ثبت نشده است',
    primaryAuthor: 'ثبت‌نشده',
    whyImportantInExam:
      'بخش اختصاصی گرایش حمل‌ونقل؛ در همهٔ دفترچه‌های ده‌سال اخیر با ۱۵ سؤال حاضر است.',
    goldenChaptersSummary: 'مرور سطح درس؛ تفکیک مبحثی در گام شش برنامهٔ پوشش افزوده می‌شود',
    diagramTags: ['حمل‌ونقل', 'لجستیک'],
  },
  {
    id: 'business_transportation',
    title: 'دانش مدیریت بازرگانی و حمل‌ونقل',
    shortTitle: 'بازرگانی و حمل‌ونقل',
    englishTitle: 'Commercial & Transport Management Knowledge',
    badge: '۳۰ تست در کنکور ارشد',
    accentColor: 'orange',
    gradient: 'from-orange-700 to-amber-800',
    questionCountInExam: '۳۰ سؤال (سؤالات ۲۵۶ تا ۲۸۵ دفترچهٔ ۱۴۰۵)',
    coefficientMaster: 'در دفترچهٔ ۱۴۰۵ ضریب صفر ثبت شده؛ اهمیت درس به ترکیب درسی گرایش بستگی دارد',
    coefficientDoctorate: 'ضریب دکتری در مخزن ثبت نشده است',
    primaryBookId: '',
    primaryBookTitle: 'کتاب مرجع اختصاصی در مخزن ثبت نشده است',
    primaryAuthor: 'ثبت‌نشده',
    whyImportantInExam:
      'بزرگ‌ترین درس دفترچه با ۳۰ سؤال؛ ترکیب بازرگانی، قراردادهای بین‌الملل و توزیع فیزیکی.',
    goldenChaptersSummary: 'مرور سطح درس؛ تفکیک مبحثی در گام شش برنامهٔ پوشش افزوده می‌شود',
    diagramTags: ['بازرگانی', 'اینکوترمز', 'توزیع'],
  },
];

/**
 * تشخیص هوشمند بخش درسی یک گره دانش
 */
export function getCourseSectionForNode(node: KnowledgeNode): KonkorCourseSectionId {
  const nid = node.id.toLowerCase();
  const c = node.course.toLowerCase();
  const t = node.topic.toLowerCase();

  // گره‌های سطح‌درس (هاب): نگاشت صریح شناسه، پیش از هر حدس متنی.
  if (nid.endsWith('_hub')) {
    const hubMap: Record<string, KonkorCourseSectionId> = {
      'bus.pubfin_hub': 'public_finance',
      'bus.hr_hub': 'human_resources',
      'bus.finmgmt_hub': 'financial_management',
      'bus.invrisk_hub': 'investment_risk',
      'bus.entrep_hub': 'entrepreneurship',
      'bus.accounting_hub': 'accounting',
      'bus.transport_hub': 'transportation',
      'bus.commerce_transport_hub': 'business_transportation',
    };
    const mapped = hubMap[nid];
    if (mapped) return mapped;
  }

  if (c.includes('اسلام') || nid.includes('islamic')) return 'islamic';
  if (c.includes('زبان') || nid.includes('english') || nid.includes('eng.')) return 'english';
  if (
    c.includes('ریاضی') ||
    c.includes('آمار') ||
    nid.startsWith('stats.') ||
    nid.startsWith('math.') ||
    nid.startsWith('rm.')
  ) {
    return 'math_stats';
  }
  if (c.includes('بازاریابی') || nid.startsWith('mkt.')) return 'marketing';
  if (c.includes('اقتصاد') || nid.startsWith('econ.')) return 'economics';
  if (
    c.includes('تحقیق در عملیات') ||
    c.includes('پژوهش عملیاتی') ||
    nid.startsWith('or.') ||
    nid.includes('simplex') ||
    nid.includes('mcdm')
  ) {
    return 'operations_research';
  }
  if (c.includes('تولید') || nid.startsWith('pom.') || nid.includes('eoq')) return 'production';

  return 'management_theories';
}

/**
 * تشخیص هوشمند بخش درسی یک سوال
 */
export function getCourseSectionForQuestion(
  q: QuestionItem,
  nodes: KnowledgeNode[]
): KonkorCourseSectionId {
  if (q.courseSectionId) {
    const valid: KonkorCourseSectionId[] = [
      'english',
      'islamic',
      'math_stats',
      'management_theories',
      'economics',
      'operations_research',
      'production',
      'marketing',
      'public_finance',
      'human_resources',
      'financial_management',
      'investment_risk',
      'entrepreneurship',
      'accounting',
      'transportation',
      'business_transportation',
    ];
    if (valid.includes(q.courseSectionId as KonkorCourseSectionId)) {
      return q.courseSectionId as KonkorCourseSectionId;
    }
  }

  // اگر شناسهٔ گره موجود است، نگاشت صریح آن بر حدس متنی مقدم است.
  const linkedNode = nodes.find((n) => n.id === q.nodeId);
  if (linkedNode) return getCourseSectionForNode(linkedNode);

  // بررسی بر اساس متن منبع یا صورت سوال
  const textBlob = (
    (q.sourceReference || '') +
    ' ' +
    (q.designedFromTextbook || '') +
    ' ' +
    q.text
  ).toLowerCase();

  if (textBlob.includes('اسلام') || textBlob.includes('islamic_moghimi')) return 'islamic';
  if (textBlob.includes('english') || textBlob.includes('زبان') || textBlob.includes('اشراقی'))
    return 'english';
  if (textBlob.includes('ریاضی') || textBlob.includes('آمار') || textBlob.includes('رنجبران') || textBlob.includes('طورانی'))
    return 'math_stats';
  if (textBlob.includes('بازاریابی') || textBlob.includes('کاتلر'))
    return 'marketing';
  if (textBlob.includes('اقتصاد') || textBlob.includes('محسن نظری')) return 'economics';
  if (textBlob.includes('پژوهش عملیاتی') || textBlob.includes('تحقیق در عملیات') || textBlob.includes('فدوی') || textBlob.includes('سیمپلکس'))
    return 'operations_research';
  if (textBlob.includes('تولید') || textBlob.includes('متقی') || textBlob.includes('جعفرنژاد') || textBlob.includes('موجودی'))
    return 'production';

  return 'management_theories';
}

/**
 * دریافت کتاب‌های مرجع اختصاصی یک درس
 */
export function getBooksForCourseSection(sectionId: KonkorCourseSectionId): ReferenceBookItem[] {
  return REFERENCE_BOOKS_DATABASE.filter((b) => {
    const textBlob = (b.id + ' ' + b.bookTitle + ' ' + b.courseName).toLowerCase();
    switch (sectionId) {
      case 'islamic':
        return textBlob.includes('islamic') || textBlob.includes('اسلام') || textBlob.includes('مقیمی');
      case 'management_theories':
        return (
          textBlob.includes('daft') ||
          textBlob.includes('robbins') ||
          textBlob.includes('rezaeian') ||
          textBlob.includes('theories') ||
          textBlob.includes('تئوری') ||
          textBlob.includes('سازمان')
        );
      case 'marketing':
        return textBlob.includes('kotler') || textBlob.includes('jalilian') || textBlob.includes('بازاریابی');
      case 'economics':
        return textBlob.includes('econ') || textBlob.includes('اقتصاد') || textBlob.includes('نظری');
      case 'math_stats':
        return textBlob.includes('math') || textBlob.includes('stats') || textBlob.includes('ریاضی') || textBlob.includes('آمار');
      case 'operations_research':
        return textBlob.includes('or_') || textBlob.includes('fadavi') || textBlob.includes('عملیات');
      case 'production':
        return textBlob.includes('pom') || textBlob.includes('تولید') || textBlob.includes('mottaghi');
      case 'english':
        return textBlob.includes('english') || textBlob.includes('زبان') || textBlob.includes('eshraghi');
      default:
        return false;
    }
  });
}
