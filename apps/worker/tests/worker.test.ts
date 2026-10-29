import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';
import pack from '../../../content/examples/demo-pack.json';

const ENV = { SESSION_SECRET: 'test-secret', ALLOW_DEMO_AUTH: 'true' };
let store: MemoryStore;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = new MemoryStore();
  store.nodes = pack.nodes.map((n) => ({ ...n }));
  store.dependencies = pack.dependencies.map((d) => ({ ...d }));
  store.questions = pack.questions.map((q) => ({ ...q }));
  app = createApp(ENV, { store });
});

async function login(): Promise<string> {
  const res = await app.request('/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'داوطلب تست' }),
  });
  expect(res.status).toBe(200);
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
async function json(res: Response): Promise<any> { return res.json(); }

async function getQueuedItem(token: string, predicate: (item: any) => boolean = () => true) {
  const response = await app.request('/api/queue?limit=20', authed(token));
  expect(response.status).toBe(200);
  const data = await json(response);
  const item = data.items.find(predicate);
  expect(item).toBeTruthy();
  expect(item.attemptId).toBeTruthy();
  expect(item.question.correctOption).toBe(-1);
  return item;
}

async function answer(token: string, item: any, selectedOption: number, extra: Record<string, unknown> = {}) {
  return app.request('/api/answers', authed(token, {
    method: 'POST',
    body: JSON.stringify({
      attemptId: item.attemptId,
      questionId: item.question.id,
      selectedOption,
      ...extra,
    }),
  }));
}

describe('worker API — secure adaptive learning loop', () => {
  it('health is available only when the environment is configured', async () => {
    const healthy = await app.request('/api/health');
    expect(healthy.status).toBe(200);
    expect((await json(healthy)).ok).toBe(true);

    const misconfigured = createApp({ ALLOW_DEMO_AUTH: 'false' });
    const unavailable = await misconfigured.request('/api/health');
    expect(unavailable.status).toBe(503);
    expect((await json(unavailable)).ok).toBe(false);
  });

  it('demo sign-in, issued queue attempt, wrong response and idempotent replay', async () => {
    const token = await login();
    await app.request('/api/tracks', authed(token, {
      method: 'PUT', body: JSON.stringify({ tracks: ['technology'] }),
    }));
    const item = await getQueuedItem(token, (x) => x.card.nodeId === 'sm.value_chain');
    const question = store.questions.find((q) => q.id === item.question.id)!;
    const wrongOption = (question.correctOption + 1) % question.options.length;

    const response = await answer(token, item, wrongOption, { responseTimeMs: 3250, studyMode: 'desk' });
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.report.wasCorrect).toBe(false);
    expect(body.report.evidenceOnly).toBe(true);
    expect(body.report.diagnosticRequired).toBe(true);
    expect(body.report.nextAction).toBe('diagnostic_probe');
    expect(body.report.masteryDeltas).toEqual([]);
    expect(body.report.crossCourseBridges).toEqual([]);

    const replayResponse = await answer(token, item, wrongOption);
    expect(replayResponse.status).toBe(200);
    expect((await json(replayResponse)).replay).toBe(true);

    const map = await json(await app.request('/api/map', authed(token)));
    const allNodes = map.courses.flatMap((c: any) => c.chapters.flatMap((ch: any) => ch.nodes));
    expect(allNodes.find((n: any) => n.id === 'sm.value_chain')?.mastery).toBe(50);
    expect(allNodes.find((n: any) => n.id === 'tech.absorptive')?.mastery).toBe(50);
    expect(allNodes.find((n: any) => n.id === 'mkt.brand') ).toBeUndefined();
  });

  it('accepts a first correct unseen response and updates only its own mastery', async () => {
    const token = await login();
    const item = await getQueuedItem(token);
    const source = store.questions.find((q) => q.id === item.question.id)!;
    const response = await answer(token, item, source.correctOption);
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.report.wasCorrect).toBe(true);
    const map = await json(await app.request('/api/map', authed(token)));
    const allNodes = map.courses.flatMap((c: any) => c.chapters.flatMap((ch: any) => ch.nodes));
    expect(allNodes.find((n: any) => n.id === item.card.nodeId)?.mastery).toBe(57.5);
  });

  it('rejects unissued attempts instead of grading arbitrary question ids', async () => {
    const token = await login();
    const question = store.questions[0];
    const response = await app.request('/api/answers', authed(token, {
      method: 'POST',
      body: JSON.stringify({ attemptId: 'unissued-attempt', questionId: question.id, selectedOption: question.correctOption }),
    }));
    expect(response.status).not.toBe(200);
    expect(store.answers).toHaveLength(0);
  });

  it('rejects fractional options and attempts with the wrong question', async () => {
    const token = await login();
    const item = await getQueuedItem(token);
    const source = store.questions.find((q) => q.id === item.question.id)!;

    const fractional = await answer(token, item, 0.5);
    expect(fractional.status).toBe(400);

    const mismatch = await app.request('/api/answers', authed(token, {
      method: 'POST',
      body: JSON.stringify({ attemptId: item.attemptId, questionId: 'nonexistent', selectedOption: source.correctOption }),
    }));
    expect(mismatch.status).toBe(404);
    expect(store.answers).toHaveLength(0);
  });

  it('keeps trap-card review separate from graded answers and mastery', async () => {
    const token = await login();
    const item = await getQueuedItem(token, (x) => !!x.question.trapNote);
    const source = store.questions.find((q) => q.id === item.question.id)!;
    const wrong = (source.correctOption + 1) % source.options.length;
    const wrongResponse = await answer(token, item, wrong);
    expect(wrongResponse.status).toBe(200);

    const trap = [...store.cards.values()].find((c) => c.userId && c.cardType === 'trap_note');
    expect(trap).toBeTruthy();
    trap!.dueAt = new Date(Date.now() - 60_000).toISOString();
    await store.upsertCards([trap!]);

    const trapQueue = await json(await app.request('/api/queue?limit=20', authed(token)));
    const trapItem = trapQueue.items.find((x: any) => x.card.cardType === 'trap_note');
    expect(trapItem).toBeTruthy();
    const answersBefore = store.answers.length;
    const seen = await app.request('/api/trap-cards/seen', authed(token, {
      method: 'POST', body: JSON.stringify({ cardId: trapItem.card.id }),
    }));
    expect(seen.status).toBe(200);
    expect(store.answers).toHaveLength(answersBefore);
  });

  it('unauthenticated requests are denied and demo auth can be disabled', async () => {
    for (const path of ['/api/queue', '/api/map']) {
      expect((await app.request(path)).status).toBe(401);
    }

    const disabled = createApp(ENV, { store });
    const forbidden = await disabled.request('/api/auth/demo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    expect(forbidden.status).toBe(403);
  });

  it('night quiz clears a question after its latest attempt is correct', async () => {
    const token = await login();
    const first = await getQueuedItem(token);
    const source = store.questions.find((q) => q.id === first.question.id)!;
    await answer(token, first, (source.correctOption + 1) % source.options.length);
    const night = await json(await app.request('/api/night-quiz', authed(token)));
    expect(night.items).toHaveLength(1);
    expect(night.items[0].attemptId).toBeTruthy();

    const correctResponse = await answer(token, night.items[0], source.correctOption);
    expect(correctResponse.status).toBe(200);
    const cleared = await json(await app.request('/api/night-quiz', authed(token)));
    expect(cleared.items).toHaveLength(0);
  });

  it('home shows observed evidence rather than assigning 50% to unseen skills', async () => {
    const token = await login();
    const home = await json(await app.request('/api/home', authed(token)));
    expect(home.progress.nodes).toBeGreaterThan(0);
    expect(home.progress.observedNodes).toBe(0);
    expect(home.progress.overall).toBe(0);
    expect(home.progress.isEvidenceBased).toBe(true);
    expect(home.nightQuiz.available).toBe(false);
  });

  it('exam-date settings validate format and update countdown', async () => {
    const token = await login();
    const bad = await app.request('/api/settings', authed(token, {
      method: 'PUT', body: JSON.stringify({ examDate: 'دیروز' }),
    }));
    expect(bad.status).toBe(400);

    const future = new Date(Date.now() + 78 * 86_400_000).toISOString().slice(0, 10);
    const response = await app.request('/api/settings', authed(token, {
      method: 'PUT', body: JSON.stringify({ examDate: future }),
    }));
    expect(response.status).toBe(200);
    expect((await json(response)).examDate).toBe(future);
  });
});
