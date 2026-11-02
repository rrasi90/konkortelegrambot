/**
 * موتور یادگیری تطبیقی — پیاده‌سازی «موج ضربه خطا» چهارلایه
 * Pure, deterministic decision logic. No I/O, no framework.
 *
 * لایهٔ ۱: بازنشانی خودِ کارت + ساخت کارت دام (Direct Reset)
 * لایهٔ ۲: شوک به کل فصل و تست‌های هم‌خانواده (Sibling Shock)
 * لایهٔ ۳: بازگشت به پیش‌نیاز (Prerequisite Backtracking)
 * لایهٔ ۴: پل بین‌درسی (Cross-Course Bridge)
 */
import {
  DEPENDENCY_RELATIONS,
  TRACK_IDS,
  isNodeDependency,
  isQuestion,
  isTrackId,
} from '@ael/contracts';
import type {
  AnswerInput,
  CardAction,
  CardType,
  DependencyRelation,
  EngineResult,
  KnowledgeNode,
  LearnerSkillState,
  MasteryDelta,
  MasteryStatus,
  NodeDependency,
  Question,
  ReviewCard,
  RippleReport,
  TrackId,
  UserNodeMastery,
} from '@ael/contracts';
import {
  Rating,
  PROOF_READINESS_PROFICIENCY,
  calculateRetrievability,
  classifyErrorType,
  initializeFSRSState,
  scheduleNextFSRS,
  update6DLearnerSkillState,
} from './fsrs';
import type {
  ErrorTypeClassification,
  SkillEvidenceInput,
  SixDimensionalLearnerState,
} from './fsrs';

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

export interface EngineConfig {
  /** سهم رشد تسلط پس از پاسخ درست: M + (100 - M) × gain */
  masteryGain: number; // 0.15
  /** ضریب کسر تسلط پس از پاسخ غلط: M × penalty */
  masteryPenalty: number; // 0.75
  /** ضریب اثر خطا بر گره وابسته: M_linked × (1 − linkedPenalty × w) */
  linkedPenalty: number; // 0.25
  /** آستانهٔ فعال‌سازی لایهٔ ۲ (شوک هم‌خانواده‌ها) */
  rippleThreshold: number; // 60
  /** ضریب نصف‌کردن فاصلهٔ کارت‌های هم‌خانواده */
  siblingIntervalFactor: number; // 0.5
  /** کاهش ضریب سهولت کارت پس از پاسخ غلط */
  easePenalty: number; // 0.20
  easeMin: number; // 1.3
  easeMax: number; // 2.8
  /** رشد سهولت پس از پاسخ درست */
  easeGain: number; // 0.05
  /** سقف کارت‌هایی که موج خطا می‌تواند به برنامهٔ فردا اضافه کند */
  rippleCapacity: number; // 6
}

/** Safe default for repair restoration: avoids undefined intervals */
export const DEFAULT_PREVIOUS_INTERVAL_DAYS = 1;

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  masteryGain: 0.15,
  masteryPenalty: 0.75,
  linkedPenalty: 0.25,
  rippleThreshold: 60,
  siblingIntervalFactor: 0.5,
  easePenalty: 0.2,
  easeMin: 1.3,
  easeMax: 2.8,
  easeGain: 0.05,
  rippleCapacity: 6,
};

/**
 * §8.6 — قواعد روشن موج خطا (Error Wave). اثر یک خطا بر مهارت‌های دیگر فقط با این شرایط مجاز است:
 *  1. پاسخ غلطِ غیرلغزش باشد (slip موج را کاملاً متوقف می‌کند — نه کسر تسلط، نه سرایت).
 *  2. تسلط گره پس از کسر، زیر rippleThreshold (۶۰) رفته باشد — یک خطای واحد روی گرهٔ قوی موج نمی‌سازد.
 *  3. سرایت به هم‌خانواده‌ها: فقط کارت سؤالِ همان گره، موعد جلوافتاده با siblingIntervalFactor (۰٫۵)،
 *     سقف rippleCapacity (۶) کارت در هر موج؛ مازاد deferred ثبت و هیچ داده‌ای حذف نمی‌شود.
 *  4. سرایت به گره‌های وابسته: کسر linkedPenalty × وزن یال، نه حذف مهارت.
 *  5. فاصلهٔ اصلی هم‌خانواده فقط بار اول در previousIntervalDays ذخیره می‌شود (تکرار موج، مبنا را خراب نمی‌کند).
 *  ضمناً طبقه‌بندی خطا در نبودِ شاهد کافی «unknown» است نه concept_gap — هر خطا ضعف قطعی فصل نیست.
 */
export const ERROR_WAVE_RULES = {
  slipStopsWave: true,
  rippleActivatesBelowMastery: 60,
  siblingIntervalFactor: 0.5,
  rippleCapacityPerWave: 6,
  linkedNodePenaltyShare: 0.25,
  insufficientEvidenceLabel: 'unknown',
} as const;

export class EngineError extends Error {}

/* ------------------------------------------------------------------ */
/* Domain state                                                        */
/* ------------------------------------------------------------------ */

export interface EngineUserState {
  userId: string;
  activeTracks: TrackId[];
}

/** متادیتای مهارت خرد (از skills.json) — برای تشخیص و کارت مقایسه */
export interface SkillMeta {
  id: string;
  nodeId: string;
  confusableWith: string[];
  prerequisites: string[];
  estimatedMinutes: number;
}

/** وضعیت موتور — همهٔ دادهٔ لازم برای تصمیم، بدون I/O */
export interface EngineState {
  config: EngineConfig;
  nodes: Map<string, KnowledgeNode>;
  dependencies: NodeDependency[];
  questions: Map<string, Question>;
  /** mastery بر حسب گره، فقط برای گره‌های دیده‌شده */
  mastery: Map<string, number>;
  cards: ReviewCard[];
  /** مهارت‌های خرد بر حسب شناسهٔ مهارت (اختیاری؛ از skills.json) */
  skills?: Map<string, SkillMeta>;
  /** وضعیت شش‌بعدی قبلی هر مهارت (اختیاری؛ از learner_skill_states) */
  skillStates?: Map<string, LearnerSkillState>;
}

export const DEFAULT_MASTERY = 50;

export function statusFromMastery(score: number): MasteryStatus {
  if (score < 40) return 'weak';
  if (score < 60) return 'unstable';
  if (score < 85) return 'learning';
  return 'mastered';
}

export function masteryOf(state: EngineState, nodeId: string): number {
  return state.mastery.get(nodeId) ?? DEFAULT_MASTERY;
}

function cardIdFor(userId: string, type: CardType, questionId: string): string {
  return `${userId}:${type}:${questionId}`;
}

export function questionCardId(userId: string, questionId: string): string {
  return cardIdFor(userId, 'question', questionId);
}

export function trapCardId(userId: string, questionId: string): string {
  return cardIdFor(userId, 'trap_note', questionId);
}

export function comparisonCardId(userId: string, questionId: string): string {
  return `${userId}:comparison:${questionId}`;
}

/** مهارتِ متصل به یک گرهٔ دانش (در صورت وجود در skills.json) */
export function skillMetaForNode(state: EngineState, nodeId: string): SkillMeta | undefined {
  if (!state.skills) return undefined;
  for (const skill of state.skills.values()) {
    if (skill.nodeId === nodeId) return skill;
  }
  return undefined;
}

/** ضعیف‌ترین پیش‌نیازِ یک مهارت — ورودی تشخیص خطا */
function weakestPrerequisiteMastery(state: EngineState, meta: SkillMeta | undefined): number | undefined {
  if (!meta || meta.prerequisites.length === 0) return undefined;
  const values: number[] = [];
  for (const skillId of meta.prerequisites) {
    const prereq = state.skills?.get(skillId);
    if (!prereq) continue;
    const m = prereq.nodeId ? state.mastery.get(prereq.nodeId) : undefined;
    if (m !== undefined) values.push(m);
  }
  // هیچ پیش‌نیاز سنجیده‌شده ⇒ undefined (نه ۵۰ ساختگی)
  if (values.length === 0) return undefined;
  return Math.min(...values);
}

function clone<T>(x: T): T {
  return structuredClone(x);
}

/* ------------------------------------------------------------------ */
/* Answer application — the core loop                                  */
/* ------------------------------------------------------------------ */

export function applyAnswer(
  state: EngineState,
  input: AnswerInput,
  user: EngineUserState,
): EngineResult {
  const cfg = state.config;
  const question = state.questions.get(input.questionId);
  if (!question) {
    throw new EngineError(`سؤال ناشناخته: ${input.questionId}`);
  }
  if (input.selectedOption < 0 || input.selectedOption >= question.options.length) {
    throw new EngineError('گزینهٔ نامعتبر');
  }
  const node = state.nodes.get(question.nodeId);
  if (!node) {
    throw new EngineError(`گره ناشناخته: ${question.nodeId}`);
  }
  const now = new Date(input.answeredAt ?? Date.now());

  const wasCorrect = input.selectedOption === question.correctOption;
  const isProof = input.attemptType === 'proof';

  /* ---------- طبقه‌بندی خطا (مدل ۶ بعدی — §8.6 ده علت، قواعد صریح) ---------- */
  const skillMeta = skillMetaForNode(state, question.nodeId);
  // §8.6 سیگنال‌های افزودنی: بازیابی FSRS، تسلط هم‌خانواده‌های مفهومی، دام و محاسبه‌بودن
  const priorCard = state.cards.find(
    (c) => c.id === questionCardId(user.userId, question.id),
  );
  const priorFsrs = priorCard?.fsrs;
  const priorReviewTime = priorFsrs ? Date.parse(priorFsrs.lastReviewedAt) : Number.NaN;
  const elapsedDays =
    Number.isFinite(priorReviewTime) && priorFsrs
      ? Math.max(0, (now.getTime() - priorReviewTime) / 86_400_000)
      : 0;
  const currentMemoryRetrievability =
    priorFsrs && priorFsrs.stability > 0
      ? calculateRetrievability(priorFsrs.stability, elapsedDays)
      : undefined;
  const nodeForQ = state.nodes.get(question.nodeId);
  // §8.6: فقط هم‌خانواده‌هایی که واقعاً سنجیده شده‌اند وارد می‌شوند. قبلاً
  // masteryOf برای گره‌های ندیده‌شده ۵۰ برمی‌گرداند و قاعدهٔ ۴ (م<۶۰) برای هر
  // سؤال دام‌دار آتش می‌گرفت: theory_confusion به‌جای misconception/unknown.
  const siblingMasteries = nodeForQ
    ? [...state.nodes.values()]
        .filter(
          (n) =>
            n.id !== question.nodeId &&
            n.chapter === nodeForQ.chapter &&
            n.course === nodeForQ.course,
        )
        .map((n) => state.mastery.get(n.id))
        .filter((m): m is number => m !== undefined)
    : [];
  const requiresCalculation = /محاسبه|چقدرت? است|مقدار|حاصل/.test(question.text);
  const evidence: SkillEvidenceInput = {
    wasCorrect,
    responseTimeMs: input.responseTimeMs,
    expectedTimeMs: question.expectedTimeMs,
    currentMastery: state.mastery.get(question.nodeId),
    prerequisiteMastery: weakestPrerequisiteMastery(state, skillMeta),
    confidenceRating: input.confidenceRating,
    // خوداظهاری slip قبل از طبقه‌بندی ست می‌شود تا محافظ §8.2 شامل حالت خودکار هم بشود
    isSlip: !wasCorrect && input.selfReport === 'slip',
    requiresCalculation,
    trapNote: question.trapNote,
    siblingMasteries,
    memoryRetrievability: currentMemoryRetrievability,
  };
  // خوداظهاری کاربر اولویت دارد؛ در نبود آن موتور طبقه‌بندی می‌کند
  const errorType: ErrorTypeClassification = !wasCorrect
    ? input.selfReport === 'slip'
      ? 'slip'
      : input.selfReport === 'didnt_know'
        ? 'concept_gap'
        : classifyErrorType(evidence)
    : 'none';
  // لغزش (slip) شاهدِ شکاف مفهومی نیست؛ موج سرایت متوقف می‌شود
  const suppressRipple = !wasCorrect && errorType === 'slip';
  // §8.2: لغزش (خوداظهاری یا تشخیص خودکار) شایستگی ۶بعدی را کم نمی‌کند
  evidence.isSlip = suppressRipple;

  const masteryUpdates = new Map<string, UserNodeMastery>();
  const cardUpdates = new Map<string, ReviewCard>();
  const createdCards = new Map<string, ReviewCard>();
  const actions: CardAction[] = [];

  /* ---------- لایهٔ ۱: خودِ کارت با زمان‌بندی FSRS ---------- */
  const qCardId = questionCardId(user.userId, question.id);
  let qCard = state.cards.find((c) => c.id === qCardId);
  if (!qCard) {
    qCard = {
      id: qCardId,
      userId: user.userId,
      nodeId: question.nodeId,
      cardType: 'question',
      questionId: question.id,
      dueAt: now.toISOString(),
      intervalDays: 1,
      ease: 2.5,
      isRepair: false,
      timesSeen: 0,
      timesCorrect: 0,
    };
    createdCards.set(qCard.id, qCard);
  }

  // درجهٔ FSRS: درست → Good (با اطمینان بالا → Easy)؛ غلط → Again
  const fsrsRating = wasCorrect
    ? input.confidenceRating !== undefined && input.confidenceRating >= 4
      ? Rating.Easy
      : Rating.Good
    : Rating.Again;
  const nextFsrs = qCard.fsrs
    ? scheduleNextFSRS(qCard.fsrs, fsrsRating, now)
    : initializeFSRSState(fsrsRating, now);
  // وضعیت ترمیم پیش از شاخهٔ پاسخ درست (که پرچم را پاک می‌کند) نگه داشته می‌شود
  const wasRepairCard = qCard.isRepair;

  let trapCardCreated = false;
  if (!wasCorrect) {
    // بازنشانی مستقیم: موعد FSRS (لغزش هم موعد کوتاه می‌گیرد) + کاهش سهولت برای سازگاری
    const before = clone(qCard);
    qCard.ease = Math.max(cfg.easeMin, qCard.ease - cfg.easePenalty);
    qCard.intervalDays = nextFsrs.intervalDays;
    qCard.dueAt = nextFsrs.dueAt;
    qCard.timesSeen += 1;
    qCard.isRepair = false;
    if (!createdCards.has(qCard.id)) cardUpdates.set(qCard.id, qCard);
    if (before.intervalDays !== qCard.intervalDays) {
      actions.push({
        cardId: qCard.id,
        kind: 'reset_failed_card',
        payload: {
          nodeId: question.nodeId,
          fromInterval: before.intervalDays,
          toInterval: qCard.intervalDays,
        },
      });
    }

    // کارت دام تستی (بدون تکرار) — فاصلهٔ ثابت، مشمول FSRS نیست
    if (question.trapNote) {
      const tCardId = trapCardId(user.userId, question.id);
      if (!state.cards.some((c) => c.id === tCardId)) {
        const trapCard: ReviewCard = {
          id: tCardId,
          userId: user.userId,
          nodeId: question.nodeId,
          cardType: 'trap_note',
          questionId: question.id,
          trapCardId: tCardId,
          dueAt: addDays(now, 1).toISOString(),
          intervalDays: 1,
          ease: 2.5,
          isRepair: false,
          timesSeen: 0,
          timesCorrect: 0,
        };
        createdCards.set(tCardId, trapCard);
        trapCardCreated = true;
        actions.push({
          cardId: tCardId,
          kind: 'create_trap_card',
          payload: { nodeId: question.nodeId, dueAt: trapCard.dueAt },
        });
      }
    }
  } else {
    // رشد فاصلهٔ مرور با FSRS
    const wasRepair = wasRepairCard;
    const prevInterval = qCard.intervalDays;
    qCard.ease = Math.min(cfg.easeMax, qCard.ease + cfg.easeGain);
    qCard.intervalDays = nextFsrs.intervalDays;
    qCard.dueAt = nextFsrs.dueAt;
    // اگر کارتِ ترمیمی درست جواب داده شد، فاصلهٔ قبلی را به‌جای رشد تازه برمی‌گردانیم
    if (wasRepair) {
      const restoredInterval = qCard.previousIntervalDays ?? DEFAULT_PREVIOUS_INTERVAL_DAYS;
      qCard.intervalDays = restoredInterval;
      qCard.dueAt = addDays(now, restoredInterval).toISOString();
      qCard.isRepair = false;
      qCard.previousIntervalDays = undefined;
    }
    qCard.timesSeen += 1;
    qCard.timesCorrect += 1;
    if (!createdCards.has(qCard.id)) cardUpdates.set(qCard.id, qCard);
    actions.push({
      cardId: qCard.id,
      kind: 'grow_interval',
      payload: {
        nodeId: question.nodeId,
        fromInterval: prevInterval,
        toInterval: qCard.intervalDays,
      },
    });
  }
  // در کارت ترمیمی، موعد و فاصلهٔ بازگردانده‌شده باید در وضعیت FSRS هم منعکس شود
  qCard.fsrs = { ...nextFsrs, ...(wasRepairCard ? { dueAt: qCard.dueAt, intervalDays: qCard.intervalDays } : {}) };

  /* ---------- لایهٔ ۲: تسلط فصل + شوک هم‌خانواده‌ها (لغزش معاف است) ---------- */
  const before = masteryOf(state, question.nodeId);
  const after = wasCorrect
    ? round1(before + (100 - before) * cfg.masteryGain)
    : suppressRipple
      ? before // لغزش: بدون کسر — شاهد شکاف نیست
      : round1(before * cfg.masteryPenalty);
  if (after !== before) state.mastery.set(question.nodeId, after);
  const topicDelta: MasteryDelta = {
    nodeId: question.nodeId,
    before,
    after,
    reason: 'direct',
  };
  if (after !== before) {
    masteryUpdates.set(question.nodeId, {
      nodeId: question.nodeId,
      mastery: after,
      status: statusFromMastery(after),
      // lastErrorAt فقط با پاسخ غلط معنی دارد؛ در پاسخ درست دست نمی‌زنیم
      ...(wasCorrect ? {} : { lastErrorAt: now.toISOString() }),
    });
  }

  let siblingShock: RippleReport['siblingShock'] = null;
  if (!wasCorrect && !suppressRipple && after < cfg.rippleThreshold) {
    const siblings = state.cards.filter(
      (c) =>
        c.nodeId === question.nodeId &&
        c.id !== qCardId &&
        c.cardType === 'question' &&
        new Date(c.dueAt).getTime() > now.getTime(),
    );
    siblings.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    const applied: string[] = [];
    let deferred = 0;
    for (const sib of siblings) {
      if (applied.length >= cfg.rippleCapacity) {
        deferred += 1;
        continue;
      }
      const beforeSib = clone(sib);
      const newInterval = Math.max(1, Math.floor(beforeSib.intervalDays * cfg.siblingIntervalFactor));
      sib.intervalDays = newInterval;
      // فاصلهٔ اصلی فقط بار اول ذخیره شود تا شوک‌های تکراری آن را بازنویسی نکنند
      if (!sib.isRepair) sib.previousIntervalDays = beforeSib.intervalDays;
      sib.dueAt = addDays(now, newInterval).toISOString();
      sib.isRepair = true;
      if (!createdCards.has(sib.id) && !cardUpdates.has(sib.id)) cardUpdates.set(sib.id, sib);
      applied.push(sib.id);
    }
    siblingShock = { cardIds: applied, applied: applied.length, deferred };
    if (applied.length > 0) {
      actions.push({
        cardId: qCardId,
        kind: 'reschedule_siblings',
        payload: { nodeId: question.nodeId, cardIds: applied },
      });
    }
  }

  /* ---------- لایهٔ ۳ و ۴: بررسی تشخیصی به‌جای کسر فوری ---------- */
  // خطا یک «شاهد اولیه» است، نه حکم قطعی؛ تسلط پیش‌نیاز/پل کاهش نمی‌یابد،
  // به‌جای آن گره نیازمند سؤال تشخیصی (Probe) علامت می‌خورد.
  const prerequisites: { nodeId: string; from: number; to: number }[] = [];
  const bridges: { nodeId: string; from: number; to: number }[] = [];
  const masteryDeltas: MasteryDelta[] = [topicDelta];
  const probeTargets: string[] = [];

  if (!wasCorrect && !suppressRipple) {
    const edges = state.dependencies.filter((d) => d.source === question.nodeId);
    for (const edge of edges) {
      const targetNode = state.nodes.get(edge.target);
      if (!targetNode) continue;
      // لایهٔ ۴ فقط برای گرایش‌های فعال کاربر معنا دارد
      if (edge.relation === 'cross_course' && !user.activeTracks.includes(targetNode.track)) {
        continue;
      }
      const b = masteryOf(state, edge.target);
      // بدون کسر عددی: from = to — فقط نیازمندی به بررسی تشخیصی ثبت می‌شود
      const entry = { nodeId: edge.target, from: b, to: b };
      if (edge.relation === 'prerequisite') prerequisites.push(entry);
      else bridges.push(entry);
      probeTargets.push(edge.target);
    }
  }

  /* ---------- کارت مقایسه (خلط مفاهیم متشابه) ---------- */
  let comparisonCardCreated = false;
  // §8.6: خلط نظریه‌ها صریحاً کارت مقایسه می‌طلبد؛ شکاف مفهومی هم همان مسیر را دارد
  if (
    !wasCorrect &&
    (errorType === 'concept_gap' || errorType === 'theory_confusion') &&
    skillMeta &&
    skillMeta.confusableWith.length > 0
  ) {
    const cmpCardId = comparisonCardId(user.userId, question.id);
    if (!state.cards.some((c) => c.id === cmpCardId)) {
      const cmpCard: ReviewCard = {
        id: cmpCardId,
        userId: user.userId,
        nodeId: question.nodeId,
        cardType: 'comparison_card',
        questionId: question.id,
        comparisonSkills: [skillMeta.id, skillMeta.confusableWith[0]!],
        dueAt: now.toISOString(),
        intervalDays: 1,
        ease: 2.5,
        isRepair: false,
        timesSeen: 0,
        timesCorrect: 0,
      };
      createdCards.set(cmpCard.id, cmpCard);
      comparisonCardCreated = true;
      actions.push({
        cardId: cmpCard.id,
        kind: 'create_comparison_card',
        payload: { nodeId: question.nodeId },
      });
    }
  }

  /* ---------- مدل ۶ بعدی یادگیرنده ---------- */
  let skillStateUpdate: EngineResult['skillStateUpdate'];
  let proofCandidate: RippleReport['proofCandidate'] = null;
  let coverageStatus: string | undefined;
  if (skillMeta) {
    // §8.6: برچسب‌های معتبر علت خطا — مقدار ناشناخته/قدیمی «unknown» تفسیر می‌شود، نه ضعف قطعی
    const VALID_ERROR_LABELS: ReadonlySet<string> = new Set<string>([
      'slip', 'concept_gap', 'knowledge_gap', 'misconception', 'calculation_error',
      'reading_error', 'theory_confusion', 'recall_failure', 'time_pressure', 'guessing', 'unknown',
    ]);
    const priorRaw = state.skillStates?.get(skillMeta.id) ?? null;
    const prior: SixDimensionalLearnerState | null = priorRaw
      ? {
          ...priorRaw,
          dominantErrorType: VALID_ERROR_LABELS.has(String(priorRaw.dominantErrorType))
            ? (priorRaw.dominantErrorType as ErrorTypeClassification)
            : 'unknown',
        }
      : null;
    const sixD = update6DLearnerSkillState(prior, evidence, qCard.fsrs, {
      attemptType: input.attemptType,
      answeredAt: now.toISOString(),
    });
    // «proven» فقط از مدل شش‌بعدی و فقط با شاهد هولدآوت می‌آید (update6D دروازه‌اش می‌کند)؛
    // تلاش اثباتِ درست همان دروازه را باز می‌کند.
    if (isProof && wasCorrect) {
      sixD.coverageStatus = 'proven';
      sixD.provenViaHoldout = true;
    } else if (
      !isProof &&
      !sixD.provenViaHoldout &&
      sixD.proficiencyProbability >= PROOF_READINESS_PROFICIENCY &&
      sixD.coverageStatus !== 'proven' &&
      sixD.coverageStatus !== 'mastered'
    ) {
      // آمادگی اثبات: ۱ سؤال دیده‌نشده (قرنطینهٔ ۱۴۰۴) لازم است.
      // تنها آستانهٔ مشترک (PROOF_READINESS_PROFICIENCY) اینجا و در مدل ۶بعدی
      // رعایت می‌شود؛ قبلاً دو عدد موازی (۰٫۶۵ و ۰٫۷۵) جاری بود.
      sixD.coverageStatus = 'needs_proof';
      proofCandidate = { nodeId: question.nodeId, skillId: skillMeta.id };
    }
    coverageStatus = sixD.coverageStatus;
    skillStateUpdate = { nodeId: question.nodeId, state: { ...sixD, skillId: skillMeta.id } };
  }

  /* ---------- پیام منتور ---------- */
  const mentorMessage = buildMentorMessage({
    node,
    wasCorrect,
    errorType,
    topicDelta,
    siblingShock,
    prerequisites,
    bridges,
    probeTargets,
    comparisonCardCreated,
    proofCandidate,
    nodes: state.nodes,
  });

  const report: RippleReport = {
    questionId: question.id,
    wasCorrect,
    directReset: !wasCorrect,
    trapCardCreated,
    topicMastery: topicDelta,
    siblingShock,
    prerequisiteRepairs: prerequisites,
    crossCourseBridges: bridges,
    masteryDeltas,
    mentorMessage,
    actions,
    errorType,
    probeTargets,
    proofCandidate,
    attemptType: input.attemptType ?? 'practice',
    coverageStatus,
  };

  // کارت‌های تازه‌ساخته به state اضافه شوند تا فراخوانی‌های بعدی آن‌ها را ببینند (dedup)
  for (const card of createdCards.values()) {
    if (!state.cards.some((c) => c.id === card.id)) state.cards.push(card);
  }

  return {
    report,
    masteryUpdates: [...masteryUpdates.values()],
    cardUpdates: [...cardUpdates.values()],
    createdCards: [...createdCards.values()],
    skillStateUpdate,
  };
}

/* ------------------------------------------------------------------ */
/* Daily queue builder                                                  */
/* ------------------------------------------------------------------ */

export interface QueueItem {
  card: ReviewCard;
  question?: Question;
  trapNote?: string;
}

export function buildDailyQueue(
  state: EngineState,
  user: EngineUserState,
  opts: {
    limit: number;
    now?: Date;
    /** Filter candidates before ranking and limiting (e.g. commute-mode exclusions). */
    includeCard?: (card: ReviewCard) => boolean;
    /** Higher scores rank first; due date remains the deterministic tie-breaker. */
    priorityScore?: (card: ReviewCard) => number;
  },
): QueueItem[] {
  const now = opts.now ?? new Date();
  const allowed = (nodeId: string): boolean => {
    const n = state.nodes.get(nodeId);
    if (!n) return false;
    return n.track === 'common' || user.activeTracks.includes(n.track);
  };
  const eligible = state.cards.filter(
    (card) =>
      allowed(card.nodeId) &&
      new Date(card.dueAt).getTime() <= now.getTime() &&
      (opts.includeCard?.(card) ?? true),
  );
  const priorityByCardId = new Map<string, number>();
  if (opts.priorityScore) {
    for (const card of eligible) {
      const score = opts.priorityScore(card);
      priorityByCardId.set(card.id, Number.isFinite(score) ? score : 0);
    }
  }
  eligible.sort((a, b) => {
    if (opts.priorityScore) {
      const priorityDelta =
        (priorityByCardId.get(b.id) ?? 0) - (priorityByCardId.get(a.id) ?? 0);
      if (priorityDelta !== 0) return priorityDelta;
    }
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
  return eligible.slice(0, Math.max(0, opts.limit)).map((card) => {
    const item: QueueItem = { card };
    if (card.questionId) {
      const q = state.questions.get(card.questionId);
      if (q) item.question = q;
      if (q?.trapNote) item.trapNote = q.trapNote;
    }
    return item;
  });
}

/* ------------------------------------------------------------------ */
/* Mentor message (فارسی)                                              */
/* ------------------------------------------------------------------ */

function buildMentorMessage(args: {
  node: KnowledgeNode;
  wasCorrect: boolean;
  errorType: ErrorTypeClassification;
  topicDelta: MasteryDelta;
  siblingShock: RippleReport['siblingShock'];
  prerequisites: { nodeId: string; from: number; to: number }[];
  bridges: { nodeId: string; from: number; to: number }[];
  probeTargets: string[];
  comparisonCardCreated: boolean;
  proofCandidate: RippleReport['proofCandidate'];
  nodes: Map<string, KnowledgeNode>;
}): string {
  const {
    node,
    wasCorrect,
    errorType,
    topicDelta,
    siblingShock,
    prerequisites,
    bridges,
    probeTargets,
    comparisonCardCreated,
    proofCandidate,
    nodes,
  } = args;
  if (wasCorrect) {
    const stable = topicDelta.after >= 85;
    let msg = stable
      ? `آفرین! تسلط مبحث «${node.topic}» به ${topicDelta.after.toFixed(0)}٪ رسید و تثبیت شده است.`
      : `درست بود؛ تسلط «${node.topic}» به ${topicDelta.after.toFixed(0)}٪ رسید. با چند پاسخ درست دیگر تثبیت می‌شود.`;
    if (proofCandidate) {
      msg += ' 🎯 برای اثبات یادگیری، یک سؤال دیده‌نشده در صف توست.';
    }
    return msg;
  }
  // لغزش: بدون حکم قطعی و بدون موج
  if (errorType === 'slip') {
    return `حله! احتمالاً عجله داشتی و دقت لازم را نکردی. مبحث «${node.topic}» مشکلی ندارد؛ فردا یک مرور سریع برای اطمینان برات گذاشتیم.`;
  }
  const parts: string[] = ['این پاسخ یک شاهد اولیه است؛'];
  const bits: string[] = [];

  // §8.6: پیام منتور برای هر یک از ده علت خطا (unknown = بدون حکم قطعی)
  const ERROR_MESSAGES: Partial<Record<ErrorTypeClassification, string>> = {
    concept_gap: `یک شکاف مفهومی در مبحث «${node.topic}» تشخیص داده شد`,
    knowledge_gap: 'شکاف در دانش پیش‌نیاز است — خودِ این مبحث لزوماً ضعیف نیست',
    misconception: 'پاسخ روی یک باورِ رایجِ غلط (دام تستی) داده شد؛ درسنامه را با مقابلهٔ دقیق بخوان',
    calculation_error: 'اشکال در محاسبه بود، نه در مفهوم؛ یک ستون محاسبهٔ منظم تمرین کن',
    reading_error: 'احتمالاً صورت سؤال دقیق خوانده نشد (با اطمینان بالا پاسخ غلط دادی)',
    theory_confusion: 'دو نظریهٔ هم‌خانواده با هم خلط شده‌اند — کارت مقایسه برایت فعال می‌شود',
    recall_failure: 'مبحث قبلاً قوی بود ولی بازیابی حافظه افت کرده — مرور زمان‌بندی‌شده اولویت است',
    time_pressure: 'پاسخ بسیار کندتر از زمان مجاز آزمون بود — مدیریت زمان تمرین شود',
    guessing: 'پاسخ با اطمینان بسیار پایین (حدس) ثبت شد؛ علت خطا برای هدف‌گیری ترمیم برچسب خورد',
  };
  if (errorType === 'concept_gap') {
    const gapLevel = topicDelta.before < 40 ? 'عمیق' : topicDelta.before < 60 ? 'متوسط' : 'سطوح';
    bits.push(`یک شکاف مفهومی ${gapLevel} در مبحث «${node.topic}» تشخیص داده شد`);
    if (node.track === 'common') {
      bits.push('برای تثبیت درس مشترک، تمرکز بیشتری لازم است');
    }
  } else if (errorType === 'knowledge_gap') {
    const prereqNodes = prerequisites
      .map((p) => nodes.get(p.nodeId))
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
    bits.push(
      `پیش‌نیاز${prereqNodes.length > 1 ? 'های' : ''}: «${prereqNodes.map((n) => n.topic).join('، ')}» نیاز به بررسی تشخیصی دارد`,
    );
    // اگر پیش‌نیاز به گرایش/مسیر دیگری تعلق دارد، بازبینی برنامه لازم است
    if (prereqNodes.some((n) => n.track !== node.track)) {
      bits.push('پیش‌نیاز درسی در مسیر دیگری قرار دارد و نیاز به بازبینی برنامه دارد');
    }
  } else if (ERROR_MESSAGES[errorType]) {
    bits.push(ERROR_MESSAGES[errorType]!);
  } else if (errorType === 'unknown') {
    bits.push('علت خطا با شواهد موجود قابل تشخیص نبود — این به معنی ضعف قطعی فصل نیست');
  }
  
  if (siblingShock && siblingShock.applied > 0) {
    const shockType = siblingShock.applied === 1 ? 'یک سؤال هم‌خانواده جلو افتاد' : `${siblingShock.applied} سؤال هم‌خانواده جلو افتاد`;
    bits.push(shockType);
  }
  
  for (const p of prerequisites) {
    const n = nodes.get(p.nodeId);
    if (n) {
      const prereqTrack = n.track === 'common' ? 'مسیر استاندارد' : `مسیر ${n.track}`;
      bits.push(`یک سؤال تشخیصی از پیش‌نیاز «${n.topic}» در ${prereqTrack} در صف قرار گرفت`);
    }
  }
  
  for (const b of bridges) {
    const n = nodes.get(b.nodeId);
    if (n) {
      const crossCourse = n.course ? `درس ${n.course}` : 'مبحث هم‌ارز';
      bits.push(`یک بررسی تشخیصی از ${crossCourse} پیشنهاد شد`);
    }
  }
  
  if (comparisonCardCreated) {
    bits.push('یک جدول مقایسهٔ مفاهیم متشابه اضافه شد');
  }
  
  if (proofCandidate) {
    bits.push('🎯 یک سؤال اثبات تسلط (دیده‌نشده) در صف توست');
  }
  
  if (bits.length > 0) {
    parts.push(`برای ادامه: ${bits.join('، ')}.`);
  }
  
  parts.push(`تسلط فصل از ${topicDelta.before.toFixed(0)}٪ به ${topicDelta.after.toFixed(0)}٪ رسید. بازبینی تمرکزی فردا پیشنهاد می‌شود!`);
  parts.push('تا با شواهد بیشتر ببندیمش!');
  return parts.join(' ');
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export {
  isTrackId,
  isQuestion,
  isNodeDependency,
  isExamLevel,
  TRACK_IDS,
  DEPENDENCY_RELATIONS,
  EXAM_LEVELS,
  getExamPath,
  getExamStructure,
  getExamStructureWarnings,
  getSubGroup,
  getSubGroupSubjects,
} from '@ael/contracts';
export type {
  TrackId,
  DependencyRelation,
  ReviewCard,
  Question,
  KnowledgeNode,
  NodeDependency,
  UserNodeMastery,
  ExamLevel,
  ExamPathIdentity,
  ExamYearStructure,
  ExamVerification,
} from '@ael/contracts';

export * from './fsrs';
export * from './exam-simulation';
