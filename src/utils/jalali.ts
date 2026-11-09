/**
 * ابزار تاریخ شمسی برای تاریخ آزمون (EXAM_CALENDAR_SPEC.md).
 * ذخیره‌سازی بدون تغییر می‌ماند: همان ISO میلادی YYYY-MM-DD؛ فقط نمایش/ورودی شمسی است.
 * همهٔ تبدیل‌ها با UTC انجام می‌شوند تا جابه‌جایی روز رخ ندهد.
 */

export interface JalaliParts { jy: number; jm: number; jd: number }

const dtf = new Intl.DateTimeFormat('en-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });

export function gregorianToJalaliFromUtcMs(utcMs: number): JalaliParts {
  const parts = dtf.formatToParts(new Date(utcMs));
  let jy = 0, jm = 0, jd = 0;
  for (const p of parts) {
    if (p.type === 'year') jy = Number(p.value);
    if (p.type === 'month') jm = Number(p.value);
    if (p.type === 'day') jd = Number(p.value);
  }
  return { jy, jm, jd };
}

function nowruzGregorianMs(jy: number): number {
  const gy = jy + 621;
  for (let d = 19; d <= 22; d++) {
    const ms = Date.UTC(gy, 2, d);
    const p = gregorianToJalaliFromUtcMs(ms);
    if (p.jy === jy && p.jm === 1 && p.jd === 1) return ms;
  }
  throw new Error(`Nowruz not found for ${jy}`);
}
function jalaliDayOfYear(jy: number, jm: number, jd: number): number | null {
  if (jm < 1 || jm > 12 || jd < 1) return null;
  const lens = [31,31,31,31,31,31,30,30,30,30,30, isLeapJalaliFast(jy) ? 30 : 29];
  if (jd > lens[jm - 1]!) return null;
  let s = jd;
  for (let m = 1; m < jm; m++) s += lens[m - 1]!;
  return s;
}
function isLeapJalaliFast(jy: number): boolean {
  // اسفند ۳۰ exists iff Nowruz next year is 366 days later
  return nowruzGregorianMs(jy + 1) - nowruzGregorianMs(jy) === 366 * 86400000;
}
export function isLeapJalali(jy: number): boolean {
  if (!Number.isInteger(jy)) return false;
  return isLeapJalaliFast(jy);
}
export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false;
  if (jy < 1300 || jy > 1500) return false;
  return jalaliDayOfYear(jy, jm, jd) !== null;
}
export function jalaliToIso(jy: number, jm: number, jd: number): string | null {
  const doy = jalaliDayOfYear(jy, jm, jd);
  if (doy === null) return null;
  const ms = nowruzGregorianMs(jy) + (doy - 1) * 86400000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function gregorianToJalaliFromIso(iso: string): JalaliParts | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const chk = new Date(ms);
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null;
  return gregorianToJalaliFromUtcMs(ms);
}
export function daysUntilExam(iso: string, todayIso?: string): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  let today: number;
  if (todayIso) {
    const t = todayIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!t) return null;
    today = Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3]));
  } else {
    const now = new Date();
    today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return Math.round((target - today) / 86400000);
}
export function formatJalaliFa(iso: string): string {
  const p = gregorianToJalaliFromIso(iso);
  if (!p) return '';
  const fa = (n: number) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
  const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  return `${fa(p.jd)} ${months[p.jm - 1]} ${fa(p.jy)}`;
}
export function validateExamDate(iso: string, todayIso: string): { ok: boolean; reason: 'ok' | 'invalid' | 'past'; message: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { ok: false, reason: 'invalid', message: 'تاریخ معتبر نیست.' };
  const days = daysUntilExam(iso, todayIso);
  if (days === null) return { ok: false, reason: 'invalid', message: 'تاریخ معتبر نیست.' };
  if (days < 0) return { ok: false, reason: 'past', message: 'این تاریخ گذشته است؛ آزمون برگزار شده است.' };
  return { ok: true, reason: 'ok', message: '' };
}
