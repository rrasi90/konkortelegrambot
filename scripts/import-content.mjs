#!/usr/bin/env node
/**
 * درون‌ریزی بستهٔ نسخه‌دار آزمون.
 * SQL mode is deterministic; direct mode requires a server-side Supabase service-role key.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const path = args[0];
const modeSql = args.includes('--sql');
if (!path) {
  console.error('کاربرد: import-content.mjs <pack.json> [--sql]');
  process.exit(2);
}

const pack = JSON.parse(readFileSync(path, 'utf8'));
const meta = pack.meta ?? {};
const synthetic = meta.synthetic === true;
const permittedRights = ['authorized', 'public_domain', 'licensed'];
if (!synthetic && !permittedRights.includes(meta.rightsStatus)) {
  console.error('درون‌ریزی محتوای غیرساختگی به مجوز صریح و ثبت‌شده نیاز دارد (meta.rightsStatus: authorized/public_domain/licensed).');
  process.exit(2);
}
if (!meta.name || !meta.version || !Array.isArray(pack.nodes) || !Array.isArray(pack.questions)) {
  console.error('بسته باید meta.name، meta.version، nodes و questions داشته باشد.');
  process.exit(2);
}
const rightsStatus = meta.rightsStatus ?? 'unknown';
const packId = `${meta.packId ?? meta.name}@${meta.version}`;
const courseKey = (node) => node.courseKey || ('course_' + createHash('sha256').update(String(node.course)).digest('hex').slice(0, 16));
const courseMap = new Map();
for (const node of pack.nodes) {
  const key = courseKey(node);
  const configured = (pack.courses ?? []).find((course) => course.key === key || course.title === node.course);
  if (!courseMap.has(key)) {
    courseMap.set(key, {
      pack_id: packId,
      course_key: key,
      title: String(configured?.title ?? node.course),
      weight: Number.isFinite(configured?.weight) && configured.weight >= 0 ? configured.weight : 0,
      weight_is_official: configured?.weightIsOfficial === true && Boolean(configured?.sourceRef),
      source_ref: configured?.sourceRef ?? null,
      sort_order: Number.isInteger(configured?.sortOrder) ? configured.sortOrder : courseMap.size,
    });
  }
}
function sqlStr(value) {
  return value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
}
function sqlJson(value) {
  return `${sqlStr(JSON.stringify(value ?? {}))}::jsonb`;
}
function questionMappings(q) {
  const rows = Array.isArray(q.skillMappings)
    ? q.skillMappings.map((m) => ({
        question_id: q.id,
        skill_id: m.skillId,
        mapping_role: m.role ?? (m.skillId === q.nodeId ? 'primary' : 'secondary'),
        confidence: m.confidence ?? null,
        verification_status: m.verificationStatus ?? 'unverified',
        source_ref: m.sourceRef ?? null,
      }))
    : (Array.isArray(q.skillIds) ? q.skillIds : [q.nodeId]).map((skillId) => ({
        question_id: q.id,
        skill_id: skillId,
        mapping_role: skillId === q.nodeId ? 'primary' : 'secondary',
        confidence: null,
        verification_status: 'unverified',
        source_ref: null,
      }));
  if (!rows.some((row) => row.skill_id === q.nodeId)) {
    rows.unshift({
      question_id: q.id, skill_id: q.nodeId, mapping_role: 'primary',
      confidence: null, verification_status: 'unverified', source_ref: null,
    });
  }
  return rows;
}
function questionVerificationStatus(q) {
  const itemRights = q.rightsStatus ?? rightsStatus;
  if (itemRights === 'blocked') return 'quarantined';
  if (synthetic) return 'demo';
  if (q.verificationStatus === 'quarantined') return 'quarantined';
  if (q.verificationStatus === 'verified' && q.verifiedBy && q.verifiedAt && (q.sourceRef || meta.sourceRef)) {
    return 'verified';
  }
  return 'unverified';
}
function questionPackRow(q) {
  const status = questionVerificationStatus(q);
  return {
    pack_id: packId, question_id: q.id, item_version: String(q.itemVersion ?? '1'),
    source_ref: q.sourceRef ?? meta.sourceRef ?? null,
    source_year: q.examYear ?? null,
    rights_status: q.rightsStatus ?? rightsStatus,
    verification_status: status,
    is_holdout: q.isHoldout === true || (meta.holdoutQuestionIds ?? []).includes(q.id),
    holdout_reviewed: q.holdoutReviewed === true,
  };
}
const questionRows = (pack.questions ?? []).map((q) => ({
  id: q.id,
  node_id: q.nodeId,
  exam_year: q.examYear ?? null,
  question_text: q.text,
  options: q.options,
  correct_option: q.correctOption,
  explanation: q.explanation ?? null,
  trap_note: q.trapNote ?? null,
  verification_status: questionVerificationStatus(q),
  source_ref: q.sourceRef ?? meta.sourceRef ?? null,
  source_hash: q.sourceHash ?? null,
  rights_status: q.rightsStatus ?? rightsStatus,
  verified_by: q.verifiedBy ?? null,
  verified_at: q.verifiedAt ?? null,
  item_version: String(q.itemVersion ?? '1'),
  is_holdout: q.isHoldout === true || (meta.holdoutQuestionIds ?? []).includes(q.id),
}));
const dependencyRows = (pack.dependencies ?? []).map((d) => ({
  source_node_id: d.source,
  target_node_id: d.target,
  relation: d.relation,
  impact_weight: d.weight,
  verification_status: d.verificationStatus ?? 'unverified',
  source_ref: d.sourceRef ?? null,
  confidence: d.confidence ?? null,
}));
const skillRows = (pack.nodes ?? []).map((n) => ({
  pack_id: packId, skill_id: n.id, course_key: courseKey(n),
  syllabus_item_ref: n.syllabusItemRef ?? null,
  atomicity_status: n.atomicityStatus ?? 'unreviewed',
  source_ref: n.sourceRef ?? meta.syllabusSourceRef ?? null,
  verification_status: n.skillVerificationStatus ?? 'unverified',
}));
const assetRows = (pack.assets ?? []).map((a) => ({
  id: a.id, pack_id: packId, skill_id: a.skillId ?? null, asset_type: a.type,
  title: a.title, content: a.content, version: a.version ?? 1,
  rights_status: a.rightsStatus ?? rightsStatus,
  verification_status: a.verificationStatus ?? 'unverified',
  source_ref: a.sourceRef ?? null, source_hash: a.sourceHash ?? null,
}));

function generateSql() {
  const lines = [
    `-- تولیدشده توسط scripts/import-content.mjs از ${path}`,
    `-- بسته: ${meta.name} نسخه ${meta.version}; id=${packId}; synthetic=${synthetic}`,
    '-- این بسته با وضعیت draft ساخته می‌شود؛ انتشار رسمی نیازمند کنترل حقوق و بازبینی متخصص است.',
    'BEGIN;',
    '',
    `INSERT INTO exam_packs(id,title,exam_level,syllabus_version,content_version,is_synthetic,rights_status,publication_status,scoring_rules,metadata,source_ref,source_hash)
VALUES (${sqlStr(packId)},${sqlStr(meta.title ?? meta.name)},${sqlStr(meta.examLevel ?? 'unspecified')},${sqlStr(meta.syllabusVersion ?? meta.version)},${Number.isInteger(meta.contentVersion) ? meta.contentVersion : 1},${synthetic},${sqlStr(rightsStatus)},'draft',${sqlJson(meta.scoringRules ?? {})},${sqlJson(meta)},${sqlStr(meta.sourceRef)},${sqlStr(meta.sourceHash)})
ON CONFLICT (id) DO NOTHING;`,
    '',
    `INSERT INTO exam_pack_syllabi(pack_id,version,source_ref,source_hash,rights_status,verification_status,syllabus_content)
VALUES (${sqlStr(packId)},${sqlStr(meta.syllabusVersion ?? meta.version)},${sqlStr(meta.syllabusSourceRef)},${sqlStr(meta.syllabusSourceHash)},${sqlStr(meta.syllabusRightsStatus ?? rightsStatus)},${sqlStr(meta.syllabusVerificationStatus ?? 'unverified')},${sqlJson(pack.syllabus ?? {})})
ON CONFLICT (pack_id,version) DO NOTHING;`,
    '',
  ];
  for (const n of pack.nodes ?? []) {
    lines.push(`INSERT INTO knowledge_nodes(id,track,course,chapter,topic) VALUES (${sqlStr(n.id)},${sqlStr(n.track)},${sqlStr(n.course)},${sqlStr(n.chapter)},${sqlStr(n.topic)}) ON CONFLICT(id) DO NOTHING;`);
  }
  lines.push('');
  for (const d of dependencyRows) {
    lines.push(`INSERT INTO node_dependencies(source_node_id,target_node_id,relation,impact_weight,verification_status,source_ref,confidence)
VALUES (${sqlStr(d.source_node_id)},${sqlStr(d.target_node_id)},${sqlStr(d.relation)},${d.impact_weight},${sqlStr(d.verification_status)},${sqlStr(d.source_ref)},${d.confidence ?? 'NULL'})
ON CONFLICT(source_node_id,target_node_id) DO NOTHING;`);
  }
  lines.push('');
  for (const course of courseMap.values()) {
    lines.push(`INSERT INTO exam_pack_courses(pack_id,course_key,title,weight,weight_is_official,source_ref,sort_order)
VALUES (${sqlStr(course.pack_id)},${sqlStr(course.course_key)},${sqlStr(course.title)},${course.weight},${course.weight_is_official},${sqlStr(course.source_ref)},${course.sort_order})
ON CONFLICT(pack_id,course_key) DO NOTHING;`);
  }
  lines.push('');
  for (const q of questionRows) {
    lines.push(`INSERT INTO questions(id,node_id,exam_year,question_text,options,correct_option,explanation,trap_note,verification_status,source_ref,source_hash,rights_status,verified_by,verified_at,item_version,is_holdout)
VALUES (${sqlStr(q.id)},${sqlStr(q.node_id)},${q.exam_year ?? 'NULL'},${sqlStr(q.question_text)},${sqlJson(q.options)},${q.correct_option},${sqlStr(q.explanation)},${sqlStr(q.trap_note)},${sqlStr(q.verification_status)},${sqlStr(q.source_ref)},${sqlStr(q.source_hash)},${sqlStr(q.rights_status)},${sqlStr(q.verified_by)},${sqlStr(q.verified_at)},${sqlStr(q.item_version)},${q.is_holdout})
ON CONFLICT(id) DO NOTHING;`);
  }
  lines.push('');
  for (const skill of skillRows) {
    lines.push(`INSERT INTO exam_pack_skills(pack_id,skill_id,course_key,syllabus_item_ref,atomicity_status,source_ref,verification_status)
VALUES (${sqlStr(skill.pack_id)},${sqlStr(skill.skill_id)},${sqlStr(skill.course_key)},${sqlStr(skill.syllabus_item_ref)},${sqlStr(skill.atomicity_status)},${sqlStr(skill.source_ref)},${sqlStr(skill.verification_status)})
ON CONFLICT(pack_id,skill_id) DO NOTHING;`);
  }
  lines.push('');
  for (const q of pack.questions ?? []) {
    const qrow = questionPackRow(q);
    lines.push(`INSERT INTO exam_pack_questions(pack_id,question_id,item_version,source_ref,source_year,rights_status,verification_status,is_holdout,holdout_reviewed)
VALUES (${sqlStr(qrow.pack_id)},${sqlStr(qrow.question_id)},${sqlStr(qrow.item_version)},${sqlStr(qrow.source_ref)},${qrow.source_year ?? 'NULL'},${sqlStr(qrow.rights_status)},${sqlStr(qrow.verification_status)},${qrow.is_holdout},${qrow.holdout_reviewed})
ON CONFLICT(pack_id,question_id,item_version) DO NOTHING;`);
    for (const mapping of questionMappings(q)) {
      lines.push(`INSERT INTO question_skill_mappings(question_id,skill_id,mapping_role,confidence,verification_status,source_ref)
VALUES (${sqlStr(mapping.question_id)},${sqlStr(mapping.skill_id)},${sqlStr(mapping.mapping_role)},${mapping.confidence ?? 'NULL'},${sqlStr(mapping.verification_status)},${sqlStr(mapping.source_ref)})
ON CONFLICT(question_id,skill_id) DO NOTHING;`);
    }
  }
  lines.push('');
  for (const asset of assetRows) {
    lines.push(`INSERT INTO learning_assets(id,pack_id,skill_id,asset_type,title,content,version,rights_status,verification_status,source_ref,source_hash)
VALUES (${sqlStr(asset.id)},${sqlStr(asset.pack_id)},${sqlStr(asset.skill_id)},${sqlStr(asset.asset_type)},${sqlStr(asset.title)},${sqlJson(asset.content)},${asset.version},${sqlStr(asset.rights_status)},${sqlStr(asset.verification_status)},${sqlStr(asset.source_ref)},${sqlStr(asset.source_hash)})
ON CONFLICT(id) DO NOTHING;`);
  }
  lines.push('', 'COMMIT;', '');
  return lines.join('\n');
}

if (modeSql) {
  process.stdout.write(generateSql());
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('برای درون‌ریزی مستقیم، SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY لازم است. از حالت --sql استفاده کنید.');
  process.exit(2);
}
async function upsert(table, rows) {
  if (!rows.length) return;
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
}

await upsert('exam_packs', [{
  id: packId,
  title: meta.title ?? meta.name,
  exam_level: meta.examLevel ?? 'unspecified',
  syllabus_version: meta.syllabusVersion ?? meta.version,
  content_version: Number.isInteger(meta.contentVersion) ? meta.contentVersion : 1,
  is_synthetic: synthetic,
  rights_status: rightsStatus,
  publication_status: 'draft',
  scoring_rules: meta.scoringRules ?? {},
  metadata: meta,
  source_ref: meta.sourceRef ?? null,
  source_hash: meta.sourceHash ?? null,
}]);
await upsert('exam_pack_syllabi', [{
  pack_id: packId,
  version: meta.syllabusVersion ?? meta.version,
  source_ref: meta.syllabusSourceRef ?? null,
  source_hash: meta.syllabusSourceHash ?? null,
  rights_status: meta.syllabusRightsStatus ?? rightsStatus,
  verification_status: meta.syllabusVerificationStatus ?? 'unverified',
  syllabus_content: pack.syllabus ?? {},
}]);
await upsert('knowledge_nodes', pack.nodes.map((n) => ({ id: n.id, track: n.track, course: n.course, chapter: n.chapter, topic: n.topic })));
await upsert('node_dependencies', dependencyRows);
await upsert('exam_pack_courses', [...courseMap.values()]);
await upsert('questions', questionRows);
await upsert('exam_pack_skills', skillRows);
await upsert('exam_pack_questions', (pack.questions ?? []).map(questionPackRow));
await upsert('question_skill_mappings', (pack.questions ?? []).flatMap(questionMappings));
await upsert('learning_assets', assetRows);
console.log(`بستهٔ ${packId} به‌صورت draft درون‌ریزی شد؛ انتشار رسمی/فعال‌سازی مهارت‌ها هنوز نیازمند بازبینی حقوق و محتوا است.`);
