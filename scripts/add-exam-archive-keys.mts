/**
 * افزودن کلید سؤال‌های واردشده از متن دفترچه به رجیستری سمت سرور.
 *
 * چرا جدا از مولد اصلی: `scripts/generate-answer-key-registry.mts` کل فایل را
 * بازنویسی می‌کند و توضیح‌های دست‌نویس داخل رجیستری را حذف می‌کند. این اسکریپت
 * فقط مدخل‌های تازه را پیش از `];` اضافه می‌کند، شناسهٔ موجود را دست نمی‌زند و
 * manifest را به‌روزرسانی می‌کند. اجرای دوباره بی‌اثر است.
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
const sidecarPath = join(root, 'apps', 'worker', 'src', 'data', 'exam-archive-keys.json');

interface Sidecar {
  keys: Record<string, { correctOption: number; examYear: number; bookletQuestionNumber: number; source: string }>;
}

if (!existsSync(sidecarPath)) throw new Error(`فایل کلید ورودی پیدا نشد: ${sidecarPath}`);
const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as Sidecar;

const registry = readFileSync(registryPath, 'utf8');
const existingIds = new Set([...registry.matchAll(/\{ id: "([^"]+)", bank: "([^"]+)", correctOption: (\d+)/g)].map((match) => match[1]));

const additions = Object.entries(sidecar.keys)
  .filter(([id]) => !existingIds.has(id))
  .sort(([a], [b]) => (a < b ? -1 : 1));

if (additions.length === 0) {
  console.log('EXAM_ARCHIVE_KEYS_UP_TO_DATE');
  process.exit(0);
}

const block = [
  '',
  '  /* ------------------------------------------------------------------',
  '   * سؤال‌های انگلیسی ارشد که از متن دفترچه وارد شده‌اند (`src/data/examArchiveImported.ts`).',
  '   * کلید این سؤال‌ها از شاهد کلید رسمی بازیابی‌شده آمده است و متن سؤال هرگز',
  '   * کلید را در بانک کلاینت نگه نمی‌دارد (R-036).',
  '   * این بلوک با scripts/add-exam-archive-keys.mts اضافه شده است.',
  '   * ------------------------------------------------------------------ */',
  ...additions.map(([id, entry]) => {
    const explanation = `کلید رسمی بازیابی‌شدهٔ آزمون ارشد ${entry.examYear}، سؤال ${entry.bookletQuestionNumber} (${entry.source}).`;
    return `  { id: ${JSON.stringify(id)}, bank: "examArchiveImported", correctOption: ${entry.correctOption}, explanation: ${JSON.stringify(explanation)}, trapNote: "" },`;
  }),
  '',
].join('\n');

const closingIndex = registry.lastIndexOf('];');
if (closingIndex < 0) throw new Error('انتهای آرایهٔ رجیستری پیدا نشد.');
const updated = `${registry.slice(0, closingIndex).trimEnd()}\n${block}${registry.slice(closingIndex)}`;
writeFileSync(registryPath, updated, 'utf8');

const sha = createHash('sha256').update(updated).digest('hex');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  const perBank = { ...(manifest.perBank as Record<string, number>) };
  perBank.examArchiveImported = additions.length;
  manifest.registrySha256 = sha;
  manifest.totalKeys = (manifest.totalKeys as number) + additions.length;
  manifest.perBank = perBank;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

console.log(`EXAM_ARCHIVE_KEYS_ADDED ${additions.length} — sha256 ${sha}`);
