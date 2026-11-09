/**
 * V3-Hardening B6 — builder مشترک fixture کنکور گروه ریاضی ۱۴۰۵.
 * دادهٔ کامل و منابع: src/tests/v3/real-family-konkur.test.ts (کامنت سرآیند آن فایل).
 */
import {
  EXAM_MODEL_SCHEMA_VERSION,
  type ExamModelBundle,
} from '@ael/contracts';

const SOURCED_AT = '2026-11-09';

function buildKonkurMathBundle(): ExamModelBundle {
  const versionId = 'event.konkur.1405.s1.v1';
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
        // B2: کد منتشرشدهٔ رسمی «۱» — دقیقاً به شکل منبع، بدون صفر ابتدایی
        examSetCode: '1',
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
      { id: 'ss.konkur.1', eventVersionId: versionId, examSetId: 'set.konkur.1405.g1', subjectId: 'konkur.g1.math', subjectNumber: 1, sourceLabel: 'ریاضیات (۳۰ تا ۴۰ سؤال — منابع متفاوت؛ تعداد ثبت نمی‌شود)' },
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
        // B3: کد رسمی رشته‌محل در منبع ثانویه معتبر نیست → null، نه کد حدسی
        officialTargetCode: null,
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
        officialTargetCode: null,
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
        // B4: محور مقدار و شواهد جدا — دادهٔ ثانویه = positive+reported، هرگز official_*
        values: [
          { subjectId: 'konkur.g1.math', value: 12, valueState: 'positive', evidence: 'reported' },
          { subjectId: 'konkur.g1.physics', value: 9, valueState: 'positive', evidence: 'reported' },
          { subjectId: 'konkur.g1.chemistry', value: 7, valueState: 'positive', evidence: 'reported' },
          { subjectId: 'konkur.g1.geology', value: null, valueState: 'unknown', evidence: 'reported' },
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
          { subjectId: 'konkur.g1.math', value: 12, valueState: 'positive', evidence: 'reported' },
          { subjectId: 'konkur.g1.physics', value: 9, valueState: 'positive', evidence: 'reported' },
          { subjectId: 'konkur.g1.chemistry', value: 7, valueState: 'positive', evidence: 'reported' },
          { subjectId: 'konkur.g1.geology', value: null, valueState: 'unknown', evidence: 'reported' },
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
        // B3: سقف دقیق ثبت‌نام چندگروهی از منبع ثانویه معلوم نیست → unknown، نه عدد ساختگی
        maxExamSetSelections: null,
        selectionLimitState: 'unknown',
        allowedRoles: ['primary'],
        allowSameSetMultipleTimes: false,
        status: 'reported',
        sourceIds: ['src.konkur.1405.heyvagroup'],
        note: 'ثبت‌نام در چند گروه آزمایشی در منابع ثانویه گزارش شده؛ سقف دقیق نیازمند سند رسمی است.',
      },
    ],
  };
}


export { buildKonkurMathBundle, SOURCED_AT };
