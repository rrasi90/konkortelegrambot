import { courseOverview, createQuiz, FormativeQuizError, gradeFormativeAnswer, gradeFormativeQuiz } from '@ael/engine';
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
  token?: unknown; questionId?: unknown; selected?: unknown;
}, now = Date.now()) {
  const { course, challenge } = await readChallenge(userId, secret, input.token, now);
  if (challenge.mode !== 'practice') throw new FormativeQuizError('پاسخ‌نامه پس از ثبت نهایی نمایش داده می‌شود.');
  return gradeFormativeAnswer(course, challenge, input.questionId, input.selected);
}

export async function finishLearningQuiz(userId: string, secret: string, input: {
  token?: unknown; answers?: unknown;
}, now = Date.now()) {
  const { course, challenge } = await readChallenge(userId, secret, input.token, now);
  if (challenge.mode === 'practice') throw new FormativeQuizError('در تمرین، هر سؤال جداگانه ثبت می‌شود.');
  return gradeFormativeQuiz(course, challenge, input.answers);
}
