/**
 * AEL-003 مرحلهٔ ۳ — تحلیل کیفیت روی دادهٔ واقعی (بدون Write).
 * خروجی: 03-quality/{DATA_QUALITY_REPORT,DUP_CANDIDATES,ANSWER_CONFLICTS}.md + QA فارسی
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'reports', 'ael-003', '03-quality');
mkdirSync(out, { recursive: true });

// ---------- نرمال‌سازی فارسی (خالص — raw حفظ می‌شود) ----------
function normalizePersian(text) {
  return String(text ?? '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[ىي]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[؟?!.،,؛:«»"'()\[\]{}\-—–]/g, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}
function trigrams(text) {
  const padded = `  ${text}  `;
  const grams = new Set();
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const item of a) if (b.has(item)) inter += 1;
  return inter / (a.size + b.size - inter);
}

// ---------- بارگذاری بانک‌ها ----------
const banks = {};
for (const name of ['bank-official_traced_arshad', 'bank-official_traced_phd', 'bank-quarantine']) {
  const data = JSON.parse(readFileSync(join(root, 'content', 'questions', `${name}.json`), 'utf8'));
  banks[name] = Array.isArray(data) ? data : (data.questions ?? []);
}
const all = [];
for (const [name, list] of Object.entries(banks)) {
  for (const q of list) all.push({ bank: name, q });
}

const report = {
  total: all.length,
  byBank: Object.fromEntries(Object.entries(banks).map(([name, list]) => [name, list.length])),
  missingFields: {},
  answerOutOfRange: [],
  answerConflicts: [],
  exactDuplicates: [],
  nearCandidates: [],
  persianIssues: { arabicYeh: 0, arabicKaf: 0, arabicDigits: 0, latinInFa: 0, zwnjMissing: 0 },
};

// ---------- چک‌های ساختاری + کلید ----------
for (const { bank, q } of all) {
  const text = q.questionText ?? q.prompt ?? '';
  const choices = q.options ?? q.choices ?? [];
  const key = q.correctOption;
  if (!text.trim()) report.missingFields[`${bank}:${q.id}`] = 'empty_prompt';
  if (typeof key === 'number' && choices.length > 0 && (key < 0 || key >= choices.length)) {
    report.answerOutOfRange.push({ bank, id: q.id, key, choicesCount: choices.length });
  }
  // فارسی QA (شمارش الگوهای سند اسکیل pol-persian-rtl-qa)
  if (/[\u064A]/.test(text)) report.persianIssues.arabicYeh += 1;
  if (/[\u0643]/.test(text)) report.persianIssues.arabicKaf += 1;
  if (/[\u0660-\u0669]/.test(text)) report.persianIssues.arabicDigits += 1;
  if (/[A-Za-z]{3,}/.test(text) && /[\u0600-\u06FF]/.test(text)) report.persianIssues.latinInFa += 1;
  if (/می\s|\sها\s|\sهایی/.test(text)) report.persianIssues.zwnjMissing += 1;
}

// ---------- تعارض کلید بین دو بانک برای همان id ----------
const byId = new Map();
for (const { bank, q } of all) {
  if (!byId.has(q.id)) byId.set(q.id, []);
  byId.get(q.id).push({ bank, key: q.correctOption, text: q.questionText ?? q.prompt ?? '' });
}
for (const [id, claims] of byId) {
  const keys = new Set(claims.map(row => row.key));
  if (claims.length > 1 && keys.size > 1) {
    report.answerConflicts.push({ id, claims: claims.map(row => ({ bank: row.bank, key: row.key })) });
  }
}

// ---------- تکرار: exact (نرمال‌شده) + near (jaccard ≥ 0.85) ----------
const vectors = [];
const exactMap = new Map();
for (const { bank, q } of all) {
  const text = String(q.questionText ?? q.prompt ?? '');
  const norm = normalizePersian(text);
  const key0 = norm;
  exactMap.set(key0, [...(exactMap.get(key0) ?? []), { bank, id: q.id }]);
  vectors.push({ bank, id: q.id, norm, grams: trigrams(norm), text });
}
for (const [norm, list] of exactMap) {
  if (list.length > 1) report.exactDuplicates.push({ normalizedPreview: norm.slice(0, 80), items: list });
}
for (let i = 0; i < vectors.length; i++) {
  for (let j = i + 1; j < vectors.length; j++) {
    const a = vectors[i], b = vectors[j];
    if (a.norm === b.norm) continue;
    const sim = jaccard(a.grams, b.grams);
    if (sim >= 0.85) report.nearCandidates.push({ a: { bank: a.bank, id: a.id }, b: { bank: b.bank, id: b.id }, similarity: Number(sim.toFixed(3)) });
  }
}

// ---------- گزارش‌ها ----------
const md = (title, body) => `# ${title}\n\n${body}\n`;
writeFileSync(join(out, 'DATA_QUALITY_REPORT.md'), md('گزارش کیفیت داده — AEL-003',
  `| سنجه | مقدار |\n|---|---|\n| کل رکورد | ${report.total} |\n| به تفکیک بانک | ${JSON.stringify(report.byBank)} |\n| فیلد خالی | ${Object.keys(report.missingFields).length} |\n| کلید خارج از محدوده | ${report.answerOutOfRange.length} |\n| تعارض کلید بین بانک‌ها | ${report.answerConflicts.length} |\n| تکرار exact | ${report.exactDuplicates.length} گروه |\n| کاندید near (≥0.85) | ${report.nearCandidates.length} جفت |\n\n## QA فارسی (الگوهای pol-persian-rtl-qa — شمارش رکورد، شاهد ماشینی)\n| الگو | رکوردها |\n|---|---|\n| ی/ک عربی | ${report.persianIssues.arabicYeh + report.persianIssues.arabicKaf} |\n| ارقام عربی | ${report.persianIssues.arabicDigits} |\n| لاتین درون فارسی | ${report.persianIssues.latinInFa} |\n| نیم‌فاصلهٔ مفقود (می/ها) | ${report.persianIssues.zwnjMissing} |\n\n**نکته:** نرمال‌سازی فقط Projection جست‌وجوست؛ Raw Text حفظ می‌شود (§8). اصلاح این موارد = editorial_revision جداگانه، نه بخشی از Migration.`));
writeFileSync(join(out, 'DUPLICATE_CANDIDATES.json'), JSON.stringify({ exact: report.exactDuplicates, near: report.nearCandidates }, null, 1));
writeFileSync(join(out, 'ANSWER_CONFLICTS.json'), JSON.stringify({ conflicts: report.answerConflicts, outOfRange: report.answerOutOfRange }, null, 1));
console.log(JSON.stringify({ total: report.total, exactDupGroups: report.exactDuplicates.length, nearCandidates: report.nearCandidates.length, conflicts: report.answerConflicts.length, outOfRange: report.answerOutOfRange.length, persianIssues: report.persianIssues }, null, 1));
