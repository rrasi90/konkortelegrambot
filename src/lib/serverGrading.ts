/**
 * R-036 گام ۲ — پل تصحیح سمت سرور برای Mini App.
 *
 * کلید پاسخ هرگز در کلاینت نیست؛ این ماژول:
 *  ۱) با تلگرام initData (داخل Telegram Mini App) یا demo auth احراز می‌شود؛
 *  ۲) بلیت تلاش از /api/practice/attempts می‌گیرد؛
 *  ۳) پاسخ را به /api/practice/answer می‌فرستد و فقط نتیجهٔ مجاز همان سؤال را می‌گیرد.
 *
 * Offline (طبق تصمیم مالک): build:offline برای مطالعه/مرور محتوای عمومی است؛
 * تصحیح/امتیاز/Mastery بدون سرور انجام نمی‌شود و هیچ کلیدی به کلاینت برنمی‌گردد.
 * در حالت بی‌دسترسی، GradingUnavailableError پرتاب می‌شود و UI باید صریحاً
 * «تصحیح آنلاین در دسترس نیست» نشان دهد — نه حدس محلی، نه افشای کلید.
 */

export class GradingUnavailableError extends Error {
  constructor(reason: string) {
    super('تصحیح آنلاین در دسترس نیست: ' + reason);
    this.name = 'GradingUnavailableError';
  }
}

export interface PracticeReveal {
  questionId: string;
  submitted: true;
  wasCorrect: boolean;
  correctOption: number;
  explanation: string;
  trapNote: string;
  replay?: boolean;
}

let sessionToken: string | null = null;
let authPromise: Promise<boolean> | null = null;

/** خواندن initData تلگرام (فقط داخل Telegram Mini App موجود است). */
function readTelegramInitData(): string | null {
  const tg = (globalThis as unknown as { Telegram?: { WebApp?: { initData?: string; ready?: () => void } } }).Telegram;
  if (tg?.WebApp?.ready && typeof tg.WebApp.ready === 'function') tg.WebApp.ready();
  return tg?.WebApp?.initData || null;
}

async function authenticate(): Promise<boolean> {
  if (sessionToken) return true;
  if (authPromise) return authPromise;
  authPromise = (async () => {
    try {
      const initData = readTelegramInitData();
      const body = initData ? { initData } : { deviceLabel: 'miniapp-browser' };
      const res = await fetch(initData ? '/api/auth/telegram' : '/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { token?: string };
      if (!data.token) return false;
      sessionToken = data.token;
      return true;
    } catch {
      return false;
    }
  })();
  return authPromise;
}

async function authedFetch(path: string, init: RequestInit): Promise<Response> {
  if (!(await authenticate())) throw new GradingUnavailableError('احراز هویت برقرار نشد');
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
  });
  return res;
}

/** آیا تصحیح آنلاین در دسترس است؟ (برای UI: غیرفعال‌سازی صریح دکمه submit در آفلاین) */
export async function isGradingAvailable(): Promise<boolean> {
  try {
    return await authenticate();
  } catch {
    return false;
  }
}

/** صدور بلیت برای فهرست شناسه‌های سؤال/درس → نگاشت questionId → attemptId */
export async function issuePracticeAttempts(
  questionIds: string[],
): Promise<Record<string, string>> {
  if (questionIds.length === 0) return {};
  const res = await authedFetch('/api/practice/attempts', {
    method: 'POST',
    body: JSON.stringify({ questionIds: [...questionIds] }),
  });
  if (res.status === 401 || res.status === 403) throw new GradingUnavailableError('احراز هویت رد شد');
  if (!res.ok) throw new GradingUnavailableError(`خطای سرور ${res.status} در صدور بلیت`);
  const data = (await res.json()) as { attempts: Array<{ attemptId: string; questionId: string }> };
  const map: Record<string, string> = {};
  for (const a of data.attempts) map[a.questionId] = a.attemptId;
  return map;
}

/** ارسال پاسخ و دریافت نتیجهٔ مجاز همان سؤال (کلید فقط پس از submit). */
export async function submitPracticeAnswer(
  attemptId: string,
  questionId: string,
  selectedOption: number,
): Promise<PracticeReveal> {
  const res = await authedFetch('/api/practice/answer', {
    method: 'POST',
    body: JSON.stringify({ attemptId, questionId, selectedOption }),
  });
  if (res.status === 401 || res.status === 403) throw new GradingUnavailableError('بلیت/احراز نامعتبر');
  if (!res.ok) throw new GradingUnavailableError(`خطای سرور ${res.status} در ثبت پاسخ`);
  return (await res.json()) as PracticeReveal;
}

/** جریان کامل برای یک پاسخ تکی: بلیت + ارسال + نتیجه. */
export async function gradeAnswerOnServer(
  questionId: string,
  selectedOption: number,
): Promise<PracticeReveal> {
  const attempts = await issuePracticeAttempts([questionId]);
  const attemptId = attempts[questionId];
  if (!attemptId) throw new GradingUnavailableError('بلیت برای این سؤال صادر نشد');
  return submitPracticeAnswer(attemptId, questionId, selectedOption);
}

/** جریان بستهٔ نشست (تا ۵۰ آیتم در هر فراخوانی؛ خودش صفحه‌بندی می‌کند). */
export async function gradeAnswersOnServerBatch(
  answers: Array<{ questionId: string; selectedOption: number }>,
): Promise<Map<string, PracticeReveal>> {
  const results = new Map<string, PracticeReveal>();
  const ids = [...new Set(answers.map((a) => a.questionId))];
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50);
    const attemptMap = await issuePracticeAttempts(slice);
    for (const qid of slice) {
      const answer = answers.find((a) => a.questionId === qid);
      if (!answer || attemptMap[qid] === undefined) continue;
      results.set(qid, await submitPracticeAnswer(attemptMap[qid], qid, answer.selectedOption));
    }
  }
  return results;
}
