#!/usr/bin/env node
/**
 * V2-072 — Engine import check: list all importers of @ael/engine and legacy engine paths.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const importers = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const p = resolve(dir, name);
    let entries = null;
    try { entries = readdirSync(p); } catch {}
    if (entries) { walk(p); continue; }
    if (!['.ts', '.tsx', '.js', '.mjs'].includes(extname(p))) continue;
    const text = readFileSync(p, 'utf8');
    if (text.includes('@ael/engine') || text.includes('learning-engine')) {
      const kind = text.includes('@ael/engine') ? '@ael/engine' : 'learning-engine-path';
      importers.push({ file: p.replace(root, ''), kind });
    }
  }
}
walk(resolve(root, 'packages'));
walk(resolve(root, 'apps'));
walk(resolve(root, 'src'));
walk(resolve(root, 'scripts'));
walk(resolve(root, 'tools'));

importers.sort((a, b) => a.file.localeCompare(b.file));
console.log(`engine-imports: ${importers.length} files`);
for (const i of importers) console.log(`  ${i.kind} :: ${i.file}`);

// legacy engine paths: src/engine/aelEngine.ts
const legacy = [];
try {
  const files = [];
  (function w(d) {
    for (const n of readdirSync(d)) {
      const p = resolve(d, n);
      try { w(p); } catch {
        if (n === 'aelEngine.ts' || n.includes('legacy')) files.push(p.replace(root, ''));
      }
    }
  })(resolve(root, 'src'));
  console.log(`legacy candidates: ${files.join(', ') || 'none'}`);
} catch (e) { console.log('legacy scan skipped:', e.message); }
