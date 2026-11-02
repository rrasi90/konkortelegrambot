/**
 * ساختار رسمی آزمون — مرجع مشترک سرور و کلاینت (ARC-01)
 * ------------------------------------------------------------------
 * دو اصول که این ماژول را از نسخه‌های قبلیِ اسناد پروژه جدا می‌کند:
 *
 * ۱) «مجموعهٔ امتحانی»، «کد ترکیب» و «کد زیرمجموعه» یکی نیستند.
 *    کد ۲۱۶۲ کد مجموعهٔ امتحانی «مدیریت» است. سازوکار رسمیِ تعیین مواد،
 *    «کد ترکیب» ۱ تا ۷ است که در دفترچهٔ ۱۴۰۵ (صفحات ۲۴–۲۵) به‌صورت
 *    ردیف‌های جدول استخراج شده است؛ هیچ سند رسمی برای کدهای ۲۱۶۳/۲۱۶۴/
 *    ۲۱۶۵ به‌عنوان «کد زیرمجموعه» در مخزن وجود ندارد و این کدها از مدل
 *    حذف شده‌اند (وضعیت: needs_check تا بازبینی دستی کارنامه‌ها).
 *    ببین: docs/phase-1/EXAM_COMBINATIONS_1405_BASELINE.csv
 *
 * ۲) قواعد آزمون بر اساس سال نسخه‌بندی می‌شود و سطح آزمون هرگز با سطح
 *    دیگر یک مسیر نمی‌شود. حذف «استعداد تحصیلی» و افزایش ضریب دروس
 *    تخصصی به ۵ از آزمون دکتری ۱۴۰۵ اعمال شده است، نه ۱۴۰۳. دفترچهٔ
 *    کارشناسی ارشد (کد ۱۱۴۲) مجموعه، زمان و ضریب‌های خودش را دارد و
 *    سؤال‌های آن هرگز به‌عنوان دفترچهٔ دکتری ارائه نمی‌شوند.
 *
 * هر رکورد یک وضعیت اعتبار دارد تا رابط کاربری به‌جای ادعای قطعیت،
 * منبع و میزان اطمینان را نشان دهد.
 */

export type ExamVerification =
  | 'official_verified' // از دفترچه/اطلاعیهٔ رسمی سازمان سنجش
  | 'reported' // منبع ثانویهٔ معتبر (خبرگزاری، مؤسسهٔ آموزشی)
  | 'needs_check'; // نیازمند تطبیق با دفترچهٔ رسمی همان سال

/** سطوح آزمون — کلید هرگز مشترک نمی‌شود. */
export const EXAM_LEVELS = ['doctorate', 'master'] as const;
export type ExamLevel = (typeof EXAM_LEVELS)[number];

/** سال‌هایی که ساختار دکتری برایشان ثبت شده است. */
export const SUPPORTED_EXAM_YEARS = [
  1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404, 1405, 1406,
] as const;

export type ExamYear = (typeof SUPPORTED_EXAM_YEARS)[number];

/* ------------------------------------------------------------------ */
/* ۰. هویت مسیر هر سطح                                                */
/* ------------------------------------------------------------------ */

export interface ExamPathIdentity {
  level: ExamLevel;
  /** عنوانی که در رابط کاربری نمایش داده می‌شود — دو سطح هرگز یک عنوان ندارند */
  title: string;
  /** کد رسمی مجموعه/دفترچهٔ همین سطح */
  bookletCode: string;
  organizer: string;
  /** آیا سرور می‌تواند جلسهٔ شبیه‌سازی همین سطح را بسازد */
  serverSimulation: 'available' | 'content_gap';
  /** دلیل صادقانهٔ content_gap — پنهان نمی‌شود */
  serverSimulationReason?: string;
  /** مرجع ساختار رسمی همین سطح */
  structureSource: string;
  verification: ExamVerification;
}

export const DOCTORATE_MANAGEMENT_PATH: ExamPathIdentity = {
  level: 'doctorate',
  title: 'آزمون دکتری — مجموعه مدیریت (۲۱۶۲)',
  bookletCode: '2162',
  organizer: 'سازمان سنجش آموزش کشور',
  serverSimulation: 'available',
  structureSource: 'packages/contracts/src/exam-structure.ts (DOCTORATE_EXAM_YEAR_STRUCTURES)',
  verification: 'official_verified',
};

export const MASTER_MANAGEMENT_PATH: ExamPathIdentity = {
  level: 'master',
  title: 'کنکور کارشناسی ارشد — مجموعه مدیریت (۱۱۴۲)',
  bookletCode: '1142',
  organizer: 'سازمان سنجش آموزش کشور',
  serverSimulation: 'content_gap',
  serverSimulationReason:
    'ساختار رسمی دفترچهٔ ۱۱۴۲ از استخراج سؤالات واقعی همان سال‌ها در مجموعهٔ کتابچه‌ها ثبت شده است، ' +
    'اما مخزن سؤال‌های سرور هنوز هیچ سؤال کارشناسی ارشد تأییدشده ندارد. تا پر شدن این مخزن، ' +
    'شبیه‌ساز سرور فقط مسیر دکتری را می‌سازد و هرگز سؤال ارشد را در جلسهٔ دکتری استفاده نمی‌کند.',
  structureSource: 'src/data/yearlyKonkorExams.ts (YEARLY_KONKOR_BOOKLETS)',
  verification: 'official_verified',
};

export const EXAM_PATH_IDENTITIES: Record<ExamLevel, ExamPathIdentity> = {
  doctorate: DOCTORATE_MANAGEMENT_PATH,
  master: MASTER_MANAGEMENT_PATH,
};

export function isExamLevel(value: unknown): value is ExamLevel {
  return typeof value === 'string' && (EXAM_LEVELS as readonly string[]).includes(value);
}

export function getExamPath(level: ExamLevel): ExamPathIdentity {
  return EXAM_PATH_IDENTITIES[level];
}

/* ------------------------------------------------------------------ */
/* ۱. مجموعهٔ امتحانی دکتری                                            */
/* ------------------------------------------------------------------ */

export interface ExamSet {
  /** کد مجموعهٔ امتحانی (نه کد زیرمجموعه) */
  code: string;
  title: string;
  experimentalGroup: string;
  organizer: string;
  /** نخستین سالی که این کد برای مجموعه به کار رفته است */
  validFromYear: number;
  verification: ExamVerification;
  note: string;
}

export const MANAGEMENT_EXAM_SET: ExamSet = {
  code: '2162',
  title: 'مجموعه مدیریت',
  experimentalGroup: 'علوم انسانی',
  organizer: 'سازمان سنجش آموزش کشور',
  validFromYear: 1395,
  verification: 'official_verified',
  note:
    'کد ۲۱۶۲ کد مجموعهٔ امتحانی «مدیریت» است. از آزمون ۱۴۰۴ همهٔ رشته‌های مدیریت ' +
    'زیر همین مجموعه و با همین کد در کارنامه معرفی می‌شوند. کدهای ۲۱۶۳، ۲۱۶۴ و ۲۱۶۵ ' +
    'کد زیرمجموعه‌ها هستند، نه کد مجموعه.',
};

/* ------------------------------------------------------------------ */
/* ۲. ترکیب‌های رسمی (کد ترکیب ۱ تا ۷ — دفترچهٔ ۱۴۰۵، ص۲۴–۲۵)          */
/* ------------------------------------------------------------------ */

export interface ExamCombination {
  /** کد ترکیب همانطور که در ستون «کد ترکیب» دفترچه درج شده است */
  combinationCode: string;
  titles: string[];
  /** شمارهٔ بسته‌های درسی علامت‌خورده برای این ترکیب در ۱۴۰۵ */
  bundleNumbers: string[];
  verification: ExamVerification;
  admissionNote?: string;
}

/**
 * رکوردهایی که تطابق بصری‌شان قطعی نشده `needs_check` هستند و نباید
 * مسیر پیش‌فرض بسازند. منبع: docs/phase-1/EXAM_COMBINATIONS_1405_BASELINE.csv
 */
export const MANAGEMENT_EXAM_COMBINATIONS: ExamCombination[] = [
  {
    combinationCode: '1',
    titles: ['مدیریت بازرگانی', 'مدیریت راهبردی'],
    bundleNumbers: ['1', '2', '3'],
    verification: 'needs_check',
    admissionNote:
      'ردیف‌های بازرگانی قطعی‌اند؛ زیرردیف «مدیریت راهبردی» نیازمند بازخوانی بصری دوباره است.',
  },
  {
    combinationCode: '2',
    titles: ['مدیریت دولتی', 'مدیریت و برنامه‌ریزی فرهنگی', 'مطالعات مدیریت اسلامی'],
    bundleNumbers: ['1', '2', '4'],
    verification: 'needs_check',
    admissionNote:
      'ردیف‌های دولتی قطعی‌اند؛ ردیف‌های فرهنگی/اسلامی فقط بستهٔ ۱؛۲ علامت دارند و تا تطبیق با اصلاحیه منتشر نشوند.',
  },
  {
    combinationCode: '3',
    titles: ['مدیریت صنعتی'],
    bundleNumbers: ['1', '2', '5'],
    verification: 'official_verified',
    admissionNote: 'استراتژی صنعتی: پذیرش فقط دانشگاه آزاد (یادداشت دفترچه).',
  },
  {
    combinationCode: '4',
    titles: ['مدیریت آماد و پشتیبانی'],
    bundleNumbers: ['1', '9'],
    verification: 'official_verified',
    admissionNote: 'مربوط به دانشگاه‌های نظامی و انتظامی؛ برای داوطلب عمومی پیش‌فرض نشود.',
  },
  {
    combinationCode: '5',
    titles: ['مدیریت رسانه', 'مدیریت فناوری اطلاعات', 'مدیریت بحران'],
    bundleNumbers: ['1', '2', '6'],
    verification: 'needs_check',
    admissionNote: 'کنترل سازگاری کد ترکیب با تعریف رسمی در حال انجام است.',
  },
  {
    combinationCode: '6',
    titles: [
      'کارآفرینی',
      'مدیریت فناوری',
      'آینده‌پژوهی',
      'سیاست‌گذاری علم و فناوری',
      'مطالعات نوآوری و توسعه فناوری‌های راهبردی',
    ],
    bundleNumbers: ['1', '2', '7'],
    verification: 'official_verified',
  },
  {
    combinationCode: '7',
    titles: ['مالی (مهندسی مالی، بانکداری، بیمه، حقوق مالی، مالی بین‌المللی)'],
    bundleNumbers: ['1', '2', '8'],
    verification: 'official_verified',
    admissionNote: 'حقوق مالی و مالی بین‌المللی: پذیرش فقط دانشگاه آزاد (یادداشت دفترچه).',
  },
];

/** بسته‌های درسی ۱۴۰۵ — عنوان از ستون رسمی همان شماره‌ها. */
export const MANAGEMENT_COURSE_BUNDLES: Record<string, string[]> = {
  '1': ['زبان انگلیسی'],
  '2': ['مجموعه دروس کارشناسی'],
  '3': ['بازاریابی و مدیریت بازار پیشرفته', 'مدیریت استراتژیک پیشرفته'],
  '4': ['نظریه‌ها و مبانی مدیریت دولتی', 'نظریه‌ها و مبانی خط‌مشی‌گذاری دولتی'],
  '5': ['تحقیق در عملیات پیشرفته', 'مدیریت تولید و عملیات پیشرفته'],
  '6': ['سیستم‌های اطلاعات مدیریت پیشرفته', 'مدیریت دانش'],
  '7': ['نظریه‌های کارآفرینی', 'تئوری‌های نوآوری', 'مدیریت استراتژیک پیشرفته'],
  '8': ['ریسک و مدیریت سرمایه‌گذاری', 'بازارها و نهادهای مالی'],
  '9': ['مدیریت ارتباط و رفتار سازمانی', 'مدیریت استراتژیک'],
};

/* ------------------------------------------------------------------ */
/* ۲ب. زیرمجموعه‌های آموزشی (نقشهٔ داخلی محصول — بدون ادعای کد رسمی)   */
/* ------------------------------------------------------------------ */

export interface ExamSubGroup {
  id: string;
  /** کد زیرمجموعه در کارنامه؛ تا وجود سند رسمی همه null است (R-001). */
  code: string | null;
  title: string;
  fields: string[];
  verification: ExamVerification;
  /** کد ترکیب رسمی ۱۴۰۵ که این زیرمجموعه به آن نگاشت می‌شود */
  combinationCodes: string[];
}

export const MANAGEMENT_SUB_GROUPS: ExamSubGroup[] = [
  {
    id: 'business',
    code: null,
    title: 'مدیریت بازرگانی و راهبردی',
    fields: [
      'مدیریت بازاریابی',
      'مدیریت استراتژیک',
      'مدیریت سیاست‌گذاری بازرگانی',
      'رفتار سازمانی و منابع انسانی',
    ],
    verification: 'needs_check',
    combinationCodes: ['1'],
  },
  {
    id: 'public',
    code: null,
    title: 'مدیریت دولتی',
    fields: [
      'تصمیم‌گیری و خط‌مشی‌گذاری عمومی',
      'مدیریت تطبیقی و توسعه',
      'مدیریت رفتار سازمانی',
      'مدیریت منابع انسانی',
    ],
    verification: 'needs_check',
    combinationCodes: ['2'],
  },
  {
    id: 'industrial',
    code: null,
    title: 'مدیریت صنعتی',
    fields: [
      'تحقیق در عملیات',
      'مدیریت تولید و عملیات',
      'استراتژی صنعتی',
      'مدیریت زنجیره تأمین',
    ],
    verification: 'needs_check',
    combinationCodes: ['3'],
  },
  {
    id: 'media',
    code: null,
    title: 'مدیریت رسانه و اطلاعات',
    fields: ['کسب‌وکار الکترونیک', 'مدیریت دانش', 'سیستم‌های اطلاعاتی پیشرفته'],
    verification: 'needs_check',
    combinationCodes: ['5'],
  },
  {
    id: 'technology',
    code: null,
    title: 'مدیریت فناوری و نوآوری / کارآفرینی',
    fields: ['نوآوری فناورانه', 'انتقال و توسعه فناوری', 'کارآفرینی بین‌الملل و فناورانه'],
    verification: 'needs_check',
    combinationCodes: ['6'],
  },
  {
    id: 'foresight',
    code: null,
    title: 'آینده‌پژوهی',
    fields: ['نظریه‌ها و روش‌های آینده‌پژوهی'],
    verification: 'needs_check',
    combinationCodes: ['6'],
  },
  {
    id: 'stpolicy',
    code: null,
    title: 'سیاست‌گذاری علم و فناوری',
    fields: ['سیاست‌گذاری علم و فناوری', 'مدیریت فناوری'],
    verification: 'needs_check',
    combinationCodes: ['6'],
  },
];

/* ------------------------------------------------------------------ */
/* ۳. مواد امتحانی هر زیرمجموعه                                        */
/* ------------------------------------------------------------------ */

export interface ExamSubject {
  id: string;
  title: string;
  level: 'کارشناسی' | 'کارشناسی ارشد' | 'عمومی';
  /** ضریب برای همین زیرمجموعه؛ null یعنی این درس برای این زیرمجموعه وجود ندارد */
  coefficient: number | null;
}

const SHARED_BACHELOR_SUBJECTS: ExamSubject[] = [
  { id: 'stats', title: 'آمار و کاربرد آن در مدیریت', level: 'کارشناسی', coefficient: 1 },
  { id: 'org', title: 'مبانی سازمان و مدیریت', level: 'کارشناسی', coefficient: 1 },
  { id: 'islamic', title: 'اصول و مبانی مدیریت از دیدگاه اسلام', level: 'کارشناسی', coefficient: 1 },
];

export const SUB_GROUP_SUBJECTS: Record<string, ExamSubject[]> = {
  business: [
    ...SHARED_BACHELOR_SUBJECTS,
    { id: 'marketing', title: 'بازاریابی و مدیریت بازار پیشرفته', level: 'کارشناسی ارشد', coefficient: 1 },
    { id: 'strategy', title: 'مدیریت استراتژیک پیشرفته', level: 'کارشناسی ارشد', coefficient: 1 },
  ],
  public: [
    ...SHARED_BACHELOR_SUBJECTS,
    { id: 'pa_theory', title: 'نظریه‌ها و مبانی مدیریت دولتی', level: 'کارشناسی ارشد', coefficient: 1 },
    { id: 'policy', title: 'نظریه‌ها و مبانی خط‌مشی‌گذاری دولتی', level: 'کارشناسی ارشد', coefficient: 1 },
  ],
  industrial: [
    ...SHARED_BACHELOR_SUBJECTS,
    { id: 'or', title: 'تحقیق در عملیات پیشرفته', level: 'کارشناسی ارشد', coefficient: 1 },
    { id: 'operations', title: 'مدیریت تولید و عملیات پیشرفته', level: 'کارشناسی ارشد', coefficient: 1 },
  ],
  media: [
    ...SHARED_BACHELOR_SUBJECTS,
    { id: 'is_advanced', title: 'سیستم‌های اطلاعات پیشرفته', level: 'کارشناسی ارشد', coefficient: 1 },
    { id: 'it_management', title: 'مدیریت فناوری اطلاعات پیشرفته', level: 'کارشناسی ارشد', coefficient: 1 },
  ],
  technology: [
    ...SHARED_BACHELOR_SUBJECTS,
    { id: 'innovation', title: 'تئوری‌های نوآوری و مدیریت فناوری', level: 'کارشناسی ارشد', coefficient: 1 },
    { id: 'entrepreneurship', title: 'نظریه‌های کارآفرینی پیشرفته', level: 'کارشناسی ارشد', coefficient: 1 },
  ],
  foresight: [
    ...SHARED_BACHELOR_SUBJECTS,
    { id: 'foresight_theory', title: 'نظریه‌ها و روش‌های آینده‌پژوهی', level: 'کارشناسی ارشد', coefficient: 1 },
    { id: 'foresight_method', title: 'روش‌های کمی و کیفی آینده‌پژوهی', level: 'کارشناسی ارشد', coefficient: 1 },
  ],
  stpolicy: [
    ...SHARED_BACHELOR_SUBJECTS,
    { id: 'stp_policy', title: 'سیاست‌گذاری علم و فناوری', level: 'کارشناسی ارشد', coefficient: 1 },
    { id: 'tech_management', title: 'مدیریت فناوری', level: 'کارشناسی ارشد', coefficient: 1 },
  ],
};

/* ------------------------------------------------------------------ */
/* ۴. ساختار آزمون دکتری به تفکیک سال                                  */
/* ------------------------------------------------------------------ */

export interface ExamYearStructure {
  level: ExamLevel;
  year: number;
  setCode: string;
  /** ضریب مجموعهٔ دروس تخصصی در همان سال */
  specializationCoefficient: number;
  languageCoefficient: number;
  /** null یعنی این درس در آن سال از مواد امتحانی حذف شده است */
  aptitudeCoefficient: number | null;
  hasAptitude: boolean;
  specializationQuestionCount: { min: number; max: number } | null;
  languageQuestionCount: number | null;
  durationMinutes: { specialization: number | null; language: number | null };
  /** جریمهٔ هر پاسخ نادرست به نسبت هر پاسخ درست */
  negativeMarkingRatio: number | null;
  verification: ExamVerification;
  source: string;
  changes: string[];
}

export const DOCTORATE_EXAM_YEAR_STRUCTURES: Record<number, ExamYearStructure> = {
  ...Object.fromEntries(
    [1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404].map((year) => [
      year,
      {
        level: 'doctorate',
        year,
        setCode: MANAGEMENT_EXAM_SET.code,
        specializationCoefficient: 4,
        languageCoefficient: 1,
        aptitudeCoefficient: 1,
        hasAptitude: true,
        specializationQuestionCount: { min: 80, max: 90 },
        languageQuestionCount: 30,
        durationMinutes: { specialization: null, language: null },
        negativeMarkingRatio: 1 / 3,
        verification: 'reported',
        source:
          'رویهٔ سازمان سنجش تا آزمون ۱۴۰۴: زبان با ضریب ۱ و استعداد تحصیلی با ضریب ۱ ' +
          'برگزار می‌شد؛ افزایش ضریب تخصصی و حذف استعداد از ۱۴۰۵ اعمال شد.',
        changes: [],
      } satisfies ExamYearStructure,
    ])
  ),
  1405: {
    level: 'doctorate',
    year: 1405,
    setCode: MANAGEMENT_EXAM_SET.code,
    specializationCoefficient: 5,
    languageCoefficient: 1,
    aptitudeCoefficient: null,
    hasAptitude: false,
    specializationQuestionCount: { min: 80, max: 90 },
    languageQuestionCount: 40,
    durationMinutes: { specialization: 105, language: 40 },
    negativeMarkingRatio: 1 / 3,
    verification: 'official_verified',
    source:
      'اطلاعیهٔ سازمان سنجش برای آزمون دکتری ۱۴۰۵: زبان ضریب ۱، دروس تخصصی ضریب ۵، ' +
      'استعداد تحصیلی از مواد امتحانی حذف شد.',
    changes: [
      'استعداد تحصیلی از مواد امتحانی حذف شد.',
      'ضریب دروس تخصصی از ۴ به ۵ افزایش یافت.',
      'دفترچهٔ زبان ۴۰ سؤال در ۴۰ دقیقه و دفترچهٔ تخصصی علوم انسانی ۱۰۵ دقیقه است.',
    ],
  },
  1406: {
    level: 'doctorate',
    year: 1406,
    setCode: MANAGEMENT_EXAM_SET.code,
    specializationCoefficient: 5,
    languageCoefficient: 1,
    aptitudeCoefficient: null,
    hasAptitude: false,
    // اطلاعیهٔ عمومی فقط ضرایب را تثبیت کرده است؛ تعداد، زمان و نمرهٔ منفی
    // از دفترچهٔ ۱۴۰۶ استخراج نشده‌اند و نباید از ۱۴۰۵ کپی شوند.
    specializationQuestionCount: null,
    languageQuestionCount: null,
    durationMinutes: { specialization: null, language: null },
    negativeMarkingRatio: null,
    verification: 'reported',
    source:
      'اطلاعیهٔ عمومی ۱۴۰۶ ضریب زبان ۱، ضریب مجموعهٔ تخصصی ۵ و حذف استعداد را گزارش می‌کند؛ ' +
      'تعداد سؤال، مدت آزمون و نمرهٔ منفی تا دریافت پیوست رسمی نامشخص‌اند.',
    changes: [
      'ضرایب زبان ۱ و تخصصی ۵ بر اساس اطلاعیهٔ عمومی ۱۴۰۶ ثبت شده‌اند.',
      'تعداد سؤال، مدت و نمرهٔ منفی در انتظار تطبیق با دفترچهٔ رسمی هستند.',
    ],
  },
};

/** آخرین سالی که ساختار دکتری ثبت شده است (سال جاری برنامه). */
export const LATEST_EXAM_YEAR: number = Math.max(
  ...Object.keys(DOCTORATE_EXAM_YEAR_STRUCTURES).map(Number)
);

/** ساختار دکتری یک سال؛ اگر سال ثبت نشده باشد، نزدیک‌ترین سالِ قبل برگردانده می‌شود. */
export function getDoctorateExamStructure(year: number): ExamYearStructure {
  const exact = DOCTORATE_EXAM_YEAR_STRUCTURES[year];
  if (exact) return exact;

  const known = Object.keys(DOCTORATE_EXAM_YEAR_STRUCTURES)
    .map(Number)
    .sort((a, b) => a - b);
  const below = known.filter((y) => y <= year);
  const fallbackYear = below[below.length - 1] ?? known[0];
  return DOCTORATE_EXAM_YEAR_STRUCTURES[fallbackYear!]!;
}

/** ساختار رسمی یک سطح/سال. سطح ارشد ساختار سالانهٔ سرور ندارد و خطا می‌دهد. */
export function getExamStructure(level: ExamLevel, year: number): ExamYearStructure {
  if (level !== 'doctorate') {
    throw new ExamStructureUnavailableError(
      `ساختار سالانهٔ سطح «${level}» در این مرجع ثبت نشده است. ` +
        (getExamPath(level).serverSimulationReason ?? '')
    );
  }
  return getDoctorateExamStructure(year);
}

export class ExamStructureUnavailableError extends Error {}

export function getExamChanges(level: ExamLevel, year: number): string[] {
  return getExamStructure(level, year).changes;
}

export function getSubGroups(): ExamSubGroup[] {
  return MANAGEMENT_SUB_GROUPS;
}

export function getSubGroup(id: string): ExamSubGroup | undefined {
  return MANAGEMENT_SUB_GROUPS.find((g) => g.id === id);
}

export function getSubGroupSubjects(subGroupId: string): ExamSubject[] {
  return SUB_GROUP_SUBJECTS[subGroupId] ?? [];
}

/**
 * هشدارهایی که رابط کاربری باید نشان دهد؛ برای جلوگیری از ثابت‌فرض‌کردن
 * الگوی آزمون قدیمی روی داوطلب سال جدید.
 */
export function getExamStructureWarnings(level: ExamLevel, year: number): string[] {
  const structure = getExamStructure(level, year);
  const warnings: string[] = [];

  if (!structure.hasAptitude) {
    warnings.push(
      'در این سال «استعداد تحصیلی» از مواد امتحانی حذف شده است؛ مطالعهٔ آن وقت تلف‌شده است.'
    );
  }
  if (structure.specializationCoefficient >= 5) {
    warnings.push(
      `ضریب دروس تخصصی ${structure.specializationCoefficient} است؛ تقریباً همهٔ وزن آزمون روی تخصصی‌ها است.`
    );
  }
  if (structure.verification !== 'official_verified') {
    warnings.push(
      'ساختار این سال از منبع ثانویه ثبت شده و هنوز با دفترچهٔ رسمی تطبیق داده نشده است.'
    );
  }
  if (structure.negativeMarkingRatio === null) {
    warnings.push(
      'نمرهٔ منفی این سال هنوز از دفترچهٔ رسمی تأیید نشده است؛ نمرهٔ وزنی رسمی محاسبه نمی‌شود.'
    );
  }
  if (structure.specializationQuestionCount === null || structure.languageQuestionCount === null) {
    warnings.push(
      'تعداد سؤال‌های رسمی این سال هنوز تأیید نشده است؛ شبیه‌سازی با تعداد رسمی تا دریافت دفترچه ممکن نیست.'
    );
  }
  if (getExamPath(level).serverSimulation === 'content_gap') {
    warnings.push(getExamPath(level).serverSimulationReason ?? '');
  }
  return warnings;
}

/** مجموع ضریب‌ها برای محاسبهٔ سهم هر درس از نمرهٔ کل. */
export function getCoefficientTotal(level: ExamLevel, year: number, subGroupId: string): number {
  const structure = getExamStructure(level, year);
  // ضریب ۵ به کل بستهٔ تخصصی تعلق دارد، نه به هر یک از درس‌های داخل بسته.
  // تعداد درس‌های فهرست‌شده نباید وزن رسمی تخصصی را چند برابر کند.
  if (!SUB_GROUP_SUBJECTS[subGroupId]) return 0;
  return (
    Math.max(0, structure.specializationCoefficient) +
    Math.max(0, structure.languageCoefficient) +
    Math.max(0, structure.aptitudeCoefficient ?? 0)
  );
}

/** درصد سهم دروس تخصصی از کل نمرهٔ وزنی. */
export function getSpecializationSharePercent(
  level: ExamLevel,
  year: number,
  subGroupId: string
): number {
  const structure = getExamStructure(level, year);
  const total = getCoefficientTotal(level, year, subGroupId);
  if (total <= 0) return 0;
  const specialized = Math.max(0, structure.specializationCoefficient);
  return Math.round((specialized / total) * 100);
}

export function getUnverifiedSubGroupCodes(): ExamSubGroup[] {
  return MANAGEMENT_SUB_GROUPS.filter((g) => g.verification === 'needs_check');
}

export function getCombination(code: string): ExamCombination | undefined {
  return MANAGEMENT_EXAM_COMBINATIONS.find((k) => k.combinationCode === code);
}

export function getCombinationsForSubGroup(subGroupId: string): ExamCombination[] {
  const group = getSubGroup(subGroupId);
  if (!group) return [];
  return group.combinationCodes
    .map((code) => getCombination(code))
    .filter((k): k is ExamCombination => k !== undefined);
}
