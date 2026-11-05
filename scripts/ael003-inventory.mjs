/**
 * AEL-003 مرحلهٔ ۱ — Inventory شمارش‌پذیر منابع دادهٔ تاریخی.
 * اجرا: node scripts/ael003-inventory.mjs  →  reports/ael-003/01-inventory/source-inventory.csv
 * هر ردیف: SHA-256 منبع، تعداد رکورد خام، دستهٔ provenance، خانوادهٔ مقصد.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'reports', 'ael-003', '01-inventory');
mkdirSync(outDir, { recursive: true });

const rows = [];
const missing = [];

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function countJsonRecords(path, pick) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const list = pick ? pick(data) : data;
  return Array.isArray(list) ? list.length : null;
}

// ---------- ۱. بسته‌های درس (Legacy Learning Courses) ----------
const courseFiles = ['financial-management.json', 'statistics-foundations.json'];
for (const name of courseFiles) {
  const path = join(root, 'content', 'learning-courses', name);
  if (!existsSync(path)) { missing.push(`content/learning-courses/${name}`); continue; }
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const questions = data.questions ?? [];
  const pendingSme = questions.filter(q => q.review === 'pending_sme').length;
  const reviewed = questions.filter(q => q.review === 'reviewed').length;
  const essays = questions.filter(q => q.kind === 'essay').length;
  rows.push({
    source_ref: `course:${data.id}`, source_kind: 'file_json',
    source_location: `content/learning-courses/${name}`, repository_ref: 'HEAD',
    environment: 'local', source_hash: sha256(path), snapshot_at: new Date().toISOString(),
    raw_record_count: questions.length,
    valid_shape_count: questions.filter(q => q.id && q.prompt && Array.isArray(q.choices)).length,
    invalid_shape_count: questions.filter(q => !(q.id && q.prompt && Array.isArray(q.choices))).length,
    schema_version: `v${data.schemaVersion ?? '?'}`,
    encoding: 'UTF-8', language: 'fa', content_domain: 'curriculum+question+material',
    provenance_class: 'real_candidate',
    rights_status: 'allowed(authored_ael)',
    target_families: 'course_definition,syllabus_nodes(content_topics),questions(content_versions),learning_material',
    inventory_status: 'inventoried',
    notes: `topics=${data.topics?.length ?? 0} pending_sme=${pendingSme} reviewed=${reviewed} essays=${essays} status=${data.status}`,
  });
}

// ---------- ۲. بانک‌های سؤال رسمی/قرنطینه ----------
const banks = [
  ['bank-official_traced_arshad.json', 'official_bank'],
  ['bank-official_traced_phd.json', 'official_bank'],
  ['bank-quarantine.json', 'quarantine_bank'],
];
for (const [name, kind] of banks) {
  const path = join(root, 'content', 'questions', name);
  if (!existsSync(path)) { missing.push(`content/questions/${name}`); continue; }
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const list = Array.isArray(data) ? data : (data.questions ?? []);
  rows.push({
    source_ref: `questions:${name}`, source_kind: 'file_json',
    source_location: `content/questions/${name}`, repository_ref: 'HEAD',
    environment: 'local', source_hash: sha256(path), snapshot_at: new Date().toISOString(),
    raw_record_count: list.length,
    valid_shape_count: list.filter(q => q.id && (q.questionText ?? q.prompt)).length,
    invalid_shape_count: list.filter(q => !(q.id && (q.questionText ?? q.prompt))).length,
    schema_version: 'detected-at-transform', encoding: 'UTF-8', language: 'fa',
    content_domain: 'question', provenance_class: kind === 'quarantine_bank' ? 'unknown_origin' : 'real_candidate',
    rights_status: kind === 'quarantine_bank' ? 'unknown' : 'pending',
    target_families: 'questions,question_appearances,answer_claims',
    inventory_status: 'inventoried',
    notes: kind,
  });
}

// ---------- ۳. دانش/سرفصل ----------
const knowledgeFiles = ['courses.json', 'syllabus-nodes.json', 'skills.json'];
for (const name of knowledgeFiles) {
  const path = join(root, 'content', 'knowledge', name);
  if (!existsSync(path)) { missing.push(`content/knowledge/${name}`); continue; }
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const list = Array.isArray(data) ? data : (data.nodes ?? data.courses ?? data.skills ?? []);
  rows.push({
    source_ref: `knowledge:${name}`, source_kind: 'file_json',
    source_location: `content/knowledge/${name}`, repository_ref: 'HEAD',
    environment: 'local', source_hash: sha256(path), snapshot_at: new Date().toISOString(),
    raw_record_count: list.length, valid_shape_count: list.length, invalid_shape_count: 0,
    schema_version: 'detected-at-transform', encoding: 'UTF-8', language: 'fa',
    content_domain: 'curriculum', provenance_class: 'real_candidate', rights_status: 'allowed(authored_ael)',
    target_families: 'knowledge_nodes,skills,syllabus', inventory_status: 'inventoried', notes: '',
  });
}
const jsonlFiles = ['relations.jsonl', 'question-skill-mappings.jsonl'];
for (const name of jsonlFiles) {
  const path = join(root, 'content', 'knowledge', name);
  if (!existsSync(path)) { missing.push(`content/knowledge/${name}`); continue; }
  const lines = readFileSync(path, 'utf8').split('\n').filter(line => line.trim());
  rows.push({
    source_ref: `knowledge:${name}`, source_kind: 'file_json',
    source_location: `content/knowledge/${name}`, repository_ref: 'HEAD',
    environment: 'local', source_hash: sha256(path), snapshot_at: new Date().toISOString(),
    raw_record_count: lines.length, valid_shape_count: lines.length, invalid_shape_count: 0,
    schema_version: 'detected-at-transform', encoding: 'UTF-8', language: 'fa',
    content_domain: 'curriculum', provenance_class: 'real_candidate', rights_status: 'allowed(authored_ael)',
    target_families: 'node_dependencies,question_skill_mappings', inventory_status: 'inventoried', notes: 'jsonl',
  });
}

// ---------- ۴. Learning Evidence ----------
const evidenceFiles = ['question-index.json', 'source-audit.json', 'recurrence.json', 'concept-rules.json'];
for (const name of evidenceFiles) {
  const path = join(root, 'content', 'learning-evidence', name);
  if (!existsSync(path)) { missing.push(`content/learning-evidence/${name}`); continue; }
  const size = statSync(path).size;
  let count = null;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    for (const value of Object.values(data)) if (Array.isArray(value)) { count = (count ?? 0) + value.length; }
    if (count === null && Array.isArray(data)) count = data.length;
  } catch { /* غیر JSON یا ساختار دیگر — شمارش null می‌ماند */ }
  rows.push({
    source_ref: `evidence:${name}`, source_kind: 'file_json',
    source_location: `content/learning-evidence/${name}`, repository_ref: 'HEAD',
    environment: 'local', source_hash: sha256(path), snapshot_at: new Date().toISOString(),
    raw_record_count: count, valid_shape_count: count, invalid_shape_count: 0,
    schema_version: 'detected-at-transform', encoding: 'UTF-8', language: 'fa',
    content_domain: 'question+curriculum', provenance_class: 'derived_evidence', rights_status: 'allowed(authored_ael)',
    target_families: 'analysis_reports(migration_reference)', inventory_status: 'inventoried',
    notes: `bytes=${size} — evidence مشتق‌شده؛ به‌عنوان مرجع ممیزی، نه رکورد محتوایی مستقل`,
  });
}

// ---------- ۵. دادهٔ قدیمی src/data (legacy vite app) ----------
const srcDataDir = join(root, 'src', 'data');
if (existsSync(srcDataDir)) {
  for (const name of readdirSync(srcDataDir)) {
    if (!/\.(ts|js|json)$/.test(name)) continue;
    const path = join(srcDataDir, name);
    const size = statSync(path).size;
    const content = readFileSync(path, 'utf8');
    const approxRecords = (content.match(/questionText|question:/g) ?? []).length;
    rows.push({
      source_ref: `legacy-src-data:${name}`, source_kind: 'file_ts',
      source_location: `src/data/${name}`, repository_ref: 'HEAD',
      environment: 'local', source_hash: sha256(path), snapshot_at: new Date().toISOString(),
      raw_record_count: approxRecords || null, valid_shape_count: null, invalid_shape_count: null,
      schema_version: 'legacy-vite-app', encoding: 'UTF-8', language: 'fa',
      content_domain: 'question+curriculum', provenance_class: 'real_candidate',
      rights_status: 'pending', target_families: 'questions(legacy_seed_reference)',
      inventory_status: 'inventoried',
      notes: `bytes=${size} — منبع قدیمی Vite app؛ مرجع مهاجرت، انتشار مستقیم ممنوع`,
    });
  }
} else missing.push('src/data/');

// ---------- ۶. رجیستری آموزشی مأموریت ۰۰۳ قبلی (Seed فاز ۱) ----------
const seedPath = join(root, 'content', 'registry', 'ael-p1-seed.json');
if (existsSync(seedPath)) {
  const data = JSON.parse(readFileSync(seedPath, 'utf8'));
  const total = Object.entries(data).reduce((sum, [key, value]) => key === 'schemaVersion' ? sum : sum + value.length, 0);
  rows.push({
    source_ref: 'registry:ael-p1-seed', source_kind: 'file_json',
    source_location: 'content/registry/ael-p1-seed.json', repository_ref: 'HEAD',
    environment: 'local', source_hash: sha256(seedPath), snapshot_at: new Date().toISOString(),
    raw_record_count: total, valid_shape_count: total, invalid_shape_count: 0,
    schema_version: 'registry-v1', encoding: 'UTF-8', language: 'fa',
    content_domain: 'curriculum', provenance_class: 'synthetic',
    rights_status: 'allowed(authored_ael)', target_families: '(قبلاً در 0019 مهاجرت شد — GATE_P1_PASS)',
    inventory_status: 'processed', notes: 'Seed اثبات مدل — Fixture، نه دادهٔ رسمی (قاعدهٔ 6.3)',
  });
}

// ---------- CSV ----------
const header = 'source_ref,source_kind,source_location,repository_ref,environment,source_hash,snapshot_at,raw_record_count,valid_shape_count,invalid_shape_count,schema_version,encoding,language,content_domain,provenance_class,rights_status,target_families,inventory_status,notes';
const csv = [header, ...rows.map(row => {
  return [row.source_ref, row.source_kind, row.source_location, row.repository_ref, row.environment,
    row.source_hash, row.snapshot_at, row.raw_record_count ?? '', row.valid_shape_count ?? '',
    row.invalid_shape_count ?? '', row.schema_version, row.encoding, row.language, row.content_domain,
    row.provenance_class, row.rights_status, `"${row.target_families}"`, row.inventory_status,
    `"${(row.notes ?? '').replace(/"/g, '""')}"`].join(',');
})].join('\n');
writeFileSync(join(outDir, 'source-inventory.csv'), '\uFEFF' + csv, 'utf8');

const totalRecords = rows.reduce((sum, row) => sum + (row.raw_record_count ?? 0), 0);
const summary = {
  generatedAt: new Date().toISOString(),
  sourceCount: rows.length,
  totalRawRecords: totalRecords,
  byProvenance: rows.reduce((acc, row) => { acc[row.provenance_class] = (acc[row.provenance_class] ?? 0) + 1; return acc; }, {}),
  missingSources: missing,
};
writeFileSync(join(outDir, 'inventory-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
