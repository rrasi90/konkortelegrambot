/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import {
  createZeroStateEngine,
  hydrateAndReconcileSavedState,
  evaluateAnswerAndRipple,
  rollbackSlipPenalty,
  calculateROIRankings,
  applyPlacementResults,
  applyLessonUnderstandingRating,
  analyzeMultiYearExamFrequency,
  classifyNodeCourseCategory,
  getNodeEffectiveBranchCoefficient,
  getMultiBranchEffectiveCoefficient,
  initFSRS,
  ReviewCard,
  LearnerSixDState,
  UserStats,
  MultiYearFrequencyInsight,
} from './engine/aelEngine';
import {
  INITIAL_KNOWLEDGE_NODES,
  INITIAL_NODE_DEPENDENCIES,
  INITIAL_INTERACTIVE_LESSONS,
  INITIAL_QUESTION_BANK,
  KnowledgeNode,
  NodeDependency,
  InteractiveLesson,
  QuestionItem,
} from './data/konkorData';
import {
  initTelegramMiniApp,
  syncTelegramBackButton,
  setTelegramClosingConfirmation,
  parseTelegramStartParam,
  saveStateToTelegramStorage,
  loadStateFromTelegramStorage,
  loadLatestStateFromTelegramStorage,
  clearTelegramZeroStateStorage,
  tmaHaptic,
} from './utils/telegramBridge';
import { DashboardView } from './components/DashboardView';
import { StudySessionView } from './components/StudySessionView';
import { gradeAnswerOnServer, GradingUnavailableError } from './lib/serverGrading';
import { LessonsLibraryView } from './components/LessonsLibraryView';
import { PlacementModal } from './components/PlacementModal';
import { OnboardingModal, OnboardingResult } from './components/OnboardingModal';
import { StudyPreferencesView } from './components/StudyPreferencesView';
import { queueMistakeReview } from './utils/mistakeReview';
import { countDueMistakeCards } from './utils/reviewToday';
import { toFaDigits } from './utils/persianDigits';
import { appendReviewLog } from './utils/reviewLog';
import {
  USER_FLASHCARDS_EVENT,
  removeMistakeReviewCard,
  setMistakeReviewCardReason,
  setMistakeReviewCardSuspended,
} from './utils/userFlashcards';
import { TelegramBotSimulatorModal } from './components/TelegramBotSimulatorModal';
import { YearlyKonkorExamView } from './components/YearlyKonkorExamView';
import { MistakeNotebookView } from './components/MistakeNotebookView';
import { SubjectDedicatedHubView } from './components/SubjectDedicatedHubView';
import { YEARLY_KONKOR_QUESTIONS, KonkorCourseSectionId } from './data/yearlyKonkorExams';
import {
  MistakeEntry,
  MistakeErrorType,
  loadMistakeNotebook,
  saveMistakeNotebook,
  upsertMistake,
  markMistakeResolved,
  setMistakeErrorType,
  removeMistake,
  clearResolvedMistakes,
} from './utils/mistakeNotebook';
import {
  Sun,
  Moon,
  Play,
  RotateCcw,
  Bot,
  Smartphone,
  Monitor,
  Home,
  BookOpen,
  Layers,
  Target,
  Award,
  BookMarked,
  MoreHorizontal,
  Sparkles,
  X,
} from 'lucide-react';

const SkillTreeGraph = lazy(() => import('./components/SkillTreeGraph').then((module) => ({ default: module.SkillTreeGraph })));
const ReviewBookView = lazy(() => import('./components/ReviewBookView').then((module) => ({ default: module.ReviewBookView })));
const CodePatchesView = lazy(() => import('./components/CodePatchesView').then((module) => ({ default: module.CodePatchesView })));

const ViewLoading: React.FC = () => (
  <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400" role="status">
    در حال بارگذاری…
  </div>
);

type ActiveTab =
  | 'home'
  | 'study'
  | 'exams'
  | 'map'
  | 'lessons'
  | 'subject_hub'
  | 'notebook'
  | 'patches'
  | 'flashcards'
  | 'preferences';

const LEGACY_PRACTICE_BANK = INITIAL_QUESTION_BANK.filter((question) => !question.isQuarantinedProof);

export default function App() {
  // بانک داده‌های پویا (قابلیت افزودن زنده مباحث جدید توسط کاربر یا ایجنت هوش مصنوعی)
  const [nodes, setNodes] = useState<KnowledgeNode[]>(INITIAL_KNOWLEDGE_NODES);
  const [dependencies, setDependencies] = useState<NodeDependency[]>(INITIAL_NODE_DEPENDENCIES);
  const [lessons, setLessons] = useState<Record<string, InteractiveLesson>>(
    INITIAL_INTERACTIVE_LESSONS
  );
  const [questions, setQuestions] = useState<QuestionItem[]>(LEGACY_PRACTICE_BANK);

  // شروع پیش‌فرض با وضعیت کاملاً صفر (Zero-State Onboarding) یا بازیابی و آشتی هوشمند از CloudStorage/LocalStorage تلگرام
  const initialEngineData = useMemo(() => {
    const saved = loadStateFromTelegramStorage();
    return hydrateAndReconcileSavedState(
      saved,
      INITIAL_KNOWLEDGE_NODES,
      LEGACY_PRACTICE_BANK,
      INITIAL_NODE_DEPENDENCIES
    );
  }, []);

  const [nodeStates, setNodeStates] = useState<Record<string, LearnerSixDState>>(
    initialEngineData.nodeStates
  );
  const [cards, setCards] = useState<ReviewCard[]>(initialEngineData.cards);
  const [stats, setStats] = useState<UserStats>(initialEngineData.stats);
  const [learnerStateHydrated, setLearnerStateHydrated] = useState(false);
  const [storageRecoveryNotice, setStorageRecoveryNotice] = useState<string | null>(null);
  const cloudNoticeShownRef = useRef(false);
  const resetDuringHydrationRef = useRef(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedExamYear, setSelectedExamYear] = useState<number>(1405);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = window.localStorage.getItem('ael.theme');
    return saved ? saved === 'dark' : true;
  });
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [isPlacementOpen, setIsPlacementOpen] = useState<boolean>(false);
  // onboarding داوطلب جدید: مقطع/گرایش + تاریخ آزمون (ذخیرهٔ محلی؛ کلید شمارش معکوس تا روز کنکور)
  const [onboarding, setOnboarding] = useState<OnboardingResult | null>(() => {
    try {
      const raw = window.localStorage.getItem('ael.onboarding');
      return raw ? (JSON.parse(raw) as OnboardingResult) : null;
    } catch {
      return null;
    }
  });
  const [isBotSimulatorOpen, setIsBotSimulatorOpen] = useState<boolean>(false);
  const [isTmaMobileFrame, setIsTmaMobileFrame] = useState<boolean>(false);
  const [isNightQuizMode, setIsNightQuizMode] = useState<boolean>(false);
  const [mistakeEntries, setMistakeEntries] = useState<MistakeEntry[]>(() =>
    loadMistakeNotebook()
  );
  const [sessionKey, setSessionKey] = useState<number>(0);
  const [dueMistakeCards, setDueMistakeCards] = useState<number>(0);
  const [pendingCardReview, setPendingCardReview] = useState<boolean>(false);
  const [dailyReviewFlow, setDailyReviewFlow] = useState<boolean>(false);
  const [customSessionQueue, setCustomSessionQueue] = useState<ReviewCard[] | null>(
    null
  );
  const [selectedLessonNodeId, setSelectedLessonNodeId] = useState<string | null>(
    'mb.structure'
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<KonkorCourseSectionId>('islamic');

  // بازیابی async از CloudStorage؛ تا پایان این مرحله autosave و تعامل آموزشی مسدود است.
  useEffect(() => {
    let cancelled = false;
    const fallbackPayload = {
      ...initialEngineData,
      savedAt: new Date(0).toISOString(),
    };
    void loadLatestStateFromTelegramStorage(fallbackPayload)
      .then((result) => {
        if (cancelled) return;
        if (!resetDuringHydrationRef.current) {
          const reconciled = hydrateAndReconcileSavedState(
            result.payload,
            INITIAL_KNOWLEDGE_NODES,
            LEGACY_PRACTICE_BANK,
            INITIAL_NODE_DEPENDENCIES,
          );
          setNodeStates(reconciled.nodeStates);
          setCards(reconciled.cards);
          setStats(reconciled.stats);
        }
        setStorageRecoveryNotice(result.warning ?? null);
        setLearnerStateHydrated(true);
      })
      .catch(() => {
        if (cancelled) return;
        setStorageRecoveryNotice(
          'بازیابی ذخیره انجام نشد؛ نسخهٔ موجود روی همین دستگاه حفظ شده است.',
        );
        setLearnerStateHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialEngineData]);

  // ۱. راه‌اندازی اولیه Telegram Mini-App SDK (disableVerticalSwipes + Theme)
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('ael.theme', isDark ? 'dark' : 'light');
    } catch {
      // ذخیرهٔ تم نباید تجربه را بشکند
    }
    initTelegramMiniApp(isDark);
  }, [isDark]);

  // ۲. فقط پس از پایان بازیابی، snapshot کامل ذخیره می‌شود تا Zero-State روی backup ننویسد.
  useEffect(() => {
    if (!learnerStateHydrated) return;
    void saveStateToTelegramStorage({
      nodeStates,
      cards,
      stats,
      savedAt: new Date().toISOString(),
    }).then((result) => {
      // نویزِ تکراری ممنوع: این وضعیت فقط یک‌بار در طول نشست اطلاع‌رسانی می‌شود
      if (!result.cloudSaved && result.error && !cloudNoticeShownRef.current) {
        cloudNoticeShownRef.current = true;
        setStorageRecoveryNotice(
          'پیشرفت شما روی همین دستگاه ذخیره شد ✓ (همگام‌سازی ابری این‌بار انجام نشد — مانع مطالعهٔ شما نیست.)',
        );
      }
    });
  }, [nodeStates, cards, stats, learnerStateHydrated]);

  // ۳. ذخیره‌سازی دفتر خطا در حافظه محلی تا پس از بستن برنامه هم باقی بماند
  useEffect(() => {
    saveMistakeNotebook(mistakeEntries);
  }, [mistakeEntries]);

  // کارت‌های خطای سررسید، بخشی از «مرور امروز» هستند.
  useEffect(() => {
    const refreshDue = () => setDueMistakeCards(countDueMistakeCards());
    refreshDue();
    window.addEventListener('ael:flashcard-schedule-changed', refreshDue);
    window.addEventListener(USER_FLASHCARDS_EVENT, refreshDue);
    window.addEventListener('storage', refreshDue);
    return () => {
      window.removeEventListener('ael:flashcard-schedule-changed', refreshDue);
      window.removeEventListener(USER_FLASHCARDS_EVENT, refreshDue);
      window.removeEventListener('storage', refreshDue);
    };
  }, []);

  // ۴. همگام‌سازی دکمه بازگشت بومی تلگرام (BackButton) و هشدار خروج در جلسه تست
  useEffect(() => {
    const shouldShowBack =
      activeTab !== 'home' || isPlacementOpen || isBotSimulatorOpen;

    syncTelegramBackButton(shouldShowBack, () => {
      tmaHaptic.impact('light');
      if (isBotSimulatorOpen) {
        setIsBotSimulatorOpen(false);
      } else if (isPlacementOpen) {
        setIsPlacementOpen(false);
      } else {
        setCustomSessionQueue(null);
        setActiveTab('home');
      }
    });

    setTelegramClosingConfirmation(activeTab === 'study');
  }, [activeTab, isPlacementOpen, isBotSimulatorOpen]);

  // تحلیل خودکار فصول پرتکرار در سال‌های مختلف کنکور (Multi-Year Exam Frequency Radar)
  const examFrequencyMap: Record<string, MultiYearFrequencyInsight> = useMemo(
    () => analyzeMultiYearExamFrequency(nodes, questions),
    [nodes, questions]
  );

  const examFrequencyList: MultiYearFrequencyInsight[] = useMemo(
    () => Object.values(examFrequencyMap),
    [examFrequencyMap]
  );

  // محاسبه رتبه‌بندی بودجه‌محور ROI برای تمام گره‌های فعال با لحاظ تکرار چندساله کنکور و مسیر شخصی کاربر
  const roiRankings = useMemo(
    () =>
      calculateROIRankings(nodeStates, stats.activeTracks, nodes, questions, {
        branch: stats.selectedMajorBranch || 'business',
        category: stats.preferredCourseCategory || 'all',
        dailyStudyHours: stats.dailyStudyHours || 4,
      }),
    [
      nodeStates,
      stats.activeTracks,
      stats.selectedMajorBranch,
      stats.selectedMajorBranches,
      stats.preferredCourseCategory,
      stats.dailyStudyHours,
      nodes,
      questions,
    ]
  );

  // ساخت صف روزانه هوشمند بر اساس مسیر شخصی داوطلب (تعداد تست روزانه، گرایش و نوع درس انتخابی)
  const dailyQueue = useMemo(() => {
    const branch = stats.selectedMajorBranch || 'business';
    const branches = stats.selectedMajorBranches ?? [];
    const category = stats.preferredCourseCategory || 'all';
    const targetCount = stats.dailyTargetQuestions || 20;

    const filteredCards = cards.filter((c) => {
      const node = nodes.find((n) => n.id === c.nodeId);
      if (!node) return true;
      // چندتخصصی: درسی در صف می‌ماند که در «حداقل یکی» از گرایش‌های انتخاب‌شده ضریب مؤثر داشته باشد
      if (branches.length > 0) {
        if (getMultiBranchEffectiveCoefficient(node, branches) === 0) return false;
      } else if (getNodeEffectiveBranchCoefficient(node, branch) === 0) return false;
      if (category !== 'all' && classifyNodeCourseCategory(node) !== category) {
        return false;
      }
      return true;
    });

    const pool = filteredCards.length > 0 ? filteredCards : cards;
    const sorted = [...pool].sort((a, b) => b.priorityScore - a.priorityScore);
    return sorted.slice(0, targetCount);
  }, [
    cards,
    nodes,
    stats.dailyTargetQuestions,
    stats.selectedMajorBranch,
    stats.selectedMajorBranches,
    stats.preferredCourseCategory,
  ]);

  const activeSessionQueue = customSessionQueue ?? dailyQueue;

  // ریست کامل رکوردها به وضعیت صفر (Zero-State) و پاکسازی CloudStorage
  const handleResetToZeroState = () => {
    resetDuringHydrationRef.current = true;
    void clearTelegramZeroStateStorage().catch(() => {
      setStorageRecoveryNotice('پاک‌سازی پشتیبان ابری کامل نشد؛ دوباره تلاش کنید.');
    });
    const fresh = createZeroStateEngine(nodes, questions);
    setNodeStates(fresh.nodeStates);
    setCards(fresh.cards);
    setStats(fresh.stats);
    setCustomSessionQueue(null);
  };

  // هندلر امتیازدهی ۱ تا ۵ به درسنامه و آپدیت زنده برنامه درسی
  const handleRateLessonUnderstanding = (
    nodeId: string,
    rating: 1 | 2 | 3 | 4 | 5
  ): string => {
    const res = applyLessonUnderstandingRating({
      nodeId,
      rating,
      nodeStates,
      cards,
      stats,
      nodes,
      dependencies,
      questions,
    });
    setNodeStates(res.nextNodeStates);
    setCards(res.nextCards);
    setStats(res.nextStats);
    return res.scheduleSummary;
  };

  // ثبت یک پاسخ غلط در دفتر خطا (یا حل‌شدن آن در صورت پاسخ صحیح بعدی)
  const recordAnswerInNotebook = (
    question: QuestionItem | undefined,
    selectedOption: number | null,
    wasCorrect: boolean,
    errorType: MistakeErrorType,
    reveal?: { correctOption: number; explanation: string; trapNote: string }
  ) => {
    if (!question) return;
    if (wasCorrect) {
      setMistakeEntries((prev) => markMistakeResolved(prev, question.id, true));
      // کارت مرور مشتق‌شده از این خطا هم از صف خارج می‌شود؛ منبع حقیقت دفتر خطاست.
      setMistakeReviewCardSuspended(question.id, true);
      return;
    }
    const node = nodes.find((n) => n.id === question.nodeId);
    if (!node) return;
    setMistakeEntries((prev) =>
      upsertMistake(prev, {
        questionId: question.id,
        nodeId: node.id,
        course: node.course,
        chapter: node.chapter,
        topic: node.topic,
        questionText: question.text,
        options: question.options,
        // R-036: کلید از reveal سرور می‌آید — هرگز از بانک کلاینت
        correctOption: reveal?.correctOption ?? -1,
        selectedOption,
        explanation: reveal?.explanation ?? '',
        trapNote: reveal?.trapNote ?? '',
        source:
          question.sourceReference ||
          question.designedFromTextbook ||
          node.sourceBookCitation,
        examYear: question.examYear,
        errorType,
      })
    );
  };

  // شروع جلسهٔ مرور از روی دفتر خطا یا سؤالات غلط یک جلسهٔ تازه
  const handleStartMistakeSession = (questionIds: string[]) => {
    const now = new Date();
    const queue: ReviewCard[] = questionIds
      .map((id) => questions.find((q) => q.id === id))
      .filter((q): q is QuestionItem => !!q && !q.isQuarantinedProof)
      .map((q) => ({
        id: `mistake.${q.id}`,
        nodeId: q.nodeId,
        cardType: 'question',
        questionId: q.id,
        dueAt: now.toISOString(),
        priorityScore: 100,
        attemptType: 'practice' as const,
        fsrs: initFSRS(now),
      }));

    if (queue.length === 0) return;
    setIsNightQuizMode(false);
    setDailyReviewFlow(false);
    setPendingCardReview(false);
    setCustomSessionQueue(queue);
    setSessionKey((prev) => prev + 1);
    setActiveTab('study');
  };

  // هندلر شروع جلسه روزانه استاندارد — سؤال‌ها و کارت‌های خطا یک جریان دارند.
  const handleStartDailySession = () => {
    tmaHaptic.impact('medium');
    const dueCards = countDueMistakeCards();
    setDueMistakeCards(dueCards);
    setIsNightQuizMode(false);
    if (dailyQueue.length === 0 && dueCards > 0) {
      setDailyReviewFlow(false);
      setPendingCardReview(false);
      setCustomSessionQueue(null);
      setActiveTab('flashcards');
      return;
    }
    setDailyReviewFlow(true);
    setPendingCardReview(dueCards > 0);
    // صف جلسه را در لحظه شروع «قفل» می‌کنیم؛ وگرنه با هر پاسخ،
    // اولویت‌ها دوباره محاسبه می‌شوند و کارت زیر دست کاربر عوض می‌شود.
    setCustomSessionQueue(dailyQueue);
    setSessionKey((prev) => prev + 1);
    setActiveTab('study');
  };

  const handleStartFlashcardReview = () => {
    setDailyReviewFlow(false);
    setPendingCardReview(false);
    setDueMistakeCards(countDueMistakeCards());
    setActiveTab('flashcards');
  };

  const handleRecordMistakeReason = (questionId: string, errorType: MistakeErrorType) => {
    setMistakeEntries((prev) => setMistakeErrorType(prev, questionId, errorType));
    if (
      errorType === 'concept_gap' ||
      errorType === 'prerequisite_failure' ||
      errorType === 'misread' ||
      errorType === 'slip'
    ) {
      setMistakeReviewCardReason(questionId, errorType);
    }
  };

  // هندلر شروع کوییز شبانه (Verification Mode)
  const handleStartNightQuiz = () => {
    const now = new Date();
    const weakestNodes = [...roiRankings].slice(0, 4).map((r) => r.node.id);
    const nightCards: ReviewCard[] = weakestNodes
      .map((nodeId): ReviewCard | null => {
        const q = questions.find(
          (item) => item.nodeId === nodeId && !item.isQuarantinedProof
        );
        if (!q) return null;
        return {
          id: `night.verify.${q.id}`,
          nodeId,
          cardType: 'question',
          questionId: q.id,
          dueAt: now.toISOString(),
          priorityScore: 95,
          attemptType: 'verification',
          fsrs: initFSRS(now),
        };
      })
      .filter((c): c is ReviewCard => c !== null);

    setIsNightQuizMode(true);
    setDailyReviewFlow(false);
    setPendingCardReview(false);
    setCustomSessionQueue(nightCards);
    setSessionKey((prev) => prev + 1);
    setActiveTab('study');
  };

  // هندلر شروع تمرین مستقیم از روی یک گره خاص در گراف دانش یا کتابخانه درسنامه
  const handleStartPracticeNode = (
    nodeId: string,
    mode: 'practice' | 'proof' | 'remedial'
  ) => {
    if (!nodes.some((node) => node.id === nodeId)) return;
    const now = new Date();
    if (mode === 'remedial') {
      const remCard: ReviewCard = {
        id: `direct.remedial.${nodeId}`,
        nodeId,
        cardType: 'remedial_lesson',
        dueAt: now.toISOString(),
        priorityScore: 99,
        attemptType: 'diagnostic',
        fsrs: initFSRS(now),
      };
      const nodeQuestions = questions
        .filter((q) => q.nodeId === nodeId && !q.isQuarantinedProof)
        .map((q) => ({
          id: `direct.q.${q.id}`,
          nodeId,
          cardType: 'question' as const,
          questionId: q.id,
          dueAt: now.toISOString(),
          priorityScore: 90,
          attemptType: 'practice' as const,
          fsrs: initFSRS(now),
        }));
      setIsNightQuizMode(false);
      setDailyReviewFlow(false);
      setPendingCardReview(false);
      setCustomSessionQueue([remCard, ...nodeQuestions]);
      setSessionKey((prev) => prev + 1);
      setActiveTab('study');
      return;
    }

    if (mode === 'proof') return; // Proof is only served by the authenticated Worker.

    const nodeQuestions = questions
      .filter((q) => q.nodeId === nodeId && !q.isQuarantinedProof)
      .map((q) => ({
        id: `direct.q.${q.id}`,
        nodeId,
        cardType: 'question' as const,
        questionId: q.id,
        dueAt: now.toISOString(),
        priorityScore: 92,
        attemptType: 'practice' as const,
        fsrs: initFSRS(now),
      }));

    if (nodeQuestions.length > 0) {
      setIsNightQuizMode(false);
      setDailyReviewFlow(false);
      setPendingCardReview(false);
      setCustomSessionQueue(nodeQuestions);
      setSessionKey((prev) => prev + 1);
      setActiveTab('study');
    }
  };

  const handleStartCoursePractice = (
    _subjectId: KonkorCourseSectionId,
    selectedQuestions: QuestionItem[]
  ) => {
    const now = new Date();
    const courseQueue: ReviewCard[] = selectedQuestions.map((q) => ({
      id: `course_practice_${q.id}`,
      nodeId: q.nodeId,
      cardType: 'question',
      questionId: q.id,
      dueAt: now.toISOString(),
      priorityScore: 95,
      attemptType: 'practice',
      fsrs: initFSRS(now),
    }));

    if (courseQueue.length > 0) {
      setIsNightQuizMode(false);
      setDailyReviewFlow(false);
      setPendingCardReview(false);
      setCustomSessionQueue(courseQueue);
      setSessionKey((prev) => prev + 1);
      setActiveTab('study');
    }
  };

  // ۴. پردازش Deep-Link تلگرام (?startapp=...) هنگام ورود از دکمه‌های شیشه‌ای ربات
  useEffect(() => {
    const cmd = parseTelegramStartParam();
    if (cmd.type === 'night_quiz') {
      handleStartNightQuiz();
    } else if (cmd.type === 'placement') {
      setIsPlacementOpen(true);
    } else if (cmd.type === 'zero_reset') {
      handleResetToZeroState();
    } else if (cmd.type === 'lesson') {
      setSelectedLessonNodeId(cmd.nodeId);
      setActiveTab('lessons');
    } else if (cmd.type === 'practice') {
      handleStartPracticeNode(cmd.nodeId, 'practice');
    } else if (cmd.type === 'proof') {
      handleStartPracticeNode(cmd.nodeId, 'proof');
    } else if (cmd.type === 'flashcards') {
      setActiveTab('flashcards');
    } else if (cmd.type === 'preferences') {
      setActiveTab('preferences');
    } else if (cmd.type === 'yearly_exams') {
      setActiveTab('exams');
    } else if (cmd.type === 'lessons') {
      setActiveTab('lessons');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col ambient-bento-bg text-slate-900 dark:text-slate-100 transition-colors pb-20 md:pb-0">
      {!learnerStateHydrated && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-6 text-center text-white backdrop-blur-sm"
        >
          <div className="max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-white/25 border-t-blue-400" />
            <p className="font-bold">در حال بازیابی پیشرفت شما</p>
            <p className="mt-2 text-sm text-slate-300">تا پایان بررسی نسخهٔ محلی و ابری، جلسهٔ آموزشی آغاز نمی‌شود.</p>
          </div>
        </div>
      )}
      {storageRecoveryNotice && learnerStateHydrated && (
        <div
          role="status"
          className="fixed top-14 left-4 right-4 z-[90] mx-auto max-w-md rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 shadow-lg dark:bg-amber-950 dark:text-amber-100"
        >
          {storageRecoveryNotice}
          <button
            type="button"
            onClick={() => setStorageRecoveryNotice(null)}
            className="mr-3 font-bold underline"
          >
            بستن
          </button>
        </div>
      )}
      {/* نوار بالای یکپارچه و مینیمال با افکت Glassmorphism */}
      <header className="sticky top-0 z-40 glass-header px-3 sm:px-6 md:px-8 py-2.5 sm:py-3 w-full">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-2 sm:gap-4 w-full">
          {/* برند سامانه */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              tmaHaptic.impact('light');
              setActiveTab('home');
            }}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-base font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-blue-700 text-white text-[11px] sm:text-[13px] font-bold flex items-center justify-center shrink-0">
              م
            </span>
            <span className="hidden sm:inline">سامانه جامع کنکور مدیریت</span>
            <span className="sm:hidden font-bold">آموزش کنکور</span>
          </a>

          {/* لینک‌های ناوبری اصلی */}
          <nav className="hidden md:flex items-center gap-5 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
            {[
              { id: 'home', label: 'میز کار' },
              { id: 'subject_hub', label: 'مطالعه درس‌به‌درس' },
              { id: 'study', label: 'جلسه تست' },
              { id: 'exams', label: 'کنکورهای ۱۳۹۱ تا ۱۴۰۵' },
              { id: 'map', label: 'درخت مهارت' },
              { id: 'lessons', label: 'درسنامه‌ها و منابع' },
              { id: 'notebook', label: 'دفتر خطا' },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  tmaHaptic.selection();
                  setActiveTab(item.id as ActiveTab);
                }}
                className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                  activeTab === item.id
                    ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 font-bold'
                    : 'border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* ابزارهای کنترلی ضروری و دکمه اصلی */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                tmaHaptic.impact('medium');
                setIsBotSimulatorOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs font-bold text-sky-600 dark:text-sky-300 flex items-center gap-1.5 hover:bg-sky-500/20 transition-colors cursor-pointer"
              title="پیش‌نمایش ربات تلگرام (@KonkorAELBot)"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ربات تلگرام</span>
            </button>

            <button
              type="button"
              onClick={() => {
                tmaHaptic.selection();
                setIsTmaMobileFrame((prev) => !prev);
              }}
              className={`p-1.5 rounded-xl border text-xs hidden sm:flex items-center justify-center transition-colors cursor-pointer ${
                isTmaMobileFrame
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500'
              }`}
              title={
                isTmaMobileFrame
                  ? 'بازگشت به نمای عریض دسکتاپ'
                  : 'پیش‌نمایش قاب موبایل مینی‌اپ تلگرام'
              }
            >
              {isTmaMobileFrame ? (
                <Monitor className="w-4 h-4" />
              ) : (
                <Smartphone className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500 transition-colors cursor-pointer"
              title={isDark ? 'تم روشن' : 'تم تاریک'}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            <button
              type="button"
              onClick={handleStartDailySession}
              className="px-2.5 sm:px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              <span className="hidden sm:inline">مرور امروز</span>
              <span className="sm:hidden">مرور</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (Supports both Full Width and 430px Telegram Mini-App Frame Mode) */}
      <main
        className={`flex-1 w-full min-w-0 mx-auto transition-all duration-200 overflow-x-hidden ${
          isTmaMobileFrame
            ? 'max-w-[440px] my-4 border-4 border-slate-800 dark:border-slate-700 rounded-[24px] shadow-2xl overflow-hidden bg-slate-50 dark:bg-[#12100d] px-3.5 py-4'
            : 'max-w-[1240px] px-2.5 sm:px-6 md:px-8 py-3 sm:py-6'
        }`}
      >
        {/* نوار بالای اختصاصی در حالت پیش‌نمایش قاب موبایل مینی‌اپ تلگرام */}
        {isTmaMobileFrame && (
          <div className="mb-4 pb-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {activeTab !== 'home' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('home')}
                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
                >
                  ← بازگشت
                </button>
              )}
              <span className="font-bold text-slate-900 dark:text-white">
                مینی‌اپ کنکور مدیریت
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsTmaMobileFrame(false)}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 cursor-pointer"
            >
              نمای دسکتاپ
            </button>
          </div>
        )}

        {activeTab === 'home' && (
          <DashboardView
            examDate={onboarding?.examDate ?? null}
            onExamDateChange={(iso) => {
              const next = onboarding ? { ...onboarding, examDate: iso } : null;
              setOnboarding(next);
              try { window.localStorage.setItem('ael.onboarding', JSON.stringify(next)); } catch { /* ignore */ }
            }}
            nodes={nodes}
            stats={stats}
            nodeStates={nodeStates}
            queue={dailyQueue}
            dueMistakeCards={dueMistakeCards}
            onStartFlashcardReview={handleStartFlashcardReview}
            roiRankings={roiRankings}
            examFrequencyList={examFrequencyList}
            onStartDailySession={handleStartDailySession}
            onStartNightQuiz={handleStartNightQuiz}
            onOpenPlacementModal={() => setIsPlacementOpen(true)}
            onOpenTelegramBotSimulator={() => setIsBotSimulatorOpen(true)}
            onOpenYearlyExam={(year) => {
              if (year) setSelectedExamYear(year);
              setActiveTab('exams');
            }}
            onChangeStudyMode={(mode) => {
              const mappedTarget = mode === 'desk' ? 20 : mode === 'commute' ? 10 : 5;
              setStats((prev) => ({
                ...prev,
                studyMode: mode,
                dailyTargetQuestions: mappedTarget,
              }));
            }}
            onUpdateStudyPreferences={(prefs) =>
              setStats((prev) => ({
                ...prev,
                ...prefs,
              }))
            }
            onToggleTrack={(track) => {
              if (track === 'common') return;
              setStats((prev) => {
                const exists = prev.activeTracks.includes(track);
                const nextTracks = exists
                  ? prev.activeTracks.filter((t) => t !== track)
                  : [...prev.activeTracks, track];
                return { ...prev, activeTracks: nextTracks };
              });
            }}
            onUseStreakFreeze={() =>
              setStats((prev) => ({
                ...prev,
                streakFreezeUsedToday: true,
                streakFreezeAvailable: false,
              }))
            }
            onStartPracticeNode={handleStartPracticeNode}
            onOpenLessonNode={(nodeId) => {
              setSelectedLessonNodeId(nodeId);
              setActiveTab('lessons');
            }}
            onNavigateTab={(t) => setActiveTab(t)}
            onSelectSubject={(subjId) => {
              setSelectedSubjectId(subjId);
              setActiveTab('subject_hub');
            }}
            onResetToZeroState={handleResetToZeroState}
          />
        )}

        {activeTab === 'study' && (
          <StudySessionView
            key={sessionKey}
            nodes={nodes}
            lessons={lessons}
            questions={questions}
            queue={activeSessionQueue}
            nodeStates={nodeStates}
            examFrequencyMap={examFrequencyMap}
            isNightQuiz={isNightQuizMode}
            onSubmitAnswer={async ({
              card,
              selectedOption,
              confidence,
              responseTimeMs,
            }) => {
              // R-036: تصحیح فقط سمت سرور؛ کلید هرگز از باندل نمی‌آید
              const reveal = card.questionId
                ? await gradeAnswerOnServer(card.questionId, selectedOption ?? -1)
                : undefined;

              const result = evaluateAnswerAndRipple({
                card,
                selectedOption,
                confidence,
                responseTimeMs,
                grading: { wasCorrect: reveal?.wasCorrect ?? false, trapNote: reveal?.trapNote ?? '' },
                nodeStates,
                cards,
                stats,
                isNightVerification: isNightQuizMode,
                nodes,
                dependencies,
                questions,
                lessons,
              });
              setNodeStates(result.nextNodeStates);
              setCards(result.nextCards);
              setStats(result.nextStats);

              // ثبت پاسخ در دفتر خطا با reveal سرور (پاسخ صحیح، خطای قبلی همان سؤال را حل‌شده می‌کند)
              const answeredQuestion = card.questionId
                ? questions.find((q) => q.id === card.questionId)
                : undefined;
              const reviewCard = answeredQuestion && reveal && !result.report.wasCorrect && !result.report.wasSkipped
                ? queueMistakeReview(answeredQuestion, selectedOption, reveal)
                : null;
              // اگر در «مرور امروز» کارت تازه ساخته شد، همان جریان امروز آن را نشان می‌دهد.
              if (dailyReviewFlow && reviewCard?.queued) {
                setPendingCardReview(true);
                setDueMistakeCards(countDueMistakeCards());
              }
              recordAnswerInNotebook(
                answeredQuestion,
                selectedOption,
                result.report.wasCorrect,
                result.report.errorType as MistakeErrorType,
                reveal
              );
              const answeredNode = nodes.find((item) => item.id === card.nodeId);
              appendReviewLog({
                cardId: card.id,
                source: 'question',
                at: new Date().toISOString(),
                result: result.report.wasSkipped
                  ? 'skipped'
                  : result.report.wasCorrect
                    ? 'correct'
                    : 'wrong',
                durationMs: responseTimeMs,
                courseId: answeredNode?.course ?? '',
                courseTitle: answeredNode?.course ?? '',
                nodeId: card.nodeId,
              });

              if (customSessionQueue && result.report.spawnedCards.length > 0) {
                const newReviewCards = result.nextCards.filter((nc) =>
                  result.report.spawnedCards.some((sc) => sc.id === nc.id)
                );
                setCustomSessionQueue((prev) =>
                  prev ? [...prev, ...newReviewCards] : null
                );
              }

              return { report: result.report, snapshot: result.snapshot, reveal, reviewCard };
            }}
            onRollbackSlip={(snapshot, report) => {
              const restored = rollbackSlipPenalty(snapshot, report);
              setNodeStates(restored.restoredNodeStates);
              setCards(restored.restoredCards);
              setStats(restored.restoredStats);
              setMistakeEntries((prev) =>
                prev.map((entry) =>
                  entry.questionId === report.questionId
                    ? { ...entry, errorType: 'slip' as MistakeErrorType }
                    : entry
                )
              );
              return restored.updatedReport;
            }}
            onRateLessonInSession={handleRateLessonUnderstanding}
            onDismissNonQuestionCard={(cardId) => {
              setCards((prev) => prev.filter((card) => card.id !== cardId));
            }}
            onExitSession={() => {
              setCustomSessionQueue(null);
              setDailyReviewFlow(false);
              if (pendingCardReview) {
                setPendingCardReview(false);
                setDueMistakeCards(countDueMistakeCards());
                setActiveTab('flashcards');
              } else {
                setActiveTab('home');
              }
            }}
            onOpenLessonNode={(nodeId) => {
              setSelectedLessonNodeId(nodeId);
              setActiveTab('lessons');
            }}
            onOpenMistakeNotebook={() => setActiveTab('notebook')}
            onRestartMistakes={handleStartMistakeSession}
            onRecordMistakeReason={handleRecordMistakeReason}
            nextSegmentLabel={
              pendingCardReview
                ? `${toFaDigits(dueMistakeCards)} کارت خطا در صف مرور`
                : undefined
            }
          />
        )}

        {activeTab === 'notebook' && (
          <MistakeNotebookView
            entries={mistakeEntries}
            nodes={nodes}
            onStartMistakeSession={handleStartMistakeSession}
            onOpenLessonNode={(nodeId) => {
              setSelectedLessonNodeId(nodeId);
              setActiveTab('lessons');
            }}
            onToggleResolved={(questionId, resolved) => {
              setMistakeEntries((prev) =>
                markMistakeResolved(prev, questionId, resolved)
              );
              setMistakeReviewCardSuspended(questionId, resolved);
            }}
            onRemove={(questionId) => {
              setMistakeEntries((prev) => removeMistake(prev, questionId));
              removeMistakeReviewCard(questionId);
            }}
            onClearResolved={() => {
              const resolvedIds = mistakeEntries
                .filter((entry) => entry.resolved)
                .map((entry) => entry.questionId);
              resolvedIds.forEach((questionId) => removeMistakeReviewCard(questionId));
              setMistakeEntries((prev) => clearResolvedMistakes(prev));
            }}
          />
        )}

        {activeTab === 'map' && (
          <Suspense fallback={<ViewLoading />}>
            <SkillTreeGraph
              nodes={nodes}
              dependencies={dependencies}
              questions={questions}
              lessons={lessons}
              nodeStates={nodeStates}
              roiRankings={roiRankings}
              examFrequencyMap={examFrequencyMap}
              onStartPracticeNode={handleStartPracticeNode}
              onOpenLessonNode={(nodeId) => {
                setSelectedLessonNodeId(nodeId);
                setActiveTab('lessons');
              }}
            />
          </Suspense>
        )}

        {activeTab === 'lessons' && (
          <LessonsLibraryView
            nodes={nodes}
            lessons={lessons}
            questions={questions}
            nodeStates={nodeStates}
            examFrequencyMap={examFrequencyMap}
            initialSelectedNodeId={selectedLessonNodeId}
            onStartPracticeNode={handleStartPracticeNode}
            onRateLessonUnderstanding={handleRateLessonUnderstanding}
          />
        )}

        {activeTab === 'exams' && (
          <YearlyKonkorExamView
            nodes={nodes}
            lessons={lessons}
            selectedBranch={stats.selectedMajorBranch || 'business'}
            initialYear={selectedExamYear}
            onChangeBranch={(branch) =>
              setStats((prev) => ({
                ...prev,
                selectedMajorBranch: branch,
              }))
            }
            onRecordMistakeReason={handleRecordMistakeReason}
            onRecordQuestionAttempt={(question, selectedOption) => {
              if (question.isQuarantinedProof || !nodes.some((node) => node.id === question.nodeId) ||
                  !questions.some((item) => item.id === question.id && item.nodeId === question.nodeId && !item.isQuarantinedProof)) return;
              void (async () => {
              // R-036: تصحیح سرور-محور
              void gradeAnswerOnServer(question.id, selectedOption).then((reveal) => {
              return reveal; }).then(async (reveal) => {
              const targetCard: ReviewCard = cards.find(
                (card) => card.questionId === question.id && card.nodeId === question.nodeId &&
                  card.cardType === 'question' && card.attemptType !== 'proof'
              ) ?? {
                id: `card.q.${question.id}`,
                nodeId: question.nodeId,
                cardType: 'question',
                questionId: question.id,
                dueAt: new Date().toISOString(),
                priorityScore: 92,
                attemptType: 'practice',
                fsrs: initFSRS(new Date()),
              };

              const result = evaluateAnswerAndRipple({
                card: targetCard,
                selectedOption,
                confidence: 'high',
                responseTimeMs: question.expectedTimeMs || 45000,
                grading: { wasCorrect: reveal?.wasCorrect ?? false, trapNote: reveal?.trapNote ?? '' },
                nodeStates,
                cards,
                stats,
                isNightVerification: false,
                nodes,
                dependencies,
                questions,
                lessons,
              });
              setNodeStates(result.nextNodeStates);
              setCards(result.nextCards);
              setStats(result.nextStats);
              recordAnswerInNotebook(
                question,
                selectedOption,
                result.report.wasCorrect,
                result.report.errorType as MistakeErrorType,
                reveal
              );
              });
              })();
            }}
            onStartYearAdaptiveSession={(year, sectionId) => {
              const now = new Date();
              const filtered = YEARLY_KONKOR_QUESTIONS.filter((q) => {
                if (q.examYear !== year || q.isQuarantinedProof) return false;
                if (sectionId !== 'all' && q.courseSectionId !== sectionId) return false;
                return true;
              }).sort((a, b) => a.bookletQuestionNumber - b.bookletQuestionNumber);

              const yearQueue: ReviewCard[] = filtered.map((q) => ({
                id: `year.${year}.q.${q.id}`,
                nodeId: q.nodeId,
                cardType: 'question',
                questionId: q.id,
                dueAt: now.toISOString(),
                priorityScore: 95,
                attemptType: 'practice',
                fsrs: initFSRS(now),
              }));

              if (yearQueue.length > 0) {
                setIsNightQuizMode(false);
                setDailyReviewFlow(false);
                setPendingCardReview(false);
                setCustomSessionQueue(yearQueue);
                setSessionKey((prev) => prev + 1);
                setActiveTab('study');
              }
            }}
            onOpenLessonNode={(nodeId) => {
              setSelectedLessonNodeId(nodeId);
              setActiveTab('lessons');
            }}
          />
        )}

        {activeTab === 'subject_hub' && (
          <SubjectDedicatedHubView
            initialSubjectId={selectedSubjectId}
            nodes={nodes}
            lessons={lessons}
            questions={questions}
            yearlyQuestions={YEARLY_KONKOR_QUESTIONS}
            onStartCoursePractice={handleStartCoursePractice}
            onOpenLesson={(nodeId) => {
              setSelectedLessonNodeId(nodeId);
              setActiveTab('lessons');
            }}
            onRecordMistake={(q, opt) => recordAnswerInNotebook(q, opt, false, 'concept_gap')}
          />
        )}

        {activeTab === 'patches' && (
          <Suspense fallback={<ViewLoading />}>
            <CodePatchesView />
          </Suspense>
        )}

        {activeTab === 'flashcards' && (
          <Suspense fallback={<ViewLoading />}>
            <ReviewBookView
              onOpenLessonNode={(nodeId) => {
                setSelectedLessonNodeId(nodeId);
                setActiveTab('lessons');
              }}
              onExit={() => setActiveTab('home')}
            />
          </Suspense>
        )}

        {activeTab === 'preferences' && <StudyPreferencesView onboarding={onboarding} />}
      </main>

      {/* نوار ناوبری پایین موبایل — شناور Warm Charcoal (AEL Visual Language) */}
      <nav
        className={`${
          isTmaMobileFrame
            ? 'sticky bottom-[12px] max-w-[440px] mx-auto w-[calc(100%-24px)] rounded-[24px]'
            : 'fixed bottom-[12px] inset-x-[12px] md:hidden w-[calc(100%-24px)] max-w-[560px] mx-auto rounded-[24px]'
        } z-40 bg-[#262524]/92 dark:bg-[#262524]/92 backdrop-blur-xl border border-white/14 shadow-2xl px-2 py-2 pb-safe`}
      >
        <div className="grid grid-cols-5 gap-1">
          {[
            { id: 'home', label: 'میز کار', icon: Home },
            { id: 'study', label: 'جلسه تست', icon: Target },
            { id: 'exams', label: 'کنکورها', icon: Award },
            { id: 'lessons', label: 'درسنامه', icon: BookOpen },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  tmaHaptic.selection();
                  setIsMoreMenuOpen(false);
                  setActiveTab(item.id as ActiveTab);
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded-2xl text-[10px] font-medium transition-all active:scale-95 cursor-pointer min-h-[52px] ${
                  isActive
                    ? 'text-[#36c4bd] dark:text-[#36c4bd] font-bold bg-[#36c4bd]/13'
                    : 'text-slate-500 dark:text-[#b1b0b0]'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              tmaHaptic.selection();
              setIsMoreMenuOpen((prev) => !prev);
            }}
            aria-expanded={isMoreMenuOpen}
            aria-haspopup="menu"
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl text-[10px] font-medium transition-all active:scale-95 cursor-pointer min-h-[52px] ${
              ['subject_hub', 'map', 'notebook', 'patches', 'flashcards', 'preferences'].includes(activeTab)
                ? 'text-[#36c4bd] dark:text-[#36c4bd] font-bold bg-[#36c4bd]/13'
                : 'text-slate-500 dark:text-[#b1b0b0]'
            }`}
          >
            <MoreHorizontal className="w-4 h-4 mb-0.5" />
            <span>بیشتر</span>
          </button>
        </div>
      </nav>

      {/* ورقهٔ «بیشتر» برای مقاصد فرعی موبایل */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="مقاصد بیشتر">
          <button
            type="button"
            aria-label="بستن منو"
            onClick={() => setIsMoreMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/45"
          />
          <div className="absolute bottom-0 inset-x-0 bg-[#fffdf8] dark:bg-[#1a1815] border-t border-slate-200 dark:border-slate-800 rounded-t-2xl p-4 pb-safe space-y-1.5">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">مقاصد بیشتر</span>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                aria-label="بستن"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {[
              { id: 'subject_hub' as ActiveTab, label: 'مطالعه تفکیکی درس‌به‌درس', icon: Sparkles },
              { id: 'map' as ActiveTab, label: 'درخت مهارت و نقشه تسلط', icon: Layers },
              { id: 'notebook' as ActiveTab, label: 'دفتر خطا و مرور اشتباه‌ها', icon: BookMarked },
              { id: 'flashcards' as ActiveTab, label: 'مرور کتاب و فلش‌کارت', icon: Layers },
              { id: 'preferences' as ActiveTab, label: 'هدف دوم و یادآور', icon: Target },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setActiveTab(item.id);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-right text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* مودال شبیه‌ساز ربات تلگرام و کیبوردهای شیشه‌ای (@KonkorAELBot) */}
      {isBotSimulatorOpen && (
        <TelegramBotSimulatorModal
          nodes={nodes}
          lessons={lessons}
          questions={questions}
          nodeStates={nodeStates}
          stats={stats}
          examFrequencyList={examFrequencyList}
          onRateLessonFromBot={handleRateLessonUnderstanding}
          onTriggerDeepLink={(action) => {
            setIsBotSimulatorOpen(false);
            if (action.type === 'night_quiz') {
              handleStartNightQuiz();
            } else if (action.type === 'placement') {
              setIsPlacementOpen(true);
            } else if (action.type === 'zero_reset') {
              handleResetToZeroState();
            } else if (action.type === 'lesson' && action.nodeId) {
              setSelectedLessonNodeId(action.nodeId);
              setActiveTab('lessons');
            } else if (action.type === 'practice' && action.nodeId) {
              handleStartPracticeNode(action.nodeId, 'practice');
            } else if (action.type === 'proof' && action.nodeId) {
              handleStartPracticeNode(action.nodeId, 'proof');
            }
          }}
          onClose={() => setIsBotSimulatorOpen(false)}
        />
      )}

      {/* مودال آزمون تعیین سطح تطبیقی اولیه */}
      {isPlacementOpen && (
        <PlacementModal
          onCompletePlacement={(results) => {
            const { updatedStates, deltas } = applyPlacementResults(
              results,
              nodeStates,
              nodes,
              dependencies,
              questions
            );
            setNodeStates(updatedStates);
            setStats((prev) => ({
              ...prev,
              isZeroStateNewUser: false,
              placementCompleted: true,
              coins: prev.coins + 30,
              xp: prev.xp + 50,
            }));
            return deltas;
          }}
          onClose={() => setIsPlacementOpen(false)}
        />
      )}

      {/* مودال خوش‌آمد داوطلب جدید: مقطع + تاریخ آزمون (شمارش معکوس تا روز کنکور) */}
      {!onboarding && learnerStateHydrated && (
        <OnboardingModal
          onComplete={(r) => {
            setOnboarding(r);
            try {
              window.localStorage.setItem('ael.onboarding', JSON.stringify(r));
            } catch {
              /* ذخیرهٔ onboarding نباید تجربه را بشکند */
            }
            // گرایش‌های انتخاب‌شده را به stats اعمال کن — تعیین سطح اختیاری است
            setStats((prev) => ({
              ...prev,
              selectedMajorBranch: r.track,
              selectedMajorBranches: r.tracks ?? [],
            }));
          }}
        />
      )}

      {/* Footer مینیمال */}
      <footer className="hidden md:block border-t border-slate-200/70 dark:border-slate-800/80 py-4 px-4 sm:px-8 mt-12 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-[1240px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <span>
            سامانه یادگیری کنکور ارشد و دکتری مدیریت — بازرگانی، صنعتی، فناوری
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleResetToZeroState}
              className="hover:text-rose-500 transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی پیشرفت (Zero-State)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('patches')}
              className="hover:text-blue-500 transition-colors cursor-pointer"
            >
              مستندات فنی و کد ربات
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
