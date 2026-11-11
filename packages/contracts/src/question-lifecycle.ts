/**
 * V3-041..044 — چرخهٔ عمر سؤال، moderation و dispute (مأموریت v5 §8)
 *
 * این ماژول ماشین‌حالت و گاردهای role-محور چرخهٔ عمر سؤال را روی مدل canonical
 * (V3-040) پیاده می‌کند؛ server-enforcement نهایی مسئول Worker است (§8: policy
 * server-side، نه فقط UI). قواعد:
 *   - transition فقط با نقش مجاز + reason؛ هر گذار audit می‌خواهد
 *   - author نمی‌تواند reviewer نهایی خودش باشد (سیاست تأیید دوگانهٔ صریح)
 *   - هیچ سؤال user-authored بدون تأیید معتبر وارد production scoring نمی‌شود
 *   - اصلاح کلید = نسخهٔ append-only جدید؛ تاریخچه و نتایج حفظ می‌شود
 *   - dispute بدون افشای کلید عمومی پیگیری می‌شود
 */

import {
  computeAllowedUse,
  type AnswerKeyRevision,
  type AllowedUse,
  type QuestionDispute,
  type QuestionRevision,
  type QuestionRevisionStatus,
  type TrustLevel,
  type QuestionVerificationStatus,
} from './question-model';

export const ACTOR_ROLES = ['author', 'moderator', 'sme', 'system', 'admin'] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export interface LifecycleTransition {
  from: QuestionRevisionStatus;
  to: QuestionRevisionStatus;
  /** نقش‌هایی که مجاز به این گذارند */
  allowedRoles: ActorRole[];
  /** دلیل گذار الزامی است (audit trail) */
  requiresReason: boolean;
}

export const LIFECYCLE_TRANSITIONS: LifecycleTransition[] = [
  { from: 'draft', to: 'submitted', allowedRoles: ['author', 'admin'], requiresReason: false },
  { from: 'submitted', to: 'in_review', allowedRoles: ['moderator', 'admin'], requiresReason: false },
  { from: 'in_review', to: 'approved', allowedRoles: ['sme', 'admin'], requiresReason: false },
  { from: 'in_review', to: 'changes_requested', allowedRoles: ['sme', 'moderator', 'admin'], requiresReason: true },
  { from: 'in_review', to: 'rejected', allowedRoles: ['sme', 'admin'], requiresReason: true },
  { from: 'changes_requested', to: 'submitted', allowedRoles: ['author', 'admin'], requiresReason: false },
  { from: 'approved', to: 'published', allowedRoles: ['moderator', 'admin'], requiresReason: false },
  { from: 'published', to: 'suspended', allowedRoles: ['moderator', 'admin'], requiresReason: true },
  { from: 'suspended', to: 'published', allowedRoles: ['moderator', 'admin'], requiresReason: true },
  { from: 'published', to: 'archived', allowedRoles: ['admin'], requiresReason: true },
  { from: 'draft', to: 'withdrawn', allowedRoles: ['author', 'admin'], requiresReason: false },
  { from: 'submitted', to: 'withdrawn', allowedRoles: ['author', 'admin'], requiresReason: true },
];

export class LifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifecycleError';
  }
}

export interface TransitionInput {
  currentStatus: QuestionRevisionStatus;
  to: QuestionRevisionStatus;
  actorId: string;
  actorRole: ActorRole;
  /** creator نسخه — برای سیاست author≠final reviewer */
  revisionCreatedBy: string;
  reason?: string;
}

/** گذار مجاز؟ — بدون mutate؛ خروجی وضعیت جدید برای caller */
export function assertTransition(input: TransitionInput): QuestionRevisionStatus {
  const transition = LIFECYCLE_TRANSITIONS.find((t) => t.from === input.currentStatus && t.to === input.to);
  if (!transition) {
    throw new LifecycleError(`گذار ${input.currentStatus} → ${input.to} در چرخهٔ عمر تعریف نشده است.`);
  }
  if (!transition.allowedRoles.includes(input.actorRole)) {
    throw new LifecycleError(`نقش «${input.actorRole}» مجاز به گذار ${input.currentStatus} → ${input.to} نیست.`);
  }
  if (transition.requiresReason && !(input.reason && input.reason.trim().length >= 3)) {
    throw new LifecycleError('این گذار دلیل الزامی دارد (audit trail).');
  }
  // سیاست تأیید دوگانه: author نمی‌تواند reviewer نهایی محتوای خودش باشد
  const isFinalApproval = input.to === 'approved' || input.to === 'published';
  if (isFinalApproval && input.actorId === input.revisionCreatedBy && input.actorRole !== 'admin') {
    throw new LifecycleError('author نمی‌تواند تأیید نهایی محتوای خودش باشد (تأیید دوگانه الزامی است).');
  }
  // هیچ مسیر مستقیم draft→published وجود ندارد:
  if (input.currentStatus === 'draft' && input.to === 'published') {
    throw new LifecycleError('انتشار مستقیم از draft ممنوع است؛ حداقل یک سیکل بازبینی لازم است.');
  }
  return input.to;
}

/* ---------- V3-043 — اتصال trust/allowedUse به موتور ---------- */

export interface EngineEligibilityInput {
  revisionStatus: QuestionRevisionStatus;
  trustLevel: TrustLevel;
  verification: QuestionVerificationStatus;
  keyRevisions: AnswerKeyRevision[];
  disputes: QuestionDispute[];
  requestedUse: AllowedUse;
}

/**
 * eligibility موتور برای یک کاربرد خاص — server-side. سؤال user-authored یا
 * فاقد کلید تأییدشده وارد proof/timed_exam نمی‌شود؛ سؤال disputed فقط مرور.
 */
export function isEligibleForUse(input: EngineEligibilityInput): { eligible: boolean; reason: string } {
  const activeDispute = input.disputes.some((d) => d.status === 'open' || d.status === 'under_review');
  const hasApprovedKey = input.keyRevisions.some((k) => k.status === 'approved');
  const allowed = computeAllowedUse({
    trustLevel: input.trustLevel,
    verification: input.verification,
    hasApprovedKey,
    disputed: activeDispute,
  });
  if (input.revisionStatus !== 'published') {
    return { eligible: false, reason: `وضعیت نسخه «${input.revisionStatus}» است؛ فقط published وارد موتور می‌شود.` };
  }
  if (allowed.includes(input.requestedUse)) {
    return { eligible: true, reason: 'مجاز طبق policy' };
  }
  return {
    eligible: false,
    reason: activeDispute
      ? 'سؤال در وضعیت dispute است و از این کاربرد خارج شده (quarantine).'
      : `کاربرد «${input.requestedUse}» با trust/verification/کلید سازگار نیست.`,
  };
}

/* ---------- V3-044 — dispute و اصلاح کلید ---------- */

export class DisputeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisputeError';
  }
}

/** ثبت dispute: حداقل evidence لازم؛ بدون نیاز به دیدن کلید */
export function openDispute(input: {
  dispute: QuestionDispute;
  questionPromptLength?: number;
}): QuestionDispute {
  if (!input.dispute.evidence || input.dispute.evidence.trim().length < 10) {
    throw new DisputeError('اعتراض بدون مدرک قابل بررسی ثبت نمی‌شود (حداقل ۱۰ نویسه).');
  }
  return { ...input.dispute, status: 'open' };
}

/**
 * تصمیم dispute: upheld → کلید جدید append-only ساخته می‌شود (نسخهٔ قبلی
 * superseded) و id کاربران متأثر قابل محاسبه است؛ rejected → تاریخچه حفظ.
 */
export function resolveDispute(input: {
  dispute: QuestionDispute;
  keyRevisions: AnswerKeyRevision[];
  upheld: boolean;
  newKey?: { correctOption: number; rationale: string; approvedBy: string; approvedAt: string };
  resolverRole: ActorRole;
}): { dispute: QuestionDispute; newKeyRevisions: AnswerKeyRevision[] } {
  if (input.resolverRole !== 'sme' && input.resolverRole !== 'admin') {
    throw new DisputeError('فقط SME/admin می‌تواند dispute را حل کند.');
  }
  if (input.dispute.status !== 'open' && input.dispute.status !== 'under_review') {
    throw new DisputeError(`dispute در وضعیت «${input.dispute.status}» قابل حل نیست.`);
  }
  if (input.upheld) {
    const target = input.dispute.keyRevisionId
      ? input.keyRevisions.find((k) => k.id === input.dispute.keyRevisionId)
      : undefined;
    if (!target) {
      throw new DisputeError('اعتراض به کلید بدون ارجاع به نسخهٔ کلید قابل حل نیست.');
    }
    if (!input.newKey) {
      throw new DisputeError('پذیرش اعتراض بدون کلید اصلاح‌شده ممکن نیست.');
    }
    const old = input.keyRevisions.map((k) =>
      k.id === target.id ? { ...k, status: 'superseded' as const } : k,
    );
    const created: AnswerKeyRevision = {
      id: `${target.id}.fix${old.length + 1}`,
      questionId: target.questionId,
      revisionId: target.revisionId,
      correctOption: input.newKey.correctOption,
      status: 'approved',
      supersedes: target.id,
      approvedBy: input.newKey.approvedBy,
      approvedAt: input.newKey.approvedAt,
      rationale: `dispute ${input.dispute.id}: ${input.newKey.rationale}`,
      createdAt: input.newKey.approvedAt,
    };
    return {
      dispute: { ...input.dispute, status: 'resolved_upheld', resolvedAt: input.newKey.approvedAt },
      newKeyRevisions: [...old, created],
    };
  }
  return {
    dispute: {
      ...input.dispute,
      status: 'resolved_rejected',
      resolution: input.dispute.resolution ?? 'اعتراض پس از بررسی رد شد؛ کلید حفظ شد.',
      resolvedAt: new Date().toISOString(),
    },
    newKeyRevisions: input.keyRevisions,
  };
}

/** شناسایی کاربران متأثر از تغییر کلید — مسیر اصلاح/اطلاع‌رسانی (§8/§V3-044) */
export function affectedAttemptRefs(input: {
  attemptsByQuestion: Array<{ attemptId: string; userId: string; questionId: string; selectedOption: number | null }>;
  oldKey: AnswerKeyRevision;
  newKey: AnswerKeyRevision;
}): Array<{ userId: string; attemptId: string; wasCountedCorrect: boolean; nowCountedCorrect: boolean }> {
  const oldCorrect = input.newKey.supersedes ? undefined : null;
  void oldCorrect;
  return input.attemptsByQuestion
    .filter((a) => a.questionId === input.newKey.questionId)
    .map((a) => ({
      userId: a.userId,
      attemptId: a.attemptId,
      wasCountedCorrect: a.selectedOption !== null && a.selectedOption === input.oldKey.correctOption,
      nowCountedCorrect: a.selectedOption !== null && a.selectedOption === input.newKey.correctOption,
    }))
    .filter((r) => r.wasCountedCorrect !== r.nowCountedCorrect);
}
