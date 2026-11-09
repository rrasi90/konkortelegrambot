/**
 * V3-013 — تست اثبات معماری مرکزی با خانوادهٔ آزمون کاملاً ساختگی.
 *
 * خانوادهٔ «fixture-apt» فقط داخل همین تست وجود دارد و هرگز وارد کاتالوگ
 * production نمی‌شود (بخش ۱۶٫۵ سند مادر). مشخصات fixture مطابق الزامات:
 * - دو هدف رشته‌محل متفاوت در یک رویداد
 * - یک مجموعه با سه ماده (یکی مشترک بین دو هدف)
 * - یک ضریب رسمی صفر و یک ضریب نامعلوم
 * - یک جزء غیرکتبی (مصاحبه) به‌عنوان component coefficient
 * - یک قاعدهٔ eligibility نسخه‌دار (SelectionPolicy)
 *
 * ادعای تست: کل مسیر اعتبارسنجی → resolver چندهدف → وزن‌دهی → برنامه‌ریزی
 * بدون هیچ تغییر کد اختصاصی خانواده در هسته کار می‌کند.
 */
import { describe, expect, it } from 'vitest';
import {
  EXAM_MODEL_SCHEMA_VERSION,
  resolveCandidatePreparationPlan,
  validateExamModelBundle,
  validateCandidateStudyPlan,
  type CandidateStudyPlan,
  type ExamModelBundle,
} from '@ael/contracts';
import { readinessLabel } from '@ael/engine';

/** خانوادهٔ کاملاً ساختگی «سنجش استعداد ویژه» — فقط تست. */
function buildFictionalFamilyBundle(): ExamModelBundle {
  return {
    schemaVersion: EXAM_MODEL_SCHEMA_VERSION,
    sources: [
      {
        id: 'src.fixture.handbook',
        title: 'دفترچهٔ ساختگی استعداد ویژه',
        url: null,
        publisher: 'سازمان ساختگی آزمون‌ها',
        sourceType: 'official_handbook',
        publishedAt: '2026-08-01',
        checkedAt: '2026-11-09',
        locator: 'صفحهٔ ۱ ساختگی',
        status: 'draft',
      } as ExamModelBundle['sources'][number],
    ],
    events: [
      {
        id: 'event.fixture.1407',
        examLevel: 'master',
        examFamilyCode: 'fixture-apt',
        yearNumber: 1407,
        yearLabel: '۱۴۰۷',
        session: 1,
        organizer: 'سازمان ساختگی آزمون‌ها',
        title: 'آزمون ساختگی استعداد ویژه ۱۴۰۷',
        status: 'draft',
        sourceIds: ['src.fixture.handbook'],
      } as ExamModelBundle['events'][number],
    ],
    eventVersions: [
      {
        id: 'event.fixture.1407.v1',
        eventId: 'event.fixture.1407',
        versionNumber: 1,
        effectiveFrom: '2026-08-01',
        effectiveUntil: null,
        status: 'draft',
        sourceIds: ['src.fixture.handbook'],
        changeReason: null,
      } as ExamModelBundle['eventVersions'][number],
    ],
    examSets: [
      {
        id: 'set.fixture.1407.apt',
        eventVersionId: 'event.fixture.1407.v1',
        examSetCode: '9100',
        title: 'مجموعهٔ ساختگی استعداد',
        status: 'draft',
        sourceIds: ['src.fixture.handbook'],
      },
    ],
    subjects: [
      { id: 'fixture.9100.s1', subjectCode: '1', title: 'زبان ساختگی', subjectLevel: 'master', componentKind: 'language', position: 1, description: null, status: 'draft' },
      { id: 'fixture.9100.s2', subjectCode: '2', title: 'استعداد کلامی', subjectLevel: 'master', componentKind: 'specialized', position: 2, description: null, status: 'draft' },
      { id: 'fixture.9100.s3', subjectCode: '3', title: 'استعداد ریاضی', subjectLevel: 'master', componentKind: 'specialized', position: 3, description: null, status: 'draft' },
    ] as ExamModelBundle['subjects'],
    setSubjects: [
      { id: 'ss.fixture.1', eventVersionId: 'event.fixture.1407.v1', examSetId: 'set.fixture.1407.apt', subjectId: 'fixture.9100.s1', subjectNumber: 1, sourceLabel: 'زبان عمومی و تخصصی' },
      { id: 'ss.fixture.2', eventVersionId: 'event.fixture.1407.v1', examSetId: 'set.fixture.1407.apt', subjectId: 'fixture.9100.s2', subjectNumber: 2, sourceLabel: 'استعداد کلامی' },
      { id: 'ss.fixture.3', eventVersionId: 'event.fixture.1407.v1', examSetId: 'set.fixture.1407.apt', subjectId: 'fixture.9100.s3', subjectNumber: 3, sourceLabel: 'استعداد ریاضی' },
    ],
    combinations: [],
    combinationSubjects: [],
    targets: [
      {
        id: 'f1407.counseling',
        eventVersionId: 'event.fixture.1407.v1',
        examSetId: 'set.fixture.1407.apt',
        officialTargetLabel: 'مشاورهٔ ساختگی',
        fieldLabel: 'روان‌شناسی',
        majorLabel: 'مشاوره',
        subfieldLabel: null,
        officialTargetCode: '1010',
        combinationCode: null,
        coefficientCode: '11',
        coefficientAssignmentId: 'coef.f1407.counseling',
        admissionStatus: 'unknown',
        admissionRestriction: null,
        verification: 'draft',
        sourceIds: ['src.fixture.handbook'],
      } as ExamModelBundle['targets'][number],
      {
        id: 'f1407.assessment',
        eventVersionId: 'event.fixture.1407.v1',
        examSetId: 'set.fixture.1407.apt',
        officialTargetLabel: 'سنجش و اندازه‌گیری ساختگی',
        fieldLabel: 'روان‌شناسی',
        majorLabel: 'سنجش',
        subfieldLabel: null,
        officialTargetCode: '1020',
        combinationCode: null,
        coefficientCode: '12',
        coefficientAssignmentId: 'coef.f1407.assessment',
        admissionStatus: 'unknown',
        admissionRestriction: null,
        verification: 'draft',
        sourceIds: ['src.fixture.handbook'],
      } as ExamModelBundle['targets'][number],
    ],
    coefficientAssignments: [
      {
        id: 'coef.f1407.counseling',
        eventVersionId: 'event.fixture.1407.v1',
        examSetId: 'set.fixture.1407.apt',
        targetId: 'f1407.counseling',
        coefficientCode: '11',
        scope: 'exam_subject',
        values: [
          { subjectId: 'fixture.9100.s1', value: 3, state: 'official_positive' },
          { subjectId: 'fixture.9100.s2', value: 2, state: 'official_positive' },
          { subjectId: 'fixture.9100.s3', value: null, state: 'unknown' },
        ],
        verification: 'draft',
        sourceIds: ['src.fixture.handbook'],
        note: null,
      },
      {
        id: 'coef.f1407.assessment',
        eventVersionId: 'event.fixture.1407.v1',
        examSetId: 'set.fixture.1407.apt',
        targetId: 'f1407.assessment',
        coefficientCode: '12',
        scope: 'exam_subject',
        values: [
          { subjectId: 'fixture.9100.s1', value: 3, state: 'official_positive' },
          { subjectId: 'fixture.9100.s2', value: 0, state: 'official_zero' },
          { subjectId: 'fixture.9100.s3', value: 4, state: 'official_positive' },
        ],
        verification: 'draft',
        sourceIds: ['src.fixture.handbook'],
        note: null,
      },
    ],
    componentCoefficients: [
      {
        id: 'comp.f1407.interview',
        eventVersionId: 'event.fixture.1407.v1',
        examSetId: 'set.fixture.1407.apt',
        componentCode: 'interview',
        componentTitle: 'مصاحبهٔ ساختگی',
        subjectIds: ['fixture.9100.s2'],
        value: 20,
        state: 'official_positive',
        scope: 'exam_component',
        verification: 'draft',
        sourceIds: ['src.fixture.handbook'],
        note: null,
      },
    ],
    subjectCourseMappings: [],
    selectionPolicies: [
      {
        id: 'selection.fixture.1407',
        eventVersionId: 'event.fixture.1407.v1',
        examLevel: 'master',
        maxExamSetSelections: 1,
        allowedRoles: ['primary'],
        allowSameSetMultipleTimes: false,
        status: 'draft',
        sourceIds: ['src.fixture.handbook'],
        note: 'قاعدهٔ eligibility ساختگی: یک مجموعه، نقش اصلی.',
      },
    ],
  };
}

describe('معماری مرکزی: افزودن خانوادهٔ آزمون ساختگی فقط با داده (V3-013)', () => {
  const bundle = buildFictionalFamilyBundle();

  it('۱. اعتبارسنج عمومی خانوادهٔ کاملاً ناشناخته را بدون تغییر کد می‌پذیرد', () => {
    const result = validateExamModelBundle(bundle);
    expect(result.ok, JSON.stringify(result.errors, null, 1)).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('۲. resolver چندهدف برای دو هدف با مواد مشترک بدون کد خانواده‌محور resolve می‌کند', () => {
    const plan: CandidateStudyPlan = {
      id: 'plan.fixture.multi',
      candidateId: 'candidate.fixture',
      eventVersionId: 'event.fixture.1407.v1',
      registrationId: null,
      targets: [
        { targetId: 'f1407.counseling', priorityOrder: 1, registrationSelectionId: null, note: null },
        { targetId: 'f1407.assessment', priorityOrder: 2, registrationSelectionId: null, note: null },
      ],
      studyTrackIds: ['fixture-track-1', 'fixture-track-2'],
      status: 'active',
      versionNumber: 1,
      createdAt: '2026-11-09T00:00:00Z',
      updatedAt: '2026-11-09T00:00:00Z',
    };
    expect(validateCandidateStudyPlan(plan, bundle).ok).toBe(true);

    const resolved = resolveCandidatePreparationPlan(plan, bundle);
    // دادهٔ fixture draft است؛ resolver به‌درستی از «resolved» کامل امتناع می‌کند
    // (fail-closed برای ساختار تأییدنشده) اما محاسبهٔ اتحاد و ضرایب کامل انجام می‌شود.
    expect(resolved.resolutionStatus).toBe('partial');

    // اتحاد مواد: ۳ ماده یکتا؛ مادهٔ مشترک (زبان) در هر دو هدف — ضرایب جدا
    expect(resolved.subjects).toHaveLength(3);
    const shared = resolved.subjects.find((s) => s.subjectId === 'fixture.9100.s1')!;
    expect(shared.includedInTargetIds).toEqual(['f1407.counseling', 'f1407.assessment']);
    expect(shared.coefficientsByTarget.map((c) => c.value)).toEqual([3, 3]);

    // ضریب صفر رسمی هدف دوم: مادهٔ کلامی فقط در هدف مشاوره
    const verbal = resolved.subjects.find((s) => s.subjectId === 'fixture.9100.s2')!;
    expect(verbal.includedInTargetIds).toEqual(['f1407.counseling']);

    // ضریب نامعلوم هدف اول: مقدار null — هرگز صفر تفسیر نمی‌شود؛ scope صریح
    const math = resolved.subjects.find((s) => s.subjectId === 'fixture.9100.s3')!;
    expect(math.coefficientsByTarget).toEqual([
      { targetId: 'f1407.counseling', value: null, state: 'unknown', scope: 'exam_subject' },
      { targetId: 'f1407.assessment', value: 4, state: 'official_positive', scope: 'exam_subject' },
    ]);

    // جزء غیرکتبی (مصاحبه) جدا گزارش می‌شود، نه داخل درس‌ها — scope همیشه exam_component است
    const interview = resolved.componentCoefficients.find((c) => c.componentCode === 'interview');
    expect(interview?.value).toBe(20);
  });

  it('۳. متن readiness عمومی برای خانوادهٔ ساختگی بدون ادعای تضمین یا احتمال قبولی کار می‌کند', () => {
    // readiness-copy مستقل از نام آزمون است. («کامل» و «رتبه» در متن high در قالب نفی می‌آیند — ثبت در GAP-012)
    expect(readinessLabel('low')).not.toMatch(/تضمینی|احتمال قبولی/);
    expect(readinessLabel('high')).not.toMatch(/تضمینی|احتمال قبولی/);
  });
});
