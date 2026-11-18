/**
 * ممیزی درس ۱ — course-org-theory (مبانی سازمان و مدیریت)
 * نقشهٔ اجرایی v2.0 §3/§12: تست‌های اختصاصی درس — پوشش کلید سمت سرور،
 * رجیستری conceptCheck، سازگاری گراف/درس‌نامه/بات، و فلش‌کارت‌ها.
 * این تست وضعیت ممیزی‌شده را قفل می‌کند تا رگرسیون آینده آشکار شود.
 */
import { describe, expect, it } from 'vitest';
import { CLIENT_BANK_ANSWER_KEYS } from '../../../apps/worker/src/data/client-bank-keys.server.ts';
import { INITIAL_INTERACTIVE_LESSONS, INITIAL_QUESTION_BANK, KNOWLEDGE_NODES } from '../../../src/data/konkorData.ts';

const MB_NODES = ['mb.structure', 'mb.contingency', 'mb.culture'];

describe('ممیزی درس ۱ — مبانی سازمان و مدیریت (course-org-theory)', () => {
  const mbNodes = KNOWLEDGE_NODES.filter((n) => MB_NODES.includes(n.id));
  const courseQuestions = INITIAL_QUESTION_BANK.filter((q) => MB_NODES.includes(q.nodeId));
  const keyMap = new Map(CLIENT_BANK_ANSWER_KEYS.map((k) => [k.id, k]));

  it('گراف دانش: دقیقاً ۳ نود mb.* با course درست وجود دارد', () => {
    expect(mbNodes.length).toBe(3);
    for (const n of mbNodes) expect(n.course).toContain('مبانی سازمان');
  });

  it('هر ۵۴ سؤال مرتبط با درس، کلید پاسخ سمت سرور دارند (R-036 پوشش کامل)', () => {
    // وضعیت پس از ادغام PRهای ۲۷/۲۸/۳۵: ۳۰ سؤال اصلی + ۲۴ تست تألیفی فصل مبانی
    // سازمان (q.auth.th.*). هدف ممیزی ۵۷ سؤال بود؛ ۳ سؤال اصلیِ باقی‌مانده هنوز
    // نوشته نشده‌اند و به‌عنوان gap محتوایی در openItems رجیستر ممیزی باز است —
    // هیچ سؤالی برای رسیدن به عدد هدف جعل نمی‌شود.
    expect(courseQuestions.length).toBe(54);
    const missing = courseQuestions.filter((q) => !keyMap.has(q.id));
    expect(missing.map((q) => q.id)).toEqual([]);
  });

  it('کلید هر سؤال رسمی در محدودهٔ گزینه‌هاست و explanation سمت سرور دارد', () => {
    for (const q of courseQuestions) {
      const key = keyMap.get(q.id)!;
      expect(key.correctOption, q.id).toBeGreaterThanOrEqual(0);
      expect(key.correctOption, q.id).toBeLessThan(q.options.length);
      expect((key.explanation ?? '').length, q.id).toBeGreaterThan(20);
    }
  });

  it('اسپات‌چک علمی: سه کلید تأییدشده دست‌نخورده مانده‌اند (پیتر، پل ارتباطی فایول، عوامل بهداشتی)', () => {
    const peter = keyMap.get('q.k1392.47')!;
    expect(peter.correctOption).toBe(1);
    expect(peter.explanation).toContain('پیتر');
    const gangplank = keyMap.get('q.k1401.77')!;
    expect(gangplank.correctOption).toBe(2);
    expect(gangplank.explanation).toContain('پل ارتباطی');
    const hygiene = keyMap.get('q.k1404.66')!;
    expect(hygiene.correctOption).toBe(0);
    expect(hygiene.explanation).toContain('هرزبرگ');
  });

  it('conceptCheck درس‌نامه‌های mb.structure/mb.contingency/mb.culture در رجیستری سرور ثبت شده‌اند', () => {
    for (const nodeId of MB_NODES) {
      const ccId = nodeId + '#conceptCheck';
      expect(keyMap.has(ccId), ccId).toBe(true);
    }
  });

  it('سازگاری گراف/درس‌نامه: درس‌های تعاملی mb.structure و mb.contingency موجودند', () => {
    expect(INITIAL_INTERACTIVE_LESSONS['mb.structure']).toBeDefined();
    expect(INITIAL_INTERACTIVE_LESSONS['mb.contingency']).toBeDefined();
  });

  it('وضعیت V5-C1-01 پس از ممیزی: گرهٔ mb.decision افزوده شده؛ mb.institutional هنوز نود ندارد', () => {
    // PR #28 (commit 37999f7) نود mb.decision را به گراف افزود و نیمهٔ اول
    // تناقض V5-C1-01 را رفع کرد؛ topic بات mb.institutional همچنان بدون نود
    // است — این نیمهٔ بازِ تناقض قابل‌مشاهده نگه داشته می‌شود.
    expect(INITIAL_INTERACTIVE_LESSONS['mb.culture']).toBeDefined();
    expect(KNOWLEDGE_NODES.some((n) => n.id === 'mb.decision')).toBe(true);
    expect(KNOWLEDGE_NODES.some((n) => n.id === 'mb.institutional')).toBe(false);
  });
});
