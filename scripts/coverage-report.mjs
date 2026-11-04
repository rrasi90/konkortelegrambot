#!/usr/bin/env node
/**
 * SRC-05 — داشبورد پوشش با مخرج صریح (قالب GOV-02 §2).
 * هیچ ادعای پوشش کل نمی‌کند؛ موارد «نامشخص» صریح می‌مانند.
 * اجرا: node --import tsx scripts/coverage-report.mjs
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const index = JSON.parse(await readFile(new URL('content/learning-evidence/question-index.json', root), 'utf8'));
const audit = JSON.parse(await readFile(new URL('content/learning-evidence/source-audit.json', root), 'utf8'));
const recurrence = JSON.parse(await readFile(new URL('content/learning-evidence/recurrence.json', root), 'utf8'));

const entries = index.entries;
const exam = entries.filter((e) => e.sourceType === 'exam_trace');
const authored = entries.filter((e) => e.sourceType === 'authored');
const keyed = exam.filter((e) => e.verification === 'official_key_cited_in_reference');
const displayable = exam.filter((e) => e.rights === 'pending_review' ? false : true); // هیچ رکورد تاریخی حقوق معلوم ندارد
const destinationed = entries.filter((e) => Array.isArray(e.learningReferences) && e.learningReferences.length > 0);
const conflicts = audit.items.filter((item) => item.result === 'conflict');
const quarantine = 17; // bank-quarantine.json — خارج از ایندکس عمومی

const years = new Map();
for (const entry of exam) {
  if (entry.year === null) continue;
  const row = years.get(entry.year) ?? { received: 0, keyed: 0 };
  row.received += 1;
  if (entry.verification === 'official_key_cited_in_reference') row.keyed += 1;
  years.set(entry.year, row);
}

console.log('# SRC-05 — داشبورد پوشش (مخرج صریح)\n');
console.log('## نسبت‌های کل (دامنه: بانک فعلی ۱۳۹۶–۱۴۰۵)');
console.log('| نسبت | صورت / مخرج | مقدار |');
console.log('|---|---|---|');
console.log(`| دریافتی | سؤال تاریخی واردشده / مورد انتظار دفترچه‌ها | ${exam.length} / **نامشخص** (فهرست مورد انتظار هر دفترچه هنوز ثبت نشده — GOV-02) |`);
console.log(`| کلیددار | official_key_cited / دریافتی | ${keyed.length} / ${exam.length} |`);
console.log(`| قابل نمایش | حقوق معلوم / کلیددار | ${displayable.length} / ${keyed.length} — همهٔ تاریخی‌ها rights=pending_review تا SRC-02 |`);
console.log(`| مقصددار | مقصد مطالعهٔ تأییدشده / قابل نمایش | ${destinationed.filter((e) => e.sourceType === 'exam_trace').length} / ${displayable.length} — تا بازبینی متخصص (SRC-04) |`);
console.log(`| تألیفی | تمرین authored / کل | ${authored.length} / ${entries.length} (همه pending_sme) |`);
console.log(`| قرنطینه | خارج از ایندکس عمومی | ${quarantine} رکورد (+ ${conflicts.length} تعارض ممیزی‌شده) |`);
console.log(`| الگوی کاندید | الگوهای trace_pending_review | ${recurrence.patterns.length} (${recurrence.patterns.map((p) => p.id).join(', ') || '—'}) |`);
console.log('\n## پوشش به تفکیک سال (دریافتی/کلیددار)');
console.log('| سال | دریافتی | کلیددار |');
console.log('|---|---|---|');
for (const year of [...years.keys()].sort((a, b) => a - b)) {
  const row = years.get(year);
  console.log(`| ${year} | ${row.received} | ${row.keyed} |`);
}
console.log('\nیادداشت: عدم مشاهده = «نادر» نیست؛ مخرج‌ها فقط بانک فعلی را می‌پوشانند، نه کل دفترچه‌های واقعی.');
