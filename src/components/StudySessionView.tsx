import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  KnowledgeNode,
  QuestionItem,
  InteractiveLesson,
  COMPARISON_TABLES,
} from '../data/konkorData';
import {
  ReviewCard,
  LearnerSixDState,
  RippleReport,
  SnapshotForRollback,
  MultiYearFrequencyInsight,
  findLegacyCardQuestion,
} from '../engine/aelEngine';
import { MathText } from './MathText';
import { SessionReport } from './SessionReportView';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Scale,
  ShieldAlert,
  MinusCircle,
  Star,
  Flame,
  Target,
  HelpCircle,
} from 'lucide-react';

interface StudySessionViewProps {
  queue: ReviewCard[];
  nodes: KnowledgeNode[];
  questions: QuestionItem[];
  lessons: Record<string, InteractiveLesson>;
  nodeStates: Record<string, LearnerSixDState>;
  examFrequencyMap: Record<string, MultiYearFrequencyInsight>;
  isNightQuiz?: boolean;
  onSubmitAnswer: (params: {
    card: ReviewCard;
    selectedOption: number | null;
    confidence: 'high' | 'low';
    responseTimeMs: number;
  }) => { report: RippleReport; snapshot: SnapshotForRollback };
  onRollbackSlip: (snapshot: SnapshotForRollback, report: RippleReport) => RippleReport;
  onRateLessonInSession: (nodeId: string, rating: 1 | 2 | 3 | 4 | 5) => string;
  onDismissNonQuestionCard: (cardId: string) => void;
  onExitSession: () => void;
  onOpenLessonNode: (nodeId: string) => void;
  onOpenMistakeNotebook: () => void;
  onRestartMistakes: (questionIds: string[]) => void;
}

interface SessionAnswerResult {
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


export const StudySessionView: React.FC<StudySessionViewProps> = ({
  queue,
  nodes,
  questions,
  lessons,
  examFrequencyMap,
  isNightQuiz = false,
  onSubmitAnswer,
  onRollbackSlip,
  onRateLessonInSession,
  onDismissNonQuestionCard,
  onExitSession,
  onOpenLessonNode,
  onOpenMistakeNotebook,
  onRestartMistakes,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionResults, setSessionResults] = useState<SessionAnswerResult[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [confidence, setConfidence] = useState<'high' | 'low'>('high');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [activeReport, setActiveReport] = useState<RippleReport | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState<SnapshotForRollback | null>(null);
  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [conceptCheckChoice, setConceptCheckChoice] = useState<number | null>(null);
  const [lessonRatingChosen, setLessonRatingChosen] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [lessonRatingMsg, setLessonRatingMsg] = useState<string | null>(null);

  const currentCard = queue[currentIndex];

  useEffect(() => {
    setSelectedOption(null);
    setActiveReport(null);
    setActiveSnapshot(null);
    setLessonDrawerOpen(false);
    setConceptCheckChoice(null);
    setLessonRatingChosen(null);
    setLessonRatingMsg(null);
    setElapsedSeconds(0);
  }, [currentIndex, currentCard?.id]);

  useEffect(() => {
    if (activeReport || !currentCard) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeReport, currentCard]);

  if (isFinished) {
    return (
      <SessionReport
        results={sessionResults}
        totalCards={queue.length}
        nodes={nodes}
        onOpenLessonNode={onOpenLessonNode}
        onOpenMistakeNotebook={onOpenMistakeNotebook}
        onRestartMistakes={onRestartMistakes}
        onExitSession={onExitSession}
      />
    );
  }

  if (!currentCard || currentIndex >= queue.length) {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-8 text-center shadow-xs my-8">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          مرور این نوبت کامل شد!
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          نتایج پاسخ‌های شما و زمان‌بندی مرورهای بعدی در پروفایل تسلط ثبت شد.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onOpenMistakeNotebook}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-colors cursor-pointer"
          >
            مرور دفتر خطا
          </button>
          <button
            type="button"
            onClick={onExitSession}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors cursor-pointer"
          >
            بازگشت به میز کار
          </button>
        </div>
      </div>
    );
  }

  const node = nodes.find((item) => item.id === currentCard.nodeId);
  const question = findLegacyCardQuestion(currentCard, questions);
  const requiresQuestion = currentCard.cardType !== 'remedial_lesson' && currentCard.cardType !== 'comparison_card';
  if (!node || (requiresQuestion && !question)) {
    return (
      <div role="status" className="bento-card glass-panel p-5 space-y-3">
        <p>این فعالیت در این نسخه در دسترس نیست.</p>
        <button type="button" onClick={() => setCurrentIndex((index) => index + 1)}>فعالیت بعدی</button>
        <button type="button" onClick={onExitSession}>بازگشت به میز کار</button>
      </div>
    );
  }
  const lesson = lessons[node.id];
  const freqInsight = examFrequencyMap[node.id];
  const compTable =
    (currentCard.comparisonId &&
      Object.values(COMPARISON_TABLES).find((c) => c.id === currentCard.comparisonId)) ||
    COMPARISON_TABLES[node.id] ||
    COMPARISON_TABLES['sm.rbv'];

  const handleAnswerSubmit = (choice: number | null) => {
    if (activeReport) return;
    setSelectedOption(choice);

    const { report, snapshot } = onSubmitAnswer({
      card: currentCard,
      selectedOption: choice,
      confidence,
      responseTimeMs: elapsedSeconds * 1000,
    });

    setActiveReport(report);
    setActiveSnapshot(snapshot);

    if (
      currentCard.cardType === 'question' ||
      currentCard.cardType === 'diagnostic_probe' ||
      currentCard.cardType === 'proof_1404'
    ) {
      setSessionResults((prev) => [
        ...prev,
        {
          cardId: currentCard.id,
          nodeId: node.id,
          course: node.course,
          topic: node.topic,
          questionId: report.questionId,
          wasCorrect: report.wasCorrect,
          wasSkipped: report.wasSkipped,
          errorType: report.errorType,
          seconds: elapsedSeconds,
        },
      ]);
    }

    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred(report.wasCorrect ? 'success' : 'error');
    }

    if (
      report.wasCorrect &&
      (currentCard.cardType === 'proof_1404' ||
        currentCard.attemptType === 'proof' ||
        report.topicDelta.after >= 85)
    ) {
      try {
        confetti({
          particleCount: 65,
          spread: 60,
          origin: { y: 0.65 },
        });
      } catch {
        // ignore
      }
    }
  };

  const handleSlipRollback = () => {
    if (!activeSnapshot || !activeReport || !activeReport.canRollbackAsSlip) return;
    const restoredReport = onRollbackSlip(activeSnapshot, activeReport);
    setActiveReport(restoredReport);
    setSessionResults((prev) =>
      prev.map((r) =>
        r.questionId === restoredReport.questionId
          ? { ...r, errorType: 'slip', wasCorrect: false }
          : r
      )
    );
  };

  const handleNextCard = () => {
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const getCardTypeHeader = () => {
    switch (currentCard.cardType) {
      case 'proof_1404':
        return {
          title: 'تست تثبیت تسلط کنکور',
          tone: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30',
        };
      case 'diagnostic_probe':
        return {
          title: 'تست سنجش پیش‌نیاز',
          tone: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30',
        };
      case 'remedial_lesson':
        return {
          title: 'درسنامه گام‌به‌گام مبحث',
          tone: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
        };
      case 'comparison_card':
        return {
          title: 'مقایسه دو مفهوم مشابه',
          tone: 'text-purple-700 dark:text-purple-300 bg-purple-500/10 border-purple-500/30',
        };
      case 'trap_note':
        return {
          title: 'دام پرتکرار طراح کنکور',
          tone: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30',
        };
      default:
        return {
          title: isNightQuiz ? 'کوییز مرور شبانه' : 'تست کنکور',
          tone: 'text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/30',
        };
    }
  };

  const badge = getCardTypeHeader();

  return (
    <div className="w-full max-w-3xl mx-auto pb-24 min-w-0">
      {/* ۱. هدر جلسه با نوار پیشرفت */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 mb-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">
              گام {currentIndex + 1} از {queue.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>{node.course}</span>
            <span aria-hidden="true">·</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{node.topic}</span>
            {freqInsight?.isHighYieldCritical && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{freqInsight.appearanceCount} دوره تکرار</span>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>
                {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:
                {String(elapsedSeconds % 60).padStart(2, '0')}
              </span>
            </div>
            <button
              type="button"
              onClick={onExitSession}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              پایان جلسه
            </button>
          </div>
        </div>

        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${queue.length}, minmax(0, 1fr))` }}
        >
          {queue.map((item, idx) => (
            <div
              key={item.id + idx}
              className={`h-1.5 rounded-full transition-all ${
                idx < currentIndex
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : idx === currentIndex
                  ? 'bg-blue-600 dark:bg-blue-400'
                  : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ۲. کارت درسنامه گام‌به‌گام تعاملی */}
      {currentCard.cardType === 'remedial_lesson' && lesson && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${badge.tone}`}>
              {badge.title}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              منبع: {node.sourceBookCitation}
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {lesson.topic}
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-7 whitespace-pre-line">
              <MathText text={lesson.summary} />
            </p>
          </div>

          {lesson.microSteps && lesson.microSteps.length > 0 && (
            <div className="space-y-2.5">
              {lesson.microSteps.map((step) => (
                <div
                  key={step.stepNumber}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                >
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {step.title}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-6 whitespace-pre-line">
                    <MathText text={step.content} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>نکات و دام‌های کنکوری:</span>
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-800 dark:text-slate-200 leading-6 list-disc list-inside">
              {lesson.konkoorTips.map((tip, i) => (
                <li key={i}>
                  <MathText text={tip} />
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              سنجش سریع مفهوم:
            </h4>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              <MathText text={lesson.conceptCheck.prompt} />
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {lesson.conceptCheck.options.map((opt, idx) => {
                const isChosen = conceptCheckChoice === idx;
                const isCorrect = idx === lesson.conceptCheck.correctIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setConceptCheckChoice(idx)}
                    className={`w-full text-right p-3.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      conceptCheckChoice === null
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-500'
                        : isCorrect
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                        : isChosen
                        ? 'bg-rose-500/15 border-rose-500 text-rose-900 dark:text-rose-200'
                        : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <span>
                      <MathText text={opt} />
                    </span>
                    {conceptCheckChoice !== null && isCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            {conceptCheckChoice !== null && (
              <div className="text-xs text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-200/70 dark:border-slate-700">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">توضیح: </span>
                <MathText text={lesson.conceptCheck.explanation} />
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/30 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>میزان تسلط خود بر این درسنامه را ثبت کنید:</span>
            </h4>
            <div className="grid grid-cols-5 gap-1 sm:gap-2">
              {([1, 2, 3, 4, 5] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setLessonRatingChosen(r);
                    const msg = onRateLessonInSession(node.id, r);
                    setLessonRatingMsg(msg);
                  }}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    lessonRatingChosen === r
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500'
                  }`}
                >
                  <div>{r} از ۵</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    {r === 1
                      ? 'نیاز به مرور'
                      : r === 2
                      ? 'ناقص'
                      : r === 3
                      ? 'متوسط'
                      : r === 4
                      ? 'خوب'
                      : 'عالی'}
                  </div>
                </button>
              ))}
            </div>
            {lessonRatingMsg && (
              <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium pt-1">
                ✓ {lessonRatingMsg}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={lessonRatingChosen === null}
              onClick={handleNextCard}
              className="px-6 py-2.5 rounded-xl bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-bold transition-colors cursor-pointer"
            >
              ادامه به گام بعدی ←
            </button>
          </div>
        </div>
      )}

      {/* ب) کارت مقایسه دو مفهوم متشابه */}
      {currentCard.cardType === 'comparison_card' && compTable && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${badge.tone}`}>
              {badge.title}
            </span>
            <Scale className="w-4 h-4 text-purple-500" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{compTable.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{compTable.subtitle}</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200">
                <tr>
                  <th className="p-3 font-bold border-l border-slate-200 dark:border-slate-700">
                    محور مقایسه
                  </th>
                  <th className="p-3 font-bold border-l border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-300">
                    {compTable.nodeA}
                  </th>
                  <th className="p-3 font-bold text-purple-700 dark:text-purple-300">
                    {compTable.nodeB}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {compTable.dimensions.map((row, idx) => (
                  <tr key={idx} className="bg-white dark:bg-slate-900/60">
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 border-l border-slate-200 dark:border-slate-800">
                      {row.criterion}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800 leading-6">
                      <MathText text={row.conceptA} />
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300 leading-6">
                      <MathText text={row.conceptB} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/25 text-xs text-slate-800 dark:text-slate-200 leading-6">
            <span className="font-bold text-purple-700 dark:text-purple-300">نکته کلیدی تفکیک در کنکور: </span>
            <MathText text={compTable.diagnosticTakeaway} />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                onDismissNonQuestionCard(currentCard.id);
                handleNextCard();
              }}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              مطالعه شد — کارت بعدی ←
            </button>
          </div>
        </div>
      )}

      {/* ج) کارت مرور دام طراح */}
      {currentCard.cardType === 'trap_note' && question && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${badge.tone}`}>
              {badge.title}
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>

          <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-300">
              دام تستی در مبحث «{node.topic}»
            </h3>
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-7">
              <MathText text={question.trapNote} />
            </p>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 leading-6">
            <span className="font-bold text-slate-800 dark:text-slate-200">پاسخ تشریحی تست مرجع: </span>
            <MathText text={question.explanation} />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                onDismissNonQuestionCard(currentCard.id);
                handleNextCard();
              }}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
            >
              متوجه شدم — گام بعدی ←
            </button>
          </div>
        </div>
      )}

      {/* د) کارت سؤال چهارگزینه‌ای */}
      {question && (currentCard.cardType === 'question' || currentCard.cardType === 'diagnostic_probe') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${badge.tone}`}>
              {badge.title}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {question.bookletQuestionNumber ? (
                <span className="px-2.5 py-0.5 rounded-md bg-blue-600/10 text-blue-700 dark:text-blue-300 font-bold tabular-nums">
                  سؤال {question.bookletQuestionNumber} دفترچه کنکور {question.examYear}
                </span>
              ) : (
                <span>کنکور {question.examYear}</span>
              )}
              {question.courseSectionTitle && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {question.courseSectionTitle}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* شناسنامه منبع طراحی سؤال */}
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="text-slate-800 dark:text-slate-200">منبع طرح سؤال:</strong>{' '}
              {question.designedFromTextbook || question.sourceReference || node.sourceBookCitation}
            </span>
            {question.designedFromTextbook && question.sourceReference && (
              <span className="text-[11px] text-slate-500">{question.sourceReference}</span>
            )}
          </div>

          {/* صورت سؤال */}
          <div className="text-base font-medium text-slate-900 dark:text-slate-100 leading-8">
            <MathText text={question.text} />
          </div>

          {/* نوار سنجش اطمینان پیش از پاسخ و دکمه نزده */}
          {!activeReport && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  اطمینان از پاسخ:
                </span>
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setConfidence('high')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                      confidence === 'high'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>مطمئنم</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfidence('low')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                      confidence === 'low'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>شک دارم</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAnswerSubmit(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MinusCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>نزده (بدون نمره منفی)</span>
              </button>
            </div>
          )}

          {/* گزینه‌ها */}
          <div className="space-y-2.5">
            {question.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrectOption = idx === question.correctOption;

              let optionStyle =
                'bg-slate-50/70 dark:bg-slate-800/45 border-slate-200/90 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-400 text-slate-800 dark:text-slate-200';

              if (activeReport) {
                if (isCorrectOption) {
                  optionStyle =
                    'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold';
                } else if (isSelected && !isCorrectOption) {
                  optionStyle =
                    'bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-100';
                } else {
                  optionStyle =
                    'bg-slate-50/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 text-slate-400 dark:text-slate-500';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!!activeReport}
                  onClick={() => handleAnswerSubmit(idx)}
                  className={`w-full text-right p-4 rounded-xl border text-sm leading-7 transition-all flex items-start justify-between gap-3 cursor-pointer disabled:cursor-default ${optionStyle}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                      {idx + 1}
                    </span>
                    <span>
                      <MathText text={opt} />
                    </span>
                  </div>

                  {activeReport && isCorrectOption && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-1" />
                  )}
                  {activeReport && isSelected && !isCorrectOption && (
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ۳. پنل بازخورد و پاسخ تشریحی یکپارچه */}
          {activeReport && (
            <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
              {/* وضعیت پاسخ و دکمه بی‌دقتی */}
              <div
                className={`p-4 rounded-xl border ${
                  activeReport.wasCorrect
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                    : activeReport.wasSkipped
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-950 dark:text-blue-100'
                    : activeReport.rolledBack
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    {activeReport.wasCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>پاسخ صحیح (+{activeReport.xpEarned} امتیاز)</span>
                      </>
                    ) : activeReport.wasSkipped ? (
                      <>
                        <MinusCircle className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>ثبت به عنوان نزده</span>
                      </>
                    ) : activeReport.rolledBack ? (
                      <>
                        <RotateCcw className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>ثبت به عنوان بی‌دقتی (جریمه بازگردانی شد)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>پاسخ نادرست</span>
                      </>
                    )}
                  </span>
                  <span className="text-xs font-mono tabular-nums font-bold">
                    تسلط این مبحث: {activeReport.masteryDeltas[0]?.before}٪ ←{' '}
                    {activeReport.masteryDeltas[0]?.after}٪
                  </span>
                </div>
                <p className="text-xs leading-6 opacity-95">{activeReport.mentorMessage}</p>

                {!activeReport.wasCorrect &&
                  !activeReport.wasSkipped &&
                  activeReport.canRollbackAsSlip && (
                    <div className="mt-3 pt-3 border-t border-rose-500/20 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs">
                        مفهوم را بلد بودید و فقط در خواندن گزینه دچار بی‌دقتی شدید؟
                      </span>
                      <button
                        type="button"
                        onClick={handleSlipRollback}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-slate-800 text-slate-900 dark:text-amber-300 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>ثبت به عنوان بی‌دقتی</span>
                      </button>
                    </div>
                  )}
              </div>

              {/* پاسخ تشریحی جامع مستخرج از منابع کنکور */}
              <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-4 text-xs leading-7">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70 dark:border-slate-700/70">
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>پاسخ تشریحی کامل (گزینه صحیح: گزینه {question.correctOption + 1})</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {question.designedFromTextbook || question.sourceReference || node.sourceBookCitation}
                  </span>
                </div>

                <div className="text-slate-800 dark:text-slate-200 leading-7 whitespace-pre-line">
                  <MathText text={question.explanation} />
                </div>

                {question.trapNote && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-950 dark:text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>دام طراح کنکور:</span>
                    </div>
                    <div className="leading-6">
                      <MathText text={question.trapNote} />
                    </div>
                  </div>
                )}
              </div>

              {/* کشوی بازشونده درسنامه و نکات مرجع مبحث */}
              {lesson && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setLessonDrawerOpen((prev) => !prev)}
                    className="w-full px-4 py-3 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                      <span>
                        مرور درسنامه و نکات کلیدی مبحث «{lesson.topic}»
                      </span>
                    </div>
                    {lessonDrawerOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {lessonDrawerOpen && (
                    <div className="p-4 bg-white dark:bg-slate-900 space-y-4 text-xs leading-7 text-slate-700 dark:text-slate-300">
                      <p className="whitespace-pre-line">
                        <MathText text={lesson.summary} />
                      </p>

                      {lesson.microSteps?.map((st) => (
                        <div
                          key={st.stepNumber}
                          className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800"
                        >
                          <div className="font-bold text-blue-600 dark:text-blue-400">
                            {st.title}
                          </div>
                          <div className="whitespace-pre-line mt-1">
                            <MathText text={st.content} />
                          </div>
                        </div>
                      ))}

                      <div className="p-3.5 rounded-xl bg-blue-600/10 border border-blue-500/30 space-y-2">
                        <div className="font-bold text-slate-900 dark:text-white">
                          تسلط شما بر این درسنامه (۱ تا ۵):
                        </div>
                        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                          {([1, 2, 3, 4, 5] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                setLessonRatingChosen(r);
                                const msg = onRateLessonInSession(node.id, r);
                                setLessonRatingMsg(msg);
                              }}
                              className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                lessonRatingChosen === r
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {r} از ۵
                            </button>
                          ))}
                        </div>
                        {lessonRatingMsg && (
                          <div className="text-emerald-700 dark:text-emerald-300 font-medium">
                            ✓ {lessonRatingMsg}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ۴. نوار چسبان پایین صفحه */}
      {activeReport && (
        <div className="fixed bottom-14 md:bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-3 px-4 shadow-lg">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {activeReport.spawnedCards.length > 0
                ? `${activeReport.spawnedCards.length} کارت تقویتی مرتبط به صف مرور اضافه شد`
                : `گام ${currentIndex + 1} از ${queue.length} تکمیل شد`}
            </div>
            <button
              type="button"
              onClick={handleNextCard}
              className="min-h-[40px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition-colors duration-200 shadow-xs shrink-0 cursor-pointer"
            >
              <span>سؤال بعدی</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
