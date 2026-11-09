#!/usr/bin/env node
/**
 * V2-014 — Doc link check: verify relative markdown links in key docs resolve.
 * Output: docs/ael-implementation/v2/reports/C12_miniapp_truth.md
 * Scope: root markdown + docs subfolders + v2 folder
 *        (only links whose target looks like a repo file; https/mailto skipped)
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

const scope = [];
function walk(dir, recursive = true) {
  try {
    for (const name of readdirSync(dir)) {
      const p = resolve(dir, name);
      if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
      if (name.endsWith('.md')) scope.push(p);
      if (recursive) {
        try {
          const stat = readdirSync(p);
          walk(p);
        } catch {}
      }
    }
  } catch {}
}

// limited scope: root md + docs/*.md (one level) + v2
for (const name of readdirSync(root)) {
  if (name.endsWith('.md')) scope.push(resolve(root, name));
}
const docsDir = resolve(root, 'docs');
if (existsSync(docsDir)) {
  for (const name of readdirSync(docsDir)) {
    const p = resolve(docsDir, name);
    try {
      const inner = readdirSync(p);
      for (const f of inner) if (f.endsWith('.md')) scope.push(resolve(p, f));
    } catch {
      if (name.endsWith('.md')) scope.push(p);
    }
  }
}
const v2dir = resolve(root, 'docs/ael-implementation/v2');
(function walkV2(dir) {
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (name.endsWith('.md')) scope.push(p);
    try { walkV2(p); } catch {}
  }
})(v2dir);

const linkRe = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
let total = 0, ok = 0;
const broken = [];

for (const file of [...new Set(scope)]) {
  let text = '';
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  // strip fenced code blocks for link extraction
  text = text.replace(/```[\s\S]*?```/g, '');
  let m;
  while ((m = linkRe.exec(text))) {
    const target = m[2].trim();
    if (!target || target.startsWith('http') || target.startsWith('mailto:') || target.startsWith('#')) continue;
    // strip anchor
    const pathPart = target.split('#')[0];
    if (!pathPart) continue;
    total++;
    const resolved = normalize(resolve(dirname(file), decodeURIComponent(pathPart)));
    if (existsSync(resolved)) ok++;
    else broken.push({ file: file.replace(root, ''), target });
  }
}

const lines = [];
lines.push('# بررسی لینک اسناد (C12)');
lines.push('');
lines.push(`- اسناد بررسی‌شده: ${new Set(scope).size}`);
lines.push(`- لینک‌های داخلی: ${total}`);
lines.push(`- موجود: ${ok}`);
lines.push(`- شکسته: ${broken.length}`);
lines.push('');
if (broken.length) {
  lines.push('## لینک‌های شکسته');
  lines.push('');
  for (const b of broken.slice(0, 200)) lines.push(`- ${b.file} → ${b.target}`);
} else lines.push('همه لینک‌های داخلی معتبرند.');
lines.push('');
lines.push('> نکته: لینک‌های بیرونی (https/mailto) و anchor-only بررسی نشدند. کدهای داخل fence کنار گذاشته شدند.');

mkdirSync(resolve(root, 'docs/ael-implementation/v2/reports'), { recursive: true });
writeFileSync(resolve(root, 'docs/ael-implementation/v2/reports/C12_miniapp_truth.md'), lines.join('\n') + '\n');
console.log(`doc-link-check: ${total} links, ${broken.length} broken`);
