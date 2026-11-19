/**
 * استخراج سؤال از متن دفترچه با شماره‌گذاری قابل اثبات.
 *
 * قاعدهٔ اصلی: کلید هر سؤال از `answers-by-year.json` با شماره خوانده می‌شود. پس
 * شمارهٔ اشتباه یعنی کلید اشتباه. هیچ سؤالی با شمارهٔ حدسی وارد نمی‌شود.
 *
 * ساختار دفترچه: هر سؤال در یک خط با شمارهٔ خودش آغاز می‌شود و گزینه‌ها در خطوط
 * بعدی با برچسب ۱ تا ۴ می‌آیند. پس تکیه‌گاه استخراج، خطِ شماره‌دار است، نه
 * سرصفحهٔ درس؛ چون OCR عنوان درس‌ها را زیاد خراب می‌کند.
 *
 * هر سؤال با برنامه‌ریزی پویا به یک شمارهٔ دفترچه نسبت داده می‌شود. اگر یک سؤال
 * در OCR گم شود، جای خالی در هم‌ترازی می‌ماند و شمارهٔ بقیه جابه‌جا نمی‌شود.
 */
export interface BookletRange {
  sectionId: string;
  from: number;
  to: number;
  title: string;
}

export interface SequentialQuestion {
  number: number;
  sectionId: string;
  stem: string;
  options: string[];
  /** شاهد شماره: `number` یعنی شمارهٔ خوانده‌شده با هم‌ترازی می‌خواند. */
  numberSource: 'count' | 'number';
}

export interface SequentialRejection {
  number: number | null;
  sectionId: string | null;
  reason: string;
  sample: string;
}

export interface SequentialResult {
  questions: SequentialQuestion[];
  rejections: SequentialRejection[];
  stats: {
    lines: number;
    groups: number;
    headers: number;
    sectionsComplete: number;
    sectionsIncomplete: number;
  };
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function latinDigits(text: string): string {
  return text
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

export function normalizeFa(text: string): string {
  return latinDigits(text)
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/\u200c/g, ' ')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** متن داخل `\text{...}` همان صورت سؤال است؛ دستورهای چیدمان حذف می‌شوند. */
export function unwrapLatex(text: string): string {
  let value = text;
  for (let pass = 0; pass < 6; pass += 1) {
    const next = value.replace(/\\(?:text|mathrm|textbf|textit|textrm|mathbf)\s*\{([^{}]*)\}/g, ' $1 ');
    if (next === value) break;
    value = next;
  }
  return value
    .replace(/\\(?:begin|end)\s*\{[^{}]*\}(?:\s*\{[^{}]*\})?/g, ' ')
    .replace(/\\(?:left|right|,|;|!|quad|qquad)/g, ' ')
    .replace(/\\\\/g, ' ')
    .replace(/&/g, ' ')
    .replace(/\$/g, ' ')
    .replace(/~/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISE: RegExp[] = [
  /^\s*$/,
  /^\s*[V∧Λv]\s*$/,
  /مجموعه\s*مد\S*\s*\(?(?:کد)?\s*1?1?42\)?/,
  /^\s*\(?\s*1142\s*\)?/,
  /^\s*صفحه\s*[0-9۰-۹]*\s*$/,
  /^\s*[0-9۰-۹]{1,3}\s*صفحه\s*$/,
  /www\.|Telegram\s*:|konkur\.in/i,
  /^\s*\[?تصویر/,
  /^\s*[0-9۰-۹]{2,4}\s*[A-Z]\s*$/,
  /^\s*PART\s+[A-D]/i,
  /^\s*Directions?\s*:/i,
  /^\s*PASSAGE\s*\d*\s*:?\s*$/i,
  /حق\s*(?:طبع|تکثیر)/,
  /^\s*مشاوره\s*-/,
  /عدم\s*درج\s*مشخصات/,
  /^\s*ردیف\s+مواد/,
  // ردیف‌های جدول پاسخ‌نامه: «۷۱ (2)» تکیه‌گاهی جعلی می‌سازد و بلوک سؤال را می‌شکند.
  /^\s*[0-9]{1,3}\s*\(\s*[1-4]\s*\)\s*$/,
  /^\s*[0-9]{1,3}\s*[.\-–]?\s*[1-4]\s*$/,
];

const isNoise = (line: string): boolean => NOISE.some((pattern) => pattern.test(line));

/**
 * خطی که با شمارهٔ سؤال آغاز می‌شود. در دفترچه‌ها شماره یا با خط تیره/پرانتز
 * می‌آید یا با فاصله؛ رقم لاتین و فارسی هر دو دیده می‌شود.
 */
const ANCHOR = /^\s*([0-9]{1,3})\s*(?:[-–).]\s*|\s)\S/;

/** همان برچسب، هر جای متن؛ چون در درس زبان چهار گزینه در یک خط می‌آیند. */
const LABEL_INLINE = /(?:^|[\s،؛:(])(?:\()?\s*([1-4])\s*(?:\)|[-–]|\.(?=\s))\s*(?=\S)/g;

export /**
 * چیدمان دوم: در درس ریاضی، برچسب گزینه در خط جدا و *بعد* از مقدار می‌آید
 * (`$2x+\sqrt{...}$` سپس `(1)`). اینجا مقدار از خط‌های پیش از برچسب خوانده می‌شود.
 */
function parseTrailingLabels(lines: string[]): { stem: string; options: string[] } | null {
  const markers: { label: number; at: number }[] = [];
  const seen = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*\(\s*([1-4])\s*\)\s*$/);
    if (!match) continue;
    const label = Number(match[1]);
    if (seen.has(label)) break;
    seen.add(label);
    markers.push({ label, at: index });
    if (markers.length === 4) break;
  }
  if (markers.length < 4) return null;

  const options = new Map<number, string>();
  for (let position = 0; position < markers.length; position += 1) {
    const from = (position === 0 ? 0 : markers[position - 1].at) + 1;
    const value = lines
      .slice(from, markers[position].at)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    options.set(markers[position].label, value);
  }
  const resolved = [1, 2, 3, 4].map((label) => options.get(label) ?? '');
  if (resolved.some((option) => option.length === 0)) return null;

  return { stem: lines[0] ?? '', options: resolved };
}

/** شمارش گزینه‌های دیده‌شده، برای یافتن مرز بلوک. */
function seenLabels(text: string): number {
  const found = new Set<number>();
  for (const match of text.matchAll(LABEL_INLINE)) {
    const label = Number(match[1]);
    if (found.has(label)) break;
    found.add(label);
  }
  if (found.size < 4) {
    for (const match of text.matchAll(/\(\s*([1-4])\s*\)/g)) {
      const label = Number(match[1]);
      if (found.has(label)) break;
      found.add(label);
      if (found.size === 4) break;
    }
  }
  return found.size;
}

interface Draft {
  number: number;
  stem: string;
  options: string[];
  sample: string;
}

/**
 * گزینه‌ها را از متن یک بلوک می‌کشد.
 *
 * ترتیب چاپ گزینه‌ها در دفترچه‌های فارسی راست‌به‌چپ است (۲، ۴، ۱، ۳)، پس گزینه‌ها
 * به ترتیب ظاهر مرتب نمی‌شوند؛ هر گزینه با برچسب خودش شناخته می‌شود. اگر برچسبی
 * تکرار شود، مرز یک سؤال تازه است و خواندن متوقف می‌شود.
 */
function parseBlock(text: string): { stem: string; options: string[] } {  const matches = [...text.matchAll(LABEL_INLINE)];
  const starts: { label: number; index: number; end: number }[] = [];
  const seen = new Set<number>();
  for (const match of matches) {
    const label = Number(match[1]);
    if (seen.has(label)) break;
    seen.add(label);
    starts.push({ label, index: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
    if (starts.length === 4) break;
  }

  const first = starts[0];
  const stem = (first ? text.slice(0, first.index) : text).replace(/\s+/g, ' ').trim();
  const options = new Map<number, string>();
  for (let position = 0; position < starts.length; position += 1) {
    const stop = position + 1 < starts.length ? starts[position + 1].index : text.length;
    const value = text.slice(starts[position].end, stop).replace(/\s+/g, ' ').trim();
    options.set(starts[position].label, value);
  }
  return { stem, options: [1, 2, 3, 4].map((label) => options.get(label) ?? '') };
}

/**
 * دفترچه را به بلوک‌های سؤال می‌شکند.
 *
 * برچسب گزینه (۱ تا ۴) هم‌شکل شمارهٔ سؤال است، پس تنها با الگوی خط نمی‌شود
 * تشخیص داد. قاعده: پس از شمارهٔ سؤال، تا چهار گزینهٔ برچسب‌دار خوانده می‌شود؛
 * اولین خط شماره‌داری که بعد از آن بیاید سؤال بعدی است. خط شماره‌داری که شماره‌اش
 * از ۴ بزرگ‌تر باشد هم سؤال تازه است، چون گزینه‌ها فقط ۱ تا ۴ هستند.
 */
export function splitQuestions(lines: string[], total: number): Draft[] {
  const drafts: Draft[] = [];
  let index = 0;
  while (index < lines.length) {
    const head = lines[index].match(ANCHOR);
    const number = head ? Number(head[1]) : Number.NaN;
    if (!head || !Number.isFinite(number) || number < 1 || number > total + 5) {
      index += 1;
      continue;
    }

    const startLine = index;
    const block: string[] = [lines[startLine].replace(ANCHOR, '').trim()];
    index += 1;
    while (index < lines.length) {
      // تا چهار گزینهٔ برچسب‌دار خوانده نشود، خطوط ادامهٔ همین سؤال‌اند.
      if (seenLabels(block.join(' ')) >= 4) break;
      const next = lines[index].match(ANCHOR);
      if (next && Number(next[1]) > 4) break;
      block.push(lines[index]);
      index += 1;
    }

    const parsed = parseBlock(block.join(' '));
    const resolved = parsed.options.some((option) => option.length === 0)
      ? (parseTrailingLabels(block) ?? parsed)
      : parsed;
    drafts.push({
      number,
      stem: resolved.stem,
      options: resolved.options,
      sample: lines[startLine].slice(0, 90),
    });
  }
  return drafts;
}

export function prepareLines(pages: string[]): string[] {
  const lines: string[] = [];
  for (const page of pages) {
    for (const rawLine of page.split(String.fromCharCode(10))) {
      const unwrapped = unwrapLatex(normalizeFa(rawLine));
      if (!unwrapped || isNoise(unwrapped)) continue;
      lines.push(unwrapped);
    }
  }
  return lines;
}

export function extractByNumber(
  pages: string[],
  booklet: { total: number; ranges: BookletRange[] },
): SequentialResult {
  const lines: string[] = [];
  for (const page of pages) {
    for (const rawLine of page.split('\n')) {
      const unwrapped = unwrapLatex(normalizeFa(rawLine));
      if (!unwrapped || isNoise(unwrapped)) continue;
      lines.push(unwrapped);
    }
  }

  const total = booklet.total;
  const drafts = splitQuestions(lines, total);

  // ۱. هم‌ترازی سؤال‌ها با شماره‌های دفترچه.
  //
  // شمارش ساده کافی نیست: هر سؤالِ گم‌شده همهٔ شماره‌های بعدی را جابه‌جا می‌کند و
  // کلید را خراب می‌کند. این‌جا تطبیق دقیق هزینهٔ صفر دارد، شمارهٔ جاافتاده با
  // هزینهٔ کم رد می‌شود و بلوک بی‌ربط حذف می‌شود.
  const width = total + 1;
  const cost = new Float64Array((drafts.length + 1) * width).fill(Number.POSITIVE_INFINITY);
  const from = new Int8Array((drafts.length + 1) * width).fill(-1);
  cost[0] = 0;
  const matchCost = (read: number, number: number): number => {
    if (read === number) return 0;
    if (Math.abs(read - number) === 1) return 1.1;
    return 3;
  };

  for (let item = 0; item <= drafts.length; item += 1) {
    for (let number = 0; number <= total; number += 1) {
      const base = cost[item * width + number];
      if (!Number.isFinite(base)) continue;
      if (item < drafts.length && number < total) {
        const next = base + matchCost(drafts[item].number, number + 1);
        const target = (item + 1) * width + (number + 1);
        if (next < cost[target]) {
          cost[target] = next;
          from[target] = 0;
        }
      }
      if (number < total) {
        const target = item * width + (number + 1);
        if (base + 1 < cost[target]) {
          cost[target] = base + 1;
          from[target] = 1;
        }
      }
      if (item < drafts.length) {
        const target = (item + 1) * width + number;
        if (base + 1.5 < cost[target]) {
          cost[target] = base + 1.5;
          from[target] = 2;
        }
      }
    }
  }

  const pairs: { draft: Draft; number: number }[] = [];
  let cursorItem = drafts.length;
  let cursorNumber = total;
  while (cursorItem > 0 || cursorNumber > 0) {
    const step = from[cursorItem * width + cursorNumber];
    if (step === 0) {
      pairs.push({ draft: drafts[cursorItem - 1], number: cursorNumber });
      cursorItem -= 1;
      cursorNumber -= 1;
    } else if (step === 1) {
      cursorNumber -= 1;
    } else if (step === 2) {
      cursorItem -= 1;
    } else {
      break;
    }
  }
  pairs.reverse();

  // ۲. دروازهٔ ساخت.
  const questions: SequentialQuestion[] = [];
  const rejections: SequentialRejection[] = [];
  for (const { draft, number } of pairs) {
    const range = booklet.ranges.find((item) => number >= item.from && number <= item.to);
    if (!range) continue;
    const usable = draft.options.every((option) => option.length > 0);
    const unique = new Set(draft.options).size === 4;
    if (!usable || !unique) {
      rejections.push({
        number,
        sectionId: range.sectionId,
        reason: !usable ? 'گزینه‌های کامل نیست' : 'گزینهٔ تکراری',
        sample: draft.sample,
      });
      continue;
    }
    if (draft.stem.length < 12) {
      rejections.push({
        number,
        sectionId: range.sectionId,
        reason: 'صورت سؤال خیلی کوتاه است',
        sample: draft.sample,
      });
      continue;
    }
    questions.push({
      number,
      sectionId: range.sectionId,
      stem: draft.stem,
      options: draft.options,
      numberSource: 'number',
    });
  }

  const counts = new Map<string, number>();
  for (const question of questions) {
    counts.set(question.sectionId, (counts.get(question.sectionId) ?? 0) + 1);
  }
  let sectionsComplete = 0;
  let sectionsIncomplete = 0;
  for (const range of booklet.ranges) {
    if ((counts.get(range.sectionId) ?? 0) === range.to - range.from + 1) sectionsComplete += 1;
    else sectionsIncomplete += 1;
  }

  return {
    questions: questions.sort((a, b) => a.number - b.number),
    rejections,
    stats: {
      lines: lines.length,
      groups: drafts.length,
      headers: 0,
      sectionsComplete,
      sectionsIncomplete,
    },
  };
}
