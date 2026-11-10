/**
 * V3-040 — مدل Canonical سؤال (مأموریت v5 §5)
 *
 * مفاهیم مستقل با ownership و cardinality صریح:
 *   CanonicalQuestion      — هویت پایدار سؤال (مستقل از revision/appearance/key)
 *   QuestionRevision       — نسخهٔ محتوایی (متن/گزینه‌ها)؛ بدون کلید
 *   QuestionAppearance     — حضور سؤال در آزمون/سال/دفترچه/شماره/منبع
 *   AnswerKeyRevision      — کلید، append-only با supersedes؛ جدا از تأیید محتوا
 *   QuestionReviewRecord   — audit بازبینی؛ تأیید محتوا ≠ تأیید کلید
 *   QuestionDispute        — اعتراض داوطلب به متن/کلید
 *
 * قواعد §5.2 که validatorها enforce می‌کنند:
 *   - شناسهٔ سؤال از revision و از appearance مجزا است
 *   - یک سؤال چند revision و چند appearance دارد (cardinality 1:N)
 *   - کلید پاسخ از پروجکشن عمومی سؤال جدا است و append-only است
 *   - تأیید محتوا و تأیید کلید دو رکورد مستقل‌اند
 *   - origin سه‌گانه: official_imported / user_authored / sme_authored
 *   - trustLevel / verificationStatus / rightsStatus / allowedUse چهار محور مستقل
 */

export const QUESTION_ORIGINS = ['official_imported', 'user_authored', 'sme_authored'] as const;
export type QuestionOrigin = (typeof QUESTION_ORIGINS)[number];

export const QUESTION_RIGHTS_STATUSES = ['unknown', 'restricted', 'licensed', 'original_ael'] as const;
export type QuestionRightsStatus = (typeof QUESTION_RIGHTS_STATUSES)[number];

export const TRUST_LEVELS = ['official', 'reported', 'user', 'unknown'] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export const VERIFICATION_STATUSES = ['pending_sme', 'sme_approved', 'rejected', 'quarantined'] as const;
export type QuestionVerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ALLOWED_USES = ['practice', 'diagnostic', 'verification', 'proof', 'timed_exam'] as const;
export type AllowedUse = (typeof ALLOWED_USES)[number];

export const REVISION_STATUSES = [
  'draft', 'submitted', 'in_review', 'approved', 'published',
  'rejected', 'changes_requested', 'withdrawn', 'archived', 'suspended',
] as const;
export type QuestionRevisionStatus = (typeof REVISION_STATUSES)[number];

export const KEY_STATUSES = ['pending_review', 'approved', 'disputed', 'superseded'] as const;
export type AnswerKeyStatus = (typeof KEY_STATUSES)[number];

export const DISPUTE_STATUSES = [
  'open', 'under_review', 'resolved_upheld', 'resolved_rejected', 'closed',
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export interface CanonicalQuestion {
  id: string;
  /** نود سرفصل اصلی در گراف دانش */
  primaryNodeId: string;
  origin: QuestionOrigin;
  rightsStatus: QuestionRightsStatus;
  /** سطح اعتماد محتوا — مستقل از بازبینی علمی و حقوق */
  trustLevel: TrustLevel;
  createdAt: string;
}

export interface QuestionRevision {
  id: string;
  questionId: string;
  /** شمارهٔ نسخه درون یک سؤال — یکتا per question */
  revisionNo: number;
  prompt: string;
  choices: string[];
  kind: 'mcq' | 'essay';
  status: QuestionRevisionStatus;
  createdBy: string;
  createdAt: string;
}

export interface QuestionAppearance {
  id: string;
  questionId: string;
  /** ظاهر شدن همیشه به یک نسخهٔ مشخص از محتوا گره می‌خورد */
  revisionId: string;
  /** مرجع آزمون — بدون حدس؛ فیلدهای نامعلوم null می‌مانند */
  examRef: { familyId?: string; examYear?: number; bookletCode?: string | null };
  orderInBooklet: number | null;
  /** منبع اولیه/ثانویه + locator دقیق؛ null یعنی منبع ثبت نشده */
  sourceRef: { sourceId: string; locator?: string } | null;
}

export interface AnswerKeyRevision {
  id: string;
  questionId: string;
  /** کلید به نسخهٔ محتوایی وصل است، نه به هویت کلی سؤال */
  revisionId: string;
  /** null برای essay یا کلید نامعلوم — unknown ≠ صفر */
  correctOption: number | null;
  status: AnswerKeyStatus;
  /** append-only: اگر نسخهٔ جدیدی از کلید جایگزین شد، id قبلی اینجا ثبت می‌شود */
  supersedes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  /** دلیل اصلاح/تعیین کلید — برای audit */
  rationale?: string;
  createdAt: string;
}

export type ReviewTarget = 'content' | 'key';
export type ReviewDecision = 'approved' | 'rejected' | 'changes_requested';

export interface QuestionReviewRecord {
  id: string;
  revisionId: string;
  /** تأیید محتوا و تأیید کلید دو رکورد مستقل با target متفاوت‌اند */
  target: ReviewTarget;
  actor: string;
  actorRole: 'author' | 'moderator' | 'sme';
  decision: ReviewDecision;
  reason?: string;
  at: string;
}

export interface QuestionDispute {
  id: string;
  questionId: string;
  revisionId: string;
  appearanceId: string | null;
  /** اگر اعتراض به کلید است، به کدام نسخهٔ کلید */
  keyRevisionId: string | null;
  raisedBy: string;
  evidence: string;
  status: DisputeStatus;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

/* ---------- Policy: AllowedUse (§5.2 — server-enforced در Worker) ---------- */

export interface UsePolicyInput {
  trustLevel: TrustLevel;
  verification: QuestionVerificationStatus;
  hasApprovedKey: boolean;
  disputed: boolean;
}

/** سیاست allowedUse: trust پایین/منبع نامعلوم هرگز وارد verification/proof/timed_exam نمی‌شود. */
export function computeAllowedUse(input: UsePolicyInput): AllowedUse[] {
  const safe: AllowedUse[] = ['practice', 'diagnostic'];
  if (input.disputed) return ['practice'];
  if (input.verification === 'quarantined' || input.verification === 'rejected') return [];
  const trustworthy = input.trustLevel === 'official' || input.trustLevel === 'reported';
  const reviewed = input.verification === 'sme_approved';
  if (trustworthy && reviewed && input.hasApprovedKey) {
    return [...safe, 'verification', 'proof', 'timed_exam'];
  }
  return safe;
}

/* ---------- Validators ---------- */

export interface CanonicalQuestionRegistry {
  questions: CanonicalQuestion[];
  revisions: QuestionRevision[];
  appearances: QuestionAppearance[];
  keyRevisions: AnswerKeyRevision[];
  reviews?: QuestionReviewRecord[];
  disputes?: QuestionDispute[];
}

export interface RegistryValidation {
  errors: string[];
}

function collectErrors(list: string[], condition: boolean, message: string): void {
  if (!condition) list.push(message);
}

export function validateQuestionRegistry(registry: CanonicalQuestionRegistry): RegistryValidation {
  const errors: string[] = [];
  const questionIds = new Set(registry.questions.map((q) => q.id));
  const revisionIds = new Set(registry.revisions.map((r) => r.id));
  const keyIds = new Set(registry.keyRevisions.map((k) => k.id));

  collectErrors(errors, questionIds.size === registry.questions.length, 'سؤال با id تکراری');
  collectErrors(errors, revisionIds.size === registry.revisions.length, 'revision با id تکراری');
  collectErrors(errors, keyIds.size === registry.keyRevisions.length, 'keyRevision با id تکراری');

  for (const q of registry.questions) {
    collectErrors(errors, QUESTION_ORIGINS.includes(q.origin), `سؤال ${q.id}: origin غیرمجاز ${q.origin}`);
    collectErrors(errors, QUESTION_RIGHTS_STATUSES.includes(q.rightsStatus), `سؤال ${q.id}: rightsStatus غیرمجاز`);
    collectErrors(errors, TRUST_LEVELS.includes(q.trustLevel), `سؤال ${q.id}: trustLevel غیرمجاز`);
  }

  const revisionNoSeen = new Map<string, Set<number>>();
  for (const rev of registry.revisions) {
    collectErrors(errors, questionIds.has(rev.questionId), `revision ${rev.id}: dangling questionId ${rev.questionId}`);
    collectErrors(errors, REVISION_STATUSES.includes(rev.status), `revision ${rev.id}: status غیرمجاز`);
    if (rev.kind === 'mcq') {
      collectErrors(errors, rev.choices.length >= 2, `revision ${rev.id}: سؤال MCQ با کمتر از ۲ گزینه`);
    } else {
      collectErrors(errors, rev.choices.length === 0, `revision ${rev.id}: سؤال essay نباید choices داشته باشد`);
    }
    const seen = revisionNoSeen.get(rev.questionId) ?? new Set<number>();
    collectErrors(errors, !seen.has(rev.revisionNo), `سؤال ${rev.questionId}: revisionNo تکراری ${rev.revisionNo}`);
    seen.add(rev.revisionNo);
    revisionNoSeen.set(rev.questionId, seen);
  }

  for (const app of registry.appearances) {
    collectErrors(errors, revisionIds.has(app.revisionId), `appearance ${app.id}: dangling revisionId`);
    const rev = registry.revisions.find((r) => r.id === app.revisionId);
    collectErrors(errors, !!rev && rev.questionId === app.questionId,
      `appearance ${app.id}: questionId با revision ناسازگار است (cross-question appearance)`);
    const dupKey = `${app.questionId}|${JSON.stringify(app.examRef)}|${app.orderInBooklet}`;
    // duplicate appearance: همان سؤال در همان دفترچه/شماره نباید دو بار ظاهر شود
    collectErrors(errors,
      registry.appearances.filter((a) =>
        `${a.questionId}|${JSON.stringify(a.examRef)}|${a.orderInBooklet}` === dupKey).length === 1,
      `appearance ${app.id}: duplicate appearance برای همین booklet/شماره`);
  }

  for (const key of registry.keyRevisions) {
    collectErrors(errors, revisionIds.has(key.revisionId), `keyRevision ${key.id}: dangling revisionId`);
    const rev = registry.revisions.find((r) => r.id === key.revisionId);
    collectErrors(errors, !!rev && rev.questionId === key.questionId,
      `keyRevision ${key.id}: questionId با revision ناسازگار`);
    if (rev?.kind === 'mcq' && key.correctOption !== null) {
      collectErrors(errors, Number.isInteger(key.correctOption) && key.correctOption >= 0 && key.correctOption < rev.choices.length,
        `keyRevision ${key.id}: correctOption خارج از محدودهٔ گزینه‌ها`);
    }
    collectErrors(errors, KEY_STATUSES.includes(key.status), `keyRevision ${key.id}: status غیرمجاز`);
    if (key.supersedes !== null) {
      collectErrors(errors, keyIds.has(key.supersedes), `keyRevision ${key.id}: supersedes ناموجود`);
      const older = registry.keyRevisions.find((k) => k.id === key.supersedes);
      collectErrors(errors, !!older && older.status === 'superseded',
        `keyRevision ${key.id}: نسخهٔ جایگزین‌شده باید status=superseded داشته باشد (append-only)`);
    }
  }

  for (const review of registry.reviews ?? []) {
    collectErrors(errors, revisionIds.has(review.revisionId), `review ${review.id}: dangling revisionId`);
    collectErrors(errors, review.target === 'content' || review.target === 'key', `review ${review.id}: target غیرمجاز`);
  }
  for (const dispute of registry.disputes ?? []) {
    collectErrors(errors, revisionIds.has(dispute.revisionId), `dispute ${dispute.id}: dangling revisionId`);
    collectErrors(errors, questionIds.has(dispute.questionId), `dispute ${dispute.id}: dangling questionId`);
    collectErrors(errors, DISPUTE_STATUSES.includes(dispute.status), `dispute ${dispute.id}: status غیرمجاز`);
    if (dispute.keyRevisionId !== null) {
      collectErrors(errors, keyIds.has(dispute.keyRevisionId), `dispute ${dispute.id}: dangling keyRevisionId`);
    }
  }

  return { errors };
}

/* ---------- Legacy adapter: تبدیل مدل flat به canonical بدون حذف تاریخچه ---------- */

export interface LegacyFlatQuestion {
  id: string;
  nodeId: string;
  text: string;
  options: string[];
  correctOption?: number;
  examYear?: number;
  isVerified?: boolean;
  contentOrigin?: 'official_booklet' | 'textbook_designed' | 'synthetic_demo';
}

/**
 * نگاشت صریح legacy → canonical. هیچ کلیدی حذف نمی‌شود؛ هر دادهٔ نامشخص با
 * وضعیت reported/unknown ثبت می‌شود و هرگز به official ارتقا نمی‌یابد.
 */
export function toCanonicalFromLegacy(
  flat: LegacyFlatQuestion,
  now = new Date().toISOString(),
): { question: CanonicalQuestion; revision: QuestionRevision; key: AnswerKeyRevision } {
  const trust: TrustLevel =
    flat.contentOrigin === 'official_booklet' ? 'reported' : 'user';
  const rights: QuestionRightsStatus = flat.contentOrigin === 'official_booklet' ? 'unknown' : 'original_ael';
  return {
    question: {
      id: flat.id,
      primaryNodeId: flat.nodeId,
      origin: 'official_imported',
      rightsStatus: rights,
      trustLevel: trust,
      createdAt: now,
    },
    revision: {
      id: `${flat.id}#rev1`,
      questionId: flat.id,
      revisionNo: 1,
      prompt: flat.text,
      choices: flat.options,
      kind: 'mcq',
      status: 'published',
      createdBy: 'legacy-import',
      createdAt: now,
    },
    key: {
      id: `${flat.id}#key1`,
      questionId: flat.id,
      revisionId: `${flat.id}#rev1`,
      correctOption: typeof flat.correctOption === 'number' ? flat.correctOption : null,
      status: 'pending_review',
      supersedes: null,
      approvedBy: null,
      approvedAt: null,
      rationale: 'legacy flat-bank import — کلید با وضعیت pending_review؛ هرگز official تلقی نمی‌شود',
      createdAt: now,
    },
  };
}
