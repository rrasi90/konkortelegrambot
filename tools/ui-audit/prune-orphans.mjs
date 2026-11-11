// حذف PNGهای orphan (فایل‌هایی که در MANIFEST نیستند) — dry-run پیش‌فرض؛ --apply برای حذف واقعی
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'artifacts/ui-audit/2026-11-11';
const SHOTS = path.join(ROOT, 'screenshots');
const APPLY = process.argv.includes('--apply');

const csv = fs.readFileSync(path.join(ROOT, 'MANIFEST.csv'), 'utf8');
const referenced = new Set();
const lines = csv.trim().split('\n').slice(1);
for (const line of lines) {
  const m = line.match(/"([^"]*\/[^"]*\.png)"/);
  if (m) referenced.add(m[1].replaceAll('\\\\', '/'));
}

let orphans = 0;
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!f.endsWith('.png')) continue;
    // مقایسه با base = پوشهٔ screenshots (مطابق ستون filename در MANIFEST)
    const rel = path.relative(SHOTS, p).split(path.sep).join('/');
    if (!referenced.has(rel)) {
      orphans += 1;
      console.log('ORPHAN:', rel);
      if (APPLY) fs.unlinkSync(p);
    }
  }
};
walk(SHOTS);
console.log(`orphans: ${orphans} | manifest rows: ${lines.length} | mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
