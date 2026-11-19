/**
 * نگهبان بانک سؤال آزمون‌های مدیریت.
 *
 * این تست جلوی پس‌رفت‌های خاموش را می‌گیرد: سؤال بدون کلید، گزینهٔ ناقص، شمارهٔ
 * تکراری، شمارهٔ بیرون از بازهٔ دفترچه، متن تکراری، و اختلاف تازه با کلید رسمی
 * بازیابی‌شده. اختلاف‌های شناخته‌شده در `content/exam-key-evidence` ثبت شده‌اند.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { YEARLY_KONKOR_BOOKLETS, YEARLY_KONKOR_QUESTIONS } from '../data/yearlyKonkorExams';
import { getArshadCoverage, isDoctorateQuestion } from '../data/examCoverage';
import { CLIENT_BANK_ANSWER_KEYS } from '../../apps/worker/src/data/client-bank-keys.server';

const evidenceDir = join(process.cwd(), 'content', 'exam-key-evidence');
const evidence = JSON.parse(readFileSync(join(evidenceDir, 'answers-by-year.json'), 'utf8')) as {
  years: Record<string, { entries: Record<string, number> }>;
};
const conflicts = JSON.parse(readFileSync(join(evidenceDir, 'known-key-conflicts.json'), 'utf8')) as {
  conflicts: { id: string }[];
};

const serverKeys = new Map(CLIENT_BANK_ANSWER_KEYS.map((key) => [key.id, key.correctOption]));
const bookletByYear = new Map(YEARLY_KONKOR_BOOKLETS.map((booklet) => [booklet.year, booklet]));
const normalize = (text: string) => text.replace(/[\u200c\s]+/g, ' ').trim();

describe('بانک سؤال آزمون‌ها', () => {
  it('هر سؤال گزینه‌های کامل و یکتا دارد', () => {
    const broken = YEARLY_KONKOR_QUESTIONS.filter(
      (question) =>
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        question.options.some((option) => !option || !option.trim()) ||
        new Set(question.options.map((option) => normalize(option))).size !== 4,
    ).map((question) => question.id);

    expect(broken).toEqual([]);
  });

  it('شناسه‌ها و متن سؤال‌ها تکراری نیستند', () => {
    const ids = YEARLY_KONKOR_QUESTIONS.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);

    const stems = YEARLY_KONKOR_QUESTIONS.map((question) => normalize(question.text));
    expect(new Set(stems).size).toBe(stems.length);
  });

  it('شمارهٔ سؤال در هر سال و مقطع یکتاست و بیرون از بازهٔ دفترچه نیست', () => {
    const seen = new Set<string>();
    const problems: string[] = [];

    for (const question of YEARLY_KONKOR_QUESTIONS) {
      if (typeof question.bookletQuestionNumber !== 'number') continue;
      const level = isDoctorateQuestion(question) ? 'دکتری' : 'ارشد';
      const tuple = `${question.examYear}|${level}|${question.bookletQuestionNumber}`;
      if (seen.has(tuple)) problems.push(`تکرار ${tuple}`);
      seen.add(tuple);

      const booklet = bookletByYear.get(question.examYear);
      if (level === 'ارشد' && booklet && question.bookletQuestionNumber > booklet.totalQuestionsInBooklet) {
        problems.push(`${question.id} خارج از بازهٔ ${question.examYear}`);
      }
    }

    expect(problems).toEqual([]);
  });

  it('هر سؤال کلید سمت سرور معتبر دارد', () => {
    const missing = YEARLY_KONKOR_QUESTIONS.filter((question) => {
      const key = serverKeys.get(question.id);
      return key === undefined || !Number.isInteger(key) || key < 0 || key > 3;
    }).map((question) => question.id);

    expect(missing).toEqual([]);
  });

  it('اختلاف کلید با شاهد رسمی فقط در فهرست ثبت‌شده است', () => {
    const registered = new Set(conflicts.conflicts.map((conflict) => conflict.id));
    const unregistered: string[] = [];

    for (const question of YEARLY_KONKOR_QUESTIONS) {
      if (isDoctorateQuestion(question)) continue;
      if (typeof question.bookletQuestionNumber !== 'number') continue;
      const official = evidence.years[String(question.examYear)]?.entries[String(question.bookletQuestionNumber)];
      if (official === undefined) continue;
      const key = serverKeys.get(question.id);
      if (key === undefined) continue;
      if (key + 1 !== official && !registered.has(question.id)) {
        unregistered.push(`${question.id} بانک=${key + 1} رسمی=${official}`);
      }
    }

    expect(unregistered).toEqual([]);
  });

  it('هیچ سال ارشد بی‌سؤال نمی‌ماند و پوشش صادقانه گزارش می‌شود', () => {
    const coverage = getArshadCoverage();
    expect(coverage.bookletCount).toBe(15);
    expect(coverage.byYear.every((row) => row.available > 0)).toBe(true);
    expect(coverage.available).toBe(coverage.byYear.reduce((sum, row) => sum + row.available, 0));
    expect(coverage.percent).toBeLessThan(100);
  });
});
