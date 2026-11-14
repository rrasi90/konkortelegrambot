import { describe, expect, it } from 'vitest';
import { BOOK_CHAPTERS, groupBookQuestionsByChapter } from '../data/bookChaptersRepo';
import { REFERENCE_BOOKS_DATABASE } from '../data/referenceBooksRepo';
import {
  CHAPTER_AUTHORED_QUESTIONS,
  AUTHORED_QUESTION_PREFIX,
  isAuthoredQuestion,
} from '../data/chapterAuthoredQuestions';
import { INITIAL_QUESTION_BANK, KNOWLEDGE_NODES, mergeQuestionsUnique, type QuestionItem } from '../data/konkorData';
import { YEARLY_KONKOR_QUESTIONS } from '../data/yearlyKonkorExams';
import { findBestChapterForQuestion } from '../data/chapterFlashcards';
import { getCourseSectionForNode, getCourseSectionForQuestion } from '../data/subjectHubMeta';
import type { KonkorCourseSectionId } from '../data/yearlyKonkorExams';

/**
 * «هیچ فصل بدون سؤال» — هر فصلِ فصل‌های کلیدی هر کتاب باید در هر دو نمای
 * اصلی دست‌کم یک سؤال وابسته داشته باشد. استخر سؤال هر کتاب همان استخر
 * واقعی رابط کاربری است: هاب درس‌ها (سؤال‌های بخش درسی) و نمای کتابخانه
 * (سؤال‌های گره‌های خود کتاب)؛ سپس گروه‌بندی صریح و استنتاج بهترین فصل.
 */
describe('پوشش سؤال فصل‌ها', () => {
  const allQuestions = mergeQuestionsUnique(INITIAL_QUESTION_BANK, YEARLY_KONKOR_QUESTIONS);
  const practiceBank = INITIAL_QUESTION_BANK.filter((q) => !q.isQuarantinedProof);

  const SECTION_IDS: KonkorCourseSectionId[] = [
    'english',
    'islamic',
    'math_stats',
    'management_theories',
    'economics',
    'operations_research',
    'production',
    'marketing',
  ];
  // بخش درسی هر کتاب از گرهٔ پیوند آن گرفته می‌شود (نه از تطابق متنی
  // getBooksForCourseSection که کتاب‌های هم‌خانواده را قاطی می‌کند).
  const sectionByBookId = new Map<string, KonkorCourseSectionId>();
  for (const book of REFERENCE_BOOKS_DATABASE) {
    if (!book.linkedNodeId) continue;
    const node = KNOWLEDGE_NODES.find((n) => n.id === book.linkedNodeId);
    if (node) sectionByBookId.set(book.id, getCourseSectionForNode(node));
  }
  const subjectQuestionsBySection = new Map<string, QuestionItem[]>();
  for (const sectionId of SECTION_IDS) {
    subjectQuestionsBySection.set(
      sectionId,
      allQuestions.filter((q) => getCourseSectionForQuestion(q, KNOWLEDGE_NODES) === sectionId)
    );
  }
  // (بدون خروجی دیباگ در حالت پایدار)

  const questionsOfChapter = (bookId: string, chapterId: string): QuestionItem[] => {
    const chapters = BOOK_CHAPTERS[bookId];
    const book = REFERENCE_BOOKS_DATABASE.find((b) => b.id === bookId);
    const sectionId = sectionByBookId.get(bookId);
    // کتاب‌های فناوری که به بخش درسی نگاشت نشده‌اند، از استخر نمای کتابخانه می‌گیرند
    const pool = sectionId ? (subjectQuestionsBySection.get(sectionId) ?? []) : practiceBank;
    const ownNodes = new Set<string>(chapters.flatMap((ch) => ch.nodes));
    if (book?.linkedNodeId) ownNodes.add(book.linkedNodeId);
    const chapterIds = new Set(chapters.map(({ id }) => id));
    const bookPool = pool.filter(
      (q) => !q.isQuarantinedProof && (ownNodes.has(q.nodeId) || chapterIds.has(q.referenceChapterId ?? ''))
    );
    const groups = groupBookQuestionsByChapter(bookId, [...bookPool, ...pool]);
    const exact = groups.find((group) => group.chapter?.id === chapterId)?.questions ?? [];
    if (exact.length > 0) return exact;
    // استنتاج بهترین فصل برای سؤال‌های بی‌فصل همان کتاب
    const unresolved = groups.find((group) => !group.chapter)?.questions ?? [];
    const inferred = unresolved.filter(
      (q) => findBestChapterForQuestion(chapters, q)?.id === chapterId
    );
    return inferred;
  };

  it('هیچ فصلی بدون سؤال وابسته نمی‌ماند', () => {
    const gaps: string[] = [];
    for (const [bookId, chapters] of Object.entries(BOOK_CHAPTERS)) {
      for (const chapter of chapters) {
        if (questionsOfChapter(bookId, chapter.id).length === 0) {
          gaps.push(`${bookId} → ${chapter.id}`);
        }
      }
    }
    expect(gaps, `فصل‌های بدون سؤال: ${gaps.join('، ')}`).toEqual([]);
  });

  it('هر فصل خالی دست‌کم سه تست تألیفی دارد', () => {
    const authoredByChapter = new Map<string, number>();
    for (const q of CHAPTER_AUTHORED_QUESTIONS) {
      const chapterId = q.referenceChapterId ?? '';
      authoredByChapter.set(chapterId, (authoredByChapter.get(chapterId) ?? 0) + 1);
    }
    expect(authoredByChapter.size).toBeGreaterThanOrEqual(45);
    for (const [, count] of authoredByChapter) {
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('تست‌های تألیفی چهارگزینه‌ای‌اند و کلیدی در بانک کلاینت ندارند', () => {
    for (const question of CHAPTER_AUTHORED_QUESTIONS) {
      expect(question.options, question.id).toHaveLength(4);
      expect(isAuthoredQuestion(question), question.id).toBe(true);
      expect(question.id.startsWith(AUTHORED_QUESTION_PREFIX), question.id).toBe(true);
      // کلید پاسخ نباید به هیچ شکلی در بانک کلاینت ظاهر شود
      expect(Object.keys(question), question.id).not.toContain('correctOption');
      expect(Object.keys(question), question.id).not.toContain('explanation');
      // ادعای ترنسکریپت دفترچه ممنوع است و نباید سؤال دکتری شمرده شود
      expect(question.sourceReference ?? '', question.id).not.toContain('دکتری');
    }
  });

  it('شناسه‌های تألیفی یکتا هستند و در بانک ادغام‌شده فقط یک‌بار می‌آیند', () => {
    const ids = new Set(CHAPTER_AUTHORED_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(CHAPTER_AUTHORED_QUESTIONS.length);
    const bankOccurrences = INITIAL_QUESTION_BANK.filter((q) =>
      ids.has(q.id)
    ).length;
    expect(bankOccurrences).toBe(CHAPTER_AUTHORED_QUESTIONS.length);
  });
});
