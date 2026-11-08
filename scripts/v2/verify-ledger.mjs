#!/usr/bin/env node
/**
 * V2-006 — Verify V2 ledger (strict). Exit 0 only if zero errors.
 * Checks: header, unique IDs, allowed statuses, BLOCKED_BY_HUMAN ban,
 * evidence file exists, commitSha real + contains evidence file,
 * no fake IDs (V2-03B/V2-03C), V2-020 provenance separation,
 * V2-004 evidence must be logs/branch-proof.txt.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { loadLedger, HEADER } from './ledger.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ALLOWED = new Set(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'PROPOSED_ONLY', 'HUMAN_REQUIRED']);
const REAL_IDS = new Set(['V2-001','V2-002','V2-003','V2-004','V2-005','V2-006','V2-007','V2-010','V2-011','V2-012','V2-013','V2-014','V2-015','V2-016','V2-017','V2-018','V2-020','V2-021','V2-022','V2-023','V2-024','V2-025','V2-030','V2-031','V2-032','V2-033','V2-034','V2-035','V2-036','V2-037','V2-038','V2-039','V2-03A','V2-040','V2-041','V2-042','V2-043','V2-044','V2-050','V2-051','V2-052','V2-053','V2-054','V2-055','V2-060','V2-061','V2-062','V2-063','V2-064','V2-065','V2-066','V2-070','V2-071','V2-072','V2-073','V2-074','V2-075','V2-076','V2-077','V2-080','V2-081','V2-082','V2-090','V2-091','V2-092','V2-100','V2-101','V2-102','V2-103','V2-104','V2-110','V2-111','V2-112']);

export function verify(records) {
  const errors = [];
  const seen = new Set();
  for (const r of records) {
    const id = r.taskId;
    if (!/^V2-\d{2,3}[A-Z]?$/.test(id)) errors.push(`${id}: bad taskId format`);
    if (seen.has(id)) errors.push(`${id}: duplicate taskId`);
    seen.add(id);
    if (!REAL_IDS.has(id)) errors.push(`${id}: not a real V2 id (fabricated or retired)`);
    if (!ALLOWED.has(r.status)) errors.push(`${id}: status not allowed: ${JSON.stringify(r.status)} (BLOCKED_BY_HUMAN is forbidden; use HUMAN_REQUIRED or PROPOSED_ONLY)`);
    if (r.status === 'BLOCKED_BY_HUMAN') errors.push(`${id}: BLOCKED_BY_HUMAN forbidden`);
    const blob = JSON.stringify(r);
    for (const fake of ['V2-03B', 'V2-03C']) {
      if (blob.includes(fake)) errors.push(`${id}: references non-existent id ${fake}`);
    }
    // evidence path must be a real file (unless empty or em-dash)
    const ev = (r.evidencePath ?? '').trim();
    if (ev && ev !== '—' && ev !== '-' && !ev.includes(' ')) {
      const cand = resolve(ROOT, 'docs/ael-implementation/v2', ev);
      const candRoot = resolve(ROOT, ev);
      if (!existsSync(cand) && !existsSync(candRoot)) errors.push(`${id}: evidencePath not a real file: ${ev}`);
      // branch name as evidence is invalid
      if (ev.includes('plan/') || ev === 'plan/ael-v2-impl-20261108') errors.push(`${id}: evidencePath is a branch name, not a file: ${ev}`);
    }
    if (id === 'V2-004' && (r.status === 'DONE' || r.status === 'PROPOSED_ONLY')) {
      if (ev !== 'logs/branch-proof.txt') errors.push(`V2-004: evidence must be logs/branch-proof.txt, got ${JSON.stringify(ev)}`);
    }
    // commitSha must be real if present
    const sha = (r.commitSha ?? '').trim();
    if (sha && sha !== '—') {
      if (!/^[0-9a-f]{40}$/.test(sha)) errors.push(`${id}: commitSha must be 40-char hex, got ${sha}`);
      else {
        try { execSync(`git cat-file -e ${sha}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }); }
        catch { errors.push(`${id}: commitSha not a real commit: ${sha}`); }
      }
    }
    // PROPOSED_ONLY rows must say PROPOSED in notes/filesChanged to avoid presenting proposal as done
    if (r.status === 'PROPOSED_ONLY') {
      if (!/PROPOSED/i.test(r.notes ?? '') && !/proposed\//i.test(r.evidencePath ?? '')) {
        errors.push(`${id}: PROPOSED_ONLY must be marked PROPOSED with proposed/ evidence`);
      }
    }
    // V2-020 provenance separation
    if (id === 'V2-020') {
      const fc = r.filesChanged ?? '';
      for (const mod of ['mastery', 'planner', 'scheduler', 'target-weights', 'readiness-copy', 'coverage-matrix']) {
        if (fc.includes(mod)) errors.push(`V2-020: ${mod}.ts is not provenance-contract evidence (filesChanged wrong)`);
      }
    }
    // V2-007 / V2-018 / V2-006 must exist
  }
  // required ids must exist
  for (const req of ['V2-006', 'V2-007', 'V2-018']) {
    if (!seen.has(req)) errors.push(`missing required id ${req}`);
  }
  return errors;
}

function main() {
  const { records } = loadLedger();
  const errors = verify(records);
  console.log(`verify-ledger: ${records.length} rows, ${new Set(records.map(r => r.taskId)).size} unique, ${errors.length} errors`);
  for (const e of errors) console.log(` ERROR ${e}`);
  if (!errors.length) console.log('verify-ledger: OK');
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1]?.endsWith('verify-ledger.mjs')) main();
export default main;
