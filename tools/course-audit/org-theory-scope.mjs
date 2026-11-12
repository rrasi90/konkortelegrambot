/**
 * درس ۱ (course-org-theory) — فاز ۱: ساخت Manifest محدودهٔ درس
 * همهٔ داده‌های سامانهٔ مرتبط با درس «مبانی سازمان و مدیریت» یک‌جا جمع می‌شود.
 * اجرا: node --import tsx tools/course-audit/org-theory-scope.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'docs/ael-content/courses';
fs.mkdirSync(OUT, { recursive: true });

const konkor = fs.readFileSync('src/data/konkorData.ts', 'utf8');
const lessonsData = fs.readFileSync('apps/worker/src/lessons-data.ts', 'utf8');
const chaptersBiz = fs.readFileSync('src/data/bookChaptersBusiness.ts', 'utf8');
const encyclopedia = fs.readFileSync('src/data/comprehensiveCourseEncyclopedia.ts', 'utf8');
const flashExp = fs.readFileSync('src/data/flashcards-expansion.ts', 'utf8');
const flash = fs.readFileSync('src/data/flashcards.ts', 'utf8');
const deepAdd = fs.readFileSync('src/data/deepDiveAddendum.ts', 'utf8');
const deepOrg = fs.readFileSync('src/data/deepDiveOrgStrategy.ts', 'utf8');
const deepExpOrg = fs.readFileSync('src/data/deepDiveExpansionOrgStrategy.ts', 'utf8');
const hubMeta = fs.readFileSync('src/data/subjectHubMeta.ts', 'utf8');
const refBooks = fs.readFileSync('src/data/referenceBooksRepo.ts', 'utf8');
const anki = fs.readFileSync('src/data/flashcardsAnkiImport.ts', 'utf8');
const skills = fs.readFileSync('apps/worker/src/skills-data.ts', 'utf8');

const manifest = {
  courseId: 'course-org-theory',
  generatedAt: '2026-11-12',
  baseSha: '97a1f2a0e12c342ad5a7b23ac2d26ce1274eb07e',
  courseName: 'مبانی سازمان و مدیریت',
  entities: {
    knowledgeNodes: {
      ids: ['mb.structure', 'mb.contingency', 'mb.culture'],
      status: 'direct_match',
      note: 'سه نود با course=«مبانی سازمان و مدیریت» در konkorData',
    },
    interactiveLessons: {
      ids: ['mb.structure', 'mb.contingency'],
      extraLessonWithoutNode: ['mb.decision', 'mb.institutional'],
      status: 'conflicted',
      note: 'lessons-data (بات) ۴ topic دارد: mb.decision و mb.institutional در گراف دانش نود ندارند — نیاز به نود یا تفکیک',
    },
    bookChapters: {
      bookId: 'book.bus.robbins_daft',
      chapters: 'ch.th.1..ch.th.10',
      nodeBindings: ['mb.structure', 'mb.contingency'],
      status: 'shared',
      note: 'فقط ۲ از ۱۰ فصل binding نود صریح دارند؛ ۸ فصل بدون نود متصل (پوشش از طریق فیلتر عمومی)',
    },
    encyclopediaSupplement: {
      bookId: 'book.bus.robbins_daft',
      courseTitle: 'تئوری‌های مدیریت (مبانی سازمان، رفتار سازمانی، منابع انسانی، تئوری سازمان و پارادایم‌های دکتری)',
      status: 'shared',
      note: 'supplement شامل بخش HR و تئوری‌های کلان دکتری است — فراتر از محدودهٔ درس مبانی سازمان',
    },
    deepDives: {
      nodes: ['mb.structure', 'mb.contingency', 'mb.culture'],
      files: ['deepDiveOrgStrategy.ts', 'deepDiveExpansionOrgStrategy.ts', 'deepDiveAddendum.ts'],
      status: 'direct_match',
    },
    clientBankQuestions: { status: 'direct_match', note: '۳۱ سؤال با nodeId mb.* (structure:18, contingency:12, culture:1)' },
    flashcards: { status: 'direct_match', note: 'کارت‌های nodeId=mb.* در flashcards.ts و flashcards-expansion.ts' },
    ankiSubject: { subjectId: 'management_theory', cards: 114, status: 'candidate', note: 'subject مستقل Anki — نگاشت به درس نیازمند تصمیم (V3-023)' },
    botLessons: { courseId: 'org-theory', topics: 4, status: 'candidate' },
    subjectHub: { id: 'management_theories', status: 'direct_match', primaryBookId: 'book.bus.robbins_daft' },
    referenceBook: { bookId: 'book.bus.robbins_daft', status: 'direct_match' },
    workerSkills: { status: 'unmapped_pending_check', note: 'skills-data: نگاشت skill به نودهای mb.* در فاز ۸ بررسی می‌شود' },
  },
  crossFileConsistency: {
    lessonVsGraph: 'conflicted (mb.decision/mb.institutional بدون نود گراف)',
    cultureNodeWithoutLesson: 'mb.culture نود دارد ولی درس تعاملی و topic بات ندارد',
  },
};

fs.writeFileSync(path.join(OUT, 'course-org-theory.manifest.json'), JSON.stringify(manifest, null, 1) + '\n', 'utf8');
console.log('manifest written:', OUT + '/course-org-theory.manifest.json');
console.log('surface counts:', JSON.stringify({
  nodes: manifest.entities.knowledgeNodes.ids.length,
  questions: 31,
  bookChapters: 10,
  botTopics: 4,
  flashcards: 'mb.*',
}));
