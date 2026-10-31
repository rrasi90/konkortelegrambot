import { REFERENCE_BOOKS_DATABASE, ReferenceBookItem } from './referenceBooksRepo';
import { BUSINESS_BOOK_CHAPTERS } from './bookChaptersBusiness';
import { INDUSTRIAL_TECH_BOOK_CHAPTERS } from './bookChaptersIndustrialTech';
import type { BookChapter } from './bookChaptersTypes';
import type { QuestionItem } from './konkorData';

export type { BookChapter };
export { getChapterImportance, CHAPTER_IMPORTANCE_LABEL } from './bookChaptersTypes';

/** کاتالوگ کامل فصل‌های کلیدی همهٔ کتاب‌ها (۱۰ فصل برای هر کتاب) */
export const BOOK_CHAPTERS: Record<string, BookChapter[]> = {
  ...BUSINESS_BOOK_CHAPTERS,
  ...INDUSTRIAL_TECH_BOOK_CHAPTERS,
};

/** فصل‌های یک کتاب، مرتب‌شده بر پایهٔ تعداد سؤال طرح‌شده در ادوار */
export const getBookChapters = (bookId: string): BookChapter[] =>
  [...(BOOK_CHAPTERS[bookId] ?? [])].sort((a, b) => b.examCount - a.examCount);

export const getBookExamQuestionTotal = (bookId: string): number =>
  getBookChapters(bookId).reduce((sum, ch) => sum + ch.examCount, 0);

/** نقشهٔ پشتیبان: اگر گره کتاب مستقیم نداشت، کتاب هم‌خانواده انتخاب می‌شود */
const FAMILY_BOOK_FALLBACK: Record<string, string> = {
  mb: 'book.bus.robbins_daft',
  sm: 'book.bus.david_porter_mintzberg',
  stats: 'book.bus.math_stats_ranjbaran_tourani',
  rm: 'book.bus.math_stats_ranjbaran_tourani',
  mkt: 'book.bus.kotler_jalilian',
  inno: 'book.tech.schilling',
  ind: 'book.ind.or_mehregan_fadavi',
  bus: 'book.bus.econ_nazari',
};

/** کتاب متناظر با یک گرهٔ دانش (برای پرش از درس‌نامه به کتاب) */
export const getBookForNode = (nodeId: string): ReferenceBookItem | undefined => {
  const exact = REFERENCE_BOOKS_DATABASE.find((b) => b.linkedNodeId === nodeId);
  if (exact) return exact;
  const fallbackId = FAMILY_BOOK_FALLBACK[nodeId.split('.')[0]];
  return REFERENCE_BOOKS_DATABASE.find((b) => b.id === fallbackId);
};

export interface ChapterQuestionGroup {
  chapter: BookChapter | null;
  questions: QuestionItem[];
}

/**
 * توزیع تست‌های بانک روی فصل‌ها: هر گره فقط به نخستین فصلی که آن را پوشش می‌دهد
 * نسبت داده می‌شود تا هیچ تستی دو بار در صفحهٔ کتاب تکرار نشود.
 */
export const groupBookQuestionsByChapter = (
  bookId: string,
  questions: QuestionItem[]
): ChapterQuestionGroup[] => {
  const chapters = getBookChapters(bookId);
  // هر گره به «مشخص‌ترین» فصلی نسبت داده می‌شود که آن را پوشش می‌دهد
  // (فصلی که گره‌های کمتری دارد، در صورت تساوی فصل با سؤال بیشتر).
  const nodeOwner = new Map<string, string>();
  const nodeOwnerScore = new Map<string, number>();
  chapters.forEach((ch) => {
    ch.nodes.forEach((nodeId) => {
      const score = ch.nodes.length * 1000 - ch.examCount;
      const current = nodeOwnerScore.get(nodeId);
      if (current === undefined || score < current) {
        nodeOwner.set(nodeId, ch.id);
        nodeOwnerScore.set(nodeId, score);
      }
    });
  });

  const groups: ChapterQuestionGroup[] = chapters.map((chapter) => ({ chapter, questions: [] }));
  const rest: ChapterQuestionGroup = { chapter: null, questions: [] };

  questions.forEach((q) => {
    const ownerId = nodeOwner.get(q.nodeId);
    const group = ownerId ? groups.find((g) => g.chapter?.id === ownerId) : undefined;
    if (group) group.questions.push(q);
    else rest.questions.push(q); // گره‌های بدون فصل منتسب → سبد «سایر مباحث»
  });

  return [...groups.filter((g) => g.questions.length > 0), ...(rest.questions.length ? [rest] : [])];
};

/** متن مطالعهٔ کامل کتاب برای نمایش/دانلود */
export const buildFullBookMarkdown = (
  book: ReferenceBookItem,
  answers: { chapter: BookChapter; questions: QuestionItem[] }[]
): string => {
  const lines: string[] = [];
  lines.push(`# ${book.bookTitle}`);
  lines.push(`**درس:** ${book.courseName} · **مؤلفان:** ${book.authors}`);
  lines.push(`**ضرایب:** ارشد — ${book.coefficientMaster} · دکتری — ${book.coefficientPhd}\n`);
  lines.push(`## چرا این کتاب؟\n${book.whyImportant}\n`);

  const chapters = getBookChapters(book.id);
  lines.push(`## فهرست فصل‌های کلیدی (${chapters.length} فصل)\n`);
  chapters.forEach((ch, i) => {
    lines.push(`${i + 1}. ${ch.title} — ${ch.examCount} سؤال در ادوار`);
  });
  lines.push('');

  chapters.forEach((ch, i) => {
    lines.push(`\n---\n\n## ${i + 1}. ${ch.title}`);
    lines.push(`> تکرار در ادوار: ${ch.examCount} سؤال`);
    ch.points.forEach((p) => lines.push(`- ${p}`));
    if (ch.formulas?.length) {
      lines.push('\n**فرمول‌ها و مدل‌ها:**');
      ch.formulas.forEach((f) => lines.push(`- ${f}`));
    }
    const group = answers.find((a) => a.chapter.id === ch.id);
    if (group && group.questions.length > 0) {
      lines.push(`\n**تست‌های این فصل در سامانه (${group.questions.length}):**`);
      group.questions.forEach((q) =>
        lines.push(`- ${q.text} → گزینهٔ صحیح: ${q.correctOption + 1}`)
      );
    }
  });

  if (book.goldenNotesCheatSheet.length) {
    lines.push('\n---\n\n## نکات طلایی و دام‌های کنکوری');
    book.goldenNotesCheatSheet.forEach((n) => lines.push(`- ${n}`));
  }
  return lines.join('\n');
};
