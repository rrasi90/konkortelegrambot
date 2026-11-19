/**
 * ورود سؤال‌های فارسی دفترچه‌های ارشد از متن تبدیل‌شدهٔ PDF.
 *
 * این ابزار فقط برای سال‌هایی اجرا می‌شود که جدول بازهٔ درس‌هایشان کامل است.
 * شمارهٔ هر سؤال دو شاهد دارد: شماره‌ای که در متن دفترچه خوانده شده و با ترتیب
 * همان درس می‌خواند، یا تطبیق کامل تعداد سؤال‌های درس با جدول جلد دفترچه. سؤالی
 * که هیچ‌کدام را ندارد وارد نمی‌شود، چون کلیدش از شماره خوانده می‌شود و شمارهٔ
 * حدسی یعنی کلید حدسی.
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
import { splitPages } from './lib/md-questions.mts';
import { extractByNumber } from './lib/sequential-questions.mts';

const root = process.cwd();
const write = process.argv.includes('--write');

interface SourceFile {
  year: number;
  path: string;
}

const SOURCES: SourceFile[] = [
  { year: 1396, path: 'pdf/دفترچه_سؤالات_کنکور_ارشد_مدیریت_1396.md' },
  { year: 1397, path: 'pdf/دفترچه_سؤالات_کنکور_ارشد_مدیریت_1397.md' },
  { year: 1398, path: 'pdf/دفترچه_سؤالات_کنکور_ارشد_مدیریت_1398.md' },
  { year: 1399, path: 'pdf/دفترچه_سؤالات_کنکور_ارشد_مدیریت_1399.md' },
  { year: 1400, path: 'pdf/دفترچه_سؤالات_کنکور_ارشد_مدیریت_1400.md' },
  { year: 1401, path: 'pdf/دانلود سؤالات کنکور کارشناسی ارشد مدیریت سال ۱۴۰۱.md' },
  { year: 1402, path: 'pdf/arshd modiriat-1402.md' },
  { year: 1403, path: 'pdf/Arshad_modiriat_1403[cafetadris.com].md' },
  { year: 1404, path: 'pdf/1142-مدیریت.md' },
  { year: 1405, path: 'pdf/1405-مدیریت.md' },
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
  numberSource: 'count' | 'number';
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
const extractedAll: Record<string, unknown>[] = [];
let keyChecks = 0;

const booklets = await loadBooklets();
console.log(`سال‌های با بازهٔ کامل: ${[...booklets.keys()].sort().join('، ')}`);

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

  const result = extractByNumber(splitPages(raw), {
    total: booklet.total,
    ranges: booklet.ranges,
  });

  const reasons: Record<string, number> = {};
  const reject = (reason: string) => {
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  };
  let kept = 0;
  let candidates = 0;
  const perSection = new Map<string, number>();
  const extracted: Record<string, unknown>[] = [];

  for (const question of result.questions) {
    // زبان انگلیسی جدا و با منبع دوم مقابله می‌شود؛ اینجا وارد نمی‌شود.
    if (question.sectionId === 'english') continue;
    candidates += 1;

    const stem = question.stem.replace(/\s+/g, ' ').trim();
    const persian = (stem.match(/[\u0600-\u06FF]/g) ?? []).length;
    if (stem.length < 12) {
      reject('صورت سؤال خیلی کوتاه است');
      extracted.push({ ...question, gate: 'صورت سؤال خیلی کوتاه است' });
      continue;
    }
    // درس زبان صورت سؤال انگلیسی دارد؛ الزام فارسی فقط برای درس‌های فارسی است.
    if (question.sectionId !== 'english' && persian < 6) {
      reject('صورت سؤال فارسی کافی ندارد');
      extracted.push({ ...question, gate: 'صورت سؤال فارسی کافی ندارد' });
      continue;
    }
    if (question.options.some((option) => option.length === 0 || option.length > 260)) {
      reject('گزینهٔ خالی یا بسیار بلند');
      extracted.push({ ...question, gate: 'گزینهٔ خالی یا بسیار بلند' });
      continue;
    }
    if (/\?\?|�|@@/.test(stem) || question.options.some((option) => /\?\?|�|@@/.test(option))) {
      reject('متن آشغال دارد');
      extracted.push({ ...question, gate: 'متن آشغال دارد' });
      continue;
    }
    // اگر نزدیک ابتدای متن شمارهٔ سؤال دیگری باشد، متن به این ردیف تعلق ندارد.
    const near = stem.slice(0, 40).match(/(?:^|\s)([0-9۰-۹]{1,3})(?=[\s\-–.)])/);
    if (near) {
      const read = Number(
        near[1].replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))),
      );
      if (read > question.number && read <= question.number + 40) {
        reject('شمارهٔ متن با ردیف نمی‌خواند');
        extracted.push({ ...question, gate: 'شمارهٔ متن با ردیف نمی‌خواند' });
        continue;
      }
    }
    const unknownRatio = vocabulary.unknownRatio(`${stem} ${question.options.join(' ')}`);
    if (unknownRatio > MAX_UNKNOWN_RATIO) {
      reject('متن پرخطا: واژه‌های ناشناس زیاد');
      extracted.push({ ...question, gate: 'متن پرخطا: واژه‌های ناشناس زیاد', unknownRatio });
      continue;
    }
    if (keyFor(source.year, question.number) === null) {
      reject('کلید رسمی برای این شماره موجود نیست');
      extracted.push({ ...question, gate: 'کلید رسمی برای این شماره موجود نیست' });
      continue;
    }

    extracted.push({ ...question, gate: null, unknownRatio });

    imported.push({
      id: `q.k${source.year}.${question.number}`,
      examYear: source.year,
      examLevel: 'ارشد',
      sectionId: question.sectionId,
      bookletQuestionNumber: question.number,
      numberSource: question.numberSource,
      text: stem,
      options: question.options,
      source: 'ocr_markdown',
      designedFromTextbook: false,
    });
    keyChecks += 1;
    kept += 1;
    perSection.set(question.sectionId, (perSection.get(question.sectionId) ?? 0) + 1);
  }

  for (const item of result.rejections) {
    reject(`استخراج: ${item.reason}`);
  }

  report.push({
    year: source.year,
    declared: booklet.total,
    extracted: result.questions.length,
    candidates,
    kept,
    groups: result.stats.groups,
    sectionsComplete: result.stats.sectionsComplete,
    sectionsIncomplete: result.stats.sectionsIncomplete,
    perSection: Object.fromEntries(perSection),
    reasons,
  });
  extractedAll.push(...extracted.map((item) => ({ examYear: source.year, ...item })));
  console.log(
    `${source.year}: ${kept} سؤال پذیرفته از ${candidates} نامزد (استخراج ${result.questions.length}/${booklet.total})`,
  );
}

console.log(JSON.stringify(report, null, 1));

if (write) {
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
  writeFileSync(
    join(root, 'content', 'exam-import-staging', 'ocr-persian', 'extracted.json'),
    `${JSON.stringify({ note: 'همهٔ سؤال‌های استخراج‌شده، با حکم دروازهٔ کیفیت؛ ورودی مرحلهٔ بازبینی.', questions: extractedAll }, null, 1)}\n`,
    'utf8',
  );
  console.log(`نوشته شد: ${unique.length} سؤال (کلید بررسی‌شده برای ${keyChecks} نامزد)`);
}
