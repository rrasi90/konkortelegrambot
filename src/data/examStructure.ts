/**
 * ساختار رسمی آزمون دکتری — مجموعهٔ مدیریت
 * ------------------------------------------------------------------
 * این ماژول تنها مرجع ساختار آزمون است. الگوی آزمون سال‌های قدیمی
 * نباید به‌صورت ثابت به داوطلب سال‌های بعد نسبت داده شود.
 *
 * دو اصل که این فایل را از نسخه‌های قبلیِ اسناد پروژه جدا می‌کند:
 *
 * ۱) «مجموعهٔ امتحانی» و «کد ضریب/زیرمجموعه» یکی نیستند.
 *    کد ۲۱۶۲ کد مجموعهٔ امتحانی «مدیریت» است؛ ۲۱۶۲/۲۱۶۳/۲۱۶۴/۲۱۶۵
 *    کدهای زیرمجموعه‌ها (بازرگانی، دولتی، صنعتی، رسانه و اطلاعات) هستند.
 *    در اسناد قبلی کل مجموعه با کد ۲۱۶۴ (که در واقع کد مدیریت صنعتی است)
 *    معرفی شده بود.
 *
 * ۲) قواعد آزمون بر اساس سال نسخه‌بندی می‌شود.
 *    حذف «استعداد تحصیلی» و افزایش ضریب دروس تخصصی به ۵ از آزمون
 *    ۱۴۰۵ اعمال شده است، نه ۱۴۰۳. برای ۱۴۰۳ و ۱۴۰۴ این درس هنوز
 *    با ضریب ۱ برگزار می‌شد.
 *
 * هر رکورد یک وضعیت اعتبار دارد تا رابط کاربری بتواند به‌جای ادعای
 * قطعیت، منبع و میزان اطمینان را نشان دهد.
 */

export type ExamVerification =
  | 'official_verified' // از دفترچه/اطلاعیهٔ رسمی سازمان سنجش
  | 'reported' // منبع ثانویهٔ معتبر (خبرگزاری، مؤسسهٔ آموزشی)
  | 'needs_check'; // نیازمند تطبیق با دفترچهٔ رسمی همان سال

/** سال‌هایی که ساختار آزمون برایشان ثبت شده است. */
export const SUPPORTED_EXAM_YEARS = [
  1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404, 1405, 1406,
] as const;

export type ExamYear = (typeof SUPPORTED_EXAM_YEARS)[number];

/* ------------------------------------------------------------------ */
/* ۱. مجموعهٔ امتحانی                                                  */
/* ------------------------------------------------------------------ */

export interface ExamSet {
  /** کد مجموعهٔ امتحانی (نه کد زیرمجموعه) */
  code: string;
  title: string;
  /** گروه آزمایشی */
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
/* ۲. زیرمجموعه‌ها (کد ضریب / رشته‌های امتحانی)                        */
/* ------------------------------------------------------------------ */

export interface ExamSubGroup {
  id: string;
  /** کد زیرمجموعه در کارنامه؛ در صورت نبودِ سند رسمی null است. */
  code: string | null;
  title: string;
  /** رشته‌ها و گرایش‌های مندرج در جدول رسمی */
  fields: string[];
  verification: ExamVerification;
}

export const MANAGEMENT_SUB_GROUPS: ExamSubGroup[] = [
  {
    id: 'business',
    code: '2162',
    title: 'مدیریت بازرگانی و راهبردی',
    fields: [
      'مدیریت بازاریابی',
      'مدیریت استراتژیک',
      'مدیریت سیاست‌گذاری بازرگانی',
      'رفتار سازمانی و منابع انسانی',
    ],
    verification: 'official_verified',
  },
  {
    id: 'public',
    code: '2163',
    title: 'مدیریت دولتی',
    fields: [
      'تصمیم‌گیری و خط‌مشی‌گذاری عمومی',
      'مدیریت تطبیقی و توسعه',
      'مدیریت رفتار سازمانی',
      'مدیریت منابع انسانی',
    ],
    verification: 'official_verified',
  },
  {
    id: 'industrial',
    code: '2164',
    title: 'مدیریت صنعتی',
    fields: [
      'تحقیق در عملیات',
      'مدیریت تولید و عملیات',
      'استراتژی صنعتی',
      'مدیریت زنجیره تأمین',
    ],
    verification: 'official_verified',
  },
  {
    id: 'media',
    code: '2165',
    title: 'مدیریت رسانه و اطلاعات',
    fields: ['کسب‌وکار الکترونیک', 'مدیریت دانش', 'سیستم‌های اطلاعاتی پیشرفته'],
    verification: 'official_verified',
  },
  {
    id: 'technology',
    code: null,
    title: 'مدیریت فناوری و نوآوری / کارآفرینی',
    fields: [
      'نوآوری فناورانه',
      'انتقال و توسعه فناوری',
      'کارآفرینی بین‌الملل و فناورانه',
    ],
    verification: 'needs_check',
  },
  {
    id: 'foresight',
    code: null,
    title: 'آینده‌پژوهی',
    fields: ['نظریه‌ها و روش‌های آینده‌پژوهی'],
    verification: 'needs_check',
  },
  {
    id: 'stpolicy',
    code: null,
    title: 'سیاست‌گذاری علم و فناوری',
    fields: ['سیاست‌گذاری علم و فناوری', 'مدیریت فناوری'],
    verification: 'needs_check',
  },
];

/* ------------------------------------------------------------------ */
/* ۳. مواد امتحانی هر زیرمجموعه                                        */
/* ------------------------------------------------------------------ */

export interface ExamSubject {
  id: string;
  title: string;
  /** سطح درس در جدول رسمی */
  level: 'کارشناسی' | 'کارشناسی ارشد' | 'عمومی';
  /** ضریب برای همین زیرمجموعه؛ null یعنی این درس برای این زیرمجموعه وجود ندارد */
  coefficient: number | null;
}

/** دروس مشترک سطح کارشناسی بین همهٔ زیرمجموعه‌های مدیریت */
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
/* ۴. ساختار آزمون به تفکیک سال                                       */
/* ------------------------------------------------------------------ */

export interface ExamYearStructure {
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
  negativeMarkingRatio: number;
  verification: ExamVerification;
  source: string;
  /** تغییرات این سال نسبت به سال قبل */
  changes: string[];
}

/**
 * جدول نسخه‌بندی‌شدهٔ ساختار آزمون.
 * کلید: سال شمسی.
 */
export const EXAM_YEAR_STRUCTURES: Record<number, ExamYearStructure> = {
  ...Object.fromEntries(
    [1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404].map((year) => [
      year,
      {
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
        verification: 'reported' as ExamVerification,
        source:
          'رویهٔ سازمان سنجش تا آزمون ۱۴۰۴: زبان با ضریب ۱ و استعداد تحصیلی با ضریب ۱ ' +
          'برگزار می‌شد؛ افزایش ضریب تخصصی و حذف استعداد از ۱۴۰۵ اعمال شد.',
        changes: [],
      },
    ])
  ),
  1405: {
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
    year: 1406,
    setCode: MANAGEMENT_EXAM_SET.code,
    specializationCoefficient: 5,
    languageCoefficient: 1,
    aptitudeCoefficient: null,
    hasAptitude: false,
    specializationQuestionCount: { min: 80, max: 90 },
    languageQuestionCount: 40,
    durationMinutes: { specialization: 105, language: 40 },
    negativeMarkingRatio: 1 / 3,
    verification: 'reported',
    source:
      'رویهٔ آزمون ۱۴۰۶ بر پایهٔ اطلاعیه‌های منتشرشده: ادامهٔ ساختار ۱۴۰۵ ' +
      '(زبان ضریب ۱، تخصصی ضریب ۵، بدون استعداد تحصیلی). نیازمند تطبیق با دفترچهٔ رسمی ۱۴۰۶.',
    changes: ['ساختار نسبت به ۱۴۰۵ تغییر نکرد.'],
  },
};

/* ------------------------------------------------------------------ */
/* ۵. توابع دسترسی                                                     */
/* ------------------------------------------------------------------ */

/** آخرین سالی که ساختار آن ثبت شده است (سال جاری برنامه). */
export const LATEST_EXAM_YEAR: number = Math.max(
  ...Object.keys(EXAM_YEAR_STRUCTURES).map(Number)
);

/** ساختار آزمون یک سال؛ اگر سال ثبت نشده باشد، نزدیک‌ترین سال قبل برگردانده می‌شود. */
export function getExamStructure(year: number): ExamYearStructure {
  const exact = EXAM_YEAR_STRUCTURES[year];
  if (exact) return exact;

  const known = Object.keys(EXAM_YEAR_STRUCTURES)
    .map(Number)
    .sort((a, b) => a - b);
  const below = known.filter((y) => y <= year);
  if (below.length > 0) return EXAM_YEAR_STRUCTURES[below[below.length - 1]];
  return EXAM_YEAR_STRUCTURES[known[0]];
}

/** آیا ساختار این سال با سال قبلش تفاوت دارد؟ */
export function getExamChanges(year: number): string[] {
  return getExamStructure(year).changes;
}

/** زیرمجموعه‌های فعال و کدهایشان. */
export function getSubGroups(): ExamSubGroup[] {
  return MANAGEMENT_SUB_GROUPS;
}

export function getSubGroup(id: string): ExamSubGroup | undefined {
  return MANAGEMENT_SUB_GROUPS.find((g) => g.id === id);
}

/** مواد امتحانی یک زیرمجموعه. */
export function getSubGroupSubjects(subGroupId: string): ExamSubject[] {
  return SUB_GROUP_SUBJECTS[subGroupId] ?? [];
}

/**
 * لیست هشدارهایی که رابط کاربری باید نشان دهد؛ برای جلوگیری از
 * ثابت‌فرض‌کردن الگوی آزمون قدیمی روی داوطلب سال جدید.
 */
export function getExamStructureWarnings(year: number): string[] {
  const structure = getExamStructure(year);
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
  return warnings;
}

/** مجموع ضریب‌ها برای محاسبهٔ سهم هر درس از نمرهٔ کل. */
export function getCoefficientTotal(year: number, subGroupId: string): number {
  const structure = getExamStructure(year);
  const specialized = SUB_GROUP_SUBJECTS[subGroupId]?.length ?? 0;
  return (
    specialized * structure.specializationCoefficient +
    structure.languageCoefficient +
    (structure.aptitudeCoefficient ?? 0)
  );
}

/** درصد سهم دروس تخصصی از کل نمرهٔ وزنی. */
export function getSpecializationSharePercent(year: number, subGroupId: string): number {
  const structure = getExamStructure(year);
  const total = getCoefficientTotal(year, subGroupId);
  if (total <= 0) return 0;
  const specialized = (SUB_GROUP_SUBJECTS[subGroupId]?.length ?? 0) * structure.specializationCoefficient;
  return Math.round((specialized / total) * 100);
}

/** کدهای زیرمجموعه که هنوز سند رسمی ندارند. */
export function getUnverifiedSubGroupCodes(): ExamSubGroup[] {
  return MANAGEMENT_SUB_GROUPS.filter((g) => g.verification === 'needs_check');
}
