import type { BookChapter } from './bookChaptersTypes';
import type { QuestionItem } from './konkorData';
import { isAuthoredQuestion } from './chapterAuthoredQuestions';

export type ChapterCardKind =
  | 'overview'
  | 'pretest'
  | 'point'
  | 'formula'
  | 'example'
  | 'trap'
  | 'retrieval'
  | 'question';

export interface ChapterStudyCard {
  id: string;
  kind: ChapterCardKind;
  label: string;
  front: string;
  back: string;
  hint?: string;
  source?: string;
  questionId?: string;
}

const STOP_WORDS = new Set([
  'مدیریت',
  'بازاریابی',
  'کدام',
  'کدامیک',
  'کدام‌یک',
  'چه',
  'است',
  'باشد',
  'شود',
  'شده',
  'کند',
  'دهد',
  'برای',
  'این',
  'آن',
  'را',
  'در',
  'به',
  'از',
  'با',
  'بر',
  'یک',
  'و',
  'یا',
  'می',
  'های',
  'ها',
]);

const normalize = (value: string): string =>
  value
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[«»:؛،.()\[\]{}؟!\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const keywords = (value: string): string[] =>
  normalize(value)
    .split(' ')
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

/**
 * اگر شناسهٔ فصل روی سؤال ثبت نشده باشد، از متن منبع/صورت سؤال
 * بهترین فصل را پیدا می‌کند. در تساوی، هیچ فصلی انتخاب نمی‌شود.
 */
export const findBestChapterForQuestion = (
  chapters: BookChapter[],
  question: QuestionItem
): BookChapter | null => {
  const source = normalize(
    `${question.text} ${question.designedFromTextbook ?? ''} ${question.sourceReference ?? ''}`
  );
  const scored = chapters.map((chapter) => {
    const titleScore = keywords(chapter.title).filter((word) => source.includes(word)).length * 2;
    const noteScore = keywords(chapter.points.join(' ')).filter((word) => source.includes(word)).length;
    return { chapter, score: titleScore + noteScore };
  });
  const sorted = scored.sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const second = sorted[1];
  if (!best || best.score < 2) return null;
  if (second && second.score === best.score) return null;
  return best.chapter;
};

const fa = (n: number) => n.toLocaleString('fa-IR');

const overviewBack = (chapter: BookChapter): string => {
  const parts: string[] = [];
  if (chapter.objectives?.length) {
    parts.push(
      'در پایان این فصل باید بتوانی:\n' +
        chapter.objectives
          .slice(0, 3)
          .map((objective, index) => `${fa(index + 1)}) ${objective}`)
          .join('\n')
    );
  }
  if (chapter.prerequisites?.length) {
    parts.push('پیش‌نیازها: ' + chapter.prerequisites.join('، '));
  }
  if (parts.length === 0) {
    parts.push('نکات آموزشی این فصل را بخوان و بعد با کارت‌های بعدی خودت را بسنج.');
  }
  return parts.join('\n\n');
};

/**
 * کارت‌های مطالعهٔ یک فصل از داده‌های موجود ساخته می‌شوند.
 * هیچ کلید پاسخ یا محتوای ساختگی وارد کارت نمی‌شود؛ تست‌ها فقط صورت سؤال و گزینه‌ها را نشان می‌دهند.
 */
export const buildChapterStudyCards = (
  chapter: BookChapter,
  questions: QuestionItem[] = []
): ChapterStudyCard[] => {
  const cards: ChapterStudyCard[] = [];

  if (chapter.objectives?.length || chapter.prerequisites?.length) {
    cards.push({
      id: `${chapter.id}-overview`,
      kind: 'overview',
      label: 'نقشهٔ فصل',
      front: 'در این فصل چه چیزی یاد می‌گیری و از کجا شروع می‌کنی؟',
      back: overviewBack(chapter),
      hint: 'اول هدف‌ها را بخوان، بعد پیش‌نیازها را مرور کن.',
    });
  }

  chapter.pretest?.forEach((prompt, index) => {
    cards.push({
      id: `${chapter.id}-pre-${index}`,
      kind: 'pretest',
      label: 'قبل از خواندن',
      front: prompt.question,
      back: prompt.answer,
      hint: prompt.hint,
    });
  });

  chapter.points.forEach((point, index) => {
    cards.push({
      id: `${chapter.id}-point-${index}`,
      kind: 'point',
      label: 'نکتهٔ آموزشی',
      front: `نکتهٔ کلیدی ${fa(index + 1)} این فصل چه بود؟`,
      back: point,
    });
  });

  chapter.formulas?.forEach((formula, index) => {
    cards.push({
      id: `${chapter.id}-formula-${index}`,
      kind: 'formula',
      label: 'فرمول / مدل',
      front: `فرمول یا مدل کلیدی ${fa(index + 1)} این فصل را بنویس.`,
      back: formula,
    });
  });

  if (chapter.workedExample) {
    cards.push({
      id: `${chapter.id}-example`,
      kind: 'example',
      label: 'مثال حل‌شده',
      front: `${chapter.workedExample.title} — گام‌های حل را به ترتیب بگو.`,
      back:
        chapter.workedExample.steps.map((step, index) => `${fa(index + 1)}) ${step}`).join('\n') +
        (chapter.workedExample.takeaway
          ? `\n\nنکتهٔ کلیدی: ${chapter.workedExample.takeaway}`
          : ''),
    });
  }

  if (chapter.commonTrap) {
    cards.push({
      id: `${chapter.id}-trap`,
      kind: 'trap',
      label: 'دام رایج',
      front: 'دام رایج این فصل چیست و چطور از آن دور می‌مانی؟',
      back: chapter.commonTrap,
    });
  }

  chapter.retrievalPrompts?.forEach((prompt, index) => {
    cards.push({
      id: `${chapter.id}-retrieval-${index}`,
      kind: 'retrieval',
      label: 'بازیابی',
      front: prompt.question,
      back: prompt.answer,
      hint: prompt.hint,
    });
  });

  questions.forEach((question) => {
    cards.push({
      id: `${chapter.id}-question-${question.id}`,
      kind: 'question',
      label: 'تست کنکور',
      front: question.text,
      back:
        question.options.map((option, index) => `${fa(index + 1)}) ${option}`).join('\n') +
        '\n\nپاسخ صحیح عمداً اینجا نمایش داده نمی‌شود؛ برای ثبت پاسخ و دیدن تشریح، تست را در بانک تست همین فصل باز کن.',
      // تست تألیفی فصل نباید خودش را «کنکور سال X» معرفی کند (قاعدهٔ صداقت منبع).
      source: isAuthoredQuestion(question)
        ? `تألیف هم‌سطح آزمون${question.courseSectionTitle ? ` · ${question.courseSectionTitle}` : ''}`
        : `کنکور ${fa(question.examYear)}${question.courseSectionTitle ? ` · ${question.courseSectionTitle}` : ''}`,
      questionId: question.id,
    });
  });

  return cards;
};
