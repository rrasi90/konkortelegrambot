import React, { useEffect, useMemo, useState } from 'react';
import {
  REFERENCE_BOOKS_DATABASE,
  MANAGEMENT_BRANCH_META,
  ManagementBranchId,
  ReferenceBookItem,
} from '../data/referenceBooksRepo';
import {
  getBookChapters,
  getBookExamQuestionTotal,
  groupBookQuestionsByChapter,
  buildFullBookMarkdown,
  getChapterImportance,
  CHAPTER_IMPORTANCE_LABEL,
  CHAPTER_FREQUENCY_BASIS,
} from '../data/bookChaptersRepo';
import type { BookChapter } from '../data/bookChaptersTypes';
import type { QuestionItem } from '../data/konkorData';
import { RichText } from './RichText';
import { MathText } from './MathText';
import {
  BookOpen,
  ArrowRight,
  ChevronDown,
  Download,
  FileText,
  Flame,
  Layers,
  ListChecks,
  Play,
  Search,
  Target,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

interface BookLibraryViewProps {
  questions: QuestionItem[];
  initialBookId?: string | null;
  onOpenLesson: (nodeId: string) => void;
  onStartPracticeNode: (nodeId: string, mode: 'practice' | 'proof' | 'remedial') => void;
}

type BookTab = 'chapters' | 'full' | 'tests';

const fa = (n: number) => n.toLocaleString('fa-IR');

const branchOf = (book: ReferenceBookItem): ManagementBranchId => book.branch;

const BookCard: React.FC<{ book: ReferenceBookItem; onOpen: () => void }> = ({ book, onOpen }) => {
  const chapters = getBookChapters(book.id);
  const totalExam = getBookExamQuestionTotal(book.id);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bento-card bento-card-interactive text-right p-4 flex flex-col gap-3 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
          <BookOpen className="w-3 h-3" />
          {MANAGEMENT_BRANCH_META[branchOf(book)].title.replace('گرایش ', '')}
        </span>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
          {fa(chapters.length)} فصل کلیدی
        </span>
      </div>

      <div>
        <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300 mb-1 line-clamp-1">
          {book.courseName}
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
          {book.bookTitle}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-1">
          {book.authors}
        </p>
      </div>

      <div className="mt-auto pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 text-[10px]">
        <span className="font-bold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
          <Flame className="w-3 h-3" />
          {fa(totalExam)} سؤال در ادوار
        </span>
        <span className="text-slate-500 dark:text-slate-400">مشاهدهٔ فصل‌ها، آموزش و تست ←</span>
      </div>
    </button>
  );
};

const QuestionCard: React.FC<{
  q: QuestionItem;
  chosen?: number;
  revealed: boolean;
  onChoose: (idx: number) => void;
  onReveal: () => void;
}> = ({ q, chosen, revealed, onChoose, onReveal }) => {
  const showAnswer = chosen !== undefined || revealed;
  return (
    <div className="glass-subcard p-4 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="font-bold text-slate-700 dark:text-slate-300">
          کنکور {fa(q.examYear)} · {q.courseSectionTitle ?? 'مدیریت'}
        </span>
        <span>{q.designedFromTextbook ?? q.sourceReference ?? 'بانک سامانه'}</span>
      </div>

      <div className="text-sm font-medium text-slate-900 dark:text-white leading-7">
        <MathText text={q.text} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {q.options.map((opt, idx) => {
          const isPicked = chosen === idx;
          const isCorrect = q.correctOption === idx;
          let style =
            'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400';
          if (showAnswer && isCorrect)
            style =
              'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold';
          else if (isPicked)
            style = 'bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-100';
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onChoose(idx)}
              className={`text-right p-2.5 rounded-lg border transition-colors cursor-pointer ${style}`}
            >
              <span className="font-bold ml-1.5 tabular-nums">{fa(idx + 1)})</span>
              <MathText text={opt} />
            </button>
          );
        })}
      </div>

      {showAnswer ? (
        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
          <div className="font-bold text-emerald-700 dark:text-emerald-400">
            پاسخ تشریحی (گزینهٔ {fa(q.correctOption + 1)})
          </div>
          <div className="text-slate-700 dark:text-slate-300 leading-6">
            <MathText text={q.explanation} />
          </div>
          <div className="text-amber-700 dark:text-amber-400 pt-1 border-t border-slate-100 dark:border-slate-800">
            <strong>دام طراح: </strong>
            <MathText text={q.trapNote} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onReveal}
          className="text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
        >
          اول خودم حل می‌کنم؛ بعد پاسخ تشریحی را ببینم ←
        </button>
      )}
    </div>
  );
};

export const BookLibraryView: React.FC<BookLibraryViewProps> = ({
  questions,
  initialBookId,
  onOpenLesson,
  onStartPracticeNode,
}) => {
  const [branchFilter, setBranchFilter] = useState<'all' | ManagementBranchId>('all');
  const [search, setSearch] = useState('');
  const [openBookId, setOpenBookId] = useState<string | null>(null);
  const [tab, setTab] = useState<BookTab>('chapters');
  const [openChapterId, setOpenChapterId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [chapterFilter, setChapterFilter] = useState<string | null>(null);

  useEffect(() => {
    if (initialBookId) {
      setOpenBookId(initialBookId);
      setTab('chapters');
      setOpenChapterId(null);
    }
  }, [initialBookId]);

  const books = useMemo(
    () =>
      REFERENCE_BOOKS_DATABASE.filter((b) => {
        const matchesBranch = branchFilter === 'all' || b.branch === branchFilter;
        const text = `${b.bookTitle} ${b.courseName} ${b.authors}`;
        return matchesBranch && (!search.trim() || text.includes(search.trim()));
      }),
    [branchFilter, search]
  );

  const activeBook = openBookId
    ? REFERENCE_BOOKS_DATABASE.find((b) => b.id === openBookId) ?? null
    : null;

  const chapters = activeBook ? getBookChapters(activeBook.id) : [];

  const ownQuestions = useMemo(() => {
    if (!activeBook) return [];
    const ownNodes = new Set<string>(chapters.flatMap((ch) => ch.nodes));
    if (activeBook.linkedNodeId) ownNodes.add(activeBook.linkedNodeId);
    return questions.filter((q) => ownNodes.has(q.nodeId));
  }, [activeBook, chapters, questions]);

  // تست‌های هر فصل = همهٔ تست‌های مباحث همان فصل (ممکن است بین فصل‌های هم‌مبحث مشترک باشد)
  const bookQuestionCount = ownQuestions.length;

  const questionsForChapter = (chapter: BookChapter) =>
    chapter.nodes.length === 0 ? [] : ownQuestions.filter((q) => chapter.nodes.includes(q.nodeId));

  // گروه‌بندی بدون تکرار برای فهرست پیش‌فرض تب تست‌ها
  const groups = useMemo(
    () => (activeBook ? groupBookQuestionsByChapter(activeBook.id, ownQuestions) : []),
    [activeBook, ownQuestions]
  );

  const openBook = (id: string) => {
    setOpenBookId(id);
    setTab('chapters');
    setOpenChapterId(null);
    setChapterFilter(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const downloadMarkdown = () => {
    if (!activeBook) return;
    const content = buildFullBookMarkdown(
      activeBook,
      groups.filter((g) => g.chapter) as { chapter: BookChapter; questions: QuestionItem[] }[]
    );
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeBook.id}-full-book.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ------------------------------ فهرست کتاب‌ها ------------------------------ */
  if (!activeBook) {
    return (
      <div className="space-y-5">
        <div className="bento-card glass-panel p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                کتابخانهٔ کتاب‌محور: از کتاب به فصل، از فصل به آموزش و تست
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-6 max-w-2xl">
                هر کتاب، ده فصل کلیدی دارد که بر پایهٔ تعداد سؤال طرح‌شده در ادوار مرتب شده‌اند. با
                باز کردن هر کتاب، فصل‌های پرتکرار، جزوهٔ جامع کتاب و تست‌های همان درس را
                یک‌جا می‌بینید.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold whitespace-nowrap">
              {fa(REFERENCE_BOOKS_DATABASE.length)} کتاب ·{' '}
              {fa(
                REFERENCE_BOOKS_DATABASE.reduce((s, b) => s + getBookChapters(b.id).length, 0)
              )}{' '}
              فصل
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="tab-strip">
              {[
                { id: 'all' as const, label: 'همهٔ گرایش‌ها' },
                ...(['business', 'industrial', 'technology'] as ManagementBranchId[]).map((id) => ({
                  id,
                  label: MANAGEMENT_BRANCH_META[id].title.replace('گرایش مدیریت ', ''),
                })),
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBranchFilter(b.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    branchFilter === b.id
                      ? 'bg-blue-600 text-white'
                      : 'glass-subcard text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جست‌وجوی نام کتاب یا درس (مثلاً شیلینگ، اقتصاد، کاتلر)..."
                className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {books.map((book) => (
            <BookCard key={book.id} book={book} onOpen={() => openBook(book.id)} />
          ))}
        </div>

        {books.length === 0 && (
          <div className="bento-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            کتابی با این جست‌وجو پیدا نشد.
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------ صفحهٔ یک کتاب ------------------------------ */
  const totalExam = getBookExamQuestionTotal(activeBook.id);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpenBookId(null)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        بازگشت به همهٔ کتاب‌ها
      </button>

      <div className="bento-card glass-panel p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] mb-1.5">
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold">
                {MANAGEMENT_BRANCH_META[branchOf(activeBook)].title}
              </span>
              <span className="text-slate-500 dark:text-slate-400">{activeBook.courseName}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {activeBook.bookTitle}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {activeBook.authors} · {activeBook.translatorsOrCompilers}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center shrink-0">
            {[
              { label: 'فصل کلیدی', value: fa(chapters.length) },
              { label: 'سؤال در ادوار', value: fa(totalExam) },
              { label: 'تست در سامانه', value: fa(bookQuestionCount) },
            ].map((s) => (
              <div key={s.label} className="px-2.5 py-1.5 rounded-lg glass-subcard">
                <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {s.value}
                </div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] leading-6">
          <div className="p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-200/60 dark:border-emerald-900/50 text-slate-700 dark:text-slate-300">
            <strong className="text-emerald-700 dark:text-emerald-400">ضریب ارشد: </strong>
            {activeBook.coefficientMaster}
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-500/8 border border-indigo-200/60 dark:border-indigo-900/50 text-slate-700 dark:text-slate-300">
            <strong className="text-indigo-700 dark:text-indigo-400">ضریب دکتری: </strong>
            {activeBook.coefficientPhd}
          </div>
        </div>
      </div>

      <div className="bento-card glass-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="tab-strip" role="tablist" aria-label="بخش‌های کتاب">
          {[
            { id: 'chapters' as const, label: `فصل‌های مهم (${fa(chapters.length)})`, icon: ListChecks },
            { id: 'full' as const, label: 'جزوهٔ جامع کتاب', icon: FileText },
            { id: 'tests' as const, label: `تست‌های این درس (${fa(bookQuestionCount)})`, icon: HelpCircle },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'glass-subcard text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={downloadMarkdown}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          دانلود جزوهٔ جامع (.md)
        </button>
      </div>

      {/* فصل‌های مهم: مرتب بر پایهٔ تعداد سؤال */}
      {tab === 'chapters' && (
        <div className="space-y-2.5">
          <div className="flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400 px-1">
            <div className="flex items-center justify-between">
              <span>مرتب‌شده بر پایهٔ تعداد سؤال طرح‌شده در ادوار کنکور</span>
              <span>برای دیدن آموزش و تست هر فصل، روی آن بزنید</span>
            </div>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-5">
              مبنا: {CHAPTER_FREQUENCY_BASIS}
            </span>
          </div>

          {chapters.map((ch, idx) => {
            const importance = getChapterImportance(ch.examCount);
            const isOpen = openChapterId === ch.id;
            const chapterQuestions = questionsForChapter(ch);
            const badgeStyle =
              importance === 'critical'
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                : importance === 'important'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-500/12 text-slate-600 dark:text-slate-400';

            return (
              <div key={ch.id} className="bento-card overflow-hidden">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenChapterId(isOpen ? null : ch.id)}
                  className="w-full text-right p-4 flex items-start gap-3 cursor-pointer"
                >
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold tabular-nums">
                    {fa(idx + 1)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {ch.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeStyle}`}>
                        {CHAPTER_IMPORTANCE_LABEL[importance]}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="tabular-nums">فصل {ch.number}</span>
                      <span className="tabular-nums inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                        <Flame className="w-3 h-3" />
                        {fa(ch.examCount)} سؤال
                      </span>
                      <span className="tabular-nums">{fa(chapterQuestions.length)} تست در سامانه</span>
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-200/70 dark:border-slate-800 pt-3">
                    <ul className="space-y-2">
                      {ch.points.map((p, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs leading-6 text-slate-700 dark:text-slate-300"
                        >
                          <span className="text-blue-500 font-bold mt-0.5">•</span>
                          <RichText text={p} />
                        </li>
                      ))}
                    </ul>

                    {ch.formulas && ch.formulas.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-amber-500/8 border border-amber-200/60 dark:border-amber-900/50 space-y-1">
                        <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                          فرمول‌ها و مدل‌های کلیدی این فصل
                        </div>
                        {ch.formulas.map((f, i) => (
                          <div key={i} className="text-xs text-slate-700 dark:text-slate-300">
                            <MathText text={f} />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {ch.nodes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenLesson(ch.nodes[0])}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          درس‌نامهٔ کامل این فصل
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setTab('tests');
                          setChapterFilter(ch.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-bold cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        تست‌های همین فصل ({fa(chapterQuestions.length)})
                      </button>
                      {ch.nodes.length > 0 && chapterQuestions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onStartPracticeNode(ch.nodes[0], 'practice')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          شروع تمرین هدفمند
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* جزوهٔ جامع کتاب */}
      {tab === 'full' && (
        <div className="space-y-4">
          <div className="bento-card p-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-6">
              <strong className="text-slate-900 dark:text-white">جزوهٔ جامع کتاب:</strong>{' '}
              {fa(chapters.length)} فصل کلیدی به‌ترتیب، در یک صفحه؛ مناسب مرور پیش از آزمون.
              <span className="block mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                این یک جزوهٔ تألیفی است، نه متن کامل کتاب. برای متن اصلی باید به نسخهٔ چاپی کتاب مراجعه کنید.
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {fa(chapters.reduce((s, c) => s + c.points.length, 0))} نکتهٔ آموزشی
            </span>
          </div>

          <nav aria-label="فهرست فصل‌های کتاب" className="flex flex-wrap gap-1.5">
            {chapters.map((ch, i) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  document
                    .getElementById(`book-chapter-${ch.id}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="toc-chip"
              >
                <span className="tabular-nums text-slate-400">{fa(i + 1)}</span>
                <span>{ch.title}</span>
              </button>
            ))}
          </nav>

          <article className="bento-card p-5 sm:p-7 space-y-6">
            <div className="paper-callout p-4">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                چرا این کتاب مهم است؟
              </div>
              <p className="lesson-prose text-sm">{activeBook.whyImportant}</p>
            </div>

            {chapters.map((ch, i) => (
              <section
                key={ch.id}
                id={`book-chapter-${ch.id}`}
                className="scroll-mt-24 space-y-2"
              >
                <div className="rule-label">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-600 text-white text-[11px] font-bold tabular-nums shrink-0">
                    {fa(i + 1)}
                  </span>
                  <span>{ch.title}</span>
                </div>
                <div className="reading-surface">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mb-1">
                    {fa(ch.examCount)} سؤال از این فصل در آزمون ارشد ·{' '}
                    {CHAPTER_IMPORTANCE_LABEL[getChapterImportance(ch.examCount)]}
                    <span className="block font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      فراوانی دکتری این فصل هنوز ثبت نشده است.
                    </span>
                  </p>
                  <ul className="lesson-prose list-disc pr-5 space-y-1">
                    {ch.points.map((p, pi) => (
                      <li key={pi}>
                        <RichText text={p} />
                      </li>
                    ))}
                  </ul>
                  {ch.formulas && ch.formulas.length > 0 && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 space-y-1">
                      <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        فرمول‌ها
                      </div>
                      {ch.formulas.map((f, fi) => (
                        <div key={fi} className="text-xs text-slate-700 dark:text-slate-300">
                          <MathText text={f} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))}

            {activeBook.goldenNotesCheatSheet.length > 0 && (
              <section className="space-y-2">
                <div className="rule-label">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-slate-950 text-[11px] font-bold shrink-0">
                    ★
                  </span>
                  <span>نکات طلایی و دام‌های کنکوری این کتاب</span>
                </div>
                <ul className="lesson-prose list-disc pr-5 space-y-1.5">
                  {activeBook.goldenNotesCheatSheet.map((note, i) => (
                    <li key={i}>
                      <MathText text={note} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        </div>
      )}

      {/* تست‌های این درس */}
      {tab === 'tests' && (
        <div className="space-y-4">
          <div className="bento-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                تست‌های درس «{activeBook.courseName}» به تفکیک فصل
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {fa(bookQuestionCount)} تست در سامانه · پاسخ تشریحی و دام طراح برای همه
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setChapterFilter(null)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                  chapterFilter === null
                    ? 'bg-blue-600 text-white'
                    : 'glass-subcard text-slate-600 dark:text-slate-300'
                }`}
              >
                همهٔ فصل‌ها
              </button>
              {groups.map((g) => (
                <button
                  key={g.chapter?.id ?? 'rest'}
                  type="button"
                  onClick={() => setChapterFilter(g.chapter?.id ?? null)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                    chapterFilter === (g.chapter?.id ?? null)
                      ? 'bg-blue-600 text-white'
                      : 'glass-subcard text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {g.chapter ? g.chapter.title.slice(0, 34) : 'سایر مباحث'} ({fa(g.questions.length)})
                </button>
              ))}
            </div>
          </div>

          {bookQuestionCount === 0 && (
            <div className="bento-card p-6 text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                هنوز تستی از این درس در بانک سامانه ثبت نشده است. نکات و آموزش فصل‌ها در
                «جزوهٔ جامع کتاب» و درس‌نامه‌های تعاملی در دسترس است.
              </p>
              {activeBook.linkedNodeId && (
                <button
                  type="button"
                  onClick={() => onOpenLesson(activeBook.linkedNodeId!)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  رفتن به درس‌نامهٔ این درس
                </button>
              )}
            </div>
          )}

          {(chapterFilter
            ? [
                {
                  chapter: chapters.find((c) => c.id === chapterFilter) ?? null,
                  questions: chapters
                    .filter((c) => c.id === chapterFilter)
                    .flatMap((c) => questionsForChapter(c)),
                },
              ]
            : groups
          )
            .filter((g) => g.questions.length > 0 || chapterFilter)
            .map((g) => (
              <div key={g.chapter?.id ?? 'rest'} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {g.chapter ? g.chapter.title : 'سایر مباحث این کتاب'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {fa(g.questions.length)} تست
                  </span>
                  {g.chapter && g.chapter.nodes[0] && (
                    <button
                      type="button"
                      onClick={() => onOpenLesson(g.chapter!.nodes[0])}
                      className="text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
                    >
                      آموزش این فصل ←
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {g.questions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      chosen={answers[q.id]}
                      revealed={!!revealed[q.id]}
                      onChoose={(idx) => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                      onReveal={() => setRevealed((prev) => ({ ...prev, [q.id]: true }))}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
