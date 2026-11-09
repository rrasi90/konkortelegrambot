import React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * BackBar — دکمهٔ بازگشت استاندارد بالای همهٔ صفحه‌های داخلی.
 * قرارداد: هر نمای تودرتو که خودش صفحهٔ مجزاست، بالای محتوا BackBar می‌گذارد
 * تا روی موبایل همیشه مسیر برگشت دیدنی باشد (دکمهٔ بومی تلگرام به‌تنهایی کافی نیست).
 */
export const BackBar: React.FC<{
  label?: string;
  onBack: () => void;
  className?: string;
}> = ({ label = 'بازگشت', onBack, className = '' }) => (
  <button
    type="button"
    onClick={onBack}
    className={`mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-300/70 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer ${className}`}
  >
    <ArrowRight className="w-3.5 h-3.5" />
    {label}
  </button>
);
