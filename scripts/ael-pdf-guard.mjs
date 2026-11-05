/**
 * AEL-315 — Git PDF Guard — Fail-Closed (سند §9):
 * Base نامعتبر / خطای git diff / PDF در Stage-Commit-Untracked-Diff = همه Fail.
 * PDFهای legacy در base اشکال ندارند؛ فقط افزودن/تغییر جدید نسبت به base ممنوع.
 *   node scripts/ael-pdf-guard.mjs [base-ref]
 */
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const base = process.argv[2] ?? 'origin/main';
const violations = [];
const failures = [];

function git(args, optional = false) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch (error) {
    if (optional) return null;
    failures.push({ check: `git ${args.join(' ')}`, error: String(error.message).split('\n')[0] });
    return null;
  }
}

// ۰) Base معتبر باشد — Fail-Closed (§9-1/§9-2)
const baseOk = git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`], true);
if (baseOk === null || baseOk === '') {
  failures.push({ check: `base ref '${base}'`, error: 'BASE_REF_UNRESOLVABLE' });
} else {
  // ۱) فایل‌های Stage شده
  const staged = git(['diff', '--name-only', '--cached']) ?? '';
  for (const file of staged.split('\n').filter(Boolean)) {
    if (file.toLowerCase().endsWith('.pdf')) violations.push({ file, rule: 'staged_pdf' });
  }
  // ۲) Untracked خارج از Ignore
  const untracked = git(['ls-files', '-o', '--exclude-standard']) ?? '';
  for (const file of untracked.split('\n').filter(Boolean)) {
    if (file.toLowerCase().endsWith('.pdf')) violations.push({ file, rule: 'untracked_pdf_outside_ignore' });
  }
  // ۳) Diff نسبت به base — فقط افزودن/تغییر PDF (حذف legacy = مشکل جدا، اینجا Fail نمی‌شود)
  const diff = git(['diff', '--name-status', `${base}...HEAD`, '--', '*.pdf']) ?? '';
  for (const line of diff.split('\n').filter(Boolean)) {
    const [status, file] = line.split('\t');
    if (file && status !== 'D') violations.push({ file, rule: `diff_${status}_pdf_vs_${base}` });
  }
  // ۴) شاخه‌های کاری مسیرهای متفاوت — Guard از ریشه اجرا می‌شود (مسیرهای نسبی ثابت)
}

if (failures.length) {
  console.error('PDF_GUARD_FAILED (environment): بررسی‌های Git واقعی اجرا نشدند — Fail-Closed');
  for (const failure of failures) console.error(` - [${failure.check}] ${failure.error}`);
  process.exit(2);
}
if (violations.length) {
  console.error('PDF_GUARD_FAILED: ورود PDF به Git ممنوع است (AEL-PDF-ARCHIVE-001 §2-1/§13.3)');
  for (const violation of violations) console.error(` - [${violation.rule}] ${violation.file}`);
  process.exit(1);
}
console.log(`PDF_GUARD_PASS: base='${base}' · Stage/Untracked/Diff بدون PDF جدید.`);
