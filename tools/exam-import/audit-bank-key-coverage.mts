// راستی‌آزمایی کامل پوشش کلید: هر سؤال چهارگزینه‌ای بانک کلاینت باید کلید سمت سرور داشته باشد
import * as konkorData from '../../src/data/konkorData';
import * as yearly from '../../src/data/yearlyKonkorExams';
import * as phdExpansion from '../../src/data/phdExpansionContent';
import * as refBooks from '../../src/data/referenceBooksRepo';
import * as encyclopedia from '../../src/data/comprehensiveCourseEncyclopedia';
import * as bookChapters from '../../src/data/bookChaptersRepo';
import { CLIENT_BANK_ANSWER_KEYS } from '../../apps/worker/src/data/client-bank-keys.server';

type QLike = { id?: string; text?: string; questionText?: string; options?: unknown[] };

function collect(value: unknown, bank: string, out: Map<string, string>, seen: Set<unknown>): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collect(item, bank, out, seen);
    return;
  }
  const rec = value as Record<string, unknown>;
  const id = typeof rec.id === 'string' ? rec.id : null;
  const text = typeof rec.text === 'string' ? rec.text : typeof rec.questionText === 'string' ? rec.questionText : null;
  const opts = Array.isArray(rec.options) ? rec.options : null;
  if (id && text && opts && opts.length >= 3 && !id.startsWith('sec.')) {
    out.set(id, bank);
  }
  for (const v of Object.values(rec)) collect(v, bank, out, seen);
}

const banks: Array<[string, unknown]> = [
  ['konkorData', konkorData],
  ['yearlyKonkorExams', yearly],
  ['phdExpansionContent', phdExpansion],
  ['referenceBooksRepo', refBooks],
  ['comprehensiveCourseEncyclopedia', encyclopedia],
  ['bookChaptersRepo', bookChapters],
];

const questions = new Map<string, string>();
for (const [bank, mod] of banks) {
  const seen = new Set<unknown>();
  for (const exported of Object.values(mod as Record<string, unknown>)) collect(exported, bank, questions, seen);
}

const keyIds = new Set(CLIENT_BANK_ANSWER_KEYS.filter((k) => !k.id.startsWith('sec.')).map((k) => k.id));

const missingKey = [...questions.entries()].filter(([id]) => !keyIds.has(id));
const orphanKeys = [...keyIds].filter((id) => !questions.has(id));

console.log('questions in client banks:', questions.size);
console.log('registry real keys:', keyIds.size);
console.log('questions WITHOUT key:', missingKey.length);
for (const [id, bank] of missingKey.slice(0, 30)) console.log('  MISSING', id, `(${bank})`);
console.log('keys WITHOUT question (orphan):', orphanKeys.length);
for (const id of orphanKeys.slice(0, 30)) console.log('  ORPHAN', id);
if (missingKey.length === 0 && orphanKeys.length === 0) console.log('COVERAGE: COMPLETE ✅');
