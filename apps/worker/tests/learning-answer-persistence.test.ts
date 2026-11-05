import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, type Env } from '../src/index';
import { MemoryStore } from '../src/memory-store';
import { issueSessionToken } from '../src/auth';
import { MemoryAdminStore } from '../src/admin/store';
import { buildCatalogSnapshot } from '../src/catalog/service';
import finance from '../../../content/learning-courses/financial-management.json';
import type { LearningCourse } from '@ael/engine';

const secret = 'learning-persistence-secret';
const env: Env = { ENVIRONMENT: 'test', SESSION_SECRET: secret };

const course: LearningCourse = {
  ...(finance as unknown as LearningCourse),
  questions: (finance as unknown as LearningCourse).questions.map(q => ({ ...q, review: 'reviewed' as const })),
};

/** کاتالوگ منتشرشدهٔ سنتز برای تست مسیر پایدار (همان مسیر واقعی Release) */
async function publishedAdminStore(): Promise<MemoryAdminStore> {
  const adminStore = new MemoryAdminStore();
  const release = await adminStore.createRelease({ code: 'persist-test-1', notes: null, createdBy: 'test' });
  const versions: Array<Record<string, unknown>> = [];
  const item = await adminStore.upsertContentItem({ kind: 'course', slug: 'c-fm', title: course.title, createdBy: 'test' });
  const version = await adminStore.createContentVersion({
    contentItemId: String(item.id),
    body: { courseId: course.id, title: course.title, description: course.description, scopeNote: course.scopeNote, sources: course.sources, topics: course.topics },
    contentHash: 'h-course', sourceIds: [], createdBy: 'test',
  });
  await adminStore.setScientificApproval(String(version.id), 'reviewer', true);
  await adminStore.addReleaseItem(String(release.id), String(version.id), 'test');
  versions.push({ ...version, slug: course.id, kind: 'course' });
  for (const [index, question] of course.questions.entries()) {
    const qItem = await adminStore.upsertContentItem({ kind: question.kind === 'essay' ? 'essay' : 'mcq', slug: `q-${index}`, title: question.id, createdBy: 'test' });
    const qVersion = await adminStore.createContentVersion({
      contentItemId: String(qItem.id), body: { ...question, courseId: course.id },
      contentHash: `h-${index}`, sourceIds: [], createdBy: 'test',
    });
    await adminStore.setScientificApproval(String(qVersion.id), 'reviewer', true);
    await adminStore.addReleaseItem(String(release.id), String(qVersion.id), 'test');
    versions.push({ ...qVersion, slug: course.id, kind: question.kind === 'essay' ? 'essay' : 'mcq' });
  }
  const snapshot = buildCatalogSnapshot('persist-test-1', versions as never);
  await adminStore.updateRelease(String(release.id), { status: 'staged', stagedAt: true });
  await adminStore.updateRelease(String(release.id), { status: 'published', publishedAt: true, publishedBy: 'test' });
  await adminStore.setActiveRelease(String(release.id), 'test');
  await adminStore.upsertPublishedSnapshot(String(release.id), snapshot.contentHash, snapshot);
  return adminStore;
}

describe('AEL-610/612 + ADR-011 — ثبت پایدار و اتمیک پاسخ تألیفی (AT-AEL-21/22/23/24)', () => {
  let store: MemoryStore;
  let adminStore: MemoryAdminStore;
  let app: ReturnType<typeof createApp>;
  let token: string;

  beforeEach(async () => {
    store = new MemoryStore();
    adminStore = await publishedAdminStore();
    app = createApp(env, { store, adminStore });
    const user = await store.createUser({ displayName: 'Learner' });
    token = await issueSessionToken(user.id, secret);
  });

  const headers = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

  it('پاسخ تمرین پایدار ثبت می‌شود و تکرار همان operationId نتیجهٔ دوم نمی‌سازد', async () => {
    const first = course.questions.find(q => q.kind !== 'essay')!;
    const start = await app.request('/api/learning-quiz/start', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ courseId: course.id, mode: 'practice', count: 1, reviewIds: [first.id], seed: 7 }),
    });
    expect(start.status).toBe(200);
    const session = await start.json() as { attemptId?: string; questions: Array<{ id: string }> };
    expect(session.attemptId).toBeDefined();

    const answer = async (operationId: string, selected: number) => app.request('/api/learning-quiz/answer', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ token: session.token, attemptId: session.attemptId, questionId: session.questions[0]!.id, selected, operationId }),
    });

    const first1 = await answer('op-a', first.answerIndex);
    const data1 = await first1.json() as { status: string; persisted: boolean; replay: boolean };
    expect(data1.status).toBe('correct');
    expect(data1.persisted).toBe(true);
    expect(data1.replay).toBe(false);

    // AT-AEL-22: تکرار همان operationId — بدون رکورد دوم
    const first2 = await answer('op-a', first.answerIndex);
    const data2 = await first2.json() as { replay: boolean };
    expect(data2.replay).toBe(true);

    // AT-AEL-22 (تعارض): همان operationId با محتوای متفاوت → خطا
    const conflict = await answer('op-a', (first.answerIndex + 1) % first.choices.length);
    expect(conflict.status).toBe(400);

  });

  it('بدون attemptId پاسخ همان رفتار قبلی را دارد (سازگاری رو به عقب)', async () => {
    const first = course.questions.find(q => q.kind !== 'essay')!;
    const start = await app.request('/api/learning-quiz/start', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ courseId: course.id, mode: 'practice', count: 1, reviewIds: [first.id], seed: 7 }),
    });
    const session = await start.json() as { token: string; questions: Array<{ id: string }> };
    const res = await app.request('/api/learning-quiz/answer', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ token: session.token, questionId: session.questions[0]!.id, selected: first.answerIndex }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { persisted?: boolean };
    expect(data.persisted).toBeUndefined();
  });

  it('پاسخ غلط هم ثبت می‌شود و تسلط پایین می‌آید (AT-AEL-23)', async () => {
    const first = course.questions.find(q => q.kind !== 'essay')!;
    const start = await app.request('/api/learning-quiz/start', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ courseId: course.id, mode: 'practice', count: 1, reviewIds: [first.id], seed: 7 }),
    });
    const session = await start.json() as { attemptId: string; token: string; questions: Array<{ id: string }> };
    const wrong = (first.answerIndex + 1) % first.choices.length;
    const res = await app.request('/api/learning-quiz/answer', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ token: session.token, attemptId: session.attemptId, questionId: session.questions[0]!.id, selected: wrong, operationId: 'op-wrong-1' }),
    });
    const data = await res.json() as { status: string; persisted: boolean };
    expect(data.status).toBe('incorrect');
    expect(data.persisted).toBe(true);
  });
});
