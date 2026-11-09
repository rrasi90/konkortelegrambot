import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  validateAcademicFoundationBundle,
  validateSyllabusHierarchy,
} from '../src/academic-foundation';

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const bundle = readJson('../../../content/knowledge/academic-foundation.v1.json');
const nodes = readJson('../../../content/knowledge/syllabus-nodes.json') as Array<{id:string}>;
const skills = readJson('../../../content/knowledge/skills.json') as Array<{id:string}>;
const pack = readJson('../../../content/knowledge/exam-packs/phd-management-business-v1.json');
const courses = [
  readJson('../../../content/learning-courses/financial-management.json'),
  readJson('../../../content/learning-courses/statistics-foundations.json'),
  readJson('../../../content/learning-courses/phd-management-expansion.json'),
];
const refs = {
  syllabusNodeIds: new Set<string>(nodes.map(n => n.id)),
  skillIds: new Set<string>(skills.map(s => s.id)),
  questionIds: new Set<string>((pack.questions as Array<{id:string}>).map(q => q.id)),
  lessonTopicKeys: new Set<string>((courses as Array<{id:string;topics:Array<{id:string}>}>)
    .flatMap(c => c.topics.map(t => c.id + '/' + t.id))),
};

describe('AEL Layer 1 academic foundation', () => {
  it('validates the seeded taxonomy and the 18 existing question mappings', () => {
    const result = validateAcademicFoundationBundle(bundle, refs);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(bundle.namespaces).toHaveLength(10);
    expect(bundle.questionMappings).toHaveLength(18);
    expect(bundle.unmappedQuestions.map((q: {questionId:string}) => q.questionId).sort())
      .toEqual(['q-1399-001','q-1400-001','q-1400-002']);
    expect(bundle.lessonMappings).toHaveLength(22);
    expect(bundle.tags).toHaveLength(49);
    expect(bundle.assignments.filter((a: {targetKind:string}) => a.targetKind === 'lesson_topic')).toHaveLength(22);
    expect(bundle.assignments.filter((a: {targetKind:string}) => a.targetKind === 'syllabus_node')).toHaveLength(24);
    expect(bundle.assignments.filter((a: {targetKind:string}) => a.targetKind === 'question')).toHaveLength(18);
    expect(bundle.assignments.filter((a: {targetKind:string}) => a.targetKind === 'skill')).toHaveLength(23);
  });

  it('rejects tag assignments and semantic relations with unresolved targets', () => {
    const badAssignment = structuredClone(bundle);
    badAssignment.assignments[0].targetId = 'financial-management/missing-topic';
    const assignmentResult = validateAcademicFoundationBundle(badAssignment, refs);
    expect(assignmentResult.errors.some(e => e.code === 'unknown_reference')).toBe(true);

    const badRelation = structuredClone(bundle);
    badRelation.relations = [{
      id:'rel-missing-target',
      fromKind:'skill',fromId:'skill.a',
      toKind:'syllabus_node',toId:'node.does-not-exist',
      relation:'related_to',strength:0.5,status:'draft'
    }];
    const relationResult = validateAcademicFoundationBundle(badRelation, refs);
    expect(relationResult.errors.some(e => e.code === 'unknown_reference')).toBe(true);
  });

  it('rejects duplicate single-select tags on one content item', () => {
    const copy = structuredClone(bundle);
    const tags = copy.tags.filter((tag: {namespaceId:string}) => tag.namespaceId === 'bloom-level').slice(0, 2);
    copy.assignments = tags.map((tag: {id:string}) => ({tagId:tag.id,targetKind:'question',targetId:'q-1404-001'}));
    const result = validateAcademicFoundationBundle(copy, refs);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'single_select_overflow')).toBe(true);
  });

  it('rejects a cyclic tag hierarchy', () => {
    const copy = structuredClone(bundle);
    const a = copy.tags.find((tag: {id:string}) => tag.id === 'discipline.management');
    const b = copy.tags.find((tag: {id:string}) => tag.id === 'discipline.strategy');
    a.parentTagId = b.id;
    const result = validateAcademicFoundationBundle(copy, refs);
    expect(result.errors.some(e => e.code === 'tag_cycle')).toBe(true);
  });

  it('canonicalizes symmetric relationships but preserves direction for directed relationships', () => {
    const copy = structuredClone(bundle);
    copy.relations = [
      {id:'rel-a',fromKind:'skill',fromId:'skill.a',toKind:'skill',toId:'skill.b',relation:'confusable_with',strength:0.8,status:'draft'},
      {id:'rel-b',fromKind:'skill',fromId:'skill.b',toKind:'skill',toId:'skill.a',relation:'confusable_with',strength:0.8,status:'draft'},
    ];
    const symmetric = validateAcademicFoundationBundle(copy, refs);
    expect(symmetric.errors.some(e => e.code === 'noncanonical_symmetric_edge')).toBe(true);

    copy.relations = [
      {id:'rel-a',fromKind:'syllabus_node',fromId:'node.a',toKind:'skill',toId:'skill.a',relation:'teaches',strength:1,status:'draft'},
      {id:'rel-b',fromKind:'skill',fromId:'skill.a',toKind:'syllabus_node',toId:'node.a',relation:'teaches',strength:1,status:'draft'},
    ];
    const directed = validateAcademicFoundationBundle(copy, refs);
    expect(directed.errors.some(e => e.code === 'duplicate_relation')).toBe(false);
  });

  it('rejects question mappings to a non-existent skill', () => {
    const copy = structuredClone(bundle);
    copy.questionMappings[0].primarySkillId = 'skill.not-a-real-skill';
    const result = validateAcademicFoundationBundle(copy, refs);
    expect(result.errors.some(e => e.code === 'unknown_skill')).toBe(true);
  });

  it('allows an explicitly unknown official coefficient without converting learning priority into an exam coefficient', () => {
    const copy = structuredClone(bundle);
    copy.examCourseAssignments = [{
      id:'assignment.example',examLevel:'doctorate',examSetCode:'2162',combinationCode:'6',
      subjectCode:'subject.example',courseDefinitionCode:'course.example',
      coefficientScope:'learning_only',officialCoefficient:null,learningPriorityWeight:72,
      validFromYear:1405,validUntilYear:null,status:'proposed'
    }];
    const result = validateAcademicFoundationBundle(copy);
    expect(result.ok).toBe(true);
  });
});

describe('syllabus hierarchy integrity', () => {
  it('accepts a multi-level tree whose parent and child are in the same course', () => {
    const result = validateSyllabusHierarchy([
      {id:'course.a.chapter1',definitionCode:'course.a',parentId:null,position:0,title:'فصل یک',nodeKind:'chapter'},
      {id:'course.a.topic1',definitionCode:'course.a',parentId:'course.a.chapter1',position:0,title:'مبحث یک',nodeKind:'topic'},
      {id:'course.a.concept1',definitionCode:'course.a',parentId:'course.a.topic1',position:0,title:'مفهوم یک',nodeKind:'concept'},
    ]);
    expect(result.ok).toBe(true);
  });

  it('rejects missing parents, cross-course parents and cycles', () => {
    const result = validateSyllabusHierarchy([
      {id:'course.a.chapter1',definitionCode:'course.a',parentId:'course.a.topic1',position:0,title:'فصل یک',nodeKind:'chapter'},
      {id:'course.a.topic1',definitionCode:'course.a',parentId:'course.a.chapter1',position:0,title:'مبحث یک',nodeKind:'topic'},
      {id:'course.b.topic2',definitionCode:'course.b',parentId:'course.a.chapter1',position:0,title:'مبحث دوم',nodeKind:'topic'},
      {id:'course.c.topic3',definitionCode:'course.c',parentId:'course.missing',position:0,title:'مبحث سوم',nodeKind:'topic'},
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'hierarchy_cycle')).toBe(true);
    expect(result.errors.some(e => e.code === 'cross_course_parent')).toBe(true);
    expect(result.errors.some(e => e.code === 'missing_parent')).toBe(true);
  });
});
