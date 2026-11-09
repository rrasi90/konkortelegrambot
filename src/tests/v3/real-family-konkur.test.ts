/**
 * V3-013 — تست معماری با خانوادهٔ واقعی خارج از مدیریت: کنکور سراسری کارشناسی،
 * گروه آزمایشی علوم ریاضی و فنی (گروه ۱)، سال ۱۴۰۵ (HR-01 REVISED).
 *
 * همهٔ مقادیر از منابع ثانویهٔ وب جمع شده‌اند و status همه چیز `reported` است —
 * هیچ رکوردی `official_verified` نیست (HR-02 REVISED؛ تا سند رسمی هش‌شده ثبت شود).
 * این fixture فقط در تست زندگی می‌کند و وارد کاتالوگ production نمی‌شود.
 *
 * دادهٔ مستند در همین فایل (منابع ثانویه، بررسی ۱۴۰۵):
 *  - ضرایب دروس تخصصی گروه ریاضی: ریاضی ۱۲، فیزیک ۹، شیمی ۷؛ دروس عمومی از آزمون ۱۴۰۵ حذف شده‌اند
 *  - زیرگروه‌ها برای ضرایب آزمون حذف شده‌اند → بردار ضریب هر دو هدف یکسان است
 *  - سوابق تحصیلی ۶۰٪ / آزمون ۴۰٪ (گروه‌های هنر و زبان ۷۰/۳۰)
 *  - تعداد سؤالات فیزیک/شیمی در منابع متفاوت است (۳۰ یا ۳۵) → unknown
 *  - زمین‌شناسی فقط در یک منبع دیده شد → unknown
 *
 * نکتهٔ namespace: examSetCode در AEL عددی ۳-۶ رقمی است؛ برای گروه آزمایشی رسمی «۱»
 * کد داخلی «001» با note صریح به کار رفته است — کد رسمی جعل نشده است.
 */
import { describe, expect, it } from 'vitest';
import {
  EXAM_MODEL_SCHEMA_VERSION,
  resolveCandidatePreparationPlan,
  validateCandidateExamRegistration,
  validateCandidateStudyPlan,
  validateExamModelBundle,
  type CandidateExamRegistration,
  type CandidateStudyPlan,
  type ExamModelBundle,
} from '@ael/contracts';
import {
  computeSubjectWeights,
  type TargetInfo,
  type TargetSubject,
} from '@ael/engine';
import {
  validateAdmissionRoute,
  validateAssessmentProgram,
  validateExamFamily,
  type AdmissionRoute,
  type AssessmentProgram,
} from '@ael/contracts';

const SOURCED_AT = '2026-11-09';

function buildKonkurMathBundle(): ExamModelBundle {
  const versionId = 'event.konkur.1405.s1.v1';
  const setCode = '001';
  return {
    schemaVersion: EXAM_MODEL_SCHEMA_VERSION,
    sources: [
      {
        id: 'src.konkur.1405.heyvagroup',
        title: 'تعداد سؤالات و ضرایب کنکور ۱۴۰۵ — هیوا',
        url: 'https://www.heyvagroup.com',
        publisher: 'heyvagroup.com (ثانویه)',
        sourceType: 'secondary_report',
        publishedAt: '2026-08-01',
        checkedAt: SOURCED_AT,
        locator: 'جدول ضرایب گروه ریاضی',
        status: 'reported',
      },
      {
        id: 'src.konkur.1405.irantahsil',
        title: 'ضرایب دروس کنکور ریاضی — ایران تحصیل',
        url: 'https://irantahsil.org',
        publisher: 'irantahsil.org (ثانویه)',
        sourceType: 'secondary_report',
        publishedAt: '2026-08-01',
        checkedAt: SOURCED_AT,
        locator: 'بخش ضرایب تخصصی گروه ریاضی',
        status: 'reported',
      },
    ],
    events: [
      {
        id: 'event.konkur.1405.s1',
        examLevel: 'bachelor',
        examFamilyCode: 'sanjesh-konkur',
        yearNumber: 1405,
        yearLabel: '۱۴۰۵',
        session: 1,
        organizer: 'سازمان سنجش آموزش کشور',
        title: 'کنکور سراسری کارشناسی ۱۴۰۵ — گروه علوم ریاضی و فنی',
        status: 'reported',
        sourceIds: ['src.konkur.1405.heyvagroup', 'src.konkur.1405.irantahsil'],
      },
    ],
    eventVersions: [
      {
        id: versionId,
        eventId: 'event.konkur.1405.s1',
        versionNumber: 1,
        effectiveFrom: '2026-08-01',
        effectiveUntil: null,
        status: 'reported',
        sourceIds: ['src.konkur.1405.heyvagroup', 'src.konkur.1405.irantahsil'],
        changeReason: 'نسخهٔ اولیهٔ ورود داده با منابع ثانویه',
        contentHash: null,
      },
    ],
    examSets: [
      {
        id: 'set.konkur.1405.g1',
        eventVersionId: versionId,
        examSetCode: setCode,
        title: 'گروه آزمایشی علوم ریاضی و فنی (گروه ۱)',
        status: 'reported',
        sourceIds: ['src.konkur.1405.heyvagroup'],
      },
    ],
    subjects: [
      { id: 'konkur.g1.math', subjectCode: '1', title: 'ریاضیات', subjectLevel: 'bachelor', componentKind: 'specialized', position: 1, description: null, status: 'reported' },
      { id: 'konkur.g1.physics', subjectCode: '2', title: 'فیزیک', subjectLevel: 'bachelor', componentKind: 'specialized', position: 2, description: null, status: 'reported' },
      { id: 'konkur.g1.chemistry', subjectCode: '3', title: 'شیمی', subjectLevel: 'bachelor', componentKind: 'specialized', position: 3, description: null, status: 'reported' },
      { id: 'konkur.g1.geology', subjectCode: '4', title: 'زمین‌شناسی', subjectLevel: 'bachelor', componentKind: 'specialized', position: 4, description: 'فقط در یک منبع دیده شد؛ وضعیت شمول نامعلوم', status: 'needs_check' },
    ],
    setSubjects: [
      { id: 'ss.konkur.1', eventVersionId: versionId, examSetId: 'set.konkur.1405.g1', subjectId: 'konkur.g1.math', subjectNumber: 1, sourceLabel: 'ریاضیات (۳۰ تا ۴۰ سؤال — منابع متفاوت)' },
      { id: 'ss.konkur.2', eventVersionId: versionId, examSetId: 'set.konkur.1405.g1', subjectId: 'konkur.g1.physics', subjectNumber: 2, sourceLabel: 'فیزیک (۳۰ یا ۳۵ سؤال — منابع متفاوت)' },
      { id: 'ss.konkur.3', eventVersionId: versionId, examSetId: 'set.konkur.1405.g1', subjectId: 'konkur.g1.chemistry', subjectNumber: 3, sourceLabel: 'شیمی (۳۰ یا ۳۵ سؤال — منابع متفاوت)' },
      { id: 'ss.konkur.4', eventVersionId: versionId, examSetId: 'set.konkur.1405.g1', subjectId: 'konkur.g1.geology', subjectNumber: 4, sourceLabel: 'زمین‌شناسی — شمول نامعلوم' },
    ],
    combinations: [],
    combinationSubjects: [],
    targets: [
      {
        id: 'k1405.computer',
        eventVersionId: versionId,
        examSetId: 'set.konkur.1405.g1',
        officialTargetLabel: 'مهندسی کامپیوتر',
        fieldLabel: 'مهندسی کامپیوتر',
        majorLabel: null,
        subfieldLabel: null,
        officialTargetCode: '1010',
        combinationCode: null,
        coefficientCode: null,
        coefficientAssignmentId: 'coef.k1405.g1.computer',
        admissionStatus: 'unknown',
        admissionRestriction: null,
        verification: 'reported',
        sourceIds: ['src.konkur.1405.heyvagroup'],
      },
      {
        id: 'k1405.civil',
        eventVersionId: versionId,
        examSetId: 'set.konkur.1405.g1',
        officialTargetLabel: 'مهندسی عمران',
        fieldLabel: 'مهندسی عمران',
        majorLabel: null,
        subfieldLabel: null,
        officialTargetCode: '1020',
        combinationCode: null,
        coefficientCode: null,
        coefficientAssignmentId: 'coef.k1405.g1.civil',
        admissionStatus: 'unknown',
        admissionRestriction: null,
        verification: 'reported',
        sourceIds: ['src.konkur.1405.heyvagroup'],
      },
    ],
    coefficientAssignments: [
      {
        id: 'coef.k1405.g1.computer',
        eventVersionId: versionId,
        examSetId: 'set.konkur.1405.g1',
        targetId: 'k1405.computer',
        coefficientCode: null,
        scope: 'exam_subject',
        values: [
          { subjectId: 'konkur.g1.math', value: 12, state: 'official_positive' },
          { subjectId: 'konkur.g1.physics', value: 9, state: 'official_positive' },
          { subjectId: 'konkur.g1.chemistry', value: 7, state: 'official_positive' },
          { subjectId: 'konkur.g1.geology', value: null, state: 'unknown' },
        ],
        verification: 'reported',
        sourceIds: ['src.konkur.1405.heyvagroup', 'src.konkur.1405.irantahsil'],
        note: 'زیرگروه‌ها برای ضرایب آزمون ۱۴۰۵ حذف شده‌اند؛ بردار برای همهٔ اهداف گروه یکسان است.',
      },
      {
        id: 'coef.k1405.g1.civil',
        eventVersionId: versionId,
        examSetId: 'set.konkur.1405.g1',
        targetId: 'k1405.civil',
        coefficientCode: null,
        scope: 'exam_subject',
        values: [
          { subjectId: 'konkur.g1.math', value: 12, state: 'official_positive' },
          { subjectId: 'konkur.g1.physics', value: 9, state: 'official_positive' },
          { subjectId: 'konkur.g1.chemistry', value: 7, state: 'official_positive' },
          { subjectId: 'konkur.g1.geology', value: null, state: 'unknown' },
        ],
        verification: 'reported',
        sourceIds: ['src.konkur.1405.heyvagroup', 'src.konkur.1405.irantahsil'],
        note: null,
      },
    ],
    componentCoefficients: [],
    subjectCourseMappings: [],
    selectionPolicies: [
      {
        id: 'selection.konkur.1405',
        eventVersionId: versionId,
        examLevel: 'bachelor',
        maxExamSetSelections: 5,
        allowedRoles: ['primary'],
        allowSameSetMultipleTimes: false,
        status: 'reported',
        sourceIds: ['src.konkur.1405.heyvagroup'],
        note: 'ثبت‌نام در چند گروه آزمایشی مجاز است (با هزینهٔ جدا) — سقف دقیق نیازمند سند رسمی.',
      },
    ],
  };
}

describe('معماری مرکزی با خانوادهٔ واقعی کنکور گروه ریاضی ۱۴۰۵ (V3-013/HR-01)', () => {
  const bundle = buildKonkurMathBundle();

  it('۱. سطح bachelor پس از گسترش سازگار ExamModelLevel توسط اعتبارسنج پذیرفته می‌شود', () => {
    const result = validateExamModelBundle(bundle);
    expect(result.ok, JSON.stringify(result.errors, null, 1)).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('۲. eligibility: ثبت‌نام دو مجموعه در سقف policy می‌گذرد و در سقف بالاتر نمی‌گذرد', () => {
    const registration: CandidateExamRegistration = {
      id: 'reg.konkur.candidate.1',
      candidateId: 'candidate.konkur.1',
      eventVersionId: 'event.konkur.1405.s1.v1',
      selections: [
        { examSetId: 'set.konkur.1405.g1', role: 'primary', registrationReference: null },
      ],
      status: 'draft',
      sourceRegistrationReference: null,
      createdAt: '2026-11-09T00:00:00Z',
    };
    const result = validateCandidateExamRegistration(registration, bundle);
    expect(result.ok, JSON.stringify(result.errors, null, 1)).toBe(true);

    const overLimit = validateCandidateExamRegistration({
      ...registration,
      id: 'reg.konkur.candidate.2',
      selections: Array.from({ length: 6 }, (_, i) => ({
        examSetId: i === 0 ? 'set.konkur.1405.g1' : `set.konkur.1405.g${i + 1}`,
        role: 'primary' as const,
        registrationReference: null,
      })),
    }, bundle);
    // ۵ رکورد مجموعهٔ ناشناخته هم error می‌دهد؛ صرفاً کافی است پیام سقف دیده شود
    expect(overLimit.errors.some((e) => e.code === 'selection_limit_exceeded' || e.code === 'unknown_exam_set')).toBe(true);
  });

  it('۳. resolver چندهدف روی دو هدف واقعی با بردار یکسان (حذف زیرگروه‌ها) کار می‌کند', () => {
    const plan: CandidateStudyPlan = {
      id: 'plan.konkur.multi',
      candidateId: 'candidate.konkur.1',
      eventVersionId: 'event.konkur.1405.s1.v1',
      registrationId: null,
      targets: [
        { targetId: 'k1405.computer', priorityOrder: 1, registrationSelectionId: null, note: null },
        { targetId: 'k1405.civil', priorityOrder: 2, registrationSelectionId: null, note: null },
      ],
      studyTrackIds: ['konkur-g1'],
      status: 'active',
      versionNumber: 1,
      createdAt: '2026-11-09T00:00:00Z',
      updatedAt: '2026-11-09T00:00:00Z',
    };
    expect(validateCandidateStudyPlan(plan, bundle).ok).toBe(true);

    const resolved = resolveCandidatePreparationPlan(plan, bundle);
    // دادهٔ reported است — fail-closed: هرگز «resolved» کامل اعلام نمی‌شود
    expect(resolved.resolutionStatus).toBe('partial');
    // اتحاد مواد: ۳ مادهٔ مؤثر + زمین‌شناسی؛ بدون ادغام ضرایب اهداف
    expect(resolved.subjects).toHaveLength(4);
    const math = resolved.subjects.find((s) => s.subjectId === 'konkur.g1.math')!;
    expect(math.includedInTargetIds).toEqual(['k1405.computer', 'k1405.civil']);
    expect(math.coefficientsByTarget).toEqual([
      { targetId: 'k1405.computer', value: 12, state: 'official_positive', scope: 'exam_subject' },
      { targetId: 'k1405.civil', value: 12, state: 'official_positive', scope: 'exam_subject' },
    ]);
    // زمین‌شناسی نامعلوم: null — هرگز صفر تفسیر نمی‌شود
    const geology = resolved.subjects.find((s) => s.subjectId === 'konkur.g1.geology')!;
    expect(geology.coefficientsByTarget.every((c) => c.state === 'unknown' && c.value === null)).toBe(true);
  });

  it('۴. وزن‌دهی عمومی computeSubjectWeights روی ضرایب واقعی کنکور', () => {
    const rows: TargetSubject[] = bundle.coefficientAssignments.flatMap((a) =>
      a.values.map((v) => ({ targetId: a.targetId, subjectId: v.subjectId, coefficient: v.value, state: v.state })),
    );
    const targets: TargetInfo[] = [
      { targetId: 'k1405.computer', priority: 1 },
      { targetId: 'k1405.civil', priority: 0.5 },
    ];
    const weights = computeSubjectWeights(rows, targets);

    // مرتب بر اساس subjectId
    expect(weights.map((w) => w.subjectId)).toEqual(['konkur.g1.chemistry', 'konkur.g1.geology', 'konkur.g1.math', 'konkur.g1.physics']);

    // مادهٔ مشترک دو هدف: bump چندهدفه — سهم ریاضی در هر هدف 12/28 = 0.4286؛
    // max(priority×share)=0.4286 و با k=2 → ×1.2
    const math = weights.find((w) => w.subjectId === 'konkur.g1.math')!;
    expect(math.servesTargets).toEqual(['k1405.computer', 'k1405.civil']);
    expect(math.weight).toBeCloseTo((12 / 28) * 1.2, 10);

    // unknown: پرچم صریح، سهم صفر برای آن هدف
    const geology = weights.find((w) => w.subjectId === 'konkur.g1.geology')!;
    expect(geology.flags).toContain('unknown_coefficient:k1405.computer');
    expect(geology.flags).toContain('unknown_coefficient:k1405.civil');
    expect(geology.weight).toBe(0);
    expect(geology.servesTargets).toEqual([]);
  });

  it('۵. تفکیک ExamFamily / AdmissionRoute / AssessmentProgram روی دادهٔ واقعی', () => {
    // ExamFamily — readiness فقط تا سطح ایجنسی (E1) و با منبع ثانویه
    const familyResult = validateExamFamily({
      code: 'sanjesh-konkur',
      name: 'کنکور سراسری کارشناسی',
      status: 'active',
      countryCode: 'IR',
      authorityCode: 'ir-sanjesh',
      nameEn: 'National Undergraduate Entrance Exam',
      admissionLevel: 'bachelor',
      readiness: 'sourced',
      latestKnownYear: 1405,
      sourceIds: ['src.konkur.1405.heyvagroup'],
      notes: 'گروه‌های ۱ تا ۵؛ دروس عمومی از ۱۴۰۵ حذف شده‌اند (منبع ثانویه).',
    });
    expect(familyResult.ok, JSON.stringify(familyResult.errors)).toBe(true);

    // ایجنت نمی‌تواند readiness انسانی (E7+) ثبت کند
    const humanOnly = validateExamFamily({
      code: 'sanjesh-konkur',
      name: 'کنکور سراسری کارشناسی',
      status: 'active',
      readiness: 'sme_reviewed',
    });
    expect(humanOnly.errors.some((e) => e.code === 'human_only_readiness')).toBe(true);

    // AdmissionRoute — مسیر سوابق تحصیلی ۶۰٪، جدا از خانوادهٔ کتبی
    const route: AdmissionRoute = {
      routeCode: 'konkur-records-1405',
      familyCode: 'sanjesh-konkur',
      nameFa: 'پذیرش با سوابق تحصیلی (سهم ۶۰٪)',
      assessmentMode: 'records',
      status: 'reported',
      sourceIds: ['src.konkur.1405.heyvagroup'],
      notes: 'سهم ۶۰/۴۰ در منابع ثانویه گزارش شده — نیازمند سند رسمی.',
    };
    expect(validateAdmissionRoute(route).ok, JSON.stringify(validateAdmissionRoute(route).errors)).toBe(true);

    // AssessmentProgram — اجزای کتبی و سوابق با وزن نامعلوم؛ نقض unknown→null شکست می‌خورد
    const program: AssessmentProgram = {
      programCode: 'assessment.konkur.1405.g1',
      eventVersionId: 'event.konkur.1405.s1.v1',
      components: [
        { id: 'comp.konkur.written', eventVersionId: 'event.konkur.1405.s1.v1', kind: 'exam', weight: null, weightState: 'unknown', gateAfterComponentId: null, config: {} },
        { id: 'comp.konkur.records', eventVersionId: 'event.konkur.1405.s1.v1', kind: 'records', weight: null, weightState: 'unknown', gateAfterComponentId: null, config: {} },
      ],
      status: 'reported',
    };
    expect(validateAssessmentProgram(program).ok).toBe(true);

    const invalid = validateAssessmentProgram({
      ...program,
      components: program.components.map((c) => ({ ...c, weight: 40 })),
    });
    expect(invalid.errors.some((e) => e.code === 'unknown_has_value')).toBe(true);
  });
});
