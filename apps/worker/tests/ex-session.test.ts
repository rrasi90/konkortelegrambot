import { describe, expect, it } from 'vitest';
import { answerLearningQuiz, finishLearningQuiz, startLearningQuiz } from '../src/learning-paths';
import { MemoryStore } from '../src/memory-store';
import { issueSessionToken } from '../src/auth';
import finance from '../../../content/learning-courses/financial-management.json';
import type { LearningCourse } from '@ael/engine';

/**
 * فیکسچر آزمون نشست: همان محتوای پایلوت با برچسب review=reviewed (موضوع تست،
 * نشست/تکرارپذیری است، نه وضعیت بازبینی محتوا؛ انحصار pending در تست Gate است).
 */
const reviewedCourse: LearningCourse = {
  ...(finance as unknown as LearningCourse),
  questions: (finance as unknown as LearningCourse).questions.map(q => ({ ...q, review: 'reviewed' as const })),
};

/**
 * EX-03/EX-04 — نشست پایدار مسیر تألیفی: عملیات تکرارپذیر، زمان مرجع سرور،
 * نسخهٔ بانک و جداسازی کاربر (AT-12/AT-15/AT-16/AT-28).
 */

const secret = 'ex-session-tests-secret';
const baseNow = 1_700_000_000_000;

function store() {
  return new MemoryStore();
}

describe('EX-03 — عملیات تکرارپذیر', () => {
  it('همان operationId با همان محتوا همان نتیجه را می‌دهد (بدون خطا)', async () => {
    const mem = store();
    const user = await mem.createUser({ displayName: 'الف' });
    const started = await startLearningQuiz(user.id, secret, { courseId: 'financial-management', mode: 'timed', count: 2, seed: 5 }, baseNow, [reviewedCourse]);
    const result1 = await finishLearningQuiz(user.id, secret, { token: started.token, answers: {}, operationId: 'op-1' }, baseNow + 1_000);
    const result2 = await finishLearningQuiz(user.id, secret, { token: started.token, answers: {}, operationId: 'op-1' }, baseNow + 2_000);
    expect(result2.total).toBe(result1.total);
    expect(result2.correct).toBe(result1.correct);
  });

  it('همان operationId با محتوای متفاوت رد می‌شود (الگوی 0018)', async () => {
    const mem = store();
    const user = await mem.createUser({ displayName: 'الف' });
    const started = await startLearningQuiz(user.id, secret, { courseId: 'financial-management', mode: 'timed', count: 2, seed: 5 }, baseNow, [reviewedCourse]);
    const questionId = started.questions[0].id;
    await finishLearningQuiz(user.id, secret, { token: started.token, answers: {}, operationId: 'op-2' }, baseNow + 1_000);
    await expect(finishLearningQuiz(user.id, secret, {
      token: started.token, answers: { [questionId]: 1 }, operationId: 'op-2',
    }, baseNow + 2_000)).rejects.toThrow(/محتوای متفاوت/);
  });

  it('شناسهٔ عملیات نامعتبر رد می‌شود', async () => {
    const mem = store();
    const user = await mem.createUser({ displayName: 'الف' });
    const started = await startLearningQuiz(user.id, secret, { courseId: 'financial-management', mode: 'timed', count: 1, seed: 6 }, baseNow, [reviewedCourse]);
    await expect(finishLearningQuiz(user.id, secret, { token: started.token, answers: {}, operationId: 42 }, baseNow + 1_000))
      .rejects.toThrow(/شناسهٔ عملیات/);
  });
});

describe('EX-04 — زمان مرجع سرور و حفظ نشست', () => {
  it('ثبت نهایی پس از پایان مهلت + مهلت گذر با ساعت سرور رد می‌شود (AT-16)', async () => {
    const mem = store();
    const user = await mem.createUser({ displayName: 'الف' });
    const started = await startLearningQuiz(user.id, secret, { courseId: 'financial-management', mode: 'timed', count: 2, seed: 7 }, baseNow, [reviewedCourse]);
    const challenge = started.challenge;
    expect(challenge.deadline).not.toBeNull();
    const afterDeadline = challenge.deadline! + 15_000 + 1; // پایان + grace + ۱ms
    await expect(finishLearningQuiz(user.id, secret, { token: started.token, answers: {}, operationId: 'late-1' }, afterDeadline))
      .rejects.toThrow(/زمان ثبت این جلسه پایان یافته/);
  });

  it('ثبت نهایی درون مهلت با ساعت سرور پذیرفته می‌شود', async () => {
    const mem = store();
    const user = await mem.createUser({ displayName: 'الف' });
    const started = await startLearningQuiz(user.id, secret, { courseId: 'financial-management', mode: 'timed', count: 2, seed: 8 }, baseNow, [reviewedCourse]);
    const result = await finishLearningQuiz(user.id, secret, { token: started.token, answers: {}, operationId: 'ok-1' }, started.challenge.deadline! - 1_000);
    expect(result.total).toBe(2);
  });

  it('جلسهٔ کاربر الف برای کاربر ب قابل استفاده نیست (AT-28)', async () => {
    const mem = store();
    const userA = await mem.createUser({ displayName: 'الف' });
    const userB = await mem.createUser({ displayName: 'ب' });
    const started = await startLearningQuiz(userA.id, secret, { courseId: 'financial-management', mode: 'timed', count: 1, seed: 9 }, baseNow, [reviewedCourse]);
    await expect(finishLearningQuiz(userB.id, secret, { token: started.token, answers: {}, operationId: 'x' }, baseNow + 1_000))
      .rejects.toThrow(/متعلق به این کاربر نیست/);
  });

  it('تغییر نسخهٔ درس نشست قبلی را باطل می‌کند (AT-12/AT-18)', async () => {
    const mem = store();
    const user = await mem.createUser({ displayName: 'الف' });
    const started = await startLearningQuiz(user.id, secret, { courseId: 'financial-management', mode: 'timed', count: 1, seed: 10 }, baseNow, [reviewedCourse]);
    // شبیه‌سازی تغییر نسخه: نشست با نسخهٔ متفاوت از نسخهٔ جاری بسته می‌شود.
    const forged = { ...started.challenge, userId: user.id, expires: baseNow + 60_000, version: '9.9.9' };
    const tampered = await issueSessionToken(JSON.stringify(forged), `ael.formative.v1:${secret}`);
    await expect(finishLearningQuiz(user.id, secret, { token: tampered, answers: {}, operationId: 'v-1' }, baseNow + 1_000))
      .rejects.toThrow(/نسخهٔ درس عوض شده/);
  });

  it('پاسخ تمرینی با operationId تکرارپذیر است', async () => {
    const mem = store();
    const user = await mem.createUser({ displayName: 'الف' });
    const started = await startLearningQuiz(user.id, secret, { courseId: 'financial-management', mode: 'practice', count: 1, seed: 11 }, baseNow, [reviewedCourse]);
    const questionId = started.questions[0].id;
    const first = await answerLearningQuiz(user.id, secret, { token: started.token, questionId, selected: 0, operationId: 'ans-1' }, baseNow + 500);
    const second = await answerLearningQuiz(user.id, secret, { token: started.token, questionId, selected: 0, operationId: 'ans-1' }, baseNow + 600);
    expect(second.status).toBe(first.status);
    await expect(answerLearningQuiz(user.id, secret, { token: started.token, questionId, selected: 1, operationId: 'ans-1' }, baseNow + 700))
      .rejects.toThrow(/محتوای متفاوت/);
  });
});
