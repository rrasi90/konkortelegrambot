/**
 * دروازهٔ استنتاج کلید — بررسی‌های مکانیکی که برنامهٔ پوشش §۴.۲ می‌خواهد.
 *
 * هیچ استدلال زبانی اینجا انجام نمی‌شود؛ این فایل فقط می‌تواند بگوید:
 *  ۱) متن و گزینه‌ها ساختاراً سالم‌اند؛
 *  ۲) در سؤالات عددی، گزینهٔ برنده با فاصلهٔ معنادار از بقیه جداست؛
 *  ۳) نقلِ شاهد D2 واقعاً داخل مخزن پیدا می‌شود (بی‌سند، دانش بیرونی ممنوع)؛
 *  ۴) موافقت/تعارض با کلید رسمی از answers-by-year.json خوانده می‌شود.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** نرمال‌سازی برای مقابلهٔ متن: نیم‌فاصله و فاصله یکسان، ارقام فارسی/عربی → لاتین. */
export function normalizeText(value: string): string {
  return value
    .replace(/[\u200c\s\u202f\u00a0]+/g, ' ')
    .replace(/[۰-۹٠-٩]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(digit) % 10))
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/٫/g, '.')
    .replace(/،/g, ',')
    .trim();
}

/** همهٔ اعداد یک متن، به‌شکل رشتهٔ عددیِ قابل Number(). */
export function numbersIn(text: string): number[] {
  const cleaned = normalizeText(text)
    .replace(/\\%/g, '%')
    .replace(/,(?=\d{3})/g, '')
    .replace(/(\d)\u066A/g, '$1%');
  const hits = cleaned.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return hits.map((hit) => Number(hit)).filter((hit) => Number.isFinite(hit));
}

export const hasPercent = (text: string): boolean => /[٪%]/.test(normalizeText(text));

/**
 * شرط ۲ برنامه: سرریز ندارد.
 * اگر دست‌کم سه گزینه عدد دارند: برنده باید از هر رقیب عددی
 * در حالت درصدی ≥ ۵ واحد درصدی و در حالت عادی ≥ ۲٪ نسبی فاصله داشته باشد.
 */
export function numericMarginOk(
  options: string[],
  winnerOneBased: number,
): { ok: boolean; mode: 'numeric' | 'nonnumeric' | 'sparse'; detail: string } {
  const perOption = options.map((option) => numbersIn(option));
  const numericCount = perOption.filter((nums) => nums.length > 0).length;
  if (numericCount < 3) return { ok: true, mode: numericCount === 0 ? 'nonnumeric' : 'sparse', detail: 'گزینه‌ها صرفاً عددی نیستند' };
  const percentMode = options.some((option) => hasPercent(option));
  const winnerIndex = winnerOneBased - 1;
  const winnerValues = perOption[winnerIndex];
  if (winnerValues.length === 0) return { ok: false, mode: 'numeric', detail: 'گزینهٔ برنده عدد ندارد' };
  const winner = winnerValues[0];
  for (let index = 0; index < perOption.length; index += 1) {
    if (index === winnerIndex) continue;
    for (const rival of perOption[index]) {
      if (percentMode) {
        if (Math.abs(rival - winner) < 5) {
          return { ok: false, mode: 'numeric', detail: `اختلاف درصدی کمتر از ۵ واحد: گزینهٔ ${index + 1}=${rival}` };
        }
      } else {
        const scale = Math.max(Math.abs(winner), Math.abs(rival), 1);
        if (Math.abs(rival - winner) / scale < 0.02) {
          return { ok: false, mode: 'numeric', detail: `اختلاف عددی کمتر از ۲٪: گزینهٔ ${index + 1}=${rival}` };
        }
      }
    }
  }
  return { ok: true, mode: 'numeric', detail: 'برنده با فاصلهٔ معنادار جداست' };
}

/* ---- مخزن نقلِ داخل پروژه (شرط ۴: شاهد فقط از داخل مخزن) ---- */

let corpusCache: string | null = null;

async function loadModuleStrings(relPath: string, sink: string[]): Promise<void> {
  const abs = join(root, relPath);
  const mod = (await import(pathToFileURL(abs).href)) as Record<string, unknown>;
  const seen = new Set<unknown>();
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    for (const item of Object.values(value as Record<string, unknown>)) {
      if (typeof item === 'string') sink.push(normalizeText(item));
      else walk(item);
    }
  };
  for (const value of Object.values(mod)) {
    if (typeof value === 'string') sink.push(normalizeText(value));
    else walk(value);
  }
}

/** رشتهٔ بزرگ نرمال‌شده از همهٔ محتوای ارجاعی داخل مخزن. */
export async function citationCorpus(): Promise<string> {
  if (corpusCache === null) {
    const parts: string[] = [];
    const sources = [
      'src/data/bookChaptersBusiness.ts',
      'src/data/bookChaptersIndustrialTech.ts',
      'src/data/referenceBooksRepo.ts',
      'src/data/flashcards.ts',
      'src/data/flashcards-expansion.ts',
      'src/data/flashcardDeck.ts',
      'src/data/flashcardRewrites.ts',
      'src/data/flashcardsAnkiImport.ts',
      'src/data/chapterFlashcards.ts',
      'src/data/konkorData.ts',
    ];
    for (const rel of sources) {
      try {
        await loadModuleStrings(rel, parts);
      } catch {
        /* فایل اختیاری است */
      }
    }
    const { readdirSync } = await import('node:fs');
    // فصول کتاب‌های ثبت‌شده در مخزن (۴۶ فایل md) — همان متنی که دادهٔ src/data از آن‌ها مشتق شده.
    const walkBooks = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkBooks(full);
        else if (entry.name.endsWith('.md')) {
          try {
            parts.push(normalizeText(readFileSync(full, 'utf8')));
          } catch {
            /* فایل خواندنی نیست */
          }
        }
      }
    };
    const booksDir = join(root, 'content', 'markdown', 'books');
    try {
      walkBooks(booksDir);
    } catch {
      /* دایرکتوری کتاب موجود نیست */
    }
    // دایرةالمعارف تألیفی خود پروژه (course.100p.*) — قابل‌استناد برای تعریف، نه برای کلید؛
    // نقلِ شامل نشانگر «سؤال» در ادامه رد می‌شود تا متن پرسشِ کلیددار مدارک نشود.
    for (const name of ['konkor-100p-centralized-compendium.md']) {
      try {
        parts.push(normalizeText(readFileSync(join(root, 'public', 'assets', name), 'utf8')));
      } catch {
        /* موجود نیست */
      }
    }
    const learningDir = join(root, 'content', 'learning-courses');
    for (const name of readdirSync(learningDir)) {
      if (!name.endsWith('.json')) continue;
      const raw = readFileSync(join(learningDir, name), 'utf8');
      for (const match of raw.matchAll(/"([^"\\]{20,})"/g)) parts.push(normalizeText(match[1]));
    }
    corpusCache = parts.join('\n\u0001\n');
  }
  return corpusCache;
}

/** نقل باید دست‌کم ۱۲ نویسهٔ نرمال‌شده باشد و عیناً در مخزن پیدا شود. */
export async function citationFoundInRepo(citation: string): Promise<boolean> {
  const needle = normalizeText(citation);
  if (needle.length < 12) return false;
  // نقل از بلوک سؤال/پاسخ ممنوع: دایرةالمعارف برای تعریف است، نه مدارک کلید.
  if (/سوال\s*\d|\bsq\b/.test(needle)) return false;
  const corpus = await citationCorpus();
  return corpus.includes(needle);
}

/* ---- کلید رسمی ---- */

export interface OfficialKeyEvidence {
  keyStatus: 'preliminary' | 'final' | 'unknown';
  entries: Record<string, number>;
}

export function loadOfficialEvidence(): Record<string, OfficialKeyEvidence> {
  const file = JSON.parse(
    readFileSync(join(root, 'content', 'exam-key-evidence', 'answers-by-year.json'), 'utf8'),
  ) as { years: Record<string, OfficialKeyEvidence> };
  return file.years;
}

/** بررسی ساختاری رکورد استنتاج (شرط‌های ۱ و ۵ و شکل داده). */
export function sanityCheckQuestion(q: { stem: string; options: string[] }): string[] {
  const problems: string[] = [];
  const stem = normalizeText(q.stem);
  if (stem.length < 12) problems.push('صورت سؤال خیلی کوتاه است');
  if ((stem.match(/[\u0601-\u06EF]/g) ?? []).length < 6) problems.push('صورت سؤال فارسی کافی ندارد');
  if (!/[.؟!»)\]:،…]$/.test(stem)) problems.push('صورت سؤال با نشانهٔ پایان بسته نشده');
  if (q.options.length !== 4) problems.push('چهار گزینه ندارد');
  else {
    if (q.options.some((option) => normalizeText(option).length === 0)) problems.push('گزینهٔ خالی');
    if (new Set(q.options.map(normalizeText)).size !== q.options.length) problems.push('گزینهٔ تکراری');
  }
  return problems;
}
