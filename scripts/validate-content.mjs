#!/usr/bin/env node
/**
 * اعتبارسنجی بستهٔ محتوا (Exam Pack)
 * کاربرد:
 *   node scripts/validate-content.mjs content/examples/demo-pack.json
 *   node scripts/validate-content.mjs --all
 * خروجی: گزارش خطاها؛ در صورت وجود خطا با کد ۱ خارج می‌شود.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// هم‌تراز با packages/contracts (TRACK_IDS)
const TRACKS = ['common', 'business', 'technology', 'strategy', 'industrial'];
const RELATIONS = ['prerequisite', 'cross_course'];

function defaultPackFiles() {
  const files = [];
  if (existsSync('content/examples/demo-pack.json')) files.push('content/examples/demo-pack.json');
  const packsDir = 'content/knowledge/exam-packs';
  if (existsSync(packsDir)) {
    for (const name of readdirSync(packsDir).sort()) {
      if (name.endsWith('.json')) files.push(join(packsDir, name));
    }
  }
  return files;
}

/** اعتبارسنجی یک بسته؛ آرایه‌های خطا/هشدار و آمار را برمی‌گرداند */
function validatePack(pack) {
  const errors = [];
  const warnings = [];

  if (!pack || typeof pack !== 'object') {
    errors.push('ساختار بستهٔ محتوا شیء JSON نیست.');
    return { errors, warnings, nodeCount: 0, edgeCount: 0, questionCount: 0 };
  }
  if (!pack.meta || typeof pack.meta.name !== 'string' || !pack.meta.version) {
    errors.push('meta.name و meta.version الزامی‌اند.');
  }
  if (!Array.isArray(pack.nodes) || pack.nodes.length === 0) errors.push('nodes خالی است.');
  if (!Array.isArray(pack.questions) || pack.questions.length === 0) errors.push('questions خالی است.');

  const nodeIds = new Set();
  const questionIds = new Set();

  if (Array.isArray(pack.nodes)) {
    const seen = new Set();
    for (const n of pack.nodes) {
      const label = n.id ?? JSON.stringify(n).slice(0, 40);
      if (typeof n.id !== 'string' || !/^[a-z0-9_.-]{2,60}$/.test(n.id)) {
        errors.push(`node.id نامعتبر: ${label}`);
        continue;
      }
      if (seen.has(n.id)) errors.push(`node.id تکراری: ${n.id}`);
      seen.add(n.id);
      nodeIds.add(n.id);
      if (!TRACKS.includes(n.track)) errors.push(`node.track نامعتبر برای ${n.id}: ${n.track}`);
      for (const f of ['course', 'chapter', 'topic']) {
        if (typeof n[f] !== 'string' || n[f].trim().length === 0) {
          errors.push(`node.${f} نامعتبر برای ${n.id}`);
        }
      }
    }
  }

  if (Array.isArray(pack.dependencies)) {
    for (const d of pack.dependencies) {
      if (!nodeIds.has(d.source)) errors.push(`یال با source ناشناخته: ${d.source}`);
      if (!nodeIds.has(d.target)) errors.push(`یال با target ناشناخته: ${d.target}`);
      if (d.source === d.target) errors.push(`یال خود-ارجاع: ${d.source}`);
      if (!RELATIONS.includes(d.relation)) errors.push(`relation نامعتبر: ${d.relation}`);
      if (typeof d.weight !== 'number' || d.weight < 0.2 || d.weight > 0.6) {
        errors.push(`weight خارج از بازهٔ ۰٫۲ تا ۰٫۶: ${d.source} → ${d.target} (${d.weight})`);
      }
    }
  }

  if (Array.isArray(pack.questions)) {
    for (const q of pack.questions) {
      const label = q.id ?? JSON.stringify(q).slice(0, 40);
      if (typeof q.id !== 'string' || q.id.length === 0) {
        errors.push(`question.id نامعتبر: ${label}`);
        continue;
      }
      if (questionIds.has(q.id)) errors.push(`question.id تکراری: ${q.id}`);
      questionIds.add(q.id);
      if (!nodeIds.has(q.nodeId)) errors.push(`question ${q.id} به گره ناشناخته وصل است: ${q.nodeId}`);
      if (typeof q.text !== 'string' || q.text.trim().length === 0) errors.push(`متن خالی: ${q.id}`);
      if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`options ناکافی: ${q.id}`);
      if (
        typeof q.correctOption !== 'number' ||
        q.correctOption < 0 ||
        (Array.isArray(q.options) && q.correctOption >= q.options.length)
      ) {
        errors.push(`correctOption نامعتبر: ${q.id}`);
      }
      if (
        q.examYear !== undefined &&
        (typeof q.examYear !== 'number' || q.examYear < 1390 || q.examYear > 1410)
      ) {
        warnings.push(`examYear مشکوک: ${q.id} → ${q.examYear}`);
      }
      if (!q.explanation || !q.explanation.trim()) warnings.push(`توضیح خالی: ${q.id}`);
      if (!q.trapNote || !q.trapNote.trim()) warnings.push(`نکتهٔ دام خالی: ${q.id}`);
    }

    // پوشش: هر گره باید حداقل یک سؤال داشته باشد
    const covered = new Set(pack.questions.map((q) => q.nodeId));
    for (const id of nodeIds) {
      if (!covered.has(id)) warnings.push(`گره بدون سؤال: ${id}`);
    }
  }

  // اعتبارسنجی نگاشت‌های مهارت و صحت روابط دانشی
  try {
    if (existsSync('content/knowledge/skills.json')) {
      const skills = JSON.parse(readFileSync('content/knowledge/skills.json', 'utf8'));
      const skillIds = new Set(skills.map((s) => s.id));
      if (existsSync('content/knowledge/question-skill-mappings.jsonl')) {
        const mappingLines = readFileSync('content/knowledge/question-skill-mappings.jsonl', 'utf8')
          .trim()
          .split('\n');
        for (const line of mappingLines) {
          if (!line.trim()) continue;
          const m = JSON.parse(line);
          if (questionIds.has(m.question_id)) {
            if (!skillIds.has(m.primary_skill_id)) {
              errors.push(`سؤال ${m.question_id} به مهارت ناموجود ${m.primary_skill_id} متصل است.`);
            }
            for (const sec of m.secondary_skill_ids ?? []) {
              if (!skillIds.has(sec)) {
                errors.push(`سؤال ${m.question_id} به مهارت ثانویه ناموجود ${sec} متصل است.`);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    warnings.push(`عدم امکان بررسی تطابق مهارت‌ها: ${err.message}`);
  }

  return {
    errors,
    warnings,
    nodeCount: nodeIds.size,
    edgeCount: (pack.dependencies ?? []).length,
    questionCount: questionIds.size,
  };
}

const cliArgs = process.argv.slice(2);
const useAll = cliArgs.includes('--all');
const files = cliArgs.filter((a) => !a.startsWith('--'));
if (useAll || files.length === 0) files.push(...defaultPackFiles());
if (files.length === 0) {
  console.error('هیچ بستهٔ محتوایی برای اعتبارسنجی پیدا نشد.');
  process.exit(2);
}

let failed = false;
for (const path of files) {
  let pack;
  try {
    pack = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`خطا در خواندن فایل ${path}: ${e.message}`);
    failed = true;
    continue;
  }

  const { errors, warnings, nodeCount, edgeCount, questionCount } = validatePack(pack);
  for (const w of warnings) console.warn(`هشدار [${path}]: ${w}`);
  if (errors.length > 0) {
    failed = true;
    for (const e of errors) console.error(`خطا [${path}]: ${e}`);
    console.error(`${path}: ${errors.length} خطا یافت شد.\n`);
    continue;
  }
  console.log(
    `بستهٔ «${pack.meta?.name ?? path}» معتبر است: ${nodeCount} گره، ` +
      `${edgeCount} یال، ${questionCount} سؤال. (${warnings.length} هشدار)`,
  );
}

if (failed) process.exit(1);
console.log(`\nهمهٔ ${files.length} بستهٔ محتوایی معتبرند.`);
