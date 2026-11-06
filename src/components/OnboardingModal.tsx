import React, { useState } from 'react';
import { GraduationCap, CalendarDays, ArrowLeft, Sparkles } from 'lucide-react';

/**
 * OnboardingModal — سه‌گام خوش‌آمد برای داوطلب جدید (الگوی اپ‌های موفق):
 * گام ۱: مقطع/گرایش هدف (بدون این، صف مرور و آرشیو برای مقطع اشتباه چیده می‌شود)
 * گام ۲: تاریخ آزمون → شمارش معکوس (فوریت و افق برنامه‌ریزی)
 * گام ۳: پیشنهاد «اول تعیین سطح» به‌عنوان اولین اقدام
 * کپی حداکثر ۳ خطی، بدون اصطلاح فنی، با دکمه به‌جای متن آزاد (بهترین شیوهٔ onboarding ربات/مینی‌اپ).
 */

export interface OnboardingResult {
  track: 'phd_all' | 'business' | 'industrial' | 'technology';
  examDate: string | null; // yyyy-mm-dd یا null
}

const TRACKS: Array<{ id: OnboardingResult['track']; title: string; hint: string }> = [
  { id: 'phd_all', title: 'دکتری تخصصی مدیریت', hint: 'مبانی سازمان، تئوری‌ها، روش تحقیق، آمار، زبان' },
  { id: 'business', title: 'ارشد مدیریت بازرگانی', hint: 'بازاریابی ضریب ۴ + تئوری، اقتصاد، OR، زبان' },
  { id: 'industrial', title: 'ارشد مدیریت صنعتی', hint: 'تحقیق در عملیات ضریب ۳ + تولید، آمار، زبان' },
  { id: 'technology', title: 'ارشد مدیریت تکنولوژی', hint: 'تئوری و زبان ضریب ۳ + اقتصاد، OR' },
];

export const OnboardingModal: React.FC<{ onComplete: (r: OnboardingResult) => void }> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [track, setTrack] = useState<OnboardingResult['track'] | null>(null);
  const [examDate, setExamDate] = useState<string>('');

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 bg-gradient-to-l from-blue-900/40 to-slate-900">
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>خوش آمدید — فقط ۲۰ ثانیه</span>
          </div>
          <h2 className="text-lg font-extrabold text-white leading-7">
            برای اینکه مسیر مرور دقیقاً برای «شما» چیده شود، دو چیز را بگویید:
          </h2>
        </div>

        {step === 1 ? (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <GraduationCap className="w-4 h-4 text-blue-400" />
              مقطع و گرایش هدف شما چیست؟
            </div>
            <div className="grid grid-cols-1 gap-2">
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTrack(t.id);
                    setStep(2);
                  }}
                  className={`text-right px-4 py-3 rounded-2xl border transition-all cursor-pointer ${
                    track === t.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800/60 border-slate-700 text-slate-200 hover:border-blue-400'
                  }`}
                >
                  <div className="text-sm font-bold">{t.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{t.hint}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              تاریخ آزمون شما کی است؟
            </div>
            <p className="text-xs text-slate-400 leading-5">
              روز شمار تا آزمون بالای صفحه می‌ماند تا هر روز دقیقاً بدانید چقدر وقت دارید. بعداً از تب تنظیمات قابل تغییر است.
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
                onClick={() => setStep(1)}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                تغییر مقطع
              </button>
              <button
                type="button"
                onClick={() => onComplete({ track: track ?? 'phd_all', examDate: examDate || null })}
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
