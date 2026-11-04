import { describe, expect, it } from 'vitest';
import { createApp } from '../src/index';
import { MemoryStore } from '../src/memory-store';
import { issueSessionToken } from '../src/auth';
import { answerLearningQuiz, finishLearningQuiz, startLearningQuiz } from '../src/learning-paths';

const secret = 'learning-path-tests-only';
const courseId = 'financial-management';

describe('Worker learning paths', () => {
  it('enforces topic quotas through the authenticated API and reports shortage', async () => {
    const store = new MemoryStore();
    const app = createApp({ SESSION_SECRET: secret }, { store });
    const user = await store.createUser({ displayName: 'Tester' });
    const token = await issueSessionToken(user.id, secret);
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const request = { courseId, mode: 'timed', count: 3, topicIds: ['fm.ratios', 'fm.tvm'],
      topicQuotas: [{ topicId: 'fm.ratios', count: 1 }, { topicId: 'fm.tvm', count: 2 }], seed: 42 };
    const start = await app.request('/api/learning-quiz/start', { method: 'POST', headers, body: JSON.stringify(request) });
    expect(start.status).toBe(200);
    const session = await start.json();
    expect(session.questions.filter((q: { topicId: string }) => q.topicId === 'fm.ratios')).toHaveLength(1);
    expect(session.questions.filter((q: { topicId: string }) => q.topicId === 'fm.tvm')).toHaveLength(2);
    const shortage = await app.request('/api/learning-quiz/start', { method: 'POST', headers, body: JSON.stringify({
      ...request, count: 5, topicQuotas: [{ topicId: 'fm.ratios', count: 4 }, { topicId: 'fm.tvm', count: 1 }],
    }) });
    expect(shortage.status).toBe(400);
    expect((await shortage.json()).error).toContain('فقط 3');
  });
  it('withholds written-answer guidance until timed submission and keeps the result pending', async () => {
    const store = new MemoryStore();
    const app = createApp({ SESSION_SECRET: secret }, { store });
    const user = await store.createUser({ displayName: 'Tester' });
    const token = await issueSessionToken(user.id, secret);
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const start = await app.request('/api/learning-quiz/start', { method: 'POST', headers,
      body: JSON.stringify({ courseId: 'statistics-foundations', mode: 'timed', kind: 'essay', count: 1 }) });
    expect(start.status).toBe(200);
    const session = await start.json();
    expect(session.questions[0]).not.toHaveProperty('rubric');
    expect(session.questions[0]).not.toHaveProperty('explanation');
    const early = await app.request('/api/learning-quiz/answer', { method: 'POST', headers,
      body: JSON.stringify({ token: session.token, questionId: session.questions[0].id, selected: 'پاسخ' }) });
    expect(early.status).toBe(400);
    const finish = await app.request('/api/learning-quiz/finish', { method: 'POST', headers,
      body: JSON.stringify({ token: session.token, answers: { [session.questions[0].id]: 'میانگین پنج است.' } }) });
    expect(finish.status).toBe(200);
    const report = await finish.json();
    expect(report).toMatchObject({ pending: 1, correct: 0, incorrect: 0 });
    expect(report.results[0].rubric).toHaveLength(3);
  });
  it('authenticates routes and sends only the public question projection', async () => {
    const store = new MemoryStore();
    const app = createApp({ SESSION_SECRET: secret }, { store });
    expect((await app.request('/api/learning-paths')).status).toBe(401);
    const user = await store.createUser({ displayName: 'Tester' });
    const token = await issueSessionToken(user.id, secret);
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const catalog = await app.request('/api/learning-paths', { headers });
    expect(catalog.status).toBe(200);
    expect((await catalog.json()).courses[0]).not.toHaveProperty('questions');
    const start = await app.request('/api/learning-quiz/start', {
      method: 'POST', headers, body: JSON.stringify({ courseId, mode: 'timed', count: 2 }),
    });
    expect(start.status).toBe(200);
    expect(start.headers.get('cache-control')).toBe('no-store');
    const data = await start.json();
    expect(data.questions[0]).not.toHaveProperty('answerIndex');
    expect(data.questions[0]).not.toHaveProperty('explanation');
    const feedback = await app.request('/api/learning-quiz/answer', {
      method: 'POST', headers, body: JSON.stringify({ token: data.token, questionId: data.questions[0].id, selected: 0 }),
    });
    expect(feedback.status).toBe(400);
    expect(await feedback.json()).not.toHaveProperty('answerIndex');
  });

  it('binds the challenge to the learner, mode, lifetime, and secret', async () => {
    const timed = await startLearningQuiz('u1', secret, { courseId, mode: 'timed', count: 2 }, 1000);
    const submission = { token: timed.token, answers: {} };
    await expect(finishLearningQuiz('u2', secret, submission, 1001)).rejects.toThrow();
    await expect(finishLearningQuiz('u1', secret, { ...submission, token: timed.token + 'x' }, 1001)).rejects.toThrow();
    await expect(finishLearningQuiz('u1', secret, submission, 136_000)).rejects.toThrow();
    const score = await finishLearningQuiz('u1', secret, submission, 1001);
    expect(score).toMatchObject({ total: 2, skipped: 2 });
    const practice = await startLearningQuiz('u1', secret, { courseId, mode: 'practice', count: 1 }, 1000);
    await expect(finishLearningQuiz('u1', secret, { token: practice.token, answers: {} }, 1001)).rejects.toThrow();
    const graded = await answerLearningQuiz('u1', secret,
      { token: practice.token, questionId: practice.questions[0].id, selected: null }, 1001);
    expect(graded).toMatchObject({ status: 'skipped', optionReasons: expect.any(Array) });
  });
});
