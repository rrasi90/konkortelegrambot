/**
 * Transparent daily-budget allocator.
 * Score is a prioritization heuristic, not a calibrated prediction of exam outcomes.
 */
export type LearningActionType =
  | 'spaced_review'
  | 'diagnostic_probe'
  | 'remediation'
  | 'new_material'
  | 'unseen_verification'
  | 'strategic_skip';

export interface PlanCandidate {
  id: string;
  actionType: LearningActionType;
  targetId: string;
  examValue: number;
  expectedBenefit: number;
  urgency: number;
  estimatedMinutes: number;
  reason?: string;
}

export interface DailyPlanPolicy {
  dailyMinutes: number;
  maxItems?: number;
  minimumNewMaterialShare?: number;
  maximumRemediationShare?: number;
}

export interface PlannedCandidate extends PlanCandidate {
  score: number;
  selectionReason: string;
}

export interface DailyPlanResult {
  selected: PlannedCandidate[];
  deferred: { candidate: PlanCandidate; reason: string; score: number }[];
  budgetMinutes: number;
  usedMinutes: number;
  newMaterialMinutes: number;
  remediationMinutes: number;
  minimumNewMaterialMinutes: number;
  maximumRemediationMinutes: number;
  warnings: string[];
}

const isRemediation = (action: LearningActionType) =>
  action === 'diagnostic_probe' || action === 'remediation';

function assertCandidate(candidate: PlanCandidate): void {
  if (!candidate.id || !candidate.targetId) throw new Error('Plan candidates require stable ids');
  for (const field of ['examValue', 'expectedBenefit', 'urgency'] as const) {
    if (!Number.isFinite(candidate[field]) || candidate[field] < 0 || candidate[field] > 1) {
      throw new Error(`${field} must be normalized to [0, 1] for ${candidate.id}`);
    }
  }
  if (!Number.isFinite(candidate.estimatedMinutes) || candidate.estimatedMinutes <= 0) {
    throw new Error(`estimatedMinutes must be positive for ${candidate.id}`);
  }
}

export function scorePlanCandidate(candidate: PlanCandidate): number {
  assertCandidate(candidate);
  return (candidate.examValue * candidate.expectedBenefit * candidate.urgency) / candidate.estimatedMinutes;
}

/**
 * Greedy budget allocator. It first reserves time for new material when enough
 * eligible candidates exist, then ranks the remaining candidates. Remediation
 * (diagnosis plus targeted repair) cannot consume more than the configured share.
 */
export function buildDailyPlan(
  inputCandidates: PlanCandidate[],
  policy: DailyPlanPolicy,
): DailyPlanResult {
  if (!Number.isFinite(policy.dailyMinutes) || policy.dailyMinutes <= 0) {
    throw new Error('dailyMinutes must be positive');
  }
  const minimumNewShare = policy.minimumNewMaterialShare ?? 0.25;
  const maximumRemediationShare = policy.maximumRemediationShare ?? 0.4;
  if (minimumNewShare < 0 || minimumNewShare > 1) throw new Error('minimumNewMaterialShare must be in [0, 1]');
  if (maximumRemediationShare < 0 || maximumRemediationShare > 1) throw new Error('maximumRemediationShare must be in [0, 1]');
  if (policy.maxItems !== undefined && (!Number.isInteger(policy.maxItems) || policy.maxItems < 1)) {
    throw new Error('maxItems must be a positive integer');
  }

  const unique = new Map<string, PlanCandidate>();
  for (const candidate of inputCandidates) {
    assertCandidate(candidate);
    if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
  }
  const candidates = [...unique.values()];
  const ranked = candidates
    .map((candidate) => ({ candidate, score: scorePlanCandidate(candidate) }))
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
  const maxItems = policy.maxItems ?? Number.MAX_SAFE_INTEGER;
  const minimumNewMaterialMinutes = policy.dailyMinutes * minimumNewShare;
  const maximumRemediationMinutes = policy.dailyMinutes * maximumRemediationShare;
  const selected: PlannedCandidate[] = [];
  const deferred = new Map<string, { candidate: PlanCandidate; reason: string; score: number }>();
  let usedMinutes = 0;
  let newMaterialMinutes = 0;
  let remediationMinutes = 0;
  const selectedIds = new Set<string>();

  const pick = (candidate: PlanCandidate, score: number, reason: string, honorRemediationCap = true): boolean => {
    if (selectedIds.has(candidate.id)) return true;
    if (selected.length >= maxItems || usedMinutes + candidate.estimatedMinutes > policy.dailyMinutes) {
      deferred.set(candidate.id, { candidate, reason: 'بودجهٔ زمان یا سقف تعداد آیتم کافی نیست', score });
      return false;
    }
    if (honorRemediationCap && isRemediation(candidate.actionType) &&
        remediationMinutes + candidate.estimatedMinutes > maximumRemediationMinutes) {
      deferred.set(candidate.id, { candidate, reason: 'سقف سهم تشخیص/ترمیم روزانه پر شده است', score });
      return false;
    }
    selected.push({ ...candidate, score, selectionReason: reason });
    selectedIds.add(candidate.id);
    usedMinutes += candidate.estimatedMinutes;
    if (candidate.actionType === 'new_material') newMaterialMinutes += candidate.estimatedMinutes;
    if (isRemediation(candidate.actionType)) remediationMinutes += candidate.estimatedMinutes;
    return true;
  };

  const newRanked = ranked.filter((row) => row.candidate.actionType === 'new_material');
  const availableNewMinutes = newRanked.reduce((sum, row) => sum + row.candidate.estimatedMinutes, 0);
  const newTarget = Math.min(minimumNewMaterialMinutes, availableNewMinutes);
  for (const row of newRanked) {
    if (newMaterialMinutes >= newTarget || selected.length >= maxItems) break;
    pick(row.candidate, row.score, 'رزرو حداقل سهم محتوای جدید', false);
  }

  for (const row of ranked) {
    if (selected.length >= maxItems) {
      deferred.set(row.candidate.id, { candidate: row.candidate, reason: 'سقف تعداد آیتم‌های برنامه پر شده است', score: row.score });
      continue;
    }
    if (selectedIds.has(row.candidate.id)) continue;
    pick(row.candidate, row.score, 'امتیاز اولویت = ارزش آزمونی × منفعت مورد انتظار × فوریت ÷ دقیقه');
  }

  const warnings: string[] = [];
  if (availableNewMinutes === 0) warnings.push('محتوای جدیدِ واجد شرایط برای رزرو سهم روزانه وجود ندارد.');
  else if (newMaterialMinutes + Number.EPSILON < minimumNewMaterialMinutes) warnings.push('به‌دلیل سقف زمان/تعداد، سهم حداقل محتوای جدید کامل نشد.');
  if (candidates.some((candidate) => isRemediation(candidate.actionType)) &&
      ranked.filter((row) => isRemediation(row.candidate.actionType)).some((row) => deferred.has(row.candidate.id))) {
    warnings.push('بخشی از تشخیص/ترمیم به‌دلیل سقف بار روزانه به تعویق افتاد.');
  }

  for (const row of ranked) {
    if (!selectedIds.has(row.candidate.id) && !deferred.has(row.candidate.id)) {
      deferred.set(row.candidate.id, { candidate: row.candidate, reason: 'در این برنامه جا نشد', score: row.score });
    }
  }

  return {
    selected,
    deferred: [...deferred.values()].sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id)),
    budgetMinutes: policy.dailyMinutes,
    usedMinutes,
    newMaterialMinutes,
    remediationMinutes,
    minimumNewMaterialMinutes,
    maximumRemediationMinutes,
    warnings,
  };
}
