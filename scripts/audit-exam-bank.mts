/**
 * آدیت بانک سؤال آزمون‌های مدیریت — ساختار، کلید و پوشش.
 *
 * سه خانوادهٔ بررسی:
 *   ۱. ساختار: شناسه، متن، گزینه‌ها، تکرار و بازهٔ شمارهٔ سؤال در دفترچه.
 *   ۲. کلید: هر سؤال بانک باید کلید سمت سرور داشته باشد؛ اختلاف با کلید رسمی
 *      بازیابی‌شده فقط اگر در `content/exam-key-evidence/known-key-conflicts.json`
 *      ثبت شده باشد پذیرفته است.
 *   ۳. پوشش: نسبت سؤال موجود به سؤال اعلام‌شدهٔ هر دفترچه، به تفکیک مقطع.
 *
 * اجرا: npm run audit:exam-bank   (کد خروج ۱ یعنی نقض قابل‌اصلاح)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { YEARLY_KONKOR_BOOKLETS, YEARLY_KONKOR_QUESTIONS } from '../src/data/yearlyKonkorExams';
import { CLIENT_BANK_ANSWER_KEYS } from '../apps/worker/src/data/client-bank-keys.server';
import { getArshadCoverage, getDoctorateCoverage, isDoctorateQuestion } from '../src/data/examCoverage';
import { DOCTORATE_EXAM_YEAR_STRUCTURES } from '@ael/contracts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = join(root, 'content', 'exam-key-evidence');

interface KeyEvidenceFile {
  correctOptionBase: 1 | 0;
  years: Record<string, { entries: Record<string, number>; maxQuestion: number | null }>;
}

interface ConflictFile {
  conflicts: { id: string; year: number; number: number; bankKey: number; officialKey: number; verdict: string }[];
}

const evidence = JSON.parse(readFileSync(join(evidenceDir, 'answers-by-year.json'), 'utf8')) as KeyEvidenceFile;
const conflicts = JSON.parse(readFileSync(join(evidenceDir, 'known-key-conflicts.json'), 'utf8')) as ConflictFile;
const conflictIds = new Set(conflicts.conflicts.map((c) => c.id));

const serverKeys = new Map(CLIENT_BANK_ANSWER_KEYS.map((key) => [key.id, key.correctOption]));
const violations: string[] = [];
const notices: string[] = [];

/** نرمال‌سازی متن برای تشخیص تکرار؛ فاصله و نیم‌فاصله یکسان می‌شوند. */
const normalize = (text: string): string => text.replace(/[\u200c\s]+/g, ' ').trim();

const idSeen = new Set<string>();
const stemSeen = new Map<string, string>();
const numberSeen = new Set<string>();
const bookletByYear = new Map(YEARLY_KONKOR_BOOKLETS.map((booklet) => [booklet.year, booklet]));

/**
 * سال‌هایی که جدول بازهٔ درس‌هایشان در بانک ناقص است. بازه‌ها برای ۱۴۰۲ تا ۱۴۰۵
 * از جدول جلد همان دفترچه کامل شد؛ برای سال‌های قدیمی‌تر هنوز عکس جلد بازبینی نشده است.
 */
const RANGE_GAP_YEARS = new Set([1391, 1392, 1393, 1394, 1395, 1396, 1397, 1398, 1399, 1400, 1401]);
const rangeGapBooklets: number[] = [];

for (const booklet of YEARLY_KONKOR_BOOKLETS) {
  const declared = booklet.totalQuestionsInBooklet;
  const sum = booklet.subjectRanges.reduce((total, range) => total + range.count, 0);
  if (sum !== declared) {
    if (RANGE_GAP_YEARS.has(booklet.year)) rangeGapBooklets.push(booklet.year);
    else violations.push(`جمع بازهٔ درس‌های ${booklet.year} برابر ${sum} است، نه ${declared}`);
    continue;
  }
  let next = 1;
  for (const range of [...booklet.subjectRanges].sort((a, b) => a.fromQuestion - b.fromQuestion)) {
    if (range.fromQuestion !== next) violations.push(`بازهٔ پیوسته نیست در ${booklet.year} (شروع ${range.fromQuestion}، انتظار ${next})`);
    if (range.toQuestion - range.fromQuestion + 1 !== range.count) {
      violations.push(`شمارش بازهٔ ${range.sectionId} در ${booklet.year} با بازه نمی‌خواند`);
    }
    next = range.toQuestion + 1;
  }
}
if (rangeGapBooklets.length > 0) {
  notices.push(`جدول بازهٔ درس‌ها در ${rangeGapBooklets.length} دفترچه ناقص است: ${rangeGapBooklets.join('، ')}`);
}

for (const question of YEARLY_KONKOR_QUESTIONS) {
  if (idSeen.has(question.id)) violations.push(`شناسهٔ تکراری: ${question.id}`);
  idSeen.add(question.id);

  if (!question.text || question.text.trim().length < 5) violations.push(`متن خالی یا کوتاه: ${question.id}`);
  if (!Array.isArray(question.options) || question.options.length !== 4) {
    violations.push(`تعداد گزینه غیر از ۴: ${question.id}`);
  } else if (question.options.some((option) => !option || !option.trim())) {
    violations.push(`گزینهٔ خالی: ${question.id}`);
  } else if (new Set(question.options.map((option) => normalize(option))).size !== 4) {
    violations.push(`گزینهٔ تکراری: ${question.id}`);
  }

  const level = isDoctorateQuestion(question) ? 'دکتری' : 'ارشد';
  const number = question.bookletQuestionNumber;
  if (typeof number === 'number') {
    const tuple = `${question.examYear}|${level}|${number}`;
    if (numberSeen.has(tuple)) violations.push(`شمارهٔ تکراری در یک آزمون: ${tuple}`);
    numberSeen.add(tuple);

    const booklet = bookletByYear.get(question.examYear);
    if (level === 'ارشد' && booklet && (number < 1 || number > booklet.totalQuestionsInBooklet)) {
      violations.push(`شمارهٔ بیرون از بازهٔ دفترچهٔ ${question.examYear}: ${question.id} (#${number})`);
    }
  }

  const key = serverKeys.get(question.id);
  if (key === undefined) violations.push(`کلید سمت سرور ندارد: ${question.id}`);
  else if (!Number.isInteger(key) || key < 0 || key > 3) violations.push(`کلید نامعتبر (${key}): ${question.id}`);

  const stem = normalize(question.text ?? '');
  const previous = stemSeen.get(stem);
  if (previous) violations.push(`متن سؤال تکراری: ${previous} و ${question.id}`);
  else stemSeen.set(stem, question.id);
}

// مقایسهٔ کلید بانک با کلید رسمی بازیابی‌شده (فقط برای ارشد، چون شاهد رسمی موجود برای دکتری نیست)
let compared = 0;
let agreed = 0;
const acknowledged: string[] = [];
for (const question of YEARLY_KONKOR_QUESTIONS) {
  if (isDoctorateQuestion(question)) continue;
  const number = question.bookletQuestionNumber;
  if (typeof number !== 'number') continue;
  const evidenceYear = evidence.years[String(question.examYear)];
  const official = evidenceYear?.entries[String(number)];
  if (official === undefined) continue;
  const bankKey = serverKeys.get(question.id);
  if (bankKey === undefined) continue;

  compared += 1;
  const bankOption = bankKey + 1;
  if (bankOption === official) {
    agreed += 1;
    continue;
  }
  if (conflictIds.has(question.id)) acknowledged.push(`${question.id} (بانک ${bankOption} / رسمی ${official})`);
  else violations.push(`اختلاف ثبت‌نشده با کلید رسمی: ${question.id} بانک=${bankOption} رسمی=${official}`);
}

const unverified = conflicts.conflicts.filter((conflict) => conflict.verdict === 'needs_booklet_review');if (unverified.length > 0) {
  notices.push(`${unverified.length} اختلاف در انتظار مشاهدهٔ تصویر کلید رسمی است: ${unverified.map((c) => c.id).join('، ')}`);
}

// شمارش زبان دکتری با ساختار رسمی همان سال مقایسه می‌شود. مخرج رسمی در contracts است.
const doctorateEnglish = new Map<number, number>();
for (const question of YEARLY_KONKOR_QUESTIONS) {
  if (!isDoctorateQuestion(question) || question.courseSectionId !== 'english') continue;
  doctorateEnglish.set(question.examYear, (doctorateEnglish.get(question.examYear) ?? 0) + 1);
}
for (const [year, count] of [...doctorateEnglish].sort((a, b) => a[0] - b[0])) {
  const official = DOCTORATE_EXAM_YEAR_STRUCTURES[year]?.languageQuestionCount;
  if (typeof official !== 'number') continue;
  if (count > official) {
    notices.push(`زبان دکتری ${year}: ${count} سؤال در بانک، سقف رسمی ${official}`);
  }
}

const master = getArshadCoverage();
const doctorate = getDoctorateCoverage();
const missingYears = master.byYear.filter((row) => row.available === 0).map((row) => row.year);
if (missingYears.length > 0) violations.push(`سال بدون هیچ سؤال ارشد: ${missingYears.join('، ')}`);

console.log('== پوشش ارشد (۱۱۴۲) ==');
for (const row of master.byYear) {
  console.log(`  ${row.year}: ${row.available} از ${row.declared} (${row.percent}٪)`);
}
console.log(`  جمع: ${master.available} از ${master.declared} (${master.percent}٪) در ${master.bookletCount} دفترچه`);
console.log('== پوشش دکتری (۲۱۶۲) ==');
console.log(`  سؤال ثبت‌شده: ${doctorate.available} — دفترچهٔ رسمی ثبت‌شده: ${doctorate.bookletCount}`);
console.log('== کلید ==');
console.log(`  کلید سمت سرور: ${serverKeys.size} — سؤال بانک سالی: ${YEARLY_KONKOR_QUESTIONS.length}`);
console.log(`  مقایسه با کلید رسمی بازیابی‌شده: ${compared} سؤال، ${agreed} همخوان، ${acknowledged.length} اختلاف ثبت‌شده`);
for (const line of acknowledged) console.log(`    - ${line}`);

for (const notice of notices) console.log(`\n[هشدار] ${notice}`);

if (violations.length > 0) {
  console.error(`\n[خطا] ${violations.length} نقض:`);
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log('\nEXAM_BANK_AUDIT_PASS');
