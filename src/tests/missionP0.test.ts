import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KonkorScoreSimulatorCard } from '../components/KonkorScoreSimulatorCard';
import { BOOK_CHAPTERS, groupBookQuestionsByChapter } from '../data/bookChaptersRepo';
import { INITIAL_KNOWLEDGE_NODES, INITIAL_NODE_DEPENDENCIES, INITIAL_QUESTION_BANK, type QuestionItem } from '../data/konkorData';
import { applyLessonUnderstandingRating, createZeroStateEngine, evaluateAnswerAndRipple, initFSRS, type ReviewCard } from '../engine/aelEngine';

const nodes = INITIAL_KNOWLEDGE_NODES;
const questions = INITIAL_QUESTION_BANK;
const dependencies = INITIAL_NODE_DEPENDENCIES;
const holdout = questions.find((question) => question.isQuarantinedProof)!;
const nodeId = holdout.nodeId;

describe('learning and content integrity', () => {
  it.each([1, 2, 3, 4, 5] as const)('rating %i preserves performance evidence and existing remediation', (rating) => {
    const base = createZeroStateEngine(nodes, questions);
    const evidence = Object.assign(base.nodeStates[nodeId], {
      masteryScore: 30, proficiencyProbability: 0.73, memoryStability: 6,
      retrievability: 0.8, coverageStatus: 'weak', evidenceCount: 3,
      isUnlockedInFrontier: false, hasLeechCard: true, rippleAlert: 'needs_remediation',
    } as const);
    const remedial: ReviewCard = {
      id: `card.remedial.${nodeId}`, nodeId, cardType: 'remedial_lesson',
      dueAt: new Date().toISOString(), priorityScore: 80, attemptType: 'diagnostic', fsrs: initFSRS(),
    };
    base.cards.push(remedial);
    const input = { ...base, nodes, dependencies, questions, nodeId, rating };
    const result = applyLessonUnderstandingRating(input);
    expect(result.nextNodeStates[nodeId]).toMatchObject({ ...evidence, lastLessonSelfRating: rating });
    expect(result.nextCards).toContainEqual(remedial);
    expect(result.nextCards.filter((card) => card.cardType === 'proof_1404' || card.attemptType === 'proof')).toEqual([]);
    expect(result.nextCards.filter((card) => base.cards.some((existing) => existing.id === card.id))).toEqual(base.cards);
    const repeated = applyLessonUnderstandingRating({
      ...input, nodeStates: result.nextNodeStates, cards: result.nextCards, stats: result.nextStats,
    });
    expect(repeated.nextStats).toEqual(result.nextStats);
    expect(repeated.nextCards).toEqual(result.nextCards);
  });

  it('rejects a stale node ID without modifying any learner state', () => {
    const base = createZeroStateEngine(nodes, questions);
    const result = applyLessonUnderstandingRating({ ...base, nodes, dependencies, questions, nodeId: 'missing', rating: 5 });
    expect(result.nextNodeStates).toBe(base.nodeStates);
    expect(result.nextCards).toBe(base.cards);
    expect(result.nextStats).toBe(base.stats);
    expect(result.scheduleSummary).toContain('معتبر نیست');
  });

  it('rejects mismatched and forged proof cards before grading', () => {
    const base = createZeroStateEngine(nodes, questions);
    const ordinary = base.cards.find((card) => card.questionId)!;
    const grade = (card: ReviewCard) => evaluateAnswerAndRipple({
      ...base, nodes, dependencies, questions, lessons: {}, card, selectedOption: 0,
      grading: { wasCorrect: false, trapNote: '' },
      confidence: 'high', responseTimeMs: 1000,
    });
    expect(() => grade({ ...ordinary, nodeId: 'missing' })).toThrow();
    expect(() => grade({ ...ordinary, questionId: 'missing' })).toThrow();
    expect(() => grade({ ...ordinary, cardType: 'proof_1404', attemptType: 'proof' })).toThrow();
    expect(() => grade({ ...ordinary, nodeId, questionId: holdout.id })).toThrow();
  });

  it('uses an explicit chapter, and leaves invalid or shared mappings unresolved', () => {
    const [bookId, chapters] = Object.entries(BOOK_CHAPTERS).find(([, items]) =>
      items.some((chapter) => chapter.nodes.some((id) => items.filter((item) => item.nodes.includes(id)).length > 1)) &&
      items.some((chapter) => chapter.nodes.some((id) => items.filter((item) => item.nodes.includes(id)).length === 1)),
    )!;
    const sharedNodeId = chapters.flatMap((chapter) => chapter.nodes).find((id) =>
      chapters.filter((chapter) => chapter.nodes.includes(id)).length > 1,
    )!;
    const matching = chapters.filter((chapter) => chapter.nodes.includes(sharedNodeId));
    const unique = chapters.flatMap((chapter) => chapter.nodes).find((id) =>
      chapters.filter((chapter) => chapter.nodes.includes(id)).length === 1,
    )!;
    const question = { ...questions[0], nodeId: sharedNodeId };
    const bank: QuestionItem[] = [
      { ...question, id: 'explicit', referenceChapterId: matching[1].id },
      { ...question, id: 'invalid', referenceChapterId: 'missing' },
      { ...question, id: 'shared' },
      { ...question, id: 'unique', nodeId: unique },
      { ...question, id: 'unmapped', nodeId: 'missing' },
    ];
    const groups = groupBookQuestionsByChapter(bookId, bank);
    expect(groups.find((group) => group.questions.some((q) => q.id === 'explicit'))?.chapter?.id).toBe(matching[1].id);
    expect(groups.find((group) => group.questions.some((q) => q.id === 'unique'))?.chapter?.nodes).toContain(unique);
    const unresolved = groups.find((group) => group.chapter === null)!;
    expect(unresolved.questions.map((q) => q.id)).toEqual(['invalid', 'shared', 'unmapped']);
    expect(unresolved.sharedWith).toEqual(expect.arrayContaining(matching.map((chapter) => chapter.id)));
  });

  it.each(['business', 'phd_all'] as const)('renders measured topic progress without unsupported exam outputs for %s', (branch) => {
    const base = createZeroStateEngine(nodes, questions);
    base.nodeStates[nodes[0].id].masteryScore = 20;
    base.nodeStates[nodes[1].id].masteryScore = 80;
    const html = renderToStaticMarkup(createElement(KonkorScoreSimulatorCard, {
      nodes: nodes.slice(0, 2), nodeStates: base.nodeStates,
      stats: { ...base.stats, selectedMajorBranch: branch },
      onStartPracticeNode: () => {}, onOpenLessonNode: () => {},
    }));
    expect(html).toContain('میانگین سادهٔ تسلط');
    expect(html).toContain('50');
    expect(html).not.toMatch(/رتبه|تراز|قبولی|What-If|نمره منفی/);
  });
});
