import type { KonkorCourseSectionId } from '../data/yearlyKonkorExams';

export interface SubjectPalette {
  /** متن/چیپ در تم تیره */
  text: string;
  /** خط، آیکون و متن در تم روشن */
  strong: string;
  /** تینت سطح کارت */
  soft: string;
  /** حاشیهٔ کارت */
  border: string;
  /** پس‌زمینهٔ دکمهٔ اصلی */
  solid: string;
  /** متن روی دکمهٔ pastel */
  onSolid: string;
}

/** رنگ هر درس فقط در بستر محتوای همان درس استفاده می‌شود؛ کروم صفحه خنثی می‌ماند. */
export const SUBJECT_PALETTES: Record<KonkorCourseSectionId, SubjectPalette> = {
  islamic: {
    text: '#A5B4FC',
    strong: '#6366F1',
    soft: 'rgba(99, 102, 241, 0.14)',
    border: 'rgba(99, 102, 241, 0.42)',
    solid: '#A5B4FC',
    onSolid: '#07110F',
  },
  management_theories: {
    text: '#93C5FD',
    strong: '#3B82F6',
    soft: 'rgba(59, 130, 246, 0.14)',
    border: 'rgba(59, 130, 246, 0.42)',
    solid: '#93C5FD',
    onSolid: '#07110F',
  },
  marketing: {
    text: '#F9A8D4',
    strong: '#EC4899',
    soft: 'rgba(236, 72, 153, 0.14)',
    border: 'rgba(236, 72, 153, 0.42)',
    solid: '#F9A8D4',
    onSolid: '#07110F',
  },
  economics: {
    text: '#67E8F9',
    strong: '#06B6D4',
    soft: 'rgba(6, 182, 212, 0.14)',
    border: 'rgba(6, 182, 212, 0.42)',
    solid: '#67E8F9',
    onSolid: '#07110F',
  },
  math_stats: {
    text: '#C4B5FD',
    strong: '#8B5CF6',
    soft: 'rgba(139, 92, 246, 0.14)',
    border: 'rgba(139, 92, 246, 0.42)',
    solid: '#C4B5FD',
    onSolid: '#07110F',
  },
  operations_research: {
    text: '#FDBA74',
    strong: '#F97316',
    soft: 'rgba(249, 115, 22, 0.14)',
    border: 'rgba(249, 115, 22, 0.42)',
    solid: '#FDBA74',
    onSolid: '#07110F',
  },
  production: {
    text: '#E7C9A9',
    strong: '#C08457',
    soft: 'rgba(192, 132, 87, 0.14)',
    border: 'rgba(192, 132, 87, 0.42)',
    solid: '#E7C9A9',
    onSolid: '#07110F',
  },
  english: {
    text: '#F0ABFC',
    strong: '#D946EF',
    soft: 'rgba(217, 70, 239, 0.14)',
    border: 'rgba(217, 70, 239, 0.42)',
    solid: '#F0ABFC',
    onSolid: '#07110F',
  },
};

export const UNKNOWN_SUBJECT_PALETTE: SubjectPalette = {
  text: '#A8BBB4',
  strong: '#5D5548',
  soft: 'rgba(168, 187, 180, 0.12)',
  border: 'rgba(168, 187, 180, 0.34)',
  solid: '#A8BBB4',
  onSolid: '#07110F',
};

export const getSubjectPalette = (
  subjectId: KonkorCourseSectionId | undefined
): SubjectPalette => (subjectId ? SUBJECT_PALETTES[subjectId] : UNKNOWN_SUBJECT_PALETTE);
