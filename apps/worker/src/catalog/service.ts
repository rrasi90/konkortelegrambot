/**
 * AEL-507/508/509 — کاتالوگ منتشرشدهٔ پویا (ADR-003).
 * منبع حقیقت Runtime = Release فعال از DB؛ Static Registry فقط Legacy/Offline است.
 */
import type { LearningCourse, LearningQuestion, LearningSource, LearningTopic } from '@ael/engine';
import type { AdminStore } from '../admin/store';

type Row = Record<string, unknown>;

export class CatalogValidationError extends Error {}

function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new CatalogValidationError(`فیلد «${field}» باید فهرست رشته باشد.`);
  }
  return value as string[];
}

/** اعتبارسنجی بدنهٔ content از نوع course — قرارداد هم‌خوان با LearningCourse (schemaVersion 1). */
export function validateCourseBody(body: unknown): { courseId: string; title: string; description: string; scopeNote: string; sources: LearningSource[]; topics: LearningTopic[] } {
  if (!body || typeof body !== 'object') throw new CatalogValidationError('بدنهٔ درس باید شیء باشد.');
  const data = body as Record<string, unknown>;
  if (typeof data.courseId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(data.courseId)) {
    throw new CatalogValidationError('courseId معتبر نیست.');
  }
  for (const field of ['title', 'description', 'scopeNote'] as const) {
    if (typeof data[field] !== 'string' || !(data[field] as string).trim()) {
      throw new CatalogValidationError(`فیلد «${field}» الزامی است.`);
    }
  }
  const sources = (data.sources ?? []) as LearningSource[];
  const topics = (data.topics ?? []) as LearningTopic[];
  if (!Array.isArray(sources) || !Array.isArray(topics)) {
    throw new CatalogValidationError('sources و topics باید فهرست باشند.');
  }
  for (const topic of topics) {
    if (!topic || typeof topic.id !== 'string' || typeof topic.title !== 'string' || typeof topic.objective !== 'string') {
      throw new CatalogValidationError('هر مبحث باید id/title/objective داشته باشد.');
    }
    assertStringArray(topic.prerequisites, 'topic.prerequisites');
    assertStringArray(topic.concepts, 'topic.concepts');
    assertStringArray(topic.sourceIds, 'topic.sourceIds');
  }
  return { courseId: data.courseId, title: data.title as string, description: data.description as string, scopeNote: data.scopeNote as string, sources, topics };
}

/** اعتبارسنجی بدنهٔ سؤال تألیفی (mcq/essay) */
export function validateQuestionBody(body: unknown): LearningQuestion {
  if (!body || typeof body !== 'object') throw new CatalogValidationError('بدنهٔ سؤال باید شیء باشد.');
  const data = body as Record<string, unknown>;
  if (typeof data.id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(data.id)) {
    throw new CatalogValidationError('شناسهٔ سؤال معتبر نیست.');
  }
  if (typeof data.courseId !== 'string' || typeof data.topicId !== 'string') {
    throw new CatalogValidationError('courseId و topicId الزامی‌اند.');
  }
  const kind = data.kind === 'essay' ? 'essay' : 'mcq';
  if (kind === 'mcq') {
    if (!Array.isArray(data.choices) || data.choices.length < 2 || data.choices.length > 6) {
      throw new CatalogValidationError('سؤال چندگزینه‌ای باید ۲ تا ۶ گزینه داشته باشد.');
    }
    if (typeof data.answerIndex !== 'number' || !Number.isInteger(data.answerIndex) ||
        data.answerIndex < 0 || data.answerIndex >= (data.choices as string[]).length) {
      throw new CatalogValidationError('answerIndex خارج از محدودهٔ گزینه‌هاست (AEL-406).');
    }
    if (new Set(data.choices as string[]).size !== (data.choices as string[]).length) {
      throw new CatalogValidationError('گزینه‌های تکراری مجاز نیستند.');
    }
  }
  if (typeof data.prompt !== 'string' || !(data.prompt as string).trim()) {
    throw new CatalogValidationError('متن سؤال الزامی است.');
  }
  return {
    id: data.id,
    topicId: data.topicId,
    difficulty: data.difficulty === 'applied' ? 'applied' : 'basic',
    prompt: data.prompt,
    choices: (data.choices ?? []) as string[],
    answerIndex: typeof data.answerIndex === 'number' ? data.answerIndex : -1,
    explanation: typeof data.explanation === 'string' ? data.explanation : '',
    optionReasons: assertStringArray(data.optionReasons ?? [], 'optionReasons'),
    sourceIds: assertStringArray(data.sourceIds ?? [], 'sourceIds'),
    origin: 'authored',
    rights: 'original_ael',
    // فقط محتوای تأییدشده وارد Release می‌شود؛ در کاتالوگ منتشرشده review=reviewed
    review: 'reviewed',
    kind,
    variantGroup: typeof data.variantGroup === 'string' ? data.variantGroup : undefined,
    rubric: Array.isArray(data.rubric) ? (data.rubric as string[]) : undefined,
  };
}

async function sha256HexWeb(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** ساخت Snapshot کاتالوگ از Versionهای یک Release — درسی بدون ماده → خطا (نه حدس). */
export async function buildCatalogSnapshot(
  releaseCode: string,
  versions: Array<Row>,
): Promise<{ schemaVersion: 1; releaseCode: string; courses: LearningCourse[]; warnings: string[]; contentHash: string }> {
  const warnings: string[] = [];
  const courseBodies = new Map<string, { body: ReturnType<typeof validateCourseBody>; sources: LearningSource[] }>();
  const questions = new Map<string, LearningQuestion[]>();

  for (const version of versions) {
    const itemSlug = String(version.slug ?? '');
    const kind = String(version.kind ?? '');
    const body = version.body;
    if (kind === 'course') {
      const validated = validateCourseBody(body);
      if (courseBodies.has(validated.courseId)) {
        throw new CatalogValidationError(`دو نسخهٔ course با courseId یکسان در یک Release: ${validated.courseId}`);
      }
      courseBodies.set(validated.courseId, { body: validated, sources: validated.sources });
    } else if (kind === 'mcq' || kind === 'essay') {
      const question = validateQuestionBody(body);
      const list = questions.get(question.topicId + '@' + (body as Record<string, unknown>).courseId) ?? [];
      list.push(question);
      questions.set(question.topicId + '@' + (body as Record<string, unknown>).courseId, list);
    } else if (['lesson', 'topic_note', 'concept', 'worked_example', 'formula_card', 'flashcard', 'remedial_explanation', 'rubric', 'study_guide'].includes(kind)) {
      warnings.push(`مادهٔ «${itemSlug}» از نوع ${kind} در کاتالوگ آزمون‌ساز استفاده نمی‌شود (فقط درس/سؤال).`);
    }
  }

  const courses: LearningCourse[] = [];
  for (const [courseId, { body }] of courseBodies) {
    const courseQuestions: LearningQuestion[] = [];
    for (const [key, list] of questions) {
      if (key.endsWith('@' + courseId)) courseQuestions.push(...list);
    }
    for (const topic of body.topics) {
      const count = courseQuestions.filter(question => question.topicId === topic.id).length;
      if (count === 0) warnings.push(`مبحث «${topic.id}» در درس ${courseId} هیچ سؤالی ندارد.`);
    }
    courses.push({
      schemaVersion: 1,
      id: courseId,
      version: releaseCode,
      title: body.title,
      status: 'authored_pilot',
      description: body.description,
      scopeNote: body.scopeNote,
      sources: body.sources,
      topics: body.topics,
      questions: courseQuestions,
    });
  }
  if (courses.length === 0) throw new CatalogValidationError('Release بدون هیچ درسی قابل انتشار نیست.');
  const contentHash = await sha256HexWeb(JSON.stringify(courses));
  return { schemaVersion: 1, releaseCode, courses, warnings, contentHash };
}

/** خواندن کاتالوگ فعال از DB — null یعنی هیچ Release فعالی نیست (Fallback تصمیم در فراخواننده). */
export async function loadPublishedCatalog(store: AdminStore): Promise<LearningCourse[] | null> {
  const releaseId = await store.getActiveReleaseId();
  if (!releaseId) return null;
  const release = await store.getRelease(releaseId);
  if (!release || String(release.status) !== 'published') return null;
  const snapshot = await store.getPublishedSnapshot(releaseId);
  if (!snapshot) return null;
  const parsed = snapshot.snapshot as { courses?: LearningCourse[] };
  return Array.isArray(parsed.courses) ? parsed.courses : null;
}
