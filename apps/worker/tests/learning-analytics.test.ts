import { beforeEach, describe, expect, it } from 'vitest';
import type { AnswerEvent } from '../src/store.ts';
import { createApp, resetRateLimitsForTesting } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';
import pack from '../../../content/examples/demo-pack.json';

const ENV = {
  SESSION_SECRET: 'test-secret',
  ALLOW_DEMO_AUTH: 'true',
};

let store: MemoryStore;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  // شمارندهٔ مشترک سطح isolate: هر تست از صفر شروع کند
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
    body: JSON.stringify({ displayName: 'داوطلب تحلیل' }),
  });
  return ((await res.json()) as { token: string }).token;
}

async function userIdOf(token: string): Promise<string> {
  const res = await app.request('/api/me', { headers: { Authorization: `Bearer ${token}` } });
  return ((await res.json()) as { user: { id: string } }).user.id;
}

async function getAnalytics(token: string): Promise<{ res: Response; payload: any }> {
  const res = await app.request('/api/analytics/learning', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { res, payload: (await res.json()) as any };
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

describe('§8.10 — داشبورد تحلیلی: ۱۳ شاخص یادگیری واقعی', () => {
  it('بدون احراز هویت رد می‌شود', async () => {
    const res = await app.request('/api/analytics/learning');
    expect(res.status).toBe(401);
  });

  it('کاتالوگ دقیقاً ۱۳ شاخص دارد و شاخص‌های نمایشی (ورود/استریک/XP/سکه) حذف شده‌اند', async () => {
    const token = await login();
    const { res, payload } = await getAnalytics(token);
    expect(res.status).toBe(200);

    expect(payload.metricCatalog).toHaveLength(13);
    const metricKeys = Object.keys(payload.metrics);
    expect(metricKeys).toHaveLength(13);
    for (const entry of payload.metricCatalog) {
      expect(metricKeys).toContain(entry.key);
      expect(entry.definition.length).toBeGreaterThan(10);
      expect(entry.source.length).toBeGreaterThan(3);
    }
    expect(payload.excludedVanityMetrics).toEqual([
      'login_count',
      'streak_days',
      'xp',
      'coins',
      'session_count',
    ]);
    const keys = collectKeys(payload);
    for (const vanity of payload.excludedVanityMetrics) {
      expect(keys.has(vanity)).toBe(false);
    }
    expect(keys.has('streakDays')).toBe(false);
    expect(keys.has('coins')).toBe(false);
  });

  it('بدون شاهد، نرخ‌ها null می‌مانند و صفر/۵۰ ساختگی گزارش نمی‌شود', async () => {
    const token = await login();
    const { res, payload } = await getAnalytics(token);
    expect(res.status).toBe(200);
    const m = payload.metrics;

    // ۷ گره مشترک دارای سؤال غیرقرنطینه (۱۴۰۴ حذف شده)
    expect(m.assessableNodeCount).toBe(7);
    expect(m.assessedNodeCount).toBe(0);
    expect(m.diagnosticCoverageRatio).toBe(0);
    expect(m.masteryDistribution).toEqual({ weak: 0, unstable: 0, learning: 0, mastered: 0 });
    expect(m.meanMasteryAssessed).toBeNull();
    expect(m.medianMasteryAssessed).toBeNull();
    expect(m.recentAccuracy30d).toBeNull();
    expect(m.recentEvidenceCount30d).toBe(0);
    expect(m.dueReviewCount).toBe(0);
    expect(m.meanRetrievability).toBeNull();
    expect(m.errorTypeDistribution.unknown).toBe(0);
    expect(m.errorTypeDistribution.none).toBe(0);
    expect(m.errorTypeDistribution.misconception).toBe(0);
    expect(m.proofCoverage.provenOrMasteredSkills).toBe(0);
    expect(m.proofCoverage.ratio).toBe(0);
    expect(m.learningVelocity7d.masteryDelta).toBe(0);
    expect(m.learningVelocity7d.changedNodeCount).toBe(0);
  });

  it('شاخص‌ها از شواهد واقعی محاسبه می‌شوند (تسلط، دقت، مرور، بازیابی، خطا، سرعت)', async () => {
    const token = await login();
    const userId = await userIdOf(token);
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 86_400_000).toISOString();
    const yesterday = new Date(now.getTime() - 86_400_000).toISOString();

    store.mastery.set(`${userId}:mb.structure`, {
      nodeId: 'mb.structure',
      mastery: 35,
      status: 'weak',
    });
    store.masteryHistory.push({
      userId,
      nodeId: 'mb.structure',
      previousScore: null,
      newScore: 35,
      changeReason: 'backfill',
      recordedAt: now.toISOString(),
    });
    store.mastery.set(`${userId}:sm.rbv`, {
      nodeId: 'sm.rbv',
      mastery: 70,
      status: 'learning',
    });
    store.masteryHistory.push(
      {
        userId,
        nodeId: 'sm.rbv',
        previousScore: null,
        newScore: 50,
        changeReason: 'backfill',
        recordedAt: new Date(now.getTime() - 3_600_000).toISOString(),
      },
      {
        userId,
        nodeId: 'sm.rbv',
        previousScore: 50,
        newScore: 70,
        changeReason: 'answer_submit',
        recordedAt: now.toISOString(),
      },
    );

    const answer = (id: string, questionId: string, correct: boolean, ageDays = 0): AnswerEvent => ({
      id,
      userId,
      questionId,
      selectedOption: 0,
      isCorrect: correct,
      attemptId: `att-${id}`,
      answeredAt: new Date(now.getTime() - ageDays * 86_400_000).toISOString(),
      rippleReport: null,
    });
    store.answers.push(
      answer('a1', 'demo-q-001', true),
      answer('a2', 'demo-q-002', true),
      answer('a3', 'demo-q-003', false),
      answer('a4', 'demo-q-015', false, 25), // گرایش صنعتی غیرفعال — از شاخص‌ها خارج است
    );

    store.cards.set(`${userId}:card-visible`, {
      id: `${userId}:card-visible`,
      userId,
      nodeId: 'sm.rbv',
      cardType: 'question',
      questionId: 'demo-q-001',
      dueAt: yesterday,
      intervalDays: 10,
      ease: 2.5,
      isRepair: false,
      timesSeen: 3,
      timesCorrect: 2,
      fsrs: {
        stability: 10,
        difficulty: 5,
        retrievability: 0.9,
        reps: 3,
        lapses: 1,
        lastReviewedAt: tenDaysAgo,
        dueAt: yesterday,
        intervalDays: 10,
      },
    });
    store.cards.set(`${userId}:card-future`, {
      id: `${userId}:card-future`,
      userId,
      nodeId: 'mb.structure',
      cardType: 'question',
      questionId: 'demo-q-004',
      dueAt: new Date(now.getTime() + 5 * 86_400_000).toISOString(),
      intervalDays: 5,
      ease: 2.5,
      isRepair: false,
      timesSeen: 1,
      timesCorrect: 1,
    });

    store.skillStates.set(`${userId}:sm.rbv`, {
      skillId: 'sm.rbv',
      proficiencyProbability: 0.6,
      confidence: 0.5,
      evidenceCount: 2,
      memoryRetrievability: 0.8,
      fluencySpeedRatio: 1.1,
      dominantErrorType: 'misconception',
      coverageStatus: 'proven',
      userId,
    });
    store.skillStates.set(`${userId}:mb.contingency`, {
      skillId: 'mb.contingency',
      proficiencyProbability: 0.4,
      confidence: 0.2,
      evidenceCount: 0,
      memoryRetrievability: 0.7,
      fluencySpeedRatio: 1.0,
      dominantErrorType: 'unknown',
      coverageStatus: 'diagnosed',
      userId,
    });

    const { res, payload } = await getAnalytics(token);
    expect(res.status).toBe(200);
    const m = payload.metrics;

    expect(m.assessableNodeCount).toBe(7);
    expect(m.assessedNodeCount).toBe(2);
    expect(m.diagnosticCoverageRatio).toBe(0.286);
    expect(m.masteryDistribution).toEqual({ weak: 1, unstable: 0, learning: 1, mastered: 0 });
    expect(m.meanMasteryAssessed).toBe(52.5);
    expect(m.medianMasteryAssessed).toBe(52.5);
    expect(m.recentEvidenceCount30d).toBe(3);
    expect(m.recentAccuracy30d).toBe(0.667);
    expect(m.dueReviewCount).toBe(1);
    expect(m.meanRetrievability).toBe(0.9);
    expect(m.errorTypeDistribution.misconception).toBe(1);
    expect(m.errorTypeDistribution.unknown).toBe(1);
    expect(m.errorTypeDistribution.slip).toBe(0);
    expect(m.proofCoverage.provenOrMasteredSkills).toBe(1);
    expect(m.proofCoverage.totalSkills).toBeGreaterThan(0);
    expect(m.proofCoverage.ratio).toBeGreaterThan(0);
    expect(m.learningVelocity7d.masteryDelta).toBe(20);
    expect(m.learningVelocity7d.changedNodeCount).toBe(1);
    expect(m.learningVelocity7d.historyRowCount).toBe(3);
    expect(m.learningVelocity7d.transitionRowCount).toBe(1);
  });

  it('پاسخ قرنطینه‌شدهٔ ۱۴۰۴ در پوشش و دقت شمرده نمی‌شود', async () => {
    const token = await login();
    const userId = await userIdOf(token);
    store.answers.push({
      id: 'q1404',
      userId,
      questionId: 'demo-q-018',
      selectedOption: 0,
      isCorrect: true,
      attemptId: 'att-q1404',
      answeredAt: new Date().toISOString(),
      rippleReport: null,
    });
    const { payload } = await getAnalytics(token);
    expect(payload.metrics.recentEvidenceCount30d).toBe(0);
    expect(payload.metrics.recentAccuracy30d).toBeNull();
  });
});
