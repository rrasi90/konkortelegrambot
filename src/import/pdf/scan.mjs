/**
 * AEL-313 — Stage 0/1: Recursive scan + File Signature + SHA-256 + Registry.
 * قواعد سند §6 Stage 0/1 و §12.2:
 *  - پسوند کافی نیست؛ امضای `%PDF-` بررسی می‌شود.
 *  - Hash بایت‌های Original؛ Registry محلی پایدار و Idempotent.
 *  - Original هرگز rename/move/delete نمی‌شود.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';

export const REGISTRY_VERSION = 1;

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** امضای واقعی PDF — %PDF- در ۱۰۲۴ بایت اول (اجازه BOM/whitespace جزئی) */
export function pdfSignatureOk(path) {
  const fd = readFileSync(path);
  const head = fd.subarray(0, 1024).toString('latin1');
  return head.includes('%PDF-');
}

export function scanPdfFolder(rootDir, inputDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.toLowerCase().endsWith('.pdf')) continue;
      files.push(full);
    }
  };
  walk(inputDir);
  return files;
}

export function buildScanReport(rootDir, inputDir, previousRegistry) {
  const report = { scannedFiles: 0, validPdfs: 0, invalid: [], newSources: [], exactDuplicates: [], newVersions: [], alreadyProcessed: [], entries: [] };
  for (const path of scanPdfFolder(rootDir, inputDir)) {
    report.scannedFiles += 1;
    const rel = relative(rootDir, path).split('\\').join('/');
    const stat = statSync(path);
    const entry = {
      basename: basename(path),
      relative_path: rel,
      byte_size: stat.size,
      sha256: null,
      signature_ok: false,
      status: 'rejected',
    };
    if (stat.size === 0) { entry.status = 'rejected'; entry.reason = 'PDF_EMPTY'; report.invalid.push({ relative_path: rel, reason: 'PDF_EMPTY' }); report.entries.push(entry); continue; }
    if (!pdfSignatureOk(path)) { entry.status = 'rejected'; entry.reason = 'PDF_INVALID_SIGNATURE'; report.invalid.push({ relative_path: rel, reason: 'PDF_INVALID_SIGNATURE' }); report.entries.push(entry); continue; }
    entry.signature_ok = true;
    entry.sha256 = sha256File(path);
    report.validPdfs += 1;

    const prior = previousRegistry.sources?.[entry.sha256];
    if (prior) {
      if (prior.relative_path === rel) { entry.status = 'already_processed'; report.alreadyProcessed.push(rel); }
      else { entry.status = 'exact_duplicate'; entry.duplicate_of = prior.sha256; report.exactDuplicates.push({ relative_path: rel, of: prior.relative_path }); }
    } else {
      // نسخه: فایل با مسیر قبلی ثبت‌شده اما Hash متفاوت = Version جدید
      const priorByPath = Object.values(previousRegistry.sources ?? {}).find(row => row.relative_path === rel);
      entry.status = priorByPath ? 'new_version' : 'new_source';
      if (priorByPath) { entry.previous_sha256 = priorByPath.sha256; report.newVersions.push(rel); }
      else report.newSources.push(rel);
    }
    report.entries.push(entry);
  }
  return report;
}

/** Registry پایدار: source_id/version deterministic بر اساس SHA-256 (سند §12 — هر اجرا ID جدید نسازد) */
export function updateRegistry(rootDir, registryPath, scanReport) {
  const registry = existsSync(registryPath)
    ? JSON.parse(readFileSync(registryPath, 'utf8'))
    : { registry_version: REGISTRY_VERSION, sources: {} };
  for (const entry of scanReport.entries) {
    if (!entry.sha256) continue;
    if (!registry.sources[entry.sha256]) {
      registry.sources[entry.sha256] = {
        source_id: `src-${entry.sha256.slice(0, 16)}`,
        source_version_id: `sv-${entry.sha256.slice(0, 16)}`,
        relative_path: entry.relative_path,
        basename: entry.basename,
        byte_size: entry.byte_size,
        sha256: entry.sha256,
        first_seen_at: new Date().toISOString(),
      };
    }
  }
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, JSON.stringify(registry, null, 1));
  return registry;
}
