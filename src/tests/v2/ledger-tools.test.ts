import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv, summary } from '../../../scripts/v2/ledger.mjs';
import { verify } from '../../../scripts/v2/verify-ledger.mjs';
import { checkReadingNotes } from '../../../scripts/v2/reading-notes-check.mjs';

describe('ledger csv parse', () => {
  it('parses quoted commas', () => {
    const recs = parseCsv('a,b\n"x,y",z\n');
    expect(recs[1]).toEqual(['x,y', 'z']);
  });
  it('roundtrips', () => {
    const text = 'a,b\n1,2\n';
    expect(parseCsv(toCsv(parseCsv(text)))).toEqual(parseCsv(text));
  });
});

describe('verify statuses', () => {
  const base = { taskId: 'V2-001', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' };
  it('accepts DONE', () => {
    const errs = verify([{ ...base, taskId: 'V2-001' }, { taskId: 'V2-006', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }, { taskId: 'V2-007', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }, { taskId: 'V2-018', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }]);
    expect(errs.filter(e => e.includes('V2-001'))).toEqual([]);
  });
  it('rejects BLOCKED_BY_HUMAN', () => {
    const errs = verify([{ ...base, status: 'BLOCKED_BY_HUMAN' }, { taskId: 'V2-006', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }, { taskId: 'V2-007', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }, { taskId: 'V2-018', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }]);
    expect(errs.some(e => e.includes('V2-001') && e.includes('BLOCKED_BY_HUMAN'))).toBe(true);
  });
  it('rejects PROPOSED_ONLY without PROPOSED marker', () => {
    const errs = verify([{ ...base, status: 'PROPOSED_ONLY' }, { taskId: 'V2-006', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }, { taskId: 'V2-007', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }, { taskId: 'V2-018', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }]);
    expect(errs.some(e => e.includes('V2-001'))).toBe(true);
  });
  it('rejects V2-020 mastery as provenance', () => {
    const errs = verify([{ ...base, taskId: 'V2-020', filesChanged: 'mastery.ts' }, { taskId: 'V2-006', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }, { taskId: 'V2-007', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }, { taskId: 'V2-018', planRef: '—', status: 'DONE', decisionRef: '—', filesChanged: '', commands: '', evidencePath: '', baselineFailures: '', notes: '', updatedAt: '2026-11-08', commitSha: '' }]);
    expect(errs.some(e => e.includes('V2-020'))).toBe(true);
  });
});

describe('reading notes anchor', () => {
  it('rejects missing anchor', () => {
    const { errors } = checkReadingNotes('1. **A**\n   - foo\n');
    expect(errors.length).toBeGreaterThan(0);
  });
  it('accepts anchor', () => {
    const { errors } = checkReadingNotes('1. **A**\n   - foo BACKLOG_FA.md:1-9 @ f9891a5\n');
    expect(errors).toEqual([]);
  });
});

describe('summary', () => {
  it('counts statuses', () => {
    const s = summary([{ taskId: 'a', status: 'DONE' }, { taskId: 'b', status: 'DONE' }]);
    expect(s).toEqual({ total: 2, unique: 2, byStatus: { DONE: 2 } });
  });
});
