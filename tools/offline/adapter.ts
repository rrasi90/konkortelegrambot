import '../../apps/miniapp/learning.js';
import { learningCourses } from '../../apps/worker/src/learning-catalog';
import recurrence from '../../content/learning-evidence/recurrence.json';
import questionIndex from '../../content/learning-evidence/question-index.json';
import { courseOverview, createQuiz, gradeFormativeAnswer, gradeFormativeQuiz, projectFormativeQuestion } from '../../packages/learning-engine/src/formative-quiz';
import type { QuizChallenge, QuizInput } from '../../packages/learning-engine/src/formative-quiz';

function courseFor(id: string) {
  const course = learningCourses.find(item => item.id === id);
  if (!course) throw new Error('این درس در بستهٔ آفلاین موجود نیست.');
  return course;
}

// Rebuild the session from the current local pack instead of trusting text or keys in a backup.
function restoreBackup(input: any) {
  if (!input || input.format !== 'ael-offline-backup' || input.version !== 1 || !input.state ||
      !Array.isArray(input.state.studied) || !Array.isArray(input.state.issues) ||
      !input.state.reviews || typeof input.state.reviews !== 'object' || Array.isArray(input.state.reviews)) {
    throw new Error('ساختار فایل پشتیبان معتبر نیست.');
  }
  const topicIds = new Set(learningCourses.flatMap(course => course.topics.map(topic => topic.id)));
  const questionIds = new Set(learningCourses.flatMap(course => course.questions.map(question => question.id)));
  if (input.state.studied.some((id: unknown) => typeof id !== 'string' || !topicIds.has(id)) ||
      Object.keys(input.state.reviews).some(id => !questionIds.has(id)) ||
      Object.values(input.state.reviews).some((review: any) => !review || typeof review !== 'object' ||
        Array.isArray(review) || (review.courseId !== undefined && !learningCourses.some(course => course.id === review.courseId)) ||
        (review.attempts !== undefined && (!Number.isInteger(review.attempts) || review.attempts < 0)) ||
        (review.due !== undefined && !Number.isFinite(review.due))) ||
      input.state.issues.some((issue: any) => !issue || typeof issue.questionId !== 'string' ||
        !questionIds.has(issue.questionId) || typeof issue.note !== 'string' || issue.note.length > 500 ||
        typeof issue.at !== 'string')) {
    throw new Error('فایل پشتیبان با محتوای این نسخه سازگار نیست.');
  }
  const state = input.state;
  if (!state.active) return { studied: state.studied, reviews: state.reviews, issues: state.issues, active: null };
  const saved = state.active;
  const challenge = saved.challenge as QuizChallenge;
  if (!challenge || !['practice', 'diagnostic', 'timed'].includes(challenge.mode) ||
      !Array.isArray(challenge.ids) || !challenge.ids.length || challenge.ids.length > 12 ||
      new Set(challenge.ids).size !== challenge.ids.length || !Number.isFinite(challenge.startedAt) ||
      (challenge.deadline !== null && !Number.isFinite(challenge.deadline))) {
    throw new Error('جلسهٔ ذخیره‌شده معتبر نیست.');
  }
  const course = courseFor(challenge.courseId);
  if (course.version !== challenge.version) throw new Error('نسخهٔ درس در فایل پشتیبان متفاوت است.');
  const questions = challenge.ids.map(id => {
    const question = course.questions.find(item => item.id === id);
    if (!question) throw new Error('سؤال جلسه در این نسخه وجود ندارد.');
    return projectFormativeQuestion(question);
  });
  if (!saved.answers || typeof saved.answers !== 'object' || Array.isArray(saved.answers) ||
      Object.keys(saved.answers).some(id => !challenge.ids.includes(id)) ||
      !Array.isArray(saved.marked) || saved.marked.some((id: unknown) => !challenge.ids.includes(id as string)) ||
      !saved.spentMs || typeof saved.spentMs !== 'object' || Array.isArray(saved.spentMs) ||
      Object.entries(saved.spentMs).some(([id, ms]) => !challenge.ids.includes(id) ||
        typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) ||
      (saved.selfAssessments !== undefined && (!saved.selfAssessments || typeof saved.selfAssessments !== 'object' ||
        Array.isArray(saved.selfAssessments) || Object.entries(saved.selfAssessments).some(([id, value]) =>
          !challenge.ids.includes(id) || !['complete', 'review'].includes(value as string)))) ||
      !Number.isInteger(saved.index) || saved.index < 0 || saved.index >= questions.length) {
    throw new Error('پاسخ‌ها یا وضعیت جلسه معتبر نیست.');
  }
  // Grading validates every selected answer and ensures question membership.
  const checked = gradeFormativeQuiz(course, challenge, saved.answers);
  const results: Record<string, unknown> = {};
  if (challenge.mode === 'practice') {
    if (!saved.results || typeof saved.results !== 'object' || Array.isArray(saved.results) ||
        Object.keys(saved.results).some(id => !challenge.ids.includes(id) || !Object.hasOwn(saved.answers, id))) {
      throw new Error('نتایج تمرین معتبر نیست.');
    }
    for (const id of Object.keys(saved.results)) results[id] = gradeFormativeAnswer(course, challenge, id, saved.answers[id]);
  }
  const summary = saved.summary ? (challenge.mode === 'practice'
    ? { results: Object.values(results), total: Object.keys(results).length,
      correct: Object.values(results).filter((r: any) => r.status === 'correct').length,
      incorrect: Object.values(results).filter((r: any) => r.status === 'incorrect').length,
      skipped: Object.values(results).filter((r: any) => r.status === 'skipped').length,
      pending: Object.values(results).filter((r: any) => r.status === 'pending').length }
    : checked) : null;
  const active = { challenge, token: challenge, questions, answers: saved.answers, results, marked: saved.marked,
    index: saved.index, summary, deviceDeadline: challenge.deadline, timedOut: !!saved.timedOut,
    spentMs: saved.spentMs, selfAssessments: saved.selfAssessments ?? {}, questionShownAt: Date.now() };
  return { studied: state.studied, reviews: state.reviews, issues: state.issues, active };
}
const widget = (window as unknown as { AELLearning: { mount: (...args: unknown[]) => { open: () => void } } }).AELLearning;
widget.mount(document.getElementById('offline-root'), {
  overview: async () => ({ courses: learningCourses.map(courseOverview), recurrence, questionIndex }),
  start: async (input: QuizInput & { courseId: string }) => {
    const session = createQuiz(courseFor(input.courseId), input);
    return { ...session, token: session.challenge };
  },
  answer: async (input: { token: QuizChallenge; questionId: string; selected: unknown }) =>
    gradeFormativeAnswer(courseFor(input.token.courseId), input.token, input.questionId, input.selected),
  finish: async (input: { token: QuizChallenge; answers: unknown }) =>
    gradeFormativeQuiz(courseFor(input.token.courseId), input.token, input.answers),
  restoreBackup,
}, { offline: true, scope: 'offline-demo' }).open();
