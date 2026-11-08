#!/usr/bin/env node
/**
 * V2-006 — Reading-notes anchor check.
 * Each numbered entry must contain an anchor with file, line range and ref/SHA.
 * Format per entry: "<path>:<start>-<end> @ <ref>" e.g. "BACKLOG_FA.md:1-60 @ f9891a5"
 * Exit 0 only if every numbered entry has such an anchor and the file exists.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOTES = resolve(ROOT, 'docs/ael-implementation/v2/logs/reading-notes.md');

export function checkReadingNotes(text, root = ROOT) {
  const errors = [];
  const lines = text.split('\n');
  let current = null;
  let entries = 0;
  const anchors = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\d+\.\s+\*\*(.+?)\*\*/);
    if (m) {
      if (current) {
        entries++;
        if (!current.anchor) errors.push(`entry ${current.n}: missing anchor "path:lines @ ref"`);
        else anchors.push(current);
      }
      current = { n: entries + 1, title: m[1], anchor: null, block: lines[i] + '\n' };
      const am0 = lines[i].match(/(\S+\.md|\S+\.json|\S+\.ts|\S+\.sql):\d+(?:-\d+)?\s*@\s*(\S+)/);
      if (am0) current.anchor = am0[0];
    } else if (current) {
      current.block += lines[i] + '\n';
      const am = lines[i].match(/(\S+\.md|\S+\.json|\S+\.ts|\S+\.sql):\d+(?:-\d+)?\s*@\s*(\S+)/);
      if (am) current.anchor = am[0];
    }
  }
  if (current) {
    entries++;
    if (!current.anchor) errors.push(`entry ${current.n} (${current.title}): missing anchor "path:lines @ ref"`);
    else anchors.push(current);
  }
  // verify anchor files exist where plausible (skip URLs)
  for (const a of anchors) {
    const m = a.anchor.match(/^(\S+?):\d+(?:-\d+)?\s*@\s*(\S+)/);
    if (m) {
      const p = m[1].replace(/^\(/, '');
      const ref = m[2];
      if (p.startsWith('http')) continue;
      if (existsSync(resolve(root, p))) continue;
      // allow files that exist at the cited ref (e.g. PR15-only migration)
      try {
        execSync(`git cat-file -e ${ref}:${p}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        errors.push(`entry ${a.n} (${a.title}): anchor file not found at ${ref}: ${p}`);
      }
    }
  }
  return { errors, entries };
}

function main() {
  const text = readFileSync(NOTES, 'utf8');
  const { errors, entries } = checkReadingNotes(text);
  console.log(`reading-notes-check: ${entries} entries, ${errors.length} errors`);
  for (const e of errors) console.log(` ERROR ${e}`);
  if (!errors.length) console.log('reading-notes-check: OK');
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1]?.endsWith('reading-notes-check.mjs')) main();
export default main;
