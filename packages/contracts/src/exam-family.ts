/**
 * V3-011 — اعتبارسنج‌های تفکیک سه مفهوم که نباید یکی گرفته شوند:
 *  - ExamFamily (از registry.ts — مالک canonical)
 *  - AdmissionRoute (اینجا؛ مسیر پذیرش مستقل از خانوادهٔ آزمون کتبی — ممکن است
 *    بدون آزمون باشد: سوابق، مصاحبه، عملی)
 *  - AssessmentProgram (اینجا؛ بستهٔ اجزای ارزیابی روی یک نسخهٔ رویداد، با
 *    AssessmentComponentهای registry)
 *
 * قواعد سند مادر:
 *  - نام دانشگاه/نوع دوره لزوماً ExamFamily نیست (بخش ۱۸٫۲ F).
 *  - پذیرش بدون آزمون AdmissionRoute است نه ExamFamily (بخش ۵٫۲).
 *  - readiness از سطوح E0..E9 بخش ۲۹؛ E7 به بالا فقط انسانی (HUMAN_ONLY_READINESS).
 */
import {
  type AdmissionRule,
  type AssessmentComponent,
  type ExamFamily,
  HUMAN_ONLY_READINESS,
  EXAM_FAMILY_READINESS,
  type ExamFamilyReadiness,
} from './registry';

export { EXAM_FAMILY_READINESS, HUMAN_ONLY_READINESS };
export type { ExamFamilyReadiness };

export const ADMISSION_MODES = [
  'written',
  'records',
  'interview',
  'practical',
  'non_written',
  'mixed',
] as const;

export type AdmissionMode = (typeof ADMISSION_MODES)[number];

export interface AdmissionRoute {
  routeCode: string;
  /** null یعنی مسیر مستقل از یک خانوادهٔ آزمون کتبی (مثلاً سوابق تحصیلی). */
  familyCode: string | null;
  nameFa: string;
  assessmentMode: AdmissionMode;
  status: 'official_verified' | 'reported' | 'needs_check' | 'draft';
  sourceIds: string[];
  notes: string | null;
}

export interface AssessmentProgram {
  programCode: string;
  /** به یک نسخهٔ رویداد مشخص بسته است — نسخهٔ جدید برنامهٔ جدید می‌سازد. */
  eventVersionId: string;
  components: AssessmentComponent[];
  status: 'official_verified' | 'reported' | 'needs_check' | 'draft';
}

export interface ExamFamilyValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ExamFamilyValidation {
  ok: boolean;
  errors: ExamFamilyValidationIssue[];
}

function add(list: ExamFamilyValidationIssue[], path: string, code: string, message: string): void {
  list.push({ path, code, message });
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const EXAM_FAMILY_STATUSES: readonly string[] = ['official_verified', 'reported', 'needs_check', 'draft'];
// lifecycleRegistry ExamFamily از RegistryLifecycleStatus استفاده می‌کند؛ اعتبارسنج
// تفصیلی فقط وضعیت‌های نسخه‌دار آزمونی را می‌پذیرد، پس وضعیت lifecycle را جداگانه چک می‌کنیم.
const LIFECYCLE_STATUSES: readonly string[] = ['active', 'archived', 'retired'];

export function validateExamFamily(family: ExamFamily): ExamFamilyValidation {
  const errors: ExamFamilyValidationIssue[] = [];
  const p = 'family';
  if (!nonEmpty(family.code) || !/^[a-z0-9][a-z0-9-]*$/.test(family.code)) {
    add(errors, p + '.code', 'invalid_family_code', 'کد خانواده باید نیم‌انگلیسی پایدار باشد.');
  }
  if (!nonEmpty(family.name)) add(errors, p + '.name', 'missing_name', 'عنوان خانواده الزامی است.');
  if (!EXAM_FAMILY_STATUSES.includes(family.status) && !LIFECYCLE_STATUSES.includes(family.status)) {
    add(errors, p + '.status', 'invalid_status', 'وضعیت خانواده نامعتبر است.');
  }
  if (family.countryCode !== undefined && !/^[A-Z]{2}$/.test(family.countryCode)) {
    add(errors, p + '.countryCode', 'invalid_country', 'کد کشور باید ISO دو حرفی باشد.');
  }
  if (family.readiness !== undefined) {
    if (!EXAM_FAMILY_READINESS.includes(family.readiness)) {
      add(errors, p + '.readiness', 'invalid_readiness', 'سطح readiness نامعتبر است.');
    }
    if (HUMAN_ONLY_READINESS.includes(family.readiness)) {
      add(errors, p + '.readiness', 'human_only_readiness', 'سطح E7 به بالا فقط با امضای انسانی اعطا می‌شود؛ ایجنت حق ثبت آن ندارد.');
    }
    if (family.readiness !== 'out_of_scope' && family.readiness !== 'discovered' &&
        (!Array.isArray(family.sourceIds) || family.sourceIds.length === 0)) {
      add(errors, p + '.sourceIds', 'missing_source_reference', 'خانوادهٔ فراتر از کشف باید منبع ثبت‌شده داشته باشد.');
    }
  }
  if (family.latestKnownYear !== undefined && family.latestKnownYear !== null &&
      (!Number.isInteger(family.latestKnownYear) || family.latestKnownYear < 1300)) {
    add(errors, p + '.latestKnownYear', 'invalid_year', 'سال قابل اثبات باید عدد شمسی معتبر باشد.');
  }
  return { ok: errors.length === 0, errors };
}

export function validateAdmissionRoute(route: AdmissionRoute): ExamFamilyValidation {
  const errors: ExamFamilyValidationIssue[] = [];
  const p = 'route';
  if (!nonEmpty(route.routeCode) || !/^[a-z0-9][a-z0-9-]*$/.test(route.routeCode)) {
    add(errors, p + '.routeCode', 'invalid_route_code', 'کد مسیر پذیرش باید نیم‌انگلیسی پایدار باشد.');
  }
  if (!ADMISSION_MODES.includes(route.assessmentMode)) add(errors, p + '.assessmentMode', 'invalid_mode', 'حالت ارزیابی مسیر نامعتبر است.');
  if (!nonEmpty(route.nameFa)) add(errors, p + '.nameFa', 'missing_name', 'عنوان فارسی مسیر الزامی است.');
  if (route.familyCode !== null && !nonEmpty(route.familyCode)) {
    add(errors, p + '.familyCode', 'invalid_family_ref', 'ارجاع خانواده باید کد معتبر یا null باشد.');
  }
  if (!Array.isArray(route.sourceIds) || route.sourceIds.length === 0) {
    add(errors, p + '.sourceIds', 'missing_source_reference', 'مسیر پذیرش بدون منبع ثبت نمی‌شود.');
  }
  if (!['official_verified', 'reported', 'needs_check', 'draft'].includes(route.status)) {
    add(errors, p + '.status', 'invalid_status', 'وضعیت مسیر نامعتبر است.');
  }
  return { ok: errors.length === 0, errors };
}

export function validateAssessmentProgram(program: AssessmentProgram): ExamFamilyValidation {
  const errors: ExamFamilyValidationIssue[] = [];
  const p = 'program';
  if (!nonEmpty(program.programCode)) add(errors, p + '.programCode', 'missing_code', 'کد برنامهٔ ارزیابی الزامی است.');
  if (!nonEmpty(program.eventVersionId)) add(errors, p + '.eventVersionId', 'missing_version', 'برنامهٔ ارزیابی باید به نسخهٔ رویداد بسته باشد.');
  if (!Array.isArray(program.components) || program.components.length === 0) {
    add(errors, p + '.components', 'empty_components', 'برنامهٔ ارزیابی بدون جزء معنی ندارد.');
    return { ok: false, errors };
  }
  const ids = new Set<string>();
  program.components.forEach((c, i) => {
    if (!nonEmpty(c.id)) add(errors, `${p}.components[${i}].id`, 'missing_component_id', 'شناسهٔ جزء الزامی است.');
    if (ids.has(c.id)) add(errors, `${p}.components[${i}]`, 'duplicate_component_id', 'شناسهٔ جزء تکراری است.');
    ids.add(c.id);
    if (c.eventVersionId !== program.eventVersionId) {
      add(errors, `${p}.components[${i}]`, 'component_version_mismatch', 'جزء به نسخهٔ دیگری از رویداد تعلق دارد.');
    }
    if (c.weightState === 'unknown' && c.weight !== null) {
      add(errors, `${p}.components[${i}]`, 'unknown_has_value', 'وزن نامعلوم باید null باشد.');
    }
    if ((c.weightState === undefined || c.weightState === 'official_positive') && c.weight !== null &&
        (typeof c.weight !== 'number' || c.weight <= 0)) {
      add(errors, `${p}.components[${i}]`, 'positive_state_mismatch', 'وزن مثبت رسمی باید عددی بزرگ‌تر از صفر باشد.');
    }
    if (c.gateAfterComponentId !== null && c.gateAfterComponentId !== undefined &&
        !program.components.some((x) => x.id === c.gateAfterComponentId)) {
      add(errors, `${p}.components[${i}].gateAfterComponentId`, 'unknown_gate', 'شرط ورود به جزء به جزء ناموجود ارجاع می‌دهد.');
    }
  });
  if (!['official_verified', 'reported', 'needs_check', 'draft'].includes(program.status)) {
    add(errors, p + '.status', 'invalid_status', 'وضعیت برنامهٔ ارزیابی نامعتبر است.');
  }
  return { ok: errors.length === 0, errors };
}
