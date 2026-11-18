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

const DATE = '2026-11-15';
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

// ---------- ۲) EXAMS-COVERAGE.md — ماتریس کامل کمبود ----------
const { YEARLY_KONKOR_QUESTIONS } = await mod('src/data/yearlyKonkorExams.ts');
const { PHD_EXPANSION_QUESTIONS } = await mod('src/data/phdExpansionContent.ts');

const faDig = (v) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

// جمع‌آوری همهٔ سؤال‌های چهارگزینه‌ای سال‌دار از بانک‌ها
const examQs = [];
const examSeen = new Set();
const examPush = (v) => {
  if (!v || typeof v !== 'object' || examSeen.has(v)) return;
  examSeen.add(v);
  if (Array.isArray(v)) { for (const x of v) examPush(x); return; }
  const id = typeof v.id === 'string' ? v.id : null;
  const text = typeof v.text === 'string' ? v.text : (typeof v.questionText === 'string' ? v.questionText : null);
  const opts = Array.isArray(v.options) ? v.options : null;
  if (id && text && opts && opts.length >= 3 && !id.startsWith('sec.')) {
    examQs.push({
      id,
      year: typeof v.examYear === 'number' ? v.examYear : null,
      level: (v.examLevel === 'دکتری' || String(id).includes('phd')) ? 'phd' : 'arshad',
      section: typeof v.courseSectionId === 'string' ? v.courseSectionId : 'other',
      official: typeof v.bookletQuestionNumber === 'number',
    });
  }
  for (const x of Object.values(v)) examPush(x);
};
examPush(INITIAL_QUESTION_BANK);
examPush(YEARLY_KONKOR_QUESTIONS);
examPush(PHD_EXPANSION_QUESTIONS);

const SECTIONS = [
  ['english', 'زبان'], ['islamic', 'اسلامی'], ['math_stats', 'ریاضی'], ['management_theories', 'تئوری'],
  ['economics', 'اقتصاد'], ['operations_research', 'تحقیق'], ['production', 'تولید'], ['marketing', 'بازاریابی'],
];
const ARSHAD_YEARS = [1391, 1392, 1393, 1394, 1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404, 1405];
const PHD_YEARS = [1394, 1395, 1396, 1397, 1398, 1399, 1400, 1401, 1402, 1403, 1404, 1405];
const ARSHAD_OFFICIAL_BASELINE = 150; // ترکیب رسمی ۸ درس تحت پوشش از هر دفترچه ارشد

// ماتریس سال × درس برای هر سطح: { official: Set, related: Set }
const matrix = { arshad: new Map(), phd: new Map() };
for (const q of examQs) {
  if (!q.year || !(q.level === 'arshad' ? ARSHAD_YEARS : PHD_YEARS).includes(q.year)) continue;
  const m = matrix[q.level];
  if (!m.has(q.year)) m.set(q.year, {});
  const cell = m.get(q.year);
  const sec = SECTIONS.some(([sid]) => sid === q.section) ? q.section : 'other';
  if (!cell[sec]) cell[sec] = { official: new Set(), related: new Set() };
  (q.official ? cell[sec].official : cell[sec].related).add(q.id);
}

const matrixRow = (level, year) => {
  const cell = matrix[level].get(year) ?? {};
  const official = SECTIONS.map(([sid]) => (cell[sid]?.official.size ?? 0));
  const officialTotal = official.reduce((a, b) => a + b, 0);
  let relatedTotal = 0;
  for (const [, c] of Object.entries(cell)) relatedTotal += c.related.size;
  const gap = level === 'arshad' ? Math.max(0, ARSHAD_OFFICIAL_BASELINE - officialTotal) : null;
  return { official, officialTotal, relatedTotal, gap };
};

const examLines = [
  '# 📝 ماتریس کامل کمبود کنکور ارشد مدیریت (۱۱۴۲) و دکتری مدیریت (۲۱۶۲)', '',
  `**به‌روزرسانی:** ${DATE} · **پنجرهٔ ده‌ساله:** ۱۳۹۶ تا ۱۴۰۵ (داده‌های ۱۳۹۱ تا ۱۳۹۵ نیز نگهداری می‌شود)`,
  '**مبنای شمارش:** تفکیک سؤال «رسمی دفترچه» (دارای `bookletQuestionNumber`) از سؤال «تألییدی مرتبط» (فقط برچسب سال).', '',
  '## ۱. ارشد مجموعه مدیریت (کد ۱۱۴۲)', '',
  'ترکیب رسمی هر دفترچه برای ۸ درس تحت پوشش سامانه ≈ **۱۵۰ سؤال** (زبان ۲۵، اسلامی ۱۵، ریاضی‌آمار ۲۰، تئوری‌ها ۲۵، اقتصاد ۲۰، تحقیق در عملیات ۱۵، تولید ۱۵، بازاریابی ۱۵).', '',
  '| سال | ' + SECTIONS.map(([, t]) => t).join(' | ') + ' | جمع رسمی | تألییدی | گپ رسمی (از ۱۵۰) |',
  '|---|' + SECTIONS.map(() => '---:').join('|') + '|---:|---:|---:|',
];
const arshadThin = [];
for (const y of ARSHAD_YEARS) {
  const { official, officialTotal, relatedTotal, gap } = matrixRow('arshad', y);
  if (officialTotal < 8) arshadThin.push(y);
  examLines.push(`| ${faDig(y)} | ${official.map(faDig).join(' | ')} | ${faDig(officialTotal)} | ${faDig(relatedTotal)} | ${faDig(gap)} |`);
}
const arshadGrand = ARSHAD_YEARS.reduce((a, y) => a + matrixRow('arshad', y).officialTotal, 0);
examLines.push('', `**خلاصهٔ کمبود ارشد:** در کل پنجرهٔ ۱۳۹۱ تا ۱۴۰۵ فقط ${faDig(arshadGrand)} سؤال رسمی در بانک است (میانگین کمتر از ۶ از ~۱۵۰ در سال). تکمیل نیازمند دفترچهٔ رسمی + پاسخنامهٔ سنجش است.`, '');

examLines.push('## ۲. دکتری مجموعه مدیریت (کد ۲۱۶۲)', '',
  'ترکیب رسمی هر دفترچه: زبان عمومی ۴۰ سؤال + درس‌های تخصصی (~۶۰ تا ۱۰۰ سؤال بسته به گرایش).', '',
  '| سال | ' + SECTIONS.map(([, t]) => t).join(' | ') + ' | جمع رسمی | تألییدی | وضعیت منبع |',
  '|---|' + SECTIONS.map(() => '---:').join('|') + '|---:|---:|---|');
const PHD_SOURCE = {
  1394: 'دفترچهٔ کامل در بانک نیست', 1395: 'دفترچهٔ کامل در بانک نیست',
  1396: '📥 دفترچه دانلود شد (konkor/downloads) — بدون پاسخنامه',
  1397: '📥 دفترچه دانلود شد — بدون پاسخنامه',
  1398: '📥 دفترچه دانلود شد — بدون پاسخنامه',
  1399: '📥 دفترچه دانلود شد — بدون پاسخنامه؛ OCR زبان مخدوش',
  1400: '📥 دفترچه دانلود شد — بدون پاسخنامه',
  1401: '📥 دفترچه دانلود شد — بدون پاسخنامه',
  1402: '📥 دفترچه دانلود شد + دو کلید نامعین (322/326)؛ OCR متن مخدوش',
  1403: '✅ دفترچهٔ رسمی 620c + کلید رسمی سنجش دانلود شد؛ زبان ۹ تا ۴۰ استخراج شد',
  1404: '✅ دفترچهٔ رسمی 820A + کلید رسمی دانلود شد؛ زبان کامل استخراج شد',
  1405: '✅ دفترچهٔ رسمی 620A + کلید رسمی دانلود شد؛ زبان کامل استخراج شد',
};
const phdThin = [];
for (const y of PHD_YEARS) {
  const { official, officialTotal, relatedTotal } = matrixRow('phd', y);
  if (officialTotal < 8) phdThin.push(y);
  examLines.push(`| ${faDig(y)} | ${official.map(faDig).join(' | ')} | ${faDig(officialTotal)} | ${faDig(relatedTotal)} | ${PHD_SOURCE[y] ?? '❌'} |`);
}
examLines.push('', '**خلاصهٔ کمبود دکتری:** از دفترچهٔ سال‌های ۱۳۹۶ تا ۱۴۰۲ فقط ۱ سؤال منتخب تخصصی استخراج شده و بخش تخصصی ۱۴۰۳ تا ۱۴۰۵ به‌جز سؤال‌های منتخب اولیه استخراج نشده است. مانع اصلی: نبود پاسخنامه در فایل‌های موجود و OCR معیوب.', '');

examLines.push('## ۳. فهرست منابع لازم برای تکمیل (به‌ترتیب اولویت)', '',
  '| # | منبع لازم | برای تکمیلِ | وضعیت فعلی |', '|---|---|---|---|',
  '| ۱ | ~~پاسخنامهٔ دکتری ۱۴۰۳-۱۴۰۵~~ ✅ دانلود شد — مانده: استخراج و ورود به بانک | ~۱۵۰ سؤال تخصصی سه سال آخر | 🟢 PDF کلیدها در `konkor/downloads/` موجود است |',
  '| ۲ | ~~دفترچهٔ ارشد ۱۱۴۲ (۱۳۹۶-۱۴۰۵)~~ ✅ دانلود شد — مانده: استخراج ~۱۴۵۰ سؤال رسمی | ~۱۴۵۰ سؤال رسمی ده‌ساله | 🟢 سؤال+کلید در `konkor/downloads/` (۱۳۹۶ به‌صورت rar با پسورد www.konkur.in) |',
  '| ۳ | پاسخنامهٔ رسمی دکتری ۲۱۶۲ سال‌های ۱۳۹۶ تا ۱۴۰۱ | ~۷۰۰ سؤال رسمی | 🟡 دفترچه‌ها دانلود شد؛ کلید این سال‌ها هنوز یافت نشد |',
  '| ۴ | دفترچهٔ زبان عمومی دکتری ۱۳۹۹ و ۱۴۰۲ (اسکن تمیز) | ۸۰ سؤال زبان | ⚠️ OCR فعلی غیرقابل بازیابی |',
  '| ۵ | سؤال‌های ۱ تا ۸ زبان دکتری ۱۴۰۳ (اسکن تمیز) | ۸ سؤال | ⚠️ مپ فونت خراب |', '');

examLines.push('## ۴. مسیر تکمیل (pipeline آماده)', '',
  '۱. فایل دفترچه (PDF/DOCX تمیز) + پاسخنامه در پوشهٔ `konkor/` گذاشته شود.',
  '۲. استخراج با `tools/exam-import/` (extract → parse → build با بازبینی انسانی).',
  '۳. ورود سؤال بدون کلید به بانک کلاینت + کلید و توضیح در رجیستری سرور (R-036).',
  '۴. راستی‌آزمایی پوشش با `audit-bank-key-coverage.mts` و به‌روزرسانی همین سند.', '',
  '> **قانون ثابت:** سؤال رسمی دارای حق نشر است؛ افزودن فقط با ثبت provenance و بدون جعل کلید انجام می‌شود. `NEEDS_SOURCE`', '');

fs.writeFileSync(path.join(ROOT, 'EXAMS-COVERAGE.md'), examLines.join('\n') + '\n', 'utf8');
console.log('EXAMS-COVERAGE.md written | arshad official total:', arshadGrand, '| thin:', arshadThin.join(','), '| phd thin:', phdThin.join(','));

// JSON برای مصرف برنامه‌نویسی — شامل ماتریس کامل
const packMatrix = (level) => Object.fromEntries((level === 'arshad' ? ARSHAD_YEARS : PHD_YEARS).map((y) => {
  const cell = matrix[level].get(y) ?? {};
  return [String(y), Object.fromEntries(Object.entries(cell).map(([sid, c]) => [sid, { official: c.official.size, related: c.related.size }]))];
}));
const byYearLevel = {};
for (const q of examQs) {
  const k = q.level + '/' + (q.year ?? 'unknown');
  byYearLevel[k] = (byYearLevel[k] ?? 0) + 1;
}
fs.writeFileSync(path.join(ROOT, 'EXAMS-COVERAGE.json'), JSON.stringify({
  updatedAt: DATE,
  arshadThin, phdThin,
  byYearLevel,
  arshadByYearSection: packMatrix('arshad'),
  phdByYearSection: packMatrix('phd'),
  arshadOfficialBaseline: ARSHAD_OFFICIAL_BASELINE,
  missingAssets: ['public/assets/aistudio/*.pdf — لینک‌های دانلود دفترچه در yearlyKonkorExams شکسته‌اند؛ PDFها اکنون در konkor/downloads/ موجود است و باید در assets سینک شوند'],
}, null, 1), 'utf8');
console.log('JSON exports written');
