import { readFile, writeFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const paths = ['content/questions/bank-official_traced_arshad.json', 'content/questions/bank-official_traced_phd.json'];

// This is a metadata-only index. Never copy question text, answer keys, or free-form references.
export function buildQuestionIndex(banks, nodes = [], courses = [], audit = { items: [] }) {
  const ids = new Set();
  const topics = new Map(nodes.map(node => [node.id, node]));
  const auditById = new Map(audit.items.map(item => [item.id, item.result]));
  const entries = [];
  for (const bank of banks) {
    for (const item of bank.questions) {
      if (typeof item.id !== 'string' || ids.has(item.id)) throw new Error('Missing or duplicate question ID: ' + item.id);
      ids.add(item.id);
      const node = topics.get(item.sourceNodeId);
      entries.push({
        id: item.id,
        sourceType: 'exam_trace',
        level: typeof item.examLevel === 'string' ? item.examLevel : null,
        year: Number.isInteger(item.examYear) ? item.examYear : null,
        booklet: typeof item.bookletCode === 'string' ? item.bookletCode : null,
        number: Number.isInteger(item.bookletQuestionNumber) && item.bookletQuestionNumber > 0 ? item.bookletQuestionNumber : null,
        courseId: typeof item.courseId === 'string' ? item.courseId : null,
        sectionId: typeof item.courseSectionId === 'string' ? item.courseSectionId : null,
        topicId: typeof item.sourceNodeId === 'string' ? item.sourceNodeId : null,
        courseTitle: typeof node?.course === 'string' ? node.course : null,
        chapterTitle: typeof node?.chapter === 'string' ? node.chapter : null,
        topicTitle: typeof node?.topic === 'string' ? node.topic : null,
        verification: typeof item.verificationStatus === 'string' ? item.verificationStatus : 'unknown',
        review: typeof item.reviewStatus === 'string' ? item.reviewStatus : 'unknown',
        rights: typeof item.copyrightStatus === 'string' ? item.copyrightStatus : 'unknown',
        auditStatus: auditById.get(item.id) ?? 'not_checked',
        learningReferences: [],
      });
    }
  }
  for (const course of courses) {
    const courseTopics = new Map(course.topics.map(topic => [topic.id, topic]));
    const sources = new Map(course.sources.map(source => [source.id, source]));
    for (const item of course.questions) {
      if (typeof item.id !== 'string' || ids.has(item.id)) throw new Error('Missing or duplicate question ID: ' + item.id);
      ids.add(item.id);
      const topic = courseTopics.get(item.topicId);
      entries.push({ id: item.id, sourceType: 'authored', level: null, year: null, booklet: null, number: null,
        courseId: course.id, sectionId: null, topicId: item.topicId, courseTitle: course.title,
        chapterTitle: null, topicTitle: topic?.title ?? null, verification: 'authored',
        review: item.review ?? 'unknown', rights: item.rights ?? 'unknown',
        auditStatus: 'authored',
        learningReferences: item.sourceIds.map(id => sources.get(id)).filter(Boolean)
          .map(source => ({ title: source.title, locator: source.locator })) });
    }
  }
  entries.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return { version: 1, status: 'source_metadata_pending_review', entries };
}

async function main() {
  const banks = await Promise.all(paths.map(async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))));
  const nodes = JSON.parse(await readFile(new URL('content/knowledge/syllabus-nodes.json', root), 'utf8'));
  const courseDir = new URL('content/learning-courses/', root);
  const files = (await readdir(courseDir)).filter(name => name.endsWith('.json')).sort();
  const courses = await Promise.all(files.map(async name => JSON.parse(await readFile(new URL(name, courseDir), 'utf8'))));
  const audit = JSON.parse(await readFile(new URL('content/learning-evidence/source-audit.json', root), 'utf8'));
  const output = JSON.stringify(buildQuestionIndex(banks, nodes, courses, audit), null, 2) + '\n';
  const target = new URL('content/learning-evidence/question-index.json', root);
  if (process.argv.includes('--check')) {
    if (await readFile(target, 'utf8') !== output) throw new Error('Question index is out of date.');
  } else {
    await writeFile(target, output);
  }
  console.log(`Metadata index: ${JSON.parse(output).entries.length} entries; text and keys excluded.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
