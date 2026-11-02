// Generates Phase 2 evidence CSVs from the built bank and in-repo lesson data.
// Run: npx tsx scripts/generate-phase-2-reports.mts  (after build-question-bank)
import { readFile, writeFile } from 'node:fs/promises';
import { ALL_LESSON_DEEP_DIVES, getDeepDiveWordCount } from '../src/data/lessonDeepDives';

const base = 'content/questions';
const out = 'docs/phase-2';

type BankItem = Record<string, unknown> & {
  id: string;
  tier: string;
  examYear: number;
  bookletCode: string | null;
  courseId: string | null;
  courseSectionId: string | null;
  sourceReference: string;
  explanation: string;
  verificationStatus: string;
  reviewStatus: string;
};

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

const tiers = ['official_traced_phd', 'official_traced_arshad', 'quarantine'] as const;
const banks: Record<string, { counts: Record<string, number>; questions: BankItem[] }> = {};
for (const t of tiers) {
  banks[t] = JSON.parse(await readFile(`${base}/bank-${t}.json`, 'utf8'));
}
const all = tiers.flatMap((t) => banks[t].questions);

// 1) QUESTION_SOURCE_AUDIT.csv — every item with its provenance flags
await writeFile(
  `${out}/QUESTION_SOURCE_AUDIT.csv`,
  csv([
    ['question_id', 'tier', 'exam_year', 'booklet_code', 'course_section_id', 'course_id',
     'verification_status', 'review_status', 'has_source_reference', 'has_explanation', 'reference_excerpt'],
    ...all.map((q) => [
      q.id, q.tier, q.examYear, q.bookletCode ?? '', q.courseSectionId ?? '', q.courseId ?? '',
      q.verificationStatus, q.reviewStatus,
      q.sourceReference.trim().length > 10 ? 'yes' : 'no',
      String(q.explanation ?? '').trim().length > 20 ? 'yes' : 'no',
      q.sourceReference.slice(0, 80),
    ]),
  ]),
  'utf8',
);

// 2) SUBJECT_COVERAGE_REPORT.csv — traced question availability per section/course
const sections = new Map<string, { phd: number; arshad: number; quarantine: number; years: Set<number>; courseId: string }>();
for (const q of all) {
  const key = q.courseSectionId ?? 'unmapped';
  const row = sections.get(key) ?? { phd: 0, arshad: 0, quarantine: 0, years: new Set<number>(), courseId: q.courseId ?? '' };
  if (q.tier === 'official_traced_phd') row.phd++;
  else if (q.tier === 'official_traced_arshad') row.arshad++;
  else row.quarantine++;
  row.years.add(q.examYear);
  if (!row.courseId && q.courseId) row.courseId = q.courseId;
  sections.set(key, row);
}
await writeFile(
  `${out}/SUBJECT_COVERAGE_REPORT.csv`,
  csv([
    ['course_section_id', 'course_id', 'phd_traced', 'arshad_traced', 'quarantined', 'distinct_years', 'coverage_status'],
    ...[...sections.entries()]
      .map(([id, r]) => {
        const traced = r.phd + r.arshad;
        const status = traced === 0 ? 'no_traced_items' : traced < 5 ? 'thin' : 'usable';
        return [id, r.courseId, r.phd, r.arshad, r.quarantine, r.years.size, status];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ]),
  'utf8',
);

// 3) LESSON_QUALITY_REPORT.csv — structural quality of deep-dive lessons
await writeFile(
  `${out}/LESSON_QUALITY_REPORT.csv`,
  csv([
    ['node_id', 'objective_count', 'section_count', 'has_example', 'misconception_count',
     'takeaway_count', 'word_count', 'quality_issues'],
    ...ALL_LESSON_DEEP_DIVES.map((d) => {
      const issues: string[] = [];
      if (d.objectives.length === 0) issues.push('no_objectives');
      if (d.sections.length === 0) issues.push('no_sections');
      if (!d.example) issues.push('no_example');
      if (d.misconceptions.length === 0) issues.push('no_misconceptions');
      if (d.takeaways.length === 0) issues.push('no_takeaways');
      const wc = getDeepDiveWordCount(d);
      if (wc < 50) issues.push('very_short');
      if (!d.examAngle.trim()) issues.push('no_exam_angle');
      return [d.nodeId, d.objectives.length, d.sections.length, d.example ? 'yes' : 'no',
              d.misconceptions.length, d.takeaways.length, wc, issues.join(';') || 'none'];
    }),
  ]),
  'utf8',
);

// 4) COPYRIGHT_AND_ATTRIBUTION_REGISTER.csv — one row per distinct source grouping
const sources = new Map<string, number>();
for (const q of all) {
  const key = `${q.tier}|${q.examYear}|${q.bookletCode ?? 'no-booklet-code'}`;
  sources.set(key, (sources.get(key) ?? 0) + 1);
}
await writeFile(
  `${out}/COPYRIGHT_AND_ATTRIBUTION_REGISTER.csv`,
  csv([
    ['source_key', 'tier', 'exam_year', 'booklet_code', 'item_count', 'rights_holder', 'usage_basis', 'status'],
    ...[...sources.keys()].sort().map((key) => {
      const [tier, year, booklet] = key.split('|');
      return [
        key, tier, year, booklet, sources.get(key)!,
        'سازمان سنجش آموزش ایران',
        tier === 'quarantine'
          ? 'quarantined_internal_only_not_served'
          : 'transcribed_exam_items_with_full_attribution_pending_owner_decision',
        'pending_owner_review',
      ];
    }),
  ]),
  'utf8',
);

console.log('PHASE 2 REPORTS: generated');
console.log(`- audit rows: ${all.length}`);
console.log(`- coverage rows: ${sections.size}`);
console.log(`- lesson rows: ${ALL_LESSON_DEEP_DIVES.length}`);
console.log(`- copyright source groups: ${sources.size}`);
