import React, { useMemo, useState } from 'react';
import { KnowledgeNode } from '../data/konkorData';
import { MathText } from './MathText';
import {
  MistakeEntry,
  MISTAKE_ERROR_LABELS,
  filterMistakes,
  summarizeMistakes,
} from '../utils/mistakeNotebook';
import {
  Search,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BookMarked,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Target,
  Layers,
} from 'lucide-react';

interface MistakeNotebookViewProps {
  entries: MistakeEntry[];
  nodes: KnowledgeNode[];
  onStartMistakeSession: (questionIds: string[]) => void;
  onOpenLessonNode: (nodeId: string) => void;
  onToggleResolved: (questionId: string, resolved: boolean) => void;
  onRemove: (questionId: string) => void;
  onClearResolved: () => void;
}

export const MistakeNotebookView: React.FC<MistakeNotebookViewProps> = ({
  entries,
  nodes,
  onStartMistakeSession,
  onOpenLessonNode,
  onToggleResolved,
  onRemove,
  onClearResolved,
}) => {
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('all');
  const [status, setStatus] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  const summary = useMemo(() => summarizeMistakes(entries), [entries]);
  const courses = useMemo(
    () => [...new Set(entries.map((e) => e.course))].sort(),
    [entries]
  );
  const visible = useMemo(
    () => filterMistakes(entries, { search, course, status }),
    [entries, search, course, status]
  );
  const unresolvedIds = useMemo(
    () => entries.filter((e) => !e.resolved).map((e) => e.questionId),
    [entries]
  );

  const toggleOpen = (id: string) =>
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-rose-500" />
              <span>دفتر خطا — یادگیری از اشتباه‌ها</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-6 max-w-2xl">
              هر تستی که غلط بزنید، با پاسخ خودتان، کلید صحیح، تشریح کامل، دام طراح و
              منبع کتاب اینجا نگه داشته می‌شود. مرور خطاها مؤثرترین بخش مطالعه است؛
              ابتدا خودتان دوباره حل کنید، بعد تشریح را باز کنید.
            </p>
          </div>
          <button
            type="button"
            disabled={unresolvedIds.length === 0}
            onClick={() => onStartMistakeSession(unresolvedIds)}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>شروع مرور خطاها ({unresolvedIds.length})</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
          {[
            { label: 'کل خطاهای ثبت‌شده', value: summary.total, tone: 'text-slate-900 dark:text-white' },
            { label: 'در انتظار مرور', value: summary.unresolved, tone: 'text-rose-600 dark:text-rose-400' },
            { label: 'یاد گرفته‌شده', value: summary.resolved, tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'خطای تکرارشده', value: summary.repeated, tone: 'text-amber-600 dark:text-amber-400' },
          ].map((card) => (
            <div
              key={card.label}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800"
            >
              <div className={`text-xl font-bold tabular-nums ${card.tone}`}>
                {card.value}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {summary.byErrorType.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              جنس خطاها:
            </span>
            {summary.byErrorType.map((item) => (
              <span
                key={item.errorType}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700"
              >
                {item.label}: <strong className="tabular-nums">{item.count}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 shadow-xs flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در متن سؤال، مبحث یا تشریح..."
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="all">همه درس‌ها</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(
              [
                { id: 'unresolved', label: 'در انتظار' },
                { id: 'resolved', label: 'یاد گرفته' },
                { id: 'all', label: 'همه' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatus(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  status === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {summary.resolved > 0 && (
            <button
              type="button"
              onClick={onClearResolved}
              className="px-2.5 py-2 rounded-xl text-[11px] font-bold text-slate-500 hover:text-rose-500 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              پاک‌سازی یادگرفته‌ها
            </button>
          )}
        </div>
      )}

      {entries.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-10 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            دفتر خطا هنوز خالی است
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-6">
            با اولین پاسخ غلط در «جلسه تست» یا «کنکورهای سالانه»، همان سؤال با تشریح
            کاملش اینجا ثبت می‌شود تا بعداً مرورش کنید.
          </p>
        </div>
      )}

      {entries.length > 0 && visible.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          خطایی با این فیلترها پیدا نشد.
        </div>
      )}

      <div className="space-y-2.5">
        {visible.map((entry, index) => {
          const isOpen = !!openIds[entry.questionId];
          const node = nodes.find((n) => n.id === entry.nodeId);
          return (
            <div
              key={entry.questionId}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center justify-center tabular-nums">
                    {index + 1}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-600/10 text-blue-700 dark:text-blue-300">
                    {entry.course}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {entry.topic}
                  </span>
                  {entry.examYear && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      کنکور {entry.examYear}
                    </span>
                  )}
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300">
                    {MISTAKE_ERROR_LABELS[entry.errorType]}
                  </span>
                  {entry.wrongCount > 1 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white">
                      {entry.wrongCount} بار غلط
                    </span>
                  )}
                  {entry.resolved && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      یاد گرفته‌شده
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleOpen(entry.questionId)}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
                >
                  {isOpen ? (
                    <>
                      بستن <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      مشاهده پاسخ و تشریح <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-sm text-slate-800 dark:text-slate-100 leading-7 mt-2.5">
                <MathText text={entry.questionText} />
              </p>

              {isOpen && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    {entry.options.map((opt, idx) => {
                      const isCorrect = idx === entry.correctOption;
                      const isChosen = idx === entry.selectedOption;
                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs leading-6 ${
                            isCorrect
                              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-900 dark:text-emerald-100'
                              : isChosen
                              ? 'bg-rose-500/10 border-rose-500/50 text-rose-900 dark:text-rose-100'
                              : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <span className="w-5 h-5 rounded-md bg-white/70 dark:bg-slate-900/70 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="flex-1">
                            <MathText text={opt} />
                          </span>
                          {isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-1" />
                          )}
                          {isChosen && !isCorrect && (
                            <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {entry.selectedOption === null
                      ? 'شما این سؤال را بی‌پاسخ گذاشتید.'
                      : `پاسخ شما: گزینه ${entry.selectedOption + 1} · پاسخ صحیح: گزینه ${
                          entry.correctOption + 1
                        }`}
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs leading-7 text-slate-700 dark:text-slate-300">
                    <div className="font-bold text-slate-900 dark:text-white">
                      پاسخ تشریحی
                    </div>
                    <div>
                      <MathText text={entry.explanation} />
                    </div>
                    {entry.trapNote && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200">
                        <span className="font-bold flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          دام طراح
                        </span>
                        <MathText text={entry.trapNote} />
                      </div>
                    )}
                    {entry.source && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        منبع: {entry.source}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onStartMistakeSession([entry.questionId])}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Target className="w-3.5 h-3.5" />
                      تمرین دوباره همین سؤال
                    </button>

                    {node && (
                      <button
                        type="button"
                        onClick={() => onOpenLessonNode(entry.nodeId)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        درسنامه این مبحث
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        onToggleResolved(entry.questionId, !entry.resolved)
                      }
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border cursor-pointer ${
                        entry.resolved
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {entry.resolved ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          بازگرداندن به «در انتظار»
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          یاد گرفتم
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemove(entry.questionId)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-500 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </button>

                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {new Date(entry.lastWrongAt).toLocaleDateString('fa-IR')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
