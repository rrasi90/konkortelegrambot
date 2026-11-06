/** AEL content audit — count questions/lessons by level, year, course, node. Metadata only. */
import { INITIAL_QUESTION_BANK, INITIAL_KNOWLEDGE_NODES } from '../src/data/konkorData.ts';
import { YEARLY_KONKOR_QUESTIONS, YEARLY_KONKOR_BOOKLETS } from '../src/data/yearlyKonkorExams.ts';

const all = [...INITIAL_QUESTION_BANK, ...YEARLY_KONKOR_QUESTIONS];
const byLevel = {};
const byYear = {};
const byCourse = {};
const phdByCourse = {};
let noExplanation = 0, noTrap = 0, noSource = 0;
for (const q of all) {
  const lvl = q.examLevel ?? (q.examType === 'official_phd' ? 'دکتری' : (String(q.id).includes('phd') ? 'دکتری' : 'ارشد/نامشخص'));
  byLevel[lvl] = (byLevel[lvl] ?? 0) + 1;
  const y = q.examYear ?? '?';
  byYear[y] = (byYear[y] ?? 0) + 1;
  const c = q.courseSectionTitle ?? q.course ?? q.subjectId ?? 'نامشخص';
  byCourse[c] = (byCourse[c] ?? 0) + 1;
  if (lvl === 'دکتری') phdByCourse[c] = (phdByCourse[c] ?? 0) + 1;
  if (!q.explanation || q.explanation.length < 40) noExplanation++;
  if (!q.trapNote) noTrap++;
  if (!q.sourceReference && !q.designedFromTextbook) noSource++;
}
console.log('=== TOTALS ===');
console.log(JSON.stringify({
  totalQuestions: all.length,
  knowledgeNodes: INITIAL_KNOWLEDGE_NODES.length,
  byLevel, byYear, noExplanation, noTrap, noSource,
}, null, 1));
console.log('=== byCourse ===');
console.log(JSON.stringify(byCourse, null, 1));
console.log('=== PhD byCourse ===');
console.log(JSON.stringify(phdByCourse, null, 1));
console.log('=== NODES ===');
console.log(INITIAL_KNOWLEDGE_NODES.map((n) => `${n.id} | ${n.topic} | ${n.track ?? ''}`).join('\n'));
