import { describe, it, expect } from 'vitest';
import type { KnowledgeNode, Question } from '@ael/contracts';
import {
  QUARANTINE_HOLDOUT_YEAR,
  SUB_GROUP_TRACK_SCOPES,
  buildExamSessionPlan,
  scoreExamSession,
  ExamSimulationError,
  type ExamResponseInput,
} from '../src/exam-simulation';

const nodes: KnowledgeNode[] = [
  { id: 'en.vocab', track: 'common', course: 'زبان انگلیسی', chapter: 'واژگان', topic: 'collocations' },
  { id: 'en.cloze', track: 'common', course: 'زبان انگلیسی', chapter: 'درک مطلب', topic: 'cloze' },
  { id: 'mb.structure', track: 'common', course: 'مبانی سازمان و مدیریت', chapter: 'ساختار', topic: 'mechanistic' },
  { id: 'ind.or_simplex', track: 'industrial', course: 'مدیریت صنعتی و تحقیق در عملیات', chapter: 'سیمپلکس', topic: 'duality' },
  { id: 'mkt.plc', track: 'business', course: 'بازاریابی پیشرفته', chapter: 'چرخهٔ محصول', topic: 'plc' },
  { id: 'apt.verbal', track: 'common', course: 'استعداد تحصیلی', chapter: 'درک کلامی', topic: 'stems' },
];

const mk = (
  id: string,
  nodeId: string,
  correctOption: number,
  extra: Partial<Question> = {}
): Question => ({
  id,
  nodeId,
  text: `سؤال ${id}`,
  options: ['الف', 'ب', 'ج', 'د'],
  correctOption,
  ...extra,
});

/** مخزن دکتری: ۲ زبان + ۲ تخصصی صنعتی/مشترک + ۱ استعداد + سؤالاتِ باید حذف شوند */
const doctoratePool: Question[] = [
  mk('q-en-1', 'en.vocab', 0, { examLevel: 'doctorate', contentOrigin: 'official_booklet' }),
  mk('q-en-2', 'en.cloze', 1, { examLevel: 'doctorate', contentOrigin: 'official_booklet' }),
  mk('q-ind-1', 'ind.or_simplex', 2, { examLevel: 'doctorate', contentOrigin: 'official_booklet' }),
  mk('q-mb-1', 'mb.structure', 3, { examLevel: 'doctorate', contentOrigin: 'official_booklet' }),
  mk('q-apt-1', 'apt.verbal', 0, { examLevel: 'doctorate', contentOrigin: 'official_booklet' }),
  mk('q-biz-1', 'mkt.plc', 0, { examLevel: 'doctorate', contentOrigin: 'official_booklet' }),
  mk('q-1404', 'mb.structure', 0, {
    examYear: QUARANTINE_HOLDOUT_YEAR,
    examLevel: 'doctorate',
    contentOrigin: 'official_booklet',
  }),
  mk('q-master', 'mb.structure', 0, { examLevel: 'master', contentOrigin: 'official_booklet' }),
];

const attemptFactory = () => {
  let i = 0;
  return () => `att-${++i}`;
};

const buildDoctorate1405 = (questions = doctoratePool) =>
  buildExamSessionPlan({
    level: 'doctorate',
    examYear: 1405,
    subGroupId: 'industrial',
    questions,
    nodes,
    newAttemptId: attemptFactory(),
  });

describe('§8.7 ساختار رسمی جلسهٔ شبیه‌سازی', () => {
  it('ساختار ۱۴۰۵: بخش استعداد حذف می‌شود و فقط تخصصی و زبان با ضریبهای همان سال ساخته می‌شوند', () => {
    const plan = buildDoctorate1405();
    expect(plan.sections.map((s) => s.sectionId)).toEqual(['specialization', 'language']);
    const spec = plan.sections.find((s) => s.sectionId === 'specialization')!;
    const lang = plan.sections.find((s) => s.sectionId === 'language')!;
    expect(spec.coefficient).toBe(5); // ضریب تخصصی ۱۴۰۵
    expect(lang.coefficient).toBe(1);
    expect(spec.officialCountRange).toEqual({ min: 80, max: 90 });
    expect(spec.officialQuestionCount).toBe(90);
    expect(lang.officialQuestionCount).toBe(40);
    expect(plan.negativeMarkingRatio).toBeCloseTo(1 / 3, 10);
    expect(plan.durationMinutes).toBe(145); // ۱۰۵ + ۴۰
    expect(plan.timingVerified).toBe(true);
  });

  it('ترکیب رسمی دروس: کد ترکیب فقط از نگاشت همان زیرمجموعه پذیرفته می‌شود و تخصیص استخری اعلام می‌شود', () => {
    const plan = buildExamSessionPlan({
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'industrial',
      combinationCode: '3',
      questions: doctoratePool,
      nodes,
      newAttemptId: attemptFactory(),
    });
    expect(plan.combinationCode).toBe('3');
    expect(plan.subjects.length).toBeGreaterThan(0);
    expect(plan.subjectAllocation).toBe('pooled');
    expect(plan.disclosures.join('\n')).toContain('مشترک');

    expect(() =>
      buildExamSessionPlan({
        level: 'doctorate',
        examYear: 1405,
        subGroupId: 'business',
        combinationCode: '3',
        questions: doctoratePool,
        nodes,
        newAttemptId: attemptFactory(),
      })
    ).toThrow(ExamSimulationError);

    expect(() =>
      buildExamSessionPlan({
        level: 'doctorate',
        examYear: 1405,
        subGroupId: 'industrial',
        combinationCode: '8',
        questions: doctoratePool,
        nodes,
        newAttemptId: attemptFactory(),
      })
    ).toThrow(/کد ترکیب/);

    expect(buildDoctorate1405().combinationCode).toBeNull();
  });

  it('پوشش ناقص مخزن پنهان نمی‌شود؛ تعداد تخصیص‌یافته از تعداد رسمی کمتر است و افشا ثبت می‌شود', () => {
    const plan = buildDoctorate1405();
    expect(plan.allocatedTotalQuestions).toBeLessThan(plan.officialTotalQuestions!);
    expect(plan.coverageRatio!).toBeLessThan(1);
    expect(plan.disclosures.join('\n')).toContain('فقط');
    expect(plan.answerSheet).toHaveLength(plan.allocatedTotalQuestions);
    expect(plan.ticketRequests).toHaveLength(plan.allocatedTotalQuestions);
    for (const t of plan.ticketRequests) expect(t.attemptType).toBe('exam_simulation');
  });

  it('هر برگه فقط سؤال همان زیرمجموعه را می‌گیرد؛ درس‌های خارج از دامنهٔ تخصصی حذف می‌شوند', () => {
    const plan = buildDoctorate1405();
    const ids = plan.answerSheet.map((s) => s.questionId);
    expect(ids).not.toContain('q-biz-1'); // business در دامنهٔ industrial نیست
    expect(SUB_GROUP_TRACK_SCOPES.industrial).toEqual(['industrial', 'common']);
  });

  it('سؤال کارشناسی ارشد هرگز در برگهٔ دکتری نمی‌آید و قرنطینهٔ ۱۴۰۴ باز نمی‌شود', () => {
    const plan = buildDoctorate1405();
    const ids = plan.answerSheet.map((s) => s.questionId);
    expect(ids).not.toContain('q-master');
    expect(ids).not.toContain('q-1404');
    expect(plan.contentLevels).toContain('master');
    expect(plan.disclosures.join('\n')).toContain('سطح دیگر');
  });

  it('مخزن بدون برچسب محتوا «ساخته‌شده از دفترچهٔ رسمی» معرفی نمی‌شود', () => {
    const unlabeled = doctoratePool.map((q) => ({ ...q, examLevel: undefined, contentOrigin: undefined }));
    const plan = buildDoctorate1405(unlabeled);
    expect(plan.contentOfficiality).toBe('scaled_pool');
    expect(plan.disclosures.join('\n')).toContain('برچسب سطح آزمون ندارند');
    expect(plan.disclosures.join('\n')).toContain('سنجش آمادگی');
  });

  it('برچسب مبدأ سؤال‌ها به‌تنهایی بازسازی رسمی دفترچه را اثبات نمی‌کند', () => {
    const plan = buildDoctorate1405();
    expect(plan.contentOfficiality).toBe('scaled_pool');
  });

  it('سال ۱۴۰۳: استعداد ضریب دارد ولی تعدادش ثبت نشده — حدس زده نمی‌شود و زمان/جمع رسمی ناقص گزارش می‌شود', () => {
    const plan = buildExamSessionPlan({
      level: 'doctorate',
      examYear: 1403,
      subGroupId: 'industrial',
      questions: doctoratePool,
      nodes,
      newAttemptId: attemptFactory(),
    });
    expect(plan.sections.map((s) => s.sectionId)).toEqual(['specialization', 'language', 'aptitude']);
    const aptitude = plan.sections.find((s) => s.sectionId === 'aptitude')!;
    expect(aptitude.coefficient).toBe(1);
    expect(aptitude.officialQuestionCount).toBeNull();
    expect(aptitude.allocatedQuestionCount).toBe(0);
    expect(plan.officialTotalQuestions).toBeNull();
    expect(plan.durationMinutes).toBeNull();
    expect(plan.structureVerification).toBe('reported');
    expect(plan.disclosures.join('\n')).toContain('تعداد سؤالات «استعداد تحصیلی»');
  });

  it('برای ۱۴۰۶ جزئیات تأییدنشدهٔ ۱۴۰۵ را کپی نمی‌کند و نمرهٔ رسمی نمی‌سازد', () => {
    const plan = buildExamSessionPlan({
      level: 'doctorate',
      examYear: 1406,
      subGroupId: 'industrial',
      questions: doctoratePool,
      nodes,
      newAttemptId: attemptFactory(),
    });
    expect(plan.structureVerification).toBe('reported');
    expect(plan.officialTotalQuestions).toBeNull();
    expect(plan.coverageRatio).toBeNull();
    expect(plan.durationMinutes).toBeNull();
    expect(plan.timingVerified).toBe(false);
    expect(plan.negativeMarkingRatio).toBeNull();
    expect(plan.answerSheet).toHaveLength(0);
    const report = scoreExamSession(plan, doctoratePool, []);
    expect(report.weightedScore).toBeNull();
    expect(report.sections.every((section) => section.rawPercent === null)).toBe(true);
    expect(report.disclosures.join('\\n')).toContain('نمرهٔ وزنی رسمی محاسبه نمی‌شود');
  });

  it('سطح ارشد در سرور شبیه‌سازی نمی‌شود و دلیل صادقانهٔ کمبود محتوا برمی‌گردد', () => {
    expect(() =>
      buildExamSessionPlan({
        level: 'master',
        examYear: 1404,
        subGroupId: 'industrial',
        questions: doctoratePool,
        nodes,
        newAttemptId: attemptFactory(),
      })
    ).toThrowError(ExamSimulationError);
    try {
      buildExamSessionPlan({
        level: 'master',
        examYear: 1404,
        subGroupId: 'industrial',
        questions: [],
        nodes,
        newAttemptId: attemptFactory(),
      });
    } catch (err) {
      expect((err as Error).message).toContain('۱۱۴۲');
    }
  });

  it('عنوان و کد دو سطح هرگز یکی نیست', () => {
    const plan = buildDoctorate1405();
    expect(plan.pathTitle).toContain('دکتری');
    expect(plan.bookletCode).toBe('2162');
    expect(plan.pathTitle).not.toContain('ارشد');
  });

  it('مقیاس جلسه و ورودی نامعتبر: مقیاس خارج از (۰،۱] و زیرمجموعهٔ ناشناخته رد می‌شوند', () => {
    expect(() =>
      buildExamSessionPlan({
        level: 'doctorate',
        examYear: 1405,
        subGroupId: 'industrial',
        questions: doctoratePool,
        nodes,
        scale: 1.5,
        newAttemptId: attemptFactory(),
      })
    ).toThrowError(ExamSimulationError);
    expect(() =>
      buildExamSessionPlan({
        level: 'doctorate',
        examYear: 1405,
        subGroupId: 'nonexistent',
        questions: doctoratePool,
        nodes,
        newAttemptId: attemptFactory(),
      })
    ).toThrowError(ExamSimulationError);
  });

  it('تخصیص مقیاس‌شده سقف رسمی را نمی‌شکند و ترتیب برگه تکرارپذیر است', () => {
    const half = buildExamSessionPlan({
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'industrial',
      questions: doctoratePool,
      nodes,
      scale: 0.1,
      newAttemptId: attemptFactory(),
    });
    const lang = half.sections.find((s) => s.sectionId === 'language')!;
    expect(lang.allocatedQuestionCount).toBeLessThanOrEqual(4); // floor(40 × ۰٫۱)
    const again = buildExamSessionPlan({
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'industrial',
      questions: [...doctoratePool].reverse(),
      nodes,
      newAttemptId: attemptFactory(),
    });
    expect(again.answerSheet.map((s) => s.questionId)).toEqual(
      buildDoctorate1405().answerSheet.map((s) => s.questionId)
    );
  });

  it('ترتیب تصادفی تزریق‌شده تکرارپذیر و بدون سؤال تکراری است', () => {
    const make = (random: () => number) => buildExamSessionPlan({
      level: 'doctorate', examYear: 1405, subGroupId: 'industrial',
      questions: doctoratePool, nodes, newAttemptId: attemptFactory(), random,
    });
    const first = make(() => 0).answerSheet.map(slot => slot.questionId);
    const second = make(() => 0).answerSheet.map(slot => slot.questionId);
    const other = make(() => 0.999).answerSheet.map(slot => slot.questionId);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
    expect(first).not.toEqual(other);
    expect(() => make(() => 1)).toThrow(/تصادفی/);
  });
});

describe('§8.7 پوشش کامل ساختار رسمی', () => {
  it('وقتی مخزن ۹۰ تخصصی و ۴۰ زبان دارد، جلسه دقیقاً اندازهٔ دفترچهٔ ۱۴۰۵ است و اطمینان بالا می‌رود', () => {
    const fullNodes: KnowledgeNode[] = [
      ...Array.from({ length: 90 }, (_, i): KnowledgeNode => ({
        id: `spec.${i}`,
        track: 'industrial',
        course: 'تحقیق در عملیات پیشرفته',
        chapter: `فصل ${i}`,
        topic: `مبحث ${i}`,
      })),
      ...Array.from({ length: 40 }, (_, i): KnowledgeNode => ({
        id: `lang.${i}`,
        track: 'common',
        course: 'زبان انگلیسی',
        chapter: `بخش ${i}`,
        topic: `سؤال ${i}`,
      })),
    ];
    const fullPool: Question[] = [
      ...Array.from({ length: 90 }, (_, i) =>
        mk(`s${String(i).padStart(3, '0')}`, `spec.${i}`, i % 4, {
          examLevel: 'doctorate',
          contentOrigin: 'official_booklet',
        })
      ),
      ...Array.from({ length: 40 }, (_, i) =>
        mk(`l${String(i).padStart(3, '0')}`, `lang.${i}`, i % 4, {
          examLevel: 'doctorate',
          contentOrigin: 'official_booklet',
        })
      ),
    ];
    const plan = buildExamSessionPlan({
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'industrial',
      questions: fullPool,
      nodes: fullNodes,
      newAttemptId: attemptFactory(),
    });
    expect(plan.officialTotalQuestions).toBe(130);
    expect(plan.allocatedTotalQuestions).toBe(130);
    expect(plan.coverageRatio).toBe(1);
    expect(plan.durationMinutes).toBe(145);
    expect(plan.contentOfficiality).toBe('scaled_pool');
    expect(plan.answerSheet.filter((s) => s.sectionId === 'language')).toHaveLength(40);

    const report = scoreExamSession(
      plan,
      fullPool,
      fullPool.map((q) => ({ questionId: q.id, selectedOption: q.correctOption }))
    );
    expect(report.weightedScore).toBe(100);
    expect(report.coefficientCoverageRatio).toBe(1);
    expect(report.readinessConfidence).toBe(1);
    expect(report.confidenceLabel).toBe('high');
  });
});

describe('§8.7 نمره‌دهی رسمی جلسه', () => {
  const plan = buildDoctorate1405();
  const specIds = plan.answerSheet.filter((s) => s.sectionId === 'specialization').map((s) => s.questionId);
  const langIds = plan.answerSheet.filter((s) => s.sectionId === 'language').map((s) => s.questionId);

  const respond = (answers: [string | undefined, number | null][]): ExamResponseInput[] =>
    answers.flatMap(([questionId, selectedOption]) =>
      questionId ? [{ questionId, selectedOption }] : []
    );

  it('جریمهٔ پاسخ نادرست یک‌سوم است و پاسخ سفید جریمه ندارد', () => {
    // q-ind-1 صحیح=2، q-mb-1 صحیح=3، q-en-1 صحیح=0، q-en-2 صحیح=1
    const report = scoreExamSession(
      plan,
      doctoratePool,
      respond([
        [specIds[0], 2], // درست
        [specIds[1], 0], // غلط
        [langIds[0], null], // سفید
        [langIds[1], 1], // درست
      ])
    );
    const spec = report.sections.find((s) => s.sectionId === 'specialization')!;
    const lang = report.sections.find((s) => s.sectionId === 'language')!;
    expect(spec.correct).toBe(1);
    expect(spec.wrong).toBe(1);
    // netCorrect و rawPercent دو رقم اعشار گرد می‌شوند (قرارداد ARC-02 برای مقادیر پایدارسازی‌شده)
    expect(spec.netCorrect).toBe(0.67);
    expect(spec.rawPercent).toBe(33.33);
    expect(lang.unanswered).toBe(1);
    expect(lang.netCorrect).toBe(1);
    expect(lang.rawPercent).toBe(50);
  });

  it('همه نادرست ⇒ کف درصد بخش −۳۳٫۳ است نه کمتر', () => {
    const allWrong: ExamResponseInput[] = plan.answerSheet.map((s) => ({
      questionId: s.questionId,
      selectedOption: 0,
    }));
    const report = scoreExamSession(plan, doctoratePool.map((q) => ({ ...q, correctOption: 3 })), allWrong);
    for (const section of report.sections.filter((s) => s.allocated > 0)) {
      expect(section.rawPercent).toBeGreaterThanOrEqual(-100 / 3 - 1e-9);
    }
  });

  it('نمرهٔ کل میانگین وزنی بخش‌ها با ضریب همان سال است (تخصصی ۵، زبان ۱)', () => {
    const report = scoreExamSession(
      plan,
      doctoratePool,
      respond([
        [specIds[0], 2],
        [specIds[1], 3],
        [langIds[0], 0],
        [langIds[1], 1],
      ])
    );
    const spec = report.sections.find((s) => s.sectionId === 'specialization')!;
    const lang = report.sections.find((s) => s.sectionId === 'language')!;
    expect(spec.rawPercent).toBe(100);
    expect(lang.rawPercent).toBe(100);
    expect(report.weightedScore).toBeCloseTo((5 * 100 + 1 * 100) / 6, 5);
  });

  it('بخش بدون سؤال وزن رسمی‌اش را در پوشش ضریب‌ها کم می‌کند و اطمینان پایین می‌آید', () => {
    const noLanguage = doctoratePool.filter((q) => q.nodeId !== 'en.vocab' && q.nodeId !== 'en.cloze');
    const sparsePlan = buildExamSessionPlan({
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'industrial',
      questions: noLanguage,
      nodes,
      newAttemptId: attemptFactory(),
    });
    const report = scoreExamSession(sparsePlan, noLanguage, []);
    expect(sparsePlan.sections.some((s) => s.sectionId === 'language' && s.allocatedQuestionCount === 0)).toBe(
      true
    );
    expect(report.coefficientCoverageRatio).toBeLessThan(1);
    expect(report.readinessConfidence).toBeLessThan(0.6);
    expect(report.confidenceLabel).toBe('low');
    expect(report.disclosures.join('\n')).toContain('هیچ سؤال «زبان انگلیسی»');
  });

  it('سؤال گم‌شده از مخزن سفید محاسبه و صریح افشا می‌شود', () => {
    const missing = scoreExamSession(
      plan,
      doctoratePool.filter((q) => q.id !== specIds[0]),
      []
    );
    expect(missing.disclosures.join('\n')).toContain('سفید محاسبه شد');
    const spec = missing.sections.find((s) => s.sectionId === 'specialization')!;
    expect(spec.unanswered).toBe(2);
  });

  it('اطمینان گزارش سقف دارد و برچسب ساختار reported آن را پایین می‌آورد', () => {
    const perfect = scoreExamSession(
      plan,
      doctoratePool,
      plan.answerSheet.map((s) => ({
        questionId: s.questionId,
        selectedOption: doctoratePool.find((x) => x.id === s.questionId)!.correctOption,
      }))
    );
    expect(perfect.readinessConfidence).toBeLessThanOrEqual(1);
    const reported = buildExamSessionPlan({
      level: 'doctorate',
      examYear: 1403,
      subGroupId: 'industrial',
      questions: doctoratePool,
      nodes,
      newAttemptId: attemptFactory(),
    });
    const reportedReport = scoreExamSession(reported, doctoratePool, []);
    expect(reported.structureVerification).toBe('reported');
    expect(reportedReport.readinessConfidence).toBeLessThan(perfect.readinessConfidence);
  });
});
