/**
 * AEL — Exam MD Analysis helpers (pure, no IO).
 * Used by scripts/ael-exam-analyze.mjs and isolated tests.
 */
export const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const toEnDigits = (s) => String(s).replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d));

export function parseInlineOptions(text) {
  const en = toEnDigits(text);
  const opts = [];
  for (const mm of en.matchAll(/(?:^|\s)\(?([1-4])\)\s*([^]*?)(?=(?:\s)\(?[1-4]\)\s|$)/g)) {
    opts.push({ label: mm[1], text: mm[2].trim() });
  }
  if (opts.length >= 2) return opts;
  const bare = [];
  for (const mm of en.matchAll(/(?:^|\s)([1-4])\s+([^]*?)(?=(?:\s)[1-4]\s+|$)/g)) {
    bare.push({ label: mm[1], text: mm[2].trim() });
  }
  if (bare.length >= 3 && new Set(bare.map((o) => o.label)).size === bare.length) return bare;
  return opts;
}

export function cellText(s) {
  return String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
