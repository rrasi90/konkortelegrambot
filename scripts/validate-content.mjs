#!/usr/bin/env node
/**
 * اعتبارسنجی بستهٔ محتوا (Exam Pack)
 * کاربرد: node scripts/validate-content.mjs content/examples/demo-pack.json
 * خروجی: گزارش خطاها؛ در صورت وجود خطا با کد ۱ خارج می‌شود.
 */
import { readFileSync } from 'node:fs';

const RELATIONS = ['prerequisite_of', 'confusable_with', 'applied_in', 'part_of', 'related_to', 'prerequisite', 'cross_course'];
const RIGHTS = ['unknown', 'review_required', 'authorized', 'public_domain', 'licensed', 'blocked'];
const isTrackSlug = (value) => typeof value === 'string' && /^[a-z][a-z0-9_-]{1,39}$/.test(value);

const path = process.argv[2];
if (!path) {
  console.error('کاربرد: validate-content.mjs <pack.json>');
  process.exit(2);
}

const errors = [];
const warnings = [];

let pack;
try {
  pack = JSON.parse(readFileSync(path, 'utf8'));
} catch (e) {
  console.error(`خطا در خواندن فایل: ${e.message}`);
  process.exit(2);
}

if (!pack.meta || typeof pack.meta.name !== 'string' || !pack.meta.version) {
  errors.push('meta.name و meta.version الزامی‌اند.');
}
if (!Array.isArray(pack.nodes) || pack.nodes.length === 0) errors.push('nodes خالی است.');
if (!Array.isArray(pack.questions) || pack.questions.length === 0) errors.push('questions خالی است.');
if (pack.meta && pack.meta.synthetic !== true) {
  warnings.push('این بسته synthetic=true نیست؛ در انتشار رسمی، حقوق استفاده و بازبینی متخصص باید مستند باشد.');
  if (!RIGHTS.includes(pack.meta.rightsStatus)) errors.push('برای بستهٔ غیرساختگی، meta.rightsStatus از نوع مجاز الزامی است.');
  else if (!['authorized','public_domain','licensed'].includes(pack.meta.rightsStatus)) errors.push('محتوای غیرساختگی بدون مجوز صریح استفاده، قابل انتشار/درون‌ریزی رسمی نیست.');
}

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
    if (!isTrackSlug(n.track)) errors.push(`node.track نامعتبر برای ${n.id}: ${n.track}`);
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
    if (typeof d.weight !== 'number' || !Number.isFinite(d.weight) || d.weight < 0.2 || d.weight > 0.6) {
      errors.push(`weight خارج از بازهٔ ۰٫۲ تا ۰٫۶: ${d.source} → ${d.target} (${d.weight})`);
    }
    if (d.confidence !== undefined && (typeof d.confidence !== 'number' || d.confidence < 0 || d.confidence > 1)) errors.push(`confidence نامعتبر برای یال ${d.source} → ${d.target}`);
    if (d.verificationStatus !== undefined && !['unverified','verified','rejected'].includes(d.verificationStatus)) errors.push(`verificationStatus نامعتبر برای یال ${d.source} → ${d.target}`);
    if (RELATIONS.includes(d.relation) && ['prerequisite_of','confusable_with','applied_in','part_of','related_to'].includes(d.relation) && d.verificationStatus !== 'verified') warnings.push(`یال معنایی ${d.source} → ${d.target} هنوز تأیید متخصص ندارد و نباید محرک تصمیم خودکار باشد.`);
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
    if (!Array.isArray(q.options) || q.options.some((option) => typeof option !== 'string' || option.trim().length === 0)) errors.push(`گزینهٔ خالی/نامعتبر: ${q.id}`);
    if (typeof q.correctOption !== 'number' || !Number.isInteger(q.correctOption) || q.correctOption < 0 || (Array.isArray(q.options) && q.correctOption >= q.options.length)) {
      errors.push(`correctOption نامعتبر: ${q.id}`);
    }
    if (q.examYear !== undefined && (typeof q.examYear !== 'number' || q.examYear < 1390 || q.examYear > 1410)) {
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

for (const w of warnings) console.warn(`هشدار: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`خطا: ${e}`);
  console.error(`\n${errors.length} خطا یافت شد.`);
  process.exit(1);
}
console.log(
  `بستهٔ «${pack.meta?.name}» معتبر است: ${nodeIds.size} گره، ` +
    `${(pack.dependencies ?? []).length} یال، ${questionIds.size} سؤال. ` +
    `(${warnings.length} هشدار)`,
);
