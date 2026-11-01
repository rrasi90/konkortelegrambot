/**
 * پوشش واقعی بانک سؤال
 * ------------------------------------------------------------------
 * هدف این ماژول این است که هیچ‌جای محصول درصد پوشش را از تعداد کتاب،
 * تعداد فصل یا تعداد درس‌نامه استنتاج نکند. پوشش فقط از دو عدد واقعی
 * محاسبه می‌شود:
 *
 *   ۱. تعداد سؤالی که دفترچهٔ رسمی اعلام کرده است  (declared)
 *   ۲. تعداد سؤالی که واقعاً در بانک سؤال ثبت شده است (available)
 *
 * دو سطح آزمون جدا شمرده می‌شوند، چون دفترچه‌های موجود همه «کارشناسی ارشد
 * (کد ۱۱۴۲)» هستند و برای دکتری هنوز هیچ دفترچه‌ای در سامانه ثبت نشده است.
 * جمع‌زدن این دو با هم، پوشش دکتری را به‌طور مصنوعی بزرگ نشان می‌دهد.
 */

import { YEARLY_KONKOR_BOOKLETS, YEARLY_KONKOR_QUESTIONS } from './yearlyKonkorExams';
import { INITIAL_QUESTION_BANK } from './konkorData';

export type ExamLevel = 'ارشد' | 'دکتری';

export interface CoverageYearRow {
  year: number;
  /** مجموع سؤال اعلام‌شده در دفترچهٔ همان سال */
  declared: number;
  /** سؤال ثبت‌شده در بانک برای همان سال */
  available: number;
  /** درصد پوشش، گردشده تا یک رقم اعشار */
  percent: number;
  level: ExamLevel;
}

export interface CoverageReport {
  level: ExamLevel;
  declared: number;
  available: number;
  percent: number;
  bookletCount: number;
  byYear: CoverageYearRow[];
  /** آیا برای این سطح، اصلاً دفترچه‌ای ثبت شده است؟ */
  hasBooklets: boolean;
  note: string;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

const percentOf = (available: number, declared: number): number =>
  declared <= 0 ? 0 : round1((available / declared) * 100);

/** سؤال‌هایی که سطحشان صریحاً «دکتری» است. */
const isDoctorate = (q: object): boolean =>
  (q as { examLevel?: string }).examLevel === 'دکتری';

/**
 * پوشش آزمون کارشناسی ارشد (کد ۱۱۴۲).
 * مبنای «اعلام‌شده»، مجموع سؤال دفترچه‌های رسمی ثبت‌شده است.
 */
export function getArshadCoverage(): CoverageReport {
  const booklets = YEARLY_KONKOR_BOOKLETS;
  const questions = YEARLY_KONKOR_QUESTIONS.filter((q) => !isDoctorate(q));

  const byYear: CoverageYearRow[] = booklets
    .map((booklet) => {
      const available = questions.filter((q) => q.examYear === booklet.year).length;
      return {
        year: booklet.year,
        declared: booklet.totalQuestionsInBooklet,
        available,
        percent: percentOf(available, booklet.totalQuestionsInBooklet),
        level: 'ارشد' as ExamLevel,
      };
    })
    .sort((a, b) => a.year - b.year);

  const declared = byYear.reduce((sum, r) => sum + r.declared, 0);
  const available = byYear.reduce((sum, r) => sum + r.available, 0);

  return {
    level: 'ارشد',
    declared,
    available,
    percent: percentOf(available, declared),
    bookletCount: booklets.length,
    byYear,
    hasBooklets: booklets.length > 0,
    note:
      'همهٔ دفترچه‌های ثبت‌شده در سامانه مربوط به آزمون کارشناسی ارشد (کد ۱۱۴۲) هستند. ' +
      'درصد پوشش نسبت به مجموع سؤال اعلام‌شدهٔ همین دفترچه‌ها محاسبه شده است.',
  };
}

/**
 * پوشش آزمون دکتری.
 * برای دکتری هنوز دفترچه‌ای ثبت نشده، پس مخرج کسر وجود ندارد و درصد
 * پوشش قابل محاسبه نیست. به‌جای نمایش یک عدد ساختگی، ۰٪ با توضیح صریح
 * برگردانده می‌شود.
 */
export function getDoctorateCoverage(): CoverageReport {
  const doctorateQuestions = [
    ...INITIAL_QUESTION_BANK.filter(isDoctorate),
    ...YEARLY_KONKOR_QUESTIONS.filter(isDoctorate),
  ];

  return {
    level: 'دکتری',
    declared: 0,
    available: doctorateQuestions.length,
    percent: 0,
    bookletCount: 0,
    byYear: [],
    hasBooklets: false,
    note:
      'برای آزمون دکتری هنوز هیچ دفترچهٔ رسمی در سامانه ثبت نشده است، بنابراین درصد پوشش ' +
      'قابل محاسبه نیست. عدد نمایش‌داده‌شده فقط تعداد سؤال دکتری موجود است، نه پوشش.',
  };
}

export function getCoverageReports(): CoverageReport[] {
  return [getArshadCoverage(), getDoctorateCoverage()];
}

/** تعداد سؤال موجود به تفکیک بخش درسی (برای دیدن ضعف بخش زبان و کمی). */
export function getCoverageBySection(): {
  sectionTitle: string;
  available: number;
}[] {
  const map = new Map<string, number>();
  for (const q of YEARLY_KONKOR_QUESTIONS) {
    const key = q.courseSectionTitle;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([sectionTitle, available]) => ({ sectionTitle, available }))
    .sort((a, b) => b.available - a.available);
}

/**
 * جمع‌بندی صادقانه برای نمایش به کاربر.
 * عدد پوشش هرگز به‌صورت «کامل» یا «۱۰۰٪» گرد نمی‌شود.
 */
export function getCoverageVerdicts(): string[] {
  const arshad = getArshadCoverage();
  const doctorate = getDoctorateCoverage();
  const sections = getCoverageBySection();
  const englishCount = YEARLY_KONKOR_QUESTIONS.filter((q) =>
    q.courseSectionId === 'english'
  ).length;

  const verdicts: string[] = [];

  verdicts.push(
    `بانک آرشیو سؤالات: ${arshad.available} سؤال از ${arshad.declared} سؤال اعلام‌شده در ` +
      `${arshad.bookletCount} دفترچهٔ ارشد (${arshad.percent}٪).`
  );

  verdicts.push(
    `آزمون دکتری: ${doctorate.available} سؤال ثبت‌شده و صفر دفترچهٔ رسمی؛ درصد پوشش در حال حاضر ` +
      'قابل محاسبه نیست.'
  );

  if (englishCount <= 5) {
    verdicts.push(
      `بخش زبان با ${englishCount} سؤال، عملاً پوشش ندارد؛ درک مطلب، کلوز تست و گرامر باید ` +
        'جداگانه ساخته شوند.'
    );
  }

  const weakest = sections[sections.length - 1];
  if (weakest) {
    verdicts.push(
      `کم‌پوشش‌ترین بخش درسی «${weakest.sectionTitle}» با ${weakest.available} سؤال است.`
    );
  }

  verdicts.push(
    'افزودن کتاب و فصل، پوشش آزمون را افزایش نمی‌دهد؛ پوشش فقط با ثبت سؤال رسمی همراه با ' +
      'سال، شمارهٔ سؤال و منبع بالا می‌رود.'
  );

  return verdicts;
}
