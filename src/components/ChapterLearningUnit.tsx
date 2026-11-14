import React from 'react';
import { AlertTriangle, BookOpen, HelpCircle, Lightbulb, ListChecks, Target } from 'lucide-react';
import type { BookChapter, ChapterContentKind } from '../data/bookChaptersTypes';
import {
  CHAPTER_CONTENT_KIND_LABEL,
  getChapterContentKind,
} from '../data/bookChaptersTypes';

const BADGE_STYLE: Record<ChapterContentKind, string> = {
  full_text: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  authored_summary: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  notes_only: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  incomplete: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

export const ChapterContentBadge: React.FC<{ chapter: BookChapter; className?: string }> = ({
  chapter,
  className = '',
}) => {
  const kind = getChapterContentKind(chapter);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${BADGE_STYLE[kind]} ${className}`}
      title="نوع محتوای ثبت‌شده برای این فصل"
    >
      <BookOpen className="h-3 w-3" />
      {CHAPTER_CONTENT_KIND_LABEL[kind]}
    </span>
  );
};

const PromptList: React.FC<{
  title: string;
  icon: React.ReactNode;
  prompts: NonNullable<BookChapter['pretest']>;
  tone: 'pretest' | 'retrieval';
}> = ({ title, icon, prompts, tone }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
      {icon}
      <span>{title}</span>
    </div>
    <div className="space-y-1.5">
      {prompts.map((prompt, index) => (
        <details
          key={`${tone}-${index}-${prompt.question}`}
          className="rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40"
        >
          <summary className="cursor-pointer list-none text-[11px] font-medium leading-6 text-slate-800 marker:hidden dark:text-slate-100">
            {prompt.question}
          </summary>
          <div className="mt-1.5 border-t border-slate-200/70 pt-1.5 text-[11px] leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <strong className="text-slate-800 dark:text-slate-100">پاسخ: </strong>
            {prompt.answer}
            {prompt.hint && (
              <span className="mt-1 block text-[10px] text-amber-700 dark:text-amber-300">
                راهنما: {prompt.hint}
              </span>
            )}
          </div>
        </details>
      ))}
    </div>
  </div>
);

/**
 * نمایش راهنمای یادگیری فصل از دادهٔ BookChapter.
 * هر بخش فقط وقتی داده دارد رندر می‌شود؛ بخش خالی ساخته نمی‌شود.
 */
export const ChapterLearningUnit: React.FC<{ chapter: BookChapter }> = ({ chapter }) => {
  const objectives = (chapter.objectives ?? []).slice(0, 3);
  const prerequisites = chapter.prerequisites ?? [];
  const pretest = chapter.pretest ?? [];
  const retrievalPrompts = chapter.retrievalPrompts ?? [];
  const hasLearningFields =
    objectives.length > 0 ||
    prerequisites.length > 0 ||
    pretest.length > 0 ||
    Boolean(chapter.workedExample) ||
    Boolean(chapter.commonTrap) ||
    retrievalPrompts.length > 0;

  return (
    <section
      className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/35"
      aria-label={`راهنمای یادگیری ${chapter.title}`}
      data-testid={`chapter-learning-${chapter.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
          <BookOpen className="h-3.5 w-3.5" />
          <span>واحد یادگیری این فصل</span>
        </div>
        <ChapterContentBadge chapter={chapter} />
      </div>

      {!hasLearningFields && (
        <p className="text-[11px] leading-6 text-slate-500 dark:text-slate-400">
          برای این فصل هنوز اهداف، مثال و پرسش بازیابی ثبت نشده است؛ فقط نکات موجود نمایش داده می‌شود.
        </p>
      )}

      {objectives.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
            <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
            <span>اهداف یادگیری</span>
          </div>
          <ul className="space-y-1">
            {objectives.map((objective) => (
              <li key={objective} className="flex items-start gap-1.5 text-[11px] leading-6 text-slate-700 dark:text-slate-300">
                <span className="mt-1 text-blue-500">•</span>
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {prerequisites.length > 0 && (
        <div className="flex flex-wrap items-start gap-1.5 text-[11px] leading-6 text-slate-600 dark:text-slate-300">
          <span className="font-bold text-slate-700 dark:text-slate-200">پیش‌نیاز:</span>
          {prerequisites.map((item) => (
            <span key={item} className="rounded-lg bg-slate-200/70 px-2 py-0.5 dark:bg-slate-800">
              {item}
            </span>
          ))}
        </div>
      )}

      {pretest.length > 0 && (
        <PromptList
          title="قبل از خواندن، خودت را بسنج"
          icon={<HelpCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />}
          prompts={pretest}
          tone="pretest"
        />
      )}

      {chapter.workedExample && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
            <ListChecks className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
            <span>مثال حل‌شده: {chapter.workedExample.title}</span>
          </div>
          <ol className="space-y-1 pr-4 text-[11px] leading-6 text-slate-700 dark:text-slate-300">
            {chapter.workedExample.steps.map((step, index) => (
              <li key={`${index}-${step}`} className="list-decimal">
                {step}
              </li>
            ))}
          </ol>
          {chapter.workedExample.takeaway && (
            <p className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] leading-6 text-emerald-800 dark:text-emerald-200">
              <strong>نکتهٔ کلیدی: </strong>
              {chapter.workedExample.takeaway}
            </p>
          )}
        </div>
      )}

      {chapter.commonTrap && (
        <div className="flex items-start gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/8 px-2.5 py-2 text-[11px] leading-6 text-rose-800 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>دام رایج: </strong>
            {chapter.commonTrap}
          </span>
        </div>
      )}

      {retrievalPrompts.length > 0 && (
        <PromptList
          title="بعد از خواندن، بازیابی کن"
          icon={<Lightbulb className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />}
          prompts={retrievalPrompts}
          tone="retrieval"
        />
      )}
    </section>
  );
};
