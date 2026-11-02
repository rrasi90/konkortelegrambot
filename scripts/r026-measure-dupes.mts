// R-026 measurement: duplicate question ids inside INITIAL_QUESTION_BANK
// and overlap with YEARLY_KONKOR_QUESTIONS.
import { INITIAL_QUESTION_BANK } from '../src/data/konkorData';
import { YEARLY_KONKOR_QUESTIONS } from '../src/data/yearlyKonkorExams';

const yearlyIds = new Set(YEARLY_KONKOR_QUESTIONS.map((q) => q.id));
const idCount = new Map<string, number>();
for (const q of INITIAL_QUESTION_BANK) idCount.set(q.id, (idCount.get(q.id) ?? 0) + 1);
const dupInsideInitial = [...idCount.entries()].filter(([, n]) => n > 1);
const overlap = [...idCount.keys()].filter((id) => yearlyIds.has(id));

console.log(
  JSON.stringify(
    {
      initialTotal: INITIAL_QUESTION_BANK.length,
      initialUniqueIds: idCount.size,
      dupInsideInitial: dupInsideInitial.length,
      overlapWithYearly: overlap.length,
      yearlyTotal: YEARLY_KONKOR_QUESTIONS.length,
      yearlyUniqueIds: yearlyIds.size,
      sampleDupIds: dupInsideInitial.slice(0, 5).map(([id, n]) => `${id}×${n}`),
    },
    null,
    1,
  ),
);
