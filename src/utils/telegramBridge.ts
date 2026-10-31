/**
 * پل ارتباطی استاندارد و بهینه‌سازی‌شده برای Telegram Mini-App (TMA SDK v7.10+)
 * شامل:
 * ۱. غیرفعال‌سازی Swipe عمودی ناخواسته (disableVerticalSwipes) هنگام اسکرول کارت‌ها و درخت مهارت
 * ۲. مدیریت دکمه بازگشت بومی تلگرام (BackButton) و دکمه اصلی پایین صفحه (MainButton)
 * ۳. موتور بازخورد لمسی چندلایه (HapticFeedback: impact / notification / selection)
 * ۴. ذخیره‌سازی هیبریدی در فضای ابری تلگرام (CloudStorage) + LocalStorage با قابلیت ریست به Zero-State
 * ۵. مسیریابی Deep-Link از دکمه‌های شیشه‌ای ربات تلگرام (startapp=...)
 */

import { LearnerSixDState, ReviewCard, UserStats } from '../engine/aelEngine';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface TelegramWebAppInstance {
  initData?: string;
  initDataUnsafe?: {
    query_id?: string;
    user?: TelegramUser;
    start_param?: string;
  };
  version?: string;
  platform?: string;
  colorScheme?: 'light' | 'dark';
  isExpanded?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  sendData?: (data: string) => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  onEvent?: (eventType: string, callback: () => void) => void;
  offEvent?: (eventType: string, callback: () => void) => void;
  BackButton?: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  MainButton?: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    setText: (text: string) => void;
    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  CloudStorage?: {
    setItem: (key: string, value: string, cb?: (err: Error | null, stored?: boolean) => void) => void;
    getItem: (key: string, cb: (err: Error | null, value?: string) => void) => void;
    removeItem: (key: string, cb?: (err: Error | null, removed?: boolean) => void) => void;
  };
}

const STORAGE_KEY_V3 = 'ael_tma_state_v3';

export function getTelegramWebApp(): TelegramWebAppInstance | null {
  if (typeof window === 'undefined') return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppInstance } }).Telegram
    ?.WebApp;
  return tg ?? null;
}

export function isRunningInsideTelegram(): boolean {
  const tg = getTelegramWebApp();
  return Boolean(tg && tg.initData && tg.initData.length > 0);
}

export function getTelegramUserInfo(): TelegramUser {
  const tg = getTelegramWebApp();
  if (tg?.initDataUnsafe?.user) {
    return tg.initDataUnsafe.user;
  }
  return {
    id: 104928374,
    first_name: 'داوطلب دکتری',
    username: 'konkor_phd_candidate',
    language_code: 'fa',
  };
}

/**
 * راه‌اندازی اولیه مینی‌اپ تلگرام (گسترش کامل صفحه، قفل اسوایپ عمودی ناخواسته، تنظیم رنگ هدر)
 */
export function initTelegramMiniApp(isDark: boolean): {
  inTelegram: boolean;
  platform: string;
  version: string;
  user: TelegramUser;
} {
  const tg = getTelegramWebApp();
  const bgHex = isDark ? '#0b0f19' : '#f8fafc';

  if (tg) {
    try {
      tg.ready?.();
      tg.expand?.();
      // در تلگرام 7.7+ مانع بسته شدن ناگهانی مینی‌اپ هنگام اسکرول کارت‌ها و درخت مهارت می‌شود
      tg.disableVerticalSwipes?.();
      tg.setHeaderColor?.(bgHex);
      tg.setBackgroundColor?.(bgHex);
    } catch {
      // نادیده گرفتن متدهای پشتیبانی‌نشده در نسخه‌های قدیمی‌تر کلاینت
    }
  }

  return {
    inTelegram: isRunningInsideTelegram(),
    platform: tg?.platform || 'web',
    version: tg?.version || '7.10',
    user: getTelegramUserInfo(),
  };
}

/**
 * موتور بازخورد لمسی بومی تلگرام (HapticFeedback) با Fallback ویبره مرورگر موبایل
 */
export const tmaHaptic = {
  impact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') {
    try {
      const tg = getTelegramWebApp();
      if (tg?.HapticFeedback && isRunningInsideTelegram()) {
        tg.HapticFeedback.impactOccurred(style);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(style === 'heavy' ? 22 : style === 'medium' ? 14 : 8);
      }
    } catch {
      // بدون خطا
    }
  },
  notify(type: 'success' | 'warning' | 'error') {
    try {
      const tg = getTelegramWebApp();
      if (tg?.HapticFeedback && isRunningInsideTelegram()) {
        tg.HapticFeedback.notificationOccurred(type);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(type === 'success' ? [12, 40, 20] : type === 'error' ? [30, 50, 30] : 20);
      }
    } catch {
      // بدون خطا
    }
  },
  selection() {
    try {
      const tg = getTelegramWebApp();
      if (tg?.HapticFeedback && isRunningInsideTelegram()) {
        tg.HapticFeedback.selectionChanged();
      }
    } catch {
      // بدون خطا
    }
  },
};

/**
 * همگام‌سازی دکمه بازگشت بومی تلگرام (BackButton)
 */
let activeBackHandler: (() => void) | null = null;

export function syncTelegramBackButton(visible: boolean, onBack: () => void) {
  const tg = getTelegramWebApp();
  if (!tg?.BackButton) return;

  try {
    if (activeBackHandler) {
      tg.BackButton.offClick(activeBackHandler);
    }
    if (visible) {
      activeBackHandler = onBack;
      tg.BackButton.onClick(activeBackHandler);
      tg.BackButton.show();
    } else {
      activeBackHandler = null;
      tg.BackButton.hide();
    }
  } catch {
    // بدون خطا
  }
}

/**
 * فعال‌سازی هشدار خروج هنگام جلسه تست فعال (جلوگیری از بسته شدن تصادفی مینی‌اپ)
 */
export function setTelegramClosingConfirmation(enabled: boolean) {
  const tg = getTelegramWebApp();
  if (!tg) return;
  try {
    if (enabled) {
      tg.enableClosingConfirmation?.();
    } else {
      tg.disableClosingConfirmation?.();
    }
  } catch {
    // بدون خطا
  }
}

/**
 * خواندن پارامتر شروع عمیق (Deep-Link startapp) از تلگرام یا URL
 * مثال‌ها:
 * - startapp=night_quiz -> شروع مستقیم کوییز شبانه
 * - startapp=placement -> باز کردن آزمون تعیین سطح ۵ سؤالی
 * - startapp=lesson_sm.rbv -> باز کردن مستقیم درسنامه RBV برای امتیازدهی ۱ تا ۵
 * - startapp=practice_stats.anova -> شروع مستقیم تست تحلیل واریانس
 * - startapp=zero_reset -> ریست کامل به وضعیت کاربر صفر
 */
export type DeepLinkCommand =
  | { type: 'none' }
  | { type: 'night_quiz' }
  | { type: 'placement' }
  | { type: 'zero_reset' }
  | { type: 'lesson'; nodeId: string }
  | { type: 'practice'; nodeId: string }
  | { type: 'proof'; nodeId: string };

export function parseTelegramStartParam(): DeepLinkCommand {
  try {
    const tg = getTelegramWebApp();
    const urlParams = new URLSearchParams(window.location.search);
    const raw =
      tg?.initDataUnsafe?.start_param ||
      urlParams.get('tgWebAppStartParam') ||
      urlParams.get('startapp') ||
      '';

    if (!raw) return { type: 'none' };
    if (raw === 'night_quiz') return { type: 'night_quiz' };
    if (raw === 'placement') return { type: 'placement' };
    if (raw === 'zero_reset') return { type: 'zero_reset' };
    if (raw.startsWith('lesson_')) {
      return { type: 'lesson', nodeId: raw.replace('lesson_', '') };
    }
    if (raw.startsWith('practice_')) {
      return { type: 'practice', nodeId: raw.replace('practice_', '') };
    }
    if (raw.startsWith('proof_')) {
      return { type: 'proof', nodeId: raw.replace('proof_', '') };
    }
  } catch {
    // بدون خطا
  }
  return { type: 'none' };
}

/**
 * ذخیره‌سازی و بازیابی هیبریدی وضعیت داوطلب در CloudStorage تلگرام + LocalStorage
 */
export interface PersistedLearnerPayload {
  nodeStates: Record<string, LearnerSixDState>;
  cards: ReviewCard[];
  stats: UserStats;
  savedAt: string;
}

export function saveStateToTelegramStorage(payload: PersistedLearnerPayload) {
  try {
    const serialized = JSON.stringify(payload);
    localStorage.setItem(STORAGE_KEY_V3, serialized);

    // ذخیره خلاصه فشرده در CloudStorage تلگرام (محدودیت ۴۰۹۶ بایت به ازای هر کلید)
    const tg = getTelegramWebApp();
    if (tg?.CloudStorage && isRunningInsideTelegram()) {
      const compactMastery: Record<string, [number, string, number?]> = {};
      Object.values(payload.nodeStates).forEach((s) => {
        if (s.masteryScore > 0 || s.lastLessonSelfRating) {
          compactMastery[s.nodeId] = [s.masteryScore, s.coverageStatus, s.lastLessonSelfRating];
        }
      });
      tg.CloudStorage.setItem(
        STORAGE_KEY_V3,
        JSON.stringify({
          m: compactMastery,
          s: {
            z: payload.stats.isZeroStateNewUser,
            d: payload.stats.streakDays,
            x: payload.stats.xp,
            c: payload.stats.coins,
            t: payload.stats.totalAnswered,
            ok: payload.stats.correctCount,
            wr: payload.stats.wrongCount,
            sk: payload.stats.skippedCount,
            lr: payload.stats.lessonsRatedCount,
          },
        })
      );
    }
  } catch {
    // نادیده گرفتن خطای Quota
  }
}

export function loadStateFromTelegramStorage(): PersistedLearnerPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V3);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedLearnerPayload;
    if (parsed && parsed.nodeStates && parsed.stats) {
      return parsed;
    }
  } catch {
    // بدون خطا
  }
  return null;
}

export function clearTelegramZeroStateStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY_V3);
    const tg = getTelegramWebApp();
    if (tg?.CloudStorage && isRunningInsideTelegram()) {
      tg.CloudStorage.removeItem(STORAGE_KEY_V3);
    }
  } catch {
    // بدون خطا
  }
}

/**
 * اشتراک‌گذاری کارنامه و تراز در چت‌ها یا گروه‌های تلگرام
 */
export function shareProgressToTelegramChat(params: {
  overallMastery: number;
  netKonkorPercent: number;
  streakDays: number;
  lessonsRatedCount: number;
}) {
  tmaHaptic.impact('medium');
  const text =
    `گزارش پیشرفت من در سامانه یادگیری تطبیقی کنکور دکتری (AEL):\n` +
    `• میانگین تسلط گراف دانش: ${params.overallMastery}٪\n` +
    `• تراز خالص (با نمره منفی): ${params.netKonkorPercent}٪\n` +
    `• درسنامه‌های ارزیابی‌شده (۱ تا ۵): ${params.lessonsRatedCount} مبحث\n` +
    `• پیوستگی مطالعه: ${params.streakDays} روز`;

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    window.location.origin
  )}&text=${encodeURIComponent(text)}`;

  const tg = getTelegramWebApp();
  if (tg?.openTelegramLink && isRunningInsideTelegram()) {
    tg.openTelegramLink(shareUrl);
  } else {
    navigator.clipboard?.writeText(text);
  }
  return text;
}
