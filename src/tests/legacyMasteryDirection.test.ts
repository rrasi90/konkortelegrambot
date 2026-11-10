import { describe, expect, it } from 'vitest';
import {
  createZeroStateEngine,
  evaluateAnswerAndRipple,
  rollbackSlipPenalty,
} from '../engine/aelEngine';
import {
  INTERACTIVE_LESSONS,
  KNOWLEDGE_NODES,
  NODE_DEPENDENCIES,
  QUESTION_BANK,
} from '../data/konkorData';

/**
 * A-09 — موتور قدیمی (deprecated، سطح React) نقض‌های جهت داشت:
 * پاسخ غلط یا موجِ آن روی گرهٔ سنجیده‌نشده تسلط «از صفر به بالا» می‌ساخت.
 * این تست‌ها همان ثابت را می‌بندند: یک پاسخ غلط هرگز masteryScore را زیاد نمی‌کند.
 */
function fixture() {
  const zero = createZeroStateEngine(KNOWLEDGE_NODES, QUESTION_BANK);
  const questionCard = zero.cards.find((c) => c.cardType === 'question')!;
  const question = QUESTION_BANK.find((q) => q.id === questionCard.questionId)!;
  // R-036: کلید در کلاینت نیست؛ سناریوی «پاسخ غلط» با نتیجهٔ تصحیح سمت سرور شبیه‌سازی می‌شود
  const wrongOption = 0;
  return { zero, questionCard, question, wrongOption };
}

describe('A-09 — موتور قدیمی: پاسخ غلط شایستگی نمی‌سازد', () => {
  it('گرهٔ سنجیده‌نشده با پاسخ غلط از ۰ بالاتر نمی‌رود', () => {
    const { zero, questionCard, question, wrongOption } = fixture();
    const before = zero.nodeStates[questionCard.nodeId]!.masteryScore;
    expect(before).toBe(0);

    const out = evaluateAnswerAndRipple({
      card: questionCard,
      selectedOption: wrongOption,
      grading: { wasCorrect: false, trapNote: '' },
      confidence: 'low',
      responseTimeMs: 30_000,
      nodeStates: zero.nodeStates,
      cards: zero.cards,
      stats: zero.stats,
      nodes: KNOWLEDGE_NODES,
      dependencies: NODE_DEPENDENCIES,
      questions: QUESTION_BANK,
      lessons: INTERACTIVE_LESSONS,
    });

    expect(out.report.wasCorrect).toBe(false);
    expect(out.nextNodeStates[questionCard.nodeId]!.masteryScore).toBeLessThanOrEqual(before);

    // موج هم نباید هیچ گرهٔ دیگری را از ۰ بالا ببرد
    for (const [nodeId, state] of Object.entries(out.nextNodeStates)) {
      const prior = zero.nodeStates[nodeId]?.masteryScore ?? 0;
      if (prior === 0) {
        expect(state.masteryScore, `گرهٔ ${nodeId} با موجِ خطا شایستگی ساخت`).toBeLessThanOrEqual(0);
      }
    }
  });

  it('بازگشت لغزش (slip rollback) نباید بالاتر از مقدار بازگردانده‌شده بنویسد', () => {
    const { zero, questionCard, question, wrongOption } = fixture();
    const out = evaluateAnswerAndRipple({
      card: questionCard,
      selectedOption: wrongOption,
      grading: { wasCorrect: false, trapNote: '' },
      confidence: 'low',
      responseTimeMs: 30_000,
      nodeStates: zero.nodeStates,
      cards: zero.cards,
      stats: zero.stats,
      nodes: KNOWLEDGE_NODES,
      dependencies: NODE_DEPENDENCIES,
      questions: QUESTION_BANK,
      lessons: INTERACTIVE_LESSONS,
    });

    const snapshotScore = out.snapshot.nodeStates[questionCard.nodeId]!.masteryScore;
    const rolled = rollbackSlipPenalty(out.snapshot, out.report);
    const after = rolled.restoredNodeStates[questionCard.nodeId]!.masteryScore;
    // «بازگشت» یعنی حذف تنبیه؛ نه ساختن شایستگی جدید
    expect(after).toBeLessThanOrEqual(snapshotScore);
    expect(after).toBeLessThanOrEqual(question ? snapshotScore : 0);
  });
});
