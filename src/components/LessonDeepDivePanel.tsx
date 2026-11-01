import React from 'react';
import type { LessonDeepDive } from '../data/lessonDeepDiveTypes';
import { RichText } from './RichText';
import { TopicDiagramVisualizer } from './TopicDiagramVisualizer';
import {
  Target,
  Lightbulb,
  AlertTriangle,
  Crosshair,
  CheckCircle2,
  PenLine,
  Compass,
} from 'lucide-react';

interface LessonDeepDivePanelProps {
  dive: LessonDeepDive;
  wordCount: number;
}

/**
 * درس‌نامهٔ کامل: اهداف یادگیری، آموزش عمیق، مثال حل‌شده، بدفهمی‌ها،
 * زاویهٔ طراح و جمع‌بندی. متن آموزشی در ستون خوانا و با فاصلهٔ خط مناسب
 * رندر می‌شود تا خواندن طولانی خسته‌کننده نباشد.
 */
export const LessonDeepDivePanel: React.FC<LessonDeepDivePanelProps> = ({ dive, wordCount }) => {
  const sectionAnchors = dive.sections.map((s, i) => ({
    id: `lesson-section-${i + 1}`,
    title: s.title,
  }));

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      {/* نمودار مفهومی و تصویر ساختاری سبک در صورت وجود */}
      <TopicDiagramVisualizer
        nodeId={dive.nodeId}
        topic={`${dive.nodeId} ${dive.sections.map((s) => s.title).join(' ')} ${dive.whyItMatters}`}
      />

      {/* اهداف یادگیری */}
      <section className="bento-card p-5 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="section-eyebrow">
            <Target className="w-4 h-4" />
            <span>در پایان این درس می‌توانید</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {wordCount.toLocaleString('fa-IR')} واژه آموزش فشرده · {dive.sections.length} بخش
          </span>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 pt-1">
          {dive.objectives.map((obj, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-7 text-slate-800 dark:text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-1.5" />
              <RichText text={obj} />
            </li>
          ))}
        </ul>
      </section>

      {/* چرا این مبحث مهم است */}
      <div className="paper-callout p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
          <Compass className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>چرا این مبحث، این‌طور پرسیده می‌شود</span>
        </div>
        <RichText
          text={dive.whyItMatters}
          className="lesson-prose block text-sm text-slate-700 dark:text-slate-300"
        />
      </div>

      {/* فهرست افقی درس: پیمایش سریع بدون باریک‌کردن ستون متن */}
      <nav aria-label="فهرست بخش‌های این درس" className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span>فهرست این درس</span>
          <span className="font-normal">
            {(sectionAnchors.length + 3).toLocaleString('fa-IR')} بخش · برای پرش کلیک کنید
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sectionAnchors.map((s, i) => (
            <button key={s.id} type="button" onClick={() => scrollTo(s.id)} className="toc-chip">
              <span className="tabular-nums text-slate-400">{String(i + 1).padStart(2, '0')}</span>
              <span>{s.title}</span>
            </button>
          ))}
          <button type="button" onClick={() => scrollTo('lesson-example')} className="toc-chip">
            <span className="text-slate-400">◆</span>
            <span>مثال حل‌شده گام‌به‌گام</span>
          </button>
          <button type="button" onClick={() => scrollTo('lesson-traps')} className="toc-chip">
            <span className="text-slate-400">◆</span>
            <span>بدفهمی‌ها و دام‌های طراح</span>
          </button>
          <button type="button" onClick={() => scrollTo('lesson-takeaways')} className="toc-chip">
            <span className="text-slate-400">◆</span>
            <span>جمع‌بندی در چهار خط</span>
          </button>
        </div>
      </nav>

      {/* آموزش عمیق */}
      <div className="space-y-5">
        {dive.sections.map((section, idx) => (
          <section
            key={section.title}
            id={`lesson-section-${idx + 1}`}
            className="scroll-mt-24 w-full max-w-[40rem] mx-auto"
          >
            <div className="rule-label mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-600 text-white text-[11px] font-bold tabular-nums shrink-0">
                {idx + 1}
              </span>
              <span>
                <RichText text={section.title} />
              </span>
            </div>
            <div className="reading-surface">
              <RichText
                text={section.body}
                className="lesson-prose block text-slate-800 dark:text-slate-200"
              />
            </div>
          </section>
        ))}
      </div>

      {/* مثال حل‌شده */}
      <section
        id="lesson-example"
        className="scroll-mt-24 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/25 p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-200">
          <PenLine className="w-4 h-4" />
          <span>مثال حل‌شده — همین‌طور که در آزمون می‌بینید</span>
        </div>

        <RichText
          text={dive.example.prompt}
          className="lesson-prose block text-sm font-medium text-slate-900 dark:text-white"
        />

        <ol className="space-y-2">
          {dive.example.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-7 text-slate-700 dark:text-slate-300">
              <span className="mt-1 shrink-0 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-[10px] font-bold text-blue-700 dark:text-blue-300 flex items-center justify-center tabular-nums">
                {i + 1}
              </span>
              <RichText text={step} />
            </li>
          ))}
        </ol>

        <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300/70 dark:border-emerald-900/70">
          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
            پاسخ نهایی
          </div>
          <RichText
            text={dive.example.answer}
            className="text-sm text-slate-800 dark:text-slate-200 leading-7"
          />
        </div>
      </section>

      {/* بدفهمی‌ها + زاویه طراح */}
      <section id="lesson-traps" className="scroll-mt-24 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4" />
            <span>سه بدفهمی رایج</span>
          </div>
          <ul className="space-y-2">
            {dive.misconceptions.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
                <span className="text-rose-500 font-bold mt-1 shrink-0">×</span>
                <RichText text={m} />
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
            <Crosshair className="w-4 h-4" />
            <span>زاویهٔ طراح و روش برخورد</span>
          </div>
          <RichText
            text={dive.examAngle}
            className="lesson-prose block text-sm text-slate-700 dark:text-slate-300"
          />
        </div>
      </section>

      {/* جمع‌بندی */}
      <section
        id="lesson-takeaways"
        className="scroll-mt-24 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span>جمع‌بندی: اگر فقط همین چهار خط را به یاد بسپارید</span>
        </div>
        <ol className="space-y-2">
          {dive.takeaways.map((t, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-7 text-slate-800 dark:text-slate-200">
              <span className="shrink-0 mt-1 px-1.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                {i + 1}
              </span>
              <RichText text={t} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};
