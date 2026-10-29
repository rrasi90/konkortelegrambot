/**
 * قراردادهای مشترک سامانهٔ یادگیری تطبیقی کنکور
 * Shared contracts: types + runtime validation for the adaptive learning engine.
 */

/* ---------- Track & Knowledge Graph ---------- */

/** Track IDs are pack-defined slugs. The engine must not encode domain names. */
export const TRACK_IDS = ['common', 'business', 'technology'] as const;
export type TrackId = string;

/** گرهٔ دانش: یک مبحث مشخص در یک فصل از یک درس */
export interface KnowledgeNode {
  /** شناسهٔ پایدار، مثلاً «sm.rbv» */
  id: string;
  track: TrackId;
  /** نام درس */
  course: string;
  /** نام فصل */
  chapter: string;
  /** نام مبحث */
  topic: string;
}

/** Semantic graph types. Legacy values remain readable while old packs are migrated. */
export const DEPENDENCY_RELATIONS = [
  'prerequisite_of', 'confusable_with', 'applied_in', 'part_of', 'related_to',
  'prerequisite', 'cross_course',
] as const;
export type DependencyRelation = (typeof DEPENDENCY_RELATIONS)[number];

/**
 * جهت یال: source = مبحثی که خطا در آن رخ داده؛
 * target = مبحثی که خطا روی آن اثر می‌گذارد.
 * - prerequisite: target پیش‌نیازِ source است (لایهٔ ۳)
 * - cross_course: target مفهوم هم‌ارز در درس/گرایش دیگر است (لایهٔ ۴)
 */
export interface NodeDependency {
  source: string;
  target: string;
  relation: DependencyRelation;
  /** ضریب ارتباط؛ heuristic only, not a mastery penalty */
  weight: number;
  verificationStatus?: 'unverified' | 'verified' | 'rejected';
  sourceRef?: string;
  confidence?: number;
}

/* ---------- Questions & Cards ---------- */

export const CARD_TYPES = ['question', 'trap_note'] as const;
export type CardType = (typeof CARD_TYPES)[number];

export interface Question {
  id: string;
  nodeId: string;
  examYear?: number;
  text: string;
  options: string[];
  /** اندیس گزینهٔ صحیح (۰ مبنا) */
  correctOption: number;
  explanation?: string;
  /** نکتهٔ دام تستی — منبع کارت‌های لایهٔ ۱ */
  trapNote?: string;
  /** Holdout content is only eligible for unseen verification, never ordinary new-material queues. */
  isHoldout?: boolean;
}

export type VerificationStatus = 'unverified' | 'verified' | 'quarantined' | 'demo';

export type CoverageState = 'unseen' | 'diagnosed' | 'remediating' | 'verified_by_unseen';
export type DominantErrorType = 'conceptual' | 'confusable' | 'computational' | 'slip' | 'unknown';

/** Six independent signals; none is inferred from a single wrong answer alone. */
export interface LearnerSkillState {
  skillId: string;
  proficiencyProbability: number;
  estimateConfidence: number;
  evidenceCount: number;
  /** Classified correct evidence on unseen questions. */
  correctEvidenceCount: number;
  /** Conceptual/confusable/computational gaps explicitly confirmed by diagnosis. A wrong answer alone does not increment this. */
  assessedGapEvidenceCount: number;
  memoryRetrievability: number;
  fluencyScore: number;
  dominantErrorType: DominantErrorType;
  coverageState: CoverageState;
  updatedAt: string;
}


/* ---------- User State ---------- */

export type MasteryStatus = 'weak' | 'unstable' | 'learning' | 'mastered';

export interface UserNodeMastery {
  nodeId: string;
  /** ۰ تا ۱۰۰ */
  mastery: number;
  status: MasteryStatus;
  lastErrorAt?: string;
}

export interface FSRSCardState {
  /** Serialized ts-fsrs Card state; dates are ISO-8601 strings for JSON/Postgres. */
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string | null;
}

export interface ReviewCard {
  /** مثلاً «q:demo-001» برای سؤال یا «trap:demo-001» برای کارت دام */
  id: string;
  /** وضعیت پایدار الگوریتم FSRS؛ زمان‌بندی قدیمی ease فقط برای سازگاری باقی مانده است. */
  fsrsState?: FSRSCardState;
  userId: string;
  nodeId: string;
  cardType: CardType;
  questionId?: string;
  trapCardId?: string;
  /** تاریخ سررسید مرور بعدی (ISO) */
  dueAt: string;
  intervalDays: number;
  /** فاصلهٔ قبلی برای بازگرداندن وضعیت پس از ترمیم */
  previousIntervalDays?: number;
  /** ضریب سهولت، بین ۱٫۳ و ۲٫۸ */
  ease: number;
  /** آیا این کارت برای ترمیم جلو افتاده است؟ */
  isRepair: boolean;
  timesSeen: number;
  timesCorrect: number;
}

export type PlanReason =
  | 'scheduled'
  | 'direct_reset'
  | 'sibling_shock'
  | 'prerequisite_repair'
  | 'cross_course_bridge'
  | 'trap_note';

/* ---------- Engine Input/Output ---------- */

export interface AnswerInput {
  userId: string;
  questionId: string;
  /** شناسهٔ تلاش برای idempotency (سرویس‌دهندهٔ تکراری نتیجهٔ قبلی را برمی‌گرداند) */
  attemptId: string;
  selectedOption: number;
  answeredAt?: string;
  /** Whether this item had been presented to this learner before. */
  seenBefore?: boolean;
  responseTimeMs?: number;
  confidenceBefore?: number;
  assistance?: string[];
  studyMode?: 'desk' | 'commute' | 'exam';
  engineVersion?: string;
  itemVersion?: string;
}

export interface MasteryDelta {
  nodeId: string;
  before: number;
  after: number;
  reason: 'direct' | 'prerequisite' | 'cross_course';
}

export interface CardAction {
  cardId: string;
  kind:
    | 'reset_failed_card'
    | 'create_trap_card'
    | 'reschedule_siblings'
    | 'schedule_repair'
    | 'grow_interval';
  /** برای reschedule: شناسهٔ کارت‌ها؛ برای repair: شناسهٔ کارت/گره هدف */
  payload: {
    nodeId?: string;
    cardIds?: string[];
    fromInterval?: number;
    toInterval?: number;
    dueAt?: string;
  };
}

export interface RippleReport {
  questionId: string;
  wasCorrect: boolean;
  /** لایهٔ ۱ */
  directReset: boolean;
  trapCardCreated: boolean;
  /** لایهٔ ۲ */
  topicMastery: MasteryDelta;
  siblingShock: { cardIds: string[]; applied: number; deferred: number } | null;
  /** لایهٔ ۳ */
  prerequisiteRepairs: { nodeId: string; from: number; to: number }[];
  /** لایهٔ ۴ */
  crossCourseBridges: { nodeId: string; from: number; to: number }[];
  /** تغییرات تسلط (شامل گرهٔ اصلی) */
  masteryDeltas: MasteryDelta[];
  /** پیام منتور فارسی */
  mentorMessage: string;
  /** اقدامات کارت برای پایدارسازی */
  actions: CardAction[];
  /** A wrong response is evidence for diagnosis, not a mastery verdict. */
  diagnosticRequired?: boolean;
  evidenceOnly?: boolean;
  nextAction?: 'diagnostic_probe' | 'targeted_remediation' | 'unseen_verification' | 'spaced_review';
}

/* ---------- Engine Result ---------- */

export interface EngineResult {
  report: RippleReport;
  /** نقشهٔ به‌روزشدهٔ تسلط گره‌ها */
  masteryUpdates: UserNodeMastery[];
  /** کارت‌های به‌روزشده (شامل کارت سؤال پاسخ‌گرفته‌شده) */
  cardUpdates: ReviewCard[];
  /** کارت‌های تازه ساخته‌شده */
  createdCards: ReviewCard[];
}

/* ---------- Validation helpers (no external deps) ---------- */

export function isTrackId(value: unknown): value is TrackId {
  return typeof value === 'string' && /^[a-z][a-z0-9_-]{1,39}$/.test(value);
}

export function isNodeDependency(value: unknown): value is NodeDependency {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.source === 'string' &&
    typeof v.target === 'string' &&
    typeof v.weight === 'number' &&
    v.weight >= 0.2 &&
    v.weight <= 0.6 &&
    typeof v.relation === 'string' &&
    (DEPENDENCY_RELATIONS as readonly string[]).includes(v.relation)
  );
}

export function isQuestion(value: unknown): value is Question {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.nodeId === 'string' &&
    typeof v.text === 'string' &&
    Array.isArray(v.options) &&
    v.options.length >= 2 &&
    typeof v.correctOption === 'number' &&
    v.correctOption >= 0 &&
    v.correctOption < v.options.length
  );
}
