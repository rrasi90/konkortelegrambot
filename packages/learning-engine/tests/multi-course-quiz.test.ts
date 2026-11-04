import { describe, expect, it } from 'vitest';
import {
  createMultiCourseQuiz,
  gradeMultiCourseQuiz,
  previewMultiCourseQuiz,
} from '../src/multi-course-quiz';
import type { LearningCourse } from '../src/formative-quiz';

function makeCourse(
  id: string,
  topics: Array<{ id: string; questionIds: string[]; variantGroup?: string }>,
): LearningCourse {
  const questions = topics.flatMap(topic =>
    topic.questionIds.map(qid => ({
      id: `${id}.${qid}`,
      topicId: topic.id,
      difficulty: 'basic' as const,
      prompt: `پرسش ${qid}`,
      choices: ['الف', 'ب', 'ج', 'د'],
      answerIndex: 0,
      explanation: 'توضیح',
      optionReasons: ['۱', '۲', '۳', '۴'],
      sourceIds: [],
      origin: 'authored' as const,
      rights: 'original_ael' as const,
      review: 'pending_sme' as const,
      variantGroup: topic.variantGroup,
    })));
  return {
    schemaVersion: 1, id, version: '1.0.0', title: `درس ${id}`, status: 'authored_pilot',
    description: '', scopeNote: '',
    sources: [],
    topics: topics.map(topic => ({ id: topic.id, title: topic.id, objective: '', minutes: 5,
      prerequisites: [], concepts: [], formula: '', workedExample: '', commonError: '', sourceIds: [] })),
    questions,
  };
}

const A = makeCourse('course-a', [
  { id: 'a1', questionIds: ['q1', 'q2'], variantGroup: undefined },
  { id: 'a2', questionIds: ['q3'] },
]);
const B = makeCourse('course-b', [
  { id: 'b1', questionIds: ['q1', 'q2'] },
]);
// گروه g1 بین دو بسته مشترک است (هم‌ارز سراسری).
const SHARED = makeCourse('shared', [
  { id: 's1', questionIds: ['q1'], variantGroup: 'g1' },
  { id: 's2', questionIds: ['q2'] },
]);
const SHARED_B = makeCourse('shared-b', [{ id: 't1', questionIds: ['q1'], variantGroup: 'g1' }]);
const ONLY_SHARED_A = makeCourse('only-a', [{ id: 'u1', questionIds: ['q1'], variantGroup: 'g2' }]);
const ONLY_SHARED_B = makeCourse('only-b', [{ id: 'v1', questionIds: ['q1'], variantGroup: 'g2' }]);

describe('EX-01 — پیش‌نمایش با همان سیاست فیلتر', () => {
  it('ظرفیت سراسری، ظرفیت هر درس و هر مبحث را با نتیجهٔ تأمین گزارش می‌کند', () => {
    const preview = previewMultiCourseQuiz([A, B], { mode: 'practice', count: 5 });
    expect(preview.filterCapacity).toBe(5);
    expect(preview.canSatisfy).toBe(true);
    expect(preview.versionPin).toEqual({ 'course-a': '1.0.0', 'course-b': '1.0.0' });
    expect(preview.perCourse.find(row => row.courseId === 'course-a')!.capacity).toBe(3);
  });

  it('AT-08: سهمیهٔ بیشتر از ظرفیت با دلیل قابل فهم رد می‌شود', () => {
    const preview = previewMultiCourseQuiz([A], { mode: 'practice', count: 4, courseQuotas: [{ courseId: 'course-a', count: 4 }] });
    expect(preview.canSatisfy).toBe(false);
    expect(preview.shortfallReasons.join(' ')).toContain('فقط 3');
  });

  it('مجموع سهمیهٔ درس‌ها باید برابر تعداد باشد', () => {
    const preview = previewMultiCourseQuiz([A, B], { mode: 'practice', count: 4, courseQuotas: [{ courseId: 'course-a', count: 1 }, { courseId: 'course-b', count: 1 }] });
    expect(preview.canSatisfy).toBe(false);
    expect(preview.shortfallReasons.join(' ')).toContain('برابر تعداد سؤال');
  });
});

describe('EX-02 — سهمیهٔ بین درس‌ها و گروه‌های هم‌ارز', () => {
  it('تخصیص قابل تأمین با گروه مشترک بین دو درس پیدا می‌شود (AT-07)', () => {
    const { challenge, questions } = createMultiCourseQuiz([SHARED, SHARED_B], {
      mode: 'practice', count: 2, seed: 7,
      courseQuotas: [{ courseId: 'shared', count: 1 }, { courseId: 'shared-b', count: 1 }],
    });
    // تخصیص معتبر: shared از سؤال مستقل خودش (q2)، shared-b از گروه مشترک — نه هر دو از یک گروه.
    expect(challenge.ids).toHaveLength(2);
    expect(challenge.ids).toContain('shared.q2');
    expect(questions).toHaveLength(2);
  });

  it('AT-06: از هر گروه هم‌ارز حداکثر یک نسخه انتخاب می‌شود', () => {
    const twoSameGroup = makeCourse('same', [{ id: 's1', questionIds: ['q1', 'q2'], variantGroup: 'g9' }]);
    const { challenge } = createMultiCourseQuiz([twoSameGroup], { mode: 'practice', count: 2, seed: 1 });
    expect(challenge.ids).toHaveLength(1);
  });

  it('AT-08: گروه مشترک تنها در دو درس + سهمیهٔ ۱+۱ ممکن نیست و خطای قابل فهم می‌دهد', () => {
    expect(() => createMultiCourseQuiz([ONLY_SHARED_A, ONLY_SHARED_B], {
      mode: 'practice', count: 2,
      courseQuotas: [{ courseId: 'only-a', count: 1 }, { courseId: 'only-b', count: 1 }],
    })).toThrow(/قابل تأمین/);
  });

  it('سهمیهٔ مبحث در چند بسته با تطبیق دوبخشی تأمین می‌شود', () => {
    const { challenge, questions } = createMultiCourseQuiz([A, B], {
      mode: 'practice', count: 3, seed: 11,
      topicIds: ['a1', 'a2', 'b1'],
      topicQuotas: [{ topicId: 'a1', count: 1 }, { topicId: 'a2', count: 1 }, { topicId: 'b1', count: 1 }],
    });
    expect(challenge.ids).toHaveLength(3);
    expect(questions.map(q => q.topicId).sort()).toEqual(['a1', 'a2', 'b1']);
  });

  it('سهمیهٔ درس و سهمیهٔ مبحث هم‌زمان مجاز نیست', () => {
    expect(() => createMultiCourseQuiz([A, B], {
      mode: 'practice', count: 2,
      courseQuotas: [{ courseId: 'course-a', count: 1 }, { courseId: 'course-b', count: 1 }],
      topicIds: ['a1', 'b1'], topicQuotas: [{ topicId: 'a1', count: 1 }, { topicId: 'b1', count: 1 }],
    })).toThrow(/هم‌زمان/);
  });
});

describe('بازپخش، فیلتر و توزیع', () => {
  it('AT-09: بانک/تنظیم/seed یکسان → انتخاب یکسان', () => {
    const input = { mode: 'practice' as const, count: 4, seed: 42 };
    const first = createMultiCourseQuiz([A, B], input).challenge;
    const second = createMultiCourseQuiz([A, B], input).challenge;
    expect(second.ids).toEqual(first.ids);
    expect(second.selectionSeed).toBe(first.selectionSeed);
  });

  it('AT-10: هزار seed — فقط از استخر فیلترشده و بدون تکرار گروه', () => {
    const filtered = previewMultiCourseQuiz([A, B], { mode: 'practice', count: 4, topicIds: ['a1', 'b1'] });
    const allowed = new Set(filtered.perTopic.map(row => row.topicId));
    for (let seed = 0; seed < 1000; seed++) {
      const { challenge, questions } = createMultiCourseQuiz([A, B], { mode: 'practice', count: 4, seed, topicIds: ['a1', 'b1'] });
      expect(challenge.ids.length).toBeLessThanOrEqual(4);
      expect(new Set(challenge.ids).size).toBe(challenge.ids.length);
      for (const question of questions) expect(allowed.has(question.topicId)).toBe(true);
    }
  });

  it('AT-11: توزیع انتخاب روی بانک متوازن بدون سهمیه هم متعادل است', () => {
    const perTopicTotal = new Map<string, number>();
    for (let seed = 0; seed < 60; seed++) {
      const { questions } = createMultiCourseQuiz([A, B], { mode: 'diagnostic', count: 6, seed });
      for (const question of questions) perTopicTotal.set(question.topicId, (perTopicTotal.get(question.topicId) ?? 0) + 1);
    }
    // در ۶۰ جلسهٔ ۶ سؤالی، هر مبحث از ۵ مبحث باید به‌طور معنادار حضور داشته باشد.
    for (const topicId of ['a1', 'a2', 'b1']) {
      expect(perTopicTotal.get(topicId) ?? 0).toBeGreaterThanOrEqual(60);
    }
  });

  it('AT-12: تغییر نسخهٔ بانک بعد از پیش‌نمایش، تصحیح با چالش قدیمی را رد می‌کند', () => {
    const preview = previewMultiCourseQuiz([A], { mode: 'practice', count: 2 });
    expect(preview.versionPin['course-a']).toBe('1.0.0');
    const { challenge } = createMultiCourseQuiz([A], { mode: 'practice', count: 2, seed: 3 });
    const updated: LearningCourse = { ...A, version: '1.1.0' };
    expect(() => gradeMultiCourseQuiz([updated], challenge, {})).toThrow(/نسخهٔ درس تغییر کرده/);
  });
});
