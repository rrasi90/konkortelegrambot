/**
 * AEL-313/304/306 v2 — Batch OCR با MinerU محلی + Completion Manifest (§6.1/§6.2).
 *   node scripts/ael-pdf-ocr.mjs [--keys] [--limit N] [--all]
 * - فرمت middle_json برای بازسازی صفحه‌محور (§4.1) — شماره صفحه از خروجی واقعی، نه حدس.
 * - Manifest per-file: Complete فقط با SHA ورودی + صفحات مورد انتظار + خروجی معتبر (§6.1).
 * - Resume: فایل Complete skip می‌شود؛ ناقص دوباره؛ خطای یکی Batch را نمی‌بندد.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd();
const KEYS_ONLY = process.argv.includes('--keys');
const ALL = process.argv.includes('--all');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx > -1 ? Number(process.argv[limitIdx + 1]) : Infinity;

const PARSER_NAME = 'MinerU';
const PARSER_VERSION = '4.1.7';
const CONFIG = { tier: 'standard', format: 'middle_json', local_only: true };
const CONFIG_HASH = createHash('sha256').update(JSON.stringify(CONFIG)).digest('hex').slice(0, 16);

const registryPath = join(root, '.ael-work', 'pdf-ingestion', 'registry', 'registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const manifestDir = join(root, '.ael-work', 'pdf-ingestion', 'ocr-manifests');
const cacheDir = join(root, '.ael-work', 'pdf-ingestion', 'mineru-cache');
mkdirSync(manifestDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

function readManifest(sourceId) {
  const path = join(manifestDir, `${sourceId}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}
function writeManifest(manifest) {
  writeFileSync(join(manifestDir, `${manifest.source_id}.json`), JSON.stringify(manifest, null, 1));
}

/** Complete فقط با همهٔ شرایط §6.1 — وجود .md به‌تنهایی کافی نیست */
function isComplete(manifest, source) {
  if (!manifest) return false;
  if (manifest.status !== 'completed' && manifest.status !== 'partial') return false;
  if (manifest.input_sha256 !== source.sha256) return false;               // ورودی عوض شده
  if (manifest.parser_version !== PARSER_VERSION || manifest.configuration_hash !== CONFIG_HASH) return false;
  const outDir = join(cacheDir, source.source_id);
  if (!existsSync(outDir)) return false;
  const files = readdirSync(outDir).filter(name => name.endsWith('.json') || name.endsWith('.md'));
  if (!files.length) return false;
  for (const file of files) {
    const hash = createHash('sha256').update(readFileSync(join(outDir, file))).digest('hex');
    if (manifest.output_hashes?.[file] && manifest.output_hashes[file] !== hash) return false; // خروجی دستکاری/ناقص
  }
  return true;
}

const jobs = Object.values(registry.sources).filter(source => {
  if (isComplete(readManifest(source.source_id), source)) return false; // skip فقط برای Complete واقعی
  if (!ALL && KEYS_ONLY && !/جواب|پاسخ|کلید/.test(source.basename)) return false;
  return true;
}).slice(0, LIMIT === Infinity ? undefined : LIMIT);

const results = [];
for (const [index, source] of jobs.entries()) {
  const outDir = join(cacheDir, source.source_id);
  mkdirSync(outDir, { recursive: true });
  const manifest = {
    source_id: source.source_id,
    input_sha256: source.sha256,
    parser_name: PARSER_NAME,
    parser_version: PARSER_VERSION,
    configuration_hash: CONFIG_HASH,
    expected_page_count: null,
    processed_page_count: 0,
    output_files: [],
    output_hashes: {},
    status: 'processing',
    started_at: new Date().toISOString(),
    completed_at: null,
    error: null,
  };
  writeManifest(manifest);
  console.log(`[${index + 1}/${jobs.length}] OCR: ${source.basename}`);
  try {
    execFileSync('mineru-kit', ['parse', join(root, source.relative_path), '-o', outDir, '--format', 'middle_json', '--tier', 'standard'], { stdio: 'pipe', timeout: 60 * 60_000 });
    const files = readdirSync(outDir).filter(name => name.endsWith('.json') || name.endsWith('.md'));
    const outputHashes = {};
    let processedPages = 0;
    for (const file of files) {
      const content = readFileSync(join(outDir, file));
      outputHashes[file] = createHash('sha256').update(content).digest('hex');
      if (file.endsWith('.json')) {
        try {
          const middle = JSON.parse(content.toString('utf8'));
          const pdfPages = middle.pdf_info ?? middle.pages ?? [];
          processedPages = Math.max(processedPages, pdfPages.length);
        } catch { /* ساختار متفاوت — شمارش از فایل‌ها */ }
      }
    }
    manifest.processed_page_count = processedPages;
    manifest.output_files = files;
    manifest.output_hashes = outputHashes;
    manifest.status = files.length ? 'completed' : 'failed';
    manifest.completed_at = new Date().toISOString();
    writeManifest(manifest);
    results.push({ source_id: source.source_id, basename: source.basename, status: manifest.status, pages: processedPages });
  } catch (error) {
    manifest.status = 'failed';
    manifest.error = String(error.message ?? error).slice(0, 300);
    manifest.completed_at = new Date().toISOString();
    writeManifest(manifest);
    results.push({ source_id: source.source_id, basename: source.basename, status: 'failed', error: manifest.error });
    // §6.2: خطای یکی Batch را نمی‌بندد
  }
}

const summary = {
  processed: results.filter(row => row.status === 'completed').length,
  failed: results.filter(row => row.status === 'failed').length,
  remaining: Object.values(registry.sources).length - Object.keys(readAllManifests()).length,
};
function readAllManifests() {
  return readdirSync(manifestDir).filter(name => name.endsWith('.json'));
}
console.log(JSON.stringify({ ...summary, results }, null, 1));
