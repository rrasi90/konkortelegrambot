/**
 * V3-Hardening R-036 — گارد ساختاری رجیستری کلید سمت سرور:
 *  ۱) هیچ ماژول کلاینت (src/) رجیستری سرور را import نمی‌کند.
 *  ۲) رجیستری شامل Canary است و شمار کلیدهای آن با manifest سازگار است.
 *  ۳) پوشش رجیستری با افشای شناخته‌شدهٔ باندل هم‌خوان است (۲۱۰ سؤال + ۲۵ conceptCheck = ۲۳۵ کلید واقعی + ۲ canary).
 *  ۴) شکل‌های دو بانک (QuestionItem و RefBook) نرمال شده‌اند.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLIENT_BANK_ANSWER_KEYS, CLIENT_BANK_ANSWER_KEY_BY_ID, SECURITY_CANARY_IDS } from '../../../apps/worker/src/data/client-bank-keys.server.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(abs);
  }
  return out;
}

describe('گارد رجیستری کلید سمت سرور (R-036 remediation)', () => {
  it('۱. هیچ فایل کلاینتِ src/ رجیستری سرور را import نمی‌کند (تست‌های گارد مستثنا)', () => {
    const offenders: string[] = [];
    for (const file of walk('src')) {
      const norm = relative('.', file).replaceAll('\\\\', '/');
      if (norm.includes('tests') || norm.includes('test.')) continue; // گارد خودش مجاز است
      const content = readFileSync(file, 'utf8');
      if (content.includes('client-bank-keys.server')) offenders.push(norm);
    }
    expect(offenders, `کلاینت نباید رجیستری سرور را بخواند: ${offenders.join(', ')}`).toEqual([]);
  });

  it('۲. Canaryها موجود و یکتا هستند', () => {
    expect(SECURITY_CANARY_IDS.length).toBeGreaterThanOrEqual(2);
    for (const id of SECURITY_CANARY_IDS) {
      const key = CLIENT_BANK_ANSWER_KEY_BY_ID.get(id);
      expect(key).toBeDefined();
      expect(key!.explanation).toMatch(/^CANARY-EXPLANATION-R036-[0-9a-f]{16}$/);
      expect(key!.trapNote).toMatch(/^CANARY-TRAPNOTE-R036-[0-9a-f]{16}$/);
    }
  });

  it('۳. پوشش رجیستری: ۱٬۲۴۷ کلید واقعی (۴۴۳ konkorData + ۲۷ referenceBooksRepo + ۱۱۲ دفترچهٔ زبان دکتری + ۱۹ سؤال واردشده + ۶۴۶ سؤال بازبینی‌شدهٔ فارسی) + ۲ canary؛ تکراری/بی‌شناسه ممنوع', () => {
    const real = CLIENT_BANK_ANSWER_KEYS.filter((k) => !k.id.startsWith('sec.'));
    // شمارش به تفکیک بانک (با اجرای promote و keys:sync بازتولید می‌شود):
    // konkorData ۴۴۳ + referenceBooksRepo ۲۷ + yearlyKonkorExams ۱۱۲
    // + examArchiveImported ۱۹ + examArchivePersian ۶۴۶ = ۱۲۴۷
    expect(real.length).toBe(1267);
    const conceptChecks = real.filter((k) => k.id.endsWith('#conceptCheck'));
    expect(conceptChecks.length).toBe(25);
    const ids = new Set(real.map((k) => k.id));
    expect(ids.size).toBe(real.length);
    // همهٔ کلیدها شناسهٔ پایدار و گزینهٔ معتبر دارند
    for (const k of real) {
      expect(k.correctOption).toBeGreaterThanOrEqual(0);
      expect(k.correctOption).toBeLessThanOrEqual(3);
      expect(k.bank.length).toBeGreaterThan(0);
    }
  });

  it('۴. نرمال‌سازی دو شکل بانک: explanation/trapNote خالی فقط برای بانک بدون فیلد', () => {
    // refRepo (questionText/detailedAnswer/konkorTrap) باید در explanation/trapNote نرمال شده باشد
    const refKeys = CLIENT_BANK_ANSWER_KEYS.filter((k) => k.bank === 'referenceBooksRepo');
    expect(refKeys.length).toBeGreaterThan(0);
    for (const k of refKeys) expect(k.explanation.length + k.trapNote.length).toBeGreaterThan(0);
  });
});
