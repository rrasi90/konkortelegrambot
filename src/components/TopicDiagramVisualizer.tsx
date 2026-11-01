import React from 'react';

interface TopicDiagramVisualizerProps {
  nodeId?: string;
  topic?: string;
  className?: string;
}

/**
 * نمودارها و تصاویر مفهومی وکتوری فوق‌العاده سبک (SVG)
 * کاملاً برداری، کم‌حجم (۱ تا ۲ کیلوبایت)، کاملاً ریسپانسیو و منطبق بر تم تاریک و روشن
 */
export const TopicDiagramVisualizer: React.FC<TopicDiagramVisualizerProps> = ({
  nodeId = '',
  topic = '',
  className = '',
}) => {
  const norm = (nodeId + ' ' + topic).toLowerCase();

  // ۱. زنجیره ارزش مایکل پورتر
  if (norm.includes('value_chain') || norm.includes('ارزش') || norm.includes('پورتر')) {
    return (
      <div className={`p-4 rounded-2xl glass-subcard border border-blue-500/20 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>نمودار مفهومی: زنجیره ارزش مایکل پورتر (Porter&apos;s Value Chain)</span>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">منبع پرتکرار کنکور</span>
        </div>
        <div className="w-full overflow-x-auto py-1">
          <svg viewBox="0 0 700 240" className="w-full min-w-[500px] h-auto select-none">
            {/* Background & Margin wedge */}
            <path d="M 30,20 L 590,20 L 670,120 L 590,220 L 30,220 Z" fill="currentColor" className="text-slate-100 dark:text-slate-800/60" stroke="#0d9488" strokeWidth="1.5" />
            <path d="M 590,20 L 670,120 L 590,220 Z" fill="#0d9488" fillOpacity="0.2" stroke="#0d9488" strokeWidth="1.5" />
            <text x="620" y="125" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-teal-800 dark:text-teal-200" transform="rotate(90 620 125)">حاشیه سود (Margin)</text>

            {/* Support activities */}
            <g fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3">
              <line x1="40" y1="50" x2="580" y2="50" />
              <line x1="40" y1="80" x2="580" y2="80" />
              <line x1="40" y1="110" x2="580" y2="110" />
            </g>
            <text x="50" y="40" fill="currentColor" className="text-[11px] font-bold text-slate-700 dark:text-slate-300">زیرساخت سازمان (مدیریت، مالی، حقوقی)</text>
            <text x="50" y="70" fill="currentColor" className="text-[11px] font-bold text-slate-700 dark:text-slate-300">مدیریت منابع انسانی (جذب، آموزش، پاداش)</text>
            <text x="50" y="100" fill="currentColor" className="text-[11px] font-bold text-slate-700 dark:text-slate-300">توسعه فناوری و تحقیق‌وتوسعه (R&amp;D)</text>
            <text x="50" y="130" fill="currentColor" className="text-[11px] font-bold text-slate-700 dark:text-slate-300">تأمین و تدارکات اقلام (Procurement)</text>
            <line x1="40" y1="140" x2="580" y2="140" stroke="#0d9488" strokeWidth="2" />

            {/* Primary activities (5 pillars) */}
            <g>
              <rect x="40" y="150" width="100" height="60" rx="6" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="90" y="175" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-blue-900 dark:text-blue-200">لجستیک ورودی</text>
              <text x="90" y="195" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500 dark:text-slate-400">انبارداری، دریافت</text>

              <rect x="150" y="150" width="100" height="60" rx="6" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="200" y="175" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-blue-900 dark:text-blue-200">عملیات ساخت</text>
              <text x="200" y="195" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500 dark:text-slate-400">تولید، مونتاژ</text>

              <rect x="260" y="150" width="100" height="60" rx="6" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="310" y="175" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-blue-900 dark:text-blue-200">لجستیک خروجی</text>
              <text x="310" y="195" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500 dark:text-slate-400">توزیع، ارسال</text>

              <rect x="370" y="150" width="100" height="60" rx="6" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="420" y="175" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-blue-900 dark:text-blue-200">بازاریابی و فروش</text>
              <text x="420" y="195" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500 dark:text-slate-400">قیمت‌گذاری، تبلیغ</text>

              <rect x="480" y="150" width="95" height="60" rx="6" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="527" y="175" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-blue-900 dark:text-blue-200">خدمات پس از فروش</text>
              <text x="527" y="195" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500 dark:text-slate-400">نصب، گارانتی</text>
            </g>
          </svg>
        </div>
      </div>
    );
  }

  // ۲. مدل پنج نیروی رقابتی مایکل پورتر
  if (norm.includes('five_forces') || norm.includes('نیروی رقابتی') || norm.includes('صنعت')) {
    return (
      <div className={`p-4 rounded-2xl glass-subcard border border-rose-500/20 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>نمودار مفهومی: ۵ نیروی رقابتی پورتر (Porter&apos;s Five Forces)</span>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-normal">تحلیل جذابیت صنعت</span>
        </div>
        <div className="w-full overflow-x-auto py-1">
          <svg viewBox="0 0 540 280" className="w-full min-w-[420px] h-auto select-none">
            {/* Center: Rivalry */}
            <rect x="180" y="100" width="180" height="80" rx="10" fill="#f43f5e" fillOpacity="0.18" stroke="#f43f5e" strokeWidth="2" />
            <text x="270" y="135" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-rose-900 dark:text-rose-100">شدت رقابت بین رقبا</text>
            <text x="270" y="155" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-500 dark:text-slate-400">(رقبای فعلی در صنعت)</text>

            {/* Top: New Entrants */}
            <rect x="180" y="10" width="180" height="55" rx="8" fill="#3b82f6" fillOpacity="0.12" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="270" y="35" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-blue-900 dark:text-blue-200">تهدید تازه واردین</text>
            <text x="270" y="52" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500 dark:text-slate-400">موانع ورود، صرفه مقیاس</text>
            <line x1="270" y1="65" x2="270" y2="95" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrow)" />

            {/* Bottom: Substitutes */}
            <rect x="180" y="215" width="180" height="55" rx="8" fill="#eab308" fillOpacity="0.12" stroke="#eab308" strokeWidth="1.5" />
            <text x="270" y="240" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-amber-900 dark:text-amber-200">تهدید محصولات جایگزین</text>
            <text x="270" y="257" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500 dark:text-slate-400">کشش تقاضا، هزینه تعویض</text>
            <line x1="270" y1="215" x2="270" y2="185" stroke="#eab308" strokeWidth="2" />

            {/* Left: Suppliers */}
            <rect x="10" y="105" width="140" height="70" rx="8" fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeWidth="1.5" />
            <text x="80" y="135" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">قدرت چانه‌زنی</text>
            <text x="80" y="152" textAnchor="middle" fill="currentColor" className="text-[10px] font-bold text-emerald-900 dark:text-emerald-200">تأمین‌کنندگان</text>
            <line x1="150" y1="140" x2="175" y2="140" stroke="#10b981" strokeWidth="2" />

            {/* Right: Buyers */}
            <rect x="390" y="105" width="140" height="70" rx="8" fill="#8b5cf6" fillOpacity="0.12" stroke="#8b5cf6" strokeWidth="1.5" />
            <text x="460" y="135" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-purple-900 dark:text-purple-200">قدرت چانه‌زنی</text>
            <text x="460" y="152" textAnchor="middle" fill="currentColor" className="text-[10px] font-bold text-purple-900 dark:text-purple-200">خریداران و مشتریان</text>
            <line x1="390" y1="140" x2="365" y2="140" stroke="#8b5cf6" strokeWidth="2" />
          </svg>
        </div>
      </div>
    );
  }

  // ۳. ماتریس رشد-سهم بوستون (BCG Matrix)
  if (norm.includes('bcg') || norm.includes('بوستون')) {
    return (
      <div className={`p-4 rounded-2xl glass-subcard border border-emerald-500/20 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>نمودار مفهومی: ماتریس رشد-سهم بوستون (BCG Matrix)</span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">استراتژی سبد کسب‌وکار</span>
        </div>
        <div className="w-full overflow-x-auto py-1">
          <svg viewBox="0 0 460 260" className="w-full min-w-[360px] h-auto select-none">
            {/* Axis labels */}
            <text x="230" y="18" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-slate-600 dark:text-slate-300">سهم نسبی بازار (Market Share)</text>
            <text x="55" y="40" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-400">زیاد (High)</text>
            <text x="395" y="40" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-400">کم (Low)</text>

            {/* Quadrant 1: Stars (High Share, High Growth) */}
            <rect x="50" y="50" width="170" height="90" rx="8" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="135" y="85" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-blue-900 dark:text-blue-200">★ ستاره‌ها (Stars)</text>
            <text x="135" y="105" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">رشد بالا / سهم بالا</text>
            <text x="135" y="122" textAnchor="middle" fill="currentColor" className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">جریان نقدینگی خنثی / سرمایه‌گذاری</text>

            {/* Quadrant 2: Question Marks (Low Share, High Growth) */}
            <rect x="235" y="50" width="170" height="90" rx="8" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="320" y="85" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-amber-900 dark:text-amber-200">؟ علامت سؤال (Question Marks)</text>
            <text x="320" y="105" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">رشد بالا / سهم کم</text>
            <text x="320" y="122" textAnchor="middle" fill="currentColor" className="text-[9px] text-rose-500 font-bold">مصرف‌کننده نقدینگی / نیازمند تصمیم</text>

            {/* Quadrant 3: Cash Cows (High Share, Low Growth) */}
            <rect x="50" y="150" width="170" height="90" rx="8" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.5" />
            <text x="135" y="185" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-emerald-900 dark:text-emerald-200">🐄 گاوهای شیرده (Cash Cows)</text>
            <text x="135" y="205" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">رشد کم / سهم بالا</text>
            <text x="135" y="222" textAnchor="middle" fill="currentColor" className="text-[9px] text-emerald-700 dark:text-emerald-300 font-bold">تولیدکننده نقدینگی بالا (شیردوشی)</text>

            {/* Quadrant 4: Dogs (Low Share, Low Growth) */}
            <rect x="235" y="150" width="170" height="90" rx="8" fill="#ef4444" fillOpacity="0.12" stroke="#ef4444" strokeWidth="1.5" />
            <text x="320" y="185" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-rose-900 dark:text-rose-200">🐕 سگ‌ها (Dogs)</text>
            <text x="320" y="205" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">رشد کم / سهم کم</text>
            <text x="320" y="222" textAnchor="middle" fill="currentColor" className="text-[9px] text-rose-600 font-bold">کاندیدای واگذاری یا انحلال</text>
          </svg>
        </div>
      </div>
    );
  }

  // ۴. ماتریس توسعه محصول-بازار ایگور آنسوف (Ansoff Matrix)
  if (norm.includes('ansoff') || norm.includes('آنسوف')) {
    return (
      <div className={`p-4 rounded-2xl glass-subcard border border-indigo-500/20 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>نمودار مفهومی: ماتریس استراتژی‌های رشد آنسوف (Ansoff Matrix)</span>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">جهت‌گیری استراتژیک رشد</span>
        </div>
        <div className="w-full overflow-x-auto py-1">
          <svg viewBox="0 0 460 250" className="w-full min-w-[360px] h-auto select-none">
            <text x="140" y="20" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-slate-700 dark:text-slate-300">محصول فعلی</text>
            <text x="330" y="20" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-slate-700 dark:text-slate-300">محصول جدید</text>

            {/* Row 1: Existing Market */}
            <rect x="50" y="35" width="180" height="90" rx="8" fill="#3b82f6" fillOpacity="0.12" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="140" y="65" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-blue-900 dark:text-blue-200">نفوذ در بازار (Penetration)</text>
            <text x="140" y="85" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">محصول فعلی در بازار فعلی</text>
            <text x="140" y="105" textAnchor="middle" fill="currentColor" className="text-[9px] text-emerald-600 font-bold">کم‌ترین ریسک / تشدید تبلیغات</text>

            <rect x="240" y="35" width="180" height="90" rx="8" fill="#8b5cf6" fillOpacity="0.12" stroke="#8b5cf6" strokeWidth="1.5" />
            <text x="330" y="65" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-purple-900 dark:text-purple-200">توسعه محصول (Product Dev)</text>
            <text x="330" y="85" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">محصول جدید در بازار فعلی</text>
            <text x="330" y="105" textAnchor="middle" fill="currentColor" className="text-[9px] text-blue-600 font-bold">تحقیق‌وتوسعه، نوآوری در ویژگی‌ها</text>

            {/* Row 2: New Market */}
            <rect x="50" y="135" width="180" height="90" rx="8" fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeWidth="1.5" />
            <text x="140" y="165" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-emerald-900 dark:text-emerald-200">توسعه بازار (Market Dev)</text>
            <text x="140" y="185" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">محصول فعلی در بازار جدید</text>
            <text x="140" y="205" textAnchor="middle" fill="currentColor" className="text-[9px] text-amber-600 font-bold">گسترش جغرافیایی یا بخش جدید مشتری</text>

            <rect x="240" y="135" width="180" height="90" rx="8" fill="#f43f5e" fillOpacity="0.12" stroke="#f43f5e" strokeWidth="1.5" />
            <text x="330" y="165" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-rose-900 dark:text-rose-200">تنوع‌بخشی (Diversification)</text>
            <text x="330" y="185" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">محصول جدید در بازار جدید</text>
            <text x="330" y="205" textAnchor="middle" fill="currentColor" className="text-[9px] text-rose-600 font-bold">بیشترین ریسک (همگون یا ناهمگون)</text>
          </svg>
        </div>
      </div>
    );
  }

  // ۵. توزیع نرمال آمار و احتمال (Gaussian Normal Distribution)
  if (norm.includes('normal') || norm.includes('توزیع') || norm.includes('stats')) {
    return (
      <div className={`p-4 rounded-2xl glass-subcard border border-teal-500/20 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>نمودار مفهومی: منحنی زنگوله‌ای توزیع نرمال استاندارد (Normal Distribution)</span>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal">فرمول‌های آمار کنکور</span>
        </div>
        <div className="w-full overflow-x-auto py-1">
          <svg viewBox="0 0 500 200" className="w-full min-w-[380px] h-auto select-none">
            {/* Axis */}
            <line x1="20" y1="170" x2="480" y2="170" stroke="currentColor" className="text-slate-400" strokeWidth="1.5" />

            {/* Bell Curve */}
            <path
              d="M 30,168 C 120,168 180,160 210,90 C 230,40 250,25 250,25 C 250,25 270,40 290,90 C 320,160 380,168 470,168"
              fill="#0d9488"
              fillOpacity="0.15"
              stroke="#0d9488"
              strokeWidth="2.5"
            />

            {/* Center Mean */}
            <line x1="250" y1="25" x2="250" y2="170" stroke="#0d9488" strokeWidth="1.5" strokeDasharray="4 3" />
            <text x="250" y="185" textAnchor="middle" fill="currentColor" className="text-xs font-bold">μ (میانگین)</text>

            {/* Standard Deviations */}
            <line x1="180" y1="120" x2="180" y2="170" stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" />
            <text x="180" y="185" textAnchor="middle" fill="currentColor" className="text-[10px]">-1σ</text>

            <line x1="320" y1="120" x2="320" y2="170" stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" />
            <text x="320" y="185" textAnchor="middle" fill="currentColor" className="text-[10px]">+1σ</text>

            {/* Percentages */}
            <text x="250" y="105" textAnchor="middle" fill="#0d9488" className="text-xs font-bold">۶۸.۲۶٪ (در بازه ±1σ)</text>
            <text x="250" y="130" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-500">۹۵.۴۴٪ (در بازه ±2σ) · ۹۹.۷۳٪ (در بازه ±3σ)</text>
          </svg>
        </div>
      </div>
    );
  }

  // ۶. هرم سلسله‌مراتب نیازهای مازلو (Maslow's Hierarchy of Needs)
  if (norm.includes('maslow') || norm.includes('مازلو') || norm.includes('انگیزش') || norm.includes('نیاز')) {
    return (
      <div className={`p-4 rounded-2xl glass-subcard border border-amber-500/20 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>نمودار مفهومی: هرم سلسله‌مراتب نیازهای آبراهام مازلو (Maslow&apos;s Hierarchy)</span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">نظریه‌های انگیزش مدیریت</span>
        </div>
        <div className="w-full overflow-x-auto py-1">
          <svg viewBox="0 0 520 250" className="w-full min-w-[380px] h-auto select-none">
            {/* Pyramid 5 tiers */}
            {/* Tier 1 (Top): Self-actualization */}
            <polygon points="260,20 200,60 320,60" fill="#f59e0b" fillOpacity="0.25" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="260" y="47" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-amber-900 dark:text-amber-200">خودشکوفایی (خلاقیت، رشد شخصی)</text>

            {/* Tier 2: Esteem */}
            <polygon points="200,65 320,65 350,105 170,105" fill="#8b5cf6" fillOpacity="0.2" stroke="#8b5cf6" strokeWidth="1.5" />
            <text x="260" y="90" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-purple-900 dark:text-purple-200">احترام و عزت‌نفس (موقعیت، شناسایی)</text>

            {/* Tier 3: Belonging / Social */}
            <polygon points="170,110 350,110 380,150 140,150" fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="260" y="135" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-blue-900 dark:text-blue-200">تعلق و عشق (روابط اجتماعی، پذیرش گروه)</text>

            {/* Tier 4: Safety */}
            <polygon points="140,155 380,155 410,195 110,195" fill="#10b981" fillOpacity="0.2" stroke="#10b981" strokeWidth="1.5" />
            <text x="260" y="180" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">امنیت (شغلی، مالی، فیزیکی و روانی)</text>

            {/* Tier 5 (Bottom): Physiological */}
            <polygon points="110,200 410,200 440,240 80,240" fill="#64748b" fillOpacity="0.2" stroke="#64748b" strokeWidth="1.5" />
            <text x="260" y="225" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-slate-800 dark:text-slate-200">نیازهای زیستی و فیزیولوژیک (خوراک، استراحت، بقا)</text>
          </svg>
        </div>
      </div>
    );
  }

  // ۷. بخش‌های پنج‌گانه ساختار سازمان مینتزبرگ (Mintzberg's 5 Organizational Parts)
  if (norm.includes('mintzberg') || norm.includes('مینتزبرگ') || norm.includes('ساختار سازمانی') || norm.includes('پنج‌گانه')) {
    return (
      <div className={`p-4 rounded-2xl glass-subcard border border-indigo-500/20 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>نمودار مفهومی: ارکان پنج‌گانه سازمان از نگاه هنری مینتزبرگ</span>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">تئوری سازمان دفت و رابینز</span>
        </div>
        <div className="w-full overflow-x-auto py-1">
          <svg viewBox="0 0 520 240" className="w-full min-w-[380px] h-auto select-none">
            {/* Strategic Apex (Top) */}
            <ellipse cx="260" cy="35" rx="85" ry="25" fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="260" y="40" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-blue-900 dark:text-blue-200">رأس راهبردی (Strategic Apex)</text>

            {/* Middle Line (Center) */}
            <rect x="200" y="75" width="120" height="55" rx="6" fill="#8b5cf6" fillOpacity="0.2" stroke="#8b5cf6" strokeWidth="1.5" />
            <text x="260" y="105" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-purple-900 dark:text-purple-200">خط میانی (Middle Line)</text>

            {/* Technostructure (Left) */}
            <rect x="30" y="75" width="145" height="55" rx="6" fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="102" y="100" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-amber-900 dark:text-amber-200">ستاد تخصصی / فن‌سالاران</text>
            <text x="102" y="118" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500 dark:text-slate-400">(استانداردسازان کار)</text>

            {/* Support Staff (Right) */}
            <rect x="345" y="75" width="145" height="55" rx="6" fill="#10b981" fillOpacity="0.2" stroke="#10b981" strokeWidth="1.5" />
            <text x="417" y="100" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">ستاد پشتیبانی (Support Staff)</text>
            <text x="417" y="118" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500 dark:text-slate-400">(حقوقی، روابط عمومی، سلف)</text>

            {/* Operating Core (Bottom) */}
            <ellipse cx="260" cy="180" rx="190" ry="35" fill="#0d9488" fillOpacity="0.18" stroke="#0d9488" strokeWidth="1.5" />
            <text x="260" y="185" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-teal-900 dark:text-teal-200">بدنه عملیاتی (Operating Core) — تولیدکنندگان کالا و خدمات اصلی</text>
          </svg>
        </div>
      </div>
    );
  }

  // ۸. آمیخته بازاریابی (Marketing 4P Mix)
  if (norm.includes('4p') || norm.includes('marketing_mix') || norm.includes('بازاریابی') || norm.includes('کاتلر')) {
    return (
      <div className={`p-4 rounded-2xl glass-subcard border border-rose-500/20 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>نمودار مفهومی: آمیخته بازاریابی (4P Marketing Mix - فلیپ کاتلر)</span>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-normal">اصول بازاریابی</span>
        </div>
        <div className="w-full overflow-x-auto py-1">
          <svg viewBox="0 0 520 220" className="w-full min-w-[380px] h-auto select-none">
            {/* Product */}
            <rect x="25" y="15" width="220" height="85" rx="8" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="135" y="42" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-blue-900 dark:text-blue-200">محصول (Product)</text>
            <text x="135" y="65" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">کیفیت، ویژگی‌ها، بسته‌بندی، برند و خدمات</text>

            {/* Price */}
            <rect x="275" y="15" width="220" height="85" rx="8" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.5" />
            <text x="385" y="42" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-emerald-900 dark:text-emerald-200">قیمت (Price)</text>
            <text x="385" y="65" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">تخفیف، شرایط پرداخت، نفوذی یا اسکیمینگ</text>

            {/* Place */}
            <rect x="25" y="115" width="220" height="85" rx="8" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="135" y="142" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-amber-900 dark:text-amber-200">توزیع و مکان (Place)</text>
            <text x="135" y="165" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">کانال‌های پخش، لجستیک، پوشش جغرافیایی</text>

            {/* Promotion */}
            <rect x="275" y="115" width="220" height="85" rx="8" fill="#ec4899" fillOpacity="0.15" stroke="#ec4899" strokeWidth="1.5" />
            <text x="385" y="142" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-pink-900 dark:text-pink-200">ترویج و ارتباطات (Promotion)</text>
            <text x="385" y="165" textAnchor="middle" fill="currentColor" className="text-[10px] text-slate-600 dark:text-slate-300">تبلیغات، روابط عمومی، فروش حضوری، پیشبرد فروش</text>
          </svg>
        </div>
      </div>
    );
  }

  // ۹. شبکه رهبری بلیک و موتون (Blake & Mouton's Managerial Grid)
  if (norm.includes('grid') || norm.includes('بلیک') || norm.includes('موتون') || norm.includes('رهبری')) {
    return (
      <div className={`p-4 rounded-2xl glass-subcard border border-teal-500/20 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>نمودار مفهومی: شبکه رهبری بلیک و موتون (Managerial Grid)</span>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal">رفتار سازمانی و رهبری</span>
        </div>
        <div className="w-full overflow-x-auto py-1">
          <svg viewBox="0 0 500 240" className="w-full min-w-[380px] h-auto select-none">
            {/* Axes */}
            <line x1="60" y1="200" x2="460" y2="200" stroke="currentColor" className="text-slate-400" strokeWidth="2" />
            <line x1="60" y1="20" x2="60" y2="200" stroke="currentColor" className="text-slate-400" strokeWidth="2" />
            <text x="260" y="225" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-slate-600 dark:text-slate-300">توجه به تولید و وظیفه (از ۱ تا ۹) →</text>
            <text x="30" y="110" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-slate-600 dark:text-slate-300" transform="rotate(-90 30 110)">توجه به افراد و روابط (از ۱ تا ۹) →</text>

            {/* (1,9) Country Club */}
            <rect x="75" y="30" width="160" height="60" rx="8" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.5" />
            <text x="155" y="55" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-emerald-800 dark:text-emerald-200">(۱، ۹) مدیریت باشگاهی</text>
            <text x="155" y="73" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500">روابط عالی / تولید فراموش‌شده</text>

            {/* (9,9) Team */}
            <rect x="290" y="30" width="160" height="60" rx="8" fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="2" />
            <text x="370" y="55" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-blue-900 dark:text-blue-100">★ (۹، ۹) مدیریت تیمی</text>
            <text x="370" y="73" textAnchor="middle" fill="currentColor" className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">بیشترین اثربخشی و تعهد</text>

            {/* (5,5) Middle of Road */}
            <rect x="180" y="105" width="160" height="45" rx="6" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="260" y="127" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-amber-800 dark:text-amber-200">(۵، ۵) مدیریت بینابین / سازشکار</text>

            {/* (1,1) Impoverished */}
            <rect x="75" y="130" width="160" height="55" rx="8" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1.5" />
            <text x="155" y="153" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-rose-800 dark:text-rose-200">(۱، ۱) مدیریت بی‌خاصیت / بی‌تفاوت</text>
            <text x="155" y="170" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500">حداقل توجه به افراد و وظیفه</text>

            {/* (9,1) Authoritarian */}
            <rect x="290" y="130" width="160" height="55" rx="8" fill="#8b5cf6" fillOpacity="0.15" stroke="#8b5cf6" strokeWidth="1.5" />
            <text x="370" y="153" textAnchor="middle" fill="currentColor" className="text-xs font-bold text-purple-800 dark:text-purple-200">(۹، ۱) مدیریت وظیفه‌محور / استبدادی</text>
            <text x="370" y="170" textAnchor="middle" fill="currentColor" className="text-[9px] text-slate-500">تولید بالا به قیمت فشار بر انسان‌ها</text>
          </svg>
        </div>
      </div>
    );
  }

  // ۱۰. مدل مقدار اقتصادی سفارش EOQ (Economic Order Quantity)
  if (norm.includes('eoq') || norm.includes('موجودی') || norm.includes('سفارش') || norm.includes('تولید')) {
    return (
      <div className={`p-4 rounded-2xl glass-subcard border border-cyan-500/20 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>نمودار مفهومی: منحنی هزینه کل و مقدار اقتصادی سفارش (EOQ Model)</span>
          <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-normal">مدیریت تولید و عملیات</span>
        </div>
        <div className="w-full overflow-x-auto py-1">
          <svg viewBox="0 0 500 220" className="w-full min-w-[380px] h-auto select-none">
            {/* Axes */}
            <line x1="50" y1="180" x2="460" y2="180" stroke="currentColor" className="text-slate-400" strokeWidth="2" />
            <line x1="50" y1="20" x2="50" y2="180" stroke="currentColor" className="text-slate-400" strokeWidth="2" />
            <text x="250" y="205" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-slate-600 dark:text-slate-300">مقدار سفارش (Q) →</text>
            <text x="25" y="100" textAnchor="middle" fill="currentColor" className="text-[11px] font-bold text-slate-600 dark:text-slate-300" transform="rotate(-90 25 100)">هزینه کل (Cost) →</text>

            {/* Holding Cost Curve (linear ascending) */}
            <line x1="60" y1="175" x2="440" y2="40" stroke="#10b981" strokeWidth="2" />
            <text x="440" y="35" textAnchor="end" fill="#10b981" className="text-[10px] font-bold">هزینه نگهداری (H·Q/2)</text>

            {/* Ordering Cost Curve (hyperbola descending) */}
            <path d="M 60,35 Q 120,130 440,170" fill="none" stroke="#3b82f6" strokeWidth="2" />
            <text x="440" y="165" textAnchor="end" fill="#3b82f6" className="text-[10px] font-bold">هزینه سفارش‌دهی (S·D/Q)</text>

            {/* Total Cost Curve (U shape) */}
            <path d="M 70,30 Q 230,195 440,75" fill="none" stroke="#ef4444" strokeWidth="2.5" />
            <text x="350" y="65" fill="#ef4444" className="text-xs font-bold">منحنی هزینه کل (Total Cost)</text>

            {/* EOQ point */}
            <line x1="225" y1="108" x2="225" y2="180" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="225" cy="108" r="4" fill="#ef4444" />
            <text x="225" y="195" textAnchor="middle" fill="#ef4444" className="text-[11px] font-bold">نقطه بهینه: Q* (EOQ)</text>
          </svg>
        </div>
      </div>
    );
  }

  // پیش‌فرض برای گره‌های دیگر
  return null;
};
