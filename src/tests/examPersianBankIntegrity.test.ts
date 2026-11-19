import { describe, expect, it } from 'vitest';
import { EXAM_ARCHIVE_PERSIAN_QUESTIONS } from '../data/examArchivePersian';
import { CLIENT_BANK_ANSWER_KEYS } from '../../apps/worker/src/data/client-bank-keys.server.ts';

/**
 * یکپارچگی بانک فارسی و کلیدهایش.
 *
 * دو باگ واقعی این‌جا گرفته شدند: سؤالی که متنش در OCR نصفه مانده بود، و کلید
 * یتیمی که پس از حذف سؤال در رجیستری سمت سرور جا مانده بود.
 */
describe('بانک فارسی دفترچه‌ها — یکپارچگی متن و کلید', () => {
  const questions = EXAM_ARCHIVE_PERSIAN_QUESTIONS;
  const keys = CLIENT_BANK_ANSWER_KEYS.filter((key) => key.bank === 'examArchivePersian');

  it('سؤال‌ها و کلیدها یک‌به‌یک هم‌خوان‌اند', () => {
    const questionIds = new Set(questions.map((question) => question.id));
    const keyIds = new Set(keys.map((key) => key.id));

    expect([...questionIds].filter((id) => !keyIds.has(id))).toEqual([]);
    expect([...keyIds].filter((id) => !questionIds.has(id))).toEqual([]);
    expect(keys).toHaveLength(questions.length);
  });

  it('شناسه، سال و شمارهٔ دفترچه با هم می‌خوانند', () => {
    for (const question of questions) {
      const match = /^q\.k(\d{4})\.(\d+)$/.exec(question.id);
      expect(match, question.id).not.toBeNull();
      expect(Number(match![1])).toBe(question.examYear);
      expect(Number(match![2])).toBe(question.bookletQuestionNumber);
    }
  });

  it('هر سؤال چهار گزینهٔ یکتا دارد و کلید در بازهٔ گزینه‌هاست', () => {
    const byId = new Map(keys.map((key) => [key.id, key]));
    for (const question of questions) {
      expect(question.options, question.id).toHaveLength(4);
      expect(new Set(question.options).size, question.id).toBe(4);
      expect(question.text.length, question.id).toBeGreaterThan(11);
      const key = byId.get(question.id);
      expect(key, question.id).toBeDefined();
      expect(key!.correctOption, question.id).toBeGreaterThanOrEqual(0);
      expect(key!.correctOption, question.id).toBeLessThanOrEqual(3);
    }
  });

  it('صورت سؤال نصفه وارد بانک نمی‌شود', () => {
    const unterminated = questions
      .filter((question) => !/[.؟!»)\]:…]$/.test(question.text.trim()))
      .map((question) => `${question.id}: ${question.text.slice(-40)}`);
    expect(unterminated).toEqual([]);
  });

  it('متن تکراری و کلید تکراری ندارد', () => {
    const normalized = questions.map((question) =>
      question.text.replace(/[\u200c\s]+/g, ' ').trim(),
    );
    expect(new Set(normalized).size).toBe(questions.length);
  });
});
