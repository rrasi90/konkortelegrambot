import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertWorkerAssetsConfiguration,
  auditClientBundle,
  findClientAnswerKeyLeaks,
} from '../../scripts/audit-client-bundle';

describe('public client bundle answer-key guard (R-036 hard gate)', () => {
  it('Wrangler serves the audited Mini App directory and routes API requests through the Worker', async () => {
    await expect(assertWorkerAssetsConfiguration()).resolves.toBeUndefined();
  });

  it('the Cloudflare Worker-served Mini App contains ZERO embedded answer keys (no exceptions)', async () => {
    // R-036 بسته شد: گام ۲ (حذف کلید از بانک‌های کلاینت + گریتینگ سرور) انجام شده؛
    // چشم‌پوشی knownR036Footprint حذف شد و گارد سخت است — هر یافته‌ای شکست است.
    const findings = await auditClientBundle(resolve(process.cwd(), 'apps/miniapp'));
    expect(findings).toEqual([]);
  });

  it('detects embedded question and lesson answer-key literals', () => {
    const findings = findClientAnswerKeyLeaks({
      'assets/app.js': 'const q={id:"q.one",correctOption:2}; const lesson={correctIndex:1};',
      'assets/questions.json': '{"id":"q.two","correctOption":0}',
    });

    expect(findings).toEqual([
      { asset: 'assets/app.js', field: 'correctOption', count: 1 },
      { asset: 'assets/app.js', field: 'correctIndex', count: 1 },
      { asset: 'assets/questions.json', field: 'correctOption', count: 1 },
    ]);
  });

  it('detects authored formative keys but permits feedback property reads', () => {
    expect(findClientAnswerKeyLeaks({
      'offline.html': '<script>const bank=[{"answerIndex":2}];</script>',
      'client.js': 'show(result.answerIndex);',
    })).toEqual([{ asset: 'offline.html', field: 'answerIndex', count: 1 }]);
  });

  it('does not flag safe property reads or answer values returned after a submit', () => {
    const findings = findClientAnswerKeyLeaks({
      'assets/app.js': 'const key=q.correctOption; const answer=payload.correctOption; submitAnswer(selectedOption);',
    });
    expect(findings).toEqual([]);
  });

  it('detects whitespace, quoted JSON keys and source-map contents', () => {
    const findings = findClientAnswerKeyLeaks({
      'assets/app.js': '({ "correctOption" : 3, \'correctIndex\' : 0 })',
      'assets/app.js.map': JSON.stringify({
        sourcesContent: ['export const key = { correctOption: 1 };'],
      }),
    });
    expect(findings).toHaveLength(3);
    expect(findings[2]).toMatchObject({ asset: 'assets/app.js.map', field: 'correctOption', count: 1 });
  });

  // ── مأموریت v4 §3.2.4/§3.2.6 — تست منفی canary و الگوهای مقدار-محور ──

  it('NEGATIVE test: a canary key leaked into a bundle MUST be detected (fail-closed)', () => {
    // کلید canary واقعی رجیستری سرور + دادهٔ حساس هم‌شکل key — Audit باید Fail شود.
    const findings = findClientAnswerKeyLeaks({
      'assets/index-abc.js':
        '{"explanation":"CANARY-EXPLANATION-R036-0123456789abcdef","trapNote":"CANARY-TRAPNOTE-R036-fedcba9876543210"}',
    });
    expect(findings).toEqual([
      { asset: 'assets/index-abc.js', field: 'canaryValue', count: 2 },
    ]);
  });

  it('NEGATIVE test: a reference to the server answer-key registry is a hard finding', () => {
    const findings = findClientAnswerKeyLeaks({
      'assets/app.js': 'import registry from "./client-bank-keys.server.js"',
    });
    expect(findings).toEqual([
      { asset: 'assets/app.js', field: 'serverRegistryReference', count: 1 },
    ]);
  });

  it('NEGATIVE test: derived correctness literal (isCorrect:true) and solutionIndex are findings', () => {
    const findings = findClientAnswerKeyLeaks({
      'assets/app.js': 'const r={isCorrect:true,solutionIndex:2};',
    });
    expect(findings).toEqual([
      { asset: 'assets/app.js', field: 'solutionIndex', count: 1 },
      { asset: 'assets/app.js', field: 'isCorrectLiteral', count: 1 },
    ]);
  });

  it('POSITIVE test: a clean bundle with public type/API names passes', () => {
    const findings = findClientAnswerKeyLeaks({
      'assets/app.js':
        'const reveal=await gradeAnswerOnServer(q.id,choice); render(reveal.correctOption,reveal.explanation);' +
        'const correctOptionType=null; submitPracticeAnswer(attemptId,qid,selected);',
    });
    // خواندن خصوصیت/نام تایپ عمومی مجاز است؛ فقط «مقدار» کلید ممنوع.
    expect(findings).toEqual([]);
  });

  it('the Offline standalone HTML contains ZERO keys and is rebuilt before scanning', async () => {
    // مأموریت v4 §3.5 — خروجی آفلاین باید صفر کلید داشته باشد؛ برای قطعیت،
    // خود این تست بیلد را اجرا می‌کند تا اسکن همیشه روی خروجی روز باشد.
    execSync('node scripts/build-ael-offline.mjs', { stdio: 'pipe' });
    const findings = await auditClientBundle(resolve(process.cwd(), 'tools/offline'));
    expect(findings).toEqual([]);
  });
});
