/**
 * AEL-313 CLI — اسکن پوشه pdf/ و به‌روزرسانی Registry (بدون پردازش سنگین).
 *   node scripts/ael-pdf-scan.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildScanReport, updateRegistry } from '../src/import/pdf/scan.mjs';

const root = process.cwd();
const inputDir = join(root, 'pdf');
const registryPath = join(root, '.ael-work', 'pdf-ingestion', 'registry', 'registry.json');
mkdirSync(join(root, '.ael-work', 'pdf-ingestion', 'registry'), { recursive: true });

const previous = existsOrDefault(registryPath);
function existsOrDefault(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return { registry_version: 1, sources: {} }; }
}

const report = buildScanReport(root, inputDir, previous);
updateRegistry(root, registryPath, report);

const batchDir = join(root, '.ael-work', 'pdf-ingestion', 'batches');
mkdirSync(batchDir, { recursive: true });
const batchId = `scan-${new Date().toISOString().replace(/[:.]/g, '-')}`;
writeFileSync(join(batchDir, `${batchId}.json`), JSON.stringify({ batchId, ...report }, null, 1));

console.log(JSON.stringify({
  batchId,
  scannedFiles: report.scannedFiles,
  validPdfs: report.validPdfs,
  invalid: report.invalid,
  newSources: report.newSources.length,
  exactDuplicates: report.exactDuplicates.length,
  newVersions: report.newVersions.length,
  alreadyProcessed: report.alreadyProcessed.length,
}, null, 1));
