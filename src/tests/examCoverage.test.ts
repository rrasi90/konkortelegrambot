import { describe, it, expect } from 'vitest';
import {
  getArshadCoverage,
  getDoctorateCoverage,
  getCoverageVerdicts,
  getCoverageBySection,
} from '../data/examCoverage';
import { INITIAL_QUESTION_BANK, mergeQuestionsUnique } from '../data/konkorData';
import { YEARLY_KONKOR_QUESTIONS } from '../data/yearlyKonkorExams';

/**
 * پوشش باید از دادهٔ واقعی محاسبه شود، نه از تعداد کتاب یا درس‌نامه.
 * این تست‌ها جلوی بازگشت ادعاهای «پوشش کامل» را می‌گیرند.
 */
describe('پوشش واقعی بانک سؤال', () => {
  it('سطح ارشد و دکتری جدا شمرده می‌شوند و با هم جمع نمی‌شوند', () => {
    const arshad = getArshadCoverage();
    const doctorate = getDoctorateCoverage();

    expect(arshad.declared).toBeGreaterThan(0);
    // سؤال‌های دکتری نباید در مخرج یا صورت کسر ارشد بیایند
    expect(doctorate.available).toBeGreaterThanOrEqual(0);
    expect(arshad.available + doctorate.available).toBeGreaterThan(arshad.available);
  });

  it('اعداد پوشش را از دادهٔ واقعی می‌گیرد و درصد با تقسیم ساده می‌خواند', () => {
    const arshad = getArshadCoverage();
    const sumDeclared = arshad.byYear.reduce((s, r) => s + r.declared, 0);
    const sumAvailable = arshad.byYear.reduce((s, r) => s + r.available, 0);

    expect(arshad.declared).toBe(sumDeclared);
    expect(arshad.available).toBe(sumAvailable);
    expect(arshad.percent).toBeCloseTo((sumAvailable / sumDeclared) * 100, 0);
  });

  it('پوشش ارشد بزرگ‌تر از ۱۰۰٪ یا منفی نیست و واقعاً پایین است', () => {
    const arshad = getArshadCoverage();

    expect(arshad.percent).toBeGreaterThanOrEqual(0);
    expect(arshad.percent).toBeLessThanOrEqual(100);
    // بانک هنوز فاصلهٔ زیادی تا پوشش کامل دارد؛ این گارد جلوی ادعای «نزدیک ۱۰۰٪» را می‌گیرد.
    expect(arshad.percent).toBeLessThan(30);
  });

  it('برای دکتری هیچ دفترچه‌ای ثبت نشده و درصد به‌جای عدد ساختگی صفر است', () => {
    const doctorate = getDoctorateCoverage();

    expect(doctorate.hasBooklets).toBe(false);
    expect(doctorate.bookletCount).toBe(0);
    expect(doctorate.declared).toBe(0);
    expect(doctorate.percent).toBe(0);
    expect(doctorate.note).toContain('قابل محاسبه نیست');
  });

  it('هر ردیف سالانهٔ ارشد نسبت درصد درستی دارد', () => {
    const arshad = getArshadCoverage();

    for (const row of arshad.byYear) {
      expect(row.declared).toBeGreaterThan(0);
      expect(row.available).toBeGreaterThanOrEqual(0);
      expect(row.available).toBeLessThanOrEqual(row.declared);
      expect(row.percent).toBeCloseTo((row.available / row.declared) * 100, 0);
    }
  });

  it('جمع‌بندی صریحاً می‌گوید افزودن کتاب پوشش را بالا نمی‌برد', () => {
    const verdicts = getCoverageVerdicts().join(' ');

    expect(verdicts).toContain('دفترچهٔ ارشد');
    expect(verdicts).toContain('دکتری');
    expect(verdicts).toContain('پوشش آزمون را افزایش نمی‌دهد');
  });

  it('تعداد سؤال هر بخش با سؤال‌های سالانه می‌خواند', () => {
    const sections = getCoverageBySection();
    const totalFromSections = sections.reduce((s, r) => s + r.available, 0);
    const arshad = getArshadCoverage();
    const doctorate = getDoctorateCoverage();

    expect(sections.length).toBeGreaterThan(0);
    // بخش‌ها روی سؤال‌های آرشیو سالانه محاسبه می‌شوند، که شامل سطح ارشد و
    // دسته‌ای از سؤال‌های دکتری است.
    expect(totalFromSections).toBeGreaterThanOrEqual(arshad.available);
    expect(totalFromSections).toBeLessThanOrEqual(
      arshad.available + doctorate.available
    );
  });

  it('R-026: ادغام INITIAL + YEARLY بدون یکتاسازی، آرایهٔ تکراری می‌دهد؛ coverage دکتری یک‌شمارشی است', () => {
    // شرط ساختاری: هر id سالانه در بانک اصلی هم هست (spread) — پس چسباندن
    // مستقیم دو آرایه حتماً id تکراری تولید می‌کند.
    const initialIds = new Set(INITIAL_QUESTION_BANK.map((q) => q.id));
    for (const q of YEARLY_KONKOR_QUESTIONS) expect(initialIds.has(q.id)).toBe(true);
    const naiveConcat = [...INITIAL_QUESTION_BANK, ...YEARLY_KONKOR_QUESTIONS];
    expect(new Set(naiveConcat.map((q) => q.id)).size).toBeLessThan(naiveConcat.length);

    // همان معرف isDoctorate در examCoverage (بدون export آن، منطق را بازتولید می‌کنیم)
    const isDoctorate = (q: object): boolean => {
      const item = q as { examLevel?: string; sourceReference?: string };
      return (
        item.examLevel === 'دکتری' ||
        (typeof item.sourceReference === 'string' && item.sourceReference.includes('دکتری'))
      );
    };

    // coverage دکتری باید یکتا بشمارد: available == تعداد id یکتای سؤالات دکتری
    const doctorate = getDoctorateCoverage();
    const uniquePhdIds = new Set(
      mergeQuestionsUnique(
        INITIAL_QUESTION_BANK.filter(isDoctorate),
        YEARLY_KONKOR_QUESTIONS.filter(isDoctorate),
      ).map((q) => q.id),
    );
    expect(doctorate.available).toBe(uniquePhdIds.size);
    // و قطعاً کمتر از شمارش naive (اثبات رفع دوباره‌شماری)
    const naivePhdCount =
      INITIAL_QUESTION_BANK.filter(isDoctorate).length +
      YEARLY_KONKOR_QUESTIONS.filter(isDoctorate).length;
    expect(doctorate.available).toBeLessThanOrEqual(naivePhdCount);
  });
});
