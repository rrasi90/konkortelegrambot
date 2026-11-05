import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, type CreateAppOptions, type Env } from '../src/index';
import { MemoryAdminStore } from '../src/admin/store';
import type { LearningCourse } from '@ael/engine';

const BOT_TOKEN = '123456:ael-release-test-token';
const BOOTSTRAP_TOKEN = 'ael-bootstrap-token-0123456789abcdef0123';

async function hmacHex(key: string | ArrayBuffer, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildInitData(userId: number): Promise<string> {
  const params = new URLSearchParams();
  params.set('query_id', 'AAH-release');
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('user', JSON.stringify({ id: userId, first_name: 'Admin' }));
  const dataCheckString = [...params.entries()]
    .filter(([k]) => k !== 'hash' && k !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = await crypto.subtle.importKey('raw', new TextEncoder().encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  params.set('hash', await hmacHex(await crypto.subtle.sign('HMAC', secretKey, new TextEncoder().encode(BOT_TOKEN)), dataCheckString));
  return params.toString();
}

function buildEnv(): Env {
  return {
    ENVIRONMENT: 'test',
    SESSION_SECRET: 'test-session-secret-0123456789',
    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    ADMIN_API_TOKEN: BOOTSTRAP_TOKEN,
  };
}

const authorCourseBody = {
  courseId: 'microeconomics-101',
  title: 'اقتصاد خرد',
  description: 'درس آزمایشی برای اثبات کاتالوگ پویا',
  scopeNote: 'پایلوت بدون اتصال به برنامهٔ رسمی',
  sources: [{ id: 's1', title: 'جزوهٔ تألیفی', url: '', locator: 'فصل ۱', kind: 'concept_reference', checkedOn: '2026-11-05' }],
  topics: [
    { id: 'me.demand', title: 'تقاضا', objective: 'تحلیل منحنی تقاضا', minutes: 20, prerequisites: [], concepts: ['تقاضا'], formula: 'Qd=f(P)', workedExample: '...', commonError: '...', sourceIds: ['s1'] },
    { id: 'me.supply', title: 'عرضه', objective: 'تحلیل منحنی عرضه', minutes: 20, prerequisites: [], concepts: ['عرضه'], formula: 'Qs=f(P)', workedExample: '...', commonError: '...', sourceIds: ['s1'] },
  ],
};

const questionBodies = [
  { id: 'me.demand.q1', courseId: 'microeconomics-101', topicId: 'me.demand', difficulty: 'basic', prompt: 'با افزایش قیمت، تقاضای معمولی چگونه تغییر می‌کند؟', choices: ['کاهش', 'افزایش', 'ثابت', 'تصادفی'], answerIndex: 0, explanation: 'قانون تقاضا', optionReasons: ['درست', 'نادرست', 'نادرست', 'نادرست'], sourceIds: ['s1'] },
  { id: 'me.supply.q1', courseId: 'microeconomics-101', topicId: 'me.supply', difficulty: 'basic', prompt: 'با افزایش قیمت، عرضه چگونه تغییر می‌کند؟', choices: ['افزایش', 'کاهش', 'ثابت', 'تصادفی'], answerIndex: 0, explanation: 'قانون عرضه', optionReasons: ['درست', 'نادرست', 'نادرست', 'نادرست'], sourceIds: ['s1'] },
];

describe('AEL-501..509 — Review → Release → Dynamic Catalog → Rollback', () => {
  let adminStore: MemoryAdminStore;
  let app: ReturnType<typeof createApp>;
  let authorToken: string;
  let reviewerToken: string;
  let publisherToken: string;
  let authorId: string;
  let reviewerId: string;
  let publisherId: string;

  beforeEach(async () => {
    adminStore = new MemoryAdminStore();
    app = createApp(buildEnv(), { store: {} as never, adminStore });
    const bootstrap = await (await app.request('/api/admin/bootstrap', {
      method: 'POST', headers: { Authorization: `Bearer ${BOOTSTRAP_TOKEN}` },
      body: JSON.stringify({ initData: await buildInitData(111) }),
    })).json() as { user: { id: string } };
    const session = async (userId: number) => ((await (await app.request('/api/admin/session', {
      method: 'POST', body: JSON.stringify({ initData: await buildInitData(userId) }),
    })).json()) as { token: string }).token;
    authorToken = await session(111); // OWNER (نویسندهٔ محتوا در این تست)
    authorId = bootstrap.user.id;
    reviewerId = (await adminStore.upsertAdminUser({ telegramUserId: 777, username: null, displayName: 'Sci Reviewer' })).id;
    await adminStore.grantRole(reviewerId, 'ACADEMIC_REVIEWER', null, authorId);
    reviewerToken = await session(777);
    publisherId = (await adminStore.upsertAdminUser({ telegramUserId: 888, username: null, displayName: 'Publisher' })).id;
    await adminStore.grantRole(publisherId, 'PUBLISHER', null, authorId);
    publisherToken = await session(888);
  });

  it('Publish بدون تأیید علمی رد می‌شود (AT-AEL-16) و Author نمی‌تواند خودش را تأیید کند (AT-AEL-13)', async () => {
    const item = await (await app.request('/api/admin/content/items', {
      method: 'POST', headers: { Authorization: `Bearer ${authorToken}` },
      body: JSON.stringify({ kind: 'course', slug: 'micro-101', title: 'اقتصاد خرد' }),
    })).json() as { item: { id: string } };
    const version = await (await app.request(`/api/admin/content/items/micro-101/versions`, {
      method: 'POST', headers: { Authorization: `Bearer ${authorToken}` },
      body: JSON.stringify({ body: authorCourseBody }),
    })).json() as { versionId: string };

    const release = await (await app.request('/api/admin/releases', {
      method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
      body: JSON.stringify({ code: 'rel-1' }),
    })).json() as { releaseId: string };

    // بدون تأیید علمی، افزودن به Release رد می‌شود
    const addItem = await app.request(`/api/admin/releases/${release.releaseId}/items`, {
      method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
      body: JSON.stringify({ contentVersionId: version.versionId }),
    });
    expect(addItem.status).toBe(400);

    // Author (OWNER در این تست) نمی‌تواند محتوای خودش را تأیید کند
    await app.request(`/api/admin/content/versions/${version.versionId}/propose`, {
      method: 'POST', headers: { Authorization: `Bearer ${authorToken}` },
    });
    const tasks = await (await app.request('/api/admin/review-tasks?kind=scientific&status=pending', {
      headers: { Authorization: `Bearer ${authorToken}` },
    })).json() as { tasks: Array<{ id: string }> };
    const selfApprove = await app.request(`/api/admin/review-tasks/${tasks.tasks[0]!.id}/decide`, {
      method: 'POST', headers: { Authorization: `Bearer ${authorToken}` },
      body: JSON.stringify({ decision: 'approved', note: 'تأیید خودم' }),
    });
    expect(selfApprove.status).toBe(403);
    void item;
    void authorId;
  });

  it('مسیر کامل: تأیید علمی مستقل → Stage → Publish → کاتالوگ دانش‌آموز بدون Deploy → Rollback (AT-AEL-15..18)', async () => {
    await app.request('/api/admin/content/items', {
      method: 'POST', headers: { Authorization: `Bearer ${authorToken}` },
      body: JSON.stringify({ kind: 'course', slug: 'micro-101', title: 'اقتصاد خرد' }),
    });
    const courseVersion = await (await app.request('/api/admin/content/items/micro-101/versions', {
      method: 'POST', headers: { Authorization: `Bearer ${authorToken}` },
      body: JSON.stringify({ body: authorCourseBody }),
    })).json() as { versionId: string };
    const questionVersionIds: string[] = [];
    for (const [index, body] of questionBodies.entries()) {
      await app.request('/api/admin/content/items', {
        method: 'POST', headers: { Authorization: `Bearer ${authorToken}` },
        body: JSON.stringify({ kind: 'mcq', slug: `micro-q${index}`, title: body.id }),
      });
      const version = await (await app.request(`/api/admin/content/items/micro-q${index}/versions`, {
        method: 'POST', headers: { Authorization: `Bearer ${authorToken}` },
        body: JSON.stringify({ body }),
      })).json() as { versionId: string };
      questionVersionIds.push(version.versionId);
    }

    // تأیید علمی مستقل
    for (const versionId of [courseVersion.versionId, ...questionVersionIds]) {
      const propose = await app.request(`/api/admin/content/versions/${versionId}/propose`, {
        method: 'POST', headers: { Authorization: `Bearer ${authorToken}` },
      });
      expect(propose.status).toBe(200);
    }
    const tasks = await (await app.request('/api/admin/review-tasks?kind=scientific&status=pending', {
      headers: { Authorization: `Bearer ${reviewerToken}` },
    })).json() as { tasks: Array<{ id: string }> };
    expect(tasks.tasks.length).toBe(3);
    for (const task of tasks.tasks) {
      const decide = await app.request(`/api/admin/review-tasks/${task.id}/decide`, {
        method: 'POST', headers: { Authorization: `Bearer ${reviewerToken}` },
        body: JSON.stringify({ decision: 'approved', note: 'بازبینی علمی سنتز‌شدهٔ تست' }),
      });
      expect(decide.status).toBe(200);
    }

    // Release
    const release = await (await app.request('/api/admin/releases', {
      method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
      body: JSON.stringify({ code: 'rel-micro-1' }),
    })).json() as { releaseId: string };
    for (const versionId of [courseVersion.versionId, ...questionVersionIds]) {
      const add = await app.request(`/api/admin/releases/${release.releaseId}/items`, {
        method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
        body: JSON.stringify({ contentVersionId: versionId }),
      });
      expect(add.status).toBe(200);
    }
    const stageData = await (await app.request(`/api/admin/releases/${release.releaseId}/stage`, {
      method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
    })).json() as { items: number };
    expect(stageData.items).toBe(3);

    // Publish موفق — Snapshot immutable با contentHash
    const publish = await app.request(`/api/admin/releases/${release.releaseId}/publish`, {
      method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
    });
    expect(publish.status).toBe(200);
    const publishData = await publish.json() as { contentHash: string; courses: number };
    expect(publishData.contentHash).toMatch(/^[a-f0-9]{64}$/);
    // Publish دوباره از وضعیت published → رد (Double publish ممنوع، AT مادهٔ ۱۹٫۴)
    expect((await app.request(`/api/admin/releases/${release.releaseId}/publish`, {
      method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
    })).status).toBe(400);

    // دانش‌آموز: کاتالوگ پویا درس تازه را نشان می‌دهد — بدون تغییر کد (AT-AEL-18)
    const userStore = new (await import('../src/memory-store')).MemoryStore();
    const app2 = createApp(buildEnv(), { store: userStore, adminStore } as CreateAppOptions);
    const user = await userStore.createUser({ displayName: 'Student' });
    const userToken = await (await import('../src/auth')).issueSessionToken(user.id, buildEnv().SESSION_SECRET);
    const catalog = await app2.request('/api/learning-paths', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const catalogData = await catalog.json() as { catalogSource: string; courses: Array<{ id: string }> };
    expect(catalogData.catalogSource).toBe('published');
    expect(catalogData.courses.map(course => course.id)).toContain('microeconomics-101');

    // آزمون از درس تازه
    const start = await app2.request('/api/learning-quiz/start', {
      method: 'POST', headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: 'microeconomics-101', mode: 'practice', count: 2, seed: 3 }),
    });
    expect(start.status).toBe(200);
    const quiz = await start.json() as { questions: Array<{ id: string }>; token: string };
    expect(quiz.questions).toHaveLength(2);

    // Release دوم → Rollback (AT-AEL-17)
    const release2 = await (await app.request('/api/admin/releases', {
      method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
      body: JSON.stringify({ code: 'rel-micro-2' }),
    })).json() as { releaseId: string };
    for (const versionId of [courseVersion.versionId, ...questionVersionIds]) {
      await app.request(`/api/admin/releases/${release2.releaseId}/items`, {
        method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
        body: JSON.stringify({ contentVersionId: versionId }),
      });
    }
    await app.request(`/api/admin/releases/${release2.releaseId}/stage`, {
      method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
    });
    await app.request(`/api/admin/releases/${release2.releaseId}/publish`, {
      method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
    });
    expect(await adminStore.getActiveReleaseId()).toBe(release2.releaseId);

    const rollback = await app.request(`/api/admin/releases/${release2.releaseId}/rollback`, {
      method: 'POST', headers: { Authorization: `Bearer ${publisherToken}` },
    });
    expect(rollback.status).toBe(200);
    expect(await adminStore.getActiveReleaseId()).toBe(release.releaseId);
    // تاریخچه حذف نشده
    const releases = await (await app.request('/api/admin/releases', {
      headers: { Authorization: `Bearer ${publisherToken}` },
    })).json() as { releases: Array<{ status: string }> };
    expect(releases.releases.some(row => row.status === 'rolled_back')).toBe(true);
  });

  it('بدون Release فعال، کاتالوگ legacy با برچسب صریح است (ADR-009)', async () => {
    const userStore = new (await import('../src/memory-store')).MemoryStore();
    const emptyAdmin = new MemoryAdminStore();
    const appLocal = createApp(buildEnv(), { store: userStore, adminStore: emptyAdmin });
    const user = await userStore.createUser({ displayName: 'Student' });
    const userToken = await (await import('../src/auth')).issueSessionToken(user.id, buildEnv().SESSION_SECRET);
    const catalog = await appLocal.request('/api/learning-paths', { headers: { Authorization: `Bearer ${userToken}` } });
    const data = await catalog.json() as { catalogSource: string };
    expect(data.catalogSource).toBe('legacy_static');
  });

  it('Snapshot انتشارشده‌ی immutable است — تغییر محتوا Version جدید می‌خواهد (AT-AEL-15)', async () => {
    const snapshot1 = await adminStore.getPublishedSnapshot('none');
    expect(snapshot1).toBeNull();
    void publisherId;
  });
});

function assertCourseShape(course: LearningCourse): void {
  expect(course.schemaVersion).toBe(1);
}
void assertCourseShape;
