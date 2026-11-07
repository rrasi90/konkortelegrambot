/**
 * Candidate-facing exam selection model.
 *
 * One plan is pinned to exactly one immutable ExamEventVersion (therefore one
 * exam level, year and session). A candidate may keep multiple plans for
 * different levels/years simultaneously.
 *
 * A study plan is NOT an official registration. Study plans may cover several
 * combinations for learning; registration intent is checked against the
 * event-version's verified selection policy.
 */
import type {
  ExamCombinationSubfieldMapping,
  ExamSelectionPolicy,
  ExamSetCombinationMapping,
  ExamSetSelectionCategory,
  ExamSubjectRole,
  RegistryExamCombination,
  RegistryExamSet,
  RegistryVersionStatus,
  Subfield,
} from './registry';

export type CandidateExamPlanPurpose = 'study_plan' | 'registration_intent' | 'official_registration';
export type CandidateExamPlanStatus = 'draft' | 'active' | 'paused' | 'submitted' | 'verified' | 'superseded' | 'completed';
export type CandidateExamSelectionRole = 'primary' | 'secondary' | 'study_only';

export interface CandidateExamPlan {
  id: string;
  candidateId: string;
  /** Immutable pin: exam level + year + session + rule version. */
  eventVersionId: string;
  purpose: CandidateExamPlanPurpose;
  status: CandidateExamPlanStatus;
  planVersion: number;
  /** Hash of the selection rules shown when the candidate confirmed this plan. */
  pinnedRulesHash: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateExamPlanSelection {
  id: string;
  planId: string;
  examSetId: string;
  combinationId: string | null;
  subfieldCode: string | null;
  role: CandidateExamSelectionRole;
  priorityOrder: number;
  /** Product study-track IDs; not official exam codes. */
  studyTrackCodes: string[];
  note: string | null;
}

export interface CandidateExamSelectionContext {
  eventVersionIds?: ReadonlySet<string>;
  examSets: readonly RegistryExamSet[];
  combinations: readonly RegistryExamCombination[];
  setCombinationMappings: readonly ExamSetCombinationMapping[];
  combinationSubfields: readonly ExamCombinationSubfieldMapping[];
  subfields: readonly Subfield[];
  policies: readonly ExamSelectionPolicy[];
}

export interface CandidateExamPlanIssue {
  code: string;
  path: string;
  message: string;
}
export type CandidateExamEligibility = 'not_applicable' | 'verified' | 'unverified';
export interface CandidateExamPlanValidation {
  ok: boolean;
  eligibility: CandidateExamEligibility;
  errors: CandidateExamPlanIssue[];
  warnings: CandidateExamPlanIssue[];
  selectedSetCount: number;
  selectedCombinationCount: number;
}

/**
 * Validate both the structural selection and the applicability of official
 * admission constraints. Unknown policy is never converted into permission.
 */
export function validateCandidateExamPlan(
  plan: CandidateExamPlan,
  selections: readonly CandidateExamPlanSelection[],
  context: CandidateExamSelectionContext,
): CandidateExamPlanValidation {
  const errors: CandidateExamPlanIssue[] = [];
  const warnings: CandidateExamPlanIssue[] = [];
  const add = (target: CandidateExamPlanIssue[], code: string, path: string, message: string) => {
    target.push({ code, path, message });
  };

  if (!plan || typeof plan !== 'object') {
    return {
      ok: false, eligibility: 'unverified',
      errors: [{ code: 'invalid_plan', path: 'plan', message: 'برنامهٔ آزمون معتبر نیست.' }],
      warnings: [], selectedSetCount: 0, selectedCombinationCount: 0,
    };
  }
  if (!plan.id?.trim() || !plan.candidateId?.trim()) add(errors, 'missing_identity', 'plan', 'شناسهٔ برنامه و داوطلب الزامی است.');
  if (!plan.eventVersionId?.trim()) add(errors, 'missing_event_version', 'plan.eventVersionId', 'نسخهٔ دقیق رویداد آزمون الزامی است.');
  if (!['study_plan','registration_intent','official_registration'].includes(plan.purpose)) add(errors, 'invalid_purpose', 'plan.purpose', 'نوع برنامه معتبر نیست.');
  if (!['draft','active','paused','submitted','verified','superseded','completed'].includes(plan.status)) add(errors, 'invalid_status', 'plan.status', 'وضعیت برنامه معتبر نیست.');
  if (!Number.isInteger(plan.planVersion) || plan.planVersion < 1) add(errors, 'invalid_version', 'plan.planVersion', 'نسخهٔ برنامه باید عدد صحیح مثبت باشد.');
  if (context.eventVersionIds && !context.eventVersionIds.has(plan.eventVersionId)) add(errors, 'unknown_event_version', 'plan.eventVersionId', 'نسخهٔ آزمون در رجیستری پیدا نشد.');

  const active = ['active','submitted','verified','completed'].includes(plan.status);
  const selected = selections.filter(item => item.planId === plan.id);
  if (selected.length !== selections.length) add(errors, 'foreign_selection', 'selections', 'همهٔ انتخاب‌ها باید به همین برنامه متصل باشند.');

  const setById = new Map(context.examSets.map(item => [item.id, item]));
  const combinationById = new Map(context.combinations.map(item => [item.id, item]));
  const subfieldByCode = new Map(context.subfields.map(item => [item.code, item]));
  const setComboKeys = new Set(context.setCombinationMappings
    .filter(link => ['approved','published'].includes(link.status))
    .map(link => link.examSetId + '|' + link.combinationId));
  const comboSubfieldMap = new Map<string, ExamCombinationSubfieldMapping>();
  for (const link of context.combinationSubfields) {
    comboSubfieldMap.set(link.combinationId + '|' + link.subfieldCode, link);
  }

  const selectionKeys = new Set<string>();
  const selectionIds = new Set<string>();
  const priorities = new Set<number>();
  const countsBySet = new Map<string, number>();
  const countsByCategory = new Map<ExamSetSelectionCategory, number>();
  let combinationCount = 0;
  let primaryCount = 0;
  let secondaryCount = 0;

  selected.forEach((item, index) => {
    const path = 'selections[' + index + ']';
    if (!item.id?.trim() || selectionIds.has(item.id)) add(errors, 'duplicate_selection_id', path + '.id', 'شناسهٔ انتخاب خالی یا تکراری است.');
    selectionIds.add(item.id);
    if (!['primary','secondary','study_only'].includes(item.role)) add(errors, 'invalid_selection_role', path + '.role', 'نقش انتخاب معتبر نیست.');
    if (!Number.isInteger(item.priorityOrder) || item.priorityOrder < 1 || priorities.has(item.priorityOrder)) {
      add(errors, 'invalid_priority', path + '.priorityOrder', 'ترتیب انتخاب باید عدد صحیح مثبت و یکتا باشد.');
    }
    priorities.add(item.priorityOrder);
    if (!Array.isArray(item.studyTrackCodes) || item.studyTrackCodes.some(code => typeof code !== 'string' || !code.trim())) {
      add(errors, 'invalid_study_tracks', path + '.studyTrackCodes', 'مسیرهای مطالعه باید فهرست شناسه‌های غیرخالی باشند.');
    }
    if (item.note !== null && item.note !== undefined && typeof item.note !== 'string') add(errors, 'invalid_note', path + '.note', 'یادداشت باید متن یا null باشد.');

    const key = item.examSetId + '|' + (item.combinationId ?? '-') + '|' + (item.subfieldCode ?? '-');
    if (selectionKeys.has(key)) add(errors, 'duplicate_selection', path, 'همین مجموعه/ترکیب/گرایش قبلاً انتخاب شده است.');
    selectionKeys.add(key);

    const set = setById.get(item.examSetId);
    if (!set) {
      add(errors, 'unknown_exam_set', path + '.examSetId', 'مجموعهٔ آزمون پیدا نشد.');
      return;
    }
    if (set.eventVersionId !== plan.eventVersionId) add(errors, 'event_version_mismatch', path + '.examSetId', 'مجموعهٔ انتخاب‌شده متعلق به نسخهٔ آزمون دیگری است.');
    const category = set.selectionCategory ?? 'unknown';
    countsByCategory.set(category, (countsByCategory.get(category) ?? 0) + 1);
    countsBySet.set(set.id, (countsBySet.get(set.id) ?? 0) + 1);

    if (item.combinationId) {
      combinationCount += 1;
      const combo = combinationById.get(item.combinationId);
      if (!combo) add(errors, 'unknown_combination', path + '.combinationId', 'کد ترکیب پیدا نشد.');
      else {
        if (combo.eventVersionId !== plan.eventVersionId) add(errors, 'event_version_mismatch', path + '.combinationId', 'کد ترکیب متعلق به نسخهٔ آزمون دیگری است.');
        if (!setComboKeys.has(set.id + '|' + combo.id)) add(errors, 'combination_not_in_set', path + '.combinationId', 'این کد ترکیب به مجموعهٔ انتخاب‌شده متصل نیست.');
      }
    } else if (set.requiresCombinationSelection === true) {
      add(errors, 'combination_required', path + '.combinationId', 'برای این مجموعه باید کد ترکیب مشخص شود.');
    }

    if (item.subfieldCode) {
      if (!item.combinationId) add(errors, 'subfield_without_combination', path + '.subfieldCode', 'انتخاب گرایش بدون کد ترکیب مجاز نیست.');
      if (!subfieldByCode.has(item.subfieldCode)) add(errors, 'unknown_subfield', path + '.subfieldCode', 'گرایش در رجیستری پیدا نشد.');
      const mapping = item.combinationId ? comboSubfieldMap.get(item.combinationId + '|' + item.subfieldCode) : undefined;
      if (!mapping) add(errors, 'subfield_not_in_combination', path + '.subfieldCode', 'این گرایش در این کد ترکیب ثبت نشده است.');
      else if (mapping.eligibility === 'restricted' || mapping.eligibility === 'not_available') {
        if (plan.purpose === 'study_plan') add(warnings, 'restricted_study_target', path + '.subfieldCode', 'این گرایش برای پذیرش در وضعیت محدود/غیرقابل‌دسترس ثبت شده؛ امکان مطالعه با امکان ثبت‌نام یکی نیست.');
        else add(errors, 'ineligible_subfield', path + '.subfieldCode', 'این گرایش طبق وضعیت فعلی برای این ترکیب قابل انتخاب نیست.');
      } else if (mapping.eligibility === 'conditional' || mapping.eligibility === 'needs_check') {
        add(warnings, 'conditional_subfield', path + '.subfieldCode', 'شرط پذیرش یا تطبیق رسمی این گرایش هنوز نیازمند بررسی است.');
      }
    }

    if (item.role === 'primary') primaryCount += 1;
    if (item.role === 'secondary') secondaryCount += 1;
  });

  if (selected.length > 1 && selected.some(item => item.role === 'study_only') &&
      selected.some(item => item.role !== 'study_only')) {
    add(errors, 'mixed_selection_roles', 'selections', 'انتخاب‌های study_only را با انتخاب‌های primary/secondary در یک برنامه مخلوط نکن.');
  }
  if (primaryCount > 1) add(errors, 'multiple_primary', 'selections', 'در یک برنامه حداکثر یک انتخاب اصلی مجاز است.');
  if (secondaryCount > 1) add(errors, 'multiple_secondary', 'selections', 'در یک برنامه حداکثر یک انتخاب ثانویه مجاز است.');
  if (active && plan.purpose !== 'study_plan' && primaryCount !== 1) add(errors, 'primary_required', 'selections', 'برنامهٔ فعال ثبت‌نامی دقیقاً به یک انتخاب اصلی نیاز دارد.');

  const eventPolicies = context.policies.filter(policy =>
    policy.eventVersionId === plan.eventVersionId &&
    policy.purpose === plan.purpose &&
    policy.examSetId === null,
  );
  const policy = eventPolicies[0];
  if (eventPolicies.length > 1) add(errors, 'duplicate_event_policy', 'context.policies', 'برای این رویداد و هدف بیش از یک policy عمومی وجود دارد.');

  let eligibility: CandidateExamEligibility = plan.purpose === 'study_plan' ? 'not_applicable' : 'unverified';
  if (!policy) {
    if (plan.purpose !== 'study_plan') add(warnings, 'selection_policy_missing', 'plan.eventVersionId', 'قواعد رسمی انتخاب برای این رویداد ثبت نشده‌اند؛ این برنامه نباید به‌عنوان واجدشرایط ثبت‌نام اعلام شود.');
    if (plan.purpose === 'official_registration') add(errors, 'official_policy_required', 'plan.purpose', 'ثبت رسمی بدون policy ثبت‌نامِ راستی‌آزمایی‌شده ممکن نیست.');
  } else {
    const policyVerified = policy.policyOrigin === 'official' && policy.verification === 'official_verified' &&
      ['approved','published'].includes(policy.status);
    if (plan.purpose !== 'study_plan' && policyVerified) eligibility = 'verified';
    if (plan.purpose === 'official_registration' && !policyVerified) add(errors, 'official_policy_unverified', 'plan.purpose', 'policy موجود رسمی و منتشرشده نیست؛ ثبت رسمی قابل تأیید نیست.');

    const enforce = plan.purpose === 'study_plan' ? policy.policyOrigin === 'product' || policy.policyOrigin === 'official'
      : policyVerified;
    if (enforce) {
      if (active && policy.minSelections !== null && selected.length < policy.minSelections) add(errors, 'below_minimum', 'selections', 'تعداد انتخاب‌ها از حداقل مقرر کمتر است.');
      if (policy.maxSelections !== null && selected.length > policy.maxSelections) add(errors, 'above_maximum', 'selections', 'تعداد انتخاب‌ها از حداکثر مجاز بیشتر است.');
      if (policy.mode === 'single' && selected.length > 1) add(errors, 'single_selection_only', 'selections', 'این policy فقط یک انتخاب را اجازه می‌دهد.');
      if (policy.mode === 'primary_plus_secondary' && (selected.length > 2 || secondaryCount > 1)) add(errors, 'primary_secondary_limit', 'selections', 'این policy فقط یک انتخاب اصلی و حداکثر یک انتخاب ثانویه را اجازه می‌دهد.');
      if (policy.requiresPrimarySelection && active && primaryCount !== 1) add(errors, 'primary_required', 'selections', 'policy یک انتخاب اصلی می‌خواهد.');
      if (policy.mode === 'unverified' && plan.purpose !== 'study_plan') {
        eligibility = 'unverified';
        add(warnings, 'policy_unverified', 'plan.purpose', 'قواعد انتخاب برای این سال هنوز تأیید نشده‌اند.');
      }
      if (!policy.allowMultipleCombinationsPerSet && [...countsBySet.values()].some(count => count > 1)) {
        add(errors, 'multiple_combinations_same_set', 'selections', 'انتخاب بیش از یک ترکیب از یک مجموعه طبق این policy مجاز نیست.');
      }
      if (policy.maxCombinationsPerSet !== null && [...countsBySet.values()].some(count => count > policy.maxCombinationsPerSet!)) {
        add(errors, 'too_many_combinations_same_set', 'selections', 'تعداد ترکیب‌های یک مجموعه از حد مجاز بیشتر است.');
      }
      for (const limit of policy.categoryLimits) {
        const count = countsByCategory.get(limit.category) ?? 0;
        if (active && count < limit.minSelections) add(errors, 'category_below_minimum', 'selections', 'تعداد انتخاب در دستهٔ ' + limit.category + ' از حداقل کمتر است.');
        if (limit.maxSelections !== null && count > limit.maxSelections) add(errors, 'category_above_maximum', 'selections', 'تعداد انتخاب در دستهٔ ' + limit.category + ' از حداکثر بیشتر است.');
      }
    }
  }

  return {
    ok: errors.length === 0,
    eligibility,
    errors,
    warnings,
    selectedSetCount: new Set(selected.map(item => item.examSetId)).size,
    selectedCombinationCount: combinationCount,
  };
}
