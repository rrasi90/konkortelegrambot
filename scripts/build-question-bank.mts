// Builds standardized, tiered question bank JSON from the in-repo traced data.
// Tiers are kept strictly separate:
//   official_traced_phd    — questions transcribed from PhD (دکتری) booklets
//   official_traced_arshad — Master's (ارشد) booklets with cited official keys
//   quarantine             — items flagged for proof-quarantine or conflicts
// Run: npx tsx scripts/build-question-bank.mts
import { writeFile, mkdir } from 'node:fs/promises';
import { INITIAL_QUESTION_BANK } from '../src/data/konkorData';
import { YEARLY_KONKOR_QUESTIONS, YEARLY_KONKOR_BOOKLETS } from '../src/data/yearlyKonkorExams';
import { CLIENT_BANK_ANSWER_KEY_BY_ID } from '../apps/worker/src/data/client-bank-keys.server';

type Tier = 'official_traced_phd' | 'official_traced_arshad' | 'quarantine';

// courseSectionId -> docs/phase-1 CURRICULUM_MASTER course_id (best effort; null = unmapped)
const SECTION_TO_COURSE: Record<string, string | null> = {
  english: 'english.language',
  islamic: null,
  math_stats: 'statistics.management',
  management_theories: null,
  economics: null,
  operations_research: null,
  production: null,
  marketing: null,
};

function classifyTier(q: { examLevel?: string; sourceReference?: string }): {
  tier: Tier;
  verificationStatus: string;
} {
  const ref = q.sourceReference ?? '';
  if (ref.includes('قرنطینه')) {
    return { tier: 'quarantine', verificationStatus: 'quarantined' };
  }
  const isPhd = q.examLevel === 'دکتری' || ref.includes('دکتری');
  if (isPhd) {
    // PhD booklets' keys are not attached in-repo -> honestly pending key review
    return { tier: 'official_traced_phd', verificationStatus: 'transcribed_pending_key_review' };
  }
  return { tier: 'official_traced_arshad', verificationStatus: 'official_key_cited_in_reference' };
}

const bookletCodeByYear = new Map<number, string>(
  YEARLY_KONKOR_BOOKLETS.map((b) => [b.year, b.bookletCode] as [number, string]),
);

// YEARLY_KONKOR_BOOKLETS documents the arshad (set 1142) booklet series only;
// PhD items must never inherit an arshad control code from the year map.
function resolveBookletCode(q: { examYear: number; sourceReference?: string }, tier: Tier): string | null {
  const explicit = (q.sourceReference ?? '').match(/کد\s*([0-9]{3}[A-Z])/);
  if (explicit) return explicit[1];
  if (tier === 'official_traced_phd' || tier === 'quarantine') return null;
  return bookletCodeByYear.get(q.examYear) ?? null;
}

const items = [...YEARLY_KONKOR_QUESTIONS, ...INITIAL_QUESTION_BANK];
const byId = new Map<string, (typeof items)[number]>();
const contentConflicts: string[] = [];
let mergedDuplicates = 0;
for (const q of items) {
  const prev = byId.get(q.id);
  if (!prev) {
    byId.set(q.id, q);
    continue;
  }
  const sameContent =
    prev.text === q.text &&
    (CLIENT_BANK_ANSWER_KEY_BY_ID.get(prev.id)?.correctOption ?? -1) === (CLIENT_BANK_ANSWER_KEY_BY_ID.get(q.id)?.correctOption ?? -1) &&
    prev.options.join('|') === q.options.join('|');
  if (sameContent) {
    mergedDuplicates += 1; // keep the first (richer) record
  } else {
    contentConflicts.push(q.id); // same id, different content -> keep first, report
  }
}
const unique = [...byId.values()];
const buckets: Record<Tier, unknown[]> = {
  official_traced_phd: [],
  official_traced_arshad: [],
  quarantine: [],
};

for (const q of unique) {
  const { tier, verificationStatus } = classifyTier(q);
  const sectionId = (q as { courseSectionId?: string }).courseSectionId ?? null;
  buckets[tier].push({
    id: q.id,
    tier,
    examLevel: tier === 'official_traced_phd' ? 'دکتری' : tier === 'official_traced_arshad' ? 'ارشد' : 'نامشخص',
    examYear: q.examYear,
    bookletCode: resolveBookletCode(q, tier),
    bookletQuestionNumber: q.bookletQuestionNumber ?? null,
    courseId: sectionId ? SECTION_TO_COURSE[sectionId] ?? null : null,
    courseSectionId: sectionId,
    sourceNodeId: q.nodeId,
    sourceReference: q.sourceReference ?? '',
    questionText: q.text,
    options: q.options,
    // R-036: کلید فقط از رجیستری سرور می‌آید — بانک کلاینت public-only است
    correctOption: CLIENT_BANK_ANSWER_KEY_BY_ID.get(q.id)?.correctOption ?? -1,
    explanation: CLIENT_BANK_ANSWER_KEY_BY_ID.get(q.id)?.explanation ?? '',
    trapNote: CLIENT_BANK_ANSWER_KEY_BY_ID.get(q.id)?.trapNote ?? '',
    expectedTimeMs: q.expectedTimeMs ?? null,
    difficulty: 'unclassified',
    cognitiveLevel: 'unclassified',
    questionType: tier === 'quarantine' ? 'quarantined_unverified' : 'official_traced',
    verificationStatus,
    reviewStatus: 'not_reviewed',
    copyrightStatus: 'pending_review',
  });
}

await mkdir('content/questions', { recursive: true });
const meta = {
  generatedAt: new Date().toISOString().slice(0, 10),
  generator: 'scripts/build-question-bank.mts',
  schema: 'items follow the Phase-2 question contract (docs/phase-2/QUESTION_BANK_SPECIFICATION.md)',
  notes: [
    'No question is marked verified against an attached Sanjesh answer-key file; PhD items are transcribed with textbook-based explanations and remain pending key review.',
    'The 3 documentation placeholders (phd-1405-001..003) are intentionally NOT part of this bank.',
  ],
};
for (const [tier, list] of Object.entries(buckets)) {
  await writeFile(
    `content/questions/bank-${tier}.json`,
    JSON.stringify({ ...meta, tier, counts: {
      // total is the number of items in THIS file; corpusTotal is the cross-tier count.
      total: list.length,
      corpusTotal: unique.length,
      rawInput: items.length,
      mergedDuplicates,
      contentConflicts: contentConflicts.length,
      [tier]: list.length,
    }, questions: list }, null, 2) + '\n',
    'utf8',
  );
  console.log(`${tier}: ${list.length}`);
}
console.log(`total: ${items.length}`);
