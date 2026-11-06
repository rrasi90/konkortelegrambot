/**
 * AEL-319 (Phase 0) — Inventory اتمیک سؤال‌ها از آرشیو واقعی.
 * فقط Metadata/شمارش؛ متن سؤال/کلید به گزارش عمومی نمی‌رود.
 * خروجی محلی: .ael-work/question-explanations/inventory/inventory.json (Local-only)
 * گزارش عمومی (خلاصه): از stdout خوانده و در docs گزارش نهایی ثبت می‌شود.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.ael-work', 'question-explanations', 'inventory');
mkdirSync(outDir, { recursive: true });

const sha = (() => { try { return execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch { return 'unknown'; } })();
const conv = JSON.parse(readFileSync(join(root, 'pdf', '_CONVERSION_REPORT.json'), 'utf8'));
const regPath = join(root, '.ael-work', 'pdf-ingestion', 'registry', 'registry.json');
const registry = existsSync(regPath) ? JSON.parse(readFileSync(regPath, 'utf8')) : { sources: {} };
const idx = JSON.parse(readFileSync(join(root, 'content', 'learning-evidence', 'question-index.json'), 'utf8'));

function countBank(path) {
  try {
    const j = JSON.parse(readFileSync(path, 'utf8'));
    return { total: j.questions?.length ?? 0, counts: j.counts ?? {} };
  } catch { return { total: 0, counts: {} }; }
}
const arshad = countBank(join(root, 'content', 'questions', 'bank-official_traced_arshad.json'));
const phd = countBank(join(root, 'content', 'questions', 'bank-official_traced_phd.json'));
const quar = countBank(join(root, 'content', 'questions', 'bank-quarantine.json'));

const inventory = {
  mission: 'AEL-QUESTION-EXPLANATIONS-RESEARCH-AND-AUTHORING-001',
  package: 'AEL-319',
  snapshot_at: new Date().toISOString(),
  git_sha: sha,
  pdf_archive: {
    scanned: conv.length,
    ok: conv.filter((r) => r.status === 'ok').length,
    missing_middle_json: conv.filter((r) => r.status !== 'ok').length,
    rows: conv.map((r) => ({
      file: r.file, status: r.status, pages: r.pages ?? null, blocks: r.blocks ?? null,
      equations: r.equations ?? null, tables: r.tables ?? null, images: r.images ?? null,
      missing: r.missing ?? null, md_bytes: r.md_bytes ?? null,
    })),
  },
  question_banks: { arshad_arr: arshad.total, phd: phd.total, quarantine: quar.total },
  question_index: { entries: idx.entries?.length ?? 0 },
  rights: { h_conk: 'pending_review — AI processing forbidden until decision (SRC-02)', ai_external_upload: 'FORBIDDEN' },
  gates: { publication: 'local_only until HUMAN_REQUIRED + SME + rights gates pass' },
};
writeFileSync(join(outDir, 'inventory.json'), JSON.stringify(inventory, null, 2));
console.log(JSON.stringify({
  pdf_ok: `${inventory.pdf_archive.ok}/${inventory.pdf_archive.scanned}`,
  arshad: arshad.total, phd: phd.total, quarantine: quar.total,
  question_index_entries: idx.entries?.length ?? 0,
  sha,
}, null, 2));
