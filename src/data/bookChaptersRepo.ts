import { REFERENCE_BOOKS_DATABASE, ReferenceBookItem } from './referenceBooksRepo';
import { BUSINESS_BOOK_CHAPTERS } from './bookChaptersBusiness';
import { INDUSTRIAL_TECH_BOOK_CHAPTERS } from './bookChaptersIndustrialTech';
import type { BookChapter } from './bookChaptersTypes';
import type { QuestionItem } from './konkorData';

export type { BookChapter };
export {
  getChapterImportance,
  CHAPTER_IMPORTANCE_LABEL,
  CHAPTER_FREQUENCY_BASIS,
  DOCTORATE_IMPORTANCE_LABEL,
  getDoctorateChapterImportance,
} from './bookChaptersTypes';

/**
 * توضیح شفاف انتخاب فصل‌ها برای نمایش در رابط کاربری.
 * ده فصلِ هر کتاب، «ده فصل پرتکرار ارشد» است، نه کل کتاب.
 */
export const getChapterSelectionNote = (bookId: string): string => {
  const chapters = BOOK_CHAPTERS[bookId] ?? [];
  return (
    `${chapters.length} فصل با بیشترین فراوانی در آزمون کارشناسی ارشد (کد ۱۱۴۲) انتخاب شده است. ` +
    'این فهرست کل کتاب نیست و برای اولویت‌بندی دکتری باید با فراوانی سؤال دکتری جایگزین شود.'
  );
};

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
  /**
   * شناسهٔ فصل‌های دیگری که همین گره‌های دانش را پوشش می‌دهند.
   * وقتی یک سؤال هم‌زمان به چند فصل مربوط است، تقسیم قطعی آن به یک فصل
   * از نظر علمی دقیق نیست؛ این فهرست همان ابهام را آشکار می‌کند.
   */
  sharedWith?: string[];
}

/** همهٔ فصل‌هایی که یک گرهٔ دانش را پوشش می‌دهند. */
export const getChaptersForNode = (bookId: string, nodeId: string): BookChapter[] =>
  (BOOK_CHAPTERS[bookId] ?? []).filter((ch) => ch.nodes.includes(nodeId));

/** Explicit references take precedence. Inferred links require a unique chapter. */
export const groupBookQuestionsByChapter = (
  bookId: string,
  questions: QuestionItem[]
): ChapterQuestionGroup[] => {
  const chapters = getBookChapters(bookId);
  const groups: ChapterQuestionGroup[] = chapters.map((chapter) => ({ chapter, questions: [] }));
  const unresolved: ChapterQuestionGroup = { chapter: null, questions: [] };
  const candidates = new Set<string>();

  for (const question of questions) {
    const matching = getChaptersForNode(bookId, question.nodeId);
    const chapterId = question.referenceChapterId !== undefined
      ? question.referenceChapterId
      : matching.length === 1 ? matching[0].id : undefined;
    const group = groups.find(({ chapter }) => chapter?.id === chapterId);
    if (group) {
      group.questions.push(question);
    } else {
      unresolved.questions.push(question);
      if (matching.length > 1) matching.forEach(({ id }) => candidates.add(id));
    }
  }

  const assigned = groups.filter((group) => group.questions.length > 0);
  if (unresolved.questions.length === 0) return assigned;
  if (candidates.size > 0) unresolved.sharedWith = [...candidates];
  return [...assigned, unresolved];
};

/**
 * «جزوهٔ جامع» یک کتاب — نه متن کامل کتاب.
 *
 * خروجی شامل شناسنامهٔ کتاب، فصل‌های منتخب پرتکرار، نکات، فرمول‌ها و تست‌های
 * همان مبحث است. این یک تألیف آموزشی است و جای متن اصلی کتاب را نمی‌گیرد؛
 * برای همین برچسب آن در رابط کاربری «جزوهٔ جامع» است، نه «مطالعهٔ کامل کتاب».
 */
export const buildFullBookMarkdown = (
  book: ReferenceBookItem,
  answers: { chapter: BookChapter; questions: QuestionItem[] }[]
): string => {
  const lines: string[] = [];
  lines.push(`# ${book.bookTitle}`);
  lines.push(`**درس:** ${book.courseName} · **مؤلفان:** ${book.authors}`);
  lines.push(`**ضرایب:** ارشد — ${book.coefficientMaster} · دکتری — ${book.coefficientPhd}\n`);
  lines.push(`## چرا این کتاب؟\n${book.whyImportant}\n`);
  lines.push(
    '> **این فایل جزوهٔ تألیفی است، نه متن کامل کتاب.** ' +
      'فصل‌های زیر بر اساس فراوانی سؤال در آزمون کارشناسی ارشد (کد ۱۱۴۲) انتخاب شده‌اند ' +
      'و متن اصلی کتاب را شامل نمی‌شوند.\n'
  );

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
        lines.push(`- ${q.text} → (کلید پس از submit در حالت آنلاین)`)
      );
    }
  });

  if (book.goldenNotesCheatSheet.length) {
    lines.push('\n---\n\n## نکات طلایی و دام‌های کنکوری');
    book.goldenNotesCheatSheet.forEach((n) => lines.push(`- ${n}`));
  }
  return lines.join('\n');
};
