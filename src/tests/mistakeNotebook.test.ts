import { describe, it, expect } from 'vitest';
import {
  upsertMistake,
  markMistakeResolved,
  removeMistake,
  clearResolvedMistakes,
  filterMistakes,
  summarizeMistakes,
  sanitizeStoredMistakes,
  MAX_MISTAKE_ENTRIES,
  type MistakeEntry,
  type MistakeInput,
} from '../utils/mistakeNotebook';

const baseInput: MistakeInput = {
  questionId: 'q.test.1',
  nodeId: 'mb.structure',
  course: 'مبانی سازمان و مدیریت',
  chapter: 'ساختار',
  topic: 'ساختار مکانیکی و ارگانیک',
  questionText: 'کدام ساختار در محیط پرتلاطم مناسب است؟',
  options: ['مکانیکی', 'ارگانیک', 'هر دو', 'هیچ‌کدام'],
  correctOption: 1,
  selectedOption: 0,
  explanation: 'محیط پرتلاطم نیازمند ساختار ارگانیک است.',
  trapNote: 'مکانیکی برای محیط باثبات است.',
  source: 'دفت، فصل ۱',
  examYear: 1404,
  errorType: 'concept_gap',
};

describe('upsertMistake', () => {
  it('creates a new unresolved entry on first wrong answer', () => {
    const now = new Date('2026-01-01T10:00:00Z');
    const result = upsertMistake([], baseInput, now);
    expect(result).toHaveLength(1);
    expect(result[0].wrongCount).toBe(1);
    expect(result[0].resolved).toBe(false);
    expect(result[0].selectedOption).toBe(0);
    expect(result[0].lastWrongAt).toBe(now.toISOString());
  });

  it('increments wrongCount and reopens a resolved entry', () => {
    const first = upsertMistake([], baseInput, new Date('2026-01-01T10:00:00Z'));
    const resolved = markMistakeResolved(first, 'q.test.1', true);
    const second = upsertMistake(
      resolved,
      { ...baseInput, selectedOption: 2, errorType: 'misread' },
      new Date('2026-01-03T09:00:00Z')
    );
    expect(second).toHaveLength(1);
    expect(second[0].wrongCount).toBe(2);
    expect(second[0].resolved).toBe(false);
    expect(second[0].errorType).toBe('misread');
    expect(second[0].firstWrongAt).toBe('2026-01-01T10:00:00.000Z');
  });

  it('keeps newest mistakes first and enforces the size cap', () => {
    let entries: MistakeEntry[] = [];
    for (let i = 0; i < MAX_MISTAKE_ENTRIES + 25; i += 1) {
      entries = upsertMistake(
        entries,
        { ...baseInput, questionId: `q.${i}` },
        new Date(2026, 0, 1, 0, i)
      );
    }
    expect(entries).toHaveLength(MAX_MISTAKE_ENTRIES);
    expect(entries[0].questionId).toBe(`q.${MAX_MISTAKE_ENTRIES + 24}`);
  });
});

describe('notebook operations', () => {
  const entries = [upsertMistake([], baseInput)[0]];

  it('marks entries resolved', () => {
    expect(markMistakeResolved(entries, 'q.test.1')[0].resolved).toBe(true);
  });

  it('removes a single entry', () => {
    expect(removeMistake(entries, 'q.test.1')).toHaveLength(0);
  });

  it('clears only resolved entries', () => {
    expect(clearResolvedMistakes(markMistakeResolved(entries, 'q.test.1'))).toHaveLength(0);
    expect(clearResolvedMistakes(entries)).toHaveLength(1);
  });

  it('filters by status, course and search text', () => {
    expect(filterMistakes(entries, { status: 'unresolved' })).toHaveLength(1);
    expect(filterMistakes(entries, { status: 'resolved' })).toHaveLength(0);
    expect(filterMistakes(entries, { course: 'بازاریابی' })).toHaveLength(0);
    expect(filterMistakes(entries, { search: 'ارگانیک' })).toHaveLength(1);
    expect(filterMistakes(entries, { search: 'ناموجود' })).toHaveLength(0);
  });

  it('summarizes unresolved, repeated and error-type counts', () => {
    const twice = upsertMistake(entries, baseInput);
    const summary = summarizeMistakes(twice);
    expect(summary.total).toBe(1);
    expect(summary.unresolved).toBe(1);
    expect(summary.repeated).toBe(1);
    expect(summary.byErrorType[0]).toMatchObject({ errorType: 'concept_gap', count: 1 });
    expect(summary.byCourse[0].course).toBe('مبانی سازمان و مدیریت');
  });
});

describe('sanitizeStoredMistakes', () => {
  it('drops corrupt records and normalizes fields', () => {
    const clean = sanitizeStoredMistakes([
      null,
      { questionId: 'x' },
      {
        questionId: 'q.ok',
        nodeId: 'mb.structure',
        options: ['a', 'b'],
        correctOption: 1,
        wrongCount: 0,
        resolved: 'yes',
      },
    ]);
    expect(clean).toHaveLength(1);
    expect(clean[0].questionId).toBe('q.ok');
    expect(clean[0].wrongCount).toBe(1);
    expect(clean[0].resolved).toBe(false);
    expect(clean[0].errorType).toBe('none');
  });

  it('returns empty array for non-array input', () => {
    expect(sanitizeStoredMistakes({ foo: 1 })).toEqual([]);
  });
});
