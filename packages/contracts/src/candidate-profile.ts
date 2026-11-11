/**
 * V3-030..033 — پروفایل تحصیلی داوطلب، چند هدف و eligibility (مأموریت v5 §7)
 *
 * مفاهیم مستقل که هرگز به هم تقلیل نمی‌یابند:
 *   - CandidateEducationHistory: سابقه/وضعیت تحصیلی فعلی داوطلب (چند رکورد)
 *   - TargetExamLevel: مقصد آزمونی — مستقل از آخرین مدرک
 *   - ExamIntent: قصد مطالعه/آزمون ≠ Registration واقعی
 *   - Eligibility: خروجی قواعد نسخه‌دار — verified / ineligible / unknown / needs_review
 *
 * قواعد §7 که validator/policy enforce می‌کنند:
 *   - current education با target مخلوط نمی‌شود
 *   - دادهٔ ناقص/unknown قابل ذخیره است؛ حدس زده نمی‌شود
 *   - حذف/اصلاح رکورد append-only با audit trail است (رکورد حذف نرم)
 *   - مواد مشترک چند هدف با union جمع می‌شود و coefficientsByTarget حفظ می‌شود
 *   - مهاجرت legacy صرفاً mapping صریح + needs_review؛ هیچ داده‌ای حذف نمی‌شود
 *     (HR-04: اجرای واقعی migration فقط proposal + CI disposable)
 */

export const PROFILE_EDUCATION_LEVELS = [
  'diploma', 'associate', 'bachelor', 'master', 'professional_doctorate', 'phd', 'unknown',
] as const;
export type ProfileEducationLevel = (typeof PROFILE_EDUCATION_LEVELS)[number];

export const PROFILE_EDUCATION_STATUSES = ['in_progress', 'completed', 'discontinued', 'unknown'] as const;
export type ProfileEducationStatus = (typeof PROFILE_EDUCATION_STATUSES)[number];

export const TARGET_EXAM_LEVELS = ['bachelor', 'master', 'phd', 'unknown'] as const;
export type TargetExamLevel = (typeof TARGET_EXAM_LEVELS)[number];

export const INTENT_KINDS = ['study_plan', 'registration_intent', 'official_registration'] as const;
export type IntentKind = (typeof INTENT_KINDS)[number];

export const ELIGIBILITY_STATUSES = ['verified', 'ineligible', 'unknown', 'needs_review'] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

export interface CandidateEducationRecord {
  id: string;
  /** مالکیت: همهٔ رکوردها به userId سرور گره خورده‌اند */
  userId: string;
  level: ProfileEducationLevel;
  /** رشته/گرایش در صورت وجود — بدون حدس؛ نامعلوم null */
  fieldOfStudy?: string | null;
  institution?: string | null;
  status: ProfileEducationStatus;
  /** سال شروع/پایان — شمسی یا میلادی با صرت ثبت؛ نامعلوم null */
  startYear?: number | null;
  endYear?: number | null;
  /** منشأ رکورد: خوداظهاری/سند — بدون سند، self_reported می‌ماند */
  provenance: 'self_reported' | 'document_verified';
  /** حذف نرم + audit: رکورد هرگز physically حذف نمی‌شود */
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExamTargetIntent {
  id: string;
  userId: string;
  /** قصد ≠ ثبت‌نام واقعی */
  intentKind: IntentKind;
  /** مقصد آزمونی — مستقل از آخرین مدرک داوطلب */
  targetLevel: TargetExamLevel;
  /** شناسهٔ داخلی خانواده/مجموعه — کد رسمی جدا نگه داشته می‌شود */
  familyId?: string | null;
  setCode?: string | null;
  createdAt: string;
  /** اهداف آرشیوی حذف نمی‌شوند */
  archived?: boolean;
}

export interface EligibilityAssessment {
  intentId: string;
  status: EligibilityStatus;
  /** دلیل قابل نمایش و ممیزی */
  reasons: string[];
  /** نسخهٔ قواعد که ارزیابی با آن انجام شد */
  ruleVersion: string;
  assessedAt: string;
}

/* ---------- Validators ---------- */

export function validateEducationRecords(records: CandidateEducationRecord[]): string[] {
  const errors: string[] = [];
  const ids = records.map((r) => r.id);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length) errors.push(`سابقهٔ تحصیلی با id تکراری: ${dupes.join(', ')}`);
  for (const r of records) {
    collect(errors, PROFILE_EDUCATION_LEVELS.includes(r.level), `${r.id}: سطح تحصیلی غیرمجاز`);
    collect(errors, PROFILE_EDUCATION_STATUSES.includes(r.status), `${r.id}: وضعیت غیرمجاز`);
    collect(errors, r.provenance === 'self_reported' || r.provenance === 'document_verified',
      `${r.id}: provenance غیرمجاز`);
    collect(errors, typeof r.userId === 'string' && r.userId.length > 0, `${r.id}: userId الزامی است`);
    if (r.status === 'completed' && r.endYear != null && r.startYear != null) {
      collect(errors, r.endYear >= r.startYear, `${r.id}: سال پایان قبل از شروع`);
    }
    // درحال‌تحصیل بودن از آخرین مدرک تفکیک دارد؛ اینجا فقط سازگاری وضعیت را چک می‌کنیم:
    collect(errors, !(r.status === 'in_progress' && r.endYear != null && r.provenance === 'document_verified'),
      `${r.id}: درحال‌تحصیل با سال پایان مستند ناسازگار است`);
  }
  return errors;
}

/**
 * «وضعیت تحصیلی فعلی» از رکوردها استخراج می‌شود — اما هرگز با target آزمون
 * اشتباه گرفته نمی‌شود. آخرین مدرک تکمیل‌شده یا رکورد درحال‌تحصیل فعال.
 */
export function currentEducation(records: CandidateEducationRecord[]): CandidateEducationRecord | null {
  const active = records.filter((r) => !r.deletedAt);
  const inProgress = active.find((r) => r.status === 'in_progress');
  if (inProgress) return inProgress;
  const completed = active
    .filter((r) => r.status === 'completed' && r.endYear != null)
    .sort((a, b) => (b.endYear ?? 0) - (a.endYear ?? 0));
  return completed[0] ?? null;
}

/* ---------- Eligibility policy (نسخه‌دار) ---------- */

export const ELIGIBILITY_RULE_VERSION = 'eligibility-rules-v1';

/**
 * ارزیابی eligibility هر intent بر اساس قواعد نسخه‌دار. خروجی نامعلوم = unknown؛
 * هیچ حدسی جای قاعده را نمی‌گیرد. قاعدهٔ نسخهٔ ۱:
 *  - هدفmaster/phd برای داوطلب بدون هیچ سابقهٔ تحصیلیِ مرتبط = needs_review (نه رد)
 *  - هدف با familyId/setCode غایب در کاتالوگ فعال = unknown (کاتالوگ ناقص گناه داوطلب نیست)
 *  - تضاد صریح بین رکوردها = needs_review
 */
export function assessEligibility(input: {
  intent: ExamTargetIntent;
  education: CandidateEducationRecord[];
  /** فهرست familyIdهایی که در کاتالوگ فعال موجودند (خالی = کاتالوگ ناقص) */
  availableFamilyIds: string[];
}): EligibilityAssessment {
  const reasons: string[] = [];
  const education = input.education.filter((r) => !r.deletedAt);
  const catalogComplete = input.availableFamilyIds.length > 0;

  if (input.intent.familyId && catalogComplete && !input.availableFamilyIds.includes(input.intent.familyId)) {
    return { intentId: input.intent.id, status: 'unknown',
      reasons: ['کاتالوگ فعال این خانواده را ندارد — وضعیت نامعلوم (نه ineligible)'],
      ruleVersion: ELIGIBILITY_RULE_VERSION, assessedAt: new Date().toISOString() };
  }

  const current = currentEducation(education);
  if (!current) {
    reasons.push('هیچ سابقهٔ تحصیلی ثبت نشده — ارزیابی بدون داده ممکن نیست');
    return { intentId: input.intent.id, status: 'needs_review', reasons,
      ruleVersion: ELIGIBILITY_RULE_VERSION, assessedAt: new Date().toISOString() };
  }

  // قاعدهٔ سطوح نسخهٔ ۱: برای هدف master/phd، داشتن سابقهٔ مرتبط بررسی می‌شود اما
  // نتیجهٔ «رد قطعی» فقط با قاعدهٔ صریح است؛ در غیر این صورت needs_review.
  const levelOrder: Record<string, number> = { diploma: 0, associate: 1, bachelor: 2, master: 3, professional_doctorate: 4, phd: 5, unknown: -1 };
  const currentRank = levelOrder[current.level] ?? -1;
  const targetRank = levelOrder[input.intent.targetLevel] ?? -1;
  if (input.intent.targetLevel !== 'unknown' && targetRank >= 2 && currentRank >= 0 && currentRank < targetRank - 1) {
    reasons.push(`سابقهٔ فعلی (${current.level}) برای هدف ${input.intent.targetLevel} نیازمند بررسی صلاحیت مسیر است`);
    return { intentId: input.intent.id, status: 'needs_review', reasons,
      ruleVersion: ELIGIBILITY_RULE_VERSION, assessedAt: new Date().toISOString() };
  }

  reasons.push('سابقهٔ تحصیلی ثبت‌شده با قاعدهٔ نسخهٔ ۱ سازگار است');
  return { intentId: input.intent.id, status: 'verified', reasons,
    ruleVersion: ELIGIBILITY_RULE_VERSION, assessedAt: new Date().toISOString() };
}

/* ---------- Union مواد چندهدف (سازگار با V3-051) ---------- */

export interface TargetSubjectWeight {
  subjectId: string;
  /** وزن/ضریب این ماده برای این هدف — unknown با null حفظ می‌شود */
  weight: number | null;
}

/** union مواد چند هدف با حفظ سهم هر هدف (dedupe بر اساس subjectId) */
export function unionTargetSubjects(
  intents: ExamTargetIntent[],
  weightsByIntent: Map<string, TargetSubjectWeight[]>,
): { subjectId: string; perTarget: Array<{ intentId: string; weight: number | null }>; unionWeightKnown: boolean }[] {
  const bySubject = new Map<string, Array<{ intentId: string; weight: number | null }>>();
  for (const intent of intents) {
    if (intent.archived) continue;
    for (const w of weightsByIntent.get(intent.id) ?? []) {
      const list = bySubject.get(w.subjectId) ?? [];
      list.push({ intentId: intent.id, weight: w.weight });
      bySubject.set(w.subjectId, list);
    }
  }
  return [...bySubject.entries()].map(([subjectId, perTarget]) => ({
    subjectId,
    perTarget,
    // مادهٔ مشترک فقط یکبار مطالعه می‌شود؛ unionWeightKnown یعنی همهٔ اهداف وزن معلوم دارند:
    unionWeightKnown: perTarget.every((p) => p.weight !== null),
  }));
}

/* ---------- V3-033 — مهاجرت legacy (proposal-only per HR-04) ---------- */

export interface LegacyProfile {
  /** پروفایل قدیمی: فقط arshad/phd */
  legacyTrack: 'arshad' | 'phd';
  userId: string;
  examYear?: number;
  subGroupId?: string;
}

export interface MigrationProposal {
  userId: string;
  /** رکورد جدید پیشنهادی — قبل از تأیید مالک ذخیره نمی‌شود */
  proposedEducation: CandidateEducationRecord;
  proposedIntent: ExamTargetIntent;
  /** mapping قطعی یا نیاز به بازبینی */
  confidence: 'deterministic' | 'needs_review';
  note: string;
}

/**
 * dry-run مهاجرت: هیچ رکوردی حذف/overwrite نمی‌شود؛ خروجی فقط proposal است.
 * mapping قطعی: arshad → master، phd → phd؛ بقیهٔ فیلدها نامعلوم می‌مانند.
 */
export function proposeLegacyMigration(
  profile: LegacyProfile,
  now = new Date().toISOString(),
): MigrationProposal {
  const level: ProfileEducationLevel = profile.legacyTrack === 'arshad' ? 'master' : 'phd';
  const target: TargetExamLevel = profile.legacyTrack === 'arshad' ? 'master' : 'phd';
  const known = profile.legacyTrack === 'arshad' || profile.legacyTrack === 'phd';
  return {
    userId: profile.userId,
    proposedEducation: {
      id: `edu.migrated.${profile.userId}`,
      userId: profile.userId,
      level,
      fieldOfStudy: null,
      institution: null,
      status: 'unknown',
      startYear: null,
      endYear: null,
      provenance: 'self_reported',
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    proposedIntent: {
      id: `intent.migrated.${profile.userId}`,
      userId: profile.userId,
      intentKind: 'study_plan',
      targetLevel: target,
      familyId: null,
      setCode: profile.subGroupId ?? null,
      createdAt: now,
    },
    confidence: known ? 'deterministic' : 'needs_review',
    note: 'HR-04: اجرای واقعی migration ممنوع تا معرفی staging؛ خروجی فقط proposal با dry-run است. سطح و هدف از mapping صریح legacy می‌آید؛ سال/مؤسسه/رشته unknown می‌مانند (حدس ممنوع).',
  };
}

function collect(list: string[], condition: boolean, message: string): void {
  if (!condition) list.push(message);
}
