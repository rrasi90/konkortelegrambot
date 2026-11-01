import React, { useState } from 'react';
import { KnowledgeNode, TRACK_LABELS, TrackId } from '../data/konkorData';
import { YEARLY_KONKOR_BOOKLETS, KonkorCourseSectionId } from '../data/yearlyKonkorExams';
import { SUBJECT_COURSE_DEFINITIONS } from '../data/subjectHubMeta';
import { getArshadCoverage } from '../data/examCoverage';

/** تبدیل ارقام لاتین به فارسی برای نمایش در رابط کاربری */
const toPersianDigits = (value: string): string =>
  value
    .replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
    .replace(/\./g, '٫');

const arshadCoverage = getArshadCoverage();
import {
  LearnerSixDState,
  ReviewCard,
  UserStats,
  ROINodeRanking,
  MultiYearFrequencyInsight,
  StudyCourseCategory,
  MajorExamBranch,
  getNodeEffectiveBranchCoefficient,
} from '../engine/aelEngine';
import { shareProgressToTelegramChat, tmaHaptic } from '../utils/telegramBridge';
import {
  Play,
  Moon,
  Flame,
  TrendingUp,
  Compass,
  BookOpen,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertOctagon,
  Award,
  Share2,
  Bot,
  SlidersHorizontal,
  GraduationCap,
  Network,
  Sparkles,
  Activity,
  Calculator,
} from 'lucide-react';
import { MasteryVelocityChart } from './MasteryVelocityChart';
import { KonkorScoreSimulatorCard } from './KonkorScoreSimulatorCard';

interface DashboardViewProps {
  nodes: KnowledgeNode[];
  stats: UserStats;
  nodeStates: Record<string, LearnerSixDState>;
  queue: ReviewCard[];
  roiRankings: ROINodeRanking[];
  examFrequencyList: MultiYearFrequencyInsight[];
  onStartDailySession: () => void;
  onStartNightQuiz: () => void;
  onOpenPlacementModal: () => void;
  onOpenTelegramBotSimulator: () => void;
  onChangeStudyMode: (mode: 'desk' | 'commute' | 'quick') => void;
  onUpdateStudyPreferences: (prefs: {
    dailyStudyHours?: number;
    dailyTargetQuestions?: number;
    preferredCourseCategory?: StudyCourseCategory;
    selectedMajorBranch?: MajorExamBranch;
  }) => void;
  onToggleTrack: (track: TrackId) => void;
  onUseStreakFreeze: () => void;
  onStartPracticeNode: (nodeId: string, mode: 'practice' | 'proof' | 'remedial') => void;
  onOpenLessonNode: (nodeId: string) => void;
  onOpenYearlyExam: (year?: number) => void;
  onNavigateTab: (
    tab: 'study' | 'exams' | 'map' | 'lessons' | 'subject_hub' | 'notebook' | 'ingest' | 'patches'
  ) => void;
  onSelectSubject?: (subjectId: KonkorCourseSectionId) => void;
  onResetToZeroState: () => void;
}

type DashboardSubTab = 'today' | 'simulator' | 'velocity' | 'priorities' | 'settings';

const BRANCH_LABELS: Record<MajorExamBranch, string> = {
  business: 'مدیریت بازرگانی',
  industrial: 'مدیریت صنعتی',
  technology: 'مدیریت تکنولوژی',
  phd_all: 'دکتری تخصصی مدیریت',
};

const CATEGORY_LABELS: Record<StudyCourseCategory, string> = {
  all: 'ترکیبی همه دروس',
  conceptual: 'دروس مفهومی و تئوری',
  quantitative: 'دروس کمی و محاسباتی',
  language: 'زبان عمومی و تخصصی',
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  nodes,
  stats,
  nodeStates,
  queue,
  roiRankings,
  examFrequencyList,
  onStartDailySession,
  onStartNightQuiz,
  onOpenPlacementModal,
  onOpenTelegramBotSimulator,
  onUpdateStudyPreferences,
  onToggleTrack,
  onStartPracticeNode,
  onOpenLessonNode,
  onOpenYearlyExam,
  onNavigateTab,
  onSelectSubject,
  onResetToZeroState,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<DashboardSubTab>('today');
  const [shareToast, setShareToast] = useState<string | null>(null);

  const allStates = Object.values(nodeStates) as LearnerSixDState[];
  const overallMastery = Math.round(
    allStates.reduce((acc, s) => acc + s.masteryScore, 0) / Math.max(1, allStates.length)
  );
  const masteredOrProvenCount = allStates.filter(
    (s) => s.coverageStatus === 'mastered' || s.coverageStatus === 'proven'
  ).length;
  const needsProofNodes = nodes.filter(
    (n) => nodeStates[n.id]?.coverageStatus === 'needs_proof'
  );
  const leechNodesCount = allStates.filter((s) => s.hasLeechCard).length;
  const probeOrRemedialCards = queue.filter(
    (c) =>
      c.cardType === 'diagnostic_probe' ||
      c.cardType === 'remedial_lesson' ||
      c.cardType === 'comparison_card' ||
      c.cardType === 'trap_note'
  );

  // محاسبه درصد خالص کنکور با فرمول نمره منفی (۳+ درست، ۱- غلط)
  const rawDenominator = Math.max(1, stats.totalAnswered * 3);
  const rawScoreWithNegative = Math.max(0, stats.correctCount * 3 - stats.wrongCount * 1);
  const netKonkorPercent =
    stats.totalAnswered === 0 ? 0 : Math.round((rawScoreWithNegative / rawDenominator) * 100);

  const activeBranch = stats.selectedMajorBranch || 'business';
  const activeCategory = stats.preferredCourseCategory || 'all';
  const activeHours = stats.dailyStudyHours || 4;
  const activeTargetQ = stats.dailyTargetQuestions || 20;

  // محاسبه نمره و تراز شبیه‌سازی‌شده کنکور بر اساس masteryScore گره‌های مرتبط با گرایش و ضرایب دروس
  const { branchWeightedMastery, simulatedKonkorTaraz } = React.useMemo(() => {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const node of nodes) {
      const coeff = getNodeEffectiveBranchCoefficient(node, activeBranch);
      if (coeff <= 0) continue;
      const st = nodeStates[node.id];
      const mScore = st?.masteryScore ?? 0;
      const nodeImportance = coeff * Math.max(1, node.historicalWeight || 5);
      weightedSum += mScore * nodeImportance;
      totalWeight += nodeImportance;
    }

    const weightedPct =
      totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
    // فرمول تراز تخمینی سازمان سنجش بر اساس میانگین وزنی ضرایب گرایش
    const estTaraz =
      activeBranch === 'phd_all'
        ? Math.round(2250 + weightedPct * 27)
        : Math.round(4450 + weightedPct * 54);

    return {
      branchWeightedMastery: weightedPct,
      simulatedKonkorTaraz: estTaraz,
    };
  }, [nodes, nodeStates, activeBranch]);

  const ringRadius = 44;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - overallMastery / 100);

  const topMultiYearNodes = [...examFrequencyList]
    .sort((a, b) => b.appearanceCount - a.appearanceCount)
    .slice(0, 6);

  const handleShareTelegram = () => {
    shareProgressToTelegramChat({
      overallMastery,
      netKonkorPercent,
      streakDays: stats.streakDays,
      lessonsRatedCount: stats.lessonsRatedCount,
    });
    setShareToast('گزارش پیشرفت کپی شد');
    setTimeout(() => setShareToast(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* نوار تب‌بندی تمیز میز کار (جلوگیری از شلوغی صفحه اول) */}
      <div className="bento-card glass-panel p-2.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 w-full">
        <div className="tab-strip" role="tablist" aria-label="بخش‌های میز کار">
          {[
            {
              id: 'today' as DashboardSubTab,
              label: 'برنامهٔ امروز',
              short: 'امروز',
              icon: Sparkles,
              badge: `${queue.length} گام`,
            },
            {
              id: 'simulator' as DashboardSubTab,
              label: 'شبیه‌ساز رتبه',
              short: 'شبیه‌ساز',
              icon: Calculator,
              badge: `تراز ${simulatedKonkorTaraz.toLocaleString('en-US')}`,
            },
            {
              id: 'velocity' as DashboardSubTab,
              label: 'روند و سرعت',
              short: 'روند',
              icon: Activity,
              badge: `${overallMastery}٪ تسلط`,
            },
            {
              id: 'priorities' as DashboardSubTab,
              label: 'اولویت‌ها',
              short: 'اولویت',
              icon: TrendingUp,
              badge: `${roiRankings.length} مبحث`,
            },
            {
              id: 'settings' as DashboardSubTab,
              label: 'تنظیمات',
              short: 'تنظیمات',
              icon: SlidersHorizontal,
              badge: BRANCH_LABELS[activeBranch].replace('مدیریت ', ''),
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  tmaHaptic.selection();
                  setActiveSubTab(tab.id);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'glass-subcard text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span>
                <span
                  className={`hidden sm:inline-flex px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* خلاصه وضعیت روزانه در سمت چپ نوار تب */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
          <span className="glass-subcard px-3 py-1.5 font-bold text-slate-900 dark:text-white tabular-nums inline-flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {stats.streakDays} روز پیوسته · {stats.xp} XP
            </span>
          </span>
          <span className="hidden sm:inline tabular-nums">
            هدف روزانه:{' '}
            <strong className="text-slate-900 dark:text-white">
              {activeHours} ساعت ({activeTargetQ} تست)
            </strong>
          </span>
          {shareToast && (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{shareToast}</span>
            </span>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* تب ۱: برنامه و مرور امروز (صفحه اول خلوت، متمرکز و بدون شلوغی) */}
      {/* =================================================================== */}
      {activeSubTab === 'today' && (
        <div className="bento-grid">
          {/* ۱. کاشی بنتو اصلی شروع مرور تطبیقی امروز (۷ ستون - Glass Hero) */}
          <div className="bento-span-7 glass-card-hero p-6 text-white flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <span>
                  صف هوشمند امروز · {BRANCH_LABELS[activeBranch]} · {CATEGORY_LABELS[activeCategory]}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-400/30 font-mono tabular-nums text-blue-300 font-bold">
                  {queue.length} گام آماده در صف امروز
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold leading-snug text-balance">
                مرور گام‌به‌گام درسنامه‌ها و تست‌های شناسنامه‌دار کنکور با پاسخ تشریحی کامل
              </h1>

              <p className="text-xs sm:text-sm text-slate-300/90 leading-7">
                پس از پاسخ به هر تست، توضیح کامل مستخرج از کتب مرجع، دام طراح سازمان سنجش و خلاصه درسنامه همان مبحث نمایش داده می‌شود و تسلط شما در درخت دانش به‌روز می‌گردد.
              </p>

              {/* خلاصه ترکیب صف امروز با زیرکارت‌های شیشه‌ای */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-1 w-full">
                <div className="p-3.5 rounded-xl bg-white/8 backdrop-blur-md border border-white/12">
                  <div className="text-[11px] text-slate-300">تست‌های کنکور</div>
                  <div className="text-base font-bold mt-0.5 tabular-nums">
                    {queue.filter((c) => c.cardType === 'question').length} تست
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-white/8 backdrop-blur-md border border-white/12">
                  <div className="text-[11px] text-slate-300">تست اثبات ۱۴۰۴</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5 tabular-nums">
                    {queue.filter((c) => c.cardType === 'proof_1404').length} آزمون
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-white/8 backdrop-blur-md border border-white/12">
                  <div className="text-[11px] text-slate-300">درسنامه و پیش‌نیاز</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5 tabular-nums">
                    {probeOrRemedialCards.length} کارت
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/12 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  tmaHaptic.impact('heavy');
                  onStartDailySession();
                }}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>شروع مرور امروز ({queue.length} گام)</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    tmaHaptic.impact('light');
                    onOpenPlacementModal();
                  }}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 backdrop-blur-md text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-blue-300" />
                  <span>تعیین سطح (۵ سؤال)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    tmaHaptic.impact('medium');
                    onStartNightQuiz();
                  }}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 backdrop-blur-md text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Moon className="w-3.5 h-3.5 text-amber-300" />
                  <span>کوییز شبانه</span>
                </button>
              </div>
            </div>
          </div>

          {/* ۲. کاشی بنتو وضعیت تسلط ۶بعدی و مأموریت‌های روزانه (۵ ستون) */}
          <div className="bento-span-5 bento-card glass-panel p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  تسلط کل گراف دانش و نمره شبیه‌سازی کنکور
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  میانگین وزنی گرایش: {branchWeightedMastery}٪ · تراز تخمینی:{' '}
                  {simulatedKonkorTaraz.toLocaleString('en-US')}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('simulator')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  شبیه‌ساز نمره ←
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('velocity')}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  نمودار ۳۰ روزه ←
                </button>
              </div>
            </div>

            <div className="flex items-center gap-5 my-4">
              <div className="relative w-22 h-22 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 104 104">
                  <circle
                    cx="52"
                    cy="52"
                    r={ringRadius}
                    fill="none"
                    strokeWidth="8"
                    className="stroke-slate-200/80 dark:stroke-slate-800"
                  />
                  <circle
                    cx="52"
                    cy="52"
                    r={ringRadius}
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    className="stroke-blue-600 dark:stroke-blue-400 transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                    {overallMastery}٪
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">تسلط کل</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 flex-1 text-xs">
                <div className="glass-subcard p-2.5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">تثبیت‌شده</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                    {masteredOrProvenCount} از {nodes.length}
                  </div>
                </div>
                <div className="glass-subcard p-2.5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">درسنامه‌ها</div>
                  <div className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                    {stats.lessonsRatedCount} مبحث
                  </div>
                </div>
                <div className="glass-subcard p-2.5 col-span-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">صحیح / غلط / نزده:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {stats.correctCount} / {stats.wrongCount} / {stats.skippedCount}
                  </span>
                </div>
                {leechNodesCount > 0 && (
                  <div className="glass-subcard p-2 col-span-2 flex items-center justify-between text-rose-600 dark:text-rose-400 font-bold">
                    <span className="flex items-center gap-1">
                      <AlertOctagon className="w-3.5 h-3.5" />
                      کارت‌های چغر:
                    </span>
                    <span>{leechNodesCount} مبحث</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1.5">
              {stats.dailyQuests.map((q) => (
                <div
                  key={q.id}
                  className="glass-subcard py-1.5 px-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        q.completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                    <span
                      className={`truncate ${
                        q.completed
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {q.title}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                    {q.current}/{q.target}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ۳. سه کارت میانبر سریع و مینیمال به بخش‌های اصلی (هر کدام ۴ ستون بنتو) */}
          <button
            type="button"
            onClick={() => onOpenYearlyExam(1405)}
            className="bento-span-4 bento-card bento-card-interactive glass-panel p-5 text-right flex flex-col justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-[-2px] transition-transform flex items-center gap-1">
                <span>ورود به تب کنکورها</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                آرشیو {toPersianDigits(String(YEARLY_KONKOR_BOOKLETS.length))} دوره آزمون کارشناسی ارشد (۱۳۹۱ تا ۱۴۰۵)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-6">
                دفترچه‌های رسمی ارشد (کد ۱۱۴۲) با {toPersianDigits(String(arshadCoverage.available))} سؤال
                از {toPersianDigits(String(arshadCoverage.declared))} سؤال اعلام‌شده ({toPersianDigits(String(arshadCoverage.percent))}٪)
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 leading-5 font-medium">
                آزمون دکتری هنوز دفترچهٔ رسمی ثبت‌شده ندارد.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('map')}
            className="bento-span-4 bento-card bento-card-interactive glass-panel p-5 text-right flex flex-col justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Network className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-[-2px] transition-transform flex items-center gap-1">
                <span>ورود به درخت مهارت</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                گراف دانش تعاملی ({nodes.length} مبحث)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-6">
                نقشه پیش‌نیازها (FIRe)، وضعیت ۶بعدی یادگیرنده و مرز دانش در Cytoscape.js
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('lessons')}
            className="bento-span-4 bento-card bento-card-interactive glass-panel p-5 text-right flex flex-col justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-[-2px] transition-transform flex items-center gap-1">
                <span>ورود به کتابخانه</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                درسنامه‌ها، کتب مرجع و مجلدات ۱۰۰ صفحه‌ای
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-6">
                خلاصه فصول کتب مرجع، جدول ضرایب کد ۱۱۴۲ و بانک تست تشریحی ارشد و دکتری
              </p>
            </div>
          </button>

          {/* بخش اختصاصی: مطالعه تفکیکی درس‌به‌درس (۸ درس رسمی کنکور) */}
          <div className="bento-span-12 bento-card glass-panel p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-md mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span>تفکیک کامل بر اساس نام درس (آموزش + کتاب + تست اختصاصی)</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  مطالعهٔ تفکیکی درس‌به‌درس: ورود مستقیم به درس مورد نظر
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  با کلیک بر روی هر درس، فقط آموزش‌ها، فصول کتب مرجع، نکات طلایی ۲+ تکرار و تست‌های همان درس را مطالعه و تمرین کنید.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('subject_hub')}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span>ورود به پیشخوان دروس</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {SUBJECT_COURSE_DEFINITIONS.map((subj) => (
                <button
                  key={subj.id}
                  type="button"
                  onClick={() => {
                    if (onSelectSubject) onSelectSubject(subj.id);
                    onNavigateTab('subject_hub');
                  }}
                  className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-500 hover:shadow-xs transition-all text-right flex flex-col justify-between gap-2 group cursor-pointer"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    {subj.shortTitle}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    {subj.questionCountInExam.split(' ')[0]} تست
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* تب ۲: شبیه‌ساز نمره، تراز و رتبه کنکور بر اساس masteryScore و ضرایب */}
      {/* =================================================================== */}
      {activeSubTab === 'simulator' && (
        <div className="bento-grid">
          <div className="bento-span-12">
            <KonkorScoreSimulatorCard
              nodes={nodes}
              nodeStates={nodeStates}
              stats={stats}
              onUpdateBranch={(b) => onUpdateStudyPreferences({ selectedMajorBranch: b })}
              onStartPracticeNode={onStartPracticeNode}
              onOpenLessonNode={onOpenLessonNode}
              onOpenPlacementModal={onOpenPlacementModal}
            />
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* تب ۳: نمودار ۳۰ روزه پیشرفت تسلط و سرعت یادگیری (Recharts)          */}
      {/* =================================================================== */}
      {activeSubTab === 'velocity' && (
        <div className="bento-grid">
          <div className="bento-span-12">
            <MasteryVelocityChart
              nodes={nodes}
              nodeStates={nodeStates}
              stats={stats}
              onStartDailySession={onStartDailySession}
              onOpenPlacementModal={onOpenPlacementModal}
            />
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* تب ۴: اولویت‌های پیشنهادی امروز (ROI) و فصول پرتکرار ادوار کنکور */}
      {/* =================================================================== */}
      {activeSubTab === 'priorities' && (
        <div className="bento-grid">
          {/* ۱. کاشی بنتو اولویت‌های مطالعه امروز (ROI Planner - ۵ ستون) */}
          <div className="bento-span-5 bento-card glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  اولویت‌های پیشنهادی امروز شما (بر اساس ضریب گرایش)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('lessons')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                همه درسنامه‌ها
              </button>
            </div>

            <div className="space-y-2.5">
              {roiRankings.slice(0, 6).map((item, idx) => (
                <div
                  key={item.node.id}
                  className="glass-subcard p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {idx + 1}. {item.node.topic}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate tabular-nums">
                      {item.node.course} · تسلط: {item.state.masteryScore}٪ ·{' '}
                      {item.examFrequencyInsight.appearanceCount} دوره کنکور
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenLessonNode(item.node.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/70 hover:bg-blue-600 text-slate-700 dark:text-slate-200 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      درسنامه
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartPracticeNode(item.node.id, 'practice')}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white dark:text-blue-400 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      تست
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {needsProofNodes.length > 0 && (
              <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 space-y-2">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  <span>آماده اثبات نهایی تسلط (سؤالات قرنطینه کنکور ۱۴۰۴):</span>
                </div>
                {needsProofNodes.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-bold text-slate-900 dark:text-amber-100 truncate">
                      {n.topic}
                    </span>
                    <button
                      type="button"
                      onClick={() => onStartPracticeNode(n.id, 'proof')}
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shrink-0 cursor-pointer"
                    >
                      شروع آزمون اثبات
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ۲. کاشی بنتو رادار فصول پرتکرار ادوار کنکور (۷ ستون) */}
          <div className="bento-span-7 bento-card glass-panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  فصول پرتکرار ادوار کنکور سراسری (مستند به کتب مرجع)
                </h2>
              </div>

              <div className="flex flex-wrap gap-1">
                {(['common', 'business', 'industrial', 'technology'] as TrackId[]).map((t) => {
                  const isActive = stats.activeTracks.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onToggleTrack(t)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-blue-600/15 text-blue-700 dark:text-blue-300 font-bold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {TRACK_LABELS[t].title.replace('گرایش ', '')}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topMultiYearNodes.map((freq) => {
                const node = nodes.find((n) => n.id === freq.nodeId);
                const state = nodeStates[freq.nodeId];
                if (!node) return null;

                return (
                  <div
                    key={freq.nodeId}
                    className="glass-subcard bento-card-interactive p-3.5 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          {freq.appearanceCount} دوره کنکور ({freq.yearsAppeared.slice(-4).join('، ')})
                        </span>
                        <span>تسلط: {state?.masteryScore ?? 0}٪</span>
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-6">
                        {node.course} — {node.topic}
                      </h3>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-5">
                        منبع: {freq.sourceBookCitation}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => onOpenLessonNode(node.id)}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>مطالعه درسنامه</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartPracticeNode(node.id, 'practice')}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>حل تست</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* تب ۳: تنظیمات مسیر مطالعه شخصی (۴ پرسش کلیدی) و ابزارهای جانبی */}
      {/* =================================================================== */}
      {activeSubTab === 'settings' && (
        <div className="bento-grid">
          <div className="bento-span-12 bento-card glass-panel p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  شخصی‌سازی مسیر مطالعه (گرایش، ساعت مطالعه روزانه، نوع دروس و تعداد تست)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  دروس ضریب صفر گرایش انتخابی شما به صورت خودکار حذف شده و صف مرور امروز بر اساس بودجه زمانی شما چیده می‌شود.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    tmaHaptic.impact('medium');
                    onOpenTelegramBotSimulator();
                  }}
                  className="glass-subcard px-3.5 py-2 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:border-sky-400"
                >
                  <Bot className="w-3.5 h-3.5 text-sky-500" />
                  <span>شبیه‌ساز ربات تلگرام</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareTelegram}
                  className="glass-subcard px-3.5 py-2 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:border-sky-400"
                >
                  <Share2 className="w-3.5 h-3.5 text-sky-500" />
                  <span>اشتراک کارنامه</span>
                </button>

                {!stats.isZeroStateNewUser && (
                  <button
                    type="button"
                    onClick={() => {
                      tmaHaptic.notify('warning');
                      onResetToZeroState();
                    }}
                    className="glass-subcard px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="ریست کامل به صفر"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>بازنشانی پیشرفت به صفر</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* ۱. انتخاب گرایش */}
              <div className="glass-subcard p-4 space-y-2.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  ۱. گرایش هدف شما در کنکور چیست؟
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'business', label: 'ارشد مدیریت بازرگانی (بازاریابی ضریب ۴)' },
                    { id: 'industrial', label: 'ارشد مدیریت صنعتی (تحقیق در عملیات ضریب ۳)' },
                    { id: 'technology', label: 'ارشد مدیریت تکنولوژی (تئوری و زبان ضریب ۳)' },
                    { id: 'phd_all', label: 'دکتری تخصصی مدیریت (همه گرایش‌ها)' },
                  ].map((b) => {
                    const active = activeBranch === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          tmaHaptic.selection();
                          onUpdateStudyPreferences({
                            selectedMajorBranch: b.id as MajorExamBranch,
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          active
                            ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-xs'
                            : 'bg-white/60 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                        }`}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ۲. نوع دروس مورد علاقه */}
              <div className="glass-subcard p-4 space-y-2.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  ۲. چه نوع دروسی را می‌خواهید بخوانید؟
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'all', label: 'ترکیبی همه دروس (تئوری + کمی + زبان)' },
                    { id: 'conceptual', label: 'دروس مفهومی و حفظی (تئوری، بازاریابی، اسلام)' },
                    { id: 'quantitative', label: 'دروس کمی و محاسباتی (OR، آمار، اقتصاد، تولید)' },
                    { id: 'language', label: 'زبان عمومی و تخصصی انگلیسی (ضریب ۳)' },
                  ].map((cat) => {
                    const active = activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          tmaHaptic.selection();
                          onUpdateStudyPreferences({
                            preferredCourseCategory: cat.id as StudyCourseCategory,
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-xs'
                            : 'bg-white/60 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ۳. ساعت مطالعه روزانه */}
              <div className="glass-subcard p-4 space-y-2.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  ۳. روزی چند ساعت می‌خواهید درس بخوانید؟
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4, 6, 8].map((hrs) => {
                    const active = activeHours === hrs;
                    return (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => {
                          tmaHaptic.selection();
                          onUpdateStudyPreferences({ dailyStudyHours: hrs });
                        }}
                        className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer tabular-nums ${
                          active
                            ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-xs'
                            : 'bg-white/60 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                        }`}
                      >
                        {hrs} ساعت در روز
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ۴. تعداد تست هدف در روز */}
              <div className="glass-subcard p-4 space-y-2.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  ۴. روزی چند تست می‌خواهید بزنید؟
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[5, 10, 15, 20, 30, 50].map((qTarget) => {
                    const active = activeTargetQ === qTarget;
                    return (
                      <button
                        key={qTarget}
                        type="button"
                        onClick={() => {
                          tmaHaptic.selection();
                          onUpdateStudyPreferences({ dailyTargetQuestions: qTarget });
                        }}
                        className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer tabular-nums ${
                          active
                            ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs'
                            : 'bg-white/60 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400'
                        }`}
                      >
                        {qTarget} تست در روز
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
