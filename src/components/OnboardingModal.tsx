import React, { useState } from 'react';
import { GraduationCap, CalendarDays, ArrowLeft, Sparkles, CheckSquare, Square } from 'lucide-react';

/**
 * OnboardingModal — بازطراحی: چندتخصصی همزمان + تعیین سطح اختیاری
 * گام ۱: انتخاب چندگانهٔ مقطع/گرایش (checkbox — دکتری و ارشد همزمان مجاز)
 * گام ۲: تاریخ آزمون (اختیاری) — شمارش معکوس
 * تعیین سطح: پیشنهاد می‌شود ولی اجباری نیست
 */

export interface OnboardingResult {
  track: 'phd_all' | 'business' | 'industrial' | 'technology';
  tracks: Array<'phd_all' | 'business' | 'industrial' | 'technology'>;
  examDate: string | null;
}

const ALL_TRACKS: Array<{ id: OnboardingResult['track']; title: string; hint: string; level: 'دکتری' | 'ارشد' }> = [
  { id: 'phd_all', title: 'دکتری تخصصی مدیریت', hint: 'مبانی سازمان، تئوری‌ها، روش تحقیق، آمار، زبان', level: 'دکتری' },
  { id: 'business', title: 'ارشد مدیریت بازرگانی', hint: 'بازاریابی ضریب ۴ + تئوری، اقتصاد، OR، زبان', level: 'ارشد' },
  { id: 'industrial', title: 'ارشد مدیریت صنعتی', hint: 'تحقیق در عملیات ضریب ۳ + تولید، آمار، زبان', level: 'ارشد' },
  { id: 'technology', title: 'ارشد مدیریت تکنولوژی', hint: 'تئوری و زبان ضریب ۳ + اقتصاد، OR', level: 'ارشد' },
];

export const OnboardingModal: React.FC<{ onComplete: (r: OnboardingResult) => void }> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<OnboardingResult['track']>>(new Set(['phd_all']));
  const [examDate, setExamDate] = useState<string>('');

  const toggle = (id: OnboardingResult['track']) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // حداقل یک انتخاب
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const primary = selected.has('phd_all') ? 'phd_all' : selected.has('business') ? 'business' : selected.has('industrial') ? 'industrial' : 'technology';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 bg-gradient-to-l from-blue-900/40 to-slate-900">
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>خوش آمدید — فقط ۲۰ ثانیه</span>
          </div>
          <h2 className="text-lg font-extrabold text-white leading-7">
            مسیر مطالعهٔ خود را انتخاب کنید (چند مورد مجاز است)
          </h2>
        </div>

        {step === 1 ? (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <GraduationCap className="w-4 h-4 text-blue-400" />
              مقطع و گرایش‌های هدف — چند انتخاب مجاز
            </div>
            <div className="grid grid-cols-1 gap-2">
              {ALL_TRACKS.map((t) => {
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
                      <div className="text-[10px] text-blue-300 mt-0.5">{t.level}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {selected.has('phd_all') && selected.size > 1 && (
              <p className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] leading-5 text-amber-200">
                مسیر دکتری شامل پوشش کامل مباحث ارشد هم می‌شود — همزمان مطالعهٔ هر دو مقطع مجاز و پیشنهادی است.
              </p>
            )}
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={selected.size === 0}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-extrabold cursor-pointer"
            >
              ادامه
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              تاریخ آزمون (اختیاری — قابل تغییر بعداً)
            </div>
            <p className="text-xs text-slate-400 leading-5">
              روز شمار تا آزمون بالای صفحه می‌ماند. اگر هنوز تاریخ را نمی‌دانید، خالی بگذارید.
            </p>
            {selected.has('phd_all') && (
              <p className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] leading-5 text-amber-200">
                مسیر دکتری شامل پوشش کامل مباحث ارشد (پیش‌نیاز) هم می‌شود.
              </p>
            )}
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
                onClick={() => setStep(1)}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                تغییر گرایش
              </button>
              <button
                type="button"
                onClick={() => onComplete({ track: primary, tracks: [...selected], examDate: examDate || null })}
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
