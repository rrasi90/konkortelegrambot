import { INITIAL_QUESTION_BANK, INITIAL_KNOWLEDGE_NODES } from '../src/data/konkorData.ts';
import { getMultiBranchEffectiveCoefficient } from '../src/engine/aelEngine.ts';
const courses = {};
for (const n of INITIAL_KNOWLEDGE_NODES) courses[n.course] = (courses[n.course] ?? 0) + 1;
const phd = INITIAL_QUESTION_BANK.filter((q) => q.examLevel === 'دکتری');
// multi-branch sanity: mkt node coefficient for business=4, industrial=0 → union business+industrial = 4
const mkt = INITIAL_KNOWLEDGE_NODES.find((n) => n.id.startsWith('mkt.'));
const union = getMultiBranchEffectiveCoefficient(mkt, ['business', 'industrial']);
console.log(JSON.stringify({ nodes: INITIAL_KNOWLEDGE_NODES.length, phdQuestions: phd.length, distinctCourses: Object.keys(courses).length, newCourses: Object.keys(courses).filter((c) => /دولتی|خط‌مشی|اطلاعات مدیریت|مدیریت دانش|ریسک|بازارها|روش تحقیق/.test(c)), multiBranchUnionMkt: union }, null, 1));
