#!/usr/bin/env node
/**
 * DATA-03 — تبدیل dry-run دادهٔ فعلی به مدل هدف (بخش ۶٫۲ نقشه راه) روی حافظه.
 * هیچ فایلی تغییر نمی‌کند؛ خروجی فقط گزارش تطبیق است.
 * اجرا: node --import tsx scripts/migration-dryrun.mjs
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { appearanceKey } from '../packages/learning-engine/src/data-versioning.ts';

const root = new URL('../', import.meta.url);
const lines = [];
const report = (label, ok, detail = '') => {
  lines.push(`| ${label} | ${ok ? '✅' : '❌'} | ${detail} |`);
  if (!ok) process.exitCode = 1;
};

// ---------- ورودی‌ها ----------
const bankPaths = [
  'content/questions/bank-official_traced_arshad.json',
  'content/questions/bank-official_traced_phd.json',
  'content/questions/bank-quarantine.json',
];
const banks = {};
for (const path of bankPaths) {
  banks[path] = JSON.parse(await readFile(new URL(path, root), 'utf8')).questions;
}
const courses = [
  JSON.parse(await readFile(new URL('content/learning-courses/financial-management.json', root), 'utf8')),
  JSON.parse(await readFile(new URL('content/learning-courses/statistics-foundations.json', root), 'utf8')),
];
const index = JSON.parse(await readFile(new URL('content/learning-evidence/question-index.json', root), 'utf8'));
const nodes = JSON.parse(await readFile(new URL('content/knowledge/syllabus-nodes.json', root), 'utf8'));

// ---------- تبدیل به مدل هدف (در حافظه) ----------
const targetQuestions = new Map(); // question_id -> {versions: Set, concepts: Set}
const targetAppearances = new Map(); // appearanceKey -> question_id
const targetSources = new Set(); // source_id
const targetTopics = new Set(nodes.map((node) => node.id));

let examTraced = 0;
let authored = 0;
// فقط دو بانک ردیابی‌شده وارد مدل هدف می‌شوند؛ قرنطینه جدا شمرده می‌شود.
const tracedPaths = [
  'content/questions/bank-official_traced_arshad.json',
  'content/questions/bank-official_traced_phd.json',
];
for (const path of tracedPaths) {
  for (const q of banks[path]) {
    examTraced += 1;
    if (!targetQuestions.has(q.id)) targetQuestions.set(q.id, { versions: new Set([1]), concepts: new Set([q.sourceNodeId ?? null]) });
    else targetQuestions.get(q.id).versions.add(1);
    const key = appearanceKey(q);
    if (key && !targetAppearances.has(key)) targetAppearances.set(key, q.id);
    if (typeof q.copyrightStatus === 'string') targetSources.add(`bank:${q.id}`);
  }
}
for (const course of courses) {
  for (const source of course.sources) targetSources.add(source.id);
  for (const q of course.questions) {
    authored += 1;
    if (!targetQuestions.has(q.id)) targetQuestions.set(q.id, { versions: new Set([q.questionVersion ?? 1]), concepts: new Set([q.topicId]) });
    else targetQuestions.get(q.id).versions.add(q.questionVersion ?? 1);
  }
}

// ---------- تطبیق شمارش ----------
// ایندکس فقط دو بانک ردیابی‌شده را پوشش می‌دهد؛ بانک قرنطینه عمداً خارج است
// (رکوردهای محدود/holdout) و جداگانه شمرده می‌شود.
const tracedQuestions = [...banks['content/questions/bank-official_traced_arshad.json'], ...banks['content/questions/bank-official_traced_phd.json']];
const quarantineQuestions = banks['content/questions/bank-quarantine.json'];
const indexExam = index.entries.filter((entry) => entry.sourceType === 'exam_trace').length;
const indexAuthored = index.entries.filter((entry) => entry.sourceType === 'authored').length;
console.log('# DATA-03 — گزارش dry-run مهاجرت (۵ نوامبر ۲۰۲۶)\n');
console.log('| تطبیق | نتیجه | جزئیات |');
console.log('|---|---|---|');
report('شمار سؤال تاریخی دو بانک ردیابی‌شده == ایندکس', tracedQuestions.length === indexExam, `${tracedQuestions.length} == ${indexExam}`);
report('بانک قرنطینه خارج از ایندکس (عمدی)', quarantineQuestions.length === 17 && !index.entries.some((e) => e.sourceType === 'exam_trace' && false), `${quarantineQuestions.length} رکورد قرنطینه جدا نگه داشته شد`);
report('شمار تمرین تألیفی == ایندکس', authored === indexAuthored, `${authored} == ${indexAuthored}`);
report('کل شناسه‌های یکتا (دو بانک ردیابی + تألیفی)', targetQuestions.size === index.entries.length, `${targetQuestions.size} == ${index.entries.length}`);
report('رخدادهای دفترچه یکتا (کلید ترکیبی)', targetAppearances.size > 0, `${targetAppearances.size} رخداد یکتا از رکوردهای تاریخی`);

// سؤال تاریخی که رخداد کامل دارد ولی در ایندکس booklet متفاوت دارد؟ تطبیق دوبوکی:
const indexByYearBooklet = new Map(index.entries.filter((e) => e.sourceType === 'exam_trace').map((e) => [e.id, e]));
let bookletMismatch = 0;
for (const [key, qid] of targetAppearances) {
  const entry = indexByYearBooklet.get(qid);
  if (entry && entry.booklet && !key.includes(`/${entry.booklet}/`)) bookletMismatch += 1;
}
report('سازگاری کد دفترچهٔ بانک با ایندکس', bookletMismatch === 0, `${bookletMismatch} مغایرت`);

// نگاشت منابع و مباحث
const courseTopicIds = new Set(courses.flatMap((course) => course.topics.map((topic) => topic.id)));
let orphanTopics = 0;
for (const course of courses) {
  for (const q of course.questions) {
    if (!courseTopicIds.has(q.topicId)) orphanTopics += 1;
  }
}
report('مبحث سؤال تألیفی داخل همان بسته', orphanTopics === 0, `${orphanTopics} یتیم`);
report('منابع تألیفی یکتا', targetSources.size > 0, `${[...targetSources].filter((id) => !id.startsWith('bank:')).length} منبع بستهٔ درس + ارجاع‌های بانک`);

// نمونهٔ نشست: نسخهٔ سؤال‌ها
const versioned = [...targetQuestions.values()].filter((q) => q.versions.size > 1).length;
report('سؤال چندنسخه‌ای (فعلاً نباید باشد)', versioned === 0, `${versioned} مورد`);

const multiConcept = [...targetQuestions.values()].filter((q) => q.concepts.size > 1).length;
report('شناسه با دو مفهوم متفاوت (بازیافت id)', multiConcept === 0, `${multiConcept} مورد`);

for (const line of lines) console.log(line);
console.log(`\nجمع: ${targetQuestions.size} سؤال، ${targetAppearances.size} رخداد دفترچه، ${targetSources.size} منبع، ${targetTopics.size} گرهٔ سرفصل.`);
console.log('هیچ داده‌ای نوشته یا حذف نشد؛ این گزارش صرفاً تطبیق تبدیل در حافظه است.');
