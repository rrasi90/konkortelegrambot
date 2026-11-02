import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearTelegramZeroStateStorage,
  loadLatestStateFromTelegramStorage,
  saveStateToTelegramStorage,
  type PersistedLearnerPayload,
} from '../utils/telegramBridge';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

let local: MemoryStorage;
let cloud: Map<string, string>;
let failCloudKeys: Set<string>;

function installStorageMocks() {
  local = new MemoryStorage();
  cloud = new Map();
  failCloudKeys = new Set();

  const cloudApi = {
    setItem: (
      key: string,
      value: string,
      callback?: (error: Error | null, stored?: boolean) => void,
    ) => {
      if (failCloudKeys.has(key)) {
        callback?.(new Error('simulated CloudStorage failure'), false);
        return;
      }
      cloud.set(key, value);
      callback?.(null, true);
    },
    getItem: (key: string, callback: (error: Error | null, value?: string) => void) => {
      callback(null, cloud.get(key));
    },
    removeItem: (
      key: string,
      callback?: (error: Error | null, removed?: boolean) => void,
    ) => {
      cloud.delete(key);
      callback?.(null, true);
    },
  };

  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('window', {
    Telegram: {
      WebApp: {
        platform: 'tdesktop',
        CloudStorage: cloudApi,
      },
    },
  });
}

function payload(
  savedAt: string,
  questionText = 'سؤال نمونه',
): PersistedLearnerPayload {
  return {
    nodeStates: {
      'node.one': {
        nodeId: 'node.one',
        masteryScore: 63,
        proficiencyProbability: 0.63,
        memoryStability: 8,
        retrievability: 0.91,
        speedFluency: 70,
        coverageStatus: 'learning',
        evidenceCount: 4,
        isUnlockedInFrontier: true,
      },
    } as never,
    cards: [
      {
        id: 'card.one',
        userId: 'user.one',
        nodeId: 'node.one',
        cardType: 'question',
        questionId: 'question.one',
        dueAt: '2026-11-03T10:00:00.000Z',
        intervalDays: 1,
        ease: 2.5,
        isRepair: false,
        timesSeen: 4,
        timesCorrect: 3,
        questionText,
      },
    ] as never,
    stats: {
      isZeroStateNewUser: false,
      streakDays: 6,
      streakFreezeAvailable: true,
      streakFreezeUsedToday: false,
      xp: 420,
      coins: 18,
      totalAnswered: 20,
      correctCount: 14,
      wrongCount: 5,
      skippedCount: 1,
      lessonsRatedCount: 3,
      leechResolvedCount: 0,
      placementCompleted: true,
      activeTracks: ['common'],
      studyMode: 'desk',
      dailyStudyHours: 3,
      dailyTargetQuestions: 25,
      preferredCourseCategory: 'all',
      selectedMajorBranch: 'business',
      dailyQuests: [],
    } as never,
    savedAt,
  };
}

describe('Telegram CloudStorage full learner snapshots', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    installStorageMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recovers the complete snapshot across devices after local storage is empty', async () => {
    const original = payload('2026-11-02T10:00:00.000Z', 'سؤال طولانی '.repeat(900));
    const saved = await saveStateToTelegramStorage(original);

    expect(saved).toMatchObject({ localSaved: true, cloudSaved: true });
    expect(cloud.has('ael_tma_v4_manifest')).toBe(true);
    expect([...cloud.entries()]
      .filter(([key]) => key.startsWith('ael_tma_v4_') && key !== 'ael_tma_v4_manifest')
      .every(([, value]) => value.length <= 4096)).toBe(true);

    local.clear();
    const result = await loadLatestStateFromTelegramStorage(payload('1970-01-01T00:00:00.000Z'));

    expect(result.source).toBe('cloud_v4');
    expect(result.payload).toEqual(original);
  });

  it('does not replace the last committed cloud snapshot when a new chunk fails', async () => {
    const committed = payload('2026-11-02T10:00:00.000Z', 'نسخه سالم');
    expect((await saveStateToTelegramStorage(committed)).cloudSaved).toBe(true);

    failCloudKeys.add('ael_tma_v4_b_000');
    const failed = await saveStateToTelegramStorage(
      payload('2026-11-02T11:00:00.000Z', 'نسخه ناقص'),
    );
    expect(failed.cloudSaved).toBe(false);
    expect(failed.error).toContain('simulated CloudStorage failure');

    local.clear();
    const result = await loadLatestStateFromTelegramStorage(payload('1970-01-01T00:00:00.000Z'));
    expect(result.source).toBe('cloud_v4');
    expect(result.payload).toEqual(committed);
  });

  it('prefers a newer complete local snapshot over an older cloud snapshot', async () => {
    const cloudSnapshot = payload('2026-11-02T09:00:00.000Z', 'cloud old');
    expect((await saveStateToTelegramStorage(cloudSnapshot)).cloudSaved).toBe(true);

    const localSnapshot = payload('2026-11-02T10:00:00.000Z', 'local newer');
    local.setItem('ael_tma_state_v4', JSON.stringify(localSnapshot));

    const result = await loadLatestStateFromTelegramStorage(payload('1970-01-01T00:00:00.000Z'));
    expect(result.source).toBe('local_v4');
    expect(result.payload).toEqual(localSnapshot);
  });

  it('recovers only the supported fields from the legacy cloud summary and warns about missing cards', async () => {
    cloud.set('ael_tma_state_v3', JSON.stringify({
      m: { 'node.one': [72, 'needs_proof', 4] },
      s: { z: false, d: 9, x: 880, c: 31, t: 42, ok: 30, wr: 10, sk: 2, lr: 8 },
    }));
    const fallback = payload('1970-01-01T00:00:00.000Z');
    const result = await loadLatestStateFromTelegramStorage(fallback);

    expect(result.source).toBe('cloud_v3_summary');
    expect(result.payload.nodeStates['node.one'].masteryScore).toBe(72);
    expect(result.payload.nodeStates['node.one'].coverageStatus).toBe('needs_proof');
    expect(result.payload.nodeStates['node.one'].lastLessonSelfRating).toBe(4);
    expect(result.payload.stats.streakDays).toBe(9);
    expect(result.payload.stats.coins).toBe(31);
    expect(result.payload.cards).toEqual(fallback.cards);
    expect(result.warning).toContain('کارت‌ها و زمان‌بندی مرور');
  });

  it('invalidates the cloud manifest and local snapshots on zero-state reset', async () => {
    expect((await saveStateToTelegramStorage(payload('2026-11-02T10:00:00.000Z'))).cloudSaved).toBe(true);
    await clearTelegramZeroStateStorage();

    expect(cloud.has('ael_tma_v4_manifest')).toBe(false);
    expect(cloud.has('ael_tma_state_v3')).toBe(false);
    expect(local.getItem('ael_tma_state_v4')).toBeNull();
    expect(local.getItem('ael_tma_state_v3')).toBeNull();
  });
});
