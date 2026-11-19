/**
 * سنجش سالم‌بودن متن فارسی با تکیه بر واژگان موجود پروژه.
 *
 * متن OCR خطاهایی دارد که با نگاه انسانی فوراً دیده می‌شود ولی با قاعدهٔ ساده نه:
 * «ساختر» به‌جای «ساختار»، «تشبیت» به‌جای «تثبیت»، «شهریدی» به‌جای «شهودی». این
 * ماژول واژگان را از محتوای خود پروژه می‌سازد و نسبت واژه‌های ناشناس هر متن را
 * برمی‌گرداند؛ متن پرخطا با همین نسبت کنار گذاشته می‌شود.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const VOCAB_DIRS = ['src/data', 'docs', 'content', 'packages/contracts/src'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.ael-work', 'dist', 'dist-miniapp', 'apps']);

/** واژه‌های فارسی متن، بدون نیم‌فاصله و علائم. */
export function persianWords(text: string): string[] {
  return (text.replace(/\u200c/g, ' ').match(/[\u0600-\u06FF]{3,}/g) ?? []).map((word) =>
    word.replace(/[^\u0600-\u06FF]/g, ''),
  );
}

function collect(path: string, into: Set<string>): void {
  let entries: string[];
  try {
    entries = readdirSync(path);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(path, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      collect(full, into);
      continue;
    }
    if (!/\.(ts|tsx|md|json|jsonl|txt)$/.test(entry)) continue;
    if (stats.size > 2_000_000) continue;
    try {
      for (const word of persianWords(readFileSync(full, 'utf8'))) into.add(word);
    } catch {
      continue;
    }
  }
}

export interface Vocabulary {
  size: number;
  has: (word: string) => boolean;
  /** نسبت واژه‌های ناشناس به کل واژه‌ها. */
  unknownRatio: (text: string) => number;
}

/** واژگان را از محتوای پروژه می‌سازد؛ نتیجه برای همهٔ سؤال‌ها استفاده می‌شود. */
export function buildVocabulary(root: string): Vocabulary {
  const words = new Set<string>();
  for (const dir of VOCAB_DIRS) collect(join(root, dir), words);
  return {
    size: words.size,
    has: (word: string) => words.has(word),
    unknownRatio: (text: string) => {
      const list = persianWords(text);
      if (list.length === 0) return 0;
      const unknown = list.filter((word) => !words.has(word)).length;
      return unknown / list.length;
    },
  };
}
