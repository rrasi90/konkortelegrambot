import type { LearningCourse } from '@ael/engine';
import finance from '../../../content/learning-courses/financial-management.json';
import statistics from '../../../content/learning-courses/statistics-foundations.json';
import phdExpansion from '../../../content/learning-courses/phd-management-expansion.json';

// Add a validated authored pack here once. Worker and offline builds use this same registry.
export const learningCourses: LearningCourse[] = [
  finance as LearningCourse,
  statistics as LearningCourse,
  phdExpansion as LearningCourse,
];
