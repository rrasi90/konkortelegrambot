/**
 * AEL-315 — Git PDF Guard: هر PDF جدید در Stage/Commit = Fail (سند §13.4).
 * PDFهای legacy tracked (public/assets/aistudio) در Diff نسبت به base چک می‌شوند نه در کل مخزن.
 *   node scripts/ael-pdf-guard.mjs [base-ref]
 */
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const base = process.argv[2] ?? 'origin/main';
const violations = [];

// ۱) فایل‌های Stage شده
let staged = [];
try { staged = git(['diff', '--name-only', '--cached']).split('\n').filter(Boolean); } catch { /* بدون Stage */ }
for (const file of staged) if (file.toLowerCase().endsWith('.pdf')) violations.push({ file, rule: 'staged_pdf' });

// ۲) فایل‌های Untracked قابل Stage در pdf/
let untracked = [];
try { untracked = git(['ls-files', '-o', '--exclude-standard']).split('\n').filter(Boolean); } catch { /* خالی */ }
for (const file of untracked) if (file.toLowerCase().endsWith('.pdf')) violations.push({ file, rule: 'untracked_pdf_outside_ignore' });

// ۳) Diff شاخه نسبت به base — PDF جدید/تغییریافته
let diff = [];
try { diff = git(['diff', '--name-status', `${base}...HEAD`, '--', '*.pdf']).split('\n').filter(Boolean); } catch { /* بدون base */ }
for (const line of diff) {
  const [status, file] = line.split('\t');
  if (file && status !== 'D') violations.push({ file, rule: `diff_${status}_pdf_vs_base` });
}

if (violations.length) {
  console.error('PDF_GUARD_FAILED: ورود PDF به Git ممنوع است (AEL-PDF-ARCHIVE-001 §2-1/§13.3)');
  for (const violation of violations) console.error(` - [${violation.rule}] ${violation.file}`);
  process.exit(1);
}
console.log('PDF_GUARD_PASS: هیچ PDF جدیدی در Stage/Commit/Diff نیست.');
