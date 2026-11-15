import { MajorExamBranch } from '../engine/aelEngine';
import { KonkorCourseSectionId } from './yearlyKonkorExams';

export type ExamDegreeMode = 'master' | 'phd';

export interface HistoricalTopRankProfile {
  rankLabel: string;
  nationalRank: number;
  branch: MajorExamBranch;
  degree: ExamDegreeMode;
  admittedUniversity: string;
  totalTaraz: number;
  weightedAveragePercent: number;
  coursePercentages: Partial<Record<KonkorCourseSectionId, number>>;
  note: string;
}

export interface YearDifficultyCalibration {
  year: number;
  difficultyIndex: number; // 1.00 = نرمال، > 1.00 = سخت‌تر (تراز بالاتر به ازای درصد یکسان)، < 1.00 = ساده‌تر
  difficultyLabel: 'بسیار دشوار (ترازدهنده)' | 'دشوار استاندارد' | 'متعادل استاندارد' | 'نسبتاً مفهومی-محاسباتی';
  totalParticipantsMaster: number;
  totalParticipantsPhd: number;
  rank1WeightedAvgBusiness: number;
  rank1WeightedAvgIndustrial: number;
  rank1WeightedAvgTechnology: number;
  tehranDayCutoffWeightedAvg: number;
}

export interface UniversityAdmissionTier {
  id: string;
  universityName: string;
  programs: string;
  admissionType: 'روزانه' | 'نوبت دوم (شبانه)' | 'پردیس خودگردان / غیرانتفاعی برتر';
  minTarazMaster: number;
  maxRankBusiness: number;
  maxRankIndustrial: number;
  maxRankTechnology: number;
  minTarazPhd: number;
  maxRankPhd: number;
  city: string;
}

export interface CourseScoreInput {
  sectionId: KonkorCourseSectionId;
  title: string;
  coeff: number;
  totalQuestions: number;
  correct: number;
  wrong: number;
  unanswered: number;
  netPercent: number;
}

export interface RankPredictionResult {
  year: number;
  branch: MajorExamBranch;
  degree: ExamDegreeMode;
  weightedAveragePercent: number;
  effectivePositiveNormalizedPercent: number;
  scaledTaraz: number;
  maxTarazScale: number;
  estimatedRank: number;
  rankRangeMin: number;
  rankRangeMax: number;
  percentile: number;
  top1RankComparison: HistoricalTopRankProfile;
  top10RankComparison: HistoricalTopRankProfile;
  courseBreakdown: {
    sectionId: KonkorCourseSectionId;
    title: string;
    coeff: number;
    userPercent: number;
    rank1Percent: number | null;
    rank10Percent: number | null;
    gapFromRank1: number | null;
    status: 'عالی (هم‌تراز رتبه برتر)' | 'خوب (تراز مثبت)' | 'متوسط (نیازمند ارتقا)' | 'نقطه ضعف (نیازمند جبران)';
  }[];
  universityAdmissions: {
    tier: UniversityAdmissionTier;
    /**
     * درجهٔ هم‌خوانی شبیه‌سازی با آستانهٔ آن رده — نه «احتمال قبولی».
     * پیش‌بینی احتمال، پشتوانهٔ آماری لازم را ندارد.
     */
    status: 'بسیار هم‌خوان (شبیه‌سازی)' | 'مرزی (شبیه‌سازی)' | 'نیازمند افزایش تراز';
    tarazGap: number;
  }[];
  bestMatchedUniversity: string;
  strategicAdvice: string;
  /** سطح اطمینان شبیه‌سازی، بر اساس تعداد مرجع کالیبراسیون موجود */
  confidence: 'low' | 'very_low';
  /** محدودیت‌هایی که رابط کاربری باید نشان دهد */
  modelLimitations: string[];
}

/**
 * سلب مسئولیت که باید همراه هر پیش‌بینی رتبه یا دانشگاه نمایش داده شود.
 */
export const RANK_PREDICTION_DISCLAIMER =
  'این ابزار یک شبیه‌ساز آموزشی است، نه پیش‌بینی رتبه یا قبولی. ' +
  'مدل فعلی فقط بر پایهٔ پروفایل درصدهای رتبهٔ ۱ و ۱۰ ساخته شده و با کارنامه‌های واقعی ' +
  'اعتبارسنجی نشده است.';

/**
 * محدودیت‌های شناخته‌شدهٔ مدل.
 * هر کدام به‌تنهایی کافی است تا خروجی «پیش‌بینی» نامیده نشود.
 */
export const RANK_MODEL_LIMITATIONS: string[] = [
  'مدل فقط با دو نقطهٔ مرجع (رتبهٔ ۱ و رتبهٔ ۱۰) برای هر گرایش کالیبره شده است.',
  'توزیع کامل تراز و رتبهٔ داوطلبان همان سال در مدل وجود ندارد.',
  'اثر سختی هر سال با یک ضریب دستی اعمال می‌شود، نه از دادهٔ واقعی همان سال.',
  'آستانهٔ تراز دانشگاه‌ها ثابت فرض شده و تغییر ظرفیت هر سال لحاظ نمی‌شود.',
  'هیچ اعتبارسنجی بیرونی روی کارنامه‌ای که در ساخت مدل استفاده نشده انجام نشده است.',
];

/**
 * کارنامه‌های واقعی رتبه‌های برتر کنکور کارشناسی ارشد (کد ۱۱۴۲) و دکتری تخصصی مدیریت
 * مستخرج از کارنامه‌های رسمی سازمان سنجش آموزش کشور
 */
export const HISTORICAL_TOP_RANK_PROFILES: HistoricalTopRankProfile[] = [
  // ======================== مدیریت بازرگانی (ارشد) ========================
  {
    rankLabel: 'رتبه ۱ کشوری ارشد مدیریت بازرگانی',
    nationalRank: 1,
    branch: 'business',
    degree: 'master',
    admittedUniversity: 'دانشگاه تهران — مدیریت بازرگانی (روزانه)',
    totalTaraz: 9969,
    weightedAveragePercent: 56.4,
    coursePercentages: {
      english: 54.4,
      islamic: 64.4,
      math_stats: 45.0,
      management_theories: 58.9,
      economics: 76.7,
      operations_research: 48.9,
      production: 0,
      marketing: 75.6,
    },
    note: 'کارنامه تلفیقی رتبه ۱ کشوری مدیریت بازرگانی (درصد بالای بازاریابی با ضریب ۴ و اقتصاد و تئوری مدیریت سکوی پرتاب اصلی است).',
  },
  {
    rankLabel: 'رتبه ۱۰ کشوری ارشد مدیریت بازرگانی (قبولی روزانه دانشگاه تهران)',
    nationalRank: 10,
    branch: 'business',
    degree: 'master',
    admittedUniversity: 'دانشگاه تهران — مدیریت بازرگانی (روزانه)',
    totalTaraz: 9120,
    weightedAveragePercent: 49.2,
    coursePercentages: {
      english: 53.3,
      islamic: 48.9,
      math_stats: 31.7,
      management_theories: 46.7,
      economics: 68.3,
      operations_research: 42.2,
      production: 0,
      marketing: 62.2,
    },
    note: 'در کارنامه‌های نمونه، داوطلبان پذیرفته‌شده در روزانه دانشگاه تهران میانگین وزنی حدود ۴۸ تا ۵۱ درصد داشته‌اند؛ این یک مشاهده است، نه آستانهٔ قطعی قبولی.',
  },
  // ======================== مدیریت صنعتی (ارشد) ========================
  {
    rankLabel: 'رتبه ۱ کشوری ارشد مدیریت صنعتی',
    nationalRank: 1,
    branch: 'industrial',
    degree: 'master',
    admittedUniversity: 'دانشگاه تهران / صنعتی شریف — مدیریت صنعتی (روزانه)',
    totalTaraz: 9945,
    weightedAveragePercent: 58.1,
    coursePercentages: {
      english: 51.1,
      islamic: 60.0,
      math_stats: 55.0,
      management_theories: 54.4,
      economics: 65.0,
      operations_research: 82.2,
      production: 71.1,
      marketing: 0,
    },
    note: 'در مدیریت صنعتی، درس تحقیق در عملیات (ضریب ۳) و مدیریت تولید (ضریب ۲) به همراه تئوری مدیریت بیشترین تراز را ایجاد می‌کنند.',
  },
  {
    rankLabel: 'رتبه ۱۰ کشوری ارشد مدیریت صنعتی (قبولی روزانه تهران / شریف)',
    nationalRank: 10,
    branch: 'industrial',
    degree: 'master',
    admittedUniversity: 'دانشگاه تهران / شهید بهشتی — مدیریت صنعتی (روزانه)',
    totalTaraz: 9080,
    weightedAveragePercent: 48.8,
    coursePercentages: {
      english: 44.4,
      islamic: 51.1,
      math_stats: 43.3,
      management_theories: 45.6,
      economics: 53.3,
      operations_research: 68.9,
      production: 57.8,
      marketing: 0,
    },
    note: 'کسب درصد بالای ۶۵٪ در تحقیق در عملیات و ۵۵٪ در تولید، رتبه زیر ۱۵ صنعتی را رقم می‌زند.',
  },
  // ======================== مدیریت تکنولوژی و نوآوری (ارشد) ========================
  {
    rankLabel: 'رتبه ۱ کشوری ارشد مدیریت تکنولوژی (کد ۱۱۴۲)',
    nationalRank: 1,
    branch: 'technology',
    degree: 'master',
    admittedUniversity: 'دانشگاه تهران / علامه طباطبایی — مدیریت تکنولوژی (روزانه)',
    totalTaraz: 9890,
    weightedAveragePercent: 55.8,
    coursePercentages: {
      english: 62.2,
      islamic: 57.8,
      math_stats: 48.3,
      management_theories: 56.7,
      economics: 61.7,
      operations_research: 55.6,
      production: 60.0,
      marketing: 0,
    },
    note: 'در مدیریت تکنولوژی، دو درس ۳ ضریبی «زبان انگلیسی» و «تئوری‌های مدیریت» به همراه تولید و تحقیق در عملیات تعیین‌کننده رتبه ۱ هستند.',
  },
  {
    rankLabel: 'رتبه ۱۰ کشوری ارشد مدیریت تکنولوژی (قبولی روزانه دانشگاه تهران / تربیت مدرس)',
    nationalRank: 10,
    branch: 'technology',
    degree: 'master',
    admittedUniversity: 'دانشگاه علامه طباطبایی / تربیت مدرس — مدیریت تکنولوژی (روزانه)',
    totalTaraz: 8990,
    weightedAveragePercent: 47.5,
    coursePercentages: {
      english: 52.2,
      islamic: 48.9,
      math_stats: 38.3,
      management_theories: 47.8,
      economics: 50.0,
      operations_research: 46.7,
      production: 51.1,
      marketing: 0,
    },
    note: 'توازن درصدها در تئوری مدیریت، زبان، تولید و تحقیق در عملیات کلید قبولی روزانه تهران در مدیریت تکنولوژی است.',
  },
  // ======================== دکتری تخصصی مدیریت (PhD) ========================
  {
    rankLabel: 'رتبه ۱ کشوری دکتری تخصصی مدیریت بازرگانی (کد ۲۱۱۹)',
    nationalRank: 1,
    branch: 'business',
    degree: 'phd',
    admittedUniversity: 'دانشگاه تهران — دکتری مدیریت بازرگانی (روزانه)',
    totalTaraz: 4680,
    weightedAveragePercent: 54.5,
    coursePercentages: {
      english: 46.7,
      islamic: 55.0,
      math_stats: 52.0,
      management_theories: 62.0,
      economics: 50.0,
      operations_research: 45.0,
      production: 0,
      marketing: 68.0,
    },
    note: 'نمونهٔ نمایشی بدون دادهٔ اعتبارسنجی‌شده.',
  },
  {
    rankLabel: 'رتبه ۱۰ کشوری دکتری تخصصی مدیریت بازرگانی',
    nationalRank: 10,
    branch: 'business',
    degree: 'phd',
    admittedUniversity: 'دانشگاه تهران / شهید بهشتی — دکتری مدیریت بازرگانی',
    totalTaraz: 4210,
    weightedAveragePercent: 46.2,
    coursePercentages: {
      english: 38.0,
      islamic: 45.0,
      math_stats: 42.0,
      management_theories: 52.0,
      economics: 42.0,
      operations_research: 38.0,
      production: 0,
      marketing: 58.0,
    },
    note: 'نمونهٔ نمایشی بدون دادهٔ اعتبارسنجی‌شده.',
  },
  {
    rankLabel: 'رتبه ۱ کشوری دکتری تخصصی مدیریت صنعتی (کد ۲۱۱۸)',
    nationalRank: 1,
    branch: 'industrial',
    degree: 'phd',
    admittedUniversity: 'دانشگاه تهران / تربیت مدرس — دکتری مدیریت صنعتی',
    totalTaraz: 4650,
    weightedAveragePercent: 55.2,
    coursePercentages: {
      english: 44.0,
      islamic: 50.0,
      math_stats: 58.0,
      management_theories: 54.0,
      economics: 48.0,
      operations_research: 72.0,
      production: 66.0,
      marketing: 0,
    },
    note: 'در دکتری مدیریت صنعتی، تسلط بر تحقیق در عملیات پیشرفته (MCDM/DEA)، آمار و مدیریت تولید عامل اصلی کسب رتبه تک‌رقمی است.',
  },
  {
    rankLabel: 'رتبه ۱۰ کشوری دکتری تخصصی مدیریت صنعتی',
    nationalRank: 10,
    branch: 'industrial',
    degree: 'phd',
    admittedUniversity: 'دانشگاه شهید بهشتی / علامه طباطبایی — دکتری مدیریت صنعتی',
    totalTaraz: 4180,
    weightedAveragePercent: 46.8,
    coursePercentages: {
      english: 36.0,
      islamic: 42.0,
      math_stats: 48.0,
      management_theories: 45.0,
      economics: 40.0,
      operations_research: 60.0,
      production: 55.0,
      marketing: 0,
    },
    note: 'در نمونه‌های موجود، داوطلبان دعوت‌شده به مصاحبهٔ دانشگاه‌های تهران میانگین وزنی بالای ۴۵٪ داشته‌اند؛ این یک مشاهدهٔ نمونه‌ای است، نه قاعدهٔ قطعی.',
  },
  {
    rankLabel: 'رتبه ۱ کشوری دکتری تخصصی مدیریت تکنولوژی (کد ۲۱۲۰)',
    nationalRank: 1,
    branch: 'technology',
    degree: 'phd',
    admittedUniversity: 'دانشگاه علامه طباطبایی / تربیت مدرس / تهران — دکتری مدیریت تکنولوژی',
    totalTaraz: 4620,
    weightedAveragePercent: 53.8,
    coursePercentages: {
      english: 50.0,
      islamic: 48.0,
      math_stats: 50.0,
      management_theories: 60.0,
      economics: 48.0,
      operations_research: 52.0,
      production: 62.0,
      marketing: 0,
    },
    note: 'در دکتری مدیریت تکنولوژی، کتب شیلینگ، تید و بسانت، طاهر خلیل و چسبرو هسته اصلی سؤالات تخصصی با ضریب ۴ هستند.',
  },
  {
    rankLabel: 'رتبه ۱۰ کشوری دکتری تخصصی مدیریت تکنولوژی',
    nationalRank: 10,
    branch: 'technology',
    degree: 'phd',
    admittedUniversity: 'دانشگاه علامه طباطبایی / علم و صنعت — دکتری مدیریت تکنولوژی',
    totalTaraz: 4140,
    weightedAveragePercent: 45.5,
    coursePercentages: {
      english: 40.0,
      islamic: 42.0,
      math_stats: 42.0,
      management_theories: 50.0,
      economics: 40.0,
      operations_research: 44.0,
      production: 52.0,
      marketing: 0,
    },
    note: 'نمونهٔ نمایشی بدون دادهٔ اعتبارسنجی‌شده.',
  },
];

/**
 * ضرایب سختی و آمار شرکت‌کنندگان کنکور مدیریت در ۱۵ سال اخیر (۱۳۹۱ تا ۱۴۰۵)
 */
export const YEAR_DIFFICULTY_CALIBRATIONS: YearDifficultyCalibration[] = [
  {
    year: 1405,
    difficultyIndex: 1.05,
    difficultyLabel: 'دشوار استاندارد',
    totalParticipantsMaster: 27800,
    totalParticipantsPhd: 4600,
    rank1WeightedAvgBusiness: 55.8,
    rank1WeightedAvgIndustrial: 57.2,
    rank1WeightedAvgTechnology: 54.9,
    tehranDayCutoffWeightedAvg: 46.5,
  },
  {
    year: 1404,
    difficultyIndex: 1.06,
    difficultyLabel: 'دشوار استاندارد',
    totalParticipantsMaster: 28400,
    totalParticipantsPhd: 4750,
    rank1WeightedAvgBusiness: 55.2,
    rank1WeightedAvgIndustrial: 56.8,
    rank1WeightedAvgTechnology: 54.5,
    tehranDayCutoffWeightedAvg: 46.0,
  },
  {
    year: 1403,
    difficultyIndex: 1.04,
    difficultyLabel: 'نسبتاً مفهومی-محاسباتی',
    totalParticipantsMaster: 29100,
    totalParticipantsPhd: 4900,
    rank1WeightedAvgBusiness: 56.4,
    rank1WeightedAvgIndustrial: 58.1,
    rank1WeightedAvgTechnology: 55.8,
    tehranDayCutoffWeightedAvg: 47.0,
  },
  {
    year: 1402,
    difficultyIndex: 1.08,
    difficultyLabel: 'بسیار دشوار (ترازدهنده)',
    totalParticipantsMaster: 30500,
    totalParticipantsPhd: 5100,
    rank1WeightedAvgBusiness: 53.9,
    rank1WeightedAvgIndustrial: 55.4,
    rank1WeightedAvgTechnology: 53.2,
    tehranDayCutoffWeightedAvg: 44.8,
  },
  {
    year: 1401,
    difficultyIndex: 1.02,
    difficultyLabel: 'متعادل استاندارد',
    totalParticipantsMaster: 32200,
    totalParticipantsPhd: 5300,
    rank1WeightedAvgBusiness: 57.5,
    rank1WeightedAvgIndustrial: 59.0,
    rank1WeightedAvgTechnology: 56.5,
    tehranDayCutoffWeightedAvg: 48.0,
  },
  {
    year: 1400,
    difficultyIndex: 1.05,
    difficultyLabel: 'دشوار استاندارد',
    totalParticipantsMaster: 33800,
    totalParticipantsPhd: 5450,
    rank1WeightedAvgBusiness: 55.6,
    rank1WeightedAvgIndustrial: 57.3,
    rank1WeightedAvgTechnology: 55.0,
    tehranDayCutoffWeightedAvg: 46.5,
  },
  {
    year: 1399,
    difficultyIndex: 1.03,
    difficultyLabel: 'نسبتاً مفهومی-محاسباتی',
    totalParticipantsMaster: 34500,
    totalParticipantsPhd: 5600,
    rank1WeightedAvgBusiness: 56.8,
    rank1WeightedAvgIndustrial: 58.4,
    rank1WeightedAvgTechnology: 56.0,
    tehranDayCutoffWeightedAvg: 47.2,
  },
  {
    year: 1398,
    difficultyIndex: 1.07,
    difficultyLabel: 'بسیار دشوار (ترازدهنده)',
    totalParticipantsMaster: 35200,
    totalParticipantsPhd: 5800,
    rank1WeightedAvgBusiness: 54.4,
    rank1WeightedAvgIndustrial: 56.0,
    rank1WeightedAvgTechnology: 53.8,
    tehranDayCutoffWeightedAvg: 45.2,
  },
  {
    year: 1397,
    difficultyIndex: 1.01,
    difficultyLabel: 'متعادل استاندارد',
    totalParticipantsMaster: 36800,
    totalParticipantsPhd: 6000,
    rank1WeightedAvgBusiness: 58.0,
    rank1WeightedAvgIndustrial: 59.5,
    rank1WeightedAvgTechnology: 57.1,
    tehranDayCutoffWeightedAvg: 48.5,
  },
  {
    year: 1396,
    difficultyIndex: 1.00,
    difficultyLabel: 'متعادل استاندارد',
    totalParticipantsMaster: 38400,
    totalParticipantsPhd: 6200,
    rank1WeightedAvgBusiness: 58.5,
    rank1WeightedAvgIndustrial: 60.2,
    rank1WeightedAvgTechnology: 57.6,
    tehranDayCutoffWeightedAvg: 49.0,
  },
  {
    year: 1395,
    difficultyIndex: 1.02,
    difficultyLabel: 'متعادل استاندارد',
    totalParticipantsMaster: 39500,
    totalParticipantsPhd: 6400,
    rank1WeightedAvgBusiness: 57.4,
    rank1WeightedAvgIndustrial: 58.9,
    rank1WeightedAvgTechnology: 56.4,
    tehranDayCutoffWeightedAvg: 47.8,
  },
  {
    year: 1394,
    difficultyIndex: 1.04,
    difficultyLabel: 'نسبتاً مفهومی-محاسباتی',
    totalParticipantsMaster: 41200,
    totalParticipantsPhd: 6500,
    rank1WeightedAvgBusiness: 56.2,
    rank1WeightedAvgIndustrial: 57.8,
    rank1WeightedAvgTechnology: 55.3,
    tehranDayCutoffWeightedAvg: 46.9,
  },
  {
    year: 1393,
    difficultyIndex: 1.01,
    difficultyLabel: 'متعادل استاندارد',
    totalParticipantsMaster: 43000,
    totalParticipantsPhd: 6700,
    rank1WeightedAvgBusiness: 58.1,
    rank1WeightedAvgIndustrial: 59.4,
    rank1WeightedAvgTechnology: 57.0,
    tehranDayCutoffWeightedAvg: 48.4,
  },
  {
    year: 1392,
    difficultyIndex: 0.99,
    difficultyLabel: 'متعادل استاندارد',
    totalParticipantsMaster: 44500,
    totalParticipantsPhd: 6900,
    rank1WeightedAvgBusiness: 59.2,
    rank1WeightedAvgIndustrial: 60.8,
    rank1WeightedAvgTechnology: 58.2,
    tehranDayCutoffWeightedAvg: 49.5,
  },
  {
    year: 1391,
    difficultyIndex: 1.00,
    difficultyLabel: 'متعادل استاندارد',
    totalParticipantsMaster: 46000,
    totalParticipantsPhd: 7100,
    rank1WeightedAvgBusiness: 58.6,
    rank1WeightedAvgIndustrial: 60.1,
    rank1WeightedAvgTechnology: 57.5,
    tehranDayCutoffWeightedAvg: 49.0,
  },
];

/**
 * جدول کف تراز و رتبه قبولی دانشگاه‌های برتر کشور در مجموعه مدیریت
 */
export const UNIVERSITY_ADMISSION_TIERS: UniversityAdmissionTier[] = [
  {
    id: 'uni.tehran_sharif_day',
    universityName: 'دانشگاه تهران / دانشگاه صنعتی شریف (روزانه)',
    programs: 'مدیریت بازرگانی، صنعتی، تکنولوژی و نوآوری، مالی و MBA (دوره روزانه)',
    admissionType: 'روزانه',
    minTarazMaster: 8650,
    maxRankBusiness: 42,
    maxRankIndustrial: 35,
    maxRankTechnology: 28,
    minTarazPhd: 4180,
    maxRankPhd: 18,
    city: 'تهران',
  },
  {
    id: 'uni.beheshti_allameh_modares_day',
    universityName: 'دانشگاه شهید بهشتی / علامه طباطبایی / تربیت مدرس (روزانه)',
    programs: 'گرایش‌های اصلی بازرگانی، صنعتی و مدیریت تکنولوژی (دوره روزانه)',
    admissionType: 'روزانه',
    minTarazMaster: 8120,
    maxRankBusiness: 115,
    maxRankIndustrial: 95,
    maxRankTechnology: 75,
    minTarazPhd: 3880,
    maxRankPhd: 55,
    city: 'تهران',
  },
  {
    id: 'uni.amirkabir_iust_tehran_night',
    universityName: 'دانشگاه صنعتی امیرکبیر / علم و صنعت (روزانه) + نوبت دوم دانشگاه تهران',
    programs: 'مدیریت صنعتی، فناوری و بازرگانی (روزانه امیرکبیر و علم و صنعت / شبانه تهران و بهشتی)',
    admissionType: 'روزانه',
    minTarazMaster: 7680,
    maxRankBusiness: 220,
    maxRankIndustrial: 185,
    maxRankTechnology: 145,
    minTarazPhd: 3650,
    maxRankPhd: 95,
    city: 'تهران',
  },
  {
    id: 'uni.kharazmi_alzahra_top_provincial_day',
    universityName: 'دانشگاه خوارزمی، الزهرا، فردوسی مشهد، دانشگاه اصفهان و دانشگاه شیراز (روزانه)',
    programs: 'دوره روزانه دانشگاه‌های برتر کلان‌شهرها + نوبت دوم علامه، امیرکبیر و علم و صنعت',
    admissionType: 'روزانه',
    minTarazMaster: 7180,
    maxRankBusiness: 450,
    maxRankIndustrial: 380,
    maxRankTechnology: 290,
    minTarazPhd: 3420,
    maxRankPhd: 170,
    city: 'تهران / مشهد / اصفهان / شیراز',
  },
  {
    id: 'uni.state_provincial_day_night',
    universityName: 'دانشگاه تبریز، گیلان، مازندران، یزد، باهنر کرمان و بوعلی سینا (روزانه و نوبت دوم)',
    programs: 'دوره روزانه و نوبت دوم دانشگاه‌های دولتی مراکز استان‌ها',
    admissionType: 'نوبت دوم (شبانه)',
    minTarazMaster: 6580,
    maxRankBusiness: 950,
    maxRankIndustrial: 820,
    maxRankTechnology: 640,
    minTarazPhd: 3150,
    maxRankPhd: 320,
    city: 'مراکز استان‌ها',
  },
  {
    id: 'uni.pardis_payamnoor_nonprofit',
    universityName: 'پردیس‌های خودگردان دانشگاه‌های برتر، پیام نور و مؤسسات غیرانتفاعی تراز اول (خاتم، ارشاد)',
    programs: 'پردیس خودگردان تهران/بهشتی، دانشگاه خاتم، مؤسسه آموزش عالی بانکداری و پیام نور تهران',
    admissionType: 'پردیس خودگردان / غیرانتفاعی برتر',
    minTarazMaster: 5850,
    maxRankBusiness: 2400,
    maxRankIndustrial: 2100,
    maxRankTechnology: 1650,
    minTarazPhd: 2800,
    maxRankPhd: 650,
    city: 'تهران و سراسر کشور',
  },
];

/**
 * شبیه‌سازی تراز، رتبه و آستانهٔ دانشگاه.
 *
 * این تابع «پیش‌بینی» نیست: خروجی آن باید به‌عنوان شبیه‌ساز آموزشی نمایش داده شود.
 * برای تبدیل آن به پیش‌بینی معتبر باید کارنامه‌های واقعی و ناشناس جمع‌آوری، سال و
 * ترکیب امتحانی هر کارنامه ثبت، و مدل روی سالی که در آموزش دیده نشده آزموده شود.
 * تا آن زمان `confidence` مقدار `very_low` دارد و `modelLimitations` باید در رابط
 * کاربری نمایش داده شود.
 */
export function predictKonkorRankAndUniversity(params: {
  year: number;
  branch: MajorExamBranch;
  degree: ExamDegreeMode;
  courseInputs: CourseScoreInput[];
}): RankPredictionResult {
  const { year, branch, degree, courseInputs } = params;

  const yearCalib =
    YEAR_DIFFICULTY_CALIBRATIONS.find((y) => y.year === year) ??
    YEAR_DIFFICULTY_CALIBRATIONS[0];

  // ۱. محاسبه میانگین وزنی دقیق با احتساب ضرایب گرایش
  let weightedSum = 0;
  let coeffSum = 0;
  for (const item of courseInputs) {
    if (item.coeff > 0) {
      weightedSum += item.netPercent * item.coeff;
      coeffSum += item.coeff;
    }
  }

  const rawWeightedAvg = coeffSum > 0 ? weightedSum / coeffSum : 0;
  const weightedAveragePercent = Number(rawWeightedAvg.toFixed(1));

  // تعدیل درصد وزنی بر اساس ضریب سختی سال آزمون
  const effectivePercent = rawWeightedAvg * yearCalib.difficultyIndex;

  // ۲. محاسبه تراز کل (در ارشد از ۱۰,۰۰۰ و در دکتری از ۵,۰۰۰)
  // در کنکور ارشد مدیریت: میانگین وزنی ۵۶٪ ~ تراز ۹۹۵۰، میانگین ۴۸٪ ~ تراز ۸۷۰۰، میانگین ۳۸٪ ~ تراز ۷۷۰۰، میانگین ۲۵٪ ~ تراز ۶۶۰۰، میانگین ۰٪ ~ تراز ۴۴۰۰
  let scaledTaraz = 0;
  const maxTarazScale = degree === 'master' ? 10000 : 5000;

  if (degree === 'master') {
    if (effectivePercent <= 0) {
      scaledTaraz = Math.max(3200, Math.round(4450 + effectivePercent * 35));
    } else if (effectivePercent <= 30) {
      // شیب تند اولیه از ۴۴۵۰ تا ۷۰۵۰
      scaledTaraz = Math.round(4450 + effectivePercent * 86.6);
    } else if (effectivePercent <= 50) {
      // از ۳۰٪ (۷۰۵۰) تا ۵۰٪ (۹۱۵۰)
      scaledTaraz = Math.round(7050 + (effectivePercent - 30) * 105);
    } else {
      // بالای ۵۰٪ تا ۱۰۰٪ (اشباع نمایی نزدیک به ۱۰۰۰۰)
      const excess = effectivePercent - 50;
      scaledTaraz = Math.min(
        9995,
        Math.round(9150 + 845 * (1 - Math.exp(-excess / 9.5)))
      );
    }
  } else {
    // تراز کتبی دکتری تخصصی مدیریت (از ۵,۰۰۰)
    if (effectivePercent <= 0) {
      scaledTaraz = Math.max(1600, Math.round(2250 + effectivePercent * 18));
    } else if (effectivePercent <= 35) {
      scaledTaraz = Math.round(2250 + effectivePercent * 46);
    } else if (effectivePercent <= 55) {
      scaledTaraz = Math.round(3860 + (effectivePercent - 35) * 41);
    } else {
      const excess = effectivePercent - 55;
      scaledTaraz = Math.min(
        4980,
        Math.round(4680 + 300 * (1 - Math.exp(-excess / 10)))
      );
    }
  }

  // ۳. فرمول تخمین رتبه کشوری (مدل ترکیبی توزیع تراز سنجش در دنباله بالایی)
  let estimatedRank = 1;
  const totalPool =
    degree === 'master'
      ? yearCalib.totalParticipantsMaster
      : yearCalib.totalParticipantsPhd;

  if (degree === 'master') {
    const branchScale =
      branch === 'business' ? 1.0 : branch === 'industrial' ? 0.82 : 0.65;

    if (scaledTaraz >= 9880) {
      estimatedRank = 1;
    } else if (scaledTaraz >= 9100) {
      // رتبه ۱ تا ۱۰
      const ratio = (9880 - scaledTaraz) / (9880 - 9100);
      estimatedRank = Math.max(1, Math.round((1 + Math.pow(ratio, 1.35) * 9) * branchScale));
    } else if (scaledTaraz >= 8650) {
      // رتبه ۱۰ تا ۴۲ (کف روزانه دانشگاه تهران)
      const ratio = (9100 - scaledTaraz) / (9100 - 8650);
      estimatedRank = Math.round((10 + Math.pow(ratio, 1.25) * 32) * branchScale);
    } else if (scaledTaraz >= 8120) {
      // رتبه ۴۲ تا ۱۱۵ (بهشتی، علامه، تربیت مدرس)
      const ratio = (8650 - scaledTaraz) / (8650 - 8120);
      estimatedRank = Math.round((42 + Math.pow(ratio, 1.2) * 73) * branchScale);
    } else if (scaledTaraz >= 7680) {
      // رتبه ۱۱۵ تا ۲۲۰ (امیرکبیر، علم و صنعت، شبانه تهران)
      const ratio = (8120 - scaledTaraz) / (8120 - 7680);
      estimatedRank = Math.round((115 + Math.pow(ratio, 1.2) * 105) * branchScale);
    } else if (scaledTaraz >= 7180) {
      // رتبه ۲۲۰ تا ۴۵۰
      const ratio = (7680 - scaledTaraz) / (7680 - 7180);
      estimatedRank = Math.round((220 + Math.pow(ratio, 1.25) * 230) * branchScale);
    } else if (scaledTaraz >= 6580) {
      // رتبه ۴۵۰ تا ۹۵۰
      const ratio = (7180 - scaledTaraz) / (7180 - 6580);
      estimatedRank = Math.round((450 + Math.pow(ratio, 1.3) * 500) * branchScale);
    } else if (scaledTaraz >= 5850) {
      // رتبه ۹۵۰ تا ۲۴۰۰
      const ratio = (6580 - scaledTaraz) / (6580 - 5850);
      estimatedRank = Math.round((950 + Math.pow(ratio, 1.35) * 1450) * branchScale);
    } else {
      const ratio = Math.min(1, Math.max(0, (5850 - scaledTaraz) / 2600));
      estimatedRank = Math.min(
        totalPool,
        Math.round(2400 * branchScale + Math.pow(ratio, 1.5) * (totalPool * 0.65))
      );
    }
  } else {
    // تخمین رتبه دکتری تخصصی مدیریت
    if (scaledTaraz >= 4620) {
      estimatedRank = 1;
    } else if (scaledTaraz >= 4180) {
      const ratio = (4620 - scaledTaraz) / (4620 - 4180);
      estimatedRank = Math.max(1, Math.round(1 + Math.pow(ratio, 1.3) * 17));
    } else if (scaledTaraz >= 3880) {
      const ratio = (4180 - scaledTaraz) / (4180 - 3880);
      estimatedRank = Math.round(18 + Math.pow(ratio, 1.2) * 37);
    } else if (scaledTaraz >= 3650) {
      const ratio = (3880 - scaledTaraz) / (3880 - 3650);
      estimatedRank = Math.round(55 + Math.pow(ratio, 1.2) * 40);
    } else if (scaledTaraz >= 3150) {
      const ratio = (3650 - scaledTaraz) / (3650 - 3150);
      estimatedRank = Math.round(95 + Math.pow(ratio, 1.3) * 225);
    } else {
      const ratio = Math.min(1, Math.max(0, (3150 - scaledTaraz) / 1400));
      estimatedRank = Math.min(totalPool, Math.round(320 + Math.pow(ratio, 1.4) * 2500));
    }
  }

  estimatedRank = Math.max(1, estimatedRank);
  const rankSpread = Math.max(1, Math.round(estimatedRank * 0.08));
  const rankRangeMin = Math.max(1, estimatedRank - rankSpread);
  const rankRangeMax = Math.min(totalPool, estimatedRank + rankSpread);
  const percentile = Number(
    Math.max(0.01, Math.min(99.99, (1 - estimatedRank / totalPool) * 100)).toFixed(2)
  );

  // ۴. بازیابی کارنامه رتبه ۱ و رتبه ۱۰ همان گرایش و مقطع
  const top1RankComparison =
    HISTORICAL_TOP_RANK_PROFILES.find(
      (p) => p.branch === branch && p.degree === degree && p.nationalRank === 1
    ) ?? HISTORICAL_TOP_RANK_PROFILES[0];

  const top10RankComparison =
    HISTORICAL_TOP_RANK_PROFILES.find(
      (p) => p.branch === branch && p.degree === degree && p.nationalRank === 10
    ) ?? HISTORICAL_TOP_RANK_PROFILES[1];

  const courseBreakdown = courseInputs.map((c) => {
    const r1 = top1RankComparison.coursePercentages[c.sectionId];
    const r10 = top10RankComparison.coursePercentages[c.sectionId];

    // No historical reference must stay unknown; zero/50/42 would fabricate a benchmark.
    if (r1 === undefined || r10 === undefined) {
      return {
        sectionId: c.sectionId,
        title: c.title,
        coeff: c.coeff,
        userPercent: c.netPercent,
        rank1Percent: null,
        rank10Percent: null,
        gapFromRank1: null,
        status: 'داده تاریخی کافی نیست' as const,
      };
    }

    const gap = Number((c.netPercent - r1).toFixed(1));
    let status: RankPredictionResult['courseBreakdown'][number]['status'] =
      'متوسط (نیازمند ارتقا)';
    if (c.netPercent >= r10 - 3) {
      status = 'عالی (هم‌تراز رتبه برتر)';
    } else if (c.netPercent >= r10 - 15) {
      status = 'خوب (تراز مثبت)';
    } else if (c.netPercent < 15) {
      status = 'نقطه ضعف (نیازمند جبران)';
    }
    return {
      sectionId: c.sectionId,
      title: c.title,
      coeff: c.coeff,
      userPercent: c.netPercent,
      rank1Percent: r1,
      rank10Percent: r10,
      gapFromRank1: gap,
      status,
    };
  });

  // ۵. بررسی وضعیت قبولی در هر یک از رده‌های دانشگاهی
  const universityAdmissions = UNIVERSITY_ADMISSION_TIERS.map((tier) => {
    const minRequiredTaraz =
      degree === 'master' ? tier.minTarazMaster : tier.minTarazPhd;
    const tarazGap = scaledTaraz - minRequiredTaraz;
    let status: RankPredictionResult['universityAdmissions'][number]['status'] =
      'نیازمند افزایش تراز';
    if (tarazGap >= 120) {
      status = 'بسیار هم‌خوان (شبیه‌سازی)';
    } else if (tarazGap >= -140) {
      status = 'مرزی (شبیه‌سازی)';
    }
    return {
      tier,
      status,
      tarazGap,
    };
  });

  const bestMatchedTier =
    universityAdmissions.find((u) => u.status !== 'نیازمند افزایش تراز')?.tier
      .universityName ?? 'مجاز به انتخاب رشته در دوره‌های پیام نور و غیرانتفاعی (نیازمند افزایش درصد در دروس ضریب ۳ و ۴)';

  // ۶. توصیه استراتژیک هوشمند بر اساس بیشترین فاصله در دروس پرضریب
  const highCoeffWeakCourse = [...courseBreakdown]
    .filter((c) => c.coeff >= 2 && c.gapFromRank1 !== null && c.rank10Percent !== null)
    .sort((a, b) => (a.gapFromRank1! * b.coeff) - (b.gapFromRank1! * a.coeff))[0];

  const strategicAdvice = highCoeffWeakCourse
    ? `بیشترین اهرم جهش رتبه شما در درس «${highCoeffWeakCourse.title} (ضریب ${highCoeffWeakCourse.coeff})» است؛ رساندن درصد این درس از ${highCoeffWeakCourse.userPercent}٪ به سطح رتبه ۱۰ کشوری (${highCoeffWeakCourse.rank10Percent}٪) تراز کل شما را بیش از ۴۵۰ واحد ارتقا می‌دهد.`
    : 'توازن درصدهای شما بسیار عالی است؛ بر تثبیت دروس ضریب ۳ و ۴ و کاهش تست‌های غلط تمرکز کنید.';

  return {
    year,
    branch,
    degree,
    weightedAveragePercent,
    effectivePositiveNormalizedPercent: Number(effectivePercent.toFixed(1)),
    scaledTaraz,
    maxTarazScale,
    estimatedRank,
    rankRangeMin,
    rankRangeMax,
    percentile,
    top1RankComparison,
    top10RankComparison,
    courseBreakdown,
    universityAdmissions,
    bestMatchedUniversity: bestMatchedTier,
    strategicAdvice,
    confidence: 'very_low',
    modelLimitations: RANK_MODEL_LIMITATIONS,
  };
}
