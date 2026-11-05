/**
 * AEL-313 CLI — Ingest کامل: Scan → Parse (MinerU/نام总算) → Classify → Pair → Archive محلی.
 *   node scripts/ael-pdf-ingest.mjs            # پردازش همه PDFهای جدید (محلی)
 *   node scripts/ael-pdf-ingest.mjs --keys-only  # فقط کلیدها (کوچک/سریع)
 * حقوق: خروجی فقط محلی (.ael-work + محلی) — Push متن کامل نیازمند تصمیم مالک (§9.2).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildScanReport, updateRegistry, sha256File } from '../src/import/pdf/scan.mjs';
import { classifyDocument, extractExamYearFromText } from '../src/import/pdf/classify.mjs';
import { pairPapersAndKeys } from '../src/import/pdf/pair-answer-keys.mjs';
import { extractPdfText, normalizePersian } from '../src/import/normalize.mjs';

const root = process.cwd();
const KEYS_ONLY = process.argv.includes('--keys-only');
const registryPath = join(root, '.ael-work', 'pdf-ingestion', 'registry', 'registry.json');
const previous = existsSync(registryPath) ? JSON.parse(readFileSync(registryPath, 'utf8')) : { registry_version: 1, sources: {} };

// ---------- Stage 0/1: Scan + Registry ----------
const report = buildScanReport(root, join(root, 'pdf'), previous);
const registry = updateRegistry(root, registryPath, report);
const targets = report.entries.filter(row =>
  row.status === 'new_source' || row.status === 'new_version' || row.status === 'already_processed');
const selected = KEYS_ONLY
  ? targets.filter(row => /جواب|پاسخ|کلید/.test(row.basename))
  : targets;

// ---------- MinerU md cache (پایلوت قبلی) ----------
const mineruCache = join(root, '.ael-work', 'pdf-ingestion', 'mineru-cache');

function readMineruMarkdown(sha, basename) {
  const source = registry.sources[sha];
  if (!source) return null;
  const outDir = join(mineruCache, source.source_id);
  if (!existsSync(outDir)) return null;
  const mdFile = readdirSync(outDir).find(name => name.endsWith('.md'));
  return mdFile ? { markdown: readFileSync(join(outDir, mdFile), 'utf8'), dir: outDir, file: mdFile } : null;
}

// ---------- Stage 4: Parse (نام总算 متنی فوری؛ اسکن‌شده → MinerU) ----------
const documents = [];
for (const entry of selected) {
  const source = registry.sources[entry.sha256];
  const fullPath = join(root, entry.relative_path);
  let pages, parseMethod;
  if (entry.status === 'already_processed' && readMineruMarkdown(entry.sha256, entry.basename)) {
    const md = readMineruMarkdown(entry.sha256, entry.basename);
    pages = [{ pageNumber: 1, text: md.markdown, extraction_method: 'mineru_cached' }];
    parseMethod = 'mineru';
  } else {
    const native = await extractPdfText(fullPath);
    const textChars = native.pages.reduce((sum, page) => sum + (page.text ?? '').length, 0);
    if (textChars > 200 * native.pageCount) {
      pages = native.pages; parseMethod = 'native_text';
    } else {
      // اسکن‌شده → نیاز به MinerU؛ در این اجرا صف می‌شود تا Batch MinerU جدا اجرا شود
      pages = native.pages; parseMethod = 'needs_ocr';
    }
  }
  const frontText = pages.slice(0, 3).map(page => page.text ?? '').join('\n').slice(0, 4000);
  const classification = classifyDocument(entry.basename, pages);
  documents.push({
    registry: source,
    entry,
    basename: entry.basename,
    parseMethod,
    pageCount: pages.length,
    frontText,
    pages,
    metadata: { exam_year: classification.exam_year },
    document_type: classification.document_type,
    classification_status: classification.classification_status,
    evidence: classification.evidence,
  });
}

// ---------- Stage 7: Pairing ----------
const papers = documents.filter(row => row.document_type === 'exam_paper');
const keys = documents.filter(row => row.document_type === 'answer_key');
const pairs = pairPapersAndKeys(papers, keys);

// ---------- Archive محلی (حقوق: pending_review → فقط محلی) ----------
const archiveDir = join(root, '.ael-work', 'pdf-ingestion', 'archive');
mkdirSync(archiveDir, { recursive: true });
for (const doc of documents) {
  if (doc.parseMethod !== 'mineru' && doc.parseMethod !== 'mineru_cached') continue;
  const mdSource = readMineruMarkdown(doc.entry.sha256, doc.basename);
  if (!mdSource) continue;
  const docDir = join(archiveDir, doc.registry.source_id);
  mkdirSync(docDir, { recursive: true });
  const year = doc.metadata.exam_year?.value ?? 'unknown';
  const front = [
    '---',
    `document_id: ${doc.registry.source_id}`,
    `source_id: ${doc.registry.source_id}`,
    `source_version_id: ${doc.registry.source_version_id}`,
    `document_type: ${doc.document_type}`,
    `exam_family: master_admission`,
    `exam_level: master`,
    `exam_year: ${year}`,
    `track_id: business`,
    `exam_set_code: "1142"`,
    `booklet_code: A`,
    `paired_document_id: null`,
    `pairing_status: pending`,
    `classification_status: ${doc.classification_status}`,
    `rights_status: pending_review`,
    `verification_status: pending_official_check`,
    `source_pdf_sha256: "${doc.entry.sha256}"`,
    `source_page_count: ${doc.pageCount}`,
    `source_file_present_in_git: false`,
    `language: fa`,
    `content_version: 1`,
    '---', '',
  ].join('\n');
  writeFileSync(join(docDir, `${doc.document_type}.md`), front + mdSource.markdown);
}

// ---------- Batch Report ----------
const batchId = `ingest-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;
const batchReport = {
  batchId,
  scannedFiles: report.scannedFiles,
  validPdfs: report.validPdfs,
  invalid: report.invalid,
  newSources: report.newSources.length,
  exactDuplicates: report.exactDuplicates.length,
  processedNow: documents.length,
  parseMethods: documents.reduce((acc, row) => { acc[row.parseMethod] = (acc[row.parseMethod] ?? 0) + 1; return acc; }, {}),
  documentTypes: documents.reduce((acc, row) => { acc[row.document_type] = (acc[row.document_type] ?? 0) + 1; return acc; }, {}),
  examYears: documents.map(row => row.metadata.exam_year?.value).filter(Boolean),
  examPapers: papers.length,
  answerKeys: keys.length,
  pairs,
  pdfFilesAddedToGitIndex: 0,
  rightsNote: 'rights_status=pending_review → Markdown کامل فقط محلی؛ Push نیازمند تصمیم مالک (§9.2)',
};
const batchDir = join(root, '.ael-work', 'pdf-ingestion', 'batches');
mkdirSync(batchDir, { recursive: true });
writeFileSync(join(batchDir, `${batchId}.json`), JSON.stringify({ batchReport, documents: documents.map(({ registry: r, basename, document_type, metadata, parseMethod, pageCount }) => ({ source_id: r.source_id, basename, document_type, exam_year: metadata.exam_year?.value ?? null, exam_year_status: metadata.exam_year?.status ?? 'unknown', parseMethod, pageCount })) }, null, 1));
console.log(JSON.stringify(batchReport, null, 1));
