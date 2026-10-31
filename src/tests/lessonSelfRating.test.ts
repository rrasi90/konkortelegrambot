import { describe, expect, it } from 'vitest';
import type { KnowledgeNode, QuestionItem } from '../data/konkorData';
import { applyLessonUnderstandingRating, createZeroStateEngine } from '../engine/aelEngine';

const node: KnowledgeNode = {
  id: 'test.lesson',
  track: 'common',
  course: 'مبانی سازمان و مدیریت',
  chapter: 'ساختار سازمانی',
  topic: 'ساختارهای مکانیکی و ارگانیک',
  sourceBookCitation: 'منبع آزمایشی',
  examYearsAppeared: [],
  examCoefficient: 5,
  historicalWeight: 5,
  estimatedStudyHours: 1,
  graphPos: { layer: 0, col: 0 },
  confusableWith: [],
};

const questions: QuestionItem[] = [
  {
    id: 'q-test-practice',
    nodeId: node.id,
    examYear: 1403,
    text: 'کدام گزینه درست است؟',
    options: ['گزینه الف', 'گزینه ب', 'گزینه ج', 'گزینه د'],
    correctOption: 0,
    explanation: 'توضیح آزمایشی',
    trapNote: 'دام آزمایشی',
    expectedTimeMs: 30_000,
  },
  {
    id: 'q-test-holdout',
    nodeId: node.id,
    examYear: 1404,
    text: 'سؤال قرنطینه',
    options: ['گزینه الف', 'گزینه ب', 'گزینه ج', 'گزینه د'],
    correctOption: 1,
    explanation: 'توضیح سؤال قرنطینه',
    trapNote: 'دام سؤال قرنطینه',
    expectedTimeMs: 30_000,
    isQuarantinedProof: true,
  },
];

describe('lesson self-rating is not proof of mastery', () => {
  it('does not increase mastery, confidence, evidence or unlock a holdout question on rating 5', () => {
    const initial = createZeroStateEngine([node], questions);
    const result = applyLessonUnderstandingRating({
      nodeId: node.id,
      rating: 5,
      nodeStates: initial.nodeStates,
      cards: initial.cards,
      stats: initial.stats,
      nodes: [node],
      dependencies: [],
      questions,
    });

    const state = result.nextNodeStates[node.id];
    expect(state.masteryScore).toBe(0);
    expect(state.proficiencyProbability).toBe(0);
    expect(state.evidenceCount).toBe(0);
    expect(state.coverageStatus).toBe('unseen');
    expect(state.lastLessonSelfRating).toBe(5);
    expect(result.delta.before).toBe(0);
    expect(result.delta.after).toBe(0);
    expect(result.nextCards.some((card) => card.questionId === 'q-test-holdout')).toBe(false);
    expect(result.nextCards.some((card) => card.questionId === 'q-test-practice')).toBe(true);
  });

  it('records low self-reported understanding without manufacturing mastery evidence', () => {
    const initial = createZeroStateEngine([node], questions);
    const result = applyLessonUnderstandingRating({
      nodeId: node.id,
      rating: 1,
      nodeStates: initial.nodeStates,
      cards: initial.cards,
      stats: initial.stats,
      nodes: [node],
      dependencies: [],
      questions,
    });

    expect(result.nextNodeStates[node.id].masteryScore).toBe(0);
    expect(result.nextNodeStates[node.id].evidenceCount).toBe(0);
    expect(result.nextNodeStates[node.id].lastLessonSelfRating).toBe(1);
    expect(result.nextNodeStates[node.id].rippleAlert).toBe('probe_queued');
  });
});
