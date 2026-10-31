/**
 * موتور یادگیری تطبیقی کنکور (AEL Pure Engine v3.0 - مبتنی بر بنچمارک جهانی)
 * شامل:
 * ۱. شروع کاملاً صفر (Zero-State Onboarding) برای کاربر جدید (۰٪ تسلط، ۰ سابقه، باز بودن مرز دانش لایه ۰)
 * ۲. الگوریتم FIRe (Fractional Implicit Repetition - MathAcademy) برای اعتبار مرور کسری به پیش‌نیازها
 * ۳. تشخیص خودکار کارت‌های زالو/چغر (Leech Cards - Anki/SuperMemo) پس از ۲ بار خطا و الزام به درسنامه خردشده
 * ۴. ارزیابی ۵سطحی درک درسنامه (۱ تا ۵) با بازتنظیم آنی برنامه درسی، فواصل FSRS و بازگشایی تست‌ها
 * ۵. رادار هوشمند تشخیص فصول پرتکرار چندساله کنکور (Multi-Year Exam Frequency Detector)
 * ۶. مأموریت‌های روزانه پویا (Daily Quests - Duolingo) و امتیاز XP
 * ۷. موتور اعتبارسنج سخت‌گیرانه بدون حدس (Zero-Guessing Content Ingestion Validator) ویژه ایجنت‌ها
 */

import {
  KnowledgeNode,
  NodeDependency,
  QuestionItem,
  InteractiveLesson,
  TrackId,
  CardType,
  AttemptType,
  ErrorTypeClassification,
  CoverageStatus,
  COMPARISON_TABLES,
} from '../data/konkorData';

export interface CardFSRSState {
  stability: number;
  difficulty: number;
  retrievability: number;
  reps: number;
  lapses: number;
  lastReviewedAt: string;
  dueAt: string;
  intervalDays: number;
}

export interface LearnerSixDState {
  nodeId: string;
  /** ۱. تسلط مفهومی (۰ تا ۱۰۰) */
  masteryScore: number;
  /** ۲. احتمال تسلط بیزی (۰ تا ۱) */
  proficiencyProbability: number;
  /** ۳. پایداری حافظه بلندمدت FSRS (بر حسب روز) */
  memoryStability: number;
  /** ۴. احتمال بازیابی لحظه‌ای از حافظه (۰ تا ۱) */
  retrievability: number;
  /** ۵. شاخص سرعت و روانی پاسخگویی (۰ تا ۱۰۰) */
  speedFluency: number;
  /** ۶. وضعیت پوشش شواهد و اثبات (۶ سطحی) */
  coverageStatus: CoverageStatus;
  /** تعداد شواهد ثبت‌شده */
  evidenceCount: number;
  /** آخرین امتیاز خودارزیابی درسنامه از ۱ تا ۵ */
  lastLessonSelfRating?: 1 | 2 | 3 | 4 | 5;
  /** آیا این گره روی مرز دانش داوطلب باز است؟ (Knowledge Frontier) */
  isUnlockedInFrontier: boolean;
  /** آیا کارت چغر (Leech) در این مبحث شناسایی شده؟ */
  hasLeechCard?: boolean;
  /** هشدار موج خطا */
  rippleAlert?: 'shocked' | 'probe_queued' | 'needs_remediation' | 'leech_suspended' | null;
}

export interface ReviewCard {
  id: string;
  nodeId: string;
  cardType: CardType;
  questionId?: string;
  comparisonId?: string;
  dueAt: string;
  priorityScore: number;
  attemptType: AttemptType;
  fsrs: CardFSRSState;
  isLeech?: boolean;
  createdByRippleFrom?: string;
}

export interface MasteryDeltaWithTitle {
  nodeId: string;
  topicTitle: string;
  courseTitle: string;
  before: number;
  after: number;
  delta: number;
  reason:
    | 'direct'
    | 'fire_implicit_credit'
    | 'sibling_shock'
    | 'prerequisite_probe'
    | 'cross_course_bridge'
    | 'placement_propagation'
    | 'lesson_self_rating';
}

export interface RippleReport {
  attemptId: string;
  questionId: string;
  nodeId: string;
  nodeTitle: string;
  wasCorrect: boolean;
  wasSkipped: boolean;
  confidence: 'high' | 'low';
  errorType: ErrorTypeClassification;
  konkorScoreChange: number;
  xpEarned: number;
  isLeechTriggered: boolean;
  topicDelta: MasteryDeltaWithTitle;
  masteryDeltas: MasteryDeltaWithTitle[];
  spawnedCards: {
    id: string;
    cardType: CardType;
    nodeId: string;
    nodeTitle: string;
    reason: string;
  }[];
  proofUnlocked?: {
    nodeId: string;
    nodeTitle: string;
    questionId: string;
  };
  mentorMessage: string;
  canRollbackAsSlip: boolean;
  rolledBack?: boolean;
}

export interface SnapshotForRollback {
  attemptId: string;
  nodeStates: Record<string, LearnerSixDState>;
  cards: ReviewCard[];
  stats: UserStats;
}

export interface DailyQuest {
  id: string;
  title: string;
  subtitle: string;
  current: number;
  target: number;
  xpReward: number;
  completed: boolean;
}

export type StudyCourseCategory = 'all' | 'conceptual' | 'quantitative' | 'language';
export type MajorExamBranch = 'business' | 'industrial' | 'technology' | 'phd_all';

export interface UserStats {
  isZeroStateNewUser: boolean;
  streakDays: number;
  streakFreezeAvailable: boolean;
  streakFreezeUsedToday: boolean;
  xp: number;
  coins: number;
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  lessonsRatedCount: number;
  leechResolvedCount: number;
  placementCompleted: boolean;
  activeTracks: TrackId[];
  studyMode: 'desk' | 'commute' | 'quick';
  /** ساعت مطالعه هدف در شبانه‌روز (مثلاً ۱ تا ۱۰ ساعت) */
  dailyStudyHours: number;
  /** تعداد تست هدف در شبانه‌روز (مثلاً ۱۰، ۲۰، ۳۰، ۵۰ تست) */
  dailyTargetQuestions: number;
  /** نوع دروس اولویت‌دار انتخابی داوطلب */
  preferredCourseCategory: StudyCourseCategory;
  /** گرایش هدف کنکور (کد ۱۱۴۲ ارشد یا جامع دکتری) برای اعمال ضرایب دقیق */
  selectedMajorBranch: MajorExamBranch;
  dailyQuests: DailyQuest[];
}

export interface MultiYearFrequencyInsight {
  nodeId: string;
  course: string;
  chapter: string;
  topic: string;
  sourceBookCitation: string;
  yearsAppeared: number[];
  appearanceCount: number;
  isHighYieldCritical: boolean; // true if appeared in >= 4 different years
  importanceBadge: string;
  shareOfExamPercent: number;
}

export interface ROINodeRanking {
  node: KnowledgeNode;
  state: LearnerSixDState;
  roiScore: number;
  expectedGainPercent: number;
  urgencyReason: string;
  examFrequencyInsight: MultiYearFrequencyInsight;
}

/* ------------------------------------------------------------------ */
/* FSRS v4.5 Core Functions                                           */
/* ------------------------------------------------------------------ */

export function initFSRS(now = new Date()): CardFSRSState {
  return {
    stability: 0,
    difficulty: 5.0,
    retrievability: 0,
    reps: 0,
    lapses: 0,
    lastReviewedAt: now.toISOString(),
    dueAt: now.toISOString(),
    intervalDays: 0,
  };
}

export function stepFSRS(
  prev: CardFSRSState,
  grade: 1 | 2 | 3 | 4,
  now = new Date()
): CardFSRSState {
  const d0 = prev.difficulty || 5.0;
  const s0 = prev.stability > 0 ? prev.stability : 1.8;

  const nextDiff = Math.min(10, Math.max(1, d0 - 0.6 * (grade - 3)));
  let nextStab = s0;
  let lapses = prev.lapses;
  let intervalDays = 1;

  if (grade === 1) {
    nextStab = Math.max(0.5, s0 * 0.4);
    lapses += 1;
    intervalDays = 0;
  } else if (grade === 2) {
    nextStab = Math.max(1.2, s0 * 1.25);
    intervalDays = Math.max(1, Math.round(nextStab));
  } else if (grade === 3) {
    nextStab = s0 * (1 + 1.45 * Math.pow(11 - nextDiff, 0.5) * Math.pow(s0, -0.15));
    intervalDays = Math.max(2, Math.round(nextStab));
  } else {
    nextStab = s0 * (1 + 2.1 * Math.pow(11 - nextDiff, 0.5) * Math.pow(s0, -0.15));
    intervalDays = Math.max(4, Math.round(nextStab * 1.3));
  }

  const dueDate = new Date(now.getTime() + intervalDays * 86400000);
  const retrievability = grade === 1 ? 0.65 : Math.min(0.99, 0.88 + nextStab * 0.01);

  return {
    stability: Number(nextStab.toFixed(2)),
    difficulty: Number(nextDiff.toFixed(2)),
    retrievability: Number(retrievability.toFixed(2)),
    reps: prev.reps + 1,
    lapses,
    lastReviewedAt: now.toISOString(),
    dueAt: dueDate.toISOString(),
    intervalDays,
  };
}

/* ------------------------------------------------------------------ */
/* 1. Zero-State Initializer (شروع کاملاً صفر برای کاربر جدید)          */
/* ------------------------------------------------------------------ */

export function createZeroStateEngine(
  nodes: KnowledgeNode[],
  questions: QuestionItem[]
): {
  nodeStates: Record<string, LearnerSixDState>;
  cards: ReviewCard[];
  stats: UserStats;
} {
  const now = new Date();
  const nodeStates: Record<string, LearnerSixDState> = {};

  for (const node of nodes) {
    // در شروع صفر، فقط گره‌های پایه (لایه ۰) در مرز دانش (Frontier) باز هستند
    const isFoundationLayer = node.graphPos.layer === 0;
    nodeStates[node.id] = {
      nodeId: node.id,
      masteryScore: 0,
      proficiencyProbability: 0,
      memoryStability: 0,
      retrievability: 0,
      speedFluency: 0,
      coverageStatus: 'unseen',
      evidenceCount: 0,
      isUnlockedInFrontier: isFoundationLayer,
      hasLeechCard: false,
      rippleAlert: null,
    };
  }

  // برای کاربر صفر، ابتدا کارت‌های درسنامه گام‌به‌گام لایه ۰ و سپس سوالات پایه در صف قرار می‌گیرند
  const cards: ReviewCard[] = [];
  const foundationNodes = nodes.filter((n) => n.graphPos.layer === 0);

  for (const fNode of foundationNodes) {
    cards.push({
      id: `card.remedial.${fNode.id}`,
      nodeId: fNode.id,
      cardType: 'remedial_lesson',
      dueAt: now.toISOString(),
      priorityScore: 98 - fNode.graphPos.col,
      attemptType: 'practice',
      fsrs: initFSRS(now),
    });
  }

  for (const q of questions) {
    if (q.isQuarantinedProof) continue; // سوالات قرنطینه ۱۴۰۴ تا رسیدن به ۷۵٪ بسته می‌مانند
    const qNode = nodes.find((n) => n.id === q.nodeId);
    const isFoundation = qNode?.graphPos.layer === 0;

    cards.push({
      id: `card.q.${q.id}`,
      nodeId: q.nodeId,
      cardType: 'question',
      questionId: q.id,
      dueAt: now.toISOString(),
      priorityScore: isFoundation ? 90 : 70,
      attemptType: 'practice',
      fsrs: initFSRS(now),
    });
  }

  return {
    nodeStates,
    cards,
    stats: {
      isZeroStateNewUser: true,
      streakDays: 0,
      streakFreezeAvailable: true,
      streakFreezeUsedToday: false,
      xp: 0,
      coins: 0,
      totalAnswered: 0,
      correctCount: 0,
      wrongCount: 0,
      skippedCount: 0,
      lessonsRatedCount: 0,
      leechResolvedCount: 0,
      placementCompleted: false,
      activeTracks: ['common', 'business', 'industrial', 'strategy', 'technology'],
      studyMode: 'desk',
      dailyStudyHours: 4,
      dailyTargetQuestions: 20,
      preferredCourseCategory: 'all',
      selectedMajorBranch: 'business',
      dailyQuests: [
        {
          id: 'quest.lesson_rate',
          title: 'مطالعه و امتیازدهی ۱ تا ۵ به یک درسنامه',
          subtitle: 'درک خود از درسنامه را ثبت کنید تا برنامه درسی کالیبره شود',
          current: 0,
          target: 1,
          xpReward: 40,
          completed: false,
        },
        {
          id: 'quest.evidence_3',
          title: 'ثبت ۳ شاهد پاسخ صحیح در صف تطبیقی',
          subtitle: 'پاسخ با اطمینان بالا یا مدیریت ریسک بدون نمره منفی',
          current: 0,
          target: 3,
          xpReward: 60,
          completed: false,
        },
        {
          id: 'quest.high_yield',
          title: 'تمرین یکی از فصول فوق‌پرتکرار کنکور',
          subtitle: 'فصولی که بیش از ۵ بار در کنکور دکتری تکرار شده‌اند',
          current: 0,
          target: 1,
          xpReward: 50,
          completed: false,
        },
      ],
    },
  };
}

/**
 * همگام‌سازی و مهاجرت امن داده‌های ذخیره‌شده در LocalStorage/CloudStorage
 * با گره‌ها و سؤالات جدید (جلوگیری از کرش undefined روی گره‌های تازه اضافه‌شده)
 */
export function hydrateAndReconcileSavedState(
  saved: {
    nodeStates: Record<string, LearnerSixDState>;
    cards: ReviewCard[];
    stats: UserStats;
  } | null,
  nodes: KnowledgeNode[],
  questions: QuestionItem[],
  dependencies: NodeDependency[]
): {
  nodeStates: Record<string, LearnerSixDState>;
  cards: ReviewCard[];
  stats: UserStats;
} {
  const fresh = createZeroStateEngine(nodes, questions);
  if (!saved || !saved.nodeStates || !saved.stats) {
    return fresh;
  }

  const mergedNodeStates: Record<string, LearnerSixDState> = {
    ...fresh.nodeStates,
    ...saved.nodeStates,
  };

  // اطمینان از وجود تمام کلیدهای الزامی برای هر گره
  for (const node of nodes) {
    if (!mergedNodeStates[node.id]) {
      mergedNodeStates[node.id] = fresh.nodeStates[node.id];
    }
  }

  const reconciledNodeStates = recomputeKnowledgeFrontier(
    mergedNodeStates,
    nodes,
    dependencies
  );

  // اضافه کردن کارت‌های سؤالات جدیدی که در کش قبلی کاربر نبوده‌اند
  const existingCardIds = new Set((saved.cards || []).map((c) => c.id));
  const existingQuestionIds = new Set(
    (saved.cards || []).map((c) => c.questionId).filter(Boolean)
  );
  const mergedCards: ReviewCard[] = [...(saved.cards || [])];

  for (const freshCard of fresh.cards) {
    if (freshCard.questionId) {
      if (!existingQuestionIds.has(freshCard.questionId)) {
        mergedCards.push(freshCard);
      }
    } else if (!existingCardIds.has(freshCard.id)) {
      mergedCards.push(freshCard);
    }
  }

  const mergedTracks = Array.from(
    new Set([
      ...(saved.stats.activeTracks || []),
      'common',
      'business',
      'industrial',
      'strategy',
      'technology',
    ] as TrackId[])
  );

  const mergedStats: UserStats = {
    ...fresh.stats,
    ...saved.stats,
    activeTracks: mergedTracks,
    dailyStudyHours: saved.stats.dailyStudyHours || 4,
    dailyTargetQuestions: saved.stats.dailyTargetQuestions || 20,
    preferredCourseCategory: saved.stats.preferredCourseCategory || 'all',
    selectedMajorBranch: saved.stats.selectedMajorBranch || 'business',
    dailyQuests:
      Array.isArray(saved.stats.dailyQuests) && saved.stats.dailyQuests.length > 0
        ? saved.stats.dailyQuests
        : fresh.stats.dailyQuests,
  };

  return {
    nodeStates: reconciledNodeStates,
    cards: mergedCards,
    stats: mergedStats,
  };
}


/* ------------------------------------------------------------------ */
/* 2. Knowledge Frontier Unlocker (MathAcademy Layering Logic)        */
/* ------------------------------------------------------------------ */

export function recomputeKnowledgeFrontier(
  nodeStates: Record<string, LearnerSixDState>,
  nodes: KnowledgeNode[],
  dependencies: NodeDependency[]
): Record<string, LearnerSixDState> {
  const updated = { ...nodeStates };
  for (const node of nodes) {
    if (node.graphPos.layer === 0) {
      updated[node.id] = { ...updated[node.id], isUnlockedInFrontier: true };
      continue;
    }
    const prereqs = dependencies.filter(
      (d) => d.source === node.id && d.relation === 'prerequisite'
    );
    const allPrereqsSatisfied =
      prereqs.length === 0 ||
      prereqs.every((p) => (updated[p.target]?.masteryScore ?? 0) >= 45);

    updated[node.id] = {
      ...updated[node.id],
      isUnlockedInFrontier:
        allPrereqsSatisfied || (updated[node.id]?.masteryScore ?? 0) > 0,
    };
  }
  return updated;
}

/* ------------------------------------------------------------------ */
/* 3. Lesson 1-to-5 Self-Rating Schedule Updater                      */
/* ------------------------------------------------------------------ */

export function applyLessonUnderstandingRating(params: {
  nodeId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  nodeStates: Record<string, LearnerSixDState>;
  cards: ReviewCard[];
  stats: UserStats;
  nodes: KnowledgeNode[];
  dependencies: NodeDependency[];
  questions: QuestionItem[];
}): {
  nextNodeStates: Record<string, LearnerSixDState>;
  nextCards: ReviewCard[];
  nextStats: UserStats;
  scheduleSummary: string;
  delta: MasteryDeltaWithTitle;
} {
  const { nodeId, rating, nodes, dependencies, questions } = params;
  const now = new Date();
  let nextNodeStates: Record<string, LearnerSixDState> = JSON.parse(
    JSON.stringify(params.nodeStates)
  );
  const nextCards: ReviewCard[] = JSON.parse(JSON.stringify(params.cards));
  const nextStats: UserStats = JSON.parse(JSON.stringify(params.stats));

  const node = nodes.find((n) => n.id === nodeId) ?? nodes[0];
  if (!nextNodeStates[node.id]) {
    nextNodeStates[node.id] = {
      nodeId: node.id,
      masteryScore: 0,
      proficiencyProbability: 0,
      memoryStability: 0,
      retrievability: 0,
      speedFluency: 0,
      coverageStatus: 'unseen',
      evidenceCount: 0,
      isUnlockedInFrontier: true,
      hasLeechCard: false,
      rippleAlert: null,
    };
  }
  const st = nextNodeStates[node.id];
  const before = st.masteryScore;

  // حذف کارت درسنامه فعلی اگر در صف بود
  const remCardId = `card.remedial.${node.id}`;
  const remIdx = nextCards.findIndex((c) => c.id === remCardId);
  if (remIdx !== -1 && rating >= 3) {
    nextCards.splice(remIdx, 1);
  }

  let targetScore = before;
  let intervalDays = 1;
  let scheduleSummary = '';

  if (rating === 1) {
    // امتیاز ۱: اصلاً متوجه نشدم -> فعال‌سازی پیش‌نیاز + نگه داشتن درسنامه در صدر صف امروز
    targetScore = Math.max(15, Math.min(25, before + 10));
    intervalDays = 0;
    st.coverageStatus = 'weak';
    st.rippleAlert = 'probe_queued';

    // جلو انداختن پیش‌نیازهای این درس
    const prereqs = dependencies.filter((d) => d.source === node.id);
    for (const edge of prereqs) {
      const pNode = nodes.find((n) => n.id === edge.target);
      if (pNode) {
        const probeId = `card.remedial.${pNode.id}`;
        if (!nextCards.some((c) => c.id === probeId)) {
          nextCards.unshift({
            id: probeId,
            nodeId: pNode.id,
            cardType: 'remedial_lesson',
            dueAt: now.toISOString(),
            priorityScore: 99,
            attemptType: 'diagnostic',
            fsrs: initFSRS(now),
          });
        }
      }
    }
    scheduleSummary = `امتیاز ۱ ثبت شد: تست‌های سخت «${node.topic}» فعلاً متوقف شدند و درسنامه پیش‌نیاز مستقیم آن در اولویت اول برنامه امروز قرار گرفت.`;
  } else if (rating === 2) {
    // امتیاز ۲: ابهام دارم -> افزودن کارت مقایسه و کارت دام طراح قبل از تست چهارگزینه‌ای
    targetScore = Math.max(30, before + 15);
    intervalDays = 1;
    st.coverageStatus = 'weak';
    st.rippleAlert = 'needs_remediation';

    const comp = COMPARISON_TABLES[node.id];
    if (comp) {
      const compId = `card.comp.${comp.id}`;
      if (!nextCards.some((c) => c.id === compId)) {
        nextCards.unshift({
          id: compId,
          nodeId: node.id,
          cardType: 'comparison_card',
          comparisonId: comp.id,
          dueAt: now.toISOString(),
          priorityScore: 97,
          attemptType: 'diagnostic',
          fsrs: initFSRS(now),
        });
      }
    }
    scheduleSummary = `امتیاز ۲ ثبت شد: تسلط به ${targetScore}٪ رسید و «جدول مقایسه مفاهیم متشابه» برای رفع ابهام به ابتدای برنامه امروز اضافه شد.`;
  } else if (rating === 3) {
    // امتیاز ۳: درک متوسط -> باز شدن تست‌های استاندارد با فاصله مرور ۲ روزه
    targetScore = Math.max(50, before + 25);
    intervalDays = 2;
    st.coverageStatus = 'learning';
    st.rippleAlert = null;
    st.hasLeechCard = false;

    const nodeQs = questions.filter((q) => q.nodeId === node.id && !q.isQuarantinedProof);
    for (const q of nodeQs) {
      const qCardIdx = nextCards.findIndex((c) => c.questionId === q.id);
      if (qCardIdx !== -1) {
        nextCards[qCardIdx].priorityScore = 93;
        nextCards[qCardIdx].isLeech = false;
      } else {
        nextCards.unshift({
          id: `card.q.${q.id}`,
          nodeId: node.id,
          cardType: 'question',
          questionId: q.id,
          dueAt: now.toISOString(),
          priorityScore: 93,
          attemptType: 'practice',
          fsrs: initFSRS(now),
        });
      }
    }
    scheduleSummary = `امتیاز ۳ ثبت شد: تسلط «${node.topic}» به ${targetScore}٪ رسید و تست‌های استاندارد آن در صف امروز فعال شدند.`;
  } else if (rating === 4) {
    // امتیاز ۴: یادگیری خوب -> تسلط ۶۸٪، باز شدن لایه بعدی درخت دانش و فاصله ۴ روزه
    targetScore = Math.max(68, before + 35);
    intervalDays = 4;
    st.coverageStatus = 'learning';
    st.rippleAlert = null;
    st.hasLeechCard = false;
    scheduleSummary = `امتیاز ۴ ثبت شد: تسلط به ${targetScore}٪ ارتقا یافت، پایداری حافظه روی ۴ روز تنظیم شد و مباحث وابسته در درخت مهارت بازگشایی شدند.`;
  } else {
    // امتیاز ۵: تسلط کامل -> تسلط ۷۶٪ و باز شدن مستقیم تست قرنطینه کنکور ۱۴۰۴ برای اثبات!
    targetScore = Math.max(76, before + 45);
    intervalDays = 7;
    st.coverageStatus = 'needs_proof';
    st.rippleAlert = null;
    st.hasLeechCard = false;

    const proofQ = questions.find((q) => q.nodeId === node.id && q.isQuarantinedProof);
    if (proofQ) {
      const proofCardId = `card.proof.${proofQ.id}`;
      if (!nextCards.some((c) => c.id === proofCardId)) {
        nextCards.unshift({
          id: proofCardId,
          nodeId: node.id,
          cardType: 'proof_1404',
          questionId: proofQ.id,
          dueAt: now.toISOString(),
          priorityScore: 99,
          attemptType: 'proof',
          fsrs: initFSRS(now),
        });
      }
    }
    scheduleSummary = `امتیاز ۵ (تسلط کامل) ثبت شد! تسلط به ${targetScore}٪ رسید و قفل «تست قرنطینه کنکور ۱۴۰۴» برای اثبات نهایی تسلط در صدر صف امروز باز شد.`;
  }

  st.masteryScore = Math.min(100, targetScore);
  st.proficiencyProbability = Number((st.masteryScore / 100).toFixed(2));
  st.memoryStability = intervalDays || 0.8;
  st.retrievability = rating >= 3 ? 0.94 : 0.72;
  st.lastLessonSelfRating = rating;
  st.evidenceCount += 1;

  // بروزرسانی مرز دانش (Knowledge Frontier)
  nextNodeStates = recomputeKnowledgeFrontier(nextNodeStates, nodes, dependencies);

  // آپدیت آمار کاربر و مأموریت روزانه
  nextStats.isZeroStateNewUser = false;
  nextStats.lessonsRatedCount += 1;
  nextStats.xp += 25;
  nextStats.coins += 8;
  if (nextStats.streakDays === 0) nextStats.streakDays = 1;

  nextStats.dailyQuests = nextStats.dailyQuests.map((q) => {
    if (q.id === 'quest.lesson_rate' && !q.completed) {
      const nextCurr = q.current + 1;
      const done = nextCurr >= q.target;
      if (done) nextStats.xp += q.xpReward;
      return { ...q, current: nextCurr, completed: done };
    }
    return q;
  });

  return {
    nextNodeStates,
    nextCards,
    nextStats,
    scheduleSummary,
    delta: {
      nodeId: node.id,
      topicTitle: node.topic,
      courseTitle: node.course,
      before,
      after: st.masteryScore,
      delta: st.masteryScore - before,
      reason: 'lesson_self_rating',
    },
  };
}

/* ------------------------------------------------------------------ */
/* 4. Multi-Year Exam Frequency Detector (رادار پرتکرارهای کنکور)       */
/* ------------------------------------------------------------------ */

export function analyzeMultiYearExamFrequency(
  nodes: KnowledgeNode[],
  questions: QuestionItem[]
): Record<string, MultiYearFrequencyInsight> {
  const insights: Record<string, MultiYearFrequencyInsight> = {};
  const totalExamAppearances = nodes.reduce(
    (acc, n) => acc + (n.examYearsAppeared?.length || 1),
    0
  );

  for (const node of nodes) {
    // ترکیب سال‌های ثبت‌شده روی گره + سال‌های سؤالات موجود در بانک سؤال
    const qYears = questions
      .filter((q) => q.nodeId === node.id && q.examYear)
      .map((q) => q.examYear);
    const mergedYears = Array.from(
      new Set([...(node.examYearsAppeared || []), ...qYears])
    ).sort((a, b) => a - b);

    const count = mergedYears.length;
    const isHighYieldCritical = count >= 6;
    const shareOfExamPercent = Math.max(
      4,
      Math.round((count / Math.max(1, totalExamAppearances)) * 100)
    );

    let importanceBadge = `تکرار در ${count} دوره کنکور`;
    if (count >= 7) {
      importanceBadge = `فوق‌پرتکرار و حیاتی (${count} دوره کنکور دکتری)`;
    } else if (count >= 5) {
      importanceBadge = `فصل پرتکرار کنکور (${count} دوره)`;
    }

    insights[node.id] = {
      nodeId: node.id,
      course: node.course,
      chapter: node.chapter,
      topic: node.topic,
      sourceBookCitation: node.sourceBookCitation,
      yearsAppeared: mergedYears,
      appearanceCount: count,
      isHighYieldCritical,
      importanceBadge,
      shareOfExamPercent,
    };
  }

  return insights;
}

/* ------------------------------------------------------------------ */
/* 5. Answer Evaluation + MathAcademy FIRe + Anki Leech Detector      */
/* ------------------------------------------------------------------ */

export function evaluateAnswerAndRipple(params: {
  card: ReviewCard;
  selectedOption: number | null;
  confidence: 'high' | 'low';
  responseTimeMs: number;
  nodeStates: Record<string, LearnerSixDState>;
  cards: ReviewCard[];
  stats: UserStats;
  nodes: KnowledgeNode[];
  dependencies: NodeDependency[];
  questions: QuestionItem[];
  lessons: Record<string, InteractiveLesson>;
  isNightVerification?: boolean;
}): {
  nextNodeStates: Record<string, LearnerSixDState>;
  nextCards: ReviewCard[];
  nextStats: UserStats;
  report: RippleReport;
  snapshot: SnapshotForRollback;
} {
  const {
    card,
    selectedOption,
    confidence,
    responseTimeMs,
    nodes,
    dependencies,
    questions,
    lessons,
    isNightVerification,
  } = params;
  const now = new Date();
  const attemptId = `att_${now.getTime()}`;

  const snapshot: SnapshotForRollback = {
    attemptId,
    nodeStates: JSON.parse(JSON.stringify(params.nodeStates)),
    cards: JSON.parse(JSON.stringify(params.cards)),
    stats: JSON.parse(JSON.stringify(params.stats)),
  };

  let nextNodeStates: Record<string, LearnerSixDState> = JSON.parse(
    JSON.stringify(params.nodeStates)
  );
  const nextCards: ReviewCard[] = JSON.parse(JSON.stringify(params.cards));
  const nextStats: UserStats = JSON.parse(JSON.stringify(params.stats));
  nextStats.isZeroStateNewUser = false;
  if (nextStats.streakDays === 0) nextStats.streakDays = 1;

  const node = nodes.find((n) => n.id === card.nodeId) ?? nodes[0];
  const question =
    questions.find((q) => q.id === card.questionId) ??
    questions.find((q) => q.nodeId === node.id) ??
    questions[0];
  if (!nextNodeStates[node.id]) {
    nextNodeStates[node.id] = {
      nodeId: node.id,
      masteryScore: 0,
      proficiencyProbability: 0,
      memoryStability: 0,
      retrievability: 0,
      speedFluency: 0,
      coverageStatus: 'unseen',
      evidenceCount: 0,
      isUnlockedInFrontier: true,
      hasLeechCard: false,
      rippleAlert: null,
    };
  }
  const currentSixD = nextNodeStates[node.id];

  const wasSkipped = selectedOption === null;
  const wasCorrect = !wasSkipped && selectedOption === question.correctOption;

  const masteryDeltas: MasteryDeltaWithTitle[] = [];
  const spawnedCards: RippleReport['spawnedCards'] = [];
  let proofUnlocked: RippleReport['proofUnlocked'] | undefined;

  // ۱. حالت «نزده (Skip)»
  if (wasSkipped) {
    const before = currentSixD.masteryScore;
    const after = before === 0 ? 15 : Math.max(15, Math.round(before - 2));
    currentSixD.masteryScore = after;
    currentSixD.proficiencyProbability = Number((after / 100).toFixed(2));
    currentSixD.coverageStatus = 'weak';
    currentSixD.rippleAlert = 'needs_remediation';

    const topicDelta: MasteryDeltaWithTitle = {
      nodeId: node.id,
      topicTitle: node.topic,
      courseTitle: node.course,
      before,
      after,
      delta: after - before,
      reason: 'direct',
    };
    masteryDeltas.push(topicDelta);

    const remedialId = `card.remedial.${node.id}`;
    if (!nextCards.some((c) => c.id === remedialId) && lessons[node.id]) {
      nextCards.unshift({
        id: remedialId,
        nodeId: node.id,
        cardType: 'remedial_lesson',
        dueAt: now.toISOString(),
        priorityScore: 98,
        attemptType: 'diagnostic',
        fsrs: initFSRS(now),
        createdByRippleFrom: question.id,
      });
      spawnedCards.push({
        id: remedialId,
        cardType: 'remedial_lesson',
        nodeId: node.id,
        nodeTitle: node.topic,
        reason: 'ایجاد درسنامه گام‌به‌گام به دلیل انتخاب هوشمندانه گزینه «نزده»',
      });
    }

    nextStats.totalAnswered += 1;
    nextStats.skippedCount += 1;
    nextStats.xp += 5;
    nextStats.coins += 2;

    return {
      nextNodeStates,
      nextCards,
      nextStats,
      snapshot,
      report: {
        attemptId,
        questionId: question.id,
        nodeId: node.id,
        nodeTitle: node.topic,
        wasCorrect: false,
        wasSkipped: true,
        confidence,
        errorType: 'skipped',
        konkorScoreChange: 0,
        xpEarned: 5,
        isLeechTriggered: false,
        topicDelta,
        masteryDeltas,
        spawnedCards,
        mentorMessage: `مدیریت ریسک عالی! در کنکور دکتری با نمره منفی یک‌سوم، نزدن سؤالی که هنوز نخوانده‌ای نمره تراز تو را حفظ می‌کند. درسنامه گام‌به‌گام «${node.topic}» به ابتدای صف اضافه شد.`,
        canRollbackAsSlip: false,
      },
    };
  }

  // ۲. حالت پاسخ صحیح + الگوریتم FIRe (اعتبار مرور ضمنی به پیش‌نیازها - MathAcademy)
  if (wasCorrect) {
    const before = currentSixD.masteryScore;
    const baseJump = before === 0 ? 55 : card.attemptType === 'proof' ? 16 : confidence === 'high' ? 14 : 9;
    const after = Math.min(100, Math.round(before + baseJump));

    const grade: 3 | 4 = confidence === 'high' && responseTimeMs <= question.expectedTimeMs ? 4 : 3;
    const updatedFsrs = isNightVerification ? card.fsrs : stepFSRS(card.fsrs, grade, now);

    currentSixD.masteryScore = after;
    currentSixD.proficiencyProbability = Number((after / 100).toFixed(2));
    currentSixD.memoryStability = updatedFsrs.stability;
    currentSixD.retrievability = updatedFsrs.retrievability;
    currentSixD.speedFluency = Math.min(100, Math.max(65, Math.round(100 - responseTimeMs / 1200)));
    currentSixD.evidenceCount += 1;
    currentSixD.rippleAlert = null;
    currentSixD.hasLeechCard = false;

    if (card.cardType === 'proof_1404' || card.attemptType === 'proof') {
      currentSixD.coverageStatus = 'proven';
    } else if (after >= 85 && currentSixD.coverageStatus === 'proven') {
      currentSixD.coverageStatus = 'mastered';
    } else if (
      after >= 75 &&
      currentSixD.coverageStatus !== 'proven' &&
      currentSixD.coverageStatus !== 'mastered'
    ) {
      currentSixD.coverageStatus = 'needs_proof';
      const proofQ = questions.find((q) => q.nodeId === node.id && q.isQuarantinedProof);
      if (proofQ) {
        const proofCardId = `card.proof.${proofQ.id}`;
        if (!nextCards.some((c) => c.id === proofCardId)) {
          nextCards.unshift({
            id: proofCardId,
            nodeId: node.id,
            cardType: 'proof_1404',
            questionId: proofQ.id,
            dueAt: now.toISOString(),
            priorityScore: 99,
            attemptType: 'proof',
            fsrs: initFSRS(now),
          });
        }
        proofUnlocked = {
          nodeId: node.id,
          nodeTitle: node.topic,
          questionId: proofQ.id,
        };
        spawnedCards.push({
          id: proofCardId,
          cardType: 'proof_1404',
          nodeId: node.id,
          nodeTitle: node.topic,
          reason: 'بازگشایی تست قرنطینه کنکور ۱۴۰۴ برای اثبات نهایی تسلط (عبور از مرز ۷۵٪)',
        });
      }
    } else {
      currentSixD.coverageStatus = 'learning';
    }

    const topicDelta: MasteryDeltaWithTitle = {
      nodeId: node.id,
      topicTitle: node.topic,
      courseTitle: node.course,
      before,
      after,
      delta: after - before,
      reason: 'direct',
    };
    masteryDeltas.push(topicDelta);

    // الگوریتم FIRe (Fractional Implicit Repetition - MathAcademy):
    // وقتی داوطلب تست یک مبحث بالاتر را درست حل می‌کند، به پیش‌نیازهای مستقیم آن اعتبار مرور کسری داده می‌شود!
    const prereqEdges = dependencies.filter(
      (d) => d.source === node.id && d.relation === 'prerequisite'
    );
    for (const edge of prereqEdges) {
      const pNode = nodes.find((n) => n.id === edge.target);
      const pState = nextNodeStates[edge.target];
      if (pNode && pState && pState.masteryScore < 95) {
        const pBefore = pState.masteryScore;
        const implicitCredit = Math.max(3, Math.round(8 * edge.weight));
        const pAfter = Math.min(95, pBefore + implicitCredit);
        pState.masteryScore = pAfter;
        pState.proficiencyProbability = Number((pAfter / 100).toFixed(2));
        pState.memoryStability = Number((pState.memoryStability + 0.8).toFixed(1));
        pState.retrievability = Math.min(0.99, Number((pState.retrievability + 0.04).toFixed(2)));
        if (pState.coverageStatus === 'unseen') pState.coverageStatus = 'learning';

        masteryDeltas.push({
          nodeId: pNode.id,
          topicTitle: pNode.topic,
          courseTitle: pNode.course,
          before: pBefore,
          after: pAfter,
          delta: pAfter - pBefore,
          reason: 'fire_implicit_credit',
        });
      }
    }

    const cardIdx = nextCards.findIndex((c) => c.id === card.id);
    if (cardIdx !== -1) {
      nextCards[cardIdx] = {
        ...nextCards[cardIdx],
        fsrs: updatedFsrs,
        isLeech: false,
        dueAt: updatedFsrs.dueAt,
        priorityScore: Math.max(25, nextCards[cardIdx].priorityScore - 25),
      };
    }

    nextNodeStates = recomputeKnowledgeFrontier(nextNodeStates, nodes, dependencies);

    const xpEarned = card.attemptType === 'proof' ? 35 : 15;
    nextStats.totalAnswered += 1;
    nextStats.correctCount += 1;
    nextStats.xp += xpEarned;
    nextStats.coins += card.attemptType === 'proof' ? 25 : 10;

    // آپدیت مأموریت‌های روزانه (Duolingo Quests)
    const isHighYieldNode = (node.examYearsAppeared?.length ?? 0) >= 6;
    nextStats.dailyQuests = nextStats.dailyQuests.map((q) => {
      if (q.id === 'quest.evidence_3' && !q.completed) {
        const nextCurr = q.current + 1;
        const done = nextCurr >= q.target;
        if (done) nextStats.xp += q.xpReward;
        return { ...q, current: nextCurr, completed: done };
      }
      if (q.id === 'quest.high_yield' && isHighYieldNode && !q.completed) {
        const nextCurr = q.current + 1;
        const done = nextCurr >= q.target;
        if (done) nextStats.xp += q.xpReward;
        return { ...q, current: nextCurr, completed: done };
      }
      return q;
    });

    const fireImplicitCount = masteryDeltas.filter((d) => d.reason === 'fire_implicit_credit').length;
    const mentorMessage =
      card.attemptType === 'proof'
        ? `فوق‌العاده! سؤال قرنطینه کنکور ۱۴۰۴ در مبحث «${node.topic}» را با موفقیت حل کردی و تسلطت در این گره رسماً «اثبات‌شده (Proven)» ثبت شد.`
        : `پاسخ صحیح ثبت شد (+${xpEarned} XP). تسلط «${node.topic}» به ${after}٪ رسید` +
          (fireImplicitCount > 0
            ? ` و طبق الگوریتم FIRe (تکرار ضمنی کسری)، پیش‌نیاز این مبحث نیز به‌طور خودکار تقویت شد تا نیاز به مرورهای تکراری کم شود.`
            : `.`);

    return {
      nextNodeStates,
      nextCards,
      nextStats,
      snapshot,
      report: {
        attemptId,
        questionId: question.id,
        nodeId: node.id,
        nodeTitle: node.topic,
        wasCorrect: true,
        wasSkipped: false,
        confidence,
        errorType: 'none',
        konkorScoreChange: 3,
        xpEarned,
        isLeechTriggered: false,
        topicDelta,
        masteryDeltas,
        spawnedCards,
        proofUnlocked,
        mentorMessage,
        canRollbackAsSlip: false,
      },
    };
  }

  // ۳. حالت پاسخ غلط + تشخیص کارت چغر (Leech Detection - Anki/SuperMemo) + موج ۴لایه
  const updatedFsrs = isNightVerification ? card.fsrs : stepFSRS(card.fsrs, 1, now);
  const isLeechTriggered = updatedFsrs.lapses >= 2;

  const prereqEdges = dependencies.filter(
    (d) => d.source === node.id && d.relation === 'prerequisite'
  );
  const bridgeEdges = dependencies.filter(
    (d) => d.source === node.id && d.relation === 'cross_course'
  );

  const hasWeakPrereq = prereqEdges.some(
    (e) => (nextNodeStates[e.target]?.masteryScore ?? 0) < 60
  );
  let errorType: ErrorTypeClassification = 'concept_gap';
  if (confidence === 'high') {
    errorType = 'misread';
  } else if (hasWeakPrereq && prereqEdges.length > 0) {
    errorType = 'prerequisite_failure';
  }

  const before = currentSixD.masteryScore;
  const penalty = before === 0 ? 0 : Math.max(6, Math.round(before * 0.22));
  const after = before === 0 ? 12 : Math.max(12, before - penalty);

  currentSixD.masteryScore = after;
  currentSixD.proficiencyProbability = Number((after / 100).toFixed(2));
  currentSixD.memoryStability = updatedFsrs.stability;
  currentSixD.retrievability = updatedFsrs.retrievability;
  currentSixD.coverageStatus = 'weak';
  currentSixD.hasLeechCard = isLeechTriggered;
  currentSixD.rippleAlert = isLeechTriggered ? 'leech_suspended' : 'needs_remediation';

  const cardIdx = nextCards.findIndex((c) => c.id === card.id);
  if (cardIdx !== -1) {
    nextCards[cardIdx] = {
      ...nextCards[cardIdx],
      fsrs: updatedFsrs,
      isLeech: isLeechTriggered,
    };
  }

  const topicDelta: MasteryDeltaWithTitle = {
    nodeId: node.id,
    topicTitle: node.topic,
    courseTitle: node.course,
    before,
    after,
    delta: after - before,
    reason: 'direct',
  };
  masteryDeltas.push(topicDelta);

  // ساخت کارت دام طراح (لایه ۱)
  if (question.trapNote) {
    const trapCardId = `card.trap.${question.id}`;
    if (!nextCards.some((c) => c.id === trapCardId)) {
      nextCards.unshift({
        id: trapCardId,
        nodeId: node.id,
        cardType: 'trap_note',
        questionId: question.id,
        dueAt: now.toISOString(),
        priorityScore: 97,
        attemptType: 'diagnostic',
        fsrs: initFSRS(now),
        createdByRippleFrom: question.id,
      });
      spawnedCards.push({
        id: trapCardId,
        cardType: 'trap_note',
        nodeId: node.id,
        nodeTitle: node.topic,
        reason: 'لایه ۱ موج خطا: کارت مرور دام طراح کنکور',
      });
    }
  }

  // ساخت کارت مقایسه دو مفهوم متشابه
  const compTable =
    COMPARISON_TABLES[node.id] ||
    Object.values(COMPARISON_TABLES).find((ct) => ct.nodeB === node.id);
  if (compTable) {
    const compCardId = `card.comp.${compTable.id}`;
    if (!nextCards.some((c) => c.id === compCardId)) {
      nextCards.unshift({
        id: compCardId,
        nodeId: node.id,
        cardType: 'comparison_card',
        comparisonId: compTable.id,
        questionId: question.id,
        dueAt: now.toISOString(),
        priorityScore: 96,
        attemptType: 'diagnostic',
        fsrs: initFSRS(now),
        createdByRippleFrom: question.id,
      });
      spawnedCards.push({
        id: compCardId,
        cardType: 'comparison_card',
        nodeId: node.id,
        nodeTitle: compTable.title,
        reason: 'تفکیک دو مفهوم متشابه به دلیل افتادن در دام مفهومی',
      });
    }
  }

  // ساخت کارت درسنامه گام‌به‌گام ترمیمی (Remedial Lesson)
  if (lessons[node.id]) {
    const remCardId = `card.remedial.${node.id}`;
    if (!nextCards.some((c) => c.id === remCardId)) {
      nextCards.unshift({
        id: remCardId,
        nodeId: node.id,
        cardType: 'remedial_lesson',
        dueAt: now.toISOString(),
        priorityScore: 99,
        attemptType: 'diagnostic',
        fsrs: initFSRS(now),
        createdByRippleFrom: question.id,
      });
      spawnedCards.push({
        id: remCardId,
        cardType: 'remedial_lesson',
        nodeId: node.id,
        nodeTitle: node.topic,
        reason: isLeechTriggered
          ? 'هشدار کارت چغر (Leech): تعلیق تست تا مطالعه گام‌به‌گام درسنامه و ثبت امتیاز ۱ تا ۵'
          : 'درسنامه گام‌به‌گام تعاملی برای ترمیم شکاف پیش از تست مجدد',
      });
    }
  }

  // لایه ۳: پیش‌نیازها (Prerequisites) — ساخت کارت Probe
  for (const edge of prereqEdges) {
    const targetNode = nodes.find((n) => n.id === edge.target);
    const targetState = nextNodeStates[edge.target];
    if (targetNode && targetState) {
      const pBefore = targetState.masteryScore;
      const pPenalty = pBefore === 0 ? 0 : Math.max(3, Math.round(pBefore * 0.12 * edge.weight));
      const pAfter = pBefore === 0 ? 10 : Math.max(15, pBefore - pPenalty);
      targetState.masteryScore = pAfter;
      targetState.proficiencyProbability = Number((pAfter / 100).toFixed(2));
      targetState.rippleAlert = 'probe_queued';

      masteryDeltas.push({
        nodeId: targetNode.id,
        topicTitle: targetNode.topic,
        courseTitle: targetNode.course,
        before: pBefore,
        after: pAfter,
        delta: pAfter - pBefore,
        reason: 'prerequisite_probe',
      });

      const probeQ = questions.find((q) => q.nodeId === targetNode.id && !q.isQuarantinedProof);
      if (probeQ) {
        const probeCardId = `card.probe.${probeQ.id}`;
        if (!nextCards.some((c) => c.id === probeCardId)) {
          nextCards.unshift({
            id: probeCardId,
            nodeId: targetNode.id,
            cardType: 'diagnostic_probe',
            questionId: probeQ.id,
            dueAt: now.toISOString(),
            priorityScore: 95,
            attemptType: 'diagnostic',
            fsrs: initFSRS(now),
            createdByRippleFrom: question.id,
          });
          spawnedCards.push({
            id: probeCardId,
            cardType: 'diagnostic_probe',
            nodeId: targetNode.id,
            nodeTitle: targetNode.topic,
            reason: 'لایه ۳ موج خطا: تست تشخیصی پیش‌نیاز (Probe) برای راستی‌آزمایی پایه',
          });
        }
      }
    }
  }

  // لایه ۴: پل‌های بین‌درسی
  for (const edge of bridgeEdges) {
    const bridgeNode = nodes.find((n) => n.id === edge.target);
    const bridgeState = nextNodeStates[edge.target];
    if (bridgeNode && bridgeState && bridgeState.masteryScore > 0) {
      const bBefore = bridgeState.masteryScore;
      const bPenalty = Math.max(2, Math.round(bBefore * 0.08 * edge.weight));
      const bAfter = Math.max(15, bBefore - bPenalty);
      bridgeState.masteryScore = bAfter;
      bridgeState.proficiencyProbability = Number((bAfter / 100).toFixed(2));
      bridgeState.rippleAlert = 'shocked';

      masteryDeltas.push({
        nodeId: bridgeNode.id,
        topicTitle: bridgeNode.topic,
        courseTitle: bridgeNode.course,
        before: bBefore,
        after: bAfter,
        delta: bAfter - bBefore,
        reason: 'cross_course_bridge',
      });
    }
  }

  nextStats.totalAnswered += 1;
  nextStats.wrongCount += 1;

  const mentorMessage = isLeechTriggered
    ? `هشدار کارت چغر (Leech Card — الگوی Anki/SuperMemo): این تست بیش از یک بار غلط زده شد! برای جلوگیری از اتلاف وقت، تست تعلیق شد و درسنامه گام‌به‌گام «${node.topic}» باز گردید تا پس از مطالعه به آن از ۱ تا ۵ امتیاز دهی.`
    : `تشخیص موتور: ${
        errorType === 'misread'
          ? 'کژفهمی و افتادن در دام طراح با اطمینان بالا'
          : errorType === 'prerequisite_failure'
          ? 'نقص در پیش‌نیاز پایه'
          : 'شکاف مفهومی'
      }. کارت درسنامه گام‌به‌گام و تست تشخیصی پیش‌نیاز به ابتدای صف اضافه شد.`;

  return {
    nextNodeStates,
    nextCards,
    nextStats,
    snapshot,
    report: {
      attemptId,
      questionId: question.id,
      nodeId: node.id,
      nodeTitle: node.topic,
      wasCorrect: false,
      wasSkipped: false,
      confidence,
      errorType,
      konkorScoreChange: -1,
      xpEarned: 3,
      isLeechTriggered,
      topicDelta,
      masteryDeltas,
      spawnedCards,
      mentorMessage,
      canRollbackAsSlip: true,
    },
  };
}

/* ------------------------------------------------------------------ */
/* 6. Slip Rollback                                                   */
/* ------------------------------------------------------------------ */

export function rollbackSlipPenalty(
  snapshot: SnapshotForRollback,
  currentReport: RippleReport
): {
  restoredNodeStates: Record<string, LearnerSixDState>;
  restoredCards: ReviewCard[];
  restoredStats: UserStats;
  updatedReport: RippleReport;
} {
  const restoredNodeStates: Record<string, LearnerSixDState> = JSON.parse(
    JSON.stringify(snapshot.nodeStates)
  );
  const restoredCards: ReviewCard[] = JSON.parse(JSON.stringify(snapshot.cards));
  const restoredStats: UserStats = JSON.parse(JSON.stringify(snapshot.stats));

  restoredStats.totalAnswered += 1;
  restoredStats.wrongCount += 1;

  const target = restoredNodeStates[currentReport.nodeId];
  const before = target.masteryScore;
  const after = Math.max(before === 0 ? 0 : 20, before - 2);
  target.masteryScore = after;
  target.proficiencyProbability = Number((after / 100).toFixed(2));
  target.rippleAlert = null;

  const updatedReport: RippleReport = {
    ...currentReport,
    errorType: 'slip',
    canRollbackAsSlip: false,
    rolledBack: true,
    spawnedCards: [],
    masteryDeltas: [
      {
        nodeId: currentReport.nodeId,
        topicTitle: currentReport.nodeTitle,
        courseTitle: currentReport.topicDelta.courseTitle,
        before,
        after,
        delta: after - before,
        reason: 'direct',
      },
    ],
    mentorMessage: `خوداظهاری «بی‌دقتی چشمی (Slip)» ثبت شد! جریمه تسلط و موج خطا روی پیش‌نیازها به حالت قبل بازگردانی (Rollback) شد.`,
  };

  return {
    restoredNodeStates,
    restoredCards,
    restoredStats,
    updatedReport,
  };
}

/* ------------------------------------------------------------------ */
/* 7. Budget-Aware ROI Planner + Multi-Year Exam Frequency Boost      */
/* ------------------------------------------------------------------ */

export function classifyNodeCourseCategory(
  node: KnowledgeNode
): 'conceptual' | 'quantitative' | 'language' {
  if (node.id === 'bus.english_eshraghi' || node.course.includes('زبان')) {
    return 'language';
  }
  const quantIds = new Set([
    'stats.scales',
    'stats.anova',
    'stats.regression',
    'ind.or_simplex_duality',
    'ind.pom_eoq_mrp',
    'ind.mcdm_dea_queue',
    'bus.econ_nazari',
    'bus.math_stats_ranjbaran_tourani',
  ]);
  if (quantIds.has(node.id)) {
    return 'quantitative';
  }
  return 'conceptual';
}

export function getNodeEffectiveBranchCoefficient(
  node: KnowledgeNode,
  branch: MajorExamBranch = 'business'
): number {
  if (branch === 'phd_all') {
    return node.examCoefficient;
  }
  if (branch === 'business') {
    if (node.id.startsWith('mkt.')) return 4;
    if (node.id === 'ind.pom_eoq_mrp') return 0; // مدیریت تولید در بازرگانی ضریب ۰ دارد
    if (node.id === 'ind.or_simplex_duality' || node.id === 'ind.mcdm_dea_queue') return 2;
    if (node.id === 'bus.english_eshraghi' || node.id.startsWith('mb.')) return 3;
    return node.examCoefficient;
  }
  if (branch === 'industrial') {
    if (node.id.startsWith('mkt.')) return 0; // بازاریابی در مدیریت صنعتی ضریب ۰ دارد
    if (node.id === 'ind.or_simplex_duality' || node.id === 'ind.mcdm_dea_queue') return 3; // تحقیق در عملیات ضریب ۳ در صنعتی
    if (node.id === 'ind.pom_eoq_mrp') return 2;
    if (node.id === 'bus.english_eshraghi' || node.id.startsWith('mb.')) return 3;
    return node.examCoefficient;
  }
  if (branch === 'technology') {
    if (node.id.startsWith('mkt.')) return 0; // بازاریابی در مدیریت تکنولوژی ضریب ۰ دارد
    if (node.id === 'ind.or_simplex_duality' || node.id === 'ind.mcdm_dea_queue') return 2;
    if (node.id === 'ind.pom_eoq_mrp') return 2;
    if (node.id.startsWith('inno.')) return 4;
    if (node.id === 'bus.english_eshraghi' || node.id.startsWith('mb.')) return 3;
    return node.examCoefficient;
  }
  return node.examCoefficient;
}

export function calculateROIRankings(
  nodeStates: Record<string, LearnerSixDState>,
  activeTracks: TrackId[],
  nodes: KnowledgeNode[],
  questions: QuestionItem[],
  studyPrefs?: {
    branch?: MajorExamBranch;
    category?: StudyCourseCategory;
    dailyStudyHours?: number;
  }
): ROINodeRanking[] {
  const freqInsights = analyzeMultiYearExamFrequency(nodes, questions);
  const branch = studyPrefs?.branch || 'business';
  const category = studyPrefs?.category || 'all';

  const filteredNodes = nodes.filter((n) => {
    const trackMatch = n.track === 'common' || activeTracks.includes(n.track);
    if (!trackMatch) return false;
    const effCoeff = getNodeEffectiveBranchCoefficient(n, branch);
    if (effCoeff === 0) return false; // حذف دروس ضریب صفر گرایش انتخابی از برنامه مطالعه
    if (category !== 'all' && classifyNodeCourseCategory(n) !== category) {
      return false;
    }
    return true;
  });

  const nodesToRank =
    filteredNodes.length > 0
      ? filteredNodes
      : nodes.filter((n) => getNodeEffectiveBranchCoefficient(n, branch) > 0);

  return nodesToRank
    .map((node) => {
      const st = nodeStates[node.id] || {
        nodeId: node.id,
        masteryScore: 0,
        proficiencyProbability: 0,
        memoryStability: 0,
        retrievability: 0,
        speedFluency: 0,
        coverageStatus: 'unseen',
        evidenceCount: 0,
        isUnlockedInFrontier: true,
      };
      const freq = freqInsights[node.id];
      const effCoeff = getNodeEffectiveBranchCoefficient(node, branch);

      const gap = Math.max(0.08, 1 - st.proficiencyProbability);
      const forgettingUrgency =
        st.coverageStatus === 'unseen' ? 0.5 : Math.max(0.1, 1 - st.retrievability);

      // ارزش کنکوری مبحث = ضریب مؤثر گرایش × وزن تاریخی × ضریب تکرار چندساله
      const multiYearMultiplier = freq.isHighYieldCritical ? 1.35 : 1.0;
      const examValue = effCoeff * node.historicalWeight * multiYearMultiplier;

      let statusMultiplier = 1.0;
      let urgencyReason = freq.isHighYieldCritical
        ? `تکرار در ${freq.appearanceCount} دوره کنکور (ضریب ${effCoeff})`
        : `بودجه‌بندی کنکور (${freq.appearanceCount} دوره تکرار · ضریب ${effCoeff})`;

      if (st.hasLeechCard || st.rippleAlert === 'leech_suspended') {
        statusMultiplier = 1.75;
        urgencyReason = 'دارای کارت چغر (Leech) — نیازمند مطالعه گام‌به‌گام درسنامه';
      } else if (st.rippleAlert === 'probe_queued') {
        statusMultiplier = 1.65;
        urgencyReason = 'نیازمند تست تشخیصی پیش‌نیاز (لایه ۳ موج خطا)';
      } else if (st.rippleAlert === 'needs_remediation') {
        statusMultiplier = 1.55;
        urgencyReason = 'نیازمند درسنامه تعاملی و امتیازدهی ۱ تا ۵';
      } else if (st.coverageStatus === 'needs_proof') {
        statusMultiplier = 1.5;
        urgencyReason = 'آماده اثبات نهایی با تست قرنطینه ۱۴۰۴';
      } else if (st.coverageStatus === 'unseen' && st.isUnlockedInFrontier) {
        statusMultiplier = 1.3;
        urgencyReason = `آماده شروع در مرز دانش (${freq.importanceBadge})`;
      }

      const rawRoi =
        ((examValue * gap * (1 + forgettingUrgency) * statusMultiplier) /
          Math.max(1, node.estimatedStudyHours)) *
        1.8;
      const roiScore = Math.min(99, Math.round(rawRoi));
      const expectedGainPercent = Math.round(gap * freq.shareOfExamPercent * 1.4);

      return {
        node,
        state: st,
        roiScore,
        expectedGainPercent: Math.max(3, expectedGainPercent),
        urgencyReason,
        examFrequencyInsight: freq,
      };
    })
    .sort((a, b) => b.roiScore - a.roiScore);
}

/* ------------------------------------------------------------------ */
/* 8. Adaptive Placement Onboarding                                   */
/* ------------------------------------------------------------------ */

export const PLACEMENT_BOTTLENECK_QUESTIONS = [
  'q.sm.rbv.1',
  'q.mb.cont.1',
  'q.stats.anova.1',
  'q.mkt.brand.1',
  'q.inno.ambi.1',
];

export function applyPlacementResults(
  results: { questionId: string; wasCorrect: boolean }[],
  currentStates: Record<string, LearnerSixDState>,
  nodes: KnowledgeNode[],
  dependencies: NodeDependency[],
  questions: QuestionItem[]
): {
  updatedStates: Record<string, LearnerSixDState>;
  deltas: MasteryDeltaWithTitle[];
} {
  let updatedStates: Record<string, LearnerSixDState> = JSON.parse(
    JSON.stringify(currentStates)
  );
  const deltas: MasteryDeltaWithTitle[] = [];

  for (const res of results) {
    const q = questions.find((item) => item.id === res.questionId);
    if (!q) continue;
    const node = nodes.find((n) => n.id === q.nodeId);
    if (!node) continue;

    const st = updatedStates[node.id];
    const before = st.masteryScore;
    const after = res.wasCorrect ? Math.max(before, 78) : Math.max(before, 25);
    st.masteryScore = after;
    st.proficiencyProbability = Number((after / 100).toFixed(2));
    st.memoryStability = res.wasCorrect ? 7.5 : 1.2;
    st.retrievability = res.wasCorrect ? 0.94 : 0.72;
    st.coverageStatus = after >= 75 ? 'needs_proof' : 'weak';
    st.evidenceCount += 2;
    st.isUnlockedInFrontier = true;

    deltas.push({
      nodeId: node.id,
      topicTitle: node.topic,
      courseTitle: node.course,
      before,
      after,
      delta: after - before,
      reason: 'direct',
    });

    if (res.wasCorrect) {
      const prereqs = dependencies.filter((d) => d.source === node.id);
      for (const edge of prereqs) {
        const pNode = nodes.find((n) => n.id === edge.target);
        const pState = updatedStates[edge.target];
        if (pNode && pState && pState.masteryScore < 72) {
          const pBefore = pState.masteryScore;
          pState.masteryScore = 72;
          pState.proficiencyProbability = 0.72;
          pState.memoryStability = 6.0;
          pState.retrievability = 0.91;
          pState.coverageStatus = 'learning';
          pState.isUnlockedInFrontier = true;
          deltas.push({
            nodeId: pNode.id,
            topicTitle: pNode.topic,
            courseTitle: pNode.course,
            before: pBefore,
            after: 72,
            delta: 72 - pBefore,
            reason: 'placement_propagation',
          });
        }
      }
    }
  }

  updatedStates = recomputeKnowledgeFrontier(updatedStates, nodes, dependencies);
  return { updatedStates, deltas };
}

/* ------------------------------------------------------------------ */
/* 9. Agent Content Ingestion Validator (Zero-Guessing Policy)        */
/* ------------------------------------------------------------------ */

export interface AgentContentPackage {
  node: {
    id: string;
    track: TrackId;
    course: string;
    chapter: string;
    topic: string;
    sourceBookCitation: string;
    examYearsAppeared: number[];
    examCoefficient: number;
    historicalWeight: number;
    estimatedStudyHours: number;
    layer: 0 | 1 | 2 | 3;
    prerequisiteNodeIds: string[];
  };
  lesson: {
    summary: string;
    microSteps: { stepNumber: number; title: string; content: string }[];
    conceptDescriptors: { concept: string; descriptor: string; answer: string }[];
    konkoorTips: string[];
    keyTerms: string[];
    conceptCheck: {
      prompt: string;
      options: [string, string];
      correctIndex: 0 | 1;
      explanation: string;
    };
  };
  questions: {
    id: string;
    examYear: number;
    sourceReference: string;
    isQuarantinedProof?: boolean;
    text: string;
    options: [string, string, string, string];
    correctOption: 0 | 1 | 2 | 3;
    explanation: string;
    trapNote: string;
  }[];
}

export function validateAgentContentPackage(rawJson: string): {
  valid: boolean;
  errors: string[];
  parsed?: AgentContentPackage;
} {
  const errors: string[] = [];
  let data: any;

  try {
    data = JSON.parse(rawJson);
  } catch (err: any) {
    return {
      valid: false,
      errors: [`خطای ساختاری JSON: متن واردشده یک JSON استاندارد نیست (${err.message}).`],
    };
  }

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['ریشه بسته محتوا باید یک شیء JSON شامل node، lesson و questions باشد.'] };
  }

  // ۱. بررسی دقیق گره دانش (Node) — بدون هیچ حدس
  const n = data.node;
  if (!n) {
    errors.push('بخش "node" در فایل وجود ندارد.');
  } else {
    if (!n.id || typeof n.id !== 'string' || !n.id.includes('.')) {
      errors.push('فیلد "node.id" باید شناسه استاندارد نقطه‌دار باشد (مثلاً "ob.motivation" یا "stats.nonparam").');
    }
    if (!['common', 'business', 'industrial', 'strategy', 'technology'].includes(n.track)) {
      errors.push('فیلد "node.track" باید یکی از مقادیر common، business، industrial، strategy یا technology باشد.');
    }
    if (!n.course || !n.chapter || !n.topic) {
      errors.push('فیلدهای "course" (نام درس)، "chapter" (نام فصل) و "topic" (نام دقیق مبحث) الزامی هستند.');
    }
    if (!n.sourceBookCitation || String(n.sourceBookCitation).length < 10) {
      errors.push('قانون عدم حدس: فیلد "node.sourceBookCitation" (نام دقیق کتاب و نویسنده مرجع دانشگاهی) الزامی است.');
    }
    if (!Array.isArray(n.examYearsAppeared) || n.examYearsAppeared.length === 0) {
      errors.push('فیلد "node.examYearsAppeared" باید آرایه‌ای از سال‌های شمسی طرح سؤال در کنکور باشد (مثلاً [1399, 1401, 1403]).');
    }
  }

  // ۲. بررسی دقیق درسنامه (Lesson)
  const l = data.lesson;
  if (!l) {
    errors.push('بخش "lesson" در فایل وجود ندارد.');
  } else {
    if (!l.summary || String(l.summary).length < 40) {
      errors.push('فیلد "lesson.summary" باید خلاصه جامع و دقیق مبحث (حداقل ۴۰ کاراکتر) باشد.');
    }
    if (!Array.isArray(l.microSteps) || l.microSteps.length < 2) {
      errors.push('فیلد "lesson.microSteps" باید حداقل شامل ۲ گام آموزشی خردشده (title و content) باشد.');
    }
    if (!Array.isArray(l.conceptDescriptors) || l.conceptDescriptors.length < 1) {
      errors.push('فیلد "lesson.conceptDescriptors" باید حداقل شامل ۱ زوج مفهوم-توصیف‌گر (الگوی RemNote) باشد.');
    }
    if (!Array.isArray(l.konkoorTips) || l.konkoorTips.length < 1) {
      errors.push('فیلد "lesson.konkoorTips" باید حداقل شامل ۱ نکته یا دام طراح کنکور باشد.');
    }
    if (
      !l.conceptCheck ||
      !l.conceptCheck.prompt ||
      !Array.isArray(l.conceptCheck.options) ||
      l.conceptCheck.options.length !== 2 ||
      (l.conceptCheck.correctIndex !== 0 && l.conceptCheck.correctIndex !== 1)
    ) {
      errors.push('بخش "lesson.conceptCheck" باید دارای صورت سؤال، دقیقاً ۲ گزینه و correctIndex (0 یا 1) باشد.');
    }
  }

  // ۳. بررسی دقیق سؤالات چهارگزینه‌ای (Questions)
  const qs = data.questions;
  if (!Array.isArray(qs) || qs.length === 0) {
    errors.push('بخش "questions" باید آرایه‌ای شامل حداقل ۱ تست چهارگزینه‌ای استاندارد کنکور باشد.');
  } else {
    qs.forEach((q: any, idx: number) => {
      if (!q.id || !q.text) {
        errors.push(`سؤال شماره ${idx + 1}: فیلد "id" و "text" الزامی است.`);
      }
      if (!q.examYear || q.examYear < 1385 || q.examYear > 1406) {
        errors.push(`سؤال شماره ${idx + 1}: فیلد "examYear" باید سال معتبر شمسی کنکور (بین ۱۳۸۵ تا ۱۴۰۶) باشد.`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        errors.push(`سؤال شماره ${idx + 1}: آرایه "options" باید دقیقاً دارای ۴ گزینه باشد.`);
      }
      if (typeof q.correctOption !== 'number' || q.correctOption < 0 || q.correctOption > 3) {
        errors.push(`سؤال شماره ${idx + 1}: فیلد "correctOption" باید عدد ۰ تا ۳ (اندیس گزینه صحیح) باشد.`);
      }
      if (!q.explanation || !q.trapNote) {
        errors.push(`سؤال شماره ${idx + 1}: فیلدهای "explanation" (پاسخ تشریحی) و "trapNote" (دام طراح) الزامی هستند.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? (data as AgentContentPackage) : undefined,
  };
}
