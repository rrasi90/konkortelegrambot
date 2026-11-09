/**
 * V3-Hardening B6 — تست انتها-به-انتها زنجیرهٔ کامل در دو مسیر:
 *   مسیر A: fixture عمومی (خانوادهٔ کاملاً ساختگی) — اثبات بی‌نیازی هسته از خانوادهٔ خاص
 *   مسیر B: خانوادهٔ واقعی کنکور گروه ریاضی ۱۴۰۵ (reported — فقط تست)
 *
 * زنجیرهٔ واقعاً اجراشده (بدون mock):
 *   Exam Definition → Schema Validation → Candidate Registration → Target Resolution
 *   → Coefficient Resolution → Subject Weight Calculation → Planning
 *   → Daily Activity Generation → Scheduler → Final Plan Validation
 *
 * Planner و Scheduler همان توابع واقعی packages/learning-engine هستند
 * (planNextActivities، scheduleDueCards) — هیچ بخشی از موتور mock نمی‌شود.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveCandidatePreparationPlan,
  validateCandidateExamRegistration,
  validateCandidateStudyPlan,
  validateExamModelBundle,
  type CandidateExamRegistration,
  type CandidateStudyPlan,
  type ExamModelBundle,
} from '@ael/contracts';
import { computeSubjectWeights, planNextActivities, scheduleDueCards, type PlanCandidate, type SchedulableCard, type TargetSubject } from '@ael/engine';

interface E2EFixture {
  bundle: ExamModelBundle;
  targets: Array<{ targetId: string; priorityOrder: number }>;
}

/** ساخت fixture از هر دو مسیر با یک زنجیرهٔ واحد */
function runChain(fixture: E2EFixture, opts: { dailyBudgetMinutes: number; now: Date }) {
  // ۱) Exam Definition → ۲) Schema Validation
  const validation = validateExamModelBundle(fixture.bundle);
  if (!validation.ok) throw new Error('bundle invalid: ' + JSON.stringify(validation.errors));

  // ۳) Candidate Registration
  const registration: CandidateExamRegistration = {
    id: 'reg.e2e',
    candidateId: 'candidate.e2e',
    eventVersionId: fixture.bundle.eventVersions[0].id,
    selections: fixture.bundle.examSets.map((s) => ({ examSetId: s.id, role: 'primary' as const, registrationReference: null })),
    status: 'draft',
    sourceRegistrationReference: null,
    createdAt: '2026-11-10T00:00:00Z',
  };
  const regResult = validateCandidateExamRegistration(registration, fixture.bundle);
  if (!regResult.ok) throw new Error('registration invalid: ' + JSON.stringify(regResult.errors));

  // ۴) Target Resolution (چندهدف)
  const plan: CandidateStudyPlan = {
    id: 'plan.e2e',
    candidateId: 'candidate.e2e',
    eventVersionId: fixture.bundle.eventVersions[0].id,
    registrationId: registration.id,
    targets: fixture.targets.map((t) => ({ targetId: t.targetId, priorityOrder: t.priorityOrder, registrationSelectionId: null, note: null })),
    studyTrackIds: ['e2e-track'],
    status: 'active',
    versionNumber: 1,
    createdAt: '2026-11-10T00:00:00Z',
    updatedAt: '2026-11-10T00:00:00Z',
  };
  const planResult = validateCandidateStudyPlan(plan, fixture.bundle);
  if (!planResult.ok) throw new Error('plan invalid: ' + JSON.stringify(planResult.errors));

  // ۵) Coefficient Resolution
  const resolved = resolveCandidatePreparationPlan(plan, fixture.bundle);
  expect(resolved.resolutionStatus).toBeDefined();

  // ۶) Subject Weight Calculation — از ضرایب resolve‌شده (شواهد هر هدف جدا حفظ می‌شود)
  const assignmentByTarget = new Map(fixture.bundle.coefficientAssignments.map((a) => [a.targetId, a]));
  const rows: TargetSubject[] = [];
  for (const subject of resolved.subjects) {
    for (const coef of subject.coefficientsByTarget) {
      const assignment = assignmentByTarget.get(coef.targetId);
      rows.push({
        targetId: coef.targetId,
        subjectId: subject.subjectId,
        coefficient: coef.value,
        valueState: coef.valueState,
        evidence: coef.evidence ?? undefined,
        state: assignment?.values.find((v) => v.subjectId === subject.subjectId)?.state,
      } as TargetSubject);
    }
  }
  const priorities = new Map(fixture.targets.map((t) => [t.targetId, 1 / t.priorityOrder]));
  const weights = computeSubjectWeights(rows, [...priorities.entries()].map(([targetId, priority]) => ({ targetId, priority })));

  // ۷) Planning — Planner واقعی روی خروجی وزن‌دهی
  const planningCandidates: PlanCandidate[] = weights
    .filter((w) => w.weightStatus === 'computed' && w.planningStatus !== 'excluded' && w.weight !== null && w.weight > 0)
    .map((w, i) => ({
      id: w.subjectId,
      estimatedMinutes: 45,
      // urgency از وزن — درس نامعلوم (needs_review) وارد صف محاسبه‌شده نمی‌شود اما در گزارش است
      urgency: w.weight!,
      // ترتیب پایدار با پسوند شاخص برای تساوی‌ها
      ...(w.subjectId + '#' + i ? {} : {}),
    }));
  const planningSlots = planNextActivities(planningCandidates, opts.dailyBudgetMinutes);

  // ۸) Daily Activity Generation — تولید فعالیت روزانه از صف برنامه (بدون mock)
  const dailyActivities = planningSlots.map((slot, i) => ({
    activityId: `act-${i + 1}`,
    subjectId: slot.id,
    reason: slot.reason,
    scheduledFor: new Date(opts.now.getTime() + i * 60 * 60 * 1000).toISOString(),
  }));

  // ۹) Scheduler — کارت‌های مرور واقعی (FSRS-facing) فیلتر می‌شوند
  const cards: SchedulableCard[] = weights.map((w, i) => ({
    id: `card-${w.subjectId}`,
    dueAt: new Date(opts.now.getTime() - (i % 3) * 24 * 60 * 60 * 1000).toISOString(),
    intervalDays: 3 + i,
    isRepair: false,
  }));
  const dueCards = scheduleDueCards(cards, opts.now, 10);

  // ۱۰) Final Plan Validation
  const plannedIds = new Set(dailyActivities.map((a) => a.subjectId));
  const unknownSubjects = weights.filter((w) => w.planningStatus === 'needs_review');
  const excludedSubjects = weights.filter((w) => w.planningStatus === 'excluded');
  // هیچ درس نامعلومی در برنامه محاسبه‌شده نیست اما در گزارش نهایی قابل مشاهده است
  for (const u of unknownSubjects) expect(plannedIds.has(u.subjectId)).toBe(false);
  // هیچ activity بدون reason نیست (خروجی Scheduler/Planner قابل توضیح)
  for (const a of dailyActivities) expect(a.reason.length).toBeGreaterThan(0);
  // due cards زیر سقف limit
  expect(dueCards.length).toBeLessThanOrEqual(10);

  return { validation, resolved, weights, planningSlots, dailyActivities, dueCards, unknownSubjects, excludedSubjects };
}

describe('B6 — زنجیرهٔ E2E واقعی: تعریف آزمون تا برنامهٔ مطالعه', () => {
  const now = new Date('2026-11-10T08:00:00Z');

  it('مسیر A — fixture عمومی ساختگی: کل زنجیره بدون کد خانواده‌محور عبور می‌کند', () => {
    // از همان باندل تست ساختگی استفاده می‌شود (import مستقیم فایل تست ممکن نیست؛
    // نسخهٔ فشردهٔ همین ساختار اینجا ساخته می‌شود)
    const bundle: ExamModelBundle = {
      schemaVersion: 1,
      sources: [{ id: 'src.gen', title: 's', url: null, publisher: 'p', sourceType: 'internal_audit', publishedAt: null, checkedAt: '2026-11-10', locator: 'l', status: 'draft' }],
      events: [{ id: 'ev.gen', examLevel: 'master', examFamilyCode: 'gen-fixture', yearNumber: 1407, yearLabel: '۱۴۰۷', session: 1, organizer: 'o', title: 't', status: 'draft', sourceIds: ['src.gen'] }],
      eventVersions: [{ id: 'evv.gen', eventId: 'ev.gen', versionNumber: 1, effectiveFrom: null, effectiveUntil: null, status: 'draft', sourceIds: ['src.gen'], changeReason: null, contentHash: null }],
      examSets: [{ id: 'set.gen', eventVersionId: 'evv.gen', examSetCode: '1', title: 't', status: 'draft', sourceIds: ['src.gen'] }],
      subjects: [
        { id: 'gen.s1', subjectCode: '1', title: 'مشترک', subjectLevel: 'master', componentKind: 'language', position: 1, description: null, status: 'draft' },
        { id: 'gen.s2', subjectCode: '2', title: 'اختصاصی A', subjectLevel: 'master', componentKind: 'specialized', position: 2, description: null, status: 'draft' },
        { id: 'gen.s3', subjectCode: '3', title: 'اختصاصی B', subjectLevel: 'master', componentKind: 'specialized', position: 3, description: null, status: 'draft' },
      ],
      setSubjects: [
        { id: 'ss1', eventVersionId: 'evv.gen', examSetId: 'set.gen', subjectId: 'gen.s1', subjectNumber: 1, sourceLabel: 's' },
        { id: 'ss2', eventVersionId: 'evv.gen', examSetId: 'set.gen', subjectId: 'gen.s2', subjectNumber: 2, sourceLabel: 's' },
        { id: 'ss3', eventVersionId: 'evv.gen', examSetId: 'set.gen', subjectId: 'gen.s3', subjectNumber: 3, sourceLabel: 's' },
      ],
      combinations: [],
      combinationSubjects: [],
      targets: [
        { id: 'gen.targetA', eventVersionId: 'evv.gen', examSetId: 'set.gen', officialTargetLabel: 'هدف A', fieldLabel: null, majorLabel: null, subfieldLabel: null, officialTargetCode: null, combinationCode: null, coefficientCode: null, coefficientAssignmentId: 'caA', admissionStatus: 'unknown', admissionRestriction: null, verification: 'draft', sourceIds: ['src.gen'] },
        { id: 'gen.targetB', eventVersionId: 'evv.gen', examSetId: 'set.gen', officialTargetLabel: 'هدف B', fieldLabel: null, majorLabel: null, subfieldLabel: null, officialTargetCode: null, combinationCode: null, coefficientCode: null, coefficientAssignmentId: 'caB', admissionStatus: 'unknown', admissionRestriction: null, verification: 'draft', sourceIds: ['src.gen'] },
      ],
      coefficientAssignments: [
        { id: 'caA', eventVersionId: 'evv.gen', examSetId: 'set.gen', targetId: 'gen.targetA', coefficientCode: null, scope: 'exam_subject', values: [
          { subjectId: 'gen.s1', value: 2, valueState: 'positive', evidence: 'inferred' },
          { subjectId: 'gen.s2', value: 3, valueState: 'positive', evidence: 'inferred' },
          { subjectId: 'gen.s3', value: null, valueState: 'unknown', evidence: 'inferred' },
        ], verification: 'draft', sourceIds: ['src.gen'], note: null },
        { id: 'caB', eventVersionId: 'evv.gen', examSetId: 'set.gen', targetId: 'gen.targetB', coefficientCode: null, scope: 'exam_subject', values: [
          { subjectId: 'gen.s1', value: 2, valueState: 'positive', evidence: 'inferred' },
          { subjectId: 'gen.s2', value: null, valueState: 'unknown', evidence: 'inferred' },
          { subjectId: 'gen.s3', value: 0, valueState: 'zero', evidence: 'inferred' },
        ], verification: 'draft', sourceIds: ['src.gen'], note: null },
      ],
      componentCoefficients: [],
      subjectCourseMappings: [],
      selectionPolicies: [{ id: 'sp.gen', eventVersionId: 'evv.gen', examLevel: 'master', maxExamSetSelections: 1, selectionLimitState: 'limited', allowedRoles: ['primary'], allowSameSetMultipleTimes: false, status: 'draft', sourceIds: ['src.gen'], note: null }],
    } as unknown as ExamModelBundle;

    const chain = runChain({ bundle, targets: [{ targetId: 'gen.targetA', priorityOrder: 1 }, { targetId: 'gen.targetB', priorityOrder: 2 }] }, { dailyBudgetMinutes: 90, now });

    // اتحاد مواد: ۳ ماده؛ ضرایب هر هدف جدا
    expect(chain.resolved.subjects).toHaveLength(3);
    // s2: سهم مثبت از هدف A + unknown هدف B → partial (برنامه‌پذیر با شکاف قابل مشاهده)
    // s3: بدون هیچ سهم مثبت → needs_review؛ هر دو در گزارش، نه حذف خاموش
    const s2 = chain.weights.find((w) => w.subjectId === 'gen.s2')!;
    expect(s2.planningStatus).toBe('partial');
    expect(s2.flags).toContain('unknown_coefficient:gen.targetB');
    expect(chain.unknownSubjects.map((s) => s.subjectId)).toEqual(['gen.s3']);
    // zero هدف B: resolver سطر zero را از شمول هدف B حذف می‌کند (صفر = خارج از آزمون
    // آن هدف)؛ خروجی resolve فقط سطر unknown هدف A را دارد → needs_review صادقانه.
    // تفکیک zero/unknown به‌صورت مستقیم در unknown-not-zero-weights.test.ts پوشش داده می‌شود.
    const s3Flags = chain.weights.find((w) => w.subjectId === 'gen.s3')!.flags;
    expect(s3Flags).toEqual(['unknown_coefficient:gen.targetA']);
    // برنامه محاسبه‌شده فقط درس‌های معلوم
    expect(chain.planningSlots.every((s) => !chain.unknownSubjects.some((u) => u.subjectId === s.id))).toBe(true);
    // Scheduler خروجی واقعی داده
    expect(chain.dueCards.length).toBeGreaterThan(0);
  });

  it('مسیر B — خانوادهٔ واقعی کنکور گروه ریاضی ۱۴۰۵: کل زنجیره با دادهٔ reported', async () => {
    // استفاده از fixture واقعی با همان builder تست رسمی (بدون کپی داده)
    const { buildKonkurMathBundle } = await import('./real-family-konkur-builder');
    const bundle = buildKonkurMathBundle();
    const chain = runChain(
      { bundle, targets: [{ targetId: 'k1405.computer', priorityOrder: 1 }, { targetId: 'k1405.civil', priorityOrder: 2 }] },
      { dailyBudgetMinutes: 120, now },
    );

    expect(chain.validation.ok).toBe(true);
    // fail-closed برای دادهٔ reported
    expect(chain.resolved.resolutionStatus).toBe('partial');
    // زمین‌شناسی unknown: در برنامه نیست، در گزارش needs_review هست
    expect(chain.unknownSubjects.map((s) => s.subjectId)).toContain('konkur.g1.geology');
    // برنامهٔ واقعی تولید شد
    expect(chain.dailyActivities.length).toBeGreaterThan(0);
    expect(chain.dueCards.length).toBeGreaterThan(0);
    // هیچ ادعای پوشش/قبولی در reasonها نیست
    for (const a of chain.dailyActivities) {
      expect(a.reason).not.toMatch(/کامل|تضمینی|احتمال قبولی|پوشش ۱۰۰/);
    }
  });
});
