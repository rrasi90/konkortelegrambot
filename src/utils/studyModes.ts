/** منطق خالص حالت‌های مرور: پرسش، پاسخexpected و گزینه‌های انحرافی. */
import type { FlashcardSessionMode, StudyCard } from '../data/flashcardDeck';
import { normalizeCardText } from './cardText';

const STOP_WORDS = new Set([
  'است', 'هست', 'چه', 'چیست', 'کدام', 'کدام‌اند', 'را', 'با', 'در', 'از', 'به', 'و', 'یا',
  'که', 'این', 'آن', 'برای', 'بر', 'می', 'شود', 'می‌شود', 'کن', 'کنید', 'توضیح', 'بده',
]);

export interface ClozeParts {
  prompt: string;
  answer: string;
}

/** یک واژهٔ محتوایی را جای خالی می‌کند؛ اگر واژهٔ مناسبی نباشد null می‌دهد. */
export function buildCloze(front: string): ClozeParts | null {
  const words = front.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let bestIndex = -1;
  let bestLength = 0;
  words.forEach((word, index) => {
    const clean = normalizeCardText(word).replace(/[.،؛:!؟?()]/g, '');
    if (clean.length < 3 || STOP_WORDS.has(clean)) return;
    if (clean.length >= bestLength) {
      bestLength = clean.length;
      bestIndex = index;
    }
  });
  if (bestIndex < 0) return null;
  const answer = words[bestIndex]!.replace(/[.،؛:!؟?()]/g, '');
  const prompt = words.map((word, index) => (index === bestIndex ? '____' : word)).join(' ');
  return { prompt, answer };
}

export function isTypedMode(mode: FlashcardSessionMode): boolean {
  return mode === 'type' || mode === 'reverse' || mode === 'cloze' || mode === 'formula';
}

export function isChoiceMode(mode: FlashcardSessionMode): boolean {
  return mode === 'term_choice' || mode === 'answer_choice';
}

export function promptForMode(card: StudyCard, mode: FlashcardSessionMode): string {
  if (mode === 'type' || mode === 'term_choice') return card.back;
  if (mode === 'reverse') return card.back;
  if (mode === 'cloze') return buildCloze(card.front)?.prompt ?? card.front;
  return card.front;
}

export function expectedForMode(card: StudyCard, mode: FlashcardSessionMode): string {
  if (mode === 'type' || mode === 'term_choice' || mode === 'reverse') return card.front;
  if (mode === 'cloze') return buildCloze(card.front)?.answer ?? card.back;
  return card.back;
}

export function answerForMode(card: StudyCard, mode: FlashcardSessionMode): string {
  if (mode === 'reverse') return card.front;
  if (mode === 'type' || mode === 'cloze' || mode === 'term_choice') return expectedForMode(card, mode);
  return card.back;
}

export function supportsMode(card: StudyCard, mode: FlashcardSessionMode): boolean {
  if (mode === 'cloze') return buildCloze(card.front) !== null;
  if (mode === 'type' || mode === 'reverse' || mode === 'formula') {
    if (card.type === 'question' && mode === 'type') return false;
    return card.front.length <= 160 && card.back.length <= 420;
  }
  return true;
}

function hash(value: string): number {
  let out = 0;
  for (let index = 0; index < value.length; index += 1) {
    out = (out * 31 + value.charCodeAt(index)) >>> 0;
  }
  return out;
}

/** گزینه‌های یک سؤال چهارگزینه‌ای را از کارت‌های همان درس می‌سازد. */
export function buildChoiceOptions(
  card: StudyCard,
  deck: StudyCard[],
  kind: 'front' | 'back',
): string[] {
  const correct = kind === 'front' ? card.front : card.back;
  const seen = new Set([normalizeCardText(correct)]);
  const pool: string[] = [];
  const sameCourse = deck.filter((item) => item.id !== card.id && item.courseId === card.courseId);
  const others = deck.filter((item) => item.id !== card.id && item.courseId !== card.courseId);
  for (const item of [...sameCourse, ...others]) {
    const value = kind === 'front' ? item.front : item.back;
    const key = normalizeCardText(value);
    if (!key || seen.has(key) || value.length > 220) continue;
    seen.add(key);
    pool.push(value);
    if (pool.length >= 12) break;
  }
  const offset = pool.length > 0 ? hash(card.id) % pool.length : 0;
  const distractors = [...pool.slice(offset), ...pool.slice(0, offset)].slice(0, 3);
  const options = [correct, ...distractors];
  const rotate = hash(`${card.id}:${kind}`) % options.length;
  return [...options.slice(rotate), ...options.slice(0, rotate)];
}
