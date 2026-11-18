/**
 * دفتر خطا (Mistake Notebook)
 * ------------------------------------------------------------------
 * هدف: هر پاسخ غلط به یک «برگهٔ قابل مرور» تبدیل شود تا داوطلب بتواند
 * بعداً صورت سؤال، پاسخ خودش، پاسخ صحیح، تشریح کامل، دام طراح و منبع را
 * یک‌جا ببیند و همان سؤال را دوباره تمرین کند.
 *
 * منطق این فایل خالص (pure) است تا در تست‌های واحد بدون مرورگر قابل آزمون باشد.
 */

export type MistakeErrorType =
  | 'concept_gap'
  | 'prerequisite_failure'
  | 'misread'
  | 'slip'
  | 'skipped'
  | 'none';

export interface MistakeEntry {
  questionId: string;
  nodeId: string;
  course: string;
  chapter: string;
  topic: string;
  questionText: string;
  options: string[];
  correctOption: number;
  /** گزینه‌ای که کاربر انتخاب کرده است؛ null یعنی سؤال را نزده گذاشته */
  selectedOption: number | null;
  explanation: string;
  trapNote: string;
  source: string;
  examYear?: number;
  errorType: MistakeErrorType;
  /** چند بار این سؤال را غلط زده است (تکرار خطا = سیگنال ضعف پایدار) */
  wrongCount: number;
  firstWrongAt: string;
  lastWrongAt: string;
  /** کاربر خودش علامت زده که مفهوم را یاد گرفته است */
  resolved: boolean;
}

export interface MistakeInput {
  questionId: string;
  nodeId: string;
  course: string;
  chapter: string;
  topic: string;
  questionText: string;
  options: string[];
  correctOption: number;
  selectedOption: number | null;
  explanation: string;
  trapNote: string;
  source?: string;
  examYear?: number;
  errorType?: MistakeErrorType;
}

export interface MistakeFilter {
  search?: string;
  course?: string;
  status?: 'all' | 'unresolved' | 'resolved';
}

export interface MistakeSummary {
  total: number;
  unresolved: number;
  resolved: number;
  repeated: number;
  byCourse: { course: string; count: number }[];
  byErrorType: { errorType: MistakeErrorType; label: string; count: number }[];
}

export const MISTAKE_ERROR_LABELS: Record<MistakeErrorType, string> = {
  concept_gap: 'خلأ مفهومی',
  prerequisite_failure: 'ضعف در پیش‌نیاز',
  misread: 'بدخوانی صورت سؤال',
  slip: 'بی‌دقتی در انتخاب گزینه',
  skipped: 'بدون پاسخ',
  none: 'نامشخص',
};

export const MISTAKE_NOTEBOOK_KEY = 'ael.mistake.notebook.v1';
export const MAX_MISTAKE_ENTRIES = 400;

/**
 * درج یا به‌روزرسانی یک خطا.
 * اگر همان سؤال قبلاً ثبت شده باشد، شمارندهٔ تکرار بالا می‌رود و وضعیت «حل‌شده»
 * دوباره باز می‌شود؛ چون خطای دوباره یعنی هنوز یاد گرفته نشده است.
 */
export function upsertMistake(
  entries: MistakeEntry[],
  input: MistakeInput,
  now: Date = new Date()
): MistakeEntry[] {
  const timestamp = now.toISOString();
  const existing = entries.find((e) => e.questionId === input.questionId);

  const next: MistakeEntry = existing
    ? {
        ...existing,
        nodeId: input.nodeId,
        course: input.course,
        chapter: input.chapter,
        topic: input.topic,
        questionText: input.questionText,
        options: input.options,
        correctOption: input.correctOption,
        selectedOption: input.selectedOption,
        explanation: input.explanation,
        trapNote: input.trapNote,
        source: input.source ?? existing.source,
        examYear: input.examYear ?? existing.examYear,
        errorType: input.errorType ?? existing.errorType,
        wrongCount: existing.wrongCount + 1,
        lastWrongAt: timestamp,
        resolved: false,
      }
    : {
        questionId: input.questionId,
        nodeId: input.nodeId,
        course: input.course,
        chapter: input.chapter,
        topic: input.topic,
        questionText: input.questionText,
        options: [...input.options],
        correctOption: input.correctOption,
        selectedOption: input.selectedOption,
        explanation: input.explanation,
        trapNote: input.trapNote,
        source: input.source ?? '',
        examYear: input.examYear,
        errorType: input.errorType ?? 'concept_gap',
        wrongCount: 1,
        firstWrongAt: timestamp,
        lastWrongAt: timestamp,
        resolved: false,
      };

  const withoutCurrent = entries.filter((e) => e.questionId !== input.questionId);
  const merged = [next, ...withoutCurrent];

  if (merged.length <= MAX_MISTAKE_ENTRIES) return merged;

  // سقف حجم: اول خطاهای حل‌شدهٔ قدیمی‌تر حذف می‌شوند، بعد قدیمی‌ترین‌ها؛
  // تازه‌ترین خطاها همیشه باید در دفتر بمانند.
  const overflow = merged.length - MAX_MISTAKE_ENTRIES;
  const removalOrder = [...merged].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? -1 : 1;
    return new Date(a.lastWrongAt).getTime() - new Date(b.lastWrongAt).getTime();
  });
  const removeIds = new Set(
    removalOrder.slice(0, overflow).map((e) => e.questionId)
  );
  return merged.filter((e) => !removeIds.has(e.questionId));
}

export function markMistakeResolved(
  entries: MistakeEntry[],
  questionId: string,
  resolved: boolean = true
): MistakeEntry[] {
  return entries.map((e) =>
    e.questionId === questionId ? { ...e, resolved } : e
  );
}

/** ثبت یا اصلاح علت خطا؛ برای هدفمندکردن کارت مرور همان پرسش. */
export function setMistakeErrorType(
  entries: MistakeEntry[],
  questionId: string,
  errorType: MistakeErrorType
): MistakeEntry[] {
  return entries.map((e) =>
    e.questionId === questionId ? { ...e, errorType } : e
  );
}

export function removeMistake(
  entries: MistakeEntry[],
  questionId: string
): MistakeEntry[] {
  return entries.filter((e) => e.questionId !== questionId);
}

export function clearResolvedMistakes(entries: MistakeEntry[]): MistakeEntry[] {
  return entries.filter((e) => !e.resolved);
}

export function getUnresolvedMistakes(entries: MistakeEntry[]): MistakeEntry[] {
  return entries.filter((e) => !e.resolved);
}

export function filterMistakes(
  entries: MistakeEntry[],
  filter: MistakeFilter = {}
): MistakeEntry[] {
  const search = (filter.search ?? '').trim().toLowerCase();
  return entries.filter((e) => {
    if (filter.status === 'unresolved' && e.resolved) return false;
    if (filter.status === 'resolved' && !e.resolved) return false;
    if (filter.course && filter.course !== 'all' && e.course !== filter.course) {
      return false;
    }
    if (!search) return true;
    const haystack = [
      e.questionText,
      e.topic,
      e.chapter,
      e.course,
      e.explanation,
      e.trapNote,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });
}

export function summarizeMistakes(entries: MistakeEntry[]): MistakeSummary {
  const courseMap = new Map<string, number>();
  const errorMap = new Map<MistakeErrorType, number>();
  let resolved = 0;
  let repeated = 0;

  for (const e of entries) {
    if (e.resolved) resolved += 1;
    if (e.wrongCount > 1) repeated += 1;
    courseMap.set(e.course, (courseMap.get(e.course) ?? 0) + 1);
    errorMap.set(e.errorType, (errorMap.get(e.errorType) ?? 0) + 1);
  }

  return {
    total: entries.length,
    unresolved: entries.length - resolved,
    resolved,
    repeated,
    byCourse: [...courseMap.entries()]
      .map(([course, count]) => ({ course, count }))
      .sort((a, b) => b.count - a.count),
    byErrorType: [...errorMap.entries()]
      .map(([errorType, count]) => ({
        errorType,
        label: MISTAKE_ERROR_LABELS[errorType] ?? MISTAKE_ERROR_LABELS.none,
        count,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

/** اعتبارسنجی دادهٔ ذخیره‌شده تا یک رکورد خراب کل دفتر را از کار نیندازد. */
export function sanitizeStoredMistakes(raw: unknown): MistakeEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: MistakeEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Partial<MistakeEntry>;
    if (typeof e.questionId !== 'string' || !e.questionId) continue;
    if (typeof e.nodeId !== 'string' || !e.nodeId) continue;
    if (!Array.isArray(e.options) || e.options.length < 2) continue;
    if (typeof e.correctOption !== 'number') continue;
    if (e.correctOption < 0 || e.correctOption >= e.options.length) continue;
    const errorType: MistakeErrorType =
      e.errorType && e.errorType in MISTAKE_ERROR_LABELS
        ? (e.errorType as MistakeErrorType)
        : 'none';
    result.push({
      questionId: e.questionId,
      nodeId: e.nodeId,
      course: typeof e.course === 'string' ? e.course : 'نامشخص',
      chapter: typeof e.chapter === 'string' ? e.chapter : '',
      topic: typeof e.topic === 'string' ? e.topic : '',
      questionText: typeof e.questionText === 'string' ? e.questionText : '',
      options: e.options.map((o) => String(o)),
      correctOption: e.correctOption,
      selectedOption:
        typeof e.selectedOption === 'number' ? e.selectedOption : null,
      explanation: typeof e.explanation === 'string' ? e.explanation : '',
      trapNote: typeof e.trapNote === 'string' ? e.trapNote : '',
      source: typeof e.source === 'string' ? e.source : '',
      examYear: typeof e.examYear === 'number' ? e.examYear : undefined,
      errorType,
      wrongCount:
        typeof e.wrongCount === 'number' && e.wrongCount > 0 ? e.wrongCount : 1,
      firstWrongAt:
        typeof e.firstWrongAt === 'string'
          ? e.firstWrongAt
          : new Date().toISOString(),
      lastWrongAt:
        typeof e.lastWrongAt === 'string'
          ? e.lastWrongAt
          : new Date().toISOString(),
      resolved: e.resolved === true,
    });
  }
  return result.slice(0, MAX_MISTAKE_ENTRIES);
}

/* ------------------------- ذخیره‌سازی محلی ------------------------- */

export function loadMistakeNotebook(): MistakeEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(MISTAKE_NOTEBOOK_KEY);
    if (!raw) return [];
    return sanitizeStoredMistakes(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveMistakeNotebook(entries: MistakeEntry[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      MISTAKE_NOTEBOOK_KEY,
      JSON.stringify(entries.slice(0, MAX_MISTAKE_ENTRIES))
    );
  } catch {
    // سهمیهٔ حافظه پر شده است؛ ذخیره‌سازی نباید تجربهٔ مطالعه را بشکند
  }
}

export function clearMistakeNotebookStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(MISTAKE_NOTEBOOK_KEY);
  } catch {
    // ignore
  }
}
