import React from 'react';
import { KnowledgeNode } from '../data/konkorData';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  BookOpen,
  Target,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  Award,
} from 'lucide-react';

export interface SessionAnswerResult {
  cardId: string;
  nodeId: string;
  course: string;
  topic: string;
  questionId: string;
  wasCorrect: boolean;
  wasSkipped: boolean;
  errorType: string;
  seconds: number;
}

interface SessionReportProps {
  results: SessionAnswerResult[];
  totalCards: number;
  nodes: KnowledgeNode[];
  onOpenLessonNode: (nodeId: string) => void;
  onOpenMistakeNotebook: () => void;
  onRestartMistakes: (questionIds: string[]) => void;
  onExitSession: () => void;
  nextStepLabel?: string;
  exitLabel?: string;
}

const ERROR_LABELS: Record<string, string> = {
  concept_gap: 'خلأ مفهومی',
  prerequisite_failure: 'ضعف پیش‌نیاز',
  misread: 'بدخوانی صورت سؤال',
  slip: 'بی‌دقتی در انتخاب گزینه',
  skipped: 'بدون پاسخ',
  none: 'نامشخص',
};

export const SessionReport: React.FC<SessionReportProps> = ({
  results,
  totalCards,
  nodes,
  onOpenLessonNode,
  onOpenMistakeNotebook,
  onRestartMistakes,
  onExitSession,
  nextStepLabel,
  exitLabel = 'بازگشت به میز کار',
}) => {
  const answered = results.filter((r) => !r.wasSkipped);
  const correct = results.filter((r) => r.wasCorrect);
  const wrong = results.filter((r) => !r.wasCorrect && !r.wasSkipped);
  const skipped = results.filter((r) => r.wasSkipped);
  const slips = results.filter((r) => r.errorType === 'slip');
  const accuracy = answered.length
    ? Math.round((correct.length / answered.length) * 100)
    : 0;
  const avgSeconds = answered.length
    ? Math.round(
        answered.reduce((sum, r) => sum + r.seconds, 0) / answered.length
      )
    : 0;

  const retryQuestionIds = [...new Set(wrong.map((r) => r.questionId))];

  const weakTopics = Object.values(
    results
      .filter((r) => !r.wasCorrect)
      .reduce<Record<string, { nodeId: string; topic: string; course: string; count: number }>>(
        (acc, r) => {
          acc[r.nodeId] = acc[r.nodeId]
            ? { ...acc[r.nodeId], count: acc[r.nodeId].count + 1 }
            : { nodeId: r.nodeId, topic: r.topic, course: r.course, count: 1 };
          return acc;
        },
        {}
      )
  ).sort((a, b) => b.count - a.count);

  const errorBreakdown = Object.values(
    results.reduce<Record<string, { type: string; count: number }>>((acc, r) => {
      const type = r.wasCorrect ? 'correct' : r.errorType;
      acc[type] = acc[type]
        ? { ...acc[type], count: acc[type].count + 1 }
        : { type, count: 1 };
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-20 my-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-500" />
              <span>کارنامه این جلسه</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-6">
              {results.length === 0
                ? 'در این جلسه کارت تستی پاسخ داده نشد (فقط درسنامه یا کارت مفهومی بود).'
                : results.length < totalCards
                  ? `جلسه را زودتر بستید؛ ${results.length} گام از ${totalCards} گام انجام شد و همین بخش کارنامه می‌شود. خطاها در دفتر خطا ذخیره شده‌اند.`
                  : 'این گزارش فقط برای همین جلسه است؛ خطاها در دفتر خطا ذخیره شده‌اند تا بعداً مرور شوند.'}
            </p>
            {answered.length > 0 && accuracy >= 80 && (
              <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                🎉 آفرین! دقت {accuracy}٪ یعنی مسیر مرور امروز درست جلو می‌رود؛ همین ریتم را نگه دارید.
              </div>
            )}
          </div>
          <div className="text-left">
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
              {accuracy}٪
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              دقت پاسخ‌های داده‌شده
            </div>
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-4">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${accuracy}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4">
          {[
            { label: 'درست', value: correct.length, tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'غلط', value: wrong.length, tone: 'text-rose-600 dark:text-rose-400' },
            { label: 'نزده', value: skipped.length, tone: 'text-slate-600 dark:text-slate-300' },
            { label: 'بی‌دقتی', value: slips.length, tone: 'text-amber-600 dark:text-amber-400' },
            { label: 'میانگین زمان', value: `${avgSeconds} ثانیه`, tone: 'text-blue-600 dark:text-blue-400' },
          ].map((item) => (
            <div
              key={item.label}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800"
            >
              <div className={`text-lg font-bold tabular-nums ${item.tone}`}>
                {item.value}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {errorBreakdown.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-4">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              جنس پاسخ‌ها:
            </span>
            {errorBreakdown.map((item) => (
              <span
                key={item.type}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700"
              >
                {item.type === 'correct' ? 'درست' : ERROR_LABELS[item.type] ?? item.type}:{' '}
                <strong className="tabular-nums">{item.count}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {weakTopics.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>مباحثی که امروز نیاز به ترمیم دارند</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            ترتیب بر اساس تعداد خطا در همین جلسه؛ اول درسنامه را مرور کنید، بعد تست‌های
            همان مبحث را دوباره بزنید.
          </p>
          <div className="mt-3 space-y-2">
            {weakTopics.slice(0, 6).map((topic) => (
              <div
                key={topic.nodeId}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {topic.topic}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {topic.course} · {topic.count} خطا
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenLessonNode(topic.nodeId)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  درسنامه
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {retryQuestionIds.length > 0
            ? `${retryQuestionIds.length} سؤال غلط برای تمرین دوباره آماده است.`
            : answered.length > 0
              ? 'همه پاسخ‌های این جلسه درست بود؛ برای تثبیت، مرور فردا را از دست ندهید.'
              : 'در این جلسه سؤالی پاسخ داده نشد؛ دفعهٔ بعد چند کارت تستی را هم امتحان کن.'}
          {nextStepLabel && (
            <div className="mt-1 font-bold text-amber-700 dark:text-amber-300">بخش بعد: {nextStepLabel}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {retryQuestionIds.length > 0 && (
            <button
              type="button"
              onClick={() => onRestartMistakes(retryQuestionIds)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              تمرین دوباره سؤالات غلط
            </button>
          )}
          <button
            type="button"
            onClick={onOpenMistakeNotebook}
            className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Target className="w-4 h-4" />
            دفتر خطا
          </button>
          <button
            type="button"
            onClick={onExitSession}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {exitLabel}
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
        {results.length} کارت تستی از {totalCards} کارت این جلسه ثبت شد ·{' '}
        <Clock className="w-3 h-3 inline" /> زمان کل جلسه:{' '}
        {Math.max(1, Math.round(results.reduce((s, r) => s + r.seconds, 0) / 60))} دقیقه
      </div>
    </div>
  );
};
