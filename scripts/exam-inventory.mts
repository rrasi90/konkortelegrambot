/**
 * فهرست وضعیت بانک سؤال آزمون‌های مدیریت: چه سالی داریم، چه سالی نداریم و هر
 * سال چقدر پوشش دارد.
 *
 * اجرا: node --import tsx scripts/exam-inventory.mts [--json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');

const { YEARLY_KONKOR_BOOKLETS, YEARLY_KONKOR_QUESTIONS } = (await import(
  pathToFileURL(join(root, 'src', 'data', 'yearlyKonkorExams.ts')).href
)) as {
  YEARLY_KONKOR_BOOKLETS: {
    year: number;
    examLevel?: string;
    totalQuestionsInBooklet: number;
    subjectRanges: { sectionId: string; fromQuestion: number; toQuestion: number }[];
  }[];
  YEARLY_KONKOR_QUESTIONS: {
    id: string;
    examYear: number;
    examLevel?: string;
    courseSectionId: string;
    bookletQuestionNumber?: number;
  }[];
};

interface Evidence {
  years: Record<string, { keyStatus: 'preliminary' | 'final' | 'unknown'; entries: Record<string, number> }>;
}
const evidence = JSON.parse(
  readFileSync(join(root, 'content', 'exam-key-evidence', 'answers-by-year.json'), 'utf8'),
) as Evidence;

const masterYears = YEARLY_KONKOR_BOOKLETS.filter((booklet) => (booklet.examLevel ?? 'ارشد') === 'ارشد');
const doctorateYears = [...new Set([1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404, 1405])];

const bookletSource = (year: number, level: 'master' | 'doctorate'): string => {
  const code = level === 'master' ? '1142' : '2162';
  const docx = existsSync(join(root, 'docs', 'exam-ocr', code, `${code}-${year}.docx`));
  if (docx) return 'OCR docx';
  if (level === 'master') {
    const candidates = [
      `pdf/دفترچه_سؤالات_کنکور_ارشد_مدیریت_${year}.md`,
      'pdf/دانش سوالات.md',
    ];
    if (candidates.some((path) => existsSync(join(root, path)))) return 'MinerU md';
  }
  return '—';
};

const masterRows = masterYears
  .sort((a, b) => a.year - b.year)
  .map((booklet) => {
    const items = YEARLY_KONKOR_QUESTIONS.filter(
      (question) => question.examYear === booklet.year && (question.examLevel ?? 'ارشد') === 'ارشد',
    );
    const keyCount = Object.keys(evidence.years[String(booklet.year)]?.entries ?? {}).length;
    return {
      year: booklet.year,
      declared: booklet.totalQuestionsInBooklet,
      inBank: items.length,
      sections: booklet.subjectRanges.length,
      booklet: bookletSource(booklet.year, 'master'),
      keyEntries: keyCount,
      keyStatus: evidence.years[String(booklet.year)]?.keyStatus ?? 'unknown',
    };
  });

const doctorateRows = doctorateYears.map((year) => {
  const items = YEARLY_KONKOR_QUESTIONS.filter(
    (question) => question.examYear === year && (question.examLevel ?? 'ارشد') !== 'ارشد',
  );
  return {
    year,
    declared: 0,
    inBank: items.length,
    sections: 0,
    booklet: bookletSource(year, 'doctorate'),
    keyEntries: Object.keys(evidence.years[String(year)]?.entries ?? {}).length,
    keyStatus: evidence.years[String(year)]?.keyStatus ?? 'unknown',
  };
});

if (asJson) {
  console.log(JSON.stringify({ master: masterRows, doctorate: doctorateRows }, null, 1));
} else {
  const lines: string[] = [];
  lines.push('| سال | ارشد اعلامی | ارشد موجود | دفترچه | کلید | دکتری موجود | دفترچه |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const row of masterRows) {
    const phd = doctorateRows.find((entry) => entry.year === row.year);
    lines.push(
      `| ${row.year} | ${row.declared} | ${row.inBank} | ${row.booklet} | ${row.keyEntries} (${row.keyStatus}) | ${phd?.inBank ?? 0} | ${phd?.booklet ?? '—'} |`,
    );
  }
  console.log(lines.join('\n'));
  const declaredTotal = masterRows.reduce((sum, row) => sum + row.declared, 0);
  const bankTotal = masterRows.reduce((sum, row) => sum + row.inBank, 0);
  const phdTotal = doctorateRows.reduce((sum, row) => sum + row.inBank, 0);
  console.log(`\nارشد: ${bankTotal} از ${declaredTotal} (${((bankTotal / declaredTotal) * 100).toFixed(1)}٪)`);
  console.log(`دکتری: ${phdTotal} سؤال در بانک`);
}
