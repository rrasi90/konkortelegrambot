/**
 * موتور یادگیری تطبیقی — زمان‌بندی مرور از تشخیص آموزشی جداست.
 * A wrong answer is evidence that triggers diagnosis, not a verdict about mastery.
 * Semantic edges can recommend probes/transfer checks but never mutate another
 * skill's mastery automatically. Legacy report fields remain for UI compatibility.
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
  MasteryDelta,
  MasteryStatus,
  NodeDependency,
  Question,
  ReviewCard,
  RippleReport,
  TrackId,
  UserNodeMastery,
} from '@ael/contracts';

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

export class EngineError extends Error {}

/* ------------------------------------------------------------------ */
/* Domain state                                                        */
/* ------------------------------------------------------------------ */

export interface EngineUserState {
  userId: string;
  activeTracks: TrackId[];
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
  if (!Number.isInteger(input.selectedOption) || input.selectedOption < 0 || input.selectedOption >= question.options.length) {
    throw new EngineError('گزینهٔ نامعتبر');
  }
  const node = state.nodes.get(question.nodeId);
  if (!node) {
    throw new EngineError(`گره ناشناخته: ${question.nodeId}`);
  }
  if (node.track !== 'common' && !user.activeTracks.includes(node.track)) {
    throw new EngineError('این سؤال در مسیرهای فعال شما نیست');
  }
  const now = new Date(input.answeredAt ?? Date.now());

  const wasCorrect = input.selectedOption === question.correctOption;

  const masteryUpdates = new Map<string, UserNodeMastery>();
  const cardUpdates = new Map<string, ReviewCard>();
  const createdCards = new Map<string, ReviewCard>();
  const actions: CardAction[] = [];

  /* ---------- لایهٔ ۱: خودِ کارت ---------- */
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

  let trapCardCreated = false;
  if (!wasCorrect) {
    // بازنشانی مستقیم: فاصلهٔ ۱ روز + کاهش سهولت
    const before = clone(qCard);
    qCard.ease = Math.max(cfg.easeMin, qCard.ease - cfg.easePenalty);
    qCard.intervalDays = 1;
    qCard.dueAt = addDays(now, 1).toISOString();
    qCard.timesSeen += 1;
    qCard.isRepair = false;
    if (!createdCards.has(qCard.id)) cardUpdates.set(qCard.id, qCard);
    if (before.intervalDays !== qCard.intervalDays) {
      actions.push({
        cardId: qCard.id,
        kind: 'reset_failed_card',
        payload: { nodeId: question.nodeId, fromInterval: before.intervalDays, toInterval: 1 },
      });
    }

    // کارت دام تستی (بدون تکرار)
    if (question.trapNote) {
      const tCardId = trapCardId(user.userId, question.id);
      if (!state.cards.some((c) => c.id === tCardId)) {
        const trapCard: ReviewCard = {
          id: tCardId,
          userId: user.userId,
          nodeId: question.nodeId,
          cardType: 'trap_note',
          questionId: question.id,
          trapCardId: `trap:${question.id}`,
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
    // رشد فاصلهٔ مرور
    const wasRepair = qCard.isRepair;
    const prevInterval = qCard.intervalDays;
    qCard.ease = Math.min(cfg.easeMax, qCard.ease + cfg.easeGain);
    qCard.intervalDays = Math.max(1, Math.round(qCard.intervalDays * qCard.ease));
    // اگر کارتِ ترمیمی درست جواب داده شد، فاصلهٔ قبلی را به‌جای رشد تازه برمی‌گردانیم
    if (wasRepair) {
      qCard.intervalDays = qCard.previousIntervalDays ?? qCard.intervalDays;
      qCard.isRepair = false;
      qCard.previousIntervalDays = undefined;
    }
    qCard.dueAt = addDays(now, qCard.intervalDays).toISOString();
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

  /* ---------- به‌روزرسانی مبتنی بر شواهد ---------- */
  // Scheduling records that this item was answered. Mastery changes only from
  // correct evidence on a previously unseen question; a wrong answer never
  // causes a fixed chapter drop or any cross-skill/cross-course penalty.
  const before = masteryOf(state, question.nodeId);
  const canUpdateProficiency = wasCorrect && input.seenBefore !== true;
  const after = canUpdateProficiency
    ? round1(before + (100 - before) * cfg.masteryGain)
    : before;
  const topicDelta: MasteryDelta = {
    nodeId: question.nodeId,
    before,
    after,
    reason: 'direct',
  };
  if (canUpdateProficiency) {
    state.mastery.set(question.nodeId, after);
    masteryUpdates.set(question.nodeId, {
      nodeId: question.nodeId,
      mastery: after,
      status: statusFromMastery(after),
    });
  }

  // Legacy fields are intentionally empty: relations are evidence for a future
  // diagnostic/transfer check, not permission to mutate connected skill mastery.
  const siblingShock: RippleReport['siblingShock'] = null;
  const prerequisites: { nodeId: string; from: number; to: number }[] = [];
  const bridges: { nodeId: string; from: number; to: number }[] = [];
  const masteryDeltas: MasteryDelta[] = canUpdateProficiency && after !== before ? [topicDelta] : [];

  /* ---------- پیام منتور ---------- */
  const mentorMessage = buildMentorMessage({
    node,
    wasCorrect,
    topicDelta,
    siblingShock,
    prerequisites,
    bridges,
    nodes: state.nodes,
  });

  const report: RippleReport = {
    questionId: question.id,
    wasCorrect,
    directReset: false,
    trapCardCreated,
    topicMastery: topicDelta,
    siblingShock,
    prerequisiteRepairs: prerequisites,
    crossCourseBridges: bridges,
    masteryDeltas,
    mentorMessage,
    actions,
    diagnosticRequired: !wasCorrect,
    evidenceOnly: !wasCorrect,
    nextAction: wasCorrect
      ? (input.seenBefore === true ? 'spaced_review' : 'unseen_verification')
      : 'diagnostic_probe',
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
  opts: { limit: number; now?: Date },
): QueueItem[] {
  const now = opts.now ?? new Date();
  const allowed = (nodeId: string): boolean => {
    const n = state.nodes.get(nodeId);
    if (!n) return false;
    return n.track === 'common' || user.activeTracks.includes(n.track);
  };
  const due = state.cards
    .filter((c) => allowed(c.nodeId) && new Date(c.dueAt).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  return due.slice(0, opts.limit).map((card) => {
    const item: QueueItem = { card };
    const trapSourceId = card.cardType === 'trap_note' && card.trapCardId?.startsWith('trap:')
      ? card.trapCardId.slice('trap:'.length)
      : undefined;
    const sourceQuestionId = card.questionId ?? trapSourceId;
    if (sourceQuestionId) {
      const q = state.questions.get(sourceQuestionId);
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
  topicDelta: MasteryDelta;
  siblingShock: RippleReport['siblingShock'];
  prerequisites: { nodeId: string; from: number; to: number }[];
  bridges: { nodeId: string; from: number; to: number }[];
  nodes: Map<string, KnowledgeNode>;
}): string {
  const { node, wasCorrect, topicDelta } = args;
  if (!wasCorrect) {
    return `از یک پاسخ نادرست به‌تنهایی نمی‌توان نتیجه گرفت که بر مبحث «${node.topic}» تسلط ندارید. گام بعدی، یک سؤال تشخیصی کوتاه است تا خطای بی‌دقتی را از شکاف مفهومی جدا کنیم؛ سپس تمرین هدفمند و یک سؤال تازه برای راستی‌آزمایی.`;
  }
  if (topicDelta.after >= 85) {
    return `پاسخ درست بود. برآورد فعلی مبحث «${node.topic}» ${topicDelta.after.toFixed(0)}٪ است؛ تثبیت نهایی فقط با شواهد کافی از سؤال‌های تازه انجام می‌شود.`;
  }
  return `پاسخ درست بود. برآورد مبحث «${node.topic}» به ${topicDelta.after.toFixed(0)}٪ رسید. مرور فاصله‌دار را ادامه می‌دهیم و تسلط را با سؤال‌های دیده‌نشده می‌سنجیم.`;
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

export { isTrackId, isQuestion, isNodeDependency, TRACK_IDS, DEPENDENCY_RELATIONS };
export type { TrackId, DependencyRelation, ReviewCard, Question, KnowledgeNode, NodeDependency, UserNodeMastery };
