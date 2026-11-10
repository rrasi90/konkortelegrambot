import React, { useState, useMemo } from 'react';
import { gradeAnswerOnServer } from '../lib/serverGrading';
import { SectionHeader } from './ui';
import type { KonkorCourseSectionId } from '../data/yearlyKonkorExams';
import type { KnowledgeNode, QuestionItem, InteractiveLesson } from '../data/konkorData';
import {
  SUBJECT_COURSE_DEFINITIONS,
  SubjectCourseDefinition,
  getCourseSectionForNode,
  getCourseSectionForQuestion,
  getBooksForCourseSection,
} from '../data/subjectHubMeta';
import { ReferenceBookItem } from '../data/referenceBooksRepo';
import { getBookChapters, BookChapter } from '../data/bookChaptersRepo';
import { getLessonDeepDive, getDeepDiveWordCount } from '../data/lessonDeepDives';
import { TopicDiagramVisualizer } from './TopicDiagramVisualizer';
import { MathText } from './MathText';
import { RichText } from './RichText';
import { LessonDeepDivePanel } from './LessonDeepDivePanel';
import {
  BookOpen,
  HelpCircle,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  Award,
  Sparkles,
  ChevronDown,
  Layers,
  GraduationCap,
  Filter,
  Eye,
  Bookmark,
} from 'lucide-react';

interface SubjectDedicatedHubViewProps {
  initialSubjectId?: KonkorCourseSectionId;
  nodes: KnowledgeNode[];
  lessons: Record<string, InteractiveLesson>;
  questions: QuestionItem[];
  yearlyQuestions: QuestionItem[];
  onStartCoursePractice: (subjectId: KonkorCourseSectionId, selectedQuestions: QuestionItem[]) => void;
  onOpenLesson: (nodeId: string) => void;
  onRecordMistake?: (q: QuestionItem, selectedOption: number) => void;
}

type SubjectSubTab = 'lessons' | 'books' | 'concepts_diagrams' | 'questions';

export const SubjectDedicatedHubView: React.FC<SubjectDedicatedHubViewProps> = ({
  initialSubjectId = 'islamic',
  nodes,
  lessons,
  questions,
  yearlyQuestions,
  onStartCoursePractice,
  onOpenLesson,
  onRecordMistake,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<KonkorCourseSectionId>(initialSubjectId);
  const [questionReveals, setQuestionReveals] = useState<Record<string, { correctOption: number; explanation: string; trapNote: string }>>({});

  const [activeSubTab, setActiveSubTab] = useState<SubjectSubTab>('books');
  const [selectedDegreeFilter, setSelectedDegreeFilter] = useState<'all' | 'ارشد' | 'دکتری'>('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState<number | 'all'>('all');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [openBookChapterId, setOpenBookChapterId] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

  // اطلاعات دوره انتخابی
  const currentSubject: SubjectCourseDefinition = useMemo(() => {
    return (
      SUBJECT_COURSE_DEFINITIONS.find((s) => s.id === selectedSubjectId) ||
      SUBJECT_COURSE_DEFINITIONS[0]
    );
  }, [selectedSubjectId]);

  // گره‌های دانش متناظر با این درس
  const subjectNodes = useMemo(() => {
    return nodes.filter((n) => getCourseSectionForNode(n) === selectedSubjectId);
  }, [nodes, selectedSubjectId]);

  // کتاب‌های مرجع اختصاصی این درس
  const subjectBooks: ReferenceBookItem[] = useMemo(() => {
    return getBooksForCourseSection(selectedSubjectId);
  }, [selectedSubjectId]);

  // کل سوالات کنکور متعلق به این درس (هم ارشد و هم دکتری، از ۱۳9۱ تا ۱۴۰۵)
  const allSubjectQuestions = useMemo(() => {
    const combined = [...yearlyQuestions, ...questions];
    const uniqueMap = new Map<string, QuestionItem>();
    for (const q of combined) {
      if (getCourseSectionForQuestion(q, nodes) === selectedSubjectId) {
        if (!uniqueMap.has(q.id)) {
          uniqueMap.set(q.id, q);
        }
      }
    }
    return Array.from(uniqueMap.values());
  }, [yearlyQuestions, questions, selectedSubjectId, nodes]);

  // سوالات فیلترشده بر اساس مقطع و سال
  const filteredQuestions = useMemo(() => {
    return allSubjectQuestions.filter((q) => {
      if (selectedDegreeFilter !== 'all') {
        const isPhd =
          q.examLevel === 'دکتری' ||
          Boolean(q.sourceReference && q.sourceReference.includes('دکتری'));
        if (selectedDegreeFilter === 'دکتری' && !isPhd) return false;
        if (selectedDegreeFilter === 'ارشد' && isPhd) return false;
      }
      if (selectedYearFilter !== 'all') {
        if (q.examYear !== selectedYearFilter) return false;
      }
      return true;
    });
  }, [allSubjectQuestions, selectedDegreeFilter, selectedYearFilter]);

  // سال‌های موجود در سوالات این درس
  const availableYears = useMemo(() => {
    const years = new Set(allSubjectQuestions.map((q) => q.examYear).filter(Boolean));
    return Array.from(years).sort((a, b) => b - a);
  }, [allSubjectQuestions]);

  const handleSelectOption = (q: QuestionItem, optIdx: number) => {
    if (userAnswers[q.id] !== undefined) return;
    setUserAnswers((prev) => ({ ...prev, [q.id]: optIdx }));
    setRevealedAnswers((prev) => ({ ...prev, [q.id]: true }));
    // R-036: تصحیح فقط سمت سرور — ثبت خطا بر اساس نتیجهٔ reveal سرور
    void (async () => {
      try {
        const reveal = await gradeAnswerOnServer(q.id, optIdx);
        setQuestionReveals((prev) => ({
          ...prev,
          [q.id]: { correctOption: reveal.correctOption, explanation: reveal.explanation, trapNote: reveal.trapNote },
        }));
        if (!reveal.wasCorrect && onRecordMistake) {
          onRecordMistake(q, optIdx);
        }
      } catch {
        // بدون افشای کلید؛ تشریح صرفاً پس از تأیید سرور
      }
    })();
  };

  const activeBook = subjectBooks[0];
  const activeBookChapters: BookChapter[] = activeBook ? getBookChapters(activeBook.id) : [];

  const activeDive = activeNodeId ? getLessonDeepDive(activeNodeId) : null;
  const activeDiveWords = activeDive ? getDeepDiveWordCount(activeDive) : 0;

  return (
    <div className="space-y-6 pb-20 w-full min-w-0 overflow-x-hidden">
      <SectionHeader title="مطالعهٔ تفکیکی درس‌به‌درس" accent="var(--ael-accent-purple)" />
      {/* ۱. نوار هوشمند و ریسپانسیو انتخاب درس (۸ درس رسمی کنکور مدیریت) */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-lg mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>مطالعهٔ تفکیکی و ۳۶۰ درجه درس‌به‌درس</span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>درس مورد نظر خود را برای مطالعهٔ جامع انتخاب کنید</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              با انتخاب هر درس، تمام آموزش‌ها، کتب مرجع، مفاهیم طلایی و تست‌های کنکور (ارشد و دکتری) منحصراً برای همان درس نمایش داده می‌شود.
            </p>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            ۸ درس تخصصی کنکور
          </span>
        </div>

        {/* لیست افقی و اسکرول‌پذیر ۸ درس */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
          {SUBJECT_COURSE_DEFINITIONS.map((s) => {
            const isSelected = s.id === selectedSubjectId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedSubjectId(s.id);
                  setActiveNodeId(null);
                  setOpenBookChapterId(null);
                }}
                className={`p-2.5 sm:p-3 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-500/30'
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-400'
                }`}
              >
                <div className="text-xs font-bold leading-tight">{s.shortTitle}</div>
                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-current/15">
                  <span className="font-mono">{s.questionCountInExam.split(' ')[0]} سؤال</span>
                  <span className="opacity-80 text-[9px] truncate max-w-[60px]">{s.englishTitle.split(' ')[0]}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ۲. کارت پیشخوان فرماندهی درس انتخابی */}
      <div className={`p-5 sm:p-6 rounded-3xl text-white shadow-lg bg-gradient-to-r ${currentSubject.gradient} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/20 backdrop-blur-md text-xs font-bold">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{currentSubject.badge}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black">{currentSubject.title}</h2>
            <p className="text-xs sm:text-sm text-white/90 font-medium font-sans">{currentSubject.englishTitle}</p>
            <p className="text-xs leading-6 text-white/95 pt-1">{currentSubject.whyImportantInExam}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={() => onStartCoursePractice(currentSubject.id, allSubjectQuestions)}
              className="px-4 py-3 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current text-blue-600" />
              <span>شروع آزمون اختصاصی این درس ({allSubjectQuestions.length} سؤال)</span>
            </button>
          </div>
        </div>

        {/* اطلاعات آماری سریع */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-white/20 text-xs">
          <div className="p-2.5 rounded-xl bg-black/15 backdrop-blur-xs space-y-0.5">
            <div className="text-[10px] text-white/70">مرجع اصلی کنکور:</div>
            <div className="font-bold truncate text-[11px]">{currentSubject.primaryAuthor}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/15 backdrop-blur-xs space-y-0.5">
            <div className="text-[10px] text-white/70">ضریب در کارشناسی ارشد:</div>
            <div className="font-bold text-[11px]">{currentSubject.coefficientMaster}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/15 backdrop-blur-xs space-y-0.5">
            <div className="text-[10px] text-white/70">ضریب در دکتری تخصصی:</div>
            <div className="font-bold text-[11px]">{currentSubject.coefficientDoctorate}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/15 backdrop-blur-xs space-y-0.5">
            <div className="text-[10px] text-white/70">بانک تست موجود:</div>
            <div className="font-bold text-[11px]">{allSubjectQuestions.length} تست شناسنامه‌دار</div>
          </div>
        </div>
      </div>

      {/* ۳. زبانه زیربخش‌های ۴گانه اختصاصی همین درس */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200/80 dark:border-slate-800">
        {[
          { id: 'books', label: 'کتب و فصول مرجع', icon: BookOpen },
          { id: 'lessons', label: 'آموزش و درس‌نامه‌ها', icon: Layers },
          { id: 'concepts_diagrams', label: 'مفاهیم طلایی و نمودارها', icon: Sparkles },
          { id: 'questions', label: `بانک تست کنکور (${allSubjectQuestions.length})`, icon: HelpCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as SubjectSubTab)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ۴. نمایش محتوای تب فعال اختصاصی همین درس */}

      {/* تب ۱: کتب و فصول مرجع */}
      {activeSubTab === 'books' && (
        <div className="space-y-4">
          {activeBook ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200/70 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">کتاب منبع مرجع رسمی طراحان کنکور:</div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{activeBook.bookTitle}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>مولفین و مراجع:</strong> {activeBook.authors} | <strong>ناشر:</strong> {activeBook.publisher}
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>پوشش کامل سرفصل‌های ارشد و دکتری</span>
                </div>
              </div>

              {/* خلاصه فصول کتاب */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>فهرست فصول سوال‌خیز و پرتکرار این کتاب مرجع:</span>
                </h4>

                <div className="grid grid-cols-1 gap-3">
                  {activeBookChapters.map((ch) => {
                    const isOpen = openBookChapterId === ch.id;
                    const isFrequent = ch.examCount >= 2;
                    return (
                      <div
                        key={ch.id}
                        className={`rounded-2xl border transition-all ${
                          isFrequent
                            ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenBookChapterId(isOpen ? null : ch.id)}
                          className="w-full p-4 flex items-center justify-between gap-3 text-right cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
                              {ch.number}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{ch.title}</span>
                                {isFrequent && (
                                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                                    <Flame className="w-3 h-3 text-amber-600 fill-current" />
                                    <span>{ch.examCount} بار تکرار در کنکور</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                شامل {ch.points.length} نکته کلیدی آموزشی
                              </div>
                            </div>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-3 text-xs">
                            {/* هایلایت طلایی برای فصل‌های پرتکرار */}
                            {isFrequent && (
                              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
                                <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                  <Flame className="w-3.5 h-3.5 text-amber-600 fill-current" />
                                  <span>بخش طلایی و پرتکرار کنکورهای ۱۵ سال اخیر</span>
                                </div>
                                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-5">
                                  طراحان کنکور ارشد و دکتری به طور مستمر از مفاهیم این فصل تست طرح کرده‌اند. تسلط بر مفاهیم تفکیکی و دام‌های تستی این بخش اولویت نخست است.
                                </p>
                              </div>
                            )}

                            {/* نکات آموزشی */}
                            <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 leading-6">
                              {ch.points.map((pt, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-blue-500 font-bold mt-0.5">•</span>
                                  <RichText text={pt} />
                                </li>
                              ))}
                            </ul>

                            {/* فرمول‌ها */}
                            {ch.formulas && ch.formulas.length > 0 && (
                              <div className="p-3 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 space-y-1.5">
                                <div className="font-bold text-blue-800 dark:text-blue-300 text-[11px]">فرمول‌ها و مدل‌های کلیدی این فصل:</div>
                                {ch.formulas.map((f, i) => (
                                  <div key={i} className="text-xs text-slate-800 dark:text-slate-200">
                                    <MathText text={f} />
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* نمودار مفهومی وکتوری سبک */}
                            <TopicDiagramVisualizer nodeId={ch.nodes[0] || ''} topic={`${ch.title} ${ch.points.join(' ')}`} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">کتاب مرجع برای این درس یافت نشد.</div>
          )}
        </div>
      )}

      {/* تب ۲: آموزش و درس‌نامه‌ها */}
      {activeSubTab === 'lessons' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {subjectNodes.map((node) => {
              const isSelected = activeNodeId === node.id;
              const lesson = lessons[node.id];
              return (
                <div
                  key={node.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                        {node.chapter}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{node.topic}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">مرجع: {node.sourceBookCitation}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">
                      ضریب: {node.examCoefficient} · دوره کنکور: {node.examYearsAppeared.join('، ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveNodeId(isSelected ? null : node.id)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{isSelected ? 'بستن درسنامه' : 'مشاهده درس‌نامه'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* پنل نمایش درسنامه تفصیلی برای گره فعال */}
          {activeNodeId && activeDive && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <span>درس‌نامه تفصیلی: {nodes.find((n) => n.id === activeNodeId)?.topic}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveNodeId(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  بستن
                </button>
              </div>
              <LessonDeepDivePanel dive={activeDive} wordCount={activeDiveWords} />
            </div>
          )}
        </div>
      )}

      {/* تب ۳: مفاهیم طلایی، فرمول‌ها و نمودارها */}
      {activeSubTab === 'concepts_diagrams' && (
        <div className="space-y-5">
          {/* نمودارهای مفهومی برداری SVG این درس */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>نمودارهای مفهومی وکتوری اختصاصی {currentSubject.shortTitle}:</span>
            </h3>
            {currentSubject.diagramTags.map((tag, idx) => (
              <TopicDiagramVisualizer key={idx} topic={tag} />
            ))}
          </div>

          {/* فصول طلایی پرتکرار */}
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 text-sm">
              <Flame className="w-4 h-4 text-amber-600 fill-current" />
              <span>مباحث با بیش از ۲ بار تکرار در ۱۵ سال اخیر ({currentSubject.shortTitle}):</span>
            </div>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-6 font-medium">
              {currentSubject.goldenChaptersSummary}
            </p>
          </div>

          {/* تقلب‌نامه نکات طلایی کتاب مرجع */}
          {activeBook && activeBook.goldenNotesCheatSheet && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
                <Award className="w-4 h-4 text-blue-600" />
                <span>تقلب‌نامه و نکات کنکوری تست‌خیز شب آزمون:</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-6">
                {activeBook.goldenNotesCheatSheet.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold mt-0.5">★</span>
                    <MathText text={tip} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* تب ۴: بانک تست‌های کنکور این درس (ارشد و دکتری) */}
      {activeSubTab === 'questions' && (
        <div className="space-y-4">
          {/* نوار فیلتر مقطع و سال */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                مقطع آزمون:
              </span>
              {[
                { id: 'all', label: 'همه مقاطع' },
                { id: 'ارشد', label: 'کنکور ارشد' },
                { id: 'دکتری', label: 'کنکور دکتری' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedDegreeFilter(f.id as any)}
                  className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-colors ${
                    selectedDegreeFilter === f.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600 dark:text-slate-400">سال کنکور:</span>
              <select
                value={selectedYearFilter}
                onChange={(e) =>
                  setSelectedYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 font-bold"
              >
                <option value="all">همه سال‌ها ({allSubjectQuestions.length})</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    کنکور سال {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* لیست سوالات شناسنامه‌دار */}
          <div className="space-y-4">
            {filteredQuestions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                سؤالی با فیلترهای انتخابی یافت نشد.
              </div>
            ) : (
              filteredQuestions.map((q, qIndex) => {
                const isRevealed = revealedAnswers[q.id];
                const selectedOpt = userAnswers[q.id];
                const isAnswered = selectedOpt !== undefined;
                const activeReveal = questionReveals[q.id]; // R-036: کلید فقط از reveal سرور
                const isCorrect = !!(isAnswered && activeReveal && selectedOpt === activeReveal.correctOption);
                const isPhd =
                  q.examLevel === 'دکتری' ||
                  Boolean(q.sourceReference && q.sourceReference.includes('دکتری'));

                return (
                  <div
                    key={q.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4 text-xs shadow-xs"
                  >
                    {/* هدر شناسنامه سوال */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold tabular-nums">
                          سؤال {q.bookletQuestionNumber || qIndex + 1}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                            isPhd
                              ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {isPhd ? 'کنکور دکتری تخصصی' : 'کنکور کارشناسی ارشد'} ({q.examYear})
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                          <strong>منبع طرح سؤال:</strong> {q.designedFromTextbook || q.sourceReference}
                        </span>
                      </div>

                      {isAnswered && (
                        activeReveal ? (
                          <span
                            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 ${
                              isCorrect
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>{isCorrect ? 'پاسخ صحیح' : 'پاسخ نادرست'}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg font-bold bg-slate-500/15 text-slate-600 dark:text-slate-300">
                            در انتظار تأیید سرور
                          </span>
                        )
                      )}
                    </div>

                    {/* صورت سوال */}
                    <div className="text-sm font-semibold text-slate-900 dark:text-white leading-7">
                      <MathText text={q.text} />
                    </div>

                    {/* ۴ گزینه تست */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const isThisSelected = selectedOpt === optIdx;
                        const isThisCorrect = optIdx === (activeReveal?.correctOption ?? -1);
                        let btnStyle =
                          'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-400';

                        if (isRevealed) {
                          if (isThisCorrect) {
                            btnStyle = 'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold';
                          } else if (isThisSelected && !isThisCorrect) {
                            btnStyle = 'bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-100';
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectOption(q, optIdx)}
                            className={`p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${btnStyle}`}
                          >
                            <span className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
                              {optIdx + 1}
                            </span>
                            <span className="flex-1 text-xs leading-6">
                              <MathText text={opt} />
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* دکمه نمایش پاسخ تشریحی */}
                    <div className="pt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedAnswers((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                        }
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                      >
                        {isRevealed ? 'پنهان‌سازی پاسخ تشریحی' : 'نمایش کلید و پاسخ تشریحی مستخرج از کتاب'}
                      </button>
                    </div>

                    {/* پاسخ تشریحی و دام طراح */}
                    {isRevealed && (
                      <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
                        {activeReveal ? (
                          <>
                            <div className="p-4 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 space-y-1.5">
                              <div className="font-bold text-blue-800 dark:text-blue-300">
                                پاسخ تشریحی کامل (گزینه صحیح: گزینه {activeReveal.correctOption + 1}):
                              </div>
                              <div className="text-slate-800 dark:text-slate-200 leading-6">
                                <MathText text={activeReveal.explanation} />
                              </div>
                            </div>

                            {activeReveal.trapNote && (
                              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
                                <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>دام طراح کنکور:</span>
                                </div>
                                <div className="text-amber-950 dark:text-amber-100 leading-6">
                                  <MathText text={activeReveal.trapNote} />
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                            کلید و پاسخ تشریحی پس از تأیید سمت سرور (ثبت پاسخ شما) نمایش داده می‌شود.
                          </div>
                        )}

                        <TopicDiagramVisualizer nodeId={q.nodeId} topic={`${q.courseSectionTitle || ''} ${q.text} ${q.designedFromTextbook || ''}`} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
