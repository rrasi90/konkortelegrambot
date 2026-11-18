/**
 * کارت شخصی — نسخهٔ اول local-first.
 *
 * چرا local-first: شکل snapshot موجود `ael_tma_state_v4` نباید عوض شود و
 * همگام‌سازی سروری در فاز بعد می‌آید. کارت‌ها روی همین دستگاه می‌مانند و
 * با JSON/TSV قابل پشتیبان‌گیری‌اند. هر کارت خصوصی است.
 */
import type { CardLayer, StudyCard } from '../data/flashcardDeck';
import { normalizeCardText, stripAnkiHtml } from './cardText';

export type MistakeReviewReason =
  | 'concept_gap'
  | 'prerequisite_failure'
  | 'misread'
  | 'slip';

export interface UserFlashcard {
  id: string;
  front: string;
  back: string;
  extra: string;
  courseId: string;
  layer: CardLayer;
  createdAt: string;
  /** شناسهٔ پرسش مبدأ؛ برای کارت‌های ساخته‌شده از پاسخ غلط. */
  sourceQuestionId?: string;
  /** گرهٔ دانش مبدأ برای پرش به درسنامه. */
  sourceNodeId?: string;
  /** برچسب منبع نمایشی، مثل «مرور خطا · کنکور ۱۴۰۵». */
  sourceLabel?: string;
  /** علت خطا برای تغییر پرسش مرور. */
  reviewReason?: MistakeReviewReason;
  /** کارت حل‌شده از صف مرور خارج می‌شود بدون اینکه حذف شود. */
  suspended?: boolean;
}

export interface MistakeReviewInput {
  questionId: string;
  nodeId?: string;
  questionText: string;
  options?: string[];
  selectedOption?: number | null;
  correctAnswer: string;
  explanation?: string;
  sourceLabel: string;
  courseId: string;
  examYear?: number;
}

export interface MistakeReviewResult {
  card: UserFlashcard | null;
  created: boolean;
  errors: string[];
}

export interface UserFlashcardInput {
  front: string;
  back: string;
  extra?: string;
  courseId: string;
  layer: CardLayer;
}

export interface ImportResult {
  cards: UserFlashcard[];
  errors: string[];
}

export const USER_FLASHCARDS_KEY = 'ael.user.flashcards.v1';
export const USER_FLASHCARDS_EVENT = 'ael:user-flashcards-changed';
const MAX_CARDS = 500;

function newId(): string {
  try {
    return `user.${crypto.randomUUID()}`;
  } catch {
    return `user.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  }
}

function read(): UserFlashcard[] {
  try {
    const raw = localStorage.getItem(USER_FLASHCARDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is UserFlashcard => {
      if (!value || typeof value !== 'object') return false;
      const item = value as Partial<UserFlashcard>;
      return (
        typeof item.id === 'string' &&
        typeof item.front === 'string' &&
        typeof item.back === 'string' &&
        typeof item.courseId === 'string' &&
        (item.layer === 'L1' || item.layer === 'L2' || item.layer === 'L3')
      );
    });
  } catch {
    return [];
  }
}

function write(cards: UserFlashcard[]): boolean {
  try {
    localStorage.setItem(USER_FLASHCARDS_KEY, JSON.stringify(cards.slice(0, MAX_CARDS)));
  } catch {
    // ذخیرهٔ محلی ناموفق نباید فرم را بترساند؛ UI پیام خطای خودش را دارد.
    return false;
  }
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(USER_FLASHCARDS_EVENT));
    }
  } catch {
    // رویداد فقط برای تازه‌سازی UI است؛ ذخیرهٔ موفق را ناموفق نشان نده.
  }
  return true;
}

function truncate(value: string, max: number): string {
  const clean = stripAnkiHtml(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function loadUserFlashcards(): UserFlashcard[] {
  return read();
}

export function validateUserCard(
  input: UserFlashcardInput,
  existing: UserFlashcard[] = read(),
): string[] {
  const errors: string[] = [];
  const front = stripAnkiHtml(input.front);
  const back = stripAnkiHtml(input.back);
  if (!front) errors.push('روی کارت نمی‌تواند خالی باشد.');
  if (!back) errors.push('پاسخ کارت نمی‌تواند خالی باشد.');
  if (front.length > 160) errors.push('روی کارت بلند است؛ آن را کوتاه‌تر کن.');
  if (input.layer === 'L1' && back.length > 280) errors.push('پاسخ L1 باید کوتاه باشد؛ حداکثر یک جمله یا سه بولت.');
  if (input.layer !== 'L1' && back.length > 420) errors.push('پاسخ L2/L3 حداکثر دو جمله باشد؛ جزئیات را در توضیح بگذار.');
  const normalized = normalizeCardText(front);
  if (normalized && existing.some((card) => normalizeCardText(card.front) === normalized)) {
    errors.push('کارت مشابه در کارت‌های من وجود دارد.');
  }
  return errors;
}

export function addUserFlashcard(input: UserFlashcardInput): { card: UserFlashcard | null; errors: string[] } {
  const existing = read();
  const errors = validateUserCard(input, existing);
  if (errors.length > 0) return { card: null, errors };
  if (existing.length >= MAX_CARDS) {
    return { card: null, errors: ['سقف کارت‌های شخصی پر شده است.'] };
  }
  const card: UserFlashcard = {
    id: newId(),
    front: stripAnkiHtml(input.front),
    back: stripAnkiHtml(input.back),
    extra: stripAnkiHtml(input.extra ?? ''),
    courseId: input.courseId,
    layer: input.layer,
    createdAt: new Date().toISOString(),
  };
  write([card, ...existing]);
  return { card, errors: [] };
}

/**
 * کارت مرور یک پرسش غلط را می‌سازد یا همان کارت قبلی را به‌روز می‌کند.
 * dedupe بر اساس شناسهٔ پرسش است، نه متن؛ پس چند پاسخ غلط یک کارت می‌سازند.
 */
export function upsertMistakeReviewCard(input: MistakeReviewInput): MistakeReviewResult {
  const questionId = input.questionId.trim();
  if (!questionId) return { card: null, created: false, errors: ['شناسهٔ پرسش برای ساخت کارت مرور لازم است.'] };
  // متن پرسش باید کامل بماند؛ بریدن شرط مسئله، کارت را مبهم می‌کند.
  const questionText = truncate(input.questionText, 420);
  const answer = truncate(input.correctAnswer, 280);
  if (!questionText || !answer) {
    return { card: null, created: false, errors: ['متن پرسش یا پاسخ درست برای ساخت کارت کامل نیست.'] };
  }
  const existing = read();
  const previous = existing.find((card) => card.sourceQuestionId === questionId);
  if (!previous && existing.length >= MAX_CARDS) {
    return { card: null, created: false, errors: ['سقف کارت‌های شخصی پر شده است.'] };
  }
  const explanation = input.explanation?.trim() ?? '';
  const options = (input.options ?? []).filter((option) => option.trim());
  const fa = (value: number) => String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
  const optionsText = options.length > 0
    ? `گزینه‌ها:\n${options.map((option, index) => `${fa(index + 1)}) ${stripAnkiHtml(option)}`).join('\n')}`
    : '';
  const selectedText = typeof input.selectedOption === 'number' && options[input.selectedOption]
    ? `پاسخ شما: گزینهٔ ${fa(input.selectedOption + 1)}`
    : '';
  const card: UserFlashcard = {
    id: previous?.id ?? newId(),
    front: questionText,
    back: answer,
    extra: [
      input.questionText.trim(),
      optionsText,
      selectedText,
      explanation ? `پاسخ تشریحی: ${explanation}` : '',
      `منبع: ${input.sourceLabel}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    courseId: input.courseId.trim() || 'mb',
    layer: 'L2',
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    sourceQuestionId: questionId,
    sourceNodeId: input.nodeId,
    sourceLabel: input.sourceLabel,
    reviewReason: previous?.reviewReason,
    suspended: false,
  };
  if (!write([card, ...existing.filter((item) => item.id !== card.id)])) {
    return { card: null, created: false, errors: ['ذخیرهٔ کارت مرور در این دستگاه ممکن نشد.'] };
  }
  return { card, created: !previous, errors: [] };
}

export function removeUserFlashcard(id: string): void {
  write(read().filter((card) => card.id !== id));
}

function updateMistakeCards(
  questionId: string,
  update: (card: UserFlashcard) => UserFlashcard,
): boolean {
  const cards = read();
  const next = cards.map((card) =>
    card.sourceQuestionId === questionId ? update(card) : card,
  );
  if (next.every((card, index) => card === cards[index])) return true;
  return write(next);
}

/** کارت حل‌شده را از صف خارج می‌کند؛ خود کارت برای تاریخچه می‌ماند. */
export function setMistakeReviewCardSuspended(questionId: string, suspended: boolean): boolean {
  return updateMistakeCards(questionId, (card) => ({ ...card, suspended }));
}

/** علت خطا را روی کارت ذخیره می‌کند تا پرسش مرور هدفمند شود. */
export function setMistakeReviewCardReason(questionId: string, reason: MistakeReviewReason): boolean {
  return updateMistakeCards(questionId, (card) => ({ ...card, reviewReason: reason }));
}

/** حذف کامل کارت مشتق‌شده از دفتر خطا. */
export function removeMistakeReviewCard(questionId: string): boolean {
  const cards = read();
  const next = cards.filter((card) => card.sourceQuestionId !== questionId);
  if (next.length === cards.length) return true;
  return write(next);
}

export function updateUserFlashcard(id: string, input: UserFlashcardInput): { errors: string[] } {
  const existing = read();
  const others = existing.filter((card) => card.id !== id);
  const errors = validateUserCard(input, others);
  if (errors.length > 0) return { errors };
  write(
    existing.map((card) =>
      card.id === id
        ? {
            ...card,
            front: stripAnkiHtml(input.front),
            back: stripAnkiHtml(input.back),
            extra: stripAnkiHtml(input.extra ?? ''),
            courseId: input.courseId,
            layer: input.layer,
          }
        : card,
    ),
  );
  return { errors: [] };
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      values.push(value);
      value = '';
      continue;
    }
    value += char;
  }
  values.push(value);
  return values.map((item) => item.trim());
}

function parseJsonImport(text: string, fallbackCourseId: string, fallbackLayer: CardLayer): ImportResult | null {
  try {
    const parsed: unknown = JSON.parse(text);
    const rawCards = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { cards?: unknown }).cards)
        ? (parsed as { cards: unknown[] }).cards
        : null;
    if (!rawCards) return null;
    const cards: UserFlashcard[] = [];
    const errors: string[] = [];
    const seen = new Set(read().map((card) => normalizeCardText(card.front)));
    rawCards.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object') {
        errors.push(`کارت ${index + 1}: ساختار معتبر نیست.`);
        return;
      }
      const item = raw as Record<string, unknown>;
      const front = stripAnkiHtml(typeof item.front === 'string' ? item.front : '');
      const back = stripAnkiHtml(typeof item.back === 'string' ? item.back : '');
      const key = normalizeCardText(front);
      if (!front || !back) {
        errors.push(`کارت ${index + 1}: روی کارت یا پاسخ خالی است.`);
        return;
      }
      if (seen.has(key)) {
        errors.push(`کارت ${index + 1}: کارت تکراری است.`);
        return;
      }
      const itemLayer = item.layer === 'L1' || item.layer === 'L2' || item.layer === 'L3'
        ? item.layer
        : fallbackLayer;
      if (back.length > 420) {
        errors.push(`کارت ${index + 1}: پاسخ بلندتر از حد مجاز است.`);
        return;
      }
      seen.add(key);
      cards.push({
        id: newId(),
        front,
        back,
        extra: stripAnkiHtml(typeof item.extra === 'string' ? item.extra : ''),
        courseId: typeof item.courseId === 'string' && item.courseId.trim() ? item.courseId.trim() : fallbackCourseId,
        layer: itemLayer,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        ...(typeof item.sourceQuestionId === 'string' ? { sourceQuestionId: item.sourceQuestionId } : {}),
        ...(typeof item.sourceNodeId === 'string' ? { sourceNodeId: item.sourceNodeId } : {}),
        ...(typeof item.sourceLabel === 'string' ? { sourceLabel: item.sourceLabel } : {}),
        ...(item.suspended === true ? { suspended: true } : {}),
      });
    });
    return { cards, errors };
  } catch {
    return null;
  }
}

/** ورودی ساده: هر خط «روی کارت TAB پاسخ»، CSV، یا فایل پشتیبان JSON. */
export function parseFlashcardImport(text: string, courseId: string, layer: CardLayer): ImportResult {
  const json = parseJsonImport(text.trim(), courseId, layer);
  if (json) return json;
  const cards: UserFlashcard[] = [];
  const errors: string[] = [];
  const existing = read();
  const seen = new Set(existing.map((card) => normalizeCardText(card.front)));
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.includes('\t')
      ? trimmed.split('\t')
      : trimmed.includes(' | ')
        ? trimmed.split(/\s+\|\s+/)
        : splitCsvLine(trimmed);
    if (parts.length < 2) {
      errors.push(`خط ${index + 1}: دو ستون «روی کارت» و «پاسخ» لازم است.`);
      return;
    }
    if (parts.length > 3) {
      errors.push(`خط ${index + 1}: بیش از سه ستون دارد؛ ستون اضافی نادیده گرفته شد.`);
    }
    const front = stripAnkiHtml(parts[0] ?? '');
    const back = stripAnkiHtml(parts[1] ?? '');
    const key = normalizeCardText(front);
    if (!front || !back) {
      errors.push(`خط ${index + 1}: یکی از دو ستون خالی است.`);
      return;
    }
    if (seen.has(key)) {
      errors.push(`خط ${index + 1}: کارت تکراری است.`);
      return;
    }
    if (back.length > 420) {
      errors.push(`خط ${index + 1}: پاسخ بلندتر از حد مجاز است.`);
      return;
    }
    seen.add(key);
    cards.push({
      id: newId(),
      front,
      back,
      extra: stripAnkiHtml(parts[2] ?? ''),
      courseId,
      layer,
      createdAt: new Date().toISOString(),
    });
    return;
  });
  return { cards, errors };
}

export function commitImportedCards(cards: UserFlashcard[]): void {
  if (cards.length === 0) return;
  write([...cards, ...read()].slice(0, MAX_CARDS));
}

/** پشتیبان کامل کارت‌های شخصی برای انتقال دستی بین دستگاه‌ها. */
export function serializeFlashcardBackup(cards: UserFlashcard[] = read()): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), cards }, null, 2);
}

export function userCardToStudyCard(card: UserFlashcard, courseTitle: string): StudyCard {
  const fromMistake = Boolean(card.sourceQuestionId);
  return {
    id: card.id,
    courseId: card.courseId,
    courseTitle,
    front: card.front,
    back: card.back,
    extra: card.extra || undefined,
    source: card.sourceLabel || 'کارت شخصی',
    layer: card.layer,
    type: fromMistake ? 'question' : 'term',
    difficulty: card.layer === 'L3' ? 'advanced' : card.layer === 'L2' ? 'intermediate' : 'basic',
    origin: 'user',
    tags: fromMistake ? ['کارت شخصی', 'مرور خطا'] : ['کارت شخصی'],
    nodeId: card.sourceNodeId,
    reviewReason: card.reviewReason,
  };
}

export function userFlashcardsToStudyCards(cards: UserFlashcard[], courseTitleFor: (courseId: string) => string): StudyCard[] {
  return cards
    .filter((card) => !card.suspended)
    .map((card) => userCardToStudyCard(card, courseTitleFor(card.courseId)));
}
