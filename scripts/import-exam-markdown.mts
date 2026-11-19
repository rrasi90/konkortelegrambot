/**
 * ورود سؤال‌های دفترچه‌های رسمی از متن استخراج‌شدهٔ MinerU.
 *
 * ورودی: `pdf/*.md` (متن استخراج‌شدهٔ PDF دفترچه‌ها، خارج از git نیست ولی خودِ PDF در git نیست)
 * شاهد کلید: `content/exam-key-evidence/answers-by-year.json`
 *
 * هر سؤال فقط وقتی وارد می‌شود که همهٔ دروازه‌ها را رد کند:
 *   ۱. عدد سؤال در بازهٔ دفترچه و بیرون از بازهٔ حذف باشد
 *   ۲. چهار گزینهٔ جدا و غیرتکراری استخراج شود
 *   ۳. متن سؤال خالی نباشد و به اندازهٔ کافی طول داشته باشد
 *   ۴. متن شبیه OCR سالم باشد (بدون کاراکترهای شکسته و بدون تکرار ماشینی)
 *   ۵. شماره در شاهد کلید رسمی موجود باشد
 *   ۶. شماره در بانک فعلی همان سال و مقطع تکراری نباشد و متنش تکرار نباشد
 *
 * خروجی:
 *   - `src/data/examArchiveImported.ts` (بدون کلید — سازگار با R-036)
 *   - `apps/worker/src/data/exam-archive-keys.json` (کلید سمت سرور)
 *   - `content/exam-key-evidence/markdown-import-report.json` (سند رد/قبول)
 *
 * اجرا: node --import tsx scripts/import-exam-markdown.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { corroborates, docxText } from './lib/docx-text.mts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { YEARLY_KONKOR_BOOKLETS, YEARLY_KONKOR_QUESTIONS } from '../src/data/yearlyKonkorExams';
import { EXAM_ARCHIVE_IMPORTED_QUESTIONS } from '../src/data/examArchiveImported';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

interface SourceBooklet {
  year: number;
  bookletCode: string;
  markdownPath: string;
  examLevel: 'ارشد' | 'دکتری';
}

/** نگاشت فایل‌های متن به سال، بر پایهٔ sha256 منبع PDF در سرصفحهٔ فایل. */
const SOURCES: SourceBooklet[] = [
  { year: 1402, bookletCode: '818C', markdownPath: 'pdf/arshd modiriat-1402.md', examLevel: 'ارشد' },
  { year: 1403, bookletCode: '141C', markdownPath: 'pdf/Arshad_modiriat_1403[cafetadris.com].md', examLevel: 'ارشد' },
  { year: 1404, bookletCode: '519C', markdownPath: 'pdf/1142-مدیریت.md', examLevel: 'ارشد' },
];

interface KeyEvidence {
  years: Record<string, { entries: Record<string, number>; maxQuestion: number | null }>;
}

interface ImportedQuestion {
  id: string;
  nodeId: string;
  examYear: number;
  bookletQuestionNumber: number;
  courseSectionId: string;
  courseSectionTitle: string;
  designedFromTextbook: string;
  sourceReference: string;
  text: string;
  options: string[];
  expectedTimeMs: number;
}


const persianDigits = (text: string): string =>
  text.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

const normalize = (text: string): string =>
  text
    .replace(/[\u200c\u200e\u200f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** حذف سرصفحه، شمارهٔ صفحه و تیترهای تکراری دفترچه. */
function cleanLines(markdown: string): string[] {
  const body = markdown.replace(/^---[\s\S]*?---/, '');
  return persianDigits(body)
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^##\s*صفحه/.test(line) &&
        !/^\[تصویر/.test(line) &&
        !/^مدیریت \(کد/.test(line) &&
        !/^[0-9]{1,3}$/.test(line) &&
        !/^(PART|Directions|PASSAGE)/i.test(line),
    );
}

const evidenceFor = (year: number, number: number): number | undefined => evidence.years[String(year)]?.entries[String(number)];

const evidence = JSON.parse(
  readFileSync(join(root, 'content', 'exam-key-evidence', 'answers-by-year.json'), 'utf8'),
) as KeyEvidence;

const conflicts = JSON.parse(
  readFileSync(join(root, 'content', 'exam-key-evidence', 'known-key-conflicts.json'), 'utf8'),
) as { conflicts: { id: string; verdict: string }[] };
const bankCorrected = new Map(
  conflicts.conflicts.filter((conflict) => conflict.verdict === 'bank_correct').map((conflict) => [conflict.id, true]),
);

const sectionFor = (year: number, number: number) => {
  const booklet = YEARLY_KONKOR_BOOKLETS.find((candidate) => candidate.year === year);
  return booklet?.subjectRanges.find((range) => number >= range.fromQuestion && number <= range.toQuestion);
};

const sectionNode: Record<string, string> = {
  english: 'bus.english_eshraghi',
  islamic: 'bus.islamic_moghimi',
  math_stats: 'bus.math_stats_ranjbaran_tourani',
  management_theories: 'mb.structure',
  economics: 'bus.econ_nazari',
  public_finance: 'fin.public_finance',
  human_resources: 'hr.practices_hrm',
  operations_research: 'ind.or_simplex_duality',
  financial_management: 'fin.risk_investment',
  production: 'ind.pom_eoq_mrp',
  marketing: 'mkt.plc',
  investment_risk: 'fin.risk_investment',
  entrepreneurship: 'inno.s-curve',
  accounting: 'fin.accounting',
  transportation: 'ops.transport',
  business_transportation: 'ops.transport',
};

/** دامنهٔ ورود خودکار. بخش زبان متن لاتین دارد و خطای OCR آن قابل‌تشخیص است؛ بخش‌های فارسی
 *  تا پایان بازبینی دستی وارد نمی‌شوند. */
const ALLOWED_SECTIONS = new Set(['english']);

/** گزینه‌های بدقلق: کاراکترهای شکسته، متن خالی و تکرار واژه. */
function looksLikeCleanText(text: string, isPersian: boolean): boolean {
  if (!text || text.length < 10) return false;
  if (/[|]{2,}|`{2,}|#{2,}/.test(text)) return false;
  if (/\?\?|�/.test(text)) return false;
  const words = text.split(' ').filter(Boolean);
  if (words.length < 3) return false;
  const uniqueRatio = new Set(words.map((word) => word.toLowerCase())).size / words.length;
  if (uniqueRatio < 0.4) return false;
  if (isPersian && !/[\u0600-\u06FF]/.test(text)) return false;
  return true;
}

const imported: ImportedQuestion[] = [];
const serverKeys: Record<string, { correctOption: number; examYear: number; bookletQuestionNumber: number; source: string }> = {};
const report: Record<string, unknown>[] = [];

/** بانک پایه، بدون سؤال‌های همین ورود؛ تا اجرای دوباره نتیجهٔ یکسان بدهد. */
const archiveIds = new Set(EXAM_ARCHIVE_IMPORTED_QUESTIONS.map((question) => question.id));
const baseQuestions = YEARLY_KONKOR_QUESTIONS.filter((question) => !archiveIds.has(question.id));
const existingStems = new Set(baseQuestions.map((question) => normalize(question.text)));
const existingNumbers = new Set(
  baseQuestions.map((question) => `${question.examYear}|${question.bookletQuestionNumber}`),
);
const acceptedStems = new Set<string>();

for (const source of SOURCES) {
  const booklet = YEARLY_KONKOR_BOOKLETS.find((candidate) => candidate.year === source.year);
  if (!booklet) {
    report.push({ year: source.year, error: 'دفترچه در بانک ثبت نشده است' });
    continue;
  }

  const lines = cleanLines(readFileSync(join(root, source.markdownPath), 'utf8'));
  const corroboration = docxText(join(root, 'docs', 'exam-ocr', '1142', `1142-${source.year}.docx`));
  if (!corroboration) {
    report.push({ year: source.year, warning: 'متن OCR دوم برای مقابله پیدا نشد' });
  }
  const starts: { number: number; index: number }[] = [];
  lines.forEach((line, index) => {
    const match = /^(\d{1,3})\s*[-–.]\s+/.exec(line);
    if (match) starts.push({ number: Number(match[1]), index });
  });

  const stats = { year: source.year, candidates: 0, accepted: 0, rejected: {} as Record<string, number> };
  const reject = (reason: string) => {
    stats.rejected[reason] = (stats.rejected[reason] ?? 0) + 1;
  };

  for (let index = 0; index < starts.length; index += 1) {
    const { number, index: start } = starts[index];
    if (number < 1 || number > booklet.totalQuestionsInBooklet) continue;
    const end = starts[index + 1]?.index ?? lines.length;
    const block = normalize(lines.slice(start, end).join('\n').replace(/^\d{1,3}\s*[-–.]\s+/, ''));
    const markers = [...block.matchAll(/(?:^|\s|\u200f|\u200e)([1-4])\s*\)\s*/g)];
    if (markers.length !== 4) {
      reject('گزینه‌ها چهارتایی و پیاپی نیستند');
      continue;
    }
    stats.candidates += 1;

    const prompt = normalize(block.slice(0, markers[0].index));
    const options = markers.map((marker, position) =>
      normalize(block.slice(marker.index + marker[0].length, markers[position + 1]?.index ?? block.length)),
    );

    const section = sectionFor(source.year, number);
    if (!section) {
      reject('درس سؤال مشخص نشد');
      continue;
    }
    if (!ALLOWED_SECTIONS.has(section.sectionId)) {
      reject('درس در دامنهٔ ورود خودکار نیست (فارسی نیازمند بازبینی دستی است)');
      continue;
    }
    if (!looksLikeCleanText(prompt, section.sectionId !== 'english')) {
      reject('متن سؤال شکسته است');
      continue;
    }
    if (options.some((option) => !option || option.length < 1 || option.length > 220)) {
      reject('گزینهٔ خالی یا بسیار بلند');
      continue;
    }
    if (options.some((option) => /@@|صفحه|\?\?|\uFFFD/.test(option))) {
      reject('گزینه آشغال دارد');
      continue;
    }
    if (new Set(options.map((option) => option.toLowerCase())).size !== 4) {
      reject('گزینهٔ تکراری');
      continue;
    }
    if (options.some((option) => /^\d+$/.test(option))) {
      reject('گزینه فقط عدد است');
      continue;
    }
    if (!evidenceFor(source.year, number)) {
      reject('کلید رسمی برای این شماره موجود نیست');
      continue;
    }
    const numberKey = `${source.year}|${number}`;
    if (existingNumbers.has(numberKey)) {
      reject('این شماره در بانک موجود است');
      continue;
    }
    const stem = normalize(prompt);
    if (existingStems.has(stem) || acceptedStems.has(stem)) {
      reject('متن سؤال در بانک موجود است');
      continue;
    }

    const id = `q.k${source.year}.${number}`;
    if (imported.some((question) => question.id === id)) {
      reject('شناسهٔ تکراری');
      continue;
    }

    if (!corroborates({ text: prompt, options }, corroboration).ok) {
      reject('منبع دوم مستقل تأیید نکرد');
      continue;
    }

    acceptedStems.add(stem);
    stats.accepted += 1;
    imported.push({
      id,
      nodeId: sectionNode[section.sectionId] ?? 'mb.structure',
      examYear: source.year,
      bookletQuestionNumber: number,
      courseSectionId: section.sectionId,
      courseSectionTitle: section.title,
      designedFromTextbook: `دفترچهٔ رسمی ارشد ${source.year} (کد ${booklet.bookletCode}) — درس ${section.title}`,
      sourceReference:
        `کنکور ارشد مدیریت ${source.year} (کد ${booklet.bookletCode}) — سؤال ${number} دفترچه — ` +
        'متن از استخراج PDF و کلید از شاهد رسمی بازیابی‌شده',
      text: prompt,
      options,
      expectedTimeMs: 80_000,
    });
    serverKeys[id] = {
      correctOption: evidenceFor(source.year, number)! - 1,
      examYear: source.year,
      bookletQuestionNumber: number,
      source: `official-key:${source.year}:${number}`,
    };
  }

  report.push(stats);
  console.log(`${source.year}: ${stats.accepted} پذیرفته از ${stats.candidates} نامزد`, stats.rejected);
}

const header = `/**
 * GENERATED FILE — دست نزنید.
 *
 * سؤال‌های دفترچه‌های رسمی که از متن استخراج‌شدهٔ PDF وارد شده‌اند.
 * کلید پاسخ این سؤال‌ها عمداً اینجا نیست (R-036) و در
 * \`apps/worker/src/data/exam-archive-keys.json\` نگه داشته می‌شود.
 *
 * بازتولید: node --import tsx scripts/import-exam-markdown.mts
 */
import type { YearlyKonkorQuestion } from './yearlyKonkorExams';

/** این شناسه‌ها در شاهد کلید رسمی با بانک اختلاف ثبت‌شده دارند و اصلاح‌شده تلقی می‌شوند. */
export const BANK_CORRECTED_KEY_IDS: readonly string[] = ${JSON.stringify([...bankCorrected.keys()])};

export const EXAM_ARCHIVE_IMPORTED_QUESTIONS: YearlyKonkorQuestion[] = ${JSON.stringify(imported, null, 2)};
`;

writeFileSync(join(root, 'src', 'data', 'examArchiveImported.ts'), header, 'utf8');
writeFileSync(
  join(root, 'apps', 'worker', 'src', 'data', 'exam-archive-keys.json'),
  `${JSON.stringify({ note: 'کلید سؤال‌های واردشده از متن دفترچه؛ سمت سرور نگه داشته می‌شود.', keys: serverKeys }, null, 1)}\n`,
  'utf8',
);
writeFileSync(
  join(root, 'content', 'exam-key-evidence', 'markdown-import-report.json'),
  `${JSON.stringify({ note: 'سند قبول/رد ورود سؤال از متن دفترچه', sources: SOURCES.map((s) => s.markdownPath), report }, null, 1)}\n`,
  'utf8',
);

console.log(`\nimported ${imported.length} questions`);
