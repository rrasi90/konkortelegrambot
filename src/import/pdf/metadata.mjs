/**
 * AEL-313 P0 — Metadata Extraction Layer مستقل (سند §3.1/§3.2).
 * هیچ مقدار Hardcode؛ هر فیلد: value/status/confidence/evidence/candidate_values.
 * وضعیت‌ها: unknown|proposed|needs_review|verified|ambiguous|rejected.
 * تفکیک اجباری: Exam Set ≠ Combination ≠ Booklet ≠ Field ≠ Track ≠ Course.
 */
import { normalizePersian } from '../normalize.mjs';

function field(value, status, confidence, evidence, candidateValues = []) {
  return { value, status, confidence, evidence, candidate_values: candidateValues };
}

const unknown = () => field(null, 'unknown', null, []);

// ---------- سال آزمون (از classify بازاستفاده ولی ساختار field) ----------
export function extractExamYear(pages) {
  const candidates = [];
  for (const page of pages) {
    const text = normalizePersian(page.text ?? '');
    const patterns = [
      /(?:آزمون|کنکور|دوره|دکتری|ارشد)[^\n]{0,40}?سال\s*([1-4]\d{3})/g,
      /سال\s*([1-4]\d{3})[^\n]{0,30}?(?:آزمون|کنکور|دکتری|ارشد)/g,
    ];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const year = Number(match[1]);
        if (year >= 1370 && year <= 1420) {
          candidates.push({ value: year, score: 0.9, evidence: [{ pdf_page: page.pageNumber, locator: `doc:/page:${page.pageNumber}`, quote: match[0].slice(0, 120), method: page.extraction_method ?? 'unknown' }] });
        }
      }
    }
  }
  const unique = [...new Set(candidates.map(row => row.value))];
  if (unique.length === 1) return field(unique[0], 'proposed', 0.9, candidates[0].evidence);
  if (unique.length > 1) return field(null, 'ambiguous', null, candidates.flatMap(row => row.evidence).slice(0, 5), unique);
  return unknown();
}

// ---------- هویت آزمون از جدول سربرگ کلید (کد رشته امتحانی / نوع دفترچه / گروه امتحانی) ----------
/**
 * MinerU سربرگ کلید را به‌صورت جدول استخراج می‌کند:
 * گروه امتحانی | شماره پاسخنامه | نوع دفترچه | نام رشته امتحانی | کد رشته امتحانی
 * توجه §3.2: «کد رشته امتحانی» (مثل 1142) کد *مجموعهٔ امتحانی* است، نه combination.
 */
export function extractExamIdentity(pages) {
  const result = {
    exam_family: unknown(),
    exam_level: unknown(),
    exam_set_code: unknown(),
    booklet_code: unknown(),
    exam_group: unknown(),
    answer_sheet_number: unknown(),
    field_title_fa: unknown(),
    organizer: unknown(),
  };
  for (const page of pages) {
    const text = normalizePersian(page.text ?? '');
    // جدول سربرگ MinerU: ردیف عنوان‌ها («گروه امتحانی … کد رشته امتحانی») و ردیف مقادیر بعد از آن
    if (text.includes('گروه امتحانی') && /کد رشته امتحانی/.test(text)) {
      const rows = [...text.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(rowMatch =>
        [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(cellMatch =>
          cellMatch[1].replace(/<[^>]+>/g, '').trim()));
      const headerIdx = rows.findIndex(row => row.some(cell => /گروه امتحانی/.test(cell)));
      const values = headerIdx >= 0 ? rows[headerIdx + 1] : null;
      const evidenceAt = (quote) => [{ pdf_page: page.pageNumber, locator: `doc:/page:${page.pageNumber}`, quote, method: page.extraction_method ?? 'mineru' }];
      if (values && values.length >= 5) {
        const [group, sheet, booklet, fieldTitle, setCode] = values;
        if (group) result.exam_group = field(group, 'proposed', 0.85, evidenceAt(group));
        if (sheet && /^\d+$/.test(sheet)) result.answer_sheet_number = field(sheet, 'proposed', 0.85, evidenceAt(sheet));
        if (booklet && /^[A-Za-z]$/.test(booklet)) result.booklet_code = field(booklet.toUpperCase(), 'proposed', 0.85, evidenceAt(booklet));
        if (fieldTitle) result.field_title_fa = field(fieldTitle, 'proposed', 0.8, evidenceAt(fieldTitle));
        if (setCode && /^\d{3,4}$/.test(setCode)) {
          // §3.2: این کد «مجموعهٔ امتحانی» است — combination نیست
          result.exam_set_code = field(setCode, 'proposed', 0.85, evidenceAt(`کد رشته امتحانی=${setCode}`));
        }
        break;
      }
    }
    const level = text.match(/(کارشناسی\s*ارشد|دکتری|کارشناسی)/);
    if (level && result.exam_level.status === 'unknown') {
      const value = /دکتری/.test(level[1]) ? 'phd' : /ارشد/.test(level[1]) ? 'master' : 'bachelor';
      result.exam_level = field(value, 'proposed', 0.85, [{ pdf_page: page.pageNumber, locator: `doc:/page:${page.pageNumber}`, quote: level[1], method: page.extraction_method ?? 'unknown' }]);
    }
    if (/سازمان سنجش/.test(text) && result.organizer.status === 'unknown') {
      result.organizer = field('سازمان سنجش آموزش کشور', 'proposed', 0.9, [{ pdf_page: page.pageNumber, locator: `doc:/page:${page.pageNumber}`, quote: 'سازمان سنجش', method: page.extraction_method ?? 'unknown' }]);
    }
  }
  return result;
}

/** ترکیب نهایی Metadata سند — همهٔ فیلدهای §3.1 با ساختار استاندارد */
export function extractMetadata(filename, pages) {
  const examYear = extractExamYear(pages);
  const identity = extractExamIdentity(pages);
  const front = normalizePersian(pages.slice(0, 3).map(page => page.text ?? '').join('\n'));

  // Exam Family از سطح + نوع سند — بدون Hardcode (اگر سطح unknown، family هم unknown)
  let examFamily = unknown();
  if (identity.exam_level.status !== 'unknown') {
    const map = { phd: 'phd_admission', master: 'master_admission', bachelor: 'bachelor_entrance' };
    examFamily = field(map[identity.exam_level.value] ?? null, 'proposed', 0.8,
      identity.exam_level.evidence, [map[identity.exam_level.value]].filter(Boolean));
  }

  // Track — هرگز از نام فایل؛ فقط با Evidence صریح رشته/گرایش. فعلاً unknown تا Taxonomy Review.
  const trackId = unknown();
  const courseId = unknown();
  const courseOfferingId = unknown();

  return {
    document_type: null, // در classify پر می‌شود
    title_fa: unknown(),
    exam_family: examFamily,
    exam_level: identity.exam_level,
    exam_year: examYear,
    exam_authority: identity.organizer,
    exam_session: unknown(), // نوبت — وقتی سند تصریح کرد
    exam_set_code: identity.exam_set_code,        // کد مجموعه (1142)
    combination_code: unknown(),                  // کد ترکیب — جدا (§3.2)
    booklet_code: identity.booklet_code,
    exam_group: identity.exam_group,
    answer_sheet_number: identity.answer_sheet_number,
    field_id: unknown(),
    field_title_fa: identity.field_title_fa,
    track_id: trackId,
    course_id: courseId,
    course_offering_id: courseOfferingId,
    education_level: identity.exam_level, // §21.2: سطح هدف داوطلب فعلاً = سطح آزمون تا Evidence جدا
    language: field('fa', 'proposed', 0.9, []),
    _front_text: front.slice(0, 2000),
  };
}
