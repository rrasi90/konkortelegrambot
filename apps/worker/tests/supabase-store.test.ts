import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseStore } from '../src/store.ts';

type Call = { method: string; url: string; body: unknown };

let calls: Call[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFetch(handler: (call: Call) => Response) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      method: init?.method ?? 'GET',
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    };
    calls.push(call);
    return handler(call);
  });
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SupabaseStore — هویت پایدار کاربر', () => {
  it('نام کاربری را نرمال‌شده در createUser ذخیره و در پاسخ برمی‌گرداند', async () => {
    installFetch(() =>
      jsonResponse([
        {
          id: 'u-1',
          telegram_user_id: null,
          telegram_username: 'ali_reza',
          display_name: '@ali_reza',
          active_tracks: ['common'],
        },
      ]),
    );
    const store = new SupabaseStore('https://db.test', 'service-key');
    const user = await store.createUser({ telegramUsername: '@Ali_Reza', displayName: '@ali_reza' });

    expect(user.id).toBe('u-1');
    expect(user.telegramUsername).toBe('ali_reza');
    expect(calls[0].method).toBe('POST');
    expect((calls[0].body as Record<string, unknown>[])[0].telegram_username).toBe('ali_reza');
  });

  it('getUserByTelegramUsername با آیدی نرمال‌شده و بدون @ کوئری می‌زند', async () => {
    installFetch((call) => {
      if (call.url.includes('telegram_username=eq.ali_reza')) {
        return jsonResponse([
          { id: 'u-2', telegram_username: 'ali_reza', active_tracks: ['common'] },
        ]);
      }
      return jsonResponse([]);
    });
    const store = new SupabaseStore('https://db.test', 'service-key');
    const user = await store.getUserByTelegramUsername('@ALI_REZA');

    expect(user?.id).toBe('u-2');
    expect(calls[0].url).toContain('telegram_username=eq.ali_reza');
  });

  it('در رقابت دو ورود هم‌زمان، کاربر ساخته‌شده را برمی‌گرداند و حساب تکراری نمی‌سازد', async () => {
    installFetch((call) => {
      if (call.method === 'POST') {
        return new Response('duplicate key value violates unique constraint', { status: 409 });
      }
      return jsonResponse([
        { id: 'u-existing', telegram_user_id: 4242, telegram_username: null, active_tracks: ['common'] },
      ]);
    });
    const store = new SupabaseStore('https://db.test', 'service-key');
    const user = await store.createUser({ telegramUserId: 4242 });

    expect(user.id).toBe('u-existing');
    expect(calls.some((c) => c.method === 'GET' && c.url.includes('telegram_user_id=eq.4242'))).toBe(true);
  });
});
