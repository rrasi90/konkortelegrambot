/**
 * همگام‌سازی کلید سؤال‌های واردشده از متن دفترچه با رجیستری سمت سرور.
 *
 * چرا جدا از مولد اصلی: `scripts/generate-answer-key-registry.mts` کل فایل را
 * بازنویسی می‌کند و توضیح‌های دست‌نویس داخل رجیستری را حذف می‌کند. این اسکریپت
 * فقط مدخل‌های تازه را پیش از `];` اضافه می‌کند، مدخل یتیمی که سؤالش از بانک
 * حذف شده را برمی‌دارد و manifest را به‌روزرسانی می‌کند. اجرای دوباره بی‌اثر است.
 *
 * اجرا: node --import tsx scripts/add-exam-archive-keys.mts
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = join(root, 'apps', 'worker', 'src', 'data', 'client-bank-keys.server.ts');
const manifestPath = join(root, 'apps', 'worker', 'src', 'data', 'client-bank-keys.manifest.json');

interface SidecarEntry {
  correctOption: number;
  examYear: number;
  bookletQuestionNumber: number;
  source: string;
  /** نام بانکی که کلید در رجیستری به آن نسبت داده می‌شود. */
  bank?: string;
}

interface Sidecar {
  keys: Record<string, SidecarEntry>;
}

/** کلید سؤال‌های انگلیسی واردشده و کلید سؤال‌های فارسی بازبینی‌شده، دو سند جدا دارند. */
const sidecarPaths = [
  join(root, 'apps', 'worker', 'src', 'data', 'exam-archive-keys.json'),
  join(root, 'apps', 'worker', 'src', 'data', 'exam-persian-keys.json'),
];

const merged: Sidecar = { keys: {} };
for (const path of sidecarPaths) {
  if (!existsSync(path)) continue;
  const part = JSON.parse(readFileSync(path, 'utf8')) as Sidecar;
  Object.assign(merged.keys, part.keys);
}
if (Object.keys(merged.keys).length === 0) {
  throw new Error(`هیچ فایل کلیدی پیدا نشد: ${sidecarPaths.join('، ')}`);
}
const sidecar = merged;
const bankOf = (entry: SidecarEntry): string => entry.bank ?? 'examArchiveImported';

const ENTRY = /\{ id: "([^"]+)", bank: "([^"]+)", correctOption: (\d+)/g;
const derived = new Set(['examArchiveImported', 'examArchivePersian']);

const registry = readFileSync(registryPath, 'utf8');

/**
 * کلیدی که سؤالش از بانک حذف شده باید از رجیستری هم برود؛ وگرنه کلید یتیم
 * می‌ماند و شمارش رجیستری با بانک نمی‌خواند.
 */
const staleIds = new Set<string>();
for (const match of registry.matchAll(ENTRY)) {
  const [, id, bank] = match;
  if (!derived.has(bank)) continue;
  if (!(id in sidecar.keys)) staleIds.add(id);
}

const pruned =
  staleIds.size === 0
    ? registry
    : registry
        .split('\n')
        .filter((line) => {
          const hit = /\{ id: "([^"]+)", bank: "([^"]+)", correctOption: \d+/.exec(line);
          return !(hit && derived.has(hit[2]) && staleIds.has(hit[1]));
        })
        .join('\n');

const existingIds = new Set([...pruned.matchAll(ENTRY)].map((match) => match[1]));

const additions = Object.entries(sidecar.keys)
  .filter(([id]) => !existingIds.has(id))
  .sort(([a], [b]) => (a < b ? -1 : 1));

if (additions.length === 0 && staleIds.size === 0) {
  console.log('EXAM_ARCHIVE_KEYS_UP_TO_DATE');
  process.exit(0);
}

const block = [
  '',
  '  /* ------------------------------------------------------------------',
  '   * سؤال‌هایی که از دفترچه‌های رسمی وارد شده‌اند (`src/data/examArchiveImported.ts`',
  '   * و `src/data/examArchivePersian.ts`). کلید این سؤال‌ها از شاهد کلید رسمی',
  '   * بازیابی‌شده آمده است و متن سؤال هرگز کلید را در بانک کلاینت نگه نمی‌دارد (R-036).',
  '   * این بلوک با scripts/add-exam-archive-keys.mts اضافه شده است.',
  '   * ------------------------------------------------------------------ */',
  ...additions.map(([id, entry]) => {
    const explanation = `کلید رسمی بازیابی‌شدهٔ آزمون ارشد ${entry.examYear}، سؤال ${entry.bookletQuestionNumber} (${entry.source}).`;
    return `  { id: ${JSON.stringify(id)}, bank: ${JSON.stringify(bankOf(entry))}, correctOption: ${entry.correctOption}, explanation: ${JSON.stringify(explanation)}, trapNote: "" },`;
  }),
  '',
].join('\n');

const closingIndex = pruned.lastIndexOf('];');
if (closingIndex < 0) throw new Error('انتهای آرایهٔ رجیستری پیدا نشد.');
const updated = `${pruned.slice(0, closingIndex).trimEnd()}\n${block}${pruned.slice(closingIndex)}`;
writeFileSync(registryPath, updated, 'utf8');

const sha = createHash('sha256').update(updated).digest('hex');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  const perBank = { ...(manifest.perBank as Record<string, number>) };
  if (staleIds.size > 0) {
    for (const match of registry.matchAll(ENTRY)) {
      const [, id, bank] = match;
      if (!staleIds.has(id)) continue;
      perBank[bank] = (perBank[bank] ?? 0) - 1;
    }
  }
  for (const [, entry] of additions) {
    const bank = bankOf(entry);
    perBank[bank] = (perBank[bank] ?? 0) + 1;
  }
  manifest.registrySha256 = sha;
  manifest.totalKeys = (manifest.totalKeys as number) + additions.length - staleIds.size;
  manifest.perBank = perBank;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

console.log(
  `EXAM_ARCHIVE_KEYS_SYNCED +${additions.length} −${staleIds.size} — sha256 ${sha}`,
);
