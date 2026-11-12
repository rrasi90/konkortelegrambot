/**
 * BookFlipStudyView — مطالعهٔ فصل‌به‌فصل کتاب با فلش‌کارت سه‌بعدی (درخواست مالک)
 *
 * جریان: انتخاب مقطع (ارشد/دکتری) → انتخاب درس → انتخاب کتاب → فصل ۱ تا آخر
 * هر نکتهٔ کلیدی فصل = یک کارت flip با گرافیک کمکی برای مفاهیم سخت.
 * کارت‌ها از points/formulas فصل (bookChaptersBusiness) + فلش‌کارت‌های متصل تولید می‌شوند.
 * بدون وابستگی به سرور — فقط مطالعه، بدون نمره.
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  BookOpen, ChevronLeft, ChevronRight, RotateCw, GraduationCap,
  Layers, Sparkles, ListChecks, CheckCircle2,
} from 'lucide-react';
import { REFERENCE_BOOKS_DATABASE } from '../data/referenceBooksRepo';
import { getBookChapters } from '../data/bookChaptersRepo';
import { FLASHCARDS } from '../data/flashcards';

type Level = 'arshad' | 'phd';

/** گرافیک کمکی برای مفاهیم سخت (§10 درخواست مالک) — نگاشت کلیدواژه → بصری */
const VISUAL_HINTS: Array<{ match: RegExp; icon: string; label: string }> = [
  { match: /سلسله.?مراتب|هرم|سطوح/i, icon: '🔺', label: 'ساختار سلسله‌مراتبی' },
  { match: /چرخه|دوره|چرخهٔ حیات|مراحل/i, icon: '🔄', label: 'فرایند چرخه‌ای' },
  { match: /ماتریس|چهار|دو بعد|بُعد/i, icon: '🔲', label: 'ماتریس دو‌بعدی' },
  { match: /منحنی|نمودار|S-|شیب/i, icon: '📈', label: 'نمودار روند' },
  { match: /تعادل|توازن|مبادله/i, icon: '⚖️', label: 'تعادل و مبادله' },
  { match: /فرمول|محاسبه|نسبت|درصد/i, icon: '🧮', label: 'محاسبه' },
  { match: /مقایسه|تفاوت|در مقابل|versus|vs/i, icon: '↔️', label: 'مقایسه' },
  { match: /نظریه|مدل|پارادایم/i, icon: '🧠', label: 'نظریه/مدل' },
  { match: /فرهنگ|ارزش/i, icon: '🏛️', label: 'فرهنگ و ارزش' },
  { match: /استراتژی|راهبرد/i, icon: '🎯', label: 'استراتژی' },
];

function visualFor(text: string) {
  return VISUAL_HINTS.find((v) => v.match.test(text)) ?? { icon: '📇', label: 'کارت مطالعه' };
}

interface FlipCard {
  id: string;
  chapterTitle: string;
  chapterNumber: string;
  front: string;
  back: string;
  kind: 'point' | 'formula' | 'flashcard';
  icon: string;
  label: string;
  source?: string;
}

export const BookFlipStudyView: React.FC = () => {
  const [level, setLevel] = useState<Level | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [doneChapters, setDoneChapters] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('ael.bookflip-done') || '{}'); } catch { return {}; }
  });

  // فیلتر کتاب‌ها بر اساس مقطع (نگاشت reported از SUBFIELDS)
  const PHD_BOOKS = new Set([
    'book.bus.robbins_daft', 'book.bus.islamic_moghimi', 'book.bus.english_eshraghi',
    'book.bus.david_porter_mintzberg', 'book.tech.schilling', 'book.tech.tidd_khalil',
  ]);

  const books = useMemo(() => {
    if (!level) return [];
    return REFERENCE_BOOKS_DATABASE.filter((b) =>
      level === 'phd' ? PHD_BOOKS.has(b.id) || b.courseName?.includes('دکتری') : true,
    );
  }, [level]);

  const courseLabel: Record<string, string> = {
    mgmt: 'تئوری‌ها و مبانی مدیریت',
    stats_math: 'ریاضی و آمار',
    islamic: 'مدیریت اسلامی',
    english: 'زبان تخصصی',
    econ: 'اقتصاد',
    or_: 'تحقیق در عملیات',
    production: 'تولید و عملیات',
    marketing: 'بازاریابی',
    strategy: 'استراتژیک',
    innovation: 'نوآوری و فناوری',
    decision: 'تصمیم‌گیری و MCDM',
    tech_transfer: 'انتقال فناوری',
  };

  // گروه‌بندی کتاب‌ها بر اساس خانوادهٔ درس
  const courseGroups = useMemo(() => {
    const groups: Record<string, typeof books> = {};
    for (const b of books) {
      const key = b.id.includes('robbins') ? 'mgmt'
        : b.id.includes('math_stats') ? 'stats_math'
        : b.id.includes('islamic') ? 'islamic'
        : b.id.includes('english') ? 'english'
        : b.id.includes('econ') ? 'econ'
        : b.id.includes('or_fadavi') || b.id.includes('or_mehregan') ? 'or_'
        : b.id.includes('pom') ? 'production'
        : b.id.includes('kotler') ? 'marketing'
        : b.id.includes('david_porter') ? 'strategy'
        : b.id.includes('schilling') || b.id.includes('tidd') ? 'innovation'
        : b.id.includes('mcdm') ? 'decision'
        : 'other';
      (groups[key] = groups[key] ?? []).push(b);
    }
    return groups;
  }, [books]);

  const book = books.find((b) => b.id === bookId);
  const chapters = useMemo(() => (bookId ? getBookChapters(bookId) : []), [bookId]);
  const chapter = chapters[chapterIdx];

  // کارت‌های فصل: نکات + فرمول‌ها + فلش‌کارت‌های متصل
  const cards: FlipCard[] = useMemo(() => {
    if (!chapter || !bookId) return [];
    const out: FlipCard[] = [];
    (chapter.points ?? []).forEach((p, i) => {
      const v = visualFor(p);
      out.push({
        id: `${chapter.id}-p${i}`, chapterTitle: chapter.title, chapterNumber: chapter.number,
        front: `نکتهٔ کلیدی ${i + 1}`, back: p, kind: 'point', icon: v.icon, label: v.label,
      });
    });
    (chapter.formulas ?? []).forEach((f, i) => {
      const v = visualFor(f);
      out.push({
        id: `${chapter.id}-f${i}`, chapterTitle: chapter.title, chapterNumber: chapter.number,
        front: `فرمول/مدل ${i + 1}`, back: f, kind: 'formula', icon: v.icon, label: v.label,
      });
    });
    FLASHCARDS.filter((c) => chapter.nodes.includes(c.nodeId)).forEach((c) => {
      const v = visualFor(c.front + ' ' + c.back);
      out.push({
        id: c.id, chapterTitle: chapter.title, chapterNumber: chapter.number,
        front: c.front, back: c.back + (c.extra ? '\n💡 ' + c.extra : ''), kind: 'flashcard', icon: v.icon, label: v.label, source: c.source,
      });
    });
    return out;
  }, [chapter, bookId]);

  const current = cards[cardIdx];
  const isChapterDone = bookId && doneChapters[bookId + '#' + chapter.id];

  const markChapterDone = useCallback(() => {
    if (!bookId || !chapter) return;
    const next = { ...doneChapters, [bookId + '#' + chapter.id]: true };
    setDoneChapters(next);
    try { localStorage.setItem('ael.bookflip-done', JSON.stringify(next)); } catch { /* ignore */ }
    setCardIdx(0); setFlipped(false);
    if (chapterIdx + 1 < chapters.length) setChapterIdx((i) => i + 1);
  }, [bookId, chapter, doneChapters, chapterIdx, chapters.length]);

  const nextCard = () => {
    setFlipped(false);
    if (cardIdx + 1 < cards.length) setCardIdx((i) => i + 1);
  };
  const prevCard = () => { setFlipped(false); if (cardIdx > 0) setCardIdx((i) => i - 1); };

  /* ---------- مرحلهٔ ۱: انتخاب مقطع ---------- */
  if (!level) {
    return (
      <div className="max-w-xl mx-auto space-y-4 my-8">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <GraduationCap className="w-5 h-5 text-blue-500" /> مطالعهٔ فصل‌به‌فصل کتاب با فلش‌کارت
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">مقطع هدف خود را انتخاب کنید:</p>
        {([
          { id: 'arshad' as Level, title: 'کارشناسی ارشد (کد ۱۱۴۲)', desc: 'همهٔ ۱۴ کتاب مرجع ارشد' },
          { id: 'phd' as Level, title: 'دکتری تخصصی (کد ۲۱۶۲)', desc: 'کتاب‌های تخصصی و پارادایم‌های دکتری' },
        ]).map((o) => (
          <button key={o.id} type="button" onClick={() => setLevel(o.id)}
            className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 text-right cursor-pointer transition-all">
            <div className="font-bold text-slate-900 dark:text-white">{o.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{o.desc}</div>
          </button>
        ))}
      </div>
    );
  }

  /* ---------- مرحلهٔ ۲: انتخاب درس ---------- */
  if (!courseId) {
    return (
      <div className="max-w-xl mx-auto space-y-3 my-8">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">انتخاب درس</div>
          <button type="button" onClick={() => setLevel(null)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">← تغییر مقطع</button>
        </div>
        {Object.entries(courseGroups).map(([key, group]) => (
          <button key={key} type="button"
            onClick={() => { setCourseId(key); setBookId(group[0]?.id ?? null); setChapterIdx(0); setCardIdx(0); }}
            className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 text-right cursor-pointer transition-all flex items-center justify-between">
            <span className="font-bold text-sm text-slate-900 dark:text-white">{courseLabel[key] ?? key}</span>
            <span className="text-xs text-slate-400">{group.length} کتاب</span>
          </button>
        ))}
      </div>
    );
  }

  /* ---------- مرحلهٔ ۳: انتخاب کتاب ---------- */
  if (!bookId || !book) {
    const group = courseGroups[courseId] ?? [];
    return (
      <div className="max-w-xl mx-auto space-y-3 my-8">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">انتخاب کتاب</div>
          <button type="button" onClick={() => setCourseId(null)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">← تغییر درس</button>
        </div>
        {group.map((b) => (
          <button key={b.id} type="button"
            onClick={() => { setBookId(b.id); setChapterIdx(0); setCardIdx(0); setFlipped(false); }}
            className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 text-right cursor-pointer transition-all">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">{b.bookTitle}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{getBookChapters(b.id).length} فصل · {b.authors}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  /* ---------- مرحلهٔ ۴: فهرست فصل‌ها ---------- */
  if (chapterIdx < 0) {
    return null;
  }

  /* ---------- مرحلهٔ ۵: کارت‌های فصل ---------- */
  return (
    <div className="max-w-xl mx-auto space-y-4 my-4">
      {/* مسیر: مقطع ← درس ← کتاب ← فصل */}
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
        <button type="button" onClick={() => { setLevel(null); setCourseId(null); setBookId(null); }} className="hover:text-blue-500 cursor-pointer">{level === 'phd' ? 'دکتری' : 'ارشد'}</button>
        <span>›</span>
        <button type="button" onClick={() => setCourseId(null)} className="hover:text-blue-500 cursor-pointer">{courseLabel[courseId] ?? courseId}</button>
        <span>›</span>
        <button type="button" onClick={() => setBookId(null)} className="hover:text-blue-500 cursor-pointer">{book.bookTitle?.slice(0, 30)}</button>
        <span>›</span>
        <span className="font-bold text-slate-600 dark:text-slate-300">فصل {chapter.number}</span>
      </div>

      {/* انتخابگر فصل */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {chapters.map((ch, i) => (
          <button key={ch.id} type="button"
            onClick={() => { setChapterIdx(i); setCardIdx(0); setFlipped(false); }}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
              i === chapterIdx ? 'bg-blue-600 text-white border-blue-600'
                : doneChapters[bookId + '#' + ch.id] ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
            }`}>
            {ch.number}{doneChapters[bookId + '#' + ch.id] ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="font-bold text-slate-700 dark:text-slate-200">{chapter.title}</div>
        {isChapterDone && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
      </div>

      {cards.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-center text-sm text-slate-500">
          ❌ هنوز محتوایی برای این فصل وارد نشده — فصل md آن در <code>docs/content-coverage/book-chapters/{bookId}/</code> قابل تکمیل است.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>کارت {cardIdx + 1} از {cards.length} · {current.icon} {current.label}</span>
            <span>{current.kind === 'formula' ? 'فرمول' : current.kind === 'flashcard' ? 'فلش‌کارت' : 'نکتهٔ کلیدی'}</span>
          </div>

          {/* کارت flip سه‌بعدی */}
          <div className="[perspective:1200px]">
            <div
              className={`relative w-full min-h-[240px] cursor-pointer select-none [transform-style:preserve-3d] transition-transform duration-500 ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
              onClick={() => setFlipped((f) => !f)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFlipped((f) => !f); }}
            >
              {/* روی کارت */}
              <div className={`absolute inset-0 [backface-visibility:hidden] rounded-2xl border-2 border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-900 dark:to-blue-950/30 shadow-sm p-6 flex flex-col items-center justify-center text-center`}>
                <div className="text-4xl mb-3">{current.icon}</div>
                <div className="text-[10px] text-slate-400 mb-2 flex items-center gap-1"><Layers className="w-3 h-3" />{current.label}</div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white leading-8">{current.front}</div>
                {!flipped && <div className="mt-4 text-xs text-slate-400 flex items-center gap-1"><RotateCw className="w-3 h-3" /> کلیک = flip</div>}
              </div>
              {/* پشت کارت */}
              <div className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/80 to-white dark:from-slate-900 dark:to-emerald-950/20 shadow-sm p-6 overflow-y-auto`}>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" />پاسخ — {chapter.title}</div>
                <div className="text-sm text-slate-800 dark:text-slate-100 leading-7 whitespace-pre-line text-right">{current.back}</div>
                {current.source && <div className="mt-3 text-[10px] text-slate-400 text-left" dir="ltr">{current.source}</div>}
              </div>
            </div>
          </div>

          {/* ناوبری کارت */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={prevCard} disabled={cardIdx === 0}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${((cardIdx + 1) / cards.length) * 100}%` }} />
            </div>
            {cardIdx + 1 < cards.length ? (
              <button type="button" onClick={nextCard}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1">
                کارت بعدی <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button type="button" onClick={markChapterDone}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1">
                <ListChecks className="w-3.5 h-3.5" /> فصل تمام شد ✓
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
