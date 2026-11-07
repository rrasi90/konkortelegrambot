import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { learningCourses } from '../apps/worker/src/learning-catalog';
import { validateAcademicFoundationBundle } from '@ael/contracts';

const files = (await readdir(new URL('../content/learning-courses/', import.meta.url)))
  .filter(name => name.endsWith('.json')).sort();
assert.deepEqual(learningCourses.map(course => course.id + '.json').sort(), files, 'Every pack must be registered once.');
const allIds = new Set<string>();
const pattern = /^[a-z0-9][a-z0-9._-]{1,79}$/;
function unique(id: string) {
  assert.match(id, pattern);
  assert.ok(!allIds.has(id), 'Duplicate identifier: ' + id);
  allIds.add(id);
}
function text(...values: string[]) {
  for (const value of values) assert.ok(typeof value === 'string' && value.trim(), 'Required text is empty.');
}
for (const course of learningCourses) {
  unique(course.id);
  assert.equal(course.schemaVersion, 1);
  assert.match(course.version, /^\d+\.\d+\.\d+$/);
  assert.equal(course.status, 'authored_pilot');
  text(course.title, course.description, course.scopeNote);
  assert.ok(course.sources.length && course.topics.length && course.questions.length, 'Missing pack sections.');
  for (const source of course.sources) {
    unique(source.id);
    text(source.title, source.locator);
    if (source.url !== undefined && source.url !== null) {
      assert.ok(source.url.trim(), 'Missing URL must be null or omitted, not an empty string: ' + source.id);
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(!url.username && !url.password);
    }
    assert.match(source.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(source.kind, 'concept_reference');
  }
  const sourceIds = new Set(course.sources.map(s => s.id));
  const checkSources = (ids: string[]) => assert.ok(ids.length > 0 && ids.every(id => sourceIds.has(id)), 'Invalid source id.');
  const knownTopics = new Set<string>();
  for (const topic of course.topics) {
    unique(topic.id);
    assert.ok(topic.prerequisites.every(id => knownTopics.has(id)), 'List prerequisites before dependents: ' + topic.id);
    knownTopics.add(topic.id);
    // Objective and concepts are core lesson content; formula/example/commonError are optional blocks.
    text(topic.title, topic.objective, ...topic.concepts);
    for (const optionalBlock of [topic.formula, topic.workedExample, topic.commonError]) {
      assert.equal(typeof optionalBlock, 'string', 'Optional lesson blocks must be strings (empty is allowed): ' + topic.id);
    }
    assert.ok(Number.isInteger(topic.minutes) && topic.minutes > 0 && topic.minutes <= 10);
    assert.ok(topic.concepts.length >= 2);
    checkSources(topic.sourceIds);
    for (const field of ['skillIds', 'learningOutcomeIds', 'tagIds'] as const) {
      const values = topic[field];
      if (values !== undefined) {
        assert.ok(Array.isArray(values) && values.every(id => typeof id === 'string' && id.trim()), 'Invalid ' + field + ' for topic ' + topic.id);
        assert.equal(new Set(values).size, values.length, 'Duplicate ' + field + ' for topic ' + topic.id);
      }
    }
    if (topic.syllabusNodeId !== undefined && topic.syllabusNodeId !== null) {
      assert.match(topic.syllabusNodeId, pattern, 'Invalid syllabusNodeId for topic ' + topic.id);
    }
    if (topic.blocks !== undefined) {
      assert.ok(Array.isArray(topic.blocks), 'blocks must be an array for topic ' + topic.id);
      const blockIds = new Set<string>();
      const kinds = ['learning_objective','concept_explanation','definition','formula','worked_example','case_study','comparison','common_misconception','summary','retrieval_prompt','practice'];
      for (const block of topic.blocks) {
        assert.match(block.id, pattern, 'Invalid block id for topic ' + topic.id);
        assert.ok(!blockIds.has(block.id), 'Duplicate block id: ' + block.id);
        blockIds.add(block.id);
        assert.ok(kinds.includes(block.kind), 'Invalid block kind: ' + block.id);
        assert.ok(Number.isInteger(block.position) && block.position >= 0, 'Invalid block position: ' + block.id);
        text(block.content);
        for (const field of ['sourceIds','relatedNodeIds','skillIds','tagIds'] as const) {
          if (block[field] !== undefined) {
            assert.ok(Array.isArray(block[field]) && block[field]!.every(id => typeof id === 'string' && id.trim()), 'Invalid ' + field + ' in block ' + block.id);
          }
        }
      }
      assert.equal(new Set(topic.blocks.map(block => block.position)).size, topic.blocks.length, 'Duplicate block position in topic ' + topic.id);
    }
    assert.ok(course.questions.some(q => q.topicId === topic.id), 'Topic has no practice: ' + topic.id);
  }
  for (const q of course.questions) {
    unique(q.id);
    assert.ok(knownTopics.has(q.topicId));
    if (q.readingBlock) {
      const topic = course.topics.find(t => t.id === q.topicId)!;
      assert.ok(['concept', 'formula', 'workedExample', 'commonError'].includes(q.readingBlock.type));
      if (q.readingBlock.type === 'concept') {
        assert.ok(Number.isInteger(q.readingBlock.index) && q.readingBlock.index! >= 0 && q.readingBlock.index! < topic.concepts.length,
          'Invalid reading concept for ' + q.id);
      } else assert.equal(q.readingBlock.index, undefined, 'Index only applies to concept: ' + q.id);
    }
    assert.ok(['basic','applied','intermediate','advanced','expert'].includes(q.difficulty), 'Invalid difficulty for ' + q.id);
    assert.ok(q.kind === undefined || q.kind === 'mcq' || q.kind === 'essay');
    if (q.variantGroup !== undefined) assert.match(q.variantGroup, pattern, 'Invalid variant group: ' + q.id);
    text(q.prompt, q.explanation);
    if (q.kind === 'essay') {
      assert.equal(q.choices.length, 0);
      assert.equal(q.optionReasons.length, 0);
      assert.equal(q.answerIndex, -1);
      assert.ok(Array.isArray(q.rubric) && q.rubric.length > 0);
      text(...q.rubric);
    } else {
      assert.equal(q.choices.length, 4);
      assert.equal(new Set(q.choices).size, 4);
      assert.equal(q.optionReasons.length, 4);
      text(...q.choices, ...q.optionReasons);
      assert.ok(Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < q.choices.length);
    }
    checkSources(q.sourceIds);
    assert.equal(q.origin, 'authored');
    assert.equal(q.rights, 'original_ael');
    assert.ok(q.review === 'pending_sme' || q.review === 'reviewed');
    for (const field of ['skillIds', 'learningOutcomeIds', 'tagIds'] as const) {
      const values = q[field];
      if (values !== undefined) {
        assert.ok(Array.isArray(values) && values.every(id => typeof id === 'string' && id.trim()), 'Invalid ' + field + ' for question ' + q.id);
        assert.equal(new Set(values).size, values.length, 'Duplicate ' + field + ' for question ' + q.id);
      }
    }
    if (q.bloomLevel !== undefined && q.bloomLevel !== null) assert.ok(Number.isInteger(q.bloomLevel) && q.bloomLevel >= 1 && q.bloomLevel <= 6, 'Invalid Bloom level for ' + q.id);
    if (q.questionFormat !== undefined) assert.ok(['single_choice','multiple_select','calculation','short_answer','essay','case_analysis','matching','true_false'].includes(q.questionFormat), 'Invalid questionFormat for ' + q.id);
    if (q.assessmentPurpose !== undefined) {
      assert.ok(Array.isArray(q.assessmentPurpose) && q.assessmentPurpose.length > 0, 'assessmentPurpose must not be empty for ' + q.id);
      assert.ok(q.assessmentPurpose.every(p => ['practice','diagnostic','verification','proof','timed_exam'].includes(p)), 'Invalid assessmentPurpose for ' + q.id);
      assert.equal(new Set(q.assessmentPurpose).size, q.assessmentPurpose.length, 'Duplicate assessmentPurpose for ' + q.id);
    }
    if (q.estimatedTimeSeconds !== undefined && q.estimatedTimeSeconds !== null) {
      assert.ok(Number.isInteger(q.estimatedTimeSeconds) && q.estimatedTimeSeconds > 0, 'Invalid estimatedTimeSeconds for ' + q.id);
    }
  }
  console.log(course.id + ': ' + course.topics.length + ' topics, ' + course.questions.length + ' authored items, ' + course.sources.length + ' references.');
}

/**
 * Layer 1 — validate the shared academic taxonomy and crosswalk against the
 * current skill, syllabus, question and learning-course catalogs.
 */
const [foundationRaw, syllabusRaw, skillsRaw, examPackRaw, crosswalkRaw, syllabusTreeRaw] = await Promise.all([
  readFile(new URL('../content/knowledge/academic-foundation.v1.json', import.meta.url), 'utf8'),
  readFile(new URL('../content/knowledge/syllabus-nodes.json', import.meta.url), 'utf8'),
  readFile(new URL('../content/knowledge/skills.json', import.meta.url), 'utf8'),
  readFile(new URL('../content/knowledge/exam-packs/phd-management-business-v1.json', import.meta.url), 'utf8'),
  readFile(new URL('../content/knowledge/layer1-node-course-crosswalk.v1.json', import.meta.url), 'utf8'),
  readFile(new URL('../content/knowledge/syllabus-tree-proposal.v1.json', import.meta.url), 'utf8'),
]);
const foundation = JSON.parse(foundationRaw);
const syllabusNodes = JSON.parse(syllabusRaw);
const skills = JSON.parse(skillsRaw);
const examPack = JSON.parse(examPackRaw);
const layer1Crosswalk = JSON.parse(crosswalkRaw);
const syllabusTree = JSON.parse(syllabusTreeRaw);
const academicResult = validateAcademicFoundationBundle(foundation, {
  syllabusNodeIds: new Set(syllabusNodes.map((node: { id: string }) => node.id)),
  skillIds: new Set(skills.map((skill: { id: string }) => skill.id)),
  questionIds: new Set(examPack.questions.map((question: { id: string }) => question.id)),
  lessonTopicKeys: new Set(learningCourses.flatMap(course => course.topics.map(topic => course.id + '/' + topic.id))),
});
assert.deepEqual(academicResult.errors, [], 'Academic Foundation validation failed: ' + JSON.stringify(academicResult.errors, null, 2));
console.log(
  'Academic Foundation: ' + foundation.namespaces.length + ' namespaces, ' +
  foundation.tags.length + ' tags, ' + foundation.questionMappings.length + ' question mappings, ' +
  foundation.unmappedQuestions.length + ' unmapped questions, ' + foundation.lessonMappings.length + ' lesson mappings.'
);

const uniqueIds = (values: string[], label: string) => {
  assert.equal(new Set(values).size, values.length, 'Duplicate ' + label + ' identifiers.');
};
uniqueIds(layer1Crosswalk.nodeCrosswalk.map((node: {nodeId:string}) => node.nodeId), 'node crosswalk');
uniqueIds(layer1Crosswalk.skillCrosswalk.map((skill: {skillId:string}) => skill.skillId), 'skill crosswalk');
uniqueIds(layer1Crosswalk.courseTitleCrosswalk.map((course: {sourceTitle:string}) => course.sourceTitle), 'course title crosswalk');
const currentSkillIds = new Set<string>(skills.map((skill: {id:string}) => skill.id));
for (const entry of layer1Crosswalk.skillCrosswalk) {
  assert.ok(currentSkillIds.has(entry.skillId), 'Crosswalk skill does not exist: ' + entry.skillId);
  const expectedMissingPrerequisites = entry.prerequisiteSkillIds.filter((id: string) => !currentSkillIds.has(id)).sort();
  const expectedMissingConfusables = entry.confusableSkillIds.filter((id: string) => !currentSkillIds.has(id)).sort();
  assert.deepEqual([...entry.missingPrerequisiteSkillIds].sort(), expectedMissingPrerequisites, 'Stale missing prerequisite references for ' + entry.skillId);
  assert.deepEqual([...entry.missingConfusableSkillIds].sort(), expectedMissingConfusables, 'Stale missing confusable references for ' + entry.skillId);
}
assert.equal(layer1Crosswalk.counts.initialKnowledgeNodes, 25);
assert.equal(layer1Crosswalk.counts.phdExpansionNodes, 12);
assert.equal(layer1Crosswalk.counts.syllabusNodes, syllabusNodes.length);
assert.equal(layer1Crosswalk.counts.skills, skills.length);
assert.equal(layer1Crosswalk.nodeCrosswalk.length, layer1Crosswalk.counts.nodeCrosswalkRows);
console.log(
  'Layer 1 crosswalk: ' + layer1Crosswalk.nodeCrosswalk.length + ' node identities, ' +
  layer1Crosswalk.skillCrosswalk.length + ' skills, ' +
  layer1Crosswalk.courseTitleCrosswalk.length + ' course-title mappings; unresolved references explicitly retained.'
);

const treeTopicIds = new Set<string>();
const treeChapterIds = new Set<string>();
let treeTopicCount = 0;
let treeChapterCount = 0;
for (const group of syllabusTree.courseGroups) {
  const courseCrosswalk = layer1Crosswalk.courseTitleCrosswalk.find(
    (entry: {sourceTitle:string}) => entry.sourceTitle === group.sourceCourseTitle,
  );
  assert.ok(courseCrosswalk, 'Syllabus tree has no course title crosswalk: ' + group.sourceCourseTitle);
  assert.equal(group.contentCourseId, courseCrosswalk.contentCourseId, 'Content course ID mismatch: ' + group.sourceCourseTitle);
  assert.equal(group.contentMatchStatus, courseCrosswalk.contentMatchStatus, 'Content course match status mismatch: ' + group.sourceCourseTitle);
  assert.equal(group.registryCourseDefinitionCode, null, 'Registry course code must remain unresolved until explicitly mapped.');
  assert.equal(group.registryMappingStatus, 'not_resolved_against_education_registry');
  for (const chapter of group.chapterNodes) {
    assert.ok(chapter.id.startsWith('chapter.'), 'Invalid proposed chapter ID: ' + chapter.id);
    assert.ok(!treeChapterIds.has(chapter.id), 'Duplicate proposed chapter ID: ' + chapter.id);
    treeChapterIds.add(chapter.id);
    treeChapterCount++;
    assert.equal(chapter.parentId, null, 'Chapter proposals must be roots within the course group.');
    assert.ok(chapter.children.length > 0, 'Empty chapter proposal: ' + chapter.id);
    for (const topic of chapter.children) {
      assert.ok(syllabusNodes.some((node: {id:string}) => node.id === topic.sourceSyllabusNodeId), 'Unknown source syllabus topic: ' + topic.id);
      assert.equal(topic.id, topic.sourceSyllabusNodeId, 'Legacy topic ID must be preserved.');
      assert.equal(topic.parentId, chapter.id, 'Topic must point to its proposed chapter.');
      assert.equal(topic.nodeKind, 'topic');
      assert.ok(!treeTopicIds.has(topic.id), 'Duplicate syllabus topic ID in tree: ' + topic.id);
      treeTopicIds.add(topic.id);
      treeTopicCount++;
    }
  }
}
assert.equal(syllabusTree.sourceRowCount, syllabusNodes.length);
assert.equal(syllabusTree.courseGroupCount, syllabusTree.courseGroups.length);
assert.equal(syllabusTree.chapterCount, treeChapterCount);
assert.equal(syllabusTree.topicCount, treeTopicCount);
assert.equal(treeTopicIds.size, syllabusNodes.length, 'Syllabus tree must contain every source topic exactly once.');
assert.equal(treeTopicCount, syllabusNodes.length);
console.log('Syllabus proposal: ' + treeChapterCount + ' chapters and ' + treeTopicCount + ' topics; registry codes remain explicitly unresolved.');
