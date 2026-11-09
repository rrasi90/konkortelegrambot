/**
 * AEL — Versioned exam model.
 *
 * This is the normalized, application-facing projection for official exam
 * structures and candidate intent. Existing Education Registry identity
 * remains canonical; legacy exam-structure.ts exports stay compatible.
 *
 * Identifier namespaces are intentionally separate:
 * exam set code != doctorate combination code != master coefficient code
 * != target display code != booklet code != AEL study-track id.
 */
import type { ExamLevel } from './exam-structure';

/**
 * V3-022 (MX-022) — سطح پذیرش مدل آزمون، جدا از ExamLevel legacy.
 * ExamLevel (doctorate/master) هویت ساختار legacy باقی می‌ماند و مسیر
 * شبیه‌ساز/ساختار فقط همان دو سطح را می‌شناسند؛ سطح‌های پذیرش دیگر
 * (بخش ۱۸٫۵ سند مادر) فقط روی مدل دادهٔ نسخه‌دار باز می‌شوند تا افزودن
 * خانوادهٔ جدید، بدون branch در هستهٔ ساختار، فقط با داده ممکن باشد.
 */
export const EXAM_MODEL_LEVELS = [
  'doctorate',
  'master',
  'professional_doctorate',
  'specialty',
  'subspecialty',
  'bachelor',
  'associate',
  'unknown',
] as const;

export type ExamModelLevel = (typeof EXAM_MODEL_LEVELS)[number];

export function isExamModelLevel(value: unknown): value is ExamModelLevel {
  return typeof value === 'string' && (EXAM_MODEL_LEVELS as readonly string[]).includes(value);
}

export const EXAM_MODEL_SCHEMA_VERSION = 1 as const;
export type ExamModelStatus = 'official_verified' | 'reported' | 'needs_check' | 'draft';
export type CandidateSelectionRole = 'primary' | 'floating' | 'additional';
/**
 * V3-Hardening B4 — دو محور مستقل برای ضریب:
 *  - محور مقدار (CoefficientValueAxis): معنای عددی — هرگز دربارهٔ منبع قضاوت نمی‌کند.
 *  - محور شواهد (CoefficientEvidence): اعتبار منبع — هرگز معنای عددی نمی‌دهد.
 * وضعیت‌های قدیمی official_positive/official_zero/... aliasهای یک‌طرفهٔ legacyاند
 * و فقط از طریق normalizeCoefficientValueState خوانده می‌شوند؛ هرگز به‌عنوان
 * شاهد رسمی تفسیر نمی‌شوند (مقدار reported از منبع ثانویه = positive+reported).
 */
export const COEFFICIENT_VALUE_AXES = ['positive', 'zero', 'unknown', 'not_applicable'] as const;
export type CoefficientValueAxis = (typeof COEFFICIENT_VALUE_AXES)[number];

export const COEFFICIENT_EVIDENCE_STATES = [
  'official_verified',
  'reported',
  'inferred',
  'pending_verification',
] as const;
export type CoefficientEvidence = (typeof COEFFICIENT_EVIDENCE_STATES)[number];

/** وضعیت‌های قدیمی — فقط برای سازگاری داده و ردیابی صریح مهاجرت. */
export type LegacyCoefficientState = 'official_positive' | 'official_zero' | 'unknown' | 'not_applicable';
/** سازگاری نوع: نام قدیمی و محور جدید هر دو پذیرفته می‌شوند؛ جداسازی در normalize. */
export type CoefficientValueState = LegacyCoefficientState | CoefficientValueAxis;

const LEGACY_VALUE_AXIS_MAP: Record<LegacyCoefficientState, CoefficientValueAxis> = {
  official_positive: 'positive',
  official_zero: 'zero',
  unknown: 'unknown',
  not_applicable: 'not_applicable',
};

export function isLegacyCoefficientState(value: unknown): value is LegacyCoefficientState {
  return typeof value === 'string' && value in LEGACY_VALUE_AXIS_MAP;
}

export function isCoefficientValueAxis(value: unknown): value is CoefficientValueAxis {
  return typeof value === 'string' && (COEFFICIENT_VALUE_AXES as readonly string[]).includes(value);
}

/** تبدیل صریح و یک‌طرفه: axis جدید یا alias قدیمی → محور مقدار. تبدیل پنهان ممنوع. */
export function normalizeCoefficientValueState(raw: unknown): CoefficientValueAxis | null {
  if (isCoefficientValueAxis(raw)) return raw;
  if (isLegacyCoefficientState(raw)) return LEGACY_VALUE_AXIS_MAP[raw];
  return null;
}

/**
 * نگاشت وضعیت بردار قدیمی (ExamModelStatus) به محور شواهد؛ تبدیل قابل ردیابی:
 * needs_check و draft هرگز به official_verified ارتقا نمی‌یابند.
 */
export function mapAssignmentVerificationToEvidence(verification: unknown): CoefficientEvidence {
  switch (verification) {
    case 'official_verified': return 'official_verified';
    case 'reported': return 'reported';
    case 'needs_check':
    case 'draft':
    default: return 'pending_verification';
  }
}

export function isCoefficientEvidence(value: unknown): value is CoefficientEvidence {
  return typeof value === 'string' && (COEFFICIENT_EVIDENCE_STATES as readonly string[]).includes(value);
}
export type CoefficientScope = 'exam_subject' | 'exam_component';
export type ExamTargetAdmissionStatus =
  | 'not_guaranteed_by_exam_table'
  | 'restricted'
  | 'offering_confirmed'
  | 'unknown';

export interface ExamModelSource {
  id: string;
  title: string;
  url: string | null;
  publisher: string;
  sourceType: 'official_handbook' | 'official_notice' | 'official_attachment' | 'secondary_report' | 'internal_audit';
  publishedAt: string | null;
  checkedAt: string;
  locator: string;
  status: ExamModelStatus;
}

export interface ExamModelEvent {
  id: string;
  examLevel: ExamModelLevel;
  examFamilyCode: string;
  yearNumber: number;
  yearLabel: string;
  session: number;
  organizer: string;
  title: string;
  status: ExamModelStatus;
  sourceIds: string[];
}

export interface ExamModelEventVersion {
  id: string;
  eventId: string;
  versionNumber: number;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  status: ExamModelStatus;
  sourceIds: string[];
  changeReason: string | null;
  contentHash: string | null;
}

export interface ExamModelSet {
  id: string;
  eventVersionId: string;
  examSetCode: string;
  title: string;
  status: ExamModelStatus;
  sourceIds: string[];
}

export type ExamSubjectComponentKind =
  | 'language'
  | 'shared_core'
  | 'specialized'
  | 'other';

export interface ExamModelSubject {
  id: string;
  subjectCode: string;
  title: string;
  subjectLevel: 'general' | 'bachelor' | 'master' | 'doctoral' | 'mixed' | 'unknown';
  componentKind: ExamSubjectComponentKind;
  position: number;
  /** The numbered subject may contain multiple course-level content areas. */
  description: string | null;
  status: ExamModelStatus;
}

export interface ExamSetSubject {
  id: string;
  eventVersionId: string;
  examSetId: string;
  subjectId: string;
  subjectNumber: number;
  /** Preserve the original handbook's course/subject numbering. */
  sourceLabel: string | null;
}

export interface ExamModelCombination {
  id: string;
  eventVersionId: string;
  examSetId: string;
  combinationCode: string;
  title: string;
  status: ExamModelStatus;
  sourceIds: string[];
}

export interface ExamCombinationSubject {
  combinationId: string;
  subjectId: string;
  required: boolean;
  position: number;
}

export interface ExamModelTarget {
  id: string;
  eventVersionId: string;
  examSetId: string;
  /** Exact registration-table row title; do not silently normalize it. */
  officialTargetLabel: string;
  fieldLabel: string | null;
  majorLabel: string | null;
  subfieldLabel: string | null;
  /** Parenthesized or printed row code, only when the source labels it as such. */
  officialTargetCode: string | null;
  combinationCode: string | null;
  coefficientCode: string | null;
  coefficientAssignmentId: string | null;
  admissionStatus: ExamTargetAdmissionStatus;
  admissionRestriction: string | null;
  verification: ExamModelStatus;
  sourceIds: string[];
}

export interface ExamCoefficientValue {
  subjectId: string;
  value: number | null;
  /** legacy: وضعیت قدیمی با محور و شواهد درهم — فقط با normalize خوانده می‌شود. */
  state?: CoefficientValueState;
  /** محور مقدار صریح (استایل جدید) — مقدم بر state. */
  valueState?: CoefficientValueAxis;
  /** محور شواهد صریح؛ غایب = نگاشت از verification بردار. */
  evidence?: CoefficientEvidence;
}

export interface ExamCoefficientAssignment {
  id: string;
  eventVersionId: string;
  examSetId: string;
  targetId: string;
  /** Printed "کد ضریب" only; never the set code or target code. */
  coefficientCode: string | null;
  scope: 'exam_subject';
  values: ExamCoefficientValue[];
  verification: ExamModelStatus;
  sourceIds: string[];
  note: string | null;
}

export interface ExamComponentCoefficient {
  id: string;
  eventVersionId: string;
  examSetId: string;
  componentCode: string;
  componentTitle: string;
  subjectIds: string[];
  value: number | null;
  state: CoefficientValueState;
  scope: 'exam_component';
  verification: ExamModelStatus;
  sourceIds: string[];
  note: string | null;
}

export interface ExamSubjectCourseMapping {
  id: string;
  eventVersionId: string;
  subjectId: string;
  courseRefKind: 'course_definition' | 'legacy_content_course' | 'unresolved';
  courseRefId: string | null;
  courseTitle: string;
  mappingStatus: 'exact' | 'candidate' | 'needs_mapping';
  note: string | null;
}

/**
 * V3-Hardening B3 — سه حالت مجزا برای سقف انتخاب مجموعه:
 *  - 'limited': سقف مشخص و مستند (maxExamSetSelections عدد الزامی)
 *  - 'unlimited': بی‌سقف بودنِ مستندشده (maxExamSetSelections باید null باشد)
 *  - 'unknown': سقف نامعلوم (maxExamSetSelections باید null باشد) — نامعلوم
 *    هرگز معنای «بی‌سقف» یا «صفر» نمی‌گیرد.
 * غایب = رفتار legacy برای رکوردهای قدیمی (عدد یا null بدون ادعای حالت).
 */
export const SELECTION_LIMIT_STATES = ['limited', 'unlimited', 'unknown'] as const;
export type SelectionLimitState = (typeof SELECTION_LIMIT_STATES)[number];

export interface ExamSelectionPolicy {
  id: string;
  eventVersionId: string;
  examLevel: ExamModelLevel;
  maxExamSetSelections: number | null;
  selectionLimitState?: SelectionLimitState;
  allowedRoles: CandidateSelectionRole[];
  allowSameSetMultipleTimes: boolean;
  status: ExamModelStatus;
  sourceIds: string[];
  note: string | null;
}

export interface CandidateExamRegistrationSelection {
  examSetId: string;
  role: CandidateSelectionRole;
  registrationReference: string | null;
}

export interface CandidateExamRegistration {
  id: string;
  candidateId: string;
  eventVersionId: string;
  selections: CandidateExamRegistrationSelection[];
  status: 'draft' | 'submitted' | 'confirmed' | 'cancelled' | 'unknown';
  sourceRegistrationReference: string | null;
  createdAt: string;
}

export interface CandidatePreparationTarget {
  targetId: string;
  priorityOrder: number;
  registrationSelectionId: string | null;
  note: string | null;
}

export interface CandidateStudyPlan {
  id: string;
  candidateId: string;
  eventVersionId: string;
  /** Optional link to an official registration; study intentions can exist before registration. */
  registrationId: string | null;
  /** Multiple target fields/majors may be studied concurrently. */
  targets: CandidatePreparationTarget[];
  /** Product-level tracks are not official exam registrations or combination codes. */
  studyTrackIds: string[];
  status: 'draft' | 'active' | 'paused' | 'archived';
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedTargetSubject {
  targetId: string;
  subjectId: string;
  inclusion: 'included_by_combination' | 'positive_coefficient' | 'unknown_coefficient';
  directCoefficient: ExamCoefficientValue | null;
  componentCoefficients: ExamComponentCoefficient[];
}

export interface ResolvedPreparationSubject {
  subjectId: string;
  subjectNumber: number;
  title: string;
  includedInTargetIds: string[];
  coefficientsByTarget: Array<{
    targetId: string;
    value: number | null;
    /** محور مقدار — معنای عددی، مستقل از منبع (B4). */
    valueState: CoefficientValueAxis;
    /** محور شواهد — اعتبار منبع، مستقل از معنای عددی (B4). */
    evidence: CoefficientEvidence;
    scope: 'exam_subject' | null;
  }>;
}

export interface ResolvedPreparationComponent {
  targetId: string;
  componentId: string;
  componentCode: string;
  componentTitle: string;
  value: number | null;
  /** محور مقدار، نرمال‌شده از state قدیمی جزء (B4). */
  valueState: CoefficientValueAxis;
  /** محور شواهد جزء — نگاشت صریح از verification. */
  evidence: CoefficientEvidence;
  subjectIds: string[];
}

export interface CandidatePreparationResolution {
  planId: string;
  eventVersionId: string;
  examSetIds: string[];
  targets: Array<{ targetId: string; officialTargetLabel: string; combinationCode: string | null; coefficientCode: string | null }>;
  subjects: ResolvedPreparationSubject[];
  targetSubjectDetails: ResolvedTargetSubject[];
  /** Component-scoped coefficients are reported once per target/component, never copied into each subject. */
  componentCoefficients: ResolvedPreparationComponent[];
  studyTrackIds: string[];
  warnings: string[];
  resolutionStatus: 'resolved' | 'partial' | 'blocked';
}

export interface ExamModelBundle {
  schemaVersion: typeof EXAM_MODEL_SCHEMA_VERSION;
  sources: ExamModelSource[];
  events: ExamModelEvent[];
  eventVersions: ExamModelEventVersion[];
  examSets: ExamModelSet[];
  subjects: ExamModelSubject[];
  setSubjects: ExamSetSubject[];
  combinations: ExamModelCombination[];
  combinationSubjects: ExamCombinationSubject[];
  targets: ExamModelTarget[];
  coefficientAssignments: ExamCoefficientAssignment[];
  componentCoefficients: ExamComponentCoefficient[];
  subjectCourseMappings: ExamSubjectCourseMapping[];
  selectionPolicies: ExamSelectionPolicy[];
}

export interface ExamModelIssue {
  path: string;
  code: string;
  message: string;
}
export interface ExamModelValidation {
  ok: boolean;
  errors: ExamModelIssue[];
  warnings: ExamModelIssue[];
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const add = (list: ExamModelIssue[], path: string, code: string, message: string) => list.push({path,code,message});
const duplicate = (list: string[]) => new Set(list).size !== list.length;
const key = (...parts: string[]) => parts.join('|');

function setSubjectRowsForVersionSubject(eventVersionId:string,subjectId:string,rows:ExamSetSubject[]):boolean {
  return rows.some(row=>row.eventVersionId===eventVersionId&&row.subjectId===subjectId);
}

export function validateExamModelBundle(input: unknown): ExamModelValidation {
  const errors: ExamModelIssue[] = [];
  const warnings: ExamModelIssue[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {ok:false,errors:[{path:'bundle',code:'invalid_object',message:'بسته مدل آزمون باید یک شیء باشد.'}],warnings};
  }
  const b = input as Record<string, unknown>;
  if (b.schemaVersion !== EXAM_MODEL_SCHEMA_VERSION) add(errors,'schemaVersion','unsupported_schema','نسخه مدل آزمون پشتیبانی نمی‌شود.');
  const arrayNames = [
    'sources','events','eventVersions','examSets','subjects','setSubjects','combinations',
    'combinationSubjects','targets','coefficientAssignments','componentCoefficients',
    'subjectCourseMappings','selectionPolicies',
  ] as const;
  for (const name of arrayNames) if (!Array.isArray(b[name])) add(errors,name,'invalid_array','این بخش باید آرایه باشد.');
  if (errors.length) return {ok:false,errors,warnings};

  const sources = b.sources as ExamModelSource[];
  const events = b.events as ExamModelEvent[];
  const versions = b.eventVersions as ExamModelEventVersion[];
  const sets = b.examSets as ExamModelSet[];
  const subjects = b.subjects as ExamModelSubject[];
  const setSubjects = b.setSubjects as ExamSetSubject[];
  const combinations = b.combinations as ExamModelCombination[];
  const combinationSubjects = b.combinationSubjects as ExamCombinationSubject[];
  const targets = b.targets as ExamModelTarget[];
  const coefficientAssignments = b.coefficientAssignments as ExamCoefficientAssignment[];
  const componentCoefficients = b.componentCoefficients as ExamComponentCoefficient[];
  const courseMappings = b.subjectCourseMappings as ExamSubjectCourseMapping[];
  const policies = b.selectionPolicies as ExamSelectionPolicy[];

  const uniqueBy = <T>(rows: T[], get: (row:T)=>string, path:string) => {
    const seen = new Set<string>();
    rows.forEach((row,index) => {
      const value = get(row);
      if (!nonEmpty(value) || seen.has(value)) add(errors,path+'['+index+']','duplicate_or_missing_id','شناسه خالی یا تکراری است: '+String(value));
      seen.add(value);
    });
  };
  uniqueBy(sources,x=>x.id,'sources');
  uniqueBy(events,x=>x.id,'events');
  uniqueBy(versions,x=>x.id,'eventVersions');
  uniqueBy(sets,x=>x.id,'examSets');
  uniqueBy(subjects,x=>x.id,'subjects');
  uniqueBy(setSubjects,x=>x.id,'setSubjects');
  uniqueBy(combinations,x=>x.id,'combinations');
  uniqueBy(targets,x=>x.id,'targets');
  uniqueBy(coefficientAssignments,x=>x.id,'coefficientAssignments');
  uniqueBy(componentCoefficients,x=>x.id,'componentCoefficients');
  uniqueBy(courseMappings,x=>x.id,'subjectCourseMappings');
  uniqueBy(policies,x=>x.id,'selectionPolicies');

  const sourceIds = new Set(sources.map(x=>x.id));
  const eventMap = new Map(events.map(x=>[x.id,x]));
  const versionMap = new Map(versions.map(x=>[x.id,x]));
  const setMap = new Map(sets.map(x=>[x.id,x]));
  const subjectMap = new Map(subjects.map(x=>[x.id,x]));
  const combinationMap = new Map(combinations.map(x=>[x.id,x]));
  const targetMap = new Map(targets.map(x=>[x.id,x]));
  const comboByCode = new Map<string,ExamModelCombination>();
  const validStatuses: ExamModelStatus[] = ['official_verified','reported','needs_check','draft'];

  // V3-011 (provenance الزامی): هر موجودیت نسخه‌دار باید دست‌کم یک منبع ثبت‌شده
  // داشته باشد؛ ارتباط Source → Event → EventVersion بدون شاهد مجاز نیست.
  const provenanceEntities: Array<[unknown[], string]> = [
    [events,'events'],[versions,'eventVersions'],[sets,'examSets'],
    [targets,'targets'],[coefficientAssignments,'coefficientAssignments'],
    [componentCoefficients,'componentCoefficients'],
  ];
  for (const [rows,name] of provenanceEntities) {
    rows.forEach((row,idx)=>{
      const r=row as {sourceIds?:unknown};
      if(!Array.isArray(r.sourceIds)||r.sourceIds.length===0)
        add(errors,name+'['+idx+'].sourceIds','missing_source_reference','هر موجودیت نسخه‌دار باید دست‌کم یک منبع ثبت‌شده داشته باشد.');
    });
  }

  sources.forEach((s,i)=>{
    const p='sources['+i+']';
    if(!nonEmpty(s.title)||!nonEmpty(s.publisher)||!nonEmpty(s.locator))add(errors,p,'missing_source_metadata','عنوان، ناشر و محل استناد الزامی است.');
    if(s.url!==null&&!/^https:\/\//.test(s.url))add(errors,p+'.url','invalid_source_url','نشانی منبع باید HTTPS یا null باشد.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt))add(errors,p+'.checkedAt','invalid_date','تاریخ بررسی منبع معتبر نیست.');
    if(!validStatuses.includes(s.status))add(errors,p+'.status','invalid_status','وضعیت منبع نامعتبر است.');
  });

  events.forEach((e,i)=>{
    const p='events['+i+']';
    if(!isExamModelLevel(e.examLevel))add(errors,p+'.examLevel','invalid_level','مقطع آزمون نامعتبر است.');
    if(!Number.isInteger(e.yearNumber)||e.yearNumber<1300||!Number.isInteger(e.session)||e.session<1)add(errors,p,'invalid_event_period','سال یا نوبت آزمون نامعتبر است.');
    if(!nonEmpty(e.examFamilyCode)||!nonEmpty(e.organizer)||!nonEmpty(e.title)||!nonEmpty(e.yearLabel))add(errors,p,'missing_event_metadata','شناسه مجموعه آزمون، مجری و عنوان الزامی است.');
    if(!validStatuses.includes(e.status))add(errors,p+'.status','invalid_status','وضعیت رویداد آزمون نامعتبر است.');
    for(const sid of e.sourceIds??[])if(!sourceIds.has(sid))add(errors,p+'.sourceIds','unknown_source','منبع رویداد یافت نشد: '+sid);
  });

  versions.forEach((v,i)=>{
    const p='eventVersions['+i+']';
    if(!eventMap.has(v.eventId))add(errors,p+'.eventId','unknown_event','رویداد آزمون پیدا نشد.');
    if(!Number.isInteger(v.versionNumber)||v.versionNumber<1)add(errors,p+'.versionNumber','invalid_version','شماره نسخه باید صحیح و مثبت باشد.');
    if(!validStatuses.includes(v.status))add(errors,p+'.status','invalid_status','وضعیت نسخه نامعتبر است.');
    for(const sid of v.sourceIds??[])if(!sourceIds.has(sid))add(errors,p+'.sourceIds','unknown_source','منبع نسخه یافت نشد: '+sid);
  });

  sets.forEach((s,i)=>{
    const p='examSets['+i+']';
    if(!versionMap.has(s.eventVersionId))add(errors,p+'.eventVersionId','unknown_version','نسخه آزمون پیدا نشد.');
    // V3-Hardening B2: examSetCode = کد «منتشرشدهٔ رسمی» دقیقاً به شکل منبع؛
    // شناسه داخلی پایدار فیلد جداگانهٔ id است. صفر ابتدایی (padding) ممنوع —
    // '001' برای '1' جعل شکل کد رسمی برای عبور از اعتبارسنجی است، نه نگهداری آن.
    if(!/^[1-9][0-9]{0,5}$/.test(s.examSetCode))add(errors,p+'.examSetCode','invalid_exam_set_code','کد مجموعه امتحانی باید عدد منتشرشدهٔ رسمی بدون صفر ابتدایی باشد (۱ تا ۶ رقم).');
    if(!nonEmpty(s.title)||!validStatuses.includes(s.status))add(errors,p,'invalid_set','عنوان یا وضعیت مجموعه معتبر نیست.');
    for(const sid of s.sourceIds??[])if(!sourceIds.has(sid))add(errors,p+'.sourceIds','unknown_source','منبع مجموعه یافت نشد: '+sid);
  });

  subjects.forEach((s,i)=>{
    const p='subjects['+i+']';
    if(!nonEmpty(s.subjectCode)||!nonEmpty(s.title))add(errors,p,'missing_subject','کد و عنوان ماده امتحانی الزامی است.');
    if(!Number.isInteger(s.position)||s.position<1)add(errors,p+'.position','invalid_position','ترتیب ماده باید عدد صحیح مثبت باشد.');
    if(!['general','bachelor','master','doctoral','mixed','unknown'].includes(s.subjectLevel))add(errors,p+'.subjectLevel','invalid_subject_level','سطح ماده نامعتبر است.');
    if(!['language','shared_core','specialized','other'].includes(s.componentKind))add(errors,p+'.componentKind','invalid_component','نوع جزء آزمون نامعتبر است.');
  });

  setSubjects.forEach((r,i)=>{
    const p='setSubjects['+i+']';
    if(!versionMap.has(r.eventVersionId)||!setMap.has(r.examSetId)||!subjectMap.has(r.subjectId))add(errors,p,'unknown_reference','نسخه، مجموعه یا ماده امتحانی پیدا نشد.');
    else if(setMap.get(r.examSetId)!.eventVersionId!==r.eventVersionId)add(errors,p,'set_version_mismatch','نسخه ماده و مجموعه با هم سازگار نیستند.');
    if(!Number.isInteger(r.subjectNumber)||r.subjectNumber<1)add(errors,p+'.subjectNumber','invalid_subject_number','شماره ماده باید عدد صحیح مثبت باشد.');
  });

  combinations.forEach((c,i)=>{
    const p='combinations['+i+']';
    if(!versionMap.has(c.eventVersionId)||!setMap.has(c.examSetId))add(errors,p,'unknown_reference','نسخه یا مجموعه ترکیب پیدا نشد.');
    else if(setMap.get(c.examSetId)!.eventVersionId!==c.eventVersionId)add(errors,p,'combination_set_version_mismatch','ترکیب به نسخه دیگری تعلق دارد.');
    if(!/^[0-9]{1,4}$/.test(c.combinationCode))add(errors,p+'.combinationCode','invalid_combination_code','کد ترکیب باید عددی و مستقل از کد مجموعه باشد.');
    const codeKey=key(c.eventVersionId,c.examSetId,c.combinationCode);
    if(comboByCode.has(codeKey))add(errors,p+'.combinationCode','duplicate_combination_code','کد ترکیب در یک مجموعه/نسخه تکراری است.');
    comboByCode.set(codeKey,c);
    if(!validStatuses.includes(c.status))add(errors,p+'.status','invalid_status','وضعیت ترکیب نامعتبر است.');
  });

  const setSubjectKeys = new Set(setSubjects.map(r=>key(r.examSetId,r.subjectId)));
  const uniqueSetCodes = new Set<string>();
  sets.forEach((s,i)=>{
    const k=key(s.eventVersionId,s.examSetCode);
    if(uniqueSetCodes.has(k))add(errors,'examSets['+i+'].examSetCode','duplicate_exam_set_code','کد مجموعه در یک نسخه آزمون تکراری است.');
    uniqueSetCodes.add(k);
    if(!setSubjects.some(r=>r.examSetId===s.id))warnings.push({path:'examSets['+i+']',code:'set_subjects_missing',message:'ساختار مواد این مجموعه هنوز در داده ثبت نشده است؛ در صورت reported/needs_check بودن، آن را قطعی فرض نکنید.'});
  });

  const comboEdges = new Set<string>();
  combinationSubjects.forEach((r,i)=>{
    const p='combinationSubjects['+i+']';
    const combo=combinationMap.get(r.combinationId);
    if(!combo||!subjectMap.has(r.subjectId))add(errors,p,'unknown_reference','ترکیب یا ماده پیدا نشد.');
    else if(!setSubjectKeys.has(key(combo.examSetId,r.subjectId)))add(errors,p,'subject_not_in_combination_set','ماده در مجموعه والد این ترکیب وجود ندارد.');
    if(!Number.isInteger(r.position)||r.position<1)add(errors,p+'.position','invalid_position','ترتیب ماده در ترکیب نامعتبر است.');
    const edge=key(r.combinationId,r.subjectId);
    if(comboEdges.has(edge))add(errors,p,'duplicate_combination_subject','ماده دوبار در یک ترکیب آمده است.');
    comboEdges.add(edge);
  });

  targets.forEach((t,i)=>{
    const p='targets['+i+']';
    if(!versionMap.has(t.eventVersionId)||!setMap.has(t.examSetId))add(errors,p,'unknown_reference','نسخه یا مجموعه هدف پیدا نشد.');
    else if(setMap.get(t.examSetId)!.eventVersionId!==t.eventVersionId)add(errors,p,'target_set_version_mismatch','هدف به نسخه یا مجموعه دیگری تعلق دارد.');
    if(!nonEmpty(t.officialTargetLabel))add(errors,p+'.officialTargetLabel','missing_label','عنوان رسمی سطر جدول الزامی است.');
    if(t.combinationCode!==null&&!comboByCode.has(key(t.eventVersionId,t.examSetId,t.combinationCode)))add(errors,p+'.combinationCode','unknown_combination','کد ترکیب این هدف در همین نسخه وجود ندارد.');
    if(t.admissionStatus==='restricted'&&!nonEmpty(t.admissionRestriction))add(errors,p+'.admissionRestriction','missing_admission_restriction','هدف محدودشده باید شرح محدودیت داشته باشد.');
    if(!validStatuses.includes(t.verification))add(errors,p+'.verification','invalid_status','وضعیت راستی‌آزمایی هدف نامعتبر است.');
    for(const sid of t.sourceIds??[])if(!sourceIds.has(sid))add(errors,p+'.sourceIds','unknown_source','منبع هدف پیدا نشد: '+sid);
  });

  coefficientAssignments.forEach((a,i)=>{
    const p='coefficientAssignments['+i+']';
    if(!versionMap.has(a.eventVersionId)||!setMap.has(a.examSetId)||!targetMap.has(a.targetId))add(errors,p,'unknown_reference','نسخه، مجموعه یا هدف ضریب پیدا نشد.');
    if(a.targetId&&targetMap.has(a.targetId)&&(targetMap.get(a.targetId)!.eventVersionId!==a.eventVersionId||targetMap.get(a.targetId)!.examSetId!==a.examSetId))add(errors,p,'coefficient_target_mismatch','هدف ضریب با مجموعه/نسخه سازگار نیست.');
    if(a.coefficientCode!==null&&!/^[0-9]{1,4}$/.test(a.coefficientCode))add(errors,p+'.coefficientCode','invalid_coefficient_code','کد ضریب باید عددی و جدا از کد مجموعه باشد.');
    const seen=new Set<string>();
    for(const v of a.values??[]){
      if(!subjectMap.has(v.subjectId))add(errors,p+'.values','unknown_subject','ماده در بردار ضریب پیدا نشد: '+v.subjectId);
      if(seen.has(v.subjectId))add(errors,p+'.values','duplicate_subject_value','برای یک ماده بیش از یک ضریب ثبت شده است.');
      seen.add(v.subjectId);
      // V3-Hardening B4: دو محور مستقل — مقدار و شواهد
      if(v.state!==undefined && v.state!==null && normalizeCoefficientValueState(v.state)===null)
        add(errors,p+'.values.state','invalid_coefficient_state','وضعیت ضریب نامعتبر است.');
      if(v.valueState!==undefined && !isCoefficientValueAxis(v.valueState))
        add(errors,p+'.values.valueState','invalid_coefficient_state','محور مقدار نامعتبر است.');
      if(v.evidence!==undefined && !isCoefficientEvidence(v.evidence))
        add(errors,p+'.values.evidence','invalid_evidence_state','وضعیت شواهد نامعتبر است.');
      if(v.valueState!==undefined && v.state!==undefined &&
         normalizeCoefficientValueState(v.state)!==v.valueState)
        add(errors,p+'.values','legacy_state_value_state_mismatch','state قدیمی با valueState جدید ناسازگار است.');
      const valueAxis = v.valueState ?? normalizeCoefficientValueState(v.state);
      const evidence = v.evidence ?? mapAssignmentVerificationToEvidence(a.verification);
      if(valueAxis==='unknown' && v.value!==null)add(errors,p+'.values','unknown_has_value','ضریب نامعلوم باید null باشد، نه صفر یا عدد.');
      if(valueAxis==='zero' && v.value!==0)add(errors,p+'.values','zero_state_mismatch','ضریب صفر باید دقیقاً ۰ باشد.');
      if(valueAxis==='positive'&&(typeof v.value!=='number'||!Number.isFinite(v.value)||v.value<=0))add(errors,p+'.values','positive_state_mismatch','ضریب مثبت باید عددی بزرگ‌تر از صفر باشد.');
      if(valueAxis==='not_applicable'&&v.value!==null)add(errors,p+'.values','not_applicable_has_value','درس نامرتبط با null ثبت می‌شود.');
      // صفر رسمی باید با سند رسمی اثبات شود؛ دادهٔ legacy بدون شواهد رسمی هشدار می‌گیرد،
      // نه ارتقای خاموش — مقادیر needs_check/draft هرگز official_verified نمی‌شوند.
      if(valueAxis==='zero' && evidence!=='official_verified')
        add(warnings,p+'.values','zero_pending_official_evidence','ضریب صفر بدون سند رسمی؛ به‌عنوان نیازمند بررسی حفظ می‌شود، نه صفر رسمی.');
      if(!setSubjectKeys.has(key(a.examSetId,v.subjectId)))add(errors,p+'.values','coefficient_subject_outside_set','بردار ضریب به ماده‌ای خارج از مجموعه اشاره می‌کند.');
    }
    if(!validStatuses.includes(a.verification))add(errors,p+'.verification','invalid_status','وضعیت بردار ضریب نامعتبر است.');
    for(const sid of a.sourceIds??[])if(!sourceIds.has(sid))add(errors,p+'.sourceIds','unknown_source','منبع ضریب یافت نشد: '+sid);
  });

  componentCoefficients.forEach((a,i)=>{
    const p='componentCoefficients['+i+']';
    if(!versionMap.has(a.eventVersionId)||!setMap.has(a.examSetId))add(errors,p,'unknown_reference','نسخه یا مجموعه جزء آزمون پیدا نشد.');
    if(!a.subjectIds.length||duplicate(a.subjectIds))add(errors,p+'.subjectIds','invalid_subject_members','اعضای جزء آزمون باید یکتا و غیرخالی باشند.');
    for(const subjectId of a.subjectIds){
      if(!subjectMap.has(subjectId))add(errors,p+'.subjectIds','unknown_subject','ماده عضو جزء آزمون پیدا نشد: '+subjectId);
      else if(!setSubjectKeys.has(key(a.examSetId,subjectId)))add(errors,p+'.subjectIds','component_subject_outside_set','ماده جزء آزمون خارج از مجموعه تعریف شده است.');
    }
    if(a.state==='unknown'&&a.value!==null)add(errors,p+'.value','unknown_has_value','ضریب جزء نامعلوم باید null باشد.');
    if(a.state==='official_zero'&&a.value!==0)add(errors,p+'.value','zero_state_mismatch','ضریب رسمی صفر باید ۰ باشد.');
    if(a.state==='official_positive'&&(typeof a.value!=='number'||a.value<=0))add(errors,p+'.value','positive_state_mismatch','ضریب رسمی مثبت نامعتبر است.');
    if(!validStatuses.includes(a.verification))add(errors,p+'.verification','invalid_status','وضعیت ضریب جزء نامعتبر است.');
  });

  courseMappings.forEach((m,i)=>{
    const p='subjectCourseMappings['+i+']';
    if(!versionMap.has(m.eventVersionId)||!subjectMap.has(m.subjectId))add(errors,p,'unknown_reference','نسخه یا ماده برای نگاشت درس پیدا نشد.');
    if(!setSubjectRowsForVersionSubject(m.eventVersionId,m.subjectId,setSubjects))add(errors,p,'course_mapping_wrong_version','نگاشت درس به ماده‌ای خارج از نسخه آزمون اشاره می‌کند.');
    if(m.courseRefKind==='unresolved'&&m.courseRefId!==null)add(errors,p+'.courseRefId','unresolved_has_id','نگاشت حل‌نشده نباید شناسه قطعی داشته باشد.');
    if(m.courseRefKind!=='unresolved'&&(!nonEmpty(m.courseRefId)||m.mappingStatus==='needs_mapping'))add(errors,p+'.courseRefId','missing_course_reference','نگاشت درس قطعی/نامزد باید شناسه داشته باشد.');
  });

  policies.forEach((p,i)=>{
    const path='selectionPolicies['+i+']';
    if(!versionMap.has(p.eventVersionId))add(errors,path+'.eventVersionId','unknown_version','نسخه سیاست انتخاب آزمون پیدا نشد.');
    if(!isExamModelLevel(p.examLevel))add(errors,path+'.examLevel','invalid_level','مقطع سیاست انتخاب نامعتبر است.');
    if(p.maxExamSetSelections!==null&&(!Number.isInteger(p.maxExamSetSelections)||p.maxExamSetSelections<1))add(errors,path+'.maxExamSetSelections','invalid_limit','حد انتخاب باید عدد صحیح مثبت یا null باشد.');
    // V3-Hardening B3: سه حالت سقف — سازگار با رکوردهای قدیمی بدون selectionLimitState
    if(p.selectionLimitState!==undefined){
      if(!(SELECTION_LIMIT_STATES as readonly string[]).includes(p.selectionLimitState))
        add(errors,path+'.selectionLimitState','invalid_limit_state','حالت سقف انتخاب نامعتبر است.');
      if(p.selectionLimitState==='limited'&&p.maxExamSetSelections===null)
        add(errors,path+'.selectionLimitState','limit_state_mismatch','حالت limited نیازمند عدد سقف است.');
      if(p.selectionLimitState!=='limited'&&p.maxExamSetSelections!==null)
        add(errors,path+'.selectionLimitState','limit_state_mismatch','حالت unlimited/unknown نیازمند سقف null است.');
    }
    if(duplicate(p.allowedRoles))add(errors,path+'.allowedRoles','duplicate_roles','نقش‌های مجاز تکراری‌اند.');
    if(!validStatuses.includes(p.status))add(errors,path+'.status','invalid_status','وضعیت سیاست انتخاب نامعتبر است.');
    if(p.maxExamSetSelections===null&&p.status==='official_verified'&&p.selectionLimitState!=='unknown')
      warnings.push({path:path+'.maxExamSetSelections',code:'unbounded_verified_policy',message:'سقف نامعلوم با وضعیت قطعی ثبت شده است.'});
  });

  // Cross-table semantic guard: a master coefficient row belongs to a target/profile,
  // while doctorate combinations use membership and component-scoped coefficients.
  targets.forEach((t,i)=>{
    if(t.coefficientCode!==null&&!t.coefficientAssignmentId)add(errors,'targets['+i+'].coefficientAssignmentId','missing_coefficient_assignment','هدف دارای کد ضریب است اما بردار ضریب به آن متصل نشده است.');
    if(t.coefficientAssignmentId){
      const row=coefficientAssignments.find(a=>a.id===t.coefficientAssignmentId);
      if(!row||row.targetId!==t.id)add(errors,'targets['+i+'].coefficientAssignmentId','broken_coefficient_link','بردار ضریب هدف پیدا نشد یا به هدف دیگری متصل است.');
      else if(row.coefficientCode!==t.coefficientCode)add(errors,'targets['+i+'].coefficientAssignmentId','coefficient_code_mismatch','کد ضریب هدف و بردار ضرایب یکسان نیستند.');
    }
  });
  return {ok:errors.length===0,errors,warnings};
}

export function validateCandidateExamRegistration(
  registration: CandidateExamRegistration,
  bundle: ExamModelBundle,
): ExamModelValidation {
  const errors: ExamModelIssue[] = [];
  const warnings: ExamModelIssue[] = [];
  const version=bundle.eventVersions.find(v=>v.id===registration.eventVersionId);
  if(!version)add(errors,'eventVersionId','unknown_version','نسخه آزمون برای ثبت‌نام داوطلب وجود ندارد.');
  const policy=bundle.selectionPolicies.find(p=>p.eventVersionId===registration.eventVersionId);
  if(!policy)add(errors,'eventVersionId','missing_selection_policy','سیاست رسمی انتخاب مجموعه برای این سال ثبت نشده است.');
  else {
    const event=version?bundle.events.find(e=>e.id===version.eventId):undefined;
    if(event&&event.examLevel!==policy.examLevel)add(errors,'eventVersionId','selection_policy_level_mismatch','مقطع سیاست انتخاب با مقطع آزمون سازگار نیست.');
    if(policy.status!=='official_verified')warnings.push({path:'eventVersionId',code:'selection_policy_not_final',message:'سقف/نقش‌های ثبت‌نام این سال هنوز قطعی و رسمی تأیید نشده است.'});
  }
  if(!nonEmpty(registration.candidateId))add(errors,'candidateId','missing_candidate','شناسه داوطلب الزامی است.');
  const ids=registration.selections.map(s=>s.examSetId);
  if(duplicate(ids))add(errors,'selections','duplicate_exam_set','یک مجموعه امتحانی دوبار انتخاب شده است.');
  for(const s of registration.selections){
    const examSet=bundle.examSets.find(x=>x.id===s.examSetId);
    if(!examSet||examSet.eventVersionId!==registration.eventVersionId)add(errors,'selections','unknown_exam_set','مجموعه انتخاب‌شده متعلق به نسخه آزمون نیست.');
    if(policy?.status==='official_verified'&&!policy.allowedRoles.includes(s.role))add(errors,'selections','role_not_allowed','نقش انتخاب رسمی مجاز نیست: '+s.role);
  }
  if(policy?.maxExamSetSelections!==null&&policy?.maxExamSetSelections!==undefined&&registration.selections.length>policy.maxExamSetSelections){
    add(errors,'selections','selection_limit_exceeded','تعداد مجموعه‌های انتخابی از سقف رسمی بیشتر است.');
  }
  return {ok:errors.length===0,errors,warnings};
}

export function validateCandidateStudyPlan(
  plan: CandidateStudyPlan,
  bundle: ExamModelBundle,
  registrations: CandidateExamRegistration[] = [],
): ExamModelValidation {
  const errors: ExamModelIssue[] = [];
  const warnings: ExamModelIssue[] = [];
  if(!nonEmpty(plan.candidateId))add(errors,'candidateId','missing_candidate','شناسه داوطلب الزامی است.');
  if(!bundle.eventVersions.some(v=>v.id===plan.eventVersionId))add(errors,'eventVersionId','unknown_version','نسخه آزمون انتخاب‌شده وجود ندارد.');
  if(!plan.targets.length)add(errors,'targets','empty_targets','حداقل یک هدف مطالعه باید انتخاب شود.');
  if(duplicate(plan.targets.map(t=>t.targetId)))add(errors,'targets','duplicate_target','یک هدف مطالعه دوبار انتخاب شده است.');
  for(const t of plan.targets){
    const target=bundle.targets.find(x=>x.id===t.targetId);
    if(!target||target.eventVersionId!==plan.eventVersionId)add(errors,'targets','unknown_target','هدف مطالعه در نسخه آزمون وجود ندارد: '+t.targetId);
    if(!Number.isInteger(t.priorityOrder)||t.priorityOrder<1)add(errors,'targets','invalid_priority','اولویت هدف باید عدد صحیح مثبت باشد.');
    if(t.registrationSelectionId&&plan.registrationId===null)warnings.push({path:'targets',code:'registration_link_without_registration',message:'هدف به انتخاب رسمی پیوند داده شده اما شناسه ثبت‌نام موجود نیست.'});
  }
  if(duplicate(plan.studyTrackIds))add(errors,'studyTrackIds','duplicate_study_track','مسیر مطالعاتی تکراری است.');
  if(plan.registrationId){
    const registration=registrations.find(r=>r.id===plan.registrationId);
    if(!registration)warnings.push({path:'registrationId',code:'registration_not_loaded',message:'ثبت‌نام رسمی به برنامه متصل شده اما هنگام اعتبارسنجی بارگذاری نشده است.'});
    else {
      if(registration.candidateId!==plan.candidateId)add(errors,'registrationId','candidate_mismatch','ثبت‌نام متعلق به داوطلب دیگری است.');
      if(registration.eventVersionId!==plan.eventVersionId)add(errors,'registrationId','registration_version_mismatch','ثبت‌نام به نسخه آزمون دیگری تعلق دارد.');
      for(const target of plan.targets){
        if(!target.registrationSelectionId)continue;
        const selection=registration.selections.find(s=>s.registrationReference===target.registrationSelectionId);
        const mapping=bundle.targets.find(t=>t.id===target.targetId);
        if(!selection)add(errors,'targets.registrationSelectionId','unknown_registration_selection','انتخاب ثبت‌نام رسمی برای هدف پیدا نشد.');
        else if(mapping&&selection.examSetId!==mapping.examSetId)add(errors,'targets.registrationSelectionId','selection_set_mismatch','هدف مطالعاتی به انتخاب مجموعه رسمی دیگری پیوند خورده است.');
      }
    }
  }
  return {ok:errors.length===0,errors,warnings};
}

/**
 * Resolve a multi-target study plan. The union is deduplicated by subject ID,
 * while each target's official coefficient remains separate. No coefficient
 * is summed across target majors, and exam component coefficients are never
 * copied into each course/subject.
 */
export function resolveCandidatePreparationPlan(
  plan: CandidateStudyPlan,
  bundle: ExamModelBundle,
): CandidatePreparationResolution {
  const validation=validateCandidateStudyPlan(plan,bundle);
  const warnings=[...validation.warnings.map(x=>x.message)];
  if(!validation.ok)return {
    planId:plan.id,eventVersionId:plan.eventVersionId,examSetIds:[],targets:[],subjects:[],
    targetSubjectDetails:[],componentCoefficients:[],studyTrackIds:[...plan.studyTrackIds],warnings:validation.errors.map(x=>x.message),
    resolutionStatus:'blocked',
  };

  const subjectsById=new Map(bundle.subjects.map(s=>[s.id,s]));
  const setSubjectRows=bundle.setSubjects;
  const resolvedTargets:ResolvedTargetSubject[]=[];
  const resolvedComponents:ResolvedPreparationComponent[]=[];
  const targetSummaries:CandidatePreparationResolution['targets']=[];
  const subjectTargetMap=new Map<string,ResolvedPreparationSubject>();
  const examSetIds=new Set<string>();

  for(const selected of [...plan.targets].sort((a,b)=>a.priorityOrder-b.priorityOrder)){
    const target=bundle.targets.find(x=>x.id===selected.targetId)!;
    examSetIds.add(target.examSetId);
    targetSummaries.push({
      targetId:target.id,officialTargetLabel:target.officialTargetLabel,
      combinationCode:target.combinationCode,coefficientCode:target.coefficientCode,
    });
    const membership=target.combinationCode
      ? bundle.combinations.find(c=>c.eventVersionId===target.eventVersionId&&c.examSetId===target.examSetId&&c.combinationCode===target.combinationCode)
      : null;
    if(target.combinationCode&&!membership)warnings.push('ترکیب رسمی '+target.combinationCode+' برای هدف '+target.id+' پیدا نشد.');
    const combinationMemberIds=membership
      ? bundle.combinationSubjects.filter(x=>x.combinationId===membership.id&&x.required).map(x=>x.subjectId)
      : null;
    const includedSetRows=setSubjectRows.filter(r=>
      r.eventVersionId===plan.eventVersionId&&r.examSetId===target.examSetId&&
      (!combinationMemberIds||combinationMemberIds.includes(r.subjectId))
    );
    const targetComponents=bundle.componentCoefficients.filter(component=>
      component.eventVersionId===plan.eventVersionId&&component.examSetId===target.examSetId&&
      component.subjectIds.some(subjectId=>includedSetRows.some(row=>row.subjectId===subjectId))
    );
    for(const component of targetComponents){
      resolvedComponents.push({
        targetId:target.id,componentId:component.id,componentCode:component.componentCode,
        componentTitle:component.componentTitle,value:component.value,
        valueState:normalizeCoefficientValueState(component.state)??'unknown',
        evidence:mapAssignmentVerificationToEvidence(component.verification),
        subjectIds:component.subjectIds.filter(subjectId=>includedSetRows.some(row=>row.subjectId===subjectId))
      });
    }
    const coefficientRow=target.coefficientAssignmentId
      ? bundle.coefficientAssignments.find(x=>x.id===target.coefficientAssignmentId)
      : bundle.coefficientAssignments.find(x=>x.targetId===target.id);
    for(const row of includedSetRows){
      const subject=subjectsById.get(row.subjectId);
      if(!subject)continue;
      const direct=coefficientRow?.values.find(v=>v.subjectId===row.subjectId)??null;
      // V3-Hardening B4/B5: محور مقدار و شواهد جدا خوانده می‌شوند؛ دادهٔ legacy با normalize.
      // بدون ردیف ضریب صریح → unknown (نه not_applicable؛ غیبت رکورد ≠ نامرتبط بودن)
      const directAxis=direct?(normalizeCoefficientValueState(direct.valueState??direct.state)??'unknown'):'unknown';
      const directEvidence=direct?(direct.evidence??mapAssignmentVerificationToEvidence(coefficientRow?.verification)):'pending_verification';
      if(directAxis==='zero'||directAxis==='not_applicable')continue;
      const inclusion=membership?'included_by_combination':directAxis==='unknown'?'unknown_coefficient':'positive_coefficient';
      resolvedTargets.push({targetId:target.id,subjectId:subject.id,inclusion,directCoefficient:direct,componentCoefficients:[]});
      const old=subjectTargetMap.get(subject.id);
      if(old){
        if(!old.includedInTargetIds.includes(target.id))old.includedInTargetIds.push(target.id);
        old.coefficientsByTarget.push({
          targetId:target.id,value:direct?.value??null,valueState:directAxis,evidence:directEvidence,
          scope:direct?'exam_subject':null,
        });
      }else{
        subjectTargetMap.set(subject.id,{
          subjectId:subject.id,subjectNumber:row.subjectNumber,title:subject.title,
          includedInTargetIds:[target.id],
          coefficientsByTarget:[{
            targetId:target.id,value:direct?.value??null,valueState:directAxis,evidence:directEvidence,
            scope:direct?'exam_subject':null,
          }],
        });
      }
    }
  }
  for(const t of targetSummaries){
    const mapping=bundle.targets.find(x=>x.id===t.targetId);
    if(mapping?.admissionStatus==='not_guaranteed_by_exam_table')warnings.push('فهرست آزمون، پذیرش قطعی رشته‌محل «'+mapping.officialTargetLabel+'» را تضمین نمی‌کند.');
    if(mapping?.admissionStatus==='restricted'&&mapping.admissionRestriction)warnings.push(mapping.admissionRestriction);
  }
  const hasUnverifiedStructure = plan.targets.some(selected => {
    const target=bundle.targets.find(t=>t.id===selected.targetId);
    const version=bundle.eventVersions.find(v=>v.id===plan.eventVersionId);
    const assignment=target?.coefficientAssignmentId
      ? bundle.coefficientAssignments.find(a=>a.id===target.coefficientAssignmentId) : undefined;
    return !target || target.verification!=='official_verified' ||
      version?.status!=='official_verified' ||
      (assignment!==undefined && assignment.verification!=='official_verified');
  });
  return {
    planId:plan.id,eventVersionId:plan.eventVersionId,examSetIds:[...examSetIds],targets:targetSummaries,
    subjects:[...subjectTargetMap.values()].sort((a,b)=>a.subjectNumber-b.subjectNumber),
    targetSubjectDetails:resolvedTargets,componentCoefficients:resolvedComponents,studyTrackIds:[...plan.studyTrackIds],warnings,
    resolutionStatus:hasUnverifiedStructure||warnings.some(x=>x.includes('پیدا نشد'))?'partial':'resolved',
  };
}
