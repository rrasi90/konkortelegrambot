/**
 * ممیزی درس‌های ۲ تا ۶ — course-stats / islamic-mgmt / strategic-mgmt / marketing / innovation-mgmt
 * نقشهٔ اجرایی v2.0 §3/§12: پوشش کلید سمت سرور، محدودهٔ کلید، توضیح، و اسپات‌چک علمی
 * هر درس (شامل یک تحلیل محاسباتی قابل‌اثبات برای ANOVA).
 */
import { describe, expect, it } from 'vitest';
import { CLIENT_BANK_ANSWER_KEYS } from '../../../apps/worker/src/data/client-bank-keys.server.ts';
import { INITIAL_QUESTION_BANK, KNOWLEDGE_NODES } from '../../../src/data/konkorData.ts';

const keyMap = new Map(CLIENT_BANK_ANSWER_KEYS.map((k) => [k.id, k]));

const COURSE_NODES: Record<string, string[]> = {
  'course-stats': ['stats.scales', 'stats.anova', 'stats.regression', 'stats.nonparametric'],
  'course-islamic-mgmt': ['bus.islamic_moghimi'],
  'course-strategic-mgmt': ['sm.value_chain', 'sm.rbv', 'sm.portfolio', 'sm.dynamic'],
  'course-marketing': ['mkt.plc', 'mkt.brand', 'mkt.consumer'],
  'course-innovation-mgmt': ['inno.s_curve', 'inno.ambidextrous', 'inno.tidd_4p'],
};

const EXPECTED_COUNTS: Record<string, number> = {
  'course-stats': 18,
  'course-islamic-mgmt': 9,
  'course-strategic-mgmt': 13,
  'course-marketing': 17,
  'course-innovation-mgmt': 7,
};

describe('ممیزی درس‌های ۲ تا ۶ — پوشش بانک سؤال و کلید سمت سرور (v2.0 §3/§12)', () => {
  for (const [cid, nodes] of Object.entries(COURSE_NODES)) {
    describe(cid, () => {
      const qs = INITIAL_QUESTION_BANK.filter((q) => nodes.includes(q.nodeId));

      it('نودهای گراف موجودند و شمار سؤال‌ها مطابق ممیزی است', () => {
        for (const nid of nodes) {
          expect(KNOWLEDGE_NODES.some((n) => n.id === nid), nid).toBe(true);
        }
        expect(qs.length).toBe(EXPECTED_COUNTS[cid]);
      });

      it('پوشش کلید سمت سرور ۱۰۰٪ است (R-036)', () => {
        const missing = qs.filter((q) => !keyMap.has(q.id));
        expect(missing.map((q) => q.id)).toEqual([]);
      });

      it('کلید در محدودهٔ گزینه‌هاست و explanation سمت سرور دارد', () => {
        for (const q of qs) {
          const key = keyMap.get(q.id)!;
          expect(key.correctOption, q.id).toBeGreaterThanOrEqual(0);
          expect(key.correctOption, q.id).toBeLessThan(q.options.length);
          expect((key.explanation ?? '').length, q.id).toBeGreaterThan(20);
        }
      });
    });
  }
});

describe('اسپات‌چک علمی درس‌های ۲ تا ۶ (قفل نتایج ممیزی)', () => {
  it('course-stats: ANOVA یک‌طرفه — F از محاسبهٔ مستقل درست است (SSB=90، df 3/20 → F=5.0)', () => {
    const q = INITIAL_QUESTION_BANK.find((x) => x.id === 'q.stats.anova.1')!;
    const key = keyMap.get('q.stats.anova.1')!;
    // بازمحاسبهٔ مستقل از اعداد صورت سؤال
    const SSB = 210 - 120;
    const F = (SSB / (4 - 1)) / (120 / (24 - 4));
    expect(F).toBe(5.0);
    // گزینهٔ کلید دقیقاً همان F محاسبه‌شده است
    expect(q.options[key.correctOption]).toContain('F = 5.0');
  });

  it('course-islamic-mgmt: عهدنامه مالک اشتر — سازوکار پیشگیرانه = تأمین معاش کافی (استغناء)', () => {
    const q = INITIAL_QUESTION_BANK.find((x) => x.id === 'q.bus.islamic.1')!;
    const key = keyMap.get('q.bus.islamic.1')!;
    expect(key.correctOption).toBe(0);
    expect(q.options[key.correctOption]).toContain('أَسبِغ عَلَیهِمُ الأَرزاق');
    expect(key.explanation).toContain('بیت‌المال');
  });

  it('course-strategic-mgmt: VRIO بارنی — ارزشمند+کمیاب بدون تقلیدناپذیری = مزیت موقت', () => {
    const key = keyMap.get('q.sm.rbv.1')!;
    expect(key.correctOption).toBe(1);
    expect(key.explanation).toContain('مزیت رقابتی موقت');
  });

  it('course-marketing: کاتلر — قیمت بالا + ترفیع بالا = سرشیرگیری سریع', () => {
    const key = keyMap.get('q.mkt.plc.1')!;
    expect(key.correctOption).toBe(0);
    expect(key.explanation).toContain('سرشیرگیری');
  });

  it('course-innovation-mgmt: فاستر — ناپیوستگی S-Curve و واگذاری بازار توسط رهبران قدیمی', () => {
    const key = keyMap.get('q.inno.scurve.1')!;
    expect(key.correctOption).toBe(0);
    expect(key.explanation).toContain('ناپیوستگی');
  });
});
