/**
 * نمای کلاینتِ ساختار رسمی آزمون دکتری
 * ------------------------------------------------------------------
 * تنها مرجع: packages/contracts/src/exam-structure.ts (ARC-01 — یک منبع، دو مصرف‌کننده).
 * این فایل فقط نام‌های تک‌آرگومانیِ مخصوص «مسیر دکتری» را دوباره صادر می‌کند؛
 * هر نیازی به سطح دیگر (ارشد) باید مستقیم از @ael/contracts با آرگومان level گرفته شود.
 */
import {
  DOCTORATE_EXAM_YEAR_STRUCTURES,
  getDoctorateExamStructure,
  getExamChanges as getExamChangesForLevel,
  getExamStructureWarnings as getExamStructureWarningsForLevel,
  getCoefficientTotal as getCoefficientTotalForLevel,
  getSpecializationSharePercent as getSpecializationSharePercentForLevel,
  type ExamYearStructure,
} from '@ael/contracts';

const LEVEL: 'doctorate' = 'doctorate';

export {
  EXAM_LEVELS,
  type ExamLevel,
  type ExamVerification,
  type ExamYear,
  SUPPORTED_EXAM_YEARS,
  type ExamSet,
  MANAGEMENT_EXAM_SET,
  type ExamCombination,
  MANAGEMENT_EXAM_COMBINATIONS,
  MANAGEMENT_COURSE_BUNDLES,
  type ExamSubGroup,
  MANAGEMENT_SUB_GROUPS,
  type ExamSubject,
  SUB_GROUP_SUBJECTS,
  type ExamPathIdentity,
  DOCTORATE_MANAGEMENT_PATH,
  MASTER_MANAGEMENT_PATH,
  EXAM_PATH_IDENTITIES,
  isExamLevel,
  getExamPath,
  type ExamYearStructure,
  LATEST_EXAM_YEAR,
  ExamStructureUnavailableError,
  getExamStructure as getExamStructureForLevel,
  getSubGroups,
  getSubGroup,
  getSubGroupSubjects,
  getUnverifiedSubGroupCodes,
  getCombination,
  getCombinationsForSubGroup,
} from '@ael/contracts';

export const EXAM_YEAR_STRUCTURES: Record<number, ExamYearStructure> = DOCTORATE_EXAM_YEAR_STRUCTURES;

export function getExamStructure(year: number): ExamYearStructure {
  return getDoctorateExamStructure(year);
}

export function getExamChanges(year: number): string[] {
  return getExamChangesForLevel(LEVEL, year);
}

export function getExamStructureWarnings(year: number): string[] {
  return getExamStructureWarningsForLevel(LEVEL, year);
}

export function getCoefficientTotal(year: number, subGroupId: string): number {
  return getCoefficientTotalForLevel(LEVEL, year, subGroupId);
}

export function getSpecializationSharePercent(year: number, subGroupId: string): number {
  return getSpecializationSharePercentForLevel(LEVEL, year, subGroupId);
}
