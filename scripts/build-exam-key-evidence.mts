/**
 * ساخت شاهد کلید رسمی آزمون‌های مدیریت از خروجی بازیابی محلی.
 *
 * ورودی: `.ael-work/exam-recovery/merged-keys/` (خارج از git، فقط در محیط محلی هست)
 * خروجی: `content/exam-key-evidence/answers-by-year.json` (در git، تا بازبینی کلید
 * در CI هم تکرارپذیر باشد).
 *
 * هر ردیف خروجی از تلاقی «لایهٔ متن PDF» و «OCR» ساخته شده است؛ عددی که دو روش
 * در آن اختلاف داشتند در فایل بازیابی به‌عنوان disputed علامت خورده و در اینجا
 * وارد نمی‌شود. اجرا: node --import tsx scripts/build-exam-key-evidence.mts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recovery = join(root, '.ael-work', 'exam-recovery');
const keyDir = join(recovery, 'merged-keys');
const textLayerDir = join(recovery, 'text-layer');
const outDir = join(root, 'content', 'exam-key-evidence');
const outFile = join(outDir, 'answers-by-year.json');

interface MergeSummaryRow {
  source_id: string;
  basename: string;
  merged: number;
  max_question: number | null;
  holes_in_span: number;
  hole_ranges: { from: number; to: number }[];
}

interface KeyEntry {
  question_number: number;
  correct_option: number;
  provenance?: string;
}

interface YearEvidence {
  /** وضعیت سند کلید همان سال: کلید اولیه یا کلید نهایی. */
  keyStatus: 'preliminary' | 'final' | 'unknown';
  maxQuestion: number | null;
  entries: Record<string, number>;
  holes: { from: number; to: number }[];
  sources: { basename: string; sourceId: string; pdfSha256: string | null }[];
}

if (!existsSync(join(keyDir, '_merge_summary.json'))) {
  throw new Error('خروجی بازیابی کلید پیدا نشد: .ael-work/exam-recovery/merged-keys/_merge_summary.json');
}

const summaryRows = JSON.parse(readFileSync(join(keyDir, '_merge_summary.json'), 'utf8')) as MergeSummaryRow[];
const textLayerFiles = existsSync(textLayerDir) ? readdirSync(textLayerDir) : [];

const sha256BySource = new Map<string, string>();
for (const name of textLayerFiles) {
  if (!name.startsWith('src-') || !name.endsWith('.json')) continue;
  const record = JSON.parse(readFileSync(join(textLayerDir, name), 'utf8')) as { source_id?: string; pdf_sha256?: string };
  if (record.source_id && record.pdf_sha256) sha256BySource.set(record.source_id, record.pdf_sha256);
}

/** وضعیت کلید از متن تبدیل‌شدهٔ همان PDF کلید خوانده می‌شود (اگر در این checkout باشد). */
function keyStatusFor(year: number): YearEvidence['keyStatus'] {
  for (const name of [`جواب ${year}.md`, `جواب${year}.md`]) {
    const path = join(root, 'pdf', name);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    if (/كليد اوليه|کلید اولیه/.test(text)) return 'preliminary';
    if (/كليد نهايي|کلید نهایی/.test(text)) return 'final';
    return 'unknown';
  }
  return 'unknown';
}

const years: Record<string, YearEvidence> = {};
for (const row of summaryRows) {
  const match = /(\d{4})/.exec(row.basename);
  if (!match) continue;
  const year = String(Number(match[1]));
  const file = join(keyDir, `${row.source_id}.jsonl`);
  if (!existsSync(file)) continue;

  const entries: Record<string, number> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line) as KeyEntry;
    if (typeof entry.question_number !== 'number') continue;
    if (typeof entry.correct_option !== 'number') continue;
    if (entry.provenance === 'disputed') continue;
    entries[String(entry.question_number)] = entry.correct_option;
  }
  if (Object.keys(entries).length === 0) continue;

  const sortedEntries: Record<string, number> = {};
  for (const key of Object.keys(entries).sort((a, b) => Number(a) - Number(b))) sortedEntries[key] = entries[key];

  const existing = years[year];
  years[year] = {
    keyStatus: existing?.keyStatus ?? keyStatusFor(Number(year)),
    maxQuestion: Math.max(existing?.maxQuestion ?? 0, row.max_question ?? 0) || null,
    entries: { ...(existing?.entries ?? {}), ...sortedEntries },
    holes: [...(existing?.holes ?? []), ...(row.hole_ranges ?? [])],
    sources: [
      ...(existing?.sources ?? []),
      { basename: row.basename, sourceId: row.source_id, pdfSha256: sha256BySource.get(row.source_id) ?? null },
    ],
  };
}

const yearKeys = Object.keys(years).sort((a, b) => Number(a) - Number(b));
const orderedYears: Record<string, YearEvidence> = {};
for (const year of yearKeys) orderedYears[year] = years[year];

mkdirSync(outDir, { recursive: true });
writeFileSync(
  outFile,
  `${JSON.stringify(
    {
      note: 'کلید رسمی بازیابی‌شدهٔ آزمون‌های مدیریت؛ فقط اعداد مورد توافق لایهٔ متن و OCR. منبع: .ael-work/exam-recovery/merged-keys',
      correctOptionBase: 1,
      years: orderedYears,
    },
    null,
    1,
  )}\n`,
  'utf8',
);

console.log(`wrote ${outFile}`);
for (const year of yearKeys) {
  console.log(`${year}: ${Object.keys(orderedYears[year].entries).length} کلید رسمی، ${orderedYears[year].holes.length} حفره`);
}
