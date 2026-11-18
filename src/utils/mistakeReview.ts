/**
 * پل «پاسخ غلط → کارت مرور».
 *
 * فقط از دادهٔ موجود استفاده می‌کند: پرسش، گزینهٔ درستِ برگشتی از سرور و
 * کارت شخصی local-first. کارت تکراری ساخته نمی‌شود و زمان‌بندی کارت موجود
 * دوباره روی «همین حالا» تنظیم می‌شود.
 */
import type { QuestionItem } from '../data/konkorData';
import { scheduleCardNow } from './flashcardSchedule';
import { upsertMistakeReviewCard } from './userFlashcards';

export interface MistakeReviewReveal {
  correctOption: number;
  explanation?: string;
  trapNote?: string;
}

export interface MistakeReviewOutcome {
  queued: boolean;
  created: boolean;
  cardId: string | null;
  reason?: string;
}

const SECTION_TO_FLASHCARD_COURSE: Record<string, string> = {
  islamic: 'bus',
  management_theories: 'sm',
  marketing: 'mkt',
  economics: 'bus',
  math_stats: 'stats',
  operations_research: 'ind',
  production: 'ind',
  english: 'lang',
};

const NODE_PREFIX_TO_FLASHCARD_COURSE: Record<string, string> = {
  mb: 'mb',
  sm: 'sm',
  stats: 'stats',
  mkt: 'mkt',
  ind: 'ind',
  inno: 'inno',
  bus: 'bus',
  pa: 'pa',
  mis: 'mis',
  fin: 'fin',
  rm: 'rm',
  hr: 'hr',
  lang: 'lang',
};

function toPersianDigits(value: string): string {
  return value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit);
}

export function flashcardCourseIdForQuestion(question: QuestionItem): string {
  const section = question.courseSectionId;
  if (section && SECTION_TO_FLASHCARD_COURSE[section]) return SECTION_TO_FLASHCARD_COURSE[section];
  const prefix = question.nodeId.split('.')[0] ?? '';
  return NODE_PREFIX_TO_FLASHCARD_COURSE[prefix] ?? 'mb';
}

export function queueMistakeReview(
  question: QuestionItem | null | undefined,
  selectedOption: number | null,
  reveal: MistakeReviewReveal | null | undefined,
): MistakeReviewOutcome {
  if (!question || !Array.isArray(question.options) || question.options.length === 0) {
    return { queued: false, created: false, cardId: null, reason: 'incomplete_question' };
  }
  if (selectedOption === null || !Number.isInteger(selectedOption)) {
    return { queued: false, created: false, cardId: null, reason: 'skipped' };
  }
  const correctOption = reveal?.correctOption;
  if (typeof correctOption !== 'number' || !Number.isInteger(correctOption) || !question.options[correctOption]) {
    return { queued: false, created: false, cardId: null, reason: 'missing_correct_answer' };
  }
  if (selectedOption === correctOption) {
    return { queued: false, created: false, cardId: null, reason: 'correct' };
  }

  const yearLabel = question.examYear ? `کنکور ${toPersianDigits(String(question.examYear))}` : 'تمرین';
  const questionNumber = question.bookletQuestionNumber
    ? ` · سؤال ${toPersianDigits(String(question.bookletQuestionNumber))}`
    : '';
  const sourceLabel = `مرور خطا · ${yearLabel}${questionNumber}`;
  const explanation = [reveal?.explanation, reveal?.trapNote].filter(Boolean).join('\n');
  const result = upsertMistakeReviewCard({
    questionId: question.id,
    nodeId: question.nodeId,
    questionText: question.text,
    options: question.options,
    selectedOption,
    correctAnswer: question.options[correctOption],
    explanation,
    sourceLabel,
    courseId: flashcardCourseIdForQuestion(question),
    examYear: question.examYear,
  });
  if (!result.card) {
    return { queued: false, created: false, cardId: null, reason: result.errors[0] ?? 'storage_error' };
  }
  scheduleCardNow(result.card.id);
  return { queued: true, created: result.created, cardId: result.card.id };
}
