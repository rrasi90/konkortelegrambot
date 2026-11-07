/**
 * AEL-101..108 — قراردادهای رجیستری آموزشی (فاز ۱)
 *
 * قرارداد این ماژول با Migration `0019_education_registry.sql` هم‌خوان است.
 * اصول (ADR-002، ADR-008):
 *  - افزودن رشته/نظام/مقررات = داده، نه تغییر کد؛ Enum فقط برای دسته‌های فنی محدود.
 *  - هر مقدار مقرراتی تاریخ اعتبار دارد؛ نامعلوم هرگز حدس زده نمی‌شود.
 *  - `unknown` با `zero` و `not_applicable` یکی نیست.
 */

// ---------- دسته‌های فنی محدود (فقط این‌ها Enum می‌مانند) ----------
export const REGISTRY_VERSION_STATUSES = ['draft', 'pending_review', 'approved', 'published', 'superseded', 'rejected'] as const;
export type RegistryVersionStatus = (typeof REGISTRY_VERSION_STATUSES)[number];

export const REGISTRY_LIFECYCLE_STATUSES = ['active', 'retired', 'archived'] as const;
export type RegistryLifecycleStatus = (typeof REGISTRY_LIFECYCLE_STATUSES)[number];

export const OFFICIALITY_KINDS = ['official', 'proposed', 'authored'] as const;
export type Officiality = (typeof OFFICIALITY_KINDS)[number];

export const SOURCE_TIERS = ['primary_official', 'secondary_republication', 'news_report', 'internal_note'] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];

export const UNIT_KINDS = ['lecture', 'practical', 'workshop', 'lab'] as const;
export type CourseUnitKind = (typeof UNIT_KINDS)[number];

export const NODE_KINDS = ['chapter', 'section', 'topic', 'concept'] as const;
export type SyllabusNodeKind = (typeof NODE_KINDS)[number];

export const EDGE_KINDS = ['prerequisite', 'corequisite', 'recommended'] as const;
export type PrerequisiteEdgeKind = (typeof EDGE_KINDS)[number];

export const EDGE_ENTITY_KINDS = ['course', 'skill', 'outcome', 'node'] as const;
export type EdgeEntityKind = (typeof EDGE_ENTITY_KINDS)[number];

export const COMPONENT_KINDS = ['exam', 'records', 'interview', 'research', 'language', 'other'] as const;
export type AssessmentComponentKind = (typeof COMPONENT_KINDS)[number];

export const NEGATIVE_MARKING_KINDS = ['none', 'per_question', 'custom'] as const;
export type NegativeMarkingKind = (typeof NEGATIVE_MARKING_KINDS)[number];

// ---------- تایپ‌های نسخه‌دار مشترک ----------
export interface VersionMetadata {
  status: RegistryVersionStatus;
  effectiveFrom: string | null;   // تاریخ میلادی ISO
  effectiveUntil: string | null;
  contentHash: string | null;
  previousVersionId: string | null;
  changeReason: string | null;
  sourceIds: string[];
  createdBy: string | null;
}

export interface VersionedEntityBase extends VersionMetadata {
  id: string;
  versionNumber: number;
}

// ---------- ساختار آموزشی ----------
export interface EducationAuthority { code: string; name: string; kind: 'government' | 'agency' | 'university' | 'council' | 'other'; status: RegistryLifecycleStatus }
export interface EducationSystem { code: string; authorityCode: string; name: string; status: RegistryLifecycleStatus }
export interface EducationLevel { code: string; systemCode: string; name: string; levelOrder: number; status: RegistryLifecycleStatus }
export interface EducationStage { code: string; levelCode: string; name: string; status: RegistryLifecycleStatus }
export interface EducationTrack { code: string; levelCode: string; name: string; status: RegistryLifecycleStatus }
export interface FieldOfStudy { code: string; trackCode: string; name: string; aliases: string[]; status: RegistryLifecycleStatus }
export interface Major { code: string; fieldCode: string; name: string; status: RegistryLifecycleStatus }
export interface Subfield { code: string; majorCode: string; name: string; examCode: string | null; status: RegistryLifecycleStatus }
export interface Institution { code: string; name: string; kind: 'university' | 'institute' | 'school' | 'other'; status: RegistryLifecycleStatus }
export interface Faculty { code: string; institutionCode: string; name: string; status: RegistryLifecycleStatus }

// ---------- برنامه درسی ----------
export interface Program { code: string; institutionCode: string; levelCode: string; fieldCode: string; majorCode: string | null; name: string; status: RegistryLifecycleStatus }
export type ProgramVersion = VersionedEntityBase & { programCode: string };
export interface AcademicYear { id: string; yearLabel: string; startsOn: string | null; endsOn: string | null }
export interface Curriculum { code: string; programVersionId: string; name: string; status: RegistryVersionStatus }
export type CurriculumVersion = VersionedEntityBase & { curriculumCode: string };
export interface CourseDefinition { code: string; name: string; aliases: string[]; status: RegistryVersionStatus; createdBy: string | null }
export interface CourseOffering { id: string; definitionCode: string; programVersionId: string | null; academicYearId: string | null; status: RegistryVersionStatus }
export interface CourseUnit { id: string; definitionCode: string; unitKind: CourseUnitKind; hours: number; position: number }
export interface SyllabusNode {
  id: string; definitionCode: string; parentId: string | null; position: number;
  title: string; nodeKind: SyllabusNodeKind; officiality: Officiality; status: RegistryVersionStatus;
  knowledgeNodeId: string | null;
}
export interface LearningOutcome { id: string; definitionCode: string; statement: string; bloomLevel: number | null; competencyCode: string | null; status: RegistryVersionStatus }
export interface CurriculumCourse { id: string; curriculumVersionId: string; definitionCode: string; term: number; isElective: boolean; position: number }
export interface PrerequisiteEdge {
  id: string; sourceKind: EdgeEntityKind; sourceId: string;
  targetKind: EdgeEntityKind; targetId: string;
  edgeKind: PrerequisiteEdgeKind; scope: string | null; status: RegistryVersionStatus;
}

// ---------- آزمون و پذیرش ----------
export interface ExamFamily { code: string; name: string; status: RegistryLifecycleStatus }
export interface ExamEvent {
  id: string;
  familyCode: string;
  /** سطح آزمون؛ مثال master یا doctorate. برای رویدادهای قدیمی اختیاری است. */
  levelCode?: string | null;
  academicYearId: string | null;
  yearLabel: string;
  session: number;
  name: string;
  status: RegistryVersionStatus;
}
export type ExamEventVersion = VersionedEntityBase & { eventId: string; rulesHash: string | null };
export interface RegistryExamSubject { code: string; name: string; status: RegistryLifecycleStatus }
export type ExamSetSelectionCategory = 'main' | 'floating' | 'independent' | 'unknown';
export interface RegistryExamSet {
  id: string;
  eventVersionId: string;
  code: string;
  name: string;
  /** دستهٔ انتخاب در همان سال/نوبت؛ از سال دیگر به ارث نمی‌رسد. */
  selectionCategory?: ExamSetSelectionCategory;
  /** آیا برای فعال‌سازی این مجموعه باید یک کد ترکیب مشخص شود؟ */
  requiresCombinationSelection?: boolean;
}
export interface RegistryExamCombination {
  id: string;
  eventVersionId: string;
  code: string;
  name: string;
  /** سازگاری قدیمی؛ رابطهٔ چندبه‌چند canonical در examCombinationSubfields است. */
  subfieldCode: string | null;
}
export interface ExamSetCombinationMapping {
  id: string;
  examSetId: string;
  combinationId: string;
  status: RegistryVersionStatus;
  sourceIds: string[];
}
export type SubfieldEligibility = 'eligible' | 'conditional' | 'restricted' | 'not_available' | 'needs_check';
export interface ExamCombinationSubfieldMapping {
  id: string;
  combinationId: string;
  subfieldCode: string;
  eligibility: SubfieldEligibility;
  restrictionCode: string | null;
  note: string | null;
  status: RegistryVersionStatus;
  sourceIds: string[];
}
export type ExamSubjectCourseMappingKind = 'exact' | 'covers' | 'partial' | 'supplementary';
export interface ExamSubjectCourseMapping {
  id: string;
  subjectCode: string;
  courseDefinitionCode: string;
  mappingKind: ExamSubjectCourseMappingKind;
  /** سهم پوشش این درس از مادهٔ امتحانی، فقط در صورت داشتن مبنای مستند. */
  coverageWeight: number | null;
  status: RegistryVersionStatus;
  sourceIds: string[];
}
export type ExamSubjectRole = 'shared' | 'specialized' | 'elective' | 'conditional' | 'unknown';
export type ExamCoefficientScope = 'exam_component' | 'subject' | 'course' | 'unknown';
export interface ExamFieldSubjectAssignment {
  id: string;
  combinationId: string;
  subjectCode: string;
  /** فیلد قدیمی؛ برای سازگاری Import باقی مانده و مرجع canonical نیست. */
  coefficient: number;
  /** فیلد قدیمی؛ وزن رسمی آزمون را با اولویت مطالعه یکی نکنید. */
  weight: number;
  negativeMarking: NegativeMarkingKind;
  timeLimitMinutes: number | null;
  position: number;
  /** ضریب رسمی با دامنهٔ صریح؛ null یعنی در منبع تعیین نشده، نه ضریب صفر. */
  officialCoefficient?: number | null;
  coefficientScope?: ExamCoefficientScope;
  /** وزن داخلی برنامه‌ریزی مطالعه؛ هرگز جایگزین ضریب رسمی نیست. */
  learningPriorityWeight?: number | null;
  subjectRole?: ExamSubjectRole;
  verification?: 'official_verified' | 'reported' | 'needs_check';
  sourceIds?: string[];
}
export interface ExamSelectionCategoryLimit {
  category: ExamSetSelectionCategory;
  minSelections: number;
  maxSelections: number | null;
}
export type ExamSelectionPurpose = 'study_plan' | 'registration_intent' | 'official_registration';
export type ExamSelectionMode = 'single' | 'primary_plus_secondary' | 'multiple' | 'unverified';
export interface ExamSelectionPolicy {
  id: string;
  eventVersionId: string;
  /** null = policy برای کل رویداد؛ در غیر این صورت فقط همان مجموعه. */
  examSetId: string | null;
  purpose: ExamSelectionPurpose;
  mode: ExamSelectionMode;
  minSelections: number | null;
  maxSelections: number | null;
  maxCombinationsPerSet: number | null;
  allowMultipleCombinationsPerSet: boolean;
  requiresPrimarySelection: boolean;
  categoryLimits: ExamSelectionCategoryLimit[];
  /** منشأ policy محصولی است یا ادعای مقررات رسمی دارد. */
  policyOrigin: 'official' | 'reported' | 'product';
  verification: 'official_verified' | 'reported' | 'needs_check';
  status: RegistryVersionStatus;
  sourceIds: string[];
  note: string | null;
}
export interface AdmissionRule { id: string; eventVersionId: string; ruleJson: Record<string, unknown>; status: RegistryVersionStatus; sourceIds: string[] }
export interface AssessmentComponent { id: string; eventVersionId: string; kind: AssessmentComponentKind; weight: number; config: Record<string, unknown> }
export interface AssessmentRubric { id: string; componentId: string; versionNumber: number; criteria: Array<Record<string, unknown>>; status: RegistryVersionStatus }
export interface ExamBooklet { id: string; eventVersionId: string; code: string; form: number; status: RegistryVersionStatus }

// ---------- بستهٔ Import نسخه‌دار ----------
export const REGISTRY_IMPORT_SCHEMA_VERSION = 1;

export interface RegistryImportBundle {
  schemaVersion: typeof REGISTRY_IMPORT_SCHEMA_VERSION;
  authorities: EducationAuthority[];
  systems: EducationSystem[];
  levels: EducationLevel[];
  stages: EducationStage[];
  tracks: EducationTrack[];
  fields: FieldOfStudy[];
  majors: Major[];
  subfields: Subfield[];
  institutions: Institution[];
  faculties: Faculty[];
  programs: Program[];
  programVersions: ProgramVersion[];
  academicYears: AcademicYear[];
  curricula: Curriculum[];
  curriculumVersions: CurriculumVersion[];
  courseDefinitions: CourseDefinition[];
  courseOfferings: CourseOffering[];
  courseUnits: CourseUnit[];
  syllabusNodes: SyllabusNode[];
  learningOutcomes: LearningOutcome[];
  curriculumCourses: CurriculumCourse[];
  prerequisiteEdges: PrerequisiteEdge[];
  examFamilies: ExamFamily[];
  examEvents: ExamEvent[];
  examEventVersions: ExamEventVersion[];
  examSubjects: RegistryExamSubject[];
  examSets: RegistryExamSet[];
  examCombinations: RegistryExamCombination[];
  /** Additive v1-import fields; omitted arrays are treated as empty. */
  examSetCombinationMappings?: ExamSetCombinationMapping[];
  examCombinationSubfields?: ExamCombinationSubfieldMapping[];
  examSubjectCourseMappings?: ExamSubjectCourseMapping[];
  examSelectionPolicies?: ExamSelectionPolicy[];
  examFieldSubjectAssignments: ExamFieldSubjectAssignment[];
  admissionRules: AdmissionRule[];
  assessmentComponents: AssessmentComponent[];
  assessmentRubrics: AssessmentRubric[];
  examBooklets: ExamBooklet[];
}

export const EMPTY_REGISTRY_BUNDLE: RegistryImportBundle = {
  schemaVersion: REGISTRY_IMPORT_SCHEMA_VERSION,
  authorities: [], systems: [], levels: [], stages: [], tracks: [], fields: [], majors: [], subfields: [],
  institutions: [], faculties: [], programs: [], programVersions: [], academicYears: [],
  curricula: [], curriculumVersions: [], courseDefinitions: [], courseOfferings: [], courseUnits: [],
  syllabusNodes: [], learningOutcomes: [], curriculumCourses: [], prerequisiteEdges: [],
  examFamilies: [], examEvents: [], examEventVersions: [], examSubjects: [], examSets: [],
  examCombinations: [], examSetCombinationMappings: [], examCombinationSubfields: [],
  examSubjectCourseMappings: [], examSelectionPolicies: [], examFieldSubjectAssignments: [], admissionRules: [], assessmentComponents: [],
  assessmentRubrics: [], examBooklets: [],
};

// ---------- Guardها ----------
export class RegistryValidationError extends Error {
  readonly errors: RegistryFieldError[];
  constructor(errors: RegistryFieldError[]) {
    super(errors[0]?.message ?? 'بستهٔ رجیستری معتبر نیست.');
    this.name = 'RegistryValidationError';
    this.errors = errors;
  }
}

export interface RegistryFieldError {
  entity: string;
  index: number;
  field: string | null;
  code: string;
  message: string;
  severity: 'error';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalNonEmptyString(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim().length > 0);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function checkEnum(value: unknown, options: readonly string[]): boolean {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

function isCode(value: unknown): boolean {
  // شناسهٔ پایدار: حروف/عدد/خط‌تیره/زیرخط/نقطه، ۱ تا ۱۲۸ نویسه
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function checkLifecycleStatus(value: unknown): boolean {
  return checkEnum(value, REGISTRY_LIFECYCLE_STATUSES);
}

function checkVersionStatus(value: unknown): boolean {
  return checkEnum(value, REGISTRY_VERSION_STATUSES);
}

function checkVersionMetadata(value: Record<string, unknown>, errors: RegistryFieldError[], entity: string, index: number): void {
  if (!checkVersionStatus(value.status)) errors.push({ entity, index, field: 'status', code: 'invalid_enum', message: 'وضعیت نسخه معتبر نیست.', severity: 'error' });
  if (value.effectiveFrom !== null && value.effectiveFrom !== undefined && typeof value.effectiveFrom !== 'string') {
    errors.push({ entity, index, field: 'effectiveFrom', code: 'invalid_type', message: 'تاریخ اعتبار باید رشته یا null باشد.', severity: 'error' });
  }
  if (value.effectiveUntil !== null && value.effectiveUntil !== undefined && typeof value.effectiveUntil !== 'string') {
    errors.push({ entity, index, field: 'effectiveUntil', code: 'invalid_type', message: 'پایان اعتبار باید رشته یا null باشد.', severity: 'error' });
  }
  if (!Array.isArray(value.sourceIds) || !value.sourceIds.every(id => typeof id === 'string')) {
    errors.push({ entity, index, field: 'sourceIds', code: 'invalid_type', message: 'منابع نسخه باید فهرست رشته باشد.', severity: 'error' });
  }
}

interface EntitySpec {
  entity: string;
  requires?: (keyof RegistryImportBundle & string)[];
  validate: (item: unknown, errors: RegistryFieldError[], index: number) => void;
}

function codeCheck(field: string) {
  return (item: Record<string, unknown>, errors: RegistryFieldError[], index: number, entity: string): void => {
    if (!isCode(item[field])) errors.push({ entity, index, field, code: 'invalid_code', message: `شناسهٔ پایدار «${field}» معتبر نیست.`, severity: 'error' });
  };
}

function lifecycleEntity(entity: string, codeField: string, extra?: (item: Record<string, unknown>, errors: RegistryFieldError[], index: number) => void): EntitySpec {
  return {
    entity,
    validate: (item, errors, index) => {
      if (!item || typeof item !== 'object') {
        errors.push({ entity, index, field: null, code: 'invalid_type', message: 'رکورد باید شیء باشد.', severity: 'error' });
        return;
      }
      const record = item as Record<string, unknown>;
      codeCheck(codeField)(record, errors, index, entity);
      if (!isNonEmptyString(record.name)) errors.push({ entity, index, field: 'name', code: 'required', message: 'عنوان الزامی است.', severity: 'error' });
      if (record.status !== undefined && !checkLifecycleStatus(record.status)) {
        errors.push({ entity, index, field: 'status', code: 'invalid_enum', message: 'وضعیت چرخهٔ عمر معتبر نیست.', severity: 'error' });
      }
      extra?.(record, errors, index);
    },
  };
}

function versionedEntity(entity: string, parentCodeField: string, extra?: (item: Record<string, unknown>, errors: RegistryFieldError[], index: number) => void): EntitySpec {
  return {
    entity,
    validate: (item, errors, index) => {
      if (!item || typeof item !== 'object') {
        errors.push({ entity, index, field: null, code: 'invalid_type', message: 'رکورد باید شیء باشد.', severity: 'error' });
        return;
      }
      const record = item as Record<string, unknown>;
      if (!isCode(record.id)) errors.push({ entity, index, field: 'id', code: 'invalid_code', message: 'شناسهٔ نسخه معتبر نیست.', severity: 'error' });
      if (!isCode(record[parentCodeField])) errors.push({ entity, index, field: parentCodeField, code: 'invalid_code', message: 'شناسهٔ والد معتبر نیست.', severity: 'error' });
      if (!Number.isInteger(record.versionNumber) || (record.versionNumber as number) < 1) {
        errors.push({ entity, index, field: 'versionNumber', code: 'invalid_number', message: 'شمارهٔ نسخه باید عدد صحیح مثبت باشد.', severity: 'error' });
      }
      checkVersionMetadata(record, errors, entity, index);
      extra?.(record, errors, index);
    },
  };
}

function plainEntity(entity: string, validate: (record: Record<string, unknown>, errors: RegistryFieldError[], index: number) => void): EntitySpec {
  return {
    entity,
    validate: (item, errors, index) => {
      if (!item || typeof item !== 'object') {
        errors.push({ entity, index, field: null, code: 'invalid_type', message: 'رکورد باید شیء باشد.', severity: 'error' });
        return;
      }
      validate(item as Record<string, unknown>, errors, index);
    },
  };
}

const SIMPLE_ENTITIES: EntitySpec[] = [
  lifecycleEntity('authorities', 'code', (record, errors, index) => {
    if (record.kind !== undefined && !checkEnum(record.kind, ['government', 'agency', 'university', 'council', 'other'])) {
      errors.push({ entity: 'authorities', index, field: 'kind', code: 'invalid_enum', message: 'نوع مرجع معتبر نیست.', severity: 'error' });
    }
  }),
  lifecycleEntity('systems', 'code', (record, errors, index) => {
    if (!isCode(record.authorityCode)) errors.push({ entity: 'systems', index, field: 'authorityCode', code: 'invalid_code', message: 'مرجع نظام معتبر نیست.', severity: 'error' });
  }),
  lifecycleEntity('levels', 'code', (record, errors, index) => {
    if (!isCode(record.systemCode)) errors.push({ entity: 'levels', index, field: 'systemCode', code: 'invalid_code', message: 'نظام معتبر نیست.', severity: 'error' });
    if (!Number.isInteger(record.levelOrder) || (record.levelOrder as number) < 0) {
      errors.push({ entity: 'levels', index, field: 'levelOrder', code: 'invalid_number', message: 'ترتیب سطح باید عدد صحیح نامنفی باشد.', severity: 'error' });
    }
  }),
  lifecycleEntity('stages', 'code', (record, errors, index) => {
    if (!isCode(record.levelCode)) errors.push({ entity: 'stages', index, field: 'levelCode', code: 'invalid_code', message: 'سطح والد معتبر نیست.', severity: 'error' });
  }),
  lifecycleEntity('tracks', 'code', (record, errors, index) => {
    if (!isCode(record.levelCode)) errors.push({ entity: 'tracks', index, field: 'levelCode', code: 'invalid_code', message: 'سطح والد معتبر نیست.', severity: 'error' });
  }),
  lifecycleEntity('fields', 'code', (record, errors, index) => {
    if (!isCode(record.trackCode)) errors.push({ entity: 'fields', index, field: 'trackCode', code: 'invalid_code', message: 'شاخهٔ والد معتبر نیست.', severity: 'error' });
    if (record.aliases !== undefined && !isStringArray(record.aliases)) {
      errors.push({ entity: 'fields', index, field: 'aliases', code: 'invalid_type', message: 'نام‌های مستعار باید فهرست رشته باشد.', severity: 'error' });
    }
  }),
  lifecycleEntity('majors', 'code', (record, errors, index) => {
    if (!isCode(record.fieldCode)) errors.push({ entity: 'majors', index, field: 'fieldCode', code: 'invalid_code', message: 'رشتهٔ والد معتبر نیست.', severity: 'error' });
  }),
  lifecycleEntity('subfields', 'code', (record, errors, index) => {
    if (!isCode(record.majorCode)) errors.push({ entity: 'subfields', index, field: 'majorCode', code: 'invalid_code', message: 'رشتهٔ والد معتبر نیست.', severity: 'error' });
    if (!isOptionalNonEmptyString(record.examCode)) errors.push({ entity: 'subfields', index, field: 'examCode', code: 'invalid_code', message: 'کد آزمون معتبر نیست.', severity: 'error' });
  }),
  lifecycleEntity('institutions', 'code', (record, errors, index) => {
    if (record.kind !== undefined && !checkEnum(record.kind, ['university', 'institute', 'school', 'other'])) {
      errors.push({ entity: 'institutions', index, field: 'kind', code: 'invalid_enum', message: 'نوع مؤسسه معتبر نیست.', severity: 'error' });
    }
  }),
  lifecycleEntity('faculties', 'code', (record, errors, index) => {
    if (!isCode(record.institutionCode)) errors.push({ entity: 'faculties', index, field: 'institutionCode', code: 'invalid_code', message: 'مؤسسهٔ والد معتبر نیست.', severity: 'error' });
  }),
  lifecycleEntity('programs', 'code', (record, errors, index) => {
    for (const field of ['institutionCode', 'levelCode', 'fieldCode'] as const) {
      if (!isCode(record[field])) errors.push({ entity: 'programs', index, field, code: 'invalid_code', message: `«${field}» معتبر نیست.`, severity: 'error' });
    }
    if (record.majorCode !== null && record.majorCode !== undefined && !isCode(record.majorCode)) {
      errors.push({ entity: 'programs', index, field: 'majorCode', code: 'invalid_code', message: 'گرایش معتبر نیست.', severity: 'error' });
    }
  }),
  lifecycleEntity('examFamilies', 'code'),
  lifecycleEntity('examSubjects', 'code'),
];

const VERSIONED_ENTITIES: EntitySpec[] = [
  versionedEntity('programVersions', 'programCode'),
  versionedEntity('curriculumVersions', 'curriculumCode'),
  versionedEntity('examEventVersions', 'eventId'),
];

const PLAIN_ENTITIES: EntitySpec[] = [
  plainEntity('academicYears', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'academicYears', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ سال معتبر نیست.', severity: 'error' });
    if (!isNonEmptyString(record.yearLabel)) errors.push({ entity: 'academicYears', index, field: 'yearLabel', code: 'required', message: 'برچسب سال الزامی است.', severity: 'error' });
  }),
  plainEntity('curricula', (record, errors, index) => {
    if (!isCode(record.code)) errors.push({ entity: 'curricula', index, field: 'code', code: 'invalid_code', message: 'کد برنامهٔ درسی معتبر نیست.', severity: 'error' });
    if (!isCode(record.programVersionId)) errors.push({ entity: 'curricula', index, field: 'programVersionId', code: 'invalid_code', message: 'نسخهٔ برنامه معتبر نیست.', severity: 'error' });
    if (!isNonEmptyString(record.name)) errors.push({ entity: 'curricula', index, field: 'name', code: 'required', message: 'عنوان الزامی است.', severity: 'error' });
  }),
  plainEntity('courseDefinitions', (record, errors, index) => {
    if (!isCode(record.code)) errors.push({ entity: 'courseDefinitions', index, field: 'code', code: 'invalid_code', message: 'کد درس معتبر نیست.', severity: 'error' });
    if (!isNonEmptyString(record.name)) errors.push({ entity: 'courseDefinitions', index, field: 'name', code: 'required', message: 'عنوان درس الزامی است.', severity: 'error' });
  }),
  plainEntity('courseOfferings', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'courseOfferings', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ ارائه معتبر نیست.', severity: 'error' });
    if (!isCode(record.definitionCode)) errors.push({ entity: 'courseOfferings', index, field: 'definitionCode', code: 'invalid_code', message: 'درس معتبر نیست.', severity: 'error' });
  }),
  plainEntity('courseUnits', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'courseUnits', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ واحد معتبر نیست.', severity: 'error' });
    if (!checkEnum(record.unitKind, UNIT_KINDS)) errors.push({ entity: 'courseUnits', index, field: 'unitKind', code: 'invalid_enum', message: 'نوع واحد معتبر نیست.', severity: 'error' });
    if (typeof record.hours !== 'number' || !Number.isFinite(record.hours) || (record.hours as number) < 0) {
      errors.push({ entity: 'courseUnits', index, field: 'hours', code: 'invalid_number', message: 'ساعت باید عدد نامنفی باشد.', severity: 'error' });
    }
  }),
  plainEntity('syllabusNodes', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'syllabusNodes', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ سرفصل معتبر نیست.', severity: 'error' });
    if (!isCode(record.definitionCode)) errors.push({ entity: 'syllabusNodes', index, field: 'definitionCode', code: 'invalid_code', message: 'درس معتبر نیست.', severity: 'error' });
    if (!isNonEmptyString(record.title)) errors.push({ entity: 'syllabusNodes', index, field: 'title', code: 'required', message: 'عنوان سرفصل الزامی است.', severity: 'error' });
    if (!checkEnum(record.nodeKind, NODE_KINDS)) errors.push({ entity: 'syllabusNodes', index, field: 'nodeKind', code: 'invalid_enum', message: 'نوع سرفصل معتبر نیست.', severity: 'error' });
    if (record.officiality !== undefined && !checkEnum(record.officiality, OFFICIALITY_KINDS)) {
      errors.push({ entity: 'syllabusNodes', index, field: 'officiality', code: 'invalid_enum', message: 'برچسب رسمی‌بودن معتبر نیست.', severity: 'error' });
    }
  }),
  plainEntity('learningOutcomes', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'learningOutcomes', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ خروجی معتبر نیست.', severity: 'error' });
    if (!isCode(record.definitionCode)) errors.push({ entity: 'learningOutcomes', index, field: 'definitionCode', code: 'invalid_code', message: 'درس معتبر نیست.', severity: 'error' });
    if (!isNonEmptyString(record.statement)) errors.push({ entity: 'learningOutcomes', index, field: 'statement', code: 'required', message: 'عبارت خروجی الزامی است.', severity: 'error' });
    if (record.bloomLevel !== null && record.bloomLevel !== undefined &&
      (!Number.isInteger(record.bloomLevel) || (record.bloomLevel as number) < 1 || (record.bloomLevel as number) > 6)) {
      errors.push({ entity: 'learningOutcomes', index, field: 'bloomLevel', code: 'invalid_number', message: 'سطح بلوم باید ۱ تا ۶ باشد.', severity: 'error' });
    }
  }),
  plainEntity('curriculumCourses', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'curriculumCourses', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ ردیف معتبر نیست.', severity: 'error' });
    if (!isCode(record.curriculumVersionId)) errors.push({ entity: 'curriculumCourses', index, field: 'curriculumVersionId', code: 'invalid_code', message: 'نسخهٔ برنامهٔ درسی معتبر نیست.', severity: 'error' });
    if (!isCode(record.definitionCode)) errors.push({ entity: 'curriculumCourses', index, field: 'definitionCode', code: 'invalid_code', message: 'درس معتبر نیست.', severity: 'error' });
    if (!Number.isInteger(record.term) || (record.term as number) < 1) {
      errors.push({ entity: 'curriculumCourses', index, field: 'term', code: 'invalid_number', message: 'ترم باید عدد صحیح مثبت باشد.', severity: 'error' });
    }
  }),
  plainEntity('prerequisiteEdges', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'prerequisiteEdges', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ یال معتبر نیست.', severity: 'error' });
    for (const [field, kinds] of [['sourceKind', EDGE_ENTITY_KINDS], ['targetKind', EDGE_ENTITY_KINDS]] as const) {
      if (!checkEnum(record[field], kinds)) errors.push({ entity: 'prerequisiteEdges', index, field, code: 'invalid_enum', message: `«${field}» معتبر نیست.`, severity: 'error' });
    }
    for (const field of ['sourceId', 'targetId'] as const) {
      if (!isCode(record[field])) errors.push({ entity: 'prerequisiteEdges', index, field, code: 'invalid_code', message: `«${field}» معتبر نیست.`, severity: 'error' });
    }
    if (!checkEnum(record.edgeKind, EDGE_KINDS)) errors.push({ entity: 'prerequisiteEdges', index, field: 'edgeKind', code: 'invalid_enum', message: 'نوع یال معتبر نیست.', severity: 'error' });
    if (record.sourceKind === record.targetKind && record.sourceId === record.targetId) {
      errors.push({ entity: 'prerequisiteEdges', index, field: null, code: 'self_edge', message: 'یال خودارجاع مجاز نیست.', severity: 'error' });
    }
  }),
  plainEntity('examEvents', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'examEvents', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ رویداد معتبر نیست.', severity: 'error' });
    if (!isCode(record.familyCode)) errors.push({ entity: 'examEvents', index, field: 'familyCode', code: 'invalid_code', message: 'خانوادهٔ آزمون معتبر نیست.', severity: 'error' });
    if (!isNonEmptyString(record.yearLabel)) errors.push({ entity: 'examEvents', index, field: 'yearLabel', code: 'required', message: 'برچسب سال الزامی است.', severity: 'error' });
    if (!Number.isInteger(record.session) || (record.session as number) < 1) {
      errors.push({ entity: 'examEvents', index, field: 'session', code: 'invalid_number', message: 'نوبت باید عدد صحیح مثبت باشد.', severity: 'error' });
    }
  }),
  plainEntity('examSets', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'examSets', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ مجموعه معتبر نیست.', severity: 'error' });
    if (!isCode(record.eventVersionId)) errors.push({ entity: 'examSets', index, field: 'eventVersionId', code: 'invalid_code', message: 'نسخهٔ رویداد معتبر نیست.', severity: 'error' });
  }),
  plainEntity('examCombinations', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'examCombinations', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ ترکیب معتبر نیست.', severity: 'error' });
    if (!isCode(record.eventVersionId)) errors.push({ entity: 'examCombinations', index, field: 'eventVersionId', code: 'invalid_code', message: 'نسخهٔ رویداد معتبر نیست.', severity: 'error' });
  }),
  plainEntity('examFieldSubjectAssignments', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'examFieldSubjectAssignments', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ ردیف معتبر نیست.', severity: 'error' });
    if (!isCode(record.combinationId)) errors.push({ entity: 'examFieldSubjectAssignments', index, field: 'combinationId', code: 'invalid_code', message: 'ترکیب معتبر نیست.', severity: 'error' });
    if (!isCode(record.subjectCode)) errors.push({ entity: 'examFieldSubjectAssignments', index, field: 'subjectCode', code: 'invalid_code', message: 'مادهٔ آزمون معتبر نیست.', severity: 'error' });
    for (const field of ['coefficient', 'weight'] as const) {
      if (typeof record[field] !== 'number' || !Number.isFinite(record[field]) || (record[field] as number) < 0) {
        errors.push({ entity: 'examFieldSubjectAssignments', index, field, code: 'invalid_number', message: `«${field}» باید عدد نامنفی باشد.`, severity: 'error' });
      }
    }
    if (record.negativeMarking !== undefined && !checkEnum(record.negativeMarking, NEGATIVE_MARKING_KINDS)) {
      errors.push({ entity: 'examFieldSubjectAssignments', index, field: 'negativeMarking', code: 'invalid_enum', message: 'قاعدهٔ نمرهٔ منفی معتبر نیست.', severity: 'error' });
    }
  }),
  plainEntity('admissionRules', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'admissionRules', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ قاعده معتبر نیست.', severity: 'error' });
    if (!isCode(record.eventVersionId)) errors.push({ entity: 'admissionRules', index, field: 'eventVersionId', code: 'invalid_code', message: 'نسخهٔ رویداد معتبر نیست.', severity: 'error' });
    if (!record.ruleJson || typeof record.ruleJson !== 'object' || Array.isArray(record.ruleJson)) {
      errors.push({ entity: 'admissionRules', index, field: 'ruleJson', code: 'invalid_type', message: 'بدنهٔ قاعده باید شیء باشد.', severity: 'error' });
    }
  }),
  plainEntity('assessmentComponents', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'assessmentComponents', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ جزء ارزیابی معتبر نیست.', severity: 'error' });
    if (!isCode(record.eventVersionId)) errors.push({ entity: 'assessmentComponents', index, field: 'eventVersionId', code: 'invalid_code', message: 'نسخهٔ رویداد معتبر نیست.', severity: 'error' });
    if (!checkEnum(record.kind, COMPONENT_KINDS)) errors.push({ entity: 'assessmentComponents', index, field: 'kind', code: 'invalid_enum', message: 'نوع جزء ارزیابی معتبر نیست.', severity: 'error' });
    if (typeof record.weight !== 'number' || !Number.isFinite(record.weight) || (record.weight as number) < 0) {
      errors.push({ entity: 'assessmentComponents', index, field: 'weight', code: 'invalid_number', message: 'وزن باید عدد نامنفی باشد.', severity: 'error' });
    }
  }),
  plainEntity('assessmentRubrics', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'assessmentRubrics', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ Rubric معتبر نیست.', severity: 'error' });
    if (!isCode(record.componentId)) errors.push({ entity: 'assessmentRubrics', index, field: 'componentId', code: 'invalid_code', message: 'جزء ارزیابی معتبر نیست.', severity: 'error' });
    if (!Number.isInteger(record.versionNumber) || (record.versionNumber as number) < 1) {
      errors.push({ entity: 'assessmentRubrics', index, field: 'versionNumber', code: 'invalid_number', message: 'شمارهٔ نسخهٔ Rubric معتبر نیست.', severity: 'error' });
    }
    if (!Array.isArray(record.criteria)) {
      errors.push({ entity: 'assessmentRubrics', index, field: 'criteria', code: 'invalid_type', message: 'معیارها باید فهرست باشند.', severity: 'error' });
    }
  }),
  plainEntity('examBooklets', (record, errors, index) => {
    if (!isCode(record.id)) errors.push({ entity: 'examBooklets', index, field: 'id', code: 'invalid_code', message: 'شناسهٔ دفترچه معتبر نیست.', severity: 'error' });
    if (!isCode(record.eventVersionId)) errors.push({ entity: 'examBooklets', index, field: 'eventVersionId', code: 'invalid_code', message: 'نسخهٔ رویداد معتبر نیست.', severity: 'error' });
    if (!Number.isInteger(record.form) || (record.form as number) < 1) {
      errors.push({ entity: 'examBooklets', index, field: 'form', code: 'invalid_number', message: 'شمارهٔ فرم دفترچه معتبر نیست.', severity: 'error' });
    }
  }),
];

const ALL_ENTITY_SPECS: EntitySpec[] = [...SIMPLE_ENTITIES, ...VERSIONED_ENTITIES, ...PLAIN_ENTITIES];

/**
 * اعتبارسنجی ساختاری کامل یک بستهٔ Import رجیستری.
 * ورودی نامعلوم هرگز حدس زده نمی‌شود؛ هر خطا با entity/index/field/code برمی‌گردد.
 */
export function validateRegistryBundle(input: unknown): { ok: true } | { ok: false; errors: RegistryFieldError[] } {
  const errors: RegistryFieldError[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: [{ entity: 'bundle', index: 0, field: null, code: 'invalid_type', message: 'بستهٔ Import باید یک شیء JSON باشد.', severity: 'error' }] };
  }
  const bundle = input as Record<string, unknown>;
  if (bundle.schemaVersion !== REGISTRY_IMPORT_SCHEMA_VERSION) {
    errors.push({ entity: 'bundle', index: 0, field: 'schemaVersion', code: 'unsupported_schema', message: `فقط schemaVersion=${REGISTRY_IMPORT_SCHEMA_VERSION} پشتیبانی می‌شود.`, severity: 'error' });
  }
  for (const spec of ALL_ENTITY_SPECS) {
    const list = bundle[spec.entity];
    if (list === undefined) continue; // فیلد اختیاری در Import جزئی
    if (!Array.isArray(list)) {
      errors.push({ entity: spec.entity, index: 0, field: null, code: 'invalid_type', message: `«${spec.entity}» باید فهرست باشد.`, severity: 'error' });
      continue;
    }
    list.forEach((item, index) => spec.validate(item, errors, index));
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

/** تکرار شناسه در یک موجودیت — Import باید Idempotent باشد، پس کلید تکراری خطاست. */
export function findDuplicateKeys(bundle: RegistryImportBundle): RegistryFieldError[] {
  const errors: RegistryFieldError[] = [];
  const seen = new Map<string, number>();
  const scan = (entity: string, items: Array<{ id?: string; code?: string }>) => {
    seen.clear();
    items.forEach((item, index) => {
      const key = item.id ?? item.code;
      if (key === undefined) return;
      const prior = seen.get(key);
      if (prior !== undefined) {
        errors.push({ entity, index, field: item.id !== undefined ? 'id' : 'code', code: 'duplicate_key', message: `شناسهٔ تکراری «${key}» (اولین بار در ردیف ${prior}).`, severity: 'error' });
      } else {
        seen.set(key, index);
      }
    });
  };
  scan('authorities', bundle.authorities);
  scan('systems', bundle.systems);
  scan('levels', bundle.levels);
  scan('stages', bundle.stages);
  scan('tracks', bundle.tracks);
  scan('fields', bundle.fields);
  scan('majors', bundle.majors);
  scan('subfields', bundle.subfields);
  scan('institutions', bundle.institutions);
  scan('faculties', bundle.faculties);
  scan('programs', bundle.programs);
  scan('programVersions', bundle.programVersions);
  scan('academicYears', bundle.academicYears);
  scan('curricula', bundle.curricula);
  scan('curriculumVersions', bundle.curriculumVersions);
  scan('courseDefinitions', bundle.courseDefinitions);
  scan('courseOfferings', bundle.courseOfferings);
  scan('courseUnits', bundle.courseUnits);
  scan('syllabusNodes', bundle.syllabusNodes);
  scan('learningOutcomes', bundle.learningOutcomes);
  scan('curriculumCourses', bundle.curriculumCourses);
  scan('prerequisiteEdges', bundle.prerequisiteEdges);
  scan('examFamilies', bundle.examFamilies);
  scan('examEvents', bundle.examEvents);
  scan('examEventVersions', bundle.examEventVersions);
  scan('examSubjects', bundle.examSubjects);
  scan('examSets', bundle.examSets);
  scan('examCombinations', bundle.examCombinations);
  scan('examFieldSubjectAssignments', bundle.examFieldSubjectAssignments);
  scan('admissionRules', bundle.admissionRules);
  scan('assessmentComponents', bundle.assessmentComponents);
  scan('assessmentRubrics', bundle.assessmentRubrics);
  scan('examBooklets', bundle.examBooklets);
  return errors;
}

// ---------- نگهداشت موجودیت → جدول مقصد (Migration 0019) ----------
/** فقط این موجودیت‌ها از مسیر API/Import قابل نوشتن‌اند (فهرست‌سفید دفاعی). */
export const REGISTRY_ENTITY_TABLES = {
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
} as const;
export type RegistryEntityKey = keyof typeof REGISTRY_ENTITY_TABLES;
