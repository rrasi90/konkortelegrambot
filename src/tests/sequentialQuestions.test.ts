import { describe, expect, it } from 'vitest';
import {
  extractByNumber,
  normalizeFa,
  unwrapLatex,
} from '../../scripts/lib/sequential-questions.mts';

/**
 * استخراج‌کننده با شش بازنویسی به این شکل رسیده است؛ این تست‌ها رفتار را قفل
 * می‌کنند تا تغییر بعدی بی‌صدا شماره‌گذاری را نشکند.
 */
const booklet = {
  total: 6,
  ranges: [
    { sectionId: 'islamic', from: 1, to: 2, title: 'اسلامی' },
    { sectionId: 'marketing', from: 3, to: 6, title: 'بازاریابی' },
  ],
};

describe('استخراج سؤال بر پایهٔ خط شماره‌دار سؤال', () => {
  it('گزینه‌هایی که برچسبشان درون خط است را می‌خواند', () => {
    const pages = [
      [
        '1 - کدام گزاره دربارهٔ ساختار سازمانی درست است؟',
        '۲) پاسخ دوم',
        '۴) پاسخ چهارم',
        '۱) پاسخ اول',
        '۳) پاسخ سوم',
        '',
        '2- گزارهٔ دوم دربارهٔ سبک رهبری کدام است؟',
        '1) الف 2) ب 3) ج 4) د',
      ].join('\n'),
    ];

    const result = extractByNumber(pages, booklet);

    expect(result.questions.map((question) => question.number)).toEqual([1, 2]);
    expect(result.questions[0]?.options).toEqual(['پاسخ اول', 'پاسخ دوم', 'پاسخ سوم', 'پاسخ چهارم']);
    expect(result.questions[1]?.options).toEqual(['الف', 'ب', 'ج', 'د']);
  });

  it('از سؤال‌های نظرکرده شمارهٔ بقیه را جابه‌جا نمی‌کند', () => {
    const pages = [
      [
        '1 - سؤال یک دربارهٔ تعریف مدیریت است',
        '1) الف 2) ب 3) ج 4) د',
        '',
        '3 - سؤال سه دربارهٔ بازاریابی است و سؤال دو در OCR گم شده',
        '1) الف 2) ب 3) ج 4) د',
        '',
        '4 - سؤال چهار دربارهٔ آمیختهٔ بازاریابی است',
        '1) الف 2) ب 3) ج 4) د',
      ].join('\n'),
    ];

    const result = extractByNumber(pages, booklet);

    expect(result.questions.map((question) => question.number)).toEqual([1, 3, 4]);
    expect(result.questions[1]?.sectionId).toBe('marketing');
  });

  it('ردیف جدول پاسخ‌نامه را تکیه‌گاه نمی‌شمارد', () => {
    const pages = [
      [
        '5 - سؤال پنج دربارهٔ برنامهٔ بازاریابی است',
        '1) الف 2) ب 3) ج 4) د',
        '',
        '6 (2)',
        '5 (4)',
      ].join('\n'),
    ];

    const result = extractByNumber(pages, booklet);

    expect(result.questions.map((question) => question.number)).toEqual([5]);
  });

  it('گزینه‌ای را که برچسبش بعد از مقدار است می‌خواند', () => {
    const pages = [
      [
        '5 - مشتق تابع زیر را حساب کن',
        '2x+1',
        '(1)',
        '2x-1',
        '(2)',
        'x+1',
        '(3)',
        'x-1',
        '(4)',
      ].join('\n'),
    ];

    const result = extractByNumber(pages, booklet);

    expect(result.questions.map((question) => question.number)).toEqual([5]);
  });

  it('سؤال با گزینهٔ ناقص را رد می‌کند و دلیل را ثبت می‌کند', () => {
    const pages = [
      [
        '5 - سؤال پنج دربارهٔ قیمت‌گذاری بی‌گزینه است',
        '1) الف 2) ب 3) ج',
      ].join('\n'),
    ];

    const result = extractByNumber(pages, booklet);

    expect(result.questions).toHaveLength(0);
    expect(result.rejections[0]?.reason).toBe('گزینه‌های کامل نیست');
  });

  it('درس را از شمارهٔ سؤال می‌گیرد نه از سرصفحهٔ خراب', () => {
    const pages = [
      [
        '## مدریت متابن انسانی:',
        '4 - سؤال چهار دربارهٔ بخش‌بندی بازار است',
        '1) الف 2) ب 3) ج 4) د',
      ].join('\n'),
    ];

    const result = extractByNumber(pages, booklet);

    expect(result.questions[0]?.sectionId).toBe('marketing');
  });
});

describe('پاک‌سازی متن', () => {
  it('ارقام فارسی را لاتین می‌کند و ی/ک را یکدست می‌سازد', () => {
    expect(normalizeFa('۱۲۳ كاري')).toBe('123 کاری');
  });

  it('پوشش لاتکس را برمی‌دارد و دستورهای چیدمان را حذف می‌کند', () => {
    expect(unwrapLatex('\\text{پاسخ درست} \\quad ۲')).toBe('پاسخ درست ۲');
  });
});
