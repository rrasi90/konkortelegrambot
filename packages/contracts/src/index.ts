/**
 * قراردادهای مشترک سامانهٔ یادگیری تطبیقی کنکور
 * Shared contracts: types + runtime validation for the adaptive learning engine.
 */

export * from './exam-structure';
export * from './english-skills';
import type { ExamLevel } from './exam-structure';

/* ---------- Track & Knowledge Graph ---------- */

export const TRACK_IDS = ['common', 'business', 'technology', 'strategy', 'industrial'] as const;
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

export const CARD_TYPES = ['question', 'trap_note', 'comparison_card'] as const;
export type CardType = (typeof CARD_TYPES)[number];

/** وضعیت مدتی FSRS روی کارت — تولیدشده توسط موتور حافظه */
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

export const QUESTION_CONTENT_ORIGINS = [
  'official_booklet',
  'textbook_designed',
  'synthetic_demo',
] as const;
export type QuestionContentOrigin = (typeof QUESTION_CONTENT_ORIGINS)[number];

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
  isVerified?: boolean;
  /** Classification from the server-side question catalog. */
  accessType?: 'practice' | 'proof';
  /** زمان موردانتظار پاسخ‌گویی (میلی‌ثانیه) — مبنای روانی اجرا */
  expectedTimeMs?: number;
  /** سطح آزمونِ منبع سؤال؛ بدون تطابق سطح، سؤال وارد جلسهٔ شبیه‌سازی آن سطح نمی‌شود */
  examLevel?: ExamLevel;
  /** مبدأ محتوا — فقط official_booklet می‌تواند جلسهٔ «ساخته‌شده از دفترچهٔ رسمی» بسازد */
  contentOrigin?: QuestionContentOrigin;
}

/** سؤالی که به کلاینت فرستاده می‌شود — بدون گزینهٔ صحیح، بدون توضیح تشریحی و بدون یادداشت دام */
export interface PublicQuestion {
  id: string;
  nodeId: string;
  examYear?: number;
  contentOrigin?: QuestionContentOrigin;
  text: string;
  options: string[];
  isVerified?: boolean;
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
  /** برای comparison_card: زوج مهارت‌های قابل‌خلط [اول، دوم] */
  comparisonSkills?: [string, string];
  /** تاریخ سررسید مرور بعدی (ISO) */
  dueAt: string;
  intervalDays: number;
  /** فاصلهٔ قبلی برای بازگرداندن وضعیت پس از ترمیم */
  previousIntervalDays?: number;
  /** ضریب سهولت، بین ۱٫۳ و ۲٫۸ (سازگاری قدیمی؛ زمان‌بندی جدید از fsrs می‌آید) */
  ease: number;
  /** آیا این کارت برای ترمیم جلو افتاده است؟ */
  isRepair: boolean;
  timesSeen: number;
  timesCorrect: number;
  /** وضعیت موتور حافظهٔ FSRS برای این کارت */
  fsrs?: CardFSRSState;
  /** آیا این تلاش از نوع اثبات یادگیری (Holdout Proof) است؟ */
  isProof?: boolean;
}

export type PlanReason =
  | 'scheduled'
  | 'direct_reset'
  | 'sibling_shock'
  | 'prerequisite_repair'
  | 'cross_course_bridge'
  | 'trap_note';

/* ---------- Engine Input/Output ---------- */

export type SelfReport = 'slip' | 'didnt_know';

export interface AnswerInput {
  userId: string;
  questionId: string;
  /** شناسهٔ تلاش برای idempotency (سرویس‌دهندهٔ تکراری نتیجهٔ قبلی را برمی‌گرداند) */
  attemptId: string;
  selectedOption: number;
  answeredAt?: string;
  /** زمان صرف‌شده تا ثبت پاسخ (میلی‌ثانیه) — مبنای روانی اجرا و تشخیص لغزش */
  responseTimeMs?: number;
  /** اطمینان پیش از پاسخ از ۱ (کم) تا ۵ (زیاد) */
  confidenceRating?: number;
  /** خوداظهاری کاربر پس از پاسخ غلط */
  selfReport?: SelfReport;
  /** نوع این تلاش (اثبات تسلط روی کارت Holdout) */
  attemptType?: 'practice' | 'diagnostic' | 'verification' | 'proof';
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
    | 'create_comparison_card'
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
  /** §8.6: نوع خطای تشخیص‌داده‌شدهٔ موتور ('none' برای پاسخ درست، 'unknown' وقتی شواهد ناکافی است) */
  errorType?:
    | 'slip'
    | 'concept_gap'
    | 'knowledge_gap'
    | 'misconception'
    | 'calculation_error'
    | 'reading_error'
    | 'theory_confusion'
    | 'recall_failure'
    | 'time_pressure'
    | 'guessing'
    | 'unknown'
    | 'none';
  /** گره‌هایی که به‌جای کسر نمره، نیازمند سؤال تشخیصی (Probe) شده‌اند */
  probeTargets?: string[];
  /** اگر آمادگی اثبات رسید: گره و مهارتِ نیازمند سؤال دیده‌نشده */
  proofCandidate?: { nodeId: string; skillId: string } | null;
  /** برچسب این تلاش */
  attemptType?: 'practice' | 'diagnostic' | 'verification' | 'proof';
  /** وضعیت پوشش مهارتِ اصلی پس از این پاسخ (از مدل ۶ بعدی) */
  coverageStatus?: string;
}

/* ---------- Engine Result ---------- */

/** وضعیت شش‌بعدی یادگیرنده برای یک مهارت (ساختار هم‌ارز مدل موتور FSRS) */
export interface LearnerSkillState {
  /** شناسهٔ مهارتِ متصل */
  skillId: string;
  /** احتمال تسلط P(L) بین ۰ و ۱ */
  proficiencyProbability: number;
  /** اطمینان به برآورد بین ۰ و ۱ */
  confidence: number;
  /** شمار شواهد معتبر */
  evidenceCount: number;
  /** بازیابی حافظه از FSRS بین ۰ و ۱ */
  memoryRetrievability: number;
  /** نسبت زمان پاسخ به مبنای سؤال */
  fluencySpeedRatio: number;
  /** نوع غالب خطا */
  dominantErrorType: string;
  /** وضعیت چرخهٔ پوشش */
  coverageStatus: 'unseen' | 'diagnosed' | 'learning' | 'remediated' | 'needs_proof' | 'proven' | 'mastered';
}

/** به‌روزرسانی وضعیت یک مهارت برای پایدارسازی در learner_skill_states */
export interface SkillStateUpdate {
  nodeId: string;
  state: LearnerSkillState;
}

export interface EngineResult {
  report: RippleReport;
  /** نقشهٔ به‌روزشدهٔ تسلط گره‌ها */
  masteryUpdates: UserNodeMastery[];
  /** کارت‌های به‌روزشده (شامل کارت سؤال پاسخ‌گرفته‌شده) */
  cardUpdates: ReviewCard[];
  /** کارت‌های تازه ساخته‌شده */
  createdCards: ReviewCard[];
  /** وضعیت شش‌بعدی به‌روزشدهٔ مهارتِ اصلی سؤال */
  skillStateUpdate?: SkillStateUpdate;
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

/* ---------- User Skill State ---------- */

export interface UserSkillState {
  skillId: string;
  userId: string;

  // 1. Tentative Mastery Estimate
  masteryEstimate: number; // 0-100, marked as 'tentative' if low evidence
  masteryConfidence: number; // 0-1, based on evidence count and quality

  // 2. Evidence Sufficiency
  evidenceCount: number; // validated responses count
  evidenceQuality: number; // average confidence of evidence (0-1)
  lastEvidenceAt: string; // ISO timestamp

  // 3. Memory Retrieval (FSRS-based)
  memoryScore: number; // FSRS retention score (0-1)
  lastReviewedAt: string;
  scheduledNextReview: string; // ISO

  // 4. Execution Fluency
  avgResponseTime: number; // milliseconds (baseline per skill)
  responseTimeStdDev: number;
  fluencyStatus: 'slow' | 'normal' | 'fast' | 'exceptional';

  // 5. Dominant Error Type
  dominantErrorType: string | 'unknown';
  errorHistory: {
    type: string;
    count: number;
    lastAt: string;
    resolved: boolean;
  }[];

  // 6. Skill Coverage
  coveredConcepts: string[];
  uncoveredGaps: string[];
  progressPercent: number; // 0-100, clearly labeled
}

// AEL فاز ۱ — رجیستری آموزشی نسخه‌دار (AEL-101..108)
export * from './registry';
