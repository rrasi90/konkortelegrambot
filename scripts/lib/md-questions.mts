/**
 * استخراج سؤال از فایل‌های Markdown تبدیل‌شدهٔ دفترچه‌های کنکور (خروجی MinerU).
 *
 * شمارهٔ سؤال در OCR زیاد خطا می‌دهد (۲ و ۷، ۰ و ۵)، پس شماره‌گذاری قطعی نیست.
 * راه‌حل: سؤال‌ها داخل هر درس به ترتیب صفحه می‌آیند، پس شمارهٔ هر سؤال از رای
 * اکثریت اختلاف «شمارهٔ خوانده‌شده منهای ترتیب» به‌دست می‌آید و بعد ترتیبی
 * ادامه پیدا می‌کند. مرز درس‌ها هم از سرصفحهٔ صفحه‌ها خوانده می‌شود.
 */

export interface ParsedOption {
  index: number;
  text: string;
}

export interface ParsedQuestion {
  sectionId: string;
  /** شمارهٔ دفترچه. */
  number: number;
  text: string;
  options: ParsedOption[];
}

export interface SectionResult {
  sectionId: string;
  /** شمارهٔ اولین و آخرین سؤال درس. */
  from: number;
  to: number;
  questions: ParsedQuestion[];
  /** چند سؤال شمارهٔ OCR با شمارهٔ ترتیبی هم‌خوان نبود. */
  numberingConflicts: number;
}

const NEWLINE = String.fromCharCode(10);
const ORDER = [
  'english',
  'islamic',
  'math_stats',
  'management_theories',
  'economics',
  'public_finance',
  'human_resources',
  'operations_research',
  'financial_management',
  'production',
  'marketing',
  'investment_risk',
  'entrepreneurship',
  'accounting',
  'publishing',
  'transportation',
  'business_transportation',
];
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const toLatinDigits = (text: string): string =>
  text
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

/** صفحه‌های خام یک فایل Markdown دفترچه را جدا می‌کند. */
export function splitPages(raw: string): string[] {
  return raw.split(/## صفحه [0-9۰-۹]+ از [0-9۰-۹]+/);
}

/** عنوان درس‌ها پس از یکدست‌سازی حروف (همه با ی و ک فارسی). */
const SECTION_TITLES: { sectionId: string; patterns: RegExp[] }[] = [
  { sectionId: 'english', patterns: [/زبان\s*عمومی\s*و\s*تخصصی/, /\(انگلیسی\)/] },
  { sectionId: 'islamic', patterns: [/اصول\s*و\s*مبانی\s*مدیریت\s*از\s*دیدگاه\s*اسلام/] },
  { sectionId: 'math_stats', patterns: [/ریاضی\s*و\s*آمار/] },
  { sectionId: 'management_theories', patterns: [/تئوری\s*های\s*مدیریت/] },
  { sectionId: 'economics', patterns: [/اقتصاد\s*خرد\s*و\s*کلان/] },
  { sectionId: 'public_finance', patterns: [/مالیه\s*عمومی\s*و\s*بودجه/] },
  { sectionId: 'human_resources', patterns: [/مدیریت\s*منابع\s*انسانی/] },
  { sectionId: 'operations_research', patterns: [/تحقیق\s*در\s*عملیات/] },
  { sectionId: 'financial_management', patterns: [/مدیریت\s*مالی(?!\s*و)/] },
  { sectionId: 'production', patterns: [/مدیریت\s*تولید/] },
  { sectionId: 'marketing', patterns: [/بازاریابی/] },
  { sectionId: 'investment_risk', patterns: [/مدیریت\s*سرمایه\s*گذاری\s*و\s*ریسک/] },
  { sectionId: 'entrepreneurship', patterns: [/مبانی\s*کارآفرینی/] },
  { sectionId: 'accounting', patterns: [/حسابداری\s*مالی\s*و\s*صنعتی/] },
  // فقط دفترچهٔ ۱۳۹۶؛ OCR این عنوان را «عماتی/عباني/میانی نشر» هم می‌خواند.
  { sectionId: 'publishing', patterns: [/اصول\s*و\s*\S+\s*نشر/] },
  { sectionId: 'transportation', patterns: [/دانش\s*حمل\s*و\s*نقل/] },
  { sectionId: 'business_transportation', patterns: [/دانش\s*مدیریت\s*بازرگانی/] },
];

/** خط‌هایی که سرصفحه یا پانویس صفحه‌اند و متن سؤال نیستند. */
const NOISE_PATTERNS: RegExp[] = [
  /^\s*$/,
  /www\.konkur\.in/i,
  /^Telegram\s*:/i,
  /^صفحه\s*\d+/,
  /^\d+\s*صفحه/,
  /^\[?تصویر/,
  /^\s*\d{2,4}[A-Z]\s*$/,
  /آزمون\s*مجموعه\s*مد[یي]ریت/,
  /^\s*\|?\s*$/,
];

const OPTION_LABEL = /(?:^|[\s،؛:(])(?:\()?\s*([1-4۱-۴])\s*(?:\)|[-–])\s*/g;

/** متن یک جدول را به رشتهٔ خوانا تبدیل می‌کند. */
function tableToText(raw: string): string {
  const cells = [...raw.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, ' ').trim())
    .filter((cell) => cell.length > 0);
  return cells.join(' | ');
}

/** پاک‌سازی یک صفحه: حذف سرصفحه/پانویس، تبدیل جدول و یکدست‌کردن فاصله‌ها. */
export function cleanPage(raw: string): string {
  let text = raw.replace(/<table>([\s\S]*?)<\/table>/g, (_all, inner: string) => ` ${tableToText(inner)} `);
  text = text.replace(/<eq>/g, ' ').replace(/<\/eq>/g, ' ');
  text = text.replace(/\$\$?([\s\S]*?)\$\$?/g, (_all, formula: string) => ` ${formula.trim()} `);
  text = text.replace(/[*#`>]+/g, ' ');
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => !NOISE_PATTERNS.some((pattern) => pattern.test(line)));
  return lines.join(NEWLINE);
}

/** یکدست‌سازی حروف عربی و رفع شکاف‌های رایج OCR در عنوان درس‌ها. */
export function normalizeFa(text: string): string {
  return toLatinDigits(text)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ى/g, 'ی')
    .replace(/ة/g, 'ه')
    .replace(/مد\s*بریت|مدپریت|مدریت|مد بریت/g, 'مدیریت')
    .replace(/‌/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * درسِ یک خط: عنوان درس‌ها در دفترچه به‌صورت یک خط کوتاه و معمولاً با دو نقطه
 * می‌آید. خط‌های بلند یا پرسشی عنوان نیستند.
 */
export function sectionOfLine(line: string): string | null {
  const value = normalizeFa(line);
  if (value.length < 5 || value.length > 60) return null;
  if (/[؟?]/.test(value)) return null;
  for (const entry of SECTION_TITLES) {
    if (entry.patterns.some((pattern) => pattern.test(value))) return entry.sectionId;
  }
  return null;
}

interface LabelHit {
  index: number;
  label: number;
  end: number;
}

function optionLabels(text: string): LabelHit[] {
  const hits: LabelHit[] = [];
  OPTION_LABEL.lastIndex = 0;
  for (const match of text.matchAll(OPTION_LABEL)) {
    const label = Number(toLatinDigits(match[1]));
    if (label < 1 || label > 4) continue;
    hits.push({ index: match.index ?? 0, label, end: (match.index ?? 0) + match[0].length });
  }
  return hits;
}

export interface OptionGroup {
  stemStart: number;
  stemEnd: number;
  options: { index: number; text: string }[];
}

function lineEndAt(text: string, from: number): number {
  const index = text.indexOf(NEWLINE, from);
  return index < 0 ? text.length : index;
}

/**
 * گروه‌های چهارگزینه‌ای را به ترتیب متن پیدا می‌کند. گزینهٔ چهارم معمولاً تا
 * انتهای خط است، پس با اولین خط‌شکن بریده می‌شود تا صورت سؤال بعدی داخلش نیفتد.
 */
export function optionGroups(text: string): OptionGroup[] {
  const hits = optionLabels(text);
  const groups: OptionGroup[] = [];
  let cursor = 0;
  let stemStart = 0;
  while (cursor + 3 < hits.length) {
    const window = hits.slice(cursor, cursor + 4);
    const labels = window.map((hit) => hit.label).sort((a, b) => a - b);
    if (labels.join(',') !== '1,2,3,4') {
      cursor += 1;
      continue;
    }
    const options = window.map((hit, order) => {
      const next = window[order + 1];
      const stop = order === 3 ? lineEndAt(text, hit.end) : next.index;
      return { index: hit.label, text: text.slice(hit.end, stop).trim() };
    });
    groups.push({ stemStart, stemEnd: window[0].index, options });
    const lastText = options[3].text;
    stemStart = window[3].end + Math.min(lastText.length, lineEndAt(text, window[3].end) - window[3].end);
    cursor += 4;
  }
  return groups;
}

/** متن سالم برای صورت سؤال یا گزینه. */
export function isSaneText(text: string, kind: 'stem' | 'option'): boolean {
  const value = text.replace(/\s+/g, ' ').trim();
  if (kind === 'stem') {
    if (value.length < 15 || value.length > 700) return false;
    const persian = (value.match(/[\u0600-\u06FF]/g) ?? []).length;
    if (persian < 10) return false;
    return true;
  }
  if (value.length < 1 || value.length > 240) return false;
  if (/www\.|Telegram|konkur\.in/i.test(value)) return false;
  const persian = (value.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (value.match(/[A-Za-z]/g) ?? []).length;
  const digits = (value.match(/[\d۰-۹]/g) ?? []).length;
  if (persian === 0 && latin > 0 && digits === 0) return false;
  if (persian === 0 && latin >= 2 && digits === 0) return false;
  // گزینهٔ لاتین تمام‌حرفی نشانهٔ خطای OCR در ارقام فارسی است.
  if (persian === 0 && /^[A-Za-z,.\/]+$/.test(value) && latin >= 2) return false;
  return true;
}

/** شمارهٔ سؤال از ابتدا یا انتهای صورت سؤال. */
export function stemNumber(stem: string): number | null {
  const cleaned = stem.replace(/\s+/g, ' ').trim();
  const head = cleaned.slice(0, 12).match(/^[-–]?\s*([۰-۹\d]{1,3})\s*[-–.]?/);
  if (head) {
    const value = Number(toLatinDigits(head[1]));
    if (value >= 1 && value <= 400) return value;
  }
  const tail = cleaned.slice(-12).match(/([۰-۹\d]{1,3})\s*[-–]?\s*$/);
  if (tail) {
    const value = Number(toLatinDigits(tail[1]));
    if (value >= 1 && value <= 400) return value;
  }
  return null;
}

/** متن هر درس را با پیمایش خط‌به‌خط صفحه‌های پاک‌شده جمع می‌کند. */
export function sectionTexts(pages: string[]): { sectionId: string; text: string }[] {
  const blocks: { sectionId: string; text: string }[] = [];
  let current: string | null = null;
  let order = -1;
  for (const page of pages) {
    for (const line of page.split(NEWLINE)) {
      const section = sectionOfLine(line);
      if (section) {
        const position = ORDER.indexOf(section);
        if (position > order) {
          order = position;
          current = section;
          blocks.push({ sectionId: section, text: '' });
          continue;
        }
      }
      if (!current) continue;
      blocks[blocks.length - 1].text += `${line}${NEWLINE}`;
    }
  }
  return blocks.filter((block) => block.text.trim().length > 0);
}

/**
 * شماره‌گذاری با تکیه بر شمارهٔ OCR: اگر شمارهٔ خوانده‌شده نزدیک به انتظار باشد
 * همان پذیرفته می‌شود تا سؤال‌های جاافتاده شماره‌های بعدی را جابه‌جا نکنند.
 */
export function extractSectionQuestions(pages: string[], declaredTotal: number): SectionResult[] {
  const grouped = new Map<string, { question: Omit<ParsedQuestion, 'number'>; vote: number | null }[]>();
  const order: string[] = [];

  for (const block of sectionTexts(pages)) {
    const list = grouped.get(block.sectionId) ?? [];
    if (!grouped.has(block.sectionId)) order.push(block.sectionId);
    for (const group of optionGroups(block.text)) {
      const stem = block.text.slice(group.stemStart, group.stemEnd).trim();
      if (!isSaneText(stem, 'stem')) continue;
      const options = group.options
        .map((option) => ({ index: option.index, text: option.text.replace(/\s+/g, ' ').trim() }))
        .sort((a, b) => a.index - b.index);
      if (!options.every((option) => isSaneText(option.text, 'option'))) continue;
      if (new Set(options.map((option) => option.text)).size !== 4) continue;
      list.push({ question: { sectionId: block.sectionId, text: stem, options }, vote: stemNumber(stem) });
    }
    grouped.set(block.sectionId, list);
  }

  const results: SectionResult[] = [];
  for (const sectionId of order) {
    const list = grouped.get(sectionId) ?? [];
    if (list.length === 0) continue;
    const questions: ParsedQuestion[] = [];
    let conflicts = 0;
    let expected = 1;
    for (const entry of list) {
      const vote = entry.vote;
      let number = expected;
      if (vote !== null && vote >= 1 && vote <= declaredTotal && Math.abs(vote - expected) <= 2) {
        number = vote;
      } else if (questions.length === 0 && vote !== null && vote >= 1 && vote <= declaredTotal) {
        number = vote;
      } else if (vote !== null && vote !== number) {
        conflicts += 1;
      }
      if (number < expected) number = expected;
      questions.push({ ...entry.question, number });
      expected = number + 1;
    }
    results.push({
      sectionId,
      from: questions[0].number,
      to: questions[questions.length - 1].number,
      questions,
      numberingConflicts: conflicts,
    });
  }
  return results;
}
