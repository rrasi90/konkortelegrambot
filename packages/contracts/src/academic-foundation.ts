/**
 * AEL Layer 1 — Academic Foundation.
 * The education registry remains the source for programs/courses/syllabus/exams.
 * This module supplies missing taxonomy, semantic graph and content mappings.
 */
export const ACADEMIC_FOUNDATION_SCHEMA_VERSION = 1 as const;

export const ACADEMIC_ENTITY_KINDS = [
  'course','syllabus_node','skill','learning_outcome','question','lesson_topic',
  'flashcard','exam_event','exam_combination',
] as const;
export type AcademicEntityKind = (typeof ACADEMIC_ENTITY_KINDS)[number];

export interface TagNamespace {
  id: string;
  title: string;
  description: string;
  selectionMode: 'single' | 'multiple';
  applicableTo: AcademicEntityKind[];
  status: 'active' | 'retired';
}
export interface TagDefinition {
  id: string;
  namespaceId: string;
  slug: string;
  label: string;
  aliases: string[];
  parentTagId: string | null;
  description: string;
  status: 'active' | 'retired';
}
export interface TagAssignment {
  tagId: string;
  targetKind: AcademicEntityKind;
  targetId: string;
  note?: string | null;
}

/** Non-hierarchical semantic edges; prerequisite edges remain in registry.ts. */
export const KNOWLEDGE_RELATION_KINDS = [
  'related_to','cross_course_related','confusable_with','contrasts_with','equivalent_to',
  'teaches','illustrates','assesses','supports_outcome',
] as const;
export type KnowledgeRelationKind = (typeof KNOWLEDGE_RELATION_KINDS)[number];
export interface KnowledgeRelation {
  id: string;
  fromKind: AcademicEntityKind;
  fromId: string;
  toKind: AcademicEntityKind;
  toId: string;
  relation: KnowledgeRelationKind;
  strength: number;
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'retired';
  note?: string | null;
}

export type BloomLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type AcademicDifficulty = 'basic' | 'intermediate' | 'advanced' | 'expert';
export type QuestionFormat =
  | 'single_choice' | 'multiple_select' | 'calculation' | 'short_answer'
  | 'essay' | 'case_analysis' | 'matching' | 'true_false';
export type AssessmentPurpose = 'practice' | 'diagnostic' | 'verification' | 'proof' | 'timed_exam';

export interface QuestionAcademicMapping {
  questionId: string;
  primaryNodeId: string;
  secondaryNodeIds: string[];
  primarySkillId: string | null;
  secondarySkillIds: string[];
  learningOutcomeIds: string[];
  tagIds: string[];
  bloomLevel: BloomLevel | null;
  difficulty: AcademicDifficulty | null;
  format: QuestionFormat;
  purpose: AssessmentPurpose[];
  estimatedTimeSeconds: number | null;
  status: 'mapped' | 'needs_review';
}
export interface UnmappedQuestion {
  questionId: string;
  reason: 'no_skill_mapping' | 'needs_concept_review' | 'missing_node' | 'other';
  note?: string | null;
}
export interface LessonTopicMapping {
  coursePackId: string;
  topicId: string;
  syllabusNodeId: string | null;
  skillIds: string[];
  learningOutcomeIds: string[];
  tagIds: string[];
  status: 'mapped' | 'needs_mapping' | 'needs_review';
}

export const LESSON_BLOCK_KINDS = [
  'learning_objective','concept_explanation','definition','formula','worked_example',
  'case_study','comparison','common_misconception','summary','retrieval_prompt','practice',
] as const;
export type LessonBlockKind = (typeof LESSON_BLOCK_KINDS)[number];
export interface LessonBlock {
  id: string;
  kind: LessonBlockKind;
  position: number;
  title?: string;
  content: string;
  sourceIds?: string[];
  relatedNodeIds?: string[];
  skillIds?: string[];
  tagIds?: string[];
}

export type CoefficientScope = 'exam_component' | 'subject' | 'course' | 'learning_only';
export interface ExamCourseAssignment {
  id: string;
  examLevel: 'master' | 'doctorate';
  examSetCode: string;
  combinationCode: string | null;
  subjectCode: string;
  courseDefinitionCode: string;
  coefficientScope: CoefficientScope;
  officialCoefficient: number | null;
  learningPriorityWeight: number | null;
  validFromYear: number;
  validUntilYear: number | null;
  status: 'official_verified' | 'reported' | 'needs_check' | 'proposed';
  note?: string | null;
}

export interface AcademicReferenceIndex {
  courseIds?: ReadonlySet<string>;
  syllabusNodeIds?: ReadonlySet<string>;
  skillIds?: ReadonlySet<string>;
  learningOutcomeIds?: ReadonlySet<string>;
  questionIds?: ReadonlySet<string>;
  lessonTopicKeys?: ReadonlySet<string>;
  examSetCodes?: ReadonlySet<string>;
  combinationCodes?: ReadonlySet<string>;
  subjectCodes?: ReadonlySet<string>;
}
export interface AcademicFoundationBundle {
  schemaVersion: typeof ACADEMIC_FOUNDATION_SCHEMA_VERSION;
  namespaces: TagNamespace[];
  tags: TagDefinition[];
  assignments: TagAssignment[];
  relations: KnowledgeRelation[];
  questionMappings: QuestionAcademicMapping[];
  unmappedQuestions: UnmappedQuestion[];
  lessonMappings: LessonTopicMapping[];
  examCourseAssignments: ExamCourseAssignment[];
}
export const EMPTY_ACADEMIC_FOUNDATION_BUNDLE: AcademicFoundationBundle = {
  schemaVersion: 1, namespaces: [], tags: [], assignments: [], relations: [],
  questionMappings: [], unmappedQuestions: [], lessonMappings: [], examCourseAssignments: [],
};
export interface AcademicFoundationIssue { path: string; code: string; message: string; }
export interface AcademicFoundationValidation { ok: boolean; errors: AcademicFoundationIssue[]; warnings: AcademicFoundationIssue[]; }

const ID = /^[a-z0-9][a-z0-9._:-]{1,127}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SYMMETRIC = new Set<KnowledgeRelationKind>([
  'related_to','cross_course_related','confusable_with','contrasts_with','equivalent_to',
]);
const ENTITY = new Set<string>(ACADEMIC_ENTITY_KINDS);
const add = (errors: AcademicFoundationIssue[], path: string, code: string, message: string) => errors.push({path,code,message});
const record = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
const compoundLessonTopicId = (v: unknown): v is string => typeof v === 'string' && v.split('/').length === 2 && v.split('/').every(part => ID.test(part));
const examCode = (v: unknown): v is string => typeof v === 'string' && (ID.test(v) || /^[0-9]{1,4}$/.test(v));
const stringList = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string' && x.trim().length > 0);
const duplicate = (v: readonly string[]) => new Set(v).size !== v.length;
const canonicalPair = (a: string,b: string) => a < b ? a + '|' + b : b + '|' + a;

/** Validate the parent-child syllabus tree and detect missing parents/cycles. */
export function validateSyllabusHierarchy(input: unknown): {ok:boolean;errors:AcademicFoundationIssue[]} {
  const errors: AcademicFoundationIssue[] = [];
  if (!Array.isArray(input)) return {ok:false,errors:[{path:'syllabusNodes',code:'invalid_array',message:'گره‌های سرفصل باید آرایه باشند.'}]};
  const nodes = new Map<string,Record<string,any>>();
  input.forEach((v,i) => {
    const p = 'syllabusNodes['+i+']';
    if (!record(v) || !id(v.id)) { add(errors,p+'.id','invalid_id','شناسهٔ گره معتبر نیست.'); return; }
    if (nodes.has(v.id)) add(errors,p+'.id','duplicate_id','شناسهٔ گره تکراری است.');
    nodes.set(v.id,v);
    if (!id(v.definitionCode)) add(errors,p+'.definitionCode','invalid_course','شناسهٔ تعریف درس معتبر نیست.');
    if (!['chapter','section','topic','concept'].includes(v.nodeKind)) add(errors,p+'.nodeKind','invalid_kind','نوع گره نامعتبر است.');
    if (!Number.isInteger(v.position) || v.position < 0) add(errors,p+'.position','invalid_position','ترتیب باید عدد صحیح نامنفی باشد.');
  });
  for (const [nodeId,node] of nodes) {
    if (node.parentId == null) continue;
    const parent = nodes.get(node.parentId);
    if (!parent) add(errors,'syllabusNodes.'+nodeId+'.parentId','missing_parent','والد سرفصل پیدا نشد.');
    else if (parent.definitionCode !== node.definitionCode) add(errors,'syllabusNodes.'+nodeId+'.parentId','cross_course_parent','والد و فرزند باید متعلق به یک درس باشند.');
  }
  const colors = new Map<string,number>();
  const visit = (nodeId:string,path:string[]) => {
    const color = colors.get(nodeId) ?? 0;
    if (color===1) { add(errors,'syllabusNodes.'+nodeId,'hierarchy_cycle','چرخه در درخت سرفصل: '+path.concat(nodeId).join(' → ')); return; }
    if (color===2) return;
    colors.set(nodeId,1);
    const parentId = nodes.get(nodeId)?.parentId;
    if (typeof parentId==='string' && nodes.has(parentId)) visit(parentId,path.concat(nodeId));
    colors.set(nodeId,2);
  };
  for (const nodeId of nodes.keys()) visit(nodeId,[]);
  return {ok:errors.length===0,errors};
}

/** Deep structural and cross-reference validation for Layer 1 data bundles. */
export function validateAcademicFoundationBundle(input: unknown, refs: AcademicReferenceIndex = {}): AcademicFoundationValidation {
  const errors: AcademicFoundationIssue[] = [];
  const warnings: AcademicFoundationIssue[] = [];
  if (!record(input)) return {ok:false,errors:[{path:'bundle',code:'invalid_object',message:'بسته باید شیء JSON باشد.'}],warnings};
  if (input.schemaVersion!==1) add(errors,'schemaVersion','unsupported_schema','نسخهٔ بسته پشتیبانی نمی‌شود.');
  const arrayNames = ['namespaces','tags','assignments','relations','questionMappings','unmappedQuestions','lessonMappings','examCourseAssignments'];
  for (const key of arrayNames) if (!Array.isArray(input[key])) add(errors,key,'invalid_array','این بخش باید آرایه باشد.');
  if (errors.length) return {ok:false,errors,warnings};

  const namespaceMap = new Map<string,TagNamespace>();
  (input.namespaces as unknown[]).forEach((v,i) => {
    const p='namespaces['+i+']';
    if (!record(v)) {add(errors,p,'invalid_object','Namespace باید شیء باشد.');return;}
    if (!id(v.id) || namespaceMap.has(v.id)) add(errors,p+'.id','invalid_id','شناسهٔ namespace نامعتبر یا تکراری است.');
    if (typeof v.title!=='string' || !v.title.trim() || typeof v.description!=='string' || !v.description.trim()) add(errors,p,'missing_text','عنوان و توضیح الزامی است.');
    if (!['single','multiple'].includes(v.selectionMode)) add(errors,p+'.selectionMode','invalid_mode','حالت انتخاب نامعتبر است.');
    if (!['active','retired'].includes(v.status)) add(errors,p+'.status','invalid_status','وضعیت نامعتبر است.');
    if (!Array.isArray(v.applicableTo) || !v.applicableTo.length || v.applicableTo.some((x:string)=>!ENTITY.has(x)) || duplicate(v.applicableTo)) add(errors,p+'.applicableTo','invalid_targets','نوع هدف‌ها باید معتبر و یکتا باشند.');
    if (id(v.id)) namespaceMap.set(v.id,v as TagNamespace);
  });

  const tagMap = new Map<string,TagDefinition>();
  const slugs = new Set<string>();
  (input.tags as unknown[]).forEach((v,i) => {
    const p='tags['+i+']';
    if (!record(v)) {add(errors,p,'invalid_object','Tag باید شیء باشد.');return;}
    if (!id(v.id) || tagMap.has(v.id)) add(errors,p+'.id','invalid_id','شناسهٔ تگ نامعتبر یا تکراری است.');
    if (!namespaceMap.has(v.namespaceId)) add(errors,p+'.namespaceId','unknown_namespace','Namespace تگ پیدا نشد.');
    if (typeof v.slug!=='string' || !SLUG.test(v.slug)) add(errors,p+'.slug','invalid_slug','Slug تگ نامعتبر است.');
    if (typeof v.label!=='string' || !v.label.trim() || typeof v.description!=='string' || !v.description.trim()) add(errors,p,'missing_text','عنوان و توضیح تگ الزامی است.');
    if (!stringList(v.aliases)) add(errors,p+'.aliases','invalid_aliases','Aliases باید آرایه رشته‌های غیرخالی باشد.');
    if (v.parentTagId!=null && !id(v.parentTagId)) add(errors,p+'.parentTagId','invalid_parent','شناسه والد نامعتبر است.');
    if (!['active','retired'].includes(v.status)) add(errors,p+'.status','invalid_status','وضعیت تگ نامعتبر است.');
    if (id(v.id)) tagMap.set(v.id,v as TagDefinition);
    if (typeof v.namespaceId==='string' && typeof v.slug==='string') {
      const key=v.namespaceId+'/'+v.slug;
      if (slugs.has(key)) add(errors,p+'.slug','duplicate_slug','Slug در این namespace تکراری است.');
      slugs.add(key);
    }
  });
  for (const [tagId,tag] of tagMap) {
    if (!tag.parentTagId) continue;
    const parent=tagMap.get(tag.parentTagId);
    if (!parent) add(errors,'tags.'+tagId+'.parentTagId','missing_parent','تگ والد پیدا نشد.');
    else if (parent.namespaceId!==tag.namespaceId) add(errors,'tags.'+tagId+'.parentTagId','cross_namespace_parent','والد باید از همان namespace باشد.');
  }
  const tagColors=new Map<string,number>();
  const visitTag=(tagId:string,path:string[])=>{
    const c=tagColors.get(tagId)??0;
    if(c===1){add(errors,'tags.'+tagId,'tag_cycle','چرخه در taxonomy تگ: '+path.concat(tagId).join(' → '));return;}
    if(c===2)return;
    tagColors.set(tagId,1);
    const parent=tagMap.get(tagId)?.parentTagId;
    if(parent && tagMap.has(parent))visitTag(parent,path.concat(tagId));
    tagColors.set(tagId,2);
  };
  for(const tagId of tagMap.keys())visitTag(tagId,[]);

  const assignKeys=new Set<string>(), singleCounts=new Map<string,number>();
  (input.assignments as unknown[]).forEach((v,i)=>{
    const p='assignments['+i+']';
    if(!record(v)){add(errors,p,'invalid_object','Assignment باید شیء باشد.');return;}
    const tag=tagMap.get(v.tagId);
    const ns=tag?namespaceMap.get(tag.namespaceId):undefined;
    if(!tag)add(errors,p+'.tagId','unknown_tag','تگ پیدا نشد.');
    const validTargetId = v.targetKind === 'lesson_topic' ? compoundLessonTopicId(v.targetId) : id(v.targetId);
    if(!ENTITY.has(v.targetKind)||!validTargetId)add(errors,p,'invalid_target','نوع یا شناسه هدف نامعتبر است.');
    if(ns && !ns.applicableTo.includes(v.targetKind))add(errors,p+'.targetKind','inapplicable_target','این namespace برای نوع هدف مجاز نیست.');
    const k=v.targetKind+'/'+v.targetId+'/'+v.tagId;
    if(assignKeys.has(k))add(errors,p,'duplicate_assignment','تگ تکراری به همان موجودیت متصل شده است.');
    assignKeys.add(k);
    if(ns?.selectionMode==='single'){
      const bucket=v.targetKind+'/'+v.targetId+'/'+ns.id;
      const count=(singleCounts.get(bucket)??0)+1;singleCounts.set(bucket,count);
      if(count>1)add(errors,p,'single_select_overflow','برای namespace تک‌انتخابی بیش از یک تگ ثبت شده است.');
    }
    if(v.targetKind==='syllabus_node'&&refs.syllabusNodeIds&&!refs.syllabusNodeIds.has(v.targetId))add(errors,p+'.targetId','unknown_reference','گره سرفصل پیدا نشد.');
    if(v.targetKind==='question'&&refs.questionIds&&!refs.questionIds.has(v.targetId))add(errors,p+'.targetId','unknown_reference','سؤال هدف پیدا نشد.');
    if(v.targetKind==='skill'&&refs.skillIds&&!refs.skillIds.has(v.targetId))add(errors,p+'.targetId','unknown_reference','مهارت هدف پیدا نشد.');
    if(v.targetKind==='course'&&refs.courseIds&&!refs.courseIds.has(v.targetId))add(errors,p+'.targetId','unknown_reference','درس هدف پیدا نشد.');
    if(v.targetKind==='lesson_topic'&&refs.lessonTopicKeys&&!refs.lessonTopicKeys.has(v.targetId))add(errors,p+'.targetId','unknown_reference','مبحث درسنامه‌ای هدف پیدا نشد.');
  });

  const referenceExists = (kind: string, targetId: string): boolean | undefined => {
    const index: Record<string, ReadonlySet<string> | undefined> = {
      course: refs.courseIds,
      syllabus_node: refs.syllabusNodeIds,
      skill: refs.skillIds,
      learning_outcome: refs.learningOutcomeIds,
      question: refs.questionIds,
      lesson_topic: refs.lessonTopicKeys,
    };
    const set = index[kind];
    return set ? set.has(targetId) : undefined;
  };
  const relationIds=new Set<string>(), relationKeys=new Set<string>();
  (input.relations as unknown[]).forEach((v,i)=>{
    const p='relations['+i+']';
    if(!record(v)){add(errors,p,'invalid_object','Relation باید شیء باشد.');return;}
    if(!id(v.id)||relationIds.has(v.id))add(errors,p+'.id','duplicate_id','شناسه رابطه نامعتبر یا تکراری است.');
    relationIds.add(v.id);
    const fromIdValid = v.fromKind === 'lesson_topic' ? compoundLessonTopicId(v.fromId) : id(v.fromId);
    const toIdValid = v.toKind === 'lesson_topic' ? compoundLessonTopicId(v.toId) : id(v.toId);
    if(!ENTITY.has(v.fromKind)||!ENTITY.has(v.toKind)||!fromIdValid||!toIdValid)add(errors,p,'invalid_endpoint','مبدأ یا مقصد رابطه نامعتبر است.');
    const fromExists = typeof v.fromKind === 'string' && typeof v.fromId === 'string' ? referenceExists(v.fromKind, v.fromId) : undefined;
    const toExists = typeof v.toKind === 'string' && typeof v.toId === 'string' ? referenceExists(v.toKind, v.toId) : undefined;
    if(fromExists === false)add(errors,p+'.fromId','unknown_reference','مبدأ رابطه در رجیستری مرجع موجود نیست.');
    if(toExists === false)add(errors,p+'.toId','unknown_reference','مقصد رابطه در رجیستری مرجع موجود نیست.');
    if(!KNOWLEDGE_RELATION_KINDS.includes(v.relation))add(errors,p+'.relation','invalid_relation','نوع رابطه ناشناخته است.');
    if(v.fromKind===v.toKind&&v.fromId===v.toId)add(errors,p,'self_relation','رابطه خودارجاع مجاز نیست.');
    if(typeof v.strength!=='number'||!Number.isFinite(v.strength)||v.strength<0||v.strength>1)add(errors,p+'.strength','invalid_strength','قدرت رابطه باید بین صفر و یک باشد.');
    if(!['draft','pending_review','approved','published','retired'].includes(v.status))add(errors,p+'.status','invalid_status','وضعیت relation نامعتبر است.');
    const from=v.fromKind+'/'+v.fromId,to=v.toKind+'/'+v.toId;
    if(SYMMETRIC.has(v.relation)&&from>to)add(errors,p,'noncanonical_symmetric_edge','رابطه متقارن باید با ترتیب canonical ذخیره شود.');
    const key=SYMMETRIC.has(v.relation)?v.relation+'/'+canonicalPair(from,to):v.relation+'/'+from+'/'+to;
    if(relationKeys.has(key))add(errors,p,'duplicate_relation','رابطه معنایی تکراری است.');
    relationKeys.add(key);
  });

  const mappedIds=new Set<string>();
  (input.questionMappings as unknown[]).forEach((v,i)=>{
    const p='questionMappings['+i+']';
    if(!record(v)){add(errors,p,'invalid_object','Question mapping باید شیء باشد.');return;}
    if(!id(v.questionId)||mappedIds.has(v.questionId))add(errors,p+'.questionId','invalid_or_duplicate_id','شناسه سؤال نامعتبر یا تکراری است.');
    mappedIds.add(v.questionId);
    if(!id(v.primaryNodeId))add(errors,p+'.primaryNodeId','required_node','گره اصلی سؤال الزامی است.');
    if(!stringList(v.secondaryNodeIds)||duplicate(v.secondaryNodeIds)||v.secondaryNodeIds.includes(v.primaryNodeId))add(errors,p+'.secondaryNodeIds','invalid_node_list','گره‌های ثانویه باید یکتا و متفاوت از گره اصلی باشند.');
    if(v.primarySkillId!=null&&!id(v.primarySkillId))add(errors,p+'.primarySkillId','invalid_skill','شناسه مهارت اصلی نامعتبر است.');
    for(const field of ['secondarySkillIds','learningOutcomeIds','tagIds'])if(!stringList(v[field])||duplicate(v[field]))add(errors,p+'.'+field,'invalid_id_list','شناسه‌ها باید یکتا و غیرخالی باشند.');
    if(v.bloomLevel!=null&&![1,2,3,4,5,6].includes(v.bloomLevel))add(errors,p+'.bloomLevel','invalid_bloom','سطح بلوم باید ۱ تا ۶ باشد.');
    if(v.difficulty!=null&&!['basic','intermediate','advanced','expert'].includes(v.difficulty))add(errors,p+'.difficulty','invalid_difficulty','دشواری نامعتبر است.');
    if(!['single_choice','multiple_select','calculation','short_answer','essay','case_analysis','matching','true_false'].includes(v.format))add(errors,p+'.format','invalid_format','قالب سؤال نامعتبر است.');
    if(!Array.isArray(v.purpose)||!v.purpose.length||v.purpose.some((x:string)=>!['practice','diagnostic','verification','proof','timed_exam'].includes(x))||duplicate(v.purpose))add(errors,p+'.purpose','invalid_purpose','هدف ارزیابی باید فهرست معتبر و یکتا باشد.');
    if(v.estimatedTimeSeconds!=null&&(!Number.isInteger(v.estimatedTimeSeconds)||v.estimatedTimeSeconds<=0))add(errors,p+'.estimatedTimeSeconds','invalid_time','زمان باید عدد صحیح مثبت یا null باشد.');
    if(!['mapped','needs_review'].includes(v.status))add(errors,p+'.status','invalid_status','وضعیت نگاشت نامعتبر است.');
    if(refs.questionIds&&!refs.questionIds.has(v.questionId))add(errors,p+'.questionId','unknown_question','سؤال پیدا نشد.');
    if(refs.syllabusNodeIds&&!refs.syllabusNodeIds.has(v.primaryNodeId))add(errors,p+'.primaryNodeId','unknown_node','گره اصلی پیدا نشد.');
    for(const nodeId of v.secondaryNodeIds??[])if(refs.syllabusNodeIds&&!refs.syllabusNodeIds.has(nodeId))add(errors,p+'.secondaryNodeIds','unknown_node','گره ثانویه پیدا نشد: '+nodeId);
    for(const skillId of [v.primarySkillId,...(v.secondarySkillIds??[])])if(skillId&&refs.skillIds&&!refs.skillIds.has(skillId))add(errors,p+'.skillIds','unknown_skill','مهارت پیدا نشد: '+skillId);
    for(const outId of v.learningOutcomeIds??[])if(refs.learningOutcomeIds&&!refs.learningOutcomeIds.has(outId))add(errors,p+'.learningOutcomeIds','unknown_outcome','خروجی یادگیری پیدا نشد: '+outId);
    for(const tagId of v.tagIds??[])if(!tagMap.has(tagId))add(errors,p+'.tagIds','unknown_tag','تگ پیدا نشد: '+tagId);
  });

  const unmappedIds=new Set<string>();
  (input.unmappedQuestions as unknown[]).forEach((v,i)=>{
    const p='unmappedQuestions['+i+']';
    if(!record(v)||!id(v.questionId)||!['no_skill_mapping','needs_concept_review','missing_node','other'].includes(v.reason)){add(errors,p,'invalid_unmapped','رکورد سؤال نگاشت‌نشده نامعتبر است.');return;}
    if(unmappedIds.has(v.questionId)||mappedIds.has(v.questionId))add(errors,p+'.questionId','duplicate_unmapped','سؤال هم‌زمان نگاشت‌شده و نگاشت‌نشده است.');
    unmappedIds.add(v.questionId);
    if(refs.questionIds&&!refs.questionIds.has(v.questionId))add(errors,p+'.questionId','unknown_question','سؤال پیدا نشد.');
  });

  const lessonKeys=new Set<string>();
  (input.lessonMappings as unknown[]).forEach((v,i)=>{
    const p='lessonMappings['+i+']';
    if(!record(v)){add(errors,p,'invalid_object','Lesson mapping باید شیء باشد.');return;}
    const key=v.coursePackId+'/'+v.topicId;
    if(!id(v.coursePackId)||!id(v.topicId)||lessonKeys.has(key))add(errors,p,'duplicate_topic','کلید بسته/مبحث نامعتبر یا تکراری است.');
    lessonKeys.add(key);
    if(v.syllabusNodeId!=null&&!id(v.syllabusNodeId))add(errors,p+'.syllabusNodeId','invalid_node','شناسه گره نامعتبر است.');
    for(const field of ['skillIds','learningOutcomeIds','tagIds'])if(!stringList(v[field])||duplicate(v[field]))add(errors,p+'.'+field,'invalid_id_list','فهرست شناسه‌ها باید یکتا و غیرخالی باشد.');
    if(!['mapped','needs_mapping','needs_review'].includes(v.status))add(errors,p+'.status','invalid_status','وضعیت mapping نامعتبر است.');
    if(refs.lessonTopicKeys&&!refs.lessonTopicKeys.has(key))add(errors,p,'unknown_topic','مبحث در بسته آموزشی پیدا نشد.');
    if(v.syllabusNodeId&&refs.syllabusNodeIds&&!refs.syllabusNodeIds.has(v.syllabusNodeId))add(errors,p+'.syllabusNodeId','unknown_node','گره متصل به درسنامه پیدا نشد.');
    for(const skillId of v.skillIds??[])if(refs.skillIds&&!refs.skillIds.has(skillId))add(errors,p+'.skillIds','unknown_skill','مهارت پیدا نشد: '+skillId);
    for(const outId of v.learningOutcomeIds??[])if(refs.learningOutcomeIds&&!refs.learningOutcomeIds.has(outId))add(errors,p+'.learningOutcomeIds','unknown_outcome','خروجی یادگیری پیدا نشد: '+outId);
    for(const tagId of v.tagIds??[])if(!tagMap.has(tagId))add(errors,p+'.tagIds','unknown_tag','تگ پیدا نشد: '+tagId);
  });

  (input.examCourseAssignments as unknown[]).forEach((v,i)=>{
    const p='examCourseAssignments['+i+']';
    if(!record(v)){add(errors,p,'invalid_object','Exam assignment باید شیء باشد.');return;}
    if(!id(v.id)||!id(v.examSetCode)||!id(v.subjectCode)||!id(v.courseDefinitionCode))add(errors,p,'invalid_ids','شناسه‌های assignment نامعتبر است.');
    if(!['master','doctorate'].includes(v.examLevel))add(errors,p+'.examLevel','invalid_level','مقطع نامعتبر است.');
    if(v.combinationCode!=null&&!examCode(v.combinationCode))add(errors,p+'.combinationCode','invalid_combination','کد ترکیب نامعتبر است.');
    if(!['exam_component','subject','course','learning_only'].includes(v.coefficientScope))add(errors,p+'.coefficientScope','invalid_scope','دامنه ضریب نامعتبر است.');
    if(v.officialCoefficient!=null&&(typeof v.officialCoefficient!=='number'||!Number.isFinite(v.officialCoefficient)||v.officialCoefficient<0))add(errors,p+'.officialCoefficient','invalid_coefficient','ضریب رسمی باید عدد نامنفی یا null باشد.');
    if(v.learningPriorityWeight!=null&&(typeof v.learningPriorityWeight!=='number'||!Number.isFinite(v.learningPriorityWeight)||v.learningPriorityWeight<0||v.learningPriorityWeight>100))add(errors,p+'.learningPriorityWeight','invalid_priority','وزن اولویت باید بین صفر و صد یا null باشد.');
    if(!Number.isInteger(v.validFromYear)||v.validFromYear<1300)add(errors,p+'.validFromYear','invalid_year','سال شروع نامعتبر است.');
    if(v.validUntilYear!=null&&(!Number.isInteger(v.validUntilYear)||v.validUntilYear<v.validFromYear))add(errors,p+'.validUntilYear','invalid_range','بازه سال نامعتبر است.');
    if(!['official_verified','reported','needs_check','proposed'].includes(v.status))add(errors,p+'.status','invalid_status','وضعیت assignment نامعتبر است.');
    if(refs.courseIds&&!refs.courseIds.has(v.courseDefinitionCode))add(errors,p+'.courseDefinitionCode','unknown_course','درس پیدا نشد.');
    if(refs.examSetCodes&&!refs.examSetCodes.has(v.examSetCode))add(errors,p+'.examSetCode','unknown_exam_set','مجموعه آزمون پیدا نشد.');
    if(v.combinationCode&&refs.combinationCodes&&!refs.combinationCodes.has(v.combinationCode))add(errors,p+'.combinationCode','unknown_combination','کد ترکیب پیدا نشد.');
    if(refs.subjectCodes&&!refs.subjectCodes.has(v.subjectCode))add(errors,p+'.subjectCode','unknown_subject','ماده آزمون پیدا نشد.');
  });
  return {ok:errors.length===0,errors,warnings};
}
