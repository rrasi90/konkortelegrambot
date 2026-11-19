/**
 * خط لولهٔ کلید استنباطی — گام دو برنامهٔ پوشش.
 *
 * هر سؤال سه مسیر دارد (کلید رسمی / کلید استنباطی / بدون کلید). این اسکریپت
 * مسیر دوم را می‌سازد: استنتاج فقط وقتی ثبت می‌شود که پنج شرط §۴.۲ برقرار باشد:
 * داده کامل، بدون سرریز عددی، دو استدلال مستقل هم‌خوان، شاهد از داخل مخزن،
 * و ثبت تعارض با کلید رسمی. تعارض هرگز خودکار وارد بانک نمی‌شود.
 *
 * حالت‌ها:
 *   --measure          شمارش جمعیت قابل‌استنتاج (تخمین نمی‌دهد؛ می‌شمارد)
 *   --export           بسته‌های استنتاج را در content/exam-key-evidence/derivation-batches می‌نویسد
 *   --import           خروجی گذرهای A/B را می‌خواند، دروازه را اجرا و کلیدها را می‌نویسد
 *
 * اجرا: node --import tsx scripts/derive-exam-keys.mts [--measure|--export|--import]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  citationFoundInRepo,
  loadOfficialEvidence,
  normalizeText,
  numericMarginOk,
  sanityCheckQuestion,
} from './lib/derivation-gate.mts';
import { corroboratesFa, docxText } from './lib/docx-text.mts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv.find((item) => item.startsWith('--')) ?? '--measure';

const batchesDir = join(root, 'content', 'exam-key-evidence', 'derivation-batches');
const evidenceDir = join(root, 'content', 'exam-key-evidence');

interface PoolQuestion {
  id: string;
  year: number;
  number: number;
  sectionId: string;
  stem: string;
  options: string[];
  /** متن بازبینی‌شده انسانی معتبرتر از متن خام OCR است. */
  textSource: 'reviewed' | 'raw';
  /** گزینهٔ بدون برچسب هرگز استنتاج نمی‌شود؛ فقط به کارگاه بازبینی می‌رود (§۳.۲). */
  optionsSource?: 'labels' | 'sequence';
}

async function loadBankIds(): Promise<Set<string>> {
  const { YEARLY_KONKOR_QUESTIONS } = (await import(
    pathToFileURL(join(root, 'src', 'data', 'yearlyKonkorExams.ts')).href
  )) as { YEARLY_KONKOR_QUESTIONS: { id: string }[] };
  return new Set(YEARLY_KONKOR_QUESTIONS.map((question) => question.id));
}

/** جمعیت استنتاج: هر سؤالِ استخراج‌شده یا بازبینی‌شده که در بانک نیست و کلید رسمی ندارد یا دارد. */
async function buildPool(): Promise<PoolQuestion[]> {
  const bankIds = await loadBankIds();
  const evidence = loadOfficialEvidence();

  const extracted = (JSON.parse(
    readFileSync(join(root, 'content', 'exam-import-staging', 'ocr-persian', 'extracted.json'), 'utf8'),
  ) as { questions: { examYear: number; sectionId: string; number: number; stem: string; options: string[]; optionsSource?: 'labels' | 'sequence' }[] })
    .questions;

  const pool = new Map<string, PoolQuestion>();
  const add = (item: PoolQuestion) => {
    if (item.optionsSource === 'sequence' && item.textSource !== 'reviewed') return;
    const existing = pool.get(item.id);
    // متن بازبینی‌شده بر خام مقدم است؛ متن خام فقط اگر هیچ نسخهٔ بهتری نباشد می‌ماند.
    if (!existing || (existing.textSource === 'raw' && item.textSource === 'reviewed')) {
      pool.set(item.id, item);
    }
  };

  for (const q of extracted) {
    const id = `q.k${q.examYear}.${q.number}`;
    if (bankIds.has(id)) continue;
    const key = evidence[String(q.examYear)]?.entries[String(q.number)];
    add({
      id, year: q.examYear, number: q.number, sectionId: q.sectionId,
      stem: q.stem, options: q.options, textSource: 'raw', optionsSource: q.optionsSource,
    });
    void key;
  }

  // متن‌های بازبینی‌شدهٔ human-reviewed (content/exam-review/<year>.json) با کیفیت بالاتر.
  const reviewDir = join(root, 'content', 'exam-review');
  for (const name of readdirSync(reviewDir)) {
    if (!/^\d{4}\.json$/.test(name)) continue;
    const payload = JSON.parse(readFileSync(join(reviewDir, name), 'utf8')) as {
      year: number;
      reviewed: { number: number; sectionId: string; text: string; options: string[]; skip?: boolean }[];
    };
    for (const r of payload.reviewed) {
      if (r.skip === true) continue; // بازبین صریح رد کرده؛ دوباره زنده نمی‌شود.
      const id = `q.k${payload.year}.${r.number}`;
      if (bankIds.has(id)) continue;
      add({
        id, year: payload.year, number: r.number, sectionId: r.sectionId,
        stem: r.text, options: r.options, textSource: 'reviewed',
      });
    }
  }

  // فقط سؤال‌هایی که ساختاراً قابل استدلال‌اند؛ ناقص هرگز استنتاج نمی‌شود (شرط ۱).
  const ready: PoolQuestion[] = [];
  for (const item of pool.values()) {
    const problems = sanityCheckQuestion({ stem: item.stem, options: item.options });
    if (problems.length === 0) ready.push(item);
  }
  return ready.sort((a, b) => (a.year - b.year) || (a.number - b.number));
}

async function measure(): Promise<void> {
  const pool = await buildPool();
  const evidence = loadOfficialEvidence();
  const bySection: Record<string, { total: number; keyless: number; reviewed: number; numeric: number }> = {};
  for (const q of pool) {
    const hasKey = typeof evidence[String(q.year)]?.entries[String(q.number)] === 'number';
    const entry = (bySection[q.sectionId] ??= { total: 0, keyless: 0, reviewed: 0, numeric: 0 });
    entry.total += 1;
    if (!hasKey) entry.keyless += 1;
    if (q.textSource === 'reviewed') entry.reviewed += 1;
    if (numericMarginOk(q.options, 1).mode === 'numeric' || numericMarginOk(q.options, 2).mode === 'numeric') {
      entry.numeric += 1;
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    poolSize: pool.length,
    bySection,
    note: 'جمعیت واردِ دروازه؛ «keyless» یعنی بدون کلید رسمی، «numeric» یعنی گزینه‌های عددیِ قابل سنجش.',
  };
  writeFileSync(join(evidenceDir, 'derivation-measure.json'), `${JSON.stringify(report, null, 1)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 1));
}

const run = async (): Promise<void> => {
  if (mode === '--measure') return measure();
  if (mode === '--export') return exportBatches();
  if (mode === '--import') return importResults();
  if (mode === '--write-bank') return writeBank();
  if (mode === '--audit-sample') return makeAuditSample();
  if (mode === '--audit-check') return auditCheck();
  console.error('حالت ناشناخته: --measure | --export | --import | --write-bank | --audit-sample | --audit-check');
  process.exit(2);
};

// ---- write-bank ----
/** نوشتن سؤال‌های دارای کلید استنباطی به بانک (متن کلاینت، کلید سمت سرور — R-036). */
async function writeBank(): Promise<void> {
  const derivedFile = join(evidenceDir, 'derived-keys.json');
  if (!existsSync(derivedFile)) {
    console.error('derived-keys.json نیست؛ اول --import را اجرا کن.');
    process.exit(1);
  }
  const keys = JSON.parse(readFileSync(derivedFile, 'utf8')) as {
    keys: Record<string, { id: string; year: number; number: number; sectionId: string; derivation: string }>;
  };
  const pool = new Map((await buildPool()).map((q) => [q.id, q]));
  const { KONKOR_COURSE_SECTIONS } = (await import(
    pathToFileURL(join(root, 'src', 'data', 'yearlyKonkorExams.ts')).href
  )) as { KONKOR_COURSE_SECTIONS: { id: string; title: string; defaultNodeId: string | null }[] };

  const rows = Object.values(keys.keys)
    .filter((record) => pool.has(record.id))
    .map((record) => {
      const q = pool.get(record.id)!;
      const section = KONKOR_COURSE_SECTIONS.find((item) => item.id === q.sectionId);
      return {
        id: record.id,
        nodeId: section?.defaultNodeId ?? null,
        examYear: q.year,
        examLevel: 'ارشد' as const,
        bookletQuestionNumber: q.number,
        courseSectionId: q.sectionId,
        courseSectionTitle: section?.title ?? q.sectionId,
        designedFromTextbook: `دفترچهٔ رسمی ارشد ${q.year} — درس ${section?.title ?? q.sectionId}`,
        sourceReference:
          `کنکور ارشد مدیریت ${q.year} — سؤال ${q.number}؛ کلید استنباطی بدون پاسخنامه، ` +
          `متن ${q.textSource === 'reviewed' ? 'بازبینی‌شده' : 'استخراج‌شده'} از دفترچه`,
        text: q.stem,
        options: q.options,
        expectedTimeMs: 80_000,
      };
    })
    .filter((row) => row.nodeId !== null);

  const header = `/**
 * GENERATED FILE — دست نزنید.
 *
 * سؤال‌های دارای کلید استنباطی (برچسب: «کلید استنباطی — بدون پاسخنامه»).
 * کلید عمداً اینجا نیست (R-036) و در apps/worker/src/data/exam-derived-keys.json نگه داشته می‌شود.
 * بازتولید: node --import tsx scripts/derive-exam-keys.mts --write-bank
 */
import type { YearlyKonkorQuestion } from './yearlyKonkorExams';

export const EXAM_ARCHIVE_DERIVED_QUESTIONS: YearlyKonkorQuestion[] = ${JSON.stringify(rows, null, 2)};
`;
  writeFileSync(join(root, 'src', 'data', 'examArchiveDerived.ts'), header, 'utf8');
  console.log(`DERIVED_BANK_WRITTEN ${rows.length}`);
}

// ---- export ----
async function exportBatches(): Promise<void> {
  const pool = await buildPool();
  mkdirSync(join(batchesDir, 'out'), { recursive: true });
  const BATCH = 45;
  const manifest: { file: string; count: number }[] = [];
  for (let start = 0; start < pool.length; start += BATCH) {
    const chunk = pool.slice(start, start + BATCH);
    const file = join(batchesDir, `batch-${String(start / BATCH + 1).padStart(2, '0')}.json`);
    writeFileSync(file, `${JSON.stringify(chunk, null, 1)}\n`, 'utf8');
    manifest.push({ file: file.split(/[\\/]/).pop()!, count: chunk.length });
  }
  writeFileSync(join(batchesDir, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), pool: pool.length, batches: manifest }, null, 1)}\n`, 'utf8');
  console.log(`EXPORTED pool=${pool.length} batches=${manifest.length}`);
}

// ---- import ----
interface PassRecord {
  id: string;
  layer?: 'D1' | 'D2' | 'R';
  answerOption?: number;
  derivation?: string;
  citation?: string;
  optionsRejected?: Record<string, string> | string[];
}

async function readPass(pass: 'A' | 'B'): Promise<Map<string, PassRecord>> {
  const out = new Map<string, PassRecord>();
  const dir = join(batchesDir, 'out');
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(`.${pass}.json`)) continue;
    const items = JSON.parse(readFileSync(join(dir, name), 'utf8')) as PassRecord[];
    for (const item of items) out.set(item.id, item);
  }
  return out;
}

async function importResults(): Promise<void> {
  const pool = await buildPool();
  const byId = new Map(pool.map((q) => [q.id, q]));

  // ضدتکرار: متن یکسان در دو سال (سؤال تکراریِ ادوار) نباید دو کلید بسازد؛
  // آدیت بانک «متن سؤال تکراری» را نقض می‌داند.
  const { YEARLY_KONKOR_QUESTIONS } = (await import(
    pathToFileURL(join(root, 'src', 'data', 'yearlyKonkorExams.ts')).href
  )) as { YEARLY_KONKOR_QUESTIONS: { id: string; text: string }[] };
  const stemSeen = new Map<string, string>();
  for (const question of YEARLY_KONKOR_QUESTIONS) {
    stemSeen.set(normalizeText(question.text), question.id);
  }
  const passA = await readPass('A');
  const passB = await readPass('B');
  const evidence = loadOfficialEvidence();

  const accepted: Record<string, unknown>[] = [];
  const conflicts: Record<string, unknown>[] = [];
  const unresolved: Record<string, unknown>[] = [];
  const rejected: Record<string, unknown>[] = [];

  // شاهد دومِ §۳.۱: متن خام OCR باید در docx همان سال هم خوانده شود.
  // متن بازبینی‌شده انسانی از این شرط معاف است (بازبین خودِ او یک شاهد دوم بود).
  const docxCache = new Map<number, string | null>();
  const docxFor = (year: number): string | null => {
    if (!docxCache.has(year)) {
      docxCache.set(year, docxText(join(root, 'docs', 'exam-ocr', '1142', `1142-${year}.docx`)));
    }
    return docxCache.get(year) ?? null;
  };

  for (const [id, a] of passA) {
    const q = byId.get(id);
    if (!q) { rejected.push({ id, reason: 'در جمعیت دروازه نیست (متن یا ساختار رد شده)' }); continue; }
    const b = passB.get(id);
    if (!b) { rejected.push({ id, reason: 'گذر دوم موجود نیست' }); continue; }
    if (q.textSource === 'raw') {
      const witness = docxFor(q.year);
      const corroboration = corroboratesFa({ text: q.stem, options: q.options }, witness);
      if (!corroboration.ok) {
        rejected.push({ id, reason: `شاهد دوم (docx همان سال) متن خام را تأیید نکرد (واژه ${Math.round(corroboration.wordRatio * 100)}٪، گزینه ${corroboration.optionHits})` });
        continue;
      }
    }
    if (!a.layer || !a.answerOption || !b.answerOption) { rejected.push({ id, reason: 'رکورد ناقص' }); continue; }
    if (a.layer === 'R' || b.layer === 'R') { unresolved.push({ id, reason: 'طبقهٔ R — استنتاج‌ناپذیر' }); continue; }
    if (a.answerOption !== b.answerOption) {
      unresolved.push({ id, reason: `اختلاف دو گذر: A=${a.answerOption} B=${b.answerOption}`, derivationA: a.derivation, derivationB: b.derivation });
      continue;
    }
    // شرط ۲: سرریز عددی.
    const margin = numericMarginOk(q.options, a.answerOption);
    if (!margin.ok) { rejected.push({ id, reason: `سرریز عددی: ${margin.detail}` }); continue; }
    // شرط ۴: شاهد از داخل مخزن.
    let citationOk = true;
    if (a.layer === 'D2') {
      citationOk = await citationFoundInRepo(a.citation ?? '');
      if (!citationOk) { rejected.push({ id, reason: 'نقل D2 در مخزن پیدا نشد' }); continue; }
    }
    // شرط ۳: رد همهٔ رقیب‌ها مستند باشد.
    const stemKey = normalizeText(q.stem);
    const twin = stemSeen.get(stemKey);
    if (twin && twin !== id) {
      rejected.push({ id, reason: `متن سؤال تکراری (همسان ${twin})` });
      continue;
    }
    stemSeen.set(stemKey, id);
    const rejects = a.optionsRejected;
    const rejectEntries = Array.isArray(rejects) ? rejects : Object.values(rejects ?? {});
    if (rejectEntries.length < 3) { rejected.push({ id, reason: 'رد گزینه‌های رقیب کامل نیست' }); continue; }
    if (!a.derivation || normalizeText(a.derivation).length < 40) { rejected.push({ id, reason: 'استدلال خیلی کوتاه است' }); continue; }

    // شرط ۵: مقابله با کلید رسمی.
    const official = evidence[String(q.year)]?.entries[String(q.number)];
    let officialAgreement: 'no-official-key' | 'derived_confirmed' | 'derived_conflict' = 'no-official-key';
    if (typeof official === 'number') {
      officialAgreement = official === a.answerOption ? 'derived_confirmed' : 'derived_conflict';
    }
    const record = {
      id,
      year: q.year,
      number: q.number,
      sectionId: q.sectionId,
      answerOption: a.answerOption,
      layer: a.layer,
      derivation: a.derivation,
      citation: a.citation ?? '',
      method: a.layer === 'D1' ? 'computation' : 'definition',
      corroboration: 'second_pass_agree' as const,
      optionsRejected: Array.isArray(rejects) ? rejects : Object.entries(rejects ?? {}).map(([key, value]) => `گزینهٔ ${key}: ${value}`),
      textSource: q.textSource,
      officialAgreement,
    };
    if (officialAgreement === 'derived_conflict') {
      conflicts.push({ ...record, officialKey: official });
      continue; // تعارض هرگز خودکار وارد بانک نمی‌شود.
    }
    accepted.push(record);
  }

  for (const [id] of passB) if (!passA.has(id)) rejected.push({ id, reason: 'گذر B بدون معادل در گذر A' });

  // نوشتن شواهد و sidecar.
  const derivedFile = join(evidenceDir, 'derived-keys.json');
  const previous = existsSync(derivedFile)
    ? (JSON.parse(readFileSync(derivedFile, 'utf8')) as { keys: Record<string, Record<string, unknown>> }).keys
    : {};
  for (const record of accepted) previous[String(record.id)] = record;

  writeFileSync(derivedFile, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: 'کلید استنباطی؛ هرگز با برچسب رسمی نمایش داده نمی‌شود (شرط صداقت §۱۰).',
    keys: previous,
  }, null, 1)}\n`, 'utf8');
  writeFileSync(join(evidenceDir, 'derived-conflicts.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), conflicts }, null, 1)}\n`, 'utf8');
  writeFileSync(join(evidenceDir, 'derived-unresolved.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), unresolved }, null, 1)}\n`, 'utf8');

  // sidecar سمت سرور — کلید هرگز به کلاینت نمی‌رود (R-036).
  const sidecarKeys: Record<string, unknown> = {};
  for (const raw of Object.values(previous)) {
    const record = raw as { id: string; year: number; number: number; answerOption: number; derivation: string; optionsRejected: string[] };
    sidecarKeys[record.id] = {
      correctOption: record.answerOption - 1,
      examYear: record.year,
      bookletQuestionNumber: record.number,
      source: `derived:${record.year}:${record.number}`,
      bank: 'examArchiveDerived',
      explanation: `کلید استنباطی — بدون پاسخنامه. ${record.derivation}`,
      trapNote: record.optionsRejected.join(' '),
    };
  }
  writeFileSync(
    join(root, 'apps', 'worker', 'src', 'data', 'exam-derived-keys.json'),
    `${JSON.stringify({ note: 'کلید استنباطی؛ فقط سمت سرور (R-036). بازتولید: derive-exam-keys --import', keys: sidecarKeys }, null, 1)}\n`,
    'utf8',
  );

  void conflicts.length;
  const summary = {
    accepted: accepted.length,
    conflicts: conflicts.length,
    unresolved: unresolved.length,
    rejected: rejected.length,
    rejectedDetail: rejected,
    registrySidecar: Object.keys(sidecarKeys).length,
  };
  writeFileSync(join(evidenceDir, 'derived-import-report.json'), `${JSON.stringify(summary, null, 1)}\n`, 'utf8');
  console.log(`DERIVED_IMPORT accepted=${summary.accepted} conflicts=${summary.conflicts} unresolved=${summary.unresolved} rejected=${summary.rejected} sidecar=${summary.registrySidecar}`);
}

// ---- audit-sample ----
/** نمونهٔ ۱۰٪ با.Hash پایدار برای بازاستخراج مستقل؛ بدون استدلال اولیه (§۴.۵). */
async function makeAuditSample(): Promise<void> {
  const derivedFile = join(evidenceDir, 'derived-keys.json');
  if (!existsSync(derivedFile)) {
    console.log('AUDIT_SAMPLE empty — derived-keys.json نیست.');
    return;
  }
  const { keys } = JSON.parse(readFileSync(derivedFile, 'utf8')) as { keys: Record<string, unknown> };
  // صورت‌ها از خود بسته‌های استنتاج خوانده می‌شوند؛ پس از write-bank سؤال در بانک است و در جمعیت نهفته نیست.
  const byId = new Map<string, unknown>();
  for (const name of readdirSync(batchesDir)) {
    if (!/^batch-\d+\.json$/.test(name)) continue;
    for (const q of JSON.parse(readFileSync(join(batchesDir, name), 'utf8')) as { id: string }[]) {
      byId.set(q.id, q);
    }
  }
  const ids = Object.keys(keys).sort();
  const picked = ids.filter((id) => {
    let h = 0;
    for (const ch of id + 'audit-v1') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % 10 === 0;
  });
  const sample = picked
    .map((id) => byId.get(id))
    .filter(Boolean);
  writeFileSync(join(batchesDir, 'audit-sample.json'), `${JSON.stringify(sample, null, 1)}\n`, 'utf8');
  console.log(`AUDIT_SAMPLE ${sample.length} از ${ids.length} (نرخ نمونه ${ids.length ? Math.round((sample.length / ids.length) * 100) : 0}٪)`);
}

// ---- audit-check ----
/** §۴.۵: نرخ توافق بازاستخراج مستقل؛ زیر ۹۰٪ یعنی قاعده باید سخت‌تر شود. */
async function auditCheck(): Promise<void> {
  const samplePath = join(batchesDir, 'audit-sample.json');
  const auditPath = join(batchesDir, 'out', 'audit.AUDIT.json');
  const derivedFile = join(evidenceDir, 'derived-keys.json');
  if (!existsSync(auditPath) || !existsSync(derivedFile)) {
    console.log('AUDIT_CHECK ناتمام است: بازاستخراج یا شواهد موجود نیست.');
    return;
  }
  const sample = new Set((JSON.parse(readFileSync(samplePath, 'utf8')) as { id: string }[]).map((q) => q.id));
  const { keys } = JSON.parse(readFileSync(derivedFile, 'utf8')) as {
    keys: Record<string, { answerOption: number }>;
  };
  const audit = JSON.parse(readFileSync(auditPath, 'utf8')) as { id: string; answerOption: number | null }[];
  let compared = 0;
  let agreed = 0;
  const mismatches: { id: string; accepted: number; auditor: number | null }[] = [];
  for (const record of audit) {
    if (!sample.has(record.id)) continue;
    const accepted = keys[record.id];
    if (!accepted) continue;
    compared += 1;
    if (record.answerOption === accepted.answerOption) agreed += 1;
    else mismatches.push({ id: record.id, accepted: accepted.answerOption, auditor: record.answerOption });
  }
  const rate = compared === 0 ? 0 : Math.round((agreed / compared) * 1000) / 10;
  const report = { compared, agreed, agreementPercent: rate, pass: rate >= 90, mismatches };
  writeFileSync(join(evidenceDir, 'derivation-audit.json'), `${JSON.stringify(report, null, 1)}\n`, 'utf8');
  console.log(`AUDIT_CHECK compared=${compared} agreed=${agreed} rate=${rate}٪ pass=${report.pass}`);
}

await run();
