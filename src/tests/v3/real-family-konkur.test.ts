/**
 * V3-013/Hardening — تست معماری با خانوادهٔ واقعی خارج از مدیریت: کنکور سراسری
 * کارشناسی، گروه آزمایشی علوم ریاضی و فنی (گروه ۱)، سال ۱۴۰۵ (HR-01 REVISED).
 *
 * منبع: منابع ثانویهٔ وب (irantahsil.org، heyvagroup.com) — بررسی ۱۴۰۵؛
 * همهٔ مقادیر status=reported و evidence=reported؛ هیچ رکوردی official_verified
 * نیست (HR-02 REVISED). این fixture فقط در تست زندگی می‌کند و وارد کاتالوگ
 * production نمی‌شود.
 *
 * دادهٔ مستند در همین فایل:
 *  - ضرایب دروس تخصصی گروه ریاضی ۱۴۰۵: ریاضی ۱۲، فیزیک ۹، شیمی ۷ (منبع ثانویه)
 *  - دروس عمومی از آزمون ۱۴۰۵ حذف شده‌اند؛ زیرگروه‌ها برای ضرایب آزمون حذف شده‌اند
 *    → بردار ضریب هر دو هدف یکسان است
 *  - سوابق تحصیلی ۶۰٪ / آزمون ۴۰٪ (گروه‌های هنر و زبان ۷۰/۳۰)
 *  - تعداد سؤالات فیزیک/شیمی در منابع متفاوت است (۳۰ یا ۳۵) → مقدار ثبت نمی‌شود
 *  - زمین‌شناسی فقط در یک منبع دیده شد → unknown
 *  - کد رسمی گروه آزمایشی در دفترچه «۱» است (B2: بدون padding)؛ کد رشته‌محل
 *    رسمی در دسترس ایجنت نیست → officialTargetCode=null (B3: هیچ کدی از حدس ساخته نمی‌شود)
 *  - سقف دقیق ثبت‌نام چندگروهی از منبع ثانویه معلوم نیست → selectionLimitState='unknown' (B3)
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
import { buildKonkurMathBundle } from './real-family-konkur-builder';
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

describe('معماری مرکزی با خانوادهٔ واقعی کنکور گروه ریاضی ۱۴۰۵ (V3-013/HR-01، Hardening B2/B3/B4)', () => {
  const bundle = buildKonkurMathBundle();

  it('۱. کد رسمی مجموعه «۱» بدون padding پذیرفته می‌شود و شناسه داخلی جدا می‌ماند', () => {
    const result = validateExamModelBundle(bundle);
    expect(result.ok, JSON.stringify(result.errors, null, 1)).toBe(true);
    expect(result.errors).toEqual([]);
    // B2: شناسه داخلی پایدار ≠ کد منتشرشدهٔ رسمی — هیچ تبدیل ضمنی وجود ندارد
    const set = bundle.examSets[0];
    expect(set.examSetCode).toBe('1');
    expect(set.id).toBe('set.konkur.1405.g1');
    expect(set.id).not.toBe(set.examSetCode);
    // padding رد می‌شود
    const padded = structuredClone(bundle);
    padded.examSets[0].examSetCode = '001';
    const paddedResult = validateExamModelBundle(padded);
    expect(paddedResult.errors.some((e) => e.code === 'invalid_exam_set_code')).toBe(true);
  });

  it('۲. eligibility: مجموعهٔ ناشناخته و سقف انتخاب دو خطای مستقل‌اند؛ سقف نامعلوم صفر یا بی‌سقف تفسیر نمی‌شود', () => {
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

    // انتخاب مجموعهٔ ناشناخته: فقط خطای unknown_exam_set — بدون خطای سقف
    const unknownSet = validateCandidateExamRegistration({
      ...registration,
      id: 'reg.konkur.candidate.2',
      selections: [
        { examSetId: 'set.konkur.1405.g1', role: 'primary', registrationReference: null },
        { examSetId: 'set.konkur.1405.gX', role: 'primary', registrationReference: null },
      ],
    }, bundle);
    expect(unknownSet.ok).toBe(false);
    expect(unknownSet.errors.map((e) => e.code)).toEqual(['unknown_exam_set']);

    // سقف نامعلوم در خود سیاست قابل مشاهده است و عدد ساختگی ندارد
    const policy = bundle.selectionPolicies[0];
    expect(policy.selectionLimitState).toBe('unknown');
    expect(policy.maxExamSetSelections).toBeNull();
  });

  it('۳. resolver چندهدف روی دو هدف واقعی با بردار یکسان — محور مقدار و شواهد جدا', () => {
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
    expect(resolved.subjects).toHaveLength(4);
    const math = resolved.subjects.find((s) => s.subjectId === 'konkur.g1.math')!;
    expect(math.includedInTargetIds).toEqual(['k1405.computer', 'k1405.civil']);
    // B4: ضریب مثبت گزارش‌شده — positive+reported، هرگز official_*
    expect(math.coefficientsByTarget).toEqual([
      { targetId: 'k1405.computer', value: 12, valueState: 'positive', evidence: 'reported', scope: 'exam_subject' },
      { targetId: 'k1405.civil', value: 12, valueState: 'positive', evidence: 'reported', scope: 'exam_subject' },
    ]);
    const geology = resolved.subjects.find((s) => s.subjectId === 'konkur.g1.geology')!;
    expect(geology.coefficientsByTarget.every((c) => c.valueState === 'unknown' && c.value === null)).toBe(true);
    // هیچ مقدار reported به‌طور ضمنی official_verified نمی‌شود
    expect(math.coefficientsByTarget.every((c) => c.evidence === 'reported')).toBe(true);
  });

  it('۴. وزن‌دهی عمومی computeSubjectWeights — Unknown ≠ Zero و وضعیت برنامه‌ریزی صریح', () => {
    const rows: TargetSubject[] = bundle.coefficientAssignments.flatMap((a) =>
      a.values.map((v) => ({ targetId: a.targetId, subjectId: v.subjectId, coefficient: v.value, valueState: v.valueState, evidence: v.evidence })),
    );
    const targets: TargetInfo[] = [
      { targetId: 'k1405.computer', priority: 1 },
      { targetId: 'k1405.civil', priority: 0.5 },
    ];
    const weights = computeSubjectWeights(rows, targets);

    expect(weights.map((w) => w.subjectId)).toEqual(['konkur.g1.chemistry', 'konkur.g1.geology', 'konkur.g1.math', 'konkur.g1.physics']);

    // مادهٔ مشترک دو هدف: bump چندهدفه — share ریاضی = 12/28؛ ready چون هیچ unknown ندارد؟
    // نه: زمین‌شناسی unknown برای هر دو هدف است اما سطرش مستقل است؛ ریاضی/فیزیک/شیمی فقط سطر positive دارند
    const math = weights.find((w) => w.subjectId === 'konkur.g1.math')!;
    expect(math.servesTargets).toEqual(['k1405.computer', 'k1405.civil']);
    expect(math.weight).toBeCloseTo((12 / 28) * 1.2, 10);
    expect(math.weightStatus).toBe('computed');
    expect(math.planningStatus).toBe('ready');

    // زمین‌شناسی: نامعلوم — وزن null (هرگز صفر)، needs_review، پرچم صریح برای هر دو هدف
    const geology = weights.find((w) => w.subjectId === 'konkur.g1.geology')!;
    expect(geology.weight).toBeNull();
    expect(geology.weightStatus).toBe('unknown');
    expect(geology.planningStatus).toBe('needs_review');
    expect(geology.flags).toContain('unknown_coefficient:k1405.computer');
    expect(geology.flags).toContain('unknown_coefficient:k1405.civil');
    expect(geology.servesTargets).toEqual([]);
  });

  it('۵. تفکیک ExamFamily / AdmissionRoute / AssessmentProgram روی دادهٔ واقعی', () => {
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

    const humanOnly = validateExamFamily({
      code: 'sanjesh-konkur',
      name: 'کنکور سراسری کارشناسی',
      status: 'active',
      readiness: 'sme_reviewed',
    });
    expect(humanOnly.errors.some((e) => e.code === 'human_only_readiness')).toBe(true);

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
