/** یک فصل کلیدی کتاب مرجع؛ واحد اصلی مرور «کتاب ← فصل ← آموزش و تست» */
export interface BookChapter {
  /** شناسه یکتا: ch.<کد کتاب>.<شماره> */
  id: string;
  /** شمارهٔ نمایشی فصل در کتاب (مثلاً «۳») */
  number: string;
  title: string;
  /**
   * برآورد تاریخی قدیمی؛ منبع آن در بخشی از کاتالوگ به آزمون ارشد ۱۱۴۲ مربوط است
   * و برای اولویت‌بندی کنکور دکتری معتبر یا قابل مقایسه نیست.
   * فقط تا زمان بازبینی داده‌های منبع حفظ شده و نباید به‌عنوان بودجه‌بندی دکتری نمایش داده شود.
   */
  examCount: number;
  /** گره‌های دانش متناظر برای اتصال به درس‌نامهٔ کامل و بانک تست */
  nodes: string[];
  /** نکات آموزشی اصلی فصل */
  points: string[];
  /** فرمول‌ها و مدل‌های کلیدی */
  formulas?: string[];
}

/** @deprecated تا زمان ورود بودجه‌بندی مستند مخصوص دکتری، از این رتبه‌بندی استفاده نشود. */
export type ChapterImportance = 'critical' | 'important' | 'supporting';

export const getChapterImportance = (examCount: number): ChapterImportance => {
  if (examCount >= 3) return 'critical';
  if (examCount === 2) return 'important';
  return 'supporting';
};

export const CHAPTER_IMPORTANCE_LABEL: Record<ChapterImportance, string> = {
  critical: 'حیاتی — چند سؤال در ادوار',
  important: 'مهم — تکرارشونده',
  supporting: 'مکمل — ترکیبی',
};
