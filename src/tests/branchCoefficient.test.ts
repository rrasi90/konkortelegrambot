import { describe, expect, it } from 'vitest';
import {
  getMultiBranchEffectiveCoefficient,
  getNodeEffectiveBranchCoefficient,
} from '../engine/aelEngine';
import { KNOWLEDGE_NODES } from '../data/konkorData';

const node = (id: string) => {
  const n = KNOWLEDGE_NODES.find((x) => x.id === id);
  if (!n) throw new Error(`node not found: ${id}`);
  return n;
};

describe('ضریب مؤثر گرایش‌ها — اشتراک و تفاوت بسته‌های رسمی ۱۴۰۵', () => {
  it('دکتری (phd_all) ضریب رسمی خود گره را برمی‌گرداند و درس سطح دکتری را صفر نمی‌کند', () => {
    const phdResearch = node('rm.research_design');
    expect(getNodeEffectiveBranchCoefficient(phdResearch, 'phd_all')).toBe(phdResearch.examCoefficient);
    expect(phdResearch.examCoefficient).toBeGreaterThan(0);
  });

  it('درس‌های سطح دکتری برای همهٔ گرایش‌های ارشد ضریب ۰ دارند', () => {
    const phdOnly = ['rm.research_design', 'rm.reliability_forms', 'lang.phd_readings', 'stats.nonparametric'];
    const arshadBranches = ['business', 'industrial', 'technology', 'public', 'financial', 'media', 'foresight', 'stpolicy', 'amad'] as const;
    for (const id of phdOnly) {
      for (const b of arshadBranches) {
        expect(getNodeEffectiveBranchCoefficient(node(id), b), `${id} در ${b} باید صفر باشد`).toBe(0);
      }
    }
  });

  it('amad طبق ترکیب ۴ فقط زبان + رفتار سازمانی + استراتژیک دارد', () => {
    expect(getNodeEffectiveBranchCoefficient(node('hr.ob_leadership'), 'amad')).toBe(4);
    expect(getNodeEffectiveBranchCoefficient(node('sm.rbv'), 'amad')).toBe(4);
    expect(getNodeEffectiveBranchCoefficient(node('bus.english_eshraghi'), 'amad')).toBe(3);
    // بدون بستهٔ مجموعه کارشناسی و بدون دروس تخصصی دیگر
    expect(getNodeEffectiveBranchCoefficient(node('stats.scales'), 'amad')).toBe(0);
    expect(getNodeEffectiveBranchCoefficient(node('mb.structure'), 'amad')).toBe(0);
    expect(getNodeEffectiveBranchCoefficient(node('mkt.plc'), 'amad')).toBe(0);
    expect(getNodeEffectiveBranchCoefficient(node('ind.or_simplex_duality'), 'amad')).toBe(0);
  });

  it('درس تخصصی هر گرایش فقط در همان گرایش ضریب‌دار است (pa فقط دولتی، fin فقط مالی، mis فقط رسانه)', () => {
    expect(getNodeEffectiveBranchCoefficient(node('pa.public_theories'), 'public')).toBe(4);
    expect(getNodeEffectiveBranchCoefficient(node('pa.public_theories'), 'business')).toBe(0);
    expect(getNodeEffectiveBranchCoefficient(node('fin.risk_investment'), 'financial')).toBe(4);
    expect(getNodeEffectiveBranchCoefficient(node('fin.risk_investment'), 'industrial')).toBe(0);
    expect(getNodeEffectiveBranchCoefficient(node('mis.sims_advanced'), 'media')).toBe(4);
    expect(getNodeEffectiveBranchCoefficient(node('mis.sims_advanced'), 'public')).toBe(0);
  });

  it('اتحاد چندگرایشی max را برمی‌گرداند (بازرگانی+دولتی: pa با ضریب ۴ دیده می‌شود)', () => {
    expect(getMultiBranchEffectiveCoefficient(node('pa.public_theories'), ['business', 'public'])).toBe(4);
    expect(getMultiBranchEffectiveCoefficient(node('mkt.plc'), ['public', 'financial'])).toBe(0);
  });
});
