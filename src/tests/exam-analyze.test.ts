import { describe, expect, it } from 'vitest';
import { cellText, parseInlineOptions, toEnDigits } from '../../scripts/ael-exam-utils.mjs';

/**
 * AEL exam MD analysis — isolated parser tests (synthetic fixtures only,
 * no real exam text, no PDF content).
 */
describe('AEL exam parser — digits and inline options', () => {
  it('Persian digits normalize to Latin for number matching', () => {
    expect(toEnDigits('۳۲')).toBe('32');
    expect(toEnDigits('۱)')).toBe('1)');
  });

  it('parses inline paren options', () => {
    const opts = parseInlineOptions('1) red 2) green 3) blue 4) black');
    expect(opts.map((o) => o.label)).toEqual(['1', '2', '3', '4']);
  });

  it('parses Persian paren options', () => {
    const opts = parseInlineOptions('(۱) الف (۲) ب (۳) ج (۴) د');
    expect(opts).toHaveLength(4);
    expect(opts[0].label).toBe('1');
  });

  it('parses bare RTL inline options only when >=3 distinct markers', () => {
    const opts = parseInlineOptions('1 alpha 2 beta 3 gamma 4 delta');
    expect(opts).toHaveLength(4);
    // a single bare number must not become an option
    expect(parseInlineOptions('step 2 continues')).toEqual([]);
  });

  it('cellText strips tags and collapses whitespace', () => {
    expect(cellText('<td class="x">  hello   world </td>')).toBe('hello world');
  });
});
