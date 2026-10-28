import type { CandidateActivity, StudyMode } from "@konkor/domain";

export interface PlannerInput {
  activities: readonly CandidateActivity[];
  dailyBudgetMinutes: number;
  studyMode: StudyMode;
  maxRemediationShare?: number;
  minNewLearningShare?: number;
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(label + " must be a finite non-negative number");
  }
}

function validateShare(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(label + " must be between zero and one");
  }
}

export function scorePriority(activity: CandidateActivity): number {
  if (!Number.isFinite(activity.estimatedMinutes) || activity.estimatedMinutes <= 0) {
    throw new RangeError("estimatedMinutes must be a finite number greater than zero");
  }

  assertNonNegativeFinite(activity.examValue, "examValue");
  assertNonNegativeFinite(activity.expectedBenefit, "expectedBenefit");
  assertNonNegativeFinite(activity.urgency, "urgency");

  return (activity.examValue * activity.expectedBenefit * activity.urgency) / activity.estimatedMinutes;
}

export function selectActivities(input: PlannerInput): CandidateActivity[] {
  const { activities, dailyBudgetMinutes, studyMode } = input;
  const maxRemediationShare = input.maxRemediationShare ?? 0.5;
  const minNewLearningShare = input.minNewLearningShare ?? 0.25;

  assertNonNegativeFinite(dailyBudgetMinutes, "dailyBudgetMinutes");
  validateShare(maxRemediationShare, "maxRemediationShare");
  validateShare(minNewLearningShare, "minNewLearningShare");
  if (maxRemediationShare + minNewLearningShare > 1) {
    throw new RangeError("minNewLearningShare plus maxRemediationShare cannot exceed one");
  }
  if (dailyBudgetMinutes === 0) return [];

  const seen = new Set<string>();
  const eligible = activities.filter((activity) => {
    if (seen.has(activity.id)) return false;
    seen.add(activity.id);
    if (activity.poolType !== "training" || activity.kind === "holdout_assessment") return false;
    if (activity.contentStatus !== "published") return false;
    if (studyMode === "commute" && activity.requiresPaper) return false;
    if (!Number.isFinite(activity.estimatedMinutes) || activity.estimatedMinutes <= 0) return false;
    return true;
  });

  eligible.sort((a, b) => {
    const difference = scorePriority(b) - scorePriority(a);
    return difference || a.id.localeCompare(b.id);
  });

  const selected: CandidateActivity[] = [];
  const selectedIds = new Set<string>();
  const budgetForRemediation = dailyBudgetMinutes * maxRemediationShare;
  const targetNewLearningMinutes = dailyBudgetMinutes * minNewLearningShare;
  let minutesUsed = 0;
  let remediationMinutes = 0;
  let newLearningMinutes = 0;

  const add = (activity: CandidateActivity): void => {
    selected.push(activity);
    selectedIds.add(activity.id);
    minutesUsed += activity.estimatedMinutes;
    if (activity.kind === "remediation") remediationMinutes += activity.estimatedMinutes;
    if (activity.kind === "new_learning") newLearningMinutes += activity.estimatedMinutes;
  };

  // Reserve time for new learning before high-priority reviews/remediation consume the day.
  for (const activity of eligible.filter((candidate) => candidate.kind === "new_learning")) {
    if (newLearningMinutes >= targetNewLearningMinutes) break;
    if (minutesUsed + activity.estimatedMinutes > dailyBudgetMinutes) continue;
    add(activity);
  }

  for (const activity of eligible) {
    if (selectedIds.has(activity.id)) continue;
    const duration = activity.estimatedMinutes;
    if (minutesUsed + duration > dailyBudgetMinutes) continue;
    if (activity.kind === "remediation" && remediationMinutes + duration > budgetForRemediation) continue;
    add(activity);
  }

  return selected;
}
