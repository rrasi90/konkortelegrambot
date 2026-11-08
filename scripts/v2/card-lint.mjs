#!/usr/bin/env node
/**
 * V2-063 — Card lint: validate draft flashcards (proposed/cards.draft.jsonl if present,
 * otherwise learning-course questions as card proxies) for schema + quality gates.
 * Exit 1 if any hard failure (empty front/back, duplicate id).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const draftPath = resolve(root, 'docs/ael-implementation/v2/proposed/cards.draft.jsonl');
const ids = new Set();
let cards = [];

if (existsSync(draftPath)) {
  const text = readFileSync(draftPath, 'utf8');
  cards = text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  console.log(`card-lint: reading draft ${draftPath} (${cards.length} cards)`);
} else {
  const files = readdirSync(resolve(root, 'content/learning-courses')).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const pack = JSON.parse(readFileSync(resolve(root, 'content/learning-courses/' + f), 'utf8'));
    for (const q of pack.questions ?? []) cards.push({ id: q.id, front: q.prompt, back: q.explanation, file: f });
  }
  console.log(`card-lint: no draft found, linting ${cards.length} learning questions as proxies`);
}

let failures = 0;
for (const c of cards) {
  if (!c.id || !c.front || !c.back) { console.log(`FAIL missing field: ${JSON.stringify(c).slice(0, 100)}`); failures++; continue; }
  if (ids.has(c.id)) { console.log(`FAIL duplicate: ${c.id}`); failures++; }
  ids.add(c.id);
}
console.log(`card-lint: ${cards.length} cards, ${failures} failures`);
process.exit(failures ? 1 : 0);
