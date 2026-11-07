import { describe, expect, it } from 'vitest';
import { learningCourses } from '../../../apps/worker/src/learning-catalog';
import { courseOverview, createQuiz, gradeFormativeAnswer, gradeFormativeQuiz, normalizeLearningTopicBlocks, projectFormativeQuestion } from '../src/formative-quiz';
import type { LearningCourse } from '../src/formative-quiz';
import { extractRecurrence } from '../../../scripts/extract-learning-recurrence.mjs';
import { buildQuestionIndex } from '../../../scripts/build-question-index.mjs';

const course = learningCourses[0];
const stats = learningCourses.find(item => item.id === 'statistics-foundations')!;

/**
 * فیکسچر آزمون موتور: همان محتوای پایلوت با برچسب review=reviewed.
 * موضوع تست اینجا رفتار موتور است، نه وضعیت بازبینی واقعی محتوا؛
 * انحصار pending_sme در تست‌های جداگانهٔ Gate پایین assertion می‌شود.
 */
function asReviewed(source: LearningCourse): LearningCourse {
  return { ...source, questions: source.questions.map(q => ({ ...q, review: 'reviewed' as const })) };
}
const reviewedCourse = asReviewed(course);
const reviewedStats = asReviewed(stats);

describe('question metadata index', () => {
  it('excludes sensitive question text, keys, and free-form references', () => {
    const index = buildQuestionIndex([{ questions: [{ id: 'q.1', examLevel: 'ارشد', examYear: 1400,
      questionText: 'secret', correctOption: 1, sourceReference: 'key secret' }] }]);
    expect(index.entries[0]).toMatchObject({ id: 'q.1', level: 'ارشد', year: 1400, booklet: null });
    expect(JSON.stringify(index)).not.toContain('secret');
    expect(JSON.stringify(index)).not.toContain('correctOption');
    expect(() => buildQuestionIndex([{ questions: [{ id: 'q.1' }, { id: 'q.1' }] }])).toThrow();
  });
  it('resolves registered topic labels and leaves missing mappings empty', () => {
    const index = buildQuestionIndex([{ questions: [{ id: 'q.1', sourceNodeId: 'n.1' }, { id: 'q.2', sourceNodeId: 'n.2' }] }],
      [{ id: 'n.1', course: 'مالی', chapter: 'نرخ', topic: 'نرخ دوره‌ای' }]);
    expect(index.entries[0]).toMatchObject({ courseTitle: 'مالی', chapterTitle: 'نرخ', topicTitle: 'نرخ دوره‌ای' });
    expect(index.entries[1]).toMatchObject({ courseTitle: null, chapterTitle: null, topicTitle: null });
  });
  it('merges authored metadata without exposing the answer or confusing educational references with exam sources', () => {
    const course = { id: 'course.a', title: 'درس الف', topics: [{ id: 'topic.a', title: 'مبحث الف' }],
      sources: [{ id: 's.1', title: 'مرجع آموزشی', locator: 'فصل ۱' }],
      questions: [{ id: 'q.a', topicId: 'topic.a', sourceIds: ['s.1'], answerIndex: 2, explanation: 'SECRET' }] };
    const result = buildQuestionIndex([], [], [course]);
    expect(result.entries[0]).toMatchObject({ sourceType: 'authored', year: null, courseTitle: 'درس الف',
      learningReferences: [{ title: 'مرجع آموزشی', locator: 'فصل ۱' }] });
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(JSON.stringify(result)).not.toContain('answerIndex');
    expect(() => buildQuestionIndex([{ questions: [{ id: 'q.a' }] }], [], [course])).toThrow();
  });
});

describe('authored formative engine', () => {
  it('keeps written answers pending and withholds rubric until assessment', () => {
    const session = createQuiz(reviewedStats, { mode: 'timed', kind: 'essay', count: 1, requireCount: true, seed: 1 }, 1);
    const question = session.questions[0];
    expect(question.kind).toBe('essay');
    expect(question).not.toHaveProperty('explanation');
    expect(question).not.toHaveProperty('rubric');
    const result = gradeFormativeQuiz(reviewedStats, session.challenge, { [question.id]: 'میانگین ۵ است.' });
    expect(result).toMatchObject({ total: 1, correct: 0, incorrect: 0, skipped: 0, pending: 1 });
    expect(result.results[0]).toHaveProperty('rubric');
    expect(gradeFormativeQuiz(reviewedStats, session.challenge, {}).skipped).toBe(1);
    expect(() => gradeFormativeQuiz(reviewedStats, session.challenge, { [question.id]: ' '.repeat(3) })).toThrow();
    expect(() => gradeFormativeQuiz(reviewedStats, session.challenge, { [question.id]: 'x'.repeat(5001) })).toThrow();
  });
  it('projects a balanced diagnostic without keys or explanations', () => {
    const session = createQuiz(reviewedCourse, { mode: 'diagnostic', count: 8 }, 100);
    expect(new Set(session.questions.map(q => q.topicId)).size).toBe(8);
    expect(session.challenge.deadline).toBeNull();
    expect(session.questions.every(q => q.difficulty === 'basic')).toBe(true);
    expect(session.questions[0]).not.toHaveProperty('answerIndex');
    expect(session.questions[0]).not.toHaveProperty('optionReasons');
    expect(courseOverview(reviewedCourse)).not.toHaveProperty('questions');
  });

  it('honors the topic, count, and timed deadline', () => {
    const session = createQuiz(reviewedCourse, { mode: 'timed', count: 12, topicId: 'fm.tvm' }, 100, () => 0.5);
    expect(session.questions).toHaveLength(3);
    expect(session.challenge.deadline).toBe(180_100);
    expect(session.questions.every(q => q.topicId === 'fm.tvm')).toBe(true);
  });

  it('counts correct, wrong, and unanswered separately', () => {
    const { challenge } = createQuiz(reviewedCourse, { mode: 'diagnostic', count: 3 }, 1);
    const [first, second] = challenge.ids.map(id => course.questions.find(q => q.id === id)!);
    const summary = gradeFormativeQuiz(reviewedCourse, challenge, { [first.id]: first.answerIndex, [second.id]: (second.answerIndex + 1) % 4 });
    expect(summary).toMatchObject({ total: 3, correct: 1, incorrect: 1, skipped: 1 });
    expect(summary.results[0].optionReasons).toHaveLength(4);
  });

  it('rejects foreign questions, invalid choices, and stale pack versions', () => {
    const { challenge } = createQuiz(reviewedCourse, { mode: 'practice', count: 1 });
    expect(() => gradeFormativeAnswer(reviewedCourse, challenge, 'missing', 0)).toThrow();
    expect(() => gradeFormativeAnswer(reviewedCourse, challenge, challenge.ids[0], 99)).toThrow();
    expect(() => gradeFormativeQuiz(reviewedCourse, challenge, { invalid: 0 })).toThrow();
    expect(() => gradeFormativeQuiz({ ...course, version: '99.0.0' }, challenge, {})).toThrow();
  });

  it('restricts review sessions to requested items', () => {
    const session = createQuiz(reviewedCourse, { mode: 'practice', reviewIds: ['fm.tvm.q01', 'fm.tvm.q01', 'fm.bonds.q01'] });
    expect(session.challenge.ids).toEqual(['fm.tvm.q01', 'fm.bonds.q01']);
    expect(() => createQuiz(reviewedCourse, { mode: 'diagnostic', reviewIds: ['fm.tvm.q01'] })).toThrow();
  });

  it('restricts a custom quiz to selected topics and rejects insufficient capacity', () => {
    const topicIds = course.topics.slice(0, 2).map(topic => topic.id);
    const session = createQuiz(reviewedCourse, { mode: 'timed', topicIds, count: 5, requireCount: true });
    expect(session.questions).toHaveLength(5);
    expect(session.questions.every(question => topicIds.includes(question.topicId))).toBe(true);
    expect(new Set(session.challenge.ids).size).toBe(5);
    expect(() => createQuiz(reviewedCourse, { mode: 'timed', topicIds: [topicIds[0]], count: 4, requireCount: true })).toThrow();
    expect(() => createQuiz(reviewedCourse, { mode: 'timed', topicIds: ['missing'], count: 1 })).toThrow();
    expect(() => createQuiz(reviewedCourse, { mode: 'timed', topicIds: [], count: 1 })).toThrow();
  });

  it('enforces per-topic quotas and rejects impossible or inconsistent selections', () => {
    const topics = course.topics.slice(0, 2).map(topic => topic.id);
    const input = { mode: 'timed', topicIds: topics, count: 3, seed: 42,
      topicQuotas: [{ topicId: topics[0], count: 1 }, { topicId: topics[1], count: 2 }] };
    const result = createQuiz(reviewedCourse, input, 1);
    expect(result.questions.filter(question => question.topicId === topics[0])).toHaveLength(1);
    expect(result.questions.filter(question => question.topicId === topics[1])).toHaveLength(2);
    expect(new Set(result.challenge.ids).size).toBe(3);
    expect(createQuiz(reviewedCourse, input, 1).challenge.ids).toEqual(result.challenge.ids);
    expect(() => createQuiz(reviewedCourse, { ...input, count: 5 }, 1)).toThrow(/مجموع/);
    expect(() => createQuiz(reviewedCourse, { ...input, count: 5,
      topicQuotas: [{ topicId: topics[0], count: 4 }, { topicId: topics[1], count: 1 }] }, 1)).toThrow(/فقط/);
    expect(() => createQuiz(reviewedCourse, { ...input,
      topicQuotas: [{ topicId: topics[0], count: 1 }, { topicId: topics[0], count: 2 }] }, 1)).toThrow();
  });

  it('matches quotas across shared variant groups without selecting equivalent questions twice', () => {
    const topics = course.topics.slice(0, 3);
    const original = reviewedCourse.questions[0];
    const q = (id: string, topicId: string, variantGroup: string) => ({ ...original, id, topicId, variantGroup });
    const pack = { ...reviewedCourse, topics, questions: [
      q('a1', topics[0].id, 'shared'), q('a2', topics[0].id, 'free'),
      q('b1', topics[1].id, 'shared'), q('c1', topics[2].id, 'other'),
    ] };
    const input = { mode: 'timed', topicIds: topics.slice(0, 2).map(t => t.id), count: 2,
      topicQuotas: topics.slice(0, 2).map(t => ({ topicId: t.id, count: 1 })) };
    for (let seed = 0; seed < 50; seed++) {
      const a = createQuiz(pack, { ...input, seed }, 1);
      expect(a.challenge.ids).toEqual(['a2', 'b1']);
      expect(a.challenge.selectionVersion).toBe('mulberry32-variants-v2');
      const plain = createQuiz(pack, { mode: 'timed', count: 3, seed, requireCount: true }, 1);
      const selectedGroups = plain.challenge.ids.map(id => pack.questions.find(item => item.id === id)!.variantGroup);
      expect(new Set(selectedGroups).size).toBe(3);
    }
    expect(courseOverview(pack).questionCount).toBe(3);
    expect(() => createQuiz(pack, { mode: 'timed', count: 4, requireCount: true }, 1)).toThrow(/مستقل/);
    const impossible = { ...pack, questions: [q('a1', topics[0].id, 'shared'), q('b1', topics[1].id, 'shared'),
      q('c1', topics[2].id, 'other'), q('c2', topics[2].id, 'third')] };
    expect(() => createQuiz(impossible, { mode: 'timed', count: 3, requireCount: true,
      topicIds: topics.map(t => t.id), topicQuotas: topics.map(t => ({ topicId: t.id, count: 1 })) }, 1)).toThrow(/هم‌زمان/);
  });

  it('finds every feasible allocation for all small three-topic overlap patterns', () => {
    const topics = course.topics.slice(0, 3);
    const original = reviewedCourse.questions[0];
    const input = { mode: 'timed', count: 3, requireCount: true, seed: 7,
      topicIds: topics.map(t => t.id), topicQuotas: topics.map(t => ({ topicId: t.id, count: 1 })) };
    for (let a = 1; a < 8; a++) for (let b = 1; b < 8; b++) for (let c = 1; c < 8; c++) {
      const masks = [a, b, c];
      const questions = topics.flatMap((topic, i) => [0, 1, 2].filter(g => masks[i] & (1 << g)).map(g => ({
        ...original, id: `test.${i}.${g}`, topicId: topic.id, variantGroup: `group.${g}`,
      })));
      const pack = { ...reviewedCourse, topics, questions };
      const feasible = [0, 1, 2].some(x => [0, 1, 2].some(y => [0, 1, 2].some(z =>
        x !== y && x !== z && y !== z && !!(a & (1 << x)) && !!(b & (1 << y)) && !!(c & (1 << z)))));
      if (!feasible) expect(() => createQuiz(pack, input, 1)).toThrow();
      else {
        const selected = createQuiz(pack, input, 1).challenge.ids.map(id => questions.find(q => q.id === id)!);
        expect(new Set(selected.map(q => q.variantGroup)).size).toBe(3);
        expect(new Set(selected.map(q => q.topicId)).size).toBe(3);
      }
    }
  });

  it('does not always select the first topic when the requested count is small', () => {
    const topics = new Set(Array.from({ length: 32 }, (_, seed) =>
      createQuiz(reviewedCourse, { mode: 'timed', count: 1, seed }, 1).questions[0].topicId));
    expect(topics.size).toBeGreaterThan(1);
    const a = createQuiz(reviewedCourse, { mode: 'timed', count: 3, seed: 72 }, 1);
    expect(createQuiz(reviewedCourse, { mode: 'timed', count: 3, seed: 72 }, 1).challenge.ids).toEqual(a.challenge.ids);
    expect(a.challenge).toMatchObject({ selectionSeed: 72, selectionVersion: 'mulberry32-v1' });
    expect(() => createQuiz(reviewedCourse, { mode: 'timed', seed: -1 }, 1)).toThrow();
  });

  it('distributes single-question selections across topics on a fixed sample of seeds', () => {
    const counts = new Map(course.topics.map(topic => [topic.id, 0]));
    for (let seed = 1; seed <= 1000; seed++) {
      let state = seed;
      const random = () => {
        state = (state + 0x6d2b79f5) | 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
      const session = createQuiz(reviewedCourse, { mode: 'timed', count: 1 }, 1, random);
      const id = session.questions[0].topicId;
      counts.set(id, counts.get(id)! + 1);
    }
    for (const count of counts.values()) {
      expect(count).toBeGreaterThanOrEqual(80);
      expect(count).toBeLessThanOrEqual(170);
    }
  });
});

describe('ten-year extraction', () => {
  const rule = { id: 'x', title: 'X', nodeId: 'n1', required: ['کشش', 'تقاضا'], summary: 'S', practicePrompt: 'P' };
  const trace = (year: number, id: string, edits = {}) => ({ id, examYear: year, examLevel: 'ارشد', bookletCode: 'A',
    bookletQuestionNumber: 42, verificationStatus: 'official_key_cited_in_reference', sourceReference: 'ref',
    sourceNodeId: 'n1', questionText: 'كشش تقاضا', ...edits });
  it('requires distinct years and rejects duplicates, old years, vague traces, and unverified keys', () => {
    const first = trace(1396, 'a');
    const bank = [{ path: 'bank.json', questions: [first, trace(1396, 'dup'), trace(1395, 'old'),
      trace(1404, 'unknown', { bookletQuestionNumber: null }),
      trace(1401, 'pending', { verificationStatus: 'transcribed_pending_key_review' })] }];
    expect(extractRecurrence(bank, [rule], 1405).patterns).toEqual([]);
    bank[0].questions.push(trace(1405, 'b'));
    expect(extractRecurrence(bank, [rule], 1405).patterns[0]).toMatchObject({ years: [1396, 1405] });
    expect(extractRecurrence(bank, [rule], 1405).patterns[0].occurrences).toHaveLength(2);
  });
  it('excludes audited conflicts before counting recurring patterns', () => {
    const bank = [{ path: 'bank.json', questions: [trace(1396, 'a'), trace(1400, 'b')] }];
    expect(extractRecurrence(bank, [rule], 1405).patterns).toHaveLength(1);
    const audit = { items: [{ id: 'a', result: 'conflict' }] };
    expect(extractRecurrence(bank, [rule], 1405, audit).patterns).toEqual([]);
  });
});


describe('AEL Gate — سؤال تأییدنشده از استخر عمومی خارج است (AT-AEL-20)', () => {
  it('pending_sme بدون انتخاب صریح سمت سرور قابل آزمون نیست', () => {
    // محتوای واقعی پایلوت همه pending_sme است → استخر عمومی خالی
    expect(() => createQuiz(course, { mode: 'practice', count: 1, seed: 1 }, 1)).toThrow();
  });

  it('pending_sme فقط با reviewIds صریح (صف مرور سمت سرور) در دسترس است', () => {
    const pending = course.questions.find(q => q.review === 'pending_sme')!;
    const session = createQuiz(reviewedCourse, { mode: 'practice', count: 1, reviewIds: [pending.id], seed: 1 }, 1);
    expect(session.questions.map(q => q.id)).toEqual([pending.id]);
  });

  it('محتوای reviewed در استخر عمومی در دسترس است', () => {
    const session = createQuiz(reviewedCourse, { mode: 'practice', count: 3, seed: 1 }, 1);
    expect(session.questions).toHaveLength(3);
    expect(session.questions.every(q => q.review === 'reviewed')).toBe(true);
  });
});


describe('Layer 1 — lesson blocks and academic metadata compatibility', () => {
  it('normalizes legacy lesson fields into ordered canonical blocks without mutating the source', () => {
    const topic = course.topics[0];
    const blocks = normalizeLearningTopicBlocks(topic);
    expect(blocks[0]).toMatchObject({ kind: 'learning_objective', content: topic.objective, position: 0 });
    expect(blocks.some(block => block.kind === 'concept_explanation')).toBe(true);
    expect(blocks.some(block => block.kind === 'worked_example' && block.content === topic.workedExample)).toBe(true);
    expect(blocks.some(block => block.kind === 'common_misconception' && block.content === topic.commonError)).toBe(true);
    expect(topic).not.toHaveProperty('blocks');
  });

  it('prefers explicitly supplied blocks and sorts them by position', () => {
    const topic = { ...course.topics[0], blocks: [
      { id:'topic.block.2',kind:'worked_example' as const,position:2,content:'مثال' },
      { id:'topic.block.1',kind:'concept_explanation' as const,position:1,content:'مفهوم' },
    ] };
    expect(normalizeLearningTopicBlocks(topic).map(block => block.id)).toEqual(['topic.block.1','topic.block.2']);
  });

  it('projects optional academic question metadata without adding answer data', () => {
    const question = { ...course.questions[0], skillIds:['skill.example'], learningOutcomeIds:['outcome.example'],
      tagIds:['discipline.management'], bloomLevel:4 as const, questionFormat:'single_choice' as const,
      assessmentPurpose:['practice' as const], estimatedTimeSeconds:75 };
    const projection = projectFormativeQuestion(question);
    expect(projection).toMatchObject({ skillIds:['skill.example'],learningOutcomeIds:['outcome.example'],
      tagIds:['discipline.management'],bloomLevel:4,questionFormat:'single_choice',
      assessmentPurpose:['practice'],estimatedTimeSeconds:75 });
    expect(projection).not.toHaveProperty('answerIndex');
    expect(projection).not.toHaveProperty('explanation');
  });
});
