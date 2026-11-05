/**
 * AEL-313 v2 CLI — Ingest با Metadata Extraction مستقل (بدون Hardcode §3)،
 * Page Reconstruction (§4)، دو مسیر Native/MinerU (§5)، Pairing واقعی در Front Matter (§8.4).
 * حقوق: خروجی محلی؛ Push متن کامل نیازمند تصمیم مالک.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildScanReport, updateRegistry } from '../src/import/pdf/scan.mjs';
import { classifyDocument } from '../src/import/pdf/classify.mjs';
import { extractMetadata } from '../src/import/pdf/metadata.mjs';
import { pairPapersAndKeys } from '../src/import/pdf/pair-answer-keys.mjs';
import { loadMiddleJson } from '../src/import/pdf/pages.mjs';
import { extractPdfText } from '../src/import/normalize.mjs';

const root = process.cwd();
const registryPath = join(root, '.ael-work', 'pdf-ingestion', 'registry', 'registry.json');
const manifestDir = join(root, '.ael-work', 'pdf-ingestion', 'ocr-manifests');
const previous = existsSync(registryPath) ? JSON.parse(readFileSync(registryPath, 'utf8')) : { registry_version: 1, sources: {} };
const PIPELINE_VERSION = '2';

// ---------- Stage 0/1: Scan ----------
const report = buildScanReport(root, join(root, 'pdf'), previous);
const registry = updateRegistry(root, registryPath, report);
const targets = report.entries.filter(row =>
  row.status === 'new_source' || row.status === 'new_version' || row.status === 'already_processed');

function readManifest(sourceId) {
  const path = join(manifestDir, `${sourceId}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}
function loadMineruPages(sourceId) {
  return loadMiddleJson(join(root, '.ael-work', 'pdf-ingestion', 'mineru-cache', sourceId), sourceId);
}

// ---------- Stage 4: Page Reconstruction (دو مسیر §5) ----------
const documents = [];
for (const entry of targets) {
  const source = registry.sources[entry.sha256];
  const fullPath = join(root, entry.relative_path);
  let pages, parseMethod;

  const manifest = readManifest(source.source_id);
  const mineruPages = loadMineruPages(source.source_id);
  if (mineruPages && manifest && ['completed', 'partial'].includes(manifest.status)) {
    pages = mineruPages; parseMethod = 'mineru'; // مسیر B — صفحات واقعی از middle_json
  } else {
    const native = await extractPdfText(fullPath);
    const textChars = native.pages.reduce((sum, page) => sum + (page.text ?? '').length, 0);
    if (textChars > 200 * native.pageCount) {
      pages = native.pages.map(page => ({ ...page, text_normalized: undefined })); // مسیر A
      parseMethod = 'native_text';
    } else {
      pages = native.pages; parseMethod = 'needs_ocr'; // اسکن‌شده — در صف OCR (§5: به آرشیو ناقص منتقل نمی‌شود)
    }
  }

  const classification = classifyDocument(entry.basename, pages);
  const metadata = extractMetadata(entry.basename, pages);
  metadata.document_type = {
    value: classification.document_type,
    status: classification.document_type === 'unknown' ? 'needs_review' : 'proposed',
    confidence: classification.document_type === 'unknown' ? null : 0.85,
    evidence: classification.evidence,
    candidate_values: [],
  };

  documents.push({
    registry: source,
    entry,
    basename: entry.basename,
    parseMethod,
    pageCount: pages.length,
    frontText: pages.slice(0, 3).map(page => page.text ?? '').join('\n').slice(0, 4000),
    pages,
    metadata,
    document_type: classification.document_type,
    classification_status: classification.classification_status,
    evidence: classification.evidence,
  });
}

// ---------- Stage 7: Pairing ----------
const papers = documents.filter(row => row.document_type === 'exam_paper');
const keys = documents.filter(row => row.document_type === 'answer_key');
const pairs = pairPapersAndKeys(papers, keys);
const pairByKey = new Map(pairs.map(pair => [pair.key, pair]));

// ---------- Stage 10: Archive محلی — هر دو مسیر، Front Matter واقعی (§8.4) ----------
const archiveDir = join(root, '.ael-work', 'pdf-ingestion', 'archive');
mkdirSync(archiveDir, { recursive: true });
let archivedCount = 0;
for (const doc of documents) {
  if (doc.parseMethod === 'needs_ocr') continue; // §5: بدون OCR به آرشیو ناقص نمی‌رود
  const pair = pairByKey.get(doc.registry.source_id);
  const meta = doc.metadata;
  const yamlField = (field) => field && field.value !== null && field.value !== undefined ? JSON.stringify(field.value) : 'null';
  const year = meta.exam_year.value ?? 'unknown';
  const docDir = join(archiveDir, doc.registry.source_id);
  mkdirSync(docDir, { recursive: true });
  let bodyMarkdown;
  if (doc.parseMethod === 'mineru') {
    const outDir = join(root, '.ael-work', 'pdf-ingestion', 'mineru-cache', doc.registry.source_id);
    const mdFile = existsSync(outDir) ? readdirSync(outDir).find(name => name.endsWith('.md')) : null;
    bodyMarkdown = mdFile ? readFileSync(join(outDir, mdFile), 'utf8') : doc.pages.map(page => page.text).join('\n\n');
  } else {
    bodyMarkdown = doc.pages.map(page => `<!-- page ${page.pageNumber} -->\n\n${page.text}`).join('\n\n---\n\n');
  }
  const front = [
    '---',
    `document_id: ${doc.registry.source_id}`,
    `source_id: ${doc.registry.source_id}`,
    `source_version_id: ${doc.registry.source_version_id}`,
    `document_type: ${doc.document_type}`,
    `exam_family: ${yamlField(meta.exam_family)}`,
    `exam_level: ${yamlField(meta.exam_level)}`,
    `exam_year: ${year}`,
    `exam_year_status: ${meta.exam_year.status}`,
    `exam_authority: ${yamlField(meta.exam_authority)}`,
    `track_id: ${yamlField(meta.track_id)}`,
    `exam_set_code: ${yamlField(meta.exam_set_code)}`,
    `combination_code: ${yamlField(meta.combination_code)}`,
    `booklet_code: ${yamlField(meta.booklet_code)}`,
    `field_title_fa: ${yamlField(meta.field_title_fa)}`,
    `course_offering_id: ${yamlField(meta.course_offering_id)}`,
    `paired_document_id: ${pair?.paired_document_id ? JSON.stringify(pair.paired_document_id) : 'null'}`,
    `pairing_status: ${pair?.pairing_status ?? 'unresolved'}`,
    `pairing_evidence: ${pair ? JSON.stringify(pair.evidence) : '[]'}`,
    `classification_status: ${doc.classification_status}`,
    `rights_status: pending_review`,
    `verification_status: pending_official_check`,
    `source_pdf_sha256: "${doc.entry.sha256}"`,
    `source_page_count: ${doc.pageCount}`,
    `source_file_present_in_git: false`,
    `pipeline_version: ${PIPELINE_VERSION}`,
    `parser: ${doc.parseMethod}`,
    `language: fa`,
    `content_version: 1`,
    '---', '',
  ].join('\n');
  writeFileSync(join(docDir, `${doc.document_type}.md`), front + bodyMarkdown);
  archivedCount += 1;
}

// ---------- Batch Report — فقط داده واقعی (§10) ----------
const batchId = `ingest-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;
const realPdfInGit = 0; // ارزیابی واقعی توسط scripts/ael-pdf-guard.mjs جداگانه انجام و گزارش می‌شود
const batchReport = {
  batchId,
  pipelineVersion: PIPELINE_VERSION,
  scannedFiles: report.scannedFiles,
  validPdfs: report.validPdfs,
  invalidPdfs: report.invalid.length,
  exactDuplicates: report.exactDuplicates.length,
  newSources: report.newSources.length,
  newVersions: report.newVersions.length,
  alreadyProcessed: report.alreadyProcessed.length,
  processedNow: documents.length,
  nativeTextParsed: documents.filter(row => row.parseMethod === 'native_text').length,
  mineruParsed: documents.filter(row => row.parseMethod === 'mineru').length,
  needsOcr: documents.filter(row => row.parseMethod === 'needs_ocr').length,
  documentTypes: documents.reduce((acc, row) => { acc[row.document_type] = (acc[row.document_type] ?? 0) + 1; return acc; }, {}),
  classifiedDocuments: documents.filter(row => row.document_type !== 'unknown').length,
  unknownDocumentTypes: documents.filter(row => row.document_type === 'unknown').length,
  yearUncertain: documents.filter(row => row.metadata.exam_year.status !== 'proposed').length,
  examYearsDetected: [...new Set(documents.map(row => row.metadata.exam_year.value).filter(Boolean))].sort(),
  examPapers: papers.length,
  answerKeys: keys.length,
  candidatePairings: pairs.filter(pair => pair.pairing_status === 'candidate').length,
  needsReviewPairings: pairs.filter(pair => pair.pairing_status === 'needs_review').length,
  unresolvedPairings: pairs.filter(pair => pair.pairing_status === 'unresolved').length,
  confirmedPairings: 0, // فقط با تأیید انسانی (§8.3) — هیچ Pair خودکار confirmed نمی‌شود
  rightsPending: documents.length,
  archivedLocally: archivedCount,
  pdfFilesAddedToGitIndex: realPdfInGit,
  rightsNote: 'rights_status=pending_review → Archive کامل فقط محلی؛ Push نیازمند تصمیم مالک',
};
const batchDir = join(root, '.ael-work', 'pdf-ingestion', 'batches');
mkdirSync(batchDir, { recursive: true });
writeFileSync(join(batchDir, `${batchId}.json`), JSON.stringify({
  batchReport,
  documents: documents.map(({ registry: r, basename, document_type, metadata, parseMethod, pageCount }) => ({
    source_id: r.source_id, basename, document_type,
    exam_year: metadata.exam_year.value ?? null, exam_year_status: metadata.exam_year.status,
    exam_set_code: metadata.exam_set_code.value, booklet_code: metadata.booklet_code.value,
    parseMethod, pageCount,
  })),
}, null, 1));
console.log(JSON.stringify(batchReport, null, 1));
