#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = resolve(process.cwd(), 'docs/phase-1');
const errors = [];

async function load(path) {
  try {
    return await readFile(resolve(base, path), 'utf8');
  } catch (error) {
    errors.push(`Missing/unreadable ${path}: ${error.message}`);
    return '';
  }
}

function parseCsv(text, label) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        value += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(value);
      value = '';
    } else if (ch === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (ch !== '\r') {
      value += ch;
    }
  }
  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (!rows.length) errors.push(`${label}: empty CSV`);
  if (quoted) errors.push(`${label}: unclosed quoted field`);

  const header = rows[0] ?? [];
  if (header.some((name, index) => header.indexOf(name) !== index)) {
    errors.push(`${label}: duplicate column names`);
  }
  return {
    header,
    rows: rows.slice(1).filter((item) => item.some((cell) => cell !== '')),
  };
}

function getColumnIndexes(header, required, label) {
  const missing = required.filter((name) => !header.includes(name));
  if (missing.length) errors.push(`${label}: missing columns: ${missing.join(', ')}`);
  return Object.fromEntries(header.map((name, index) => [name, index]));
}

const [specText, schemaText, registryText, comboText, matrixText] = await Promise.all([
  load('EXAM_SPECIFICATION_1406.json'),
  load('EXAM_SPECIFICATION_SCHEMA.json'),
  load('SOURCE_REGISTRY.json'),
  load('EXAM_COMBINATIONS_1405_BASELINE.csv'),
  load('CURRICULUM_COVERAGE_MATRIX.csv'),
]);

let spec;
let schema;
let registry;
try { spec = JSON.parse(specText); } catch (error) { errors.push(`Exam specification JSON: ${error.message}`); }
try { schema = JSON.parse(schemaText); } catch (error) { errors.push(`Exam schema JSON: ${error.message}`); }
try { registry = JSON.parse(registryText); } catch (error) { errors.push(`Source registry JSON: ${error.message}`); }

if (spec) {
  if (spec.examYear !== 1406 || spec.examType !== 'phd') {
    errors.push('Specification must target PhD 1406.');
  }
  if (spec.verificationStatus !== 'partially_verified') {
    errors.push('1406 specification must remain partially_verified until the official field/bundle table is checked.');
  }

  const components = Object.fromEntries(
    (spec.assessmentComponents ?? []).map((item) => [item.componentId, item]),
  );
  if (components.language?.coefficient !== 1) errors.push('Language coefficient must be 1.');
  if (
    components.specialized_bundle?.coefficient !== 5 ||
    components.specialized_bundle?.coefficientScope !== 'whole_bundle'
  ) {
    errors.push('Specialized coefficient must be 5 at whole-bundle scope.');
  }
  if ((spec.examSets ?? []).some((set) => (set.combinations ?? []).length > 0)) {
    errors.push('Do not infer 1406 combinations before verifying the official PDF.');
  }
  if (spec.schedule?.registrationEndExtendedTo !== '1405-08-15') {
    errors.push('Registration extension to 1405-08-15 is missing.');
  }
  if (spec.schedule?.examDate !== '1405-11-16') errors.push('Exam date for 1406 is inconsistent.');
}

if (schema && schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
  errors.push('Exam schema must declare JSON Schema 2020-12.');
}
if (registry) {
  const sourceIds = (registry.sources ?? []).map((source) => source.id);
  if (new Set(sourceIds).size !== sourceIds.length) {
    errors.push('Source registry contains duplicate source IDs.');
  }
  for (const sourceId of spec?.sources ?? []) {
    if (!sourceIds.includes(sourceId)) errors.push(`Unknown source ID in exam specification: ${sourceId}`);
  }
  // No placeholder hashes or fake file evidence may survive in the registry.
  const placeholderHits = registryText.match(/"fileHash[a-zA-Z0-9]*"\s*:\s*"[^"]*placeholder[^"]*"|"sha256"\s*:\s*"[^"]*placeholder[^"]*"/gi) ?? [];
  for (const hit of placeholderHits) errors.push(`Placeholder hash in source registry: ${hit.slice(0, 60)}`);
  for (const source of registry.sources ?? []) {
    const hashes = Object.entries(source).filter(([key]) => /sha256|fileHash/i.test(key));
    for (const [, value] of hashes) {
      if (typeof value === 'string' && !/^[0-9a-f]{64}$/i.test(value)) {
        errors.push(`Source ${source.id} has a non-64-hex hash value: ${value.slice(0, 40)}`);
      }
    }
    if (source.accessed !== true && source.type?.includes('official') && (source.contentVerified ?? []).length > 0) {
      errors.push(`Source ${source.id} claims verified content while accessed=false.`);
    }
  }
}

const combo = parseCsv(comboText, 'EXAM_COMBINATIONS_1405_BASELINE.csv');
const c = getColumnIndexes(
  combo.header,
  ['exam_year', 'set_code', 'combination_code', 'field_name', 'major_or_track',
   'course_bundle_numbers_1405', 'verification_status'],
  '1405 baseline',
);
const assignments = new Set();

for (const item of combo.rows) {
  if (item[c.exam_year] !== '1405' || item[c.set_code] !== '2162') {
    errors.push('1405 baseline row has the wrong exam year or exam-set code.');
  }
  const combinationCode = item[c.combination_code] ?? '';
  if (combinationCode && !['1', '2', '3', '4', '5', '6', '7'].includes(combinationCode)) {
    errors.push(`Invalid 1405 combination code: ${combinationCode}`);
  }
  const bundles = (item[c.course_bundle_numbers_1405] ?? '').split(';').filter(Boolean);
  for (const bundle of bundles) {
    if (!['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(bundle)) {
      errors.push(`Invalid 1405 subject bundle: ${bundle}`);
    }
  }
  const key = [item[c.field_name], item[c.major_or_track], combinationCode].join('|');
  if (assignments.has(key)) errors.push(`Duplicate baseline row assignment: ${key}`);
  assignments.add(key);
}

// Combination-code consistency: the official definition requires the same
// subject bundles for every row sharing a combination code. Rows that violate
// this must be quarantined (verification_status must not claim the plain
// official_handbook_1405 status).
const bundlesByCombination = new Map();
for (const item of combo.rows) {
  const code = item[c.combination_code];
  if (!code) continue;
  const bundleSig = (item[c.course_bundle_numbers_1405] ?? '').split(';').filter(Boolean).sort().join(';');
  const status = item[c.verification_status];
  const prev = bundlesByCombination.get(code);
  if (prev && prev.sig !== bundleSig && status === 'official_handbook_1405') {
    errors.push(`Combination ${code} row marked official_handbook_1405 diverges from that combination's bundles; quarantine it instead.`);
  } else if (!prev) {
    bundlesByCombination.set(code, { sig: bundleSig, status });
  }
}

const matrix = parseCsv(matrixText, 'CURRICULUM_COVERAGE_MATRIX.csv');
const m = getColumnIndexes(
  matrix.header,
  ['topic_id', 'cognitive_targets', 'prerequisite_topic_ids', 'curriculum_status', 'review_status'],
  'curriculum matrix',
);
const topicIds = matrix.rows.map((item) => item[m.topic_id]);
const topicSet = new Set(topicIds);
if (topicSet.size !== topicIds.length) errors.push('Curriculum matrix contains duplicate topic IDs.');

const bloomLevels = new Set(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']);
for (const item of matrix.rows) {
  const topicId = item[m.topic_id];
  if (!bloomLevels.has(item[m.cognitive_targets])) {
    errors.push(`Invalid Bloom cognitive level for ${topicId}: ${item[m.cognitive_targets]}`);
  }
  if (item[m.curriculum_status] !== 'proposed_topic_expansion') {
    errors.push(`Unexpected curriculum status for ${topicId}`);
  }
  if (item[m.review_status] !== 'pending_sme_review') {
    errors.push(`Topic is not marked for subject-matter review: ${topicId}`);
  }
  for (const prerequisite of (item[m.prerequisite_topic_ids] ?? '').split(';').filter(Boolean)) {
    if (!topicSet.has(prerequisite)) {
      errors.push(`Unknown prerequisite ${prerequisite} referenced by ${topicId}`);
    }
  }
}

// Prerequisite cycle detection (DFS three-color).
const prereqEdges = new Map();
for (const item of matrix.rows) {
  prereqEdges.set(item[m.topic_id], (item[m.prerequisite_topic_ids] ?? '').split(';').filter((id) => topicSet.has(id)));
}
const WHITE = 0, GRAY = 1, BLACK = 2;
const color = new Map([...topicSet].map((id) => [id, WHITE]));
function visit(node, stack) {
  color.set(node, GRAY);
  for (const next of prereqEdges.get(node) ?? []) {
    if (color.get(next) === GRAY) {
      errors.push(`Prerequisite cycle detected: ${[...stack, node, next].join(' -> ')}`);
      color.set(next, BLACK);
    } else if (color.get(next) === WHITE) {
      visit(next, [...stack, node]);
    }
  }
  color.set(node, BLACK);
}
for (const topic of topicSet) {
  if (color.get(topic) === WHITE) visit(topic, []);
}

if (errors.length) {
  console.error('PHASE 1 FOUNDATION VALIDATION: FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('PHASE 1 FOUNDATION VALIDATION: PASS');
  console.log(`- 1405 row-level field mappings: ${combo.rows.length}`);
  console.log(`- Proposed curriculum topics: ${matrix.rows.length}`);
  console.log(`- Registered sources: ${registry.sources.length}`);
  console.log('- 1406 remains partially verified; no unverified combinations were inferred.');
}
