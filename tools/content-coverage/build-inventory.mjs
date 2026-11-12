/**
 * تولید کامل inventory پوشش محتوا (§11/§13/§14 درخواست مالک):
 *  ۱) یک فایل .md برای «هر فصل هر کتاب» — حتی اگر هیچ محتوایی نداشته باشیم
 *  ۲) BOOKS-COVERAGE.md: پوشش هر کتاب (نکات/فلش‌کارت/سؤال/درس‌نامه/md)
 *  ۳) EXAMS-COVERAGE.md: تعداد سؤال هر سال ارشد/دکتری + گپ‌ها
 *  ۴) SUBFIELDS.md: فهرست کامل رشته‌های ارشد/دکتری مدیریت
 * اجرا: node --import tsx tools/content-coverage/build-inventory.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ماژول‌های TS را با tsx ساده‌تر می‌خوانیم
// (این اسکریپت با node --import tsx اجرا می‌شود پس import مستقیم TS مجاز است)
const mod = async (p) => await import(pathToFileURL(path.resolve(p)).href);

const { REFERENCE_BOOKS_DATABASE } = await mod('src/data/referenceBooksRepo.ts');
const { getBookChapters } = await mod('src/data/bookChaptersRepo.ts');
const { BOOK_CHAPTERS } = await mod('src/data/bookChaptersBusiness.ts');
const { INITIAL_QUESTION_BANK } = await mod('src/data/konkorData.ts');
const { KNOWLEDGE_NODES } = await mod('src/data/konkorData.ts');
const { COURSE_ENCYCLOPEDIA_SUPPLEMENTS } = await mod('src/data/comprehensiveCourseEncyclopedia.ts');

// flashcards: استخراج با regex از سورس (ساختار object literal)
const flashSrc = fs.readFileSync('src/data/flashcards-expansion.ts', 'utf8') + '\n' + fs.readFileSync('src/data/flashcards.ts', 'utf8');
const cardRe = /\{\s*id:\s*'(fc-[^']+)',\s*nodeId:\s*'([^']+)',\s*type:\s*'([^']+)',\s*front:\s*'((?:[^'\\]|\\.)*)'/g;
const flashcards = [];
let m;
while ((m = cardRe.exec(flashSrc))) flashcards.push({ id: m[1], nodeId: m[2], type: m[3], front: m[4] });

const ROOT = 'docs/content-coverage';
const chapterMdDir = path.join(ROOT, 'book-chapters');
fs.mkdirSync(chapterMdDir, { recursive: true });

const DATE = '2026-11-13';
let mdFilesCreated = 0;

/** flashcards متصل به نودهای یک فصل */
function cardsForChapter(chapter) {
  return flashcards.filter((c) => chapter.nodes.includes(c.nodeId));
}
/** سؤال‌های متصل به نودهای یک فصل */
function questionsForChapter(chapter) {
  return INITIAL_QUESTION_BANK.filter((q) => chapter.nodes.includes(q.nodeId));
}

const booksCoverage = [];

for (const book of REFERENCE_BOOKS_DATABASE) {
  const chapters = getBookChapters(book.id);
  const bookDir = path.join(chapterMdDir, book.id);
  fs.mkdirSync(bookDir, { recursive: true });

  const bookCards = flashcards.filter((c) => chapters.some((ch) => ch.nodes.includes(c.nodeId)));
  const bookQs = INITIAL_QUESTION_BANK.filter((q) => chapters.some((ch) => ch.nodes.includes(q.nodeId)));
  const supplement = COURSE_ENCYCLOPEDIA_SUPPLEMENTS.find((s) => s.bookId === book.id);

  const perChapter = [];

  for (const ch of chapters) {
    const chCards = cardsForChapter(ch);
    const chQs = questionsForChapter(ch);
    const safeName = ch.id;
    const mdPath = path.join(bookDir, safeName + '.md');

    const hasContent = (ch.points?.length ?? 0) > 0;
    const lines = [];
    lines.push(`# ${ch.title}`);
    lines.push('');
    lines.push(`> کتاب: **${book.bookTitle}** · فصل ${ch.number} · تکرار آزمونی: ${ch.examCount} سؤال`);
    lines.push(`> نودهای دانش: ${ch.nodes.length ? ch.nodes.map((n) => '`' + n + '`').join('، ') : '—'}`);
    lines.push('');
    lines.push('| بخش | وضعیت | شمار |');
    lines.push('|---|---|---|');
    lines.push(`| نکات کلیدی | ${hasContent ? '✅ دارد' : '❌ نداریم'} | ${ch.points?.length ?? 0} |`);
    lines.push(`| فرمول‌ها/مدل‌ها | ${(ch.formulas?.length ?? 0) > 0 ? '✅ دارد' : '❌ نداریم'} | ${ch.formulas?.length ?? 0} |`);
    lines.push(`| فلش‌کارت | ${chCards.length ? '✅ دارد' : '❌ نداریم'} | ${chCards.length} |`);
    lines.push(`| سؤال مرتبط | ${chQs.length ? '✅ دارد' : '❌ نداریم'} | ${chQs.length} |`);
    lines.push('');

    if (hasContent) {
      lines.push('## 📌 نکات کلیدی فصل');
      lines.push('');
      ch.points.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
      lines.push('');
    } else {
      lines.push('## 📌 نکات کلیدی فصل');
      lines.push('');
      lines.push('❌ **هنوز محتوایی برای این فصل وارد نشده است.**');
      lines.push('');
    }

    if (ch.formulas?.length) {
      lines.push('## 🧮 فرمول‌ها و مدل‌ها');
      lines.push('');
      ch.formulas.forEach((f) => lines.push(`- ${f}`));
      lines.push('');
    }

    if (chCards.length) {
      lines.push('## 🗂 فلش‌کارت‌های این فصل');
      lines.push('');
      chCards.forEach((c) => lines.push(`- **${c.front}** ← \`${c.id}\``));
      lines.push('');
    } else {
      lines.push('## 🗂 فلش‌کارت‌های این فصل');
      lines.push('');
      lines.push('❌ **فلش‌کارتی برای این فصل ساخته نشده.** (لیست تولید در `docs/content-coverage/FLASHCARD-BACKLOG.md`)');
      lines.push('');
    }

    if (chQs.length) {
      lines.push('## ❓ سؤال‌های مرتبط');
      lines.push('');
      chQs.forEach((q) => lines.push(`- \`${q.id}\` — سال ${q.examYear ?? '—'}: ${String(q.text).slice(0, 90)}`));
      lines.push('');
    }

    if (supplement) {
      const suppCh = supplement.extraChapters?.find((x) => x.chapterNumber?.includes(ch.number) || x.chapterTitle?.includes(ch.title?.slice(0, 15)));
      lines.push('## 📖 دانشنامهٔ جامع');
      lines.push('');
      lines.push(suppCh
        ? `✅ این فصل در دانشنامهٔ جامع پوشش داده شده: **${suppCh.chapterTitle}**`
        : '❌ این فصل در دانشنامهٔ جامعِ این کتاب پوشش داده نشده.');
      lines.push('');
    }

    lines.push('---');
    lines.push(`*تولید خودکار — ${DATE} — منبع: bookChaptersBusiness/flashcards/INITIAL_QUESTION_BANK*`);

    fs.writeFileSync(mdPath, lines.join('\n') + '\n', 'utf8');
    mdFilesCreated += 1;

    perChapter.push({
      id: ch.id,
      number: ch.number,
      title: ch.title,
      examCount: ch.examCount,
      nodes: ch.nodes,
      points: ch.points?.length ?? 0,
      formulas: ch.formulas?.length ?? 0,
      flashcards: chCards.length,
      questions: chQs.length,
      md: path.relative('docs', mdPath).replaceAll('\\\\', '/'),
    });
  }

  booksCoverage.push({
    bookId: book.id,
    title: book.bookTitle,
    authors: book.authors,
    courseName: book.courseName,
    linkedNodes: book.linkedNodeId ? [book.linkedNodeId] : [],
    chapters: perChapter,
    totals: {
      chapters: chapters.length,
      withPoints: perChapter.filter((c) => c.points > 0).length,
      withFormulas: perChapter.filter((c) => c.formulas > 0).length,
      withCards: perChapter.filter((c) => c.flashcards > 0).length,
      withQuestions: perChapter.filter((c) => c.questions > 0).length,
      totalCards: bookCards.length,
      totalQuestions: bookQs.length,
    },
  });
}

// ---------- BOOKS-COVERAGE.md ----------
const covLines = [
  '# 📚 پوشش کامل کتاب‌های مرجع AEL', '',
  `**تاریخ:** ${DATE} · **SHA مبنا:** \`97a1f2a0\` · یک فایل .md برای هر فصل هر کتاب در [\`book-chapters/\`](./book-chapters/) تولید شده است.`, '',
  '| کتاب | درس | فصل | نکات دارد | فرمول دارد | فلش‌کارت دارد | سؤال دارد | md فصل‌ها |',
  '|---|---|---:|---:|---:|---:|---:|---|',
];
for (const b of booksCoverage) {
  covLines.push(`| ${b.title} | ${b.courseName} | ${b.totals.chapters} | ${b.totals.withPoints} | ${b.totals.withFormulas} | ${b.totals.withCards} | ${b.totals.withQuestions} | ${b.chapters.length ? '✅' : '❌'} |`);
}
covLines.push('');
covLines.push('## 📖 دانشنامهٔ جامع (supplements)');
covLines.push('');
for (const s of COURSE_ENCYCLOPEDIA_SUPPLEMENTS) {
  covLines.push(`- ✅ **${s.courseTitle}** (${s.bookId}) — ${s.extraChapters?.length ?? 0} بخش تکمیلی · معادل ${s.equivalentReferencePages} صفحه`);
}
covLines.push('');
covLines.push('## ❌ کتاب‌های بدون دانشنامهٔ جامع');
covLines.push('');
const suppIds = new Set(COURSE_ENCYCLOPEDIA_SUPPLEMENTS.map((s) => s.bookId));
REFERENCE_BOOKS_DATABASE.filter((b) => !suppIds.has(b.id)).forEach((b) => covLines.push(`- ❌ ${b.bookTitle} (\`${b.id}\`) — **نداریم**`));
covLines.push('');
covLines.push('## 🗂 فلش‌کارت‌های در انتظار تولید (backlog)');
covLines.push('');
const backlog = booksCoverage.flatMap((b) => b.chapters.filter((c) => c.flashcards === 0 && c.points > 0).map((c) => `- \`${b.bookId}/${c.id}\` — ${c.title} (${c.points} نکتهٔ آمادهٔ کارت‌شدن)`));
covLines.push(backlog.length ? backlog.join('\n') : '(همهٔ فصل‌های دارای نکته، کارت دارند)');
covLines.push('');

fs.writeFileSync(path.join(ROOT, 'BOOKS-COVERAGE.md'), covLines.join('\n') + '\n', 'utf8');
console.log('BOOKS-COVERAGE.md written | books:', booksCoverage.length, '| chapter .md files:', mdFilesCreated);

// ---------- ۲) EXAMS-COVERAGE.md ----------
const byYearLevel = {};
INITIAL_QUESTION_BANK.forEach((q) => {
  const isPhd = String(q.id).includes('phd') || (q.examLevel ?? '').includes('دکتری');
  const y = q.examYear ?? null;
  const k = (isPhd ? 'phd' : 'arshad') + '/' + (y ?? 'unknown');
  byYearLevel[k] = (byYearLevel[k] ?? 0) + 1;
});

const examLines = [
  '# 📝 پوشش کنکورهای ارشد و دکتری مدیریت (۱۰ سال اخیر)', '',
  `**تاریخ:** ${DATE} · مبنا: \`INITIAL_QUESTION_BANK\` + yearlyKonkorExams`, '',
  '## سال‌های کارشناسی ارشد (کد ۱۱۴۲)', '',
  '| سال | سؤال در بانک | وضعیت پوشش |', '|---|---:|---|',
];
const ARSHAD_YEARS = [1391, 1392, 1393, 1394, 1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404, 1405];
for (const y of ARSHAD_YEARS) {
  const n = byYearLevel['arshad/' + y] ?? 0;
  const status = n >= 15 ? '✅ خوب' : n >= 8 ? '🟡 کم' : n > 0 ? '⚠️ خیلی کم' : '❌ نداریم';
  examLines.push(`| ${y} | ${n} | ${status} |`);
}
examLines.push('', '## سال‌های دکتری مجموعه مدیریت (کد ۲۱۶۲)', '', '| سال | سؤال در بانک | وضعیت پوشش |', '|---|---:|---|');
const PHD_YEARS = [1394, 1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404, 1405];
for (const y of PHD_YEARS) {
  const n = byYearLevel['phd/' + y] ?? 0;
  const status = n >= 15 ? '✅ خوب' : n >= 8 ? '🟡 کم' : n > 0 ? '⚠️ خیلی کم' : '❌ نداریم';
  examLines.push(`| ${y} | ${n} | ${status} |`);
}
examLines.push('', '## ⚠️ گپ‌های اصلی (سند صادقانه)', '');
const arshadThin = ARSHAD_YEARS.filter((y) => (byYearLevel['arshad/' + y] ?? 0) < 8);
const phdThin = PHD_YEARS.filter((y) => (byYearLevel['phd/' + y] ?? 0) < 8);
examLines.push(`- **ارشد کم‌سؤال:** ${arshadThin.join('، ')} — هر دفترچهٔ رسمی ~۱۵ سؤال این درس‌ها را دارد؛ استخراج کامل نیازمند سند دفترچه است.`);
examLines.push(`- **دکتری کم‌سؤال/فاقد:** ${phdThin.join('، ')} — در حال حاضر تقریباً فقط ۱ سؤال per سال؛ استخراج نیازمند سند دفترچه ۲۱۶۲.`);
examLines.push('- **منبع افزودن:** سؤال رسمی کنکور دارای حق نشر است؛ افزودن فقط با ثبت provenance (سال/شماره/دفترچه) و بدون جعل انجام می‌شود. `NEEDS_SOURCE`');
examLines.push('- **لینک:** `yearlyKonkorExams.ts` (بانک سالانه) · `content/knowledge/exam-model.v1.json` (ساختار آزمون)');
examLines.push('');

fs.writeFileSync(path.join(ROOT, 'EXAMS-COVERAGE.md'), examLines.join('\n') + '\n', 'utf8');
console.log('EXAMS-COVERAGE.md written | arshad thin:', arshadThin.join(','), '| phd thin/missing:', phdThin.join(','));

// booksCoverage JSON برای مصرف برنامه‌نویسی
fs.writeFileSync(path.join(ROOT, 'BOOKS-COVERAGE.json'), JSON.stringify(booksCoverage, null, 1), 'utf8');
fs.writeFileSync(path.join(ROOT, 'EXAMS-COVERAGE.json'), JSON.stringify({ arshadThin, phdThin, byYearLevel }, null, 1), 'utf8');
console.log('JSON exports written');
