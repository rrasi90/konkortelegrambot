import type { CandidateActivity, StudyMode } from "@konkor/domain";

export interface PlannerInput {
  activities: readonly CandidateActivity[];
  dailyBudgetMinutes: number;
  studyMode: StudyMode;
  maxRemediationShare?: number;
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(label + " must be a finite non-negative number");
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

  assertNonNegativeFinite(dailyBudgetMinutes, "dailyBudgetMinutes");
  if (!Number.isFinite(maxRemediationShare) || maxRemediationShare < 0 || maxRemediationShare > 1) {
    throw new RangeError("maxRemediationShare must be between zero and one");
  }
  if (dailyBudgetMinutes === 0) return [];

  const seen = new Set<string>();
  const eligible = activities.filter((activity) => {
    if (seen.has(activity.id)) return false;
    seen.add(activity.id);
    if (activity.poolType !== "training") return false;
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
  const budgetForRemediation = dailyBudgetMinutes * maxRemediationShare;
  let minutesUsed = 0;
  let remediationMinutes = 0;

  for (const activity of eligible) {
    const duration = activity.estimatedMinutes;
    if (minutesUsed + duration > dailyBudgetMinutes) continue;
    if (activity.kind === "remediation" && remediationMinutes + duration > budgetForRemediation) continue;

    selected.push(activity);
    minutesUsed += duration;
    if (activity.kind === "remediation") remediationMinutes += duration;
  }

  return selected;
}
