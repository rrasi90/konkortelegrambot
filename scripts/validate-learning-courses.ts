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
const [foundationRaw, syllabusRaw, skillsRaw, examPackRaw] = await Promise.all([
  readFile(new URL('../content/knowledge/academic-foundation.v1.json', import.meta.url), 'utf8'),
  readFile(new URL('../content/knowledge/syllabus-nodes.json', import.meta.url), 'utf8'),
  readFile(new URL('../content/knowledge/skills.json', import.meta.url), 'utf8'),
  readFile(new URL('../content/knowledge/exam-packs/phd-management-business-v1.json', import.meta.url), 'utf8'),
]);
const foundation = JSON.parse(foundationRaw);
const syllabusNodes = JSON.parse(syllabusRaw);
const skills = JSON.parse(skillsRaw);
const examPack = JSON.parse(examPackRaw);
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
