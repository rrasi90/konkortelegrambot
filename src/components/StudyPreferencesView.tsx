import React, { useEffect, useState } from 'react';
import { Bell, CalendarDays, CheckCircle2, MessageSquare, Target, Clock3 } from 'lucide-react';
import type { OnboardingResult, OnboardTrack } from './OnboardingModal';
import {
  CAPACITY_OPTIONS,
  REVIEW_CAP_OPTIONS,
  WEEKDAY_LABELS,
  loadStudySettings,
  saveStudySettings,
  type StudyCapacity,
  type StudySettings,
} from '../utils/studySettings';
import { loadReminderRemote, saveReminderRemote, sendAdminMessage, sendTestReminder } from '../lib/feedbackApi';

const ARSHAD_TRACKS: Array<{ id: OnboardTrack; title: string }> = [
  { id: 'business', title: 'مدیریت بازرگانی' },
  { id: 'industrial', title: 'مدیریت صنعتی' },
  { id: 'technology', title: 'مدیریت تکنولوژی' },
  { id: 'public', title: 'مدیریت دولتی' },
  { id: 'financial', title: 'مدیریت مالی' },
  { id: 'media', title: 'مدیریت رسانه' },
  { id: 'foresight', title: 'آینده‌پژوهی' },
  { id: 'stpolicy', title: 'سیاست‌گذاری علم و فناوری' },
  { id: 'amad', title: 'مدیریت آماد و پشتیبانی' },
];

const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

function statusClass(ok: boolean): string {
  return ok
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
}

export const StudyPreferencesView: React.FC<{ onboarding: OnboardingResult | null }> = ({ onboarding }) => {
  const [settings, setSettings] = useState<StudySettings>(() => loadStudySettings());
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageState, setMessageState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    void loadReminderRemote()
      .then((remote) => {
        if (!cancelled && remote) setSettings((prev) => ({ ...prev, reminder: remote }));
      })
      .catch(() => {
        // سرور در دسترس نیست؛ تنظیم محلی معتبر می‌ماند.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<StudySettings>) => {
    setNotice(null);
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const updateReminder = (patch: Partial<StudySettings['reminder']>) => {
    setNotice(null);
    setSettings((prev) => ({ ...prev, reminder: { ...prev.reminder, ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    saveStudySettings(settings);
    try {
      const remote = await saveReminderRemote(settings.reminder);
      setSettings((prev) => ({ ...prev, reminder: remote }));
      setNotice({ ok: true, text: 'تنظیمات ذخیره شد. یادآور روی سرور ثبت است.' });
    } catch (error) {
      setNotice({
        ok: false,
        text: `${error instanceof Error ? error.message : 'ذخیرهٔ سروری انجام نشد'} تنظیم محلی ذخیره شد؛ ارسال یادآور تا اتصال سرور فعال نمی‌شود.`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    saveStudySettings(settings);
    try {
      await saveReminderRemote(settings.reminder);
      await sendTestReminder();
      setNotice({ ok: true, text: 'پیام آزمایشی به تلگرام فرستاده شد.' });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'ارسال آزمایشی ناموفق بود.' });
    } finally {
      setTesting(false);
    }
  };

  const handleMessage = async () => {
    if (message.trim().length < 5) {
      setMessageState('error');
      return;
    }
    setMessageState('sending');
    try {
      await sendAdminMessage(message);
      setMessageState('sent');
      setMessage('');
    } catch {
      setMessageState('error');
    }
  };

  const secondary = settings.secondaryGoal;
  const primaryLabel = onboarding?.level === 'phd'
    ? 'دکتری تخصصی'
    : (ARSHAD_TRACKS.find((track) => track.id === onboarding?.track)?.title ?? onboarding?.track ?? 'ثبت نشده');

  return (
    <div className="max-w-xl mx-auto space-y-4 my-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h1 className="text-base font-extrabold text-slate-900 dark:text-white">هدف دوم و ظرفیت</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          هدف اصلی از آنبوردینگ خوانده می‌شود. هدف دوم اختیاری است و فقط وقتی ظرفیت کافی باشد برنامهٔ کامل می‌گیرد.
        </p>
        <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          هدف اصلی: {onboarding ? `${onboarding.level === 'phd' ? 'دکتری' : 'ارشد'} · ${primaryLabel}` : 'هنوز ثبت نشده'}
          {onboarding?.examDate ? ` · ${onboarding.examDate}` : ''}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Target className="w-4 h-4 text-emerald-600" /> هدف دوم
          </div>
          <button
            type="button"
            onClick={() => update({ secondaryGoal: secondary ? null : { level: 'arshad', track: 'business', examDate: null, weeklyShare: 30 } })}
            className={`rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer ${secondary ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
          >
            {secondary ? 'فعال' : 'خاموش'}
          </button>
        </div>
        {secondary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                مقطع
                <select
                  value={secondary.level}
                  onChange={(event) => update({ secondaryGoal: { ...secondary, level: event.target.value as 'arshad' | 'phd' } })}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="arshad">کارشناسی ارشد</option>
                  <option value="phd">دکتری</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                سهم هفتگی: {secondary.weeklyShare}٪
                <input
                  type="range"
                  min={20}
                  max={50}
                  step={5}
                  value={secondary.weeklyShare}
                  onChange={(event) => update({ secondaryGoal: { ...secondary, weeklyShare: Number(event.target.value) } })}
                  className="mt-2 w-full accent-emerald-600"
                />
              </label>
            </div>
            {secondary.level === 'arshad' && (
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                گرایش
                <select
                  value={secondary.track}
                  onChange={(event) => update({ secondaryGoal: { ...secondary, track: event.target.value } })}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                >
                  {ARSHAD_TRACKS.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
                </select>
              </label>
            )}
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              تاریخ آزمون هدف دوم (اختیاری)
              <input
                type="date"
                value={secondary.examDate ?? ''}
                onChange={(event) => update({ secondaryGoal: { ...secondary, examDate: event.target.value || null } })}
                dir="ltr"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              />
            </label>
            <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
              اگر ظرفیت کم باشد، هدف دوم به «حالت نگه‌داری» می‌رود: یک جلسهٔ کوتاه در هفته، نه برنامهٔ کامل.
            </p>
          </div>
        )}
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          ظرفیت امروز
          <select
            value={settings.capacity}
            onChange={(event) => update({ capacity: event.target.value as StudyCapacity })}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
          >
            {CAPACITY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label} — {option.hint}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          ساعت مطالعهٔ هفتگی
          <input
            type="number"
            min={2}
            max={80}
            value={settings.weeklyHours}
            onChange={(event) => update({ weeklyHours: Math.max(2, Math.min(80, Number(event.target.value) || 2)) })}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
          />
        </label>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          سقف کارت در هر جلسهٔ مرور
          <select
            value={settings.reviewCap}
            onChange={(event) => update({ reviewCap: Number(event.target.value) })}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
          >
            {REVIEW_CAP_OPTIONS.map((cap) => (
              <option key={cap} value={cap}>{cap} کارت</option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Bell className="w-4 h-4 text-emerald-600" /> یادآور روزانه
          </div>
          <button
            type="button"
            onClick={() => updateReminder({ enabled: !settings.reminder.enabled })}
            className={`rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer ${settings.reminder.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
          >
            {settings.reminder.enabled ? 'روشن' : 'خاموش'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            ساعت ارسال
            <input
              type="time"
              step={900}
              value={settings.reminder.timeLocal}
              onChange={(event) => updateReminder({ timeLocal: event.target.value })}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            منطقهٔ زمانی
            <input
              value={settings.reminder.timezone}
              onChange={(event) => updateReminder({ timezone: event.target.value })}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            شروع سکوت
            <input
              type="time"
              value={settings.reminder.quietStart}
              onChange={(event) => updateReminder({ quietStart: event.target.value })}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            پایان سکوت
            <input
              type="time"
              value={settings.reminder.quietEnd}
              onChange={(event) => updateReminder({ quietEnd: event.target.value })}
              dir="ltr"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Clock3 className="w-3.5 h-3.5" /> روزهای ارسال
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WEEK_ORDER.map((day) => {
              const active = settings.reminder.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => updateReminder({
                    weekdays: active
                      ? settings.reminder.weekdays.filter((value) => value !== day)
                      : [...settings.reminder.weekdays, day].sort(),
                  })}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'}`}
                >
                  {WEEKDAY_LABELS[day]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-3 text-sm font-extrabold text-white cursor-pointer"
          >
            {saving ? 'در حال ذخیره…' : 'ذخیرهٔ تنظیمات'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
          >
            {testing ? 'ارسال…' : 'پیام آزمایشی'}
          </button>
        </div>
        {notice && <div className={`rounded-xl border px-3 py-2 text-xs leading-5 ${statusClass(notice.ok)}`}>{notice.text}</div>}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          <MessageSquare className="w-4 h-4 text-emerald-600" /> پیام به ادمین
        </div>
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          اشکال یک کارت یا درس را از دکمهٔ «گزارش» همان محتوا بفرست. این‌جا برای پیشنهاد یا مشکل فنی است.
        </p>
        <textarea
          value={message}
          onChange={(event) => { setMessage(event.target.value); setMessageState('idle'); }}
          rows={3}
          placeholder="پیام کوتاه و مشخص بنویس."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={handleMessage}
          disabled={messageState === 'sending'}
          className="w-full rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer disabled:opacity-50"
        >
          {messageState === 'sending' ? 'در حال ارسال…' : 'ارسال پیام'}
        </button>
        {messageState === 'sent' && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4" /> پیام ثبت شد. پاسخ در تلگرام می‌آید.
          </div>
        )}
        {messageState === 'error' && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            پیام فرستاده نشد؛ اتصال یا متن را بررسی کن.
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
        <CalendarDays className="w-4 h-4 shrink-0 mt-0.5" />
        یادآور حداکثر یک پیام در روز می‌فرستد و در ساعات سکوت ارسال نمی‌کند. خاموش‌کردن فوری است.
      </div>
    </div>
  );
};
