// پاکسازی MANIFEST: فقط ردیف‌های کامل ۱۴-ستونه با filename معتبر .png و status OK
import fs from 'node:fs';
import path from 'node:path';

const p = path.resolve('artifacts/ui-audit/2026-11-11/MANIFEST.csv');
const raw = fs.readFileSync(p, 'utf8');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else field += c;
  }
  return rows;
}

const table = parseCsv(raw);
const cols = table[0].map((h) => h.replace(/^\ufeff/, ''));
const valid = table.slice(1).filter((cells) => {
  if (cells.length !== cols.length) return false;
  const rec = {};
  cols.forEach((h, i) => { rec[h] = cells[i]; });
  return rec.capture_status === 'OK' && rec.filename.endsWith('.png');
});
const out = [cols].concat(valid.map((cells) => cells.map((c) => '"' + c.replaceAll('"', '""') + '"').join(',')));
fs.writeFileSync(p, '\ufeff' + out.join('\n') + '\n', 'utf8');
console.log('valid rows:', valid.length, '(raw physical rows before:', raw.split('\n').length, ')');
