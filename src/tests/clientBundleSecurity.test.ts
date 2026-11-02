import { describe, expect, it } from 'vitest';
import { findClientAnswerKeyLeaks } from '../../scripts/audit-client-bundle';

describe('public client bundle answer-key guard', () => {
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

  it('detects whitespace and quoted JSON keys', () => {
    const findings = findClientAnswerKeyLeaks({
      'assets/app.js': '({ "correctOption" : 3, \'correctIndex\' : 0 })',
    });
    expect(findings).toHaveLength(2);
  });
});
