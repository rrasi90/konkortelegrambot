/**
 * R-036 گام ۲ — حذف حرف‌های کلید از بانک‌های سؤال کلاینت (src/data/*).
 *
 * پیش‌شرط: رجیستری سرور (apps/worker/src/data/client-bank-keys.server.ts) باید
 * از قبل با پوشش کامل تولید شده باشد (۲۳۷ = ۲۱۰ سؤال + ۲۵ conceptCheck + ۲ canary).
 * این اسکریپت فقط خط‌های تک‌سطری کلید را حذف می‌کند و گزارش شمارشی می‌دهد.
 * اجرا: node --import tsx scripts/strip-client-bank-keys.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  'src/data/konkorData.ts',
  'src/data/yearlyKonkorExams.ts',
  'src/data/phdExpansionContent.ts',
  'src/data/referenceBooksRepo.ts',
  'src/data/comprehensiveCourseEncyclopedia.ts',
];

const PATTERNS: Array<[string, RegExp]> = [
  ['correctOption', /^\s*correctOption:\s*\d+\s*,?\s*$/],
  ['explanation', /^\s*explanation:\s*(["'`]).*\1\s*,?\s*$/],
  ['trapNote', /^\s*trapNote:\s*(["'`]).*\1\s*,?\s*$/],
  ['correctIndex', /^\s*correctIndex:\s*[01]\s*,?\s*$/],
  ['detailedAnswer', /^\s*detailedAnswer:\s*(["'`]).*\1\s*,?\s*$/],
  ['konkorTrap', /^\s*konkorTrap:\s*(["'`]).*\1\s*,?\s*$/],
];

let grandTotal = 0;
for (const file of FILES) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const kept: string[] = [];
  const removed: Record<string, number> = {};
  for (const line of lines) {
    let matched = false;
    for (const [name, re] of PATTERNS) {
      if (re.test(line)) {
        removed[name] = (removed[name] ?? 0) + 1;
        grandTotal++;
        matched = true;
        break;
      }
    }
    if (!matched) kept.push(line);
  }
  writeFileSync(file, kept.join('\n'), 'utf8');
  const summary = Object.entries(removed).map(([k, v]) => `${k}=${v}`).join(', ') || 'nothing';
  console.log(`${file}: removed ${Object.values(removed).reduce((a, b) => a + b, 0)} lines (${summary})`);
}
console.log(`TOTAL removed: ${grandTotal}`);
