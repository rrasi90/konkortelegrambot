# ارتقای مولد inventory: جایگزینی بخش EXAMS-COVERAGE با ماتریس کامل کمبود
import io

P = 'tools/content-coverage/build-inventory.mjs'

NEW_BLOCK = r'''// ---------- ۲) EXAMS-COVERAGE.md — ماتریس کامل کمبود ----------
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
  '# 📝 ماتریس کامل کمبود کنکور — ارشد مدیریت (۱۱۴۲) و دکتری مدیریت (۲۱۶۲)', '',
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
  1396: '❌ دفترچه ندارد', 1397: '❌ دفترچه ندارد', 1398: '❌ دفترچه ندارد',
  1399: '⚠️ OCR زبان مخدوش، تخصصی ندارد', 1400: '❌ دفترچه ندارد',
  1401: '⚠️ OCR صنعتی مخدوش، بدون پاسخنامه', 1402: '⚠️ دفترچه دوستونه غیرقابل بازیابی',
  1403: '🟡 زبان ۹ تا ۴۰ استخراج شد (۱ تا ۸ خراب)؛ مدیریت بدون پاسخنامه',
  1404: '🟡 زبان کامل با کلید رسمی؛ مدیریت بدون پاسخنامه',
  1405: '🟡 زبان کامل؛ مدیریت بدون پاسخنامه',
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
  '| ۱ | پاسخنامهٔ رسمی سنجش دفترچه‌های مدیریت دکتری ۱۴۰۳، ۱۴۰۴، ۱۴۰۵ | ~۱۵۰ سؤال تخصصی سه سال آخر | ❌ در فایل‌های تغدادی نیست؛ متن سؤال موجود است |',
  '| ۲ | دفترچهٔ رسمی + پاسخنامهٔ ارشد ۱۱۴۲ سال‌های ۱۳۹۶ تا ۱۴۰۵ | ~۱۴۵۰ سؤال رسمی ده‌ساله | ❌ فایل‌های PDF ارشد در ریپو موجود نیست (لینک‌های `/assets/aistudio/*.pdf` شکسته‌اند) |',
  '| ۳ | دفترچهٔ رسمی + پاسخنامهٔ دکتری ۲۱۶۲ سال‌های ۱۳۹۶ تا ۱۴۰۲ | ~۷۰۰ سؤال رسمی | ❌ در بانک نیست |',
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
  missingAssets: ['public/assets/aistudio/*.pdf — فایل‌های PDF دفترچه‌های ارشد referenced در yearlyKonkorExams در ریپو موجود نیست'],
}, null, 1), 'utf8');
console.log('JSON exports written');
'''

def main():
    s = io.open(P, encoding='utf-8').read()
    marker = "// ---------- ۲) EXAMS-COVERAGE.md ----------"
    idx = s.find(marker)
    assert idx > 0, 'marker not found'
    s = s[:idx] + NEW_BLOCK
    s = s.replace("const DATE = '2026-11-13';", "const DATE = '2026-11-15';")
    io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
    print('generator upgraded')

if __name__ == '__main__':
    main()
