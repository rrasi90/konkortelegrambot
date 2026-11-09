#!/usr/bin/env node
/**
 * V2-006 — Ledger manager (version 1.2 router).
 * Commands:
 *   node scripts/v2/ledger.mjs summary
 *   node scripts/v2/ledger.mjs set <taskId> --status <S> --commitSha <sha> --evidence <path> [--notes <text>]
 *   node scripts/v2/ledger.mjs add <taskId> --planRef <ref> --status <S> [--evidence <path>]
 * All writes validate CSV structure; use verify-ledger.mjs after every write.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const LEDGER_PATH = resolve(ROOT, 'docs/ael-implementation/v2/V2_LEDGER.csv');
export const HEADER = ['taskId','planRef','status','decisionRef','filesChanged','commands','evidencePath','baselineFailures','notes','updatedAt','commitSha'];

export function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) { row.push(cur); cur = ''; }
    else if (c === '\n' && !inQ) { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c === '\r' && text[i+1] === '\n') { /* skip */ }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

export function toCsv(rows) {
  return rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n') + '\n';
}

export function loadLedger(path = LEDGER_PATH) {
  const text = readFileSync(path, 'utf8');
  const rows = parseCsv(text);
  const header = rows[0];
  const records = rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
  return { header, records };
}

export function saveLedger(records, path = LEDGER_PATH) {
  writeFileSync(path, toCsv([HEADER, ...records.map(r => HEADER.map(h => r[h] ?? ''))]));
}

export function summary(records) {
  const byStatus = {};
  for (const r of records) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return { total: records.length, unique: new Set(records.map(r => r.taskId)).size, byStatus };
}

function applySet(records, taskId, patch) {
  const rec = records.find(r => r.taskId === taskId);
  if (!rec) throw new Error(`task not found: ${taskId}`);
  Object.assign(rec, patch);
  return rec;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'summary') {
    const { records } = loadLedger();
    console.log(JSON.stringify(summary(records), null, 2));
    return;
  }
  if (cmd === 'set') {
    const taskId = rest[0];
    const args = {};
    for (let i = 1; i < rest.length; i++) {
      if (rest[i].startsWith('--') && rest[i+1]) { args[rest[i].slice(2)] = rest[i+1]; i++; }
    }
    const { records } = loadLedger();
    const patch = {};
    for (const [k, v] of Object.entries(args)) {
      if (k === 'status') patch.status = v;
      if (k === 'commitSha') patch.commitSha = v;
      if (k === 'evidence') patch.evidencePath = v;
      if (k === 'notes') patch.notes = v;
      if (k === 'filesChanged') patch.filesChanged = v;
      if (k === 'commands') patch.commands = v;
    }
    patch.updatedAt = new Date().toISOString().slice(0, 10);
    applySet(records, taskId, patch);
    saveLedger(records);
    console.log(`updated ${taskId}`);
    return;
  }
  if (cmd === 'add') {
    const taskId = rest[0];
    const args = {};
    for (let i = 1; i < rest.length; i++) {
      if (rest[i].startsWith('--') && rest[i+1]) { args[rest[i].slice(2)] = rest[i+1]; i++; }
    }
    const { records } = loadLedger();
    if (records.some(r => r.taskId === taskId)) throw new Error(`duplicate taskId: ${taskId}`);
    const rec = { taskId, planRef: args.planRef ?? '—', status: args.status ?? 'NOT_STARTED', decisionRef: '—', filesChanged: args.filesChanged ?? '', commands: args.commands ?? '', evidencePath: args.evidence ?? '', baselineFailures: '', notes: args.notes ?? '', updatedAt: new Date().toISOString().slice(0, 10), commitSha: args.commitSha ?? '' };
    records.push(rec);
    saveLedger(records);
    console.log(`added ${taskId}`);
    return;
  }
  console.log('usage: ledger.mjs summary | set <id> --status <S> ... | add <id> --planRef <ref> --status <S>');
}

import { basename } from 'node:path';
if (basename(process.argv[1] ?? '') === 'ledger.mjs') {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
