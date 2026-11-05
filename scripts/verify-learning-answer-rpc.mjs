/**
 * AEL-610/612 + ADR-011 — اثبات RPC اتمیک ثبت پاسخ تألیفی روی DB آزمایشی (pglite).
 * سناریوها: ثبت موفق / تکرار همان operationId (replay) / تکرار با محتوای متفاوت (Conflict)
 * / بلیت بیگانه / بلیت منقضی / تسلط و کارت FSRS فقط یک‌بار.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const db = new PGlite({ extensions: { pgcrypto } });
for (const file of readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
}

// stub تابع auth.uid() برای اجرای مستقل RPC (در Supabase واقعی از JWT می‌آید)
await db.exec(`
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid as $$
    select nullif(current_setting('ael.test_user', true), '')::uuid
  $$ language sql stable;
`);

const USER = '11111111-1111-4111-8111-111111111111';
await db.query('insert into app_users (id) values ($1) on conflict do nothing', [USER]);
const setUid = (uid) => db.query(`select set_config('ael.test_user', $1, false)`, [uid]);
await setUid(USER);

async function callRpc({ attemptId, questionId, selected, operationId, isCorrect, topicId, mastery, fsrs }) {
  try {
    const res = await db.query(
      `select submit_learning_answer_secure($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as out`,
      [attemptId, questionId, selected, operationId, isCorrect, topicId, mastery,
        fsrs?.stability ?? null, fsrs?.difficulty ?? null, fsrs?.dueDays ?? null],
    );
    return { ok: true, out: res.rows[0].out };
  } catch (error) {
    return { ok: false, error: String(error.message ?? error).split('\n')[0] };
  }
}

const attemptId = 'attempt-1';
await db.query(
  `insert into learning_quiz_attempts (id, user_id, course_id, course_version, mode, question_ids, expires_at)
   values ($1,$2,'crs-finmgmt','1.0.0','practice',$3, now() + interval '1 hour')`,
  [attemptId, USER, JSON.stringify(['q1', 'q2'])],
);

const results = {};
const fsrs = { stability: 1.2, difficulty: 5.1, dueDays: 3 };

// ۱) ثبت موفق
results.insert = await callRpc({ attemptId, questionId: 'q1', selected: 2, operationId: 'op-1', isCorrect: true, topicId: 'tvm', mastery: 60, fsrs });

// ۲) تکرار همان operationId با همان محتوا → replay
results.replay = await callRpc({ attemptId, questionId: 'q1', selected: 2, operationId: 'op-1', isCorrect: true, topicId: 'tvm', mastery: 60, fsrs });

// ۳) همان operationId با محتوای متفاوت → OPERATION_CONFLICT
results.conflict = await callRpc({ attemptId, questionId: 'q1', selected: 0, operationId: 'op-1', isCorrect: false, topicId: 'tvm', mastery: 40, fsrs: null });

// ۴) سؤال خارج از بلیت
results.foreignQuestion = await callRpc({ attemptId, questionId: 'q9', selected: 1, operationId: 'op-2', isCorrect: false, topicId: 'npv', mastery: 40, fsrs: null });

// ۵) بلیت منقضی
await db.query(`update learning_quiz_attempts set expires_at = now() - interval '1 minute' where id = $1`, [attemptId]);
results.expired = await callRpc({ attemptId, questionId: 'q2', selected: 1, operationId: 'op-3', isCorrect: false, topicId: 'npv', mastery: 40, fsrs: null });

// ۶) شمارش‌ها — دقیقاً یک رخداد، یک تسلط، یک کارت
const counts = (await db.query(`
  select
    (select count(*) from learning_answer_events where user_id = $1)::int as answers,
    (select mastery from authored_topic_mastery where user_id = $1 and topic_id = 'tvm')::float as mastery,
    (select correct_count from authored_topic_mastery where user_id = $1 and topic_id = 'tvm')::int as correct,
    (select count(*) from authored_review_cards where user_id = $1)::int as cards,
    (select status from learning_quiz_attempts where id = $2) as attempt_status
`, [USER, attemptId])).rows[0];

const checks = {
  insertOk: results.insert.ok && results.insert.out.replay === false,
  replayOk: results.replay.ok && results.replay.out.replay === true,
  conflictRejected: !results.conflict.ok && results.conflict.error.includes('OPERATION_CONFLICT'),
  foreignQuestionRejected: !results.foreignQuestion.ok && results.foreignQuestion.error.includes('QUESTION_NOT_IN_ATTEMPT'),
  expiredRejected: !results.expired.ok && results.expired.error.includes('ATTEMPT_EXPIRED'),
  exactlyOneAnswer: counts.answers === 1,
  masteryAppliedOnce: counts.mastery === 60 && counts.correct === 1,
  exactlyOneCard: counts.cards === 1,
  // نکتهٔ اتمی: پرتاب exception در RPC تراکنش (شامل update وضعیت expired) را rollback می‌کند؛
  // علامت‌گذاری نهایی وضعیت expired مسئولیت فراخواننده/پاک‌ساز دوره‌ای است.

};
const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ results, counts, checks, result: pass ? 'RPC_ATOMIC_PASS' : 'FAIL' }, null, 2));
process.exit(pass ? 0 : 1);
