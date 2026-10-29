// Priority calculation utilities for daily queue generation

/** Calculate urgency from interval decay */
export function calculateUrgency(
  cardDueDate: string | Date,
  cardCreatedDate: string | Date,
  now: Date = new Date()
): number {
  const due = new Date(cardDueDate).getTime();
  const nowMs = now.getTime();

  // Days overdue (positive means past due date)
  const diffDays = (nowMs - due) / 86400000;

  if (diffDays >= 0) {
    // Card is due or overdue
    const daysOverdue = diffDays;
    const overdueFactor = 1.0 + Math.min(4.0, daysOverdue / 7);
    return overdueFactor;
  }

  // Card is not yet due (in future)
  const daysUntilDue = -diffDays;
  return 1.0 / (1.0 + daysUntilDue);
}

/** Calculate mastery-based urgency: lower mastery = higher urgency */
export function calculateMasteryUrgency(
  masteryScore: number, // 0-100
  opts: { threshold?: number } = { threshold: 50 }
): number {
  const threshold = opts.threshold ?? 50;
  const normalized = Math.max(0, Math.min(100, masteryScore));

  if (normalized >= threshold) {
    // Meets or exceeds threshold: urgency is low (0 to 0.3)
    const span = Math.max(1, 100 - threshold);
    return Math.max(0, ((100 - normalized) / span) * 0.3);
  }

  // Below threshold: urgency is high (0.3 to 1.0)
  return 0.3 + 0.7 * ((threshold - normalized) / Math.max(1, threshold));
}

/** Calculate exam value from pack metadata and user mastery */
export function calculateExamValue(
  targetId: string,
  userState: {
    examPackWeights: Map<string, number>;
    currentPack?: string;
    masteryMap: Map<string, number>;
  }
): number {
  const defaultPackWeight = 1.0;
  const weight = userState.examPackWeights.get(targetId) || defaultPackWeight;
  const mastery = userState.masteryMap.get(targetId) ?? 50;

  // High weight + lower mastery produces higher urgency to learn
  const masteryGap = (100 - Math.min(100, Math.max(0, mastery))) / 100;
  return Math.min(2.0, Math.max(0.5, weight * (0.8 + 0.4 * masteryGap)));
}

/** Calculate expected benefit based on activity type */
export function calculateExpectedBenefit(
  activityType: 'review' | 'diagnostic' | 'remedial' | 'proof' | 'exam',
  userState: {
    masteryMap: Map<string, number>;
    evidenceLevel: 'none' | 'partial' | 'complete' | 'certified';
  },
  targetId?: string
): number {
  const baseMastery =
    (targetId ? userState.masteryMap.get(targetId) : undefined) ??
    userState.masteryMap.get('current') ??
    50;

  switch (activityType) {
    case 'review':
      return Math.min(1.5, 0.5 + (baseMastery / 100) * 0.7);
    case 'diagnostic':
      return Math.min(1.5, 1.5 - (baseMastery / 100) * 0.5);
    case 'remedial':
      return Math.min(1.5, 0.8 + 0.6 * (1 - baseMastery / 100));
    case 'proof': {
      const evidenceMap: Record<string, number> = {
        none: 1.0,
        partial: 1.1,
        complete: 1.2,
        certified: 1.3,
      };
      return evidenceMap[userState.evidenceLevel] || 1.0;
    }
    case 'exam':
      return 1.1;
    default:
      return 1.0;
  }
}

/** Calculate urgency with all factors combined */
export function calculateUrgencyV2(
  card: {
    intervalDays: number;
    dueAt: string;
    nodeId: string;
  },
  userState: {
    masteryMap: Map<string, number>;
    fsrsRetentionMap?: Map<string, number>;
    examDate?: Date;
  },
  now: Date = new Date()
): number {
  const dueDate = new Date(card.dueAt);
  const nowMs = now.getTime();
  const dueMs = dueDate.getTime();
  const diffDays = (nowMs - dueMs) / 86400000;

  const baseUrgency = diffDays >= 0
    ? 1.0 + Math.min(4.0, diffDays / 7)
    : 1.0 / (1.0 + Math.abs(diffDays));

  const mastery = userState.masteryMap.get(card.nodeId) ?? 50;
  const masteryUrgency = Math.max(0, (100 - mastery) / 100);

  let examUrgency = 0.5;
  if (userState.examDate) {
    const daysUntilExam = Math.max(0, (userState.examDate.getTime() - nowMs) / 86400000);
    // As exam approaches (fewer days left), exam urgency increases
    examUrgency = 1.0 / (1.0 + daysUntilExam / 30);
  }

  return Math.round(baseUrgency * 40 + masteryUrgency * 40 + examUrgency * 20);
}
