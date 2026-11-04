/**
 * SRC-03 — خط ورود سؤال (JSON) با قرنطینه و ورود idempotent.
 * Pure و بدون I/O؛ CLI آن در scripts/import-questions.mjs است.
 *
 * قواعد پذیرش:
 * - AT-04: ورود مجدد همان فایل/رکورد، رکورد تازه نمی‌سازد.
 * - AT-05: رکورد ناقص/مبهم با دلیل وارد قرنطینه می‌شود و شاهد (صفحه/هش) حفظ می‌ماند.
 * - بخش ۶٫۴: هیچ وضعیت حقوق یا کلیدی حدس زده نمی‌شود؛ حقوق فقط از ورودی ثبت‌شده می‌آید.
 */

export function sha256Hex(bytes) {
  // Web Crypto در Node 24 و Workers هر دو هست.
  return crypto.subtle.digest('SHA-256', bytes).then((digest) =>
    [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join(''));
}

const REQUIRED = ['id', 'prompt', 'choices', 'answerIndex'];

/** اعتبارسنجی ساختاری یک رکورد کاندید؛ خروجی: فهرست ایرادها (خالی = سالم). */
export function structuralIssues(record) {
  const issues = [];
  if (typeof record.id !== 'string' || !record.id) issues.push('شناسهٔ سؤال نامعتبر است.');
  if (typeof record.prompt !== 'string' || !record.prompt.trim()) issues.push('صورت سؤال خالی است.');
  if (!Array.isArray(record.choices) || record.choices.length !== 4 || new Set(record.choices).size !== 4) {
    issues.push('گزینه‌ها باید دقیقاً چهار مقدار یکتا باشند.');
  }
  if (!Number.isInteger(record.answerIndex) || record.answerIndex < 0 || record.answerIndex > 3) {
    issues.push('کلید (answerIndex) باید عددی ۰ تا ۳ باشد.');
  }
  if (record.answerIndex !== undefined && Array.isArray(record.choices) && record.answerIndex >= record.choices.length) {
    issues.push('کلید به گزینهٔ موجود اشاره نمی‌کند.');
  }
  if (typeof record.rights !== 'string' || !record.rights) {
    issues.push('وضعیت حقوق ثبت نشده است — حدس ممنوع (AT-29).');
  }
  return issues;
}

/**
 * ورود یک بستهٔ کاندید:
 * @param incoming  رکوردهای فایل جدید
 * @param existingIds  شناسه‌های موجود بانک (Set)
 * @returns { accepted, quarantined, duplicates } — هیچ رکورد تازه‌ای از تکرار ساخته نمی‌شود.
 */
export function importQuestionBatch(incoming, existingIds) {
  const accepted = [];
  const quarantined = [];
  const duplicates = [];
  const seen = new Set();
  const bankIds = existingIds instanceof Set ? existingIds : new Set(existingIds);
  for (const record of incoming) {
    const issues = structuralIssues(record);
    if (issues.length) {
      quarantined.push({ id: typeof record.id === 'string' ? record.id : null, reasons: issues, record });
      continue;
    }
    if (bankIds.has(record.id) || seen.has(record.id)) {
      duplicates.push(record);
      continue;
    }
    seen.add(record.id);
    accepted.push(record);
  }
  return { accepted, quarantined, duplicates };
}

/** گزارش ورود قابل بازسازی: هش محتوا + شمارها؛ بدون متن سؤال (متادیتا فقط). */
export function importReport(fileName, contentHash, result) {
  return {
    version: 1,
    file: fileName,
    contentSha256: contentHash,
    importedAtNote: 'زمان توسط فراخوان ثبت می‌شود؛ این گزارش خودش تاریخ ندارد.',
    counts: {
      accepted: result.accepted.length,
      quarantined: result.quarantined.length,
      duplicates: result.duplicates.length,
    },
    quarantineReasons: result.quarantined.map((entry) => ({ id: entry.id, reasons: entry.reasons })),
  };
}
