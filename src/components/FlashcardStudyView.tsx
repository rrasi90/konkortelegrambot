/**
 * FlashcardStudyView — جلسهٔ مرور کارت‌ها.
 *
 * این نسخه سه چیز را به هم وصل می‌کند:
 * ۱) کارت‌های متنی پاک‌سازی‌شدهٔ انکی (۴۳۰ کارت قابل استفاده) به‌جای فقط ۷۵ کارت دستی.
 * ۲) کارت‌های شخصی local-first.
 * ۳) گزارش محتوا با اتصال به همان صف feedback ادمین.
 *
 * زمان‌بندی هر کارت در `ael.flashcard-schedule` می‌ماند؛ شکل داده عوض نشده است.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, CheckCircle2, ChevronDown, Flag, Layers, RotateCw, Undo2, Volume2,
} from 'lucide-react';
import { FLASHCARD_COURSES } from '../data/flashcards';
import {
  ANKI_STUDY_CARDS,
  AUTHORED_STUDY_CARDS,
  DECK_STATS,
  STUDY_MODES,
  buildStudyDeck,
  isTypedAnswerCorrect,
  type CardLayer,
  type StudyCard,
} from '../data/flashcardDeck';
import {
  loadUserFlashcards,
  userFlashcardsToStudyCards,
  USER_FLASHCARDS_EVENT,
} from '../utils/userFlashcards';
import {
  REPORT_REASON_LABELS,
  sendContentReport,
  type ReportReason,
} from '../lib/feedbackApi';
import { loadStudySettings } from '../utils/studySettings';
import {
  DEFAULT_SCHEDULE,
  loadCardSchedules,
  saveCardSchedules,
  updateCardSchedule,
  type CardSchedule,
  type FlashcardRating,
} from '../utils/flashcardSchedule';
import { buildFlashcardQueue, type FlashcardSessionMode } from '../utils/flashcardQueue';
import { appendReviewLog, removeReviewLogById } from '../utils/reviewLog';
import {
  answerForMode,
  buildChoiceOptions,
  expectedForMode,
  isChoiceMode,
  isTypedMode,
  promptForMode,
} from '../utils/studyModes';
import { toFaDigits } from '../utils/persianDigits';
import {
  appendRepeatedCard,
  removeLastRepeatedCard,
  shouldRepeatCard,
} from '../utils/flashcardSession';

type SessionMode = FlashcardSessionMode;
type RatingStats = { again: number; hard: number; good: number; easy: number };
type SessionLogItem = { cardId: string; courseTitle: string; rating: FlashcardRating; seconds: number };

const REVIEW_REASON_HINTS: Record<string, string> = {
  concept_gap: 'این کارت از یک خطای مفهومی ساخته شده است. پیش از پاسخ، تعریف و مرز مفهوم را بازگو کن.',
  prerequisite_failure: 'این خطا به پیش‌نیاز مربوط است. ابتدا پیش‌نیاز را مرور کن، بعد به این پرسش برگرد.',
  misread: 'این خطا از بدخوانی بوده است. این بار شرط اصلی صورت پرسش را با دقت مشخص کن.',
  slip: 'این خطا بی‌دقتی بوده است. پاسخ را می‌دانی؛ فقط گزینه‌ها را آرام‌تر بخوان.',
};

const RATING_LABELS: Record<FlashcardRating, { label: string; className: string }> = {
  1: { label: 'دوباره', className: 'bg-rose-600 hover:bg-rose-500' },
  2: { label: 'سخت', className: 'bg-amber-600 hover:bg-amber-500' },
  3: { label: 'خوب', className: 'bg-emerald-600 hover:bg-emerald-500' },
  4: { label: 'آسان', className: 'bg-sky-600 hover:bg-sky-500' },
};

function loadDeck(): StudyCard[] {
  const userCards = userFlashcardsToStudyCards(
    loadUserFlashcards(),
    (courseId) => FLASHCARD_COURSES.find((course) => course.id === courseId)?.title ?? 'کارت شخصی',
  );
  return buildStudyDeck(userCards);
}

export const FlashcardStudyView: React.FC<{
  onOpenLessonNode?: (nodeId: string) => void;
  onExit?: () => void;
}> = ({ onOpenLessonNode, onExit }) => {
  const [schedules, setSchedules] = useState<Record<string, CardSchedule>>(() => loadCardSchedules());
  const schedulesRef = useRef(schedules);
  const [deck, setDeck] = useState<StudyCard[]>(() => loadDeck());
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [layerFilter, setLayerFilter] = useState<'all' | CardLayer>('all');
  const [mode, setMode] = useState<SessionMode>('reveal');
  const [sessionCards, setSessionCards] = useState<StudyCard[]>([]);
  const [sessionIdx, setSessionIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [typed, setTyped] = useState('');
  const [typedResult, setTypedResult] = useState<boolean | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [freeRecall, setFreeRecall] = useState('');
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [speechUnavailable, setSpeechUnavailable] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [dueTotal, setDueTotal] = useState(0);
  const [stats, setStats] = useState<RatingStats>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [repeatCounts, setRepeatCounts] = useState<Record<string, number>>({});
  const [sessionLog, setSessionLog] = useState<SessionLogItem[]>([]);
  const [lastRating, setLastRating] = useState<{
    cardId: string;
    index: number;
    previous: CardSchedule;
    previousStats: RatingStats;
    repeated: boolean;
    logId: string | null;
  } | null>(null);
  const cardStartedAtRef = useRef(Date.now());
  const [reviewCap] = useState(() => loadStudySettings().reviewCap);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('wrong_science');
  const [reportNote, setReportNote] = useState('');
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    const refresh = () => setDeck(loadDeck());
    window.addEventListener(USER_FLASHCARDS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(USER_FLASHCARDS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of FLASHCARD_COURSES) map.set(course.id, course.title);
    for (const card of deck) if (!map.has(card.courseId)) map.set(card.courseId, card.courseTitle);
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [deck]);

  const buildQueue = useCallback(() => {
    return buildFlashcardQueue(deck, schedulesRef.current, {
      courseId: selectedCourse,
      layer: layerFilter,
      mode,
      cap: reviewCap,
    });
  }, [deck, layerFilter, mode, selectedCourse, reviewCap]);

  useEffect(() => {
    const queue = buildQueue();
    setSessionCards(queue.cards);
    setDueTotal(queue.total);
    setSessionIdx(0);
    setFlipped(false);
    setTyped('');
    setTypedResult(null);
    setSelectedChoice(null);
    setFreeRecall('');
    setConfidence(null);
    setSpeechUnavailable(false);
    setSessionDone(queue.cards.length === 0);
    setStats({ again: 0, hard: 0, good: 0, easy: 0 });
    setRepeatCounts({});
    setSessionLog([]);
    setLastRating(null);
    cardStartedAtRef.current = Date.now();
    setReportOpen(false);
    setReportState('idle');
  }, [buildQueue]);

  const current = sessionCards[sessionIdx];

  const handleRate = useCallback((rating: FlashcardRating) => {
    if (sessionIdx >= sessionCards.length) return;
    const card = sessionCards[sessionIdx];
    if (!card) return;
    const previous = schedules[card.id] ?? DEFAULT_SCHEDULE;
    const next = updateCardSchedule(previous, rating);
    const nextSchedules = { ...schedules, [card.id]: next };
    const seconds = Math.max(1, Math.round((Date.now() - cardStartedAtRef.current) / 1000));
    const ratingKey = rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy';
    const nextStats: RatingStats = { ...stats, [ratingKey]: stats[ratingKey] + 1 };
    // «دوباره» در همان جلسه برمی‌گردد؛ حداکثر دو بار برای هر کارت.
    const repeated = shouldRepeatCard(rating, repeatCounts[card.id] ?? 0);
    const nextCards = appendRepeatedCard(sessionCards, card, repeated);

    schedulesRef.current = nextSchedules;
    setSchedules(nextSchedules);
    saveCardSchedules(nextSchedules);
    setStats(nextStats);
    setSessionLog((prev) => [...prev, { cardId: card.id, courseTitle: card.courseTitle, rating, seconds }]);
    const logEntry = appendReviewLog({
      cardId: card.id,
      source: 'flashcard',
      at: new Date().toISOString(),
      rating,
      durationMs: seconds * 1000,
      courseId: card.courseId,
      courseTitle: card.courseTitle,
      nodeId: card.nodeId,
      mode,
      ...(confidence ? { confidence } : {}),
      intervalDays: next.interval,
      previousIntervalDays: previous.interval,
    });
    setLastRating({ cardId: card.id, index: sessionIdx, previous, previousStats: stats, repeated, logId: logEntry?.id ?? null });
    if (repeated) {
      setRepeatCounts((prev) => ({ ...prev, [card.id]: (prev[card.id] ?? 0) + 1 }));
    }
    setFlipped(false);
    setTyped('');
    setTypedResult(null);
    setSelectedChoice(null);
    setFreeRecall('');
    setConfidence(null);
    setSpeechUnavailable(false);
    setReportOpen(false);
    cardStartedAtRef.current = Date.now();
    setSessionCards(nextCards);
    if (sessionIdx + 1 >= nextCards.length) setSessionDone(true);
    else setSessionIdx((index) => index + 1);
  }, [mode, repeatCounts, schedules, sessionCards, sessionIdx, stats]);

  const undoLastRating = () => {
    if (!lastRating) return;
    const { cardId, index, previous, previousStats, repeated, logId } = lastRating;
    const nextSchedules = { ...schedules, [cardId]: previous };
    schedulesRef.current = nextSchedules;
    setSchedules(nextSchedules);
    saveCardSchedules(nextSchedules);
    setStats(previousStats);
    setSessionLog((prev) => prev.slice(0, -1));
    if (logId) removeReviewLogById(logId);
    if (repeated) {
      setSessionCards((prev) => removeLastRepeatedCard(prev, cardId));
      setRepeatCounts((prev) => ({ ...prev, [cardId]: Math.max(0, (prev[cardId] ?? 1) - 1) }));
    }
    setSessionIdx(index);
    setSessionDone(false);
    setFlipped(false);
    setTyped('');
    setTypedResult(null);
    setSelectedChoice(null);
    setFreeRecall('');
    setConfidence(null);
    setSpeechUnavailable(false);
    setLastRating(null);
    cardStartedAtRef.current = Date.now();
  };

  const prompt = current ? promptForMode(current, mode) : '';
  const expected = current ? expectedForMode(current, mode) : '';
  const answer = current ? answerForMode(current, mode) : '';
  const choiceOptions = useMemo(
    () => current && isChoiceMode(mode)
      ? buildChoiceOptions(current, deck, mode === 'term_choice' ? 'front' : 'back')
      : [],
    [current, deck, mode],
  );

  useEffect(() => {
    setSelectedChoice(null);
    setFreeRecall('');
    setConfidence(null);
    setSpeechUnavailable(false);
  }, [current?.id, mode]);

  const handleTypedSubmit = () => {
    if (!current) return;
    setTypedResult(isTypedAnswerCorrect(expected, typed));
    setFlipped(true);
  };

  const handleChoice = (value: string) => {
    setSelectedChoice(value);
    setFlipped(true);
  };

  const handleSpeak = () => {
    if (!current || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeechUnavailable(true);
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(prompt);
      utterance.lang = 'fa-IR';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeechUnavailable(true);
    }
  };

  const handleReport = async () => {
    if (!current) return;
    setReportState('sending');
    try {
      await sendContentReport({
        contentType: 'card',
        contentId: current.id,
        reason: reportReason,
        details: reportNote,
      });
      setReportState('sent');
      setReportNote('');
    } catch {
      setReportState('error');
    }
  };

  const restart = () => {
    const queue = buildQueue();
    setSessionCards(queue.cards);
    setDueTotal(queue.total);
    setSessionIdx(0);
    setFlipped(false);
    setTyped('');
    setTypedResult(null);
    setSelectedChoice(null);
    setFreeRecall('');
    setConfidence(null);
    setSpeechUnavailable(false);
    setSessionDone(queue.cards.length === 0);
    setStats({ again: 0, hard: 0, good: 0, easy: 0 });
    setRepeatCounts({});
    setSessionLog([]);
    setLastRating(null);
    cardStartedAtRef.current = Date.now();
  };

  const repeatsSoFar = Object.values(repeatCounts).reduce((sum, value) => sum + value, 0);
  const remainingDue = Math.max(0, dueTotal - (sessionCards.length - repeatsSoFar));
  const ratedCount = sessionLog.length;
  const retention = ratedCount
    ? Math.round((sessionLog.filter((item) => item.rating > 1).length / ratedCount) * 100)
    : 0;
  const avgSeconds = ratedCount
    ? Math.round(sessionLog.reduce((sum, item) => sum + item.seconds, 0) / ratedCount)
    : 0;
  const hardestCourse = useMemo(() => {
    const byCourse = new Map<string, number>();
    for (const item of sessionLog) {
      if (item.rating <= 2) byCourse.set(item.courseTitle, (byCourse.get(item.courseTitle) ?? 0) + 1);
    }
    return [...byCourse.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [sessionLog]);

  const answerFooter = current ? (
    <>
      {current.extra && (
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-6 text-right">{current.extra}</div>
      )}
      <div className="mt-2 text-[10px] text-slate-400 text-left" dir="auto">{current.source}</div>
      {current.nodeId && onOpenLessonNode && (
        <button
          type="button"
          onClick={() => onOpenLessonNode(current.nodeId!)}
          className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" /> درسنامهٔ این مبحث
        </button>
      )}
    </>
  ) : null;

  if (sessionDone) {
    return (
      <div className="max-w-xl mx-auto border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 rounded-2xl p-8 text-center my-8">
        <CheckCircle2 className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {sessionCards.length === 0 ? 'کارت سررسیدی نیست' : 'کارنامهٔ مرور'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-6">
          {sessionCards.length === 0
            ? 'برای این فیلتر کارتی نمانده است. فیلتر را عوض کن یا کارت شخصی بساز.'
            : `${toFaDigits(ratedCount)} مرور ثبت شد · دوباره: ${toFaDigits(stats.again)} · سخت: ${toFaDigits(stats.hard)} · خوب: ${toFaDigits(stats.good)} · آسان: ${toFaDigits(stats.easy)}`}
        </p>
        {ratedCount > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3">
              <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{toFaDigits(retention)}٪</div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">نگهداشت این جلسه</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3">
              <div className="text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">{toFaDigits(avgSeconds)} ثانیه</div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">میانگین هر کارت</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3">
              <div className="truncate text-sm font-bold text-amber-700 dark:text-amber-300">{hardestCourse ?? 'ندارد'}</div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">دشوارترین درس</div>
            </div>
          </div>
        )}
        {remainingDue > 0 && (
          <p className="mt-3 text-xs leading-6 text-amber-700 dark:text-amber-300">
            {toFaDigits(remainingDue)} کارت دیگر سررسید است؛ برای اینکه مرور به یک نشست طولانی تبدیل نشود، به جلسهٔ بعد سپرده شد.
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={restart}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer"
          >
            {remainingDue > 0 ? 'جلسهٔ بعدی' : 'جلسهٔ تازه'}
          </button>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold cursor-pointer"
            >
              بازگشت به میز کار
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">کارتی برای نمایش پیدا نشد.</p>
        <button
          type="button"
          onClick={() => { setSelectedCourse('all'); setLayerFilter('all'); }}
          className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer"
        >
          پاک‌کردن فیلتر
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-3 my-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {toFaDigits(deck.length)} کارت · {toFaDigits(ANKI_STUDY_CARDS.length)} از انکی · {toFaDigits(AUTHORED_STUDY_CARDS.length)} دستی
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
            {toFaDigits(DECK_STATS.quarantinedImages)} تصویری قرنطینه
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            درس
            <select
              value={selectedCourse}
              onChange={(event) => setSelectedCourse(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="all">همه</option>
              {courseOptions.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            لایه
            <select
              value={layerFilter}
              onChange={(event) => setLayerFilter(event.target.value as 'all' | CardLayer)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="all">همه</option>
              <option value="L1">L1</option>
              <option value="L2">L2</option>
              <option value="L3">L3</option>
            </select>
          </label>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            حالت
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as SessionMode)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              {(['main', 'more'] as const).map((group) => (
                <optgroup key={group} label={group === 'main' ? 'حالت‌های اصلی' : 'بیشتر'}>
                  {STUDY_MODES.filter((item) => item.group === group).map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
          {STUDY_MODES.find((item) => item.id === mode)?.hint}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>گام {toFaDigits(sessionIdx + 1)} از {toFaDigits(sessionCards.length)}</span>
        <span className="flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-bold text-slate-600 dark:text-slate-300">
          <Layers className="w-3 h-3" /> {current.courseTitle}
        </span>
      </div>

      <div
        className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm min-h-[240px] flex flex-col justify-center ${flipped ? 'border-emerald-400 dark:border-emerald-600' : 'border-slate-200/80 dark:border-slate-800/80'}`}
      >
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-bold">{current.layer}</span>
          <span>{current.tags.includes('مرور خطا') ? 'مرور خطا' : current.origin === 'anki' ? 'انکی' : current.origin === 'user' ? 'کارت شخصی' : 'دستی'}</span>
          <span>·</span>
          <span>{current.type === 'term' ? 'اصطلاح' : current.type === 'formula' ? 'فرمول' : current.type === 'comparison' ? 'مقایسه' : current.type === 'question' ? 'پرسش' : 'مفهوم'}</span>
          <span>·</span>
          <span>{current.difficulty === 'basic' ? 'پایه' : current.difficulty === 'intermediate' ? 'متوسط' : 'پیشرفته'}</span>
        </div>

        {current.reviewReason && REVIEW_REASON_HINTS[current.reviewReason] && (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm leading-7 text-amber-800 dark:text-amber-200">
            {REVIEW_REASON_HINTS[current.reviewReason]}
          </div>
        )}

        {isTypedMode(mode) ? (
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {mode === 'type'
                ? 'اصطلاح مناسب برای این تعریف چیست؟'
                : mode === 'reverse'
                  ? 'صورت پرسش این پاسخ چیست؟'
                  : mode === 'cloze'
                    ? 'واژهٔ حذف‌شده چیست؟'
                    : 'پاسخ یا قدم اول را بنویس.'}
            </div>
            <div className="text-base font-semibold leading-8 text-slate-900 dark:text-white whitespace-pre-line">{prompt}</div>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleTypedSubmit(); }}
              placeholder="پاسخ را تایپ کن"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-base text-slate-900 dark:text-slate-100"
            />
            {!flipped && (
              <button
                type="button"
                onClick={handleTypedSubmit}
                disabled={!typed.trim()}
                className="w-full rounded-xl bg-emerald-600 disabled:opacity-40 px-4 py-3 text-sm font-bold text-white cursor-pointer"
              >
                بررسی پاسخ
              </button>
            )}
            {typedResult !== null && (
              <div className={`rounded-xl border px-3 py-2 text-sm leading-6 ${typedResult ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}>
                {typedResult ? 'درست بود.' : 'پاسخ درست:'} {!typedResult && <strong>{expected}</strong>}
              </div>
            )}
            {flipped && answerFooter}
          </div>
        ) : isChoiceMode(mode) ? (
          <div className="space-y-3">
            <div className="text-base font-semibold leading-8 text-slate-900 dark:text-white whitespace-pre-line">{prompt}</div>
            <div className="grid grid-cols-1 gap-2">
              {choiceOptions.map((option, index) => (
                <button
                  key={`${option}-${index}`}
                  type="button"
                  onClick={() => handleChoice(option)}
                  disabled={flipped}
                  className={`min-h-[44px] rounded-xl border px-3 py-2 text-right text-sm leading-6 cursor-pointer ${
                    flipped && option === expected
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : flipped && option === selectedChoice
                        ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {toFaDigits(index + 1)}) {option}
                </button>
              ))}
            </div>
            {flipped && (
              <div className={`rounded-xl border px-3 py-2 text-sm leading-6 ${selectedChoice === expected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}>
                {selectedChoice === expected ? 'درست بود.' : `پاسخ درست: ${expected}`}
              </div>
            )}
            {flipped && answerFooter}
          </div>
        ) : (
          <>
            <div className="text-base font-bold text-slate-900 dark:text-white leading-8 text-right whitespace-pre-line">
              {mode === 'self'
                ? 'با صدای بلند توضیح بده؛ بعد پاسخ را ببین.'
                : mode === 'scenario'
                  ? 'این مفهوم را در یک موقعیت واقعی توضیح بده؛ بعد پاسخ را ببین.'
                  : prompt}
            </div>
            {(mode === 'self' || mode === 'scenario') && !flipped && (
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{current.front}</div>
            )}
            {mode === 'audio' && !flipped && (
              <button
                type="button"
                onClick={handleSpeak}
                className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" /> شنیدن صورت پرسش
              </button>
            )}
            {speechUnavailable && (
              <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                صدای مرورگر در این دستگاه در دسترس نیست؛ صورت پرسش را بخوان و ادامه بده.
              </p>
            )}
            {mode === 'free_recall' && !flipped && (
              <textarea
                value={freeRecall}
                onChange={(event) => setFreeRecall(event.target.value)}
                rows={4}
                placeholder="هرچه از این مبحث می‌دانی بنویس."
                className="mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-base leading-7 text-slate-900 dark:text-slate-100"
              />
            )}
            {flipped && (
              <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                <div className="text-base text-slate-800 dark:text-slate-200 leading-8 text-right whitespace-pre-line">{answer}</div>
                {mode === 'free_recall' && freeRecall.trim() && (
                  <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs leading-6 text-slate-500 dark:text-slate-300">
                    نوشتهٔ تو: {freeRecall}
                  </div>
                )}
                {mode === 'confidence' && (
                  <div className="mt-3">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">چقدر مطمئن بودی؟</div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {([1, 2, 3] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setConfidence(value)}
                          className={`min-h-[44px] rounded-lg border px-2 py-2 text-xs font-bold cursor-pointer ${confidence === value ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                        >
                          {value === 1 ? 'حدس' : value === 2 ? 'نسبتاً مطمئن' : 'مطمئن'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {answerFooter}
              </div>
            )}
            {!flipped && (
              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="mt-6 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" /> {mode === 'free_recall' ? 'دیدن پاسخ' : 'نمایش پاسخ'}
              </button>
            )}
          </>
        )}
      </div>

      <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${((sessionIdx + 1) / sessionCards.length) * 100}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>این جلسه {toFaDigits(sessionCards.length)} کارت دارد.</span>
        <span>{remainingDue > 0 ? `${toFaDigits(remainingDue)} کارت برای جلسهٔ بعد` : 'صف امروز کامل است'}</span>
      </div>

      {flipped ? (
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(RATING_LABELS) as unknown as FlashcardRating[]).map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => handleRate(rating)}
              className={`py-3 rounded-xl text-white text-xs font-bold transition-colors cursor-pointer ${RATING_LABELS[rating].className}`}
            >
              {RATING_LABELS[rating].label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setReportOpen((open) => !open); setReportState('idle'); }}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" /> گزارش اشکال
          </button>
          {lastRating && (
            <button
              type="button"
              onClick={undoLastRating}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" /> واگرد آخرین امتیاز
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={restart}
          className="flex min-h-[44px] items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5" /> شروع دوباره
        </button>
      </div>

      {reportOpen && (
        <div className="rounded-2xl border border-rose-500/20 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">گزارش این کارت</div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setReportReason(reason)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer ${reportReason === reason ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                {REPORT_REASON_LABELS[reason]}
              </button>
            ))}
          </div>
          <textarea
            value={reportNote}
            onChange={(event) => setReportNote(event.target.value)}
            rows={2}
            placeholder="توضیح اختیاری"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleReport}
            disabled={reportState === 'sending'}
            className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-4 py-2.5 text-xs font-bold text-white cursor-pointer"
          >
            {reportState === 'sending' ? 'در حال ارسال…' : 'ارسال به ادمین'}
          </button>
          {reportState === 'sent' && <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">گزارش ثبت شد و در صف ادمین است.</div>}
          {reportState === 'error' && <div className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">ارسال نشد؛ اتصال را بررسی کن.</div>}
        </div>
      )}
    </div>
  );
};
