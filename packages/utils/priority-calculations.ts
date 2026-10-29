// Priority calculation utilities for daily queue generation

/** Calculate urgency from interval decay */
export function calculateUrgency(
  cardDueDate: string | Date,
  cardCreatedDate: string | Date,
  now: Date = new Date()
): number {
  const due = new Date(cardDueDate).getTime();
  const created = new Date(cardCreatedDate).getTime();
  const nowMs = now.getTime();
  
  // Days overdue (negative means not yet due)
  const daysOverdue = Math.max(0, (due - nowMs) / 86400000);
  const daysSinceCreated = (nowMs - created) / 86400000;
  
  // Base urgency: 1/intervalDays when on schedule
  const baseUrgency = daysOverdue > 0
    ? 1 / Math.max(1, daysOverdue)
    : 1 / Math.max(1, 30 - daysSinceCreated); // decay from 30-day half-life
  
  // Exponential increase for overdue cards
  const overdueFactor = daysOverdue > 0 ? Math.exp(daysOverdue / 7) : 1;
  
  return baseUrgency * overdueFactor;
}

/** Calculate mastery-based urgency */
export function calculateMasteryUrgency(
  masteryScore: number, // 0-100
  opts: { threshold: number } = { threshold: 50 }
): number {
  // Lower mastery = higher urgency
  const aboveThreshold = Math.max(0, masteryScore - (opts.threshold || 50));
  const range = 100 - (opts.threshold || 50);
  return aboveThreshold / range;
}

/** Calculate exam value from pack metadata */
export function calculateExamValue(
  questionId: string,
  userState: {
    examPackWeights: Map<string, number>;
    currentPack: string;
    masteryMap: Map<string, number>;
  }
): number {
  // In real implementation, query DB for question's exam pack membership
  // For now, use default
  const defaultPackWeight = 1.0;
  const weight = userState.examPackWeights.get(questionId) || defaultPackWeight;
  const mastery = userState.masteryMap.get(questionId) || 50;
  
  // Final value: 0.5 - 1.5 range typically
  return Math.min(1.5, Math.max(0.5, 1.0 + (weight - 0.5) * 0.3 + (mastery - 50) / 200 * 0.3));
}

/** Calculate expected benefit based on activity type */
export function calculateExpectedBenefit(
  activityType: 'review' | 'diagnostic' | 'remedial' | 'proof' | 'exam',
  userState: {
    masteryMap: Map<string, number>;
    evidenceLevel: 'none' | 'partial' | 'complete' | 'certified';
  }
): number {
  const baseMastery = userState.masteryMap.get('current') || 50;
  
  switch (activityType) {
    case 'review':
      return (baseMastery / 100) * 1.0;
    case 'diagnostic':
      return (1 - baseMastery / 100) * 1.5;
    case 'remedial':
      return 0.8 + 0.2 * (1 - baseMastery / 100);
    case 'proof':
      const evidenceMap: Record<string, number> = {
        none: 1.0,
        partial: 1.1,
        complete: 1.2,
        certified: 1.3,
      };
      return evidenceMap[userState.evidenceLevel] || 1.0;
    case 'exam':
      return 1.1;
    default:
      return 1.0;
  }
}

/** Calculate urgency with all factors */
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
  }
): number {
  const now = new Date();
  // Use the card's due date directly
  const dueDate = new Date(card.dueAt);
  const daysOverdue = Math.max(0, (dueDate.getTime() - now.getTime()) / 86400000);
  
  const baseUrgency = 1 / Math.max(1, card.intervalDays);
  const overdueFactor = daysOverdue > 0 ? Math.exp(daysOverdue / 7) : 1;
  
  const mastery = userState.masteryMap.get(card.nodeId) || 50;
  const examProximity = userState.examDate 
    ? 9999 / (9999 + (userState.examDate.getTime() - now.getTime()) / 86400000)
    : 1;
  
  const masteryDecay = 1 - mastery / 100;
  
  return Math.round(
    (baseUrgency * 0.3 + overdueFactor * 0.4 + (1 - mastery / 100) * 0.2 + (1 - examProximity) * 0.1) * 10
  );
}
