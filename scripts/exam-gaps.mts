/**
 * دفتر شکاف بانک سؤال: چه سالی چه مقدار پوشش دارد و بزرگ‌ترین شکاف بعدی کجاست.
 *
 * این ابزار حافظهٔ حلقهٔ کار است. هر دور فقط بزرگ‌ترین شکاف را برمی‌دارد، می‌بندد و
 * دوباره همین‌جا اندازه می‌گیرد. هیچ عددی در این فایل دستی نوشته نمی‌شود.
 *
 * اجرا: node --import tsx scripts/exam-gaps.mts [--from=1396] [--to=1405] [--json]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const arg = (name: string, fallback: number): number => {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};

const { YEARLY_KONKOR_BOOKLETS, YEARLY_KONKOR_QUESTIONS, KONKOR_COURSE_SECTIONS } = (await import(
  pathToFileURL(join(root, 'src', 'data', 'yearlyKonkorExams.ts')).href
)) as {
  YEARLY_KONKOR_BOOKLETS: {
    year: number;
    totalQuestionsInBooklet: number;
    examLevel?: string;
    declaredVerified?: boolean;
    declaredEvidence?: string[];
    subjectRanges: { sectionId: string; fromQuestion: number; toQuestion: number; title: string }[];
  }[];
  YEARLY_KONKOR_QUESTIONS: {
    id: string;
    examYear: number;
    examLevel?: string;
    courseSectionId: string;
    bookletQuestionNumber?: number;
  }[];
  KONKOR_COURSE_SECTIONS: { id: string; title: string; defaultNodeId: string | null }[];
};

const evidence = JSON.parse(
  readFileSync(join(root, 'content', 'exam-key-evidence', 'answers-by-year.json'), 'utf8'),
) as { years: Record<string, { keyStatus: string; entries: Record<string, number> }> };

const stagingPath = join(root, 'content', 'exam-import-staging', 'ocr-persian', 'report.json');
const staging = existsSync(stagingPath)
  ? (JSON.parse(readFileSync(stagingPath, 'utf8')) as {
      generatedAt: string;
      report: {
        year: number;
        declared?: number;
        extracted?: number;
        candidates?: number;
        kept?: number;
        sectionsComplete?: number;
        sectionsIncomplete?: number;
        reasons?: Record<string, number>;
      }[];
    })
  : null;

const masters = YEARLY_KONKOR_BOOKLETS.filter((booklet) => (booklet.examLevel ?? 'ارشد') === 'ارشد');
const maxYear = Math.max(...masters.map((booklet) => booklet.year));
const from = arg('from', maxYear - 9);
const to = arg('to', maxYear);
const windowYears = masters
  .map((booklet) => booklet.year)
  .filter((year) => year >= from && year <= to)
  .sort((a, b) => a - b);

const rows = windowYears.map((year) => {
  const booklet = masters.find((item) => item.year === year)!;
  const inBank = YEARLY_KONKOR_QUESTIONS.filter(
    (question) => question.examYear === year && (question.examLevel ?? 'ارشد') === 'ارشد',
  ).length;
  const declared = booklet.totalQuestionsInBooklet;
  const record = staging?.report.find((item) => item.year === year);
  const keyEntries = Object.keys(evidence.years[String(year)]?.entries ?? {}).length;
  const ranged = booklet.subjectRanges.reduce(
    (sum, range) => sum + (range.toQuestion - range.fromQuestion + 1),
    0,
  );
  return {
    year,
    declared,
    declaredVerified: booklet.declaredVerified === true,
    inBank,
    missing: declared - inBank,
    percent: declared === 0 ? 0 : Math.round((inBank / declared) * 1000) / 10,
    extracted: record?.extracted ?? 0,
    staged: record?.kept ?? 0,
    keyEntries,
    keyStatus: evidence.years[String(year)]?.keyStatus ?? 'unknown',
    rangeComplete: ranged === declared,
  };
});

const doctorate = YEARLY_KONKOR_QUESTIONS.filter((question) => (question.examLevel ?? 'ارشد') !== 'ارشد');

/** شکاف به تفکیک درس: کدام درس‌ها پوشش ندارند، نه فقط کدام سال‌ها. */
const declaredBySection: Record<string, number> = {};
for (const booklet of masters) {
  if (booklet.year < from || booklet.year > to) continue;
  for (const range of booklet.subjectRanges) {
    declaredBySection[range.sectionId] =
      (declaredBySection[range.sectionId] ?? 0) + (range.toQuestion - range.fromQuestion + 1);
  }
}
const bankBySection: Record<string, number> = {};
for (const question of YEARLY_KONKOR_QUESTIONS) {
  if (question.examYear < from || question.examYear > to) continue;
  if ((question.examLevel ?? 'ارشد') !== 'ارشد') continue;
  bankBySection[question.courseSectionId] = (bankBySection[question.courseSectionId] ?? 0) + 1;
}
const bySection = Object.entries(declaredBySection)
  .map(([sectionId, declared]) => {
    const inBank = bankBySection[sectionId] ?? 0;
    return {
      sectionId,
      title: KONKOR_COURSE_SECTIONS.find((section) => section.id === sectionId)?.title ?? sectionId,
      declared,
      inBank,
      percent: declared === 0 ? 0 : Math.round((inBank / declared) * 1000) / 10,
    };
  })
  .sort((left, right) => left.percent - right.percent);

const declaredTotal = rows.reduce((sum, row) => sum + row.declared, 0);
const bankTotal = rows.reduce((sum, row) => sum + row.inBank, 0);
const stagedTotal = rows.reduce((sum, row) => sum + row.staged, 0);
const verifiedRows = rows.filter((row) => row.declaredVerified);
const verifiedDeclaredTotal = verifiedRows.reduce((sum, row) => sum + row.declared, 0);
const verifiedBankTotal = verifiedRows.reduce((sum, row) => sum + row.inBank, 0);
const verifiedStagedTotal = verifiedRows.reduce((sum, row) => sum + row.staged, 0);
const biggest = [...rows].sort((a, b) => b.missing - a.missing)[0] ?? null;

/** دلیل واقعی توقف هر سال؛ تا وقتی برطرف نشود، حلقه سراغ همان سال نمی‌رود. */
const blockers = rows.flatMap((row) => {
  const items: string[] = [];
  if (!row.rangeComplete) items.push(`${row.year}: جدول بازهٔ درس ناقص است`);
  if (!row.declaredVerified) {
    items.push(`${row.year}: مخرج با شاهد دوم تأیید نشده؛ برای این سال درصد گزارش نمی‌شود`);
  }
  if (row.keyEntries === 0) items.push(`${row.year}: سند کلید رسمی در دسترس نیست`);
  if (row.extracted === 0) items.push(`${row.year}: متن دفترچه استخراج نشد`);
  return items;
});

/** گلوگاهی که به سال خاصی وابسته نیست و کل دفترچه‌ها را نصف می‌کند. */
const sectionBlockers = KONKOR_COURSE_SECTIONS.filter((section) => !section.defaultNodeId).map(
  (section) => `${section.title}: گرهٔ برنامهٔ درسی ندارد؛ سؤال این درس وارد بانک نمی‌شود`,
);
blockers.push(...sectionBlockers);

// درس‌هایی که گره دارند ولی استخراج‌شان تقریباً صفر است؛ مانع، متن دفترچه است نه بانک.
const weakSections = bySection.filter((row) => row.percent < 5 && row.declared > 0);
for (const row of weakSections) {
  if (KONKOR_COURSE_SECTIONS.find((section) => section.id === row.sectionId)?.defaultNodeId) {
    blockers.push(
      `${row.title}: پوشش ${row.percent}٪ — سؤال‌های این درس در OCR قابل استخراج نیستند`,
    );
  }
}

const ledger = {
  generatedAt: new Date().toISOString(),
  window: { from, to, years: windowYears.length, level: 'ارشد' },
  totals: {
    declared: declaredTotal,
    inBank: bankTotal,
    staged: stagedTotal,
    percentInBank: declaredTotal === 0 ? 0 : Math.round((bankTotal / declaredTotal) * 1000) / 10,
    percentWithStaged:
      declaredTotal === 0 ? 0 : Math.round(((bankTotal + stagedTotal) / declaredTotal) * 1000) / 10,
    /** دو عدد جدای پوشش؛ هرگز با هم مخلوط نمی‌شوند. */
    officialCoverage: verifiedDeclaredTotal === 0
      ? null
      : Math.round((verifiedBankTotal / verifiedDeclaredTotal) * 1000) / 10,
    totalCoverage: verifiedDeclaredTotal === 0
      ? null
      : Math.round(((verifiedBankTotal + verifiedStagedTotal) / verifiedDeclaredTotal) * 1000) / 10,
    verifiedDenominator: verifiedDeclaredTotal,
    verifiedYears: verifiedRows.map((row) => row.year),
  },
  doctorate: {
    inBank: doctorate.length,
    declared: null,
    note: 'مخرج دکتری صفر است؛ تا ثبت دفترچهٔ رسمی درصد پوشش معنا ندارد.',
  },
  biggestGap: biggest,
  blockers,
  bySection,
  rows,
  stagingGeneratedAt: staging?.generatedAt ?? null,
};

writeFileSync(
  join(root, 'content', 'exam-coverage-gaps.json'),
  `${JSON.stringify(ledger, null, 2)}\n`,
  'utf8',
);

if (asJson) {
  console.log(JSON.stringify(ledger, null, 2));
} else {
  const lines = [
    `| سال | اعلامی | مخرج | در بانک | درصد | استخراج‌شده | آمادهٔ بازبینی | کلید | بازهٔ درس |`,
    `| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |`,
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.year} | ${row.declared} | ${row.declaredVerified ? 'تأییدشده' : 'بی‌شاهد'} | ${row.inBank} | ${row.declaredVerified ? `${row.percent}٪` : `— (${row.inBank} سؤال)`} | ${row.extracted} | ${row.staged} | ${row.keyEntries} (${row.keyStatus}) | ${row.rangeComplete ? 'کامل' : 'ناقص'} |`,
    );
  }
  console.log(lines.join('\n'));
  console.log(
    `\nارشد ${from} تا ${to}: ${bankTotal} از ${declaredTotal} در بانک (${ledger.totals.percentInBank}٪) ` +
      `و ${stagedTotal} نامزد آمادهٔ بازبینی (با آن‌ها ${ledger.totals.percentWithStaged}٪).`,
  );
  if (verifiedDeclaredTotal > 0) {
    console.log(
      `پوشش رسمی روی مخرج تأییدشده (${verifiedRows.map((row) => row.year).join('، ')}): ` +
        `${verifiedBankTotal} از ${verifiedDeclaredTotal}، یعنی ${ledger.totals.officialCoverage}٪؛ ` +
        `با نامزدهای بازبینی‌شده ${ledger.totals.totalCoverage}٪.`,
    );
  }
  console.log(
    `\nارشد ${from} تا ${to}: ${bankTotal} از ${declaredTotal} در بانک (${ledger.totals.percentInBank}٪) ` +
      `و ${stagedTotal} نامزد آمادهٔ بازبینی (با آن‌ها ${ledger.totals.percentWithStaged}٪).`,
  );
  console.log(`دکتری در بانک: ${doctorate.length} سؤال؛ مخرج رسمی ثبت نشده است.`);
  if (biggest) console.log(`بزرگ‌ترین شکاف بعدی: ${biggest.year} با ${biggest.missing} سؤال.`);
  if (blockers.length > 0) {
    console.log('\nگلوگاه‌ها:');
    for (const blocker of blockers) console.log(`  - ${blocker}`);
  }
}
