/**
 * خواندن متن `.docx` بدون ابزار بیرونی، برای مقابلهٔ دو‌منبعی سؤال‌های واردشده.
 *
 * فایل `.docx` یک ZIP است؛ `word/document.xml` کافی است. این ماژول همان کاری را
 * می‌کند که `unzip -p` می‌کرد، ولی با `zlib` خود Node تا در هر محیطی (از جمله
 * ویندوز و CI) بدون وابستگی اجرا شود.
 */
import { existsSync, readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/** متن خام `word/document.xml` از یک فایل `.docx`؛ اگر خواندن شکست خورد `null`. */
export function docxText(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    const zip = readFileSync(path);
    const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) return null;

    const centralSize = zip.readUInt32LE(eocd + 12);
    const centralOffset = zip.readUInt32LE(eocd + 16);
    let cursor = centralOffset;
    while (cursor < centralOffset + centralSize) {
      if (zip.readUInt32LE(cursor) !== 0x02014b50) break;

      const method = zip.readUInt16LE(cursor + 10);
      const compressedSize = zip.readUInt32LE(cursor + 20);
      const nameLength = zip.readUInt16LE(cursor + 28);
      const extraLength = zip.readUInt16LE(cursor + 30);
      const commentLength = zip.readUInt16LE(cursor + 32);
      const localOffset = zip.readUInt32LE(cursor + 42);
      const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');

      if (name === 'word/document.xml') {
        const localNameLength = zip.readUInt16LE(localOffset + 26);
        const localExtraLength = zip.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const raw = zip.subarray(dataStart, dataStart + compressedSize);
        const xml = (method === 0 ? raw : inflateRawSync(raw)).toString('utf8');
        return xml
          .replace(/<w:p[ >]/g, '\n<w:p ')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
      }

      cursor += 46 + nameLength + extraLength + commentLength;
    }
  } catch {
    return null;
  }
  return null;
}

/** نرمال‌سازی برای مقابلهٔ متنی: فقط حروف و ارقام لاتین. */
export const latinKey = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * آیا منبع دوم مستقل همین سؤال را تأیید می‌کند؟
 * شرط: حداقل سه واژهٔ کلیدی صورت سؤال و حداقل سه گزینه از چهار گزینه در منبع دوم.
 */
export function corroborates(
  item: { text: string; options: string[] },
  haystack: string | null,
): { ok: boolean; wordRatio: number; optionHits: number } {
  if (!haystack) return { ok: false, wordRatio: 0, optionHits: 0 };
  const hay = latinKey(haystack);
  if (!hay) return { ok: false, wordRatio: 0, optionHits: 0 };

  const words = [...new Set(latinKey(item.text).split(' ').filter((word) => word.length > 3))];
  const hits = words.filter((word) => hay.includes(word)).length;
  const optionHits = item.options.filter((option) => {
    const key = latinKey(option);
    return key.length > 2 && hay.includes(key);
  }).length;
  const wordRatio = words.length === 0 ? 0 : hits / words.length;

  return { ok: words.length >= 3 && wordRatio >= 0.8 && optionHits >= 3, wordRatio, optionHits };
}

/** نرمال‌سازی فارسی برای مقابلهٔ دوگذره: حروف/ارقام زبانی، یکدست ی/ک/ه. */
export const faKey = (text: string): string =>
  text
    .replace(/[۰-۹٠-٩]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(digit) % 10))
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/\u200c/g, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * شاهد دومِ فارسی: واژه‌های کلیدی صورت و واژه‌های گزینه‌ها باید در متن OCR دوم
 * (docx همان سال در docs/exam-ocr) دیده شوند. آستانه‌ها سخت‌گیرانه‌اند؛ هدف تأیید
 * هویت سؤال است، نه اصلاح واژه به واژه.
 */
export function corroboratesFa(
  item: { text: string; options: string[] },
  haystack: string | null,
): { ok: boolean; wordRatio: number; optionHits: number } {
  if (!haystack) return { ok: false, wordRatio: 0, optionHits: 0 };
  const hay = faKey(haystack);
  if (!hay) return { ok: false, wordRatio: 0, optionHits: 0 };

  const words = [...new Set(faKey(item.text).split(' ').filter((word) => word.length >= 4))];
  if (words.length < 6) return { ok: false, wordRatio: 0, optionHits: 0 };
  const hits = words.filter((word) => hay.includes(word)).length;
  const wordRatio = hits / words.length;

  const optionHits = item.options.filter((option) => {
    const tokens = faKey(option).split(' ').filter((token) => token.length >= 4);
    if (tokens.length === 0) return false;
    const present = tokens.filter((token) => hay.includes(token)).length;
    return present / tokens.length >= 0.6;
  }).length;

  return { ok: wordRatio >= 0.55 && optionHits >= 2, wordRatio, optionHits };
}
