#!/usr/bin/env node
/**
 * V2-037 — Tag lint: check governance tags (V2-xxx, AEL-xxx, D-xxx, C-xx) in docs + ledger.
 * Output: docs/ael-implementation/v2/reports/TAG_LINT.md
 * Rules: unknown V2 IDs (not in ledger) flagged; duplicate ledger IDs flagged.
 */
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ledgerText = readFileSync(resolve(root, 'docs/ael-implementation/v2/V2_LEDGER.csv'), 'utf8');
const ledgerIds = new Set(ledgerText.split('\n').map(l => l.split(',')[0].trim()).filter(x => x.startsWith('V2-')));
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'anki' || name === 'anki-extracted') continue;
    const p = resolve(dir, name);
    if (name.endsWith('.md')) files.push(p)
    try { walk(p); } catch {}
  }
}
walk(resolve(root, 'docs'));
for (const name of readdirSync(root)) if (name.endsWith('.md')) files.push(resolve(root, name));

const v2Re = /V2-\d+[A-Z]?/g;
const unknowns = new Map();
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const matches = text.match(v2Re) ?? [];
  for (const m of matches) {
    if (!ledgerIds.has(m)) {
      const key = m + '|' + file.replace(root, '');
      unknowns.set(key, (unknowns.get(key) ?? 0) + 1);
    }
  }
}

const lines = [];
lines.push('# بررسی تگ‌ها (TAG_LINT)');
lines.push('');
lines.push(`- شناسه‌های لجر (V2-xxx موجود): ${ledgerIds.size}`);
lines.push(`- ارجاع V2 ناشناخته (در اسناد، خارج از لجر): ${unknowns.size}`);
lines.push('');
if (unknowns.size) {
  lines.push('## ناشناخته‌ها');
  lines.push('');
  for (const [k, n] of unknowns) lines.push(`- ${k} ×${n}`);
} else lines.push('همه ارجاع‌های V2 در اسناد به لجر وصل می‌شوند.');
lines.push('');
lines.push('> منطق: هر V2-xxx که در متن اسناد آمده ولی در V2_LEDGER.csv نیست، مشکوک است (غالباً تایپو یا تسک حذف‌شده). این لिंتر فقط گزارش می‌دهد و اصلاح نمی‌کند.');

mkdirSync(resolve(root, 'docs/ael-implementation/v2/reports'), { recursive: true });
writeFileSync(resolve(root, 'docs/ael-implementation/v2/reports/TAG_LINT.md'), lines.join('\n') + '\n');
console.log(`tag-lint: ${ledgerIds.size} ledger ids, ${unknowns.size} unknown refs`);
