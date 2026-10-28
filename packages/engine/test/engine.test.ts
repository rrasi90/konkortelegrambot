import { describe, expect, it } from "vitest";
import type { CandidateActivity, SkillEdge } from "@konkor/domain";
import { decideAfterWrongAnswer, scorePriority, selectActivities } from "../src/index.js";

function activity(overrides: Partial<CandidateActivity> = {}): CandidateActivity {
  return {
    id: "a",
    skillId: "skill-a",
    kind: "new_learning",
    poolType: "training",
    contentStatus: "published",
    estimatedMinutes: 5,
    examValue: 1,
    expectedBenefit: 1,
    urgency: 1,
    requiresPaper: false,
    ...overrides,
  };
}

describe("priority and daily planner", () => {
  it("scores value per estimated minute", () => {
    expect(scorePriority(activity({ examValue: 2, expectedBenefit: 0.5, urgency: 2, estimatedMinutes: 5 }))).toBe(0.4);
  });

  it("never exceeds the daily time budget", () => {
    const result = selectActivities({
      activities: [activity({ id: "a", estimatedMinutes: 7 }), activity({ id: "b", estimatedMinutes: 6 }), activity({ id: "c", estimatedMinutes: 4 })],
      dailyBudgetMinutes: 10,
      studyMode: "desk",
    });
    expect(result.reduce((sum, item) => sum + item.estimatedMinutes, 0)).toBeLessThanOrEqual(10);
  });

  it("excludes paper-based and holdout activities from commute practice", () => {
    const result = selectActivities({
      activities: [
        activity({ id: "desk", requiresPaper: true }),
        activity({ id: "holdout", poolType: "holdout_eval" }),
        activity({ id: "draft", contentStatus: "ai_suggested" }),
        activity({ id: "safe" }),
      ],
      dailyBudgetMinutes: 20,
      studyMode: "commute",
    });
    expect(result.map((item) => item.id)).toEqual(["safe"]);
  });

  it("caps remediation share rather than filling the whole day with remediation", () => {
    const result = selectActivities({
      activities: [
        activity({ id: "r1", kind: "remediation", estimatedMinutes: 6, examValue: 10 }),
        activity({ id: "n1", kind: "new_learning", estimatedMinutes: 5, examValue: 1 }),
        activity({ id: "n2", kind: "new_learning", estimatedMinutes: 5, examValue: 1 }),
      ],
      dailyBudgetMinutes: 10,
      studyMode: "desk",
      maxRemediationShare: 0.5,
    });
    expect(result.some((item) => item.kind === "remediation")).toBe(false);
    expect(result.reduce((sum, item) => sum + item.estimatedMinutes, 0)).toBeLessThanOrEqual(10);
  });

  it("rejects invalid time estimates in the priority function", () => {
    expect(() => scorePriority(activity({ estimatedMinutes: 0 }))).toThrow(RangeError);
  });
});

describe("evidence-based diagnostic decisions", () => {
  const edges: SkillEdge[] = [
    { sourceSkillId: "pre", targetSkillId: "target", relationType: "prerequisite_of", verificationStatus: "verified" },
    { sourceSkillId: "target", targetSkillId: "confusable", relationType: "confusable_with", verificationStatus: "verified" },
    { sourceSkillId: "target", targetSkillId: "ai-only", relationType: "prerequisite_of", verificationStatus: "ai_suggested" },
    { sourceSkillId: "far", targetSkillId: "pre", relationType: "prerequisite_of", verificationStatus: "verified" },
    { sourceSkillId: "target", targetSkillId: "related", relationType: "related_to", verificationStatus: "verified" },
  ];

  it("does not cascade a self-reported slip before checking the same skill", () => {
    const result = decideAfterWrongAnswer({
      skillId: "target",
      confidence: "medium",
      selfReportedError: "slip",
      priorSlipReportsForSkill: 0,
      edges,
    });
    expect(result.approach).toBe("same_skill_verification");
    expect(result.probeSkillIds).toEqual(["target"]);
  });

  it("uses only verified one-hop prerequisites and confusable edges", () => {
    const result = decideAfterWrongAnswer({
      skillId: "target",
      confidence: "high",
      selfReportedError: "conceptual",
      priorSlipReportsForSkill: 0,
      edges,
    });
    expect(result.priority).toBe("high");
    expect(result.probeSkillIds).toEqual(["confusable", "pre", "target"]);
    expect(result.probeSkillIds).not.toContain("far");
    expect(result.probeSkillIds).not.toContain("ai-only");
    expect(result.probeSkillIds).not.toContain("related");
  });

  it("stops trusting repeated slip reports after two previous reports", () => {
    const result = decideAfterWrongAnswer({
      skillId: "target",
      confidence: "low",
      selfReportedError: "slip",
      priorSlipReportsForSkill: 2,
      edges,
    });
    expect(result.approach).toBe("one_hop_diagnostic");
    expect(result.probeSkillIds).toContain("pre");
  });
});
