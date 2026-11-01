/**
 * مبنای عدد `examCount`.
 *
 * این عدد از دفترچه‌های کارشناسی ارشد (کد ۱۱۴۲) استخراج شده است، نه آزمون دکتری.
 * پس برای اولویت‌بندی مطالعهٔ دکتری معتبر نیست و رابط کاربری باید همین را نشان دهد.
 */
export const CHAPTER_FREQUENCY_BASIS =
  'برآورد از دفترچه‌های کارشناسی ارشد (کد ۱۱۴۲)، ۱۳۹۱ تا ۱۴۰۵ — نه آزمون دکتری';

/** یک فصل کلیدی کتاب مرجع؛ واحد اصلی مرور «کتاب ← فصل ← آموزش و تست» */
export interface BookChapter {
  /** شناسه یکتا: ch.<کد کتاب>.<شماره> */
  id: string;
  /** شمارهٔ نمایشی فصل در کتاب (مثلاً «۳») */
  number: string;
  title: string;
  /**
   * تعداد سؤالی که در ادوار **آزمون کارشناسی ارشد (کد ۱۱۴۲)** از این فصل طرح شده.
   * برآورد است و مبنای آن در `CHAPTER_FREQUENCY_BASIS` آمده.
   * این عدد شاخص اهمیت دکتری نیست.
   */
  examCount: number;
  /** گره‌های دانش متناظر برای اتصال به درس‌نامهٔ کامل و بانک تست */
  nodes: string[];
  /** نکات آموزشی اصلی فصل */
  points: string[];
  /** فرمول‌ها و مدل‌های کلیدی */
  formulas?: string[];
}

/** اهمیت فصل بر پایهٔ تعداد سؤال طرح‌شده از آن */
export type ChapterImportance = 'critical' | 'important' | 'supporting';

export const getChapterImportance = (examCount: number): ChapterImportance => {
  if (examCount >= 3) return 'critical';
  if (examCount === 2) return 'important';
  return 'supporting';
};

export const CHAPTER_IMPORTANCE_LABEL: Record<ChapterImportance, string> = {
  critical: 'حیاتی در ارشد — چند سؤال در ادوار',
  important: 'مهم در ارشد — تکرارشونده',
  supporting: 'مکمل در ارشد — ترکیبی',
};

/**
 * اهمیت یک فصل برای برنامهٔ مطالعهٔ دکتری.
 *
 * تا وقتی فراوانی سؤال دکتری برای هر فصل ثبت نشده، مقدار «نامعلوم» برگردانده
 * می‌شود تا برچسب ارشد به‌اشتباه اهمیت دکتری تلقی نشود.
 */
export type DoctorateChapterImportance = 'verified' | 'unknown';

export const getDoctorateChapterImportance = (
  doctorateExamCount: number | undefined
): DoctorateChapterImportance =>
  typeof doctorateExamCount === 'number' && doctorateExamCount > 0
    ? 'verified'
    : 'unknown';

export const DOCTORATE_IMPORTANCE_LABEL: Record<DoctorateChapterImportance, string> = {
  verified: 'فراوانی دکتری ثبت شده',
  unknown: 'اهمیت دکتری هنوز سنجیده نشده',
};
