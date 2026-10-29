/**
 * قراردادهای مشترک سامانهٔ یادگیری تطبیقی کنکور
 * Shared contracts: types + runtime validation for the adaptive learning engine.
 */

/* ---------- Track & Knowledge Graph ---------- */

export const TRACK_IDS = ['common', 'business', 'technology'] as const;
export type TrackId = (typeof TRACK_IDS)[number];

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

export const DEPENDENCY_RELATIONS = ['prerequisite', 'cross_course'] as const;
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
  /** ضریب همبستگی ۰٫۲ تا ۰٫۶ */
  weight: number;
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
}

export type VerificationStatus = 'unverified' | 'verified' | 'quarantined';

/* ---------- User State ---------- */

export type MasteryStatus = 'weak' | 'unstable' | 'learning' | 'mastered';

export enum UserSkillStatus {
  UNSEEN = 'unseen',
  EVIDENCE_GATHERING = 'evidence_gathering',
  SKILL_GAP = 'skill_gap',
  IN_REMEDIATION = 'in_remediation',
  EVIDENCE_SUFFICIENT = 'evidence_sufficient',
  PROVEN_INDEPENDENT = 'proven_independent',
}

export interface SkillModel {
  id: string; // UUID پایدار
  title: string;
  course: string;
  chapter: string | null;
  topic: string;
  module: string | null;
  track: TrackId;
  dependencies: string[]; // skill IDs (not node IDs) - از node_dependencies استفاده شود
  confusableWith: string[]; // IDهای مهارتی که به آن شبیه هستند
  assessmentMap: {
    diagnosticQuestionIds: string[];
    verificationQuestionIds: string[];
    proofQuestionIds: string[];
  };
  difficultyEstimate: number; // 0-100, بر اساس تحلیل باکس játékos
  estimatedStudyHours: number; // برآورد orthodox
  status: UserSkillStatus;
  evidenceLevel: 'none' | 'partial' | 'complete' | 'certified';
  sinceWhen: string; // ISO date when status changed
}

export interface QuestionModel {
  id: string; // logical ID (logical_path harvest شده)
  version: number; // نسخهٔ محتوا (change-tracked)
  examPackId: string; // بسته所属
  itemVersion: string; // نسخه‌سازی شده محتوا (semantic version)
  questionText: string;
  options: string[];
  correctOption: number;
  explanation: string | null;
  trapNote: string | null;
  usageType: 'educational' | 'diagnostic' | 'verification' | 'proof';
  targetSkills: string[]; //skill IDs Aimed
  difficulty: number; // 0-100, از تحلیل آمار 질문
  estimatedTime: number; // دقیقه approximate
  status: 'draft' | 'review' | 'approved' | 'published' | 'retired';
  holdoutContext: {
    packId: string;
    version: string;
    sinceWhen: string; // ISO date
  };
}

/* ---------- Engine Result types moved down ---------- */

export interface UserNodeMastery {
  nodeId: string;
  /** ۰ تا ۱۰۰ */
  mastery: number;
  status: MasteryStatus;
  lastErrorAt?: string;
}

export interface ReviewCard {
  /** مثلاً «q:demo-001» برای سؤال یا «trap:demo-001» برای کارت دام */
  id: string;
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

export interface EngineResult {
  report: RippleReport;
  /** نقشهٔ به‌روزشدهٔ تسلط گره‌ها */
  masteryUpdates: UserNodeMastery[];
  /** کارت‌های به‌روزشده (شامل کارت سؤال پاسخ‌گرفته‌شده) */
  cardUpdates: ReviewCard[];
  /** کارت‌های تازه ساخته‌شده */
  createdCards: ReviewCard[];
}

export interface ReviewCard {
  /** مثلاً «q:demo-001» برای سؤال یا «trap:demo-001» برای کارت دام */
  id: string;
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
  return typeof value === 'string' && (TRACK_IDS as readonly string[]).includes(value);
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
