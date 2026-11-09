import React, { useState } from 'react';
import { GraduationCap, CalendarDays, ArrowLeft, Sparkles, CheckSquare, Square, ChevronRight } from 'lucide-react';

/**
 * OnboardingModal — جریان سطح‌محور (طبق درخواست: اول مقطع، بعد گرایش، نه همه با هم)
 * گام ۱: مقطع — دکتری تخصصی یا کارشناسی ارشد
 * گام ۲: گرایش — ارشد: چندانتخابی گرایش‌های ارشد؛ دکتری: phd_all (شامل پیش‌نیاز ارشد)
 * گام ۳: تاریخ آزمون (اختیاری) — شمارش معکوس
 */

export type OnboardTrack =
  | 'phd_all' | 'business' | 'industrial' | 'technology' | 'public'
  | 'financial' | 'media' | 'foresight' | 'stpolicy' | 'amad';

export type OnboardLevel = 'arshad' | 'phd';

export interface OnboardingResult {
  track: OnboardTrack;
  tracks: OnboardTrack[];
  examDate: string | null;
  level: OnboardLevel;
}

const ARSHAD_TRACKS: Array<{ id: OnboardTrack; title: string; hint: string }> = [
  { id: 'business', title: 'مدیریت بازرگانی', hint: 'بازاریابی ضریب ۴ + تئوری، اقتصاد، OR، زبان' },
  { id: 'industrial', title: 'مدیریت صنعتی', hint: 'تحقیق در عملیات ضریب ۳ + تولید، آمار، زبان' },
  { id: 'technology', title: 'مدیریت تکنولوژی', hint: 'تئوری و زبان ضریب ۳ + اقتصاد، OR' },
  { id: 'public', title: 'مدیریت دولتی', hint: 'نظریه‌های دولتی و خط‌مشی‌گذاری + حقوق اداری' },
  { id: 'financial', title: 'مدیریت مالی', hint: 'ریسک و سرمایه‌گذاری + بازارهای مالی (بستهٔ ۸)' },
  { id: 'media', title: 'مدیریت رسانه و اطلاعات', hint: 'MIS پیشرفته + مدیریت دانش (بستهٔ ۶)' },
  { id: 'foresight', title: 'آینده‌پژوهی', hint: 'نظریه‌ها و روش‌های آینده‌پژوهی + نوآوری' },
  { id: 'stpolicy', title: 'سیاست‌گذاری علم و فناوری', hint: 'سیاست‌گذاری علم + مدیریت فناوری' },
  { id: 'amad', title: 'مدیریت آماد و پشتیبانی', hint: 'ارتباط و رفتار سازمانی + استراتژیک (بستهٔ ۹)' },
];

export const OnboardingModal: React.FC<{ onComplete: (r: OnboardingResult) => void }> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [level, setLevel] = useState<OnboardLevel | null>(null);
  const [selected, setSelected] = useState<Set<OnboardTrack>>(new Set());
  const [examDate, setExamDate] = useState<string>('');

  const toggle = (id: OnboardTrack) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // حداقل یک گرایش
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const tracks: OnboardTrack[] =
    level === 'phd' ? ['phd_all'] : level === 'arshad' ? [...selected] : [];
  const primary: OnboardTrack = tracks[0] ?? 'business';

  const levelButton = (l: OnboardLevel, title: string, hint: string) => (
    <button
      key={l}
      type="button"
      onClick={() => {
        setLevel(l);
        if (l === 'arshad') setSelected(new Set(['business']));
        setStep(2);
      }}
      className="text-right px-5 py-5 rounded-2xl border border-slate-700 bg-slate-800/60 text-slate-100 transition-all cursor-pointer hover:border-blue-400"
    >
      <div className="text-base font-extrabold">{title}</div>
      <div className="text-[11px] text-slate-400 mt-1 leading-5">{hint}</div>
      <div className="flex items-center gap-1 text-[11px] text-blue-300 mt-2">
        انتخاب <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 bg-gradient-to-l from-blue-900/40 to-slate-900">
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>خوش آمدید — فقط ۲۰ ثانیه</span>
          </div>
          <h2 className="text-lg font-extrabold text-white leading-7">
            {step === 1 && 'مقطع هدف شما چیست؟'}
            {step === 2 && 'گرایش‌های هدف — چند انتخاب مجاز است'}
            {step === 3 && 'تاریخ آزمون (اختیاری — قابل تغییر بعداً)'}
          </h2>
          <div className="flex gap-1.5 mt-3" dir="ltr">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 rounded-full flex-1 transition-all ${s <= step ? 'bg-blue-500' : 'bg-slate-700'}`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <GraduationCap className="w-4 h-4 text-blue-400" />
              در چه مقطعی شرکت می‌کنید؟
            </div>
            {levelButton('arshad', 'کارشناسی ارشد (کد ۱۱۴۲)', 'گرایش‌های بازرگانی، صنعتی، دولتی، مالی، رسانه، تکنولوژی، آینده‌پژوهی، سیاست‌گذاری و آماد')}
            {levelButton('phd', 'دکتری تخصصی مدیریت (کد ۲۱۶۲)', 'مبانی سازمان، تئوری‌ها، روش تحقیق، آمار، زبان — مسیر دکتری شامل پوشش کامل مباحث ارشد (پیش‌نیاز) هم می‌شود')}
          </div>
        )}

        {step === 2 && level === 'arshad' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <GraduationCap className="w-4 h-4 text-blue-400" />
              ارشد — گرایش(های) هدف شما؟
            </div>
            <div className="grid grid-cols-1 gap-2">
              {ARSHAD_TRACKS.map((t) => {
                const active = selected.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={`text-right px-4 py-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      active
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-800/60 border-slate-700 text-slate-200 hover:border-blue-400'
                    }`}
                  >
                    {active
                      ? <CheckSquare className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      : <Square className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                    }
                    <div>
                      <div className="text-sm font-bold">{t.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{t.hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {selected.size > 1 && (
              <p className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] leading-5 text-amber-200">
                انتخاب چند گرایش مجاز است — درس‌های مشترک یک‌بار خوانده می‌شوند و دروس اختصاصی هر گرایش با ضریب خودش وارد برنامه می‌شود.
              </p>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                تغییر مقطع
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={selected.size === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-extrabold cursor-pointer"
              >
                ادامه
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && level === 'phd' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <GraduationCap className="w-4 h-4 text-blue-400" />
              دکتری تخصصی مدیریت
            </div>
            <div className="rounded-2xl border border-blue-500/40 bg-blue-600/10 px-4 py-4 text-sm text-slate-100 leading-6">
              <div className="font-bold mb-1">مجموعه مدیریت — همه گرایش‌ها (کد ۲۱۶۲)</div>
              آزمون دکتری همهٔ گرایش‌ها زیر یک مجموعه برگزار می‌شود؛ برنامهٔ شما همهٔ درس‌ها را با ضریب رسمی پوشش می‌دهد.
            </div>
            <p className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] leading-5 text-amber-200">
              مسیر دکتری شامل پوشش کامل مباحث ارشد (پیش‌نیاز) هم می‌شود.
            </p>
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                تغییر مقطع
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold cursor-pointer"
              >
                ادامه
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              تاریخ آزمون (اختیاری — قابل تغییر بعداً)
            </div>
            <p className="text-xs text-slate-400 leading-5">
              روز شمار تا آزمون بالای صفحه می‌ماند. اگر هنوز تاریخ را نمی‌دانید، خالی بگذارید.
            </p>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-slate-100 text-sm"
              dir="ltr"
            />
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                تغییر گرایش
              </button>
              <button
                type="button"
                onClick={() => onComplete({ track: primary, tracks, examDate: examDate || null, level: level ?? 'arshad' })}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold cursor-pointer shadow-lg shadow-blue-600/20"
              >
                شروع کنیم
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
