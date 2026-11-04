import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { learningCourses } from '../apps/worker/src/learning-catalog';

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
    const url = new URL(source.url);
    assert.equal(url.protocol, 'https:');
    assert.ok(!url.username && !url.password);
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
    text(topic.title, topic.objective, topic.formula, topic.workedExample, topic.commonError, ...topic.concepts);
    assert.ok(Number.isInteger(topic.minutes) && topic.minutes > 0 && topic.minutes <= 10);
    assert.ok(topic.concepts.length >= 2);
    checkSources(topic.sourceIds);
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
    assert.ok(q.difficulty === 'basic' || q.difficulty === 'applied');
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
  }
  console.log(course.id + ': ' + course.topics.length + ' topics, ' + course.questions.length + ' authored items, ' + course.sources.length + ' references.');
}
