/**
 * AEL-004 — سیاست وضعیت‌گذاری درون‌ریزی محتوا (Pure، بدون I/O).
 *
 * قاعدهٔ مأموریت: هیچ وضعیت published/authorized/verified از «غیبت» یک نشانه
 * استنتاج نمی‌شود. غیبتِ synthetic به معنی رسمی/تأییدشده بودن نیست؛ فقط وضعیت
 * انتظار بازبینی می‌گیرد. انتشار و مجوز، Gateهای انسانی جدا دارند.
 */

export const IMPORT_POLICY_VERSION = 1;

/**
 * وضعیت راستی‌آزمایی سؤال هنگام درون‌ریزی.
 * - synthetic صریح (=== true) → 'demo'
 * - هر حالت دیگر (غیبت، false، نامشخص) → 'pending_review' — هرگز 'verified' از غیبت.
 */
export function deriveQuestionVerificationStatus(meta) {
  return meta?.synthetic === true ? 'demo' : 'pending_review';
}

/**
 * وضعیت بستهٔ آزمون هنگام درون‌ریزی: هرگز 'published' نیست.
 * فعال‌سازی و انتشار فقط از مسیر Gateهای بازبینی/حقوق انجام می‌شود.
 */
export function deriveExamPackStatus(meta) {
  return meta?.synthetic === true ? 'demo' : 'draft';
}

/** وضعیت حقوق بسته: از هیچ ورودی یا غیابی مجاز استنتاج نمی‌شود. */
export function deriveExamPackRightsStatus(meta) {
  return 'pending_review';
}

/**
 * گارد نوشتن مستقیم پایگاه داده: فقط با پرچم صریح `--write` و هرگز روی
 * محیط production. پیش‌فرض همیشه dry-run است.
 */
export function assertDirectWriteAllowed({ writeFlag, environment }) {
  if (!writeFlag) {
    throw new Error('نوشتن مستقیم فقط با پرچم --write مجاز است. پیش‌فرض این اسکریپت dry-run است.');
  }
  if (environment === 'production') {
    throw new Error('نوشتن مستقیم به پایگاه production از این اسکریپت ممنوع است.');
  }
  return true;
}
