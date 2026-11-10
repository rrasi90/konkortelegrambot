/**
 * R-036 / مأموریت v4 §3.5 — Projection عمومی و حداقلی برای خروجی Offline.
 *
 * دادهٔ خام (content/learning-courses/*.json) هرگز وارد باندل آفلاین نمی‌شود.
 * ماژول مجازی 'ael-offline-source' توسط scripts/build-ael-offline.mjs در زمان
 * Build از فایل‌های خام ساخته و «فقط فیلدهای عمومی» تزریق می‌شود؛ فیلدهای
 * کلید-محور (answerIndex, explanation, optionReasons, rubric, variantGroup)
 * عمداً در Build حذف می‌شوند تا کلید پاسخ اصلاً وارد HTML مستقل نشود.
 */

import type { LearningCourse, LearningQuestion } from '@ael/engine';

// ماژول مجازی که scripts/build-ael-offline.mjs در زمان Build تزریق می‌کند؛
// امضای آن در ael-offline-source.d.ts اعلام شده است.
import offlineSourceCourses from 'ael-offline-source';

export interface PublicOfflineQuestion {
  id: string;
  topicId: string;
  difficulty: LearningQuestion['difficulty'];
  prompt: string;
  choices: string[];
  sourceIds: string[];
  origin: LearningQuestion['origin'];
  review: LearningQuestion['review'];
  kind: 'mcq' | 'essay';
  questionFormat: NonNullable<LearningQuestion['questionFormat']>;
}

export interface PublicOfflineTopic {
  id: string;
  title: string;
}

export interface PublicOfflineCourse {
  id: string;
  version: string;
  title: string;
  status: LearningCourse['status'];
  description: string;
  scopeNote: string;
  topics: PublicOfflineTopic[];
  questions: PublicOfflineQuestion[];
}

function toPublicQuestion(question: unknown): PublicOfflineQuestion {
  const q = question as LearningQuestion;
  return {
    id: q.id,
    topicId: q.topicId,
    difficulty: q.difficulty,
    prompt: q.prompt,
    choices: q.choices,
    sourceIds: q.sourceIds ?? [],
    origin: q.origin,
    review: q.review,
    kind: q.kind ?? 'mcq',
    questionFormat: q.questionFormat ?? (q.kind === 'essay' ? 'essay' : 'single_choice'),
  };
}

function toPublicCourse(course: unknown): PublicOfflineCourse {
  const c = course as LearningCourse;
  return {
    id: c.id,
    version: c.version,
    title: c.title,
    status: c.status,
    description: c.description,
    scopeNote: c.scopeNote,
    topics: c.topics.map((topic) => ({ id: topic.id, title: topic.title })),
    questions: c.questions.map(toPublicQuestion),
  };
}

export const offlineCourses: PublicOfflineCourse[] = offlineSourceCourses.map(toPublicCourse);
