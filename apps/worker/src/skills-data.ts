/**
 * بارگذاری مهارت‌های خرد از بستهٔ محتوا (content/knowledge/skills.json).
 * این فایل فقط پل داده است؛ منطق تصمیم در @ael/engine می‌ماند.
 */
import skillsJson from '../../../content/knowledge/skills.json';
import type { SkillMeta } from '@ael/engine';

interface RawSkill {
  id: string;
  node_id: string;
  title: string;
  prerequisites?: string[];
  confusable_with?: string[];
  difficulty_estimate?: number;
  estimated_study_minutes?: number;
}

const raw = skillsJson as unknown as RawSkill[];

/** فهرست مهارت‌های خرد به شکل SkillMeta برای موتور */
export const SKILL_METAS: SkillMeta[] = raw.map((s) => ({
  id: s.id,
  nodeId: s.node_id,
  confusableWith: s.confusable_with ?? [],
  prerequisites: s.prerequisites ?? [],
  estimatedMinutes: s.estimated_study_minutes ?? 5,
}));

/** نقشهٔ مهارت‌ها بر حسب شناسهٔ مهارت */
export function skillMetaMap(): Map<string, SkillMeta> {
  return new Map(SKILL_METAS.map((s) => [s.id, s]));
}

/** زمان تخمینی مطالعه (دقیقه) برای یک گره — پیش‌فرض ۵ */
export function estimatedMinutesForNode(nodeId: string): number {
  const skill = SKILL_METAS.find((s) => s.nodeId === nodeId);
  return skill?.estimatedMinutes ?? 5;
}

/** مهارتِ متصل به یک گرهٔ دانش */
export function skillForNode(nodeId: string): SkillMeta | undefined {
  return SKILL_METAS.find((s) => s.nodeId === nodeId);
}

/** عنوان مهارت برای کارت مقایسه */
export function skillTitle(skillId: string): string | undefined {
  return raw.find((s) => s.id === skillId)?.title;
}

/** گرهٔ دانشِ متصل به یک مهارت (معکوس) */
export function nodeForSkill(skillId: string): string | undefined {
  return SKILL_METAS.find((s) => s.id === skillId)?.nodeId;
}
