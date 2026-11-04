import { describe, expect, it } from 'vitest';
import {
  appearanceKey,
  findPrerequisiteCycle,
  partitionImportBatch,
  resolveQuestionVersion,
  validateAppearances,
  validateBookEditions,
  validateQuestionIdentity,
} from '../src/data-versioning';

describe('DATA-02 — نسخه‌بندی سؤال', () => {
  it('نسخهٔ نامشخص = ۱ و نسخهٔ نامعتبر NaN است', () => {
    expect(resolveQuestionVersion({})).toBe(1);
    expect(resolveQuestionVersion({ questionVersion: 3 })).toBe(3);
    expect(resolveQuestionVersion({ questionVersion: 0 })).toBeNaN();
    expect(resolveQuestionVersion({ questionVersion: 'two' })).toBeNaN();
  });

  it('AT-18: بازیافت شناسه برای مفهوم متفاوت رد می‌شود', () => {
    const issues = validateQuestionIdentity([
      { id: 'q.1', topicId: 'fm.tvm', questionVersion: 1 },
      { id: 'q.1', topicId: 'stat.center', questionVersion: 2 },
    ]);
    expect(issues.some((issue) => issue.code === 'id_reuse' && issue.message.includes('مفهوم متفاوت'))).toBe(true);
  });

  it('AT-04: ورود مجدد همان نسخه رکورد تکراری است و گزارش می‌شود', () => {
    const issues = validateQuestionIdentity([
      { id: 'q.1', topicId: 'fm.tvm', questionVersion: 1 },
      { id: 'q.1', topicId: 'fm.tvm', questionVersion: 1 },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('idempotent');
  });

  it('نسخه‌های متفاوت با مفهوم واحد مجازند (ویرایش نسخه‌دار)', () => {
    const issues = validateQuestionIdentity([
      { id: 'q.1', topicId: 'fm.tvm', questionVersion: 1 },
      { id: 'q.1', topicId: 'fm.tvm', questionVersion: 2 },
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe('DATA-02 — رخداد دفترچه', () => {
  it('کلید ترکیبی سال/دفترچه/شماره می‌سازد؛ رکورد بدون رخداد کامل null است', () => {
    expect(appearanceKey({ examYear: 1402, bookletCode: '818C', bookletQuestionNumber: 185 })).toBe('1402/818C/185');
    expect(appearanceKey({ examYear: 1402 })).toBeNull();
  });

  it('AT-19: دو سؤال با یک رخداد رد می‌شوند؛ دو سالِ یک سؤال مجاز است', () => {
    const issues = validateAppearances([
      { id: 'q.a', examYear: 1402, bookletCode: '818C', bookletQuestionNumber: 185 },
      { id: 'q.b', examYear: 1402, bookletCode: '818C', bookletQuestionNumber: 185 },
      { id: 'q.c', examYear: 1402, bookletCode: '818C', bookletQuestionNumber: 185 },
    ]);
    expect(issues).toHaveLength(2);
    expect(issues.every((issue) => issue.code === 'duplicate_appearance')).toBe(true);
  });
});

describe('DATA-02 — چاپ کتاب', () => {
  it('AT-03: چاپ تکراری و صفحهٔ نامعتبر جدا گزارش می‌شوند', () => {
    const issues = validateBookEditions([
      { bookId: 'b1', editionYear: 1400, sectionPages: [{ sectionId: 's1', printedPage: 42 }] },
      { bookId: 'b1', editionYear: 1400 },
      { bookId: 'b2', editionYear: 1403, sectionPages: [{ sectionId: 's2', printedPage: -1 }] },
    ]);
    expect(issues.some((issue) => issue.code === 'duplicate_edition')).toBe(true);
    expect(issues.some((issue) => issue.code === 'invalid_edition_page')).toBe(true);
  });
});

describe('DATA-02 — ورود idempotent (AT-04)', () => {
  it('تکرار مطلق و تکرار درون بسته‌ای به duplicates می‌رود، نه fresh', () => {
    const existing = new Set(['q.1', 'q.2']);
    const { fresh, duplicates } = partitionImportBatch(
      [{ id: 'q.2' }, { id: 'q.3' }, { id: 'q.3' }, { id: 'q.1' }, { id: 'q.4' }],
      existing,
    );
    expect(fresh.map((item) => item.id)).toEqual(['q.3', 'q.4']);
    expect(duplicates.map((item) => item.id)).toEqual(['q.2', 'q.3', 'q.1']);
  });
});

describe('DATA-02 — چرخهٔ پیش‌نیاز', () => {
  it('دور در گراف مباحث پیدا می‌شود؛ گراف خطی null برمی‌گرداند', () => {
    const cycle = findPrerequisiteCycle(
      ['a', 'b', 'c'],
      [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }],
    );
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThan(2);

    expect(findPrerequisiteCycle(['a', 'b', 'c'], [{ from: 'b', to: 'a' }, { from: 'c', to: 'b' }])).toBeNull();
  });
});
