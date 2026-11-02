/**
 * تاکسونومی ۱۰ مهارت زبان انگلیسی — پیشنهاد برنامهٔ درسی، نه سند رسمی
 * ------------------------------------------------------------------
 * منبع استنتاج: docs/phase-1/CURRICULUM_COVERAGE_MATRIX.csv (هفت مبحث پیشنهادی زبان)
 * و docs/status/phd-coverage-audit-2026-11.md §زبان انگلیسی (واژگان آکادمیک، گرامر
 * در متن، کلوز، درک مطلب، مرجع ضمیر، استنباط، پارافریز و سرعت/مدیریت زمان).
 *
 * وضعیت هر مهارت `proposed_curriculum_pending_sme` است: هیچ عدد رسمی سؤال،
 * ضریب یا سطح دشواری از این تاکسونومی استخراج نمی‌شود. مهارت‌ها گره‌های دانش
 * مستقل‌اند تا سنجش هر مهارت جداگانه باشد و «فهرست لغت» جای کل ماژول را نگیرد.
 */

export const ENGLISH_SKILL_BUCKETS = [
  'vocabulary',
  'word_formation',
  'grammar',
  'cloze',
  'reading',
  'scanning',
  'inference',
  'reference',
  'paraphrase',
  'strategy',
] as const;

export type EnglishSkillBucket = (typeof ENGLISH_SKILL_BUCKETS)[number];

export type EnglishSkillId =
  | 'english.vocabulary_context'
  | 'english.word_formation'
  | 'english.grammar_context'
  | 'english.cohesion_cloze'
  | 'english.main_idea'
  | 'english.detail_scanning'
  | 'english.inference_stance'
  | 'english.reference'
  | 'english.paraphrase'
  | 'english.time_strategy';

export interface EnglishSkill {
  id: EnglishSkillId;
  /** گرهٔ دانش متناظر؛ سؤال‌های آیندهٔ زبان به همین گره وصل می‌شوند */
  nodeId: string;
  bucket: EnglishSkillBucket;
  title: string;
  description: string;
  /** پیش‌نیازها فقط برای ترتیب پیشنهادی تمرین‌اند، نه دروازهٔ قطعی */
  prerequisiteIds: EnglishSkillId[];
  verification: 'proposed_curriculum_pending_sme';
}

export const ENGLISH_SKILLS: EnglishSkill[] = [
  {
    id: 'english.vocabulary_context',
    nodeId: 'english.vocabulary_context',
    bucket: 'vocabulary',
    title: 'واژگان آکادمیک در بافت',
    description: 'تشخیص معنای واژه از بافت جمله و متن، نه حفظ فهرست لغت.',
    prerequisiteIds: [],
    verification: 'proposed_curriculum_pending_sme',
  },
  {
    id: 'english.word_formation',
    nodeId: 'english.word_formation',
    bucket: 'word_formation',
    title: 'ساختواژه و هم‌آیندی',
    description: 'پیشوند/پسوند/ریشه و ترکیب‌های پرتکرار واژگان مدیریتی.',
    prerequisiteIds: ['english.vocabulary_context'],
    verification: 'proposed_curriculum_pending_sme',
  },
  {
    id: 'english.grammar_context',
    nodeId: 'english.grammar_context',
    bucket: 'grammar',
    title: 'گرامر در بافت',
    description: 'زمان‌ها، تطابق، بندها، مجهول و شرطی در جمله‌های آزمونی.',
    prerequisiteIds: [],
    verification: 'proposed_curriculum_pending_sme',
  },
  {
    id: 'english.cohesion_cloze',
    nodeId: 'english.cohesion_cloze',
    bucket: 'cloze',
    title: 'کلوز و انسجام متن',
    description: 'انتخاب واژه/پیوند منطقی بر پایهٔ انسجام و روابط جمله‌ها.',
    prerequisiteIds: ['english.grammar_context'],
    verification: 'proposed_curriculum_pending_sme',
  },
  {
    id: 'english.main_idea',
    nodeId: 'english.main_idea',
    bucket: 'reading',
    title: 'ایده اصلی و ساختار متن',
    description: 'تشخیص ایدهٔ اصلی، هدف نویسنده و نقش پاراگراف در متن آکادمیک.',
    prerequisiteIds: ['english.vocabulary_context'],
    verification: 'proposed_curriculum_pending_sme',
  },
  {
    id: 'english.detail_scanning',
    nodeId: 'english.detail_scanning',
    bucket: 'scanning',
    title: 'جزئیات و خواندن سریع',
    description: 'یافتن جزئیات صریح و اسکن هدفمند متن تحت محدودیت زمان.',
    prerequisiteIds: ['english.main_idea'],
    verification: 'proposed_curriculum_pending_sme',
  },
  {
    id: 'english.inference_stance',
    nodeId: 'english.inference_stance',
    bucket: 'inference',
    title: 'استنباط و موضع نویسنده',
    description: 'استنتاج معنای ناگفته و تشخیص لحن و موضع نویسنده.',
    prerequisiteIds: ['english.main_idea'],
    verification: 'proposed_curriculum_pending_sme',
  },
  {
    id: 'english.reference',
    nodeId: 'english.reference',
    bucket: 'reference',
    title: 'مرجع ضمیر و ارجاع',
    description: 'بازگرداندن ضمیر/عبارت ارجاعی به مرجع درست در متن.',
    prerequisiteIds: ['english.inference_stance'],
    verification: 'proposed_curriculum_pending_sme',
  },
  {
    id: 'english.paraphrase',
    nodeId: 'english.paraphrase',
    bucket: 'paraphrase',
    title: 'پارافریز و هم‌معنایی',
    description: 'تشخیص بازگویی هم‌معنای یک گزاره و رد گزینه‌های تحریف‌شده.',
    prerequisiteIds: ['english.vocabulary_context', 'english.main_idea'],
    verification: 'proposed_curriculum_pending_sme',
  },
  {
    id: 'english.time_strategy',
    nodeId: 'english.time_strategy',
    bucket: 'strategy',
    title: 'مدیریت زمان و راهبرد آزمون',
    description: 'اولویت‌بندی سؤال، تخمین زمان و تصمیم پاسخ/عبور در بخش زبان.',
    prerequisiteIds: ['english.cohesion_cloze', 'english.detail_scanning'],
    verification: 'proposed_curriculum_pending_sme',
  },
];

const ENGLISH_SKILL_BY_ID = new Map(ENGLISH_SKILLS.map((skill) => [skill.id, skill]));

export function getEnglishSkill(id: string): EnglishSkill | undefined {
  return ENGLISH_SKILL_BY_ID.get(id as EnglishSkillId);
}

export function isEnglishSkillId(value: unknown): value is EnglishSkillId {
  return typeof value === 'string' && ENGLISH_SKILL_BY_ID.has(value as EnglishSkillId);
}
