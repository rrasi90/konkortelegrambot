import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Trash2, Upload } from 'lucide-react';
import { FLASHCARD_COURSES } from '../data/flashcards';
import { DECK_STATS } from '../data/flashcardDeck';
import {
  addUserFlashcard,
  commitImportedCards,
  loadUserFlashcards,
  parseFlashcardImport,
  removeUserFlashcard,
  serializeFlashcardBackup,
  type UserFlashcard,
} from '../utils/userFlashcards';
import type { CardLayer } from '../data/flashcardDeck';

const LAYER_HINT: Record<CardLayer, string> = {
  L1: 'یادآوری: تعریف، فاکت یا فرمول کوتاه.',
  L2: 'فهم: چرا، رابطه یا مقایسه.',
  L3: 'مرز: استثنا، محدودیت یا شرایط شکست.',
};

export const PersonalFlashcardsView: React.FC = () => {
  const [cards, setCards] = useState<UserFlashcard[]>(() => loadUserFlashcards());
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [extra, setExtra] = useState('');
  const [courseId, setCourseId] = useState('mkt');
  const [layer, setLayer] = useState<CardLayer>('L1');
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<UserFlashcard[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const courseOptions = useMemo(
    () => FLASHCARD_COURSES.map((course) => ({ id: course.id, title: course.title })),
    [],
  );

  const refresh = () => setCards(loadUserFlashcards());

  const handleAdd = () => {
    const result = addUserFlashcard({ front, back, extra, courseId, layer });
    if (result.errors.length > 0) {
      setErrors(result.errors);
      setNotice(null);
      return;
    }
    setErrors([]);
    setNotice('کارت ذخیره شد و در جلسهٔ مرور بعدی می‌آید.');
    setFront('');
    setBack('');
    setExtra('');
    refresh();
  };

  const handleDelete = (id: string) => {
    removeUserFlashcard(id);
    setNotice('کارت حذف شد.');
    refresh();
  };

  const handlePreviewImport = () => {
    const result = parseFlashcardImport(importText, courseId, layer);
    setImportPreview(result.cards);
    setImportErrors(result.errors);
    setNotice(null);
  };

  const handleCommitImport = () => {
    if (importPreview.length === 0) return;
    commitImportedCards(importPreview);
    setNotice(`${importPreview.length} کارت وارد شد.`);
    setImportPreview([]);
    setImportText('');
    setImportErrors([]);
    setImportOpen(false);
    refresh();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) {
      setImportErrors(['فایل بزرگ‌تر از ۲ مگابایت است؛ یک فایل کوچک‌تر انتخاب کن.']);
      return;
    }
    const text = await file.text();
    setImportText(text);
    const result = parseFlashcardImport(text, courseId, layer);
    setImportPreview(result.cards);
    setImportErrors(result.errors);
    setNotice(null);
  };

  const handleExport = () => {
    if (cards.length === 0) return;
    const blob = new Blob([serializeFlashcardBackup(cards)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ael-flashcards.json';
    link.click();
    URL.revokeObjectURL(url);
    setNotice('پشتیبان JSON ساخته شد.');
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 my-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">کارت‌های من</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              یک مفهوم در هر کارت. کارت خصوصی است و روی همین دستگاه ذخیره می‌شود؛ با پشتیبان JSON می‌توانی آن را منتقل کنی.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-500 dark:text-slate-300">
            {cards.length}
          </span>
        </div>
        <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
          {DECK_STATS.ankiUsable} کارت متنی از فایل انکی آماده است. کارت‌های تصویری بدون فایل تصویر نمایش داده نمی‌شوند.
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          <Plus className="w-4 h-4 text-emerald-600" /> کارت تازه
        </div>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          روی کارت
          <textarea
            value={front}
            onChange={(event) => setFront(event.target.value)}
            rows={2}
            placeholder="مثلاً: نیاز پنهان"
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100"
          />
        </label>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          پاسخ
          <textarea
            value={back}
            onChange={(event) => setBack(event.target.value)}
            rows={3}
            placeholder="یک جملهٔ کوتاه و دقیق."
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            درس
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            >
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            لایه
            <select
              value={layer}
              onChange={(event) => setLayer(event.target.value as CardLayer)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="L1">L1 — یادآوری</option>
              <option value="L2">L2 — فهم</option>
              <option value="L3">L3 — مرز</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">{LAYER_HINT[layer]}</p>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          توضیح اختیاری
          <input
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
            placeholder="منبع یا نکتهٔ کمکی"
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
        </label>
        {errors.length > 0 && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-5 text-rose-700 dark:text-rose-300">
            {errors.map((error) => <div key={error}>• {error}</div>)}
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4" /> {notice}
          </div>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-3 text-sm font-extrabold text-white cursor-pointer"
        >
          ذخیرهٔ کارت
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <button
          type="button"
          onClick={() => setImportOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
        >
          <span className="flex items-center gap-2"><Upload className="w-4 h-4 text-emerald-600" /> ورود از انکی</span>
          <span className="text-xs text-slate-400">{importOpen ? 'بستن' : 'باز کردن'}</span>
        </button>
        {importOpen && (
          <div className="mt-3 space-y-3">
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              هر خط یک کارت: روی کارت، TAB یا کاما، پاسخ. ستون سوم اختیاری است. فایل CSV، TSV یا JSON پشتیبان هم پذیرفته می‌شود.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                انتخاب فایل
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".tsv,.csv,.json,text/plain,application/json"
                onChange={(event) => { void handleFile(event); }}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleExport}
                disabled={cards.length === 0}
                className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
              >
                پشتیبان JSON
              </button>
            </div>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={5}
              dir="ltr"
              placeholder={'نیاز پنهان\tمشتری می‌داند چه می‌خواهد اما بیان نمی‌کند.'}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreviewImport}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                پیش‌نمایش
              </button>
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={importPreview.length === 0}
                className="flex-1 rounded-xl bg-emerald-600 disabled:opacity-40 px-3 py-2.5 text-xs font-bold text-white cursor-pointer"
              >
                ذخیرهٔ {importPreview.length} کارت
              </button>
            </div>
            {importErrors.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                {importErrors.slice(0, 6).map((error) => <div key={error}>• {error}</div>)}
                {importErrors.length > 6 && <div>و {importErrors.length - 6} خطای دیگر.</div>}
              </div>
            )}
            {importPreview.length > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                {importPreview.length} کارت آمادهٔ ذخیره است.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
            هنوز کارت شخصی نساخته‌ای. کارت اول را از بالا اضافه کن.
          </div>
        ) : (
          cards.map((card) => (
            <div key={card.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-300">{card.layer}</span>
                    <span className="truncate text-xs text-slate-400">{courseOptions.find((course) => course.id === card.courseId)?.title ?? card.courseId}</span>
                    {card.sourceQuestionId && (
                      <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">از دفتر خطا</span>
                    )}
                    {card.suspended && (
                      <span className="rounded-md bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">متوقف برای مرور</span>
                    )}
                  </div>
                  <div className="mt-2 text-sm font-bold leading-6 text-slate-900 dark:text-white">{card.front}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.back}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(card.id)}
                  aria-label="حذف کارت"
                  className="shrink-0 rounded-xl p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        پشتیبان JSON از همین بخش ساخته می‌شود. همگام‌سازی خودکار بین دستگاه‌ها هنوز به API پایدار وابسته است؛ کارت‌ها فعلاً در همین مرورگر ذخیره می‌شوند.
      </div>
    </div>
  );
};
