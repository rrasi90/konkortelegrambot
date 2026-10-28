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
  const priority = input.confidence === "high" ? "high" : "normal";

  // A self-reported slip is weak evidence. Until repeated evidence contradicts it,
  // verify the same skill rather than cascading the error through the graph.
  if (input.selfReportedError === "slip" && input.priorSlipReportsForSkill < 2) {
    return {
      approach: "same_skill_verification",
      priority,
      probeSkillIds: [input.skillId],
      reason: "Self-reported slip requires a later unseen check on the same skill.",
    };
  }

  const targets = new Set<string>([input.skillId]);
  for (const edge of input.edges) {
    if (edge.verificationStatus !== "verified") continue;

    if (edge.relationType === "prerequisite_of" && edge.targetSkillId === input.skillId) {
      targets.add(edge.sourceSkillId);
    }

    if (edge.relationType === "confusable_with") {
      if (edge.sourceSkillId === input.skillId) targets.add(edge.targetSkillId);
      if (edge.targetSkillId === input.skillId) targets.add(edge.sourceSkillId);
    }
  }

  return {
    approach: "one_hop_diagnostic",
    priority,
    probeSkillIds: [...targets].sort(),
    reason: "Use one-hop verified prerequisite/confusable edges for diagnosis; do not infer mastery loss directly.",
  };
}
