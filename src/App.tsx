/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  initFSRS,
  ReviewCard,
  LearnerSixDState,
  UserStats,
  MultiYearFrequencyInsight,
  AgentContentPackage,
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
  clearTelegramZeroStateStorage,
  tmaHaptic,
} from './utils/telegramBridge';
import { DashboardView } from './components/DashboardView';
import { StudySessionView } from './components/StudySessionView';
import { SkillTreeGraph } from './components/SkillTreeGraph';
import { LessonsLibraryView } from './components/LessonsLibraryView';
import { PlacementModal } from './components/PlacementModal';
import { ContentIngestionStudio } from './components/ContentIngestionStudio';
import { CodePatchesView } from './components/CodePatchesView';
import { TelegramBotSimulatorModal } from './components/TelegramBotSimulatorModal';
import { YearlyKonkorExamView } from './components/YearlyKonkorExamView';
import { MistakeNotebookView } from './components/MistakeNotebookView';
import { YEARLY_KONKOR_QUESTIONS } from './data/yearlyKonkorExams';
import {
  MistakeEntry,
  MistakeErrorType,
  loadMistakeNotebook,
  saveMistakeNotebook,
  upsertMistake,
  markMistakeResolved,
  removeMistake,
  clearResolvedMistakes,
} from './utils/mistakeNotebook';
import {
  Sun,
  Moon,
  Play,
  RotateCcw,
  FilePlus2,
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
  X,
} from 'lucide-react';

type ActiveTab =
  | 'home'
  | 'study'
  | 'exams'
  | 'map'
  | 'lessons'
  | 'notebook'
  | 'ingest'
  | 'patches';

export default function App() {
  // بانک داده‌های پویا (قابلیت افزودن زنده مباحث جدید توسط کاربر یا ایجنت هوش مصنوعی)
  const [nodes, setNodes] = useState<KnowledgeNode[]>(INITIAL_KNOWLEDGE_NODES);
  const [dependencies, setDependencies] = useState<NodeDependency[]>(INITIAL_NODE_DEPENDENCIES);
  const [lessons, setLessons] = useState<Record<string, InteractiveLesson>>(
    INITIAL_INTERACTIVE_LESSONS
  );
  const [questions, setQuestions] = useState<QuestionItem[]>(INITIAL_QUESTION_BANK);

  // شروع پیش‌فرض با وضعیت کاملاً صفر (Zero-State Onboarding) یا بازیابی و آشتی هوشمند از CloudStorage/LocalStorage تلگرام
  const initialEngineData = useMemo(() => {
    const saved = loadStateFromTelegramStorage();
    return hydrateAndReconcileSavedState(
      saved,
      INITIAL_KNOWLEDGE_NODES,
      INITIAL_QUESTION_BANK,
      INITIAL_NODE_DEPENDENCIES
    );
  }, []);

  const [nodeStates, setNodeStates] = useState<Record<string, LearnerSixDState>>(
    initialEngineData.nodeStates
  );
  const [cards, setCards] = useState<ReviewCard[]>(initialEngineData.cards);
  const [stats, setStats] = useState<UserStats>(initialEngineData.stats);

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedExamYear, setSelectedExamYear] = useState<number>(1405);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = window.localStorage.getItem('ael.theme');
    return saved ? saved === 'dark' : true;
  });
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [isPlacementOpen, setIsPlacementOpen] = useState<boolean>(false);
  const [isBotSimulatorOpen, setIsBotSimulatorOpen] = useState<boolean>(false);
  const [isTmaMobileFrame, setIsTmaMobileFrame] = useState<boolean>(false);
  const [isNightQuizMode, setIsNightQuizMode] = useState<boolean>(false);
  const [mistakeEntries, setMistakeEntries] = useState<MistakeEntry[]>(() =>
    loadMistakeNotebook()
  );
  const [sessionKey, setSessionKey] = useState<number>(0);
  const [customSessionQueue, setCustomSessionQueue] = useState<ReviewCard[] | null>(
    null
  );
  const [selectedLessonNodeId, setSelectedLessonNodeId] = useState<string | null>(
    'mb.structure'
  );

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

  // ۲. ذخیره‌سازی خودکار وضعیت در CloudStorage / LocalStorage تلگرام
  useEffect(() => {
    saveStateToTelegramStorage({
      nodeStates,
      cards,
      stats,
      savedAt: new Date().toISOString(),
    });
  }, [nodeStates, cards, stats]);

  // ۳. ذخیره‌سازی دفتر خطا در حافظه محلی تا پس از بستن برنامه هم باقی بماند
  useEffect(() => {
    saveMistakeNotebook(mistakeEntries);
  }, [mistakeEntries]);

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
      stats.preferredCourseCategory,
      stats.dailyStudyHours,
      nodes,
      questions,
    ]
  );

  // ساخت صف روزانه هوشمند بر اساس مسیر شخصی داوطلب (تعداد تست روزانه، گرایش و نوع درس انتخابی)
  const dailyQueue = useMemo(() => {
    const branch = stats.selectedMajorBranch || 'business';
    const category = stats.preferredCourseCategory || 'all';
    const targetCount = stats.dailyTargetQuestions || 20;

    const filteredCards = cards.filter((c) => {
      const node = nodes.find((n) => n.id === c.nodeId);
      if (!node) return true;
      if (getNodeEffectiveBranchCoefficient(node, branch) === 0) return false;
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
    stats.preferredCourseCategory,
  ]);

  const activeSessionQueue = customSessionQueue ?? dailyQueue;

  // ریست کامل رکوردها به وضعیت صفر (Zero-State) و پاکسازی CloudStorage
  const handleResetToZeroState = () => {
    clearTelegramZeroStateStorage();
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
    errorType: MistakeErrorType
  ) => {
    if (!question) return;
    if (wasCorrect) {
      setMistakeEntries((prev) => markMistakeResolved(prev, question.id, true));
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
        correctOption: question.correctOption,
        selectedOption,
        explanation: question.explanation,
        trapNote: question.trapNote,
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
      .filter((q): q is QuestionItem => !!q)
      .map((q) => ({
        id: `mistake.${q.id}`,
        nodeId: q.nodeId,
        cardType: q.isQuarantinedProof ? 'proof_1404' : 'question',
        questionId: q.id,
        dueAt: now.toISOString(),
        priorityScore: 100,
        attemptType: 'practice' as const,
        fsrs: initFSRS(now),
      }));

    if (queue.length === 0) return;
    setIsNightQuizMode(false);
    setCustomSessionQueue(queue);
    setSessionKey((prev) => prev + 1);
    setActiveTab('study');
  };

  // هندلر ورود بسته محتوای جدید توسط ایجنت یا کاربر (با جلوگیری از ایجاد گره/سؤال تکراری)
  const handleIngestNewContentPackage = (pkg: AgentContentPackage) => {
    const targetLayer = pkg.node.layer ?? 1;
    const colInLayer = nodes.filter(
      (n) => n.graphPos.layer === targetLayer && n.id !== pkg.node.id
    ).length;

    const newNode: KnowledgeNode = {
      id: pkg.node.id,
      track: pkg.node.track,
      course: pkg.node.course,
      chapter: pkg.node.chapter,
      topic: pkg.node.topic,
      sourceBookCitation: pkg.node.sourceBookCitation,
      examYearsAppeared: pkg.node.examYearsAppeared,
      examCoefficient: pkg.node.examCoefficient || 5,
      historicalWeight: pkg.node.historicalWeight || 9,
      estimatedStudyHours: pkg.node.estimatedStudyHours || 2.5,
      graphPos: { layer: targetLayer, col: colInLayer },
      confusableWith: [],
    };

    const newDeps: NodeDependency[] = (pkg.node.prerequisiteNodeIds || []).map(
      (prereqId) => ({
        source: pkg.node.id,
        target: prereqId,
        relation: 'prerequisite',
        weight: 0.9,
        description: `پیش‌نیاز ثبت‌شده برای ${pkg.node.topic}`,
      })
    );

    const newLesson: InteractiveLesson = {
      nodeId: pkg.node.id,
      course: pkg.node.course,
      chapter: pkg.node.chapter,
      topic: pkg.node.topic,
      sourceBookCitation: pkg.node.sourceBookCitation,
      examYearsAppeared: pkg.node.examYearsAppeared,
      konkoorWeightLabel: `ضریب ${pkg.node.examCoefficient || 5} — افزوده‌شده`,
      frequencyLabel: `تکرار در ${pkg.node.examYearsAppeared.length} دوره کنکور`,
      summary: pkg.lesson.summary,
      microSteps: pkg.lesson.microSteps,
      conceptDescriptors: pkg.lesson.conceptDescriptors,
      konkoorTips: pkg.lesson.konkoorTips,
      keyTerms: pkg.lesson.keyTerms,
      conceptCheck: pkg.lesson.conceptCheck,
    };

    const newQuestions: QuestionItem[] = pkg.questions.map((q) => ({
      id: q.id,
      nodeId: pkg.node.id,
      examYear: q.examYear,
      sourceReference: q.sourceReference,
      isQuarantinedProof: q.isQuarantinedProof,
      text: q.text,
      options: q.options,
      correctOption: q.correctOption,
      explanation: q.explanation,
      trapNote: q.trapNote,
      expectedTimeMs: 45000,
    }));

    setNodes((prev) => [...prev.filter((n) => n.id !== newNode.id), newNode]);
    setDependencies((prev) => [
      ...prev.filter((d) => d.source !== pkg.node.id),
      ...newDeps,
    ]);
    setLessons((prev) => ({ ...prev, [pkg.node.id]: newLesson }));
    setQuestions((prev) => [
      ...prev.filter((q) => !newQuestions.some((nq) => nq.id === q.id)),
      ...newQuestions,
    ]);

    const now = new Date();
    const isUnlockedInFrontier =
      pkg.node.layer === 0 ||
      newDeps.every((d) => (nodeStates[d.target]?.masteryScore ?? 0) >= 45);

    setNodeStates((prev) => ({
      ...prev,
      [pkg.node.id]: prev[pkg.node.id] ?? {
        nodeId: pkg.node.id,
        masteryScore: 0,
        proficiencyProbability: 0,
        memoryStability: 0,
        retrievability: 0,
        speedFluency: 0,
        coverageStatus: 'unseen',
        evidenceCount: 0,
        isUnlockedInFrontier,
        hasLeechCard: false,
        rippleAlert: null,
      },
    }));

    const newCards: ReviewCard[] = [
      {
        id: `card.remedial.${pkg.node.id}`,
        nodeId: pkg.node.id,
        cardType: 'remedial_lesson',
        dueAt: now.toISOString(),
        priorityScore: 98,
        attemptType: 'practice',
        fsrs: initFSRS(now),
      },
      ...newQuestions
        .filter((q) => !q.isQuarantinedProof)
        .map((q) => ({
          id: `card.q.${q.id}`,
          nodeId: pkg.node.id,
          cardType: 'question' as const,
          questionId: q.id,
          dueAt: now.toISOString(),
          priorityScore: 91,
          attemptType: 'practice' as const,
          fsrs: initFSRS(now),
        })),
    ];

    setCards((prev) => [
      ...newCards,
      ...prev.filter((c) => !newCards.some((nc) => nc.id === c.id)),
    ]);
    setSelectedLessonNodeId(pkg.node.id);
    setActiveTab('lessons');
  };

  // هندلر شروع جلسه روزانه استاندارد
  const handleStartDailySession = () => {
    tmaHaptic.impact('medium');
    setIsNightQuizMode(false);
    // صف جلسه را در لحظه شروع «قفل» می‌کنیم؛ وگرنه با هر پاسخ،
    // اولویت‌ها دوباره محاسبه می‌شوند و کارت زیر دست کاربر عوض می‌شود.
    setCustomSessionQueue(dailyQueue);
    setSessionKey((prev) => prev + 1);
    setActiveTab('study');
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
    setCustomSessionQueue(nightCards);
    setSessionKey((prev) => prev + 1);
    setActiveTab('study');
  };

  // هندلر شروع تمرین مستقیم از روی یک گره خاص در گراف دانش یا کتابخانه درسنامه
  const handleStartPracticeNode = (
    nodeId: string,
    mode: 'practice' | 'proof' | 'remedial'
  ) => {
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
      setCustomSessionQueue([remCard, ...nodeQuestions]);
      setSessionKey((prev) => prev + 1);
      setActiveTab('study');
      return;
    }

    if (mode === 'proof') {
      const proofQ =
        questions.find((q) => q.nodeId === nodeId && q.isQuarantinedProof) ??
        questions.find((q) => q.nodeId === nodeId);
      if (proofQ) {
        setIsNightQuizMode(false);
        setCustomSessionQueue([
          {
            id: `direct.proof.${proofQ.id}`,
            nodeId,
            cardType: 'proof_1404',
            questionId: proofQ.id,
            dueAt: now.toISOString(),
            priorityScore: 99,
            attemptType: 'proof',
            fsrs: initFSRS(now),
          },
        ]);
        setSessionKey((prev) => prev + 1);
        setActiveTab('study');
      }
      return;
    }

    const nodeQuestions = questions
      .filter((q) => q.nodeId === nodeId)
      .map((q) => ({
        id: `direct.q.${q.id}`,
        nodeId,
        cardType: q.isQuarantinedProof
          ? ('proof_1404' as const)
          : ('question' as const),
        questionId: q.id,
        dueAt: now.toISOString(),
        priorityScore: 92,
        attemptType: q.isQuarantinedProof
          ? ('proof' as const)
          : ('practice' as const),
        fsrs: initFSRS(now),
      }));

    if (nodeQuestions.length > 0) {
      setIsNightQuizMode(false);
      setCustomSessionQueue(nodeQuestions);
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col ambient-bento-bg text-slate-900 dark:text-slate-100 transition-colors pb-16 md:pb-0">
      {/* نوار بالای یکپارچه و مینیمال با افکت Glassmorphism */}
      <header className="sticky top-0 z-40 glass-header px-4 sm:px-8 py-3">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-4">
          {/* برند سامانه */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              tmaHaptic.impact('light');
              setActiveTab('home');
            }}
            className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            <span className="w-7 h-7 rounded-md bg-blue-700 text-white text-[13px] font-bold flex items-center justify-center shrink-0">
              م
            </span>
            <span>سامانه جامع کنکور مدیریت</span>
          </a>

          {/* لینک‌های ناوبری اصلی */}
          <nav className="hidden md:flex items-center gap-5 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
            {[
              { id: 'home', label: 'میز کار' },
              { id: 'study', label: 'جلسه تست' },
              { id: 'exams', label: 'کنکورهای ۱۳۹۱ تا ۱۴۰۵' },
              { id: 'map', label: 'درخت مهارت' },
              { id: 'lessons', label: 'درسنامه‌ها و منابع' },
              { id: 'notebook', label: 'دفتر خطا' },
              { id: 'ingest', label: 'افزودن محتوا' },
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
                  activeTab === item.id ||
                  (item.id === 'ingest' && activeTab === 'patches')
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
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>مرور امروز</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (Supports both Full Width and 430px Telegram Mini-App Frame Mode) */}
      <main
        className={`flex-1 w-full mx-auto transition-all duration-300 ${
          isTmaMobileFrame
            ? 'max-w-[440px] my-4 border-4 border-slate-800 dark:border-slate-700 rounded-[24px] shadow-2xl overflow-hidden bg-slate-50 dark:bg-[#12100d] px-3.5 py-4'
            : 'max-w-[1240px] px-4 sm:px-8 py-6'
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
            nodes={nodes}
            stats={stats}
            nodeStates={nodeStates}
            queue={dailyQueue}
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
            onSubmitAnswer={({
              card,
              selectedOption,
              confidence,
              responseTimeMs,
            }) => {
              const result = evaluateAnswerAndRipple({
                card,
                selectedOption,
                confidence,
                responseTimeMs,
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

              // ثبت پاسخ در دفتر خطا (پاسخ صحیح، خطای قبلی همان سؤال را حل‌شده می‌کند)
              const answeredQuestion = card.questionId
                ? questions.find((q) => q.id === card.questionId)
                : undefined;
              recordAnswerInNotebook(
                answeredQuestion,
                selectedOption,
                result.report.wasCorrect,
                result.report.errorType as MistakeErrorType
              );

              if (customSessionQueue && result.report.spawnedCards.length > 0) {
                const newReviewCards = result.nextCards.filter((nc) =>
                  result.report.spawnedCards.some((sc) => sc.id === nc.id)
                );
                setCustomSessionQueue((prev) =>
                  prev ? [...prev, ...newReviewCards] : null
                );
              }

              return { report: result.report, snapshot: result.snapshot };
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
            onDismissNonQuestionCard={(cardId, nodeId, bonusScore = 5) => {
              setNodeStates((prev) => {
                const current = prev[nodeId];
                if (!current) return prev;
                const nextScore = Math.min(100, current.masteryScore + bonusScore);
                return {
                  ...prev,
                  [nodeId]: {
                    ...current,
                    masteryScore: nextScore,
                    proficiencyProbability: Number((nextScore / 100).toFixed(2)),
                    rippleAlert: null,
                  },
                };
              });
              setCards((prev) => prev.filter((c) => c.id !== cardId));
              setStats((prev) => ({
                ...prev,
                coins: prev.coins + 8,
                isZeroStateNewUser: false,
              }));
            }}
            onExitSession={() => {
              setCustomSessionQueue(null);
              setActiveTab('home');
            }}
            onOpenLessonNode={(nodeId) => {
              setSelectedLessonNodeId(nodeId);
              setActiveTab('lessons');
            }}
            onOpenMistakeNotebook={() => setActiveTab('notebook')}
            onRestartMistakes={handleStartMistakeSession}
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
            onToggleResolved={(questionId, resolved) =>
              setMistakeEntries((prev) =>
                markMistakeResolved(prev, questionId, resolved)
              )
            }
            onRemove={(questionId) =>
              setMistakeEntries((prev) => removeMistake(prev, questionId))
            }
            onClearResolved={() =>
              setMistakeEntries((prev) => clearResolvedMistakes(prev))
            }
          />
        )}

        {activeTab === 'map' && (
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
            onRecordQuestionAttempt={(question, selectedOption) => {
              const targetCard: ReviewCard = cards.find(
                (c) => c.questionId === question.id
              ) ?? {
                id: `card.q.${question.id}`,
                nodeId: question.nodeId,
                cardType: question.isQuarantinedProof ? 'proof_1404' : 'question',
                questionId: question.id,
                dueAt: new Date().toISOString(),
                priorityScore: 92,
                attemptType: question.isQuarantinedProof ? 'proof' : 'practice',
                fsrs: initFSRS(new Date()),
              };

              const result = evaluateAnswerAndRipple({
                card: targetCard,
                selectedOption,
                confidence: 'high',
                responseTimeMs: question.expectedTimeMs || 45000,
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
                result.report.errorType as MistakeErrorType
              );
            }}
            onStartYearAdaptiveSession={(year, sectionId) => {
              const now = new Date();
              const filtered = YEARLY_KONKOR_QUESTIONS.filter((q) => {
                if (q.examYear !== year) return false;
                if (sectionId !== 'all' && q.courseSectionId !== sectionId) return false;
                return true;
              }).sort((a, b) => a.bookletQuestionNumber - b.bookletQuestionNumber);

              const yearQueue: ReviewCard[] = filtered.map((q) => ({
                id: `year.${year}.q.${q.id}`,
                nodeId: q.nodeId,
                cardType: q.isQuarantinedProof ? 'proof_1404' : 'question',
                questionId: q.id,
                dueAt: now.toISOString(),
                priorityScore: 95,
                attemptType: q.isQuarantinedProof ? 'proof' : 'practice',
                fsrs: initFSRS(now),
              }));

              if (yearQueue.length > 0) {
                setIsNightQuizMode(false);
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

        {activeTab === 'ingest' && (
          <ContentIngestionStudio
            existingNodeIds={nodes.map((n) => n.id)}
            onIngestValidatedPackage={(pkg) => {
              handleIngestNewContentPackage(pkg);
            }}
          />
        )}

        {activeTab === 'patches' && <CodePatchesView />}
      </main>

      {/* نوار ناوبری پایین موبایل — حداکثر ۵ مقصد اصلی (رهنمود ناوبری موبایل) */}
      <nav
        className={`${
          isTmaMobileFrame
            ? 'sticky bottom-0 max-w-[440px] mx-auto w-full rounded-b-[20px]'
            : 'fixed bottom-0 inset-x-0 md:hidden'
        } z-40 bg-[#fffdf8]/96 dark:bg-[#171512]/96 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90 px-2 py-1.5 pb-safe`}
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
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-medium transition-all active:scale-95 cursor-pointer ${
                  isActive
                    ? 'text-blue-700 dark:text-blue-300 font-bold bg-blue-500/10'
                    : 'text-slate-500 dark:text-slate-400'
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
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-medium transition-all active:scale-95 cursor-pointer ${
              ['map', 'notebook', 'ingest', 'patches'].includes(activeTab)
                ? 'text-blue-700 dark:text-blue-300 font-bold bg-blue-500/10'
                : 'text-slate-500 dark:text-slate-400'
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
              { id: 'map' as ActiveTab, label: 'درخت مهارت و نقشه تسلط', icon: Layers },
              { id: 'notebook' as ActiveTab, label: 'دفتر خطا و مرور اشتباه‌ها', icon: BookMarked },
              { id: 'ingest' as ActiveTab, label: 'افزودن بستهٔ محتوا', icon: FilePlus2 },
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
