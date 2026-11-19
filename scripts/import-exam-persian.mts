/**
 * ورود سؤال‌های فارسی دفترچه‌های ارشد از متن تبدیل‌شدهٔ PDF.
 *
 * این ابزار فقط برای سال‌هایی اجرا می‌شود که جدول بازهٔ درس‌هایشان کامل است، چون
 * شمارهٔ هر سؤال از همان بازه می‌آید. متن منبع OCR است؛ پس هر سؤال باید چند
 * دروازه را بگذراند: صورت سؤال فارسی و سالم، چهار گزینهٔ یکتای فارسی یا عددی،
 * شمارهٔ داخل بازهٔ درس، و کلید رسمی موجود. سؤال مشکوک وارد نمی‌شود و در گزارش
 * با دلیل ثبت می‌شود.
 *
 * خروجی این ابزار عمداً در ناحیهٔ آماده‌سازی می‌نشیند، نه در بانک سؤال برنامه:
 * متن OCR فارسی روی نمونهٔ بررسی‌شده حدود یک واژه در هر هفت واژه خطا دارد. تا
 * وقتی نسخهٔ تمیز در دست نباشد، این سؤال‌ها فقط نامزد بازبینی‌اند و به بانک
 * دانش‌آموز نمی‌روند.
 *
 * اجرا:
 *   node --import tsx scripts/import-exam-persian.mts           # گزارش
 *   node --import tsx scripts/import-exam-persian.mts --write   # نوشتن نامزدها
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { buildVocabulary } from './lib/persian-quality.mts';
import {
  cleanPage,
  isSaneText,
  optionGroups,
  sectionTexts,
  sectionOfLine,
  splitPages,
  stemNumber,
} from './lib/md-questions.mts';

const root = process.cwd();
const write = process.argv.includes('--write');

interface SourceFile {
  year: number;
  path: string;
}

const SOURCES: SourceFile[] = [
  { year: 1402, path: 'pdf/arshd modiriat-1402.md' },
  { year: 1403, path: 'pdf/Arshad_modiriat_1403[cafetadris.com].md' },
  { year: 1404, path: 'pdf/1142-مدیریت.md' },
];

interface BookletRange {
  sectionId: string;
  from: number;
  to: number;
  title: string;
}

interface Booklet {
  year: number;
  total: number;
  ranges: BookletRange[];
}

/** سال‌هایی که بازهٔ کامل و پیوسته دارند از بانک خوانده می‌شوند. */
async function loadBooklets(): Promise<Map<number, Booklet>> {
  const module = (await import(pathToFileURL(join(root, 'src', 'data', 'yearlyKonkorExams.ts')).href)) as {
    YEARLY_KONKOR_BOOKLETS: {
      year: number;
      totalQuestionsInBooklet: number;
      examLevel?: string;
      subjectRanges: { sectionId: string; fromQuestion: number; toQuestion: number; title: string }[];
    }[];
  };
  const map = new Map<number, Booklet>();
  for (const booklet of module.YEARLY_KONKOR_BOOKLETS) {
    if ((booklet.examLevel ?? 'ارشد') !== 'ارشد') continue;
    const ranges = [...booklet.subjectRanges].sort((a, b) => a.fromQuestion - b.fromQuestion);
    if (ranges.length !== 16) continue;
    let next = 1;
    let contiguous = true;
    for (const range of ranges) {
      if (range.fromQuestion !== next) contiguous = false;
      next = range.toQuestion + 1;
    }
    if (!contiguous || next !== booklet.totalQuestionsInBooklet + 1) continue;
    map.set(booklet.year, {
      year: booklet.year,
      total: booklet.totalQuestionsInBooklet,
      ranges: ranges.map((range) => ({
        sectionId: range.sectionId,
        from: range.fromQuestion,
        to: range.toQuestion,
        title: range.title,
      })),
    });
  }
  return map;
}

interface KeyEvidence {
  years: Record<string, { entries: Record<string, number> }>;
}

const evidence = JSON.parse(
  readFileSync(join(root, 'content', 'exam-key-evidence', 'answers-by-year.json'), 'utf8'),
) as KeyEvidence;

/** پایگاه گزینه‌های کلید: ۱ یعنی گزینهٔ ۱ درست است. */
const keyFor = (year: number, number: number): number | null => {
  const record = evidence.years[String(year)];
  if (!record) return null;
  const value = record.entries[String(number)];
  return typeof value === 'number' ? value : null;
};

interface ImportedQuestion {
  id: string;
  examYear: number;
  examLevel: 'ارشد';
  sectionId: string;
  bookletQuestionNumber: number;
  text: string;
  options: string[];
  source: 'ocr_markdown';
  designedFromTextbook: false;
}

const vocabulary = buildVocabulary(root);
/** سقف نسبت واژه‌های ناشناس؛ متن پرخطا نامزد بازبینی هم نمی‌شود. */
const MAX_UNKNOWN_RATIO = 0.08;

const report: Record<string, unknown>[] = [];
const imported: ImportedQuestion[] = [];
// کلید عمداً اینجا نوشته نمی‌شود؛ کلید فقط در content/exam-key-evidence می‌نشیند.
let keyChecks = 0;

const booklets = await loadBooklets();
console.log(`سال‌های با بازهٔ کامل: ${[...booklets.keys()].join('، ')}`);

for (const source of SOURCES) {
  const booklet = booklets.get(source.year);
  if (!booklet) {
    report.push({ year: source.year, skipped: 'بازهٔ درس‌ها کامل نیست' });
    continue;
  }
  let raw: string;
  try {
    raw = readFileSync(join(root, source.path), 'utf8');
  } catch {
    report.push({ year: source.year, skipped: 'فایل منبع نیست' });
    continue;
  }
  const pages = splitPages(raw).map((page) => cleanPage(page));
  const sections = sectionTexts(pages);
  const rangeOf = new Map(booklet.ranges.map((range) => [range.sectionId, range]));
  const used = new Set<number>();
  const reasons: Record<string, number> = {};
  let kept = 0;
  let candidates = 0;

  for (const block of sections) {
    const range = rangeOf.get(block.sectionId);
    if (!range) {
      reasons['درس بدون بازهٔ ثبت‌شده'] = (reasons['درس بدون بازهٔ ثبت‌شده'] ?? 0) + 1;
      continue;
    }
    let cursor = range.from;
    for (const group of optionGroups(block.text)) {
      candidates += 1;
      const stem = block.text.slice(group.stemStart, group.stemEnd).trim();
      if (!isSaneText(stem, 'stem')) {
        reasons['صورت سؤال ناسالم'] = (reasons['صورت سؤال ناسالم'] ?? 0) + 1;
        continue;
      }
      const options = group.options
        .map((option) => ({ index: option.index, text: option.text.replace(/\s+/g, ' ').trim() }))
        .sort((a, b) => a.index - b.index);
      if (options.length !== 4) {
        reasons['گزینه‌ها چهارتایی نیستند'] = (reasons['گزینه‌ها چهارتایی نیستند'] ?? 0) + 1;
        continue;
      }
      if (!options.every((option) => isSaneText(option.text, 'option'))) {
        reasons['گزینهٔ ناسالم'] = (reasons['گزینهٔ ناسالم'] ?? 0) + 1;
        continue;
      }
      const unknownRatio = vocabulary.unknownRatio(`${stem} ${options.map((option) => option.text).join(' ')}`);
      if (unknownRatio > MAX_UNKNOWN_RATIO) {
        reasons['متن پرخطا: واژه‌های ناشناس زیاد'] = (reasons['متن پرخطا: واژه‌های ناشناس زیاد'] ?? 0) + 1;
        continue;
      }
      if (new Set(options.map((option) => option.text)).size !== 4) {
        reasons['گزینهٔ تکراری'] = (reasons['گزینهٔ تکراری'] ?? 0) + 1;
        continue;
      }
      const vote = stemNumber(stem);
      let number: number;
      if (vote !== null && vote >= range.from && vote <= range.to && !used.has(vote)) {
        number = vote;
      } else {
        while (cursor <= range.to && used.has(cursor)) cursor += 1;
        if (cursor > range.to) {
          reasons['شمارهٔ خالی در بازه نیست'] = (reasons['شمارهٔ خالی در بازه نیست'] ?? 0) + 1;
          continue;
        }
        number = cursor;
      }
      const key = keyFor(source.year, number);
      if (key === null) {
        reasons['کلید رسمی برای این شماره موجود نیست'] = (reasons['کلید رسمی برای این شماره موجود نیست'] ?? 0) + 1;
        continue;
      }
      used.add(number);
      if (number >= cursor) cursor = number + 1;
      imported.push({
        id: `q.k${source.year}.${number}`,
        examYear: source.year,
        examLevel: 'ارشد',
        sectionId: range.sectionId,
        bookletQuestionNumber: number,
        text: stem.replace(/\s+/g, ' ').trim(),
        options: options.map((option) => option.text),
        source: 'ocr_markdown',
        designedFromTextbook: false,
      });
      keyChecks += 1;
      kept += 1;
    }
  }
  report.push({ year: source.year, candidates, kept, reasons });
  console.log(`${source.year}: ${kept} از ${candidates} نامزد پذیرفته شد`);
}

console.log(JSON.stringify(report, null, 1));

if (write) {
  console.log(`کلید بررسی‌شده برای ${keyChecks} نامزد`);
  const seen = new Set<string>();
  const unique = imported.filter((question) => {
    if (seen.has(question.id)) return false;
    seen.add(question.id);
    return true;
  });
  mkdirSync(join(root, 'content', 'exam-import-staging', 'ocr-persian'), { recursive: true });
  writeFileSync(
    join(root, 'content', 'exam-import-staging', 'ocr-persian', 'report.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), report, kept: unique.length }, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    join(root, 'content', 'exam-import-staging', 'ocr-persian', 'candidates.json'),
    `${JSON.stringify({ questions: unique }, null, 1)}\n`,
    'utf8',
  );
  console.log(`نوشته شد: ${unique.length} سؤال`);
}
void sectionOfLine;
