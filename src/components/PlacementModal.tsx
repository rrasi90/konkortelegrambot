import React, { useState } from 'react';
import { QUESTION_BANK, KNOWLEDGE_NODES } from '../data/konkorData';
import { PLACEMENT_BOTTLENECK_QUESTIONS, MasteryDeltaWithTitle } from '../engine/aelEngine';
import { MathText } from './MathText';
import { Sparkles, CheckCircle2, XCircle, X, ArrowLeft } from 'lucide-react';
import { gradeAnswersOnServerBatch, type PracticeReveal } from '../lib/serverGrading';

interface PlacementModalProps {
  onCompletePlacement: (results: { questionId: string; wasCorrect: boolean }[]) => MasteryDeltaWithTitle[];
  onClose: () => void;
}

export const PlacementModal: React.FC<PlacementModalProps> = ({
  onCompletePlacement,
  onClose,
}) => {
  const questions = PLACEMENT_BOTTLENECK_QUESTIONS.map(
    (id) => QUESTION_BANK.find((q) => q.id === id)!
  ).filter(Boolean);

  const [step, setStep] = useState(0);
  const [questionReveals, setQuestionReveals] = useState<Record<string, { correctOption: number; explanation: string; trapNote: string }>>({});

  const [answers, setAnswers] = useState<
    { questionId: string; chosenIdx: number; wasCorrect: boolean }[]
  >([]);
  const [finalDeltas, setFinalDeltas] = useState<MasteryDeltaWithTitle[] | null>(null);

  const currentQ = questions[step];
  const currentNode = KNOWLEDGE_NODES.find((n) => n.id === currentQ?.nodeId);

  const handleSelect = (optionIdx: number) => {
    if (!currentQ) return;
    // R-036: wasCorrect فقط از تصحیح سمت سرور — نه از کلید باندل
    void (async () => {
    let wasCorrect = false;
    try {
      const reveal = await gradeAnswersOnServerBatch([{ questionId: currentQ.id, selectedOption: optionIdx }]);
      wasCorrect = reveal.get(currentQ.id)?.wasCorrect ?? false;
      const r = reveal.get(currentQ.id);
      if (r) {
        setQuestionReveals((prev) => ({
          ...prev,
          [currentQ.id]: { correctOption: r.correctOption, explanation: r.explanation, trapNote: r.trapNote },
        }));
      }
    } catch {
      // آفلاین: پاسخ ثبت می‌شود اما بدون نتیجهٔ معتبر (برچسب unknown)
    }
    const nextAnswers = [
      ...answers,
      { questionId: currentQ.id, chosenIdx: optionIdx, wasCorrect },
    ];
    setAnswers(nextAnswers);

    if (step + 1 < questions.length) {
      setStep(step + 1);
    } else {
      const deltas = onCompletePlacement(
        nextAnswers.map(({ questionId, wasCorrect: c }) => ({
          questionId,
          wasCorrect: c,
        }))
      );
      setFinalDeltas(deltas);
    }
    })();
  };

  if (!currentQ && !finalDeltas) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 my-8">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              تعیین سطح سریع (سؤالات کلیدی کنکور)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!finalDeltas && currentQ ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                سؤال {step + 1} از {questions.length} · {currentNode?.course} ({currentNode?.topic})
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                منبع: {currentQ.sourceReference || currentNode?.sourceBookCitation}
              </span>
            </div>

            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-7 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800">
              <MathText text={currentQ.text} />
            </div>

            <div className="space-y-2">
              {currentQ.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className="w-full text-right p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/30 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all flex items-center gap-3 cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="leading-6">
                    <MathText text={opt} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div className="text-xs leading-6 text-slate-800 dark:text-slate-200">
                <strong className="font-bold text-emerald-700 dark:text-emerald-300 block text-sm">
                  تعیین سطح شما با موفقیت ثبت شد!
                </strong>
                تسلط مباحث پایه و پیش‌نیازها بر اساس پاسخ‌های شما تنظیم گردید.
              </div>
              <div className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                نتیجه: {answers.filter((a) => a.wasCorrect).length} از {answers.length} پاسخ درست
                {answers.filter((a) => a.wasCorrect).length === answers.length && ' — شروع فوق‌العاده‌ای بود! 🎉'}
              </div>
            </div>

            {/* پاسخ تشریحی سؤالات تعیین سطح */}
            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
              {answers.map((ans, idx) => {
                const q = questions.find((item) => item.id === ans.questionId);
                if (!q) return null;
                const activeReveal = questionReveals[ans.questionId]; // R-036: کلید فقط از reveal سرور
                return (
                  <div
                    key={q.id + idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {ans.wasCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        )}
                        <span>
                          سؤال {idx + 1}: پاسخ شما گزینه {ans.chosenIdx + 1}
                          {ans.wasCorrect ? ' (درست)' : ` — کلید: گزینه ${(activeReveal?.correctOption ?? 0) + 1}`}
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {q.sourceReference}
                      </span>
                    </div>
                    <div className="text-slate-700 dark:text-slate-300 leading-6">
                      {activeReveal ? (
                        <MathText text={activeReveal.explanation} />
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">
                          پاسخ تشریحی پس از تأیید سمت سرور نمایش داده می‌شود.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>مشاهده برنامه شخصی در میز کار</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
