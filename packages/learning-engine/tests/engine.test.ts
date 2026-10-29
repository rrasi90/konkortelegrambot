import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENGINE_CONFIG,
  addDays,
  applyAnswer,
  buildDailyQueue,
  questionCardId,
  trapCardId,
  type EngineState,
  type ReviewCard,
} from '@ael/engine';
import type { KnowledgeNode, NodeDependency, Question, TrackId } from '@ael/contracts';

const NOW = new Date('2026-10-29T08:00:00.000Z');

function node(id: string, track: string, topic = id): KnowledgeNode {
  return { id, track, course: 'Course', chapter: 'Chapter', topic };
}

const nodes: KnowledgeNode[] = [
  node('skill.alpha', 'common', 'Alpha'),
  node('skill.beta', 'common', 'Beta'),
  node('skill.finance', 'finance', 'Finance'),
  node('skill.computing', 'computing', 'Computing'),
];

const dependencies: NodeDependency[] = [
  { source: 'skill.alpha', target: 'skill.beta', relation: 'prerequisite_of', weight: 0.4, verificationStatus: 'verified' },
  { source: 'skill.alpha', target: 'skill.finance', relation: 'applied_in', weight: 0.5, verificationStatus: 'verified' },
  { source: 'skill.alpha', target: 'skill.computing', relation: 'related_to', weight: 0.3, verificationStatus: 'unverified' },
];

const questions: Question[] = [
  {
    id: 'q-alpha-1', nodeId: 'skill.alpha', text: 'Choose the correct concept',
    options: ['correct', 'incorrect'], correctOption: 0,
    explanation: 'Explanation', trapNote: 'Common confusion',
  },
  { id: 'q-alpha-2', nodeId: 'skill.alpha', text: 'An unseen equivalent question', options: ['correct', 'incorrect'], correctOption: 0 },
  { id: 'q-beta', nodeId: 'skill.beta', text: 'Beta question', options: ['correct', 'incorrect'], correctOption: 0 },
];

function buildState(overrides: Partial<EngineState> = {}): EngineState {
  return {
    config: { ...DEFAULT_ENGINE_CONFIG },
    nodes: new Map(nodes.map((n) => [n.id, n])),
    dependencies,
    questions: new Map(questions.map((q) => [q.id, q])),
    mastery: new Map(),
    cards: [],
    ...overrides,
  };
}

function card(id: string, nodeId: string, opts: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id, userId: 'user-1', nodeId, cardType: 'question',
    questionId: id.replace(/^card:/, ''),
    dueAt: addDays(NOW, 20).toISOString(),
    intervalDays: 20, ease: 2.5, isRepair: false, timesSeen: 1, timesCorrect: 1,
    ...opts,
  };
}

const user = { userId: 'user-1', activeTracks: ['common', 'finance', 'computing'] as TrackId[] };

describe('evidence-based proficiency', () => {
  it('a correct unseen answer updates only the directly assessed skill', () => {
    const state = buildState({ mastery: new Map([['skill.alpha', 50], ['skill.beta', 80], ['skill.finance', 70]]) });
    const result = applyAnswer(state, {
      userId: user.userId, questionId: 'q-alpha-1', attemptId: 'attempt-1',
      selectedOption: 0, answeredAt: NOW.toISOString(), seenBefore: false,
    }, user);

    expect(result.report.topicMastery.after).toBe(57.5);
    expect(result.masteryUpdates.map((row) => row.nodeId)).toEqual(['skill.alpha']);
    expect(result.report.masteryDeltas.map((row) => row.nodeId)).toEqual(['skill.alpha']);
    expect(result.report.nextAction).toBe('unseen_verification');
  });

  it('a wrong answer creates a diagnostic requirement but does not lower any skill mastery', () => {
    const before = new Map([['skill.alpha', 82], ['skill.beta', 74], ['skill.finance', 65], ['skill.computing', 55]]);
    const state = buildState({ mastery: new Map(before) });
    const result = applyAnswer(state, {
      userId: user.userId, questionId: 'q-alpha-1', attemptId: 'attempt-2',
      selectedOption: 1, answeredAt: NOW.toISOString(),
    }, user);

    expect(result.report.wasCorrect).toBe(false);
    expect(result.report.evidenceOnly).toBe(true);
    expect(result.report.diagnosticRequired).toBe(true);
    expect(result.report.nextAction).toBe('diagnostic_probe');
    expect(result.report.masteryDeltas).toEqual([]);
    expect(result.masteryUpdates).toEqual([]);
    expect([...state.mastery.entries()]).toEqual([...before.entries()]);
    expect(result.report.mentorMessage).toContain('سؤال تشخیصی');
    expect(result.report.prerequisiteRepairs).toEqual([]);
    expect(result.report.crossCourseBridges).toEqual([]);
    expect(result.report.siblingShock).toBeNull();
  });

  it('a correct answer to a previously seen item does not inflate proficiency', () => {
    const state = buildState({ mastery: new Map([['skill.alpha', 66]]) });
    const result = applyAnswer(state, {
      userId: user.userId, questionId: 'q-alpha-1', attemptId: 'attempt-3',
      selectedOption: 0, seenBefore: true, answeredAt: NOW.toISOString(),
    }, user);
    expect(result.report.topicMastery.after).toBe(66);
    expect(result.masteryUpdates).toEqual([]);
    expect(result.report.masteryDeltas).toEqual([]);
    expect(result.report.nextAction).toBe('spaced_review');
  });

  it('rejects fractional option indexes', () => {
    expect(() => applyAnswer(buildState(), {
      userId: user.userId, questionId: 'q-alpha-1', attemptId: 'attempt-4', selectedOption: 0.5,
    }, user)).toThrow('گزینهٔ نامعتبر');
  });

  it('does not accept a question from an inactive track', () => {
    expect(() => applyAnswer(buildState(), {
      userId: user.userId, questionId: 'q-alpha-1', attemptId: 'attempt-5', selectedOption: 0,
    }, { userId: user.userId, activeTracks: ['finance'] as TrackId[] })).toThrow('مسیرهای فعال');
  });
});

describe('review scheduling remains separate from proficiency', () => {
  it('wrong answers schedule the current question, but never cause a mastery cascade', () => {
    const existing: ReviewCard = {
      ...card(questionCardId(user.userId, 'q-alpha-1'), 'skill.alpha'),
      intervalDays: 15, ease: 2.5, timesSeen: 3,
    };
    const state = buildState({ cards: [existing], mastery: new Map([['skill.alpha', 80], ['skill.beta', 70]]) });
    const result = applyAnswer(state, {
      userId: user.userId, questionId: 'q-alpha-1', attemptId: 'attempt-6',
      selectedOption: 1, answeredAt: NOW.toISOString(),
    }, user);
    const updated = result.cardUpdates.find((row) => row.id === existing.id);
    expect(updated?.intervalDays).toBe(1);
    expect(updated?.ease).toBeCloseTo(2.3);
    expect(updated?.dueAt).toBe(addDays(NOW, 1).toISOString());
    expect(result.report.directReset).toBe(false);
    expect(result.masteryUpdates).toEqual([]);
    expect(state.mastery.get('skill.alpha')).toBe(80);
    expect(state.mastery.get('skill.beta')).toBe(70);
  });

  it('creates at most one user review card per trap and points to a stable global asset', () => {
    const state = buildState();
    const first = applyAnswer(state, {
      userId: user.userId, questionId: 'q-alpha-1', attemptId: 'attempt-7',
      selectedOption: 1, answeredAt: NOW.toISOString(),
    }, user);
    const second = applyAnswer(state, {
      userId: user.userId, questionId: 'q-alpha-1', attemptId: 'attempt-8',
      selectedOption: 1, answeredAt: NOW.toISOString(),
    }, user);
    expect(first.report.trapCardCreated).toBe(true);
    expect(second.report.trapCardCreated).toBe(false);
    const trap = state.cards.filter((row) => row.id === trapCardId(user.userId, 'q-alpha-1'));
    expect(trap).toHaveLength(1);
    expect(trap[0]?.questionId).toBe('q-alpha-1');
    expect(trap[0]?.trapCardId).toBe('trap:q-alpha-1');
  });

  it('grows spaced-review interval after a correct answer', () => {
    const existing = { ...card(questionCardId(user.userId, 'q-alpha-1'), 'skill.alpha'), intervalDays: 10, ease: 2 };
    const state = buildState({ cards: [existing] });
    const result = applyAnswer(state, {
      userId: user.userId, questionId: 'q-alpha-1', attemptId: 'attempt-9',
      selectedOption: 0, seenBefore: true, answeredAt: NOW.toISOString(),
    }, user);
    const updated = result.cardUpdates.find((row) => row.id === existing.id);
    expect(updated?.intervalDays).toBe(21);
    expect(updated?.ease).toBeCloseTo(2.05);
  });

  it('daily queue returns only due cards in active tracks', () => {
    const due = card(questionCardId(user.userId, 'q-alpha-1'), 'skill.alpha', { dueAt: addDays(NOW, -2).toISOString() });
    const future = card(questionCardId(user.userId, 'q-alpha-2'), 'skill.alpha');
    const inactive = card(questionCardId(user.userId, 'q-beta'), 'skill.beta', { dueAt: addDays(NOW, -2).toISOString() });
    const state = buildState({ cards: [due, future, inactive] });
    const queue = buildDailyQueue(state, { userId: user.userId, activeTracks: ['common'] as TrackId[] }, { limit: 10, now: NOW });
    expect(queue).toHaveLength(1);
    expect(queue[0]?.card.id).toBe(due.id);
  });

  it('trap-note review is not a graded question answer', () => {
    const trap: ReviewCard = {
      ...card(trapCardId(user.userId, 'q-alpha-1'), 'skill.alpha'),
      cardType: 'trap_note', questionId: 'q-alpha-1', trapCardId: 'trap:q-alpha-1',
      dueAt: addDays(NOW, -1).toISOString(),
    };
    const queue = buildDailyQueue(buildState({ cards: [trap] }), user, { limit: 10, now: NOW });
    expect(queue[0]?.card.cardType).toBe('trap_note');
    expect(queue[0]?.question?.id).toBe('q-alpha-1');
    expect(queue[0]?.trapNote).toBe('Common confusion');
  });
});
