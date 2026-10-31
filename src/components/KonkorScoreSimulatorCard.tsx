import React, { useMemo, useState } from 'react';
import { KnowledgeNode } from '../data/konkorData';
import { LearnerSixDState, MajorExamBranch, UserStats } from '../engine/aelEngine';
import { KonkorCourseSectionId } from '../data/yearlyKonkorExams';
import {
  predictKonkorRankAndUniversity,
  CourseScoreInput,
  ExamDegreeMode,
} from '../data/konkorRankPredictor';
import {
  Calculator,
  GraduationCap,
  Award,
  TrendingUp,
  Play,
  BookOpen,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

interface KonkorScoreSimulatorCardProps {
  nodes: KnowledgeNode[];
  nodeStates: Record<string, LearnerSixDState>;
  stats: UserStats;
  onUpdateBranch?: (branch: MajorExamBranch) => void;
  onStartPracticeNode: (nodeId: string, mode: 'practice' | 'proof' | 'remedial') => void;
  onOpenLessonNode: (nodeId: string) => void;
  onOpenPlacementModal?: () => void;
}

interface CourseNodeMapping {
  sectionId: KonkorCourseSectionId;
  title: string;
  totalQuestions: number;
  coeffByBranch: Record<MajorExamBranch, number>;
  matchNode: (node: KnowledgeNode) => boolean;
}

const KONKOR_SECTIONS_CONFIG: CourseNodeMapping[] = [
  {
    sectionId: 'marketing',
    title: 'بازاریابی و مدیریت بازار',
    totalQuestions: 15,
    coeffByBranch: { business: 4, industrial: 0, technology: 0, phd_all: 4 },
    matchNode: (n) => n.id.startsWith('mkt.') || n.course.includes('بازاریابی'),
  },
  {
    sectionId: 'management_theories',
    title: 'تئوری‌های مدیریت، رفتار سازمانی و استراتژی',
    totalQuestions: 25,
    coeffByBranch: { business: 3, industrial: 3, technology: 3, phd_all: 5 },
    matchNode: (n) =>
      n.id.startsWith('mb.') ||
      n.id.startsWith('ob.') ||
      n.id.startsWith('hrm.') ||
      n.id.startsWith('sm.'),
  },
  {
    sectionId: 'operations_research',
    title: 'تحقیق در عملیات (پژوهش عملیاتی)',
    totalQuestions: 15,
    coeffByBranch: { business: 2, industrial: 3, technology: 2, phd_all: 4 },
    matchNode: (n) =>
      n.id === 'ind.or_simplex_duality' ||
      n.id === 'ind.mcdm_dea_queue' ||
      n.course.includes('تحقیق در عملیات'),
  },
  {
    sectionId: 'production',
    title: 'مدیریت تولید، عملیات و نوآوری فناورانه',
    totalQuestions: 15,
    coeffByBranch: { business: 0, industrial: 2, technology: 2, phd_all: 4 },
    matchNode: (n) =>
      n.id === 'ind.pom_eoq_mrp' ||
      n.id.startsWith('inno.') ||
      n.course.includes('تولید'),
  },
  {
    sectionId: 'english',
    title: 'زبان عمومی و تخصصی (انگلیسی)',
    totalQuestions: 25,
    coeffByBranch: { business: 3, industrial: 3, technology: 3, phd_all: 1 },
    matchNode: (n) => n.id === 'bus.english_eshraghi' || n.course.includes('زبان'),
  },
  {
    sectionId: 'math_stats',
    title: 'ریاضی، آمار و روش تحقیق',
    totalQuestions: 20,
    coeffByBranch: { business: 2, industrial: 2, technology: 2, phd_all: 5 },
    matchNode: (n) =>
      n.id.startsWith('stats.') ||
      n.id === 'bus.math_stats_ranjbaran_tourani' ||
      n.course.includes('آمار'),
  },
  {
    sectionId: 'economics',
    title: 'اقتصاد خرد و کلان',
    totalQuestions: 20,
    coeffByBranch: { business: 2, industrial: 2, technology: 2, phd_all: 2 },
    matchNode: (n) => n.id === 'bus.econ_nazari' || n.course.includes('اقتصاد'),
  },
  {
    sectionId: 'islamic',
    title: 'اصول و مبانی مدیریت از دیدگاه اسلام',
    totalQuestions: 15,
    coeffByBranch: { business: 2, industrial: 2, technology: 2, phd_all: 2 },
    matchNode: (n) => n.id === 'bus.islamic_moghimi' || n.course.includes('اسلام'),
  },
];

const BRANCH_LABELS: Record<MajorExamBranch, string> = {
  business: 'کارشناسی ارشد مدیریت بازرگانی (کد ۱۱۴۲)',
  industrial: 'کارشناسی ارشد مدیریت صنعتی (کد ۱۱۴۲)',
  technology: 'کارشناسی ارشد مدیریت تکنولوژی (کد ۱۱۴۲)',
  phd_all: 'دکتری تخصصی مدیریت (همه گرایش‌ها)',
};

export const KonkorScoreSimulatorCard: React.FC<KonkorScoreSimulatorCardProps> = ({
  nodes,
  nodeStates,
  stats,
  onUpdateBranch,
  onStartPracticeNode,
  onOpenLessonNode,
  onOpenPlacementModal,
}) => {
  const activeBranch: MajorExamBranch = stats.selectedMajorBranch || 'business';
  const degreeMode: ExamDegreeMode = activeBranch === 'phd_all' ? 'phd' : 'master';

  // امکان شبیه‌سازی What-If (افزایش فرضی تسلط روی هر درس برای دیدن اثر ضرایب بر تراز و رتبه)
  const [whatIfBoostByCourse, setWhatIfBoostByCourse] = useState<
    Partial<Record<KonkorCourseSectionId, number>>
  >({});
  const [carelessnessRiskMode, setCarelessnessRiskMode] = useState<
    'conservative' | 'balanced' | 'aggressive'
  >('balanced');

  const hasAnyWhatIf = Object.values(whatIfBoostByCourse).some((v) => (v || 0) > 0);

  // ۱. تحلیل دقیق گره‌های مرتبط با هر درس و محاسبه درصد شبیه‌سازی‌شده با احتساب historicalWeight و نمره منفی
  const simulatedCourses = useMemo(() => {
    return KONKOR_SECTIONS_CONFIG.map((cfg) => {
      const matchedNodes = nodes.filter(cfg.matchNode);
      const coeff = cfg.coeffByBranch[activeBranch];

      // میانگین وزنی masteryScore گره‌های این درس بر اساس وزن بودجه‌بندی تاریخی کنکور (historicalWeight)
      let weightedMasterySum = 0;
      let weightSum = 0;
      let totalRetrievability = 0;
      let weakestNode: KnowledgeNode | null = null;
      let weakestScore = 101;

      for (const node of matchedNodes) {
        const st = nodeStates[node.id];
        const mScore = st?.masteryScore ?? 0;
        const retr = st?.retrievability ?? (mScore > 0 ? 0.85 : 0);
        const hWeight = Math.max(1, node.historicalWeight || 5);

        weightedMasterySum += mScore * hWeight;
        weightSum += hWeight;
        totalRetrievability += retr;

        if (mScore < weakestScore) {
          weakestScore = mScore;
          weakestNode = node;
        }
      }

      const rawNodeMasteryAvg =
        weightSum > 0 ? Math.round((weightedMasterySum / weightSum) * 10) / 10 : 0;
      const avgRetrievability =
        matchedNodes.length > 0
          ? Math.round((totalRetrievability / matchedNodes.length) * 100) / 100
          : 0;

      const boost = whatIfBoostByCourse[cfg.sectionId] || 0;
      const effectiveMastery = Math.min(100, Math.round((rawNodeMasteryAvg + boost) * 10) / 10);

      // تبدیل تسلط (۰ تا ۱۰۰) به تعداد پاسخ صحیح، غلط و نزده در جلسه کنکور (فرمول نمره منفی ۳ به ۱)
      const totalQ = cfg.totalQuestions;
      let correct = 0;
      let wrong = 0;

      if (effectiveMastery > 0 && coeff > 0) {
        // ضریب یادآوری در جلسه آزمون
        const recallFactor =
          avgRetrievability > 0 ? 0.82 + avgRetrievability * 0.16 : 0.92;
        const answerableRatio = (effectiveMastery / 100) * recallFactor;
        correct = Math.min(totalQ, Math.round(totalQ * answerableRatio));

        const remainingQ = Math.max(0, totalQ - correct);
        const wrongRate =
          carelessnessRiskMode === 'conservative'
            ? 0.06
            : carelessnessRiskMode === 'balanced'
            ? 0.14
            : 0.26;
        wrong = Math.min(
          remainingQ,
          Math.round(remainingQ * wrongRate * (1 - effectiveMastery / 140))
        );
      }

      const unanswered = Math.max(0, totalQ - correct - wrong);
      const rawNet = ((correct * 3 - wrong) / (totalQ * 3)) * 100;
      const netPercent = Math.max(-15, Math.min(100, Math.round(rawNet * 10) / 10));

      return {
        sectionId: cfg.sectionId,
        title: cfg.title,
        coeff,
        totalQuestions: totalQ,
        matchedNodes,
        rawNodeMasteryAvg,
        boost,
        effectiveMastery,
        correct,
        wrong,
        unanswered,
        netPercent,
        weakestNode: weakestNode || matchedNodes[0] || null,
      };
    });
  }, [nodes, nodeStates, activeBranch, whatIfBoostByCourse, carelessnessRiskMode]);

  // ۲. فراخوانی موتور کالیبره‌شده سازمان سنجش برای محاسبه تراز، رتبه کشوری و دانشگاه قبولی
  const rankPrediction = useMemo(() => {
    const courseInputs: CourseScoreInput[] = simulatedCourses.map((c) => ({
      sectionId: c.sectionId,
      title: c.title,
      coeff: c.coeff,
      totalQuestions: c.totalQuestions,
      correct: c.correct,
      wrong: c.wrong,
      unanswered: c.unanswered,
      netPercent: c.netPercent,
    }));

    return predictKonkorRankAndUniversity({
      year: 1404,
      branch: activeBranch === 'phd_all' ? 'business' : activeBranch,
      degree: degreeMode,
      courseInputs,
    });
  }, [simulatedCourses, activeBranch, degreeMode]);

  // ۳. محاسبه میانگین وزنی تسلط گره‌های گرایش داوطلب
  const weightedMasterySummary = useMemo(() => {
    let sumWeightedMastery = 0;
    let sumCoeffs = 0;
    let activeBranchNodesCount = 0;

    for (const c of simulatedCourses) {
      if (c.coeff > 0) {
        sumWeightedMastery += c.effectiveMastery * c.coeff;
        sumCoeffs += c.coeff;
        activeBranchNodesCount += c.matchedNodes.length;
      }
    }

    return {
      weightedMasteryPercent:
        sumCoeffs > 0 ? Math.round((sumWeightedMastery / sumCoeffs) * 10) / 10 : 0,
      totalCoeffs: sumCoeffs,
      activeBranchNodesCount,
    };
  }, [simulatedCourses]);

  const handleAdjustBoost = (sectionId: KonkorCourseSectionId, delta: number) => {
    setWhatIfBoostByCourse((prev) => {
      const current = prev[sectionId] || 0;
      const next = Math.max(0, Math.min(85, current + delta));
      return { ...prev, [sectionId]: next };
    });
  };

  const handleApplySmartPreset = () => {
    // شبیه‌سازی جهش ۳۰٪ روی دروس ضریب ۳ و ۴ گرایش داوطلب
    const preset: Partial<Record<KonkorCourseSectionId, number>> = {};
    for (const c of simulatedCourses) {
      if (c.coeff >= 3) {
        preset[c.sectionId] = 45;
      } else if (c.coeff >= 2) {
        preset[c.sectionId] = 30;
      }
    }
    setWhatIfBoostByCourse(preset);
  };

  return (
    <div className="bento-card glass-panel p-5 sm:p-6 space-y-5">
      {/* هدر شبیه‌ساز نمره و رتبه کنکور */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" />
              <span>شبیه‌ساز هوشمند نمره، تراز و رتبه کنکور (مبتنی بر ضرایب دروس)</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {weightedMasterySummary.activeBranchNodesCount} گره دانش در گرایش شما
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              مجموع ضرایب مؤثر: {weightedMasterySummary.totalCoeffs}
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            تخمین نمره کل، تراز سنجش و دانشگاه قبولی بر اساس تسلط فعلی شما در گراف دانش
          </h2>
        </div>

        {/* انتخاب گرایش و شبیه‌سازی What-If */}
        <div className="flex flex-wrap items-center gap-2">
          {!hasAnyWhatIf ? (
            <button
              type="button"
              onClick={handleApplySmartPreset}
              className="px-3 py-1.5 rounded-xl text-xs font-bold glass-subcard text-amber-600 dark:text-amber-400 hover:border-amber-400 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>شبیه‌سازی اثر رشد دروس ضریب‌دار (What-If)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setWhatIfBoostByCourse({})}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازگشت به تسلط واقعی فعلی</span>
            </button>
          )}
        </div>
      </div>

      {/* نوار انتخاب گرایش و استراتژی ریسک نمره منفی */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 ml-1">گرایش ضرایب:</span>
          {(['business', 'industrial', 'technology', 'phd_all'] as MajorExamBranch[]).map(
            (b) => {
              const isSelected = activeBranch === b;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => onUpdateBranch?.(b)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold'
                      : 'glass-subcard text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {BRANCH_LABELS[b]
                    .replace('کارشناسی ارشد ', '')
                    .replace(' (کد ۱۱۴۲)', '')
                    .replace(' (همه گرایش‌ها)', '')}
                </button>
              );
            }
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 ml-1 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5" />
            <span>مدیریت نمره منفی در جلسه:</span>
          </span>
          {[
            { id: 'conservative', label: 'محتاطانه (حداقل غلط)' },
            { id: 'balanced', label: 'استاندارد کنکور' },
            { id: 'aggressive', label: 'پرریسک (حدس زیاد)' },
          ].map((mode) => {
            const active = carelessnessRiskMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() =>
                  setCarelessnessRiskMode(
                    mode.id as 'conservative' | 'balanced' | 'aggressive'
                  )
                }
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold'
                    : 'glass-subcard text-slate-600 dark:text-slate-400'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ۴ کارت شاخص کلیدی کارنامه شبیه‌سازی‌شده کنکور */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-subcard p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>میانگین وزنی تسلط / درصد خالص</span>
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
            {rankPrediction.weightedAveragePercent}٪{' '}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              (تسلط: {weightedMasterySummary.weightedMasteryPercent}٪)
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            میانگین رتبه ۱۰ کشوری:{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {rankPrediction.top10RankComparison.weightedAveragePercent}٪
            </strong>
          </div>
        </div>

        <div className="glass-subcard p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>تراز کل تخمینی سازمان سنجش</span>
            <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            {rankPrediction.scaledTaraz.toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-slate-500">
              / {rankPrediction.maxTarazScale.toLocaleString('en-US')}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            تراز رتبه ۱ کشوری:{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {rankPrediction.top1RankComparison.totalTaraz.toLocaleString('en-US')}
            </strong>
          </div>
        </div>

        <div className="glass-subcard p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>رتبه کشوری تخمینی در گرایش</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
            رتبه {rankPrediction.estimatedRank.toLocaleString('en-US')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            بازه اطمینان: {rankPrediction.rankRangeMin} تا {rankPrediction.rankRangeMax} (صدک{' '}
            {rankPrediction.percentile}٪)
          </div>
        </div>

        <div className="glass-subcard p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>دانشگاه و دوره محل قبولی</span>
            <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white leading-5 line-clamp-2">
            {rankPrediction.bestMatchedUniversity}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {hasAnyWhatIf ? 'در سناریوی شبیه‌سازی (What-If)' : 'بر اساس وضعیت فعلی شما'}
          </div>
        </div>
      </div>

      {/* جدول تحلیلی تک‌تک دروس، ضرایب، تسلط گره‌ها و شبیه‌سازی درصد با نمره منفی */}
      <div className="glass-subcard overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-slate-900 dark:text-white">
            جدول شبیه‌سازی دروس کنکور بر اساس `masteryScore` گره‌های مرتبط و ضریب گرایش
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            با دکمه‌های «+۱۰٪» اثر افزایش تسلط در هر درس را بر تراز و رتبه کل آزمایش کنید
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-900/40">
                <th className="py-2.5 px-3.5 font-bold">نام درس و تعداد گره</th>
                <th className="py-2.5 px-2.5 font-bold text-center">ضریب گرایش</th>
                <th className="py-2.5 px-3 font-bold">تسلط گره‌ها (`masteryScore`)</th>
                <th className="py-2.5 px-3 font-bold text-center">شبیه‌سازی دفترچه (صحیح/غلط)</th>
                <th className="py-2.5 px-3 font-bold text-center">درصد خالص شما</th>
                <th className="py-2.5 px-3 font-bold text-center">رتبه ۱۰ کشوری</th>
                <th className="py-2.5 px-3.5 font-bold text-left">اقدام ارتقای تراز</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/60">
              {simulatedCourses.map((course) => {
                const isZeroCoeff = course.coeff === 0;
                const breakdownItem = rankPrediction.courseBreakdown.find(
                  (b) => b.sectionId === course.sectionId
                );
                const rank10Pct = breakdownItem?.rank10Percent ?? 45;

                return (
                  <tr
                    key={course.sectionId}
                    className={`transition-colors ${
                      isZeroCoeff
                        ? 'opacity-45 bg-slate-100/30 dark:bg-slate-900/20'
                        : 'hover:bg-slate-200/30 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {course.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {course.matchedNodes.length} گره دانش · {course.totalQuestions} سؤال در دفترچه
                      </div>
                    </td>

                    <td className="py-3 px-2.5 text-center font-mono tabular-nums">
                      <span
                        className={`font-bold ${
                          course.coeff >= 3
                            ? 'text-blue-600 dark:text-blue-400'
                            : course.coeff === 0
                            ? 'text-slate-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        ضریب {course.coeff}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center justify-between gap-2 mb-1 tabular-nums">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {course.effectiveMastery}٪
                          {course.boost > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 mr-1 text-[10px]">
                              (+{course.boost}٪ فرضی)
                            </span>
                          )}
                        </span>
                        {!isZeroCoeff && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustBoost(course.sectionId, 10)}
                              className="px-1.5 py-0.5 rounded bg-blue-600/15 hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white text-[10px] font-mono font-bold transition-colors cursor-pointer"
                              title="افزایش فرضی ۱۰٪ تسلط برای شبیه‌سازی اثر ضریب"
                            >
                              +10%
                            </button>
                            {course.boost > 0 && (
                              <button
                                type="button"
                                onClick={() => handleAdjustBoost(course.sectionId, -10)}
                                className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono font-bold cursor-pointer"
                              >
                                -10%
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            course.effectiveMastery >= 70
                              ? 'bg-emerald-500'
                              : course.effectiveMastery >= 40
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, course.effectiveMastery)}%` }}
                        />
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center font-mono tabular-nums text-[11px]">
                      {isZeroCoeff ? (
                        <span className="text-slate-400">حذف در گرایش</span>
                      ) : (
                        <span>
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {course.correct}✓
                          </strong>{' '}
                          ·{' '}
                          <strong className="text-rose-500">{course.wrong}✗</strong> ·{' '}
                          <span className="text-slate-400">{course.unanswered}○</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center font-mono tabular-nums">
                      {isZeroCoeff ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={`font-bold ${
                            course.netPercent >= rank10Pct
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : course.netPercent >= 25
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {course.netPercent}٪
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {isZeroCoeff ? '—' : `${rank10Pct}٪`}
                    </td>

                    <td className="py-3 px-3.5 text-left">
                      {!isZeroCoeff && course.weakestNode ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenLessonNode(course.weakestNode!.id)}
                            className="px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 hover:bg-blue-600 text-slate-700 dark:text-slate-300 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                            title={`درسنامه ضعیف‌ترین گره این درس: ${course.weakestNode.topic}`}
                          >
                            <BookOpen className="w-3 h-3 inline ml-1" />
                            <span>درسنامه</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onStartPracticeNode(course.weakestNode!.id, 'practice')
                            }
                            className="px-2 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                            title={`حل تست از مبحث: ${course.weakestNode.topic}`}
                          >
                            <Play className="w-3 h-3 inline ml-1" />
                            <span>تست</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">بدون اثر در گرایش</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* توصیه استراتژیک موتور تخمین تراز و وضعیت قبولی دانشگاه‌ها */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 glass-subcard p-4 flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>تحلیل اهرم ضرایب و توصیه استراتژیک افزایش تراز:</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-6">
              {rankPrediction.strategicAdvice}
            </p>
          </div>

          {stats.isZeroStateNewUser && !hasAnyWhatIf && (
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                برای کالیبره شدن فوری `masteryScore` گره‌ها و مشاهده رتبه واقعی خود، آزمون تعیین سطح ۵ سؤالی را انجام دهید:
              </span>
              {onOpenPlacementModal && (
                <button
                  type="button"
                  onClick={onOpenPlacementModal}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer transition-colors"
                >
                  شروع تعیین سطح سریع
                </button>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 glass-subcard p-4 space-y-2">
          <div className="text-xs font-bold text-slate-900 dark:text-white">
            وضعیت شانس قبولی در رده‌های دانشگاهی کشور:
          </div>
          <div className="space-y-1.5 text-xs">
            {rankPrediction.universityAdmissions.slice(0, 4).map((adm) => {
              const isGuaranteed = adm.status.startsWith('قبولی قطعی');
              const isBorderline = adm.status.startsWith('قبولی محتمل');
              return (
                <div
                  key={adm.tier.id}
                  className="flex items-center justify-between gap-2 py-1 border-b last:border-b-0 border-slate-200/50 dark:border-slate-800/60"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isGuaranteed
                          ? 'text-emerald-500'
                          : isBorderline
                          ? 'text-amber-500'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                    <span className="truncate text-slate-700 dark:text-slate-300">
                      {adm.tier.universityName}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[11px] tabular-nums font-bold ${
                      isGuaranteed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isBorderline
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {adm.tarazGap >= 0 ? `+${adm.tarazGap}` : adm.tarazGap} تراز
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
