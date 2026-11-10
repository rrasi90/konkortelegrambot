/**
 * مأموریت v5 §3/§13.2 — تست reconcile منابع حقیقت
 * Ledger و Gap Register باید با parser استاندارد خوانده شوند، شمارش‌ها
 * قابل‌تکرار باشند و statusها فقط enum مجاز باشند (بدون متن در status).
 */
import { describe, expect, it } from 'vitest';
import {
  loadValidations,
  validateGapRegister,
  validateLedger,
} from '../../../scripts/ledger-gap-reconcile.mts';

describe('Ledger / Gap Register reconciliation (v5 §3)', () => {
  const { ledger, gap } = loadValidations();

  it('both registries parse with zero schema/enum errors', () => {
    expect(ledger.errors).toEqual([]);
    expect(gap.errors).toEqual([]);
  });

  it('ledger has 45 rows and V3 statuses match the reconciled truth', () => {
    expect(ledger.totalRows).toBe(45);
    // مأموریت v5 §3.1 — شمارش مرجع (از FX/HD جدا):
    expect(ledger.countsByPrefix['V3']).toEqual({
      DONE: 11,
      DONE_WITH_DEFAULT: 3,
      PARTIAL: 4,
      NOT_STARTED: 14,
    });
    expect(ledger.countsByPrefix['FX']).toEqual({ DONE: 5 });
    expect(ledger.countsByPrefix['HD']).toEqual({ DONE: 8 });
  });

  it('gap register has 19 rows, pure status enum, and known open ids', () => {
    expect(gap.totalRows).toBe(19);
    expect(gap.counts).toEqual({ OPEN: 9, CLOSED: 10 });
    expect(gap.openIds).toEqual([
      'GAP-001', 'GAP-002', 'GAP-003', 'GAP-006', 'GAP-010',
      'GAP-012', 'GAP-013', 'GAP-014', 'GAP-018',
    ]);
    // هیچ status آلوده به متن («CLOSED: دلیل») مجاز نیست:
    for (const row of gap.rows) {
      expect(row.status, row.gapId).toMatch(/^(OPEN|IN_PROGRESS|CLOSED)$/);
    }
    // هر CLOSED باید resolution غیرخالی داشته باشد:
    for (const row of gap.rows) {
      if (row.status === 'CLOSED') expect(row.resolution.trim().length, row.gapId).toBeGreaterThan(0);
    }
  });

  it('parser handles quoted commas, escaped quotes and CRLF', () => {
    const parsed = validateLedger('taskId,status,notes\nA-1,DONE,"با , کاما و ""quote"""');
    expect(parsed.totalRows).toBe(1);
    expect(parsed.rows[0].notes).toBe('با , کاما و "quote"');
    const parsedCRLF = validateGapRegister('gapId,status,resolution\r\nG-1,CLOSED,دلیل\r\n');
    expect(parsedCRLF.totalRows).toBe(1);
    expect(parsedCRLF.rows[0].gapId).toBe('G-1');
  });

  it('rejects polluted status text and duplicate ids (fail-closed)', () => {
    const bad = validateGapRegister('gapId,status,resolution\nG-1,"CLOSED: دلیل قدیمی",\nG-1,OPEN,\n');
    expect(bad.errors.length).toBeGreaterThanOrEqual(3); // enum غیرمجاز + resolution خالی + تکراری
    const badLedger = validateLedger('taskId,status\nX-1,WEIRD\nX-1,WEIRD\n');
    expect(badLedger.errors.length).toBeGreaterThanOrEqual(2);
  });
});
