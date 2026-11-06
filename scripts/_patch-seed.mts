/**
 * یک‌بار: افزودن گسترش دکتری (12 node + 27 question) به default-seed ورکر
 * تا محتوای جدید به مینی‌اپ زندهٔ تلگرام (worker) برسد.
 * اجرا: npx tsx scripts/_patch-seed.mts  (idempotent)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PHD_EXPANSION_NODES, PHD_EXPANSION_QUESTIONS } from '../src/data/phdExpansionContent.ts';

const path = 'apps/worker/src/default-seed.ts';
let t = readFileSync(path, 'utf8');

if (t.includes('"pa.public_theories"')) {
  console.log('already patched — skip');
  process.exit(0);
}

const nodesBlock = PHD_EXPANSION_NODES.map((n) => {
  const s = (v: string) => JSON.stringify(v);
  return [
    '    {',
    `      "id": ${s(n.id)},`,
    `      "track": ${s(n.track)},`,
    `      "course": ${s(n.course)},`,
    `      "chapter": ${s(n.chapter)},`,
    `      "topic": ${s(n.topic)}`,
    '    },',
  ].join('\n');
}).join('\n');

const questionsBlock = PHD_EXPANSION_QUESTIONS.map((q, i) => {
  const s = (v: string) => JSON.stringify(v);
  return [
    '    {',
    `      "id": "phd-exp-${String(i + 1).padStart(3, '0')}",`,
    `      "nodeId": ${s(q.nodeId)},`,
    `      "examYear": ${q.examYear},`,
    `      "examLevel": ${s(q.examLevel ?? 'دکتری')},`,
    `      "text": ${s(q.text)},`,
    '      "options": [',
    q.options.map((o) => `        ${s(o)},`).join('\n').slice(0, -1),
    '      ],',
    `      "correctOption": ${q.correctOption},`,
    `      "explanation": ${s(q.explanation + ' (منبع مطالعه: ' + (q.sourceReference ?? '') + ')')},`,
    `      "trapNote": ${s(q.trapNote)},`,
    '      "isVerified": false',
    '    },',
  ].join('\n');
}).join('\n');

// ۱) nodes: قبل از آرایهٔ dependencies
const depsIdx = t.indexOf('"dependencies": [');
if (depsIdx < 0) throw new Error('dependencies marker not found');
const nodesClose = t.lastIndexOf('  ],', depsIdx);
if (nodesClose < 0) throw new Error('nodes close not found');
t = t.slice(0, nodesClose) + nodesBlock + '\n  ],' + t.slice(nodesClose + '  ],'.length);

// ۲) questions: انتهای آرایهٔ questions = انتهای فایل `  ]\n} as const;`
const tail = '\n  ]\n} as const;\n';
if (!t.endsWith(tail)) throw new Error('file tail shape changed');
const lastQClose = t.lastIndexOf('    }\n  ]\n} as const;\n');
if (lastQClose < 0) throw new Error('last question close not found');
t = t.slice(0, lastQClose) + '    },\n' + questionsBlock + '\n  ]\n} as const;\n';

// ۳) متا: نسخه + توضیح صادقانه
t = t.replace('"version": "0.1.0"', '"version": "0.2.0"');
const oldDesc = 'محتوای نمایشی ساختگی برای توسعه و تست موتور؛ جایگزین بانک سؤالات ۱۱ سال اخیر نیست.';
const newDesc =
  'بستهٔ محتوای دکتری مدیریت: مباحث پایه + گسترش دروس غایب بسته‌های رسمی (دولتی، سیاست‌گذاری، MIS/مدیریت دانش، مالی، روش تحقیق، HR، زبان، آمار) — همه تألیفی و pending_review؛ جایگزین بانک رسمی کنکور نیست.';
if (!t.includes(oldDesc)) throw new Error('meta description not found');
t = t.replace(oldDesc, newDesc);

writeFileSync(path, t);
console.log(`seed patched: +${PHD_EXPANSION_NODES.length} nodes, +${PHD_EXPANSION_QUESTIONS.length} questions`);
