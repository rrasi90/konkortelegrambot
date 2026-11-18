import { describe, expect, it } from 'vitest';
import { BOOK_CHAPTERS } from '../data/bookChaptersRepo';
import type { QuestionItem } from '../data/konkorData';
import { buildChapterStudyCards, findBestChapterForQuestion } from '../data/chapterFlashcards';

const pilot = BOOK_CHAPTERS['book.bus.kotler_jalilian'].find((chapter) => chapter.id === 'ch.kotler.1');
if (!pilot) throw new Error('فصل پایلوت بازاریابی پیدا نشد');

const question: QuestionItem = {
  id: 'q.test.1',
  nodeId: pilot.nodes[0],
  examYear: 1404,
  text: 'کدام حالت تقاضا به بازاریابی تبدیلی نیاز دارد؟',
  options: ['تقاضای منفی', 'تقاضای کامل', 'تقاضای مضر', 'تقاضای نامنظم'],
  expectedTimeMs: 60000,
  courseSectionTitle: 'بازاریابی',
};

describe('کارت‌های فصل', () => {
  it('از اهداف، نکات، دام و پرسش‌های بازیابی کارت می‌سازد', () => {
    const cards = buildChapterStudyCards(pilot);
    expect(cards.length).toBeGreaterThan(5);
    expect(cards.some((card) => card.kind === 'overview')).toBe(true);
    expect(cards.some((card) => card.kind === 'point')).toBe(true);
    expect(cards.some((card) => card.kind === 'trap')).toBe(true);
    expect(cards.some((card) => card.kind === 'retrieval')).toBe(true);
    expect(cards.every((card) => card.front.trim().length > 0 && card.back.trim().length > 0)).toBe(true);
  });

  it('تست کنکور را بدون افشای کلید پاسخ به کارت اضافه می‌کند', () => {
    const cards = buildChapterStudyCards(pilot, [question]);
    const questionCard = cards.find((card) => card.kind === 'question');
    expect(questionCard).toBeTruthy();
    expect(questionCard?.front).toBe(question.text);
    expect(questionCard?.back).toContain('۱) تقاضای منفی');
    expect(questionCard?.back).toContain('پاسخ صحیح عمداً اینجا نمایش داده نمی‌شود');
    expect(questionCard?.back).not.toContain('correctOption');
    expect(questionCard?.questionId).toBe(question.id);
  });

  it('برای فصل بدون نکته کارت خالی نمی‌سازد', () => {
    const cards = buildChapterStudyCards({
      id: 'ch.test.empty',
      number: '۱',
      title: 'فصل آزمایشی',
      examCount: 0,
      nodes: [],
      points: [],
    });
    expect(cards).toHaveLength(0);
  });

  it('وقتی شناسهٔ فصل ثبت نشده، فصل را از متن منبع سؤال پیدا می‌کند', () => {
    const chapters = BOOK_CHAPTERS['book.bus.kotler_jalilian'];
    const matched = findBestChapterForQuestion(chapters, {
      ...question,
      text: 'در کدام مرحله از منحنی عمر محصول، تبلیغات ماهیت یادآورنده دارد؟',
      designedFromTextbook: 'مدیریت بازاریابی کاتلر (فصل چرخه عمر محصول)',
    });
    expect(matched?.id).toBe('ch.kotler.6');
  });
});
