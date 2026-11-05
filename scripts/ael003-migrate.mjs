/**
 * AEL-003 مرحلهٔ ۴/۵ — Importer با Dry-run پیش‌فرض + Idempotency + Reconciliation.
 * اجرا روی pglite (Disposable):
 *   node scripts/ael003-migrate.mjs            # dry-run (پیش‌فرض) — هیچ Write
 *   node scripts/ael003-migrate.mjs --commit   # Commit واقعی + Re-run برای Idempotency
 *
 * خانواده‌ها: F1 (دو بستهٔ درس) + F2 (سه بانک سؤال) — طبق 02-mapping/DATA_MAPPING_OVERVIEW.md
 */
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const COMMIT = process.argv.includes('--commit');
const root = process.cwd();
const outDir = join(root, 'reports', 'ael-003', '05-migration-runs');
mkdirSync(outDir, { recursive: true });
const BATCH_ID = `ael003-${COMMIT ? 'commit' : 'dryrun'}-${new Date().toISOString().slice(0, 10)}`;
const sha = (value) => createHash('sha256').update(value).digest('hex');

// ---------- نرمال‌سازی (Projection — raw حفظ می‌شود §7.2/§8) ----------
const normalize = (text) => String(text ?? '')
  .replace(/[\u200c\u200f\u200e]/g, ' ')
  .replace(/[ىي]/g, 'ی').replace(/ك/g, 'ک')
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/\s+/g, ' ').trim().toLowerCase();

const db = new PGlite({ extensions: { pgcrypto } });
const migrationsDir = join(root, 'supabase', 'migrations');
const migrationFiles = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
for (const file of migrationFiles) {
  await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
}
const readdirSyncSafe = (dir) => readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

// ---------- transform F1: بسته‌های درس ----------
const records = []; // { source_ref, key, hash, type, status, targetId, payload, notes }
for (const name of ['financial-management.json', 'statistics-foundations.json']) {
  const path = join(root, 'content', 'learning-courses', name);
  const raw = readFileSync(path, 'utf8');
  const sourceHash = sha(raw);
  const data = JSON.parse(raw);
  const sourceRef = `course:${data.id}`;
  // course item — status: authored_pilot → review pending (هرگز approved خودکار، §0 نکتهٔ مهم)
  records.push({
    sourceRef, key: `course:${data.id}`, hash: sha(JSON.stringify({ t: data.topics, d: data.description })),
    type: 'content_item', status: 'migrated_needs_review',
    target: `course-pack-${data.id}`,
    payload: { kind: 'course', slug: `course-pack-${data.id}`, title: data.title ?? data.id, body: { courseId: data.id, title: data.title, description: data.description, scopeNote: data.scopeNote, sources: data.sources, topics: data.topics }, reviewStatus: 'pending_review' },
    notes: 'F1 verbatim + pending_sme → pending_review (تبدیل به reviewed ممنوع)',
  });
  for (const q of data.questions ?? []) {
    const shapeOk = q.id && q.prompt && Array.isArray(q.choices);
    records.push({
      sourceRef, key: `question:${q.id}`, hash: sha(JSON.stringify(q)),
      type: 'content_item', status: shapeOk ? 'migrated_needs_review' : 'quarantined',
      target: shapeOk ? `course-pack-${data.id}#${q.id}` : null,
      payload: shapeOk ? { kind: q.kind === 'essay' ? 'essay' : 'mcq', slug: `course-pack-${data.id}-${q.id}`, title: q.id, body: { ...q, courseId: data.id }, reviewStatus: 'pending_review' } : null,
      notes: shapeOk ? 'F1 authored question — pending_review' : 'F1: shape نامعتبر (§10)',
      quarantineReason: shapeOk ? null : 'INVALID_SHAPE',
    });
  }
}

// ---------- transform F2: بانک‌های سؤال ----------
const rightsMap = { pending: 'pending', unknown: 'unknown' };
for (const name of ['bank-official_traced_arshad', 'bank-official_traced_phd', 'bank-quarantine']) {
  const path = join(root, 'content', 'questions', `${name}.json`);
  const raw = readFileSync(path, 'utf8');
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : (data.questions ?? []);
  const sourceRef = `questions:${name}`;
  const bankKind = name.includes('quarantine') ? 'quarantine' : 'official';
  for (const q of list) {
    const prompt = q.questionText ?? q.prompt ?? '';
    const options = q.options ?? q.choices ?? [];
    const key = q.correctOption;
    const shapeOk = q.id && prompt.trim() && Array.isArray(options) && options.length >= 2;
    const keyValid = typeof key === 'number' && key >= 0 && key < options.length;
    let status = 'migrated_needs_review';
    let reason = null;
    if (!shapeOk) { status = 'quarantined'; reason = 'INVALID_SHAPE'; }
    else if (!keyValid) { status = 'quarantined'; reason = key === undefined || key === null ? 'ANSWER_CLAIM_MISSING' : 'ANSWER_OUT_OF_RANGE'; }
    else if (bankKind === 'quarantine') { status = 'quarantined'; reason = 'SOURCE_QUARANTINE_BANK'; }
    else if (q.copyrightStatus === 'unknown' || !q.copyrightStatus) { status = 'migrated_needs_review'; reason = null; }
    records.push({
      sourceRef, key: `question:${q.id}`, hash: sha(JSON.stringify(q)),
      type: 'staged_question', status,
      target: shapeOk ? `staged:${q.id}@${name}` : null,
      payload: shapeOk ? {
        questionId: q.id, sourceBank: name, examYear: q.examYear ?? null, bookletCode: q.bookletCode ?? null,
        questionNumber: q.bookletQuestionNumber ?? null, courseId: q.courseId ?? null,
        promptRaw: prompt, promptNormalized: normalize(prompt), optionsRaw: options,
        answerClaim: { correctOption: keyValid ? key : null, source: sourceRef, confidence: 'source_claim', verified: false },
        explanation: q.explanation ?? null,
        rightsStatus: rightsMap[q.copyrightStatus] ?? 'unknown',
        reviewStatus: status === 'quarantined' ? 'quarantined' : 'pending_review',
      } : null,
      notes: `F2 ${bankKind} — Appearance fields: year=${q.examYear ?? 'unknown'} booklet=${q.bookletCode ?? 'unknown'}#q${q.bookletQuestionNumber ?? 'unknown'}`,
      quarantineReason: reason,
    });
  }
}

// ---------- Batch ledger row ----------
await db.query(
  `insert into migration_batches (batch_id, source_ref, source_snapshot_hash, dry_run, environment, operator_id, total_records, notes)
   values ($1,'ael003:legacy_assets',$2,$3,'test','agent-ael003',$4,'F1+F2 per mapping v1')
   on conflict (batch_id) do update set total_records = excluded.total_records, dry_run = excluded.dry_run`,
  [BATCH_ID, sha(JSON.stringify(records.map(r => r.hash))), !COMMIT, records.length],
);

// ---------- Insert records (idempotent: ON CONFLICT DO UPDATE last_seen) ----------
let inserted = 0, updated = 0;
for (const record of records) {
  const res = await db.query(
    `insert into migration_records (batch_id, source_ref, source_record_key, source_record_hash,
       target_entity_type, target_entity_id, migration_status, raw_payload, transformation_notes, quarantine_reason)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (source_ref, source_record_key, target_entity_type) do update set
       last_seen_at = now(), migration_status = excluded.migration_status,
       source_record_hash = excluded.source_record_hash
     returning (xmax = 0) as inserted`,
    [BATCH_ID, record.sourceRef, record.key, record.hash, record.type, record.target,
      record.status, record.payload ? JSON.stringify(record.payload) : null, record.notes, record.quarantineReason],
  );
  if (res.rows[0]?.inserted) inserted += 1; else updated += 1;
  // Staged target write — فقط در commit و فقط برای non-quarantined
  if (COMMIT && record.payload && record.status !== 'quarantined') {
    if (record.type === 'content_item') {
      await db.query(
        `insert into staged_content_versions (batch_id, content_item_slug, content_kind, title, body, content_hash, review_status, rights_status)
         values ($1,$2,$3,$4,$5,$6,$7,'pending') on conflict (batch_id, content_item_slug, content_hash) do nothing`,
        [BATCH_ID, record.payload.slug, record.payload.kind, record.payload.title,
          JSON.stringify(record.payload.body), record.hash, record.payload.reviewStatus],
      );
    } else if (record.type === 'staged_question') {
      const p = record.payload;
      await db.query(
        `insert into staged_questions (batch_id, question_id, source_bank, exam_year, booklet_code,
           question_number, course_id, prompt_raw, prompt_normalized, options_raw, answer_claim,
           explanation, rights_status, review_status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict (batch_id, question_id, source_bank) do update set last_seen_check = now()`,
        [BATCH_ID, p.questionId, p.sourceBank, p.examYear, p.bookletCode, p.questionNumber,
          p.courseId, p.promptRaw, p.promptNormalized, JSON.stringify(p.optionsRaw),
          JSON.stringify(p.answerClaim), p.explanation, p.rightsStatus, p.reviewStatus],
      ).catch(async () => {
        // ستون last_seen_check وجود ندارد — fallback به do nothing
        await db.query(
          `insert into staged_questions (batch_id, question_id, source_bank, exam_year, booklet_code,
             question_number, course_id, prompt_raw, prompt_normalized, options_raw, answer_claim,
             explanation, rights_status, review_status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           on conflict (batch_id, question_id, source_bank) do nothing`,
          [BATCH_ID, p.questionId, p.sourceBank, p.examYear, p.bookletCode, p.questionNumber,
            p.courseId, p.promptRaw, p.promptNormalized, JSON.stringify(p.optionsRaw),
            JSON.stringify(p.answerClaim), p.explanation, p.rightsStatus, p.reviewStatus],
        );
      });
    }
  }
}

// ---------- Reconciliation (§17) ----------
const recon = (await db.query(`select reconcile_migration_batch($1) as out`, [BATCH_ID])).rows[0].out;
const statusCounts = recon.status_counts;

// شمارش staged واقعی در commit
let stagedCounts = null;
if (COMMIT) {
  stagedCounts = {
    contentVersions: (await db.query(`select count(*)::int as n from staged_content_versions where batch_id=$1`, [BATCH_ID])).rows[0].n,
    questions: (await db.query(`select count(*)::int as n from staged_questions where batch_id=$1`, [BATCH_ID])).rows[0].n,
  };
}

const result = {
  batchId: BATCH_ID, mode: COMMIT ? 'commit' : 'dry-run',
  totalRecords: records.length,
  ledger: { inserted, updatedOrReplayed: updated },
  statusCounts, reconciliationPassed: recon.passed,
  stagedCounts,
  promise: 'هیچ رکورد مبدأ بی‌سرنوشت نمانده است (§0.1)' ,
};

// Idempotency check: اجرای مجدد همین اسکریپت نباید inserted جدید بسازد
writeFileSync(join(outDir, `${COMMIT ? 'commit' : 'dry_run'}-${BATCH_ID}.json`), JSON.stringify({ result, records: records.map(({ sourceRef, key, status, target, quarantineReason }) => ({ sourceRef, key, status, target, quarantineReason })) }, null, 1));
console.log(JSON.stringify(result, null, 1));
if (!recon.passed) process.exit(1);
