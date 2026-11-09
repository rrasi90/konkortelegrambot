/**
 * V3-Hardening B8 — کاتالوگ trackها بدون fallback مدیریت‌محور.
 * با کاتالوگ خالی، هیچ رشتهٔ مدیریت به‌صورت خودکار تزریق نمی‌شود؛
 * پاسخ صریح catalog_not_available برمی‌گردد.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, resetRateLimitsForTesting } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';

const ENV = {
  ENVIRONMENT: 'development',
  SESSION_SECRET: 'test-secret',
  ALLOW_DEMO_AUTH: 'true',
  TELEGRAM_WEBHOOK_SECRET: 'test_telegram_webhook_secret_2026_secure',
  ADMIN_API_TOKEN: 'test-admin-api-token-with-at-least-32-characters-2026',
};

type TrackIdLiteral = 'business' | 'common' | 'industrial' | 'strategy' | 'technology';

class ConfigurablePacksStore extends MemoryStore {
  constructor(private readonly packs: Array<{ packId: string; title: string; tracks: TrackIdLiteral[]; isDemo: boolean }>) {
    super();
  }
  override async listPacks(): Promise<Array<{ packId: string; title: string; tracks: TrackIdLiteral[]; isDemo: boolean }>> {
    return this.packs;
  }
}

function buildApp(packs: Array<{ id: string; tracks: string[]; title?: string }>): { app: ReturnType<typeof createApp>; token: Promise<string> } {
  const store = new ConfigurablePacksStore(packs.map((p) => ({ packId: p.id, title: p.title ?? p.id, tracks: p.tracks as TrackIdLiteral[], isDemo: false })));
  const app = createApp(ENV, { store });
  const token = (async () => {
    const res = await app.request('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'داوطلب کاتالوگ' }),
    });
    return ((await res.json()) as { token: string }).token;
  })();
  return { app, token };
}

describe('B8 — GET /api/tracks بدون fallback ثابت', () => {
  beforeEach(() => resetRateLimitsForTesting());

  it('کاتالوگ خالی: هیچ track مدیریت‌محور تزریق نمی‌شود؛ catalog_not_available صریح است', async () => {
    const { app, token } = buildApp([]);
    const res = await app.request('/api/tracks', {
      headers: { Authorization: `Bearer ${await token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tracks: string[]; catalog_not_available?: boolean };
    expect(body.catalog_not_available).toBe(true);
    expect(body.tracks).toEqual([]);
    for (const banned of ['business', 'technology', 'strategy', 'industrial']) {
      expect(body.tracks).not.toContain(banned);
    }
  });

  it('کاتالوگ واقعی: فقط trackهای همان کاتالوگ + common', async () => {
    const { app, token } = buildApp([
      { id: 'pack.custom-1', tracks: ['custom-track-a'] },
      { id: 'pack.custom-2', tracks: ['custom-track-a', 'custom-track-b'] },
    ]);
    const res = await app.request('/api/tracks', {
      headers: { Authorization: `Bearer ${await token}` },
    });
    const body = (await res.json()) as { tracks: string[]; packs: unknown[] };
    expect(body.tracks.sort()).toEqual(['common', 'custom-track-a', 'custom-track-b']);
    expect(body.packs).toHaveLength(2);
  });
});
