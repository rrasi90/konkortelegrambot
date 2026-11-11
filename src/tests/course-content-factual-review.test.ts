import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLASHCARDS } from '../data/flashcards';
import { COURSE_ENCYCLOPEDIA_SUPPLEMENTS } from '../data/comprehensiveCourseEncyclopedia';
import {
  REFERENCE_BOOKS_DATABASE,
  generateBookHandoutMarkdown,
} from '../data/referenceBooksRepo';

const loadJson = (path: string): any =>
  JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));

const phd = loadJson('content/learning-courses/phd-management-expansion.json');
const stats = loadJson('content/learning-courses/statistics-foundations.json');
const topic = (id: string) => phd.topics.find((item: any) => item.id === id);
const question = (id: string) => phd.questions.find((item: any) => item.id === id);
const card = (id: string) => FLASHCARDS.find((item) => item.id === id);

function binomialUpperTail(n: number, k: number): number {
  const choose = (nn: number, kk: number): number => {
    let value = 1;
    for (let i = 1; i <= kk; i += 1) value = (value * (nn - i + 1)) / i;
    return value;
  };
  return Array.from({ length: n - k + 1 }, (_, i) => choose(n, k + i))
    .reduce((sum, value) => sum + value, 0) / 2 ** n;
}

describe('ممیزی دقت محتوای آموزشی AEL — 2026-11-12', () => {
  it('هفت آموزهٔ هود را از تمثیل هدایت‌گری آزبورن و گبلر جدا نگه می‌دارد', () => {
    const q = question('phd-exp.q001');
    expect(q.choices[1]).toContain('کنترل برونداد');
    expect(q.choices[1]).toContain('تفکیک واحدها');
    expect(q.explanation).toContain('آزبورن و گبلر');
    expect(topic('pa.public_theories').concepts[0]).toContain('هفت آموزه');
    expect(card('fc-pa-001')?.back).toContain('صرفه‌جویی در مصرف منابع');
    expect(card('fc-pa-001')?.back).not.toContain('کاسه‌بازی');
  });

  it('برای تمثیل Osborne–Gaebler از عبارت درست هدایت‌گری به‌جای پاروزنی استفاده می‌کند', () => {
    const q = question('phd-exp.q017');
    expect(q.prompt).toContain('هدایت‌گری به‌جای پاروزنی');
    expect(q.prompt).not.toContain('کاسه‌بازی');
    expect(q.explanation).toContain('پاسخ‌گویی');
    expect(phd.questions.some((item: any) => item.prompt.includes('کاسه‌بازی'))).toBe(false);
  });

  it('چهار مرحلهٔ SECI را با نام‌های استاندارد فارسی و توالی درست نگه می‌دارد', () => {
    const q = question('phd-exp.q005');
    expect(q.choices[1]).toContain('اجتماعی‌سازی');
    expect(q.choices[1]).toContain('برونی‌سازی');
    expect(q.answerIndex).toBe(1);
    expect(topic('mis.knowledge_mgmt').concepts[0]).toContain('درونی‌سازی');
    expect(card('fc-mis-002')?.back).toContain('اجتماعی‌سازی');
    expect(card('fc-mis-002')?.back).toContain('برونی‌سازی');
    expect(card('fc-mis-002')?.back).not.toContain('برآمده‌سازی');
  });

  it('اطلاعات محرمانهٔ منتشرنشده را به کارایی قوی نسبت می‌دهد', () => {
    const q = question('phd-exp.q022');
    expect(q.prompt).toContain('محرمانه');
    expect(q.prompt).toContain('منتشرنشده');
    expect(q.answerIndex).toBe(2);
    expect(q.choices[2]).toContain('قوی');
    expect(topic('fin.markets_institutions').workedExample).toContain('کارایی قوی');
  });

  it('CVR نه خبره و هفت رأی ضروری را در سطح ۰٫۰۵ زیر حد بحرانی درست طبقه‌بندی می‌کند', () => {
    const q = question('phd-exp.q024');
    const observedCvr = (7 - 9 / 2) / (9 / 2);
    const criticalCvr = (8 - 9 / 2) / (9 / 2);
    expect(observedCvr).toBeCloseTo(0.5556, 3);
    expect(binomialUpperTail(9, 7)).toBeGreaterThan(0.05);
    expect(binomialUpperTail(9, 8)).toBeLessThan(0.05);
    expect(criticalCvr).toBeCloseTo(0.7778, 3);
    expect(q.answerIndex).toBe(0);
    expect(q.choices[0]).toContain('۰٫۷۸');
    expect(q.sourceIds).toContain('wilson.cvr2012');
    expect(topic('rm.reliability_forms').sourceIds).toContain('wilson.cvr2012');
  });

  it('اثر کاهش آلفا را مشروط بیان می‌کند و افزایش حجم نمونه را تنها راه نمی‌نامد', () => {
    expect(topic('rm.research_design').concepts[2]).toContain('عدم رد فرض صفرِ نادرست');
    expect(topic('rm.research_design').concepts[2]).not.toContain('پذیرش نول غلط');
    expect(topic('rm.research_design').concepts[3]).not.toContain('تنها راه');
    expect(question('phd-exp.q009').explanation).not.toContain('تنها راه');
    expect(card('fc-rm-002')?.back).not.toContain('تنها راه');
  });

  it('در مقایسهٔ پراکندگی، ابهام واریانس جامعه/نمونه را رفع می‌کند', () => {
    const q = stats.questions.find((item: any) => item.id === 'stat.dispersion.q02');
    expect(q.answerIndex).toBe(0);
    expect(q.explanation).toContain('واریانس جامعه ۱۸÷۳=۶');
    expect(q.explanation).toContain('واریانس نمونه ۱۸÷۲=۹');
  });

  it('فلش‌کارت VRIO پیامد نبود هر یک از چهار شرط را تفکیک می‌کند', () => {
    const back = card('fc-sm-001')?.back ?? '';
    expect(back).toContain('برابری رقابتی');
    expect(back).toContain('مزیت موقت');
    expect(back).toContain('O ندارد');
    expect(back).toContain('مزیت رقابتی پایدار');
  });

  it('آزمون‌های نرمال بودن را با مرز ۵۰ به‌عنوان قاعدهٔ سرانگشتی، نه قانون قطعی، معرفی می‌کند', () => {
    const back = card('fc-stats-004')?.back ?? '';
    expect(back).toContain('مرز سرانگشتی ۵۰');
    expect(back).toContain('قانون قطعی');
    expect(card('fc-stats-005')?.extra).toContain('قاعدهٔ سرانگشتی');
    expect(back).toContain('توان آزمون');
  });

  it('تمرین‌های افزوده‌شده در دایرةالمعارف به‌عنوان سؤال رسمیِ دارای سال منتشر نمی‌شوند', () => {
    const authored = COURSE_ENCYCLOPEDIA_SUPPLEMENTS.flatMap((item) => item.extraQuestions);
    expect(authored).toHaveLength(4);
    expect(authored.every((q) => q.origin === 'authored_supplement')).toBe(true);
    expect(authored.every((q) => q.examYear === undefined)).toBe(true);
    expect(COURSE_ENCYCLOPEDIA_SUPPLEMENTS.every((item) => !item.coveredKonkorYears.includes('۱۰۰٪'))).toBe(true);
    const book = REFERENCE_BOOKS_DATABASE.find((item) => item.id === 'book.bus.robbins_daft');
    expect(book).toBeDefined();
    const merged = book!.sampleKonkorQuestions.find((q) => q.id === 'ref.q.robbins.supp.1');
    expect(merged?.origin).toBe('authored_supplement');
    const handout = generateBookHandoutMarkdown(book!);
    expect(handout).toContain('تمرین تألیفی مکمل — سؤال کنکور رسمی نیست');
    expect(handout).not.toContain('تمرین تألیفی مکمل (سؤال کنکور رسمی نیست) — سال 1403');
  });
});
