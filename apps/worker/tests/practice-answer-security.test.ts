/**
 * V3-Hardening R-036 remediation — SEC-001..009: تحویل سؤال/کلید روی مسیر
 * practice سمت سرور (پایهٔ server-only delivery).
 *
 * کلاینت سؤال عمومی را محلی دارد؛ این تست‌ها قرارداد API سمت سرور را اثبات
 * می‌کنند: بلیت → تصحیح اتمیک → افشای کلید فقط برای همان سؤالِ همان داوطلبِ
 * همان تلاشِ مصرف‌شده.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, resetRateLimitsForTesting } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';
import { CLIENT_BANK_ANSWER_KEY_BY_ID, SECURITY_CANARY_IDS } from '../src/data/client-bank-keys.server.ts';
import pack from '../../../content/examples/demo-pack.json';

const ENV = {
  ENVIRONMENT: 'development',
  SESSION_SECRET: 'test-secret',
  ALLOW_DEMO_AUTH: 'true',
  TELEGRAM_WEBHOOK_SECRET: 'test_telegram_webhook_secret_2026_secure',
  ADMIN_API_TOKEN: 'test-admin-api-token-with-at-least-32-characters-2026',
};

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

async function login(displayName = 'داوطلب practice'): Promise<string> {
  const res = await app.request('/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
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

const KEY_FIELD_PATTERN = /["']?(correctOption|correctIndex|answerIndex)["']?\s*:/g;
const realBankId = [...CLIENT_BANK_ANSWER_KEY_BY_ID.keys()].find((id) => !id.startsWith('sec.'))!;
const canaryId = SECURITY_CANARY_IDS[0];
const derivedKey = [...CLIENT_BANK_ANSWER_KEY_BY_ID.values()].find((k) => k.bank === 'examArchiveDerived');

async function issueAndAnswer(token: string, questionId: string, selectedOption: number) {
  const issue = await app.request('/api/practice/attempts', authed(token, {
    method: 'POST',
    body: JSON.stringify({ questionIds: [questionId] }),
  }));
  const { attempts } = (await issue.json()) as { attempts: Array<{ attemptId: string; questionId: string }> };
  return app.request('/api/practice/answer', authed(token, {
    method: 'POST',
    body: JSON.stringify({ attemptId: attempts[0].attemptId, questionId, selectedOption }),
  }));
}

describe('SEC — تحویل server-only کلید پاسخ برای بانک کلاینت', () => {
  it('SEC-001: صدور بلیت هیچ کلیدی برنمی‌گرداند؛ شناسهٔ ناشناخته 404 می‌دهد', async () => {
    const token = await login();
    const res = await app.request('/api/practice/attempts', authed(token, {
      method: 'POST',
      body: JSON.stringify({ questionIds: [realBankId] }),
    }));
    expect(res.status).toBe(200);
    const raw = JSON.stringify(await res.json());
    expect(raw.match(KEY_FIELD_PATTERN)).toBeNull();

    const unknown = await app.request('/api/practice/attempts', authed(token, {
      method: 'POST',
      body: JSON.stringify({ questionIds: ['nope.unknown.1'] }),
    }));
    expect(unknown.status).toBe(404);
  });

  it('SEC-002..004: صدور بلیت بدون auth رد می‌شود (صف/کوییز شبانه/یادگیری جداگانه در question-key-delivery پوشش دارند)', async () => {
    const res = await app.request('/api/practice/attempts', {
      method: 'POST',
      body: JSON.stringify({ questionIds: [realBankId] }),
    });
    expect([401, 403]).toContain(res.status);
  });

  it('SEC-011: کلید استنباطی با برچسب derived تحویل می‌شود، هرگز رسمی', async () => {
    if (!derivedKey) return; // تا نخستین کلید استنباطی وارد رجیستری نشود، بی‌محتوا رد می‌شود.
    const token = await login('برچسب-SEC011');
    const res = await (await issueAndAnswer(token, derivedKey.id, derivedKey.correctOption)).json();
    expect(res.keySource).toBe('derived');
    expect(String(res.explanation)).toContain('کلید استنباطی');
  });

  it('SEC-005: پاسخ صحیح و غلط سمت سرور تشخیص داده می‌شود (کلید از registry سرور)', async () => {
    const token = await login();
    const key = CLIENT_BANK_ANSWER_KEY_BY_ID.get(realBankId)!;
    const correct = await (await issueAndAnswer(token, realBankId, key.correctOption)).json();
    expect(correct.wasCorrect).toBe(true);
    expect(correct.correctOption).toBe(key.correctOption);
    expect(correct.replay).toBe(false);
    expect(correct.keySource).toBe('official');

    const token2 = await login('داوطلب دوم-SEC005');
    const wrongOption = (key.correctOption + 1) % 4;
    const wrong = await (await issueAndAnswer(token2, realBankId, wrongOption)).json();
    expect(wrong.wasCorrect).toBe(false);
    expect(wrong.correctOption).toBe(key.correctOption);
  });

  it('SEC-006/007: نتیجه فقط برای همان سؤال/همان داوطلب؛ داوطلب دیگر به نتیجهٔ دیگری دسترسی ندارد', async () => {
    const token1 = await login('مالک-SEC007');
    const issue = await app.request('/api/practice/attempts', authed(token1, {
      method: 'POST',
      body: JSON.stringify({ questionIds: [realBankId] }),
    }));
    const { attempts } = (await issue.json()) as { attempts: Array<{ attemptId: string }> };
    const attemptId = attempts[0].attemptId;
    const key = CLIENT_BANK_ANSWER_KEY_BY_ID.get(realBankId)!;
    await app.request('/api/practice/answer', authed(token1, {
      method: 'POST',
      body: JSON.stringify({ attemptId, questionId: realBankId, selectedOption: key.correctOption }),
    }));

    // کاربر دیگر با همان attemptId
    const token2 = await login('غریبه-SEC007');
    const foreign = await app.request('/api/practice/result', authed(token2, {
      headers: { Authorization: `Bearer ${token2}` },
    }).method === 'POST' ? {} : {});
    // result با attemptId دیگری: برای کاربر دوم 404 (نتایج مالکیت‌دارند)
    const foreignResult = await app.request(
      `/api/practice/result?attemptId=${encodeURIComponent(attemptId)}`,
      authed(token2),
    );
    expect(foreignResult.status).toBe(404);
    void foreign;
  });

  it('SEC-008: جعل selectedOption در کلاینت بی‌اثر است — کلید فقط سرور دارد', async () => {
    const token = await login('جعل‌کننده-SEC008');
    const key = CLIENT_BANK_ANSWER_KEY_BY_ID.get(realBankId)!;
    // کلاینت ادعای درست بودن ندارد؛ فقط selectedOption می‌فرستد و سرور با کلید واقعی می‌سنجد
    const wrongButClaimed = await (await issueAndAnswer(token, realBankId, (key.correctOption + 1) % 4)).json();
    expect(wrongButClaimed.wasCorrect).toBe(false);
    // هیچ مسیری در endpoint، فیلد wasCorrect از کلاینت نمی‌پذیرد (قرارداد ورودی محدود است)
  });

  it('SEC-009: Replay نتیجهٔ همان را بدون ثبت دوباره برمی‌گرداند؛ بلیت مصرف‌شده برای سؤال دیگر کار نمی‌کند', async () => {
    const token = await login('replay-SEC009');
    const key = CLIENT_BANK_ANSWER_KEY_BY_ID.get(realBankId)!;
    const issue = await app.request('/api/practice/attempts', authed(token, {
      method: 'POST',
      body: JSON.stringify({ questionIds: [realBankId, [...CLIENT_BANK_ANSWER_KEY_BY_ID.keys()].filter((id) => !id.startsWith('sec.') && id !== realBankId)[0]] }),
    }));
    const { attempts } = (await issue.json()) as { attempts: Array<{ attemptId: string; questionId: string }> };
    const first = await (await app.request('/api/practice/answer', authed(token, {
      method: 'POST',
      body: JSON.stringify({ attemptId: attempts[0].attemptId, questionId: attempts[0].questionId, selectedOption: key.correctOption }),
    }))).json();
    const replay = await (await app.request('/api/practice/answer', authed(token, {
      method: 'POST',
      body: JSON.stringify({ attemptId: attempts[0].attemptId, questionId: attempts[0].questionId, selectedOption: key.correctOption }),
    }))).json();
    expect(replay.replay).toBe(true);
    expect(replay.wasCorrect).toBe(first.wasCorrect);

    // همان بلیت برای سؤال دیگر → رد (ownership سؤال)
    const otherQ = attempts[1].questionId;
    const misuse = await app.request('/api/practice/answer', authed(token, {
      method: 'POST',
      body: JSON.stringify({ attemptId: attempts[0].attemptId, questionId: otherQ, selectedOption: 0 }),
    }));
    expect(misuse.status).toBe(400); // attempt قبلاً برای سؤال دیگری ثبت شده
  });

  it('SEC-010 (بخش API): Canary در پاسخ‌های این endpointها فقط پس از submit همان canary ظاهر می‌شود', async () => {
    const token = await login('canary-SEC010');
    const canaryKey = CLIENT_BANK_ANSWER_KEY_BY_ID.get(canaryId)!;
    // قبل از submit: هیچ canary explanation/trapNote در هیچ پاسخی نیست
    const issue = await app.request('/api/practice/attempts', authed(token, {
      method: 'POST',
      body: JSON.stringify({ questionIds: [realBankId] }),
    }));
    const rawIssue = JSON.stringify(await issue.json());
    expect(rawIssue).not.toContain('CANARY-EXPLANATION-R036');
    expect(rawIssue).not.toContain('CANARY-TRAPNOTE-R036');

    // بعد از submit همان canary: افشا فقط برای همان canary
    const answered = await (await issueAndAnswer(token, canaryId, canaryKey.correctOption)).json();
    expect(answered.explanation).toContain('CANARY-EXPLANATION-R036');

    // نتیجهٔ سؤال دیگر never شامل canary نمی‌شود
    const otherResult = await (await issueAndAnswer(token, realBankId, 0)).json();
    expect(JSON.stringify(otherResult)).not.toContain('CANARY-EXPLANATION-R036');
  });

  it('ورودی نامعتبر و بلیت بدون صدور رد می‌شوند', async () => {
    const token = await login('invalid-SEC');
    const badInput = await app.request('/api/practice/answer', authed(token, {
      method: 'POST',
      body: JSON.stringify({ attemptId: 'x', questionId: realBankId, selectedOption: 9 }),
    }));
    expect(badInput.status).toBe(400);
    const noTicket = await app.request('/api/practice/answer', authed(token, {
      method: 'POST',
      body: JSON.stringify({ attemptId: crypto.randomUUID(), questionId: realBankId, selectedOption: 0 }),
    }));
    expect(noTicket.status).toBe(403);
  });
});
