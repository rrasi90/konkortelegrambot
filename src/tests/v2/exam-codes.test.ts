import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('exam codes', () => {
  it('courses uses 2162 set code (0eef570 evidence)', () => {
    const courses = JSON.parse(readFileSync('content/knowledge/courses.json', 'utf8'));
    for (const c of courses) expect(c.exam_code).toBe('2162');
  });
  it('mappings keep legacy 2164 documented (no silent global replace)', () => {
    const text = readFileSync('content/knowledge/question-skill-mappings.jsonl', 'utf8');
    expect(text).toContain('2164');
  });
  it('level/year isolation: doctorate vs master keys differ', async () => {
    const mod = await import('@ael/contracts');
    expect(mod.getExamPath('doctorate').bookletCode).toBe('2162');
    expect(mod.getExamPath('master').bookletCode).toBe('1142');
  });
});
