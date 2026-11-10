/**
 * مأموریت v5 §3 — Parser و اعتبارسنج Ledger/Gap Register
 *
 * شمارش قبلی گزارش v4 با split(',') و regex غیرقابل‌اعتماد انجام شده بود و
 * DONE=24/NOT_STARTED=13 اعلام کرده بود که با واقعیِ CSV نمی‌خواند. این ماژول
 * parser استاندارد CSV (با پشتیبانی quote/escape) و اعتبارسنجی schema ارائه
 * می‌دهد تا شمارش‌ها قابل‌تکرار و ماشین‌خوان باشند.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** استاندارد CSV با پشتیبانی quote/double-quote escape — RFC 4180-compatible */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

export const LEDGER_STATUSES = [
  'DONE', 'DONE_WITH_DEFAULT', 'PARTIAL', 'IN_PROGRESS',
  'NOT_STARTED', 'BLOCKED', 'NEEDS_HUMAN', 'NOT_RUN', 'NOT_APPLICABLE',
] as const;
export const GAP_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const;

export interface LedgerValidation {
  header: string[];
  rows: Array<Record<string, string>>;
  countsByPrefix: Record<string, Record<string, number>>;
  totalRows: number;
  errors: string[];
}

const LEDGER_COLUMNS = [
  'taskId', 'phase', 'status', 'dependsOn', 'decisionRef', 'filesChanged',
  'commands', 'evidencePath', 'baselineFailures', 'notes', 'updatedAt', 'commitSha',
];

export function validateLedger(csvText: string): LedgerValidation {
  const table = parseCsv(csvText);
  const errors: string[] = [];
  const header = table[0] ?? [];
  for (const col of LEDGER_COLUMNS) {
    if (!header.includes(col)) errors.push(`ledger: ستون الزامی «${col}» وجود ندارد`);
  }
  const rows = table.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((h, i) => { record[h] = cells[i] ?? ''; });
    return record;
  });
  const ids = rows.map((r) => r.taskId);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length) errors.push(`ledger: taskId تکراری: ${dupes.join(', ')}`);
  for (const r of rows) {
    if (!LEDGER_STATUSES.includes(r.status as (typeof LEDGER_STATUSES)[number])) {
      errors.push(`ledger: ${r.taskId} وضعیت غیرمجاز «${r.status}»`);
    }
  }
  const countsByPrefix: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const prefix = r.taskId.split('-')[0];
    countsByPrefix[prefix] = countsByPrefix[prefix] ?? {};
    countsByPrefix[prefix][r.status] = (countsByPrefix[prefix][r.status] ?? 0) + 1;
  }
  return { header, rows, countsByPrefix, totalRows: rows.length, errors };
}

export interface GapValidation {
  header: string[];
  rows: Array<Record<string, string>>;
  counts: Record<string, number>;
  openIds: string[];
  totalRows: number;
  errors: string[];
}

/** پس از نرمال‌سازی: gapId,phase,area,description,evidence,status,resolution,blocking */
const GAP_COLUMNS = ['gapId', 'phase', 'area', 'description', 'evidence', 'status', 'resolution', 'blocking'];

export function validateGapRegister(csvText: string): GapValidation {
  const table = parseCsv(csvText);
  const errors: string[] = [];
  const header = table[0] ?? [];
  for (const col of GAP_COLUMNS) {
    if (!header.includes(col)) errors.push(`gap: ستون الزامی «${col}» وجود ندارد`);
  }
  const statusIdx = header.indexOf('status');
  const rows = table.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((h, i) => { record[h] = cells[i] ?? ''; });
    return record;
  });
  const ids = rows.map((r) => r.gapId);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length) errors.push(`gap: gapId تکراری: ${dupes.join(', ')}`);
  for (const r of rows) {
    // status باید فقط enum باشد؛ دلیل بسته‌شدن در ستون resolution است.
    if (!(GAP_STATUSES as readonly string[]).includes(r.status)) {
      errors.push(`gap: ${r.gapId} وضعیت غیرمجاز «${r.status}» (enum: OPEN|IN_PROGRESS|CLOSED)`);
    }
    if (r.status === 'CLOSED' && !(r.resolution ?? '').trim()) {
      errors.push(`gap: ${r.gapId} CLOSED است اما resolution خالی است`);
    }
  }
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return {
    header, rows, counts,
    openIds: rows.filter((r) => r.status === 'OPEN').map((r) => r.gapId),
    totalRows: rows.length, errors,
  };
}

export function loadValidations(root = process.cwd()): { ledger: LedgerValidation; gap: GapValidation } {
  const ledger = validateLedger(
    readFileSync(resolve(root, 'docs/ael-implementation/v3/AEL_V3_LEDGER.csv'), 'utf8'),
  );
  const gap = validateGapRegister(
    readFileSync(resolve(root, 'docs/ael-implementation/v3/reports/V3_GAP_REGISTER.csv'), 'utf8'),
  );
  return { ledger, gap };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { ledger, gap } = loadValidations();
  const allErrors = [...ledger.errors, ...gap.errors];
  console.log(`Ledger: ${ledger.totalRows} ردیف — ${JSON.stringify(ledger.countsByPrefix)}`);
  console.log(`Gap: ${gap.totalRows} ردیف — ${JSON.stringify(gap.counts)} — OPEN: ${gap.openIds.join(', ')}`);
  if (allErrors.length) {
    console.error('ERRORS:\n' + allErrors.map((e) => `- ${e}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('VALIDATION PASS');
  }
}
