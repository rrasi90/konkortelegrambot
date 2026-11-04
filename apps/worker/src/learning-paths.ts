import { courseOverview, createQuiz, findTransferQuestion, FormativeQuizError, gradeFormativeAnswer, gradeFormativeQuiz } from '@ael/engine';
import type { LearningCourse, QuizChallenge, QuizInput } from '@ael/engine';
import { learningCourses } from './learning-catalog';
import recurrence from '../../../content/learning-evidence/recurrence.json';
import questionIndex from '../../../content/learning-evidence/question-index.json';
import { issueSessionToken, verifySessionToken } from './auth';

// Registry for authored pilot packs. Generated/client assets never import this module.
const courses = learningCourses;
const secretForQuiz = (secret: string) => `ael.formative.v1:${secret}`;
const lifetime = 24 * 60 * 60_000;
const submitGrace = 15_000;
type SignedChallenge = QuizChallenge & { userId: string; expires: number };

// EX-03: عملیات تکرارپذیر — نتیجهٔ مسیر تألیفی تابع خالص (چالش، پاسخ) است، پس
// تکرار همان شناسهٔ عملیات با همان محتوا همیشه همان نتیجه را می‌دهد و رکورد دوم
// نمی‌سازد. این نگاشت فقط «همان opId با محتوای متفاوت» را رد می‌کند (الگوی
// مهاجرت 0018). حافظه per-isolate است و پس از ری‌استارت فقط تعارض‌های جدید دیده می‌شوند؛
// درستی نتیجه به این حافظه وابسته نیست.
const operationFingerprints = new Map<string, { expires: number; fingerprint: string }>();
const operationTtl = 24 * 60 * 60_000;

function assertUniqueOperation(userId: string, operationId: unknown, payload: unknown, now: number): void {
  if (operationId === undefined || operationId === null) return;
  if (typeof operationId !== 'string' || !operationId.trim() || operationId.length > 128) {
    throw new FormativeQuizError('شناسهٔ عملیات معتبر نیست.');
  }
  const key = `${userId}:${operationId}`;
  const fingerprint = JSON.stringify(payload);
  const seen = operationFingerprints.get(key);
  if (seen && now < seen.expires) {
    if (seen.fingerprint !== fingerprint) {
      throw new FormativeQuizError('این شناسهٔ عملیات قبلاً با محتوای متفاوت ثبت شده است.');
    }
    return;
  }
  operationFingerprints.set(key, { expires: now + operationTtl, fingerprint });
  if (operationFingerprints.size > 10_000) {
    const cutoff = now;
    for (const [key, value] of operationFingerprints) if (value.expires < cutoff) operationFingerprints.delete(key);
  }
}

export function learningOverview() {
  return { courses: courses.map(courseOverview), recurrence, questionIndex };
}

function lookupCourse(id: unknown): LearningCourse {
  const course = courses.find(item => item.id === id);
  if (!course) throw new FormativeQuizError('درس مورد نظر موجود نیست.');
  return course;
}

export async function startLearningQuiz(userId: string, secret: string, input: QuizInput & { courseId?: unknown }, now = Date.now()) {
  const course = lookupCourse(input.courseId);
  const { challenge, questions } = createQuiz(course, input, now);
  const signed: SignedChallenge = {
    ...challenge, userId, expires: challenge.deadline === null ? now + lifetime : challenge.deadline + submitGrace,
  };
  return {
    challenge, questions,
    token: await issueSessionToken(JSON.stringify(signed), secretForQuiz(secret)),
  };
}

/** UX-03: تمرین انتقالی پس از غلط — سؤال مستقل از همان مبحث، خارج از گروه هم‌ارزی. */
export async function startTransferQuiz(userId: string, secret: string, input: {
  courseId?: unknown; questionId?: unknown;
}, now = Date.now()) {
  const course = lookupCourse(input.courseId);
  if (typeof input.questionId !== 'string' || !input.questionId) {
    throw new FormativeQuizError('شناسهٔ سؤال معتبر نیست.');
  }
  const transfer = findTransferQuestion(course, input.questionId);
  if (!transfer) throw new FormativeQuizError('در این مبحث فعلاً سؤال مستقل دیگری برای تمرین انتقالی نیست.');
  // انتخاب قطعی همان سؤال انتقالی: استخر محدود به یک شناسه + seed بازتولیدپذیر.
  const seed = deterministicSeed(transfer.id);
  const { challenge, questions } = createQuiz(course, {
    mode: 'practice', count: 1, reviewIds: [transfer.id], seed,
  }, now);
  const signed: SignedChallenge = { ...challenge, userId, expires: now + lifetime };
  return {
    challenge, questions,
    token: await issueSessionToken(JSON.stringify(signed), secretForQuiz(secret)),
    transferOf: input.questionId,
  };
}

function deterministicSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function readChallenge(userId: string, secret: string, token: unknown, now: number) {
  if (typeof token !== 'string' || token.length > 4000) {
    throw new FormativeQuizError('شناسهٔ جلسه معتبر نیست.');
  }
  const payload = await verifySessionToken(token, secretForQuiz(secret));
  if (!payload) throw new FormativeQuizError('امضای جلسه معتبر نیست.');
  const challenge = JSON.parse(payload) as SignedChallenge;
  if (challenge.userId !== userId) throw new FormativeQuizError('این جلسه متعلق به این کاربر نیست.');
  if (now >= challenge.expires) throw new FormativeQuizError('زمان ثبت این جلسه پایان یافته است. یک جلسهٔ تازه شروع کنید.');
  const course = lookupCourse(challenge.courseId);
  if (course.version !== challenge.version) throw new FormativeQuizError('نسخهٔ درس عوض شده است. یک جلسهٔ تازه شروع کنید.');
  return { course, challenge };
}

export async function answerLearningQuiz(userId: string, secret: string, input: {
  token?: unknown; questionId?: unknown; selected?: unknown; operationId?: unknown;
}, now = Date.now()) {
  const { course, challenge } = await readChallenge(userId, secret, input.token, now);
  if (challenge.mode !== 'practice') throw new FormativeQuizError('پاسخ‌نامه پس از ثبت نهایی نمایش داده می‌شود.');
  assertUniqueOperation(userId, input.operationId, { token: input.token, questionId: input.questionId, selected: input.selected }, now);
  return gradeFormativeAnswer(course, challenge, input.questionId, input.selected);
}

export async function finishLearningQuiz(userId: string, secret: string, input: {
  token?: unknown; answers?: unknown; operationId?: unknown;
}, now = Date.now()) {
  const { course, challenge } = await readChallenge(userId, secret, input.token, now);
  if (challenge.mode === 'practice') throw new FormativeQuizError('در تمرین، هر سؤال جداگانه ثبت می‌شود.');
  assertUniqueOperation(userId, input.operationId, { token: input.token, answers: input.answers }, now);
  return gradeFormativeQuiz(course, challenge, input.answers);
}
