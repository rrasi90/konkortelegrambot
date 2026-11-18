/**
 * تنظیمات مطالعهٔ شخصی — هدف دوم، ظرفیت هفتگی و یادآور.
 *
 * این‌ها shape snapshot موجود را عوض نمی‌کنند. هدف اصلی از `ael.onboarding`
 * خوانده می‌شود؛ هدف دوم و ظرفیت در کلید مستقل `ael.study.settings.v1` می‌مانند.
 * تنظیم یادآور علاوه بر localStorage به سرور هم فرستاده می‌شود، چون ارسال
 * زمان‌بندی‌شده فقط با cron ممکن است.
 */
export type StudyCapacity = 'light' | 'normal' | 'heavy' | 'off';
export type StudyLevel = 'arshad' | 'phd';

export interface SecondaryGoal {
  level: StudyLevel;
  track: string;
  examDate: string | null;
  weeklyShare: number;
}

export interface ReminderSettings {
  enabled: boolean;
  timeLocal: string;
  timezone: string;
  weekdays: number[];
  quietStart: string;
  quietEnd: string;
  onlyWhenDue: boolean;
}

export interface StudySettings {
  secondaryGoal: SecondaryGoal | null;
  capacity: StudyCapacity;
  weeklyHours: number;
  /** سقف کارت هر جلسهٔ مرور؛ صفر یا مقدار نامعتبر به پیش‌فرض برمی‌گردد. */
  reviewCap: number;
  reminder: ReminderSettings;
}

export const STUDY_SETTINGS_KEY = 'ael.study.settings.v1';
export const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  timeLocal: '21:00',
  timezone: 'Asia/Tehran',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  quietStart: '23:00',
  quietEnd: '08:00',
  onlyWhenDue: false,
};

export const DEFAULT_STUDY_SETTINGS: StudySettings = {
  secondaryGoal: null,
  capacity: 'normal',
  weeklyHours: 20,
  reviewCap: 20,
  reminder: DEFAULT_REMINDER,
};

export const REVIEW_CAP_OPTIONS = [10, 20, 30, 50] as const;

export function normalizeReviewCap(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_STUDY_SETTINGS.reviewCap;
  return Math.min(50, Math.max(5, Math.round(numeric)));
}

export const CAPACITY_OPTIONS: Array<{ id: StudyCapacity; label: string; hint: string }> = [
  { id: 'light', label: 'سبک', hint: '۱۵ تا ۲۵ دقیقه در روز' },
  { id: 'normal', label: 'معمولی', hint: 'برنامهٔ هفتگی پیش‌فرض' },
  { id: 'heavy', label: 'سنگین', hint: 'حدود ۱٫۵ برابر ظرفیت' },
  { id: 'off', label: 'تعطیل', hint: 'بدون جریمه و بدون فشار' },
];

export const WEEKDAY_LABELS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

export function loadStudySettings(): StudySettings {
  try {
    const raw = localStorage.getItem(STUDY_SETTINGS_KEY);
    if (!raw) return DEFAULT_STUDY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StudySettings>;
    return {
      ...DEFAULT_STUDY_SETTINGS,
      ...parsed,
      reviewCap: normalizeReviewCap(parsed.reviewCap),
      reminder: { ...DEFAULT_REMINDER, ...(parsed.reminder ?? {}) },
    };
  } catch {
    return DEFAULT_STUDY_SETTINGS;
  }
}

export function saveStudySettings(settings: StudySettings): void {
  try {
    localStorage.setItem(STUDY_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ذخیرهٔ محلی اختیاری است؛ UI وضعیت را نشان می‌دهد.
  }
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidTimezone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function minutesOfDay(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

export function isQuietTime(now: string, start: string, end: string): boolean {
  const current = minutesOfDay(now);
  const from = minutesOfDay(start);
  const to = minutesOfDay(end);
  if (from === to) return false;
  if (from < to) return current >= from && current < to;
  return current >= from || current < to;
}
