const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** اعداد رابط را به رقم فارسی تبدیل می‌کند؛ ورودی لاتین یا فارسی هر دو پذیرفته است. */
export function toFaDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}
