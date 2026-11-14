/**
 * AEL — یک لایهٔ تمیز برای کارت‌های مطالعه.
 *
 * چرا این فایل وجود دارد:
 * - ۸۷۳ کارت انکی در `flashcardsAnkiImport.ts` ذخیره شده‌اند، اما هیچ‌جا مصرف نمی‌شوند.
 * - نیمی از آن‌ها پاسخ تصویری دارند و فایل تصویرشان در پروژه نیست.
 * - جبهه‌های تکراری، HTML خام و تگ‌های ناسازگار دارند.
 *
 * این لایه فقط کارت‌های متنی قابل استفاده را عبور می‌دهد، HTML را پاک می‌کند،
 * تکراری‌ها را حذف می‌کند و یک شناسهٔ پایدار می‌سازد. کارت خام دست‌نخورده می‌ماند.
 * کارت تصویری قرنطینه می‌شود و هرگز به جلسهٔ مرور نمی‌رسد.
 */
import { FLASHCARDS, FLASHCARD_COURSES, type Flashcard } from './flashcards';
import { ANKI_IMPORTED_FLASHCARDS, type AnkiFlashcardItem } from './flashcardsAnkiImport';
import { normalizeCardText, stripAnkiHtml } from '../utils/cardText';

export { normalizeCardText, stripAnkiHtml } from '../utils/cardText';

export type CardLayer = 'L1' | 'L2' | 'L3';
export type StudyCardType = 'term' | 'concept' | 'formula' | 'comparison' | 'question' | 'cloze';
export type StudyCardOrigin = 'authored' | 'anki' | 'user';

export interface StudyCard {
  id: string;
  courseId: string;
  courseTitle: string;
  front: string;
  back: string;
  extra?: string;
  source: string;
  layer: CardLayer;
  type: StudyCardType;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  origin: StudyCardOrigin;
  tags: string[];
  /** گرهٔ دانش مبدأ برای پرش به درسنامه؛ فقط کارت‌های دارای مبحث. */
  nodeId?: string;
  /** علت خطایی که این کارت از آن ساخته شده؛ برای تغییر پرسش مرور. */
  reviewReason?: string;
}

export type StudyModeId =
  | 'reveal'
  | 'type'
  | 'self'
  | 'cloze'
  | 'reverse'
  | 'term_choice'
  | 'answer_choice'
  | 'audio'
  | 'free_recall'
  | 'confidence'
  | 'scenario'
  | 'formula';

export interface StudyMode {
  id: StudyModeId;
  label: string;
  hint: string;
  group: 'main' | 'more';
}

export const STUDY_MODES: StudyMode[] = [
  { id: 'reveal', label: 'نمایش پاسخ', hint: 'کارت را ببین، پاسخ را بازیابی کن، بعد خودت امتیاز بده.', group: 'main' },
  { id: 'type', label: 'تعریف ← تایپ', hint: 'تعریف را می‌بینی و اصطلاح را تایپ می‌کنی. مناسب کارت‌های کوتاه.', group: 'main' },
  { id: 'self', label: 'توضیح شفاهی', hint: 'با صدای بلند توضیح بده، بعد پاسخ را ببین و امتیاز بده.', group: 'main' },
  { id: 'cloze', label: 'جای خالی', hint: 'یک واژهٔ کلیدی از صورت پرسش حذف می‌شود و آن را تایپ می‌کنی.', group: 'main' },
  { id: 'reverse', label: 'پاسخ ← پرسش', hint: 'پاسخ را می‌بینی و صورت پرسش را از حافظه می‌سازی.', group: 'main' },
  { id: 'free_recall', label: 'بازگویی آزاد', hint: 'هرچه از این مبحث می‌دانی بنویس، بعد پاسخ را ببین.', group: 'main' },
  { id: 'term_choice', label: 'انتخاب اصطلاح', hint: 'از میان چهار اصطلاح، اصطلاح درست را انتخاب می‌کنی.', group: 'more' },
  { id: 'answer_choice', label: 'انتخاب پاسخ', hint: 'از میان چهار پاسخ، پاسخ درست را انتخاب می‌کنی.', group: 'more' },
  { id: 'audio', label: 'شنیداری', hint: 'صورت پرسش با صدای مرورگر خوانده می‌شود؛ بعد پاسخ را می‌بینی.', group: 'more' },
  { id: 'confidence', label: 'نمایش با اطمینان', hint: 'پاسخ را می‌بینی و پیش از امتیاز، میزان اطمینانت را ثبت می‌کنی.', group: 'more' },
  { id: 'scenario', label: 'سناریو', hint: 'پرسش را در یک موقعیت واقعی توضیح می‌دهی، بعد پاسخ را می‌بینی.', group: 'more' },
  { id: 'formula', label: 'فرمول ← تایپ', hint: 'صورت فرمول را می‌بینی و پاسخ یا قدم اول را تایپ می‌کنی.', group: 'more' },
];

export type FlashcardSessionMode = StudyModeId;

const COURSE_TITLE = new Map<string, string>(FLASHCARD_COURSES.map((course) => [course.id, course.title]));

const ANKI_COURSE: Record<string, string> = {
  marketing: 'mkt',
  management_theory: 'sm',
  islamic_management: 'bus',
  economics_micro: 'bus',
};

function layerForAuthored(card: Flashcard): CardLayer {
  if (card.type === 'comparison' || card.type === 'question') return 'L2';
  if (card.type === 'formula') return card.difficulty === 'basic' ? 'L1' : 'L2';
  if (card.difficulty === 'advanced') return 'L3';
  return 'L1';
}

function authoredCourseId(card: Flashcard): string {
  return card.nodeId.split('.')[0] ?? 'mb';
}

function toAuthoredCard(card: Flashcard): StudyCard {
  const courseId = authoredCourseId(card);
  return {
    id: card.id,
    courseId,
    courseTitle: COURSE_TITLE.get(courseId) ?? 'مرور کتاب',
    front: stripAnkiHtml(card.front),
    back: stripAnkiHtml(card.back),
    extra: card.extra ? stripAnkiHtml(card.extra) : undefined,
    source: card.source,
    layer: layerForAuthored(card),
    type: card.type,
    difficulty: card.difficulty,
    origin: 'authored',
    tags: card.tags,
    nodeId: card.nodeId,
  };
}

function toAnkiCard(card: AnkiFlashcardItem): StudyCard | null {
  if (/<img/i.test(card.back)) return null;
  const front = stripAnkiHtml(card.front);
  const back = stripAnkiHtml(card.back);
  if (!front || back.length < 10) return null;
  const courseId = ANKI_COURSE[card.subjectId] ?? 'bus';
  return {
    id: `anki.${card.id}`,
    courseId,
    courseTitle: COURSE_TITLE.get(courseId) ?? 'مرور کتاب',
    front,
    back,
    source: `ورودی انکی: ${card.sourceDeck}`,
    layer: 'L1',
    type: 'term',
    difficulty: 'basic',
    origin: 'anki',
    tags: card.tags,
  };
}

function dedupeByFront(cards: StudyCard[]): StudyCard[] {
  const seen = new Set<string>();
  const out: StudyCard[] = [];
  for (const card of cards) {
    const key = normalizeCardText(card.front);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

export const AUTHORED_STUDY_CARDS: StudyCard[] = dedupeByFront(FLASHCARDS.map(toAuthoredCard));

export const ANKI_STUDY_CARDS: StudyCard[] = dedupeByFront(
  ANKI_IMPORTED_FLASHCARDS.map(toAnkiCard).filter((card): card is StudyCard => card !== null),
);

export const BUILT_IN_STUDY_DECK: StudyCard[] = [...AUTHORED_STUDY_CARDS, ...ANKI_STUDY_CARDS];

export function withUserCards(userCards: StudyCard[]): StudyCard[] {
  return dedupeByFront([...userCards, ...BUILT_IN_STUDY_DECK]);
}

export function buildStudyDeck(userCards: StudyCard[] = []): StudyCard[] {
  return withUserCards(userCards);
}

export function cardCourseLabel(card: StudyCard): string {
  return card.courseTitle;
}

export function clozeFront(front: string): string | null {
  const words = front.trim().split(/\s+/);
  if (words.length < 2 || front.length > 80) return null;
  return `${words.slice(0, -1).join(' ')} ____`;
}

export function normalizeTypedAnswer(value: string): string {
  return normalizeCardText(value)
    .replace(/^ال|^یک\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isTypedAnswerCorrect(expected: string, typed: string): boolean {
  const a = normalizeTypedAnswer(expected);
  const b = normalizeTypedAnswer(typed);
  if (!a || !b) return false;
  if (a === b) return true;
  // پاسخ کوتاه‌تر یا بلندتر با فاصلهٔ کم پذیرفته می‌شود؛ نه تطبیق سستِ دلخواه.
  return a.includes(b) && b.length >= Math.max(3, Math.floor(a.length * 0.6));
}

/** فقط برای آمار و نمایش در UI. */
export const DECK_STATS = {
  authored: AUTHORED_STUDY_CARDS.length,
  ankiUsable: ANKI_STUDY_CARDS.length,
  ankiRaw: ANKI_IMPORTED_FLASHCARDS.length,
  quarantinedImages: ANKI_IMPORTED_FLASHCARDS.filter((card) => /<img/i.test(card.front) || /<img/i.test(card.back)).length,
} as const;
