import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, resetRateLimitsForTesting } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';
import pack from '../../../content/examples/demo-pack.json';

const ENV = {
  SESSION_SECRET: 'test-secret',
  ALLOW_DEMO_AUTH: 'true',
};

let store: MemoryStore;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
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
    body: JSON.stringify({ displayName: 'داوطلب آزمون' }),
  });
  const body = (await res.json()) as { token: string };
  return body.token;
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

async function json(res: Response): Promise<any> {
  return res.json();
}

async function startSession(token: string, body: Record<string, unknown>) {
  const res = await app.request(
    '/api/exam-simulation/start',
    authed(token, { method: 'POST', body: JSON.stringify(body) }),
  );
  return { res, payload: (await json(res)) as any };
}

describe('§8.7 — ساختار رسمی آزمون (GET /api/exam-structure)', () => {
  it('ساختار ۱۴۰۵ با ضریب تخصصی ۵، زبان ۱، جریمهٔ یک‌سوم و زمان ۱۰۵/۴۰ برگردانده می‌شود', async () => {
    const token = await login();
    const res = await app.request('/api/exam-structure?level=doctorate&year=1405', authed(token));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.available).toBe(true);
    expect(body.path.bookletCode).toBe('2162');
    expect(body.path.title).toContain('دکتری');
    expect(body.structure.specializationCoefficient).toBe(5);
    expect(body.structure.languageCoefficient).toBe(1);
    expect(body.structure.hasAptitude).toBe(false);
    expect(body.structure.negativeMarkingRatio).toBeCloseTo(1 / 3, 10);
    expect(body.structure.durationMinutes).toEqual({ specialization: 105, language: 40 });
    expect(body.structure.specializationQuestionCount).toEqual({ min: 80, max: 90 });
    expect(body.structure.languageQuestionCount).toBe(40);
    expect(Array.isArray(body.warnings)).toBe(true);
    expect(body.subGroups.length).toBeGreaterThan(0);
  });

  it('سطح ارشد ساختار سالانه ندارد و دلیلش اعلام می‌شود — دو سطح یک عنوان و یک کد ندارند', async () => {
    const token = await login();
    const masterRes = await app.request('/api/exam-structure?level=master', authed(token));
    expect(masterRes.status).toBe(200);
    const master = await json(masterRes);
    expect(master.available).toBe(false);
    expect(master.structure).toBeNull();
    expect(master.reason).toContain('۱۱۴۲');

    const doctorRes = await app.request('/api/exam-structure?level=doctorate', authed(token));
    const doctor = await json(doctorRes);
    expect(master.path.title).not.toBe(doctor.path.title);
    expect(master.path.bookletCode).not.toBe(doctor.path.bookletCode);
    expect(master.path.bookletCode).toBe('1142');
    expect(doctor.path.bookletCode).toBe('2162');
  });

  it('سطح نامعتبر و سال نامعتبر رد می‌شوند', async () => {
    const token = await login();
    const badLevel = await app.request('/api/exam-structure?level=phd', authed(token));
    expect(badLevel.status).toBe(400);
    const badYear = await app.request('/api/exam-structure?level=doctorate&year=1200', authed(token));
    expect(badYear.status).toBe(400);
  });

  it('بدون ورود، ساختار آزمون برگردانده نمی‌شود', async () => {
    const res = await app.request('/api/exam-structure?level=doctorate');
    expect(res.status).toBe(401);
  });
});

describe('§8.7 — ساخت جلسهٔ شبیه‌سازی', () => {
  it('جلسهٔ دکتری با کد ۲۱۶۲ ساخته می‌شود و برگهٔ پاسخ بدون کلید صحیح است', async () => {
    const token = await login();
    const { res, payload } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    expect(res.status).toBe(200);
    expect(payload.session.bookletCode).toBe('2162');
    expect(payload.session.level).toBe('doctorate');
    expect(payload.session.examYear).toBe(1405);
    expect(payload.session.negativeMarkingRatio).toBeCloseTo(1 / 3, 10);
    expect(payload.items.length).toBeGreaterThan(0);
    expect(payload.items.length).toBe(payload.session.allocatedTotalQuestions);
    for (const item of payload.items) {
      expect(item.attemptId).toBeTruthy();
      expect(item.question.correctOption).toBeUndefined();
      expect(item.question.explanation).toBeUndefined();
      expect(item.question.trapNote).toBeUndefined();
    }
    // سؤال قرنطینهٔ ۱۴۰۴ در جلسهٔ شبیه‌سازی باز نمی‌شود
    expect(payload.items.some((i: any) => i.question.id === 'demo-q-017')).toBe(false);
  });

  it('پوشش ناقص و غیررسمی بودن محتوا صریح اعلام می‌شود', async () => {
    const token = await login();
    const { payload } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    expect(payload.session.coverageRatio).toBeLessThan(1);
    expect(payload.session.officialTotalQuestions).toBe(130);
    expect(payload.disclosures.length).toBeGreaterThan(0);
    expect(payload.disclosures.join('\n')).toContain('سنجش آمادگی');
    expect(payload.session.officiality).not.toBe('official_booklet');
  });

  it('سطح ارشد در سرور شبیه‌سازی نمی‌شود و دلیل برگردانده می‌شود', async () => {
    const token = await login();
    const { res, payload } = await startSession(token, {
      level: 'master',
      examYear: 1404,
      subGroupId: 'business',
    });
    expect(res.status).toBe(503);
    expect(payload.error).toContain('۱۱۴۲');
    expect(payload.path.level).toBe('master');
  });

  it('زیرمجموعهٔ ناشناخته رد می‌شود و سال نامعتبر هم', async () => {
    const token = await login();
    const badGroup = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'not-a-group',
    });
    expect(badGroup.res.status).toBe(400);
    const badYear = await startSession(token, {
      level: 'doctorate',
      examYear: 1200,
      subGroupId: 'business',
    });
    expect(badYear.res.status).toBe(400);
  });

  it('کد ترکیب رسمی پذیرفته می‌شود و کد ترکیبِ خارج از نگاشت زیرمجموعه رد می‌شود', async () => {
    const token = await login();
    const ok = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
      combinationCode: '1',
    });
    expect(ok.res.status).toBe(200);
    expect(ok.payload.session.combinationCode).toBe('1');
    expect(ok.payload.session.subjects.length).toBeGreaterThan(0);
    expect(ok.payload.session.subjectAllocation).toBe('pooled');

    const wrong = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
      combinationCode: '3',
    });
    expect(wrong.res.status).toBe(400);
    expect(wrong.payload.error).toContain('کد ترکیب');
  });

  it('سؤال سطح ارشد هرگز وارد جلسهٔ دکتری نمی‌شود', async () => {
    const token = await login();
    store.questions = store.questions.map((q) => ({ ...q, examLevel: 'master' as const }));
    const { res } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    // همهٔ سؤال‌ها سطح دیگر دارند ⇒ جلسه‌ای ساخته نمی‌شود
    expect(res.status).toBe(409);
  });
});

describe('§8.7 — ثبت پاسخ و گزارش نمره', () => {
  it('پاسخ ثبت می‌شود ولی درستی آن به کلاینت اعلام نمی‌شود (رفتار آزمون رسمی)', async () => {
    const token = await login();
    const { payload } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    const item = payload.items[0];
    const res = await app.request(
      '/api/exam-simulation/answer',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: payload.session.id,
          attemptId: item.attemptId,
          questionId: item.question.id,
          selectedOption: 0,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.recorded).toBe(true);
    expect(body.isCorrect).toBeUndefined();
    expect(body.correctOption).toBeUndefined();
  });

  it('ارسال مجدد پاسخ یکسان بی‌اثر است و پاسخ متفاوت رد می‌شود', async () => {
    const token = await login();
    const { payload } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    const item = payload.items[0];
    const body = JSON.stringify({
      sessionId: payload.session.id,
      attemptId: item.attemptId,
      questionId: item.question.id,
      selectedOption: 0,
    });
    const first = await app.request('/api/exam-simulation/answer', authed(token, { method: 'POST', body }));
    expect(first.status).toBe(200);
    const second = await app.request('/api/exam-simulation/answer', authed(token, { method: 'POST', body }));
    expect(second.status).toBe(200);
    expect(store.examSessionResponses).toHaveLength(1);
    const changed = JSON.stringify({ sessionId: payload.session.id, attemptId: item.attemptId,
      questionId: item.question.id, selectedOption: 1 });
    const third = await app.request('/api/exam-simulation/answer', authed(token, { method: 'POST', body: changed }));
    expect(third.status).toBe(409);
  });

  it('جلسهٔ منقضی پاسخ نمی‌پذیرد', async () => {
    const token = await login();
    const { payload } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    const item = payload.items[0];
    const session = store.examSessions.get(payload.session.id);
    expect(session).toBeDefined();
    session!.expiresAt = new Date(Date.now() - 60_000).toISOString();

    const res = await app.request(
      '/api/exam-simulation/answer',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: payload.session.id,
          attemptId: item.attemptId,
          questionId: item.question.id,
          selectedOption: 0,
        }),
      }),
    );
    expect(res.status).toBe(409);
    expect((await json(res)).error).toContain('زمان');
    expect(store.examSessionResponses.length).toBe(0);
  });

  it('بلیتِ جلسهٔ دیگر یا سؤالِ خارج از برگه پذیرفته نمی‌شود', async () => {
    const token = await login();
    const { payload } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    const item = payload.items[0];
    const res = await app.request(
      '/api/exam-simulation/answer',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: payload.session.id,
          attemptId: 'att-not-issued',
          questionId: item.question.id,
          selectedOption: 0,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('بلیت شبیه‌سازی از مسیر /api/answers قابل خرج‌کردن نیست', async () => {
    const token = await login();
    const { payload } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    const item = payload.items[0];
    const res = await app.request(
      '/api/answers',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: item.attemptId,
          questionId: item.question.id,
          selectedOption: 0,
        }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await json(res)).error).toContain('موتور یادگیری');
  });

  it('پاسخ شبیه‌سازی تسلط کاربر را تغییر نمی‌دهد', async () => {
    const token = await login();
    const { payload } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    const item = payload.items[0];
    await app.request(
      '/api/exam-simulation/answer',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: payload.session.id,
          attemptId: item.attemptId,
          questionId: item.question.id,
          selectedOption: 0,
        }),
      }),
    );
    expect(store.mastery.size).toBe(0);
    expect(store.cards.size).toBe(0);
    expect(store.answers.length).toBe(0);
  });

  it('گزارش پایانی: نمرهٔ وزنی، بخش‌ها، اطمینان و افشاها را می‌دهد', async () => {
    const token = await login();
    const { payload } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    for (const item of payload.items) {
      await app.request(
        '/api/exam-simulation/answer',
        authed(token, {
          method: 'POST',
          body: JSON.stringify({
            sessionId: payload.session.id,
            attemptId: item.attemptId,
            questionId: item.question.id,
            selectedOption: 0,
          }),
        }),
      );
    }
    const res = await app.request(
      '/api/exam-simulation/submit',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ sessionId: payload.session.id }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.answered).toBe(payload.items.length);
    expect(body.total).toBe(payload.items.length);
    expect(body.report.bookletCode).toBe('2162');
    expect(body.report.pathTitle).toContain('دکتری');
    expect(body.report.negativeMarkingRatio).toBeCloseTo(1 / 3, 10);
    expect(body.report.sections.length).toBeGreaterThan(0);
    expect(typeof body.report.weightedScore).toBe('number');
    expect(body.report.readinessConfidence).toBeLessThanOrEqual(1);
    expect(['low', 'medium', 'high']).toContain(body.report.confidenceLabel);
    expect(body.report.disclosures.length).toBeGreaterThan(0);
    expect(body.report.officiality).not.toBe('official_booklet');
  });

  it('ثبت گزارش تکرارپذیر است و وضعیت جلسه «scored» می‌شود', async () => {
    const token = await login();
    const { payload } = await startSession(token, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    const first = await app.request(
      '/api/exam-simulation/submit',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ sessionId: payload.session.id }),
      }),
    );
    expect(first.status).toBe(200);
    const second = await app.request(
      '/api/exam-simulation/submit',
      authed(token, {
        method: 'POST',
        body: JSON.stringify({ sessionId: payload.session.id }),
      }),
    );
    expect(second.status).toBe(200);
    expect((await json(second)).already_scored).toBe(true);
    const getRes = await app.request(`/api/exam-simulation/${payload.session.id}`, authed(token));
    expect(getRes.status).toBe(200);
    const session = await json(getRes);
    expect(session.session.status).toBe('scored');
    expect(session.report).toBeTruthy();
    for (const item of session.items) {
      expect(item.question.correctOption).toBeUndefined();
    }
  });

  it('ثبت نهایی هم‌زمان یک گزارش پایدار می‌دهد و پاسخ پس از بستن پذیرفته نمی‌شود', async () => {
    const token = await login();
    const { payload } = await startSession(token, { level: 'doctorate', examYear: 1405, subGroupId: 'business' });
    const body = JSON.stringify({ sessionId: payload.session.id });
    const [first, second] = await Promise.all([
      app.request('/api/exam-simulation/submit', authed(token, { method: 'POST', body })),
      app.request('/api/exam-simulation/submit', authed(token, { method: 'POST', body })),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await json(first)).report).toEqual((await json(second)).report);
    const item = payload.items[0];
    const late = await app.request('/api/exam-simulation/answer', authed(token, {
      method: 'POST', body: JSON.stringify({ sessionId: payload.session.id, attemptId: item.attemptId,
        questionId: item.question.id, selectedOption: 0 }),
    }));
    expect(late.status).toBe(409);
  });

  it('پس از وقفه میان بستن پاسخ‌ها و محاسبه، ثبت نهایی قابل تکرار است', async () => {
    const token = await login();
    const { payload } = await startSession(token, { level: 'doctorate', examYear: 1405, subGroupId: 'business' });
    const session = store.examSessions.get(payload.session.id)!;
    await store.beginExamSimulationSubmission(session.userId, session.id);
    expect(session.status).toBe('submitted');
    const retry = await app.request('/api/exam-simulation/submit', authed(token, {
      method: 'POST', body: JSON.stringify({ sessionId: session.id }),
    }));
    expect(retry.status).toBe(200);
    expect(session.status).toBe('scored');
    expect((await json(retry)).report).toBeTruthy();
  });

  it('جلسهٔ کاربر دیگر قابل خواندن نیست', async () => {
    const tokenA = await login();
    const { payload } = await startSession(tokenA, {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'business',
    });
    const tokenB = await login();
    const res = await app.request(`/api/exam-simulation/${payload.session.id}`, authed(tokenB));
    expect(res.status).toBe(404);
  });
});
