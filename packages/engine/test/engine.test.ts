import { describe, expect, it } from "vitest";
import type { CandidateActivity, SkillEdge } from "@konkor/domain";
import { decideAfterWrongAnswer, scorePriority, selectActivities, shuffleOptionsPreservingSpecial } from "../src/index.js";

function activity(overrides: Partial<CandidateActivity> = {}): CandidateActivity {
  return {
    id: "a", skillId: "skill-a", kind: "new_learning", poolType: "training",
    contentStatus: "published", estimatedMinutes: 5, examValue: 1,
    expectedBenefit: 1, urgency: 1, requiresPaper: false, ...overrides,
  };
}

describe("daily planner", () => {
  it("scores expected benefit per minute", () => {
    expect(scorePriority(activity({ examValue: 2, expectedBenefit: 0.5, urgency: 2, estimatedMinutes: 5 }))).toBe(0.4);
  });
  it("stays within the daily budget", () => {
    const result = selectActivities({ activities: [activity({ id: "a", estimatedMinutes: 7 }), activity({ id: "b", estimatedMinutes: 6 }), activity({ id: "c", estimatedMinutes: 4 })], dailyBudgetMinutes: 10, studyMode: "desk" });
    expect(result.reduce((sum, item) => sum + item.estimatedMinutes, 0)).toBeLessThanOrEqual(10);
  });
  it("excludes papers in commute mode, drafts and holdout", () => {
    const result = selectActivities({
      activities: [activity({ id: "paper", requiresPaper: true }), activity({ id: "holdout", poolType: "holdout_eval" }), activity({ id: "holdout-kind", kind: "holdout_assessment" }), activity({ id: "draft", contentStatus: "ai_suggested" }), activity({ id: "safe" })],
      dailyBudgetMinutes: 20, studyMode: "commute",
    });
    expect(result.map((x) => x.id)).toEqual(["safe"]);
  });
  it("reserves time for new learning", () => {
    const result = selectActivities({
      activities: [activity({ id: "review", kind: "spaced_review", estimatedMinutes: 10, examValue: 10 }), activity({ id: "new-a", estimatedMinutes: 3, examValue: 0.1 }), activity({ id: "new-b", estimatedMinutes: 3, examValue: 0.1 })],
      dailyBudgetMinutes: 20, studyMode: "desk", minNewLearningShare: 0.3,
    });
    expect(result.filter((x) => x.kind === "new_learning").reduce((sum, x) => sum + x.estimatedMinutes, 0)).toBeGreaterThanOrEqual(6);
    expect(result.some((x) => x.id === "review")).toBe(true);
  });
  it("caps remediation and rejects invalid bounds", () => {
    const result = selectActivities({
      activities: [activity({ id: "repair", kind: "remediation", estimatedMinutes: 6, examValue: 10 }), activity({ id: "n1", estimatedMinutes: 5 }), activity({ id: "n2", estimatedMinutes: 5 })],
      dailyBudgetMinutes: 10, studyMode: "desk", maxRemediationShare: 0.5,
    });
    expect(result.some((x) => x.kind === "remediation")).toBe(false);
    expect(() => scorePriority(activity({ estimatedMinutes: 0 }))).toThrow(RangeError);
    expect(() => selectActivities({ activities: [], dailyBudgetMinutes: 10, studyMode: "desk", maxRemediationShare: 0.8, minNewLearningShare: 0.5 })).toThrow(RangeError);
  });
});

describe("evidence-based diagnosis", () => {
  const edges: SkillEdge[] = [
    { sourceSkillId: "pre", targetSkillId: "target", relationType: "prerequisite_of", verificationStatus: "verified" },
    { sourceSkillId: "target", targetSkillId: "confusable", relationType: "confusable_with", verificationStatus: "verified" },
    { sourceSkillId: "target", targetSkillId: "ai-only", relationType: "prerequisite_of", verificationStatus: "ai_suggested" },
    { sourceSkillId: "far", targetSkillId: "pre", relationType: "prerequisite_of", verificationStatus: "verified" },
    { sourceSkillId: "target", targetSkillId: "related", relationType: "related_to", verificationStatus: "verified" },
  ];
  it("checks the same skill after an initial slip report", () => {
    const result = decideAfterWrongAnswer({ skillId: "target", confidence: "medium", selfReportedError: "slip", priorSlipReportsForSkill: 0, edges });
    expect(result.approach).toBe("same_skill_verification");
    expect(result.probeSkillIds).toEqual(["target"]);
  });
  it("checks same skill through the third reported slip", () => {
    const result = decideAfterWrongAnswer({ skillId: "target", confidence: "medium", selfReportedError: "slip", priorSlipReportsForSkill: 2, edges });
    expect(result.approach).toBe("same_skill_verification");
  });
  it("uses verified one-hop edges after three previous reports", () => {
    const result = decideAfterWrongAnswer({ skillId: "target", confidence: "low", selfReportedError: "slip", priorSlipReportsForSkill: 3, edges });
    expect(result.approach).toBe("one_hop_diagnostic");
    expect(result.probeSkillIds).toEqual(["confusable", "pre", "target"]);
    expect(result.probeSkillIds).not.toContain("far");
    expect(result.probeSkillIds).not.toContain("ai-only");
    expect(result.probeSkillIds).not.toContain("related");
  });
  it("prioritizes confident errors but does not directly reduce global mastery", () => {
    const result = decideAfterWrongAnswer({ skillId: "target", confidence: "high", selfReportedError: "conceptual", priorSlipReportsForSkill: 0, edges });
    expect(result.priority).toBe("high");
    expect(result.probeSkillIds).toEqual(["confusable", "pre", "target"]);
  });
  it("rejects negative slip counts", () => {
    expect(() => decideAfterWrongAnswer({ skillId: "target", confidence: "low", selfReportedError: "slip", priorSlipReportsForSkill: -1, edges })).toThrow(RangeError);
  });
});

describe("anti-rote option shuffle", () => {
  const options = [
    { id: "a", text: "گزینه الف", role: "ordinary" as const },
    { id: "all", text: "همه موارد", role: "all_of_above" as const },
    { id: "b", text: "گزینه ب", role: "ordinary" as const },
    { id: "none", text: "هیچ‌کدام", role: "none_of_above" as const },
    { id: "c", text: "گزینه ج", role: "ordinary" as const },
  ];
  it("shuffles ordinary choices but preserves special option positions", () => {
    const result = shuffleOptionsPreservingSpecial(options, () => 0);
    expect(result.map((x) => x.id)).toEqual(["b", "all", "c", "none", "a"]);
    expect(new Set(result.map((x) => x.id))).toEqual(new Set(options.map((x) => x.id)));
  });
  it("rejects duplicate IDs and invalid random samples", () => {
    expect(() => shuffleOptionsPreservingSpecial([{ id: "x", text: "الف", role: "ordinary" }, { id: "x", text: "ب", role: "ordinary" }])).toThrow(/unique and stable/);
    expect(() => shuffleOptionsPreservingSpecial(options, () => 1)).toThrow(RangeError);
  });
});
