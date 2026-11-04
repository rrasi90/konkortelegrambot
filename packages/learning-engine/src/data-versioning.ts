/**
 * DATA-02 — اعتبارسنج نسخه‌بندی داده (بخش ۶٫۲ نقشهٔ راه).
 * Pure و بدون I/O؛ برای اسکریپت‌های CLI و تست استفاده می‌شود.
 *
 * قواعد کلیدی:
 * - شناسهٔ سؤال پایدار است و برای مفهوم متفاوت بازیافت نمی‌شود (AT-18).
 * - رخداد دفترچه با کلید ترکیبی سال/نوبت/دفترچه/شماره یکتاست (AT-19).
 * - ورود مجدد همان رکورد، رکورد تازه نمی‌سازد (AT-04).
 * - چاپ‌های کتاب جداگانه‌اند و صفحهٔ هر چاپ مستقل ثبت می‌شود (AT-03).
 */

export interface VersionedQuestionInput {
  id: string;
  questionVersion?: unknown;
  /** مفهوم/مبحث سؤال — دو رکورد با id برابر باید مفهوم واحد داشته باشند */
  topicId?: unknown;
  sourceNodeId?: unknown;
  examYear?: unknown;
  bookletCode?: unknown;
  bookletQuestionNumber?: unknown;
  [key: string]: unknown;
}

export interface VersioningIssue {
  code: 'id_reuse' | 'invalid_version' | 'duplicate_appearance' | 'invalid_edition_page' | 'duplicate_edition';
  message: string;
  subjectId: string;
}

/** نسخهٔ سؤال: عدد صحیح ≥ ۱؛ پیش‌فرض ۱ برای دادهٔ فعلی بدون فیلد نسخه. */
export function resolveQuestionVersion(question: { questionVersion?: unknown }): number {
  const v = question.questionVersion;
  if (v === undefined || v === null) return 1;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1) return v;
  return Number.NaN;
}

/**
 * AT-18: یک شناسه فقط برای یک مفهوم. اگر دو رکورد با id برابر مفهوم متفاوت
 * (topicId/sourceNodeId) داشته باشند، بازیافت شناسه است و رد می‌شود.
 */
export function validateQuestionIdentity(
  questions: VersionedQuestionInput[],
): VersioningIssue[] {
  const issues: VersioningIssue[] = [];
  const byId = new Map<string, { concept: string | null; version: number }>();
  for (const q of questions) {
    const version = resolveQuestionVersion(q);
    if (Number.isNaN(version)) {
      issues.push({ code: 'invalid_version', message: 'questionVersion باید عدد صحیح ≥ ۱ باشد', subjectId: q.id });
      continue;
    }
    const concept = typeof q.topicId === 'string' ? q.topicId : typeof q.sourceNodeId === 'string' ? q.sourceNodeId : null;
    const seen = byId.get(q.id);
    if (!seen) {
      byId.set(q.id, { concept, version });
      continue;
    }
    if (seen.concept !== null && concept !== null && seen.concept !== concept) {
      issues.push({ code: 'id_reuse', message: `شناسهٔ ${q.id} برای دو مفهوم متفاوت (${seen.concept} و ${concept}) استفاده شده است`, subjectId: q.id });
    }
    if (version === seen.version) {
      // ورود مجدد همان نسخه = رکورد تکراری؛ بازبینی‌کننده باید تصمیم بگیرد نه ساخت رکورد موازی (AT-04)
      issues.push({ code: 'id_reuse', message: `شناسهٔ ${q.id} با نسخهٔ ${version} تکراری است — ورود مجدد idempotent نیست`, subjectId: q.id });
    }
  }
  return issues;
}

/** کلید رخداد دفترچه؛ null یعنی رکورد بدون رخداد کامل (مثل تمرین تألیفی). */
export function appearanceKey(question: {
  examYear?: unknown;
  bookletCode?: unknown;
  bookletQuestionNumber?: unknown;
}): string | null {
  if (
    Number.isInteger(question.examYear) &&
    typeof question.bookletCode === 'string' &&
    Number.isInteger(question.bookletQuestionNumber)
  ) {
    return `${question.examYear}/${question.bookletCode}/${question.bookletQuestionNumber}`;
  }
  return null;
}

/**
 * AT-19: کلید ترکیبی سال/دفترچه/شماره باید یکتا باشد؛ یک سؤال می‌تواند در چند
 * دفترچه ظاهر شود اما دو سؤال نمی‌توانند یک رخداد را ادعا کنند.
 */
export function validateAppearances(questions: VersionedQuestionInput[]): VersioningIssue[] {
  const issues: VersioningIssue[] = [];
  const owners = new Map<string, string>();
  for (const q of questions) {
    const key = appearanceKey(q);
    if (!key) continue;
    const owner = owners.get(key);
    if (owner && owner !== q.id) {
      issues.push({ code: 'duplicate_appearance', message: `رخداد ${key} هم به ${owner} و هم به ${q.id} نسبت داده شده است`, subjectId: key });
    } else {
      owners.set(key, q.id);
    }
  }
  return issues;
}

export interface BookEditionInput {
  bookId: string;
  editionYear: number;
  /** صفحهٔ چاپی هر بخش؛ منفی یا غیرصحیح نامعتبر است */
  sectionPages?: Array<{ sectionId: string; printedPage: unknown }>;
}

/** AT-03: چاپ‌های یک کتاب متمایز و صفحه‌ها غیرمنفی‌اند. */
export function validateBookEditions(editions: BookEditionInput[]): VersioningIssue[] {
  const issues: VersioningIssue[] = [];
  const seen = new Set<string>();
  for (const edition of editions) {
    const key = `${edition.bookId}/${edition.editionYear}`;
    if (seen.has(key)) {
      issues.push({ code: 'duplicate_edition', message: `چاپ ${key} بیش از یک‌بار ثبت شده است`, subjectId: key });
    }
    seen.add(key);
    for (const section of edition.sectionPages ?? []) {
      if (!Number.isInteger(section.printedPage) || (section.printedPage as number) < 0) {
        issues.push({ code: 'invalid_edition_page', message: `صفحهٔ چاپی بخش ${section.sectionId} در چاپ ${key} نامعتبر است`, subjectId: section.sectionId });
      }
    }
  }
  return issues;
}

/**
 * AT-04: شناسایی رکوردهای تکراری بین بستهٔ ورودی جدید و بانک موجود.
 * خروجی فقط «دوباره‌وارد نشود»هاست؛ هیچ رکورد تازه‌ای از تکرار ساخته نمی‌شود.
 */
export function partitionImportBatch<T extends { id: string }>(
  incoming: T[],
  existingIds: Set<string>,
): { fresh: T[]; duplicates: T[] } {
  const fresh: T[] = [];
  const duplicates: T[] = [];
  const seenInBatch = new Set<string>();
  for (const item of incoming) {
    if (existingIds.has(item.id) || seenInBatch.has(item.id)) {
      duplicates.push(item);
    } else {
      seenInBatch.add(item.id);
      fresh.push(item);
    }
  }
  return { fresh, duplicates };
}

/**
 * چرخهٔ پیش‌نیاز معتبر نیست (بخش ۶٫۲)؛ یافتن دور در گراف مباحث.
 * edges: from → to یعنی «to پیش‌نیاز from است».
 */
export function findPrerequisiteCycle(nodes: string[], edges: Array<{ from: string; to: string }>): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node, []);
  for (const edge of edges) {
    if (adjacency.has(edge.from) && adjacency.has(edge.to)) adjacency.get(edge.from)!.push(edge.to);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(nodes.map((n) => [n, WHITE]));
  const stack: Array<{ node: string; path: string[] }> = nodes.map((n) => ({ node: n, path: [n] }));
  while (stack.length) {
    const { node, path } = stack.pop()!;
    if (color.get(node) === BLACK) continue;
    color.set(node, GRAY);
    let recursed = false;
    for (const next of adjacency.get(node) ?? []) {
      if (color.get(next) === GRAY) {
        const start = path.indexOf(next);
        return path.slice(start === -1 ? 0 : start).concat(next);
      }
      if (color.get(next) === WHITE) {
        stack.push({ node, path });
        stack.push({ node: next, path: path.concat(next) });
        recursed = true;
        break;
      }
    }
    if (!recursed) color.set(node, BLACK);
  }
  return null;
}
