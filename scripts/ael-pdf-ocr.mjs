/**
 * AEL-313/304/306 — Batch OCR با MinerU محلی (local-only، بدون Remote).
 *   node scripts/ael-pdf-ocr.mjs --keys           # فقط کلیدها
 *   node scripts/ael-pdf-ocr.mjs --limit N        # سقف تعداد فایل این اجرا
 * خروجی: .ael-work/pdf-ingestion/mineru-cache/{source_id}/*.md — قابل ازسرگیری (skip کش موجود)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const KEYS_ONLY = process.argv.includes('--keys');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx > -1 ? Number(process.argv[limitIdx + 1]) : Infinity;

const registryPath = join(root, '.ael-work', 'pdf-ingestion', 'registry', 'registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const cacheDir = join(root, '.ael-work', 'pdf-ingestion', 'mineru-cache');
mkdirSync(cacheDir, { recursive: true });

const jobs = Object.values(registry.sources).filter(source => {
  const outDir = join(cacheDir, source.source_id);
  if (existsSync(outDir) && readdirSync(outDir).some(name => name.endsWith('.md'))) return false; // قابل ازسرگیری
  if (KEYS_ONLY && !/جواب|پاسخ|کلید/.test(source.basename)) return false;
  return true;
}).slice(0, LIMIT === Infinity ? undefined : LIMIT);

const results = [];
for (const [index, source] of jobs.entries()) {
  const outDir = join(cacheDir, source.source_id);
  mkdirSync(outDir, { recursive: true });
  const fullPath = join(root, source.relative_path);
  console.log(`[${index + 1}/${jobs.length}] OCR: ${source.basename}`);
  try {
    execFileSync('mineru-kit', ['parse', fullPath, '-o', outDir, '--tier', 'standard'], { stdio: 'pipe', timeout: 30 * 60_000 });
    const mdFile = readdirSync(outDir).find(name => name.endsWith('.md'));
    results.push({ source_id: source.source_id, basename: source.basename, status: 'parsed', md: mdFile });
  } catch (error) {
    results.push({ source_id: source.source_id, basename: source.basename, status: 'failed', error: String(error.message).slice(0, 200) });
  }
  writeFileSync(join(root, '.ael-work', 'pdf-ingestion', 'registry', 'ocr-progress.json'), JSON.stringify({ updated_at: new Date().toISOString(), results }, null, 1));
}
console.log(JSON.stringify({ done: results.filter(row => row.status === 'parsed').length, failed: results.filter(row => row.status !== 'parsed').length, remaining: Object.values(registry.sources).length - results.length }));
