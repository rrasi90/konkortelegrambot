import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const audit = JSON.parse(await readFile(new URL('content/learning-evidence/source-audit.json', root), 'utf8'));
const banks = await Promise.all(['arshad', 'phd'].map(async name => JSON.parse(
  await readFile(new URL(`content/questions/bank-official_traced_${name}.json`, root), 'utf8'))));
const ids = new Set(banks.flatMap(bank => bank.questions.map(question => question.id)));
const seen = new Set();
let verifiedFiles = 0;
let unavailableFiles = 0;
for (const item of audit.items) {
  assert.ok(ids.has(item.id) && !seen.has(item.id), 'Unknown or duplicated audit record: ' + item.id);
  seen.add(item.id);
  assert.ok(['conflict', 'image_match_pending_key'].includes(item.result));
  assert.ok(Number.isInteger(item.pdfPage) && item.pdfPage > 0);
  assert.match(item.file, /^public\/assets\/aistudio\/[A-Za-z0-9_.-]+\.pdf$/);
  assert.match(item.sha256, /^[a-f0-9]{64}$/i, 'Invalid source SHA-256: ' + item.id);
  let content;
  try {
    content = await readFile(new URL(item.file, root));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      unavailableFiles++;
      console.warn('Source audit reference unavailable in this checkout: ' + item.id + ' (' + item.file + ')');
      continue;
    }
    throw error;
  }
  assert.equal(createHash('sha256').update(content).digest('hex'), item.sha256, 'Source changed: ' + item.id);
  verifiedFiles++;
}
console.log(
  `Source audit: ${audit.items.length} references checked; ${verifiedFiles} file hashes verified; ` +
  `${unavailableFiles} source files are not present in this checkout.`
);
