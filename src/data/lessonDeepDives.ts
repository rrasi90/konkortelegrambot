import type { LessonDeepDive } from './lessonDeepDiveTypes';
import { DEEP_DIVE_ADDENDUM } from './deepDiveAddendum';
import { DEEP_DIVE_ORG_STRATEGY } from './deepDiveOrgStrategy';
import { DEEP_DIVE_QUANT } from './deepDiveQuant';
import { DEEP_DIVE_MARKETING_INNOVATION } from './deepDiveMarketingInnovation';
import { DEEP_DIVE_RESEARCH_LANGUAGE } from './deepDiveResearchLanguage';
import { EXPANSION_ORG_STRATEGY } from './deepDiveExpansionOrgStrategy';
import { EXPANSION_QUANT } from './deepDiveExpansionQuant';
import { EXPANSION_MARKETING_INNOVATION } from './deepDiveExpansionMarketingInnovation';
import { EXPANSION_RESEARCH_LANGUAGE } from './deepDiveExpansionResearchLanguage';
import type { DeepDiveSection } from './lessonDeepDiveTypes';

const BASE_DEEP_DIVES: LessonDeepDive[] = [
  ...DEEP_DIVE_ORG_STRATEGY,
  ...DEEP_DIVE_QUANT,
  ...DEEP_DIVE_MARKETING_INNOVATION,
  ...DEEP_DIVE_RESEARCH_LANGUAGE,
];

/** لایه‌های تکمیلی: ابتدا بخش‌های «تفکیک‌های تستی»، سپس بخش‌های آموزش تعمیق‌یافته */
const EXPANSION: Record<string, DeepDiveSection[]> = {
  ...EXPANSION_ORG_STRATEGY,
  ...EXPANSION_QUANT,
  ...EXPANSION_MARKETING_INNOVATION,
  ...EXPANSION_RESEARCH_LANGUAGE,
};

export const ALL_LESSON_DEEP_DIVES: LessonDeepDive[] = BASE_DEEP_DIVES.map((dive) => {
  const extra = DEEP_DIVE_ADDENDUM[dive.nodeId] ?? [];
  const expansion = EXPANSION[dive.nodeId] ?? [];
  return { ...dive, sections: [...dive.sections, ...extra, ...expansion] };
});

const BY_NODE: Record<string, LessonDeepDive> = ALL_LESSON_DEEP_DIVES.reduce(
  (acc, dive) => {
    acc[dive.nodeId] = dive;
    return acc;
  },
  {} as Record<string, LessonDeepDive>
);

export const getLessonDeepDive = (nodeId: string): LessonDeepDive | undefined => BY_NODE[nodeId];

/** تعداد کلمات متن آموزشی هر درس (برای نمایش حجم محتوا در فهرست) */
export const getDeepDiveWordCount = (dive: LessonDeepDive | undefined): number => {
  if (!dive) return 0;
  const parts: string[] = [
    dive.whyItMatters,
    dive.examAngle,
    dive.example.prompt,
    dive.example.answer,
    ...dive.example.steps,
    ...dive.objectives,
    ...dive.misconceptions,
    ...dive.takeaways,
    ...dive.sections.flatMap((s) => [s.title, s.body]),
  ];
  return parts.join(' ').trim().split(/\s+/).filter(Boolean).length;
};
