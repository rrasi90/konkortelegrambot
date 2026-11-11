/**
 * V3-022..027 — کاتالوگ داده‌محور آزمون‌ها و ingestion idempotent (مأموریت v5 §6)
 *
 * سه محور مستقل (V3-022): سابقهٔ تحصیلی داوطلب / مقصد آزمونی / مسیر پذیرش —
 * با خانوادهٔ آزمون یکی نمی‌شوند. مقادیر رسمی فقط با منبع اولیه official_verified
 * می‌شوند؛ بدون سند، reported/unknown می‌مانند (HR-02). کد رسمی بدون padding و
 * دقیقاً مطابق منبع؛ شناسهٔ داخلی مجزا (HD-01).
 *
 * Ingestion (V3-026): idempotent — تکرار همان ورودی رکورد جدید نمی‌سازد؛
 * رکورد نامعتبر quarantine می‌شود و هرگز وارد کاتالوگ فعال نمی‌شود.
 *
 * Coverage (V3-027): «پوشش مشاهده‌شده» با مخرج صریح — با پوشش رسمی اشتباه
 * گرفته نمی‌شود؛ missing/unknown/not_applicable از صفر مستقل‌اند.
 */

import type { ProfileEducationLevel } from './candidate-profile';

// V3-022 — مدل مسیر پذیرش canonical در exam-family.ts هست (AdmissionRoute +
// validateAdmissionRoute)؛ این ماژول آن را تکرار نمی‌کند — فقط کاتالوگ مواد/نگاشت/
// ingestion/coverage را ارائه می‌دهد.

export interface FieldCatalogEntry {
  id: string;
  /** کد رسمی — فقط با منبع؛ بدون padding؛ نامعلوم null */
  officialCode: string | null;
  title: string;
  parentFieldId: string | null;
  /** گروه آزمایشی/مجموعه */
  setLabel: string | null;
  evidenceStatus: 'official_verified' | 'reported' | 'unknown';
  validFromYear?: number | null;
}

export interface SubjectCoefficient {
  subjectId: string;
  title: string;
  /** unknown با null — صفر رسمی با سند (Unknown ≠ Zero، HD-03) */
  coefficient: number | null;
  valueState: 'positive' | 'zero_official' | 'unknown' | 'not_applicable';
  evidenceStatus: 'official_verified' | 'reported' | 'unknown';
  /** scope دقیق: سال/مجموعه — مقدار بدون scope مجاز نیست */
  scope: { examYear: number; setLabel: string };
}

export interface SubjectCourseMapping {
  id: string;
  subjectId: string;
  courseId: string;
  /** نگاشت مبهم با confidence — حدس ممنوع */
  confidence: 'verified' | 'reported' | 'needs_mapping';
  note?: string;
}

/* ---------- V3-026 — Ingestion idempotent ---------- */

export interface CatalogIngestResult<T> {
  /** رکوردهای جدیدی که واقعاً اعمال شدند */
  applied: T[];
  /** رکوردهای تکراری که دوباره اعمال نشدند (idempotency) */
  skippedDuplicates: T[];
  /** رکوردهای نامعتبر — وارد کاتالوگ فعال نشده‌اند */
  quarantined: Array<{ entry: T; reason: string }>;
}

export type CatalogEntryValidator<T> = (entry: T) => string[];

/**
 * ورود idempotent: کلید یکتایی هر entry با کلید انتخابی caller تعیین می‌شود.
 * همان ورودیِ تکراری skip می‌شود؛ نامعتبر quarantine؛ تغییر سند رسمی باید
 * ExamVersion جدید بسازد (اینجا فقط اعمال رکورد مشخص است).
 */
export function ingestCatalogEntries<T>(
  incoming: T[],
  existing: T[],
  keyOf: (entry: T) => string,
  validate: CatalogEntryValidator<T>,
): CatalogIngestResult<T> {
  const existingKeys = new Set(existing.map(keyOf));
  const applied: T[] = [];
  const skippedDuplicates: T[] = [];
  const quarantined: Array<{ entry: T; reason: string }> = [];
  const seenInBatch = new Set<string>();
  for (const entry of incoming) {
    const errors = validate(entry);
    if (errors.length > 0) {
      quarantined.push({ entry, reason: errors.join(' | ') });
      continue;
    }
    const key = keyOf(entry);
    if (existingKeys.has(key) || seenInBatch.has(key)) {
      skippedDuplicates.push(entry);
      continue;
    }
    seenInBatch.add(key);
    applied.push(entry);
  }
  return { applied, skippedDuplicates, quarantined };
}

/* ---------- V3-027 — پوشش مشاهده‌شده (نه رسمی) ---------- */

export interface CoverageDenominator {
  /** مخرج فقط با منبع رسمی تعریف می‌شود؛ وگرنه observed */
  kind: 'official_verified' | 'reported';
  total: number;
  sourceId?: string;
}

export interface CoverageComputation {
  /** نسبت مشاهده‌شده — فقط وقتی مخرج قابل دفاع باشد */
  observedRatio: number | null;
  denominator: CoverageDenominator | null;
  covered: number;
  /** از صفر مستقل: */
  missing: number;
  unknown: number;
  notApplicable: number;
}

export function computeObservedCoverage(
  covered: number,
  missing: number,
  unknown: number,
  notApplicable: number,
  denominator: CoverageDenominator | null,
): CoverageComputation {
  const totalItems = covered + missing + unknown + notApplicable;
  const defensible = denominator !== null && denominator.total > 0;
  return {
    observedRatio: defensible && denominator!.total > 0
      ? Number((covered / denominator!.total).toFixed(4))
      : null,
    denominator,
    covered,
    missing,
    unknown,
    notApplicable,
  };
}

/* ---------- نرمال‌سازی alias فارسی (V3-025) — متن اصلی حفظ می‌شود ---------- */

export interface SubjectAlias {
  subjectId: string;
  /** متن اصلی بدون تغییر */
  raw: string;
  /** کلید نرمال‌شده برای تطبیق — فقط مقایسه، نه جایگزینی */
  normalized: string;
}

export function normalizePersianSubjectName(raw: string): string {
  return raw
    .replace(/[\u064A\u0649]/g, 'ی')
    .replace(/[\u0643]/g, 'ک')
    .replace(/[\u0623\u0625\u0622]/g, 'ا')
    .replace(/[\u0640]/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- Validatorهای کاتالوگ ---------- */

export function validateSubjectCoefficient(c: SubjectCoefficient): string[] {
  const errors: string[] = [];
  collect(errors, Number.isInteger(c.scope.examYear) && c.scope.examYear > 1300, 'scope.examYear نامعتبر');
  collect(errors, c.scope.setLabel.length > 0, 'scope.setLabel الزامی است');
  if (c.valueState === 'positive') {
    collect(errors, typeof c.coefficient === 'number' && c.coefficient > 0, 'positive بدون مقدار مثبت');
    collect(errors, c.evidenceStatus !== 'unknown', 'مقدار مثبت با evidence unknown ناسازگار است');
  }
  if (c.valueState === 'zero_official') {
    collect(errors, c.coefficient === 0, 'zero_official باید دقیقاً صفر باشد');
    collect(errors, c.evidenceStatus === 'official_verified', 'صفر رسمی نیازمند سند اولیه است');
  }
  if (c.valueState === 'unknown') collect(errors, c.coefficient === null, 'unknown باید null باشد (نه صفر)');
  if (c.valueState === 'not_applicable') collect(errors, c.coefficient === null, 'not_applicable باید null باشد');
  return errors;
}

function collect(list: string[], condition: boolean, message: string): void {
  if (!condition) list.push(message);
}
