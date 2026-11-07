/**
 * FlashcardStudyView — Anki-style flashcard review interface.
 * Shows front → user thinks → flip → rate (دوباره/سخت/خوب/آسان).
 * FSRS-compatible: intervals stored in localStorage per card, course filter.
 * All 40+ cards cover 32 nodes across 13 courses (arshad + PhD).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight, ChevronLeft, RotateCw,
  Layers, Zap, CheckCircle2, XCircle,
} from 'lucide-react';
import { FLASHCARDS, FLASHCARD_COURSES, Flashcard } from '../data/flashcards';

type Rating = 1 | 2 | 3 | 4; // 1=دوباره 2=سخت 3=خوب 4=آسان

interface CardSchedule {
  ease: number;      // ease factor (Anki-style, starts 2.5)
  interval: number;  // days
  due: number;       // timestamp ms
  reps: number;      // total reviews
  lapses: number;    // total times rated 1
}

const LS_KEY = 'ael.flashcard-schedule';
const DEFAULT_SCHEDULE: CardSchedule = { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0 };

function loadSchedules(): Record<string, CardSchedule> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch { return {}; }
}

function saveSchedules(s: Record<string, CardSchedule>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* non-critical */ }
}

/** Anki-style interval update: rate 1 resets, 2-4 scale interval by ease factor adjusted. */
function updateSchedule(prev: CardSchedule, rating: Rating): CardSchedule {
  const next = { ...prev, reps: prev.reps + 1 };
  if (rating === 1) {
    next.lapses = prev.lapses + 1;
    next.interval = 0;
    next.ease = Math.max(1.3, prev.ease - 0.2);
    next.due = Date.now() + 60_000; // 1 minute (relearn)
    return next;
  }
  const easeAdjust = rating === 2 ? -0.15 : rating === 4 ? 0.15 : 0;
  next.ease = Math.max(1.3, prev.ease + easeAdjust);
  if (prev.reps === 0) next.interval = rating === 2 ? 1 : rating === 3 ? 2 : 4;
  else if (prev.reps === 1) next.interval = rating === 2 ? 3 : rating === 3 ? 6 : 9;
  else next.interval = Math.round(prev.interval * next.ease);
  next.due = Date.now() + next.interval * 86_400_000;
  return next;
}

const RATING_LABELS: Record<Rating, { label: string; color: string }> = {
  1: { label: 'دوباره', color: 'bg-rose-600 hover:bg-rose-500' },
  2: { label: 'سخت', color: 'bg-amber-600 hover:bg-amber-500' },
  3: { label: 'خوب', color: 'bg-emerald-600 hover:bg-emerald-500' },
  4: { label: 'آسان', color: 'bg-sky-600 hover:bg-sky-500' },
};

export const FlashcardStudyView: React.FC = () => {
  const [schedules, setSchedules] = useState<Record<string, CardSchedule>>(() => loadSchedules());
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [sessionIdx, setSessionIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 });

  const now = Date.now();

  // Build due cards for selected course
  const dueCards = useMemo(() => {
    const cards = FLASHCARDS.filter((c) => selectedCourse === 'all' || c.nodeId.startsWith(selectedCourse + '.'));
    const due = cards.filter((c) => {
      const s = schedules[c.id] ?? DEFAULT_SCHEDULE;
      return s.due <= now || s.reps === 0;
    });
    // new cards first, then by due date
    return due.sort((a, b) => {
      const sa = schedules[a.id] ?? DEFAULT_SCHEDULE;
      const sb = schedules[b.id] ?? DEFAULT_SCHEDULE;
      if (sa.reps === 0 && sb.reps > 0) return -1;
      if (sb.reps === 0 && sa.reps > 0) return 1;
      return sa.due - sb.due;
    }).slice(0, 20);
  }, [selectedCourse, schedules, now]);

  // Start session when course changes
  useEffect(() => {
    setSessionCards(dueCards);
    setSessionIdx(0);
    setFlipped(false);
    setSessionDone(dueCards.length === 0);
    setStats({ again: 0, hard: 0, good: 0, easy: 0 });
  }, [dueCards]);

  const handleRate = useCallback((rating: Rating) => {
    if (sessionIdx >= sessionCards.length) return;
    const card = sessionCards[sessionIdx];
    const prev = schedules[card.id] ?? DEFAULT_SCHEDULE;
    const next = updateSchedule(prev, rating);
    const newSchedules = { ...schedules, [card.id]: next };
    setSchedules(newSchedules);
    saveSchedules(newSchedules);
    setStats((s) => ({ ...s, [rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy']: (s as any)[rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy'] + 1 }));
    setFlipped(false);
    if (sessionIdx + 1 >= sessionCards.length) setSessionDone(true);
    else setSessionIdx((i) => i + 1);
  }, [sessionIdx, sessionCards, schedules]);

  const current = sessionCards[sessionIdx];
  const courseInfo = FLASHCARD_COURSES.find((c) => current?.nodeId.startsWith(c.id + '.'));

  if (sessionDone) {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-8 text-center shadow-xs my-8">
        <CheckCircle2 className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">جلسهٔ فلش‌کارت تمام شد!</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          {sessionCards.length} کارت مرور شد · دوباره: {stats.again} · سخت: {stats.hard} · خوب: {stats.good} · آسان: {stats.easy}
        </p>
        <button
          type="button"
          onClick={() => { setSessionDone(false); setSessionIdx(0); setSessionCards(dueCards); }}
          className="mt-6 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold cursor-pointer"
        >
          شروع دوباره
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">همهٔ کارت‌های این درس به‌وقت رسیده‌اند! 🎉</p>
        <button
          type="button"
          onClick={() => { setSelectedCourse('all'); }}
          className="mt-4 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold cursor-pointer"
        >
          مرور همهٔ دروس
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 my-4">
      {/* نوار بالای جلسه */}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>گام {sessionIdx + 1} از {sessionCards.length}</span>
        <span className="px-2.5 py-0.5 rounded-md bg-blue-600/10 text-blue-600 dark:text-blue-300 font-bold">
          {courseInfo?.title ?? 'فلش‌کارت'}
        </span>
      </div>

      {/* کارت فلش */}
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm cursor-pointer select-none min-h-[220px] flex flex-col justify-center transition-all ${flipped ? 'border-blue-400 dark:border-blue-600' : ''}`}
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFlipped((f) => !f); }}
      >
        <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
          <Layers className="w-3 h-3" />
          {current.type === 'term' ? 'اصطلاح' : current.type === 'formula' ? 'فرمول' : current.type === 'comparison' ? 'مقایسه' : current.type === 'question' ? 'پرسش' : 'مفهوم'}
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span>{current.difficulty === 'basic' ? 'پایه' : current.difficulty === 'intermediate' ? 'متوسط' : 'پیشرفته'}</span>
        </div>
        <div className="text-base font-bold text-slate-900 dark:text-white leading-7 text-right">
          {current.front}
        </div>
        {flipped && (
          <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="text-sm text-slate-800 dark:text-slate-200 leading-7 text-right">
              {current.back}
            </div>
            {current.extra && (
              <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-5 text-right">
                💡 {current.extra}
              </div>
            )}
            <div className="mt-2 text-[10px] text-slate-400 text-left" dir="ltr">
              {current.source}
            </div>
          </div>
        )}
        {!flipped && (
          <div className="mt-6 flex items-center justify-center text-xs text-slate-400 gap-1">
            <RotateCw className="w-3 h-3" />
            <span>برای دیدن پاسخ کلیک کنید</span>
          </div>
        )}
      </div>

      {/* نوار پیشرفت */}
      <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${((sessionIdx + 1) / sessionCards.length) * 100}%` }} />
      </div>

      {/* ناحیهٔ امتیازدهی (فقط پس از flip) */}
      {flipped ? (
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(RATING_LABELS) as unknown as Rating[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRate(r)}
              className={`py-2.5 rounded-xl text-white text-xs font-bold transition-colors cursor-pointer ${RATING_LABELS[r].color}`}
            >
              {RATING_LABELS[r].label}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setFlipped(true)}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold cursor-pointer"
        >
          نمایش پاسخ
        </button>
      )}
    </div>
  );
};
