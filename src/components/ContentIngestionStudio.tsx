import React, { useState } from 'react';
import {
  AgentContentPackage,
  validateAgentContentPackage,
} from '../engine/aelEngine';
import {
  FileJson,
  Copy,
  Check,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  PlusCircle,
  BookOpen,
  Code2,
} from 'lucide-react';

interface ContentIngestionStudioProps {
  onIngestValidatedPackage: (pkg: AgentContentPackage) => void;
  existingNodeIds: string[];
}

const SAMPLE_AGENT_PACKAGE: AgentContentPackage = {
  node: {
    id: 'ob.motivation',
    track: 'common',
    course: 'مبانی سازمان و مدیریت (رفتار سازمانی)',
    chapter: 'نظریه‌های انگیزش در سازمان',
    topic: 'نظریه انتظار ویکتور وروم و نظریه برابری آدامز',
    sourceBookCitation:
      'رفتار سازمانی، استیفن رابینز و تیموتی جاج، فصل ۷ و ۸؛ و کتاب مدیریت رفتار سازمانی دکتر علی رضائیان، فصل انگیزش',
    examYearsAppeared: [1396, 1398, 1400, 1401, 1402, 1403, 1404],
    examCoefficient: 5,
    historicalWeight: 9,
    estimatedStudyHours: 2.5,
    layer: 1,
    prerequisiteNodeIds: ['mb.structure'],
  },
  lesson: {
    summary:
      'نظریه‌های فرآیندی انگیزش (برخلاف نظریه‌های محتوایی مزلو و هرزبرگ که به «چرایی و نوع نیازها» می‌پردازند)، به «چگونگی و فرآیند شناختیِ ایجاد انگیزش» تمرکز دارند. دو نظریه محوری این فصل در کنکور دکتری، «نظریه انتظار ویکتور وروم (Vroom)» و «نظریه برابری استیسی آدامز (Adams)» هستند.',
    microSteps: [
      {
        stepNumber: 1,
        title: 'گام ۱: فرمول ضربی نظریه انتظار ویکتور وروم ($F = E \\times I \\times V$)',
        content:
          'ویکتور وروم انگیزش (Force) را حاصل‌ضرب سه متغیر شناختی می‌داند:\n۱. انتظار (Expectancy — پیوند تلاش-عملکرد): احتمال ذهنی فرد مبنی بر اینکه تلاش بیشتر به عملکرد بهتر منجر می‌شود ($0 \\le E \\le 1$).\n۲. وسیله‌ای بودن (Instrumentality — پیوند عملکرد-پاداش): باور فرد به اینکه عملکرد سطح بالا منجر به دریافت پاداش سازمانی می‌شود ($0 \\le I \\le 1$).\n۳. جاذبه یا ظرفیت (Valence — ارزش پاداش): میزان اهمیت و مطلوبیت پاداش در نظر شخص ($-1 \\le V \\le +1$).\nنکته ریاضی کنکور: چون رابطه «ضربی» است، اگر حتی یکی از سه متغیر صفر باشد، کل انگیزش صفر می‌شود!',
      },
      {
        stepNumber: 2,
        title: 'گام ۲: نظریه برابری آدامز و نسبت ستانده به داده ($O/I$)',
        content:
          'استیسی آدامز بیان می‌کند که کارکنان نسبت «ستانده‌های دریافتی (Outcomes: حقوق، ارتقا، قدردانی)» به «داده‌های ورودی خود (Inputs: تلاش، تحصیلات، سابقه)» را با افراد مرجع مقایسه می‌کنند:\n$$\\frac{O_A}{I_A} = \\frac{O_B}{I_B}$$\nدر صورت احساس نابرابری (کم‌ پاداش‌دهی یا پاداش بیش از حد)، فرد یکی از ۶ واکنش زیر را نشان می‌دهد: ۱) تغییر داده‌ها (کم‌کاری)، ۲) تغییر ستانده‌ها، ۳) تحریف شناختی نسبت به خود، ۴) تحریف شناختی نسبت به دیگری، ۵) تغییر فرد مرجع، ۶) ترک سازمان.',
      },
      {
        stepNumber: 3,
        title: 'گام ۳: عدالت توزیعی، رویه‌ای و تعاملی (گسترش نظریه برابری)',
        content:
          'در ادبیات نوین رفتار سازمانی، عدالت سازمانی به سه بعد تقسیم می‌شود:\n• عدالت توزیعی (Distributive): انصاف ادراک‌شده از مقدار و تخصیص پاداش‌ها.\n• عدالت رویه‌ای (Procedural): انصاف ادراک‌شده از فرآیند و قوانین تصمیم‌گیری.\n• عدالت مراوده‌ای/تعاملی (Interactional): رفتار محترمانه و صادقانه مدیر هنگام ابلاغ تصمیم.',
      },
    ],
    conceptDescriptors: [
      {
        concept: 'رابطه تلاش-عملکرد در مدل وروم',
        descriptor: 'نام فنی متغیر',
        answer: 'انتظار (Expectancy)',
      },
      {
        concept: 'رابطه عملکرد-پاداش در مدل وروم',
        descriptor: 'نام فنی متغیر',
        answer: 'وسیله‌ای بودن (Instrumentality)',
      },
      {
        concept: 'نابرابری مثبت (پاداش بیش از حد) در مدل آدامز',
        descriptor: 'نوع هیجان ایجادشده در فرد',
        answer: 'احساس گناه (Guilt)؛ در حالی که کم‌پاداش‌دهی احساس خشم ایجاد می‌کند',
      },
    ],
    konkoorTips: [
      'دام بسیار پرتکرار کنکور: در مدل وروم، دامنه تغییرات «جاذبه (Valence)» بین ۱- تا ۱+ است (چون یک پیامد مثل انتقال به شهر دیگر ممکن است برای فرد ناخوشایند و منفی باشد)، اما دامنه «انتظار» از ۰ تا ۱ است!',
      'تفکیک هرزبرگ و وروم: نظریه دو عاملی هرزبرگ «محتوایی» است، اما نظریه انتظار وروم و برابری آدامز «فرآیندی» هستند.',
    ],
    keyTerms: [
      'Vroom Expectancy Theory',
      'Expectancy vs Instrumentality',
      'Valence',
      'Adams Equity Theory',
      'Procedural Justice',
    ],
    conceptCheck: {
      prompt:
        'در مدل انتظار ویکتور وروم، باور کارمند به اینکه «در صورت کسب رتبه اول ارزیابی عملکرد، سازمان قطعاً پاداش وعده‌داده‌شده را به او پرداخت می‌کند» کدام متغیر است؟',
      options: [
        'وسیله‌ای بودن (Instrumentality — رابطه عملکرد و پاداش)',
        'انتظار (Expectancy — رابطه تلاش و عملکرد)',
      ],
      correctIndex: 0,
      explanation:
        'پیوند بین تلاش و عملکرد «انتظار» نام دارد، اما پیوند بین عملکرد و دریافت پاداش «وسیله‌ای بودن» است.',
    },
  },
  questions: [
    {
      id: 'q.ob.motiv.1',
      examYear: 1403,
      sourceReference: 'کنکور دکتری مدیریت ۱۴۰۳ — منبع: رفتار سازمانی رابینز فصل ۷',
      text: 'بر اساس نظریه انتظار ویکتور وروم، اگر کارمندی مطمئن باشد که با تلاش زیاد می‌تواند پروژه را با کیفیت عالی به پایان برساند ($E = 0.9$) و مدیر نیز قطعاً به او ترفیع در محل کار جدید خواهد داد ($I = 1.0$)، اما کارمند به دلیل مشکلات خانوادگی به‌شدت از انتقال به شهر جدید بیزار باشد ($V = -0.8$)، وضعیت انگیزش او چگونه خواهد بود؟',
      options: [
        'انگیزش مثبت و بالا، زیرا انتظار و وسیله‌ای بودن هر دو نزدیک به ۱ هستند.',
        'انگیزش منفی (اجتناب فعال از عملکرد بالا)، زیرا جاذبه پیامد ($V$) منفی است و رابطه متغیرها ضربی است.',
        'انگیزش متوسط، زیرا میانگین سه متغیر مثبت است.',
        'انگیزش بی‌تفاوت، زیرا جاذبه در فرمول وروم اثری ندارد.',
      ],
      correctOption: 1,
      explanation:
        'در فرمول $F = E \\times I \\times V$، چون جاذبه پیامد منفی است ($V = -0.8$)، حاصل‌ضرب برابر با $0.9 \\times 1.0 \\times (-0.8) = -0.72$ شده و فرد نه تنها انگیزه‌ای ندارد بلکه تلاش می‌کند ترفیع نگیرد!',
      trapNote: 'توجه به منفی شدن جاذبه ($V < 0$) و ماهیت ضربی فرمول وروم.',
    },
    {
      id: 'q.ob.motiv.proof.1404',
      examYear: 1404,
      sourceReference: 'کنکور سراسری دکتری ۱۴۰۴ — قرنطینه اثبات تسلط',
      isQuarantinedProof: true,
      text: '[سؤال قرنطینه کنکور ۱۴۰۴ — اثبات تسلط] در نظریه برابری آدامز، هنگامی که کارمند الف احساس کند نسبت ستانده به داده او کمتر از همکار مرجعش است ($\\frac{O_A}{I_A} < \\frac{O_B}{I_B}$) و حقوق به صورت «ساعتی/ماهیانه» پرداخت شود، محتمل‌ترین واکنش رفتاری او چیست؟',
      options: [
        'افزایش کمیت و کیفیت کار برای اثبات شایستگی',
        'کاهش داده‌ها (کاهش تلاش، کم‌کاری و کاهش کیفیت یا کمیت کار) برای برقراری مجدد توازن نسبت',
        'احساس گناه و بخشش بخشی از پاداش خود',
        'افزایش ساعت کاری داوطلبانه بدون دریافت اضافه‌کار',
      ],
      correctOption: 1,
      explanation:
        'در پرداخت ساعتی/ماهیانه، کارمندی که احساس کم‌پاداش‌دهی (Under-reward inequity) می‌کند، برای بزرگ کردن کسر $\\frac{O_A}{I_A}$ مخرج کسر یعنی داده‌ها و تلاش خود ($I_A$) را کاهش می‌دهد.',
      trapNote:
        'در پرداخت کارمزدی (Piece-rate)، کم‌پاداش‌دهی باعث می‌شود فرد «کمیت» را بالا ببرد اما «کیفیت» را فدا کند؛ ولی در پرداخت ماهیانه هم کمیت و هم کیفیت را کاهش می‌دهد.',
    },
  ],
};

const AGENT_PROMPT_GUIDE = `# دستورالعمل استاندارد تزریق محتوا به سامانه یادگیری تطبیقی کنکور (AEL Agent Ingestion Spec)

شما یک ایجنت مهندسی محتوای آموزشی برای کنکور دکتری مدیریت هستید. هرگاه کاربر یک متن درسی، فصل کتاب، جزوه یا برگه‌ی سؤال کنکور به شما داد، باید آن را بدون هیچ‌گونه حدس زدن (Zero-Guessing Policy) به یک شیء JSON استاندارد با ساختار زیر تبدیل کنید:

## قوانین اجباری (Strict Rules):
1. هیچ فیلدی نباید حدس زده شود یا خالی بماند.
2. فیلد \`node.sourceBookCitation\` باید نام دقیق کتاب مرجع دانشگاهی، نویسنده و شماره فصل را مشخص کند.
3. فیلد \`node.examYearsAppeared\` باید آرایه‌ای از سال‌های واقعی طرح سؤال در کنکور سراسری دکتری باشد (مثلاً \`[1398, 1400, 1402, 1404]\`). اگر در ۳ سال یا بیشتر تکرار شده باشد، موتور AEL به صورت خودکار نشان «🔥 فصل فوق‌العاده مهم کنکور» را به آن اختصاص می‌دهد.
4. بخش \`lesson.microSteps\` باید درسنامه را به حداقل ۳ گام کامل، خودبسنده و دقیق (شامل تعاریف، فرمول‌های LaTeX بین علامت \`$...$\` و دسته‌بندی‌ها) تقسیم کند تا داوطلب هنگام مطالعه به هیچ منبع دیگری نیاز نداشته باشد.
5. بخش \`lesson.conceptDescriptors\` باید مفاهیم کلیدی را به زوج‌های «مفهوم ← ویژگی/توصیف‌گر ← پاسخ دقیق» (الگوی RemNote) بشکند.
6. در بخش \`questions\`، حداقل ۱ سؤال استاندارد و ۱ سؤال قرنطینه اثبات تسلط (\`isQuarantinedProof: true\`) با کلید صحیح (\`0\` تا \`3\`)، پاسخ تشریحی خط‌به‌خط و دام طراح (\`trapNote\`) قرار دهید.`;

export const ContentIngestionStudio: React.FC<ContentIngestionStudioProps> = ({
  onIngestValidatedPackage,
  existingNodeIds,
}) => {
  const [jsonInput, setJsonInput] = useState<string>(
    JSON.stringify(SAMPLE_AGENT_PACKAGE, null, 2)
  );
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    ingestedTopic?: string;
  } | null>(null);

  const handleCopyAgentPrompt = () => {
    const fullSpec = `${AGENT_PROMPT_GUIDE}\n\n## نمونه دقیق خروجی JSON مورد انتظار:\n\`\`\`json\n${JSON.stringify(
      SAMPLE_AGENT_PACKAGE,
      null,
      2
    )}\n\`\`\``;
    navigator.clipboard.writeText(fullSpec);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handleValidateAndIngest = () => {
    const check = validateAgentContentPackage(jsonInput);
    if (!check.valid || !check.parsed) {
      setValidationResult({ valid: false, errors: check.errors });
      return;
    }

    onIngestValidatedPackage(check.parsed);
    setValidationResult({
      valid: true,
      errors: [],
      ingestedTopic: check.parsed.node.topic,
    });
  };

  return (
    <div className="space-y-6">
      {/* هدر راهنمای ایجنت */}
      <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileJson className="w-5 h-5 text-blue-500" />
              <span>استودیو ورود محتوای جدید و پروتکل ایجنت هوش مصنوعی (Zero-Guessing Ingestion)</span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-6">
              هر زمان که یک متن درسی یا جزوه جدید دارید، کافی است دکمه <strong>«کپی پرامپت راهنمای ایجنت»</strong> را بزنید و به همراه متن درس به هر ایجنت یا مدلی بدهید. ایجنت دقیقاً می‌فهمد چگونه درسنامه گام‌به‌گام، سال‌های تکرار در کنکور، منبع دقیق و تست‌ها را در قالب استاندارد استخراج کند؛ سپس خروجی را در کادر زیر وارد کنید تا بلافاصله به گراف دانش و صف تست اضافه شود.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyAgentPrompt}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            {copiedPrompt ? (
              <>
                <Check className="w-4 h-4" />
                <span>پرامپت و اسکیمای ایجنت کپی شد!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>کپی پرامپت استاندارد ویژه ایجنت‌ها</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ستون چپ: قوانین اعتبارسنجی بدون حدس و دستورالعمل ایجنت (5 ستون) */}
        <div className="lg:col-span-5 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-500" />
            <span>قرارداد سخت‌گیرانه عدم حدس (Zero-Guessing Schema)</span>
          </h2>

          <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 leading-6">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-white block mb-0.5">
                ۱. منبع دقیق دانشگاهی (sourceBookCitation):
              </strong>
              نام دقیق کتاب مرجع، نویسنده/مترجم و شماره فصل باید بدون حدس ذکر شود.
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-white block mb-0.5">
                ۲. آرایه سال‌های کنکور (examYearsAppeared):
              </strong>
              سال‌های طرح سؤال از این مبحث (مثلاً <code className="font-mono">[1398, 1400, 1402, 1403, 1404]</code>). سیستم به صورت خودکار تعداد تکرار را شمرده و اگر پرتکرار باشد به داوطلب هشدار می‌دهد.
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-white block mb-0.5">
                ۳. گام‌های خردشده (microSteps) و کارت‌های مفهومی (conceptDescriptors):
              </strong>
              هر درسنامه باید حداقل ۲ گام تشریحی کامل (با فرمول‌های LaTeX) و حداقل ۱ زوج مفهوم-توصیف‌گر داشته باشد تا مطلب کاملاً کافی و خودبسنده باشد.
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-white block mb-0.5">
                ۴. اتصال به پیش‌نیازها (prerequisiteNodeIds):
              </strong>
              شناسه‌های گره‌های موجود در گراف دانش:
              <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                {existingNodeIds.map((id) => (
                  <span
                    key={id}
                    className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20"
                  >
                    {id}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ستون راست: ویرایشگر زنده JSON و دکمه تزریق فوری به سیستم (7 ستون) */}
        <div className="lg:col-span-7 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                ورودی بسته محتوا (آماده آزمایش: مبحث انگیزش وروم و آدامز)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                یک نمونه کامل و استاندارد از مبحث «نظریه انتظار وروم و برابری آدامز» در کادر زیر قرار داده شده است؛ دکمه تایید را بزنید تا زنده به سیستم اضافه شود!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setJsonInput(JSON.stringify(SAMPLE_AGENT_PACKAGE, null, 2))}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              بازگردانی نمونه استاندارد
            </button>
          </div>

          <textarea
            dir="ltr"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={16}
            className="w-full p-4 rounded-xl bg-[#0d1117] text-slate-100 font-mono text-xs leading-6 border border-slate-800 focus:outline-none focus:border-blue-500"
          />

          {validationResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                validationResult.valid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100'
              }`}
            >
              {validationResult.valid ? (
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>
                    مبحث «{validationResult.ingestedTopic}» با موفقیت اعتبارسنجی شد و به درخت مهارت، کتابخانه درسنامه‌ها و صف تست اضافه گردید!
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>خطا در اعتبارسنجی (قانون ممنوعیت حدس زدن):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleValidateAndIngest}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>اعتبارسنجی دقیق و افزودن فوری به گراف دانش و درسنامه‌ها</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
