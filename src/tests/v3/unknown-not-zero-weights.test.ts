/**
 * V3-Hardening B4/B5 — تست‌های الزامی دو محور ضریب و اصل Unknown ≠ Zero.
 *
 * B4: محور مقدار (positive/zero/unknown/not_applicable) مستقل از محور شواهد
 *     (official_verified/reported/inferred/pending_verification).
 * B5: وزن نامعلوم null است نه صفر؛ درس نامعلوم هرگز خاموش حذف نمی‌شود؛
 *     planningStatus وضعیت ناقص داده را آشکار می‌کند.
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeCoefficientValueState,
  mapAssignmentVerificationToEvidence,
  validateExamModelBundle,
  type ExamModelBundle,
} from '@ael/contracts';
import { computeSubjectWeights, type TargetInfo, type TargetSubject } from '@ael/engine';

describe('B4 — دو محور مستقل ضریب', () => {
  it('normalize: alias قدیمی و محور جدید هر دو به محور مقدار می‌رسند و یک‌طرفه‌اند', () => {
    expect(normalizeCoefficientValueState('official_positive')).toBe('positive');
    expect(normalizeCoefficientValueState('official_zero')).toBe('zero');
    expect(normalizeCoefficientValueState('unknown')).toBe('unknown');
    expect(normalizeCoefficientValueState('not_applicable')).toBe('not_applicable');
    expect(normalizeCoefficientValueState('positive')).toBe('positive');
    expect(normalizeCoefficientValueState('nonsense')).toBeNull();
    // نکتهٔ محوری: official_positive → positive، اما reported نمی‌شود official_verified
  });

  it('mapAssignmentVerification: needs_check و draft هرگز official_verified نمی‌شوند', () => {
    expect(mapAssignmentVerificationToEvidence('official_verified')).toBe('official_verified');
    expect(mapAssignmentVerificationToEvidence('reported')).toBe('reported');
    expect(mapAssignmentVerificationToEvidence('needs_check')).toBe('pending_verification');
    expect(mapAssignmentVerificationToEvidence('draft')).toBe('pending_verification');
    expect(mapAssignmentVerificationToEvidence(undefined)).toBe('pending_verification');
  });

  function bundleWithValue(
    value: number | null,
    valueState: 'positive' | 'zero' | 'unknown' | 'not_applicable',
    evidence: 'official_verified' | 'reported' | 'inferred' | 'pending_verification' | undefined,
  ): ExamModelBundle {
    return {
      schemaVersion: 1,
      sources: [{ id: 'src.t', title: 't', url: null, publisher: 'p', sourceType: 'internal_audit', publishedAt: null, checkedAt: '2026-11-10', locator: 'l', status: 'draft' }],
      events: [{ id: 'ev', examLevel: 'master', examFamilyCode: 't', yearNumber: 1405, yearLabel: '۱۴۰۵', session: 1, organizer: 'o', title: 't', status: 'draft', sourceIds: ['src.t'] }],
      eventVersions: [{ id: 'evv', eventId: 'ev', versionNumber: 1, effectiveFrom: null, effectiveUntil: null, status: 'draft', sourceIds: ['src.t'], changeReason: null, contentHash: null }],
      examSets: [{ id: 'set.t', eventVersionId: 'evv', examSetCode: '1', title: 't', status: 'draft', sourceIds: ['src.t'] }],
      subjects: [{ id: 's1', subjectCode: '1', title: 'مادهٔ آزمون', subjectLevel: 'master', componentKind: 'language', position: 1, description: null, status: 'draft' }],
      setSubjects: [{ id: 'ss1', eventVersionId: 'evv', examSetId: 'set.t', subjectId: 's1', subjectNumber: 1, sourceLabel: 's' }],
      combinations: [],
      combinationSubjects: [],
      targets: [{ id: 'tg', eventVersionId: 'evv', examSetId: 'set.t', officialTargetLabel: 'هدف', fieldLabel: null, majorLabel: null, subfieldLabel: null, officialTargetCode: null, combinationCode: null, coefficientCode: null, coefficientAssignmentId: 'ca', admissionStatus: 'unknown', admissionRestriction: null, verification: 'draft', sourceIds: ['src.t'] }],
      coefficientAssignments: [{
        id: 'ca', eventVersionId: 'evv', examSetId: 'set.t', targetId: 'tg', coefficientCode: null, scope: 'exam_subject',
        values: [{ subjectId: 's1', value, valueState, evidence }],
        verification: 'draft', sourceIds: ['src.t'], note: null,
      }],
      componentCoefficients: [],
      subjectCourseMappings: [],
      selectionPolicies: [{ id: 'sp', eventVersionId: 'evv', examLevel: 'master', maxExamSetSelections: null, selectionLimitState: 'unknown', allowedRoles: ['primary'], allowSameSetMultipleTimes: false, status: 'draft', sourceIds: ['src.t'], note: null }],
    } as unknown as ExamModelBundle;
  }

  const MATRIX: Array<[number | null, 'positive' | 'zero' | 'unknown' | 'not_applicable', 'official_verified' | 'reported' | 'inferred' | 'pending_verification', boolean, string?]> = [
    // [value, valueState, evidence, valid?, expectedErrorCode?]
    [3, 'positive', 'official_verified', true],           // ضریب مثبت با مدرک رسمی
    [3, 'positive', 'reported', true],                    // ضریب مثبت گزارش‌شده
    [0, 'zero', 'official_verified', true],               // ضریب صفر رسمی
    [null, 'unknown', 'pending_verification', true],      // ضریب نامعلوم
    [null, 'not_applicable', 'official_verified', true],  // غیرقابل‌اعمال با مستند معتبر
    [0, 'zero', 'reported', true, 'zero_pending_official_evidence'],   // صفر بدون سند رسمی → هشدار، نه ارتقا
    [0, 'unknown', 'official_verified', false, 'unknown_has_value'],   // نامعلوم با مقدار
    [null, 'positive', 'official_verified', false, 'positive_state_mismatch'],
  ];

  for (const [value, valueState, evidence, valid, code] of MATRIX) {
    it(`ماتریس B4: ${valueState}+${evidence} با value=${value} → ${valid ? 'معتبر' : code}`, () => {
      const result = validateExamModelBundle(bundleWithValue(value, valueState, evidence));
      if (valid && !code) {
        expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
      } else if (valid && code) {
        expect(result.errors).toEqual([]);
        expect(result.warnings.some((w) => w.code === code), JSON.stringify(result.warnings)).toBe(true);
      } else {
        expect(result.errors.some((e) => e.code === code), JSON.stringify(result.errors)).toBe(true);
      }
    });
  }

  it('هیچ مقدار reported به‌طور ضمنی official_verified نمی‌شود', () => {
    const b = bundleWithValue(3, 'positive', undefined); // بدون evidence صریح
    const result = validateExamModelBundle(b);
    expect(result.errors).toEqual([]);
    // بردار draft است → شواهد مشتق‌شده باید pending_verification باشد، نه official_verified
    const v = (b.coefficientAssignments[0].values[0] as { evidence?: string });
    expect(v.evidence).toBeUndefined(); // داده دست‌نخورده — ارتقای خاموش در داده رخ نمی‌دهد
    expect(mapAssignmentVerificationToEvidence('draft')).toBe('pending_verification');
  });
});

describe('B5 — Unknown ≠ Zero در وزن‌دهی (۹ سناریوی الزامی)', () => {
  const T = (id: string, priority: number): TargetInfo => ({ targetId: id, priority });
  const R = (t: string, s: string, coefficient: number | null, state: TargetSubject['state']): TargetSubject =>
    ({ targetId: t, subjectId: s, coefficient, state });

  it('۱. تمام ضرایب مثبت: وزن محاسبه‌شده و ready', () => {
    const w = computeSubjectWeights(
      [R('t1', 'a', 3, 'official_positive')],
      [T('t1', 1)],
    );
    expect(w[0]).toMatchObject({ weight: 1, weightStatus: 'computed', planningStatus: 'ready' });
    expect(w[0].weight).not.toBeNull();
  });

  it('۲. درس با ضریب صفر رسمی: وزن ۰ واقعی است (صفر معلوم)، نه needs_review', () => {
    const w = computeSubjectWeights(
      [R('t1', 'a', 0, 'official_zero')],
      [T('t1', 1)],
    );
    expect(w[0].weight).toBe(0);
    expect(w[0].weightStatus).toBe('computed');
    expect(w[0].planningStatus).toBe('excluded');
    expect(w[0].flags).toContain('zero_coefficient:t1');
  });

  it('۳. درس با ضریب نامعلوم: وزن null و needs_review — هرگز صفر', () => {
    const w = computeSubjectWeights(
      [R('t1', 'a', null, 'unknown')],
      [T('t1', 1)],
    );
    expect(w[0].weight).toBeNull();
    expect(w[0].weightStatus).toBe('unknown');
    expect(w[0].planningStatus).toBe('needs_review');
    expect(w[0].servesTargets).toEqual([]);
    expect(w[0].flags).toContain('unknown_coefficient:t1');
  });

  it('۴. درس not_applicable: متمایز از unknown — excluded با پرچم مخصوص', () => {
    const w = computeSubjectWeights(
      [R('t1', 'a', null, 'not_applicable')],
      [T('t1', 1)],
    );
    expect(w[0].weightStatus).toBe('not_applicable');
    expect(w[0].planningStatus).toBe('excluded');
    expect(w[0].flags).toContain('not_applicable:t1');
    expect(w[0].flags).not.toContain('unknown_coefficient:t1');
  });

  it('۵. هدف اول معلوم، هدف دوم نامعلوم: وزن از هدف معلوم، planningStatus partial', () => {
    const w = computeSubjectWeights(
      [R('t1', 'a', 4, 'official_positive'), R('t2', 'a', null, 'unknown')],
      [T('t1', 1), T('t2', 0.5)],
    );
    expect(w[0].weightStatus).toBe('computed');
    expect(w[0].weight).not.toBeNull();
    expect(w[0].planningStatus).toBe('partial');
    expect(w[0].servesTargets).toEqual(['t1']);
    expect(w[0].flags).toContain('unknown_coefficient:t2');
  });

  it('۶. دو هدف با وضعیت ضرایب متفاوت: صفر رسمی یک هدف، مثبت هدف دیگر', () => {
    const w = computeSubjectWeights(
      [R('t1', 'a', 0, 'official_zero'), R('t2', 'a', 6, 'official_positive')],
      [T('t1', 1), T('t2', 1)],
    );
    // سهم مثبت فقط از t2؛ صفرِ t1 صفرِ معلوم است — نه نامعلوم، نه نقص داده
    expect(w[0].weight).toBe(1); // share=6/6=1 × priority 1
    expect(w[0].weightStatus).toBe('computed');
    expect(w[0].servesTargets).toEqual(['t2']);
    expect(w[0].flags).toContain('zero_coefficient:t1');
    expect(w[0].planningStatus).toBe('ready');
  });

  it('۷. تمام ضرایب یک هدف نامعلوم: وزن null، needs_review — درس حذف خاموش نمی‌شود', () => {
    const w = computeSubjectWeights(
      [R('t1', 'a', null, 'unknown'), R('t1', 'b', null, 'unknown')],
      [T('t1', 1)],
    );
    for (const item of w) {
      expect(item.weight).toBeNull();
      expect(item.planningStatus).toBe('needs_review');
      expect(item.weightStatus).toBe('unknown');
    }
  });

  it('۸. گزارش نهایی بین وزن محاسبه‌شده و وزن نامعلوم تمایز دارد', () => {
    const w = computeSubjectWeights(
      [R('t1', 'known', 5, 'official_positive'), R('t1', 'unknown-subj', null, 'unknown')],
      [T('t1', 1)],
    );
    const known = w.find((x) => x.subjectId === 'known')!;
    const unknown = w.find((x) => x.subjectId === 'unknown-subj')!;
    expect(known.weight).toBeGreaterThan(0);
    expect(known.weightStatus).toBe('computed');
    expect(unknown.weight).toBeNull();
    expect(unknown.weightStatus).toBe('unknown');
    // هیچ درسی با وزن unknown صفر گزارش نمی‌شود
    expect(w.filter((x) => x.weightStatus === 'unknown').every((x) => x.weight === null)).toBe(true);
  });

  it('۹. ضرایب هدف‌ها جمع نمی‌شوند — max با bump چندهدفه', () => {
    const w = computeSubjectWeights(
      [R('t1', 'a', 4, 'official_positive'), R('t2', 'a', 2, 'official_positive')],
      [T('t1', 1), T('t2', 1)],
    );
    // share t1 = 4/4=1؛ share t2 = 2/2=1؛ max=1؛ bump k=2 → ×1.2؛ جمعِ 1+1=2 ممنوع
    expect(w[0].weight).toBeCloseTo(1.2, 10);
  });
});
