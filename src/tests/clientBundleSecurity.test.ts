import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertWorkerAssetsConfiguration,
  auditClientBundle,
  findClientAnswerKeyLeaks,
} from '../../scripts/audit-client-bundle';

describe('public client bundle answer-key guard', () => {
  it('Wrangler serves the audited Mini App directory and routes API requests through the Worker', async () => {
    await expect(assertWorkerAssetsConfiguration()).resolves.toBeUndefined();
  });

  it('the Cloudflare Worker-served Mini App contains no embedded answer keys', async () => {
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
});
