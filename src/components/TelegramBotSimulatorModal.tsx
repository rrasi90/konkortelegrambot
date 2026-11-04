import React, { useState } from 'react';
import { KnowledgeNode, InteractiveLesson, QuestionItem } from '../data/konkorData';
import {
  LearnerSixDState,
  UserStats,
  MultiYearFrequencyInsight,
} from '../engine/aelEngine';
import { tmaHaptic } from '../utils/telegramBridge';
import {
  Send,
  X,
  Bot,
  Sparkles,
  ExternalLink,
  CheckCheck,
  RotateCcw,
  Flame,
  Moon,
  Star,
} from 'lucide-react';

interface TelegramBotSimulatorModalProps {
  nodes: KnowledgeNode[];
  lessons: Record<string, InteractiveLesson>;
  questions: QuestionItem[];
  nodeStates: Record<string, LearnerSixDState>;
  stats: UserStats;
  examFrequencyList: MultiYearFrequencyInsight[];
  onRateLessonFromBot: (nodeId: string, rating: 1 | 2 | 3 | 4 | 5) => string;
  onTriggerDeepLink: (action: {
    type: 'lesson' | 'practice' | 'proof' | 'night_quiz' | 'placement' | 'zero_reset';
    nodeId?: string;
  }) => void;
  onClose: () => void;
}

interface BotChatMessage {
  id: string;
  sender: 'bot' | 'user';
  time: string;
  text: string;
  inlineButtons?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'rating' | 'link';
  }[][];
}

export const TelegramBotSimulatorModal: React.FC<TelegramBotSimulatorModalProps> = ({
  nodes,
  lessons,
  nodeStates,
  stats,
  examFrequencyList,
  onRateLessonFromBot,
  onTriggerDeepLink,
  onClose,
}) => {
  const topHighYield = [...examFrequencyList]
    .sort((a, b) => b.appearanceCount - a.appearanceCount)
    .slice(0, 3);

  const [messages, setMessages] = useState<BotChatMessage[]>(() => [
    {
      id: 'msg-welcome',
      sender: 'bot',
      time: '۲۱:۴۵',
      text:
        `سلام داوطلب گرامی! به ربات تلگرام «سامانه یادگیری تطبیقی کنکور دکتری (AEL v3.0)» خوش آمدید.\n\n` +
        `وضعیت فعلی پروفایل شما:\n` +
        `• وضعیت حساب: ${
          stats.isZeroStateNewUser ? 'کاربر جدید (رکوردهای کاملاً صفر 0%)' : 'فعال و کالیبره‌شده'
        }\n` +
        `• پاسخ‌های ثبت‌شده: ${stats.totalAnswered} تست | درسنامه‌های امتیازدهی‌شده: ${stats.lessonsRatedCount}\n` +
        `• پیوستگی: ${stats.streakDays} روز | امتیاز: ${stats.xp} XP\n\n` +
        `می‌توانید هم از داخل چت تلگرام به درسنامه‌ها امتیاز ۱ تا ۵ بدهید و هم با دکمه‌های شیشه‌ای زیر مستقیماً وارد بخش مورد نظر در مینی‌اپ شوید:`,
      inlineButtons: [
        [
          {
            label: 'باز کردن درسنامه پایه (لایه ۰) در مینی‌اپ',
            variant: 'link',
            onClick: () => {
              tmaHaptic.impact('medium');
              onTriggerDeepLink({ type: 'lesson', nodeId: 'mb.structure' });
            },
          },
        ],
        [
          {
            label: 'آزمون تعیین سطح تطبیقی (۵ سؤال گلوگاهی)',
            variant: 'link',
            onClick: () => {
              tmaHaptic.impact('medium');
              onTriggerDeepLink({ type: 'placement' });
            },
          },
        ],
        [
          {
            label: 'ریست کامل رکوردها به وضعیت صفر (Zero-State)',
            variant: 'primary',
            onClick: () => {
              tmaHaptic.notify('warning');
              onTriggerDeepLink({ type: 'zero_reset' });
            },
          },
        ],
      ],
    },
  ]);

  const appendCommandExchange = (
    userCmd: string,
    botReply: Omit<BotChatMessage, 'id' | 'sender' | 'time'>
  ) => {
    tmaHaptic.impact('light');
    const nowStr = new Date().toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setMessages((prev) => [
      ...prev,
      {
        id: `u_${Date.now()}`,
        sender: 'user',
        time: nowStr,
        text: userCmd,
      },
      {
        id: `b_${Date.now() + 1}`,
        sender: 'bot',
        time: nowStr,
        ...botReply,
      },
    ]);
  };

  // ۱. شبیه‌سازی دستور /lesson در ربات تلگرام (همراه با دکمه‌های شیشه‌ای ۱ تا ۵)
  const handleSendLessonInChat = (nodeId = 'sm.rbv') => {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) {
      appendCommandExchange('/lesson', { text: 'شناسهٔ مبحث معتبر نیست.' });
      return;
    }
    const lesson = lessons[node.id];
    const currentScore = nodeStates[node.id]?.masteryScore ?? 0;

    appendCommandExchange(`/lesson ${node.id}`, {
      text:
        `خلاصه درسنامه تلگرامی: ${node.topic}\n` +
        `• منبع دقیق طراح: ${node.sourceBookCitation}\n` +
        `• سال‌های تکرار در کنکور: ${node.examYearsAppeared.join('، ')}\n` +
        `• تسلط فعلی شما: ${currentScore}٪\n\n` +
        `${lesson?.summary || ''}\n\n` +
        `چقدر این درس را یاد گرفتید؟ (از ۱ تا ۵ انتخاب کنید تا برنامه درسی همین لحظه آپدیت شود):`,
      inlineButtons: [
        ([1, 2, 3, 4, 5] as const).map((r) => ({
          label: `امتیاز ${r} از ۵`,
          variant: 'rating' as const,
          onClick: () => {
            tmaHaptic.notify('success');
            const summary = onRateLessonFromBot(node.id, r);
            const nowStr = new Date().toLocaleTimeString('fa-IR', {
              hour: '2-digit',
              minute: '2-digit',
            });
            setMessages((prev) => [
              ...prev,
              {
                id: `rate_reply_${Date.now()}`,
                sender: 'bot',
                time: nowStr,
                text: `ثبت امتیاز درک ${r} از ۵ برای «${node.topic}»:\n\n${summary}`,
                inlineButtons: [
                  [
                    {
                      label: 'شروع حل تست‌های این مبحث در مینی‌اپ',
                      variant: 'link',
                      onClick: () =>
                        onTriggerDeepLink({
                          type: 'practice',
                          nodeId: node.id,
                        }),
                    },
                  ],
                ],
              },
            ]);
          },
        })),
        [
          {
            label: 'باز کردن درسنامه کامل گام‌به‌گام در مینی‌اپ',
            variant: 'link',
            onClick: () => onTriggerDeepLink({ type: 'lesson', nodeId: node.id }),
          },
        ],
      ],
    });
  };

  // ۲. شبیه‌سازی دستور /radar (رادار فصول پرتکرار چندساله کنکور)
  const handleSendRadarInChat = () => {
    const lines = topHighYield
      .map(
        (f, idx) =>
          `${idx + 1}. ${f.topic}\n` +
          `   • تکرار در ${f.appearanceCount} دوره کنکور (${f.yearsAppeared.join('، ')})\n` +
          `   • منبع: ${f.sourceBookCitation}`
      )
      .join('\n\n');

    appendCommandExchange('/radar (فصول پرتکرار کنکور)', {
      text:
        `رادار هوشمند فصول پرتکرار کنکور دکتری:\n` +
        `بر اساس تحلیل سؤالات ادوار سازمان سنجش، این فصول در چندین سال مختلف تکرار شده‌اند و بالاترین اولویت بودجه‌بندی را دارند:\n\n` +
        lines,
      inlineButtons: topHighYield.map((f) => [
        {
          label: `درسنامه + امتیاز ۱ تا ۵: ${f.topic.slice(0, 26)}...`,
          variant: 'link' as const,
          onClick: () => onTriggerDeepLink({ type: 'lesson', nodeId: f.nodeId }),
        },
      ]),
    });
  };

  // ۳. شبیه‌سازی پوش نوتیفیکیشن کوییز شبانه (۲۲:۳۰)
  const handleSendNightQuizPush = () => {
    appendCommandExchange('شبیه‌سازی اعلان ساعت ۲۲:۳۰ ربات', {
      text:
        `زمان کوییز شبانه تثبیت شکاف‌ها (۳ دقیقه)!\n\n` +
        `بر اساس فعالیت امروز شما، ۴ تست کلیدی در حالت Verification آماده شده است تا بدون به هم ریختن فواصل بلندمدت FSRS، شکاف‌های امروز را ببندید:`,
      inlineButtons: [
        [
          {
            label: 'شروع فوری کوییز شبانه در مینی‌اپ (startapp=night_quiz)',
            variant: 'link',
            onClick: () => onTriggerDeepLink({ type: 'night_quiz' }),
          },
        ],
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-[#0e1621] text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* هدر کلاینت تلگرام */}
        <div className="px-4 py-3 bg-[#17212b] border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <span>ربات مربی کنکور دکتری (@KonkorAELBot)</span>
                <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-mono">
                  bot
                </span>
              </div>
              <div className="text-[11px] text-sky-400">
                متصل به موتور زنده مینی‌اپ (Deep-Link + Inline 1..5 Rating)
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* بدنه پیام‌های چت تلگرام */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0e1621]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.sender === 'user' ? 'items-start' : 'items-end'
              }`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-6 whitespace-pre-line shadow-xs ${
                  m.sender === 'user'
                    ? 'bg-[#2b5278] text-white rounded-br-xs'
                    : 'bg-[#182533] text-slate-100 border border-slate-700/60 rounded-bl-xs'
                }`}
              >
                <div>{m.text}</div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-1 font-mono tabular-nums">
                  <span>{m.time}</span>
                  {m.sender === 'user' && (
                    <CheckCheck className="w-3 h-3 text-sky-400" />
                  )}
                </div>
              </div>

              {/* دکمه‌های شیشه‌ای تلگرام (Inline Keyboard Markup) */}
              {m.inlineButtons && m.inlineButtons.length > 0 && (
                <div className="w-full max-w-[92%] mt-1.5 space-y-1">
                  {m.inlineButtons.map((row, rIdx) => (
                    <div
                      key={rIdx}
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {row.map((btn, bIdx) => (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={btn.onClick}
                          className={`min-h-[36px] py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer border ${
                            btn.variant === 'rating'
                              ? 'bg-[#203042] hover:bg-sky-600 text-amber-300 hover:text-white border-sky-500/30'
                              : btn.variant === 'link'
                              ? 'bg-[#1f344d] hover:bg-sky-600 text-sky-200 hover:text-white border-sky-500/35'
                              : 'bg-[#182533]/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          {btn.variant === 'rating' && (
                            <Star className="w-3 h-3 fill-current shrink-0" />
                          )}
                          <span className="truncate">{btn.label}</span>
                          {btn.variant === 'link' && (
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-80" />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* نوار دستورات سریع ربات تلگرام (Bot Command Menu) */}
        <div className="p-3 bg-[#17212b] border-t border-slate-800 space-y-2">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>دستورات سریع ربات تلگرام برای تست تعامل دوطرفه با مینی‌اپ:</span>
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleSendLessonInChat('sm.rbv')}
              className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-bold flex items-center gap-1.5 transition-colors duration-200 cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>/lesson (امتیاز ۱ تا ۵ در چت)</span>
            </button>

            <button
              type="button"
              onClick={handleSendRadarInChat}
              className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors duration-200 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>/radar (فصول پرتکرار کنکور)</span>
            </button>

            <button
              type="button"
              onClick={handleSendNightQuizPush}
              className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-colors duration-200 cursor-pointer"
            >
              <Moon className="w-3.5 h-3.5" />
              <span>اعلان کوییز شبانه</span>
            </button>

            <button
              type="button"
              onClick={() => onTriggerDeepLink({ type: 'zero_reset' })}
              className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors duration-200 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>/reset_zero</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
