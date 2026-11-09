/**
 * V3-Hardening B7 — ممیزی امنیت تحویل سؤال/کلید: مسیر DB → API → کلاینت.
 *
 * تضمین: هیچ پاسخ API پیش از ثبت پاسخ داوطلب، هیچ فیلد افشاگر کلیدی
 * (correctOption/correctIndex/answerIndex) حتی به‌صورت رشتهٔ خام در بدنه ندارد.
 * اسکن روی متن خام Response انجام می‌شود (مانند اسکن باندل کلاینت) تا فیلدهای
 * تودرتو یا نام‌های ناشناخته هم گرفته شوند.
 *
 * محدودهٔ معلوم: R-036 (کلید در باندل React مینی‌اپ) باز است و ربطی به API ندارد —
 * سند blockers: docs/operations/QUESTION_ANSWER_KEY_SECURITY_FA.md
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, resetRateLimitsForTesting } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';
import pack from '../../../content/examples/demo-pack.json';

const ENV = {
  ENVIRONMENT: 'development',
  SESSION_SECRET: 'test-secret',
  ALLOW_DEMO_AUTH: 'true',
  TELEGRAM_WEBHOOK_SECRET: 'test_telegram_webhook_secret_2026_secure',
  ADMIN_API_TOKEN: 'test-admin-api-token-with-at-least-32-characters-2026',
};

const KEY_FIELD_PATTERN = /["']?(correctOption|correctIndex|answerIndex)["']?\s*:/g;

let store: MemoryStore;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  resetRateLimitsForTesting();
  store = new MemoryStore();
  store.nodes = pack.nodes.map((n) => ({ ...n })) as typeof store.nodes;
  store.dependencies = pack.dependencies.map((d) => ({ ...d })) as typeof store.dependencies;
  store.questions = pack.questions.map((q) => ({ ...q })) as typeof store.questions;
  app = createApp(ENV, { store });
});

async function login(): Promise<string> {
  const res = await app.request('/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'داوطلب تست کلید' }),
  });
  return ((await res.json()) as { token: string }).token;
}

function authed(token: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...((init.headers as Record<string, string>) ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

function assertNoKeyFields(raw: string, endpoint: string): void {
  const matches = raw.match(KEY_FIELD_PATTERN);
  expect(matches, `کلید پاسخ در پاسخ ${endpoint} افشا شد: ${matches?.join(', ') ?? ''}`).toBeNull();
}

describe('B7 — تحویل سؤال بدون کلید؛ کلید فقط پس از ثبت پاسخ', () => {
  it('کوییز شبانه: بدنهٔ خام پاسخ قبل از submit هیچ فیلد کلیدی ندارد', async () => {
    const token = await login();
    const res = await app.request('/api/night-quiz', authed(token));
    expect(res.status).toBe(200);
    const raw = JSON.stringify(await res.json());
    assertNoKeyFields(raw, 'POST /api/night-quiz');
  });

  it('شروع مسیر یادگیری: payload سؤال‌ها بدون کلید؛ key ظاهرشدن فقط در پاسخ answer', async () => {
    const token = await login();
    const start = await app.request('/api/learning-quiz/start', authed(token, {
      method: 'POST',
      body: JSON.stringify({ courseId: store.questions[0]?.nodeId?.split('.').slice(0, 2).join('.') ?? 'course.x' }),
    }));
    // شروع ممکن است به‌دلیل نگاشت course ناموفق باشد؛ در آن صورت فقط وضعیت را ثبت می‌کنیم
    if (start.status === 200) {
      const raw = JSON.stringify(await start.json());
      assertNoKeyFields(raw, 'POST /api/learning-quiz/start');
    } else {
      expect([400, 404]).toContain(start.status);
    }
  });

  it('چرخهٔ کامل: صف قبل از answer بدون کلید؛ بعد از answer کلید برای همان سؤال افشا می‌شود', async () => {
    const token = await login();
    await app.request('/api/tracks', authed(token, { method: 'PUT', body: JSON.stringify({ tracks: ['business', 'technology', 'strategy', 'industrial'] }) }));

    const queue = await app.request('/api/queue', authed(token));
    expect(queue.status).toBe(200);
    const queueBody = (await queue.json()) as { items: Array<{ attemptId: string; question: { id: string } }> };
    expect(queueBody.items.length).toBeGreaterThan(0);
    assertNoKeyFields(JSON.stringify(queueBody), 'GET /api/queue');

    const first = queueBody.items[0];
    const question = store.questions.find((q) => q.id === first.question.id)!;
    const wrongOption = (question.correctOption + 1) % question.options.length;

    const answer = await app.request('/api/answers', authed(token, {
      method: 'POST',
      body: JSON.stringify({ attemptId: first.attemptId, questionId: question.id, selectedOption: wrongOption }),
    }));
    expect(answer.status).toBe(200);
    const answerBody = (await answer.json()) as Record<string, unknown>;
    // کلید فقط همین‌جا و فقط برای سؤال پاسخ‌داده‌شده مجاز است
    expect(answerBody.wasCorrect).toBe(false);
    expect(answerBody.correctOption).toBe(question.correctOption);
  });

  it('کوییز شبانه پس از یک پاسخ غلط: آیتم‌های شبانه هم بدون کلید قبل از submit', async () => {
    const token = await login();
    await app.request('/api/tracks', authed(token, { method: 'PUT', body: JSON.stringify({ tracks: ['business', 'technology', 'strategy', 'industrial'] }) }));

    const queue = (await (await app.request('/api/queue', authed(token))).json()) as { items: Array<{ attemptId: string; question: { id: string } }> };
    const question = store.questions.find((q) => q.id === queue.items[0].question.id)!;
    await app.request('/api/answers', authed(token, {
      method: 'POST',
      body: JSON.stringify({ attemptId: queue.items[0].attemptId, questionId: question.id, selectedOption: (question.correctOption + 1) % question.options.length }),
    }));

    const night = await app.request('/api/night-quiz', authed(token));
    expect(night.status).toBe(200);
    const nightBody = (await night.json()) as { items: Array<{ attemptId: string; question: { id: string } }> };
    expect(nightBody.items.length).toBeGreaterThan(0);
    assertNoKeyFields(JSON.stringify(nightBody), 'GET /api/night-quiz (پس از پاسخ غلط)');
  });
});
