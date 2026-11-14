/**
 * جای‌گردی گزینه‌ها فقط برای شناسه‌های معیَّن — یک‌بار اجرا.
 *
 * بر خلاف rotate-authored-options.mts که همهٔ بلوک‌ها را می‌گرداند (و برای
 * سؤال‌های پیش‌تر چرخیده مخرب است)، این اسکریپت فقط بلوک گزینهٔ سؤال‌هایی را
 * که بلافاصله پس از authored('<id>') می‌آیند جابه‌جا می‌کند.
 *
 * اجرا: node --import tsx scripts/rotate-authored-options-by-id.mts <idsFile>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'src/data/chapterAuthoredQuestions.ts';
const idsFile = process.argv[2];
if (!idsFile) throw new Error('مسیر فایل شناسه‌ها را بدهید');

const slots = new Map<string, number>();
for (const line of readFileSync(idsFile, 'utf8').split('\n')) {
  const match = line.trim().match(/^(\d) (q\.auth\..+)$/);
  if (match) slots.set(match[2], Number(match[1]));
}

const original = readFileSync(FILE, 'utf8');
let changed = 0;
const result: { from: number; to: number; replacement: string }[] = [];
for (const [id, slot] of slots) {
  const anchor = `authored('${id.replace('q.auth.', '')}', {`;
  const anchorIndex = original.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`بلوک ${id} پیدا نشد`);
  const optionsStart = original.indexOf('options: [', anchorIndex);
  if (optionsStart < 0) throw new Error(`گزینه‌های ${id} پیدا نشد`);
  const optionsEnd = original.indexOf('],', optionsStart);
  if (optionsEnd < 0) throw new Error(`پایان گزینه‌های ${id} پیدا نشد`);
  const block = original.slice(optionsStart, optionsEnd + 1);
  const literals = [
    ...block.matchAll(/'([^']*)'|"((?:[^"\\]|\\.)*)"/g),
  ].map((m) => m[1] ?? m[2]);
  if (literals.length !== 4) throw new Error(`${id}: ${literals.length} گزینه پیدا شد`);
  const rotated = literals.map((_, i) => literals[(i - slot + 4) % 4]);
  const replacement =
    'options: [\n' +
    rotated.map((option) => `      ${JSON.stringify(option)},`).join('\n') +
    '\n    ]';
  result.push({
    from: optionsStart,
    to: optionsEnd + 1,
    replacement,
  });
  changed++;
}
// اعمال از انتهای رشته به ابتدا تا جابه‌جایی ایندکس‌ها خراب نشود
result.sort((a, b) => b.from - a.from);
let output = original;
for (const patch of result) {
  output = output.slice(0, patch.from) + patch.replacement + output.slice(patch.to);
}
writeFileSync(FILE, output, 'utf8');
console.log(`${changed} بلوک گزینه چرخیده شد`);
