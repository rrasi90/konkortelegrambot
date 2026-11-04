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

describe('SupabaseStore — فیلترهای PostgREST', () => {
  it('attemptId ورودی را encode می‌کند تا نتواند فیلتر دیگری به کوئری تزریق کند', async () => {
    installFetch(() => jsonResponse([]));
    const store = new SupabaseStore('https://db.test', 'service-key');

    await store.findAnswerByAttempt('user-1', 'a&user_id=eq.attacker&select=*');

    expect(calls[0].url).toContain('attempt_id=eq.a%26user_id%3Deq.attacker%26select%3D*');
    expect(calls[0].url).not.toContain('attempt_id=eq.a&user_id=eq.attacker');
  });
});

describe('SupabaseStore — نگاشت درست روی ستون‌های واقعی اسکیما', () => {
  it('listPacks ستون‌های وجوددارِ exam_packs را می‌خواند و صحیح نگاشت می‌کند', async () => {
    installFetch(() =>
      jsonResponse([
        {
          id: 'demo-pack',
          name: 'بستهٔ نمایشی',
          track: 'business',
          status: 'published',
          rights_status: 'authorized',
          metadata: null,
        },
        {
          id: 'synth-pack',
          name: 'بستهٔ ساختگی',
          track: 'common',
          status: 'draft',
          rights_status: 'authorized',
          metadata: { synthetic: true, tracks: ['strategy', 'industrial'] },
        },
      ]),
    );
    const store = new SupabaseStore('https://db.test', 'service-key');
    const packs = await store.listPacks();

    // pack_id/title/tracks/is_demo در اسکیما وجود ندارند؛ درخواست قدیمی ۴۰۰ می‌داد
    expect(calls[0].url).toContain('/rest/v1/exam_packs?');
    expect(calls[0].url).toContain('select=id,name,track,status,rights_status,metadata');
    expect(calls[0].url).not.toContain('pack_id');
    expect(packs[0]).toEqual({ packId: 'demo-pack', title: 'بستهٔ نمایشی', tracks: ['business'], isDemo: false });
    expect(packs[1]!.tracks).toEqual(['strategy', 'industrial']);
    expect(packs[1]!.isDemo).toBe(true);
  });

  it('saveExamSelection با on_conflict می‌نویسد تا انتخاب همان سال تکراری نشود', async () => {
    installFetch(() =>
      jsonResponse([
        {
          user_id: 'u-1',
          exam_year: 1406,
          sub_group_id: 'mgmt',
          combination_code: '3',
          set_code: '2162',
          is_active: true,
          selected_at: '2026-11-02T00:00:00Z',
        },
      ]),
    );
    const store = new SupabaseStore('https://db.test', 'service-key');
    const selection = await store.saveExamSelection('u-1', {
      examYear: 1406,
      subGroupId: 'mgmt',
      combinationCode: '3',
      setCode: '2162',
    });

    // قید یکتا روی (user_id, exam_year) است؛ بدون on_conflict دومین PUT خطای ۴۰۹ می‌داد
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('exam_selections?on_conflict=user_id,exam_year');
    expect(selection.examYear).toBe(1406);
  });

  it('listQuestions وضعیت isVerified را از verification_status می‌سازد (نه همیشه false)', async () => {
    installFetch(() =>
      jsonResponse([
        {
          id: 'q-verified',
          node_id: 'n-1',
          exam_year: 1403,
          question_text: 'سؤال تأییدشده',
          options: ['الف', 'ب'],
          correct_option: 0,
          explanation: null,
          trap_note: null,
          exam_level: 'doctorate',
          content_origin: 'official_booklet',
          verification_status: 'verified',
          access_type: 'proof',
        },
        {
          id: 'q-demo',
          node_id: 'n-2',
          exam_year: null,
          question_text: 'سؤال نمایشی',
          options: ['الف', 'ب'],
          correct_option: 1,
          explanation: null,
          trap_note: null,
          exam_level: null,
          content_origin: 'synthetic_demo',
          verification_status: 'demo',
          access_type: 'practice',
        },
      ]),
    );
    const store = new SupabaseStore('https://db.test', 'service-key');
    const questions = await store.listQuestions();

    expect(calls[0].url).toContain('v_worker_question_access');
    expect(questions.find((q) => q.id === 'q-verified')).toMatchObject({ isVerified: true, accessType: 'proof' });
    expect(questions.find((q) => q.id === 'q-demo')!.isVerified).toBe(false);
  });
});
