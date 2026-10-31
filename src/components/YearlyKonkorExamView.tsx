import React, { useState, useMemo, useEffect } from 'react';
import {
  YEARLY_KONKOR_BOOKLETS,
  YEARLY_KONKOR_QUESTIONS,
  KONKOR_COURSE_SECTIONS,
  KonkorCourseSectionId,
  YearlyKonkorQuestion,
} from '../data/yearlyKonkorExams';
import { KnowledgeNode, InteractiveLesson } from '../data/konkorData';
import { MajorExamBranch } from '../engine/aelEngine';
import { MathText } from './MathText';
import {
  predictKonkorRankAndUniversity,
  HISTORICAL_TOP_RANK_PROFILES,
  YEAR_DIFFICULTY_CALIBRATIONS,
  ExamDegreeMode,
  CourseScoreInput,
} from '../data/konkorRankPredictor';
import {
  FileText,
  Download,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  BookOpen,
  Award,
  Clock,
  Sparkles,
  AlertTriangle,
  Eye,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  Calculator,
  GraduationCap,
  TrendingUp,
} from 'lucide-react';

interface YearlyKonkorExamViewProps {
  nodes: KnowledgeNode[];
  lessons: Record<string, InteractiveLesson>;
  initialYear?: number;
  selectedBranch: MajorExamBranch;
  onChangeBranch: (branch: MajorExamBranch) => void;
  onStartYearAdaptiveSession: (year: number, sectionId: KonkorCourseSectionId | 'all') => void;
  onRecordQuestionAttempt?: (question: YearlyKonkorQuestion, selectedOption: number) => void;
  onOpenLessonNode: (nodeId: string) => void;
}

export const YearlyKonkorExamView: React.FC<YearlyKonkorExamViewProps> = ({
  nodes,
  lessons,
  initialYear = 1405,
  selectedBranch,
  onChangeBranch,
  onStartYearAdaptiveSession,
  onRecordQuestionAttempt,
  onOpenLessonNode,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedSection, setSelectedSection] = useState<KonkorCourseSectionId | 'all'>('all');
  const [viewMode, setViewMode] = useState<'simulator' | 'descriptive' | 'rank_predictor' | 'pdf_split'>('simulator');
  const [userAnswers, setUserAnswers] = useState<Record<string, number | null>>({});
  const [revealedQuestions, setRevealedQuestions] = useState<Record<string, boolean>>({});
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [showBudgetTable, setShowBudgetTable] = useState<boolean>(false);

  // حالت‌های موتور تخمین رتبه، تراز و دانشگاه قبولی (ارشد و دکتری)
  const [predictorDegree, setPredictorDegree] = useState<ExamDegreeMode>('master');
  const [predictorInputMode, setPredictorInputMode] = useState<'live_exam' | 'custom_counts'>('custom_counts');
  const [customCounts, setCustomCounts] = useState<
    Record<KonkorCourseSectionId, { correct: number; wrong: number }>
  >({
    english: { correct: 15, wrong: 3 },
    islamic: { correct: 10, wrong: 2 },
    math_stats: { correct: 9, wrong: 3 },
    management_theories: { correct: 16, wrong: 4 },
    economics: { correct: 14, wrong: 2 },
    operations_research: { correct: 9, wrong: 2 },
    production: {
      correct: selectedBranch === 'business' ? 0 : 9,
      wrong: selectedBranch === 'business' ? 0 : 2,
    },
    marketing: {
      correct: selectedBranch === 'business' ? 11 : 0,
      wrong: selectedBranch === 'business' ? 2 : 0,
    },
  });

  // تایمر شبیه‌ساز جلسه کنکور
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(150 * 60);

  useEffect(() => {
    if (initialYear) {
      setSelectedYear(initialYear);
      setActiveQuestionIndex(0);
    }
  }, [initialYear]);

  const currentBooklet = useMemo(
    () =>
      YEARLY_KONKOR_BOOKLETS.find((b) => b.year === selectedYear) ??
      YEARLY_KONKOR_BOOKLETS[0],
    [selectedYear]
  );

  useEffect(() => {
    setIsTimerRunning(false);
    setRemainingSeconds((currentBooklet.durationMinutes || 150) * 60);
  }, [currentBooklet]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // سؤالات سال انتخابی به ترتیب دقیق شماره سؤال در دفترچه کنکور
  const yearQuestions = useMemo(() => {
    return YEARLY_KONKOR_QUESTIONS.filter((q) => {
      if (q.examYear !== selectedYear) return false;
      if (selectedSection !== 'all' && q.courseSectionId !== selectedSection) return false;
      return true;
    }).sort((a, b) => a.bookletQuestionNumber - b.bookletQuestionNumber);
  }, [selectedYear, selectedSection]);

  // تمام سؤالات سال انتخابی (بدون فیلتر درس) برای محاسبه کارنامه جامع سال
  const allQuestionsOfSelectedYear = useMemo(() => {
    return YEARLY_KONKOR_QUESTIONS.filter((q) => q.examYear === selectedYear).sort(
      (a, b) => a.bookletQuestionNumber - b.bookletQuestionNumber
    );
  }, [selectedYear]);

  // محاسبه کارنامه زنده کنکور برای سال انتخابی (با نمره منفی ۳ به ۱ و ضرایب گرایش)
  const examScoreReport = useMemo(() => {
    let totalAnswered = 0;
    let totalCorrect = 0;
    let totalWrong = 0;

    const sectionStats: Record<
      KonkorCourseSectionId,
      {
        title: string;
        coeff: number;
        total: number;
        answered: number;
        correct: number;
        wrong: number;
        rawPercent: number;
      }
    > = {} as any;

    for (const sec of KONKOR_COURSE_SECTIONS) {
      const rangeInfo = currentBooklet.subjectRanges.find((r) => r.sectionId === sec.id);
      const coeff =
        selectedBranch === 'business'
          ? rangeInfo?.coeffBusiness ?? 2
          : selectedBranch === 'industrial'
          ? rangeInfo?.coeffIndustrial ?? 2
          : rangeInfo?.coeffTechnology ?? 2;

      const secQuestions = allQuestionsOfSelectedYear.filter(
        (q) => q.courseSectionId === sec.id
      );
      let c = 0;
      let w = 0;
      for (const q of secQuestions) {
        const ans = userAnswers[q.id];
        if (ans !== undefined && ans !== null) {
          if (ans === q.correctOption) c++;
          else w++;
        }
      }
      const totalQ = secQuestions.length;
      const netPercent =
        totalQ > 0 ? Math.max(-33.3, ((c * 3 - w) / (totalQ * 3)) * 100) : 0;

      sectionStats[sec.id] = {
        title: sec.title,
        coeff,
        total: totalQ,
        answered: c + w,
        correct: c,
        wrong: w,
        rawPercent: Number(netPercent.toFixed(1)),
      };

      totalAnswered += c + w;
      totalCorrect += c;
      totalWrong += w;
    }

    let weightedSum = 0;
    let coeffSum = 0;
    Object.values(sectionStats).forEach((st) => {
      if (st.coeff > 0 && st.total > 0) {
        weightedSum += st.rawPercent * st.coeff;
        coeffSum += st.coeff;
      }
    });

    const weightedAveragePercent =
      coeffSum > 0 ? Number((weightedSum / coeffSum).toFixed(1)) : 0;

    return {
      totalQuestions: allQuestionsOfSelectedYear.length,
      totalAnswered,
      totalCorrect,
      totalWrong,
      weightedAveragePercent,
      sectionStats,
    };
  }, [allQuestionsOfSelectedYear, currentBooklet, selectedBranch, userAnswers]);

  // محاسبه تخمین رتبه، تراز و دانشگاه قبولی (هم برای پاسخ‌برگ زنده آزمون و هم برای شبیه‌ساز دستی)
  const rankPrediction = useMemo(() => {
    const courseInputs: CourseScoreInput[] = KONKOR_COURSE_SECTIONS.map((sec) => {
      const rangeInfo = currentBooklet.subjectRanges.find((r) => r.sectionId === sec.id);
      const coeff =
        selectedBranch === 'business'
          ? rangeInfo?.coeffBusiness ?? 2
          : selectedBranch === 'industrial'
          ? rangeInfo?.coeffIndustrial ?? 2
          : rangeInfo?.coeffTechnology ?? 2;

      if (predictorInputMode === 'live_exam') {
        const st = examScoreReport.sectionStats[sec.id];
        const tot = st?.total || 1;
        const c = st?.correct || 0;
        const w = st?.wrong || 0;
        const u = Math.max(0, tot - c - w);
        return {
          sectionId: sec.id,
          title: sec.title,
          coeff,
          totalQuestions: tot,
          correct: c,
          wrong: w,
          unanswered: u,
          netPercent: st?.rawPercent ?? 0,
        };
      } else {
        const totalInBooklet = rangeInfo?.count ?? 15;
        const rawC = customCounts[sec.id]?.correct ?? 0;
        const rawW = customCounts[sec.id]?.wrong ?? 0;
        const c = Math.min(totalInBooklet, Math.max(0, rawC));
        const w = Math.min(totalInBooklet - c, Math.max(0, rawW));
        const u = Math.max(0, totalInBooklet - c - w);
        const netPercent =
          totalInBooklet > 0
            ? Number(Math.max(-33.3, ((c * 3 - w) / (totalInBooklet * 3)) * 100).toFixed(1))
            : 0;
        return {
          sectionId: sec.id,
          title: sec.title,
          coeff,
          totalQuestions: totalInBooklet,
          correct: c,
          wrong: w,
          unanswered: u,
          netPercent,
        };
      }
    });

    return predictKonkorRankAndUniversity({
      year: selectedYear,
      branch: selectedBranch,
      degree: predictorDegree,
      courseInputs,
    });
  }, [
    currentBooklet,
    customCounts,
    examScoreReport,
    predictorDegree,
    predictorInputMode,
    selectedBranch,
    selectedYear,
  ]);

  const applyPresetToCustomCounts = (targetRank: 1 | 10) => {
    const profile =
      HISTORICAL_TOP_RANK_PROFILES.find(
        (p) =>
          p.branch === selectedBranch &&
          p.degree === predictorDegree &&
          p.nationalRank === targetRank
      ) ?? HISTORICAL_TOP_RANK_PROFILES[0];

    const nextCounts: Record<KonkorCourseSectionId, { correct: number; wrong: number }> =
      {} as any;
    for (const sec of KONKOR_COURSE_SECTIONS) {
      const rangeInfo = currentBooklet.subjectRanges.find((r) => r.sectionId === sec.id);
      const totalQ = rangeInfo?.count ?? 15;
      const targetPct = profile.coursePercentages[sec.id] ?? 0;
      if (targetPct <= 0) {
        nextCounts[sec.id] = { correct: 0, wrong: 0 };
      } else {
        const approxCorrect = Math.min(
          totalQ,
          Math.max(1, Math.round((targetPct / 100) * totalQ + 0.5))
        );
        const approxWrong = Math.min(totalQ - approxCorrect, 1);
        nextCounts[sec.id] = { correct: approxCorrect, wrong: approxWrong };
      }
    }
    setPredictorInputMode('custom_counts');
    setCustomCounts(nextCounts);
  };

  const handleSelectOption = (q: YearlyKonkorQuestion, optIdx: number) => {
    const alreadyAnswered = userAnswers[q.id] !== undefined && userAnswers[q.id] !== null;
    setUserAnswers((prev) => ({
      ...prev,
      [q.id]: optIdx,
    }));
    setRevealedQuestions((prev) => ({
      ...prev,
      [q.id]: true,
    }));
    if (!alreadyAnswered && onRecordQuestionAttempt) {
      onRecordQuestionAttempt(q, optIdx);
    }
  };

  const handleClearOption = (qId: string) => {
    setUserAnswers((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  const handleResetYearExam = () => {
    const nextAnswers = { ...userAnswers };
    const nextRevealed = { ...revealedQuestions };
    for (const q of allQuestionsOfSelectedYear) {
      delete nextAnswers[q.id];
      delete nextRevealed[q.id];
    }
    setUserAnswers(nextAnswers);
    setRevealedQuestions(nextRevealed);
    setActiveQuestionIndex(0);
    setIsTimerRunning(false);
    setRemainingSeconds((currentBooklet.durationMinutes || 150) * 60);
  };

  const handleDownloadYearBookletSummary = () => {
    const lines: string[] = [
      `# دفترچه تشریحی و کالبدشکافی کنکور کارشناسی ارشد مدیریت سال ${selectedYear}`,
      `- **کد دفترچه سازمان سنجش:** ${currentBooklet.bookletCode}`,
      `- **عنوان آزمون:** ${currentBooklet.examDateLabel}`,
      `- **تعداد کل سؤالات دفترچه:** ${currentBooklet.totalQuestionsInBooklet} سؤال (${currentBooklet.durationMinutes} دقیقه)`,
      ``,
      `## جدول بودجه‌بندی و شماره سؤالات دفترچه سال ${selectedYear}`,
      ...currentBooklet.subjectRanges.map(
        (r) =>
          `- **${r.title}:** از سؤال ${r.fromQuestion} تا ${r.toQuestion} (${r.count} سؤال) | ضریب بازرگانی: ${r.coeffBusiness} | ضریب صنعتی: ${r.coeffIndustrial} | ضریب تکنولوژی: ${r.coeffTechnology}`
      ),
      ``,
      `---`,
      `## سؤالات شناسنامه‌دار به ترتیب شماره دفترچه به همراه منبع طرح سؤال و پاسخ تشریحی`,
      ...allQuestionsOfSelectedYear.map(
        (q) =>
          `\n### سؤال شماره ${q.bookletQuestionNumber} دفترچه (${q.courseSectionTitle})\n- **منبع دقیق طرح سؤال:** ${q.designedFromTextbook}\n- **آدرس در دفترچه:** ${q.sourceReference}\n\n**صورت سؤال:**\n${q.text}\n\n**گزینه‌ها:**\n${q.options
            .map((opt, idx) => `${idx + 1}) ${opt}`)
            .join('\n')}\n\n- **گزینه صحیح:** گزینه ${q.correctOption + 1}\n- **پاسخ تشریحی کامل (مستخرج از منبع):** ${q.explanation}\n- **دام طراح کنکور:** ${q.trapNote}\n`
      ),
    ];

    const blob = new Blob([lines.join('\n')], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `konkor-arshad-modiriat-${selectedYear}-descriptive-key.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentQuestion = yearQuestions[activeQuestionIndex] ?? yearQuestions[0];

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 pb-20">
      {/* ۱. پنل یکپارچه انتخاب سال (۱۳۹۱ تا ۱۴۰۵)، گرایش و ابزارهای دفترچه */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                کنکور کارشناسی ارشد مدیریت سال {selectedYear}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                کد دفترچه {currentBooklet.bookletCode}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {currentBooklet.examDateLabel} · {currentBooklet.totalQuestionsInBooklet} سؤال در دفترچه اصلی
            </p>
          </div>

          {/* انتخاب گرایش برای ضرایب کارنامه */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[
              { id: 'business', label: 'بازرگانی' },
              { id: 'industrial', label: 'صنعتی' },
              { id: 'technology', label: 'تکنولوژی' },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onChangeBranch(b.id as MajorExamBranch)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selectedBranch === b.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* نوار فشرده ۱۵ سال کنکور (۱۳۹۱ تا ۱۴۰۵) */}
        <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-15 gap-1.5">
          {YEARLY_KONKOR_BOOKLETS.map((b) => {
            const isSelected = b.year === selectedYear;
            return (
              <button
                key={b.year}
                type="button"
                onClick={() => {
                  setSelectedYear(b.year);
                  setActiveQuestionIndex(0);
                }}
                className={`py-2 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                }`}
              >
                <div className="text-xs font-bold tabular-nums">{b.year}</div>
                <div
                  className={`text-[9px] font-mono ${
                    isSelected ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {b.bookletCode}
                </div>
              </button>
            );
          })}
        </div>

        {/* نوار فیلتر دروس به ترتیب شماره دفترچه */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setSelectedSection('all');
              setActiveQuestionIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              selectedSection === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            همه دروس ({allQuestionsOfSelectedYear.length})
          </button>

          {currentBooklet.subjectRanges.map((range) => {
            const isSelectedSec = selectedSection === range.sectionId;
            const activeCoeff =
              selectedBranch === 'business'
                ? range.coeffBusiness
                : selectedBranch === 'industrial'
                ? range.coeffIndustrial
                : range.coeffTechnology;

            return (
              <button
                key={range.sectionId}
                type="button"
                onClick={() => {
                  setSelectedSection(
                    selectedSection === range.sectionId ? 'all' : range.sectionId
                  );
                  setActiveQuestionIndex(0);
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelectedSec
                    ? 'bg-blue-600 text-white border-blue-500 font-bold'
                    : activeCoeff === 0
                    ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 text-slate-400'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                }`}
              >
                <span>{range.title}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded ${
                    isSelectedSec
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  س{range.fromQuestion}-{range.toQuestion} · ض{activeCoeff}
                </span>
              </button>
            );
          })}
        </div>

        {/* نوار وضعیت کارنامه، تایمر آزمون، تغییر حالت نمایش و دانلود PDF */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
          {/* تغییر حالت نمایش */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'simulator', label: 'شبیه‌ساز تعاملی', icon: Award },
              { id: 'descriptive', label: 'پاسخنامه تشریحی یکجا', icon: BookOpen },
              {
                id: 'rank_predictor',
                label: 'تخمین رتبه، تراز و دانشگاه + کارنامه نفر اول',
                icon: Calculator,
              },
              { id: 'pdf_split', label: 'دفترچه PDF اصلی', icon: Eye },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    viewMode === m.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowBudgetTable((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>جدول بودجه‌بندی</span>
              {showBudgetTable ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* تایمر و اکشن‌های سریع */}
          <div className="flex flex-wrap items-center gap-2">
            {/* تایمر شبیه‌ساز کنکور */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-200">
                {formatTimer(remainingSeconds)}
              </span>
              <button
                type="button"
                onClick={() => setIsTimerRunning((prev) => !prev)}
                className="p-1 rounded bg-blue-600/15 text-blue-600 dark:text-blue-400 hover:bg-blue-600/25 cursor-pointer"
                title={isTimerRunning ? 'توقف تایمر' : 'شروع تایمر جلسه کنکور'}
              >
                {isTimerRunning ? (
                  <Pause className="w-3 h-3" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => onStartYearAdaptiveSession(selectedYear, selectedSection)}
              className="px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>ارسال به مرور تطبیقی</span>
            </button>

            <a
              href={currentBooklet.pdfAssetUrl}
              download={`Konkor_Arshad_Modiriat_${selectedYear}_${currentBooklet.bookletCode}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF اصلی {selectedYear}</span>
            </a>

            <button
              type="button"
              onClick={handleDownloadYearBookletSummary}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="دانلود فایل Markdown کلید و پاسخنامه تشریحی"
            >
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">کلید تشریحی (.md)</span>
            </button>
          </div>
        </div>

        {/* جدول بازشونده جزئیات بودجه‌بندی و درصد هر درس */}
        {showBudgetTable && (
          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {currentBooklet.subjectRanges.map((range) => {
              const secStats = examScoreReport.sectionStats[range.sectionId];
              const activeCoeff =
                selectedBranch === 'business'
                  ? range.coeffBusiness
                  : selectedBranch === 'industrial'
                  ? range.coeffIndustrial
                  : range.coeffTechnology;

              return (
                <div
                  key={range.sectionId}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {range.title}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                      ضریب {activeCoeff}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    سؤال {range.fromQuestion} تا {range.toQuestion} دفترچه ({range.count} تست)
                  </div>
                  {secStats && secStats.answered > 0 && (
                    <div className="mt-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] tabular-nums">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {secStats.correct} درست · {secStats.wrong} غلط
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {secStats.rawPercent}٪
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* نوار خلاصه کارنامه زنده + تخمین فوری رتبه و دانشگاه */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 tabular-nums">
          <span className="text-slate-600 dark:text-slate-400">
            پاسخ‌برگ {selectedYear}:{' '}
            <strong className="text-slate-900 dark:text-white">
              {examScoreReport.totalAnswered} از {examScoreReport.totalQuestions}
            </strong>
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            {examScoreReport.totalCorrect} صحیح
          </span>
          <span className="text-rose-600 dark:text-rose-400 font-bold">
            {examScoreReport.totalWrong} غلط
          </span>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            میانگین وزنی: {examScoreReport.weightedAveragePercent}٪
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (examScoreReport.totalAnswered > 0) {
                setPredictorInputMode('live_exam');
              }
              setViewMode('rank_predictor');
            }}
            className="px-3 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>محاسبه دقیق رتبه، تراز و دانشگاه قبولی + مقایسه با نفر اول کنکور ←</span>
          </button>

          {examScoreReport.totalAnswered > 0 && (
            <button
              type="button"
              onClick={handleResetYearExam}
              className="px-2.5 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>پاک کردن پاسخ‌برگ</span>
            </button>
          )}
        </div>
      </div>

      {/* ۲. حالت اول: شبیه‌ساز تعاملی گام‌به‌گام به ترتیب شماره دفترچه */}
      {viewMode === 'simulator' && currentQuestion && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ستون سمت راست: ناوبری شماره‌های دفترچه */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                پاسخ‌برگ کنکور {selectedYear} (به ترتیب دفترچه)
              </h3>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {yearQuestions.length} سؤال
              </span>
            </div>

            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pl-1">
              {yearQuestions.map((q, idx) => {
                const ans = userAnswers[q.id];
                const isAnswered = ans !== undefined && ans !== null;
                const isCorrect = isAnswered && ans === q.correctOption;
                const isActive = idx === activeQuestionIndex;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setActiveQuestionIndex(idx)}
                    className={`w-full p-2.5 rounded-xl border text-right transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/10 border-blue-500 text-slate-900 dark:text-white font-bold'
                        : isAnswered
                        ? isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                          : 'bg-rose-500/10 border-rose-500/40 text-rose-900 dark:text-rose-200'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-[11px] font-mono font-bold tabular-nums shrink-0">
                        سؤال {q.bookletQuestionNumber}
                      </span>
                      <span className="text-xs truncate">{q.courseSectionTitle}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isAnswered ? (
                        isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-500" />
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400">نزده</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ستون سمت چپ: کارت سؤال فعال + منبع دقیق طرح سؤال + پاسخ تشریحی کامل */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 space-y-5">
            {/* نوار شناسنامه سؤال در دفترچه */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-200/70 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold tabular-nums">
                  سؤال شماره {currentQuestion.bookletQuestionNumber} دفترچه {currentQuestion.examYear}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    currentQuestion.examLevel === 'دکتری'
                      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {currentQuestion.examLevel === 'دکتری' ? 'کنکور دکتری تخصصی' : 'کنکور کارشناسی ارشد'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold">
                  {currentQuestion.courseSectionTitle}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onOpenLessonNode(currentQuestion.nodeId)}
                className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>درسنامه این مبحث</span>
              </button>
            </div>

            {/* کادر مشخص‌کننده اینکه این سؤال کنکور دقیقاً از کجا طراحی شده است */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="text-slate-700 dark:text-slate-300 leading-6">
                <strong className="text-blue-700 dark:text-blue-300 inline-flex items-center gap-1 ml-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>منبع طرح سؤال:</span>
                </strong>
                {currentQuestion.designedFromTextbook}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {currentQuestion.sourceReference}
              </span>
            </div>

            {/* صورت سؤال */}
            <div className="text-base font-medium text-slate-900 dark:text-slate-100 leading-8">
              <MathText text={currentQuestion.text} />
            </div>

            {/* گزینه‌های چهارگانه */}
            <div className="space-y-2.5">
              {currentQuestion.options.map((opt, optIdx) => {
                const selectedOpt = userAnswers[currentQuestion.id];
                const isRevealed = !!revealedQuestions[currentQuestion.id];
                const isSelected = selectedOpt === optIdx;
                const isCorrect = optIdx === currentQuestion.correctOption;

                let style =
                  'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-blue-500 text-slate-800 dark:text-slate-200';
                if (isRevealed) {
                  if (isCorrect) {
                    style =
                      'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold';
                  } else if (isSelected && !isCorrect) {
                    style =
                      'bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-100';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectOption(currentQuestion, optIdx)}
                    className={`w-full text-right p-4 rounded-xl border text-sm leading-7 transition-all flex items-start justify-between gap-3 cursor-pointer ${style}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                        {optIdx + 1}
                      </span>
                      <span>
                        <MathText text={opt} />
                      </span>
                    </div>
                    {isRevealed && isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-1" />
                    )}
                    {isRevealed && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* دکمه‌های نمایش پاسخ تشریحی و حرکت بین سؤالات به ترتیب دفترچه */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRevealedQuestions((prev) => ({
                      ...prev,
                      [currentQuestion.id]: !prev[currentQuestion.id],
                    }))
                  }
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {revealedQuestions[currentQuestion.id]
                    ? 'پنهان کردن پاسخ تشریحی'
                    : 'نمایش کلید و پاسخ تشریحی'}
                </button>

                {userAnswers[currentQuestion.id] !== undefined && (
                  <button
                    type="button"
                    onClick={() => handleClearOption(currentQuestion.id)}
                    className="px-2.5 py-2 rounded-xl text-xs text-slate-500 hover:text-rose-500 cursor-pointer"
                  >
                    ثبت به عنوان نزده
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeQuestionIndex === 0}
                  onClick={() => setActiveQuestionIndex((i) => Math.max(0, i - 1))}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  سؤال قبلی
                </button>
                <button
                  type="button"
                  disabled={activeQuestionIndex + 1 >= yearQuestions.length}
                  onClick={() =>
                    setActiveQuestionIndex((i) =>
                      Math.min(yearQuestions.length - 1, i + 1)
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  سؤال بعدی در دفترچه ←
                </button>
              </div>
            </div>

            {/* پاسخ تشریحی کامل مستخرج از کتب مرجع کنکور + دام طراح + خلاصه درسنامه مرتبط */}
            {revealedQuestions[currentQuestion.id] && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="p-4 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/25 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      <span>
                        پاسخ تشریحی کامل (گزینه صحیح: گزینه {currentQuestion.correctOption + 1})
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      منبع: {currentQuestion.designedFromTextbook}
                    </span>
                  </div>
                  <div className="text-xs text-slate-800 dark:text-slate-200 leading-7 whitespace-pre-line">
                    <MathText text={currentQuestion.explanation} />
                  </div>
                </div>

                {currentQuestion.trapNote && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                    <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>دام طراح کنکور:</span>
                    </div>
                    <div className="text-amber-950 dark:text-amber-100 leading-6">
                      <MathText text={currentQuestion.trapNote} />
                    </div>
                  </div>
                )}

                {lessons[currentQuestion.nodeId] && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>
                        نکات کلیدی مبحث ({lessons[currentQuestion.nodeId].topic}):
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenLessonNode(currentQuestion.nodeId)}
                        className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        مطالعه کامل درسنامه ←
                      </button>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-6">
                      <MathText text={lessons[currentQuestion.nodeId].summary} />
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ۳. حالت دوم: لیست کامل و پشت‌سرهم تمام سؤالات سال انتخابی به همراه پاسخ تشریحی */}
      {viewMode === 'descriptive' && (
        <div className="space-y-4">
          {yearQuestions.map((q) => {
            const node = nodes.find((n) => n.id === q.nodeId);
            return (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold tabular-nums">
                      سؤال شماره {q.bookletQuestionNumber} دفترچه کنکور {q.examYear}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold">
                      {q.courseSectionTitle}
                    </span>
                    {node && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                        {node.topic}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenLessonNode(q.nodeId)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>درسنامه مبحث</span>
                  </button>
                </div>

                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  <strong>منبع طرح سؤال:</strong> {q.designedFromTextbook} ({q.sourceReference})
                </div>

                <div className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-8">
                  <MathText text={q.text} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.options.map((opt, idx) => {
                    const isCorrect = idx === q.correctOption;
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs leading-6 flex items-start gap-2.5 ${
                          isCorrect
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold'
                            : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center shrink-0 font-bold tabular-nums">
                          {idx + 1}
                        </span>
                        <span className="flex-1">
                          <MathText text={opt} />
                        </span>
                        {isCorrect && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 text-xs space-y-2">
                  <div className="font-bold text-blue-800 dark:text-blue-300">
                    پاسخ تشریحی کامل (گزینه {q.correctOption + 1}):
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 leading-7 whitespace-pre-line">
                    <MathText text={q.explanation} />
                  </div>
                  {q.trapNote && (
                    <div className="pt-2 border-t border-blue-500/20 text-amber-800 dark:text-amber-300">
                      <strong>دام طراح کنکور:</strong> <MathText text={q.trapNote} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ۴. حالت سوم: مشاهده مستقیم فایل PDF دفترچه اصلی کنکور در کنار تست‌های تعاملی همان سال */}
      {viewMode === 'pdf_split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-500" />
                <span>
                  فایل PDF دفترچه اصلی کنکور مدیریت سال {selectedYear} (کد{' '}
                  {currentBooklet.bookletCode})
                </span>
              </h3>
              <a
                href={currentBooklet.pdfAssetUrl}
                download={`Konkor_Arshad_Modiriat_${selectedYear}_${currentBooklet.bookletCode}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود فایل PDF</span>
              </a>
            </div>
            <iframe
              src={currentBooklet.pdfAssetUrl}
              title={`دفترچه کنکور مدیریت سال ${selectedYear}`}
              className="w-full h-[680px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950"
            />
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 max-h-[740px] overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white sticky top-0 bg-white dark:bg-slate-900 py-2 border-b border-slate-200 dark:border-slate-800">
              کلید، منبع طرح سؤال و پاسخ تشریحی سؤالات منتخب سال {selectedYear}
            </h3>
            {yearQuestions.map((q) => (
              <div
                key={q.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-blue-600 dark:text-blue-400">
                    سؤال شماره {q.bookletQuestionNumber} ({q.courseSectionTitle})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    کلید: گزینه {q.correctOption + 1}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  <strong>منبع طراحی:</strong> {q.designedFromTextbook}
                </div>
                <div className="text-slate-800 dark:text-slate-200 leading-6">
                  <MathText text={q.text} />
                </div>
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-300 leading-6">
                  <strong>پاسخ تشریحی:</strong> <MathText text={q.explanation} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ۵. حالت چهارم: موتور کالیبره‌شده تخمین رتبه، تراز، دانشگاه قبولی و مقایسه با کارنامه نفر اول کنکور */}
      {viewMode === 'rank_predictor' && (
        <div className="space-y-5">
          {/* هدر و تنظیمات ورودی موتور تخمین رتبه */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>
                    موتور تخمین رتبه، تراز و دانشگاه قبولی کنکور سال {selectedYear} (کالیبره‌شده با کارنامه نفر اول)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  بر اساس ضرایب رسمی گرایش{' '}
                  {selectedBranch === 'business'
                    ? 'مدیریت بازرگانی'
                    : selectedBranch === 'industrial'
                    ? 'مدیریت صنعتی'
                    : 'مدیریت تکنولوژی'}
                  ، نمره منفی یک‌سوم ($-1/3$) و ضریب سختی سال {selectedYear} (
                  {
                    YEAR_DIFFICULTY_CALIBRATIONS.find((y) => y.year === selectedYear)
                      ?.difficultyLabel
                  }
                  )
                </p>
              </div>

              {/* انتخاب مقطع (ارشد / دکتری) و منبع درصدها */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPredictorDegree('master')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      predictorDegree === 'master'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    کارشناسی ارشد (کد ۱۱۴۲)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPredictorDegree('phd')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      predictorDegree === 'phd'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    دکتری تخصصی (PhD)
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPredictorInputMode('custom_counts')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      predictorInputMode === 'custom_counts'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    ورود دستی صحیح / غلط
                  </button>
                  <button
                    type="button"
                    onClick={() => setPredictorInputMode('live_exam')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      predictorInputMode === 'live_exam'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    از پاسخ‌برگ آزمون ({examScoreReport.totalAnswered} تست)
                  </button>
                </div>
              </div>
            </div>

            {/* دکمه‌های شبیه‌سازی سریع کارنامه رتبه ۱ و رتبه ۱۰ کشوری */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-800 text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                بارگذاری سریع کارنامه‌های معیار سازمان سنجش:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyPresetToCustomCounts(1)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold cursor-pointer"
                >
                  بارگذاری کارنامه رتبه ۱ کشوری
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetToCustomCounts(10)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-bold cursor-pointer"
                >
                  بارگذاری کارنامه رتبه ۱۰ (قبولی روزانه دانشگاه تهران)
                </button>
              </div>
            </div>

            {/* کارت‌های خروجی کلیدی: رتبه کشوری، تراز کل، میانگین وزنی و دانشگاه قبولی */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-blue-600 text-white space-y-1">
                <div className="text-[11px] text-blue-100">رتبه کشوری تخمینی (سهمیه آزاد)</div>
                <div className="text-2xl font-black tabular-nums">
                  رتبه {rankPrediction.estimatedRank}
                </div>
                <div className="text-[11px] text-blue-100 tabular-nums">
                  بازه اطمینان ۹۹٪: رتبه {rankPrediction.rankRangeMin} تا{' '}
                  {rankPrediction.rankRangeMax} (صدک {rankPrediction.percentile}٪)
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white space-y-1">
                <div className="text-[11px] text-slate-300">
                  تراز کل کالیبره‌شده (از {rankPrediction.maxTarazScale.toLocaleString('fa-IR')})
                </div>
                <div className="text-2xl font-black tabular-nums text-amber-400">
                  {rankPrediction.scaledTaraz.toLocaleString('fa-IR')}
                </div>
                <div className="text-[11px] text-slate-300 tabular-nums">
                  تراز رتبه ۱ کشوری:{' '}
                  {rankPrediction.top1RankComparison.totalTaraz.toLocaleString('fa-IR')}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  میانگین وزنی کل (با نمره منفی)
                </div>
                <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                  {rankPrediction.weightedAveragePercent}٪
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  میانگین وزنی نفر اول: {rankPrediction.top1RankComparison.weightedAveragePercent}٪
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1">
                  <GraduationCap className="w-4 h-4" />
                  <span>بهترین دانشگاه محل قبولی:</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-100 leading-6">
                  {rankPrediction.bestMatchedUniversity}
                </div>
              </div>
            </div>

            {/* توصیه استراتژیک هوشمند */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-2 leading-6">
              <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-1" />
              <div>
                <strong>تحلیل استراتژیک کارنامه شما: </strong>
                {rankPrediction.strategicAdvice}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ستون راست (۷ ستون): جدول ورود تعداد صحیح/غلط/نزده و مقایسه درس‌به‌درس با کارنامه نفر اول */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  جدول تعداد صحیح، غلط، نزده و مقایسه با درصد نفر اول و دهم کنکور
                </h3>
                <span className="text-[11px] text-slate-500">
                  فرمول درصد خالص: $\frac&#123;3C - W&#125;&#123;3N&#125; \times 100$
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-2.5 font-bold">درس (ضریب)</th>
                      <th className="p-2.5 font-bold text-center">تعداد کل</th>
                      <th className="p-2.5 font-bold text-center text-emerald-600">صحیح</th>
                      <th className="p-2.5 font-bold text-center text-rose-600">غلط</th>
                      <th className="p-2.5 font-bold text-center">نزده</th>
                      <th className="p-2.5 font-bold text-center text-blue-600">درصد شما</th>
                      <th className="p-2.5 font-bold text-center text-amber-600">درصد نفر اول</th>
                      <th className="p-2.5 font-bold text-center">درصد رتبه ۱۰</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 tabular-nums">
                    {KONKOR_COURSE_SECTIONS.map((sec) => {
                      const rangeInfo = currentBooklet.subjectRanges.find(
                        (r) => r.sectionId === sec.id
                      );
                      const totalQ =
                        predictorInputMode === 'live_exam'
                          ? examScoreReport.sectionStats[sec.id]?.total || 1
                          : rangeInfo?.count ?? 15;
                      const coeff =
                        selectedBranch === 'business'
                          ? rangeInfo?.coeffBusiness ?? 2
                          : selectedBranch === 'industrial'
                          ? rangeInfo?.coeffIndustrial ?? 2
                          : rangeInfo?.coeffTechnology ?? 2;

                      const breakdownRow = rankPrediction.courseBreakdown.find(
                        (b) => b.sectionId === sec.id
                      );

                      const curC =
                        predictorInputMode === 'live_exam'
                          ? examScoreReport.sectionStats[sec.id]?.correct ?? 0
                          : customCounts[sec.id]?.correct ?? 0;
                      const curW =
                        predictorInputMode === 'live_exam'
                          ? examScoreReport.sectionStats[sec.id]?.wrong ?? 0
                          : customCounts[sec.id]?.wrong ?? 0;
                      const curU = Math.max(0, totalQ - curC - curW);

                      return (
                        <tr
                          key={sec.id}
                          className={
                            coeff === 0
                              ? 'opacity-45 bg-slate-50/40 dark:bg-slate-900/40'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }
                        >
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                            <div>{sec.title}</div>
                            <span className="text-[10px] font-normal text-slate-500">
                              ضریب {coeff} {coeff === 0 ? '(عدم تأثیر)' : ''}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-mono">{totalQ}</td>
                          <td className="p-2.5 text-center">
                            {predictorInputMode === 'custom_counts' ? (
                              <input
                                type="number"
                                min={0}
                                max={totalQ}
                                value={curC}
                                onChange={(e) => {
                                  const val = Math.min(
                                    totalQ,
                                    Math.max(0, Number(e.target.value) || 0)
                                  );
                                  setCustomCounts((prev) => ({
                                    ...prev,
                                    [sec.id]: {
                                      correct: val,
                                      wrong: Math.min(totalQ - val, prev[sec.id]?.wrong ?? 0),
                                    },
                                  }));
                                }}
                                className="w-14 px-1.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/5 text-center font-bold text-emerald-700 dark:text-emerald-300"
                              />
                            ) : (
                              <span className="font-bold text-emerald-600">{curC}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {predictorInputMode === 'custom_counts' ? (
                              <input
                                type="number"
                                min={0}
                                max={Math.max(0, totalQ - curC)}
                                value={curW}
                                onChange={(e) => {
                                  const val = Math.min(
                                    Math.max(0, totalQ - curC),
                                    Math.max(0, Number(e.target.value) || 0)
                                  );
                                  setCustomCounts((prev) => ({
                                    ...prev,
                                    [sec.id]: {
                                      correct: prev[sec.id]?.correct ?? 0,
                                      wrong: val,
                                    },
                                  }));
                                }}
                                className="w-14 px-1.5 py-1 rounded-lg border border-rose-500/40 bg-rose-500/5 text-center font-bold text-rose-700 dark:text-rose-300"
                              />
                            ) : (
                              <span className="font-bold text-rose-600">{curW}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-slate-500">{curU}</td>
                          <td className="p-2.5 text-center font-bold text-blue-600 dark:text-blue-400">
                            {breakdownRow?.userPercent ?? 0}٪
                          </td>
                          <td className="p-2.5 text-center font-bold text-amber-600 dark:text-amber-400">
                            {breakdownRow?.rank1Percent ?? 0}٪
                          </td>
                          <td className="p-2.5 text-center text-slate-600 dark:text-slate-300">
                            {breakdownRow?.rank10Percent ?? 0}٪
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ستون چپ (۵ ستون): جدول شانس قبولی در دانشگاه‌های برتر کشور */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-emerald-500" />
                <span>وضعیت قبولی شما در دانشگاه‌های کشور با تراز {rankPrediction.scaledTaraz}</span>
              </h3>

              <div className="space-y-2.5">
                {rankPrediction.universityAdmissions.map((ua) => {
                  const isAdmitted = ua.status === 'قبولی قطعی (احتمال > ۹۵٪)';
                  const isBorderline = ua.status === 'قبولی محتمل / مرزی (احتمال ۶۰٪ تا ۹۰٪)';
                  const minRequired =
                    predictorDegree === 'master'
                      ? ua.tier.minTarazMaster
                      : ua.tier.minTarazPhd;

                  return (
                    <div
                      key={ua.tier.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                        isAdmitted
                          ? 'bg-emerald-500/10 border-emerald-500/40'
                          : isBorderline
                          ? 'bg-amber-500/10 border-amber-500/40'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {ua.tier.universityName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            isAdmitted
                              ? 'bg-emerald-600 text-white'
                              : isBorderline
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {ua.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        {ua.tier.programs}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 tabular-nums">
                        <span>کف تراز لازم: {minRequired}</span>
                        <span>
                          {ua.tarazGap >= 0
                            ? `+${ua.tarazGap} تراز بالاتر از کف قبولی`
                            : `${Math.abs(ua.tarazGap)} تراز کمتر از کف قبولی`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
