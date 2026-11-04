#!/usr/bin/env node
/**
 * SRC-03 — CLI ورود سؤال: فایل JSON کاندید را اعتبارسنجی، از بانک تفکیک و به
 * قرنطینه/تکرار تقسیم می‌کند. پیش‌فرض فقط گزارش می‌دهد (dry-run)؛ هیچ فایلی را
 * تغییر نمی‌دهد. اجرا:
 *   node --import tsx scripts/import-questions.mjs <candidate.json>
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { importQuestionBatch, importReport, sha256Hex } from '../src/import/pipeline.mjs';

const root = new URL('../', import.meta.url);
const candidatePath = process.argv[2];
if (!candidatePath) {
  console.error('مسیر فایل کاندید لازم است: node --import tsx scripts/import-questions.mjs <candidate.json>');
  process.exit(2);
}
const bytes = await readFile(new URL(candidatePath, pathToFileURL(process.cwd() + '/')));
const contentHash = await sha256Hex(bytes);
const parsed = JSON.parse(bytes.toString('utf8'));
const incoming = Array.isArray(parsed) ? parsed : parsed.questions;
if (!Array.isArray(incoming)) {
  console.error('فایل کاندید باید آرایهٔ سؤال یا شیء با questions باشد.');
  process.exit(2);
}
const bankPaths = [
  'content/questions/bank-official_traced_arshad.json',
  'content/questions/bank-official_traced_phd.json',
  'content/questions/bank-quarantine.json',
];
const existingIds = new Set();
for (const path of bankPaths) {
  for (const q of JSON.parse(await readFile(new URL(path, root), 'utf8')).questions) existingIds.add(q.id);
}
for (const course of ['financial-management.json', 'statistics-foundations.json']) {
  for (const q of JSON.parse(await readFile(new URL(`content/learning-courses/${course}`, root), 'utf8')).questions) existingIds.add(q.id);
}
const result = importQuestionBatch(incoming, existingIds);
const report = importReport(candidatePath, contentHash, result);
console.log(JSON.stringify(report, null, 2));
console.log(`\nDry-run: هیچ فایلی تغییر نکرد. ${report.counts.accepted} قابل پذیرش، ${report.counts.quarantined} قرنطینه، ${report.counts.duplicates} تکراری.`);
if (report.counts.quarantined > 0) process.exit(1);
