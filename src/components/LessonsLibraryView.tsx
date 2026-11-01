import React, { useState, useEffect, useRef } from 'react';
import {
  KnowledgeNode,
  InteractiveLesson,
  QuestionItem,
  COMPARISON_TABLES,
  TrackId,
  CENTRALIZED_100PAGE_COURSE_CATALOG,
  generateCentralized100PageCourseMarkdown,
} from '../data/konkorData';
import {
  REFERENCE_BOOKS_DATABASE,
  MANAGEMENT_BRANCH_META,
  MASTER_1142_COEFFICIENTS_TABLE,
  ManagementBranchId,
  generateBookHandoutMarkdown,
  generateAllBooksMasterHandoutMarkdown,
} from '../data/referenceBooksRepo';
import {
  LearnerSixDState,
  MultiYearFrequencyInsight,
} from '../engine/aelEngine';
import { MathText } from './MathText';
import { TopicDiagramVisualizer } from './TopicDiagramVisualizer';
import { LessonDeepDivePanel } from './LessonDeepDivePanel';
import { getLessonDeepDive, getDeepDiveWordCount } from '../data/lessonDeepDives';
import { getBookForNode } from '../data/bookChaptersRepo';
import {
  EXAM_YEAR_STRUCTURES,
  LATEST_EXAM_YEAR,
  MANAGEMENT_EXAM_SET,
  MANAGEMENT_SUB_GROUPS,
  getExamStructure,
  getExamStructureWarnings,
  getSpecializationSharePercent,
  getSubGroupSubjects,
} from '../data/examStructure';
import { BookLibraryView } from './BookLibraryView';

/** تبدیل ارقام لاتین به فارسی برای نمایش در رابط کاربری */
const toPersianDigits = (value: string): string =>
  value
    .replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
    .replace(/\./g, '٫');
import {
  BookOpen,
  Scale,
  ShieldAlert,
  Play,
  Target,
  CheckCircle2,
  Sparkles,
  Search,
  Layers,
  Flame,
  Star,
  Library,
  FileText,
  HelpCircle,
  Award,
  ArrowLeft,
  GraduationCap,
  Eye,
} from 'lucide-react';

interface LessonsLibraryViewProps {
  nodes: KnowledgeNode[];
  lessons: Record<string, InteractiveLesson>;
  questions?: QuestionItem[];
  nodeStates: Record<string, LearnerSixDState>;
  examFrequencyMap: Record<string, MultiYearFrequencyInsight>;
  initialSelectedNodeId?: string | null;
  onRateLessonUnderstanding: (nodeId: string, rating: 1 | 2 | 3 | 4 | 5) => string;
  onStartPracticeNode: (nodeId: string, mode: 'practice' | 'proof' | 'remedial') => void;
}

const RATING_OPTIONS: {
  rating: 1 | 2 | 3 | 4 | 5;
  label: string;
  desc: string;
  colorClass: string;
}[] = [
  {
    rating: 1,
    label: '۱ — اصلاً متوجه نشدم',
    desc: 'نیاز به بازخوانی پیش‌نیاز پایه (تعلیق تست‌های سخت)',
    colorClass: 'hover:border-rose-500 data-[active=true]:bg-rose-600 data-[active=true]:text-white',
  },
  {
    rating: 2,
    label: '۲ — ابهام دارم',
    desc: 'افزودن جدول مقایسه و دام طراح پیش از تست',
    colorClass: 'hover:border-orange-500 data-[active=true]:bg-orange-500 data-[active=true]:text-white',
  },
  {
    rating: 3,
    label: '۳ — درک متوسط',
    desc: 'فعال‌سازی تست‌های آموزشی در صف امروز — تسلط با پاسخ درست ساخته می‌شود',
    colorClass: 'hover:border-amber-500 data-[active=true]:bg-amber-500 data-[active=true]:text-slate-950',
  },
  {
    rating: 4,
    label: '۴ — خوب یاد گرفتم',
    desc: 'باز شدن لایه بعدی درخت مهارت + مرور ۴ روزه',
    colorClass: 'hover:border-blue-500 data-[active=true]:bg-blue-600 data-[active=true]:text-white',
  },
  {
    rating: 5,
    label: '۵ — کاملاً فهمیدم',
    desc: 'باز شدن فوری تست قرنطینه برای اثبات تسلط',
    colorClass: 'hover:border-emerald-500 data-[active=true]:bg-emerald-600 data-[active=true]:text-white',
  },
];

export const LessonsLibraryView: React.FC<LessonsLibraryViewProps> = ({
  nodes,
  lessons,
  questions = [],
  nodeStates,
  examFrequencyMap,
  initialSelectedNodeId,
  onRateLessonUnderstanding,
  onStartPracticeNode,
}) => {
  const [librarySection, setLibrarySection] = useState<
    'books' | 'interactive_lessons' | 'reference_books' | 'compendium_100p' | 'coefficients_table'
  >('books');
  const [bookPresetId, setBookPresetId] = useState<string | null>(null);
  const lastRequestedLesson = useRef<string | null>(initialSelectedNodeId ?? null);
  const [selectedBranch, setSelectedBranch] = useState<ManagementBranchId>('business');
  const [degreeFilter, setDegreeFilter] = useState<'all' | 'master' | 'phd'>('all');
  const [selectedBookId, setSelectedBookId] = useState<string>('book.bus.kotler_jalilian');
  const [selectedQuestionAnswers, setSelectedQuestionAnswers] = useState<Record<string, number>>({});
  const [testBankViewMode, setTestBankViewMode] = useState<'interactive' | 'descriptive'>('descriptive');
  const [selected100PageCourseId, setSelected100PageCourseId] = useState<string>(
    CENTRALIZED_100PAGE_COURSE_CATALOG[0]?.courseId || 'course.100p.management_theories'
  );
  // ساختار آزمون دکتری بر اساس سال نسخه‌بندی می‌شود؛ پیش‌فرض روی آخرین سال ثبت‌شده است.
  const [examYear, setExamYear] = useState<number>(LATEST_EXAM_YEAR);
  const [structureGroupId, setStructureGroupId] = useState<string>('business');

  const [selectedTrack, setSelectedTrack] = useState<'all' | TrackId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNodeId, setActiveNodeId] = useState<string>(
    initialSelectedNodeId || 'mb.structure'
  );
  const [unlockedStepCount, setUnlockedStepCount] = useState<number>(3);
  const [revealedCards, setRevealedCards] = useState<Record<number, boolean>>({});
  const [conceptChoice, setConceptChoice] = useState<number | null>(null);
  const [ratingFeedback, setRatingFeedback] = useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  useEffect(() => {
    // فقط وقتی درخواست تازه‌ای از بیرون می‌رسد به درس‌نامه بپر؛ ورود عادی به کتابخانه،
    // صفحهٔ «کتاب‌ها» را نشان می‌دهد.
    if (initialSelectedNodeId && initialSelectedNodeId !== lastRequestedLesson.current) {
      setActiveNodeId(initialSelectedNodeId);
      setLibrarySection('interactive_lessons');
    }
    lastRequestedLesson.current = initialSelectedNodeId ?? null;
  }, [initialSelectedNodeId]);

  useEffect(() => {
    setConceptChoice(null);
    setRatingFeedback(null);
    setRevealedCards({});
    setUnlockedStepCount(3);
  }, [activeNodeId]);

  const isBookInBranch = (b: (typeof REFERENCE_BOOKS_DATABASE)[number], branch: ManagementBranchId) =>
    b.branches ? b.branches.includes(branch) : b.branch === branch;

  const branchBooks = REFERENCE_BOOKS_DATABASE.filter((b) => {
    if (!isBookInBranch(b, selectedBranch)) return false;
    if (degreeFilter === 'master') {
      return b.targetLevel === 'ارشد و دکتری' || b.targetLevel === 'ویژه کارشناسی ارشد';
    }
    if (degreeFilter === 'phd') {
      return b.targetLevel === 'ارشد و دکتری' || b.targetLevel === 'ویژه دکتری تخصصی';
    }
    return true;
  }).sort((a, b) => {
    const rankA = a.branchSpecificMeta?.[selectedBranch]?.orderRank ?? 99;
    const rankB = b.branchSpecificMeta?.[selectedBranch]?.orderRank ?? 99;
    return rankA - rankB;
  });

  const activeBook =
    branchBooks.find((b) => b.id === selectedBookId) ||
    branchBooks[0] ||
    REFERENCE_BOOKS_DATABASE[0];

  const handleSelectBranch = (branch: ManagementBranchId) => {
    setSelectedBranch(branch);
    const matching = REFERENCE_BOOKS_DATABASE.filter((b) => isBookInBranch(b, branch)).sort(
      (a, b) =>
        (a.branchSpecificMeta?.[branch]?.orderRank ?? 99) -
        (b.branchSpecificMeta?.[branch]?.orderRank ?? 99)
    );
    if (matching[0]) {
      setSelectedBookId(matching[0].id);
    }
  };

  const filteredNodes = nodes.filter((node) => {
    const matchesTrack = selectedTrack === 'all' || node.track === selectedTrack;
    const matchesSearch =
      !searchQuery.trim() ||
      node.topic.includes(searchQuery) ||
      node.course.includes(searchQuery) ||
      node.chapter.includes(searchQuery);
    return matchesTrack && matchesSearch && lessons[node.id];
  });

  const activeNode =
    nodes.find((n) => n.id === activeNodeId) ??
    filteredNodes[0] ??
    nodes[0];
  const activeLesson = lessons[activeNode.id];
  const activeDive = getLessonDeepDive(activeNode.id);
  const activeDiveWords = getDeepDiveWordCount(activeDive);
  const activeState = nodeStates[activeNode.id];
  const freqInsight = examFrequencyMap[activeNode.id];
  const relatedComparison =
    COMPARISON_TABLES[activeNode.id] ||
    Object.values(COMPARISON_TABLES).find((c) => c.nodeB === activeNode.id);

  const activeIndex = filteredNodes.findIndex((n) => n.id === activeNode.id);
  const prevNode = activeIndex > 0 ? filteredNodes[activeIndex - 1] : null;
  const nextNode =
    activeIndex >= 0 && activeIndex < filteredNodes.length - 1
      ? filteredNodes[activeIndex + 1]
      : null;

  const handleRatingClick = (rating: 1 | 2 | 3 | 4 | 5) => {
    const summaryMsg = onRateLessonUnderstanding(activeNode.id, rating);
    setRatingFeedback(summaryMsg);
  };

  return (
    <div className="space-y-5">
      {/* نوار ۴ تبی بخش‌بندی تمیز کتابخانه و منابع */}
      <div className="bento-card glass-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="tab-strip" role="tablist" aria-label="بخش‌های درسنامه‌ها و منابع">
          {[
            {
              id: 'books' as const,
              label: 'کتاب‌ها و فصل‌ها',
              icon: Library,
            },
            {
              id: 'interactive_lessons' as const,
              label: `درس‌نامه‌ها (${nodes.length.toLocaleString('fa-IR')})`,
              icon: BookOpen,
            },
            {
              id: 'reference_books' as const,
              label: 'کتب مرجع',
              icon: Library,
            },
            {
              id: 'compendium_100p' as const,
              label: 'مجلدات ۱۰۰ص',
              icon: Layers,
            },
            {
              id: 'coefficients_table' as const,
              label: 'ضرایب ۱۱۴۲',
              icon: Scale,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = librarySection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setLibrarySection(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'glass-subcard text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* فیلتر مقطع تحصیلی و دکمه دانلود در تب کتب مرجع */}
        {librarySection === 'reference_books' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLibrarySection('compendium_100p')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>مطالعه دایره‌المعارف ۱۰۰ صفحه‌ای دروس</span>
            </button>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {[
                { id: 'all', label: 'همه مقاطع' },
                { id: 'master', label: 'ارشد' },
                { id: 'phd', label: 'دکتری' },
              ].map((deg) => (
                <button
                  key={deg.id}
                  type="button"
                  onClick={() => setDegreeFilter(deg.id as 'all' | 'master' | 'phd')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    degreeFilter === deg.id
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {deg.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* تب کتاب‌محور: کتاب ← فصل ← آموزش ← تست */}
      {librarySection === 'books' && (
        <BookLibraryView
          questions={questions}
          initialBookId={bookPresetId}
          onOpenLesson={(nodeId) => {
            setActiveNodeId(nodeId);
            setLibrarySection('interactive_lessons');
          }}
          onStartPracticeNode={onStartPracticeNode}
        />
      )}

      {/* تب ۴: جدول رسمی مقایسه ضرایب دروس کنکور کارشناسی ارشد مجموعه مدیریت (کد ۱۱۴۲) */}
      {librarySection === 'coefficients_table' && (
        <div className="space-y-4">
          {/* ساختار آزمون دکتری — نسخه‌بندی‌شده بر اساس سال */}
          {(() => {
            const structure = getExamStructure(examYear);
            const warnings = getExamStructureWarnings(examYear);
            const subjects = getSubGroupSubjects(structureGroupId);
            const group = MANAGEMENT_SUB_GROUPS.find((g) => g.id === structureGroupId);
            const share = getSpecializationSharePercent(examYear, structureGroupId);
            const years = Object.keys(EXAM_YEAR_STRUCTURES).map(Number).sort((a, b) => a - b);

            return (
              <div className="bento-card glass-panel p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        ساختار آزمون دکتری {toPersianDigits(String(examYear))} — مجموعهٔ امتحانی{' '}
                        {toPersianDigits(MANAGEMENT_EXAM_SET.code)}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        قواعد آزمون هر سال متفاوت است؛ الگوی سال‌های قبل به‌طور خودکار به این سال نسبت داده نمی‌شود.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {years.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => setExamYear(y)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          examYear === y
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        }`}
                      >
                        {toPersianDigits(String(y))}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="glass-subcard p-3">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      ضریب دروس تخصصی
                    </div>
                    <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                      {toPersianDigits(String(structure.specializationCoefficient))}
                    </div>
                  </div>
                  <div className="glass-subcard p-3">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">ضریب زبان</div>
                    <div className="text-lg font-black text-blue-700 dark:text-blue-400">
                      {toPersianDigits(String(structure.languageCoefficient))}
                    </div>
                  </div>
                  <div className="glass-subcard p-3">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">استعداد تحصیلی</div>
                    <div
                      className={`text-sm font-black mt-1 ${
                        structure.hasAptitude
                          ? 'text-slate-700 dark:text-slate-200'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {structure.hasAptitude
                        ? `ضریب ${toPersianDigits(String(structure.aptitudeCoefficient ?? 1))}`
                        : 'حذف شده'}
                    </div>
                  </div>
                  <div className="glass-subcard p-3">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      سهم تخصصی از نمره
                    </div>
                    <div className="text-lg font-black text-indigo-700 dark:text-indigo-400">
                      {toPersianDigits(String(share))}٪
                    </div>
                  </div>
                </div>

                {warnings.length > 0 && (
                  <ul className="space-y-1.5">
                    {warnings.map((w) => (
                      <li
                        key={w}
                        className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 rounded-lg px-2.5 py-1.5"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{toPersianDigits(w)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {MANAGEMENT_SUB_GROUPS.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setStructureGroupId(g.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          structureGroupId === g.id
                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {g.title}
                        {g.code && (
                          <span className="mr-1 opacity-60">({toPersianDigits(g.code)})</span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                    <span className="font-bold">رشته‌های این زیرمجموعه:</span>{' '}
                    {group?.fields.join(' • ')}
                    {group?.code === null && (
                      <span className="text-amber-700 dark:text-amber-400 font-bold">
                        {' '}
                        — کد این زیرمجموعه هنوز با دفترچهٔ رسمی تطبیق داده نشده است.
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {subjects.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1.5"
                      >
                        <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                          {s.title}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                          {s.level === 'کارشناسی' ? 'کارشناسی' : 'کارشناسی ارشد'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-200/60 dark:border-slate-800 pt-2">
                  منبع: {structure.source}
                </p>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['business', 'industrial', 'technology'] as ManagementBranchId[]).map((branchId) => {
              const meta = MANAGEMENT_BRANCH_META[branchId];
              const isSelected = selectedBranch === branchId;
              const bookCount = REFERENCE_BOOKS_DATABASE.filter((b) =>
                isBookInBranch(b, branchId)
              ).length;
              return (
                <button
                  key={branchId}
                  type="button"
                  onClick={() => handleSelectBranch(branchId)}
                  className={`text-right p-4 rounded-2xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 dark:border-blue-400'
                      : 'bg-white/90 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {meta.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shrink-0">
                      {bookCount} بسته مرجع
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5">
                    {meta.examCodeInfo}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {meta.subtitle}
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                    {meta.examCoursesSummary}
                  </div>
                  <div className="mt-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                    {meta.zeroCoeffWarning}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bento-card glass-panel p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  جدول رسمی ضرایب دروس و بهترین منابع کنکور کارشناسی ارشد مجموعه مدیریت (کد ۱۱۴۲: بازرگانی، صنعتی، تکنولوژی)
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                با کلیک روی هر درس، مستقیماً وارد تب کتب مرجع و خلاصه فصول آن درس می‌شوید
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <th className="p-2.5 font-bold">نام درس امتحانی (تعداد سؤال)</th>
                    <th
                      className={`p-2.5 font-bold ${
                        selectedBranch === 'business'
                          ? 'text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40'
                          : ''
                      }`}
                    >
                      ضریب مدیریت بازرگانی
                    </th>
                    <th
                      className={`p-2.5 font-bold ${
                        selectedBranch === 'industrial'
                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40'
                          : ''
                      }`}
                    >
                      ضریب مدیریت صنعتی
                    </th>
                    <th
                      className={`p-2.5 font-bold ${
                        selectedBranch === 'technology'
                          ? 'text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40'
                          : ''
                      }`}
                    >
                      ضریب مدیریت تکنولوژی
                    </th>
                    <th className="p-2.5 font-bold">بهترین منبع رتبه برتر (جزوه + بانک تست در سامانه)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {MASTER_1142_COEFFICIENTS_TABLE.map((row) => {
                    const isRowSelected = activeBook.id === row.linkedBookId;
                    return (
                      <tr
                        key={row.courseTitle}
                        onClick={() => {
                          setSelectedBookId(row.linkedBookId);
                          setLibrarySection('reference_books');
                        }}
                        className={`transition-colors cursor-pointer ${
                          isRowSelected
                            ? 'bg-blue-50/80 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          {row.courseTitle}{' '}
                          <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                            ({row.questionCount})
                          </span>
                        </td>
                        <td
                          className={`p-2.5 font-semibold ${
                            row.businessCoeff.includes('ضریب ۰')
                              ? 'text-rose-600 dark:text-rose-400'
                              : row.businessCoeff.includes('ضریب ۴')
                                ? 'text-blue-700 dark:text-blue-300 font-bold'
                                : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {row.businessCoeff}
                        </td>
                        <td
                          className={`p-2.5 font-semibold ${
                            row.industrialCoeff.includes('ضریب ۰')
                              ? 'text-rose-600 dark:text-rose-400'
                              : row.industrialCoeff.includes('تفاوت اصلی')
                                ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                                : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {row.industrialCoeff}
                        </td>
                        <td
                          className={`p-2.5 font-semibold ${
                            row.technologyCoeff.includes('ضریب ۰')
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {row.technologyCoeff}
                        </td>
                        <td className="p-2.5 text-blue-600 dark:text-blue-400 font-medium">
                          {row.topReferenceBook}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* تب ۳: مجلدات ۱۰۰ صفحه‌ای هر درس (مستخرج از konkorData.ts) */}
      {librarySection === 'compendium_100p' && (
        <div className="bento-card glass-panel p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    مخزن متمرکز پوشش ۱۰۰+ صفحه‌ای هر درس در konkorData.ts (ارشد کد ۱۱۴۲ و دکتری تخصصی)
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                    تضمین پوشش ۱۰۰٪ ده تا پانزده سال اخیر
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  شامل ماژول‌های درسنامه، ماتریس تطبیقی نظریه‌پردازان، فرمول‌نامه و بانک تست تشریحی برای هر سه گرایش بازرگانی، صنعتی و فناوری
                </p>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              <span>مطالعه کامل برخط در سامانه</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {CENTRALIZED_100PAGE_COURSE_CATALOG.map((cat) => {
              const isSelected = cat.courseId === selected100PageCourseId;
              return (
                <button
                  key={cat.courseId}
                  type="button"
                  onClick={() => setSelected100PageCourseId(cat.courseId)}
                  className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                      : 'glass-subcard text-slate-800 dark:text-slate-200 hover:border-blue-400'
                  }`}
                >
                  <div className="text-xs font-bold leading-snug">{cat.courseTitle}</div>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-current/15">
                    <span className="font-bold">
                      حجم مرجع: {cat.targetEquivalentPages} صفحه استاندارد
                    </span>
                    <span>
                      {cat.comprehensiveSyllabiModules.length} ماژول ·{' '}
                      {cat.scholarComparisonMatrix.length} ماتریس
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {(() => {
            const activeCat =
              CENTRALIZED_100PAGE_COURSE_CATALOG.find(
                (c) => c.courseId === selected100PageCourseId
              ) ?? CENTRALIZED_100PAGE_COURSE_CATALOG[0];

            return (
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {activeCat.comprehensiveSyllabiModules.map((mod) => (
                    <div
                      key={mod.moduleCode}
                      className="glass-subcard p-4 space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          {mod.moduleTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold shrink-0">
                          {mod.equivalentPages} صفحه
                        </span>
                      </div>
                      <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 leading-6 list-disc pr-4">
                        {mod.exhaustiveSynthesis.map((syn, sIdx) => (
                          <li key={sIdx}>
                            <MathText text={syn} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    ماتریس تطبیقی نظریه‌پردازان، فرمول‌ها و کلیدواژه‌های امضای طراح کنکور:
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {activeCat.scholarComparisonMatrix.map((row, rIdx) => (
                      <div
                        key={rIdx}
                        className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/25 text-xs space-y-1.5"
                      >
                        <div className="font-bold text-slate-900 dark:text-white">
                          {row.scholarOrSchool}{' '}
                          <span className="text-[10px] font-normal text-slate-500">
                            ({row.yearOrEra})
                          </span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 leading-6">
                          <strong>مدل/فرمول:</strong> <MathText text={row.keyDimensionsOrFormula} />
                        </div>
                        <div className="text-emerald-700 dark:text-emerald-300 leading-6">
                          <strong>امضای کنکوری:</strong> <MathText text={row.konkorSignatureKeyword} />
                        </div>
                        <div className="text-rose-700 dark:text-rose-300 leading-6">
                          <strong>دام طراح:</strong> <MathText text={row.commonExamTrap} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* تب ۲: بانک کتب مرجع، خلاصه فصول و تست‌های کنکور */}
      {librarySection === 'reference_books' && (
        <div className="space-y-5">
          {/* نوار انتخاب سریع گرایش برای فیلتر کتب مرجع */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['business', 'industrial', 'technology'] as ManagementBranchId[]).map((branchId) => {
              const meta = MANAGEMENT_BRANCH_META[branchId];
              const isSelected = selectedBranch === branchId;
              const bookCount = REFERENCE_BOOKS_DATABASE.filter((b) =>
                isBookInBranch(b, branchId)
              ).length;
              return (
                <button
                  key={branchId}
                  type="button"
                  onClick={() => handleSelectBranch(branchId)}
                  className={`text-right p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                      : 'glass-panel text-slate-900 dark:text-white hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold">{meta.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {bookCount} کتاب مرجع
                    </span>
                  </div>
                  <div
                    className={`text-[11px] mt-1 ${
                      isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {meta.examCoursesSummary}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ستون راست: لیست کتب مرجع گرایش انتخاب‌شده (4 ستون) */}
            <div className="lg:col-span-4 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 space-y-3">
              <div className="pb-2 border-b border-slate-200/70 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  کتب مرجع {MANAGEMENT_BRANCH_META[selectedBranch].title}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  مرتب‌شده بر اساس ضرایب دروس امتحانی این گرایش (کلیک جهت مشاهده جزوه و تست)
                </p>
              </div>

              <div className="space-y-2.5">
                {branchBooks.map((book) => {
                  const active = activeBook.id === book.id;
                  const branchBadge =
                    book.branchSpecificMeta?.[selectedBranch]?.orderBadge || book.courseOrderBadge;
                  const branchMasterCoeff =
                    book.branchSpecificMeta?.[selectedBranch]?.masterCoeffLabel ||
                    book.coefficientMaster;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => setSelectedBookId(book.id)}
                      className={`w-full text-right p-3.5 rounded-xl border transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-500 dark:border-blue-400'
                          : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {branchBadge && (
                        <div className="mb-1.5">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                            {branchBadge}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 text-[11px] text-blue-600 dark:text-blue-400 font-bold mb-1">
                        <span>{book.courseName}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] shrink-0">
                          {book.targetLevel}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {book.bookTitle}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        مؤلفان: {book.authors}
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/70 space-y-0.5 text-[10px]">
                        <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                          • ارشد: {branchMasterCoeff}
                        </div>
                        <div className="text-indigo-700 dark:text-indigo-400 font-medium">
                          • دکتری: {book.coefficientPhd}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ستون چپ: شناسنامه کامل کتاب، خلاصه فصول مهم، جزوه نکات طلایی و تست‌های کنکور (8 ستون) */}
            <div className="lg:col-span-8 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 space-y-6">
              {/* شناسنامه کتاب مرجع */}
              <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                      <GraduationCap className="w-4 h-4" />
                      <span>درس: {activeBook.courseName}</span>
                    </span>
                    {(activeBook.branchSpecificMeta?.[selectedBranch]?.orderBadge ||
                      activeBook.courseOrderBadge) && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                        {activeBook.branchSpecificMeta?.[selectedBranch]?.orderBadge ||
                          activeBook.courseOrderBadge}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <span>مطالعه سرفصل‌ها و تست‌های تشریحی این مرجع</span>
                    </div>
                    {activeBook.linkedNodeId && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveNodeId(activeBook.linkedNodeId!);
                          setLibrarySection('interactive_lessons');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                      >
                        <span>ورود به درسنامه تعاملی و تست‌های این مرجع</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {activeBook.bookTitle}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400">مؤلفان اصلی: </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {activeBook.authors}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">بهترین ترجمه / مرجع تستی کنکور: </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {activeBook.translatorsOrCompilers}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">ضریب در کارشناسی ارشد: </span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {activeBook.coefficientMaster}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">ضریب در دکتری تخصصی: </span>
                    <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                      {activeBook.coefficientPhd}
                    </span>
                  </div>
                  <div className="sm:col-span-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong className="text-slate-900 dark:text-white">چرا این کتاب در کنکور ارشد و دکتری حیاتی است؟ </strong>
                    {activeBook.whyImportant}
                  </div>
                </div>
              </div>

              {/* بخش ۱: خلاصه و جزوه فصول پرتکرار کتاب */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    جزوه و خلاصه فصول سؤال‌خیز کتاب ({activeBook.highYieldChapters.length} بخش کلیدی)
                  </h3>
                </div>

                <div className="space-y-3">
                  {activeBook.highYieldChapters.map((ch, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          <span className="text-blue-600 dark:text-blue-400 ml-1.5">
                            [{ch.chapterNumber}]
                          </span>
                          {ch.chapterTitle}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                          {ch.examImportance}
                        </span>
                      </div>

                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {ch.keyPointsSummary.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold mt-0.5">•</span>
                            <MathText text={pt} />
                          </li>
                        ))}
                      </ul>

                      {ch.formulasOrModels && ch.formulasOrModels.length > 0 && (
                        <div className="mt-2 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                          <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            فرمول‌ها و مدل‌های مرجع این فصل:
                          </div>
                          {ch.formulasOrModels.map((fm, fIdx) => (
                            <div
                              key={fIdx}
                              className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200/60 dark:border-indigo-900/50 text-xs text-slate-800 dark:text-slate-200"
                            >
                              <MathText text={fm} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* هایلایت طلایی برای مباحث و فصل‌های با ۲ بار یا بیشتر تکرار در ۱۵ سال اخیر */}
                      {(ch.examImportance.includes('۲') || ch.examImportance.includes('حیاتی') || ch.examImportance.includes('مهم') || ch.examImportance.includes('تکرار')) && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                            <Flame className="w-3.5 h-3.5 text-amber-600 fill-current" />
                            <span>سرفصل پرتکرار کنکورهای ۱۵ سال اخیر (۲ بار و بیشتر طرح سوال)</span>
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-5">
                            طراحان کنکور ارشد و دکتری در ادوار اخیر به طور مکرر از این سرفصل تست طراحی کرده‌اند. تسلط بر مفاهیم تفکیکی، تعاریف تئوریک و فرمول‌های این بخش اولویت نخست آمادگی آزمون است.
                          </p>
                        </div>
                      )}

                      {/* نمودار مفهومی وکتوری کم‌حجم */}
                      <TopicDiagramVisualizer topic={`${ch.chapterTitle} ${ch.keyPointsSummary.join(' ')}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* بخش ۲: نکات طلایی و دام‌های کنکوری این کتاب */}
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                  <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>تقلب‌نامه و نکات طلایی تستی (ویژه مرور سریع شب آزمون ارشد و دکتری)</span>
                </div>
                <ul className="space-y-1.5 text-xs text-amber-950 dark:text-amber-200/90 leading-relaxed">
                  {activeBook.goldenNotesCheatSheet.map((tip, idx) => (
                    <li key={idx}>
                      <MathText text={tip} />
                    </li>
                  ))}
                </ul>
              </div>

              {/* بخش ۳: بانک تست چهارگزینه‌ای و تشریحی کنکور از این کتاب */}
              <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      بانک تست چهارگزینه‌ای و تشریحی کنکور ({activeBook.sampleKonkorQuestions.length} تست منتخب با کالبدشکافی کامل)
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTestBankViewMode('descriptive')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        testBankViewMode === 'descriptive'
                          ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>بانک تست تشریحی (پاسخ و دام باز)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestBankViewMode('interactive')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        testBankViewMode === 'interactive'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>آزمون چهارگزینه‌ای تعاملی</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {activeBook.sampleKonkorQuestions.map((q) => {
                    const chosenIdx = selectedQuestionAnswers[q.id];
                    const isAnswered = testBankViewMode === 'descriptive' || chosenIdx !== undefined;
                    return (
                      <div
                        key={q.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                              مقطع {q.degreeLevel}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {q.examTitle} — سال {q.examYear}
                            </span>
                          </div>
                          <span className="text-slate-500 dark:text-slate-400">
                            مبحث: {q.chapterTopic}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                          <MathText text={q.questionText} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => {
                            const isPicked = chosenIdx === oIdx;
                            const isCorrect = q.correctOption === oIdx;
                            let btnStyle =
                              'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400';
                            if (isAnswered) {
                              if (isCorrect) {
                                btnStyle =
                                  'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold';
                              } else if (isPicked) {
                                btnStyle =
                                  'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-900 dark:text-rose-200';
                              }
                            }
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() =>
                                  setSelectedQuestionAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: oIdx,
                                  }))
                                }
                                className={`text-right p-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${btnStyle}`}
                              >
                                <span className="font-bold ml-1.5">{oIdx + 1})</span>
                                <MathText text={opt} />
                              </button>
                            );
                          })}
                        </div>

                        {isAnswered && (
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1.5">
                            <div className="font-bold text-emerald-700 dark:text-emerald-400">
                              پاسخ تشریحی کامل (گزینه صحیح: {q.correctOption + 1})
                            </div>
                            <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                              <MathText text={q.detailedAnswer} />
                            </div>
                            <div className="text-amber-700 dark:text-amber-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                              <strong>دام کنکوری: </strong>
                              <MathText text={q.konkorTrap} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* تب ۱: درسنامه‌های تعاملی گام‌به‌گام + امتیازدهی ۱ تا ۵ */}
      {librarySection === 'interactive_lessons' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMobileListOpen((prev) => !prev)}
            aria-expanded={mobileListOpen}
            className="lg:hidden w-full flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-right cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                  {mobileListOpen ? 'بستن فهرست' : `فهرست ${filteredNodes.length} درسنامه`}
                </span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                  {activeLesson?.topic ?? 'انتخاب مبحث'}
                </span>
              </span>
            </span>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
              {mobileListOpen ? 'بستن' : 'تغییر'}
            </span>
          </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* سایدبار فهرست درسنامه‌ها با نشانگر سال‌های تکرار در کنکور (4 ستون) */}
          <div className={`${mobileListOpen ? 'block' : 'hidden'} lg:block lg:col-span-4 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs space-y-4`}>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                درسنامه‌های گام‌به‌گام و دقیق کنکور
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                مستند به منابع اصلی سنجش + رادار تکرار چندساله کنکور + امتیازدهی ۱ تا ۵
              </p>
            </div>

            {/* جست‌وجو */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جست‌وجوی مبحث یا منبع (مثلاً سیمپلکس، DEA، چسبرو، شیلینگ، VRIO)..."
                className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* فیلتر گرایش */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg">
              {[
                { id: 'all', label: 'همه' },
                { id: 'common', label: 'مشترک' },
                { id: 'business', label: 'بازرگانی' },
                { id: 'industrial', label: 'صنعتی' },
                { id: 'technology', label: 'فناوری' },
                { id: 'strategy', label: 'استراتژیک' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTrack(tab.id as 'all' | TrackId)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    selectedTrack === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* لیست مباحث */}
            <div className="space-y-2 max-h-[560px] overflow-y-auto pl-1">
              {filteredNodes.map((node) => {
                const st = nodeStates[node.id];
                const freq = examFrequencyMap[node.id];
                const isSelected = activeNode.id === node.id;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      setActiveNodeId(node.id);
                      setMobileListOpen(false);
                      requestAnimationFrame(() => {
                        document.getElementById('lesson-reader')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      });
                    }}
                    className={`w-full text-right p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-500 dark:border-blue-400'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      <span>{node.course}</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                        تسلط: {st?.masteryScore ?? 0}٪
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {node.topic}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px]">
                      <span
                        className={
                          freq?.isHighYieldCritical
                            ? 'text-amber-600 dark:text-amber-400 font-bold'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {getLessonDeepDive(node.id) && (
                          <span className="text-emerald-600 dark:text-emerald-400">آموزش کامل · </span>
                        )}
                        {freq?.importanceBadge}
                      </span>
                      {st?.lastLessonSelfRating && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          امتیاز درک شما: {st.lastLessonSelfRating} از ۵
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* محتوای درسنامه انتخاب‌شده (8 ستون) */}
          <div id="lesson-reader" className="lg:col-span-8 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-6 scroll-mt-20">
            {activeLesson ? (
              <>
                {/* هدر درسنامه + رادار تکرار چندساله در کنکور و منبع دقیق */}
                <div className="space-y-3 pb-4 border-b border-slate-200/70 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{activeLesson.course}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeLesson.chapter}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {activeLesson.konkoorWeightLabel}
                        </span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5 leading-snug">
                        {activeLesson.topic}
                      </h1>
                      {activeDive && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 font-bold">
                            درس‌نامهٔ کامل
                          </span>
                          <span className="tabular-nums">
                            {activeDiveWords.toLocaleString('fa-IR')} واژه ·{' '}
                            {activeDive.sections.length.toLocaleString('fa-IR')} بخش · مجموعاً حدود{' '}
                            {Math.max(3, Math.round(activeDiveWords / 120)).toLocaleString('fa-IR')} دقیقه مطالعه
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onStartPracticeNode(activeNode.id, 'practice')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>حل تست‌های این مبحث</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartPracticeNode(activeNode.id, 'proof')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Target className="w-3.5 h-3.5" />
                        <span>آزمون قرنطینه ۱۴۰۴</span>
                      </button>
                    </div>
                  </div>

                  {/* باکس منبع رسمی کتاب و سال‌های تکرار در کنکور */}
                  <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                        <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>رادار بودجه‌بندی و تکرار در ادوار کنکور سراسری:</span>
                        <span>{freqInsight?.importanceBadge}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {activeLesson.examYearsAppeared.map((yr) => (
                          <span
                            key={yr}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200/60 dark:bg-amber-900/50 text-amber-950 dark:text-amber-200 tabular-nums"
                          >
                            {yr}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80 leading-6">
                      این مبحث در {freqInsight?.appearanceCount ?? activeLesson.examYearsAppeared.length} دوره کنکور تکرار شده و حدود {freqInsight?.shareOfExamPercent ?? 8}٪ از بودجه‌بندی آزمون را به خود اختصاص می‌دهد.
                    </p>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 pt-1.5 border-t border-amber-200/50 dark:border-amber-800/40 leading-5">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        منبع دقیق کتاب مرجع:{' '}
                      </span>
                      {activeLesson.sourceBookCitation}
                    </div>
                  </div>
                </div>

                {/* خلاصه کلیدی */}
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300 mb-1.5">
                    <BookOpen className="w-4 h-4" />
                    <span>چکیده مفهومی مبحث</span>
                  </div>
                  <MathText
                    text={activeLesson.summary}
                    className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed"
                  />
                </div>

                {/* درس‌نامهٔ کامل: اهداف، آموزش عمیق، مثال حل‌شده، بدفهمی‌ها و جمع‌بندی */}
                {activeDive ? (
                  <LessonDeepDivePanel dive={activeDive} wordCount={activeDiveWords} />
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 leading-6">
                    درس‌نامهٔ عمیق این مبحث در حال تکمیل است؛ فعلاً از گام‌های آموزشی زیر و بانک تست همین صفحه استفاده کنید.
                  </div>
                )}

                {/* گام‌های خردشده آموزشی (سبک Brilliant Micro-Steps) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      <span>آموزش گام‌به‌گام و دقیق ({activeLesson.microSteps.length} گام آموزشی)</span>
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {activeLesson.microSteps.map((step) => (
                      <div
                        key={step.stepNumber}
                        className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2"
                      >
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {step.title}
                        </div>
                        <MathText
                          text={step.content}
                          className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* فلش‌کارت‌های مفهومی/توصیفی (سبک RemNote Concept-Descriptor) */}
                {activeLesson.conceptDescriptors &&
                  activeLesson.conceptDescriptors.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        <span>کارت‌های حافظه مفهوم ⇌ توصیف‌گر (الگوی RemNote — کلیک برای مشاهده پاسخ)</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {activeLesson.conceptDescriptors.map((cd, idx) => {
                          const isRevealed = !!revealedCards[idx];
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                setRevealedCards((prev) => ({
                                  ...prev,
                                  [idx]: !prev[idx],
                                }))
                              }
                              className="text-right p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 transition-all cursor-pointer"
                            >
                              <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                                <span>{cd.concept}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  {cd.descriptor}
                                </span>
                              </div>
                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                                {isRevealed ? (
                                  <MathText
                                    text={cd.answer}
                                    className="text-emerald-700 dark:text-emerald-300 font-medium"
                                  />
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500">
                                    برای نمایش پاسخ دقیق کلیک کنید...
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* دام‌های پرتکرار طراحان کنکور */}
                <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200/70 dark:border-rose-900/50 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                    <ShieldAlert className="w-4 h-4" />
                    <span>نکات طلایی و دام‌های پرتکرار طراحان کنکور در این مبحث</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 list-disc list-inside leading-relaxed">
                    {activeLesson.konkoorTips.map((tip, i) => (
                      <li key={i}>
                        <MathText text={tip} />
                      </li>
                    ))}
                  </ul>
                </div>

                {/* جدول مقایسه مفاهیم متشابه در صورت وجود */}
                {relatedComparison && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <Scale className="w-4 h-4 text-amber-500" />
                      <span>{relatedComparison.title}</span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <tr>
                            <th className="p-2.5 font-semibold">معیار تفکیک</th>
                            <th className="p-2.5 font-semibold">مفهوم اول</th>
                            <th className="p-2.5 font-semibold">مفهوم دوم</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {relatedComparison.dimensions.map((dim, idx) => (
                            <tr key={idx}>
                              <td className="p-2.5 font-medium text-slate-900 dark:text-slate-200 bg-slate-50/60 dark:bg-slate-900/40">
                                {dim.criterion}
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-300">
                                {dim.conceptA}
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-300">
                                {dim.conceptB}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ایستگاه بررسی مفهوم (Concept Check) */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ایستگاه بررسی سریع مفهوم (Concept Check):
                  </div>
                  <MathText
                    text={activeLesson.conceptCheck.prompt}
                    className="text-xs text-slate-700 dark:text-slate-300"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeLesson.conceptCheck.options.map((opt, idx) => {
                      const isPicked = conceptChoice === idx;
                      const isRight = activeLesson.conceptCheck.correctIndex === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setConceptChoice(idx)}
                          className={`p-3 rounded-xl border text-right text-xs font-medium transition-all cursor-pointer ${
                            conceptChoice === null
                              ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-800 dark:text-slate-200'
                              : isRight
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                                : isPicked
                                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-900 dark:text-rose-200'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                          }`}
                        >
                          <MathText text={opt} />
                        </button>
                      );
                    })}
                  </div>
                  {conceptChoice !== null && (
                    <div className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300 pt-1">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <MathText text={activeLesson.conceptCheck.explanation} />
                    </div>
                  )}
                </div>

                {/* دکمه‌های ۵گانه خودارزیابی درک درسنامه (۱ تا ۵) با آپدیت زنده برنامه درسی */}
                <div className="p-5 rounded-2xl bg-gradient-to-l from-indigo-50/90 via-blue-50/80 to-slate-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 border-2 border-indigo-200 dark:border-indigo-800/70 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span>این درسنامه را چقدر خوب یاد گرفتید؟ (امتیاز از ۱ تا ۵)</span>
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        با انتخاب هر گزینه، الگوریتم FSRS برنامه مرور، کارت‌های روزانه و قفل مباحث بعدی را بلافاصله تنظیم می‌کند.
                      </p>
                    </div>
                    {activeState?.lastLessonSelfRating && (
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold">
                        آخرین امتیاز ثبت‌شده: {activeState.lastLessonSelfRating} از ۵
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {RATING_OPTIONS.map((item) => {
                      const isActive = activeState?.lastLessonSelfRating === item.rating;
                      return (
                        <button
                          key={item.rating}
                          type="button"
                          data-active={isActive}
                          onClick={() => handleRatingClick(item.rating)}
                          className={`p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${item.colorClass}`}
                        >
                          <div className="text-xs font-bold">{item.label}</div>
                          <div
                            className={`text-[10px] leading-snug ${
                              isActive
                                ? 'text-white/90'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {item.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {ratingFeedback && (
                    <div className="p-3.5 rounded-xl bg-emerald-600 text-white text-xs font-medium flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{ratingFeedback}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onStartPracticeNode(activeNode.id, 'practice')}
                        className="px-3 py-1.5 rounded-lg bg-white text-emerald-900 font-bold whitespace-nowrap hover:bg-emerald-50 cursor-pointer"
                      >
                        شروع تست‌های مبحث
                      </button>
                    </div>
                  )}
                </div>

                {/* تست‌های این مبحث در کتابخانهٔ کتاب: تست‌ها اینجا پراکنده نمی‌شوند */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-6">
                    <strong className="text-slate-900 dark:text-white">
                      {questions.filter((q) => q.nodeId === activeNode.id).length.toLocaleString('fa-IR')} تست
                      شناسنامه‌دار
                    </strong>{' '}
                    برای این مبحث در بانک سامانه ثبت شده است؛ تست‌ها همراه با آموزش، داخل صفحهٔ کتاب
                    مرجع همین درس دسته‌بندی شده‌اند.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const book = getBookForNode(activeNode.id);
                      return book ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBookPresetId(book.id);
                            setLibrarySection('books');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-bold cursor-pointer"
                        >
                          <Library className="w-3.5 h-3.5" />
                          آموزش و تست‌های کتاب این درس
                        </button>
                      ) : null;
                    })()}
                    <button
                      type="button"
                      onClick={() => onStartPracticeNode(activeNode.id, 'practice')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      شروع جلسهٔ تست تطبیقی
                    </button>
                  </div>
                </div>

                {/* حرکت بین درس‌ها بدون برگشت به فهرست */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3">
                  {prevNode ? (
                    <button
                      type="button"
                      onClick={() => setActiveNodeId(prevNode.id)}
                      className="text-right p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 transition-colors cursor-pointer"
                    >
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">درس قبلی</div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {prevNode.topic}
                      </div>
                    </button>
                  ) : (
                    <div />
                  )}
                  {nextNode ? (
                    <button
                      type="button"
                      onClick={() => setActiveNodeId(nextNode.id)}
                      className="text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 transition-colors cursor-pointer"
                    >
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">درس بعدی</div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {nextNode.topic}
                      </div>
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
        </div>
      )}
    </div>
  );
};
