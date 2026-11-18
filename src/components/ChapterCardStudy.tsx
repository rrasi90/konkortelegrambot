import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Layers,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { BookChapter } from '../data/bookChaptersTypes';
import type { QuestionItem } from '../data/konkorData';
import { buildChapterStudyCards } from '../data/chapterFlashcards';
import { MathText } from './MathText';

interface ChapterCardStudyProps {
  chapter: BookChapter;
  subjectId: string;
  subjectTitle: string;
  questions: QuestionItem[];
  onClose: () => void;
  onOpenQuestions?: () => void;
}

const fa = (n: number) => n.toLocaleString('fa-IR');

const KIND_STYLE: Record<string, string> = {
  overview: 'bg-[var(--subject-soft)] text-[color:var(--subject-text)]',
  pretest: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  point: 'bg-[var(--subject-soft)] text-[color:var(--subject-text)]',
  formula: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
  example: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  trap: 'bg-rose-500/15 text-rose-800 dark:text-rose-300',
  retrieval: 'bg-[var(--subject-soft)] text-[color:var(--subject-text)]',
  question: 'bg-slate-500/15 text-slate-700 dark:text-slate-200',
};

export const ChapterCardStudy: React.FC<ChapterCardStudyProps> = ({
  chapter,
  subjectId,
  subjectTitle,
  questions,
  onClose,
  onOpenQuestions,
}) => {
  const cards = useMemo(() => buildChapterStudyCards(chapter, questions), [chapter, questions]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [chapter.id]);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const card = cards[index];
  const isLast = index === cards.length - 1;

  const goNext = () => {
    setFlipped(false);
    if (!isLast) setIndex((current) => current + 1);
  };

  const goPrevious = () => {
    setFlipped(false);
    if (index > 0) setIndex((current) => current - 1);
  };

  const body = (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto bg-[#f6f2e9] text-slate-900 dark:bg-[#100f0d] dark:text-slate-100"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={`کارت‌های مطالعهٔ ${chapter.title}`}
      data-subject={subjectId}
      data-testid="chapter-card-study"
    >
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pb-6 pt-3 sm:px-6">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت به فصل‌ها
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate rounded-lg bg-[var(--subject-soft)] px-2 py-1 text-[10px] font-bold text-[color:var(--subject-text)]">
              {subjectTitle}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن کارت‌های فصل"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="pt-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <Layers className="h-3.5 w-3.5" />
                {`فصل ${chapter.number} · ${fa(cards.length)} کارت`}
              </div>
              <h2 className="text-xl font-extrabold leading-8 text-slate-900 dark:text-white">
                {chapter.title}
              </h2>
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
              {`${fa(index + 1)} از ${fa(cards.length)}`}
            </span>
          </div>

          <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full bg-[var(--subject-line)] transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${((index + 1) / Math.max(cards.length, 1)) * 100}%` }}
            />
          </div>

          {questions.length === 0 && (
            <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-[11px] leading-6 text-amber-800 dark:text-amber-200">
              برای این فصل تست ثبت‌شده‌ای در سامانه نداریم؛ کارت‌ها از نکات تألیفی همین فصل ساخته شده‌اند.
            </p>
          )}

          {!card ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              برای این فصل هنوز کارت مطالعه‌ای ثبت نشده است. به فهرست فصل‌ها برگرد و فصل دیگری را انتخاب کن.
            </div>
          ) : (
            <>
              <div
                role="button"
                tabIndex={0}
                aria-label={flipped ? 'برگرداندن کارت' : 'نمایش پاسخ کارت'}
                onClick={() => setFlipped((value) => !value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFlipped((value) => !value);
                  }
                }}
                className="relative mt-5 h-[420px] w-full cursor-pointer outline-none sm:h-[460px]"
                style={{ perspective: '1200px' }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-3 right-0 z-10 w-1.5 rounded-l-full bg-[var(--subject-solid)] opacity-70"
                />
                <div
                  className="relative h-full w-full transition-transform duration-300 motion-reduce:transition-none"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  <div
                    aria-hidden={flipped}
                    className="absolute inset-0 flex flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-[#fffdf8] p-5 shadow-sm dark:border-slate-700 dark:bg-[#1d1c19] sm:p-7"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold ${KIND_STYLE[card.kind] ?? KIND_STYLE.point}`}
                      >
                        {card.label}
                      </span>
                      {card.source && (
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          {card.source}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 items-center py-5">
                      <p className="text-base font-bold leading-9 text-slate-900 dark:text-slate-100">
                        <MathText text={card.front} />
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <RotateCcw className="h-3.5 w-3.5" />
                      برای دیدن پاسخ، کارت را بزن.
                    </div>
                  </div>

                  <div
                    aria-hidden={!flipped}
                    className="absolute inset-0 flex flex-col overflow-y-auto rounded-2xl border border-[color:var(--subject-line)] bg-[var(--subject-soft)] p-5 shadow-sm dark:bg-[#241f1a] sm:p-7"
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1 text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        <Sparkles className="h-3 w-3" />
                        پاسخ
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{card.label}</span>
                    </div>
                    <div className="flex-1 whitespace-pre-line py-5 text-[15px] leading-8 text-slate-800 dark:text-slate-100">
                      <MathText text={card.back} />
                    </div>
                    {card.hint && (
                      <p className="mb-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-6 text-amber-800 dark:text-amber-200">
                        راهنما: {card.hint}
                      </p>
                    )}
                    {card.kind === 'question' && onOpenQuestions && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenQuestions();
                        }}
                        className="min-h-11 rounded-xl border border-[color:var(--subject-line)] px-3 text-xs font-bold text-[color:var(--subject-text)] hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        رفتن به بانک تست همین فصل
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrevious}
                  disabled={index === 0}
                  aria-label="کارت قبلی"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFlipped((value) => !value)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-xs font-extrabold transition-transform active:scale-[0.99] motion-reduce:active:scale-100"
                  style={{
                    backgroundColor: 'var(--subject-solid)',
                    color: 'var(--subject-on-solid)',
                  }}
                >
                  {flipped ? 'برگرداندن کارت' : 'نمایش پاسخ'}
                </button>
                {isLast ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    پایان فصل
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="کارت بعدی"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
};
