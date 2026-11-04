import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const input = [
  'content/questions/bank-official_traced_arshad.json',
  'content/questions/bank-official_traced_phd.json',
];
const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک').replace(/[\u200c\u200d\s]+/g, ' ').trim();

/** @param {{items: Array<{id: string, result: string}>}} sourceAudit */
export function extractRecurrence(banks, rules, endYear, sourceAudit = { items: [] }) {
  const startYear = endYear - 9;
  const conflicts = new Set(sourceAudit.items.filter(item => item.result === 'conflict').map(item => item.id));
  const patterns = [];
  const coverage = [];
  for (const { path, questions } of banks) {
    const byLevel = new Map();
    for (const q of questions) {
      if (!Number.isInteger(q.examYear) || q.examYear < startYear || q.examYear > endYear || !q.examLevel) continue;
      const records = byLevel.get(q.examLevel) ?? [];
      records.push(q);
      byLevel.set(q.examLevel, records);
    }
    for (const [examLevel, records] of byLevel) {
      const traced = records.filter((q) =>
        !conflicts.has(q.id) && q.verificationStatus === 'official_key_cited_in_reference' && q.sourceReference &&
        q.bookletCode && Number.isInteger(q.bookletQuestionNumber) && q.bookletQuestionNumber > 0
      );
      coverage.push({ examLevel, path, candidateRows: records.length,
        traceableRows: new Set(traced.map(q => `${q.examYear}/${q.bookletCode}/${q.bookletQuestionNumber}`)).size,
        yearsWithTraceableRows: [...new Set(traced.map(q => q.examYear))].sort() });
      for (const rule of rules) {
        const expressions = rule.required.map((pattern) => new RegExp(pattern, 'iu'));
        const refs = new Map();
        for (const q of traced) {
          if (q.sourceNodeId !== rule.nodeId || !expressions.every(r => r.test(normalize(q.questionText)))) continue;
          const reference = { year: q.examYear, booklet: q.bookletCode, number: q.bookletQuestionNumber, itemId: q.id };
          refs.set(`${reference.year}/${reference.booklet}/${reference.number}`, reference);
        }
        const years = [...new Set([...refs.values()].map(q => q.year))].sort();
        if (years.length < 2) continue;
        patterns.push({ id: rule.id, title: rule.title, examLevel, years, summary: rule.summary,
          practicePrompt: rule.practicePrompt, status: 'trace_pending_review',
          occurrences: [...refs.values()].sort((a, b) => a.year - b.year || a.number - b.number) });
      }
    }
  }
  return { window: { from: startYear, through: endYear }, coverage, patterns };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const endYear = Number(process.argv[2] ?? 1405);
  if (!Number.isInteger(endYear) || endYear < 1390 || endYear > 1500) throw new Error('Invalid exam year');
  const banks = await Promise.all(input.map(async path => ({
    path, questions: JSON.parse(await readFile(new URL(path, root), 'utf8')).questions,
  })));
  const rules = JSON.parse(await readFile(new URL('content/learning-evidence/concept-rules.json', root), 'utf8'));
  const audit = JSON.parse(await readFile(new URL('content/learning-evidence/source-audit.json', root), 'utf8'));
  const evidence = extractRecurrence(banks, rules, endYear, audit);
  const serialized = JSON.stringify(evidence, null, 2) + '\n';
  const destination = new URL('content/learning-evidence/recurrence.json', root);
  if (process.argv.includes('--check')) {
    if (serialized !== await readFile(destination, 'utf8')) throw new Error('Recurrence output needs regeneration.');
  } else {
    await writeFile(destination, serialized);
  }
  console.log(evidence.patterns.map(p => `${p.id}: ${p.years.join(', ')}`).join('\n'));
}
