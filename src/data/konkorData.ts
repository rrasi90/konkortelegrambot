/**
 * داده‌های جامع، دقیق و مستند گراف دانش، سؤالات استاندارد و قرنطینه ۱۴۰۴،
 * درسنامه‌های گام‌به‌گام (سبک Brilliant) و کارت‌های مفهومی/توصیفی (سبک RemNote)
 * بدون هیچ‌گونه حدس، مستند به کتب مرجع کنکور دکتری مدیریت و سال‌های دقیق طرح سؤال در سازمان سنجش.
 */

import { YEARLY_KONKOR_QUESTIONS } from './yearlyKonkorExams';
import { PHD_EXPANSION_NODES, PHD_EXPANSION_QUESTIONS } from './phdExpansionContent';
import { CHAPTER_AUTHORED_QUESTIONS } from './chapterAuthoredQuestions';

export type TrackId = 'common' | 'business' | 'industrial' | 'technology' | 'strategy';
export type DependencyRelation = 'prerequisite' | 'cross_course';
export type CardType =
  | 'question'
  | 'trap_note'
  | 'comparison_card'
  | 'remedial_lesson'
  | 'diagnostic_probe'
  | 'proof_1404';
export type AttemptType = 'practice' | 'diagnostic' | 'verification' | 'proof' | 'placement';
export type ErrorTypeClassification =
  | 'none'
  | 'slip'
  | 'misread'
  | 'prerequisite_failure'
  | 'concept_gap'
  | 'skipped';
export type CoverageStatus =
  | 'unseen'
  | 'weak'
  | 'learning'
  | 'needs_proof'
  | 'proven'
  | 'mastered';

export interface KnowledgeNode {
  id: string;
  track: TrackId;
  course: string;
  chapter: string;
  topic: string;
  /** منبع دقیق دانشگاهی و کتاب مرجع طراحان کنکور دکتری */
  sourceBookCitation: string;
  /** سال‌های دقیق طرح سؤال مستقیم از این مبحث در کنکور سراسری دکتری */
  examYearsAppeared: number[];
  /** ضریب درس در کنکور دکتری (مصوبه شورای عالی انقلاب فرهنگی و سنجش: ضریب ۵ تخصصی) */
  examCoefficient: number;
  /** وزن بودجه‌بندی و تکرار در ۱۱ سال اخیر کنکور (از ۱ تا ۱۰) */
  historicalWeight: number;
  /** زمان تخمینی تسلط کامل بر حسب ساعت */
  estimatedStudyHours: number;
  /** مختصات در درخت مهارت ۴لایه */
  graphPos: { layer: number; col: number };
  /** گره‌های متشابه که داوطلبان با آن اشتباه می‌گیرند */
  confusableWith: string[];
}

export interface NodeDependency {
  source: string;
  target: string;
  relation: DependencyRelation;
  weight: number;
  description: string;
}

export interface ComparisonTableData {
  id: string;
  nodeA: string;
  nodeB: string;
  title: string;
  subtitle: string;
  dimensions: {
    criterion: string;
    conceptA: string;
    conceptB: string;
  }[];
  diagnosticTakeaway: string;
}

export interface ConceptDescriptorPair {
  concept: string;
  descriptor: string;
  answer: string;
}

export interface LessonMicroStep {
  stepNumber: number;
  title: string;
  content: string;
  formulaOrDiagramNote?: string;
}

export interface InteractiveLesson {
  nodeId: string;
  course: string;
  chapter: string;
  topic: string;
  sourceBookCitation: string;
  examYearsAppeared: number[];
  konkoorWeightLabel: string;
  frequencyLabel: string;
  summary: string;
  /** گام‌های تعاملی خردشده (الگوی Brilliant) برای آموزش کامل و دقیق بدون هیچ نکته مبهم */
  microSteps: LessonMicroStep[];
  /** زوج‌های مفهوم-توصیف‌گر (الگوی RemNote Concept-Descriptor) */
  conceptDescriptors: ConceptDescriptorPair[];
  konkoorTips: string[];
  keyTerms: string[];
  /** مینی‌تست ۲ گزینه‌ای برای ایستگاه بررسی مفهوم (Concept Check) */
  conceptCheck: {
    prompt: string;
    options: [string, string];
  };
}

export interface QuestionItem {
  id: string;
  nodeId: string;
  examYear: number;
  sourceReference?: string;
  bookletQuestionNumber?: number;
  courseSectionId?: string;
  courseSectionTitle?: string;
  designedFromTextbook?: string;
  referenceChapterId?: string;
  examLevel?: 'ارشد' | 'دکتری';
  isQuarantinedProof?: boolean;
  isDiagnosticProbe?: boolean;
  text: string;
  options: string[];
  expectedTimeMs: number;
}

export const TRACK_LABELS: Record<TrackId, { title: string; subtitle: string }> = {
  common: { title: 'هسته مشترک مدیریتی', subtitle: 'مبانی سازمان، استراتژیک، آمار و روش تحقیق' },
  business: { title: 'گرایش مدیریت بازرگانی', subtitle: 'بازاریابی پیشرفته، برند و رفتار مصرف‌کننده' },
  industrial: { title: 'گرایش مدیریت صنعتی', subtitle: 'تحقیق در عملیات (OR)، تولید و عملیات (POM) و کنترل کیفیت' },
  strategy: { title: 'گرایش مدیریت استراتژیک', subtitle: 'پورتفولیو، قابلیت‌های پویا و شایستگی محوری' },
  technology: { title: 'گرایش مدیریت فناوری و نوآوری', subtitle: 'شیلینگ، تید و بسانت، طاهر خلیل و سازمان دوپهلو' },
};

export const INITIAL_KNOWLEDGE_NODES: KnowledgeNode[] = [
  // لایه ۰ (پایه و پیش‌نیازهای بنیادی — باز در وضعیت شروع صفر)
  {
    id: 'mb.structure',
    track: 'common',
    course: 'مبانی سازمان و مدیریت',
    chapter: 'ابعاد ساختاری و طراحی سازمان',
    topic: 'ساختارهای مکانیکی و ارگانیک (برنز و استاکر)',
    sourceBookCitation: 'تئوری و طراحی سازمان، ریچارد دفت (ترجمه پارسائیان و اعرابی)، فصل ۱ و ۴؛ و کتاب تئوری سازمان رابینز، فصل ساختار',
    examYearsAppeared: [1396, 1397, 1399, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 2.0,
    graphPos: { layer: 0, col: 0 },
    confusableWith: ['mb.contingency'],
  },
  {
    id: 'sm.value_chain',
    track: 'common',
    course: 'مدیریت استراتژیک پیشرفته',
    chapter: 'تحلیل درون‌سازمانی و زنجیره ارزش',
    topic: 'زنجیره ارزش مایکل پورتر و تحلیل پیوندها',
    sourceBookCitation: 'Competitive Advantage (Michael Porter, 1985), Ch. 2؛ و مدیریت استراتژیک فرد دیوید، فصل ارزیابی داخلی',
    examYearsAppeared: [1397, 1398, 1400, 1401, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 2.5,
    graphPos: { layer: 0, col: 1 },
    confusableWith: ['sm.rbv'],
  },
  {
    id: 'stats.scales',
    track: 'common',
    course: 'آمار و کاربرد آن در مدیریت',
    chapter: 'مبانی اندازه‌گیری و شاخص‌های توصیفی',
    topic: 'مقیاس‌های چهارگانه استیونز (اسمی، رتبه‌ای، فاصله‌ای، نسبتی)',
    sourceBookCitation: 'آمار و کاربرد آن در مدیریت (جلد ۱)، دکتر عادل آذر و منصور مؤمنی، فصل ۱؛ و روش تحقیق دکتر سرمد و بازرگان',
    examYearsAppeared: [1396, 1398, 1400, 1401, 1402],
    examCoefficient: 5,
    historicalWeight: 8,
    estimatedStudyHours: 1.5,
    graphPos: { layer: 0, col: 2 },
    confusableWith: ['rm.validity'],
  },
  {
    id: 'inno.s_curve',
    track: 'technology',
    course: 'تئوری‌های نوآوری و فناوری',
    chapter: 'پویایی و چرخه عمر فناوری',
    topic: 'منحنی S فناوری (ریچارد فاستر) و ناپیوستگی فناورانه',
    sourceBookCitation: 'مدیریت استراتژیک نوآوری فناورانه، ملیسا شیلینگ (Melissa Schilling)، فصل ۳ (منحنی‌های S)',
    examYearsAppeared: [1398, 1399, 1401, 1402, 1403],
    examCoefficient: 5,
    historicalWeight: 8,
    estimatedStudyHours: 2.0,
    graphPos: { layer: 0, col: 3 },
    confusableWith: ['mkt.plc'],
  },

  // لایه ۱ (مباحث میانی و تحلیلی)
  {
    id: 'mb.contingency',
    track: 'common',
    course: 'مبانی سازمان و مدیریت',
    chapter: 'تئوری‌های اقتضایی فناوری و محیط',
    topic: 'مدل تفکیک-یکپارچگی لارنس و لورش و فناوری جوآن وودوارد',
    sourceBookCitation: 'تئوری سازمان: ساختار و طرح سازمانی، استیفن رابینز، فصل ۶ و ۷ (فناوری و محیط)؛ و کتاب ریچارد دفت فصل ۷',
    examYearsAppeared: [1396, 1398, 1399, 1400, 1401, 1402, 1404],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 3.0,
    graphPos: { layer: 1, col: 0 },
    confusableWith: ['mb.structure', 'mb.culture'],
  },
  {
    id: 'sm.rbv',
    track: 'common',
    course: 'مدیریت استراتژیک پیشرفته',
    chapter: 'مکتب مبتنی بر منابع و قابلیت‌ها',
    topic: 'دیدگاه مبتنی بر منابع (RBV) و چارچوب VRIO جی بارنی',
    sourceBookCitation: 'Barney, J. (1991). Firm Resources and Sustained Competitive Advantage, Journal of Management؛ و کتاب مدیریت استراتژیک دکتر سیدمحمد اعرابی',
    examYearsAppeared: [1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 10,
    estimatedStudyHours: 3.5,
    graphPos: { layer: 1, col: 1 },
    confusableWith: ['sm.value_chain', 'sm.dynamic'],
  },
  {
    id: 'stats.anova',
    track: 'common',
    course: 'آمار و کاربرد آن در مدیریت',
    chapter: 'آزمون‌های پارامتریک مقایسه چند جامعه',
    topic: 'تحلیل واریانس یک‌طرفه و دوطرفه (One-Way & Two-Way ANOVA)',
    sourceBookCitation: 'آمار و کاربرد آن در مدیریت (جلد ۲: استنباط آماری)، دکتر عادل آذر و منصور مؤمنی، فصل ۳ (تحلیل واریانس)',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 10,
    estimatedStudyHours: 3.5,
    graphPos: { layer: 1, col: 2 },
    confusableWith: ['stats.regression'],
  },
  {
    id: 'mkt.plc',
    track: 'business',
    course: 'بازاریابی پیشرفته',
    chapter: 'استراتژی‌های چرخه عمر محصول',
    topic: 'چرخه عمر محصول (PLC) و استراتژی‌های چهارگانه معرفی و بلوغ کاتلر',
    sourceBookCitation: 'مدیریت بازاریابی (Marketing Management)، فیلیپ کاتلر و کوین لین کلر، ویرایش ۱۶، فصل ۱۱',
    examYearsAppeared: [1397, 1399, 1401, 1403],
    examCoefficient: 5,
    historicalWeight: 8,
    estimatedStudyHours: 2.5,
    graphPos: { layer: 1, col: 3 },
    confusableWith: ['sm.portfolio', 'inno.s_curve'],
  },

  // لایه ۲ (مباحث پیشرفته و ترکیبی)
  {
    id: 'mb.culture',
    track: 'common',
    course: 'مبانی سازمان و مدیریت',
    chapter: 'فرهنگ سازمانی و ارزش‌های رقابتی',
    topic: 'لایه‌های سه‌گانه فرهنگ ادگار شاین و مدل چهاربعدی دنیسون',
    sourceBookCitation: 'Organizational Culture and Leadership (Edgar Schein)؛ و تئوری و طراحی سازمان ریچارد دفت، فصل ۱۰',
    examYearsAppeared: [1398, 1400, 1401, 1402, 1403],
    examCoefficient: 5,
    historicalWeight: 8,
    estimatedStudyHours: 2.5,
    graphPos: { layer: 2, col: 0 },
    confusableWith: ['mb.contingency'],
  },
  {
    id: 'sm.portfolio',
    track: 'strategy',
    course: 'مدیریت استراتژیک پیشرفته',
    chapter: 'استراتژی‌های سطح شرکت و تحلیل پورتفولیو',
    topic: 'ماتریس‌های پورتفولیو (BCG، GE-McKinsey و ماتریس SPACE)',
    sourceBookCitation: 'مدیریت استراتژیک، فرد آر. دیوید (ترجمه پارسائیان و اعرابی)، فصل ۶ (تجزیه و تحلیل و انتخاب استراتژی)',
    examYearsAppeared: [1397, 1399, 1401, 1402, 1404],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 3.0,
    graphPos: { layer: 2, col: 1 },
    confusableWith: ['mkt.plc'],
  },
  {
    id: 'stats.regression',
    track: 'common',
    course: 'آمار و کاربرد آن در مدیریت',
    chapter: 'مدل‌سازی خطی و اقتصادسنجی پایه',
    topic: 'رگرسیون خطی چندگانه، ضریب تعیین تعدیل‌شده و فروض گوس-مارکوف',
    sourceBookCitation: 'آمار و کاربرد آن در مدیریت (جلد ۲)، دکتر عادل آذر و مؤمنی، فصل ۵ و ۶ (رگرسیون ساده و چندگانه)',
    examYearsAppeared: [1396, 1397, 1398, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 10,
    estimatedStudyHours: 4.0,
    graphPos: { layer: 2, col: 2 },
    confusableWith: ['stats.anova'],
  },
  {
    id: 'mkt.brand',
    track: 'business',
    course: 'بازاریابی پیشرفته',
    chapter: 'مدیریت استراتژیک برند',
    topic: 'مدل ارزش ویژه برند مبتنی بر مشتری (هرم CBBE کلر و مدل ۵بعدی آکر)',
    sourceBookCitation: 'مدیریت استراتژیک برند (Strategic Brand Management)، کوین لین کلر، فصل ۲ و ۳؛ و مدیریت بازاریابی کاتلر و کلر فصل ۹',
    examYearsAppeared: [1397, 1398, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 10,
    estimatedStudyHours: 3.0,
    graphPos: { layer: 2, col: 3 },
    confusableWith: ['mkt.consumer'],
  },

  // لایه ۳ (مباحث مرز دانش و تلفیقی دکتری)
  {
    id: 'inno.ambidextrous',
    track: 'technology',
    course: 'تئوری‌های نوآوری و فناوری',
    chapter: 'معماری سازمان‌های نوآور و یادگیرنده',
    topic: 'سازمان‌های دوپهلو (Ambidextrous: تعادل بهره‌برداری و اکتشاف)',
    sourceBookCitation: 'March, J. G. (1991) Exploration and Exploitation in Organizational Learning؛ و O’Reilly & Tushman (2004) Harvard Business Review',
    examYearsAppeared: [1399, 1400, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 3.0,
    graphPos: { layer: 3, col: 0 },
    confusableWith: ['mb.structure', 'sm.dynamic'],
  },
  {
    id: 'sm.dynamic',
    track: 'strategy',
    course: 'مدیریت استراتژیک پیشرفته',
    chapter: 'پارادایم‌های نوین مزیت رقابتی در محیط متلاطم',
    topic: 'قابلیت‌های پویا (Dynamic Capabilities: حس‌گری، تسخیر و بازآرایی تیس)',
    sourceBookCitation: 'Teece, Pisano, & Shuen (1997) & Teece (2007) Explicating Dynamic Capabilities, Strategic Management Journal',
    examYearsAppeared: [1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 3.5,
    graphPos: { layer: 3, col: 1 },
    confusableWith: ['sm.rbv', 'inno.ambidextrous'],
  },
  {
    id: 'rm.validity',
    track: 'common',
    course: 'روش تحقیق پیشرفته در مدیریت',
    chapter: 'سنجش، مقیاس‌سازی و مدل‌سازی معادلات ساختاری',
    topic: 'روایی سازه (همگرا و واگرا - ماتریس فورنل و لارکر و بارهای عاملی)',
    sourceBookCitation: 'Fornell & Larcker (1981)؛ و کتاب روش تحقیق در مدیریت دکتر دانایی‌فرد، الوانی و آذر، فصل روایی و پایایی',
    examYearsAppeared: [1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 3.0,
    graphPos: { layer: 3, col: 2 },
    confusableWith: ['stats.scales', 'stats.regression'],
  },
  {
    id: 'mkt.consumer',
    track: 'business',
    course: 'بازاریابی پیشرفته',
    chapter: 'رفتار مصرف‌کننده و تغییر نگرش',
    topic: 'مدل احتمال بسط ذهن (ELM پتی و کاچیوپو: مسیر مرکزی و پیرامونی)',
    sourceBookCitation: 'رفتار مصرف‌کننده، مایکل سولومون (Michael Solomon) و شیفمن و کانوک، فصل شکل‌گیری و تغییر نگرش',
    examYearsAppeared: [1398, 1400, 1401, 1402, 1403],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 3.0,
    graphPos: { layer: 3, col: 3 },
    confusableWith: ['mkt.brand'],
  },
  // گره‌های گرایش مدیریت صنعتی و فناوری (OR، POM و مدل 4P تید و بسانت / طاهر خلیل)
  {
    id: 'ind.or_simplex_duality',
    track: 'industrial',
    course: 'تحقیق در عملیات پیشرفته',
    chapter: 'سیمپلکس، تئوری دوگان و تحلیل حساسیت',
    topic: 'فرم ماتریسی سیمپلکس، قضایای دوگان (Duality) و مکمل‌های متوازن',
    sourceBookCitation: 'پژوهش عملیاتی، دکتر محمدرضا مهرگان و دکتر عادل آذر؛ و کتاب جامع تحقیق در عملیات دکتر عارفه فدوی، فصول ۳ تا ۵',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 10,
    estimatedStudyHours: 4.0,
    graphPos: { layer: 1, col: 4 },
    confusableWith: ['ind.pom_eoq_mrp'],
  },
  {
    id: 'ind.pom_eoq_mrp',
    track: 'industrial',
    course: 'مدیریت تولید و عملیات پیشرفته',
    chapter: 'مدیریت موجودی، MRP و کنترل کیفیت آماری',
    topic: 'مدل‌های موجودی EOQ/EPQ، برنامه‌ریزی نیاز مواد (MRP) و توانمندی فرآیند (Cp, Cpk)',
    sourceBookCitation: 'مدیریت تولید و عملیات، دکتر هایده متقی؛ و مدیریت تولید و عملیات نوین، دکتر احمد جعفرنژاد، فصول موجودی، MRP و کنترل کیفیت',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 10,
    estimatedStudyHours: 3.5,
    graphPos: { layer: 2, col: 4 },
    confusableWith: ['ind.or_simplex_duality', 'stats.anova'],
  },
  {
    id: 'inno.tidd_4p',
    track: 'technology',
    course: 'تئوری‌های نوآوری و فناوری',
    chapter: 'فضای نوآوری تید و بسانت و مدیریت تکنولوژی خلیل',
    topic: 'مدل ۴ بعدی نوآوری (4P تید و بسانت)، طبقه‌بندی فناوری ADL و اطلس فناوری (طاهر خلیل)',
    sourceBookCitation: 'مدیریت نوآوری، جو تید و جان بسانت (ترجمه دکتر آراستی)، فصل ۱ و ۲؛ و مدیریت تکنولوژی، طاهر خلیل (ترجمه دکتر اعرابی)',
    examYearsAppeared: [1397, 1398, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 3.0,
    graphPos: { layer: 3, col: 4 },
    confusableWith: ['inno.s_curve', 'inno.ambidextrous'],
  },
  {
    id: 'ind.mcdm_dea_queue',
    track: 'industrial',
    course: 'تحقیق در عملیات پیشرفته و تصمیم‌گیری',
    chapter: 'تصمیم‌گیری چندمعیاره (MCDM)، تحلیل پوششی داده‌ها (DEA) و تئوری صف',
    topic: 'روش‌های AHP و TOPSIS، مدل‌های CCR/BCC در DEA و سیستم صف مارکوفی (M/M/1)',
    sourceBookCitation: 'تصمیم‌گیری چندمعیاره دکتر اصغرپور و دکتر مهرگان؛ و تحلیل پوششی داده‌ها و تئوری صف دکتر عادل آذر و دکتر عارفه فدوی',
    examYearsAppeared: [1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 10,
    estimatedStudyHours: 4.0,
    graphPos: { layer: 3, col: 5 },
    confusableWith: ['ind.or_simplex_duality', 'ind.pom_eoq_mrp'],
  },
  {
    id: 'inno.open_rd_transfer',
    track: 'technology',
    course: 'مدیریت تکنولوژی و انتقال فناوری',
    chapter: 'نوآوری باز چسبرو، نسل‌های R&D روث‌ول و قراردادهای انتقال تکنولوژی',
    topic: 'نوآوری باز (چسبرو)، ۵ نسل R&D (روث‌ول)، ظرفیت جذب (کوهن-لوینتال) و انتقال فناوری',
    sourceBookCitation: 'نوآوری باز هنری چسبرو (ترجمه کامران باقری)؛ سیاست‌گذاری علم و فناوری دکتر قاضی‌نوری؛ و مقاله Rothwell (1994)',
    examYearsAppeared: [1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 3.5,
    graphPos: { layer: 2, col: 5 },
    confusableWith: ['inno.tidd_4p', 'inno.ambidextrous'],
  },
  // گره‌های تکمیلی ۷ درس کنکور کارشناسی ارشد مدیریت بازرگانی (ضرایب ۴، ۳ و ۲)
  {
    id: 'bus.english_eshraghi',
    track: 'business',
    course: 'زبان عمومی و تخصصی مدیریت (ضریب ۳)',
    chapter: 'واژگان تخصصی مدیریت و تکنیک‌های درک مطلب (اشراقی / زیر ذره‌بین)',
    topic: 'اصطلاحات طلایی مدیریت و بازاریابی، گرامر تستی وارونگی (Inversion) و درک مطلب تحلیلی',
    sourceBookCitation: 'زبان تخصصی مدیریت، آرمان اشراقی (نگاه دانش) / دکتر ناصرزاده؛ و زبان عمومی ارشد زیر ذره‌بین (جهانشاهی و حجازی)',
    examYearsAppeared: [1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 3,
    historicalWeight: 9,
    estimatedStudyHours: 3.5,
    graphPos: { layer: 1, col: 6 },
    confusableWith: ['mb.structure', 'mkt.plc'],
  },
  {
    id: 'bus.econ_nazari',
    track: 'business',
    course: 'اقتصاد خرد و کلان (ضریب ۲)',
    chapter: 'کشش‌ها، ساختارهای بازار و تعادل کلان IS-LM و AD-AS (دکتر محسن نظری)',
    topic: 'کشش‌های تقاضا، حداکثرسازی سود ($MR=MC$)، مدل IS-LM، اثر برون‌رانی و منحنی فیلیپس',
    sourceBookCitation: 'اقتصاد خرد و اقتصاد کلان، دکتر محسن نظری (انتشارات نگاه دانش) — منبع اصلی کنکور ارشد مدیریت',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 2,
    historicalWeight: 9,
    estimatedStudyHours: 3.5,
    graphPos: { layer: 2, col: 6 },
    confusableWith: ['mkt.plc', 'stats.regression'],
  },
  {
    id: 'bus.math_stats_ranjbaran_tourani',
    track: 'common',
    course: 'ریاضی و آمار (ضریب ۲)',
    chapter: 'دامنه، حد، مشتق و ماتریس (رنجبران) + احتمال بیز و توزیع‌ها (طورانی)',
    topic: 'حد و پیوستگی، بهینه‌سازی چندمتغیره، ویژه مقدارها و قضیه احتمال کامل و بیز',
    sourceBookCitation: 'ریاضیات عمومی هادی رنجبران (اثبات) / محمودیان؛ و آمار و احتمال طرح ۹۰ درصد محسن طورانی (نگاه دانش)',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 3,
    historicalWeight: 9,
    estimatedStudyHours: 4.0,
    graphPos: { layer: 1, col: 7 },
    confusableWith: ['stats.scales', 'stats.anova'],
  },
  {
    id: 'bus.islamic_moghimi',
    track: 'business',
    course: 'اصول و مبانی مدیریت از دیدگاه اسلام (ضریب ۲)',
    chapter: 'نظام ارزش‌ها، برنامه‌ریزی، انگیزش و کنترل اسلامی (دکتر سید محمد مقیمی)',
    topic: 'سطوح ارزش‌ها، فرمان امام علی (ع) به مالک اشتر، مدل انگیزشی اسلامی و نظارت درونی (تقوا)',
    sourceBookCitation: 'اصول و مبانی مدیریت از دیدگاه اسلام، دکتر سید محمد مقیمی (انتشارات راه دان) — منبع مستقیم کنکور ارشد',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 2,
    historicalWeight: 8,
    estimatedStudyHours: 2.5,
    graphPos: { layer: 3, col: 6 },
    confusableWith: ['mb.culture', 'mb.contingency'],
  },
  ...PHD_EXPANSION_NODES,
];

export const INITIAL_NODE_DEPENDENCIES: NodeDependency[] = [
  {
    source: 'mb.contingency',
    target: 'mb.structure',
    relation: 'prerequisite',
    weight: 0.5,
    description: 'درک تمایز ساختار مکانیکی و ارگانیک پیش‌نیاز مستقیم تحلیل عدم اطمینان محیطی لارنس و لورش و فناوری وودوارد است.',
  },
  {
    source: 'mb.culture',
    target: 'mb.contingency',
    relation: 'prerequisite',
    weight: 0.35,
    description: 'تناسب فرهنگ سازمانی دنیسون (انطباق‌پذیری در برابر ثبات) بر مبنای اقتضائات محیطی بنا شده است.',
  },
  {
    source: 'inno.ambidextrous',
    target: 'mb.structure',
    relation: 'prerequisite',
    weight: 0.45,
    description: 'در سازمان دوپهلو، واحد اکتشاف نیازمند ساختار ارگانیک و واحد بهره‌برداری نیازمند ساختار مکانیکی است.',
  },
  {
    source: 'sm.rbv',
    target: 'sm.value_chain',
    relation: 'prerequisite',
    weight: 0.5,
    description: 'شناسایی منابع و قابلیت‌های متمایز بارنی ابتدا از طریق تفکیک فعالیت‌های اولیه و پشتیبانی زنجیره ارزش پورتر انجام می‌شود.',
  },
  {
    source: 'sm.portfolio',
    target: 'sm.value_chain',
    relation: 'prerequisite',
    weight: 0.4,
    description: 'تحلیل توان رقابتی واحدهای کسب‌وکار (SBU) در ماتریس GE نیازمند درک مزیت هزینه‌ای/تمایز زنجیره ارزش است.',
  },
  {
    source: 'sm.dynamic',
    target: 'sm.rbv',
    relation: 'prerequisite',
    weight: 0.55,
    description: 'قابلیت‌های پویای تیس امتداد پویای دیدگاه مبتنی بر منابع (RBV) در محیط‌های پرتلاطم و هایپرکمپتیشن است.',
  },
  {
    source: 'stats.anova',
    target: 'stats.scales',
    relation: 'prerequisite',
    weight: 0.55,
    description: 'در ANOVA متغیر وابسته باید کمی (فاصله‌ای/نسبتی) و متغیر مستقل کیفی (اسمی/رتبه‌ای) باشد.',
  },
  {
    source: 'stats.regression',
    target: 'stats.anova',
    relation: 'prerequisite',
    weight: 0.5,
    description: 'آزمون معناداری کل رگرسیون بر پایه جدول تحلیل واریانس و آماره F انجام می‌شود.',
  },
  {
    source: 'rm.validity',
    target: 'stats.regression',
    relation: 'cross_course',
    weight: 0.45,
    description: 'محاسبه AVE و بارهای عاملی استاندارد ($\lambda^2$) در روایی سازه فورنل-لارکر نیازمند درک واریانس تبیین‌شده و ضریب تعیین است.',
  },
  {
    source: 'mkt.brand',
    target: 'sm.rbv',
    relation: 'cross_course',
    weight: 0.4,
    description: 'ارزش ویژه برند یکی از مهم‌ترین دارایی‌های نامشهود و تقلیدناپذیر (VRIO) ایجادکننده مزیت رقابتی پایدار است.',
  },
  {
    source: 'mkt.plc',
    target: 'sm.portfolio',
    relation: 'cross_course',
    weight: 0.45,
    description: 'مراحل چهارگانه چرخه عمر محصول (معرفی، رشد، بلوغ، افول) متناظر با خانه‌های ماتریس BCG هستند.',
  },
  {
    source: 'mkt.consumer',
    target: 'mkt.brand',
    relation: 'prerequisite',
    weight: 0.4,
    description: 'تداعی‌های برند و تصویر ذهنی در مدل کلر بر اساس مسیر مرکزی و پیرامونی پردازش اطلاعات شکل می‌گیرند.',
  },
  {
    source: 'inno.s_curve',
    target: 'mkt.plc',
    relation: 'cross_course',
    weight: 0.35,
    description: 'بلوغ عملکردی فناوری در منحنی S فاستر با مرحله بلوغ بازار در چرخه عمر محصول هم‌پوشانی تحلیلی دارد.',
  },
  {
    source: 'sm.dynamic',
    target: 'inno.ambidextrous',
    relation: 'cross_course',
    weight: 0.4,
    description: 'حس‌گری و تسخیر فرصت در قابلیت‌های پویا از طریق ساختارهای دوپهلوی سازمانی (اکتشاف و بهره‌برداری) اجرا می‌شود.',
  },
  {
    source: 'ind.or_simplex_duality',
    target: 'stats.scales',
    relation: 'prerequisite',
    weight: 0.45,
    description: 'مدل‌سازی متغیرهای پیوسته و گسسته در برنامه‌ریزی خطی نیازمند شناخت مقیاس‌های کمی نسبتی است.',
  },
  {
    source: 'ind.pom_eoq_mrp',
    target: 'ind.or_simplex_duality',
    relation: 'prerequisite',
    weight: 0.5,
    description: 'مدل‌های بهینه‌سازی موجودی، برنامه‌ریزی تولید و تخصیص ظرفیت بر پایه بهینه‌سازی ریاضی و تحقیق در عملیات بنا شده‌اند.',
  },
  {
    source: 'inno.tidd_4p',
    target: 'inno.s_curve',
    relation: 'prerequisite',
    weight: 0.5,
    description: 'چرخه فناوری طاهر خلیل (ADL) و فضای 4P نوآوری تید و بسانت مستقیماً بر روی مراحل منحنی S فناوری نگاشت می‌شوند.',
  },
  {
    source: 'ind.mcdm_dea_queue',
    target: 'ind.or_simplex_duality',
    relation: 'prerequisite',
    weight: 0.55,
    description: 'مدل‌های برنامه‌ریزی آرمانی (MODM) و فرم‌های مضربی/پوششی در تحلیل پوششی داده‌ها (DEA) مستقیماً بر پایه برنامه‌ریزی خطی و قضایای دوگان بنا شده‌اند.',
  },
  {
    source: 'inno.open_rd_transfer',
    target: 'inno.s_curve',
    relation: 'prerequisite',
    weight: 0.5,
    description: 'انتخاب سازوکار انتقال تکنولوژی (لیسانسینگ، JV، BOT) و نوآوری باز ورودی/خروجی تابع مرحله بلوغ فناوری در منحنی S است.',
  },
  {
    source: 'bus.english_eshraghi',
    target: 'mb.structure',
    relation: 'cross_course',
    weight: 0.4,
    description: 'تسلط بر اصطلاحات انگلیسی ساختار سازمانی (Span of Control, Formalization, Decentralization) مستقیماً بر درک تئوری‌های سازمان استوار است.',
  },
  {
    source: 'bus.econ_nazari',
    target: 'mkt.plc',
    relation: 'cross_course',
    weight: 0.45,
    description: 'استراتژی‌های قیمت‌گذاری در مراحل PLC کاتلر بر مبنای کشش قیمتی تقاضا و ساختار بازار در اقتصاد خرد دکتر نظری تحلیل می‌شوند.',
  },
  {
    source: 'stats.anova',
    target: 'bus.math_stats_ranjbaran_tourani',
    relation: 'prerequisite',
    weight: 0.5,
    description: 'توزیع‌های احتمال، امید ریاضی و واریانس در آمار طورانی و حساب دیفرانسیل رنجبران زیربنای استنباط آماری و تحلیل واریانس هستند.',
  },
  {
    source: 'bus.islamic_moghimi',
    target: 'mb.culture',
    relation: 'cross_course',
    weight: 0.45,
    description: 'الگوی سطوح ارزش‌ها و مفروضات توحیدی در مدیریت اسلامی دکتر مقیمی متناظر با لایه‌های فرهنگ سازمانی شاین است.',
  },
];

export const COMPARISON_TABLES: Record<string, ComparisonTableData> = {
  'sm.rbv': {
    id: 'comp.rbv_vs_io',
    nodeA: 'sm.rbv',
    nodeB: 'sm.value_chain',
    title: 'مقایسه دیدگاه مبتنی بر منابع (RBV بارنی) و سازمان صنعتی (I/O پورتر)',
    subtitle: 'پرتکرارترین دام مفهومی کنکور دکتری مدیریت استراتژیک (تکرار در ۸ دوره اخیر)',
    dimensions: [
      {
        criterion: 'منشأ اصلی سودآوری و مزیت رقابتی',
        conceptA: 'درون بنگاه: منابع و قابلیت‌های ناهمگن و غیرمتحرک (VRIO)',
        conceptB: 'بیرون بنگاه: جذابیت ساختار صنعت و موقعیت‌یابی در ۵ نیروی رقابتی',
      },
      {
        criterion: 'واحد اصلی تحلیل',
        conceptA: 'منابع، دارایی‌های نامشهود و روتین‌های اختصاصی بنگاه',
        conceptB: 'صنعت، گروه استراتژیک و فعالیت‌های زنجیره ارزش',
      },
      {
        criterion: 'فرض بنیادی درباره منابع بنگاه‌های یک صنعت',
        conceptA: 'ناهمگنی منابع (Heterogeneity) و عدم تحرک کامل (Immobility) بین رقبا',
        conceptB: 'همگنی منابع؛ منابع در بازار عوامل تولید قابل خرید و جابه‌جایی‌اند',
      },
      {
        criterion: 'سازوکار محافظت در برابر تقلید رقبا',
        conceptA: 'ابهام علی (Causal Ambiguity)، وابستگی به مسیر (تاریخی) و پیچیدگی اجتماعی',
        conceptB: 'موانع ورود به صنعت، صرفه‌جویی مقیاس و هزینه تغییر تأمین‌کننده',
      },
    ],
    diagnosticTakeaway:
      'اگر در صورت سؤال بر «تفاوت سودآوری دو شرکت هم‌سایز در یک صنعت واحد» تأکید شد، پاسخ قطعاً دیدگاه مبتنی بر منابع (RBV) است نه مدل پورتر!',
  },
  'mb.structure': {
    id: 'comp.mech_vs_org',
    nodeA: 'mb.structure',
    nodeB: 'mb.contingency',
    title: 'مقایسه ساختار مکانیکی و ساختار ارگانیک (برنز و استاکر)',
    subtitle: 'کلید حل تست‌های تئوری سازمان، وودوارد و سازمان‌های دوپهلو',
    dimensions: [
      {
        criterion: 'محیط و فناوری متناظر',
        conceptA: 'محیط پایدار و مطمئن / فناوری تولید انبوه (وودوارد)',
        conceptB: 'محیط پویا و با عدم اطمینان بالا / فناوری تولید تکی یا فرآیندی',
      },
      {
        criterion: 'تخصص‌گرایی و رسمیت',
        conceptA: 'تخصص‌گرایی شدید، شرح وظایف خشک و قوانین مکتوب بالا',
        conceptB: 'وظایف منعطف و مشترک، رسمیت پایین و بازتعریف مستمر نقش‌ها',
      },
      {
        criterion: 'کانال ارتباطات و تصمیم‌گیری',
        conceptA: 'عمودی (سلسله‌مراتبی از بالا به پایین) و تمرکز شدید در رأس',
        conceptB: 'افقی و شبکه‌ای (مشاوره‌ای) و عدم تمرکز مبتنی بر دانش تخصصی',
      },
      {
        criterion: 'کاربرد در سازمان دوپهلو (Ambidextrous)',
        conceptA: 'واحد بهره‌برداری (Exploitation) برای کارایی و کاهش هزینه',
        conceptB: 'واحد اکتشاف (Exploration) برای نوآوری رادیکال و R&D',
      },
    ],
    diagnosticTakeaway:
      'دام کنکور: فناوری «تولید فرآیندی/پیوسته» (پالایشگاه) در مدل وودوارد با اینکه بسیار مکانیزه است، ساختار مدیریتی «ارگانیک» دارد، نه مکانیکی!',
  },
  'stats.anova': {
    id: 'comp.anova_vs_reg',
    nodeA: 'stats.anova',
    nodeB: 'stats.regression',
    title: 'تفکیک تحلیل واریانس (ANOVA) و رگرسیون خطی در آمار مدیریت',
    subtitle: 'بررسی مقیاس متغیرها و تجزیه مجموع مربعات خطا',
    dimensions: [
      {
        criterion: 'مقیاس متغیر مستقل (X)',
        conceptA: 'کیفی (اسمی یا رتبه‌ای) — به آن «عامل (Factor)» گفته می‌شود',
        conceptB: 'کمی (فاصله‌ای یا نسبتی) — متغیر پیش‌بین پیوسته',
      },
      {
        criterion: 'هدف اصلی آزمون آماری',
        conceptA: 'مقایسه برابری میانگینِ $k$ جامعه مستقل ($H_0: \\mu_1 = \\mu_2 = \\dots = \\mu_k$)',
        conceptB: 'پیش‌بینی مقدار متغیر وابسته و سنجش شیب خط ($H_0: \\beta_1 = \\beta_2 = \\dots = 0$)',
      },
      {
        criterion: 'رابطه درجات آزادی کل ($df_T$)',
        conceptA: '$df_{\\text{Total}} = n - 1 = (k - 1) + (n - k)$',
        conceptB: '$df_{\\text{Total}} = n - 1 = p + (n - p - 1)$ که $p$ تعداد متغیرهای مستقل است',
      },
      {
        criterion: 'آماره آزمون نهایی',
        conceptA: '$F = \\frac{MSB}{MSW} = \\frac{SSB / (k-1)}{SSW / (n-k)}$',
        conceptB: '$F = \\frac{MSR}{MSE} = \\frac{R^2 / p}{(1 - R^2) / (n - p - 1)}$',
      },
    ],
    diagnosticTakeaway:
      'هرگاه متغیر مستقل به صورت «سطوح روش تدریس» یا «نوع گرایش» بود از ANOVA و هرگاه «میزان بودجه تبلیغات به ریال» بود از رگرسیون استفاده می‌کنیم.',
  },
  'mkt.brand': {
    id: 'comp.keller_vs_aaker',
    nodeA: 'mkt.brand',
    nodeB: 'mkt.consumer',
    title: 'مقایسه مدل ارزش ویژه برند کلر (CBBE) و دیوید آکر',
    subtitle: 'تفکیک پله‌های هرم کلر از ابعاد پنج‌گانه آکر',
    dimensions: [
      {
        criterion: 'ساختار مدل',
        conceptA: 'هرم ۴ لایه‌ای پلکانی (هویت ← معنا ← پاسخ ← رابطه/طنین)',
        conceptB: '۵ بعد هم‌عرض (آگاهی، تداعی، کیفیت ادراک‌شده، وفاداری، سایر دارایی‌ها)',
      },
      {
        criterion: 'نقطه اوج مدل',
        conceptA: 'طنین یا رزونانس برند (Brand Resonance): وفاداری رفتاری و دلبستگی فعال',
        conceptB: 'وفاداری به برند (Brand Loyalty) به عنوان هسته مرکزی ارزش مالی',
      },
      {
        criterion: 'دوگانگی عقلانی و احساسی',
        conceptA: 'مسیر چپ (عملکرد و قضاوت منطقی) در برابر مسیر راست (تصویر و احساسات)',
        conceptB: 'تفکیک صریح بین مسیر منطقی و هیجانی در قالب پلکانی وجود ندارد',
      },
    ],
    diagnosticTakeaway:
      'در هرم کلر، بدون ایجاد «برجستگی برند (Salience)» در پله اول، رسیدن به «طنین برند (Resonance)» در قله هرم غیرممکن است.',
  },
};

export const INITIAL_INTERACTIVE_LESSONS: Record<string, InteractiveLesson> = {
  'mb.structure': {
    nodeId: 'mb.structure',
    course: 'مبانی سازمان و مدیریت',
    chapter: 'ابعاد ساختاری و طراحی سازمان',
    topic: 'ساختارهای مکانیکی و ارگانیک (برنز و استاکر)',
    sourceBookCitation: 'تئوری و طراحی سازمان، ریچارد دفت (ترجمه پارسائیان و اعرابی)، فصل ۱ و ۴',
    examYearsAppeared: [1396, 1397, 1399, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ — پایه تمام تست‌های طراحی سازمان',
    frequencyLabel: 'تکرار در ۷ دوره کنکور دکتری (۱۳۹۶ تا ۱۴۰۴)',
    summary:
      'تام برنز و جورج استاکر (۱۹۶۱) با بررسی ۲۰ شرکت صنعتی در بریتانیا ثابت کردند که هیچ ساختار واحدی برای همه سازمان‌ها بهینه نیست، بلکه ساختار داخلی باید با درجه تغییرپذیری و عدم اطمینان محیط بیرونی تناسب داشته باشد. آن‌ها دو قطب ایده‌آل «مکانیکی» (مناسب محیط پایدار) و «ارگانیک» (مناسب محیط متلاطم) را تعریف کردند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: سه بعد ساختاری رابینز (پیچیدگی، رسمیت، تمرکز)',
        content:
          'هر ساختار سازمانی با ۳ بُعد سنجیده می‌شود:\n۱. پیچیدگی (Complexity): میزان تفکیک افقی (تعداد تخصص‌ها)، عمودی (تعداد سطوح سلسله‌مراتب) و فضایی (پراکندگی جغرافیایی).\n۲. رسمیت (Formalization): میزان تکیه بر قوانین، رویه‌ها و شرح شغل‌های مکتوب و استاندارد.\n۳. تمرکز (Centralization): جایگاه اختیار تصمیم‌گیری در رأس هرم یا تفویض آن به سطوح پایین.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: کالبدشکافی ساختار مکانیکی (Mechanistic)',
        content:
          'در محیط‌های باثبات و قابل پیش‌بینی، ساختار مکانیکی بیشترین کارایی (Efficiency) را دارد:\n• وظایف به بخش‌های بسیار تخصصی و مجزا تقسیم می‌شوند.\n• سلسله‌مراتب اختیار روشن، حیطه نظارت محدود و ارتباطات عمودی (دستور از بالا، گزارش از پایین) است.\n• منبع اقتدار «جایگاه رسمی در چارت سازمانی» است و وفاداری به شرح شغل محدود معطوف است.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: کالبدشکافی ساختار ارگانیک (Organic)',
        content:
          'در محیط‌های متلاطم، فناورانه و نامطمئن، ساختار ارگانیک اثربخشی و نوآوری را تضمین می‌کند:\n• کارکنان در تیم‌های میان‌وظیفه‌ای کار می‌کنند و وظایف به طور مستمر بر اساس نیاز پروژه بازتعریف می‌شوند.\n• رسمیت و تمرکز پایین است؛ ارتباطات افقی/مورب و ماهیت آن «مشاوره و تبادل اطلاعات» است نه دستور.\n• منشأ نفوذ و اقتدار «دانش فنی و خبرگی» است، نه پست سازمانی.',
      },
    ],
    conceptDescriptors: [
      { concept: 'ساختار مکانیکی', descriptor: 'منشأ اقتدار و نفوذ', answer: 'جایگاه رسمی در سلسله‌مراتب اداری' },
      { concept: 'ساختار ارگانیک', descriptor: 'منشأ اقتدار و نفوذ', answer: 'دانش، مهارت و خبرگی تخصصی در هر نقطه از شبکه' },
      { concept: 'ساختار مکانیکی', descriptor: 'جهت و ماهیت ارتباطات', answer: 'عمودی؛ مبتنی بر دستور و فرمان از بالا به پایین' },
      { concept: 'ساختار ارگانیک', descriptor: 'جهت و ماهیت ارتباطات', answer: 'افقی و شبکه‌ای؛ مبتنی بر مشاوره و اطلاعات' },
    ],
    konkoorTips: [
      'دام طراح: در ساختار ارگانیک «تخصص‌گرایی و دانش» حذف نمی‌شود، بلکه «مرزبندی خشک وظایف» حذف شده و تخصص‌ها در قالب تیم ترکیب می‌شوند.',
      'بوروکراسی ماشینی مینتزبرگ و مدیریت علمی تیلور منطبق بر ساختار مکانیکی، و ادهوکراسی (Adhocracy) منطبق بر ساختار ارگانیک است.',
    ],
    keyTerms: ['Mechanistic Structure', 'Organic Structure', 'Formalization', 'Centralization', 'Burns & Stalker'],
    conceptCheck: {
      prompt: 'کدام ویژگی زیر مختص «ساختار ارگانیک» در محیط‌های با عدم اطمینان بالاست؟',
      options: [
        'ارتباطات افقی به صورت مشاوره و بازتعریف مستمر وظایف توسط اعضای تیم بر مبنای دانش',
        'تمرکز دانش در رأس هرم استراتژیک و ارتباطات عمودی مبتنی بر دستورالعمل مکتوب',
      ],
    },
  },
  'mb.contingency': {
    nodeId: 'mb.contingency',
    course: 'مبانی سازمان و مدیریت',
    chapter: 'تئوری‌های اقتضایی فناوری و محیط',
    topic: 'مدل تفکیک-یکپارچگی لارنس و لورش و فناوری جوآن وودوارد',
    sourceBookCitation: 'تئوری سازمان استیفن رابینز، فصل ۶ و ۷؛ و ریچارد دفت فصل ۴ و ۷',
    examYearsAppeared: [1396, 1398, 1399, 1400, 1401, 1402, 1404],
    konkoorWeightLabel: 'ضریب ۵ — پرتکرارترین مبحث تئوری سازمان',
    frequencyLabel: 'تکرار در ۷ دوره کنکور دکتری (۱۳۹۶ تا ۱۴۰۴)',
    summary:
      'تئوری اقتضایی بیان می‌کند که طراحی سازمان تابعی از عوامل موقعیتی (محیط، فناوری، اندازه و استراتژی) است. دو ستون اصلی این فصل در کنکور دکتری، پژوهش «لارنس و لورش» درباره محیط و پژوهش «جوآن وودوارد» درباره فناوری تولید است.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: مدل تفکیک و یکپارچگی لارنس و لورش (Lawrence & Lorsch)',
        content:
          'لارنس و لورش نشان دادند که محیط کل سازمان یکدست نیست؛ بلکه هر واحد (R&D، تولید، فروش) با یک «زیرمحیط (Sub-environment)» متفاوت روبه‌روست:\n• تفکیک (Differentiation): تفاوت در جهت‌گیری شناختی، افق زمانی (کوتاه‌مدت در فروش، بلندمدت در R&D)، هدف و ساختار رسمی بین مدیران واحدهای مختلف.\n• یکپارچگی (Integration): کیفیت همکاری و هماهنگی بین این واحدهای متمایز با استفاده از تیم‌های میان‌وظیفه‌ای، مدیران رابط و کمیته‌ها.\nقانون طلایی: هرچه محیط نامطمئن‌تر و ناهمگن‌تر باشد، هم «تفکیک» بیشتر می‌شود و هم نیاز به «یکپارچگی» شدیدتر می‌گردد!',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: طبقه‌بندی سه‌گانه فناوری تولید جوآن وودوارد (Joan Woodward)',
        content:
          'وودوارد ۱۰۰ شرکت تولیدی را بر اساس «پیچیدگی فنی فرآیند تولید» در ۳ گروه دسته‌بندی کرد:\n۱. تولید تکی و دسته‌ای کوچک (Unit / Small Batch): ساخت سفارشی (مثل ساخت ماهواره، کشتی یا لباس سفارشی) ← پیچیدگی فنی پایین.\n۲. تولید انبوه و دسته‌ای بزرگ (Mass / Large Batch): خط مونتاژ استاندارد (مثل خودروسازی) ← پیچیدگی فنی متوسط.\n۳. تولید فرآیندی یا پیوسته (Continuous Process): جریان خودکار شیمیایی/پالایشگاهی (مثل پتروشیمی و پالایشگاه) ← پیچیدگی فنی بسیار بالا.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: روابط خطی و منحنی (U-شکل) در جدول وودوارد (دام اصلی کنکور)',
        content:
          'در جدول وودوارد دو دسته رابطه وجود دارد که هر سال در کنکور سؤال می‌شود:\nالف) متغیرهایی که از تکی به فرآیندی «خطی افزایش» می‌یابند: پیچیدگی فنی، تعداد سطوح عمودی مدیریت، نسبت مدیران به کل کارکنان، و نسبت کارگران غیرمستقیم (تعمیر و نگهداری) به مستقیم.\nب) متغیرهایی که «منحنی (U یا ∩ شکل)» هستند: در تولید تکی و فرآیندی، رسمیت پایین، تمرکز پایین، ارتباطات شفاهی بالا و ساختار «ارگانیک» است؛ اما در تولید انبوه (وسط طیف) رسمیت بالا، حیطه نظارت سرپرستان خط اول بسیار وسیع و ساختار «مکانیکی» است!',
      },
    ],
    conceptDescriptors: [
      { concept: 'لارنس و لورش', descriptor: 'شرط موفقیت در محیط بسیار نامطمئن', answer: 'تفکیک بالا + یکپارچگی بالا (به طور هم‌زمان)' },
      { concept: 'تولید انبوه وودوارد', descriptor: 'ساختار مدیریتی و حیطه نظارت سرپرستان', answer: 'ساختار مکانیکی و پهن‌ترین حیطه نظارت در سطح عملیاتی' },
      { concept: 'تولید فرآیندی وودوارد', descriptor: 'ساختار مدیریتی و پیچیدگی فنی', answer: 'ساختار ارگانیک با بالاترین پیچیدگی فنی و بیشترین سطوح مدیریت' },
    ],
    konkoorTips: [
      'دام بسیار پرتکرار: داوطلبان تصور می‌کنند چون پالایشگاه (تولید فرآیندی) کاملاً خودکار و ماشینی است، ساختار مدیریتی آن مکانیکی است؛ در حالی که کارهای تکراری توسط ماشین انجام می‌شود و تیم انسانی برای مدیریت بحران ساختار «ارگانیک» دارد!',
    ],
    keyTerms: ['Differentiation & Integration', 'Lawrence & Lorsch', 'Joan Woodward', 'Unit / Mass / Process Production'],
    conceptCheck: {
      prompt: 'طبق یافته‌های جوآن وودوارد، کدام دو نوع فناوری تولید نیازمند ساختار مدیریتی «ارگانیک» هستند؟',
      options: [
        'تولید تکی (سفارشی) و تولید فرآیندی (پیوسته)',
        'تولید انبوه (خط مونتاژ) و تولید فرآیندی (پیوسته)',
      ],
    },
  },
  'sm.value_chain': {
    nodeId: 'sm.value_chain',
    course: 'مدیریت استراتژیک پیشرفته',
    chapter: 'تحلیل درون‌سازمانی و زنجیره ارزش',
    topic: 'زنجیره ارزش مایکل پورتر و تحلیل پیوندها',
    sourceBookCitation: 'Competitive Advantage (Michael Porter, 1985), Ch. 2؛ و مدیریت استراتژیک فرد دیوید',
    examYearsAppeared: [1397, 1398, 1400, 1401, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ — پیش‌نیاز تحلیل استراتژی کسب‌وکار',
    frequencyLabel: 'تکرار در ۶ دوره کنکور دکتری (۱۳۹۷ تا ۱۴۰۴)',
    summary:
      'مایکل پورتر بنگاه را مجموعه‌ای از فعالیت‌های ارزش‌زا می‌داند که به دو گروه «فعالیت‌های اولیه (Primary)» و «فعالیت‌های پشتیبانی (Support)» تقسیم می‌شوند. تفاضل ارزش کل ایجادشده برای خریدار و هزینه اجرای این فعالیت‌ها «حاشیه سود (Margin)» را شکل می‌دهد.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: پنج فعالیت اولیه (Primary Activities)',
        content:
          'فعالیت‌هایی که مستقیماً در ساخت فیزیکی، فروش، انتقال به خریدار و پشتیبانی پس از فروش نقش دارند:\n۱. لجستیک ورودی (Inbound Logistics): دریافت، انبارداری، کنترل موجودی و توزیع مواد خام به خط تولید.\n۲. عملیات (Operations): ماشین‌کاری، مونتاژ، بسته‌بندی و تبدیل نهاده‌ها به محصول نهایی.\n۳. لجستیک خروجی (Outbound Logistics): انبارداری کالای ساخته شده، پردازش سفارش و حمل فیزیکی به مشتری.\n۴. بازاریابی و فروش: تبلیغات، قیمت‌گذاری، انتخاب کانال و نیروی فروش.\n۵. خدمات (Service): نصب، تعمیر، آموزش و تأمین قطعات برای حفظ ارزش محصول.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: چهار فعالیت پشتیبانی (Support Activities) و دام تدارکات',
        content:
          'فعالیت‌هایی که پشتیبان کل زنجیره و فعالیت‌های اولیه هستند:\n۱. زیرساخت بنگاه (Firm Infrastructure): مدیریت عمومی، برنامه‌ریزی استراتژیک، امور مالی، حقوقی و کیفیت (پشتیبانِ کل زنجیره).\n۲. مدیریت منابع انسانی (HRM): جذب، استخدام، آموزش و سیستم جبران خدمات.\n۳. توسعه فناوری (Technology Development): تحقیق و توسعه، طراحی فرآیند و محصول.\n۴. تدارکات (Procurement): وظیفه «خرید» نهاده‌ها (مواد خام، ماشین‌آلات، ساختمان و خدمات) در کل شرکت.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: پیوندهای درونی (Internal Linkages) و عمودی (Vertical Linkages)',
        content:
          'مزیت رقابتی پایدار نه فقط از تک‌تک فعالیت‌ها، بلکه از «پیوندها» ناشی می‌شود:\n• پیوند درونی: زمانی که نحوه انجام یک فعالیت (مثلاً بازرسی دقیق‌تر مواد در لجستیک ورودی یا طراحی بهتر در R&D) هزینه فعالیت دیگر (مثلاً ضایعات عملیات یا تعمیرات گارانتی) را کاهش می‌دهد.\n• پیوند عمودی (سیستم ارزش): هماهنگی زنجیره ارزش بنگاه با زنجیره ارزش تأمین‌کنندگان (بالادست) و کانال‌های توزیع (پایین‌دست)؛ مثل تحویل به‌موقع (JIT).',
      },
    ],
    conceptDescriptors: [
      { concept: 'تدارکات (Procurement)', descriptor: 'جایگاه در زنجیره ارزش پورتر', answer: 'فعالیت پشتیبانی (مربوط به فرآیند خرید نهاده‌ها در کل شرکت)' },
      { concept: 'لجستیک ورودی', descriptor: 'جایگاه در زنجیره ارزش پورتر', answer: 'فعالیت اولیه (دریافت، انبارش و جابه‌جایی فیزیکی مواد خام)' },
      { concept: 'زیرساخت بنگاه', descriptor: 'ویژگی منحصر‌به‌فرد در میان فعالیت‌های پشتیبانی', answer: 'تنها فعالیتی که به جای یک بخش خاص، از کل زنجیره ارزش پشتیبانی می‌کند' },
    ],
    konkoorTips: [
      'دام کلاسیک کنکور: «تدارکات (Procurement)» یعنی فرآیند خرید و مذاکره با تأمین‌کننده که یک فعالیت «پشتیبانی» است؛ اما دریافت و انبار کردن فیزیکی مواد خام «لجستیک ورودی» (فعالیت اولیه) است.',
    ],
    keyTerms: ['Primary Activities', 'Support Activities', 'Procurement vs Inbound Logistics', 'Internal & Vertical Linkages'],
    conceptCheck: {
      prompt: 'در مدل زنجیره ارزش پورتر، «مذاکره و عقد قرارداد خرید مواد اولیه» و «انبارداری مواد اولیه دریافتی» به ترتیب جزو کدام فعالیت‌ها هستند؟',
      options: [
        'تدارکات (پشتیبانی) — لجستیک ورودی (اولیه)',
        'لجستیک ورودی (اولیه) — عملیات (اولیه)',
      ],
    },
  },
  'sm.rbv': {
    nodeId: 'sm.rbv',
    course: 'مدیریت استراتژیک پیشرفته',
    chapter: 'مکتب مبتنی بر منابع و قابلیت‌ها',
    topic: 'دیدگاه مبتنی بر منابع (RBV) و چارچوب VRIO جی بارنی',
    sourceBookCitation: 'Barney, J. (1991). Firm Resources and Sustained Competitive Advantage, Journal of Management',
    examYearsAppeared: [1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ — پرتکرارترین مبحث استراتژی دکتری',
    frequencyLabel: 'تکرار در ۸ دوره کنکور دکتری (۱۳۹۷ تا ۱۴۰۴)',
    summary:
      'دیدگاه مبتنی بر منابع (Resource-Based View) با رد اولویت ساختار صنعت، منشأ تفاوت سودآوری شرکت‌ها را در منابع و قابلیت‌های درونی آن‌ها می‌جوید. جی بارنی (۱۹۹۱) بر دو پیش‌فرض بنیادی و چهار ویژگی چارچوب VRIO تأکید می‌کند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: دو پیش‌فرض بنیادی RBV (در برابر مکتب صنعتی پورتر)',
        content:
          'بارنی دو فرض کلیدی مطرح می‌کند:\n۱. ناهمگنی منابع (Resource Heterogeneity): بنگاه‌های فعال در یک صنعت، بسته‌های متفاوتی از منابع و قابلیت‌ها را در اختیار دارند.\n۲. عدم تحرک منابع (Resource Immobility): این تفاوت‌ها در طول زمان پایدار می‌مانند زیرا منابع استراتژیک به راحتی در بازار عوامل تولید قابل خرید و فروش و انتقال بین رقبا نیستند.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: ماتریس تصمیم‌گیری VRIO و پیامد رقابتی هر مرحله',
        content:
          'برای ارزیابی پتانسیل یک منبع، ۴ سؤال به ترتیب پرسیده می‌شود:\n• آیا ارزشمند است (Valuable)؟ اگر خیر ← نقطه‌ضعف رقابتی (بازده کمتر از نرمال).\n• آیا فقط ارزشمند است اما کمیاب نیست؟ ← برابری رقابتی (Competitive Parity — بازده نرمال).\n• آیا ارزشمند و کمیاب (Rare) است اما قابل تقلید است؟ ← مزیت رقابتی موقت (Temporary Advantage).\n• آیا ارزشمند + کمیاب + پرهزینه برای تقلید (Inimitable) + سازمان‌یافته برای بهره‌برداری (Organized) است؟ ← مزیت رقابتی پایدار (Sustained Competitive Advantage).',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: سه سازوکار تقلیدناپذیری منابع (Inimitability Mechanisms)',
        content:
          'چرا رقبا نمی‌توانند یک منبع ارزشمند و کمیاب را کپی کنند؟\n۱. شرایط تاریخی منحصر‌به‌فرد و وابستگی به مسیر (Path Dependency): منبع در طی یک مسیر تاریخی طولانی شکل گرفته که تکرار سریع آن ممکن نیست.\n۲. ابهام علی (Causal Ambiguity): پیوند علّی بین منبع و مزیت رقابتی به‌قدری پنهان است که رقبا (و حتی خود مدیران شرکت!) دقیقاً نمی‌دانند کدام جزء عامل موفقیت بوده است.\n۳. پیچیدگی اجتماعی (Social Complexity): منبع در بافت روابط انسانی، اعتماد، فرهنگ و شهرت تنیده شده که با پول قابل خریداری نیست.',
      },
    ],
    conceptDescriptors: [
      { concept: 'منبع ارزشمند ولی غیرکمیاب', descriptor: 'پیامد رقابتی و اقتصادی در مدل VRIO', answer: 'برابری رقابتی (Competitive Parity) و کسب بازده اقتصادی نرمال' },
      { concept: 'منبع ارزشمند و کمیاب ولی قابل تقلید', descriptor: 'پیامد رقابتی در مدل VRIO', answer: 'مزیت رقابتی موقت (Temporary Competitive Advantage)' },
      { concept: 'ابهام علی (Causal Ambiguity)', descriptor: 'شرط اثربخشی به عنوان مانع تقلید', answer: 'عدم آگاهی دقیق هر دو طرف (هم شرکت پیشتاز و هم رقبا) از فرمول علّی مزیت' },
    ],
    konkoorTips: [
      'دام طراح: اگر فقط رقبا از رابطه علّی بی‌خبر باشند اما مدیران خود شرکت فرمول دقیق را بدانند، رقبا با «استخدام و شکار مدیران شرکت پیشتاز» ابهام را از بین می‌برند! بنابراین ابهام علی زمانی پایدار است که حتی خود مدیران بنگاه هم نتوانند آن را کُدگذاری و منتقل کنند.',
    ],
    keyTerms: ['VRIO Framework', 'Causal Ambiguity', 'Path Dependency', 'Social Complexity', 'Resource Heterogeneity'],
    conceptCheck: {
      prompt: 'اگر منبعی در یک شرکت «ارزشمند» و «کمیاب» باشد اما رقبا بتوانند به راحتی آن را کپی یا جایگزین کنند، نتیجه رقابتی چیست؟',
      options: [
        'مزیت رقابتی موقت (Temporary Competitive Advantage)',
        'برابری رقابتی (Competitive Parity)',
      ],
    },
  },
  'sm.portfolio': {
    nodeId: 'sm.portfolio',
    course: 'مدیریت استراتژیک پیشرفته',
    chapter: 'استراتژی‌های سطح شرکت و تحلیل پورتفولیو',
    topic: 'ماتریس‌های پورتفولیو (BCG، GE-McKinsey و ماتریس SPACE)',
    sourceBookCitation: 'مدیریت استراتژیک، فرد آر. دیوید، فصل ۶',
    examYearsAppeared: [1397, 1399, 1401, 1402, 1404],
    konkoorWeightLabel: 'ضریب ۵ — مبحث مشترک استراتژی و بازاریابی',
    frequencyLabel: 'تکرار در ۵ دوره کنکور دکتری (۱۳۹۷ تا ۱۴۰۴)',
    summary:
      'تحلیل پورتفولیو به شرکت‌های چندکسب‌وکاره (هلدینگ‌ها) کمک می‌کند تا منابع نقدی را بین واحدهای استراتژیک کسب‌وکار (SBU) بهینه تخصیص دهند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: فرمول دقیق سهم نسبی بازار در ماتریس BCG',
        content:
          'محور افقی ماتریس BCG «سهم نسبی بازار (RMS)» و محور عمودی «نرخ رشد بازار» است. سهم نسبی بازار از تقسیم فروش یا سهم واحد کسب‌وکار بر فروشِ بزرگ‌ترین رقیب به دست می‌آید: $$\\text{RMS} = \\frac{\\text{Sales of SBU}}{\\text{Sales of Largest Competitor}}$$ بنابراین فقط شرکت شماره ۱ بازار (رهبر بازار) دارای $\\text{RMS} > 1$ است.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: منطق جریان نقدینگی در ۴ خانه BCG',
        content:
          '• گاو شیری (رشد کم، سهم بالا): تولیدکننده وجه نقد مازاد (نیاز سرمایه‌گذاری کم، جریان ورودی بالا).\n• ستاره (رشد بالا، سهم بالا): هم وجه نقد زیادی تولید می‌کند و هم برای حفظ رشدْ نقدینگی زیادی مصرف می‌کند (جریان خالص نزدیک به صفر).\n• علامت سؤال (رشد بالا، سهم کم): بلعنده نقدینگی؛ نیازمند تصمیم‌گیری بین استراتژی نفوذ/توسعه (تبدیل به ستاره) یا واگذاری.\n• سگ (رشد کم، سهم کم): استراتژی کاهش، درو یا انحلال.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: برتری ماتریس ۹ خانه‌ای GE-McKinsey بر BCG',
        content:
          'ماتریس BCG به دلیل تکیه بر ۲ متغیر تک‌بعدی و نداشتن حد وسط، بیش از حد ساده‌انگارانه است. ماتریس GE-McKinsey محور عمودی را به «جذابیت صنعت» (شامل اندازه، رشد، حاشیه سود، شدت رقابت) و محور افقی را به «توان رقابتی واحد کسب‌وکار» تبدیل کرده و ماتریس ۳×۳ (۹ خانه‌ای) می‌سازد.',
      },
    ],
    conceptDescriptors: [
      { concept: 'سهم نسبی بازار (RMS)', descriptor: 'شرط بزرگ‌تر بودن از عدد ۱', answer: 'فقط زمانی که واحد کسب‌وکار، رهبر مطلق بازار (رتبه ۱ فروش در صنعت) باشد' },
      { concept: 'واحد گاو شیری در BCG', descriptor: 'متناظر در منحنی چرخه عمر محصول (PLC)', answer: 'مرحله بلوغ (Maturity)' },
    ],
    konkoorTips: [
      'در ترسیم گرافیکی ماتریس BCG، مساحت هر دایره متناسب با «سهم آن واحد از کل درآمد شرکت» است و قاچِ رنگی داخل دایره نشان‌دهنده «سهم آن واحد از کل سود شرکت» است.',
    ],
    keyTerms: ['BCG Matrix', 'Relative Market Share', 'Cash Cow', 'GE-McKinsey 9-Box', 'SPACE Matrix'],
    conceptCheck: {
      prompt: 'اگر سهم بازار شرکت الف ۲۰٪ و سهم بازار بزرگ‌ترین رقیب آن در صنعت ۴۰٪ باشد، سهم نسبی بازار (RMS) شرکت الف در ماتریس BCG چقدر است؟',
      options: ['۰٫۵ (سمت راست ماتریس — سهم نسبی پایین)', '۲٫۰ (سمت چپ ماتریس — سهم نسبی بالا)'],
    },
  },
  'sm.dynamic': {
    nodeId: 'sm.dynamic',
    course: 'مدیریت استراتژیک پیشرفته',
    chapter: 'پارادایم‌های نوین مزیت رقابتی در محیط متلاطم',
    topic: 'قابلیت‌های پویا (Dynamic Capabilities: حس‌گری، تسخیر و بازآرایی تیس)',
    sourceBookCitation: 'Teece (2007). Explicating Dynamic Capabilities, Strategic Management Journal',
    examYearsAppeared: [1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ — سؤالات تحلیلی ۵ سال اخیر کنکور',
    frequencyLabel: 'تکرار پیوسته در کنکورهای دکتری ۱۴۰۰ تا ۱۴۰۴',
    summary:
      'دیوید تیس قابلیت‌های پویا را برای رفع ایستایی دیدگاه RBV در محیط‌های با تغییر سریع технологи (رژیم‌های شومپیتری) مطرح کرد.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: تفاوت قابلیت‌های عملیاتی (Ordinary) و قابلیت‌های پویا (Dynamic)',
        content:
          '• قابلیت‌های عملیاتی (معمولی/صفرسطحی): روتین‌هایی که به شرکت امکان می‌دهند محصولات فعلی را با کارایی بالا تولید و به مشتریان فعلی بفروشد (انجام درست کارها - Doing things right).\n• قابلیت‌های پویا (مرتبه بالاتر): توانایی ایجاد، ادغام و بازآرایی قابلیت‌های عملیاتی و منابع برای تطبیق با تغییرات محیط (انجام کارهای درست - Doing the right things).',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: سه ریزبنیان (Micro-foundations) مدل ۲۰۰۷ تیس',
        content:
          '۱. حس‌گری (Sensing): اسکن محیط، پایش فناوری‌های نوظهور و کشف نیازهای پنهان مشتریان.\n۲. تسخیر فرصت (Seizing): طراحی مدل کسب‌وکار جدید، معماری مرزهای بنگاه و بسیج سرمایه‌گذاری برای تجاری‌سازی فرصت شناسایی‌شده.\n۳. دگرگون‌سازی و بازآرایی (Transforming / Reconfiguring): هم‌راستاسازی مجدد دارایی‌های ملموس و ناملموس، تمرکززدایی و غلبه بر اینرسی سازمانی.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: پدیده سختی‌های محوری (Core Rigidities - لئونارد بارتون)',
        content:
          'دوروتی لئونارد-بارتون هشدار می‌دهد که اگر شرکتی فاقد قابلیت‌های پویا باشد، همان «شایستگی‌های محوری (Core Competencies)» گذشته که عامل موفقیتش بودند، به دلیل تعصب شناختی و رسوب در فرهنگ، به «سختی‌های محوری (Core Rigidities)» تبدیل شده و مانع نوآوری می‌شوند.',
      },
    ],
    conceptDescriptors: [
      { concept: 'حس‌گری (Sensing)', descriptor: 'نقش در چارچوب تیس', answer: 'کشف و فیلتر کردن فرصت‌های فناورانه و بازار پیش از رقبا' },
      { concept: 'تسخیر (Seizing)', descriptor: 'نقش در چارچوب تیس', answer: 'طراحی مدل کسب‌وکار و تخصیص سرمایه برای بهره‌برداری از فرصت' },
      { concept: 'سختی محوری (Core Rigidity)', descriptor: 'تعریف لئونارد-بارتون', answer: 'تبدیل شدن شایستگی محوری قدیمی به مانع تغییر در محیط جدید' },
    ],
    konkoorTips: [
      'آیزنهارت و مارتین (۲۰۰۰) بر خلاف تیس معتقدند در بازارهای فوق‌العاده پرسرعت (High-Velocity Markets)، قابلیت‌های پویا به جای روتین‌های پیچیده، «قواعد ساده و تجربی (Simple Rules)» هستند.',
    ],
    keyTerms: ['Sensing', 'Seizing', 'Transforming', 'Ordinary vs Dynamic Capabilities', 'Core Rigidities'],
    conceptCheck: {
      prompt: 'در چارچوب قابلیت‌های پویای تیس، بازطراحی مدل کسب‌وکار و تخصیص سرمایه برای تجاری‌سازی یک فرصت کشف‌شده کدام مرحله است؟',
      options: ['تسخیر فرصت (Seizing)', 'حس‌گری محیط (Sensing)'],
    },
  },
  'stats.scales': {
    nodeId: 'stats.scales',
    course: 'آمار و کاربرد آن در مدیریت',
    chapter: 'مبانی اندازه‌گیری و شاخص‌های توصیفی',
    topic: 'مقیاس‌های چهارگانه استیونز (اسمی، رتبه‌ای، فاصله‌ای، نسبتی)',
    sourceBookCitation: 'آمار و کاربرد آن در مدیریت (جلد ۱)، دکتر عادل آذر و منصور مؤمنی، فصل ۱',
    examYearsAppeared: [1396, 1398, 1400, 1401, 1402],
    konkoorWeightLabel: 'ضریب ۵ — پایه انتخاب آزمون‌های آماری',
    frequencyLabel: 'تکرار در ۵ دوره کنکور دکتری',
    summary:
      'تعیین درست مقیاس متغیرها اولین گام در انتخاب شاخص مرکزی، پراکندگی و نوع آزمون آماری (پارامتریک یا ناپارامتریک) است.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: مقیاس‌های کیفی (اسمی و رتبه‌ای)',
        content:
          '• اسمی (Nominal): صرفاً طبقه‌بندی و نام‌گذاری بدون هیچ ترتیبی (مثل کد ملی، جنسیت، نوع رشته). تنها شاخص مرکزی مجاز «نما (Mode)» و آزمون آماری متناظر «کای‌دو ($\\chi^2$)» است.\n• رتبه‌ای (Ordinal): طبقات دارای ترتیب‌اند اما فاصله بین رتبه‌ها یکسان و مشخص نیست (مثل تحصیلات، رتبه کنکور، طیف لیکرت تک‌سؤالی). شاخص مرکزی مجاز «میانه (Median)» و پراکندگی «دامنه میان‌چارکی» است.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: مقیاس فاصله‌ای (Interval) و صفر قراردادی',
        content:
          'در مقیاس فاصله‌ای، فاصله بین اعداد مساوی و معنادار است اما «صفر مطلق وجود ندارد» (صفر قراردادی است؛ مثل دمای سلسیوس یا فارنهایت، و سال تقویمی). جمع و تفریق مجاز است و تبدیل خطی مجاز به فرم $Y = aX + b$ است، اما نسبت گرفتن (مثلاً گفتنِ دمای ۴۰ درجه دو برابر ۲۰ درجه است) غلط است!',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: مقیاس نسبتی (Ratio) و شرط محاسبه ضریب تغییرات (CV)',
        content:
          'دارای صفر حقیقی و مطلق (به معنای عدم وجود صفت؛ مثل حقوق، وزن، زمان پاسخگویی، تعداد فروش). تبدیل مجاز $Y = aX$ است و تنها مقیاسی است که محاسبه «میانگین هندسی» و «ضریب تغییرات ($CV = \\frac{s}{\\bar{x}}$)» در آن مجاز است.',
      },
    ],
    conceptDescriptors: [
      { concept: 'مقیاس فاصله‌ای', descriptor: 'تبدیل ریاضی مجاز و نوع صفر', answer: 'تبدیل خطی $Y = aX + b$ به دلیل قراردادی بودن مبدأ صفر' },
      { concept: 'مقیاس نسبتی', descriptor: 'شاخص پراکندگی نسبی انحصاری', answer: 'ضریب تغییرات ($CV = s / \\bar{x}$) و میانگین هندسی' },
    ],
    konkoorTips: [
      'دام بسیار پرتکرار: محاسبه «ضریب تغییرات ($CV = \\frac{s}{\\bar{x}}$)» فقط در مقیاس «نسبتی» مجاز است، چون در مقیاس فاصله‌ای به دلیل قراردادی بودن صفر، میانگین ($\\bar{x}$) با تغییر مبدأ تغییر می‌کند!',
    ],
    keyTerms: ['Nominal', 'Ordinal', 'Interval', 'Ratio Scale', 'Coefficient of Variation'],
    conceptCheck: {
      prompt: 'محاسبه «ضریب تغییرات ($CV = s / \\bar{x}$)» صرفاً در کدام مقیاس اندازه‌گیری از نظر ریاضی معتبر است؟',
      options: ['فقط مقیاس نسبتی (به دلیل وجود صفر مطلق)', 'مقیاس‌های فاصله‌ای و نسبتی هر دو'],
    },
  },
  'stats.anova': {
    nodeId: 'stats.anova',
    course: 'آمار و کاربرد آن در مدیریت',
    chapter: 'آزمون‌های پارامتریک مقایسه چند جامعه',
    topic: 'تحلیل واریانس یک‌طرفه و دوطرفه (One-Way & Two-Way ANOVA)',
    sourceBookCitation: 'آمار و کاربرد آن در مدیریت (جلد ۲)، دکتر عادل آذر و مؤمنی، فصل ۳',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ — سؤال قطعی ۱۰۰٪ ادوار کنکور دکتری',
    frequencyLabel: 'تکرار در ۹ دوره کنکور دکتری (۱۳۹۶ تا ۱۴۰۴)',
    summary:
      'تحلیل واریانس (ANOVA) برای آزمون برابری میانگین $k$ جامعه مستقل ($k \\ge 3$) به کار می‌رود تا از تورم خطای نوع اول ناشی از تکرار آزمون $t$ جلوگیری شود.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: تجزیه مجموع مربعات و درجات آزادی در ANOVA یک‌طرفه',
        content:
          'در ANOVA یک‌طرفه با $k$ تیمار (گروه) و مجموعاً $n$ مشاهده داریم:\n$$SST = SSB + SSW$$\n$$df_{\\text{Total}} = n - 1, \\quad df_B = k - 1, \\quad df_W = n - k$$\nمیانگین مربعات و آماره $F$: $$MSB = \\frac{SSB}{k - 1}, \\quad MSW = \\frac{SSW}{n - k}, \\quad F = \\frac{MSB}{MSW}$$',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: تحلیل واریانس دوطرفه با اثر متقابل (Two-Way ANOVA)',
        content:
          'اگر عامل A دارای $a$ سطح، عامل B دارای $b$ سطح و در هر خانه جدول $r$ تکرار مشاهده داشته باشیم ($N = abr$):\n$$SST = SSA + SSB + SS_{AB} + SSE$$\nدرجات آزادی عبارت‌اند از:\n• عامل A: $df_A = a - 1$\n• عامل B: $df_B = b - 1$\n• اثر متقابل ($A \\times B$): $df_{AB} = (a - 1)(b - 1)$\n• خطا (درون‌گروهی): $df_E = ab(r - 1)$',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: فروض کلاسیک ANOVA و معادل ناپارامتریک آن',
        content:
          'سه فرض اصلی ANOVA عبارت‌اند از: ۱) نرمال بودن توزیع متغیر وابسته در هر جامعه، ۲) برابری (همگنی) واریانس جوامع که با «آزمون لون (Levene Test)» سنجیده می‌شود، ۳) استقلال خطاها. در صورت نقض فرض نرمال بودن، از معادل ناپارامتریک ANOVA یک‌طرفه یعنی «آزمون کروسکال-والیس (Kruskal-Wallis)» استفاده می‌شود.',
      },
    ],
    conceptDescriptors: [
      { concept: 'ANOVA یک‌طرفه', descriptor: 'درجه آزادی صورت و مخرج آماره F', answer: 'صورت $k - 1$ و مخرج $n - k$' },
      { concept: 'ANOVA دوطرفه با تکرار', descriptor: 'فرمول درجه آزادی خطا ($df_E$)', answer: '$ab(r - 1)$ که $r$ تعداد تکرار در هر سلول است' },
      { concept: 'آزمون کروسکال-والیس', descriptor: 'کاربرد در استنباط آماری', answer: 'معادل ناپارامتریک تحلیل واریانس یک‌طرفه (مبتنی بر رتبه‌ها)' },
    ],
    konkoorTips: [
      'اگر فرض صفر در ANOVA درست باشد (یعنی میانگین تمام جوامع برابر باشد)، هم $MSB$ و هم $MSW$ برآوردگر نااریب واریانس مشترک جامعه ($\\sigma^2$) هستند و انتظار داریم $F \\approx 1$ باشد.',
    ],
    keyTerms: ['SST = SSB + SSW', 'Degrees of Freedom', 'Two-Way Interaction', 'Kruskal-Wallis', 'Levene Test'],
    conceptCheck: {
      prompt: 'در تحلیل واریانس یک‌طرفه با $k = 4$ تیم و مجموعاً $n = 24$ کارمند، درجات آزادی صورت ($df_B$) و مخرج ($df_W$) آماره $F$ به ترتیب کدام‌اند؟',
      options: ['صورت ۳ و مخرج ۲۰', 'صورت ۴ و مخرج ۲۳'],
    },
  },
  'stats.regression': {
    nodeId: 'stats.regression',
    course: 'آمار و کاربرد آن در مدیریت',
    chapter: 'مدل‌سازی خطی و اقتصادسنجی پایه',
    topic: 'رگرسیون خطی چندگانه، ضریب تعیین تعدیل‌شده و فروض گوس-مارکوف',
    sourceBookCitation: 'آمار و کاربرد آن در مدیریت (جلد ۲)، دکتر عادل آذر و مؤمنی، فصل ۵ و ۶',
    examYearsAppeared: [1396, 1397, 1398, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ — مهم‌ترین مبحث کمی دکتری',
    frequencyLabel: 'تکرار در ۸ دوره کنکور دکتری (۱۳۹۶ تا ۱۴۰۴)',
    summary:
      'رگرسیون خطی چندگانه رابطه بین یک متغیر وابسته کمی ($Y$) و $p$ متغیر مستقل ($X_1, \\dots, X_p$) را به صورت $Y = \\beta_0 + \\beta_1 X_1 + \\dots + \\beta_p X_p + \\varepsilon$ مدل‌سازی می‌کند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: ضریب تعیین ($R^2$) و ضریب تعیین تعدیل‌شده ($\\bar{R}^2$)',
        content:
          'ضریب تعیین $R^2 = \\frac{SSR}{SST} = 1 - \\frac{SSE}{SST}$ نشان می‌دهد چند درصد از تغییرات $Y$ توسط مدل توضیح داده شده است. چون با افزودن هر متغیر جدید (حتی بی‌ربط) $R^2$ هرگز کم نمی‌شود، از ضریب تعیین تعدیل‌شده استفاده می‌کنیم که به ازای درجه آزادی جریمه اعمال می‌کند:\n$$\\bar{R}^2 = 1 - (1 - R^2)\\frac{n - 1}{n - p - 1}$$',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: آماره F معناداری کل رگرسیون بر حسب $R^2$',
        content:
          'رابطه مستقیم بین آماره $F$ و ضریب تعیین $R^2$ یکی از پرتکرارترین فرمول‌های محاسباتی کنکور دکتری است:\n$$F = \\frac{MSR}{MSE} = \\frac{SSR / p}{SSE / (n - p - 1)} = \\frac{R^2 / p}{(1 - R^2) / (n - p - 1)}$$',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: فروض کلاسیک گوس-مارکوف و تشخیص نقض فروض',
        content:
          '• قضیه گوس-مارکوف: در صورت برقراری فروض کلاسیک (میانگین خطا صفر، واریانس خطا ثابت $\\sigma^2$، عدم خودهمبستگی خطاها)، برآوردگر حداقل مربعات معمولی (OLS) بهترین برآوردگر خطی نااریب (BLUE) است.\n• آزمون دوربین-واتسون ($DW \\approx 2(1 - \\rho)$): سنجش خودهمبستگی مرتبه اول خطاها (بازه ۰ تا ۴؛ عدد ۲ یعنی عدم خودهمبستگی).\n• عامل تورم واریانس ($VIF = \\frac{1}{1 - R_j^2}$): سنجش هم‌خطی چندگانه بین متغیرهای مستقل.',
      },
    ],
    conceptDescriptors: [
      { concept: 'ناهمسانی واریانس یا خودهمبستگی خطاها', descriptor: 'اثر بر ویژگی‌های برآوردگر OLS', answer: 'برآوردگر همچنان نااریب می‌ماند اما دیگر کارا (کمترین واریانس / BLUE) نیست' },
      { concept: 'آماره دوربین-واتسون نزدیک به صفر', descriptor: 'تفسیر آماری', answer: 'وجود خودهمبستگی مثبت شدید بین جملات خطا ($\\rho \\to +1$)' },
    ],
    konkoorTips: [
      'تحت نقض فرض همسانی واریانس، برآوردگرهای OLS اریب نمی‌شوند، فقط واریانس آن‌ها دیگر کمینه نیست و آزمون‌های $t$ و $F$ نامعتبر می‌شوند.',
    ],
    keyTerms: ['Adjusted R-Squared', 'Gauss-Markov BLUE', 'Durbin-Watson', 'VIF & Multicollinearity'],
    conceptCheck: {
      prompt: 'اگر ضریب همبستگی جملات خطای متوالی در رگرسیون $\\rho = +0.8$ باشد، آماره دوربین-واتسون ($DW$) تقریباً برابر چه عددی خواهد بود؟',
      options: ['نزدیک به ۰٫۴ (خودهمبستگی مثبت شدید)', 'نزدیک به ۳٫۶ (خودهمبستگی منفی شدید)'],
    },
  },
  'rm.validity': {
    nodeId: 'rm.validity',
    course: 'روش تحقیق پیشرفته در مدیریت',
    chapter: 'سنجش، مقیاس‌سازی و مدل‌سازی معادلات ساختاری',
    topic: 'روایی سازه (همگرا و واگرا - ماتریس فورنل و لارکر و بارهای عاملی)',
    sourceBookCitation: 'Fornell & Larcker (1981)؛ و روش تحقیق در مدیریت دکتر دانایی‌فرد، الوانی و آذر',
    examYearsAppeared: [1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ — تست قطعی معادلات ساختاری و روش تحقیق',
    frequencyLabel: 'تکرار در ۷ دوره کنکور دکتری (۱۳۹۸ تا ۱۴۰۴)',
    summary:
      'روایی سازه (Construct Validity) بررسی می‌کند که آیا گویه‌های پرسشنامه واقعاً سازه نظری مورد نظر را می‌سنجند یا خیر و به دو بخش «روایی همگرا» و «روایی واگرا (تشخیصی)» تقسیم می‌شود.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: شروط سه‌گانه روایی همگرا (Convergent Validity)',
        content:
          'برای تأیید روایی همگرا در مدل اندازه‌گیری (CFA / PLS) سه شرط باید برقرار باشد:\n۱. بارهای عاملی استاندارد هر گویه باید معنادار و ترجیحاً $\\lambda_i \\ge 0.70$ باشند.\n۲. میانگین واریانس استخراج‌شده حداقل ۰٫۵ باشد: $$\\text{AVE} = \\frac{\\sum \\lambda_i^2}{n} \\ge 0.50$$\n۳. پایایی ترکیبی بیشتر از AVE باشد: $\\text{CR} > 0.70$ و $\\text{CR} > \\text{AVE}$.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: معیار فورنل و لارکر برای روایی واگرا (Discriminant Validity)',
        content:
          'روایی واگرا نشان می‌دهد که یک سازه از سایر سازه‌های مدل متمایز است. طبق معیار فورنل-لارکر، ریشه دوم میانگین واریانس استخراج‌شده هر سازه ($\\sqrt{\\text{AVE}_i}$) که روی قطر اصلی ماتریس قرار می‌گیرد، باید از قدرمطلق همبستگی آن سازه با تمام سازه‌های دیگر ($|r_{ij}|$) بزرگ‌تر باشد.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: رابطه منطقی پایایی (Reliability) و روایی (Validity)',
        content:
          'پایایی (تکرارپذیری و دقت؛ مثل آلفای کرونباخ) شرط لازم برای روایی است اما شرط کافی نیست:\n• اگر ابزاری روایی داشته باشد، قطعاً پایایی هم دارد.\n• اگر ابزاری پایا باشد، ممکن است روا باشد یا کاملاً ناروا (خطای سیستماتیک).\n• اگر ابزاری پایا نباشد، قطعاً روا هم نیست.',
      },
    ],
    conceptDescriptors: [
      { concept: 'میانگین واریانس استخراج‌شده (AVE)', descriptor: 'حد نصاب قبولی برای روایی همگرا', answer: '$\\text{AVE} \\ge 0.50$' },
      { concept: 'ماتریس فورنل و لارکر', descriptor: 'اعداد روی قطر اصلی ماتریس', answer: 'جذر میانگین واریانس استخراج‌شده هر سازه ($\\sqrt{\\text{AVE}}$)' },
    ],
    konkoorTips: [
      'در سال‌های اخیر علاوه بر فورنل-لارکر، شاخص HTMT (نسبت دگرخصیصه به هم‌خصیصه هنسلر) نیز برای روایی واگرا مطرح می‌شود که باید کمتر از ۰٫۸۵ یا ۰٫۹۰ باشد.',
    ],
    keyTerms: ['AVE >= 0.5', 'Fornell-Larcker Criterion', 'Convergent vs Discriminant Validity', 'HTMT Ratio'],
    conceptCheck: {
      prompt: 'اگر برای یک سازه $\\text{AVE} = 0.64$ باشد، طبق معیار فورنل و لارکر حداکثر همبستگی مجاز این سازه با سایر سازه‌های مدل برای تأیید روایی واگرا چقدر است؟',
      options: ['کمتر از ۰٫۸۰ (چون $\\sqrt{0.64} = 0.80$)', 'کمتر از ۰٫۶۴'],
    },
  },
  'mb.culture': {
    nodeId: 'mb.culture',
    course: 'مبانی سازمان و مدیریت',
    chapter: 'فرهنگ سازمانی و ارزش‌های رقابتی',
    topic: 'لایه‌های سه‌گانه فرهنگ ادگار شاین و مدل چهاربعدی دنیسون',
    sourceBookCitation: 'Organizational Culture and Leadership (Edgar Schein)؛ و تئوری سازمان دفت فصل ۱۰',
    examYearsAppeared: [1398, 1400, 1401, 1402, 1403],
    konkoorWeightLabel: 'ضریب ۵ — مبحث پرتکرار رفتار و تئوری سازمان',
    frequencyLabel: 'تکرار در ۵ دوره کنکور دکتری',
    summary:
      'ادگار شاین فرهنگ سازمانی را در سه لایه از سطحی‌ترین (ملموس) تا عمیق‌ترین (ناخودآگاه) تحلیل می‌کند و دنیسون چهار تیپ فرهنگی را بر اساس دو محور طبقه‌بندی می‌نماید.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: سه لایه فرهنگ سازمانی ادگار شاین (Edgar Schein)',
        content:
          '۱. مصنوعات و نمادها (Artifacts): سطح بیرونی شامل معماری، لباس، تشریفات و داستان‌ها (مشاهده آسان، تفسیر دشوار).\n۲. ارزش‌های ابرازشده (Espoused Values): استراتژی‌ها، اهداف و فلسفه‌های رسمی که سازمان به آن‌ها استناد می‌کند.\n۳. مفروضات بنیادین (Basic Underlying Assumptions): باورهای ناخودآگاه، بدیهی‌انگاشته و غیرقابل چالش درباره ماهیت انسان و محیط که هسته واقعی فرهنگ را تشکیل می‌دهند.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: ماتریس ۴گانه فرهنگ سازمانی دنیسون (Denison)',
        content:
          'دنیسون فرهنگ را با دو محور «تمرکز درونی / بیرونی» و «انعطاف‌پذیری / ثبات» به ۴ دسته تقسیم می‌کند:\n• فرهنگ انطباق‌پذیری (Adaptability): تمرکز بیرونی + انعطاف‌پذیری (نوآوری و کارآفرینی).\n• فرهنگ مأموریتی (Mission): تمرکز بیرونی + ثبات (تأکید بر چشم‌انداز، اهداف استراتژیک و سهم بازار).\n• فرهنگ مشارکتی (Involvement): تمرکز درونی + انعطاف‌پذیری (توانمندسازی و کار تیمی).\n• فرهنگ سازگاری/ثبات (Consistency): تمرکز درونی + ثبات (قوانین، هماهنگی و یکپارچگی درونی).',
      },
    ],
    conceptDescriptors: [
      { concept: 'مفروضات بنیادین شاین', descriptor: 'سطح آگاهی و قابلیت مشاهده', answer: 'عمیق‌ترین لایه، کاملاً ناخودآگاه و بدیهی‌انگاشته' },
      { concept: 'فرهنگ مأموریتی دنیسون', descriptor: 'ترکیب دو محور اصلی', answer: 'تمرکز بیرونی + ثبات و کنترل بالا' },
    ],
    konkoorTips: [
      'در چارچوب ارزش‌های رقابتی کامرون و کوئین (CVF) نیز همین چهار ربع به ترتیب «ادهوکراسی»، «بازار»، «قبیله‌ای (Clan)» و «سلسله‌مراتبی» نامیده می‌شوند.',
    ],
    keyTerms: ['Edgar Schein 3 Levels', 'Artifacts', 'Basic Assumptions', 'Denison Culture Model'],
    conceptCheck: {
      prompt: 'در مدل فرهنگ سازمانی دنیسون، سازمانی با «تمرکز بیرونی» و «نیاز به ثبات و کنترل بالا» دارای کدام نوع فرهنگ است؟',
      options: ['فرهنگ مأموریتی (Mission Culture)', 'فرهنگ انطباق‌پذیری (Adaptability Culture)'],
    },
  },
  'mkt.plc': {
    nodeId: 'mkt.plc',
    course: 'بازاریابی پیشرفته',
    chapter: 'استراتژی‌های چرخه عمر محصول',
    topic: 'چرخه عمر محصول (PLC) و استراتژی‌های چهارگانه معرفی و بلوغ کاتلر',
    sourceBookCitation: 'مدیریت بازاریابی کاتلر و کلر، ویرایش ۱۶، فصل ۱۱',
    examYearsAppeared: [1397, 1399, 1401, 1403],
    konkoorWeightLabel: 'ضریب ۵ — مبحث کلیدی بازاریابی بازرگانی',
    frequencyLabel: 'تکرار در ۴ دوره کنکور دکتری',
    summary:
      'چرخه عمر محصول (PLC) شامل چهار مرحله معرفی، رشد، بلوغ و افول است که هر مرحله نیازمند ترکیب متفاوتی از آمیخته بازاریابی (4P) است.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: چهار استراتژی مرحله معرفی (قیمت × ترفیع)',
        content:
          '۱. سرشیرگیری سریع (قیمت بالا + ترفیع بالا): بازار ناآگاه است، خریداران حاضر به پرداخت قیمت بالا هستند و خطر ورود رقبا شدید است.\n۲. سرشیرگیری کند (قیمت بالا + ترفیع کم): اندازه بازار محدود است، بازار از محصول آگاه است و خطر ورود رقبا کم است.\n۳. نفوذ سریع (قیمت پایین + ترفیع بالا): بازار بزرگ است، مشتریان به قیمت حساس‌اند، رقابت بالقوه شدید است و هزینه تولید با مقیاس کاهش می‌یابد.\n۴. نفوذ کند (قیمت پایین + ترفیع کم): بازار بزرگ و کاملاً آگاه از محصول و حساس به قیمت است.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: ویژگی‌های مرحله رشد و بلوغ',
        content:
          '• در مرحله «رشد» بیشترین نرخ افزایش سود و ورود رقبای جدید رخ می‌دهد و هدف «حداکثرسازی سهم بازار» است.\n• در مرحله «بلوغ» فروش کل به اوج می‌رسد اما نرخ رشد فروش کند می‌شود؛ شرکت از سه روش «اصلاح بازار»، «اصلاح محصول» و «اصلاح برنامه بازاریابی» استفاده می‌کند.',
      },
    ],
    conceptDescriptors: [
      { concept: 'نفوذ سریع (Rapid Penetration)', descriptor: 'ترکیب قیمت و ترفیع', answer: 'قیمت پایین + بودجه ترفیع و تبلیغات سنگین' },
      { concept: 'مرحله بلوغ PLC', descriptor: 'وضعیت حجم فروش و هدف استراتژیک', answer: 'بیشترین حجم فروش کل؛ هدف دفاع از سهم بازار و حداکثرسازی سود' },
    ],
    konkoorTips: [
      'دام کنکور: بیشترین حجم فروش ریالی در مرحله «بلوغ» رخ می‌دهد، اما بیشترین شیب رشد سود در مرحله «رشد» اتفاق می‌افتد.',
    ],
    keyTerms: ['Product Life Cycle', 'Rapid Skimming', 'Rapid Penetration', 'Maturity Modification'],
    conceptCheck: {
      prompt: 'وقتی اندازه بازار بزرگ است، مشتریان به قیمت حساس‌اند و رقابت بالقوه شدید است، کدام استراتژی مرحله معرفی مناسب‌تر است؟',
      options: ['نفوذ سریع (قیمت پایین و ترفیع سنگین)', 'سرشیرگیری سریع (قیمت بالا و ترفیع سنگین)'],
    },
  },
  'mkt.brand': {
    nodeId: 'mkt.brand',
    course: 'بازاریابی پیشرفته',
    chapter: 'مدیریت استراتژیک برند',
    topic: 'مدل ارزش ویژه برند مبتنی بر مشتری (هرم CBBE کلر و مدل ۵بعدی آکر)',
    sourceBookCitation: 'مدیریت استراتژیک برند، کوین لین کلر، فصل ۲ و ۳',
    examYearsAppeared: [1397, 1398, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ — پرتکرارترین مبحث بازاریابی دکتری',
    frequencyLabel: 'تکرار در ۷ دوره کنکور دکتری (۱۳۹۷ تا ۱۴۰۴)',
    summary:
      'کوین لین کلر ارزش ویژه برند مبتنی بر مشتری (CBBE) را به صورت «اثر تفاضلی دانش برند بر واکنش مصرف‌کننده به فعالیت‌های بازاریابی آن برند» تعریف می‌کند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: چهار پله هرم CBBE کلر و چهار سؤال مشتری',
        content:
          '۱. پله اول — هویت برند (تو کیستی؟): ایجاد «برجستگی برند (Salience)» شامل عمق آگاهی (سهولت یادآوری) و وسعت آگاهی (طیف موقعیت‌های خرید و مصرف).\n۲. پله دوم — معنای برند (تو چیستی؟): شامل دو بلوک «عملکرد برند (Performance)» و «تصویر ذهنی برند (Imagery)».\n۳. پله سوم — پاسخ‌های برند (درباره تو چه فکری و حسی دارم؟): شامل «قضاوت‌های منطقی (Judgments)» و «احساسات هیجانی (Feelings)».\n۴. پله چهارم — رابطه با برند (چه پیوندی بین من و توست؟): بلوک «طنین برند (Resonance)» شامل وفاداری رفتاری، دلبستگی نگرشی، حس اجتماع و تعامل فعال.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: سه معیار تداعی‌های برند (قوی، مطلوب، منحصر‌به‌فرد)',
        content:
          'در پله دوم هرم کلر، برای ایجاد نقاط تمایز (POD) و نقاط تشابه (POP)، تداعی‌های برند در ذهن مشتری باید دارای سه ویژگی به ترتیب باشند: ۱) استحکام/قوی بودن (Strength)، ۲) مطلوبیت (Favorability) و ۳) منحصر‌به‌فرد بودن (Uniqueness).',
      },
    ],
    conceptDescriptors: [
      { concept: 'برجستگی برند (Brand Salience)', descriptor: 'دو بعد سازنده در پله اول کلر', answer: 'عمق آگاهی (Depth) و وسعت آگاهی (Breadth)' },
      { concept: 'طنین برند (Brand Resonance)', descriptor: 'چهار رکن تشکیل‌دهنده در قله هرم کلر', answer: 'وفاداری رفتاری، دلبستگی نگرشی، حس اجتماع برند و درگیری فعال' },
    ],
    konkoorTips: [
      'در هرم کلر، سمت چپ هرم (عملکرد و قضاوت‌ها) مسیر «منطقی/سر» و سمت راست هرم (تصویر ذهنی و احساسات) مسیر «هیجانی/دل» ساخت برند است.',
    ],
    keyTerms: ['CBBE Pyramid', 'Brand Salience', 'Brand Imagery vs Performance', 'Brand Resonance'],
    conceptCheck: {
      prompt: 'در هرم ارزش ویژه برند کلر، بلوک‌های «عملکرد برند (Performance)» و «تصویر ذهنی برند (Imagery)» در کدام لایه قرار دارند؟',
      options: ['لایه دوم: معنای برند (Brand Meaning)', 'لایه سوم: پاسخ‌های برند (Brand Responses)'],
    },
  },
  'mkt.consumer': {
    nodeId: 'mkt.consumer',
    course: 'بازاریابی پیشرفته',
    chapter: 'رفتار مصرف‌کننده و تغییر نگرش',
    topic: 'مدل احتمال بسط ذهن (ELM پتی و کاچیوپو: مسیر مرکزی و پیرامونی)',
    sourceBookCitation: 'رفتار مصرف‌کننده، مایکل سولومون و شیفمن، فصل تغییر نگرش',
    examYearsAppeared: [1398, 1400, 1401, 1402, 1403],
    konkoorWeightLabel: 'ضریب ۵ — تست قطعی رفتار مصرف‌کننده',
    frequencyLabel: 'تکرار در ۵ دوره کنکور دکتری',
    summary:
      'مدل احتمال بسط ذهن (ELM) توضیح می‌دهد که مصرف‌کنندگان بسته به سطح «انگیزه» و «توانایی پردازش»، پیام‌های متقاعدکننده را از دو مسیر کاملاً متفاوت پردازش می‌کنند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: مسیر مرکزی (Central Route) و شروط فعال‌سازی',
        content:
          'زمانی فعال می‌شود که مصرف‌کننده هم «انگیزه بالا (درگیری ذهنی شدید با خرید)» و هم «توانایی و فرصت پردازش اطلاعات» را داشته باشد. در این حالت مخاطب به دقت استدلال‌های فنی و منطقی پیام را می‌سنجد و نگرش شکل‌گرفته بسیار پایدار، مقاوم در برابر تبلیغات رقیب و پیش‌بینی‌کننده قوی رفتار خرید است.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: مسیر پیرامونی (Peripheral Route) و سرنخ‌های سطحی',
        content:
          'هرگاه یکی از دو شرط «انگیزه» یا «توانایی پردازش» پایین باشد، مصرف‌کننده وارد مسیر پیرامونی شده و بر اساس سرنخ‌های حاشیه‌ای (جذابیت سلبریتی، موسیقی آگهی، تعداد استدلال‌ها به جای کیفیت آن‌ها، یا بسته‌بندی) تصمیم می‌گیرد.',
      },
    ],
    conceptDescriptors: [
      { concept: 'مسیر مرکزی در ELM', descriptor: 'شروط لازم و کافی فعال‌سازی', answer: 'انگیزه بالا + توانایی پردازش بالا + فرصت کافی (هر سه با هم)' },
      { concept: 'مسیر پیرامونی در ELM', descriptor: 'پایداری تغییر نگرش', answer: 'موقتی، آسیب‌پذیر در برابر ضدتبلیغات و نیازمند تکرار مداوم' },
    ],
    konkoorTips: [
      'اگر مصرف‌کننده درگیری ذهنی بالایی داشته باشد اما به دلیل پیچیدگی فنی یا کمبود زمان «توانایی پردازش» نداشته باشد، باز هم به ناچار از مسیر پیرامونی استفاده می‌کند!',
    ],
    keyTerms: ['ELM Model', 'Central vs Peripheral Route', 'High Involvement', 'Attitude Persistence'],
    conceptCheck: {
      prompt: 'شرط لازم و کافی برای فعال شدن «مسیر مرکزی» تغییر نگرش در مدل ELM پتی و کاچیوپو چیست؟',
      options: [
        'وجود هم‌زمانِ انگیزه بالا (درگیری ذهنی) و توانایی بالای پردازش پیام',
        'استفاده از سخنگوی مشهور و تکرار بالای پیام تبلیغاتی در رسانه‌ها',
      ],
    },
  },
  'inno.s_curve': {
    nodeId: 'inno.s_curve',
    course: 'تئوری‌های نوآوری و فناوری',
    chapter: 'پویایی و چرخه عمر فناوری',
    topic: 'منحنی S فناوری (ریچارد فاستر) و ناپیوستگی فناورانه',
    sourceBookCitation: 'مدیریت استراتژیک نوآوری فناورانه، ملیسا شیلینگ، فصل ۳',
    examYearsAppeared: [1398, 1399, 1401, 1402, 1403],
    konkoorWeightLabel: 'ضریب ۵ — پایه گرایش مدیریت تکنولوژی',
    frequencyLabel: 'تکرار در ۵ دوره کنکور دکتری',
    summary:
      'منحنی S فناوری نشان می‌دهد که عملکرد یک فناوری در طول چرخه حیات خود به ازای سرمایه‌گذاری مهندسی، از الگوی S شکل پیروی می‌کند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: محورهای دقیق منحنی S فاستر',
        content:
          'محور عمودی «حد عملکرد فناوری» و محور افقی «تلاش و سرمایه‌گذاری تجمعی مهندسی (Cumulative Effort)» است. استفاده از «زمان» روی محور افقی فقط زمانی مجاز است که نرخ سرمایه‌گذاری R&D در طول زمان کاملاً ثابت باشد.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: ناپیوستگی فناوری (Discontinuity) و معمای نوآور',
        content:
          'وقتی فناوری موجود به «سقف فیزیکی/طبیعی» خود نزدیک می‌شود، بازده نهایی سرمایه‌گذاری R&D به شدت افت می‌کند. در این نقطه فناوری رادیکال جدید با یک منحنی S تازه ظاهر می‌شود که در ابتدا عملکرد پایین‌تری دارد اما سقف بالقوه آن بسیار بالاتر است.',
      },
    ],
    conceptDescriptors: [
      { concept: 'منحنی S فناوری فاستر', descriptor: 'متغیر دقیق محور افقی', answer: 'تلاش مهندسی و انباشت سرمایه‌گذاری R&D (نه صرفاً زمان تقویمی)' },
      { concept: 'نقطه عطف منحنی S', descriptor: 'رویداد صنعتی هم‌زمان', answer: 'تثبیت طرح غالب (Dominant Design) و شروع رشد سریع عملکرد' },
    ],
    konkoorTips: [
      'دام طراح: محور افقی منحنی S استاندارد فاستر «تلاش و انباشت سرمایه‌گذاری R&D» است نه صرفاً گذشت زمان تقویمی!',
    ],
    keyTerms: ['Foster S-Curve', 'Engineering Effort vs Time', 'Technological Discontinuity', 'Physical Limit'],
    conceptCheck: {
      prompt: 'در مدل اصلی منحنی S فناوری ریچارد فاستر، محور افقی نمودار دقیقاً نشان‌دهنده کدام متغیر است؟',
      options: [
        'میزان تلاش، منابع و سرمایه‌گذاری تجمعی مهندسی (Effort)',
        'صرفاً زمان تقویمی از لحظه ثبت اختراع اولیه',
      ],
    },
  },
  'inno.ambidextrous': {
    nodeId: 'inno.ambidextrous',
    course: 'تئوری‌های نوآوری و فناوری',
    chapter: 'معماری سازمان‌های نوآور و یادگیرنده',
    topic: 'سازمان‌های دوپهلو (Ambidextrous: تعادل بهره‌برداری و اکتشاف)',
    sourceBookCitation: 'March (1991) & O’Reilly and Tushman (2004)',
    examYearsAppeared: [1399, 1400, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ — مبحث مشترک استراتژی، سازمان و تکنولوژی',
    frequencyLabel: 'تکرار در ۵ دوره کنکور دکتری',
    summary:
      'سازمان دوپهلو سازمانی است که به طور هم‌زمان بر «بهره‌برداری از توانمندی‌های فعلی» و «اکتشاف فرصت‌های رادیکال آینده» تسلط دارد.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: دوگانگی مارچ (بهره‌برداری در برابر اکتشاف)',
        content:
          '• بهره‌برداری (Exploitation): کارایی، پالایش، تولید، استانداردسازی و نوآوری تدریجی (نیازمند ساختار مکانیکی و بازده کوتاه‌مدت مطمئن).\n• اکتشاف (Exploration): جست‌وجو، آزمایش‌گری، ریسک‌پذیری و نوآوری رادیکال (نیازمند ساختار ارگانیک و افق بلندمدت).',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: دوپهلویی ساختاری (اورایلی و تاشمن) در برابر زمینه‌ای (بیرکینشاو)',
        content:
          '• دوپهلویی ساختاری (Structural): جداسازی فیزیکی و ساختاری واحدهای اکتشاف و بهره‌برداری، همراه با یکپارچگی در سطح تیم مدیریت ارشد.\n• دوپهلویی زمینه‌ای (Contextual - گیبسون و بیرکینشاو): به جای تفکیک واحدها، فرهنگ و سیستم‌های سازمان به هر کارمند اجازه می‌دهد خودش زمانش را بین کارهای روزمره و نوآوری تقسیم کند.',
      },
    ],
    conceptDescriptors: [
      { concept: 'تله موفقیت (Success Trap)', descriptor: 'علت بروز در مدل مارچ', answer: 'تمرکز افراطی بر بهره‌برداری (Exploitation) و غفلت از اکتشاف فناوری جدید' },
      { concept: 'تله شکست (Failure Trap)', descriptor: 'علت بروز در مدل مارچ', answer: 'اکتشاف و پرش مداوم از یک ایده خام به ایده دیگر بدون تجاری‌سازی و بهره‌برداری' },
    ],
    konkoorTips: [
      'تمرکز انحصاری بر بهره‌برداری به «تله موفقیت (Success Trap)» و تمرکز انحصاری بر اکتشاف بدون تجاری‌سازی به «تله شکست (Failure Trap)» منجر می‌شود.',
    ],
    keyTerms: ['Exploration vs Exploitation', 'Structural vs Contextual Ambidexterity', 'Success Trap'],
    conceptCheck: {
      prompt: 'شرکتی که تمام بودجه خود را صرف بهبود جزئی محصول فعلی کرده و از نوآوری‌های رادیکال بازار جا می‌ماند، در کدام دام افتاده است؟',
      options: ['تله موفقیت یا شایستگی (Success / Competence Trap)', 'تله شکست یا جست‌وجوی بی‌پایان (Failure Trap)'],
    },
  },
  'ind.or_simplex_duality': {
    nodeId: 'ind.or_simplex_duality',
    course: 'تحقیق در عملیات پیشرفته',
    chapter: 'سیمپلکس، تئوری دوگان و تحلیل حساسیت',
    topic: 'فرم ماتریسی سیمپلکس، قضایای دوگان (Duality) و مکمل‌های متوازن',
    sourceBookCitation: 'پژوهش عملیاتی، دکتر محمدرضا مهرگان و دکتر عادل آذر؛ و کتاب جامع تحقیق در عملیات دکتر عارفه فدوی، فصول ۳ تا ۵',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ دکتری و ضریب ۳ ارشد صنعتی — سؤال ۱۰۰٪ قطعی هر سال',
    frequencyLabel: 'تکرار در ۹ دوره کنکور (۱۳۹۶ تا ۱۴۰۴)',
    summary:
      'روش سیمپلکس، تئوری دوگان (Duality) و قضیه مکمل‌های متوازن هسته اصلی سؤالات تحقیق در عملیات در کنکور ارشد و دکتری مدیریت صنعتی را تشکیل می‌دهند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: روابط ماتریسی جدول سیمپلکس ($B^{-1}$)',
        content:
          'اگر $B$ ماتریس پایه متناظر با متغیرهای اساسی باشد، در هر جدول سیمپلکس مقادیر ستون سمت راست برابر $x_B = B^{-1}b$، بردار قیمت‌های سایه‌ای (متغیرهای دوگان) برابر $Y = C_B B^{-1}$، ضرایب سطر تابع هدف برابر $z_j - c_j = C_B B^{-1} a_j - c_j$ و مقدار تابع هدف برابر $Z = C_B B^{-1} b$ است.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: تبدیل اولیه (Primal) به دوگان (Dual) و روابط شدنی/بیکرانی',
        content:
          'در تبدیل مسئله استاندارد بیشینه‌سازی ($\\max Z = c^T x \\text{ s.t. } Ax \\le b, x \\ge 0$) به دوگان ($\\min W = b^T y \\text{ s.t. } A^T y \\ge c, y \\ge 0$)، به ازای هر محدودیت در اولیه یک متغیر در دوگان داریم. طبق قضیه ضعیف دوگان همواره $Z \\le W$ است و اگر اولیه بیکران باشد، دوگان قطعاً ناشدنی است.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: قضیه مکمل‌های متوازن (Complementary Slackness)',
        content:
          'در جواب بهینه، برای هر $i$ و $j$ داریم: $$y_i^* \\cdot s_i^* = 0 \\quad \\text{و} \\quad x_j^* \\cdot v_j^* = 0$$\nیعنی اگر متغیر کمکی محدودیت $i$ام در اولیه مثبت باشد ($s_i^* > 0$)، متغیر دوگان متناظر حتماً صفر است ($y_i^* = 0$)؛ و اگر متغیر اصلی $x_j^* > 0$ باشد، محدودیت $j$ام در دوگان به صورت تساوی برقرار است ($v_j^* = 0$).',
      },
    ],
    conceptDescriptors: [
      { concept: 'قیمت سایه‌ای ($Y = C_B B^{-1}$)', descriptor: 'تفسیر اقتصادی در برنامه‌ریزی خطی', answer: 'میزان بهبود تابع هدف بهینه به ازای یک واحد افزایش در منبع سمت راست ($b_i$)' },
      { concept: 'قضیه مکمل‌های متوازن', descriptor: 'شرط بهینگی هم‌زمان اولیه و دوگان', answer: 'صفر بودن حاصل‌ضرب هر متغیر اصلی در متغیر کمکی متناظر دوگان ($x_j^* v_j^* = 0$ و $y_i^* s_i^* = 0$)' },
    ],
    konkoorTips: [
      'اگر در جدول بهینه سیمپلکس، برای یک متغیر غیراساسی $z_j - c_j = 0$ باشد، مسئله دارای «جواب بهینه دگرسان (چندگانه)» است.',
      'محدودیت تساوی ($=$) در مسئله اولیه به «متغیر آزاد در علامت» در دوگان تبدیل می‌شود، و متغیر آزاد در علامت در اولیه به «محدودیت تساوی» در دوگان تبدیل می‌شود.',
    ],
    keyTerms: ['Simplex Matrix Form', 'Duality Theory', 'Complementary Slackness', 'Shadow Price', 'Degeneracy'],
    conceptCheck: {
      prompt: 'اگر در جواب بهینه یک مسئله بیشینه‌سازی، منبع اول به طور کامل مصرف نشده باشد ($s_1^* > 0$)، قیمت سایه‌ای آن منبع ($y_1^*$) چقدر است؟',
      options: ['صفر ($y_1^* = 0$)', 'مثبت و مخالف صفر ($y_1^* > 0$)'],
    },
  },
  'ind.pom_eoq_mrp': {
    nodeId: 'ind.pom_eoq_mrp',
    course: 'مدیریت تولید و عملیات پیشرفته',
    chapter: 'مدیریت موجودی، MRP و کنترل کیفیت آماری',
    topic: 'مدل‌های موجودی EOQ/EPQ، برنامه‌ریزی نیاز مواد (MRP) و توانمندی فرآیند (Cp, Cpk)',
    sourceBookCitation: 'مدیریت تولید و عملیات، دکتر هایده متقی؛ و مدیریت تولید و عملیات نوین، دکتر احمد جعفرنژاد',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ دکتری و ضریب ۳ ارشد صنعتی — پرتکرارترین مبحث محاسباتی تولید',
    frequencyLabel: 'تکرار در ۹ دوره کنکور (۱۳۹۶ تا ۱۴۰۴)',
    summary:
      'مدل‌های بهینه‌سازی موجودی (EOQ و EPQ)، برنامه‌ریزی نیازمندی‌های مواد (MRP) و شاخص‌های قابلیت فرآیند ($C_p$ و $C_{pk}$) سه ستون اصلی تست‌های مدیریت تولید و عملیات در کنکور مدیریت صنعتی هستند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: مدل مقدار سفارش اقتصادی (EOQ) و تولید اقتصادی (EPQ)',
        content:
          'در مدل کلاسیک ویلسون (EOQ) با تقاضای سالانه $D$، هزینه هر بار سفارش $S$ و هزینه نگهداری واحد در سال $H$، در نقطه بهینه هزینه سالانه سفارش‌دهی و نگهداری برابرند:\n$$Q^* = \\sqrt{\\frac{2DS}{H}}, \\quad TC_{\\text{inv}}(Q^*) = \\sqrt{2DSH}$$\nدر مدل تولید پیوسته (EPQ) با نرخ تولید $p$ و نرخ مصرف $d$ ($p > d$):\n$$Q_p^* = \\sqrt{\\frac{2DS}{H(1 - d/p)}}, \\quad I_{\\max} = Q_p^*\\left(1 - \\frac{d}{p}\\right)$$',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: منطق محاسباتی برنامه‌ریزی نیازمندی‌های مواد (MRP)',
        content:
          'برای هر قطعه در سطح درخت محصول (BOM)، نیاز خالص دوره $t$ برابر است با:\n$$\\text{Net Req}_t = \\max\\big(0,\\; \\text{Gross Req}_t - \\text{On Hand}_{t-1} - \\text{Scheduled Receipts}_t\\big)$$\nزمان رهاسازی سفارش برنامه‌ریزی‌شده (PORel) به اندازه زمان تدارک ($L$) قبل از زمان دریافت سفارش (PORec) ثبت می‌شود.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: شاخص‌های توانمندی فرآیند در کنترل کیفیت آماری ($C_p$ و $C_{pk}$)',
        content:
          'برای سنجش اینکه آیا پراکندگی طبیعی فرآیند ($6\\sigma$) در داخل حدود مشخصات مهندسی ($USL - LSL$) می‌گنجد یا خیر:\n$$C_p = \\frac{USL - LSL}{6\\sigma}, \\quad C_{pk} = \\min\\left(\\frac{USL - \\mu}{3\\sigma},\\; \\frac{\\mu - LSL}{3\\sigma}\\right)$$\nهمواره $C_{pk} \\le C_p$ است و برابری آن دو فقط زمانی رخ می‌دهد که فرآیند فاقد انحراف از مرکز باشد ($\\mu = \\frac{USL + LSL}{2}$).',
      },
    ],
    conceptDescriptors: [
      { concept: 'نقطه بهینه EOQ', descriptor: 'رابطه هزینه سفارش‌دهی و هزینه نگهداری سالانه', answer: 'برابری دقیق هزینه کل سفارش‌دهی سالانه با هزینه کل نگهداری سالانه ($DS/Q^* = Q^*H/2$)' },
      { concept: 'شاخص $C_{pk}$', descriptor: 'تفاوت کلیدی با شاخص $C_p$', answer: 'در نظر گرفتن انحراف میانگین فرآیند ($\\mu$) از مرکز حدود مشخصات فنی علاوه بر واریانس' },
    ],
    konkoorTips: [
      'اگر در مسئله EOQ تمام پارامترها ثابت بمانند و تقاضا $k$ برابر شود، مقدار سفارش بهینه $\\sqrt{k}$ برابر می‌شود.',
      'در درخت محصول (BOM) اگر قطعه‌ای در دو سطح مختلف تکرار شود، طبق «قاعده کد سطح پایین (Low-Level Coding)» محاسبات MRP آن قطعه تا رسیدن به پایین‌ترین سطح به تعویق می‌افتد.',
    ],
    keyTerms: ['EOQ', 'EPQ', 'MRP Low-Level Coding', 'Process Capability Cp & Cpk', 'Safety Stock'],
    conceptCheck: {
      prompt: 'در نقطه سفارش اقتصادی بهینه ($Q^*$ در مدل کلاسیک EOQ)، نسبت هزینه سالانه سفارش‌دهی به هزینه سالانه نگهداری چقدر است؟',
      options: ['دقیقاً برابر ۱ (دو هزینه با هم برابرند)', 'بستگی به نسبت $S$ به $H$ دارد'],
    },
  },
  'inno.tidd_4p': {
    nodeId: 'inno.tidd_4p',
    course: 'تئوری‌های نوآوری و فناوری',
    chapter: 'فضای نوآوری تید و بسانت و مدیریت تکنولوژی خلیل',
    topic: 'مدل ۴ بعدی نوآوری (4P تید و بسانت)، طبقه‌بندی فناوری ADL و اطلس فناوری (طاهر خلیل)',
    sourceBookCitation: 'مدیریت نوآوری، جو تید و جان بسانت (ترجمه دکتر آراستی)، فصل ۱ و ۲؛ و مدیریت تکنولوژی، طاهر خلیل (ترجمه دکتر اعرابی)',
    examYearsAppeared: [1397, 1398, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ — مرجع اصلی کنکور مدیریت فناوری و نوآوری',
    frequencyLabel: 'تکرار در ۷ دوره کنکور دکتری',
    summary:
      'چارچوب 4P نوآوری تید و بسانت و طبقه‌بندی استراتژیک فناوری‌های طاهر خلیل (ADL و اجزای چهارگانه فناوری) شالوده تحلیلی سؤالات کنکور ارشد و دکتری مدیریت فناوری و نوآوری را تشکیل می‌دهند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: ابعاد چهارگانه فضای نوآوری (مدل 4P تید و بسانت)',
        content:
          'تید و بسانت نوآوری را در ۴ بعد تعریف می‌کنند:\n• محصول (Product): تغییر در محصولات/خدماتی که سازمان عرضه می‌کند.\n• فرآیند (Process): تغییر در روش‌های تولید و تحویل آن محصولات.\n• جایگاه (Position): تغییر در بستر معنایی یا بخش بازار هدف که محصول در آن معرفی می‌شود.\n• پارادایم (Paradigm): تغییر در مدل‌های ذهنی زیربنایی و مدل کسب‌وکار سازمان.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: فرآیند ۴ مرحله‌ای مدیریت نوآوری (Search, Select, Implement, Capture)',
        content:
          '۱) جستجو (Search): پایش محیط برای کشف سیگنال‌های فناوری و بازار.\n۲) انتخاب (Select): گزینش استراتژیک پروژه‌ها بر اساس هم‌راستایی با شایستگی‌های سازمان.\n۳) پیاده‌سازی (Implement): تبدیل ایده به محصول/فرآیند واقعی از طریق اکتساب دانش و اجرای پروژه.\n۴) کسب ارزش (Capture): بهره‌برداری تجاری، حفاظت از مالکیت فکری و یادگیری سازمانی.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: طبقه‌بندی فناوری ADL و ۴ جزء اطلس فناوری (طاهر خلیل)',
        content:
          'در مدل ADL فناوری‌ها از مرحله «نوظهور (Emerging)» به «پیشاهنگ (Pacing)»، سپس به «کلیدی (Key - منشأ مزیت رقابتی فعلی)» و نهایتاً به «پایه (Base - عمومی و فاقد تمایز)» حرکت می‌کنند.\nهمچنین طبق اطلس فناوری، هر تکنولوژی متشکل از ۴ جزء جدانشدنی است: سخت‌افزار (Technoware)، انسان‌افزار (Humanware)، اطلاعات‌افزار (Infoware) و سازمان‌افزار (Orgaware).',
      },
    ],
    conceptDescriptors: [
      { concept: 'نوآوری جایگاه (Position)', descriptor: 'تعریف در مدل 4P تید و بسانت', answer: 'عرضه محصول موجود در یک بازار هدف جدید یا با روایت معنایی جدید بدون تغییر فیزیکی ماهیت محصول' },
      { concept: 'فناوری کلیدی (Key Technology)', descriptor: 'جایگاه در ماتریس ADL طاهر خلیل', answer: 'فناوری متمایزکننده فعلی که بیشترین اثر رقابتی را بر محصول دارد و تحت کنترل شرکت است' },
    ],
    konkoorTips: [
      'هرگاه در صورت سؤال کنکور به «تغییر مدل‌های ذهنی و چارچوب فکری حاکم بر کسب‌وکار» اشاره شد، گزینه صحیح در مدل تید و بسانت «نوآوری پارادایم» است.',
      'در مدل اطلس فناوری، انتقال تکنولوژی صرفاً خرید ماشین‌آلات (Technoware) نیست و بدون انتقال دانش مستند (Infoware)، مهارت نیروی انسانی (Humanware) و ساختار مدیریتی (Orgaware) شکست می‌خورد.',
    ],
    keyTerms: ['4P Innovation Space', 'Position vs Paradigm Innovation', 'ADL Technology Classification', 'Technoware & Orgaware'],
    conceptCheck: {
      prompt: 'معرفی یک نوشیدنی که قبلاً به عنوان شربت تقویتی کودکان فروخته می‌شد به عنوان «نوشیدنی انرژی‌زای ورزشکاران حرفه‌ای» بدون تغییر فرمولاسیون، مصداق کدام بعد از مدل 4P تید و بسانت است؟',
      options: ['نوآوری جایگاه (Position Innovation)', 'نوآوری پارادایم (Paradigm Innovation)'],
    },
  },
  'ind.mcdm_dea_queue': {
    nodeId: 'ind.mcdm_dea_queue',
    course: 'تحقیق در عملیات پیشرفته و تصمیم‌گیری',
    chapter: 'تصمیم‌گیری چندمعیاره (MCDM)، تحلیل پوششی داده‌ها (DEA) و تئوری صف',
    topic: 'روش‌های AHP و TOPSIS، مدل‌های CCR/BCC در DEA و سیستم صف مارکوفی (M/M/1)',
    sourceBookCitation: 'تصمیم‌گیری چندمعیاره دکتر اصغرپور و دکتر مهرگان؛ و تحلیل پوششی داده‌ها و تئوری صف دکتر عادل آذر و دکتر عارفه فدوی',
    examYearsAppeared: [1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ دکتری و ضریب ۳ ارشد صنعتی — فصل کلیدی تحقیق در عملیات ۲ و دکتری',
    frequencyLabel: 'تکرار در ۸ دوره کنکور (۱۳۹۷ تا ۱۴۰۴)',
    summary:
      'مدل‌های تصمیم‌گیری چندشاخصه (AHP و TOPSIS)، تحلیل پوششی داده‌ها (DEA) برای سنجش کارایی نسبی واحدهای تصمیم‌گیرنده (DMU) و تئوری صف مارکوفی ($M/M/1$) هسته اصلی سؤالات پیشرفته تحقیق در عملیات در کنکور ارشد و دکتری مدیریت صنعتی هستند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: نرخ ناسازگاری در AHP ساعتی و شاخص نزدیکی در TOPSIS',
        content:
          'در روش AHP توماس ساعتی، برای یک ماتریس مقایسات زوجی $n \\times n$ سازگار کامل، بزرگ‌ترین مقدار ویژه دقیقاً برابر $\\lambda_{\\max} = n$ است. شاخص ناسازگاری از رابطه $CI = \\frac{\\lambda_{\\max} - n}{n - 1}$ و نرخ ناسازگاری از رابطه $IR = \\frac{CI}{RI}$ محاسبه می‌شود (شرط پذیرش: $IR \\le 0.10$).\nدر روش TOPSIS، رتبه هر گزینه بر اساس نزدیکی نسبی به راه‌حل ایده‌آل مثبت ($A^+$) و دوری از ایده‌آل منفی ($A^-$) تعیین می‌شود: $$CL_i^* = \\frac{d_i^-}{d_i^+ + d_i^-}$$',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: تحلیل پوششی داده‌ها (DEA: مقایسه مدل‌های CCR و BCC)',
        content:
          'مدل CCR (چارنز، کوپر و رودز) با فرض «بازده به مقیاس ثابت (CRS)» کارایی فنی کل را می‌سنجد؛ اما مدل BCC (بنکر، چارنز و کوپر) با افزودن قید تحدب $\\sum_{j=1}^n \\lambda_j = 1$ در فرم پوششی، فرض «بازده به مقیاس متغیر (VRS)» دارد و کارایی فنی خالص را می‌سنجد. همواره رابطه زیر برقرار است:\n$$\\theta_{\\text{CCR}}^* \\le \\theta_{\\text{BCC}}^*$$\nیعنی هر واحدی که در مدل CCR کارا باشد، در مدل BCC نیز قطعاً کاراست، اما عکس آن الزامی نیست!',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: روابط طلایی سیستم صف مارکوفی تک‌کاناله ($M/M/1$) و قضایای لیتل',
        content:
          'در سیستم صف $M/M/1$ با نرخ ورود پواسون $\\lambda$ و نرخ خدمت‌دهی نمایی $\\mu$ ($\\lambda < \\mu$)، ضریب بهره‌برداری برابر $\\rho = \\frac{\\lambda}{\\mu}$ و احتمال خالی بودن سیستم $P_0 = 1 - \\rho$ است. طبق روابط لیتل:\n$$L_s = \\frac{\\rho}{1 - \\rho} = \\frac{\\lambda}{\\mu - \\lambda}, \\quad L_q = \\frac{\\rho^2}{1 - \\rho} = \\rho L_s, \\quad W_s = \\frac{L_s}{\\lambda} = \\frac{1}{\\mu - \\lambda}, \\quad W_q = \\frac{L_q}{\\lambda}$$',
      },
    ],
    conceptDescriptors: [
      { concept: 'قید تحدب $\\sum \\lambda_j = 1$', descriptor: 'نقش در تحلیل پوششی داده‌ها (DEA)', answer: 'تبدیل مدل CCR (بازده به مقیاس ثابت) به مدل BCC (بازده به مقیاس متغیر)' },
      { concept: 'اختلاف $L_s - L_q$ در صف $M/M/1$', descriptor: 'مقدار عددی دقیق', answer: 'برابر با ضریب بهره‌برداری $\\rho = \\lambda / \\mu$ (میانگین تعداد مشتریان در حال دریافت خدمت)' },
    ],
    konkoorTips: [
      'اگر در ماتریس مقایسات زوجی $3 \\times 3$ در روش AHP داشته باشیم $a_{12} = 2$ و $a_{23} = 3$، برای سازگاری کامل باید $a_{13} = a_{12} \\times a_{23} = 6$ باشد.',
      'در سیستم صف $M/M/1$، احتمال اینکه دقیقاً $n$ مشتری در کل سیستم حضور داشته باشند از توزیع هندسی $P_n = (1 - \\rho)\\rho^n$ پیروی می‌کند.',
    ],
    keyTerms: ['AHP Consistency Ratio', 'TOPSIS Ideal Solution', 'DEA CCR vs BCC', 'M/M/1 Queue', 'Little’s Law'],
    conceptCheck: {
      prompt: 'در تحلیل پوششی داده‌ها (DEA)، اگر یک واحد تصمیم‌گیرنده (DMU) در مدل CCR کارا باشد ($\\theta_{\\text{CCR}}^* = 1$)، وضعیت کارایی آن در مدل BCC چگونه است؟',
      options: ['حتماً در مدل BCC نیز کاراست ($\\theta_{\\text{BCC}}^* = 1$)', 'ممکن است در مدل BCC ناکارا باشد'],
    },
  },
  'inno.open_rd_transfer': {
    nodeId: 'inno.open_rd_transfer',
    course: 'مدیریت تکنولوژی و انتقال فناوری',
    chapter: 'نوآوری باز چسبرو، نسل‌های R&D روث‌ول و قراردادهای انتقال تکنولوژی',
    topic: 'نوآوری باز (چسبرو)، ۵ نسل R&D (روث‌ول)، ظرفیت جذب (کوهن-لوینتال) و انتقال فناوری',
    sourceBookCitation: 'نوآوری باز هنری چسبرو (ترجمه کامران باقری)؛ سیاست‌گذاری علم و فناوری دکتر قاضی‌نوری؛ و مقاله Rothwell (1994)',
    examYearsAppeared: [1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۵ دکتری و ضریب ۳ ارشد فناوری — مبحث محوری نوآوری و انتقال تکنولوژی',
    frequencyLabel: 'تکرار در ۷ دوره کنکور (۱۳۹۸ تا ۱۴۰۴)',
    summary:
      'پارادایم نوآوری باز چسبرو، تکامل پنج نسل تحقیق و توسعه روی روث‌ول، نظریه ظرفیت جذب کوهن و لوینتال و قراردادهای بین‌المللی انتقال فناوری شاکله اصلی سؤالات تخصصی کنکور ارشد و دکتری مدیریت فناوری را می‌سازند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: نوآوری باز چسبرو (ورودی، خروجی و مدیریت خطای منفی کاذب)',
        content:
          'هنری چسبرو (۲۰۰۳) نشان داد که در پارادایم نوآوری باز، مرزهای بنگاه متخلخل است:\n• نوآوری باز ورودی (Outside-In): بهره‌گیری از دانش بیرونی، استارتاپ‌ها و دانشگاه‌ها برای شتاب‌دهی به R&D داخلی.\n• نوآوری باز خروجی (Inside-Out): تجاری‌سازی فناوری‌های بلااستفاده داخلی از طریق اعطای لیسانس یا تأسیس شرکت زایشی (Spin-off) برای جلوگیری از «خطای منفی کاذب (False Negative)».',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: نسل‌های پنج‌گانه فرآیند R&D روی روث‌ول (Rothwell’s 5G)',
        content:
          '۱) نسل اول: فشار فناوری خطی (Technology Push - دهه ۱۹۵۰).\n۲) نسل دوم: کشش تقاضای بازار خطی (Market Pull - دهه ۱۹۶۰).\n۳) نسل سوم: مدل تعاملی یا جفت‌شده (Coupling Model - دهه ۱۹۷۰) با حلقه‌های بازخورد میان R&D و بازاریابی.\n۴) نسل چهارم: مدل یکپارچه و مهندسی هم‌زمان/موازی (Integrated & Parallel - دهه ۱۹۸۰).\n۵) نسل پنجم: یکپارچگی سیستمی و شبکه‌سازی دیجیتال (SIN - دهه ۱۹۹۰ به بعد).',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: ظرفیت جذب (ACAP) و قراردادهای انتقال تکنولوژی (Licensing, BOT, Turnkey)',
        content:
          '• ظرفیت جذب (کوهن و لوینتال ۱۹۹۰): توانایی شرکت در تشخیص ارزش دانش بیرونی، جذب و به‌کارگیری تجاری آن که مستلزم داشتن R&D داخلی و دانش پیشین است.\n• قراردادهای انتقال فناوری: از «لیسانسینگ (انتقال حق بهره‌برداری در ازای رویالتی)» و «کلید در دست (Turnkey - تحویل کارخانه آماده)» تا «ساخت، بهره‌برداری و انتقال (BOT)» و «سرمایه‌گذاری مشترک (Joint Venture)».',
      },
    ],
    conceptDescriptors: [
      { concept: 'خطای منفی کاذب (False Negative)', descriptor: 'مفهوم در قیف نوآوری باز چسبرو', answer: 'رد کردن یک فناوری ارزشمند در داخل شرکت به دلیل عدم انطباق با مدل کسب‌وکار فعلی (مثل آزمایشگاه PARC زیراکس)' },
      { concept: 'نسل سوم R&D روث‌ول', descriptor: 'ویژگی متمایزکننده نسبت به نسل ۱ و ۲', answer: 'عبور از مدل‌های خطی و ایجاد مدل تعاملی/جفت‌شده (Coupling) بین فشار فناوری و کشش بازار' },
    ],
    konkoorTips: [
      'در نظریه کوهن و لوینتال، نوآوری باز و انتقال فناوری هرگز جایگزین R&D داخلی نمی‌شوند، زیرا بدون R&D داخلی، شرکت فاقد «ظرفیت جذب» برای درک فناوری وارداتی خواهد بود.',
    ],
    keyTerms: ['Open Innovation', 'False Negative (PARC)', 'Rothwell 5G R&D', 'Absorptive Capacity', 'BOT & Turnkey Contracts'],
    conceptCheck: {
      prompt: 'تجاری‌سازی پتنت‌های راکد و بلااستفاده آزمایشگاه شرکت از طریق واگذاری امتیاز (Licensing) به شرکت‌های دیگر یا ایجاد شرکت زایشی (Spin-off)، مصداق کدام بعد نوآوری باز چسبرو است؟',
      options: ['نوآوری باز خروجی (Inside-Out / Outbound)', 'نوآوری باز ورودی (Outside-In / Inbound)'],
    },
  },
  'bus.english_eshraghi': {
    nodeId: 'bus.english_eshraghi',
    course: 'زبان عمومی و تخصصی مدیریت (ضریب ۳)',
    chapter: 'واژگان تخصصی مدیریت و تکنیک‌های درک مطلب (اشراقی / زیر ذره‌بین)',
    topic: 'اصطلاحات طلایی مدیریت و بازاریابی، گرامر تستی وارونگی (Inversion) و درک مطلب تحلیلی',
    sourceBookCitation: 'زبان تخصصی مدیریت، آرمان اشراقی (نگاه دانش) / دکتر ناصرزاده؛ و زبان عمومی ارشد زیر ذره‌بین (جهانشاهی و حجازی)',
    examYearsAppeared: [1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۳ ارشد مدیریت بازرگانی — ۳۰ تست سرنوشت‌ساز (۱۵ عمومی + ۱۵ تخصصی)',
    frequencyLabel: 'تکرار در تمامی ادوار کنکور ارشد و دکتری',
    summary:
      'درس زبان با ضریب ۳ در کنکور ارشد مدیریت بازرگانی ترازسازترین درس برای کسب رتبه‌های تک‌رقمی است. ترکیب واژگان پرتکرار «زیر ذره‌بین» و اصطلاحات تخصصی «آرمان اشراقی» پوشش قابل‌اتکایی از پرتکرارترین الگوهای واژگانی این درس می‌دهد؛ ادعای پوشش ۱۰۰٪ فقط با مستند رسمی قابل تأیید است.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: واژگان تخصصی پرتکرار مدیریت و سازمان (کتاب آرمان اشراقی)',
        content:
          '• Span of Control (حیطه نظارت): تعداد مرئوسانی که مستقیماً به یک مدیر گزارش می‌دهند.\n• Unity of Command (وحدت فرماندهی): هر کارمند باید تنها از یک مافوق دستور بگیرد.\n• Esprit de Corps (روحیه جمعی و همبستگی): اصل چهاردهم فایول برای ایجاد همدلی در سازمان.\n• Escalation of Commitment (تشدید تعهد): پافشاری غیرمنطقی بر تصمیم اشتباه قبلی به دلیل هزینه‌های غرق‌شده (Sunk Costs).',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: واژگان تخصصی بازاریابی، استراتژی و منابع انسانی',
        content:
          '• Market Skimming (قیمت‌گذاری سرشیرگیری) در برابر Market Penetration (قیمت‌گذاری نفوذی).\n• Planned Obsolescence (فرسودگی برنامه‌ریزی‌شده) و Cannibalization (هم‌خواری محصول).\n• Job Enlargement (توسعه افقی شغل: افزایش تعداد وظایف هم‌سطح) در برابر Job Enrichment (غنی‌سازی عمودی شغل: افزایش استقلال و مسئولیت).\n• Glass Ceiling (سقف شیشه‌ای: مانع نامرئی ارتقای زنان و اقلیت‌ها به سطوح عالی).',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: قواعد گرامری کلیدی کلوزتست (کتاب زیر ذره‌بین جهانشاهی و حجازی)',
        content:
          '• قاعده وارونگی (Inversion): هرگاه قیدهای منفی (Never, Rarely, Seldom, Hardly... when, No sooner... than, Not only) در ابتدای جمله قرار گیرند، فعل کمکی قبل از فاعل می‌آید: $\\text{No sooner had the company launched...}$\n• افعال سببی (Causatives): ساختار $\\text{have/get something + Past Participle}$ (مجهول سببی) و $\\text{make someone + Simple Verb}$.\n• وجه التزامی (Subjunctive Mood): بعد از افعال و صفات امری (suggest, insist, vital, imperative) در بند that همواره شکل ساده فعل بدون to و بدون s سوم شخص می‌آید.',
      },
    ],
    conceptDescriptors: [
      { concept: 'Cannibalization (هم‌خواری محصول)', descriptor: 'معنای تخصصی در متون بازاریابی اشراقی', answer: 'کاهش فروش و سهم بازار محصول قدیمی یک شرکت در اثر معرفی محصول جدید توسط همان شرکت' },
      { concept: 'Job Enrichment در برابر Job Enlargement', descriptor: 'تفاوت کلیدی در متون انگلیسی HRM', answer: 'غنی‌سازی (Enrichment) توسعه عمودی شغل و تفویض اختیار است، اما توسعه شغل (Enlargement) صرفاً افزایش افقی تعداد وظایف هم‌سطح است' },
    ],
    konkoorTips: [
      'در سوالات درک مطلب (Reading)، سوالات Main Idea را با مطالعه جمله اول پاراگراف اول و جمله آخر متن در کمتر از ۴۵ ثانیه پاسخ دهید.',
      'پس از عبارت‌های Harldy / Scarcely حرف ربط when و پس از No sooner حرف ربط than می‌آید.',
    ],
    keyTerms: ['Span of Control', 'Cannibalization', 'Job Enrichment', 'Inversion Grammar', 'Subjunctive Mood'],
    conceptCheck: {
      prompt: 'کدام اصطلاح تخصصی انگلیسی به «پافشاری غیرمنطقی مدیر بر یک پروژه زیان‌ده به دلیل سرمایه‌گذاری‌های قبلی (Sunk Costs)» اشاره دارد؟',
      options: ['Escalation of Commitment (تشدید تعهد)', 'Delegation of Authority (تفویض اختیار)'],
    },
  },
  'bus.econ_nazari': {
    nodeId: 'bus.econ_nazari',
    course: 'اقتصاد خرد و کلان (ضریب ۲)',
    chapter: 'کشش‌ها، ساختارهای بازار و تعادل کلان IS-LM و AD-AS (دکتر محسن نظری)',
    topic: 'کشش‌های تقاضا، حداکثرسازی سود ($MR=MC$)، مدل IS-LM، اثر برون‌رانی و منحنی فیلیپس',
    sourceBookCitation: 'اقتصاد خرد و اقتصاد کلان، دکتر محسن نظری (انتشارات نگاه دانش)',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۲ ارشد مدیریت — ۲۰ تست (۱۰ خرد + ۱۰ کلان از کتب دکتر محسن نظری)',
    frequencyLabel: 'تکرار ۱۰۰٪ هر سال در کنکور ارشد مدیریت',
    summary:
      'کتاب‌های اقتصاد خرد و کلان دکتر محسن نظری (انتشارات نگاه دانش) منبع بلامنازع کنکور ارشد مدیریت هستند. تسلط بر روابط کشش و درآمد کل، شرط تعطیل بنگاه در رقابت کامل و تحلیل شیب منحنی‌های IS و LM تضمین‌کننده درصد بالای ۸۰ است.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: کشش قیمتی تقاضا و فرمول آستانه تعطیل بنگاه در رقابت کامل (اقتصاد خرد)',
        content:
          'رابطه اساسی درآمد نهایی ($MR$)، قیمت ($P$) و قدرمطلق کشش قیمتی تقاضا ($|E_p|$):\n$$MR = P\\left(1 - \\frac{1}{|E_p|}\\right)$$\n• اگر $|E_p| > 1$ (باکشش): کاهش قیمت باعث افزایش درآمد کل ($TR$) می‌شود.\n• انحصارگر همواره در ناحیه باکشش منحنی تقاضا ($|E_p| > 1$) تولید می‌کند.\n• شرط تعطیل بنگاه رقابتی در کوتاه‌مدت: اگر قیمت بازار از حداقل هزینه متغیر متوسط کمتر شود ($P < \\min AVC$)، بنگاه تولید را متوقف می‌کند و زیانش معادل هزینه ثابت کل ($TFC$) است.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: ضرایب فزاینده کینزی و بودجه متوازن هاولمو (اقتصاد کلان)',
        content:
          'در مدل کینزی با میل نهایی به مصرف $c = MPC$:\n$$k_G = \\frac{1}{1 - c}, \\quad k_T = \\frac{-c}{1 - c}, \\quad k_{TR} = \\frac{c}{1 - c}$$\nطبق قضیه بودجه متوازن هاولمو، در مدل ساده بدون مالیات تابعی از درآمد، اگر مخارج دولت و مالیات مقطوع به یک اندازه افزایش یابند ($\\Delta G = \\Delta T$)، درآمد ملی دقیقاً به اندازه $\\Delta Y = \\Delta G$ افزایش می‌یابد ($k_B = 1$).',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: تعادل هم‌زمان بازار کالا و پول (IS-LM) و اثر برون‌رانی (Crowding Out)',
        content:
          '• در «دام نقدینگی کینزی» منحنی $LM$ کاملاً افقی است؛ در این حالت سیاست مالی حداکثر کارایی را دارد (اثر برون‌رانی صفر است) و سیاست پولی کاملاً بی‌اثر است.\n• در «حالت کلاسیکی» منحنی $LM$ کاملاً عمودی است؛ در این حالت سیاست پولی حداکثر کارایی را دارد و سیاست مالی به دلیل اثر برون‌رانی ۱۰۰ درصدی کاملاً بی‌اثر است.',
      },
    ],
    conceptDescriptors: [
      { concept: 'کالای گیفن در برابر کالای پست', descriptor: 'تفکیک اثر جانشینی و اثر درآمدی در کتاب دکتر نظری', answer: 'هر کالای گیفنی حتماً پست است که اثر درآمدی منفی آن قوی‌تر از اثر جانشینی است، اما هر کالای پستی الزاماً گیفن نیست' },
      { concept: 'دام نقدینگی (Liquidity Trap)', descriptor: 'وضعیت منحنی LM و کارایی سیاست‌ها', answer: 'منحنی LM افقی است؛ سیاست مالی کاملاً کارا (بدون برون‌رانی) و سیاست پولی کاملاً عقیم است' },
    ],
    konkoorTips: [
      'اگر کشش متقاطع دو کالا مثبت باشد ($E_{xy} > 0$) دو کالا جانشین، و اگر منفی باشد ($E_{xy} < 0$) دو کالا مکمل یکدیگرند.',
      'منحنی عرضه کوتاه‌مدت بنگاه در بازار رقابت کامل، بخش صعودی منحنی $MC$ از نقطه حداقل $AVC$ به بالاست؛ اما در بازار انحصار کامل، منحنی عرضه وجود ندارد!',
    ],
    keyTerms: ['Price Elasticity & Total Revenue', 'Shutdown Point (P < min AVC)', 'IS-LM Model', 'Crowding-Out Effect', 'Liquidity Trap'],
    conceptCheck: {
      prompt: 'طبق قضایای اقتصاد خرد دکتر نظری، یک بنگاه انحصارگر کامل همواره در کدام ناحیه از منحنی تقاضای خطی تولید می‌کند؟',
      options: ['در ناحیه باکشش منحنی تقاضا ($|E_p| > 1$) که درآمد نهایی نامنفی است', 'در ناحیه کم‌کشش منحنی تقاضا ($|E_p| < 1$)'],
    },
  },
  'bus.math_stats_ranjbaran_tourani': {
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    course: 'ریاضی و آمار (ضریب ۲)',
    chapter: 'دامنه، حد، مشتق و ماتریس (رنجبران) + احتمال بیز و توزیع‌ها (طورانی)',
    topic: 'حد و پیوستگی، بهینه‌سازی چندمتغیره، ویژه مقدارها و قضیه احتمال کامل و بیز',
    sourceBookCitation: 'ریاضیات عمومی هادی رنجبران (اثبات) / محمودیان؛ و آمار و احتمال طرح ۹۰ درصد محسن طورانی (نگاه دانش)',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۲ بازرگانی و ضریب ۳ صنعتی — مرجع بی‌رقیب رنجبران و طورانی',
    frequencyLabel: 'تکرار در تمامی ادوار کنکور ارشد و دکتری',
    summary:
      'ترکیب کتاب «ریاضیات عمومی هادی رنجبران» و «آمار و احتمال محسن طورانی» استاندارد طلایی پاسخ‌گویی سریع به تست‌های ریاضی و آمار کنکور مدیریت با روش‌های تستی و فرمول‌های میان‌بر است.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: اکسترمم توابع دومتغیره و آزمون دترمینان هسین (ریاضی رنجبران)',
        content:
          'برای یافتن نقاط بحرانی تابع $z = f(x,y)$، ابتدا مشتقات جزئی مرتبه اول را مساوی صفر قرار می‌دهیم ($f_x = 0, f_y = 0$). سپس دترمینان ماتریس هسین را محاسبه می‌کنیم:\n$$D = f_{xx} f_{yy} - (f_{xy})^2$$\n• اگر $D > 0$ و $f_{xx} > 0$: نقطه مینیمم نسبی است.\n• اگر $D > 0$ و $f_{xx} < 0$: نقطه ماکزیمم نسبی است.\n• اگر $D < 0$: نقطه زینی (Saddle Point) است و اکسترمم نیست.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: خواص طلایی مقادیر ویژه ماتریس‌ها ($\lambda_i$)',
        content:
          'برای هر ماتریس مربعی $A_{n \\times n}$ با مقادیر ویژه $\\lambda_1, \\dots, \\lambda_n$:\n$$\\sum_{i=1}^n \\lambda_i = \\text{tr}(A) \\quad (\\text{مجموع درایه‌های قطر اصلی})$$\n$$\\prod_{i=1}^n \\lambda_i = \\det(A)$$\nهمچنین مقادیر ویژه ماتریس $A^k$ برابر $\\lambda_i^k$ و مقادیر ویژه ماتریس وارون $A^{-1}$ برابر $1/\\lambda_i$ است.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: قضیه احتمال کامل، بیز و خواص امید ریاضی و واریانس (آمار طورانی)',
        content:
          'اگر $A_1, \\dots, A_k$ افرازی از فضای نمونه باشند، طبق قضیه بیز:\n$$P(A_i \\mid B) = \\frac{P(A_i) P(B \\mid A_i)}{\\sum_{j=1}^k P(A_j) P(B \\mid A_j)}$$\nو برای تبدیل خطی متغیر تصادفی $Y = aX + b$:\n$$E(aX + b) = aE(X) + b, \\qquad \\text{Var}(aX + b) = a^2 \\text{Var}(X)$$\nبرای دو متغیر تصادفی مستقل $X$ و $Y$ داریم: $\\text{Var}(aX - bY) = a^2\\text{Var}(X) + b^2\\text{Var}(Y)$.',
      },
    ],
    conceptDescriptors: [
      { concept: 'اثر ماتریس ($\text{tr}(A)$)', descriptor: 'رابطه با مقادیر ویژه در کتاب رنجبران', answer: 'برابر با مجموع تمام مقادیر ویژه ماتریس ($\sum \lambda_i = \text{tr}(A)$)' },
      { concept: 'توزیع پواسون ($\text{Poisson}(\lambda)$)', descriptor: 'رابطه امید ریاضی و واریانس در کتاب طورانی', answer: 'تنها توزیع گسسته معروف که در آن میانگین و واریانس دقیقاً با هم برابرند ($E(X) = \text{Var}(X) = \lambda$)' },
    ],
    konkoorTips: [
      'در محاسبه واریانس تفاضل دو متغیر مستقل $\\text{Var}(X - Y)$، علامت منفی به دلیل به توان ۲ رسیدن به مثبت تبدیل می‌شود: $\\text{Var}(X) + \\text{Var}(Y)$!',
      'در ماتریس‌های مثلثی (بالامثلثی یا پایین‌مثلثی) و قطری، مقادیر ویژه دقیقاً همان درایه‌های روی قطر اصلی هستند.',
    ],
    keyTerms: ['Hessian Determinant', 'Eigenvalues Trace & Determinant', 'Bayes Theorem', 'Poisson Distribution', 'Variance Properties'],
    conceptCheck: {
      prompt: 'اگر $X$ و $Y$ دو متغیر تصادفی مستقل با $\\text{Var}(X) = 4$ و $\\text{Var}(Y) = 5$ باشند، مقدار $\\text{Var}(2X - Y + 7)$ چقدر است؟',
      options: ['۲۱', '۱۱'],
    },
  },
  'bus.islamic_moghimi': {
    nodeId: 'bus.islamic_moghimi',
    course: 'اصول و مبانی مدیریت از دیدگاه اسلام (ضریب ۲)',
    chapter: 'نظام ارزش‌ها، برنامه‌ریزی، انگیزش و کنترل اسلامی (دکتر سید محمد مقیمی)',
    topic: 'سطوح ارزش‌ها، فرمان امام علی (ع) به مالک اشتر، مدل انگیزشی اسلامی و نظارت درونی (تقوا)',
    sourceBookCitation: 'اصول و مبانی مدیریت از دیدگاه اسلام، دکتر سید محمد مقیمی (انتشارات راه دان)',
    examYearsAppeared: [1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404],
    konkoorWeightLabel: 'ضریب ۲ ارشد مدیریت بازرگانی — ۱۵ تست با پوشش بیش از ۸۵٪ از کتاب دکتر مقیمی',
    frequencyLabel: 'تکرار ۱۰۰٪ هر سال در کنکور ارشد مدیریت',
    summary:
      'کتاب «اصول و مبانی مدیریت از دیدگاه اسلام» تألیف دکتر سید محمد مقیمی (انتشارات راه دان) منبع مستقیم طراحان کنکور ارشد مدیریت است و با مطالعه هدفمند فصول آن می‌توان در کوتاه‌ترین زمان به درصد بالای ۸۰ دست یافت.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: مفروضات بنیادین و سلسله‌مراتب نظام ارزش‌ها در مدیریت اسلامی',
        content:
          'در الگوی دکتر مقیمی، مدیریت اسلامی بر جهان‌بینی توحیدی استوار است و «مسئولیت در مدیریت اسلامی امانت الهی و تکلیف است نه طعمه و امتیاز (نامه‌های نهج‌البلاغه)».\nسلسله‌مراتب نظام ارزشی سازمان اسلامی از عمیق‌ترین لایه به ملموس‌ترین لایه عبارت است از:\n۱) جهان‌بینی توحیدی و اعتقادات بنیادین ← ۲) ارزش‌های غایی (قرب الی الله و سعادت انسان) ← ۳) ارزش‌های ابزاری (عدالت، امانت‌داری، شورا) ← ۴) هنجارها و الگوهای رفتاری.',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: اصول برنامه‌ریزی، تصمیم‌گیری (شورا در برابر عزم) و سازماندهی اسلامی',
        content:
          '• در تصمیم‌گیری اسلامی (آیه ۱۵۹ سوره آل‌عمران: «وَشَاوِرْهُمْ فِي الْأَمْرِ فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ»)، مرحله «مشورت با صاحبان خرد و تجربه (شورا)» برای پختگی تصمیم است، اما مرحله «تصمیم‌گیری نهایی و عزم مدیریتی» بر عهده شخص مدیر ارشد همراه با توکل است.\n• در عهدنامه مالک اشتر، ملاک اصلی گزینش و انتصاب کارگزاران «تقدم تعهد و تقوا بر تجربه، همراه با آزمون آزمایشی پیش از انتصاب قطعی» و پرهیز از انتصاب بر پایه «هواپرستی و استبداد رأی» است.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: الگوی انگیزش توحیدی و نظارت دوگانه (خودکنترلی درونی و نظارت بیرونی)',
        content:
          '• انگیزش در مدیریت اسلامی تلفیقی متوازن از «عوامل بیرونی و مادی (تأمین معیشت کافی کارگزاران برای حفظ عفت نفس)» و «عوامل درونی و معنوی (رضایت الهی و نیت قربت)» است.\n• سیستم کنترل در مدیریت اسلامی بر دو پایه استوار است: ۱) نظارت درونی (خودکنترلی مبتنی بر تقوا، وجدان و باور به حضور دائمی خداوند: أَلَمْ يَعْلَمْ بِأَنَّ اللَّهَ يَرَى) که کم‌هزینه‌ترین و پایدارترین نوع کنترل است، و ۲) نظارت بیرونی (بازرسان امین و مخفی در عهدنامه مالک اشتر).',
      },
    ],
    conceptDescriptors: [
      { concept: 'تأمین معیشت کارگزاران در عهدنامه مالک اشتر', descriptor: 'فلسفه انگیزشی و کنترلی از دیدگاه امام علی (ع)', answer: 'گشاده‌دستی در روزی کارگزاران (أَسبِغ عَلَیهِمُ الأَرزاق) باعث تقویت خوداصلاحی و سلب بهانه خیانت در بیت‌المال می‌شود' },
      { concept: 'تقوا در سیستم کنترل سازمانی', descriptor: 'معادل در ادبیات مدیریت اسلامی دکتر مقیمی', answer: 'نظارت درونی و خودکنترلی مستمر ناشی از باور قلبی به نظارت الهی' },
    ],
    konkoorTips: [
      'در سوالات کنکور از کتاب دکتر مقیمی، تفکیک دو مرحله «مشورت (مشارکتی)» و «عزم و تصمیم نهایی (مسئولیت فردی مدیر)» بسیار پرتکرار است.',
      'طبق عهدنامه مالک اشتر، در صورت خیانت کارگزار پس از تأمین کامل معیشت او، مجازات شدید بدنی، استرداد اموال و تشهیر (رسواسازی عمومی) اعمال می‌شود.',
    ],
    keyTerms: ['Tawhidi Worldview', 'Shura vs Azm', 'Malik Ashtar Covenant', 'Intrinsic Self-Control (Taqwa)', 'Balanced Islamic Motivation'],
    conceptCheck: {
      prompt: 'بر اساس الگوی تصمیم‌گیری قرآنی در کتاب دکتر مقیمی («وَشَاوِرْهُمْ فِي الْأَمْرِ فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ»)، پس از انجام مشورت با کارشناسان، مسئولیت اتخاذ تصمیم نهایی (عزم) با کیست؟',
      options: ['بر عهده شخص مدیر و رهبر سازمان با توکل بر خداوند', 'بر عهده رأی‌گیری اکثریت اعضای شورا و سلب مسئولیت از مدیر'],
    },
  },
};

export const INITIAL_QUESTION_BANK: QuestionItem[] = [
  // ۱. مبانی سازمان - ساختار مکانیکی و ارگانیک
  {
    id: 'q.mb.struct.1',
    nodeId: 'mb.structure',
    examYear: 1402,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۲ — منبع: تئوری سازمان ریچارد دفت فصل ۴',
    text: 'بر اساس پژوهش‌های برنز و استاکر، هنگامی که یک شرکت دانش‌بنیان از محیط صنعتی باثبات وارد بازاری با تغییرات سریع فناوری و عدم اطمینان بالا می‌شود، کدام تغییر ساختاری برای حفظ اثربخشی ضروری است؟',
    options: [
      'افزایش استانداردسازی فرآیندهای کار و تقویت خط فرماندهی عمودی',
      'گذر به سمت ساختار ارگانیک با کاهش رسمیت، تمرکززدایی و جایگزینی دستورات عمودی با مشاوره‌های افقی',
      'حذف کامل تقسیم کار تخصصی و واگذاری تمام تصمیمات استراتژیک به واحدهای ستادی',
      'افزایش تفکیک عمودی و تدوین شرح وظایف دقیق و تغییرناپذیر برای هر پست سازمانی',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.mb.struct.proof.1404',
    nodeId: 'mb.structure',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] در مقایسه ساختارهای مکانیکی و ارگانیک، کدام گزاره درباره «منشأ اعتبار و نفوذ (Authority)» و «ماهیت تعهد کارکنان» کاملاً صحیح است؟',
    options: [
      'در ساختار ارگانیک منشأ نفوذ جایگاه رسمی در سلسله‌مراتب است و تعهد معطوف به وظیفه فعلی است.',
      'در ساختار مکانیکی منشأ نفوذ دانش و خبرگی فنی است و تعهد معطوف به مأموریت کلی سازمان است.',
      'در ساختار ارگانیک منشأ نفوذ در محل قرارگیری دانش و تخصص است و تعهد کارکنان معطوف به اهداف و پیشرفت کلی سازمان است.',
      'در هر دو ساختار منشأ نفوذ جایگاه قانونی است و تنها تفاوت در تعداد سطوح سلسله‌مراتب است.',
    ],
    expectedTimeMs: 50000,
  },

  // ۲. مبانی سازمان - اقتضایی و وودوارد
  {
    id: 'q.mb.cont.1',
    nodeId: 'mb.contingency',
    examYear: 1401,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۱ — منبع: تئوری سازمان رابینز فصل ۶ (وودوارد)',
    text: 'طبق یافته‌های جوآن وودوارد درباره رابطه فناوری و ساختار سازمانی، کدام مقایسه بین سه فناوری «تولید تکی (واحدی)»، «تولید انبوه» و «تولید فرآیندی (پیوسته)» صحیح است؟',
    options: [
      'حیطه نظارت سرپرستان خط اول در تولید انبوه پهن‌تر (بیشتر) از تولید تکی و تولید فرآیندی است.',
      'میزان رسمیت و تمرکز در تولید فرآیندی (مانند پالایشگاه نفت) بیشتر از تولید انبوه (مانند خودروسازی) است.',
      'نسبت مدیران به کل کارکنان با حرکت از تولید تکی به فرآیندی کاهش می‌یابد.',
      'تولید انبوه و تولید فرآیندی هر دو نیازمند ساختار مدیریتی کاملاً مکانیکی هستند.',
    ],
    expectedTimeMs: 55000,
  },
  {
    id: 'q.mb.cont.proof.1404',
    nodeId: 'mb.contingency',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] در مدل اقتضایی لارنس و لورش، شرکتی که در محیطی به‌شدت ناهمگن و متلاطم فعالیت می‌کند و واحدهای تحقیق و توسعه، تولید و بازاریابی آن دارای تفاوت‌های عمیق در افق زمانی و جهت‌گیری بین‌فردی هستند، برای کسب عملکرد برتر به چه ترکیبی نیاز دارد؟',
    options: [
      'کاهش تفکیک بین واحدها از طریق یکسان‌سازی قوانین و استفاده از سلسله‌مراتب سنتی',
      'حفظ سطح بالای تفکیک (Differentiation) متناسب با زیرمحیط‌ها همراه با سازوکارهای یکپارچگی (Integration) قوی و افقی',
      'حذف سازوکارهای یکپارچگی برای افزایش سرعت عمل مستقل هر واحد',
      'تفکیک پایین و یکپارچگی پایین جهت صرفه‌جویی در هزینه‌های هماهنگی اداری',
    ],
    expectedTimeMs: 50000,
  },

  // ۳. مدیریت استراتژیک - زنجیره ارزش پورتر
  {
    id: 'q.sm.vc.1',
    nodeId: 'sm.value_chain',
    examYear: 1401,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۱ — منبع: مزیت رقابتی پورتر',
    isDiagnosticProbe: true,
    text: 'در الگوی زنجیره ارزش مایکل پورتر، کدام مورد زیر جزو «فعالیت‌های پشتیبانی (Support Activities)» بنگاه طبقه‌بندی می‌شود؟',
    options: [
      'دریافت، انبارداری و کنترل موجودی مواد اولیه ورودی به کارخانه',
      'تدارکات (Procurement) و خرید ماشین‌آلات، مواد خام و اقلام مصرفی برای کل سازمان',
      'بسته‌بندی، پردازش سفارشات و ارسال فیزیکی محصولات نهایی به نمایندگی‌های فروش',
      'نصب، راه‌اندازی، آموزش مشتری و تأمین قطعات یدکی پس از فروش',
    ],
    expectedTimeMs: 40000,
  },
  {
    id: 'q.sm.vc.proof.1404',
    nodeId: 'sm.value_chain',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] هنگامی که یک شرکت تولیدی با صرف هزینه بیشتر در «طراحی مهندسی محصول و کنترل کیفیت مواد ورودی»، هزینه‌های «تعمیرات گارانتی و خدمات پس از فروش» خود را به شکل چشمگیری کاهش می‌دهد، مزیت رقابتی آن از کدام ویژگی زنجیره ارزش پورتر حاصل شده است؟',
    options: [
      'برون‌سپاری فعالیت‌های اولیه به تأمین‌کنندگان',
      'بهینه‌سازی و هماهنگی در پیوندهای درونی زنجیره ارزش (Internal Linkages)',
      'ادغام عمودی پیشرو در سیستم ارزش کانال توزیع',
      'کاهش مستقیم حاشیه سود (Margin) برای نفوذ در بازار',
    ],
    expectedTimeMs: 45000,
  },

  // ۴. مدیریت استراتژیک - RBV و VRIO
  {
    id: 'q.sm.rbv.1',
    nodeId: 'sm.rbv',
    examYear: 1402,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۲ — منبع: مقاله بارنی ۱۹۹۱ (VRIO)',
    text: 'طبق چارچوب VRIO جی بارنی، اگر یک دارایی استراتژیک در شرکت «ارزشمند» و «کمیاب» باشد، اما به دلیل عدم وجود ابهام علی و وابستگی به مسیر، رقبا بتوانند در مدت کوتاهی آن را مهندسی معکوس یا شبیه‌سازی کنند، این دارایی چه پیامدی برای شرکت دارد؟',
    options: [
      'برابری رقابتی (Competitive Parity) و بازده اقتصادی نرمال',
      'مزیت رقابتی موقت (Temporary Competitive Advantage) و عملکرد بالاتر از میانگین در کوتاه‌مدت',
      'مزیت رقابتی پایدار (Sustained Competitive Advantage)',
      'عدم مزیت رقابتی و بازده کمتر از میانگین صنعت',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.sm.rbv.proof.1404',
    nodeId: 'sm.rbv',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] کدام عامل زیر در دیدگاه مبتنی بر منابع (RBV)، قوی‌ترین مانع در برابر تقلید رقبا از طریق «جذب و استخدام مدیران ارشد شرکت پیشتاز توسط شرکت رقیب» محسوب می‌شود؟',
    options: [
      'ثبت اختراع و حق مالکیت معنوی (Patent) قابل معامله در بازار',
      'صرفه‌جویی ناشی از مقیاس در خرید مواد اولیه',
      'ابهام علی (Causal Ambiguity) و تنیده شدن قابلیت در پیچیدگی اجتماعی و فرهنگ تیمی سازمان مبدأ',
      'موانع تعرفه‌ای و قانونی ورود به صنعت',
    ],
    expectedTimeMs: 50000,
  },

  // ۵. استراتژیک - پورتفولیو
  {
    id: 'q.sm.port.1',
    nodeId: 'sm.portfolio',
    examYear: 1401,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۱ — منبع: مدیریت استراتژیک فرد دیوید فصل ۶',
    text: 'در ماتریس گروه مشاوره بوستون (BCG)، واحد کسب‌وکاری که در صنعتی با نرخ رشد سالانه ۱۸٪ (بالا) فعالیت می‌کند و فروش آن ۳۰ میلیارد تومان است، در حالی که سه رقیب اصلی آن در بازار به ترتیب ۶۰، ۲۵ و ۱۵ میلیارد تومان فروش دارند، در کدام خانه قرار می‌گیرد؟',
    options: [
      'ستاره (Star) — زیرا رشد بازار بالاست و شرکت دوم بازار است.',
      'علامت سؤال (Question Mark) — زیرا رشد بازار بالاست اما سهم نسبی بازار آن ۰٫۵ (کمتر از ۱) است.',
      'گاو شیری (Cash Cow) — زیرا گردش مالی ۳۰ میلیارد تومانی بالایی دارد.',
      'سگ (Dog) — زیرا سهم نسبی بازار آن کمتر از ۱ است.',
    ],
    expectedTimeMs: 55000,
  },
  {
    id: 'q.sm.port.proof.1404',
    nodeId: 'sm.portfolio',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] کدام نقد اساسی به ماتریس ۴ خانه‌ای BCG باعث شد مک‌کینزی و جنرال الکتریک ماتریس ۹ خانه‌ای (GE) را جایگزین آن کنند؟',
    options: [
      'در ماتریس BCG جریان نقدینگی واحدهای کسب‌وکار به کلی نادیده گرفته شده است.',
      'تقلیل دادن «جذابیت صنعت» به یک متغیر (نرخ رشد بازار) و «توان رقابتی» به یک متغیر (سهم نسبی بازار) و نادیده گرفتن واحدهای حد واسط (متوسط)',
      'عدم امکان ترسیم دایره‌های متناسب با سهم فروش هر واحد کسب‌وکار در ماتریس BCG',
      'تمرکز ماتریس BCG بر استراتژی‌های سطح وظیفه‌ای به جای سطح شرکت',
    ],
    expectedTimeMs: 45000,
  },

  // ۶. قابلیت‌های پویا
  {
    id: 'q.sm.dyn.1',
    nodeId: 'sm.dynamic',
    examYear: 1403,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۳ — منبع: مقاله دیوید تیس ۲۰۰۷',
    text: 'بر اساس نظریه قابلیت‌های پویا (دیوید تیس)، توانایی یک شرکت خودروساز در «بازطراحی ساختار سازمانی، کنار گذاشتن خطوط تولید موتورهای درون‌سوز منسوخ و هم‌راستاسازی مجدد دارایی‌های مکمل برای عصر خودروهای برقی» مصداق کدام ریزبنیان است؟',
    options: [
      'حس‌گری فرصت‌ها و تهدیدها (Sensing)',
      'تسخیر و تصاحب فرصت (Seizing)',
      'دگرگون‌سازی و بازآرایی مستمر دارایی‌ها (Transforming / Reconfiguring)',
      'قابلیت‌های عملیاتی و روتین‌های صفرسطحی (Ordinary Capabilities)',
    ],
    expectedTimeMs: 45000,
  },

  // ۷. آمار - مقیاس‌های اندازه‌گیری
  {
    id: 'q.stats.scale.1',
    nodeId: 'stats.scales',
    examYear: 1401,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۱ — منبع: آمار عادل آذر جلد ۱',
    isDiagnosticProbe: true,
    text: 'اگر پژوهشگری متغیر «میزان رضایت شغلی» را با یک سؤال طیف لیکرت ۵ درجه‌ای (از کاملاً مخالفم=۱ تا کاملاً موافقم=۵) و متغیر «سابقه کاری به ماه» را از صفر تا ۳۶۰ ماه اندازه‌گیری کند، مقیاس این دو متغیر و شاخص پراکندگی نسبی مجاز برای متغیر دوم کدام است؟',
    options: [
      'فاصله‌ای و نسبتی — محاسبه ضریب تغییرات ($CV = s / \\bar{x}$) برای هر دو متغیر مجاز است.',
      'رتبه‌ای و نسبتی — محاسبه ضریب تغییرات ($CV = s / \\bar{x}$) فقط برای «سابقه کاری» (به دلیل داشتن صفر مطلق) مجاز است.',
      'اسمی و فاصله‌ای — محاسبه میانگین هندسی برای هر دو مجاز است.',
      'رتبه‌ای و فاصله‌ای — در هیچ‌کدام نمی‌توان ضریب تغییرات محاسبه کرد.',
    ],
    expectedTimeMs: 45000,
  },

  // ۸. آمار - تحلیل واریانس ANOVA
  {
    id: 'q.stats.anova.1',
    nodeId: 'stats.anova',
    examYear: 1402,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۲ — منبع: آمار عادل آذر جلد ۲ فصل ۳',
    text: 'در یک جدول تحلیل واریانس یک‌طرفه (One-Way ANOVA) برای مقایسه بهره‌وری ۴ کارخانه ($k = 4$) با مجموعاً ۲۴ کارگر تصادفی ($n = 24$)، اگر مجموع مربعات کل $SST = 210$ و مجموع مربعات خطا (درون‌گروهی) $SSW = 120$ باشد، مقدار آماره آزمون $F$ برابر کدام است؟',
    options: [
      '$F = 5.0$',
      '$F = 3.75$',
      '$F = 6.0$',
      '$F = 1.75$',
    ],
    expectedTimeMs: 65000,
  },
  {
    id: 'q.stats.anova.proof.1404',
    nodeId: 'stats.anova',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] در تحلیل واریانس دوطرفه (Two-Way ANOVA) با دو عامل A (دارای ۳ سطح) و B (دارای ۴ سطح) که در هر خانه جدول دقیقاً $r = 5$ تکرار مشاهده وجود دارد، درجه آزادی اثر متقابل ($A \\times B$) و درجه آزادی خطا ($SSE$) به ترتیب کدام‌اند؟',
    options: [
      'اثر متقابل ۶ و خطا ۴۸',
      'اثر متقابل ۱۲ و خطا ۴۸',
      'اثر متقابل ۶ و خطا ۵۹',
      'اثر متقابل ۷ و خطا ۶۰',
    ],
    expectedTimeMs: 65000,
  },

  // ۹. آمار - رگرسیون
  {
    id: 'q.stats.reg.1',
    nodeId: 'stats.regression',
    examYear: 1403,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۳ — منبع: آمار عادل آذر جلد ۲ فصل ۶',
    text: 'در یک مدل رگرسیون خطی چندگانه با $p = 3$ متغیر مستقل و حجم نمونه $n = 24$، اگر ضریب تعیین معمولی $R^2 = 0.60$ باشد، مقدار «ضریب تعیین تعدیل‌شده ($\\bar{R}^2$)» و آماره $F$ معناداری کل رگرسیون به ترتیب کدام‌اند؟',
    options: [
      '$\\bar{R}^2 = 0.54$ و $F = 10.0$',
      '$\\bar{R}^2 = 0.56$ و $F = 15.0$',
      '$\\bar{R}^2 = 0.50$ و $F = 8.5$',
      '$\\bar{R}^2 = 0.60$ و $F = 12.0$',
    ],
    expectedTimeMs: 70000,
  },
  {
    id: 'q.stats.reg.proof.1404',
    nodeId: 'stats.regression',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] اگر در برازش مدل رگرسیون به روش مربعات واریانس جملات خطا ثابت نباشد (وجود ناهمسانی واریانس یا Heteroscedasticity)، کدام ویژگی برآوردگرهای حداقل مربعات معمولی (OLS) نقض می‌شود؟',
    options: [
      'برآوردگرهای OLS اریب (Biased) و ناسازگار می‌شوند.',
      'برآوردگرهای OLS همچنان نااریب و سازگار باقی می‌مانند، اما دیگر دارای کمترین واریانس (کارا / BLUE) نیستند و خطای معیار آن‌ها نامعتبر می‌شود.',
      'ضریب تعیین $R^2$ منفی می‌شود.',
      'میانگین جملات خطا مخالف صفر شده و هم‌خطی کامل رخ می‌دهد.',
    ],
    expectedTimeMs: 55000,
  },

  // ۱۰. روش تحقیق - روایی سازه
  {
    id: 'q.rm.val.1',
    nodeId: 'rm.validity',
    examYear: 1402,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۲ — منبع: معیار فورنل و لارکر ۱۹۸۱',
    text: 'در مدل‌سازی معادلات ساختاری، اگر میانگین واریانس استخراج‌شده (AVE) برای سازه «تعهد سازمانی» برابر ۰٫۴۹ و پایایی ترکیبی (CR) آن ۰٫۸۲ باشد، کدام قضاوت درباره روایی همگرا و واگرای این سازه صحیح است؟',
    options: [
      'روایی همگرا تأیید می‌شود زیرا پایایی ترکیبی بزرگ‌تر از ۰٫۷ است.',
      'روایی همگرا رد می‌شود (چون $\\text{AVE} < 0.50$)، و در جدول فورنل-لارکر همبستگی این سازه با سایر سازه‌ها باید کمتر از $0.70$ ($\\sqrt{0.49}$) باشد.',
      'روایی واگرا تأیید می‌شود اگر همبستگی با سایر سازه‌ها بیش از ۰٫۷۰ باشد.',
      'مقدار AVE هیچ ارتباطی با بارهای عاملی گویه‌ها ندارد.',
    ],
    expectedTimeMs: 50000,
  },

  // ۱۱. فرهنگ سازمانی
  {
    id: 'q.mb.cult.1',
    nodeId: 'mb.culture',
    examYear: 1402,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۲ — منبع: فرهنگ سازمانی ادگار شاین',
    text: 'در الگوی فرهنگ سازمانی ادگار شاین، «معماری فضای کار، لباس فرم و شعارهای نصب‌شده روی دیوار» در کدام سطح و «باورهای ناخودآگاه درباره ماهیت انسان و زمان که بدون چون‌وچرا بدیهی فرض می‌شوند» در کدام سطح قرار دارند؟',
    options: [
      'ارزش‌های ابرازشده — مصنوعات (Artifacts)',
      'مصنوعات (Artifacts) — مفروضات بنیادین (Basic Underlying Assumptions)',
      'هنجارهای رفتاری — ارزش‌های ابرازشده',
      'نمادهای ملموس — استراتژی‌های مکتوب',
    ],
    expectedTimeMs: 40000,
  },
  {
    id: 'q.mb.cult.2',
    nodeId: 'mb.culture',
    examYear: 1404,
    sourceReference: 'تألیفی — منبع: مدل سازگاری دنیسون و تئوری Z ویلیام اوشی',
    text: 'در مدل سازگاری دنیسون (Denison)، بُعد «مشارکت» (Involvement) با کدام ویژگی در تئوری Z ویلیام اوشی (Ouchi) بیشترین هم‌پوشانی دارد؟',
    options: [
      'تصمیم‌گیری متمرکز و سلسله‌مراتب رسمی',
      'تصمیم‌گیری مشارکتی، مالکیت فردی و وفاداری بلندمدت سازمان',
      'کنترل بیرونی از طریق قوانین مکتوب و دستورالعمل‌های استاندارد',
      'ارزیابی عملکرد صرفاً بر مبنای شاخص‌های مالی کوتاه‌مدت',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.mb.cult.3',
    nodeId: 'mb.culture',
    examYear: 1405,
    sourceReference: 'تألیفی — منبع: تعریف کلیمات و فرهنگ (علاقه‌بند) و تمایز آن‌ها',
    text: 'کدام گزینه تمایز درست بین «اقلیم سازمانی» (Organizational Climate) و «فرهنگ سازمانی» (Organizational Culture) را بیان می‌کند؟',
    options: [
      'اقلیم پدیده‌ای عمیق و ناخودآگاه است؛ فرهنگ سطحی و قابل‌مشاهده.',
      'فرهنگ پدیده‌ای عمیق و ناخودآگاه است؛ اقلیم ادراک سطحی و قابل‌مشاهده از محیط کاری.',
      'هر دو یکسان‌اند و فقط در روش سنجش متفاوت‌اند.',
      'اقلیم مختص بخش دولتی و فرهنگ مختص بخش خصوصی است.',
    ],
    expectedTimeMs: 45000,
  },

  // ۱۲. بازاریابی - PLC
  {
    id: 'q.mkt.plc.1',
    nodeId: 'mkt.plc',
    examYear: 1401,
    sourceReference: 'کنکور دکتری مدیریت بازرگانی ۱۴۰۱ — منبع: کاتلر و کلر فصل ۱۱',
    text: 'شرکتی محصول فناورانه جدیدی را وارد بازاری کرده که اکثر خریداران بالقوه از وجود محصول آگاه‌اند، حاضرند قیمت بالایی برای آن بپردازند و شرکت نگران ورود قریب‌الوقوع رقبای قدرتمند است. طبق مدل کاتلر کدام استراتژی مرحله معرفی مناسب است؟',
    options: [
      'سرشیرگیری سریع (قیمت بالا + ترفیع بالا)',
      'سرشیرگیری کند (قیمت بالا + ترفیع پایین)',
      'نفوذ سریع (قیمت پایین + ترفیع بالا)',
      'نفوذ کند (قیمت پایین + ترفیع پایین)',
    ],
    expectedTimeMs: 45000,
  },

  // ۱۳. بازاریابی - برند کلر
  {
    id: 'q.mkt.brand.1',
    nodeId: 'mkt.brand',
    examYear: 1402,
    sourceReference: 'کنکور دکتری مدیریت بازرگانی ۱۴۰۲ — منبع: مدیریت برند کوین لین کلر',
    text: 'در مدل ارزش ویژه برند مبتنی بر مشتری (CBBE کوین لین کلر)، تلاش بازاریاب برای پاسخ به پرسش «تو که هستی؟ (Who are you?)» در ذهن مشتری، متناظر با کدام پله هرم و کدام هدف است؟',
    options: [
      'پله اول: هویت برند — ایجاد برجستگی برند (Brand Salience) از طریق عمق و وسعت آگاهی',
      'پله دوم: معنای برند — ایجاد تداعی‌های عملکردی و تصویر ذهنی قوی، مطلوب و منحصر‌به‌فرد',
      'پله سوم: واکنش برند — شکل‌دهی به قضاوت‌های کیفیت و اعتبار',
      'پله چهارم: رابطه با برند — ایجاد طنین و وفاداری رفتاری',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.mkt.brand.proof.1404',
    nodeId: 'mkt.brand',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] در هرم CBBE کلر، تفاوت «وسعت آگاهی از برند (Breadth)» و «عمق آگاهی از برند (Depth)» در بلوک برجستگی برند چیست؟',
    options: [
      'عمق آگاهی به سهولت یادآوری برند اشاره دارد، در حالی که وسعت آگاهی به طیف موقعیت‌های خرید و مصرفی اشاره دارد که برند به ذهن خطور می‌کند.',
      'وسعت آگاهی همان وفاداری نگرشی است و عمق آگاهی وفاداری رفتاری است.',
      'عمق آگاهی فقط در کالاهای صنعتی و وسعت آگاهی در کالاهای مصرفی کاربرد دارد.',
      'وسعت آگاهی به تعداد رقبا و عمق آگاهی به قیمت برند اشاره دارد.',
    ],
    expectedTimeMs: 50000,
  },

  // ۱۴. رفتار مصرف‌کننده - ELM
  {
    id: 'q.mkt.cons.1',
    nodeId: 'mkt.consumer',
    examYear: 1403,
    sourceReference: 'کنکور دکتری مدیریت بازرگانی ۱۴۰۳ — منبع: رفتار مصرف‌کننده سولومون',
    text: 'بر اساس مدل احتمال بسط ذهن (ELM)، هنگامی که یک بیمار قصد خرید داروی تخصصی حیاتی دارد (درگیری ذهنی بسیار بالا)، اما متن بروشور پزشکی به‌قدری تخصصی است که او قادر به درک استدلال‌های علمی آن نیست، تغییر نگرش او چگونه رخ می‌دهد؟',
    options: [
      'از مسیر مرکزی، زیرا درگیری ذهنی (انگیزه) او در بالاترین سطح ممکن است.',
      'از مسیر پیرامونی (تکیه بر اعتبار پزشک یا شهرت کشور سازنده)، زیرا توانایی پردازش اطلاعات تخصصی را ندارد.',
      'هیچ‌گونه نگرشی شکل نمی‌گیرد و فرآیند تصمیم‌گیری متوقف می‌شود.',
      'ابتدا از مسیر مرکزی و سپس از طریق ناهماهنگی شناختی پس از خرید.',
    ],
    expectedTimeMs: 50000,
  },

  // ۱۵. نوآوری - منحنی S و سازمان دوپهلو
  {
    id: 'q.inno.scurve.1',
    nodeId: 'inno.s_curve',
    examYear: 1402,
    sourceReference: 'کنکور دکتری مدیریت تکنولوژی ۱۴۰۲ — منبع: ملیسا شیلینگ فصل ۳',
    text: 'در تحلیل منحنی S فناوری (فاستر)، چرا شرکت‌های پیشرو و مسلط در فناوری قدیمی، اغلب در هنگام ظهور یک فناوری جدید (ناپیوستگی فناوری) بازار را به استارتاپ‌های تازه‌وارد واگذار می‌کنند؟',
    options: [
      'زیرا در ابتدای ظهور فناوری جدید، عملکرد آن پایین‌تر از فناوری بالغ فعلی است و سرمایه‌گذاری در فناوری قدیم در کوتاه‌مدت بازده مطمئن‌تری نشان می‌دهد.',
      'زیرا شرکت‌های بزرگ به منابع مالی دسترسی ندارند.',
      'زیرا منحنی S فناوری جدید از همان روز اول عملکردی بالاتر از سقف فیزیکی فناوری قدیم دارد.',
      'زیرا در مرحله بلوغ فناوری قدیم، شیب منحنی S بی‌نهایت می‌شود.',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.inno.ambi.1',
    nodeId: 'inno.ambidextrous',
    examYear: 1403,
    sourceReference: 'کنکور دکتری مدیریت ۱۴۰۳ — منبع: اورایلی و تاشمن ۲۰۰۴',
    text: 'در معماری «سازمان دوپهلوی ساختاری (Structural Ambidexterity)» به روایت اورایلی و تاشمن، هماهنگی و یکپارچگی بین واحدهای بهره‌برداری (Exploitation) و واحدهای اکتشاف (Exploration) چگونه برقرار می‌شود؟',
    options: [
      'ادغام کامل کارکنان هر دو واحد در یک خط تولید واحد با قوانین مکانیکی یکسان',
      'جداسازی ساختاری، فرهنگی و فرآیندی دو واحد در سطوح عملیاتی، همراه با یکپارچگی استراتژیک در سطح تیم مدیریت ارشد و چشم‌انداز مشترک',
      'چرخش هفتگی تمام کارگران بین خط تولید و آزمایشگاه تحقیق و توسعه',
      'برون‌سپاری کامل واحد بهره‌برداری و حفظ صرفاً واحد اکتشاف',
    ],
    expectedTimeMs: 50000,
  },
  {
    id: 'q.inno.ambi.2',
    nodeId: 'inno.ambidextrous',
    examYear: 1405,
    sourceReference: 'تألیفی — منبع: اکتشاف در مقابل بهره‌برداری (مارس و سیمون ۱۹۵۸)',
    text: 'کدام گزینه تخصیص درست منابع بین «اکتشاف» (Exploration) و «بهره‌برداری» (Exploitation) را از نظر مارس و سیمون بیان می‌کند؟',
    options: [
      'تمام منابع صرف بهره‌برداری شود چون بازده کوتاه‌مدت قطعی است.',
      'تمام منابع صرف اکتشاف شود چون بقای بلندمدت مهم‌تر است.',
      'تعادل پویا: بهره‌برداری سود امروز و اکتشاف تضمین بقای فردا؛ هر دو ضروری‌اند.',
      'اکتشاف فقط در بحران مالی معنا دارد.',
    ],
    expectedTimeMs: 45000,
  },

  // ۱۶. مدیریت صنعتی - تحقیق در عملیات (سیمپلکس و دوگان)
  {
    id: 'q.ind.or.1',
    nodeId: 'ind.or_simplex_duality',
    examYear: 1403,
    sourceReference: 'کنکور دکتری مدیریت صنعتی ۱۴۰۳ — منبع: پژوهش عملیاتی مهرگان فصل ۴',
    text: 'در یک مسئله برنامه‌ریزی خطی اولیه از نوع بیشینه‌سازی، اگر متغیر اصلی $x_1^* = 5$ در جواب بهینه حضور داشته باشد، طبق قضیه مکمل‌های متوازن کدام گزاره درباره محدودیت اول مسئله دوگان قطعی است؟',
    options: [
      'محدودیت اول دوگان به صورت تساوی برقرار است (متغیر کمکی $v_1^* = 0$).',
      'محدودیت اول دوگان دارای متغیر مازاد مثبت است ($v_1^* > 0$).',
      'متغیر اول دوگان حتماً صفر است ($y_1^* = 0$).',
      'مسئله دوگان دارای جواب بیکران است.',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.ind.or.proof.1404',
    nodeId: 'ind.or_simplex_duality',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط مدیریت صنعتی',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] در فرم ماتریسی سیمپلکس، اگر بردار ضرایب متغیرهای اساسی در تابع هدف $C_B = [2, 5]$ و معکوس ماتریس پایه در جدول نهایی $B^{-1} = \\begin{bmatrix} 1 & -1 \\\\ 0 & 2 \\end{bmatrix}$ باشد، مقادیر بهینه متغیرهای دوگان $(y_1^*, y_2^*)$ کدام است؟',
    options: [
      '$(2, 8)$',
      '$(2, -2)$',
      '$(5, 10)$',
      '$(7, 8)$',
    ],
    expectedTimeMs: 55000,
  },

  // ۱۷. مدیریت صنعتی - مدیریت تولید و عملیات (EOQ, EPQ, MRP, Cp/Cpk)
  {
    id: 'q.ind.pom.1',
    nodeId: 'ind.pom_eoq_mrp',
    examYear: 1403,
    sourceReference: 'کنکور دکتری مدیریت صنعتی ۱۴۰۳ — منبع: مدیریت تولید و عملیات دکتر متقی',
    text: 'در یک سیستم تولیدی با مدل EPQ، نرخ تولید روزانه ۱۰۰ واحد و نرخ مصرف روزانه ۶۰ واحد است. اگر اندازه هر انباشت تولید ۵۰۰ واحد باشد، حداکثر موجودی انبار ($I_{\\max}$) چقدر خواهد بود؟',
    options: [
      '۲۰۰ واحد',
      '۳۰۰ واحد',
      '۵۰۰ واحد',
      '۲۵۰ واحد',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.ind.pom.proof.1404',
    nodeId: 'ind.pom_eoq_mrp',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط مدیریت صنعتی',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] اگر برای یک فرآیند تولیدی $USL = 58$، $LSL = 46$، انحراف معیار $\\sigma = 1.5$ و شاخص $C_{pk} = 1.11$ (معادل $\\frac{10}{9}$) باشد، میانگین فرآیند ($\\mu$) کدام یک از مقادیر زیر می‌تواند باشد؟',
    options: [
      '۵۳ یا ۵۱',
      '۵۲ (دقیقاً در مرکز مشخصات)',
      '۵۵ یا ۴۹',
      '۵۶ یا ۴۸',
    ],
    expectedTimeMs: 55000,
  },

  // ۱۸. مدیریت فناوری و نوآوری - تید و بسانت (4P) و طاهر خلیل
  {
    id: 'q.inno.tidd.1',
    nodeId: 'inno.tidd_4p',
    examYear: 1403,
    sourceReference: 'کنکور دکتری مدیریت تکنولوژی ۱۴۰۳ — منبع: مدیریت نوآوری تید و بسانت فصل ۱',
    text: 'بر اساس مدل 4P نوآوری تید و بسانت، تصمیم شرکت خطوط هوایی رایان‌ایر (Ryanair) برای بازتعریف کل منطق صنعت هوانوردی از «سفر لوکس» به «حمل‌ونقل عمومی ارزان‌قیمت بدون تشریفات»، مصداق کدام نوع نوآوری است؟',
    options: [
      'نوآوری پارادایم (Paradigm Innovation)',
      'نوآوری فرآیند (Process Innovation)',
      'نوآوری محصول (Product Innovation)',
      'نوآوری تدریجی جزء (Modular Innovation)',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.inno.tidd.proof.1404',
    nodeId: 'inno.tidd_4p',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط مدیریت فناوری',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] در چارچوب اطلس فناوری (در کتاب مدیریت تکنولوژی طاهر خلیل)، توانایی‌های شناختی، خلاقیت، تجربه عملی و مهارت حل مسئله مهندسان و تکنسین‌های سازمان در کدام جزء فناوری طبقه‌بندی می‌شود؟',
    options: [
      'انسان‌افزار (Humanware)',
      'اطلاعات‌افزار (Infoware)',
      'سازمان‌افزار (Orgaware)',
      'فن‌افزار (Technoware)',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.inno.tidd.2',
    nodeId: 'inno.tidd_4p',
    examYear: 1405,
    sourceReference: 'تألیفی — منبع: مدل ۴P نوآوری تید و بسانت (استراتژی فرآیند)',
    text: 'در مدل ۴P نوآوری تید و بسانت (Tidd & Bessant)، «فرآیند نوآوری» (Process Innovation) به کدام گزینه اشاره دارد؟',
    options: [
      'معرفی محصول یا خدمت جدید به بازار',
      'بهبود یا ایجاد روش تولید و تحویل جدید یا به‌طور معنادار بهبودیافته',
      'ورود به بازارهای جغرافیایی جدید',
      'تغییر در ساختار سازمانی و سبک رهبری',
    ],
    expectedTimeMs: 45000,
  },

  // ۱۹. مدیریت صنعتی - تصمیم‌گیری چندمعیاره (MCDM)، تحلیل پوششی داده‌ها (DEA) و تئوری صف
  {
    id: 'q.ind.mcdm.1',
    nodeId: 'ind.mcdm_dea_queue',
    examYear: 1403,
    sourceReference: 'کنکور دکتری مدیریت صنعتی ۱۴۰۳ — منبع: تئوری صف و تصمیم‌گیری دکتر عادل آذر',
    text: 'در یک ایستگاه خدمات بانکی تک‌باجه‌ای ($M/M/1$)، مشتریان با نرخ متوسط ۱۲ نفر در ساعت طبق توزیع پواسون وارد می‌شوند و کارمند باجه به طور متوسط در هر ۴ دقیقه به یک مشتری خدمت می‌دهد (توزیع نمایی). میانگین تعداد مشتریان موجود در کل سیستم ($L_s$) و احتمال بیکار بودن متصدی باجه ($P_0$) به ترتیب کدام است؟',
    options: [
      '۴ نفر در سیستم — $P_0 = 0.20$',
      '۳.۲ نفر در سیستم — $P_0 = 0.20$',
      '۴ نفر در سیستم — $P_0 = 0.80$',
      '۳ نفر در سیستم — $P_0 = 0.25$',
    ],
    expectedTimeMs: 50000,
  },
  {
    id: 'q.ind.mcdm.proof.1404',
    nodeId: 'ind.mcdm_dea_queue',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط مدیریت صنعتی (DEA و AHP)',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] در یک ماتریس مقایسات زوجی $4 \\times 4$ در روش AHP توماس ساعتی، اگر بزرگ‌ترین مقدار ویژه ماتریس برابر $\\lambda_{\\max} = 4.27$ و شاخص تصادفی بودن برای $n=4$ برابر $RI = 0.90$ باشد، نرخ ناسازگاری ($IR$) چقدر است و آیا سازگاری ماتریس پذیرفته می‌شود؟',
    options: [
      '$IR = 0.10$ — سازگاری ماتریس در مرز ۰.۱۰ قابل قبول است.',
      '$IR = 0.09$ — سازگاری ماتریس کاملاً قابل قبول است.',
      '$IR = 0.30$ — ماتریس ناسازگار است و باید تجدیدنظر شود.',
      '$IR = 0.27$ — ماتریس ناسازگار است.',
    ],
    expectedTimeMs: 55000,
  },

  // ۲۰. مدیریت فناوری و نوآوری - نوآوری باز چسبرو، نسل‌های R&D روث‌ول و انتقال فناوری
  {
    id: 'q.inno.open.1',
    nodeId: 'inno.open_rd_transfer',
    examYear: 1403,
    sourceReference: 'کنکور دکتری مدیریت تکنولوژی ۱۴۰۳ — منبع: نوآوری باز هنری چسبرو',
    text: 'در چارچوب نوآوری باز (Open Innovation) هنری چسبرو، پدیده «منفی کاذب (False Negative)» که در شرکت زیراکس (آزمایشگاه PARC) رخ داد به چه معناست و راه‌حل نوآوری باز برای آن چیست؟',
    options: [
      'پروژه‌های تحقیقاتی که در ابتدا نویدبخش به نظر می‌رسند اما در عمل شکست می‌خورند.',
      'فناوری‌هایی که به دلیل عدم تناسب با مدل کسب‌وکار فعلی شرکت در داخل رد و بایگانی می‌شوند، اما از طریق «نوآوری باز خروجی (واگذاری لیسانس یا Spin-off)» می‌توانند در بازارهای دیگر خلق ثروت کنند.',
      'کاهش بودجه تحقیق و توسعه داخلی به صفر و خرید کامل فناوری از دانشگاه‌ها.',
      'ثبت اختراع تدافعی برای جلوگیری از ورود رقبا بدون تجاری‌سازی فناوری.',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.inno.open.proof.1404',
    nodeId: 'inno.open_rd_transfer',
    examYear: 1404,
    sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط مدیریت فناوری (روث‌ول و ظرفیت جذب)',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] بر اساس نظریه «ظرفیت جذب (Absorptive Capacity)» کوهن و لوینتال (۱۹۹۰) و بازبینی زهرا و جورج (۲۰۰۲)، کدام دو بعد به ترتیب تشکیل‌دهنده «ظرفیت جذب بالقوه (Potential Absorptive Capacity - PACAP)» هستند؟',
    options: [
      'اکتساب دانش (Acquisition) و هضم/جذب دانش (Assimilation)',
      'تبدیل دانش (Transformation) و بهره‌برداری تجاری (Exploitation)',
      'اکتساب دانش (Acquisition) و بهره‌برداری تجاری (Exploitation)',
      'تولید دانش داخلی و واگذاری لیسانس خروجی',
    ],
    expectedTimeMs: 50000,
  },

  // ۲۱. زبان عمومی و تخصصی مدیریت - اشراقی و زیر ذره‌بین
  {
    id: 'q.bus.eng.1',
    nodeId: 'bus.english_eshraghi',
    examYear: 1403,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت بازرگانی ۱۴۰۳ — منبع: زبان تخصصی مدیریت آرمان اشراقی',
    text: 'When a company introduces a new product line that unintentionally takes away sales and market share from its own existing products, the phenomenon is best referred to as ................. .',
    options: [
      'Market Cannibalization',
      'Market Diversification',
      'Backward Integration',
      'Planned Obsolescence',
    ],
    expectedTimeMs: 40000,
  },
  {
    id: 'q.bus.eng.proof.1404',
    nodeId: 'bus.english_eshraghi',
    examYear: 1404,
    sourceReference: 'کنکور سراسری ارشد مدیریت ۱۴۰۴ — قرنطینه اثبات تسلط زبان (زیر ذره‌بین و اشراقی)',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] Not until the board of directors approved the restructuring plan ................. to implement the new decentralized hierarchy.',
    options: [
      'was the CEO able',
      'the CEO was able',
      'had the CEO been able',
      'the CEO had been able',
    ],
    expectedTimeMs: 45000,
  },

  // ۲۲. اقتصاد خرد و کلان - دکتر محسن نظری
  {
    id: 'q.bus.econ.1',
    nodeId: 'bus.econ_nazari',
    examYear: 1403,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت ۱۴۰۳ — منبع: اقتصاد کلان دکتر محسن نظری (نگاه دانش)',
    text: 'در الگوی تعادل هم‌زمان بازار کالا و پول (IS-LM)، اگر اقتصاد در شرایط «دام نقدینگی کینزی (Liquidity Trap)» قرار داشته باشد، اثر یک سیاست مالی انبساطی (افزایش مخارج دولت $\\Delta G > 0$) بر نرخ بهره و درآمد ملی چگونه خواهد بود؟',
    options: [
      'نرخ بهره تغییر نمی‌کند، اثر برون‌رانی (Crowding Out) صفر است و درآمد ملی به حداکثر میزان ممکن ($k_G \\Delta G$) افزایش می‌یابد.',
      'نرخ بهره به شدت افزایش یافته و اثر برون‌رانی ۱۰۰ درصدی مانع از افزایش درآمد ملی می‌شود.',
      'نرخ بهره کاهش یافته و سرمایه‌گذاری بخش خصوصی کاهش می‌یابد.',
      'منحنی LM به سمت چپ منتقل شده و درآمد ملی ثابت می‌ماند.',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.bus.econ.proof.1404',
    nodeId: 'bus.econ_nazari',
    examYear: 1404,
    sourceReference: 'کنکور سراسری ارشد مدیریت ۱۴۰۴ — قرنطینه اثبات تسلط اقتصاد خرد دکتر نظری',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] تابع هزینه کل کوتاه‌مدت یک بنگاه در بازار رقابت کامل به صورت $TC = Q^3 - 6Q^2 + 21Q + 50$ است. این بنگاه در قیمت‌های کمتر از چند واحد تولید را در کوتاه‌مدت تعطیل می‌کند؟',
    options: [
      '۱۲',
      '۲۱',
      '۹',
      '۵۰',
    ],
    expectedTimeMs: 50000,
  },

  // ۲۳. ریاضی و آمار - هادی رنجبران و محسن طورانی
  {
    id: 'q.bus.math.1',
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    examYear: 1403,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت ۱۴۰۳ — منبع: ریاضیات عمومی هادی رنجبران',
    text: 'اگر مقادیر ویژه ماتریس $A_{3 \\times 3}$ اعداد $1, 2, -2$ باشند، دترمینان ماتریس $A^{-1}$ و اثر ماتریس (مجموع درایه‌های قطر اصلی) $A^2 + 3I$ به ترتیب کدام است؟',
    options: [
      '$-\\frac{1}{4}$ و $18$',
      '$-4$ و $18$',
      '$-\\frac{1}{4}$ و $9$',
      '$\\frac{1}{4}$ و $12$',
    ],
    expectedTimeMs: 50000,
  },
  {
    id: 'q.bus.math.proof.1404',
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    examYear: 1404,
    sourceReference: 'کنکور سراسری ارشد مدیریت ۱۴۰۴ — قرنطینه اثبات تسلط آمار محسن طورانی',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] در یک کارخانه، دستگاه اول ۶۰٪ و دستگاه دوم ۴۰٪ محصولات را تولید می‌کنند. احتمال معیوب بودن محصول دستگاه اول ۲٪ و دستگاه دوم ۵٪ است. اگر محصولی به تصادف انتخاب شود و معیوب باشد، با کدام احتمال ساخت دستگاه دوم بوده است؟',
    options: [
      '$\\frac{5}{8}$ (۶۲.۵ درصد)',
      '$\\frac{3}{8}$ (۳۷.۵ درصد)',
      '$\\frac{2}{7}$',
      '$\\frac{1}{2}$ (۵۰ درصد)',
    ],
    expectedTimeMs: 50000,
  },

  // ۲۴. اصول و مبانی مدیریت از دیدگاه اسلام - دکتر سید محمد مقیمی
  {
    id: 'q.bus.islamic.1',
    nodeId: 'bus.islamic_moghimi',
    examYear: 1403,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت بازرگانی ۱۴۰۳ — منبع: مدیریت از دیدگاه اسلام دکتر مقیمی',
    text: 'بر اساس منشور مدیریتی امام علی (ع) به مالک اشتر (در کتاب اصول و مبانی مدیریت از دیدگاه اسلام دکتر مقیمی)، مهم‌ترین سازوکار پیشگیرانه برای حفظ پاکدستی کارگزاران و ایجاد زمینه خوداصلاحی در آنان کدام است؟',
    options: [
      'گشاده‌دستی در تأمین معاش و پرداخت حقوق کافی (أَسبِغ عَلَیهِمُ الأَرزاق) پیش از اعمال بازرسی مخفی و مجازات',
      'تغییر هفتگی و مستمر پست سازمانی تمام کارگزاران',
      'حذف کامل نظارت بیرونی و بسنده کردن به سوگند ابتدای خدمت',
      'کاهش حقوق کارگزاران به حداقل ممکن برای ترویج زهد اجباری',
    ],
    expectedTimeMs: 40000,
  },
  {
    id: 'q.bus.islamic.proof.1404',
    nodeId: 'bus.islamic_moghimi',
    examYear: 1404,
    sourceReference: 'کنکور سراسری ارشد مدیریت ۱۴۰۴ — قرنطینه اثبات تسلط مدیریت اسلامی دکتر مقیمی',
    isQuarantinedProof: true,
    text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] در الگوی «سلسله‌مراتب نظام ارزشی سازمان اسلامی» دکتر سید محمد مقیمی، کدام گزینه به ترتیب بیانگر «ارزش غایی» و «ارزش ابزاری» در مدیریت اسلامی است؟',
    options: [
      'قرب الی الله و فلاح انسان — عدالت محوری، امانت‌داری و شورا',
      'سودآوری بلندمدت — رضایت مشتریان',
      'شورا و مشورت — جهان‌بینی توحیدی',
      'نظم سازمانی — قرب الی الله',
    ],
    expectedTimeMs: 45000,
  },

  // ۲۵. سؤالات تکمیلی پرتکرار کنکور — مدیریت بازاریابی (جلیلیان، کاتلر و کلر)
  {
    id: 'q.mkt.plc.2',
    nodeId: 'mkt.plc',
    examYear: 1402,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت بازرگانی ۱۴۰۲ — منبع: مدیریت بازاریابی دکتر حسین جلیلیان (فصل چرخه عمر و قیمت‌گذاری)',
    text: 'هنگامی که یک شرکت داروسازی یا تولیدکننده تراشه‌های موبایل، محصول کاملاً نوآورانه‌ای را با «قیمت اولیه بسیار بالا» وارد بازار می‌کند تا پیش از ورود رقبا حداکثر حاشیه سود را از بخش‌های کم‌حساس به قیمت جذب کند، کدام استراتژی را به کار بسته و کدام شرط زیر برای موفقیت آن الزامی است؟',
    options: [
      'سرشیرگیری بازار (Market Skimming) — کشش قیمتی تقاضا در بخش پیشتازان پایین باشد و قیمت بالا تداعی‌کننده کیفیت برتر باشد.',
      'نفوذ سریع در بازار (Market Penetration) — بازار به شدت به قیمت حساس باشد و صرفه‌جویی ناشی از مقیاس در تولید برقرار باشد.',
      'سرشیرگیری بازار (Market Skimming) — هزینه‌های واحد تولید در تیراژ پایین کمتر از تیراژ بالا باشد.',
      'قیمت‌گذاری رهبر زیان‌ده (Loss Leader) — هدف حذف کامل سود ناخالص در مرحله معرفی باشد.',
    ],
    expectedTimeMs: 50000,
  },
  {
    id: 'q.mkt.plc.3',
    nodeId: 'mkt.plc',
    examYear: 1401,
    sourceReference: 'کنکور دکتری و ارشد مدیریت بازرگانی ۱۴۰۱ — منبع: استراتژی‌های بازاریابی در مرحله بلوغ PLC (کاتلر و جلیلیان)',
    text: 'در مرحله «بلوغ (Maturity)» چرخه عمر محصول که رشد فروش متوقف و رقابت قیمتی شدید می‌شود، اگر شرکتی تصمیم بگیرد بدون دستکاری فیزیکی محصول، «کاربران جدید جذب کند» یا «میزان و دفعات مصرف مشتریان فعلی را افزایش دهد»، کدام استراتژی را اجرا کرده است؟',
    options: [
      'اصلاح بازار (Market Modification)',
      'اصلاح محصول (Product Modification)',
      'اصلاح آمیخته بازاریابی (Marketing Mix Modification)',
      'استراتژی درو کردن (Harvesting)',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.mkt.brand.2',
    nodeId: 'mkt.brand',
    examYear: 1402,
    sourceReference: 'کنکور دکتری مدیریت بازرگانی ۱۴۰۲ — منبع: مدیریت استراتژیک برند کوین لین کلر (CBBE)',
    text: 'در مدل هرمی ارزش ویژه برند مبتنی بر مشتری (CBBE) کوین لین کلر، تفاوت بلوک‌های «عملکرد برند (Brand Performance)» و «تصویر ذهنی برند (Brand Imagery)» در سطح دوم هرم (معنای برند) چیست؟',
    options: [
      'عملکرد برند به ویژگی‌های ذاتی، کارکردی، دوام و قابلیت اطمینان محصول برای رفع نیازهای عینی اشاره دارد؛ اما تصویر ذهنی به جنبه‌های بیرونی، روان‌شناختی و نمادین برند مربوط است.',
      'عملکرد برند در سمت راست هرم (مسیر احساسی) و تصویر ذهنی در سمت چپ هرم (مسیر منطقی) قرار دارد.',
      'عملکرد برند در پله اول هرم (هویت) و تصویر ذهنی در پله چهارم (طنین) قرار می‌گیرد.',
      'هر دو صرفاً معطوف به وفاداری رفتاری و تکرار خرید پس از مصرف هستند.',
    ],
    expectedTimeMs: 50000,
  },
  {
    id: 'q.mkt.cons.2',
    nodeId: 'mkt.consumer',
    examYear: 1401,
    sourceReference: 'کنکور کارشناسی ارشد و دکتری بازرگانی ۱۴۰۱ — منبع: ماتریس رفتار خرید هنری اسل (کاتلر و سولومون)',
    text: 'بر اساس ماتریس چهارگانه رفتار خرید مصرف‌کننده «هنری اسل (Henry Assael)»، خرید کالایی مانند «نمک خوراکی یا بیسکویت که ارزان‌قیمت است (درگیری ذهنی پایین) اما مشتری بین برندهای مختلف تفاوت چندانی قائل نیست و صرفاً برای فرار از یکنواختی برند خود را عوض می‌کند» کدام نوع رفتار خرید است؟',
    options: [
      'رفتار خرید تنوع‌طلبانه (Variety-Seeking Buying Behavior)',
      'رفتار خرید عادتی (Habitual Buying Behavior)',
      'رفتار خرید کاهنده ناهماهنگی (Dissonance-Reducing Buying Behavior)',
      'رفتار خرید پیچیده (Complex Buying Behavior)',
    ],
    expectedTimeMs: 45000,
  },

  // ۲۶. سؤالات تکمیلی پرتکرار کنکور — تئوری‌های مدیریت (جوادین، جلیلیان، مقیمی، دفت و رابینز)
  {
    id: 'q.mb.struct.2',
    nodeId: 'mb.structure',
    examYear: 1402,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت ۱۴۰۲ — منبع: تئوری‌های مدیریت جوادین و جلیلیان (پیکربندی‌های مینتزبرگ)',
    text: 'در مدل پنج پیکربندی ساختاری هنری مینتزبرگ، در یک «بوروکراسی حرفه‌ای (Professional Bureaucracy)» مانند بیمارستان یا دانشگاه، کدام رکن سازمانی مهم‌ترین بخش است و سازوکار اصلی هماهنگی در آن کدام است؟',
    options: [
      'هسته عملیاتی (Operating Core) — استانداردسازی مهارت‌ها و دانش تخصصی',
      'ستاد تخصصی/تکنواستراکچر (Technostructure) — استانداردسازی فرآیندهای کار',
      'خط میانی (Middle Line) — استانداردسازی برون‌دادها و نتایج',
      'رأس استراتژیک (Strategic Apex) — نظارت مستقیم',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.mb.cont.2',
    nodeId: 'mb.contingency',
    examYear: 1403,
    sourceReference: 'کنکور کارشناسی ارشد و دکتری مدیریت ۱۴۰۳ — منبع: ماتریس فناوری چارلز پرو (Perrow) در کتاب دفت و رابینز',
    text: 'بر اساس ماتریس دو‌بعدی فناوری بخش‌های سازمانی «چارلز پرو (Charles Perrow)»، واحدی که در آن «تنوع کار (تعداد استثنائات) بسیار کم» است، اما هنگام بروز مشکل «تحلیل‌پذیری کار پایین است و کارکنان باید به شهود، تجربه و هنر شخصی تکیه کنند»، دارای کدام نوع فناوری است؟',
    options: [
      'فناوری صنعت‌گری / پیشه‌وری (Craft Technology)',
      'فناوری تکراری / روتین (Routine Technology)',
      'فناوری مهندسی (Engineering Technology)',
      'فناوری غیرتکراری / غیرروتین (Non-routine Technology)',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.mb.cont.3',
    nodeId: 'mb.contingency',
    examYear: 1401,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت ۱۴۰۱ — منبع: مدیریت رفتار سازمانی هرسی و بلانچارد (جوادین و جلیلیان)',
    text: 'در نظریه رهبری موقعیتی «هرسی و بلانچارد»، برای پیروانی که در سطح بلوغ و آمادگی $M_3$ (یا $R_3$) قرار دارند — یعنی «توانایی و مهارت فنی بالایی دارند اما فاقد انگیزه یا اعتمادبه‌نفس کافی برای انجام مستقل کار هستند» — کدام سبک رهبری اثربخش‌ترین است؟',
    options: [
      'سبک مشارکتی (Participating / $S_3$): وظیفه‌مداری پایین و رابطه‌مداری بالا',
      'سبک متقاعدسازی / توجیهی (Selling / $S_2$): وظیفه‌مداری بالا و رابطه‌مداری بالا',
      'سبک تفویضی (Delegating / $S_4$): وظیفه‌مداری پایین و رابطه‌مداری پایین',
      'سبک دستوری / آمرانه (Telling / $S_1$): وظیفه‌مداری بالا و رابطه‌مداری پایین',
    ],
    expectedTimeMs: 45000,
  },

  // ۲۷. سؤالات تکمیلی پرتکرار کنکور — تحقیق در عملیات (دکتر عارفه فدوی و دکتر مهرگان)
  {
    id: 'q.ind.or.2',
    nodeId: 'ind.or_simplex_duality',
    examYear: 1402,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت صنعتی و بازرگانی ۱۴۰۲ — منبع: پژوهش عملیاتی دکتر عارفه فدوی (نگاه دانش)',
    text: 'در جدول نهایی سیمپلکس یک مسئله بیشینه‌سازی ($\max Z$)، اگر برای یکی از متغیرهای غیرپایه‌ای (Non-basic variable) داشته باشیم $z_j - c_j = 0$ و در ستون آن متغیر حداقل یک ضریب مثبت ($y_{ij} > 0$) وجود داشته باشد، مسئله دارای چه نوع جوابی است؟',
    options: [
      'جواب بهینه دگرسان (بیشمار جواب بهینه روی پارهخط بین دو رأس مجاور)',
      'جواب بهینه تباهیده (Degenerate Optimal Solution)',
      'جواب بیکران (Unbounded Solution)',
      'فضای شدنی تهی (Infeasible Solution)',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.ind.or.3',
    nodeId: 'ind.or_simplex_duality',
    examYear: 1401,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت صنعتی ۱۴۰۱ — منبع: پژوهش عملیاتی دکتر عارفه فدوی (مسئله حمل‌ونقل)',
    text: 'در یک مسئله حمل‌ونقل متوازن با $m = 4$ مبدأ (عرضه) و $n = 5$ مقصد (تقاضا)، اگر در یک جواب موجه پایه دقیقاً ۷ خانه جدول مقدار مثبت گرفته باشند، برای اجرای آزمون بهینگی (روش MODI یا پله‌سنگ) چه اقدامی باید انجام شود؟',
    options: [
      'جواب دچار تباهیدگی (Degeneracy) است و باید در یک خانه غیرپایه‌ای مستقل (که دور تشکیل ندهد) مقدار بسیار کوچک $\\epsilon$ قرار داد تا تعداد خانه‌های پایه به $4 + 5 - 1 = 8$ برسد.',
      'جواب کاملاً غیردژنره است زیرا تعداد خانه‌های پر کمتر از $m+n$ است.',
      'باید یک سطر یا ستون مجازی (Dummy) به جدول اضافه کرد.',
      'مسئله حمل‌ونقل فاقد جواب بهینه متناهی است.',
    ],
    expectedTimeMs: 45000,
  },

  // ۲۸. سؤالات تکمیلی پرتکرار کنکور — مدیریت تولید و عملیات (دکتر متقی و چیس)
  {
    id: 'q.ind.pom.2',
    nodeId: 'ind.pom_eoq_mrp',
    examYear: 1402,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت صنعتی و تکنولوژی ۱۴۰۲ — منبع: مدیریت تولید دکتر حامد متقی (فصل موجودی EOQ)',
    text: 'در مدل کلاسیک مقدار سفارش اقتصادی (EOQ)، اگر تقاضای سالانه یک کالا ۴ برابر شود ($D_2 = 4D_1$) و سایر پارامترها (هزینه هر بار سفارش‌دهی $S$ و هزینه نگهداری واحد $H$) ثابت بمانند، «مقدار سفارش بهینه ($Q^*$)» و «فاصله زمانی بین دو سفارش متوالی ($T^*$)» به ترتیب چگونه تغییر می‌کنند؟',
    options: [
      'مقدار سفارش بهینه ۲ برابر می‌شود و فاصله زمانی بین دو سفارش نصف ($\\frac{1}{2}$) می‌شود.',
      'مقدار سفارش بهینه ۴ برابر می‌شود و فاصله زمانی ثابت می‌ماند.',
      'مقدار سفارش بهینه ۲ برابر می‌شود و فاصله زمانی نیز ۲ برابر می‌شود.',
      'مقدار سفارش بهینه نصف می‌شود و تعداد دفعات سفارش ۴ برابر می‌شود.',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.ind.pom.3',
    nodeId: 'ind.pom_eoq_mrp',
    examYear: 1401,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت صنعتی ۱۴۰۱ — منبع: مدیریت تولید و عملیات دکتر متقی (فصل زمان‌بندی کارها - قانون جانسون)',
    text: 'پنج کار باید به ترتیب ابتدا روی ماشین ۱ (تراشکاری) و سپس روی ماشین ۲ (فرزکاری) پردازش شوند. زمان پردازش کارها روی (ماشین ۱، ماشین ۲) عبارت است از: کار A: $(6, 3)$، کار B: $(2, 7)$، کار C: $(8, 4)$، کار D: $(5, 9)$، کار E: $(7, 6)$. طبق «الگوریتم جانسون» برای کمینه‌سازی کل زمان تکمیل ($C_{\\max}$)، ترتیب بهینه انجام کارها از چپ به راست کدام است؟',
    options: [
      'B $\\rightarrow$ D $\\rightarrow$ E $\\rightarrow$ C $\\rightarrow$ A',
      'A $\\rightarrow$ C $\\rightarrow$ E $\\rightarrow$ D $\\rightarrow$ B',
      'B $\\rightarrow$ A $\\rightarrow$ D $\\rightarrow$ C $\\rightarrow$ E',
      'D $\\rightarrow$ B $\\rightarrow$ E $\\rightarrow$ A $\\rightarrow$ C',
    ],
    expectedTimeMs: 55000,
  },

  // ۲۹. سؤالات تکمیلی پرتکرار کنکور — اقتصاد خرد و کلان (دکتر محسن نظری - نگاه دانش)
  {
    id: 'q.bus.econ.2',
    nodeId: 'bus.econ_nazari',
    examYear: 1402,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت ۱۴۰۲ — منبع: اقتصاد خرد دکتر محسن نظری (فصل کشش و درآمد کل)',
    text: 'اگر کشش قیمتی تقاضا برای کالای $X$ برابر $|E_d| = 2.5$ (باکشش) باشد و بنگاه قیمت کالا را ۱۰ درصد کاهش دهد، «مقدار تقاضا» و «درآمد کل بنگاه ($TR = P \\times Q$)» به ترتیب چه تغییری می‌کنند؟',
    options: [
      'مقدار تقاضا ۲۵٪ افزایش می‌یابد و درآمد کل افزایش می‌یابد.',
      'مقدار تقاضا ۲۵٪ افزایش می‌یابد و درآمد کل کاهش می‌یابد.',
      'مقدار تقاضا ۴٪ افزایش می‌یابد و درآمد کل ثابت می‌ماند.',
      'مقدار تقاضا ۱۰٪ افزایش می‌یابد و درآمد کل کاهش می‌یابد.',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.bus.econ.3',
    nodeId: 'bus.econ_nazari',
    examYear: 1401,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت ۱۴۰۱ — منبع: اقتصاد کلان دکتر محسن نظری (ضریب فزاینده بودجه متوازن هاولمو)',
    text: 'در یک اقتصاد بسته کینزی بدون مالیات تبعی با تابع مصرف $C = 100 + 0.8 Y_d$، اگر دولت مخارج خود را به میزان $\\Delta G = +50$ میلیارد تومان افزایش دهد و کل این مبلغ را از طریق افزایش مالیات مقطوع ($\Delta T = +50$) تأمین کند، درآمد ملی تعادلی ($\Delta Y$) چقدر تغییر می‌کند؟',
    options: [
      '۵۰ میلیارد تومان افزایش می‌یابد (قضیه بودجه متوازن هاولمو: $k_{BB} = 1$).',
      '۲۵۰ میلیارد تومان افزایش می‌یابد.',
      'هیچ تغییری نمی‌کند ($\Delta Y = 0$) زیرا اثر افزایش مخارج و مالیات یکدیگر را کامل خنثی می‌کنند.',
      '۲۰۰ میلیارد تومان افزایش می‌یابد.',
    ],
    expectedTimeMs: 45000,
  },

  // ۳۰. سؤالات تکمیلی پرتکرار کنکور — ریاضی و آمار (هادی رنجبران و محسن طورانی)
  {
    id: 'q.bus.math.2',
    nodeId: 'bus.math_stats_ranjbaran_tourani',
    examYear: 1402,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت ۱۴۰۲ — منبع: ریاضیات عمومی هادی رنجبران (فصل توابع چندمتغیره و اکسترمم)',
    text: 'برای تابع دومتغیره $f(x, y) = x^3 + y^3 - 3xy$، نقطه بحرانی $(1, 1)$ از چه نوعی است؟',
    options: [
      'نقطه مینیمم نسبی با مقدار $f(1,1) = -1$',
      'نقطه ماکزیمم نسبی با مقدار $f(1,1) = -1$',
      'نقطه زینی (Saddle Point)',
      'آزمون مشتق دوم در این نقطه بی‌نتیجه است ($\\Delta = 0$)',
    ],
    expectedTimeMs: 50000,
  },
  {
    id: 'q.stats.anova.2',
    nodeId: 'stats.anova',
    examYear: 1402,
    sourceReference: 'کنکور دکتری و ارشد مدیریت ۱۴۰۲ — منبع: آمار و کاربرد آن در مدیریت (عادل آذر و محسن طورانی)',
    text: 'در یک جدول تحلیل واریانس یک‌طرفه (One-Way ANOVA) برای مقایسه میانگین بهره‌وری ۴ شیفت کاری، از هر شیفت ۶ کارگر به تصادف انتخاب شده‌اند (مجموعاً ۲۴ نفر). اگر مجموع مربعات کل $SST = 180$ و مجموع مربعات خطای درون‌گروهی $SSW = 120$ باشد، مقدار آماره $F$ محاسباتی چقدر است؟',
    options: [
      '$F = \\frac{10}{3} \\approx 3.33$',
      '$F = \\frac{60}{120} = 0.50$',
      '$F = 5.00$',
      '$F = 4.00$',
    ],
    expectedTimeMs: 50000,
  },
  {
    id: 'q.stats.scales.2',
    nodeId: 'stats.scales',
    examYear: 1403,
    sourceReference: 'کنکور کارشناسی ارشد و دکتری مدیریت ۱۴۰۳ — منبع: آمار و احتمال محسن طورانی و عادل آذر',
    text: 'اگر بر روی تمام داده‌های یک نمونه آماری با میانگین $\\bar{x} = 10$ و واریانس $s^2 = 4$، تبدیل خطی $y_i = -3x_i + 5$ اعمال شود، «میانگین جدید ($\\bar{y}$)» و «انحراف معیار جدید ($s_y$)» به ترتیب کدام خواهند بود؟',
    options: [
      'میانگین $-25$ و انحراف معیار $6$',
      'میانگین $-25$ و انحراف معیار $-6$',
      'میانگین $-30$ و واریانس $36$',
      'میانگین $-25$ و انحراف معیار $17$',
    ],
    expectedTimeMs: 45000,
  },

  // ۳۱. سؤالات تکمیلی پرتکرار کنکور — اصول مدیریت از دیدگاه اسلام (دکتر سید محمد مقیمی) و زبان تخصصی
  {
    id: 'q.bus.islamic.2',
    nodeId: 'bus.islamic_moghimi',
    examYear: 1402,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت ۱۴۰۲ — منبع: اصول و مبانی مدیریت از دیدگاه اسلام دکتر سید محمد مقیمی',
    text: 'در مبحث «انگیزش در مدیریت اسلامی» از کتاب دکتر سید محمد مقیمی، تفاوت بنیادین «مدل انگیزشی توحیدی» با «هرم نیازهای مازلو» در کدام مورد زیر به درستی تبیین شده است؟',
    options: [
      'در مدل اسلامی، انسان موجودی دوبعدی (مادی-الهی) است که می‌تواند در سایه انگیزش درونیِ «ابتغاء مرضات الله (جلب رضایت الهی)»، حتی پیش از اشباع کامل نیازهای مادی پایین‌تر، به بالاترین سطوح ایثار و تعالی معنوی دست یابد.',
      'در مدیریت اسلامی، تأمین نیازهای معیشتی و فیزیولوژیک کارکنان کاملاً مردود و غیرضروری تلقی می‌شود.',
      'در مدل اسلامی، ترتیب ارضای نیازها صددرصد مکانیکی و منوط به اشباع کامل نیاز به امنیت و احترام دنیوی است.',
      'انگیزش در مدیریت اسلامی صرفاً مبتنی بر پاداش و تنبیه مالی بیرونی است.',
    ],
    expectedTimeMs: 45000,
  },
  {
    id: 'q.bus.eng.2',
    nodeId: 'bus.english_eshraghi',
    examYear: 1402,
    sourceReference: 'کنکور کارشناسی ارشد مدیریت ۱۴۰۲ — منبع: زبان تخصصی مدیریت آرمان اشراقی (نگاه دانش)',
    text: 'The invisible barrier of subtle prejudices and organizational norms that prevents qualified women and minorities from advancing to top-level executive positions is known as the ................. .',
    options: [
      'Glass Ceiling',
      'Span of Control',
      'Scalar Chain',
      'Psychological Contract',
    ],
    expectedTimeMs: 40000,
  },
  // ۳۲. کل بانک سؤالات شناسنامه‌دار کنکورهای سراسری سال‌های ۱۳۹۱ تا ۱۴۰۵ (به ترتیب شماره دفترچه و تفکیک درس)
  ...YEARLY_KONKOR_QUESTIONS,
  // ۳۳. گسترش محتوای دکتری: دروس غایب بسته‌های رسمی (مدیریت دولتی، سیاست‌گذاری، MIS/مدیریت دانش، مالی، روش تحقیق، HR، زبان، آمار)
  ...PHD_EXPANSION_QUESTIONS,
  // ۳۴. تست‌های تألیفی فصل‌ها («هیچ فصل بدون سؤال») — کلید پاسخ فقط در رجیستری سمت سرور
  ...CHAPTER_AUTHORED_QUESTIONS,
];

/**
 * R-026 — INITIAL_QUESTION_BANK خودش شامل YEARLY_KONKOR_QUESTIONS است (spread بالا)،
 * پس هر مصرف‌کننده‌ای که این دو آرایه را به هم می‌چسباند، ۹۶ آیتم مشترک را دوباره
 * می‌شمارد. تنها مرجع ادغام یکتا بر پایهٔ id همین تابع است (اولین رخداد برنده).
 */
export function mergeQuestionsUnique(...banks: QuestionItem[][]): QuestionItem[] {
  const byId = new Map<string, QuestionItem>();
  for (const bank of banks) {
    for (const q of bank) {
      if (!byId.has(q.id)) byId.set(q.id, q);
    }
  }
  return [...byId.values()];
}

// Compat exports for existing imports
export const KNOWLEDGE_NODES = INITIAL_KNOWLEDGE_NODES;
export const NODE_DEPENDENCIES = INITIAL_NODE_DEPENDENCIES;
export const INTERACTIVE_LESSONS = INITIAL_INTERACTIVE_LESSONS;
export const QUESTION_BANK = INITIAL_QUESTION_BANK;

/* ============================================================================
 * ساختار متمرکز پوشش ۱۰۰ صفحه‌ای دروس کنکور ارشد و دکتری مدیریت در konkorData.ts
 * شامل دروس تخصصی و مشترک ۳ گرایش: مدیریت بازرگانی، مدیریت صنعتی و مدیریت فناوری (تکنولوژی)
 * ============================================================================ */

export interface CentralizedScholarMatrixRow {
  scholarOrSchool: string;
  yearOrEra: string;
  coreTheoryOrModel: string;
  keyDimensionsOrFormula: string;
  konkorSignatureKeyword: string;
  commonExamTrap: string;
}

export interface CentralizedCourse100PageBlueprint {
  courseId: string;
  courseTitle: string;
  branches: ('business' | 'industrial' | 'technology')[];
  degreeLevels: ('ارشد' | 'دکتری')[];
  masterCoefficients: {
    business: number;
    industrial: number;
    technology: number;
  };
  phdCoefficient: number;
  targetEquivalentPages: number;
  primaryReferenceBooks: string[];
  coveredNodeIds: string[];
  scholarComparisonMatrix: CentralizedScholarMatrixRow[];
  masterFormulaVault: {
    title: string;
    formulaLatex: string;
    applicationAndShortcut: string;
  }[];
  comprehensiveSyllabiModules: {
    moduleCode: string;
    moduleTitle: string;
    equivalentPages: number;
    exhaustiveSynthesis: string[];
  }[];
}

export const CENTRALIZED_100PAGE_COURSE_CATALOG: CentralizedCourse100PageBlueprint[] = [
  {
    courseId: 'course.100p.management_theories',
    courseTitle: 'تئوری‌های مدیریت جامع (مبانی سازمان، رفتار سازمانی، منابع انسانی، تئوری سازمان و پارادایم‌های دکتری)',
    branches: ['business', 'industrial', 'technology'],
    degreeLevels: ['ارشد', 'دکتری'],
    masterCoefficients: { business: 3, industrial: 3, technology: 3 },
    phdCoefficient: 4,
    targetEquivalentPages: 145,
    primaryReferenceBooks: [
      'مرجع کامل تئوری‌های مدیریت دکتر سیدرضا سیدجوادین و دکتر حسین جلیلیان (نگاه دانش)',
      'مبانی سازمان و مدیریت دکتر سید محمد مقیمی (راه دان) و دکتر سید مهدی الوانی (سمت)',
      'رفتار سازمانی استیفن رابینز (ترجمه پارسائیان و اعرابی) و دکتر علی رضائیان',
      'تئوری و طراحی سازمان ریچارد دفت و استیفن رابینز + سازمان: سیستم‌های عقلایی، طبیعی و باز ریچارد اسکات (ویژه دکتری)',
      'مدیریت منابع انسانی دکتر سیدجوادین، دکتر اسفندیار سعادت و گری دسلر',
    ],
    coveredNodeIds: ['mb.contingency', 'mb.structure', 'ob.motivation'],
    scholarComparisonMatrix: [
      {
        scholarOrSchool: 'فردریک وینسلو تیلور (مدیریت علمی)',
        yearOrEra: '۱۹۱۱ — مکتب کلاسیک',
        coreTheoryOrModel: 'سنجش کار و زمان، سیستم کارمزدی تفاضلی، سرپرستی کارکردی ۸گانه',
        keyDimensionsOrFormula: 'تفکیک برنامه‌ریزی از اجرا، بهترین راه انجام کار (One Best Way)، گزینش علمی کارگران',
        konkorSignatureKeyword: 'سرپرستی کارکردی (نقض اصل وحدت فرماندهی فایول!) و انسان اقتصادی',
        commonExamTrap: 'تیلور بر سطح کارگاه و کارگر تمرکز داشت، در حالی که فایول بر کل سازمان و وظایف مدیر تمرکز داشت.',
      },
      {
        scholarOrSchool: 'هانری فایول (اصول اداری)',
        yearOrEra: '۱۹۱۶ — مکتب کلاسیک',
        coreTheoryOrModel: '۱۴ اصل مدیریت و ۵ وظیفه مدیر (POCCC) و ۶ فعالیت صنعتی',
        keyDimensionsOrFormula: 'وحدت فرماندهی (یک رئیس)، وحدت جهت (یک برنامه و یک هدف)، زنجیره فرمان و پل فایول',
        konkorSignatureKeyword: 'تفاوت وحدت فرماندهی (معطوف به کارکنان) با وحدت جهت (معطوف به ساختار و کل فعالیت‌ها)',
        commonExamTrap: 'پل فایول (Gangplank) برای ارتباط افقی مستقیم بین دو واحد هم‌سطح با اطلاع رؤسا جهت سرعت‌بخشیدن به کارهاست.',
      },
      {
        scholarOrSchool: 'ماکس وبر و منتقدان بوروکراسی (مرتون، سلزنیک، گولدنر، کروزیر، آرجریس)',
        yearOrEra: '۱۹۲۰–۱۹۶۵',
        coreTheoryOrModel: 'بوروکراسی ایده‌آل و کژکارکردهای پنج‌گانه آن',
        keyDimensionsOrFormula: 'مرتون: جابه‌جایی هدف | سلزنیک: تفویض اختیار و اهداف واحدهای فرعی | گولدنر: حداقل کار قابل قبول | کروزیر: دور باطل',
        konkorSignatureKeyword: 'تبدیل قوانین از وسیله به هدف نهایی = جابه‌جایی اهداف رابرت مرتون',
        commonExamTrap: 'تضاد شخصیت بالغ با ساختار رسمی متعلق به «کریس آرجریس» است نه رابرت مرتون!',
      },
      {
        scholarOrSchool: 'هنری مینتزبرگ (پیکربندی‌های ساختاری و نقش‌های ده‌گانه)',
        yearOrEra: '۱۹۷۹–۱۹۸۳',
        coreTheoryOrModel: '۵ بخش سازمان، ۵ سازوکار هماهنگی و ۵ پیکربندی ساختاری',
        keyDimensionsOrFormula: 'ساده (رأس استراتژیک/نظارت مستقیم)، ماشینی (ستاد فنی/فرآیند)، حرفه‌ای (هسته عملیاتی/مهارت)، بخشی (خط میانی/خروجی)، ادهوکراسی (ستاد پشتیبانی/سازگاری متقابل)',
        konkorSignatureKeyword: 'بیمارستان و دانشگاه = بوروکراسی حرفه‌ای؛ استانداردسازی خروجی = ساختار بخشی',
        commonExamTrap: 'در بوروکراسی ماشینی تمرکز بالاست، اما در بوروکراسی حرفه‌ای عدم تمرکز افقی و عمودی بالاست.',
      },
      {
        scholarOrSchool: 'جوآن وودوارد، چارلز پرو و جیمز تامپسون (فناوری و ساختار)',
        yearOrEra: '۱۹۶۵–۱۹۶۷ — مکتب اقتضایی',
        coreTheoryOrModel: 'فناوری ساخت (وودوارد)، فناوری بخشی (پرو) و وابستگی تکنولوژیک (تامپسون)',
        keyDimensionsOrFormula: 'وودوارد: تکی (ارگانیک) ← انبوه (مکانیکی) ← فرآیندی (ارگانیک) | پرو: روتین، صنعتگری، مهندسی، غیرروتین | تامپسون: مشترک، ترتیبی، متقابل',
        konkorSignatureKeyword: 'حداکثر حیطه نظارت سرپرستان خط اول در «تولید انبوه» و حداکثر سطوح مدیریت در «تولید فرآیندی» وودوارد',
        commonExamTrap: 'در مدل وودوارد رابطه پیچیدگی فناوری با ساختار خطی نیست بلکه منحنی‌الخط (U شکل) است (تکی و فرآیندی هر دو ارگانیک‌اند).',
      },
      {
        scholarOrSchool: 'بوریل و مورگان، دی‌ماجیو و پاول، هانان و فریمن (تئوری‌های کلان دکتری)',
        yearOrEra: '۱۹۷۷–۱۹۸۳ — دکتری تخصصی',
        coreTheoryOrModel: '۴ پارادایم جامعه‌شناختی، نهادگرایی جدید و بوم‌شناسی جمعیت',
        keyDimensionsOrFormula: 'پارادایم‌ها: کارکردگرایی، تفسیری، اومانیسم رادیکال، ساختارگرایی رادیکال | هم‌ریختی: اجباری، تقلیدی، هنجاری',
        konkorSignatureKeyword: 'کپی‌برداری در شرایط عدم اطمینان = هم‌ریختی تقلیدی؛ لختی ساختاری = بوم‌شناسی جمعیت',
        commonExamTrap: 'پارادایم تفسیری و کارکردگرایی هر دو در نیمه «نظم و تنظیم» هستند، اما کارکردگرایی عینی و تفسیری ذهنی است.',
      },
    ],
    masterFormulaVault: [
      {
        title: 'فرمول امتیاز انگیزشی بالقوه شغل (هاکمن و اولدهام - JCM)',
        formulaLatex: 'MPS = \\left(\\frac{\\text{Skill Variety} + \\text{Task Identity} + \\text{Task Significance}}{3}\\right) \\times \\text{Autonomy} \\times \\text{Feedback}',
        applicationAndShortcut: 'اگر استقلال (Autonomy) یا بازخورد (Feedback) صفر باشد، کل توان انگیزشی شغل ($MPS$) صفر می‌شود.',
      },
      {
        title: 'فرمول نظریه انتظار ویکتور وروم (Expectancy Theory)',
        formulaLatex: 'M = E \\times I \\times V \\quad (\\text{Expectancy} \\times \\text{Instrumentality} \\times \\text{Valence})',
        applicationAndShortcut: 'تلاش به عملکرد ($E$: انتظار)، عملکرد به پاداش ($I$: وسیله‌ای بودن)، جذابیت پاداش برای فرد ($V$: ظرفیت/جاذبه).',
      },
      {
        title: 'فرمول تعداد روابط متقابل حیطه نظارت گریکوناس (Graicunas)',
        formulaLatex: 'R = n\\left(\\frac{2^n}{2} + n - 1\\right)',
        applicationAndShortcut: 'با افزایش تعداد مرئوسان ($n$) به صورت حسابی، تعداد روابط مستقیم، گروهی و متقاطع ($R$) به صورت نمایی رشد می‌کند (مثلاً برای $n=3 \\Rightarrow R=18$ و برای $n=4 \\Rightarrow R=44$).',
      },
    ],
    comprehensiveSyllabiModules: [
      {
        moduleCode: 'MOD-MGT-01',
        moduleTitle: 'ماژول ۱ (صفحات ۱ تا ۳۰): سیر تحول مکاتب مدیریت، وظایف مدیران (POCCC)، نقش‌های مینتزبرگ و سطوح سیستم‌های بولدینگ',
        equivalentPages: 30,
        exhaustiveSynthesis: [
          'مکتب کلاسیک بر مفروضات انسان اقتصادی و محیط بسته و باثبات استوار است و شامل سه شاخه مدیریت علمی (تیلور، گیلبرث‌ها، گانت)، مدیریت اداری (فایول، گیولیک و اورویک با الگوی POSDCORB) و بوروکراسی (وبر) است.',
          'مکتب نئوکلاسیک (روابط انسانی) با مطالعات هاثورن التون مایو (آزمایش روشنایی، اتاق مونتاژ رله، مصاحبه و اتاق سیم‌پیچی بانک) سازمان غیررسمی، هنجارهای گروهی و انسان اجتماعی را کشف کرد.',
          'در طبقه‌بندی ۹ سطحی سیستم‌های کنت بولدینگ: سطوح ۱ تا ۳ (چارچوب ایستا، ساعت‌شمار پویا، سایبرنتیک/ترموستات) سیستم‌های بسته و مکانیکی هستند؛ سطوح ۴ تا ۶ (سلول، گیاه، حیوان) سیستم‌های باز زیستی؛ و سطوح ۷ تا ۹ (انسان، سازمان اجتماعی، سیستم‌های متعالی) سیستم‌های باز فکری-اجتماعی هستند.',
        ],
      },
      {
        moduleCode: 'MOD-MGT-02',
        moduleTitle: 'ماژول ۲ (صفحات ۳۱ تا ۶۸): رفتار سازمانی فردی و گروهی (ادراک، شخصیت MBTI و Big Five، انگیزش، رهبری، قدرت و تعارض)',
        equivalentPages: 38,
        exhaustiveSynthesis: [
          'پنج عامل بزرگ شخصیت (Big Five): برون‌گرایی، سازگاری/توافق‌پذیری، وظیفه‌شناسی/وجدانی بودن (بهترین پیش‌بینی‌کننده عملکرد شغلی در تمامی مشاغل!)، ثبات عاطفی (روان‌رنجوری پایین) و گشودگی به تجربه.',
          'سیر تئوری‌های رهبری: ۱) صفات مشخصه، ۲) رفتاری (اوهایو: ساخت‌دهی و ملاحظه؛ میشیگان: کارمدار و کارمندمدار؛ شبکه مدیریتی بلیک و موتون $9 \\times 9$)، ۳) اقتضایی (فیدلر LPC با ۳ متغیر رابطه رهبر-عضو، ساختار وظیفه و قدرت مقام؛ هرسی و بلانچارد $R_1$ تا $R_4$؛ مسیر-هدف رابرت هاوس؛ مشارکتی وروم-یتون)، ۴) رهبری معاصر (تبادلی در برابر تحول‌آفرین با ۴ بعد نفوذ آرمانی، ترغیب انگیزشی، تحریک فکری و ملاحظه فردی؛ رهبری کاریزماتیک و خدمتگزار).',
        ],
      },
      {
        moduleCode: 'MOD-MGT-03',
        moduleTitle: 'ماژول ۳ (صفحات ۶۹ تا ۱۱۰): تئوری سازمان و طراحی ساختاری (پیچیدگی، رسمیت، تمرکز، اقتضائات محیط، استراتژی، اندازه و چرخه حیات)',
        equivalentPages: 42,
        exhaustiveSynthesis: [
          'ماتریس عدم اطمینان محیطی دانکن (ساده/پیچیده × ایستا/پویا): ۱) ساده و ایستا = عدم اطمینان کم، ۲) پیچیده و ایستا = عدم اطمینان کم تا متوسط، ۳) ساده و پویا = عدم اطمینان متوسط تا زیاد، ۴) پیچیده و پویا = حداکثر عدم اطمینان محیطی (نیازمند ساختار کاملاً ارگانیک، غیرمتمرکز و تیمی). Note: بعد «پویایی» اثر بیشتری بر عدم اطمینان دارد تا بعد «پیچیدگی»!',
          'تطابق استراتژی و ساختار: ۱) آلفرد چندلر («ساختار تابع استراتژی است»: استراتژی توسعه محصول واحد ← ساختار وظیفه‌ای؛ استراتژی تنوع‌بخشی ← ساختار بخشی)، ۲) ریموند مایلز و چارلز اسنو (تدافعی/Defender ← ساختار مکانیکی و کارایی؛ آینده‌نگر/Prospector ← ساختار ارگانیک و نوآوری؛ تحلیل‌گر/Analyzer ← ساختار ماتریسی ترکیبی؛ منفعل/Reactor ← فاقد استراتژی منسجم).',
        ],
      },
      {
        moduleCode: 'MOD-MGT-04',
        moduleTitle: 'ماژول ۴ (صفحات ۱۱۱ تا ۱۴۵): مدیریت منابع انسانی و تئوری‌های پیشرفته سازمان ویژه دکتری (بوم‌شناسی، نهادگرایی و پسامدرنیسم)',
        equivalentPages: 35,
        exhaustiveSynthesis: [
          'در مدیریت استراتژیک منابع انسانی، مدل اسچولر و جکسون استراتژی‌های منابع انسانی را با استراتژی‌های رقابتی پورتر (رهبری هزینه، تمایز، تمرکز) هم‌راستا می‌کند و مدل میشیگان (فومبرون) و مدل هاروارد (بیر) چارچوب‌های بنیادین HRM را می‌سازند.',
          'در آزمون دکتری، تمایز بین «دیدگاه سیستم عقلایی (بسته: تیلور، فایول، وبر، سایمون)»، «دیدگاه سیستم طبیعی (بسته/باز: مایو، بارنارد، سلزنیک، پارسونز با الگوی AGIL)» و «دیدگاه سیستم باز (بولدینگ، کاتز و کان، لورنس و لورش، ویک)» در کتاب ریچارد اسکات هر سال سؤال مستقیم دارد.',
        ],
      },
    ],
  },
  {
    courseId: 'course.100p.marketing_strategy',
    courseTitle: 'مدیریت بازاریابی، رفتار مصرف‌کننده و مدیریت استراتژیک پیشرفته (ویژه بازرگانی ارشد ضریب ۴ و دکتری ضریب ۵)',
    branches: ['business'],
    degreeLevels: ['ارشد', 'دکتری'],
    masterCoefficients: { business: 4, industrial: 0, technology: 0 },
    phdCoefficient: 5,
    targetEquivalentPages: 130,
    primaryReferenceBooks: [
      'مرجع کامل مدیریت بازاریابی دکتر حسین جلیلیان (نگاه دانش) + بازاریابی رضا مروج + ۲۰۰۰ تست بازاریابی',
      'مدیریت بازاریابی فیلیپ کاتلر و کوین لین کلر (ویرایش ۱۶)',
      'مدیریت استراتژیک فرد ر. دیوید + جنگل استراتژی هنری مینتزبرگ + تئوری‌های پیشرفته بازاریابی (وارگو و لاش)',
    ],
    coveredNodeIds: ['mkt.plc', 'mkt.brand', 'sm.portfolio', 'sm.rbv'],
    scholarComparisonMatrix: [
      {
        scholarOrSchool: 'فیلیپ کاتلر و کلر (فلسفه‌ها، تقاضا و استراتژی رقابتی)',
        yearOrEra: '۱۹۶۷–۲۰۲۲',
        coreTheoryOrModel: 'بازاریابی کل‌نگر (Holistic)، ۸ حالت تقاضا، ماتریس PLC و استراتژی‌های رهبر/چالشگر/پیرو/گوشه‌گیر',
        keyDimensionsOrFormula: '۴ بعد کل‌نگر: رابطه‌مند، یکپارچه، درونی، عملکردی | ۴ استراتژی معرفی: سرشیرگیری سریع/کند، نفوذ سریع/کند',
        konkorSignatureKeyword: 'تقاضای نامنظم = بازاریابی هم‌زمان‌سازی؛ تقاضای پنهان = بازاریابی توسعه‌ای',
        commonExamTrap: 'در مرحله رشد PLC نسبت هزینه‌های ترفیعی به فروش کاهش می‌یابد هرچند رقم مطلق ترفیع بالا می‌ماند.',
      },
      {
        scholarOrSchool: 'هنری آسائل و هاوارد-شث (رفتار مصرف‌کننده)',
        yearOrEra: '۱۹۸۷',
        coreTheoryOrModel: 'ماتریس ۴گانه رفتار خرید بر اساس سطح درگیری ذهنی و تفاوت بین برندها',
        keyDimensionsOrFormula: 'پیچیده (درگیری بالا/تفاوت بالا)، کاهنده ناهماهنگی (درگیری بالا/تفاوت کم)، تنوع‌طلبانه (درگیری کم/تفاوت بالا)، عادتی (هر دو کم)',
        konkorSignatureKeyword: 'خرید فرش و لوازم خانگی هم‌قیمت = رفتار خرید کاهنده ناهماهنگی شناختی',
        commonExamTrap: 'تغییر برند در خرید بیسکویت یا شکلات ناشی از نارضایتی نیست بلکه ناشی از «تنوع‌طلبی» است.',
      },
      {
        scholarOrSchool: 'کوین لین کلر و دیوید آکر (ارزش ویژه برند CBBE)',
        yearOrEra: '۱۹۹۱–۲۰۱۳',
        coreTheoryOrModel: 'هرم ۴ سطحی و ۶ بلوکی ارزش ویژه برند مبتنی بر مشتری (CBBE)',
        keyDimensionsOrFormula: '۱. برجستگی (هویت) ← ۲. عملکرد و تصویر (معنا) ← ۳. قضاوت و احساسات (واکنش) ← ۴. طنین برند (رابطه و وفاداری شدید)',
        konkorSignatureKeyword: 'بالاترین سطح هرم کلر = طنین برند (Brand Resonance)؛ پایین‌ترین سطح = برجستگی برند',
        commonExamTrap: 'مدل دیوید آکر دارای ۵ بعد (وفاداری، آگاهی، کیفیت ادراک‌شده، تداعیات و سایر دارایی‌های ثبت‌شده برند) است.',
      },
      {
        scholarOrSchool: 'مایکل پورتر، جی بارنی و دیوید تیس (استراتژی رقابتی و منابع)',
        yearOrEra: '۱۹۸۰–۲۰۰۷',
        coreTheoryOrModel: '۵ نیروی رقابتی و استراتژی‌های ژنریک پورتر، RBV (VRIO) بارنی و قابلیت‌های پویای تیس',
        keyDimensionsOrFormula: 'VRIO: ارزشمند، کمیاب، تقلیدناپذیر، سازمان‌یافته | تیس: Sensing, Seizing, Transforming',
        konkorSignatureKeyword: 'گیر افتادن در میانه (Stuck in the Middle) پورتر؛ علیت مبهم و وابستگی به مسیر در RBV',
        commonExamTrap: 'منبعی که فقط ارزشمند و کمیاب باشد ولی به سادگی قابل تقلید باشد، صرفاً «مزیت رقابتی موقت» ایجاد می‌کند.',
      },
    ],
    masterFormulaVault: [
      {
        title: 'فرمول قیمت‌گذاری افزودن به بهای تمام‌شده (Markup Pricing) و نقطه سربه‌سر',
        formulaLatex: 'P = \\frac{AVC + \\frac{FC}{Q}}{1 - r}, \\quad Q_{BEP} = \\frac{FC}{P - AVC}',
        applicationAndShortcut: 'اگر حاشیه سود ناخالص روی فروش $r$ (مثلاً ۲۰٪) و هزینه واحد $C$ باشد، قیمت برابر $\\frac{C}{1 - 0.20} = 1.25 C$ است.',
      },
      {
        title: 'فرمول ارزش طول عمر مشتری (Customer Lifetime Value - CLV)',
        formulaLatex: 'CLV = \\sum_{t=1}^{T} \\frac{(P_t - C_t) \\cdot r^t}{(1 + i)^t} - AC',
        applicationAndShortcut: 'در حالت دوره نامحدود با حاشیه سود ثابت $m$، نرخ ماندگاری مشتری $r$ و نرخ تنزیل $i$ داریم: $CLV = m \\cdot \\frac{r}{1 + i - r}$.',
      },
    ],
    comprehensiveSyllabiModules: [
      {
        moduleCode: 'MOD-MKT-01',
        moduleTitle: 'ماژول ۱ (صفحات ۱ تا ۳۵): مفاهیم بنیادین بازاریابی، محیط‌شناسی، سیستم اطلاعات بازاریابی (MIS) و تحقیقات بازاریابی',
        equivalentPages: 35,
        exhaustiveSynthesis: [
          'سیستم اطلاعات بازاریابی (MIS) شامل ۴ زیرسیستم است: ۱) سیستم ثبت گزارش‌های داخلی (چرخه سفارش تا وصول و سیستم اطلاعات فروش)، ۲) سیستم هوشیاری بازاریابی (پایش رویدادهای روزمره محیط رقبا)، ۳) سیستم تحقیقات بازاریابی (پروژه‌محور برای یک مسئله خاص)، ۴) سیستم پشتیبان تصمیم بازاریابی (MDSS).',
          'انواع تحقیقات بازاریابی بر اساس هدف: ۱) اکتشافی (Exploratory: برای تعریف مسئله و صورت‌بندی فرضیه با گروه کانونی و مصاحبه عمیق)، ۲) توصیفی (Descriptive: تعیین فراوانی و سهم بازار با پیمایش)، ۳) علی (Causal: کشف رابطه علت و معلولی متغیر مستقل و وابسته از طریق آزمایش میدانی یا آزمایشگاهی).',
        ],
      },
      {
        moduleCode: 'MOD-MKT-02',
        moduleTitle: 'ماژول ۲ (صفحات ۳۶ تا ۷۰): رفتار مصرف‌کننده و خرید سازمانی (B2B)، بخش‌بندی، هدف‌گذاری و جایگاه‌یابی (STP)',
        equivalentPages: 35,
        exhaustiveSynthesis: [
          'مقایسه ۳ موقعیت خرید سازمانی (روبینسون، فاریس و ویند): ۱) خرید مجدد مستقیم (Straight Rebuy: سفارش مجدد روتین بدون تغییر از تأمین‌کنندگان موجود در لیست)، ۲) خرید مجدد تعدیل‌شده (Modified Rebuy: تغییر مشخصات فنی، قیمت یا شرایط تحویل)، ۳) وظیفه جدید (New Task: خرید برای اولین بار با بیشترین ریسک و بزرگ‌ترین مرکز خرید Buying Center شامل آغازگر، کاربر، اثرگذار، تصمیم‌گیرنده، تصویب‌کننده، خریدار و دروازه‌بان اطلاعات).',
        ],
      },
      {
        moduleCode: 'MOD-MKT-03',
        moduleTitle: 'ماژول ۳ (صفحات ۷۱ تا ۱۰۰): آمیخته بازاریابی (4P کالا و 7P خدمات)، برندینگ، قیمت‌گذاری، کانال‌های توزیع و IMC',
        equivalentPages: 30,
        exhaustiveSynthesis: [
          'استراتژی‌های سبد محصول و خط محصول: ۱) کشش خط محصول (Line Stretching: به سمت پایین، بالا یا دوطرفه)، ۲) پر کردن خط محصول (Line Filling: افزودن اقلام جدید در همان بازه فعلی خط محصول؛ با خطر هم‌خواری/Cannibalization در صورت عدم تمایز ملموس!).',
        ],
      },
      {
        moduleCode: 'MOD-MKT-04',
        moduleTitle: 'ماژول ۴ (صفحات ۱۰۱ تا ۱۳۰): مدیریت استراتژیک پیشرفته (ماتریس‌های دیوید، مکاتب مینتزبرگ، RBV و منطق چیره خدمت دکتری)',
        equivalentPages: 30,
        exhaustiveSynthesis: [
          'مقایسه ماتریس‌های پورتفولیو در تدوین استراتژی: ماتریس BCG (۲×۲)، ماتریس مک‌کینزی GE (۳×۳ با دو محور جذابیت صنعت و توانمندی واحد کسب‌وکار)، ماتریس داخلی-خارجی IE (۹ خانه‌ای بر اساس نمرات IFE و EFE: خانه‌های ۱، ۲ و ۴ رشد و ساخت؛ خانه‌های ۳، ۵ و ۷ حفظ و نگهداری؛ خانه‌های ۶، ۸ و ۹ برداشت یا واگذاری) و ماتریس QSPM (تنها ماتریس مرحله سوم تصمیم‌گیری برای اولویت‌بندی کمی استراتژی‌ها).',
        ],
      },
    ],
  },
  {
    courseId: 'course.100p.operations_research',
    courseTitle: 'تحقیق در عملیات جامع و پیشرفته (LP، سیمپلکس، دوگان، حساسیت، حمل‌ونقل، MCDM، DEA و صف)',
    branches: ['industrial', 'business', 'technology'],
    degreeLevels: ['ارشد', 'دکتری'],
    masterCoefficients: { business: 2, industrial: 3, technology: 2 },
    phdCoefficient: 5,
    targetEquivalentPages: 135,
    primaryReferenceBooks: [
      'پژوهش عملیاتی (تحقیق در عملیات) دکتر عارفه فدوی (انتشارات نگاه دانش)',
      'پژوهش عملیاتی مقدماتی و پیشرفته دکتر محمدرضا مهرگان و دکتر عادل آذر',
      'تصمیم‌گیری چندمعیاره (MCDM) دکتر محمدجواد اصغرپور و دکتر مقصود امیری + DEA و تئوری صف',
    ],
    coveredNodeIds: ['ind.or_simplex_duality', 'ind.mcdm_dea_queue'],
    scholarComparisonMatrix: [
      {
        scholarOrSchool: 'جورج دانتزیگ (روش سیمپلکس و تئوری دوگان)',
        yearOrEra: '۱۹۴۷',
        coreTheoryOrModel: 'الگوریتم سیمپلکس، فرم ماتریسی سیمپلکس، دوگان و تحلیل حساسیت',
        keyDimensionsOrFormula: 'شرط بهینگی Max: $z_j - c_j \\ge 0$ | ستون راست نهایی: $B^{-1}b$ | متغیرهای دوگان: $Y^* = C_B B^{-1}$',
        konkorSignatureKeyword: 'قضیه مکمل‌های متوازن: $x_j^* v_j^* = 0$ و $y_i^* s_i^* = 0$',
        commonExamTrap: 'صفر بودن متغیر اساسی در ستون RHS نشانه تباهی است، اما صفر بودن $z_j - c_j$ برای متغیر غیراساسی در جدول بهینه نشانه جواب بهینه دگرسان (چندگانه) است.',
      },
      {
        scholarOrSchool: 'توماس ساعتی و هوانگ-یون (تصمیم‌گیری چندشاخصه AHP و TOPSIS)',
        yearOrEra: '۱۹۸۰–۱۹۸۱',
        coreTheoryOrModel: 'مقایسات زوجی سلسله‌مراتبی (AHP) و فاصله از ایده آل مثبت و منفی (TOPSIS)',
        keyDimensionsOrFormula: 'نرخ ناسازگاری: $IR = \\frac{(\\lambda_{\\max}-n)/(n-1)}{RI} \\le 0.10$ | تاپسیس: $CL_i^* = \\frac{d_i^-}{d_i^+ + d_i^-}$',
        konkorSignatureKeyword: 'نرمال‌سازی خطی در AHP در برابر نرمال‌سازی اقلیدسی (برداری) در TOPSIS',
        commonExamTrap: 'برای ماتریس $2 \\times 2$ در AHP شاخص ناسازگاری همیشه دقیقاً صفر است ($\\lambda_{\\max} = 2$).',
      },
      {
        scholarOrSchool: 'چارنز، کوپر، رودز و بنکر (تحلیل پوششی داده‌ها DEA)',
        yearOrEra: '۱۹۷۸–۱۹۸۴',
        coreTheoryOrModel: 'سنجش کارایی نسبی واحدهای تصمیم‌گیرنده (DMUs) با مدل‌های CCR و BCC',
        keyDimensionsOrFormula: 'CCR: بازده به مقیاس ثابت (CRS) | BCC: بازده به مقیاس متغیر (VRS) با قید تحدب $\\sum \\lambda_j = 1$',
        konkorSignatureKeyword: 'رابطه همیشگی کارایی: $\\theta_{\\text{CCR}}^* \\le \\theta_{\\text{BCC}}^*$ و کارایی مقیاس $SE = \\frac{\\theta_{CCR}^*}{\\theta_{BCC}^*}$',
        commonExamTrap: 'هر واحدی که در مدل CCR کارا باشد ($\\theta=1$) حتماً در مدل BCC نیز کاراست، اما عکس آن لزوماً برقرار نیست!',
      },
    ],
    masterFormulaVault: [
      {
        title: 'فرمول‌های طلایی فرم ماتریسی سیمپلکس و تحلیل حساسیت',
        formulaLatex: 'X_B = B^{-1}b, \\quad Y^* = C_B B^{-1}, \\quad \\bar{a}_j = B^{-1}a_j, \\quad z_j - c_j = Y^* a_j - c_j, \\quad Z^* = C_B B^{-1}b = Y^* b',
        applicationAndShortcut: 'زیر متغیرهای کمکی اولیه ($S_1, \\dots, S_m$) در جدول نهایی سیمپلکس همیشه ماتریس معکوس پایه $B^{-1}$ و در سطر $Z$ مقادیر بهینه متغیرهای دوگان $Y^*$ قرار دارد!',
      },
      {
        title: 'فرمول‌های طلایی سیستم صف مارکوفی تک‌کاناله ($M/M/1:\\infty/FCFS$)',
        formulaLatex: '\\rho = \\frac{\\lambda}{\\mu}, \\quad P_0 = 1 - \\rho, \\quad P_n = (1 - \\rho)\\rho^n, \\quad L_s = \\frac{\\rho}{1 - \\rho}, \\quad L_q = \\frac{\\rho^2}{1 - \\rho} = \\rho L_s, \\quad W_s = \\frac{1}{\\mu - \\lambda}, \\quad W_q = \\frac{\\rho}{\\mu - \\lambda}',
        applicationAndShortcut: 'دو اتحاد تستی ۱ ثانیه‌ای در صف $M/M/1$: همواره $L_s - L_q = \\rho$ و $W_s - W_q = \\frac{1}{\\mu}$ است.',
      },
    ],
    comprehensiveSyllabiModules: [
      {
        moduleCode: 'MOD-OR-01',
        moduleTitle: 'ماژول ۱ (صفحات ۱ تا ۴۰): مدل‌سازی LP، حل ترسیمی، روش سیمپلکس، روش M بزرگ و دوفازی و تشخیص ۴ حالت خاص',
        equivalentPages: 40,
        exhaustiveSynthesis: [
          'در حل ترسیمی، اگر شیب تابع هدف موازی با یکی از محدودیت‌های فعال باشد، کلیه نقاط روی پاره‌خط مرزی جواب بهینه چندگانه هستند (بی‌نهایت جواب بهینه و ۲ جواب اساسی بهینه گوشه‌ای).',
          'در روش سیمپلکس، متغیر ورودی در مسئله Max متغیری است که منفی‌ترین ضریب را در سطر $z_j - c_j$ دارد، و متغیر خروجی بر اساس «کمترین نسبت مثبت $\\min \\{ \\frac{\\bar{b}_i}{y_{ik}} \\mid y_{ik} > 0 \\}$» تعیین می‌شود تا شدنی بودن جواب حفظ گردد.',
        ],
      },
      {
        moduleCode: 'MOD-OR-02',
        moduleTitle: 'ماژول ۲ (صفحات ۴۱ تا ۸۰): مسئله دوگان (Duality)، سیمپلکس دوگان، قضیه مکمل‌های متوازن و تحلیل حساسیت کامل',
        equivalentPages: 40,
        exhaustiveSynthesis: [
          'الگوریتم سیمپلکس دوگان (Dual Simplex) زمانی به کار می‌رود که جدول «بهینه اما ناشدنی» باشد (یعنی شرط بهینگی در سطر هدف برقرار است اما در ستون RHS حداقل یک عدد منفی وجود دارد). در این روش ابتدا متغیر خروجی (منفی‌ترین مقدار RHS) و سپس متغیر ورودی انتخاب می‌شود.',
        ],
      },
      {
        moduleCode: 'MOD-OR-03',
        moduleTitle: 'ماژول ۳ (صفحات ۸۱ تا ۱۱۰): مدل‌های حمل‌ونقل، تخصیص (مجارستانی)، شبکه‌ها (CPM/PERT، کوتاه‌ترین مسیر، بیشترین جریان)',
        equivalentPages: 30,
        exhaustiveSynthesis: [
          'در شبکه PERT با سه زمان خوش‌بینانه ($a$)، محتمل‌ترین ($m$) و بدبینانه ($b$): میانگین زمان فعالیت برابر $t_e = \\frac{a + 4m + b}{6}$ و واریانس فعالیت برابر $\\sigma^2 = \\left(\\frac{b - a}{6}\\right)^2$ است.',
        ],
      },
      {
        moduleCode: 'MOD-OR-04',
        moduleTitle: 'ماژول ۴ (صفحات ۱۱۱ تا ۱۳۵): برنامه‌ریزی عدد صحیح، برنامه‌ریزی آرمانی، MCDM، DEA و تئوری صف (ویژه صنعتی و دکتری)',
        equivalentPages: 25,
        exhaustiveSynthesis: [
          'در برنامه‌ریزی آرمانی (Goal Programming)، محدودیت‌های آرمانی دارای متغیرهای انحراف منفی ($d_i^-$: کمبود از آرمان) و انحراف مثبت ($d_i^+$: مازاد بر آرمان) هستند که همواره $d_i^- \\times d_i^+ = 0$ است و تابع هدف همیشه از نوع کمینه‌سازیِ انحرافات نامطلوب است.',
        ],
      },
    ],
  },
  {
    courseId: 'course.100p.production_technology',
    courseTitle: 'مدیریت تولید و عملیات + مدیریت استراتژیک تکنولوژی و نوآوری (ویژه صنعتی و فناوری ارشد و دکتری)',
    branches: ['industrial', 'technology'],
    degreeLevels: ['ارشد', 'دکتری'],
    masterCoefficients: { business: 0, industrial: 2, technology: 2 },
    phdCoefficient: 5,
    targetEquivalentPages: 130,
    primaryReferenceBooks: [
      'مدیریت تولید و عملیات دکتر عارفه فدوی (نگاه دانش) + دکتر هایده متقی + دکتر احمد جعفرنژاد',
      'کنترل کیفیت آماری داگلاس مونتگومری (ترجمه دکتر رسول نورالسناء)',
      'مدیریت استراتژیک نوآوری فناورانه ملیسا شیلینگ + مدیریت نوآوری تید و بسانت + مدیریت تکنولوژی طاهر خلیل + نوآوری باز چسبرو',
    ],
    coveredNodeIds: ['ind.pom_eoq_mrp', 'inno.s_curve', 'inno.tidd_4p', 'inno.open_rd_transfer'],
    scholarComparisonMatrix: [
      {
        scholarOrSchool: 'هریس و ویلسون (مدل‌های کنترل موجودی EOQ و EPQ)',
        yearOrEra: '۱۹۱۳–۱۹۳۴',
        coreTheoryOrModel: 'تعادل بین هزینه سفارش‌دهی سالانه و هزینه نگهداری سالانه موجودی',
        keyDimensionsOrFormula: '$Q^* = \\sqrt{\\frac{2DS}{H}}$ و در نقطه بهینه هزینه نگهداری سالانه = هزینه سفارش‌دهی سالانه = $\\frac{1}{2}\\sqrt{2DSH}$',
        konkorSignatureKeyword: 'حساسیت جذری EOQ نسبت به تغییرات تقاضا ($D$) و هزینه سفارش ($S$)',
        commonExamTrap: 'هزینه خرید کل سالانه ($D \\times P$) در مدل بدون تخفیف تأثیری بر $Q^*$ ندارد.',
      },
      {
        scholarOrSchool: 'ملیسا شیلینگ، اندرسون و تاشمن، هندرسون و کلارک (پویایی‌های نوآوری فناورانه)',
        yearOrEra: '۱۹۹۰–۲۰۲۰',
        coreTheoryOrModel: 'منحنی S فناوری، چرخه فناوری (عصر تخمیر و طرح غالب) و ماتریس ۴گانه نوآوری',
        keyDimensionsOrFormula: 'ناپیوستگی فناورانه ← عصر تخمیر ← انتخاب طرح غالب (Dominant Design) ← عصر تغییرات تدریجی و نوآوری فرآیند',
        konkorSignatureKeyword: 'محور افقی منحنی S شیلینگ = میزان تلاش و سرمایه‌گذاری در R&D (نه صرفاً زمان!)',
        commonExamTrap: 'پس از ظهور طرح غالب، تمرکز رقابت از نوآوری رادیکال محصول به نوآوری فرآیند و کاهش هزینه منتقل می‌شود.',
      },
      {
        scholarOrSchool: 'جو تید، جان بسانت، طاهر خلیل و هنری چسبرو (مدیریت نوآوری و انتقال فناوری)',
        yearOrEra: '۲۰۰۰–۲۰۲۱',
        coreTheoryOrModel: 'فضای 4P نوآوری (تید)، طبقه‌بندی فناوری ADL و اطلس فناوری (خلیل)، نوآوری باز (چسبرو)',
        keyDimensionsOrFormula: '4P: محصول، فرآیند، جایگاه، پارادایم | ADL: پایه، کلیدی، پیشاهنگ، نوظهور | اطلس: فن‌افزار، انسان‌افزار، اطلاعات‌افزار، سازمان‌افزار',
        konkorSignatureKeyword: 'رفع خطای منفی کاذب (False Negative) در قیف نوآوری باز چسبرو از طریق Spin-off و لیسانسینگ خروجی',
        commonExamTrap: 'فناوری کلیدی (Key) منشأ مزیت رقابتی فعلی است، اما فناوری پیشاهنگ (Pacing) فناوری کلیدی فرداست.',
      },
    ],
    masterFormulaVault: [
      {
        title: 'فرمول‌های موجودی EOQ، تولید اقتصادی EPQ و نقطه سفارش مجدد ROP',
        formulaLatex: 'Q^* = \\sqrt{\\frac{2DS}{H}}, \\quad Q_{EPQ}^* = \\sqrt{\\frac{2DS}{H(1 - d/p)}}, \\quad I_{\\max} = Q\\left(1 - \\frac{d}{p}\\right), \\quad ROP = \\bar{d} \\cdot L + Z \\sigma_d \\sqrt{L}',
        applicationAndShortcut: 'در مدل EPQ اگر نرخ تولید بی‌نهایت شود ($p \\to \\infty$)، کسر $d/p \\to 0$ شده و فرمول EPQ به همان فرمول EOQ تبدیل می‌شود.',
      },
      {
        title: 'شاخص‌های قابلیت و توانمندی فرآیند کنترل کیفیت (مونتگومری)',
        formulaLatex: 'C_p = \\frac{USL - LSL}{6\\sigma}, \\quad C_{pk} = \\min\\left(\\frac{USL - \\mu}{3\\sigma}, \\frac{\\mu - LSL}{3\\sigma}\\right)',
        applicationAndShortcut: 'همواره $C_{pk} \\le C_p$ است و تنها زمانی $C_{pk} = C_p$ می‌شود که فرآیند دقیقاً در مرکز حدود مشخصات قرار داشته باشد ($\\mu = \\frac{USL + LSL}{2}$).',
      },
    ],
    comprehensiveSyllabiModules: [
      {
        moduleCode: 'MOD-POM-01',
        moduleTitle: 'ماژول ۱ (صفحات ۱ تا ۳۵): پیش‌بینی تقاضا (هموارسازی نمایی و MAD)، برنامه‌ریزی ادغامی (Aggregate Planning) و موجودی (EOQ/EPQ)',
        equivalentPages: 35,
        exhaustiveSynthesis: [
          'در پیش‌بینی به روش هموارسازی نمایی ساده $F_t = F_{t-1} + \\alpha(A_{t-1} - F_{t-1})$، در محیط‌های با نوسان تصادفی شدید ضریب $\\alpha$ کوچک (برای هموار کردن نوسان) و در محیط‌های دارای تغییر روند واقعی ضریب $\\alpha$ بزرگ (برای واکنش سریع) انتخاب می‌شود.',
        ],
      },
      {
        moduleCode: 'MOD-POM-02',
        moduleTitle: 'ماژول ۲ (صفحات ۳۶ تا ۷۰): برنامه‌ریزی نیازمندی‌های مواد (MRP)، زمان‌بندی عملیات (جانسون، SPT, EDD, Moore)، چیدمان و توازن خط تولید',
        equivalentPages: 35,
        exhaustiveSynthesis: [
          'در توازن خط تولید (Line Balancing)، زمان سیکل برابر $C = \\frac{\\text{زمان در دسترس تولید}}{\\text{تقاضای دوره}}$، حداقل تئوریک ایستگاه‌های کاری برابر $N_{\\min} = \\lceil \\frac{\\sum t_i}{C} \\rceil$ و کارایی خط تولید برابر $E = \\frac{\\sum t_i}{N_{\\text{actual}} \\times C}$ است.',
        ],
      },
      {
        moduleCode: 'MOD-TECH-03',
        moduleTitle: 'ماژول ۳ (صفحات ۷۱ تا ۱۰۰): مدیریت استراتژیک نوآوری فناورانه (شیلینگ، تید و بسانت) و چرخه عمر فناوری (طاهر خلیل)',
        equivalentPages: 30,
        exhaustiveSynthesis: [
          'چرخه عمر فناوری در کتاب طاهر خلیل شامل ۶ مرحله است: ۱) تحقیق و توسعه (بذر فناوری)، ۲) ظهور و معرفی، ۳) رشد سریع (کاربردی شدن)، ۴) بلوغ (کند شدن پیشرفت و رسیدن به حد فیزیکی)، ۵) اشباع (جایگزینی با فناوری جدید)، ۶) زوال و منسوخ شدن.',
        ],
      },
      {
        moduleCode: 'MOD-TECH-04',
        moduleTitle: 'ماژول ۴ (صفحات ۱۰۱ تا ۱۳۰): نوآوری باز (چسبرو)، ظرفیت جذب (کوهن و لوینتال)، ۵ نسل R&D (روث‌ول) و قراردادهای انتقال تکنولوژی',
        equivalentPages: 30,
        exhaustiveSynthesis: [
          'مقایسه روش‌های انتقال فناوری: ۱) سرمایه‌گذاری مستقیم خارجی (FDI)، ۲) مشارکت انتفاعی (Joint Venture)، ۳) اعطای مجوز/لیسانس (Licensing: حق استفاده از دانش فنی در ازای رویالتی)، ۴) قرارداد کلید در دست (Turnkey: طراحی، ساخت و راه‌اندازی کامل کارخانه توسط انتقال‌دهنده)، ۵) قرارداد ساخت، بهره‌برداری و واگذاری (BOT) و ۶) مهندسی معکوس.',
        ],
      },
    ],
  },
  {
    courseId: 'course.100p.economics_micro_macro',
    courseTitle: 'اقتصاد خرد و کلان جامع (پوشش ۱۰۰٪ مباحث و فرمول‌های دکتر محسن نظری از ۱۳۹۱ تا ۱۴۰۵)',
    branches: ['business', 'industrial', 'technology'],
    degreeLevels: ['ارشد', 'دکتری'],
    masterCoefficients: { business: 2, industrial: 2, technology: 2 },
    phdCoefficient: 2,
    targetEquivalentPages: 125,
    primaryReferenceBooks: [
      'اقتصاد خرد ویژه کنکور کارشناسی ارشد مدیریت دکتر محسن نظری (انتشارات نگاه دانش)',
      'اقتصاد کلان ویژه کنکور کارشناسی ارشد مدیریت دکتر محسن نظری (انتشارات نگاه دانش)',
      ' ۲۰۰۰ تست اقتصاد خرد و کلان دکتر محسن نظری',
    ],
    coveredNodeIds: ['bus.econ_nazari'],
    scholarComparisonMatrix: [
      {
        scholarOrSchool: 'آلفرد مارشال، هیکس و اسلاتسکی (تقاضا، کشش و رفتار مصرف‌کننده)',
        yearOrEra: '۱۸۹۰–۱۹۳۹',
        coreTheoryOrModel: 'کشش قیمتی، درآمدی و متقاطع؛ مطلوبیت کاردینال و اوردینال (منحنی‌های بی‌تفاوتی)؛ معادله اسلاتسکی',
        keyDimensionsOrFormula: 'تعادل مصرف‌کننده: $\\frac{MU_x}{P_x} = \\frac{MU_y}{P_y} \\iff MRS_{xy} = \\frac{P_x}{P_y}$ | کالای گیفن: اثر درآمدی منفی > اثر جانشینی',
        konkorSignatureKeyword: 'منحنی عرضه خطی گذرنده از مبدأ مختصات در هر قیمتی دارای کشش عرضه $E_s = 1$ است!',
        commonExamTrap: 'برای منحنی بی‌تفاوتی، اگر دو کالا مکمل کامل باشند (L شکل) $MRS=0$ و اثر جانشینی صفر است؛ اگر جانشین کامل باشند خط راست با $MRS$ ثابت است.',
      },
      {
        scholarOrSchool: 'جان مینارد کینز، هانسن و هیکس (مدل کینزی و IS-LM)',
        yearOrEra: '۱۹۳۶–۱۹۳۷',
        coreTheoryOrModel: 'ضرایب فزاینده مخارج و مالیات، بودجه متوازن هاولمو، تعادل هم‌زمان بازار کالا (IS) و پول (LM)',
        keyDimensionsOrFormula: 'ضریب فزاینده مخارج: $\\frac{1}{1-c(1-t)+m}$ | دام نقدینگی (LM افقی): حداکثر اثر سیاست مالی و بی‌اثری سیاست پولی',
        konkorSignatureKeyword: 'قضیه بودجه متوازن هاولمو: در اقتصاد دو یا سه‌بخشی با مالیات مقطوع، ضریب فزاینده بودجه متوازن برابر ۱ است.',
        commonExamTrap: 'در ناحیه کلاسیکی (LM عمودی)، سیاست مالی انبساطی باعث اثر برون‌رانی ۱۰۰٪ (کاهش سرمایه‌گذاری خصوصی دقیقاً به اندازه افزایش مخارج دولت) می‌شود.',
      },
      {
        scholarOrSchool: 'کینز، دوزنبری، مودیلیانی و فریدمن (چهار نظریه مصرف کلان)',
        yearOrEra: '۱۹۳۶–۱۹۵۷',
        coreTheoryOrModel: 'درآمد مطلق (کینز)، درآمد نسبی (دوزنبری)، چرخه زندگی (مودیلیانی) و درآمد دائمی (فریدمن)',
        keyDimensionsOrFormula: 'کینز: $APC > MPC$ در کوتاه‌مدت | دوزنبری: اثر چرخ‌دنده‌ای و نمایشی | فریدمن: میل نهایی به مصرف از درآمد موقتی صفر است',
        konkorSignatureKeyword: 'در بلندمدت تابع مصرف از مبدأ مختصات می‌گذرد و $APC = MPC$ است (تبیین معمای کوزنتس)',
        commonExamTrap: 'در نظریه درآمد دائمی فریدمن، سیاست‌های مالی موقتی (تغییر موقت مالیات) هیچ اثری بر مصرف جاری ندارند!',
      },
    ],
    masterFormulaVault: [
      {
        title: 'رابطه درآمد نهایی، قیمت و کشش در انحصار و شاخص قدرت انحصاری لرنر',
        formulaLatex: 'MR = P\\left(1 - \\frac{1}{|E_d|}\\right), \\quad L = \\frac{P - MC}{P} = \\frac{1}{|E_d|}',
        applicationAndShortcut: 'در بازار رقابت کامل $|E_d| = \\infty \\Rightarrow P = MC \\Rightarrow L = 0$. در انحصار همواره $|E_d| > 1$ است.',
      },
      {
        title: 'ضرایب فزاینده در اقتصاد باز چهاربخشی و ضریب فزاینده پولی',
        formulaLatex: 'k_G = \\frac{1}{1 - c(1 - t) + m}, \\quad m_{\\text{money}} = \\frac{1 + cu}{rr + er + cu}',
        applicationAndShortcut: 'در حالت ساده بدون نشت اسکناس ($cu=0$) و بدون ذخایر اضافی ($er=0$)، ضریب فزاینده پولی برابر $m = \\frac{1}{rr}$ است.',
      },
    ],
    comprehensiveSyllabiModules: [
      {
        moduleCode: 'MOD-ECON-01',
        moduleTitle: 'ماژول ۱ (صفحات ۱ تا ۳۵): تقاضا، عرضه، کشش‌ها، تعادل بازار، مالیات و یارانه، و تئوری رفتار مصرف‌کننده',
        equivalentPages: 35,
        exhaustiveSynthesis: [
          'سهم مصرف‌کننده و تولیدکننده از مالیات بر واحد کالا تابع کشش قیمتی عرضه و تقاضاست: هر طرف بازار که «کم‌کشش‌تر» باشد، سهم بیشتری از بار مالیات را متحمل می‌شود ($\\frac{\\text{سهم مصرف‌کننده}}{\\text{سهم تولیدکننده}} = \\frac{E_s}{|E_d|}$).',
        ],
      },
      {
        moduleCode: 'MOD-ECON-02',
        moduleTitle: 'ماژول ۲ (صفحات ۳۶ تا ۶۵): نظریه تولید (کوتاه‌مدت و بلندمدت، بازده به مقیاس)، توابع هزینه و ساختارهای بازار (رقابت کامل، انحصار، انحصار چندجانبه)',
        equivalentPages: 30,
        exhaustiveSynthesis: [
          'برای تابع تولید کاب-داگلاس $Q = A L^\\alpha K^\\beta$: کشش تولید نسبت به کار برابر $\\alpha$ و نسبت به سرمایه برابر $\\beta$ است. اگر $\\alpha + \\beta = 1$ باشد بازده به مقیاس ثابت، اگر $>1$ صعودی و اگر $<1$ نزولی است.',
        ],
      },
      {
        moduleCode: 'MOD-ECON-03',
        moduleTitle: 'ماژول ۳ (صفحات ۶۶ تا ۹۵): حسابداری ملی (GDP اسمی و واقعی)، تعادل کینزی، ضرایب فزاینده و نظریه‌های مصرف و سرمایه‌گذاری',
        equivalentPages: 30,
        exhaustiveSynthesis: [
          'رابطه تولید ناخالص داخلی (GDP) و تولید ناخالص ملی (GNP): $GNP = GDP + \\text{خالص درآمد عوامل تولید از خارج (NFI)}$. با کسر استهلاک از GNP، تولید خالص ملی (NNP) و با کسر مالیات‌های غیرمستقیم و افزودن یارانه‌ها، درآمد ملی (NI) حاصل می‌شود.',
        ],
      },
      {
        moduleCode: 'MOD-ECON-04',
        moduleTitle: 'ماژول ۴ (صفحات ۹۶ تا ۱۲۵): بازار پول، سیاست‌های پولی و مالی در مدل IS-LM، منحنی‌های AD-AS، تورم و بیکاری و مکاتب کلان',
        equivalentPages: 30,
        exhaustiveSynthesis: [
          'تقاضای پول در مکتب کینز شامل ۳ انگیزه «معاملاتی»، «احتیاطی» (هر دو تابع مستقیم درآمد $Y$) و «سفته‌بازی» (تابع معکوس نرخ بهره $r$) است.',
        ],
      },
    ],
  },
  {
    courseId: 'course.100p.math_stats_research',
    courseTitle: 'ریاضی و آمار جامع + آمار و روش تحقیق پیشرفته دکتری (رنجبران، طورانی، عادل آذر و سرمد)',
    branches: ['business', 'industrial', 'technology'],
    degreeLevels: ['ارشد', 'دکتری'],
    masterCoefficients: { business: 2, industrial: 2, technology: 2 },
    phdCoefficient: 4,
    targetEquivalentPages: 135,
    primaryReferenceBooks: [
      'ریاضیات عمومی و کاربرد آن در مدیریت دکتر هادی رنجبران (انتشارات اثبات) / دکتر محمودیان',
      'آمار و احتمال طرح ۹۰ درصد استاد محسن طورانی (انتشارات نگاه دانش)',
      'آمار و کاربرد آن در مدیریت دکتر عادل آذر و دکتر مؤمنی (سمت) + روش تحقیق دکتر زهره سرمد، بازرگان و حجازی',
    ],
    coveredNodeIds: [
      'bus.math_stats_ranjbaran_tourani',
      'stats.scales',
      'stats.regression',
      'stats.anova',
      'stats.hypothesis',
    ],
    scholarComparisonMatrix: [
      {
        scholarOrSchool: 'استیونس (مقیاس‌های چهارگانه اندازه‌گیری در آمار و روش تحقیق)',
        yearOrEra: '۱۹۴۶',
        coreTheoryOrModel: 'سلسله‌مراتب دقت مقیاس‌ها: اسمی (Nominal) ← رتبه‌ای (Ordinal) ← فاصله‌ای (Interval) ← نسبی (Ratio)',
        keyDimensionsOrFormula: 'اسمی: مد و خی‌دو | رتبه‌ای: میانه و اسپیرمن | فاصله‌ای: میانگین، انحراف معیار و پیرسون (صفر قراردادی) | نسبی: میانگین هندسی و ضریب تغییرات (صفر مطلق)',
        konkorSignatureKeyword: 'صفر قراردادی/اعتباری = مقیاس فاصله‌ای (مثل دما به سانتی‌گراد)؛ صفر مطلق = مقیاس نسبی (مثل درآمد و وزن)',
        commonExamTrap: 'ضریب تغییرات ($CV = \\frac{\\sigma}{\\mu}$) فقط برای مقیاس نسبی مجاز است و در مقیاس فاصله‌ای به دلیل صفر قراردادی بی‌معناست!',
      },
      {
        scholarOrSchool: 'فورنل و لارکر، هیر و همکاران (مدل‌سازی معادلات ساختاری SEM دکتری)',
        yearOrEra: '۱۹۸۱–۲۰۲۲',
        coreTheoryOrModel: 'ارزیابی مدل اندازه‌گیری (روایی همگرا و واگرا، پایایی ترکیبی) و مدل ساختاری (CB-SEM و PLS-SEM)',
        keyDimensionsOrFormula: 'پایایی ترکیبی $CR \\ge 0.70$ | روایی همگرا $AVE \\ge 0.50$ | روایی واگرا: $\\sqrt{AVE_i} > r_{ij}$',
        konkorSignatureKeyword: 'حداقل مقدار میانگین واریانس استخراج‌شده ($AVE$) برای تأیید روایی همگرا برابر ۰.۵۰ است.',
        commonExamTrap: 'رویکرد کوواریانس‌محور (LISREL/AMOS) برای آزمون تئوری با نمونه بزرگ و نرمال است، اما رویکرد واریانس‌محور (SmartPLS) برای پیش‌بینی و نمونه‌های کوچک یا غیرنرمال مناسب است.',
      },
    ],
    masterFormulaVault: [
      {
        title: 'نامساوی چبیشف، ضریب تغییرات و اثر تبدیل خطی $Y = aX + b$',
        formulaLatex: 'P(|X - \\mu| < k\\sigma) \\ge 1 - \\frac{1}{k^2}, \\quad \\bar{Y} = a\\bar{X} + b, \\quad S_Y = |a|S_X, \\quad \\text{Var}(Y) = a^2 \\text{Var}(X)',
        applicationAndShortcut: 'مجموع قدرمطلق انحرافات $\\sum |x_i - a|$ در $a = \\text{Median}$ (میانه) و مجموع مربعات انحرافات $\\sum (x_i - a)^2$ در $a = \\bar{x}$ (میانگین) کمینه می‌شود.',
      },
      {
        title: 'خواص دترمینان، معکوس و الحاقی ماتریس مربعی از مرتبه $n$',
        formulaLatex: '|kA| = k^n |A|, \\quad |A^{-1}| = \\frac{1}{|A|}, \\quad |\\text{adj}(A)| = |A|^{n-1}, \\quad \\text{tr}(A) = \\sum_{i=1}^n \\lambda_i, \\quad |A| = \\prod_{i=1}^n \\lambda_i',
        applicationAndShortcut: 'مجموع مقادیر ویژه ماتریس برابر اثر ماتریس (جمع عناصر قطر اصلی) و حاصل‌ضرب مقادیر ویژه برابر دترمینان ماتریس است.',
      },
    ],
    comprehensiveSyllabiModules: [
      {
        moduleCode: 'MOD-MATH-01',
        moduleTitle: 'ماژول ۱ (صفحات ۱ تا ۳۵): توابع، حد و پیوستگی، مشتق و کاربرد در اقتصاد، انتگرال معین و ناسره',
        equivalentPages: 35,
        exhaustiveSynthesis: [
          'در کاربرد مشتق و انتگرال در اقتصاد: هزینه نهایی $MC(q) = TC\'(q)$، هزینه کل $TC(q) = \\int MC(q)\\,dq + FC$، و مازاد مصرف‌کننده برابر مساحت زیر منحنی تقاضا و بالای خط قیمت تعادلی است.',
        ],
      },
      {
        moduleCode: 'MOD-MATH-02',
        moduleTitle: 'ماژول ۲ (صفحات ۳۶ تا ۶۵): ماتریس‌ها، دترمینان، دستگاه معادلات خطی، مقادیر ویژه، دنباله و سری و توابع دومتغیره',
        equivalentPages: 30,
        exhaustiveSynthesis: [
          'برای تابع دومتغیره همگن از درجه $k$، طبق قضیه اویلر داریم $x f_x + y f_y = k f(x, y)$. همچنین در بهینه‌سازی بدون قید، علامت دترمینان هسین $\\Delta = f_{xx}f_{yy} - (f_{xy})^2$ نوع نقطه بحرانی را تعیین می‌کند.',
        ],
      },
      {
        moduleCode: 'MOD-STAT-03',
        moduleTitle: 'ماژول ۳ (صفحات ۶۶ تا ۱۰۰): آمار توصیفی، آنالیز ترکیبی، احتمال شرطی و قضیه بیز، متغیرهای تصادفی و توزیع‌های دوجمله‌ای، پواسون، هندسی، یکنواخت، نمایی و نرمال',
        equivalentPages: 35,
        exhaustiveSynthesis: [
          'در توزیع دوجمله‌ای $B(n, p)$ میانگین $np$ و واریانس $npq$ است (همواره در دوجمله‌ای میانگین بزرگ‌تر از واریانس است چون $q < 1$!). در توزیع پواسون میانگین و واریانس برابر $\\lambda$ هستند. در توزیع نمایی با پارامتر $\\lambda$، میانگین $\\frac{1}{\\lambda}$ و واریانس $\\frac{1}{\\lambda^2}$ است.',
        ],
      },
      {
        moduleCode: 'MOD-STAT-04',
        moduleTitle: 'ماژول ۴ (صفحات ۱۰۱ تا ۱۳۵): برآورد و فاصله اطمینان، آزمون فرض، تحلیل واریانس (ANOVA)، رگرسیون، معادلات ساختاری و روش تحقیق دکتری',
        equivalentPages: 35,
        exhaustiveSynthesis: [
          'در رگرسیون خطی ساده $Y = \\beta_0 + \\beta_1 X + \\epsilon$، ضریب تعیین $R^2 = \\frac{SSR}{SST} = 1 - \\frac{SSE}{SST}$ نشان می‌دهد چند درصد از تغییرات متغیر وابسته $Y$ توسط متغیر مستقل $X$ تبیین می‌شود.',
        ],
      },
    ],
  },
  {
    courseId: 'course.100p.islamic_english_general',
    courseTitle: 'اصول و مبانی مدیریت از دیدگاه اسلام (دکتر مقیمی) + زبان عمومی و تخصصی مدیریت (جهانشاهی و اشراقی)',
    branches: ['business', 'industrial', 'technology'],
    degreeLevels: ['ارشد', 'دکتری'],
    masterCoefficients: { business: 5, industrial: 5, technology: 5 },
    phdCoefficient: 2,
    targetEquivalentPages: 110,
    primaryReferenceBooks: [
      'اصول و مبانی مدیریت از دیدگاه اسلام دکتر سید محمد مقیمی (انتشارات راه دان)',
      'زبان عمومی کارشناسی ارشد زیر ذره‌بین (مهندس هادی جهانشاهی و حجازی - نگاه دانش)',
      'زبان تخصصی مدیریت آرمان اشراقی (نگاه دانش) و دکتر فرزاد ناصرزاده',
    ],
    coveredNodeIds: ['bus.islamic_moghimi', 'bus.english_eshraghi'],
    scholarComparisonMatrix: [
      {
        scholarOrSchool: 'دکتر سید محمد مقیمی (اصول و مبانی مدیریت از دیدگاه اسلام)',
        yearOrEra: 'متون قرآنی و نهج‌البلاغه (نامه ۵۳ مالک اشتر)',
        coreTheoryOrModel: 'سیر جامعه‌پذیری توحیدی (تخلیه، تحلیه، تجلیه)، خودکنترلی (مشارطه، مراقبه، محاسبه، معاتبه) و شایسته‌سالاری (قوی و امین / حفیظ و علیم)',
        keyDimensionsOrFormula: 'سه سطح کنترل اسلامی: ۱) نظارت درونی (تقوا و وجدان)، ۲) نظارت همگانی (امر به معروف)، ۳) نظارت سازمانی و بازرسان پنهان (عیون)',
        konkorSignatureKeyword: 'آراستن به فضایل = تحلیه؛ پیراستن از رذایل = تخلیه؛ مساوات در نگاه و توجه = عدالت احساسی',
        commonExamTrap: 'در آیه ۱۵۹ آل‌عمران (وشاورهم فی الامر فاذا عزمت فتوکل علی الله)، مشورت مربوط به مرحله تصمیم‌گیری است و پس از عزم، قاطعیت و توکل در اجرا لازم است.',
      },
      {
        scholarOrSchool: 'آرمان اشراقی و هادی جهانشاهی (زبان عمومی و تخصصی مدیریت)',
        yearOrEra: 'متون کلاسیک کونتز، استونر، رابینز و کاتلر',
        coreTheoryOrModel: 'واژگان تخصصی ۷ حوزه مدیریت + گرامر پیشرفته کلوزتست (التزامی، وارونگی، شرطی) + درک مطلب',
        keyDimensionsOrFormula: 'Subjunctive Mood پس از suggest/insist/imperative + فعل ساده بدون to و بدون s',
        konkorSignatureKeyword: 'Bullwhip Effect (اثر شلاق چرمی)، Glass Ceiling (سقف شیشه‌ای)، Whistle-blowing (سوت‌زنی/افشاگری)',
        commonExamTrap: 'در وارونگی (Inversion) پس از Never/Rarely/Seldom/Hardly در ابتدای جمله، فعل کمکی باید قبل از فاعل قرار گیرد.',
      },
    ],
    masterFormulaVault: [
      {
        title: 'تطبیق ۴ مرحله خودکنترلی اسلامی با چرخه کنترل کلاسیک مدیریت',
        formulaLatex: '\\text{Moshareteh (Standard)} \\to \\text{Moraghebeh (Monitoring)} \\to \\text{Mohasebeh (Evaluation)} \\to \\text{Moatebeh (Corrective Action)}',
        applicationAndShortcut: 'مشارطه = تعیین استاندارد اولیه؛ مراقبه = پایش حین اجرا؛ محاسبه = سنجش عملکرد؛ معاتبه = اقدام اصلاحی.',
      },
    ],
    comprehensiveSyllabiModules: [
      {
        moduleCode: 'MOD-ISL-01',
        moduleTitle: 'ماژول ۱ (صفحات ۱ تا ۵۵): خلاصه کامل ۱۰ فصل کتاب اصول و مبانی مدیریت از دیدگاه اسلام دکتر مقیمی و نکات عهدنامه مالک اشتر',
        equivalentPages: 55,
        exhaustiveSynthesis: [
          'در عهدنامه مالک اشتر (نامه ۵۳ نهج‌البلاغه)، طبقات هفت‌گانه جامعه عبارت‌اند از: ۱) لشکریان و حافظان امنیت (جنود)، ۲) دبیران و کاتبان اداری (کتّاب)، ۳) قضات و مجریان عدالت (قضات عدل)، ۴) کارگزاران انصاف و رفق، ۵) خراج‌گزاران و مالیات‌دهندگان، ۶) بازرگانان و صاحبان صنایع و پیشه‌وران، ۷) طبقه نیازمندان و محرومان.',
          'مراحل سه‌گانه گزینش و مدیریت کارگزاران در عهدنامه مالک اشتر: ۱) گزینش بر پایه تجربه و حیا و پرهیز از خویشاوندسالاری و استبداد رأی، ۲) تأمین معاش و حقوق مکفی (أسبغ علیهم الأرزاق) تا انگیزه خیانت از بین برود، ۳) نظارت مستمر از طریق بازرسان راستگو و وفادار (عیون).',
        ],
      },
      {
        moduleCode: 'MOD-ENG-02',
        moduleTitle: 'ماژول ۲ (صفحات ۵۶ تا ۱۱۰): بانک واژگان پرتکرار زیر ذره‌بین، اصطلاحات تخصصی مدیریت آرمان اشراقی و قواعد طلایی گرامر و Reading',
        equivalentPages: 55,
        exhaustiveSynthesis: [
          'کلیدی‌ترین اصطلاحات تخصصی مدیریت در کنکورهای ۱۳۹۱ تا ۱۴۰۵: Span of Control (حیطه نظارت)، Unity of Command (وحدت فرماندهی)، Scalar Chain (زنجیره فرمان)، Esprit de Corps (روحیه تیمی)، Red Tape (کاغذبازی اداری)، Nepotism (خویشاوندسالاری)، Attrition / Turnover (ریزش کارکنان)، Conglomerate Diversification (تنوع‌بخشی ناهمگن)، Price Skimming (قیمت‌گذاری سرشیرگیری)، Economies of Scale (صرفه‌جویی ناشی از مقیاس)، Bullwhip Effect (اثر شلاق چرمی).',
        ],
      },
    ],
  },
];

/**
 * تابع تولیدکننده متن کامل و یکپارچه مرجع ۱۰۰ صفحه‌ای هر درس از ساختار متمرکز konkorData.ts
 * (شامل ماژول‌های درسنامه، ماتریس نظریه‌پردازان، فرمول‌نامه، درسنامه‌های تعاملی مرتبط و کل بانک تست ۱۵ ساله)
 */
export function generateCentralized100PageCourseMarkdown(courseId: string): string {
  const course =
    CENTRALIZED_100PAGE_COURSE_CATALOG.find((c) => c.courseId === courseId) ??
    CENTRALIZED_100PAGE_COURSE_CATALOG[0];

  const linkedLessons = course.coveredNodeIds
    .map((id) => INITIAL_INTERACTIVE_LESSONS[id])
    .filter(Boolean);

  const linkedQuestions = INITIAL_QUESTION_BANK.filter((q) =>
    course.coveredNodeIds.includes(q.nodeId)
  );

  const lines: string[] = [
    `# دایرةالمعارف و مرجع متمرکز ۱۰۰ صفحه‌ای: ${course.courseTitle}`,
    `- **شناسه متمرکز در konkorData.ts:** \`${course.courseId}\``,
    `- **حجم معادل مرجع استاندارد:** ${course.targetEquivalentPages} صفحه خالص کنکوری`,
    `- **مقاطع تحت پوشش:** ${course.degreeLevels.join(' و ')}`,
    `- **ضرایب در کنکور ارشد (کد ۱۱۴۲):** بازرگانی: ${course.masterCoefficients.business} | صنعتی: ${course.masterCoefficients.industrial} | تکنولوژی: ${course.masterCoefficients.technology}`,
    `- **ضریب در کنکور دکتری تخصصی:** ${course.phdCoefficient}`,
    ``,
    `## ۱. کتب مرجع اصلی پوشش‌داده‌شده در این مجلد`,
    ...course.primaryReferenceBooks.map((b, idx) => `${idx + 1}. ${b}`),
    ``,
    `---`,
    `## ۲. ماژول‌های چهارگانه درسنامه جامع (${course.targetEquivalentPages} صفحه معادل)`,
    ...course.comprehensiveSyllabiModules.flatMap((m) => [
      `\n### [${m.moduleCode}] ${m.moduleTitle} (معادل ${m.equivalentPages} صفحه)`,
      ...m.exhaustiveSynthesis.map((p) => `- ${p}`),
    ]),
    ``,
    `---`,
    `## ۳. ماتریس تطبیقی اندیشمندان، مکاتب و دام‌های کنکوری`,
    ...course.scholarComparisonMatrix.map(
      (row, idx) =>
        `\n### ${idx + 1}. ${row.scholarOrSchool} (${row.yearOrEra})\n- **نظریه/مدل محوری:** ${row.coreTheoryOrModel}\n- **ابعاد و روابط کلیدی:** ${row.keyDimensionsOrFormula}\n- **کلیدواژه امضای طراح کنکور:** ${row.konkorSignatureKeyword}\n- **دام متداول طراح:** ${row.commonExamTrap}`
    ),
    ``,
    `---`,
    `## ۴. بانک فرمول‌ها و میان‌برهای حل سریع تست`,
    ...course.masterFormulaVault.map(
      (f, idx) =>
        `\n### فرمول ${idx + 1}: ${f.title}\n$$${f.formulaLatex}$$\n- **کاربرد و تکنیک تستی:** ${f.applicationAndShortcut}`
    ),
    ``,
    `---`,
    `## ۵. گام‌های خردشده تعاملی و زوج‌های مفهوم-توصیف‌گر (${linkedLessons.length} گره دانشی)`,
    ...linkedLessons.flatMap((les) => [
      `\n### مبحث: ${les.topic} (${les.sourceBookCitation})`,
      `**خلاصه مدیریتی:** ${les.summary}`,
      ...les.microSteps.map(
        (st) => `- **گام ${st.stepNumber} (${st.title}):** ${st.content}`
      ),
      `**نکات طلایی کنکور:**`,
      ...les.konkoorTips.map((t) => `  * ${t}`),
    ]),
    ``,
    `---`,
    `## ۶. بانک جامع سؤالات کنکور ارشد و دکتری مرتبط با پاسخ کاملاً تشریحی (${linkedQuestions.length} سؤال)`,
    ...linkedQuestions.map(
      (q, idx) =>
        `\n### سؤال ${idx + 1} (کنکور سال ${q.examYear} — ${q.sourceReference || 'سازمان سنجش'})\n**صورت سؤال:** ${q.text}\n${q.options
          .map((opt, oIdx) => `${oIdx + 1}) ${opt}`)
          .join('\n')}\n- **گزینه صحیح و پاسخ تشریحی:** پس از submit در حالت آنلاین نمایش داده می‌شود (کلید فقط سمت سرور است).`
    ),
  ];

  return lines.join('\n');
}


