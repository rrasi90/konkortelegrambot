export type QuizMode = 'practice' | 'diagnostic' | 'timed';
export interface LearningSource {
  id: string;
  title: string;
  url: string;
  locator: string;
  kind: 'concept_reference';
  checkedOn: string;
}
export interface LearningTopic {
  id: string;
  title: string;
  objective: string;
  minutes: number;
  prerequisites: string[];
  concepts: string[];
  formula: string;
  workedExample: string;
  commonError: string;
  sourceIds: string[];
}
export interface LearningQuestion {
  id: string;
  topicId: string;
  difficulty: 'basic' | 'applied';
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  optionReasons: string[];
  sourceIds: string[];
  origin: 'authored';
  rights: 'original_ael';
  review: 'pending_sme' | 'reviewed';
  kind?: 'mcq' | 'essay';
  // Explicit editorial grouping only; similar wording is not sufficient evidence.
  variantGroup?: string;
  rubric?: string[];
  readingBlock?: { type: 'concept' | 'formula' | 'workedExample' | 'commonError'; index?: number };
}
export interface LearningCourse {
  schemaVersion: 1;
  id: string;
  version: string;
  title: string;
  status: 'authored_pilot';
  description: string;
  scopeNote: string;
  sources: LearningSource[];
  topics: LearningTopic[];
  questions: LearningQuestion[];
}
export interface QuizChallenge {
  courseId: string;
  version: string;
  mode: QuizMode;
  ids: string[];
  startedAt: number;
  deadline: number | null;
  selectionSeed?: number;
  selectionVersion?: 'mulberry32-v1' | 'mulberry32-variants-v2';
}
export interface QuizInput {
  mode?: unknown;
  topicId?: unknown;
  count?: unknown;
  reviewIds?: unknown;
  topicIds?: unknown;
  requireCount?: unknown;
  seed?: unknown;
  kind?: unknown;
  topicQuotas?: unknown;
}

export class FormativeQuizError extends Error {}

function variantKey(question: LearningQuestion) {
  return question.variantGroup ? 'group:' + question.variantGroup : 'question:' + question.id;
}

function distinctCount(questions: LearningQuestion[]) {
  return new Set(questions.map(variantKey)).size;
}

export function courseOverview(course: LearningCourse) {
  const { id, title, version, status, description, scopeNote } = course;
  const topics = course.topics.map(topic => {
    const { id, title, objective, minutes, prerequisites, concepts, formula, workedExample, commonError, sourceIds } = topic;
    return { id, title, objective, minutes, prerequisites, concepts, formula, workedExample, commonError, sourceIds,
      questionCount: distinctCount(course.questions.filter(q => q.topicId === id)),
      mcqCount: distinctCount(course.questions.filter(q => q.topicId === id && q.kind !== 'essay')),
      essayCount: distinctCount(course.questions.filter(q => q.topicId === id && q.kind === 'essay')) };
  });
  const sources = course.sources.map(({ id, title, url, locator, kind, checkedOn }) => ({ id, title, url, locator, kind, checkedOn }));
  return { id, title, version, status, description, scopeNote, topics, sources, questionCount: distinctCount(course.questions),
    hasVariantGroups: course.questions.some(q => !!q.variantGroup) };
}

export function projectFormativeQuestion(question: LearningQuestion) {
  const { id, topicId, difficulty, prompt, choices, sourceIds, origin, review, kind } = question;
  return { id, topicId, difficulty, prompt, choices, sourceIds, origin, review, kind: kind ?? 'mcq' };
}

/**
 * EX-06 — ثبت تصحیح انسانی تشریحی: پاسخ «در انتظار» با تصحیح، «ارزیابی‌شده»
 * می‌شود اما هرگز خودکار درست/غلط شمرده نمی‌شود؛ هویت مصحح و زمان جدا ثبت و
 * نتیجهٔ قبلی حفظ می‌شود (AT-17/AT-18). این تابع فقط قرارداد ثبت است؛ نقش و
 * مجوز مصحح در لایهٔ سرور کنترل می‌شود (ADMIN-01).
 */
export function recordEssayEvaluation(
  evaluated: { id: string; status: string; kind?: string },
  grade: { graderId: unknown; score?: unknown; verdict: 'acceptable' | 'needs_review'; note?: string },
  gradedAt = Date.now(),
) {
  if (evaluated.kind !== 'essay' || evaluated.status !== 'pending') {
    throw new FormativeQuizError('فقط پاسخ تشریحیِ در انتظار قابل تصحیح انسانی است.');
  }
  if (typeof grade.graderId !== 'string' || !grade.graderId.trim()) {
    throw new FormativeQuizError('شناسهٔ مصحح لازم است.');
  }
  if (grade.score !== undefined && (typeof grade.score !== 'number' || !Number.isFinite(grade.score) || grade.score < 0 || grade.score > 100)) {
    throw new FormativeQuizError('نمرهٔ تشریحی باید عددی بین ۰ تا ۱۰۰ باشد یا ثبت نشود.');
  }
  if (grade.verdict !== 'acceptable' && grade.verdict !== 'needs_review') {
    throw new FormativeQuizError('نتیجهٔ تصحیح باید «قابل قبول» یا «نیاز به مرور» باشد.');
  }
  return {
    ...evaluated,
    status: 'evaluated',
    evaluation: {
      graderId: grade.graderId,
      verdict: grade.verdict,
      score: grade.score ?? null,
      note: typeof grade.note === 'string' ? grade.note.slice(0, 2000) : null,
      gradedAt,
      version: 1,
    },
  };
}

/**
 * LEARN-03 — پیشنهاد توضیح‌پذیر فعالیت بعدی (بخش ۱۰٫۱): ترتیب پیش‌فرض
 * غلط‌های دارای مقصد ← موارد موعددار ← مبحث خوانده‌نشده با پیش‌نیاز در دسترس.
 * با دادهٔ کم برچسب «اطلاعات ناکافی» می‌دهد؛ پیشنهاد قابل رد است و هیچ ادعای
 * تسلط/رتبه نمی‌سازد. تابع خالص است و UI فقط نمایش می‌دهد.
 */
export interface RecommendationState {
  /** شناسه‌های مبحث با غلط تازه و مقصد مطالعهٔ تأییدشده */
  wrongs?: Array<{ topicId: string; destination: string | null; count?: number }>;
  /** موارد موعددار مرور */
  dueReviews?: Array<{ id: string; topicId?: string }>;
  /** مباحث خوانده‌نشده با پیش‌نیازهای خوانده‌شده */
  unreadReady?: string[];
}

export function recommendNextActivity(state: RecommendationState, minutes: 5 | 10 | 20 = 10): Array<{ kind: 'remediate' | 'review' | 'study'; target: string; reason: string }> {
  const suggestions: Array<{ kind: 'remediate' | 'review' | 'study'; target: string; reason: string }> = [];
  const wrongs = state.wrongs ?? [];
  const due = state.dueReviews ?? [];
  const unread = state.unreadReady ?? [];
  if (!wrongs.length && !due.length && !unread.length) {
    return [{ kind: 'study', target: '*', reason: 'اطلاعات ناکافی: هنوز پاسخ یا مطالعه‌ای ثبت نشده است. یک درس را آزاد انتخاب کنید.' }];
  }
  const withDestination = wrongs.filter((wrong) => wrong.destination);
  if (withDestination.length) {
    const top = withDestination.reduce((a, b) => ((b.count ?? 1) > (a.count ?? 1) ? b : a));
    suggestions.push({ kind: 'remediate', target: top.destination!, reason: `${top.count ?? 1} پاسخ نادرست تازه در این مبحث؛ مطالعهٔ بخش مرتبط پیشنهاد می‌شود. امکان رد دارد.` });
  }
  if (due.length) {
    suggestions.push({ kind: 'review', target: due[0].id, reason: `${due.length} مورد موعددار؛ مرور کوتاه پیشنهاد می‌شود.` });
  }
  if (unread.length) {
    suggestions.push({ kind: 'study', target: unread[0], reason: 'مبحث خوانده‌نشده با پیش‌نیازهای در دسترس؛ ادامهٔ مسیر.' });
  }
  if (minutes === 5) return suggestions.slice(0, 1);
  if (minutes === 10) return suggestions.slice(0, 2);
  return suggestions;
}

/**
 * UX-03 (بخش ۱۵٫۳): سؤال هم‌مهارت با دادهٔ تازه برای تمرین انتقالی پس از غلط.
 * از همان مبحث و خارج از گروه هم‌ارزیِ سؤال جاری انتخاب می‌شود؛ اگر نمونهٔ
 * مستقلی وجود نداشته باشد null برمی‌گردد — هیچ چیزی تأییدشده جلوه داده نمی‌شود.
 */
export function findTransferQuestion(
  course: LearningCourse,
  questionId: string,
  options: { excludeIds?: string[] } = {},
): LearningQuestion | null {
  const current = course.questions.find(q => q.id === questionId);
  if (!current) return null;
  const exclude = new Set(options.excludeIds ?? []);
  const sameTopic = course.questions.filter(q =>
    q.topicId === current.topicId && q.id !== current.id && !exclude.has(q.id) && (q.kind ?? 'mcq') === (current.kind ?? 'mcq'));
  const independent = sameTopic.filter(q => variantKey(q) !== variantKey(current));
  const candidates = independent.length ? independent : sameTopic;
  if (!candidates.length) return null;
  return candidates[0]!;
}

export function createQuiz(course: LearningCourse, input: QuizInput, now = Date.now(), random = Math.random) {
  const { mode, topicId, reviewIds, topicIds, requireCount } = input;
  if (mode !== 'practice' && mode !== 'diagnostic' && mode !== 'timed') {
    throw new FormativeQuizError('حالت آزمون معتبر نیست.');
  }
  if (topicId !== undefined && !course.topics.some(topic => topic.id === topicId)) {
    throw new FormativeQuizError('این مبحث پیدا نشد.');
  }
  if (topicIds !== undefined && (!Array.isArray(topicIds) || topicIds.length === 0 ||
      topicIds.some(id => typeof id !== 'string' || !course.topics.some(topic => topic.id === id)) ||
      new Set(topicIds).size !== topicIds.length || topicId !== undefined)) {
    throw new FormativeQuizError('فهرست مباحث معتبر نیست.');
  }
  if (requireCount !== undefined && typeof requireCount !== 'boolean') {
    throw new FormativeQuizError('تنظیم تعداد آزمون معتبر نیست.');
  }
  if (input.kind !== undefined && input.kind !== 'mcq' && input.kind !== 'essay') {
    throw new FormativeQuizError('نوع سؤال معتبر نیست.');
  }
  if (input.seed !== undefined && (typeof input.seed !== 'number' || !Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff)) {
    throw new FormativeQuizError('شناسهٔ تصادفی آزمون معتبر نیست.');
  }
  const count = input.count ?? (topicId ? 3 : 6);
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 12) {
    throw new FormativeQuizError('تعداد تست باید عددی بین ۱ تا ۱۲ باشد.');
  }
  if (reviewIds !== undefined && (mode !== 'practice' || !Array.isArray(reviewIds) ||
      reviewIds.length > course.questions.length || !reviewIds.every(id => typeof id === 'string'))) {
    throw new FormativeQuizError('فهرست مرور معتبر نیست.');
  }
  let quotas: Map<string, number> | undefined;
  if (input.topicQuotas !== undefined) {
    if (!Array.isArray(topicIds) || reviewIds !== undefined || !Array.isArray(input.topicQuotas) ||
        input.topicQuotas.length !== topicIds.length) {
      throw new FormativeQuizError('سهمیهٔ مباحث با انتخاب آزمون سازگار نیست.');
    }
    quotas = new Map();
    for (const entry of input.topicQuotas) {
      if (!entry || typeof entry !== 'object' || typeof entry.topicId !== 'string' ||
          !topicIds.includes(entry.topicId) || quotas.has(entry.topicId) ||
          !Number.isInteger(entry.count) || entry.count < 1 || entry.count > 12) {
        throw new FormativeQuizError('سهمیهٔ هر مبحث باید عدد صحیح و مثبت باشد.');
      }
      quotas.set(entry.topicId, entry.count);
    }
    if ([...quotas.values()].reduce((sum, value) => sum + value, 0) !== count) {
      throw new FormativeQuizError('مجموع سهمیه‌ها باید برابر تعداد سؤال باشد.');
    }
  }
  const pool = course.questions.filter(q =>
    (topicId === undefined || q.topicId === topicId) &&
    (input.kind === undefined || (q.kind ?? 'mcq') === input.kind) &&
    (topicIds === undefined || topicIds.includes(q.topicId)) &&
    (reviewIds === undefined || reviewIds.includes(q.id))
  );
  if (!pool.length) throw new FormativeQuizError('برای این انتخاب هنوز تستی وجود ندارد.');
  const capacity = distinctCount(pool);
  if (requireCount && capacity < count) {
    throw new FormativeQuizError('تعداد سؤال‌های مستقل موجود برای انتخاب شما ' + capacity + ' است. تعداد کمتری انتخاب کنید.');
  }
  if (quotas) {
    for (const [id, requested] of quotas) {
      const available = distinctCount(pool.filter(question => question.topicId === id));
      if (available < requested) {
        const title = course.topics.find(topic => topic.id === id)?.title ?? id;
        throw new FormativeQuizError('برای «' + title + '» فقط ' + available + ' سؤال موجود است.');
      }
    }
  }
  const randomValue = input.seed === undefined ? random() : undefined;
  if (randomValue !== undefined && !(randomValue >= 0 && randomValue < 1)) {
    throw new FormativeQuizError('منبع تصادفی آزمون معتبر نیست.');
  }
  const selectionSeed = input.seed === undefined ? Math.floor(randomValue! * 0x100000000) : input.seed as number;
  let randomState = selectionSeed;
  const nextRandom = () => {
    randomState = (randomState + 0x6d2b79f5) | 0;
    let value = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
  // Round-robin across topics so a short diagnostic is not dominated by a large chapter.
  const groups = new Map<string, LearningQuestion[]>();
  for (const question of pool) {
    const group = groups.get(question.topicId) ?? [];
    group.push(question);
    groups.set(question.topicId, group);
  }
  // If the request has fewer slots than topics, avoid always choosing the first topics in the pack.
  const orderedGroups = [...groups.values()];
  if (reviewIds === undefined && orderedGroups.length > count) {
    for (let i = orderedGroups.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      [orderedGroups[i], orderedGroups[j]] = [orderedGroups[j]!, orderedGroups[i]!];
    }
  }
  const ids: string[] = [];
  for (const group of orderedGroups) {
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      [group[i], group[j]] = [group[j]!, group[i]!];
    }
    if (mode === 'diagnostic') {
      group.sort((a, b) => Number(a.difficulty === 'applied') - Number(b.difficulty === 'applied'));
    }
  }
  const variantAware = pool.some(q => !!q.variantGroup);
  if (quotas && variantAware) {
    // Match quota slots to groups globally. Augmenting paths recover solutions
    // when a group occurs in more than one topic, rather than greedily failing.
    const slots = [...quotas].flatMap(([topic, n]) => Array.from({ length: n }, () => topic));
    const choices = slots.map(topic => {
      const questions = orderedGroups.find(group => group[0]?.topicId === topic) ?? [];
      const groups = new Map<string, LearningQuestion>();
      for (const question of questions) if (!groups.has(variantKey(question))) groups.set(variantKey(question), question);
      return groups;
    });
    const matched = new Map<string, number>();
    function assign(slot: number, visited: Set<string>): boolean {
      for (const key of choices[slot]!.keys()) {
        if (visited.has(key)) continue;
        visited.add(key);
        const previous = matched.get(key);
        if (previous === undefined || assign(previous, visited)) { matched.set(key, slot); return true; }
      }
      return false;
    }
    for (let slot = 0; slot < slots.length; slot++) {
      if (!assign(slot, new Set())) throw new FormativeQuizError('به‌دلیل سؤال‌های مشابه مشترک، سهمیه‌های انتخابی هم‌زمان قابل تأمین نیستند. سهمیه‌ها را تغییر دهید.');
    }
    const selected = Array<LearningQuestion>(slots.length);
    for (const [key, slot] of matched) selected[slot] = choices[slot]!.get(key)!;
    ids.push(...selected.map(question => question.id));
  }
  const remaining = quotas && new Map(quotas);
  const usedVariants = new Set<string>();
  while (!(quotas && variantAware) && ids.length < Math.min(count, capacity)) {
    for (const group of orderedGroups) {
      const groupTopic = group[0]?.topicId;
      if (remaining && (!groupTopic || !remaining.get(groupTopic))) continue;
      let question = group.shift();
      while (question && usedVariants.has(variantKey(question))) question = group.shift();
      if (question) {
        ids.push(question.id);
        usedVariants.add(variantKey(question));
        if (remaining) remaining.set(question.topicId, remaining.get(question.topicId)! - 1);
      }
      if (ids.length === Math.min(count, capacity)) break;
    }
  }
  const challenge: QuizChallenge = { courseId: course.id, version: course.version, mode, ids, startedAt: now,
    deadline: mode === 'timed' ? now + ids.length * 60_000 : null, selectionSeed,
    selectionVersion: variantAware ? 'mulberry32-variants-v2' : 'mulberry32-v1' };
  return { challenge, questions: ids.map(id => projectFormativeQuestion(course.questions.find(q => q.id === id)!)) };
}

function questionFor(course: LearningCourse, challenge: QuizChallenge, id: unknown): LearningQuestion {
  if (course.id !== challenge.courseId || course.version !== challenge.version || typeof id !== 'string' || !challenge.ids.includes(id)) {
    throw new FormativeQuizError('سؤال متعلق به این جلسه نیست یا نسخهٔ درس تغییر کرده است.');
  }
  const question = course.questions.find(q => q.id === id);
  if (!question) throw new FormativeQuizError('این سؤال در نسخهٔ جاری موجود نیست.');
  return question;
}

export function gradeFormativeAnswer(course: LearningCourse, challenge: QuizChallenge, id: unknown, selected: unknown) {
  const question = questionFor(course, challenge, id);
  if (question.kind === 'essay') {
    if (selected !== null && (typeof selected !== 'string' || !selected.trim() || selected.length > 5000)) {
      throw new FormativeQuizError('پاسخ تشریحی باید متن غیرخالی و حداکثر ۵۰۰۰ نویسه باشد.');
    }
    return { ...projectFormativeQuestion(question), answerIndex: -1, optionReasons: [], explanation: question.explanation, rubric: question.rubric ?? [],
      readingBlock: question.readingBlock, selected: selected as string | null, status: selected === null ? 'skipped' : 'pending' };
  }
  if (selected !== null &&
    (typeof selected !== 'number' || !Number.isInteger(selected) || selected < 0 || selected >= question.choices.length)) {
    throw new FormativeQuizError('گزینهٔ انتخابی معتبر نیست.');
  }
  const { answerIndex, explanation, optionReasons, readingBlock } = question;
  return { ...projectFormativeQuestion(question), answerIndex, explanation, optionReasons, readingBlock,
    selected: selected as number | null, status: selected === null ? 'skipped' : selected === answerIndex ? 'correct' : 'incorrect' };
}

export function gradeFormativeQuiz(course: LearningCourse, challenge: QuizChallenge, answers: unknown) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new FormativeQuizError('پاسخ‌های جلسه معتبر نیستند.');
  }
  const selections = answers as Record<string, unknown>;
  if (Object.keys(selections).some(id => !challenge.ids.includes(id))) {
    throw new FormativeQuizError('شناسهٔ پاسخ خارج از جلسه است.');
  }
  const results = challenge.ids.map(id =>
    gradeFormativeAnswer(course, challenge, id, Object.hasOwn(selections, id) ? selections[id] : null)
  );
  return { results, total: results.length,
    correct: results.filter(r => r.status === 'correct').length,
    incorrect: results.filter(r => r.status === 'incorrect').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    pending: results.filter(r => r.status === 'pending').length };
}
