import { describe, expect, it } from 'vitest';
import {
  getBookChapters,
  groupBookQuestionsByChapter,
} from '../data/bookChaptersRepo';
import type { QuestionItem } from '../data/konkorData';

const bookId = 'book.bus.kotler_jalilian';

function question(overrides: Partial<QuestionItem> = {}): QuestionItem {
  return {
    id: 'q-test',
    nodeId: 'mkt.plc',
    examYear: 1404,
    text: 'سؤال آزمایشی',
    options: ['الف', 'ب', 'ج', 'د'],
    correctOption: 0,
    explanation: 'توضیح',
    trapNote: 'دام',
    expectedTimeMs: 30_000,
    ...overrides,
  };
}

describe('reference-book chapter mapping', () => {
  it('keeps the source catalogue order instead of sorting by legacy frequency estimates', () => {
    const chapters = getBookChapters(bookId);
    expect(chapters[0].id).toBe('ch.kotler.1');
    expect(chapters[1].id).toBe('ch.kotler.2');
    expect(chapters[2].id).toBe('ch.kotler.3');
  });

  it('does not arbitrarily assign a question when multiple chapters share its node', () => {
    const chapters = getBookChapters(bookId);
    const candidates = chapters.filter((chapter) => chapter.nodes.includes('mkt.plc'));
    expect(candidates.length).toBeGreaterThan(1);

    const groups = groupBookQuestionsByChapter(bookId, [question()]);
    const unassigned = groups.find((group) => group.chapter === null);
    expect(unassigned?.questions.map((q) => q.id)).toContain('q-test');
    expect(groups.every((group) => group.chapter === null || !group.questions.some((q) => q.id === 'q-test'))).toBe(true);
  });

  it('uses a valid explicit referenceChapterId when supplied', () => {
    const chapters = getBookChapters(bookId);
    const target = chapters.find((chapter) => chapter.nodes.includes('mkt.plc') && chapter.id !== 'ch.kotler.1');
    expect(target).toBeDefined();

    const groups = groupBookQuestionsByChapter(bookId, [
      question({ referenceChapterId: target!.id }),
    ]);
    const assigned = groups.find((group) => group.chapter?.id === target!.id);
    expect(assigned?.questions.map((q) => q.id)).toContain('q-test');
  });

  it('sends invalid explicit chapter links to the unassigned group', () => {
    const groups = groupBookQuestionsByChapter(bookId, [
      question({ referenceChapterId: 'chapter-from-another-book' }),
    ]);
    expect(groups.find((group) => group.chapter === null)?.questions.map((q) => q.id)).toContain('q-test');
  });
});
