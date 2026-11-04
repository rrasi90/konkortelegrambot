/**
 * EX-01 / EX-02 — قرارداد واحد فیلتر/پیش‌نمایش و سهمیهٔ بین چند بستهٔ درس.
 * همان سیاست انتخاب تک‌بسته (mulberry32 + تطبیق دوبخشی هم‌ارزها) به چند بسته تعمیم یافته است.
 *
 * قواعد پذیرش مرتبط:
 * - AT-06: در هر جلسه حداکثر یک نسخه از هر گروه هم‌ارز (سراسری بین بسته‌ها).
 * - AT-07/AT-08: ظرفیت دقیق با تطبیق دوبخشی؛ سهمیهٔ ناممکن خطای قابل فهم می‌دهد، انتخاب خاموش خراب نمی‌سازد.
 * - AT-09: بانک/تنظیم/seed برابر → انتخاب برابر؛ تغییر نسخه در چالش ثبت می‌شود.
 * - AT-12: پیش‌نمایش نسخه‌بانک را pin می‌کند؛ تغییر بانک یعنی پیش‌نمایش تازه لازم است.
 */
import type { LearningCourse, LearningQuestion, QuizChallenge, QuizInput, QuizMode } from './formative-quiz';
import { FormativeQuizError } from './formative-quiz';

export type MultiCourseSelectionVersion = 'mulberry32-multi-v1';

export interface MultiCourseChallenge {
  courseIds: string[];
  /** نسخهٔ pin‌شدهٔ هر بسته در لحظهٔ انتخاب (AT-12) */
  versions: Record<string, string>;
  mode: QuizMode;
  ids: string[];
  startedAt: number;
  deadline: number | null;
  selectionSeed?: number;
  selectionVersion: MultiCourseSelectionVersion;
}

export interface CourseQuota { courseId: string; count: number }

export interface MultiCourseQuizInput extends QuizInput {
  /** سهمیهٔ بین درس‌ها؛ مجموع باید برابر count باشد. با topicQuotas هم‌زمان مجاز نیست. */
  courseQuotas?: unknown;
}

export interface MultiCoursePreview {
  versionPin: Record<string, string>;
  filterCapacity: number;
  perCourse: Array<{ courseId: string; capacity: number; topicIds: string[] }>;
  perTopic: Array<{ topicId: string; courseId: string; capacity: number }>;
  canSatisfy: boolean;
  shortfallReasons: string[];
}

interface CoursePool {
  course: LearningCourse;
  pool: LearningQuestion[];
  groupMap: Map<string, LearningQuestion[]>;
}

/**
 * کلید هم‌ارزی سراسری: شناسهٔ گروه بین بسته‌ها مشترک معنا می‌دهد (AT-07)؛
 * سؤال بدون گروه با شناسهٔ مطلق خودش یکتاست.
 */
function globalVariantKey(courseId: string, question: LearningQuestion): string {
  return question.variantGroup
    ? `group:${question.variantGroup}`
    : `${courseId}|question:${question.id}`;
}

function validateShared(input: QuizInput): { mode: QuizMode; count: number } {
  const mode = input.mode;
  if (mode !== 'practice' && mode !== 'diagnostic' && mode !== 'timed') {
    throw new FormativeQuizError('حالت آزمون معتبر نیست.');
  }
  if (input.seed !== undefined && (typeof input.seed !== 'number' || !Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff)) {
    throw new FormativeQuizError('شناسهٔ تصادفی آزمون معتبر نیست.');
  }
  if (input.kind !== undefined && input.kind !== 'mcq' && input.kind !== 'essay') {
    throw new FormativeQuizError('نوع سؤال معتبر نیست.');
  }
  const count = input.count ?? 6;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 12) {
    throw new FormativeQuizError('تعداد تست باید عددی بین ۱ تا ۱۲ باشد.');
  }
  return { mode, count };
}

/** topicId → بستهٔ مالک؛ شناسهٔ مبحث باید سراسری یکتا باشد. */
function ownerOfTopic(courses: LearningCourse[], topicId: string): LearningCourse | null {
  const owners = courses.filter(course => course.topics.some(topic => topic.id === topicId));
  if (owners.length > 1) throw new FormativeQuizError(`مبحث «${topicId}» در بیش از یک بستهٔ درس تعریف شده است؛ شناسهٔ مباحث باید سراسری یکتا باشد.`);
  return owners[0] ?? null;
}

function buildPools(courses: LearningCourse[], input: MultiCourseQuizInput): CoursePool[] {
  if (!Array.isArray(courses) || courses.length === 0) throw new FormativeQuizError('دست‌کم یک بستهٔ درس لازم است.');
  const ids = courses.map(course => course.id);
  if (new Set(ids).size !== ids.length) throw new FormativeQuizError('شناسهٔ بسته‌های درس تکراری است.');
  const topicIds = input.topicIds;
  if (topicIds !== undefined && (!Array.isArray(topicIds) || topicIds.length === 0 ||
      topicIds.some(id => typeof id !== 'string' || !ownerOfTopic(courses, id)) ||
      new Set(topicIds).size !== topicIds.length)) {
    throw new FormativeQuizError('فهرست مباحث معتبر نیست.');
  }
  return courses.map(course => ({
    course,
    pool: course.questions.filter(q =>
      (input.kind === undefined || (q.kind ?? 'mcq') === input.kind) &&
      (topicIds === undefined || (topicIds as string[]).includes(q.topicId))),
    groupMap: new Map<string, LearningQuestion[]>(),
  }));
}

/** استخر صاف‌شده و گروه‌بندی بر اساس مبحث — همان رفتار تک‌بسته. */
function orderedGroups(pools: CoursePool[], courseQuotaFilter?: Set<string>): Array<{ pool: CoursePool; group: LearningQuestion[] }> {
  const ordered: Array<{ pool: CoursePool; group: LearningQuestion[] }> = [];
  for (const pool of pools) {
    if (courseQuotaFilter && !courseQuotaFilter.has(pool.course.id)) continue;
    const groups = new Map<string, LearningQuestion[]>();
    for (const question of pool.pool) {
      const group = groups.get(question.topicId) ?? [];
      group.push(question);
      groups.set(question.topicId, group);
    }
    for (const group of groups.values()) ordered.push({ pool, group });
  }
  return ordered;
}

function mulberry32(seed: number) {
  let randomState = seed;
  return () => {
    randomState = (randomState + 0x6d2b79f5) | 0;
    let value = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function distinctAcrossPools(pools: CoursePool[]): number {
  const keys = new Set<string>();
  for (const { course, pool } of pools) for (const question of pool) keys.add(globalVariantKey(course.id, question));
  return keys.size;
}

/** پیش‌نمایش با همان سیاست فیلتر — بدون انتخاب و بدون مصرف تصادف (EX-01/AT-12). */
export function previewMultiCourseQuiz(courses: LearningCourse[], input: MultiCourseQuizInput): MultiCoursePreview {
  validateShared(input);
  const pools = buildPools(courses, input);
  const versionPin: Record<string, string> = {};
  for (const { course } of pools) versionPin[course.id] = course.version;

  const perCourse = pools.map(({ course, pool }) => {
    const keys = new Set(pool.map(q => globalVariantKey(course.id, q)));
    return { courseId: course.id, capacity: keys.size, topicIds: course.topics.map(t => t.id) };
  });
  const perTopic: MultiCoursePreview['perTopic'] = [];
  for (const { course, pool } of pools) {
    for (const topic of course.topics) {
      const keys = new Set(pool.filter(q => q.topicId === topic.id).map(q => globalVariantKey(course.id, q)));
      perTopic.push({ topicId: topic.id, courseId: course.id, capacity: keys.size });
    }
  }

  const shortfallReasons: string[] = [];
  const { count } = validateShared(input);
  const filterCapacity = distinctAcrossPools(pools);
  let canSatisfy = filterCapacity >= count || input.requireCount !== true;

  // سهمیهٔ درس: ظرفیت هر درس جدا کنترل می‌شود.
  if (input.courseQuotas !== undefined) {
    if (!Array.isArray(input.courseQuotas)) throw new FormativeQuizError('سهمیهٔ درس‌ها معتبر نیست.');
    const quotas = new Map<string, number>();
    for (const entry of input.courseQuotas as CourseQuota[]) {
      if (!entry || typeof entry.courseId !== 'string' || !pools.some(p => p.course.id === entry.courseId) ||
          !Number.isInteger(entry.count) || entry.count < 1 || entry.count > 12 || quotas.has(entry.courseId)) {
        throw new FormativeQuizError('سهمیهٔ هر درس باید عدد صحیح مثبت و برای بستهٔ موجود باشد.');
      }
      quotas.set(entry.courseId, entry.count);
    }
    const total = [...quotas.values()].reduce((sum, value) => sum + value, 0);
    if (total !== count) {
      shortfallReasons.push(`مجموع سهمیهٔ درس‌ها (${total}) باید برابر تعداد سؤال (${count}) باشد.`);
      canSatisfy = false;
    }
    for (const [courseId, requested] of quotas) {
      const pool = pools.find(p => p.course.id === courseId)!;
      const available = new Set(pool.pool.map(q => globalVariantKey(courseId, q))).size;
      if (available < requested) {
        shortfallReasons.push(`برای بستهٔ «${pool.course.title}» فقط ${available} سؤال مستقل موجود است.`);
        canSatisfy = false;
      }
    }
    // ممکن‌بودن تخصیص با تطبیق دوبخشی (AT-07): گروه‌های مشترک بین درس‌ها حساب می‌شوند.
    const slots = [...quotas].flatMap(([courseId, n]) => Array.from({ length: n }, () => courseId));
    if (slots.length > 0) {
      const groupsByCourse = new Map<string, Set<string>>();
      for (const { course, pool } of pools) {
        const keys = new Set(pool.map(q => globalVariantKey(course.id, q)));
        groupsByCourse.set(course.id, keys);
      }
      let feasible = true;
      const visitedAll = new Set<string>();
      function augment(slotIndex: number, visited: Set<string>): boolean {
        const courseId = slots[slotIndex]!;
        for (const key of groupsByCourse.get(courseId) ?? []) {
          if (visited.has(key)) continue;
          visited.add(key);
          visitedAll.add(key);
          const owner = matched.get(key);
          if (owner === undefined || augment(owner, visited)) { matched.set(key, slotIndex); return true; }
        }
        return false;
      }
      const matched = new Map<string, number>();
      for (let slot = 0; slot < slots.length; slot++) {
        if (!augment(slot, new Set())) { feasible = false; break; }
      }
      if (!feasible) {
        shortfallReasons.push('به‌دلیل سؤال‌های مشابه مشترک بین درس‌ها، سهمیه‌های انتخابی هم‌زمان قابل تأمین نیستند.');
        canSatisfy = false;
      }
      void visitedAll;
    }
  }

  // سهمیهٔ مبحث: ظرفیت هر مبحث (در هر بسته) کنترل می‌شود.
  if (input.topicQuotas !== undefined && Array.isArray(input.topicQuotas)) {
    for (const entry of input.topicQuotas as Array<{ topicId: string; count: number }>) {
      const info = perTopic.find(row => row.topicId === entry.topicId);
      if (info && info.capacity < entry.count) {
        shortfallReasons.push(`برای مبحث «${entry.topicId}» فقط ${info.capacity} سؤال مستقل موجود است.`);
        canSatisfy = false;
      }
    }
  }
  if (input.requireCount === true && filterCapacity < count) {
    shortfallReasons.push(`تعداد سؤال‌های مستقل موجود برای انتخاب شما ${filterCapacity} است.`);
    canSatisfy = false;
  }

  return { versionPin, filterCapacity, perCourse, perTopic, canSatisfy, shortfallReasons };
}

/** ساخت جلسهٔ چندبسته‌ای با همان سیاست تک‌بسته (EX-02). */
export function createMultiCourseQuiz(
  courses: LearningCourse[],
  input: MultiCourseQuizInput,
  now = Date.now(),
  random: () => number = Math.random,
): { challenge: MultiCourseChallenge; questions: ReturnType<typeof import('./formative-quiz').projectFormativeQuestion>[] } {
  const { mode, count } = validateShared(input);
  const pools = buildPools(courses, input);
  if (pools.some(({ pool }) => pool.length === 0) && input.reviewIds === undefined) {
    // درس بدون سؤال در فیلتر فعلی اشکال نیست مگر کل ظرفیت صفر شود؛ کنترل پایین انجام می‌شود.
  }
  const filterCapacity = distinctAcrossPools(pools);
  if (!filterCapacity) throw new FormativeQuizError('برای این انتخاب هنوز تستی وجود ندارد.');
  const effectiveCount = Math.min(count, filterCapacity);

  // سهمیه‌ها: یا درس یا مبحث؛ هم‌زمان مجاز نیست (سادگی قرارداد نسخهٔ اول).
  let courseQuotaSlots: string[] | null = null;
  let topicQuotas: Map<string, number> | null = null;
  if (input.courseQuotas !== undefined && input.topicQuotas !== undefined) {
    throw new FormativeQuizError('سهمیهٔ درس و سهمیهٔ مبحث هم‌زمان قابل استفاده نیستند.');
  }
  if (input.courseQuotas !== undefined) {
    const preview = previewMultiCourseQuiz(courses, input);
    if (!preview.canSatisfy) throw new FormativeQuizError(preview.shortfallReasons.join(' '));
    courseQuotaSlots = [];
    for (const entry of input.courseQuotas as CourseQuota[]) {
      for (let i = 0; i < entry.count; i++) courseQuotaSlots.push(entry.courseId);
    }
  } else if (input.topicQuotas !== undefined) {
    if (!Array.isArray(input.topicIds)) throw new FormativeQuizError('سهمیهٔ مباحث با انتخاب آزمون سازگار نیست.');
    topicQuotas = new Map();
    for (const entry of input.topicQuotas as Array<{ topicId: string; count: number }>) {
      if (!entry || typeof entry.topicId !== 'string' || !(input.topicIds as string[]).includes(entry.topicId) ||
          topicQuotas.has(entry.topicId) || !Number.isInteger(entry.count) || entry.count < 1) {
        throw new FormativeQuizError('سهمیهٔ هر مبحث باید عدد صحیح و مثبت باشد.');
      }
      topicQuotas.set(entry.topicId, entry.count);
    }
    if ([...topicQuotas.values()].reduce((sum, value) => sum + value, 0) !== count) {
      throw new FormativeQuizError('مجموع سهمیه‌ها باید برابر تعداد سؤال باشد.');
    }
  }

  const randomValue = input.seed === undefined ? random() : undefined;
  if (randomValue !== undefined && !(randomValue >= 0 && randomValue < 1)) {
    throw new FormativeQuizError('منبع تصادفی آزمون معتبر نیست.');
  }
  const selectionSeed = input.seed === undefined ? Math.floor(randomValue! * 0x100000000) : input.seed as number;
  const nextRandom = mulberry32(selectionSeed);

  const ordered = orderedGroups(pools);
  if (input.reviewIds === undefined && ordered.length > count) {
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j]!, ordered[i]!];
    }
  }
  for (const { group } of ordered) {
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      [group[i], group[j]] = [group[j]!, group[i]!];
    }
    if (mode === 'diagnostic') group.sort((a, b) => Number(a.difficulty === 'applied') - Number(b.difficulty === 'applied'));
  }

  const usedVariants = new Set<string>();
  const ids: string[] = [];

  if (courseQuotaSlots) {
    // AT-07: تطبیق دوبخشی سراسری بین جایگاه‌های سهمیهٔ درس و گروه‌های هم‌ارز.
    const choices = courseQuotaSlots.map(courseId => {
      const map = new Map<string, LearningQuestion>();
      for (const { pool, group } of ordered) {
        if (pool.course.id !== courseId) continue;
        for (const question of group) if (!map.has(globalVariantKey(courseId, question))) map.set(globalVariantKey(courseId, question), question);
      }
      return map;
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
    for (let slot = 0; slot < courseQuotaSlots.length; slot++) {
      if (!assign(slot, new Set())) throw new FormativeQuizError('تخصیص سهمیهٔ درس‌ها با گروه‌های مشترک ممکن نیست. سهمیه‌ها را تغییر دهید.');
    }
    const selected = Array<LearningQuestion>(courseQuotaSlots.length);
    for (const [key, slot] of matched) selected[slot] = choices[slot]!.get(key)!;
    ids.push(...selected.filter(Boolean).map(q => q.id));
  } else if (topicQuotas) {
    const remaining = new Map(topicQuotas);
    const variantAware = pools.some(({ pool }) => pool.some(q => !!q.variantGroup));
    if (variantAware) {
      // تطبیق دوبخشی سهمیهٔ مبحث سراسری بین بسته‌ها.
      const slots = [...remaining].flatMap(([topic, n]) => Array.from({ length: n }, () => topic));
      const choices = slots.map(topic => {
        const map = new Map<string, LearningQuestion>();
        for (const { pool, group } of ordered) {
          for (const question of group) {
            if (question.topicId !== topic) continue;
            const key = globalVariantKey(pool.course.id, question);
            if (!map.has(key)) map.set(key, question);
          }
        }
        return map;
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
        if (!assign(slot, new Set())) throw new FormativeQuizError('به‌دلیل سؤال‌های مشابه مشترک، سهمیه‌های انتخابی هم‌زمان قابل تأمین نیستند.');
      }
      const selected = Array<LearningQuestion>(slots.length);
      for (const [key, slot] of matched) selected[slot] = choices[slot]!.get(key)!;
      ids.push(...selected.filter(Boolean).map(q => q.id));
    } else {
      outer: while (ids.length < effectiveCount) {
        for (const { group } of ordered) {
          const groupTopic = group[0]?.topicId;
          if (!groupTopic || !remaining.get(groupTopic)) continue;
          let question = group.shift();
          if (question) {
            ids.push(question.id);
            remaining.set(groupTopic, remaining.get(groupTopic)! - 1);
          }
          if (ids.length === effectiveCount) break outer;
        }
      }
    }
  } else {
    outer: while (ids.length < effectiveCount) {
      for (const { pool, group } of ordered) {
        let question = group.shift();
        while (question && usedVariants.has(globalVariantKey(pool.course.id, question))) question = group.shift();
        if (question) {
          ids.push(question.id);
          usedVariants.add(globalVariantKey(pool.course.id, question));
        }
        if (ids.length === effectiveCount) break outer;
      }
    }
  }

  if (!ids.length) throw new FormativeQuizError('برای این انتخاب هنوز تستی وجود ندارد.');
  const versions: Record<string, string> = {};
  for (const { course } of pools) versions[course.id] = course.version;
  const challenge: MultiCourseChallenge = {
    courseIds: pools.map(({ course }) => course.id),
    versions,
    mode,
    ids,
    startedAt: now,
    deadline: mode === 'timed' ? now + ids.length * 60_000 : null,
    selectionSeed,
    selectionVersion: 'mulberry32-multi-v1',
  };
  const questionById = new Map<string, { question: LearningQuestion; course: LearningCourse }>();
  for (const { course } of pools) for (const question of course.questions) questionById.set(question.id, { question, course });
  return { challenge, questions: ids.map(id => {
    const found = questionById.get(id)!;
    const { id: qid, topicId, difficulty, prompt, choices, sourceIds, origin, review, kind } = found.question;
    return { id: qid, topicId, difficulty, prompt, choices, sourceIds, origin, review, kind: kind ?? 'mcq', courseId: found.course.id };
  }) };
}

function resolveQuestion(courses: LearningCourse[], challenge: MultiCourseChallenge, id: unknown) {
  if (typeof id !== 'string' || !challenge.ids.includes(id)) {
    throw new FormativeQuizError('سؤال متعلق به این جلسه نیست یا نسخهٔ درس تغییر کرده است.');
  }
  for (const course of courses) {
    if (!challenge.courseIds.includes(course.id)) continue;
    if (challenge.versions[course.id] !== course.version) {
      throw new FormativeQuizError('نسخهٔ درس تغییر کرده است؛ جلسهٔ جدید لازم است (AT-12).');
    }
    const question = course.questions.find(q => q.id === id);
    if (question) return { question, courseId: course.id };
  }
  throw new FormativeQuizError('این سؤال در نسخهٔ جاری موجود نیست.');
}

export function gradeMultiCourseAnswer(courses: LearningCourse[], challenge: MultiCourseChallenge, id: unknown, selected: unknown) {
  const { question, courseId } = resolveQuestion(courses, challenge, id);
  if (question.kind === 'essay') {
    if (selected !== null && (typeof selected !== 'string' || !selected.trim() || selected.length > 5000)) {
      throw new FormativeQuizError('پاسخ تشریحی باید متن غیرخالی و حداکثر ۵۰۰۰ نویسه باشد.');
    }
    const { id: qid, topicId, difficulty, prompt, choices, sourceIds, origin, review } = question;
    return { id: qid, topicId, difficulty, prompt, choices, sourceIds, origin, review, courseId, kind: 'essay',
      answerIndex: -1, optionReasons: [], explanation: question.explanation, rubric: question.rubric ?? [],
      readingBlock: question.readingBlock, selected: selected as string | null,
      status: selected === null ? 'skipped' : 'pending' };
  }
  if (selected !== null &&
    (typeof selected !== 'number' || !Number.isInteger(selected) || selected < 0 || selected >= question.choices.length)) {
    throw new FormativeQuizError('گزینهٔ انتخابی معتبر نیست.');
  }
  const { id: qid, topicId, difficulty, prompt, choices, sourceIds, origin, review, kind } = question;
  const { answerIndex, explanation, optionReasons, readingBlock } = question;
  return { id: qid, topicId, difficulty, prompt, choices, sourceIds, origin, review, kind: kind ?? 'mcq', courseId,
    answerIndex, explanation, optionReasons, readingBlock, selected: selected as number | null,
    status: selected === null ? 'skipped' : selected === answerIndex ? 'correct' : 'incorrect' };
}

export function gradeMultiCourseQuiz(courses: LearningCourse[], challenge: MultiCourseChallenge, answers: unknown) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new FormativeQuizError('پاسخ‌های جلسه معتبر نیستند.');
  }
  const selections = answers as Record<string, unknown>;
  if (Object.keys(selections).some(id => !challenge.ids.includes(id))) {
    throw new FormativeQuizError('شناسهٔ پاسخ خارج از جلسه است.');
  }
  const results = challenge.ids.map(id =>
    gradeMultiCourseAnswer(courses, challenge, id, Object.hasOwn(selections, id) ? selections[id] : null));
  return { results, total: results.length,
    correct: results.filter(r => r.status === 'correct').length,
    incorrect: results.filter(r => r.status === 'incorrect').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    pending: results.filter(r => r.status === 'pending').length };
}

/** سازگاری نوع: چالش تک‌بسته همچنان QuizChallenge است؛ ماژول جدید جدا است و مسیر قدیمی دست‌نخورده می‌ماند. */
export type { QuizChallenge };
