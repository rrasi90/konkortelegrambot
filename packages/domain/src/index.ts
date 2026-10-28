export type ContentStatus =
  | "draft"
  | "ai_suggested"
  | "verified"
  | "published"
  | "rejected"
  | "retired";

export type StudyMode = "desk" | "commute";
export type PoolType = "training" | "holdout_eval";

export type ActivityKind =
  | "new_learning"
  | "diagnostic_probe"
  | "remediation"
  | "spaced_review"
  | "holdout_assessment"
  | "exam_simulation";

export type SkillEdgeType =
  | "prerequisite_of"
  | "confusable_with"
  | "applied_in"
  | "part_of"
  | "related_to";

export type VerificationStatus = "draft" | "ai_suggested" | "verified" | "rejected";

export interface SkillEdge {
  sourceSkillId: string;
  targetSkillId: string;
  relationType: SkillEdgeType;
  verificationStatus: VerificationStatus;
  evidenceSource?: string;
}

export interface CandidateActivity {
  id: string;
  skillId?: string;
  kind: ActivityKind;
  poolType: PoolType;
  contentStatus: ContentStatus;
  estimatedMinutes: number;
  examValue: number;
  expectedBenefit: number;
  urgency: number;
  requiresPaper: boolean;
}

export interface LearnerEvent {
  eventId: string;
  idempotencyKey: string;
  userId: string;
  examPackId: string;
  itemId: string;
  itemVersion: number;
  occurredAt: string;
  engineVersion: string;
  eventType: "answer_submitted" | "confidence_recorded" | "diagnostic_completed" | "remediation_completed" | "holdout_assessed" | "activity_skipped";
  payload: Readonly<Record<string, unknown>>;
}
