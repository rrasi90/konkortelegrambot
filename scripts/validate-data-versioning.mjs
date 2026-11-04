#!/usr/bin/env node
/**
 * DATA-02 — اعمال اعتبارسنج نسخه‌بندی روی دادهٔ واقعی مخزن.
 * اجرا: node --import tsx scripts/validate-data-versioning.mjs
 * خروجی ناموفق = کد خروج ۱ (برای CI مناسب است). داده تغییری نمی‌کند.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  findPrerequisiteCycle,
  validateAppearances,
  validateBookEditions,
  validateQuestionIdentity,
} from '../packages/learning-engine/src/data-versioning.ts';

const root = new URL('../', import.meta.url);
const bankPaths = [
  'content/questions/bank-official_traced_arshad.json',
  'content/questions/bank-official_traced_phd.json',
];

const questions = [];
for (const path of bankPaths) {
  const bank = JSON.parse(await readFile(new URL(path, root), 'utf8'));
  questions.push(...bank.questions);
}
const courses = [
  JSON.parse(await readFile(new URL('content/learning-courses/financial-management.json', root), 'utf8')),
  JSON.parse(await readFile(new URL('content/learning-courses/statistics-foundations.json', root), 'utf8')),
];
for (const course of courses) {
  for (const question of course.questions) {
    questions.push({ ...question, topicId: question.topicId });
  }
}

// سرفصل‌ها: پیش‌نیازها از syllabus-nodes (اگر فیلد دارد)
const nodes = JSON.parse(await readFile(new URL('content/knowledge/syllabus-nodes.json', root), 'utf8'));
const nodeIds = nodes.map((node) => node.id);
const prereqEdges = [];
for (const node of nodes) {
  for (const prereq of node.prerequisites ?? node.prereqNodeIds ?? []) {
    if (typeof prereq === 'string') prereqEdges.push({ from: node.id, to: prereq });
  }
}

// کتاب‌ها از content/markdown/books (frontmatter ساده)
import { readdir, readFile as readFileRaw } from 'node:fs/promises';
const editions = [];
const booksDir = new URL('content/markdown/books/', root);
for (const folder of (await readdir(booksDir)).sort()) {
  try {
    const meta = await readFileRaw(new URL(`${folder}/metadata.md`, booksDir), 'utf8');
    const editionYear = Number((meta.match(/edition[_-]?year:\s*(\d{4})/i) ?? [])[1]);
    if (Number.isInteger(editionYear)) {
      editions.push({ bookId: folder, editionYear });
    }
  } catch {
    // کتاب بدون metadata — از شمارش چاپ می‌ماند
  }
}

const identityIssues = validateQuestionIdentity(questions);
const appearanceIssues = validateAppearances(questions);
const editionIssues = validateBookEditions(editions);
const cycle = prereqEdges.length ? findPrerequisiteCycle(nodeIds, prereqEdges) : null;

console.log(`identity: ${questions.length} question records checked -> ${identityIssues.length} issue(s)`);
console.log(`appearances: ${appearanceIssues.length} issue(s)`);
console.log(`editions: ${editions.length} book edition(s) checked -> ${editionIssues.length} issue(s)`);
console.log(`prerequisite graph: ${nodeIds.length} node(s), ${prereqEdges.length} edge(s) -> ${cycle ? 'CYCLE: ' + cycle.join(' -> ') : 'no cycle'}`);

const allIssues = [...identityIssues, ...appearanceIssues, ...editionIssues];
if (cycle) allIssues.push({ code: 'invalid_version', message: 'چرخهٔ پیش‌نیاز: ' + cycle.join(' -> '), subjectId: 'syllabus-nodes' });
for (const issue of allIssues) {
  console.error(`[${issue.code}] ${issue.subjectId}: ${issue.message}`);
}
if (allIssues.length > 0) process.exit(1);
console.log('DATA-02 versioning validation: PASS');
