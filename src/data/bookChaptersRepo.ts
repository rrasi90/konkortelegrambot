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

/** فصل‌ها با ترتیب منبع/کاتالوگ نمایش داده می‌شوند؛ اعداد تاریخی قدیمی معیار رتبه‌بندی دکتری نیستند. */
export const getBookChapters = (bookId: string): BookChapter[] =>
  [...(BOOK_CHAPTERS[bookId] ?? [])];

/**
 * @deprecated جمع این اعداد، تعداد سؤال‌های رسمی دکتری نیست. فقط برای سازگاری با
 * مصرف‌کنندگان قدیمی حفظ شده است؛ در UI و برنامه‌ریز آزمون استفاده نشود.
 */
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
 * نگاشت تست به فصل:
 * ۱) اگر referenceChapterId تعیین شده باشد، همان پیوند دقیق استفاده می‌شود.
 * ۲) اگر تنها یک فصل گره را پوشش دهد، اتصال خودکار بی‌ابهام است.
 * ۳) اگر چند فصل یک nodeId مشترک داشته باشند، سؤال تا زمان بازبینی انسانی در «فصل‌بندی‌نشده» می‌ماند.
 * این سیاست از نسبت‌دادن دلخواه یک تست به فصل اشتباه جلوگیری می‌کند.
 */
export const groupBookQuestionsByChapter = (
  bookId: string,
  questions: QuestionItem[]
): ChapterQuestionGroup[] => {
  const chapters = getBookChapters(bookId);
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const chaptersByNode = new Map<string, BookChapter[]>();

  chapters.forEach((chapter) => {
    chapter.nodes.forEach((nodeId) => {
      const matches = chaptersByNode.get(nodeId) ?? [];
      matches.push(chapter);
      chaptersByNode.set(nodeId, matches);
    });
  });

  const groups: ChapterQuestionGroup[] = chapters.map((chapter) => ({ chapter, questions: [] }));
  const rest: ChapterQuestionGroup = { chapter: null, questions: [] };

  questions.forEach((question) => {
    let owner: BookChapter | undefined;

    if (question.referenceChapterId) {
      owner = chapterById.get(question.referenceChapterId);
      // Explicit mappings must belong to this book and cover the question's node.
      if (!owner || !owner.nodes.includes(question.nodeId)) owner = undefined;
    } else {
      const candidates = chaptersByNode.get(question.nodeId) ?? [];
      if (candidates.length === 1) owner = candidates[0];
    }

    const group = owner ? groups.find((candidate) => candidate.chapter?.id === owner!.id) : undefined;
    if (group) group.questions.push(question);
    else rest.questions.push(question);
  });

  return [...groups.filter((group) => group.questions.length > 0), ...(rest.questions.length ? [rest] : [])];
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
    lines.push(`${i + 1}. ${ch.title} — برآورد تاریخی ثبت‌شده: ${ch.examCount} (بدون تفکیک سطح آزمون؛ برای بودجه‌بندی دکتری معتبر نیست)`);
  });
  lines.push('');

  chapters.forEach((ch, i) => {
    lines.push(`\n---\n\n## ${i + 1}. ${ch.title}`);
    lines.push(`> برآورد تاریخی قدیمی: ${ch.examCount} (سطح آزمون در داده فعلی تفکیک نشده است)`);
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
