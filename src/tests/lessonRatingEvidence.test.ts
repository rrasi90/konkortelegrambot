import { describe, it, expect } from 'vitest';
import {
  applyLessonUnderstandingRating,
  createZeroStateEngine,
  initFSRS,
} from '../engine/aelEngine';
import {
  INITIAL_KNOWLEDGE_NODES,
  INITIAL_NODE_DEPENDENCIES,
  INITIAL_QUESTION_BANK,
} from '../data/konkorData';

/**
 * خودارزیابی درس‌نامه شاهد تسلط نیست.
 *
 * این تست مستقیماً روی موتور واقعی اجرا می‌شود، چون ایراد اصلی این بود که
 * انتخاب «۵ — کاملاً مسلطم» بدون حل هیچ سؤالی تسلط را به ۷۶٪ می‌رساند.
 */
describe('applyLessonUnderstandingRating — خواندن، تسلط نمی‌سازد', () => {
  const nodes = INITIAL_KNOWLEDGE_NODES;
  const questions = INITIAL_QUESTION_BANK;
  const dependencies = INITIAL_NODE_DEPENDENCIES;
  const targetNode = nodes[0];

  const buildBase = () => {
    const first = createZeroStateEngine(nodes, questions);
    return {
      nodeStates: first.nodeStates,
      cards: first.cards,
      stats: {
        ...first.stats,
        // یک درسنامهٔ ترمیمی برای بررسی حذف/افزودن کارت
        dailyQuests: first.stats.dailyQuests ?? [],
      },
    };
  };

  it('رقم تسلط را با هیچ امتیازی تغییر نمی‌دهد', () => {
    for (const rating of [1, 2, 3, 4, 5] as const) {
      const base = buildBase();
      const before = base.nodeStates[targetNode.id]?.masteryScore ?? 0;

      const result = applyLessonUnderstandingRating({
        nodeId: targetNode.id,
        rating,
        nodeStates: base.nodeStates,
        cards: base.cards,
        stats: base.stats,
        nodes,
        dependencies,
        questions,
      });

      const after = result.nextNodeStates[targetNode.id]?.masteryScore ?? 0;
      expect(after).toBe(before);
      expect(result.delta.delta).toBe(0);
    }
  });

  it('امتیاز خودارزیابی در فیلد جداگانه ذخیره می‌شود', () => {
    const base = buildBase();
    const result = applyLessonUnderstandingRating({
      nodeId: targetNode.id,
      rating: 5,
      nodeStates: base.nodeStates,
      cards: base.cards,
      stats: base.stats,
      nodes,
      dependencies,
      questions,
    });

    expect(result.nextNodeStates[targetNode.id]?.selfReportedUnderstanding).toBe(5);
    expect(result.nextNodeStates[targetNode.id]?.lastLessonSelfRating).toBe(5);
  });

  it('امتیاز ۵ ادعای ۷۶٪ تسلط نمی‌کند و تست اثبات را باز می‌کند', () => {
    const base = buildBase();
    const result = applyLessonUnderstandingRating({
      nodeId: targetNode.id,
      rating: 5,
      nodeStates: base.nodeStates,
      cards: base.cards,
      stats: base.stats,
      nodes,
      dependencies,
      questions,
    });

    const state = result.nextNodeStates[targetNode.id];
    expect(state.masteryScore).toBeLessThan(76);
    expect(state.coverageStatus).toBe('needs_proof');
    // پیام برنامه‌ریز نباید عدد تسلط جعلی نشان دهد
    expect(result.scheduleSummary).not.toMatch(/تسلط.*۷۶/);
  });

  it('امتیاز ۱ پیش‌نیاز را در صف قرار می‌دهد بدون ساختن تسلط', () => {
    const base = buildBase();
    const result = applyLessonUnderstandingRating({
      nodeId: targetNode.id,
      rating: 1,
      nodeStates: base.nodeStates,
      cards: base.cards,
      stats: base.stats,
      nodes,
      dependencies,
      questions,
    });

    expect(result.nextNodeStates[targetNode.id].coverageStatus).toBe('weak');
    expect(result.nextNodeStates[targetNode.id].masteryScore).toBe(
      base.nodeStates[targetNode.id]?.masteryScore ?? 0
    );
  });

  it('initFSRS برای کارت جدید پایداری صفر می‌سازد (بدون تقلب در مرور)', () => {
    const fsrs = initFSRS(new Date('2026-11-01T00:00:00Z'));
    expect(fsrs.stability).toBe(0);
    expect(fsrs.intervalDays).toBe(0);
  });
});
