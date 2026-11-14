/**
 * جای‌گردی قطعی گزینه‌های تست‌های تألیفی فصل — یک‌بار اجرا.
 *
 * در نگارش اولیهٔ src/data/chapterAuthoredQuestions.ts گزینهٔ صحیح همیشه در
 * ردیف اول بود. این اسکریپت با جای‌گردی بر پایهٔ هش شناسه، گزینهٔ صحیح را به
 * جایگاه مقصد می‌برد و فایل را بازنویسی می‌کند. اجرای دوباره تغییری ایجاد نمی‌کند.
 *
 * اجرا: node --import tsx scripts/rotate-authored-options.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CHAPTER_AUTHORED_QUESTIONS } from '../src/data/chapterAuthoredQuestions';

const FILE = 'src/data/chapterAuthoredQuestions.ts';

/** هش پایدار بر پایهٔ کد نویسه‌ها — باید با جای‌گردی کلاینت هم‌خوان بماند */
export const authoredSlotHash = (id: string): number => {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return sum % 4;
};

const original = readFileSync(FILE, 'utf8');

const optionBlockRe = /options: \[([^\]]*['`][^\]]*)\]/g;
const matches = [...original.matchAll(optionBlockRe)];
if (matches.length !== CHAPTER_AUTHORED_QUESTIONS.length) {
  throw new Error(`تعداد بلوک گزینه (${matches.length}) با تعداد سؤال (${CHAPTER_AUTHORED_QUESTIONS.length}) نمی‌خواند`);
}

const result: string[] = [];
let cursor = 0;
matches.forEach((match, index) => {
  const question = CHAPTER_AUTHORED_QUESTIONS[index];
  if (match.index === undefined) throw new Error('موقعیت بلوک گزینه نامشخص است');
  if (!original.slice(match.index, match.index + match[0].length).includes('options:')) {
    throw new Error(`بلوک ${index} گزینه نیست`);
  }
  // متن سؤال پیش از بلوک گزینه باید همان سؤال انتظارشده باشد
  // (بک‌اسلش در سورس دوبار نوشته می‌شود؛ برای مقایسه حذفش می‌کنیم)
  const normalize = (value: string) => value.replaceAll('\\', '');
  const preceding = normalize(original.slice(cursor, match.index));
  if (!preceding.includes(normalize(question.text).slice(0, 24))) {
    throw new Error(`ناهماهنگی ترتیب در ${question.id}`);
  }
  const slot = authoredSlotHash(question.id);
  const rotated = question.options.map((_, i) => question.options[(i - slot + 4) % 4]);
  const replacement =
    'options: [\n' +
    rotated.map((option) => `      ${JSON.stringify(option)},`).join('\n') +
    '\n    ]';
  result.push(original.slice(cursor, match.index), replacement);
  cursor = match.index + match[0].length;
});
result.push(original.slice(cursor));

writeFileSync(FILE, result.join(''), 'utf8');
console.log(`جای‌گردی گزینه‌ها انجام شد: ${matches.length} سؤال`);
for (const question of CHAPTER_AUTHORED_QUESTIONS) {
  console.log(`${authoredSlotHash(question.id)}\t${question.id}`);
}
