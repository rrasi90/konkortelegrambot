/**
 * AEL-107 — منطق Import رجیستری آموزشی/برنامه/آزمون.
 *
 * قواعد (سند ۸، AEL-107):
 *  - Dry-run پیش‌فرض؛ هیچ نوشتنی بدون `--write` صریح و محیط غیر Production.
 *  - Import تکراری Idempotent (Upsert روی کلید پایدار، نه رکورد جدید).
 *  - گزارش Accepted / Rejected / Duplicate / Conflict / Unknown با جزئیات.
 *  - ورودی معیوب با خطای قابل اقدام رد می‌شود؛ حدس زده نمی‌شود.
 */
import {
  EMPTY_REGISTRY_BUNDLE,
  findDuplicateKeys,
  RegistryValidationError,
  validateRegistryBundle,
  type RegistryImportBundle,
} from '@ael/contracts';
import { createHash } from 'node:crypto';

export interface ImportReport {
  schemaVersion: number;
  totals: Record<string, number>;
  accepted: number;
  rejected: number;
  duplicates: number;
  conflicts: string[];
  missingReferences: string[];
  prerequisiteCycles: string[];
  contentHash: string;
}

const CAMEL_RE = /([a-z0-9])([A-Z])/g;
const toSnake = (field: string): string => field.replace(CAMEL_RE, '$1_$2').toLowerCase();

// entity → جدول مقصد در Migration 0019
export const ENTITY_TABLES: Record<string, string> = {
  authorities: 'education_authorities',
  systems: 'education_systems',
  levels: 'education_levels',
  stages: 'education_stages',
  tracks: 'education_tracks',
  fields: 'fields_of_study',
  majors: 'majors',
  subfields: 'subfields',
  institutions: 'institutions',
  faculties: 'faculties',
  programs: 'programs',
  programVersions: 'program_versions',
  academicYears: 'academic_years',
  curricula: 'curricula',
  curriculumVersions: 'curriculum_versions',
  courseDefinitions: 'course_definitions',
  courseOfferings: 'course_offerings',
  courseUnits: 'course_units',
  syllabusNodes: 'syllabus_nodes',
  learningOutcomes: 'learning_outcomes',
  curriculumCourses: 'curriculum_courses',
  prerequisiteEdges: 'prerequisite_edges',
  examFamilies: 'exam_families',
  examEvents: 'exam_events',
  examEventVersions: 'exam_event_versions',
  examSubjects: 'exam_subjects',
  examSets: 'exam_sets',
  examCombinations: 'exam_combinations',
  examFieldSubjectAssignments: 'exam_field_subject_assignments',
  admissionRules: 'admission_rules',
  assessmentComponents: 'assessment_components',
  assessmentRubrics: 'assessment_rubrics',
  examBooklets: 'exam_booklets',
};

const PK_FIELD: Record<string, 'id' | 'code'> = {
  authorities: 'code', systems: 'code', levels: 'code', stages: 'code', tracks: 'code',
  fields: 'code', majors: 'code', subfields: 'code', institutions: 'code', faculties: 'code',
  programs: 'code', courseDefinitions: 'code', curricula: 'code',
  examFamilies: 'code', examSubjects: 'code',
};

// ارجاع‌های درون‌بسته‌ای که باید قبل از نوشتن موجود باشند (خارج از این‌ها مثل skills در DB تعریف می‌شوند)
const REFERENCE_CHECKS: Array<{ from: string; field: string; to: string; nullable?: boolean }> = [
  { from: 'systems', field: 'authorityCode', to: 'authorities' },
  { from: 'levels', field: 'systemCode', to: 'systems' },
  { from: 'stages', field: 'levelCode', to: 'levels' },
  { from: 'tracks', field: 'levelCode', to: 'levels' },
  { from: 'fields', field: 'trackCode', to: 'tracks' },
  { from: 'majors', field: 'fieldCode', to: 'fields' },
  { from: 'subfields', field: 'majorCode', to: 'majors' },
  { from: 'faculties', field: 'institutionCode', to: 'institutions' },
  { from: 'programs', field: 'institutionCode', to: 'institutions' },
  { from: 'programs', field: 'levelCode', to: 'levels' },
  { from: 'programs', field: 'fieldCode', to: 'fields' },
  { from: 'programs', field: 'majorCode', to: 'majors', nullable: true },
  { from: 'programVersions', field: 'programCode', to: 'programs' },
  { from: 'curricula', field: 'programVersionId', to: 'programVersions' },
  { from: 'curriculumVersions', field: 'curriculumCode', to: 'curricula' },
  { from: 'courseOfferings', field: 'definitionCode', to: 'courseDefinitions' },
  { from: 'courseOfferings', field: 'programVersionId', to: 'programVersions', nullable: true },
  { from: 'courseOfferings', field: 'academicYearId', to: 'academicYears', nullable: true },
  { from: 'courseUnits', field: 'definitionCode', to: 'courseDefinitions' },
  { from: 'syllabusNodes', field: 'definitionCode', to: 'courseDefinitions' },
  { from: 'syllabusNodes', field: 'parentId', to: 'syllabusNodes', nullable: true },
  { from: 'learningOutcomes', field: 'definitionCode', to: 'courseDefinitions' },
  { from: 'curriculumCourses', field: 'curriculumVersionId', to: 'curriculumVersions' },
  { from: 'curriculumCourses', field: 'definitionCode', to: 'courseDefinitions' },
  { from: 'examEvents', field: 'familyCode', to: 'examFamilies' },
  { from: 'examEventVersions', field: 'eventId', to: 'examEvents' },
  { from: 'examSets', field: 'eventVersionId', to: 'examEventVersions' },
  { from: 'examCombinations', field: 'eventVersionId', to: 'examEventVersions' },
  { from: 'examCombinations', field: 'subfieldCode', to: 'subfields', nullable: true },
  { from: 'examFieldSubjectAssignments', field: 'combinationId', to: 'examCombinations' },
  { from: 'examFieldSubjectAssignments', field: 'subjectCode', to: 'examSubjects' },
  { from: 'admissionRules', field: 'eventVersionId', to: 'examEventVersions' },
  { from: 'assessmentComponents', field: 'eventVersionId', to: 'examEventVersions' },
  { from: 'assessmentRubrics', field: 'componentId', to: 'assessmentComponents' },
  { from: 'examBooklets', field: 'eventVersionId', to: 'examEventVersions' },
];

export interface LoadResult {
  bundle: RegistryImportBundle;
  report: ImportReport;
}

/** بارگذاری و اعتبارسنجی کامل بسته؛ در صورت خطا RegistryValidationError پرتاب می‌شود. */
export function loadRegistryBundle(raw: unknown, bundleName = 'inline'): LoadResult {
  const structural = validateRegistryBundle(raw);
  if (!structural.ok) throw new RegistryValidationError(structural.errors);
  const bundle = raw as RegistryImportBundle;

  const report: ImportReport = {
    schemaVersion: bundle.schemaVersion,
    totals: {},
    accepted: 0,
    rejected: 0,
    duplicates: 0,
    conflicts: [],
    missingReferences: [],
    prerequisiteCycles: [],
    contentHash: '',
  };

  for (const [entity, list] of Object.entries(bundle)) {
    if (entity === 'schemaVersion') continue;
    report.totals[entity] = (list as unknown[]).length;
  }
  report.duplicates = findDuplicateKeys(bundle).length;

  const idSets = new Map<string, Set<string>>();
  for (const [entity, list] of Object.entries(bundle)) {
    if (entity === 'schemaVersion') continue;
    const pk = PK_FIELD[entity] ?? 'id';
    idSets.set(entity, new Set((list as Array<Record<string, unknown>>).map(item => String(item[pk]))));
  }

  for (const check of REFERENCE_CHECKS) {
    const list = bundle[check.from as keyof RegistryImportBundle] as unknown as Array<Record<string, unknown>>;
    const known = idSets.get(check.to) ?? new Set<string>();
    list.forEach((item, index) => {
      const value = item[check.field];
      if (value === null || value === undefined) {
        if (!check.nullable) {
          report.missingReferences.push(`${bundleName}: ${check.from}[${index}].${check.field} الزامی است ولی خالی است.`);
        }
        return;
      }
      if (!known.has(String(value))) {
        report.missingReferences.push(`${bundleName}: ${check.from}[${index}].${check.field}="${value}" در ${check.to} نیست.`);
      }
    });
  }

  report.prerequisiteCycles = detectPrerequisiteCycles(bundle);
  report.accepted = Object.entries(report.totals).reduce((sum, [, count]) => sum + count, 0);
  report.rejected = report.missingReferences.length + report.prerequisiteCycles.length;
  if (report.duplicates > 0) report.rejected += report.duplicates;
  report.contentHash = createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
  return { bundle, report };
}

/** یال‌های درون‌بسته‌ای course→course و چرخهٔ آن‌ها (Kahn). */
export function detectPrerequisiteCycles(bundle: RegistryImportBundle): string[] {
  const edges = bundle.prerequisiteEdges.filter(edge => edge.sourceKind === 'course' && edge.targetKind === 'course');
  if (!edges.length) return [];
  const nodes = new Set<string>([
    ...bundle.courseDefinitions.map(course => course.code),
    ...edges.flatMap(edge => [edge.sourceId, edge.targetId]),
  ]);
  const indegree = new Map<string, number>([...nodes].map(node => [node, 0]));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.sourceId, [...(adjacency.get(edge.sourceId) ?? []), edge.targetId]);
    indegree.set(edge.targetId, (indegree.get(edge.targetId) ?? 0) + 1);
  }
  const queue = [...nodes].filter(node => (indegree.get(node) ?? 0) === 0);
  const visited: string[] = [];
  while (queue.length) {
    const node = queue.shift()!;
    visited.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const degree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }
  const remaining = [...nodes].filter(node => !visited.includes(node));
  if (!remaining.length) return [];
  return [`چرخهٔ پیش‌نیاز شامل: ${remaining.slice(0, 12).join(' -> ')}${remaining.length > 12 ? ' …' : ''}`];
}

function sqlString(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

/**
 * تولید SQL Idempotent (Upsert با ON CONFLICT) برای اجرا روی DB آزمایشی/غیر Production.
 * هیچ مقدار حدسی اضافه نمی‌شود؛ ستون‌های موجود در JSON همان ستون‌های Migration 0019 هستند.
 */
export function buildUpsertSql(bundle: RegistryImportBundle): string {
  const statements: string[] = ['-- تولیدشده توسط scripts/import-registry.mts (AEL-107)'];
  statements.push('begin;');
  for (const [entity, table] of Object.entries(ENTITY_TABLES)) {
    const list = bundle[entity as keyof RegistryImportBundle] as unknown[];
    if (!Array.isArray(list) || list.length === 0) continue;
    const pk = PK_FIELD[entity] ?? 'id';
    for (const item of list as Array<Record<string, unknown>>) {
      const keys = Object.keys(item);
      const columns = keys.map(toSnake);
      const values = keys.map(key => sqlString(item[key]));
      const updates = keys.filter(key => key !== pk).map(key => `${toSnake(key)} = excluded.${toSnake(key)}`);
      statements.push(
        `insert into ${table} (${columns.join(', ')}) values (${values.join(', ')})\n` +
        `  on conflict (${pk}) do update set ${updates.join(', ')}, updated_at = now();`,
      );
    }
  }
  statements.push('commit;');
  return statements.join('\n');
}

export { EMPTY_REGISTRY_BUNDLE };
