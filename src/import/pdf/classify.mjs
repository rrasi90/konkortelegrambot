/**
 * AEL-313 — Stage 2/3: Classification عمومی سند + Metadata با Evidence.
 * قواعد سند §6 Stage 2/3 و §27.4:
 *  - نام فایل فقط نشانه کمکی است؛ متن جلد/سربرگ مقدم است.
 *  - هر تصمیم با evidence (صفحه/شاهد/روش) همراه است.
 *  - unknown نتیجه معتبر است؛ حدس ممنوع.
 *  - کد مجموعه ≠ کد ترکیب ≠ کد دفترچه ≠ رشته ≠ گرایش.
 */
import { normalizePersian } from '../normalize.mjs';

export const DOCUMENT_TYPES = [
  'exam_paper', 'answer_key', 'answer_explanation', 'exam_brochure', 'exam_amendment',
  'syllabus', 'curriculum', 'textbook', 'book_chapter', 'lecture_notes',
  'academic_article', 'regulation', 'reference_material', 'other', 'unknown',
];

const TYPE_PATTERNS = [
  { type: 'answer_key', evidence_type: 'title_match', patterns: [/کلید\s*(سؤالات|سوالات|پاسخ)/, /^(جواب|پاسخ‌نامه|پاسخ نامه)/, /کلید\s*رسمی/, /کلید\s*اولیه/] },
  { type: 'exam_paper', evidence_type: 'title_match', patterns: [/دفترچه\s*(سؤالات|آزمون|سوالات)/, /سؤالات\s*کنکور/, /آزمون\s*ورودی/] },
];

/** استخراج سال شمسی از متن جلد/سربرگ — از سال چاپ/تاریخ فایل جدا (§27.4) */
export function extractExamYearFromText(pages) {
  const candidates = [];
  for (const page of pages) {
    const text = normalizePersian(page.text ?? '');
    // الگوهای «آزمون سال 1404»، «کنکور سال ۱۴۰۴»، «سال ۱۴۰۴»
    // الگوی مستقیم (آزمون…سال X) + الگوی معکوس RTL — OCR ترتیب را جابه‌جا می‌کند
    const yearPatterns = [
      /(?:آزمون|کنکور|دوره|دکتری|ارشد)[^\n]{0,40}?سال\s*([1-4]\d{3})/g,
      /سال\s*([1-4]\d{3})[^\n]{0,30}?(?:آزمون|کنکور|دکتری|ارشد)/g,
    ];
    for (const pattern of yearPatterns) {
      for (const match of text.matchAll(pattern)) {
        const year = Number(match[1]);
        if (year >= 1370 && year <= 1420) {
          candidates.push({
            value: year, score: 0.9, status: 'proposed',
            evidence: [{ pdf_page: page.pageNumber, locator: `doc:/page:${page.pageNumber}`, quote: match[0].slice(0, 120), method: 'native_text' }],
          });
        }
      }
    }
  }
  // یکتا بودن — اگر چند سال متفاوت، multi-candidate
  const uniqueYears = [...new Set(candidates.map(row => row.value))];
  if (uniqueYears.length === 1) return { value: uniqueYears[0], status: 'proposed', evidence: candidates[0].evidence };
  if (uniqueYears.length > 1) return { value: null, status: 'ambiguous', candidates: uniqueYears, evidence: candidates.flatMap(row => row.evidence).slice(0, 5) };
  return { value: null, status: 'unknown', evidence: [] };
}

export function classifyDocument(filename, pages) {
  // ۱) امتیاز نوع سند از متن صفحات (جلد/سربرگ = صفحه‌های اول)
  const frontText = normalizePersian(pages.slice(0, 3).map(page => page.text ?? '').join('\n'));
  let bestType = 'unknown';
  let bestEvidence = [];
  for (const rule of TYPE_PATTERNS) {
    for (const page of pages.slice(0, 3)) {
      const text = normalizePersian(page.text ?? '');
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          if (bestType === 'unknown' || (rule.type === 'answer_key' && bestType === 'exam_paper')) {
            bestType = rule.type;
            bestEvidence = [{ pdf_page: page.pageNumber, locator: `doc:/page:${page.pageNumber}`, quote: (page.text ?? '').match(pattern)?.[0]?.slice(0, 80) ?? '', method: 'native_text' }];
          }
        }
      }
    }
  }
  // ۲) نشانهٔ کمکی نام فایل — هرگز تنها Evidence نیست (§2-6)
  const nameHint = normalizePersian(filename);
  if (bestType === 'unknown') {
    if (/^(جواب|پاسخ)/.test(nameHint)) bestType = 'answer_key';
    else if (/دفترچه|سؤالات|کنکور/.test(nameHint)) bestType = 'exam_paper';
  }

  const examYear = extractExamYearFromText(pages);
  return {
    document_type: bestType,
    classification_status: bestType === 'unknown' ? 'needs_review' : 'classified',
    exam_year: examYear,
    evidence: bestEvidence,
  };
}
