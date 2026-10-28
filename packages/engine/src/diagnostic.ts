import type { SkillEdge } from "@konkor/domain";

export type ConfidenceBeforeAnswer = "high" | "medium" | "low";
export type SelfReportedError = "slip" | "conceptual" | "unknown";
export interface WrongAnswerInput {
  skillId: string;
  confidence: ConfidenceBeforeAnswer;
  selfReportedError: SelfReportedError;
  priorSlipReportsForSkill: number;
  edges: readonly SkillEdge[];
}
export interface DiagnosticDecision {
  approach: "same_skill_verification" | "one_hop_diagnostic";
  priority: "high" | "normal";
  probeSkillIds: string[];
  reason: string;
}

export function decideAfterWrongAnswer(input: WrongAnswerInput): DiagnosticDecision {
  if (!Number.isInteger(input.priorSlipReportsForSkill) || input.priorSlipReportsForSkill < 0) {
    throw new RangeError("priorSlipReportsForSkill must be a non-negative integer.");
  }
  const priority = input.confidence === "high" ? "high" : "normal";
  // Verify a self-reported slip on the same skill first. After three prior
  // reports with continued errors, stop accepting that explanation alone.
  if (input.selfReportedError === "slip" && input.priorSlipReportsForSkill < 3) {
    return {
      approach: "same_skill_verification",
      priority,
      probeSkillIds: [input.skillId],
      reason: "Self-reported slip is weak evidence; verify the same skill with a new item first.",
    };
  }
  const targets = new Set<string>([input.skillId]);
  for (const edge of input.edges) {
    if (edge.verificationStatus !== "verified") continue;
    if (edge.relationType === "prerequisite_of" && edge.targetSkillId === input.skillId) targets.add(edge.sourceSkillId);
    if (edge.relationType === "confusable_with") {
      if (edge.sourceSkillId === input.skillId) targets.add(edge.targetSkillId);
      if (edge.targetSkillId === input.skillId) targets.add(edge.sourceSkillId);
    }
  }
  return {
    approach: "one_hop_diagnostic",
    priority,
    probeSkillIds: [...targets].sort(),
    reason: "Use only verified one-hop prerequisite/confusable edges; never infer global mastery loss directly.",
  };
}
