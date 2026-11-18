import { describe, expect, it } from 'vitest';
import { INITIAL_INTERACTIVE_LESSONS, INITIAL_KNOWLEDGE_NODES } from '../data/konkorData';
import { FLASHCARD_EXPANSION } from '../data/flashcards-expansion';
import { BUSINESS_BOOK_CHAPTERS } from '../data/bookChaptersBusiness';
import { REFERENCE_BOOKS_DATABASE } from '../data/referenceBooksRepo';
import { getCourseSectionForNode, getCourseSectionForQuestion, SUBJECT_COURSE_DEFINITIONS } from '../data/subjectHubMeta';
import { YEARLY_KONKOR_BOOKLETS, YEARLY_KONKOR_QUESTIONS } from '../data/yearlyKonkorExams';

describe('ممیزی گراف درس مبانی سازمان و مدیریت', () => {
  const ids = ['mb.decision', 'mb.ob_motivation', 'mb.leadership'];
  it('سه گرهٔ سرفصل را در گراف و درس‌نامه ثبت می‌کند', () => {
    for (const id of ids) {
      const node = INITIAL_KNOWLEDGE_NODES.find(item => item.id === id);
      expect(node).toBeDefined();
      expect(getCourseSectionForNode(node!)).toBe('management_theories');
      expect(INITIAL_INTERACTIVE_LESSONS[id]).toBeDefined();
    }
  });
  it('فلش‌کارت‌های انگیزش را به گرهٔ انگیزش وصل می‌کند', () => {
    for (const id of ['fc-mb-007','fc-mb-008','fc-mb-009','fc-mb-010','fc-mb-011','fc-mb-012'])
      expect(FLASHCARD_EXPANSION.find(card => card.id === id)?.nodeId).toBe('mb.ob_motivation');
  });
  it('فصل‌های تصمیم‌گیری، انگیزش و رهبری را به گرهٔ متناسب پیوند می‌دهد', () => {
    const chapters = BUSINESS_BOOK_CHAPTERS['book.bus.robbins_daft'];
    expect(chapters.find(ch => ch.id === 'ch.th.3')?.nodes).toEqual(['mb.decision']);
    expect(chapters.find(ch => ch.id === 'ch.th.7')?.nodes).toEqual(['mb.ob_motivation']);
    expect(chapters.find(ch => ch.id === 'ch.th.8')?.nodes).toEqual(['mb.leadership']);
  });
  it('نگاشت صریح گره را بر حدس متنی نام نویسنده مقدم می‌کند', () => {
    const question = { nodeId: 'mb.structure', sourceReference: 'آزمون مدیریت', designedFromTextbook: 'مبانی سازمان و مدیریت مقیمی و جلیلیان', text: 'سؤال سازمانی' } as any;
    expect(getCourseSectionForQuestion(question, INITIAL_KNOWLEDGE_NODES)).toBe('management_theories');
  });
  it('سؤال‌های چهارگانه را به گرهٔ علمی جدید نگاشت می‌کند', () => {
    const mapping = new Map(YEARLY_KONKOR_QUESTIONS.map(q => [q.id, q.nodeId]));
    expect(mapping.get('q.k1391.31')).toBe('mb.culture');
    expect(mapping.get('q.k1392.48')).toBe('mb.leadership');
    expect(mapping.get('q.k1400.77')).toBe('mb.decision');
    expect(mapping.get('q.k1404.66')).toBe('mb.ob_motivation');
  });
  it('بودجه‌بندی آخرین دفترچهٔ ثبت‌شدهٔ ارشد را درست نشان می‌دهد', () => {
    const booklet = YEARLY_KONKOR_BOOKLETS.find(item => item.year === 1405)!;
    const section = booklet.subjectRanges.find(item => item.sectionId === 'management_theories')!;
    expect(section.count).toBe(25);
    expect(section.fromQuestion).toBe(61);
    expect(section.toQuestion).toBe(85);
    expect(SUBJECT_COURSE_DEFINITIONS.find(item => item.id === 'management_theories')!.questionCountInExam).toContain('۲۵');
  });
  it('کتاب مرجع را از گرهٔ پایهٔ ساختار باز می‌کند', () => {
    expect(REFERENCE_BOOKS_DATABASE.find(item => item.id === 'book.bus.robbins_daft')?.linkedNodeId).toBe('mb.structure');
  });
});
