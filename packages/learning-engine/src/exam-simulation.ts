/**
 * شبیه‌ساز آزمون — ساخت جلسه منطبق بر ساختار رسمی و نمره‌دهی رسمی
 * ------------------------------------------------------------------
 * مرجع ساختار: @ael/contracts (exam-structure). این ماژول هیچ عددِ ساختاری
 * را خودش نمی‌سازد؛ فقط ساختار همان سال را با مخزن سؤالِ سرور تطبیق می‌دهد و
 * کمبود پوشش را صریح اعلام می‌کند.
 */
import type {
  ExamLevel,
  ExamSubject,
  ExamYearStructure,
  KnowledgeNode,
  Question,
  TrackId,
} from '@ael/contracts';
import {
  getCombinationsForSubGroup,
  getExamPath,
  getExamStructure,
  getExamStructureWarnings,
  getSubGroup,
  getSubGroupSubjects,
} from '@ael/contracts';

export class ExamSimulationError extends Error {}

/** قرنطینهٔ ۱۴۰۴: این سال فقط از مسیر اثبات تسلط باز می‌شود، نه شبیه‌سازی. */
export const QUARANTINE_HOLDOUT_YEAR = 1404;

export const EXAM_SECTION_IDS = ['specialization', 'language', 'aptitude'] as const;
export type ExamSectionId = (typeof EXAM_SECTION_IDS)[number];

/**
 * دامنهٔ دروس تخصصی هر زیرمجموعه روی گره‌های دانش.
 * این نگاشت از سمت محصول است (نه سند رسمی) و تا برچسب‌گذاری سؤالات بر پایهٔ
 * عنوان درسِ رسمی، verification آن needs_check باقی می‌ماند.
 */
export const SUB_GROUP_TRACK_SCOPES: Record<string, TrackId[]> = {
  business: ['business', 'common'],
  public: ['common'],
  industrial: ['industrial', 'common'],
  media: ['technology', 'common'],
  technology: ['technology', 'common'],
  foresight: ['strategy', 'common'],
  stpolicy: ['strategy', 'common'],
};

/** مسیرهای درس‌های جداگانهٔ دفترچه بر پایهٔ عنوان درس گرهٔ دانش. */
export const SECTION_ROUTING_RULES = {
  languageCourseKeywords: ['زبان'],
  aptitudeCourseKeywords: ['استعداد تحصیلی'],
};

export function sectionOfNode(node: KnowledgeNode | undefined): ExamSectionId | null {
  if (!node) return null;
  const course = node.course ?? '';
  if (SECTION_ROUTING_RULES.languageCourseKeywords.some((k) => course.includes(k))) return 'language';
  if (SECTION_ROUTING_RULES.aptitudeCourseKeywords.some((k) => course.includes(k))) return 'aptitude';
  return 'specialization';
}

export interface ExamSessionSlot {
  /** شمارهٔ سؤال در برگهٔ پاسخ همین بخش */
  questionNumber: number;
  sectionId: ExamSectionId;
  questionId: string;
  attemptId: string;
}

export interface ExamSectionPlan {
  sectionId: ExamSectionId;
  title: string;
  coefficient: number;
  /** سقف تعداد رسمی همان سال؛ null یعنی در ساختار رسمی این سال ثبت نشده است */
  officialQuestionCount: number | null;
  /** بازهٔ رسمی تعداد، وقتی دفترچه بازه‌ای اعلام کرده است */
  officialCountRange: { min: number; max: number } | null;
  durationMinutes: number | null;
  /** اندازهٔ مخزنِ قابل استفاده برای همین بخش */
  poolSize: number;
  allocatedQuestionCount: number;
  coverageRatio: number | null;
}

export type ContentOfficiality = 'official_booklet' | 'scaled_pool' | 'mixed';

export interface ExamSessionPlan {
  level: ExamLevel;
  examYear: number;
  subGroupId: string;
  /** کد ترکیب رسمی انتخاب‌شدهٔ همان زیرمجموعه؛ null یعنی کاربر ترکیبی انتخاب نکرده است */
  combinationCode: string | null;
  /** دروس تخصصی رسمی همین زیرمجموعه (از دفترچهٔ همان سال) */
  subjects: ExamSubject[];
  /**
   * تخصیص سؤال بین دروس تخصصی فقط استخری است، چون تعداد رسمی سؤال هر درس
   * در ساختار سالانه ثبت نشده و حدس زده نمی‌شود.
   */
  subjectAllocation: 'pooled';
  /** عنوان رسمی مسیر — با عنوان سطح دیگر هرگز یکسان نمی‌شود */
  pathTitle: string;
  bookletCode: string;
  structureVerification: ExamYearStructure['verification'];
  negativeMarkingRatio: number;
  sections: ExamSectionPlan[];
  officialTotalQuestions: number | null;
  allocatedTotalQuestions: number;
  coverageRatio: number | null;
  durationMinutes: number | null;
  timingVerified: boolean;
  answerSheet: ExamSessionSlot[];
  contentOfficiality: ContentOfficiality;
  contentOrigins: string[];
  contentLevels: string[];
  disclosures: string[];
  warnings: string[];
  ticketRequests: { attemptId: string; questionId: string; attemptType: 'exam_simulation' }[];
}

export interface BuildExamSessionPlanInput {
  level: ExamLevel;
  examYear: number;
  subGroupId: string;
  /** کد ترکیب رسمی ۱ تا ۷؛ باید به همین زیرمجموعه نگاشت شده باشد */
  combinationCode?: string;
  questions: Question[];
  nodes: KnowledgeNode[];
  /** نسبت مقیاس‌دهی به تعداد رسمی (۰ تا ۱]. پیش‌فرض ۱ = تلاش برای تکمیل ساختار رسمی */
  scale?: number;
  /** سازندهٔ شناسهٔ تلاش — سمت سرور؛ موتور هیچ شناسه‌ای از خود نمی‌سازد */
  newAttemptId: () => string;
}

function coefficientForSection(structure: ExamYearStructure, sectionId: ExamSectionId): number {
  if (sectionId === 'language') return structure.languageCoefficient;
  if (sectionId === 'aptitude') return structure.aptitudeCoefficient ?? 0;
  return structure.specializationCoefficient;
}

function officialCountForSection(
  structure: ExamYearStructure,
  sectionId: ExamSectionId
): { count: number | null; range: { min: number; max: number } | null } {
  if (sectionId === 'language') {
    return { count: structure.languageQuestionCount, range: null };
  }
  if (sectionId === 'specialization') {
    const range = structure.specializationQuestionCount;
    return { count: range?.max ?? null, range };
  }
  // تعداد رسمی استعداد تحصیلی در ساختار نسخه‌بندی‌شده ثبت نشده است؛ حدس نمی‌زنیم.
  return { count: null, range: null };
}

function durationForSection(
  structure: ExamYearStructure,
  sectionId: ExamSectionId
): number | null {
  if (sectionId === 'language') return structure.durationMinutes.language;
  if (sectionId === 'specialization') return structure.durationMinutes.specialization;
  return null;
}

export function buildExamSessionPlan(input: BuildExamSessionPlanInput): ExamSessionPlan {
  const path = getExamPath(input.level);
  if (path.serverSimulation !== 'available') {
    throw new ExamSimulationError(
      path.serverSimulationReason ?? `شبیه‌ساز سرور برای سطح «${input.level}» ساخته نمی‌شود.`
    );
  }
  const structure = getExamStructure(input.level, input.examYear);
  if (structure.setCode !== path.bookletCode) {
    throw new ExamSimulationError(
      `کد مجموعهٔ ساختار (${structure.setCode}) با کد مسیر (${path.bookletCode}) نمی‌خواند.`
    );
  }
  if (!getSubGroup(input.subGroupId)) {
    throw new ExamSimulationError(`زیرمجموعهٔ «${input.subGroupId}» در مدل آزمون ثبت نشده است.`);
  }
  const combinationCode = input.combinationCode ?? null;
  if (combinationCode !== null) {
    const allowedCombinations = getCombinationsForSubGroup(input.subGroupId);
    if (!allowedCombinations.some((combo) => combo.combinationCode === combinationCode)) {
      throw new ExamSimulationError(
        `کد ترکیب «${combinationCode}» برای زیرمجموعهٔ «${input.subGroupId}» در دفترچهٔ رسمی ثبت نشده است.`
      );
    }
  }
  const scale = input.scale ?? 1;
  if (!(scale > 0 && scale <= 1)) {
    throw new ExamSimulationError('مقیاس جلسه باید در بازهٔ (۰، ۱] باشد.');
  }

  const nodeById = new Map(input.nodes.map((n) => [n.id, n]));
  const allowedTracks = new Set(SUB_GROUP_TRACK_SCOPES[input.subGroupId] ?? []);
  const disclosures: string[] = [];
  const warnings: string[] = [...getExamStructureWarnings(input.level, input.examYear)];

  // سطح و مبدأ محتوا از خودِ سؤال‌ها خوانده می‌شود؛ ادعای «دفترچهٔ رسمی» بدون برچسب محتوایی ساخته نمی‌شود.
  const origins = new Set<string>();
  const levels = new Set<string>();
  const eligible = input.questions.filter((q) => {
    if (q.examYear === QUARANTINE_HOLDOUT_YEAR) return false;
    if (q.examLevel && q.examLevel !== input.level) {
      levels.add(q.examLevel);
      return false;
    }
    if (!q.examLevel) {
      levels.add('unlabeled');
      return true;
    }
    origins.add(q.contentOrigin ?? 'unlabeled');
    return true;
  });

  const buckets: Record<ExamSectionId, Question[]> = {
    specialization: [],
    language: [],
    aptitude: [],
  };
  for (const q of eligible) {
    const node = nodeById.get(q.nodeId);
    if (!node) continue;
    const section = sectionOfNode(node);
    if (!section) continue;
    if (section === 'specialization' && !allowedTracks.has(node.track)) continue;
    buckets[section].push(q);
  }
  // ترتیب پایدار: انتخاب جلسه باید تکرارپذیر باشد
  for (const list of Object.values(buckets)) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const sections: ExamSectionPlan[] = [];
  const answerSheet: ExamSessionSlot[] = [];
  const ticketRequests: ExamSessionPlan['ticketRequests'] = [];
  let officialTotal = 0;
  let officialKnown = true;
  let allocatedTotal = 0;
  let durationTotal = 0;
  let timingVerified = true;

  const subjects = getSubGroupSubjects(input.subGroupId).map((s) => ({
    id: s.id,
    title: s.title,
    level: s.level,
    coefficient: s.coefficient,
  }));
  const subjectTitles = subjects.map((s) => s.title);
  const sectionTitles: Record<ExamSectionId, string> = {
    specialization: `دروس تخصصی (${subjectTitles.length} درس)`,
    language: 'زبان انگلیسی',
    aptitude: 'استعداد تحصیلی',
  };
  disclosures.push(
    'سؤال‌های دروس تخصصی به‌صورت مشترک از کل دروس همین زیرمجموعه انتخاب می‌شوند؛ ' +
      'تعداد رسمی سؤال هر درس در ساختار سالانه ثبت نشده است و سهم ساختگی برای هر درس اعمال نمی‌شود.'
  );

  for (const sectionId of EXAM_SECTION_IDS) {
    const coefficient = coefficientForSection(structure, sectionId);
    const { count, range } = officialCountForSection(structure, sectionId);
    const durationMinutes = durationForSection(structure, sectionId);
    const pool = buckets[sectionId];

    if (coefficient <= 0) {
      // درس در این سال حذف شده است (مثلاً استعداد تحصیلی از ۱۴۰۵) — بخش نمی‌سازیم
      continue;
    }

    const target = count === null ? 0 : Math.max(0, Math.floor(count * scale));
    const allocated = Math.min(pool.length, target);
    if (count === null) {
      officialKnown = false;
      disclosures.push(
        `تعداد سؤالات «${sectionTitles[sectionId]}» در ساختار رسمی این سال ثبت نشده است؛ ` +
          'این بخش حدس زده نمی‌شود و نمرهٔ جلسه ناقصِ همان بخش گزارش می‌گردد.'
      );
    } else officialTotal += count;
    allocatedTotal += allocated;

    if (durationMinutes === null) timingVerified = false;
    else durationTotal += durationMinutes;

    if (allocated > 0) {
      pool.slice(0, allocated).forEach((q, i) => {
        const slot: ExamSessionSlot = {
          questionNumber: i + 1,
          sectionId,
          questionId: q.id,
          attemptId: input.newAttemptId(),
        };
        answerSheet.push(slot);
        ticketRequests.push({ attemptId: slot.attemptId, questionId: slot.questionId, attemptType: 'exam_simulation' });
      });
    }

    if (allocated < target) {
      disclosures.push(
        `بخش «${sectionTitles[sectionId]}» از ${target} سؤالِ هدف (ساختار رسمی ${
          range ? `${range.min}–${range.max}` : count
        }) فقط ${allocated} سؤالِ موجود در مخزن تأییدشده دارد.`
      );
    }
    if (allocated === 0 && pool.length === 0) {
      disclosures.push(
        `مخزن سرور هیچ سؤال «${sectionTitles[sectionId]}» ندارد؛ ضریب ${coefficient} این بخش در نمرهٔ وزنی لحاظ نمی‌شود.`
      );
    }

    sections.push({
      sectionId,
      title: sectionTitles[sectionId],
      coefficient,
      officialQuestionCount: count,
      officialCountRange: range,
      durationMinutes,
      poolSize: pool.length,
      allocatedQuestionCount: allocated,
      coverageRatio: count && count > 0 ? allocated / count : null,
    });
  }

  const originList = [...origins];
  const hasUnlabeled = levels.has('unlabeled');
  const otherLevels = [...levels].filter((l) => l !== 'unlabeled');
  const officialOriginCount = originList.filter((o) => o === 'official_booklet').length;
  const contentOfficiality: ContentOfficiality =
    officialOriginCount > 0 && (officialOriginCount < originList.length || hasUnlabeled)
      ? 'mixed'
      : officialOriginCount > 0
        ? 'official_booklet'
        : 'scaled_pool';

  if (hasUnlabeled) {
    disclosures.push(
      'برخی سؤال‌های مخزن برچسب سطح آزمون ندارند؛ این جلسه «ساخته‌شده از دفترچهٔ رسمی» معرفی نمی‌شود.'
    );
  }
  if (otherLevels.length > 0) {
    disclosures.push(
      `سؤال‌های سطح دیگر (${otherLevels.join('، ')}) از مخزن این جلسه حذف شدند — هرگز سؤالی از سطح دیگر در برگهٔ این سطح نمی‌آید.`
    );
  }
  if (contentOfficiality !== 'official_booklet') {
    disclosures.push(
      'محتوای این جلسه از سؤال‌های واقعی دفترچهٔ همان سال نیست' +
        (originList.length > 0 ? ` (مبدأ محتوا: ${originList.join('، ')})` : '') +
        '؛ نمرهٔ آن سنجش آمادگی است، نه پیش‌بینی رتبه یا کارنامهٔ رسمی.'
    );
  }
  if (!timingVerified) {
    disclosures.push(
      'زمان هر بخش برای این سال در ساختار رسمی ثبت نشده است؛ فقط جمع زمان‌های معلوم اعلام می‌گردد و جلسه زمان‌بندی‌شدهٔ رسمی محسوب نمی‌شود.'
    );
  }

  return {
    level: input.level,
    examYear: structure.year,
    subGroupId: input.subGroupId,
    combinationCode,
    subjects,
    subjectAllocation: 'pooled',
    pathTitle: path.title,
    bookletCode: path.bookletCode,
    structureVerification: structure.verification,
    negativeMarkingRatio: structure.negativeMarkingRatio,
    sections,
    officialTotalQuestions: officialKnown ? officialTotal : null,
    allocatedTotalQuestions: answerSheet.length,
    coverageRatio: officialTotal > 0 ? allocatedTotal / officialTotal : null,
    durationMinutes: timingVerified && durationTotal > 0 ? durationTotal : null,
    timingVerified,
    answerSheet,
    contentOfficiality,
    contentOrigins: [...origins].sort(),
    contentLevels: [...levels].sort(),
    disclosures,
    warnings,
    ticketRequests,
  };
}

/* ------------------------------------------------------------------ */
/* نمره‌دهی رسمی                                                       */
/* ------------------------------------------------------------------ */

export interface ExamResponseInput {
  questionId: string;
  /** null = پاسخ داده نشده (برگهٔ سفید) */
  selectedOption: number | null;
}

export interface ExamSectionScore {
  sectionId: ExamSectionId;
  title: string;
  coefficient: number;
  allocated: number;
  answered: number;
  correct: number;
  wrong: number;
  unanswered: number;
  /** درست − نسبت جریمه × نادرست */
  netCorrect: number;
  rawPercent: number;
  weight: number;
}

export interface ExamSessionReport {
  level: ExamLevel;
  examYear: number;
  subGroupId: string;
  pathTitle: string;
  bookletCode: string;
  negativeMarkingRatio: number;
  sections: ExamSectionScore[];
  /** میانگین وزنیِ درصد بخش‌ها با ضریب‌های همان سال */
  weightedScore: number;
  /** سهم ضریب بخش‌هایی که سؤال داشته‌اند از کل ضریب‌های رسمی */
  coefficientCoverageRatio: number;
  coverageRatio: number | null;
  /** اطمینان سنجش، نه پیش‌بینی رتبه */
  readinessConfidence: number;
  confidenceLabel: 'low' | 'medium' | 'high';
  answeredQuestions: number;
  officiality: ContentOfficiality;
  disclosures: string[];
}

const VERIFICATION_CONFIDENCE_FACTOR: Record<ExamYearStructure['verification'], number> = {
  official_verified: 1,
  reported: 0.85,
  needs_check: 0.7,
};

export function scoreExamSession(
  plan: ExamSessionPlan,
  pool: Question[],
  responses: ExamResponseInput[]
): ExamSessionReport {
  const byQuestionId = new Map(pool.map((q) => [q.id, q]));
  const responseByQuestionId = new Map(responses.map((r) => [r.questionId, r]));
  const disclosures: string[] = [...plan.disclosures];

  const sectionScores: ExamSectionScore[] = [];
  for (const section of plan.sections) {
    const slots = plan.answerSheet.filter((s) => s.sectionId === section.sectionId);
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    const stray: string[] = [];
    for (const slot of slots) {
      const question = byQuestionId.get(slot.questionId);
      if (!question) {
        stray.push(slot.questionId);
        unanswered++;
        continue;
      }
      const response = responseByQuestionId.get(slot.questionId);
      if (!response || response.selectedOption === null) {
        unanswered++;
        continue;
      }
      if (response.selectedOption === question.correctOption) correct++;
      else wrong++;
    }
    if (stray.length > 0) {
      disclosures.push(
        `${stray.length} سؤال از برگهٔ جلسه در مخزن پیدا نشد و سفید محاسبه شد (${stray.join('، ')}).`
      );
    }
    const allocated = slots.length;
    const netCorrect = correct - plan.negativeMarkingRatio * wrong;
    const rawPercent =
      allocated === 0 ? 0 : Math.max(-100 * plan.negativeMarkingRatio, (netCorrect / allocated) * 100);
    sectionScores.push({
      sectionId: section.sectionId,
      title: section.title,
      coefficient: section.coefficient,
      allocated,
      answered: correct + wrong,
      correct,
      wrong,
      unanswered,
      netCorrect: Math.round(netCorrect * 100) / 100,
      rawPercent: Math.round(rawPercent * 100) / 100,
      weight: allocated > 0 ? section.coefficient : 0,
    });
  }

  const scored = sectionScores.filter((s) => s.weight > 0);
  const weightedSum = scored.reduce((acc, s) => acc + s.weight * s.rawPercent, 0);
  const weightTotal = scored.reduce((acc, s) => acc + s.weight, 0);
  const allCoefficientTotal = plan.sections.reduce((acc, s) => acc + s.coefficient, 0);
  const weightedScore = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const coefficientCoverageRatio =
    allCoefficientTotal > 0 ? weightTotal / allCoefficientTotal : 0;

  const coverage = plan.coverageRatio ?? coefficientCoverageRatio ?? 0;
  const factor = VERIFICATION_CONFIDENCE_FACTOR[plan.structureVerification];
  const readinessConfidence = Math.max(
    0,
    Math.min(1, (0.6 * coverage + 0.4 * coefficientCoverageRatio) * factor)
  );

  return {
    level: plan.level,
    examYear: plan.examYear,
    subGroupId: plan.subGroupId,
    pathTitle: plan.pathTitle,
    bookletCode: plan.bookletCode,
    negativeMarkingRatio: plan.negativeMarkingRatio,
    sections: sectionScores,
    weightedScore: Math.round(weightedScore * 100) / 100,
    coefficientCoverageRatio: Math.round(coefficientCoverageRatio * 1000) / 1000,
    coverageRatio: plan.coverageRatio === null ? null : Math.round(plan.coverageRatio * 1000) / 1000,
    readinessConfidence: Math.round(readinessConfidence * 1000) / 1000,
    confidenceLabel: readinessConfidence >= 0.8 ? 'high' : readinessConfidence >= 0.5 ? 'medium' : 'low',
    answeredQuestions: sectionScores.reduce((acc, s) => acc + s.answered, 0),
    officiality: plan.contentOfficiality,
    disclosures,
  };
}
