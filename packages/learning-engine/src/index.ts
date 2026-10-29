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
  if (input.selectedOption < 0 || input.selectedOption >= question.options.length) {
    throw new EngineError('گزینهٔ نامعتبر');
  }
  const node = state.nodes.get(question.nodeId);
  if (!node) {
    throw new EngineError(`گره ناشناخته: ${question.nodeId}`);
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

  /* ---------- لایهٔ ۲: تسلط فصل + شوک هم‌خانواده‌ها ---------- */
  const before = masteryOf(state, question.nodeId);
  const after = wasCorrect
    ? round1(before + (100 - before) * cfg.masteryGain)
    : round1(before * cfg.masteryPenalty);
  state.mastery.set(question.nodeId, after);
  const topicDelta: MasteryDelta = {
    nodeId: question.nodeId,
    before,
    after,
    reason: 'direct',
  };
  masteryUpdates.set(question.nodeId, {
    nodeId: question.nodeId,
    mastery: after,
    status: statusFromMastery(after),
    // lastErrorAt فقط با پاسخ غلط معنی دارد؛ در پاسخ درست دست نمی‌زنیم
    ...(wasCorrect ? {} : { lastErrorAt: now.toISOString() }),
  });

  let siblingShock: RippleReport['siblingShock'] = null;
  if (!wasCorrect && after < cfg.rippleThreshold) {
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

  /* ---------- لایهٔ ۳ و ۴: سرایت از طریق یال‌ها ---------- */
  const prerequisites: { nodeId: string; from: number; to: number }[] = [];
  const bridges: { nodeId: string; from: number; to: number }[] = [];
  const masteryDeltas: MasteryDelta[] = [topicDelta];

  if (!wasCorrect) {
    const edges = state.dependencies.filter((d) => d.source === question.nodeId);
    for (const edge of edges) {
      const targetNode = state.nodes.get(edge.target);
      if (!targetNode) continue;
      // لایهٔ ۴ فقط برای گرایش‌های فعال کاربر معنا دارد
      if (edge.relation === 'cross_course' && !user.activeTracks.includes(targetNode.track)) {
        continue;
      }
      const b = masteryOf(state, edge.target);
      const a = round1(b * (1 - cfg.linkedPenalty * edge.weight));
      state.mastery.set(edge.target, a);
      masteryUpdates.set(edge.target, {
        nodeId: edge.target,
        mastery: a,
        status: statusFromMastery(a),
        lastErrorAt: now.toISOString(),
      });
      const entry = { nodeId: edge.target, from: b, to: a };
      if (edge.relation === 'prerequisite') prerequisites.push(entry);
      else bridges.push(entry);
      masteryDeltas.push({ nodeId: edge.target, before: b, after: a, reason: edge.relation });
    }
  }

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
    directReset: !wasCorrect,
    trapCardCreated,
    topicMastery: topicDelta,
    siblingShock,
    prerequisiteRepairs: prerequisites,
    crossCourseBridges: bridges,
    masteryDeltas,
    mentorMessage,
    actions,
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
  topicDelta: MasteryDelta;
  siblingShock: RippleReport['siblingShock'];
  prerequisites: { nodeId: string; from: number; to: number }[];
  bridges: { nodeId: string; from: number; to: number }[];
  nodes: Map<string, KnowledgeNode>;
}): string {
  const { node, wasCorrect, topicDelta, siblingShock, prerequisites, bridges, nodes } = args;
  if (wasCorrect) {
    const stable = topicDelta.after >= 85;
    return stable
      ? `آفرین! تسلط مبحث «${node.topic}» به ${topicDelta.after.toFixed(0)}٪ رسید و تثبیت شده است.`
      : `درست بود؛ تسلط «${node.topic}» به ${topicDelta.after.toFixed(0)}٪ رسید. با چند پاسخ درست دیگر تثبیت می‌شود.`;
  }
  const parts: string[] = [
    `این پاسخ نشون می‌ده مبحث «${node.topic}» هنوز برات جا نیفتاده؛ تسلط فصل از ${topicDelta.before.toFixed(0)}٪ به ${topicDelta.after.toFixed(0)}٪ رسید.`,
  ];
  const bits: string[] = [];
  if (siblingShock && siblingShock.applied > 0) {
    bits.push(`${siblingShock.applied} تست هم‌خانواده از همین فصل جلو افتاد`);
  }
  for (const p of prerequisites) {
    const n = nodes.get(p.nodeId);
    if (n) bits.push(`یک مرور از پیش‌نیاز «${n.topic}» به برنامهٔ فردا اضافه شد`);
  }
  for (const b of bridges) {
    const n = nodes.get(b.nodeId);
    if (n) bits.push(`یک پیوند از درس «${n.course}» فعال شد`);
  }
  if (bits.length > 0) parts.push(`برای فردا: ${bits.join('، ')}.`);
  parts.push('تا کامل ببندیمش!');
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

export { isTrackId, isQuestion, isNodeDependency, TRACK_IDS, DEPENDENCY_RELATIONS };
export type { TrackId, DependencyRelation, ReviewCard, Question, KnowledgeNode, NodeDependency, UserNodeMastery };

export * from './fsrs';
