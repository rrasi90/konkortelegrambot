import { describe, expect, it } from 'vitest';
import { STUDY_MODES, type StudyCard } from '../data/flashcardDeck';
import {
  answerForMode,
  buildChoiceOptions,
  buildCloze,
  expectedForMode,
  isChoiceMode,
  isTypedMode,
  promptForMode,
  supportsMode,
} from '../utils/studyModes';

function card(overrides: Partial<StudyCard> & Pick<StudyCard, 'id' | 'front' | 'back'>): StudyCard {
  return {
    courseId: 'mkt',
    courseTitle: 'بازاریابی',
    source: 'دستی',
    layer: 'L1',
    type: 'term',
    difficulty: 'basic',
    origin: 'authored',
    tags: [],
    ...overrides,
  };
}

const target = card({
  id: 'target',
  front: 'نیاز پنهان مشتری چیست',
  back: 'نیازی که مشتری از بیان آن آگاه است اما آن را نمی‌گوید.',
});

const deck = [
  target,
  card({ id: 'a', front: 'نیاز آشکار', back: 'نیازی که مشتری آن را بیان می‌کند.' }),
  card({ id: 'b', front: 'تقاضا', back: 'نیاز پشتیبانی‌شده با قدرت خرید.' }),
  card({ id: 'c', front: 'ارزش مشتری', back: 'تفاوت میان منافع و هزینه‌های ادراک‌شده.' }),
  card({ id: 'd', front: 'رضایت', back: 'نتیجهٔ مقایسهٔ انتظار با عملکرد.' }),
];

describe('twelve review modes', () => {
  it('exposes twelve modes in two groups', () => {
    expect(STUDY_MODES).toHaveLength(12);
    expect(new Set(STUDY_MODES.map((mode) => mode.id)).size).toBe(12);
    expect(STUDY_MODES.filter((mode) => mode.group === 'main')).toHaveLength(6);
  });

  it('builds a meaningful cloze and rejects one-word prompts', () => {
    const cloze = buildCloze(target.front);
    expect(cloze).not.toBeNull();
    expect(cloze?.prompt).toContain('____');
    expect(cloze?.answer.length).toBeGreaterThan(2);
    expect(buildCloze('تقاضا')).toBeNull();
    expect(supportsMode(target, 'cloze')).toBe(true);
    expect(supportsMode(card({ id: 'one', front: 'تقاضا', back: 'نیاز پشتیبانی‌شده.' }), 'cloze')).toBe(false);
  });

  it('swaps prompt and answer for reverse mode', () => {
    expect(promptForMode(target, 'reverse')).toBe(target.back);
    expect(expectedForMode(target, 'reverse')).toBe(target.front);
    expect(answerForMode(target, 'reverse')).toBe(target.front);
    expect(isTypedMode('reverse')).toBe(true);
  });

  it('builds four unique choices with the correct answer included', () => {
    const options = buildChoiceOptions(target, deck, 'front');
    expect(options).toHaveLength(4);
    expect(options).toContain(target.front);
    expect(new Set(options).size).toBe(4);
    expect(isChoiceMode('term_choice')).toBe(true);
    expect(isChoiceMode('answer_choice')).toBe(true);
  });

  it('builds answer choices without duplicate correct entries', () => {
    const options = buildChoiceOptions(target, deck, 'back');
    expect(options).toContain(target.back);
    expect(options.filter((option) => option === target.back)).toHaveLength(1);
    expect(new Set(options).size).toBe(options.length);
  });
});
