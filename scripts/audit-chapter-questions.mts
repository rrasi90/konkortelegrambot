/**
 * ممیزی پوشش سؤال فصل‌ها — «کدام فصل‌ها هیچ سؤال وابسته‌ای ندارند؟»
 *
 * همان منطق دو نمای اصلی را بازسازی می‌کند:
 *  - BookLibraryView: ownQuestions (گره‌های فصل‌ها یا referenceChapterId) → groupBookQuestionsByChapter
 *  - SubjectDedicatedHubView: allSubjectQuestions (سالانه + بانک اصلی) → گروه‌بندی + findBestChapterForQuestion
 *
 * خروجی: برای هر کتاب، فصل‌هایی که در هیچ‌کدام از دو مسیر سؤالی ندارند.
 * اجرا: node --import tsx scripts/audit-chapter-questions.mts
 */
import {
  INITIAL_QUESTION_BANK,
  KNOWLEDGE_NODES,
  type QuestionItem,
} from '../src/data/konkorData';
import { YEARLY_KONKOR_QUESTIONS } from '../src/data/yearlyKonkorExams';
import { BOOK_CHAPTERS, groupBookQuestionsByChapter } from '../src/data/bookChaptersRepo';
import { REFERENCE_BOOKS_DATABASE } from '../src/data/referenceBooksRepo';
import { getCourseSectionForQuestion, getCourseSectionForNode } from '../src/data/subjectHubMeta';
import { type KonkorCourseSectionId } from '../src/data/yearlyKonkorExams';
import { findBestChapterForQuestion } from '../src/data/chapterFlashcards';

const combined = [...YEARLY_KONKOR_QUESTIONS, ...INITIAL_QUESTION_BANK];
const unique = new Map<string, QuestionItem>();
for (const q of combined) unique.set(q.id, q);
const allQuestions = [...unique.values()];

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
const sectionByBookId = new Map<string, KonkorCourseSectionId>();
// بخش درسی هر کتاب از گرهٔ پیوند آن گرفته می‌شود؛ تطابق متنی
// getBooksForCourseSection کتاب‌های هم‌خانواده (مثل مقیمی) را قاطی می‌کند.
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

const fa = (n: number) => n.toLocaleString('fa-IR');

const practiceBank = INITIAL_QUESTION_BANK.filter((q) => !q.isQuarantinedProof);

interface BookReport {
  bookTitle: string;
  bookId: string;
  sectionQuestions: number;
  emptyChapters: { id: string; number: string; title: string; examCount: number }[];
  chapterCounts: Record<string, number>;
}

const reports: BookReport[] = [];

for (const book of REFERENCE_BOOKS_DATABASE) {
  const chapters = BOOK_CHAPTERS[book.id] ?? [];
  const sectionId = sectionByBookId.get(book.id);
  if (chapters.length === 0) continue;

  // کتاب‌های فناوری که به بخش درسی نگاشت نشده‌اند، فقط از مسیر کتابخانه
  // (سؤال‌های بانک اصلی) سؤال می‌گیرند.
  const allSubjectQuestions = sectionId
    ? (subjectQuestionsBySection.get(sectionId) ?? [])
    : practiceBank;

  // مسیر ۱: گروه‌بندی صریح روی سؤال‌های درس
  const groups = groupBookQuestionsByChapter(book.id, allSubjectQuestions);
  const counts: Record<string, number> = {};
  chapters.forEach((ch) => (counts[ch.id] = 0));
  groups.forEach((group) => {
    if (group.chapter && group.chapter.id in counts) counts[group.chapter.id] = group.questions.length;
  });

  // مسیر ۲: استنتاج بهترین فصل برای سؤال‌های بی‌فصل
  const unresolved = groups.find((g) => !g.chapter)?.questions ?? [];
  for (const q of unresolved) {
    const ch = findBestChapterForQuestion(chapters, q);
    if (ch && counts[ch.id] !== undefined) counts[ch.id] += 1;
  }

  // مسیر ۳: نمای کتابخانه — گره‌های خودِ کتاب (نه فقط فصل‌ها)
  const ownNodes = new Set<string>(chapters.flatMap((ch) => ch.nodes));
  if (book.linkedNodeId) ownNodes.add(book.linkedNodeId);
  const chapterIds = new Set(chapters.map(({ id }) => id));
  const ownQuestions = practiceBank.filter(
    (q) => !q.isQuarantinedProof && (ownNodes.has(q.nodeId) || chapterIds.has(q.referenceChapterId ?? ''))
  );
  const ownGroups = groupBookQuestionsByChapter(book.id, ownQuestions);
  ownGroups.forEach((group) => {
    if (group.chapter && group.chapter.id in counts && counts[group.chapter.id] === 0) {
      counts[group.chapter.id] = group.questions.length;
    }
  });

  const emptyChapters = chapters
    .filter((ch) => counts[ch.id] === 0)
    .map(({ id, number, title, examCount }) => ({ id, number, title, examCount }));

  reports.push({
    bookTitle: book.bookTitle,
    bookId: book.id,
    sectionQuestions: allSubjectQuestions.length,
    emptyChapters,
    chapterCounts: counts,
  });
}

let totalEmpty = 0;
let totalQuestions = 0;
for (const r of reports) {
  const filled = Object.values(r.chapterCounts).filter((c) => c > 0).length;
  const totalChapters = Object.keys(r.chapterCounts).length;
  totalEmpty += r.emptyChapters.length;
  totalQuestions += Object.values(r.chapterCounts).reduce((a, b) => a + b, 0);
  console.log(
    `${r.bookId.padEnd(42)} درس‌سؤال=${fa(r.sectionQuestions).padEnd(4)} فصل‌پوشش=${filled}/${totalChapters} خالی=${r.emptyChapters.length}`
  );
  for (const ch of r.emptyChapters) {
    console.log(`    خالی: ${ch.id} «فصل ${ch.number} — ${ch.title}» (examCount=${ch.examCount})`);
  }
}
console.log(`\nمجموع فصل‌های بدون سؤال: ${fa(totalEmpty)} — مجموع سؤال‌های متصل: ${fa(totalQuestions)}`);
