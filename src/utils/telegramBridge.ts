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
  return Boolean(tg && (tg.platform || (tg.initData && tg.initData.length > 0) || tg.initDataUnsafe?.user));
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

      // همگام‌سازی ابعاد واقعی ویوپورت تلگرام در تغییر اندازه یا چرخش گوشی
      const syncViewport = () => {
        if (typeof document !== 'undefined') {
          if (tg.viewportHeight) {
            document.documentElement.style.setProperty('--tg-viewport-height', `${tg.viewportHeight}px`);
          }
          if (tg.viewportStableHeight) {
            document.documentElement.style.setProperty('--tg-viewport-stable-height', `${tg.viewportStableHeight}px`);
          }
        }
      };
      syncViewport();
      tg.onEvent?.('viewportChanged', syncViewport);
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
 * نسخهٔ ۴: snapshot کامل و نسخه‌دار وضعیت یادگیرنده.
 *
 * CloudStorage تلگرام سقف ۴۰۹۶ نویسه برای هر value دارد؛ بنابراین snapshot
 * به chunkهای مستقل تقسیم می‌شود و manifest فقط پس از نوشتن موفق تمام chunkها
 * commit می‌شود. دو slot باعث می‌شود snapshot سالم قبلی تا زمان commit بعدی بماند.
 */
export interface PersistedLearnerPayload {
  nodeStates: Record<string, LearnerSixDState>;
  cards: ReviewCard[];
  stats: UserStats;
  savedAt: string;
}

export type LearnerStorageSource =
  | 'local_v4'
  | 'local_v3'
  | 'cloud_v4'
  | 'cloud_v3_summary'
  | 'fresh';

export interface LearnerStorageLoadResult {
  payload: PersistedLearnerPayload;
  source: LearnerStorageSource;
  warning?: string;
}

export interface LearnerStorageSaveResult {
  localSaved: boolean;
  cloudSaved: boolean;
  skippedAsStale?: boolean;
  error?: string;
}

const STORAGE_KEY_LOCAL_V4 = 'ael_tma_state_v4';
const STORAGE_KEY_V4_MANIFEST = 'ael_tma_v4_manifest';
const STORAGE_KEY_V3 = 'ael_tma_state_v3';
const CLOUD_CHUNK_SIZE = 3000;
const CLOUD_MAX_CHUNKS = 240;
const CLOUD_WRITE_BATCH_SIZE = 8;

interface CloudSnapshotManifest {
  version: 4;
  slot: 'a' | 'b';
  chunkCount: number;
  savedAt: string;
  length: number;
  checksum: string;
}

let cloudWriteQueue: Promise<unknown> = Promise.resolve();
let cloudWriteGeneration = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isPersistedLearnerPayload(value: unknown): value is PersistedLearnerPayload {
  if (!isRecord(value)) return false;
  if (!isRecord(value.nodeStates) || !Array.isArray(value.cards) || !isRecord(value.stats)) {
    return false;
  }
  if (typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) {
    return false;
  }
  return true;
}

function parsePayload(raw: string | null | undefined): PersistedLearnerPayload | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPersistedLearnerPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readLocalSnapshot():
  | { payload: PersistedLearnerPayload; source: 'local_v4' | 'local_v3' }
  | null {
  try {
    const current = parsePayload(localStorage.getItem(STORAGE_KEY_LOCAL_V4));
    if (current) return { payload: current, source: 'local_v4' };
    const legacy = parsePayload(localStorage.getItem(STORAGE_KEY_V3));
    if (legacy) return { payload: legacy, source: 'local_v3' };
  } catch {
    // Storage may be disabled or over quota; cloud restore must still be attempted.
  }
  return null;
}

function cloudStorage(): TelegramWebAppInstance['CloudStorage'] | null {
  const tg = getTelegramWebApp();
  return tg?.CloudStorage && isRunningInsideTelegram() ? tg.CloudStorage : null;
}

function cloudGetItem(
  storage: NonNullable<TelegramWebAppInstance['CloudStorage']>,
  key: string,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    try {
      storage.getItem(key, (error, value) => {
        if (error) reject(error);
        else resolve(typeof value === 'string' ? value : null);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function cloudSetItem(
  storage: NonNullable<TelegramWebAppInstance['CloudStorage']>,
  key: string,
  value: string,
): Promise<void> {
  if (value.length > 4096) {
    return Promise.reject(new Error(`CloudStorage value exceeds 4096 characters: ${key}`));
  }
  return new Promise((resolve, reject) => {
    try {
      storage.setItem(key, value, (error, stored) => {
        if (error) reject(error);
        else if (stored === false) reject(new Error(`CloudStorage did not store key: ${key}`));
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function cloudRemoveItem(
  storage: NonNullable<TelegramWebAppInstance['CloudStorage']>,
  key: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      storage.removeItem(key, (error) => {
        if (error) reject(error);
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function checksum(value: string): string {
  // FNV-1a 32-bit: corruption detection, not a cryptographic integrity primitive.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function makeChunks(value: string): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += CLOUD_CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + CLOUD_CHUNK_SIZE));
  }
  return chunks;
}

function cloudChunkKey(slot: 'a' | 'b', index: number): string {
  return `ael_tma_v4_${slot}_${String(index).padStart(3, '0')}`;
}

function parseManifest(raw: string | null): CloudSnapshotManifest | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    if (
      value.version !== 4 ||
      (value.slot !== 'a' && value.slot !== 'b') ||
      !Number.isInteger(value.chunkCount) ||
      (value.chunkCount as number) < 1 ||
      (value.chunkCount as number) > CLOUD_MAX_CHUNKS ||
      !Number.isInteger(value.length) ||
      (value.length as number) < 1 ||
      typeof value.savedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.savedAt)) ||
      typeof value.checksum !== 'string'
    ) return null;
    return value as unknown as CloudSnapshotManifest;
  } catch {
    return null;
  }
}

async function inBatches<T>(
  values: T[],
  batchSize: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < values.length; i += batchSize) {
    await Promise.all(values.slice(i, i + batchSize).map(worker));
  }
}

async function readCloudSnapshot(
  storage: NonNullable<TelegramWebAppInstance['CloudStorage']>,
): Promise<PersistedLearnerPayload | null> {
  const rawManifest = await cloudGetItem(storage, STORAGE_KEY_V4_MANIFEST);
  const manifest = parseManifest(rawManifest);
  if (!manifest) return null;

  const parts = new Array<string>(manifest.chunkCount);
  const indices = Array.from({ length: manifest.chunkCount }, (_, index) => index);
  await inBatches(indices, CLOUD_WRITE_BATCH_SIZE, async (index) => {
    const part = await cloudGetItem(storage, cloudChunkKey(manifest.slot, index));
    if (typeof part !== 'string') throw new Error(`Cloud snapshot chunk ${index} is missing`);
    parts[index] = part;
  });

  const serialized = parts.join('');
  if (serialized.length !== manifest.length || checksum(serialized) !== manifest.checksum) {
    throw new Error('Cloud snapshot checksum/length mismatch');
  }
  const payload = parsePayload(serialized);
  if (!payload || payload.savedAt !== manifest.savedAt) {
    throw new Error('Cloud snapshot payload is invalid or does not match its manifest');
  }
  return payload;
}

function restoreLegacyCloudSummary(
  raw: string | null,
  fallback: PersistedLearnerPayload,
): PersistedLearnerPayload | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.m) || !isRecord(parsed.s)) return null;
    const nodeStates = { ...fallback.nodeStates };
    for (const [nodeId, tuple] of Object.entries(parsed.m)) {
      if (!Array.isArray(tuple) || tuple.length < 2) continue;
      const previous = nodeStates[nodeId];
      if (!previous) continue;
      const masteryScore = tuple[0];
      const coverageStatus = tuple[1];
      const lessonRating = tuple[2];
      if (typeof masteryScore !== 'number' || !Number.isFinite(masteryScore)) continue;
      if (typeof coverageStatus !== 'string') continue;
      nodeStates[nodeId] = {
        ...previous,
        masteryScore: Math.max(0, Math.min(100, masteryScore)),
        coverageStatus: coverageStatus as LearnerSixDState['coverageStatus'],
        ...(typeof lessonRating === 'number' && lessonRating >= 1 && lessonRating <= 5
          ? { lastLessonSelfRating: Math.round(lessonRating) as 1 | 2 | 3 | 4 | 5 }
          : {}),
      };
    }

    const summary = parsed.s;
    const stats = { ...fallback.stats };
    const copyNumber = (key: string, target: keyof UserStats) => {
      const value = summary[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        (stats as unknown as Record<string, unknown>)[target] = value;
      }
    };
    copyNumber('d', 'streakDays');
    copyNumber('x', 'xp');
    copyNumber('c', 'coins');
    copyNumber('t', 'totalAnswered');
    copyNumber('ok', 'correctCount');
    copyNumber('wr', 'wrongCount');
    copyNumber('sk', 'skippedCount');
    copyNumber('lr', 'lessonsRatedCount');
    if (typeof summary.z === 'boolean') stats.isZeroStateNewUser = summary.z;

    return {
      ...fallback,
      nodeStates,
      stats,
      // The v3 cloud format never contained cards or scheduling data.
      savedAt: new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/** فوری و همگام: فقط snapshot کامل روی همین دستگاه را می‌خواند. */
export function loadStateFromTelegramStorage(): PersistedLearnerPayload | null {
  return readLocalSnapshot()?.payload ?? null;
}

/**
 * آخرین snapshot کامل را میان LocalStorage و Telegram CloudStorage انتخاب می‌کند.
 * خلاصهٔ cloud نسخهٔ ۳ فقط وقتی استفاده می‌شود که هیچ snapshot کامل در دسترس نباشد.
 */
export async function loadLatestStateFromTelegramStorage(
  fallback: PersistedLearnerPayload,
): Promise<LearnerStorageLoadResult> {
  const local = readLocalSnapshot();
  const storage = cloudStorage();
  if (!storage) {
    return local
      ? { payload: local.payload, source: local.source }
      : { payload: fallback, source: 'fresh' };
  }

  let cloudSnapshot: PersistedLearnerPayload | null = null;
  let cloudReadWarning: string | undefined;
  try {
    cloudSnapshot = await readCloudSnapshot(storage);
  } catch (error) {
    cloudReadWarning = 'پشتیبان ابری خوانده نشد یا ناقص بود؛ از نسخهٔ محلی استفاده شد.';
  }

  if (cloudSnapshot) {
    const localTime = local ? Date.parse(local.payload.savedAt) : Number.NEGATIVE_INFINITY;
    const cloudTime = Date.parse(cloudSnapshot.savedAt);
    if (!local || cloudTime > localTime) {
      return { payload: cloudSnapshot, source: 'cloud_v4' };
    }
    return { payload: local.payload, source: local.source };
  }

  if (local) {
    return {
      payload: local.payload,
      source: local.source,
      ...(cloudReadWarning ? { warning: cloudReadWarning } : {}),
    };
  }

  try {
    const legacy = restoreLegacyCloudSummary(
      await cloudGetItem(storage, STORAGE_KEY_V3),
      fallback,
    );
    if (legacy) {
      return {
        payload: legacy,
        source: 'cloud_v3_summary',
        warning:
          'فقط خلاصهٔ قدیمی ابری بازیابی شد؛ کارت‌ها و زمان‌بندی مرور در قالب قدیمی ذخیره نشده بودند. این دستگاه از این پس snapshot کامل را ذخیره می‌کند.',
      };
    }
  } catch {
    cloudReadWarning = 'بازیابی پشتیبان ابری ناموفق بود؛ وضعیت تازه روی این دستگاه آغاز شد.';
  }

  return {
    payload: fallback,
    source: 'fresh',
    ...(cloudReadWarning ? { warning: cloudReadWarning } : {}),
  };
}

/**
 * ابتدا snapshot کامل روی دستگاه نوشته می‌شود، سپس در CloudStorage به دو slot
 * متناوب نوشته می‌شود. manifest آخرین مرحله است؛ شکست chunkها snapshot قبلی را
 * معتبر نگه می‌دارد. فراخوانی‌های سریع نیز به ترتیب و بدون commit دادهٔ قدیمی اجرا می‌شوند.
 */
export function saveStateToTelegramStorage(
  payload: PersistedLearnerPayload,
): Promise<LearnerStorageSaveResult> {
  let localSaved = false;
  let localError: string | undefined;
  const serialized = JSON.stringify(payload);

  try {
    localStorage.setItem(STORAGE_KEY_LOCAL_V4, serialized);
    localStorage.removeItem(STORAGE_KEY_V3);
    localSaved = true;
  } catch (error) {
    localError = error instanceof Error ? error.message : String(error);
  }

  const storage = cloudStorage();
  if (!storage) {
    return Promise.resolve({
      localSaved,
      cloudSaved: false,
      ...(localError ? { error: localError } : {}),
    });
  }

  const generation = ++cloudWriteGeneration;
  const job = cloudWriteQueue
    .catch(() => undefined)
    .then(async (): Promise<LearnerStorageSaveResult> => {
      if (generation !== cloudWriteGeneration) {
        return { localSaved, cloudSaved: false, skippedAsStale: true };
      }

      const chunks = makeChunks(serialized);
      if (chunks.length === 0 || chunks.length > CLOUD_MAX_CHUNKS) {
        throw new Error(
          `Learner snapshot is too large for Telegram CloudStorage (${chunks.length} chunks; max ${CLOUD_MAX_CHUNKS})`,
        );
      }

      const oldManifest = parseManifest(
        await cloudGetItem(storage, STORAGE_KEY_V4_MANIFEST),
      );
      const slot: 'a' | 'b' = oldManifest?.slot === 'a' ? 'b' : 'a';
      const indices = Array.from({ length: chunks.length }, (_, index) => index);
      await inBatches(indices, CLOUD_WRITE_BATCH_SIZE, async (index) => {
        await cloudSetItem(storage, cloudChunkKey(slot, index), chunks[index]);
      });

      if (generation !== cloudWriteGeneration) {
        return { localSaved, cloudSaved: false, skippedAsStale: true };
      }

      const manifest: CloudSnapshotManifest = {
        version: 4,
        slot,
        chunkCount: chunks.length,
        savedAt: payload.savedAt,
        length: serialized.length,
        checksum: checksum(serialized),
      };
      await cloudSetItem(storage, STORAGE_KEY_V4_MANIFEST, JSON.stringify(manifest));
      // Remove the obsolete summary only after the full snapshot has been committed.
      await cloudRemoveItem(storage, STORAGE_KEY_V3).catch(() => undefined);
      return { localSaved, cloudSaved: true };
    });

  cloudWriteQueue = job.catch(() => undefined);
  return job.catch((error): LearnerStorageSaveResult => ({
    localSaved,
    cloudSaved: false,
    error: error instanceof Error ? error.message : String(error),
  }));
}

/**
 * حذف manifest قبل از هر snapshot جدید، تا Zero-State نتواند دادهٔ قدیمی را دوباره hydrate کند.
 * حذف chunkهای یتیم لازم نیست؛ بدون manifest هیچ slotای قابل بازیابی نیست.
 */
export function clearTelegramZeroStateStorage(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY_LOCAL_V4);
    localStorage.removeItem(STORAGE_KEY_V3);
  } catch {
    // Continue with cloud invalidation even if local storage is unavailable.
  }

  ++cloudWriteGeneration;
  const storage = cloudStorage();
  if (!storage) return Promise.resolve();

  const job = cloudWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await cloudRemoveItem(storage, STORAGE_KEY_V4_MANIFEST);
      await cloudRemoveItem(storage, STORAGE_KEY_V3).catch(() => undefined);
    });
  cloudWriteQueue = job.catch(() => undefined);
  return job;
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
