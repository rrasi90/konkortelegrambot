/**
 * ارتقای سؤال‌های بازبینی‌شدهٔ فارسی از ناحیهٔ آماده‌سازی به بانک سؤال.
 *
 * چرا دروازهٔ سخت: متن منبع، OCR است. بازبین فقط اجازهٔ اصلاح خطای خواندن دارد، نه
 * بازنویسی محتوا. پس متن بازبینی‌شده باید با متن استخراج‌شده مقایسه شود و اگر
 * بیش از سقف تعیین‌شده تغییر کرده باشد، رد می‌شود. عدد، نام، سال و گزینه‌ها
 * نباید عوض شوند؛ اگر عوض شده باشند یعنی متن تازه ساخته شده، نه اصلاح.
 *
 * ورودی:  `content/exam-review/<year>.json`
 * خروجی:  `src/data/examArchivePersian.ts`
 *          `apps/worker/src/data/exam-persian-keys.json`
 *          `content/exam-review/promotion-report.json`
 *
 * اجرا: node --import tsx scripts/promote-exam-review.mts [--year=1396] [--dry]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');
const yearArg = process.argv.find((item) => item.startsWith('--year='));
const onlyYear = yearArg ? Number(yearArg.split('=')[1]) : null;

/** سقف تغییر مجاز نسبت به متن استخراج‌شده؛ بیشتر از این یعنی بازنویسی، نه اصلاح. */
const MAX_EDIT_RATIO = 0.35;

/**
 * یکدست‌سازی نیم‌فاصله که بازبین گاهی جا می‌گذارد.
 *
 * فقط الگوهای قطعی اعمال می‌شوند (صفت تفضیلی، پیشوند می/نمی، چند ترکیب ثابت)؛
 * قاعدهٔ گشاد‌تر مثل «ها»ی جمع عمداً نیست چون معنا را عوض می‌کند.
 * بعد از دروازه اجرا می‌شود تا سنجش ویرایشی روی متن بازبینی‌شده بماند.
 */
function polishPersian(value: string): string {
  const letter = '[\u0621-\u063A\u0641-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC]';
  return value
    .replace(/([\u0621-\u063A\u0641-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC])\s+(ترین|تر)(?=[\s،؛.:؟!«»)]|$)/g, '$1\u200c$2')
    .replace(/(^|[\s(«])(ن?می)\s+(?=[\u0600-\u06FF])/g, '$1$2\u200c')
    .replace(new RegExp(`${letter}\\s+ها(?=[\\s،؛.:؟!«»)]|$)`, 'g'), (match) =>
      match.replace(/\s+/, '\u200c'),
    )
    .replace(new RegExp(`(${letter})\\s*,\\s*(?=${letter})`, 'g'), '$1، ')
    .replace(/جابه\s+جایی/g, 'جابه\u200cجایی')
    .replace(/جمع\s+آوری/g, 'جمع\u200cآوری')
    .replace(/به\s+کارگیری/g, 'به\u200cکارگیری')
    .replace(/هم\s+پیوندی/g, 'هم\u200cپیوندی')
    .replace(/قابل\s+توجه/g, 'قابل\u200cتوجه');
}

interface ExtractedQuestion {
  examYear: number;
  sectionId: string;
  number: number;
  stem: string;
  options: string[];
}

interface ReviewedQuestion {
  number: number;
  sectionId: string;
  text: string;
  options: string[];
  originalText?: string;
  originalOptions?: string[];
  note?: string;
  skip?: boolean;
  skipReason?: string;
}

const { YEARLY_KONKOR_BOOKLETS, KONKOR_COURSE_SECTIONS } = (await import(
  pathToFileURL(join(root, 'src', 'data', 'yearlyKonkorExams.ts')).href
)) as {
  YEARLY_KONKOR_BOOKLETS: {
    year: number;
    examLevel?: string;
    subjectRanges: { sectionId: string; fromQuestion: number; toQuestion: number; title: string }[];
  }[];
  KONKOR_COURSE_SECTIONS: { id: string; title: string; defaultNodeId: string | null }[];
};

const evidence = JSON.parse(
  readFileSync(join(root, 'content', 'exam-key-evidence', 'answers-by-year.json'), 'utf8'),
) as { years: Record<string, { entries: Record<string, number> }> };

const extractedPath = join(root, 'content', 'exam-import-staging', 'ocr-persian', 'extracted.json');
if (!existsSync(extractedPath)) throw new Error('extracted.json نیست؛ اول import:exam-persian را اجرا کن.');
const extracted = (
  JSON.parse(readFileSync(extractedPath, 'utf8')) as { questions: ExtractedQuestion[] }
).questions;

const normalize = (text: string): string => text.replace(/[\u200c\s]+/g, ' ').trim();

/** فاصلهٔ ویرایشی نویسه‌ای، نرمال‌شده به بلندترین متن. */
function editRatio(a: string, b: string): number {
  const left = [...normalize(a)];
  const right = [...normalize(b)];
  if (left.length === 0 && right.length === 0) return 0;
  const previous = new Array<number>(right.length + 1);
  const current = new Array<number>(right.length + 1);
  for (let index = 0; index <= right.length; index += 1) previous[index] = index;
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
  }
  return previous[right.length] / Math.max(left.length, right.length);
}

/** اعداد متن؛ برای اطمینان از این‌که مقدارها در بازبینی گم یا عوض نشده‌اند. */
const numbersOf = (text: string): string[] =>
  (text.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).match(/\d+/g) ?? []).sort();

const reviewDir = join(root, 'content', 'exam-review');
const reviewFiles = existsSync(reviewDir)
  ? readdirSync(reviewDir).filter((name) => /^\d{4}\.json$/.test(name))
  : [];
if (reviewFiles.length === 0) {
  console.log('NO_REVIEW_FILES: هیچ فایل بازبینی‌ای در content/exam-review نیست.');
  process.exit(0);
}

const accepted: {
  id: string;
  nodeId: string;
  examYear: number;
  examLevel: 'ارشد';
  bookletQuestionNumber: number;
  courseSectionId: string;
  courseSectionTitle: string;
  designedFromTextbook: string;
  sourceReference: string;
  text: string;
  options: string[];
  expectedTimeMs: number;
}[] = [];
/** درس‌هایی که یک سؤالشان شمارهٔ ناهمخوان داشت؛ کل درس قرنطینه می‌شود. */
const suspectSections = new Set<string>();
const sectionOf = (year: number, sectionId: string): string => `${year}|${sectionId}`;
const keys: Record<
  string,
  { correctOption: number; examYear: number; bookletQuestionNumber: number; source: string; bank: string }
> = {};
const rejections: Record<string, unknown>[] = [];
const seenIds = new Set<string>();
const seenStems = new Set<string>();

// شناسه و متن بانک‌های دیگر پیش‌تر خوانده می‌شود تا ارتقا سؤال تکراری نسازد.
// `YEARLY_KONKOR_QUESTIONS` خودش بانک انگلیسی و فارسیِ واردشده را هم در بر می‌گیرد،
// پس سؤال‌های آن دو کنار گذاشته می‌شوند؛ وگرنه ارتقای دوباره تکراری شمرده می‌شد.
const { YEARLY_KONKOR_QUESTIONS } = (await import('../src/data/yearlyKonkorExams.ts')) as {
  YEARLY_KONKOR_QUESTIONS: { id: string; text: string }[];
};
const { EXAM_ARCHIVE_IMPORTED_QUESTIONS } = (await import(
  '../src/data/examArchiveImported.ts'
)) as { EXAM_ARCHIVE_IMPORTED_QUESTIONS: { id: string; text: string }[] };
const { EXAM_ARCHIVE_PERSIAN_QUESTIONS } = (await import(
  '../src/data/examArchivePersian.ts'
)) as { EXAM_ARCHIVE_PERSIAN_QUESTIONS: { id: string; text: string }[] };
const derived = new Set([
  ...EXAM_ARCHIVE_IMPORTED_QUESTIONS.map((question) => question.id),
  ...EXAM_ARCHIVE_PERSIAN_QUESTIONS.map((question) => question.id),
]);
for (const question of YEARLY_KONKOR_QUESTIONS) {
  if (derived.has(question.id)) continue;
  seenIds.add(question.id);
  seenStems.add(normalize(question.text));
}

for (const file of reviewFiles) {
  const payload = JSON.parse(readFileSync(join(reviewDir, file), 'utf8')) as {
    year: number;
    reviewed: ReviewedQuestion[];
  };
  const year = payload.year;
  if (onlyYear !== null && year !== onlyYear) continue;

  // فایل بازبینی باید همان تعداد سؤال ورودی را داشته باشد؛ وگرنه یک اجرای قدیمی
  // یا نیمه‌کاره می‌تواند بانک را بی‌صدا کوچک کند.
  const inputPath = join(reviewDir, `${year}-input.json`);
  if (existsSync(inputPath)) {
    const input = JSON.parse(readFileSync(inputPath, 'utf8')) as { questions?: unknown[] };
    const expected = input.questions?.length ?? 0;
    if (expected > 0 && payload.reviewed.length !== expected) {
      rejections.push({
        year,
        reason: `فایل بازبینی با ورودی نمی‌خواند (${payload.reviewed.length} در برابر ${expected})`,
      });
      continue;
    }
  }

  const booklet = YEARLY_KONKOR_BOOKLETS.find(
    (item) => item.year === year && (item.examLevel ?? 'ارشد') === 'ارشد',
  );
  if (!booklet) {
    rejections.push({ year, reason: 'دفترچه در بانک ثبت نشده است' });
    continue;
  }

  for (const item of payload.reviewed ?? []) {
    const reject = (reason: string) => rejections.push({ year, number: item.number, reason });

    // حکم بازبین بر رد، پذیرفته می‌شود؛ سؤالی که بازبین نتوانسته مطمئن بازسازی کند
    // نباید با متن قدیمی وارد بانک شود.
    if (item.skip === true) {
      reject(`بازبین رد کرد: ${item.skipReason || 'بدون دلیل'}`);
      continue;
    }

    if (!Number.isInteger(item.number) || item.number < 1) {
      reject('شمارهٔ سؤال نامعتبر');
      continue;
    }
    const range = booklet.subjectRanges.find(
      (candidate) => item.number >= candidate.fromQuestion && item.number <= candidate.toQuestion,
    );
    if (!range) {
      reject('شماره بیرون از بازهٔ دفترچه');
      continue;
    }
    if (range.sectionId !== item.sectionId) {
      reject(`درس با جدول جلد نمی‌خواند (جلد: ${range.sectionId})`);
      continue;
    }
    const source = extracted.find(
      (candidate) => candidate.examYear === year && candidate.number === item.number,
    );
    if (!source) {
      reject('متن استخراج‌شدهٔ این شماره پیدا نشد');
      continue;
    }

    const text = normalize(item.text ?? '');
    const options = (item.options ?? []).map((option) => normalize(option));
    if (text.length < 12) {
      reject('صورت سؤال خیلی کوتاه است');
      continue;
    }
    // صورت سؤالی که با نشانهٔ پایان جمله بسته نشده، در OCR نصفه مانده است.
    if (!/[.؟!»)\]:…]$/.test(text)) {
      reject('صورت سؤال ناتمام است');
      continue;
    }
    if ((text.match(/[\u0600-\u06FF]/g) ?? []).length < 6) {
      reject('صورت سؤال فارسی کافی ندارد');
      continue;
    }
    if (options.length !== 4 || options.some((option) => option.length === 0 || option.length > 260)) {
      reject('چهار گزینهٔ سالم ندارد');
      continue;
    }
    if (new Set(options).size !== 4) {
      reject('گزینهٔ تکراری');
      continue;
    }

    // دروازهٔ ضدجعل: فاصلهٔ ویرایشی با متن استخراج‌شده محدود است.
    const stemRatio = editRatio(source.stem, text);
    if (stemRatio > MAX_EDIT_RATIO) {
      reject(`تغییر متن بیش از سقف (${(stemRatio * 100).toFixed(0)}٪)`);
      continue;
    }
    const optionRatio = Math.max(
      ...source.options.map((option, index) => editRatio(option, options[index] ?? '')),
      0,
    );
    if (optionRatio > MAX_EDIT_RATIO) {
      reject(`تغییر گزینه بیش از سقف (${(optionRatio * 100).toFixed(0)}٪)`);
      continue;
    }
    if (numbersOf(source.stem).join(',') !== numbersOf(text).join(',')) {
      reject('اعداد صورت سؤال تغییر کرده‌اند');
      continue;
    }
    // اولین عدد متن اگر از شمارهٔ ردیف بزرگ‌تر باشد، متن به سؤال بعدی تعلق دارد.
    const lead = text.slice(0, 40).match(/(?:^|\s)([0-9۰-۹]{1,3})(?=[\s\-–.)])/);
    if (lead) {
      const read = Number(
        lead[1].replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))),
      );
      if (read > item.number) {
        reject('متن به سؤال دیگری تعلق دارد');
        suspectSections.add(sectionOf(year, range.sectionId));
        continue;
      }
    }

    const id = `q.k${year}.${item.number}`;
    if (seenIds.has(id)) {
      reject('شناسهٔ تکراری');
      continue;
    }
    const stemKey = normalize(text);
    if (seenStems.has(stemKey)) {
      reject('متن سؤال تکراری');
      continue;
    }
    const correctOption = evidence.years[String(year)]?.entries[String(item.number)];
    if (typeof correctOption !== 'number') {
      reject('کلید رسمی برای این شماره موجود نیست');
      continue;
    }
    // گرهٔ برنامهٔ درسی: برای ۷ درس رسمی، گراف برنامهٔ درسی هیچ گره‌ای ندارد و
    // `defaultNodeId` عمداً null است. چسباندنشان به گرهٔ درس دیگر، برچسب غلط می‌سازد.
    const nodeId = KONKOR_COURSE_SECTIONS.find(
      (section) => section.id === range.sectionId,
    )?.defaultNodeId;
    if (!nodeId) {
      reject('درس بدون گرهٔ برنامهٔ درسی');
      continue;
    }

    seenIds.add(id);
    seenStems.add(stemKey);
    accepted.push({
      id,
      nodeId,
      examYear: year,
      examLevel: 'ارشد',
      bookletQuestionNumber: item.number,
      courseSectionId: range.sectionId,
      courseSectionTitle: range.title,
      designedFromTextbook: `دفترچهٔ رسمی ارشد ${year} — درس ${range.title}`,
      sourceReference: `کنکور ارشد مدیریت ${year} — سؤال ${item.number} دفترچه — متن بازبینی‌شده از استخراج PDF`,
      text: polishPersian(text),
      options: options.map(polishPersian),
      expectedTimeMs: 80_000,
    });
    keys[id] = {
      correctOption: correctOption - 1,
      examYear: year,
      bookletQuestionNumber: item.number,
      source: `official-key:${year}:${item.number}`,
      bank: 'examArchivePersian',
    };
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  maxEditRatio: MAX_EDIT_RATIO,
  suspectSections: [...suspectSections].sort(),
  accepted: 0,
  rejected: rejections.length,
  byYear: {} as Record<string, number>,
  rejectionReasons: rejections.reduce<Record<string, number>>((accumulator, item) => {
    const reason = String(item.reason);
    accumulator[reason] = (accumulator[reason] ?? 0) + 1;
    return accumulator;
  }, {}),
  rejections,
};

// قرنطینهٔ درس‌های مشکوک: یک شمارهٔ ناهمخوان یعنی کل شماره‌گذاری آن درس قابل اتکا نیست.
const quarantined = accepted.filter((question) =>
  suspectSections.has(sectionOf(question.examYear, question.courseSectionId)),
);
for (const question of quarantined) {
  rejections.push({
    year: question.examYear,
    number: question.bookletQuestionNumber,
    reason: 'کل درس قرنطینه شد: شمارهٔ یک سؤال با متن نمی‌خواند',
  });
}
const keep = accepted.filter(
  (question) => !suspectSections.has(sectionOf(question.examYear, question.courseSectionId)),
);
accepted.length = 0;
accepted.push(...keep);
for (const question of keep) {
  report.byYear[String(question.examYear)] = (report.byYear[String(question.examYear)] ?? 0) + 1;
}
report.accepted = keep.length;
report.rejected = rejections.length;
report.rejectionReasons = rejections.reduce<Record<string, number>>((accumulator, item) => {
  const reason = String(item.reason);
  accumulator[reason] = (accumulator[reason] ?? 0) + 1;
  return accumulator;
}, {});
writeFileSync(
  join(root, 'content', 'exam-review', 'promotion-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);

console.log(
  `پذیرفته: ${accepted.length} — ردشده: ${rejections.length} — سال‌ها: ${JSON.stringify(report.byYear)}`,
);
for (const [reason, count] of Object.entries(report.rejectionReasons)) {
  console.log(`  - ${reason}: ${count}`);
}

if (dry) {
  console.log('DRY: فایل‌های بانک نوشته نشدند.');
  process.exit(0);
}

const header = `/**
 * GENERATED FILE — دست نزنید.
 *
 * سؤال‌های فارسی دفترچه‌های رسمی که متنشان بازبینی شده است. کلید این سؤال‌ها عمداً
 * اینجا نیست (R-036) و در \`apps/worker/src/data/exam-persian-keys.json\` نگه داشته
 * می‌شود.
 *
 * بازتولید: node --import tsx scripts/promote-exam-review.mts
 */
import type { YearlyKonkorQuestion } from './yearlyKonkorExams';

export const EXAM_ARCHIVE_PERSIAN_QUESTIONS: YearlyKonkorQuestion[] = ${JSON.stringify(accepted, null, 2)};
`;
writeFileSync(join(root, 'src', 'data', 'examArchivePersian.ts'), header, 'utf8');
writeFileSync(
  join(root, 'apps', 'worker', 'src', 'data', 'exam-persian-keys.json'),
  `${JSON.stringify(
    { note: 'کلید سؤال‌های فارسی بازبینی‌شده؛ فقط سمت سرور (R-036).', keys },
    null,
    1,
  )}\n`,
  'utf8',
);
console.log('نوشته شد: src/data/examArchivePersian.ts و apps/worker/src/data/exam-persian-keys.json');
