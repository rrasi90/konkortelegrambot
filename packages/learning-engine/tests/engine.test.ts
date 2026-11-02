import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENGINE_CONFIG,
  DEFAULT_MASTERY,
  addDays,
  applyAnswer,
  buildDailyQueue,
  masteryOf,
  questionCardId,
  statusFromMastery,
  trapCardId,
  type EngineState,
  type ReviewCard,
} from '@ael/engine';
import type { KnowledgeNode, NodeDependency, Question, TrackId } from '@ael/contracts';

/* ----------------------------- fixtures ------------------------------ */

const NOW = new Date('2026-10-29T08:00:00.000Z');

function node(id: string, track: KnowledgeNode['track'], topic: string): KnowledgeNode {
  return { id, track, course: 'درس', chapter: 'فصل', topic };
}

const nodes: KnowledgeNode[] = [
  node('sm.rbv', 'common', 'دیدگاه مبتنی بر منابع'),
  node('sm.value_chain', 'common', 'زنجیره ارزش پورتر'),
  node('mkt.brand_equity', 'business', 'دارایی‌های برند'),
  node('tech.absorptive', 'technology', 'ظرفیت جذب'),
  node('stats.anova', 'common', 'تحلیل واریانس دوطرفه'),
  node('stats.scales', 'common', 'مقیاس‌های اندازه‌گیری'),
];

const dependencies: NodeDependency[] = [
  { source: 'sm.rbv', target: 'sm.value_chain', relation: 'prerequisite', weight: 0.4 },
  { source: 'mkt.brand_equity', target: 'sm.rbv', relation: 'prerequisite', weight: 0.6 },
  { source: 'sm.rbv', target: 'mkt.brand_equity', relation: 'cross_course', weight: 0.5 },
  { source: 'sm.rbv', target: 'tech.absorptive', relation: 'cross_course', weight: 0.5 },
  { source: 'stats.anova', target: 'stats.scales', relation: 'prerequisite', weight: 0.5 },
];

const questions: Question[] = [
  {
    id: 'q-rbv-1',
    nodeId: 'sm.rbv',
    text: 'کدام گزینه VRIN را کامل توصیف می‌کند؟',
    options: ['ارزش‌مندی، کمیابی، تقلیدناپذیری، جایگزینی‌ناپذیری', 'کیفیت، قیمت، توزیع، تبلیغ'],
    correctOption: 0,
    explanation: 'مدل بارنی.',
    trapNote: 'دام رایج: خلط VRIN با VRIO.',
    expectedTimeMs: 60_000,
  },
  {
    id: 'q-rbv-2',
    nodeId: 'sm.rbv',
    text: 'قابلیت‌های پویا در چه چیزی تعریف می‌شوند؟',
    options: ['بازآرایی منابع برای محیط متغیر', 'ثابت‌ماندن فرایندها'],
    correctOption: 0,
  },
  {
    id: 'q-brand-1',
    nodeId: 'mkt.brand_equity',
    text: 'دارایی برند از دید آکر کدام است؟',
    options: ['آگاهی، تداعی، ادراک کیفیت، وفاداری', 'فقط قیمت'],
    correctOption: 0,
  },
  {
    id: 'q-anova-1',
    nodeId: 'stats.anova',
    text: 'در ANOVA دوطرفه، کدام مفروض بررسی می‌شود؟',
    options: ['همسانی واریانس‌ها', 'نرمال‌بودن رتبه‌ها'],
    correctOption: 0,
  },
];

/** مهارت خرد متصل به گرهٔ sm.rbv (برای تشخیص و کارت مقایسه) */
const smRbvSkill = {
  id: 'skill.sm.rbv.vrio',
  nodeId: 'sm.rbv',
  confusableWith: ['skill.sm.dynamic.reconfiguration'],
  prerequisites: [],
  estimatedMinutes: 10,
};

function buildState(overrides: Partial<EngineState> = {}): EngineState {
  return {
    config: { ...DEFAULT_ENGINE_CONFIG },
    nodes: new Map(nodes.map((n) => [n.id, n])),
    dependencies,
    questions: new Map(questions.map((q) => [q.id, q])),
    mastery: new Map(),
    cards: [],
    ...overrides,
  };
}

function card(id: string, nodeId: string, opts: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id,
    userId: 'user-1',
    nodeId,
    cardType: 'question',
    questionId: id.startsWith('trap') ? undefined : id.replace(/^card:/, ''),
    dueAt: addDays(NOW, 20).toISOString(),
    intervalDays: 20,
    ease: 2.5,
    isRepair: false,
    timesSeen: 1,
    timesCorrect: 1,
    ...opts,
  };
}

const user = { userId: 'user-1', activeTracks: ['common', 'technology'] as TrackId[] };

/* ------------------------------ tests -------------------------------- */

describe('mastery formulas (فرمول‌های تسلط)', () => {
  it('پاسخ درست: M_new = M_old + (100 - M_old) × 0.15', () => {
    const state = buildState({ mastery: new Map([['sm.rbv', 50]]) });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a1', selectedOption: 0, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common', 'business'] },
    );
    expect(res.report.topicMastery.before).toBe(50);
    expect(res.report.topicMastery.after).toBe(57.5);
  });

  it('پاسخ غلط: M_new = M_old × 0.75', () => {
    const state = buildState({ mastery: new Map([['sm.rbv', 80]]) });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a2', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(res.report.topicMastery.after).toBe(60);
  });

  it('گرهٔ تازه با تسلط پیش‌فرض ۵۰ شروع می‌شود', () => {
    const state = buildState();
    expect(masteryOf(state, 'sm.rbv')).toBe(DEFAULT_MASTERY);
  });

  it('نقشهٔ وضعیت از عدد تسلط ساخته می‌شود', () => {
    expect(statusFromMastery(30)).toBe('weak');
    expect(statusFromMastery(50)).toBe('unstable');
    expect(statusFromMastery(70)).toBe('learning');
    expect(statusFromMastery(90)).toBe('mastered');
  });
});

describe('layer 1 — direct reset & trap card', () => {
  it('کارت غلط به ۱ روز بازمی‌گردد و سهولت آن ۰٫۲ کم می‌شود', () => {
    const existing: ReviewCard = {
      ...card(questionCardId('user-1', 'q-rbv-1'), 'sm.rbv'),
      intervalDays: 15,
      ease: 2.5,
      timesSeen: 3,
    };
    const state = buildState({ cards: [existing] });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a3', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    const updated = res.cardUpdates.find((c) => c.id === existing.id);
    expect(updated?.intervalDays).toBe(1);
    expect(updated?.ease).toBeCloseTo(2.3);
    expect(new Date(updated?.dueAt ?? '').getTime()).toBe(addDays(NOW, 1).getTime());
    expect(res.report.directReset).toBe(true);
  });

  it('سهولت هرگز زیر ۱٫۳ نمی‌رود', () => {
    const existing: ReviewCard = {
      ...card(questionCardId('user-1', 'q-rbv-1'), 'sm.rbv'),
      intervalDays: 15,
      ease: 1.35,
    };
    const state = buildState({ cards: [existing] });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a4', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    const updated = res.cardUpdates.find((c) => c.id === existing.id);
    expect(updated?.ease).toBe(1.3);
  });

  it('کارت دام تستی فقط یک بار ساخته می‌شود (بدون تکرار)', () => {
    const state = buildState();
    const r1 = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a5', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    const r2 = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a6', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(r1.report.trapCardCreated).toBe(true);
    expect(r2.report.trapCardCreated).toBe(false);
    const traps = state.cards.filter((c) => c.id === trapCardId('user-1', 'q-rbv-1'));
    expect(traps.length).toBe(1);
  });

  it('پاسخ درست با FSRS فاصلهٔ مرور می‌سازد (کارت تازه: Good → ۳ روز)', () => {
    const existing: ReviewCard = {
      ...card(questionCardId('user-1', 'q-rbv-1'), 'sm.rbv'),
      intervalDays: 10,
      ease: 2.0,
    };
    const state = buildState({ cards: [existing] });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a7', selectedOption: 0, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    const updated = res.cardUpdates.find((c) => c.id === existing.id);
    // FSRS: بدون وضعیت قبلی، Good → stability ۳٫۲.
    // طبق تعریف FSRS، در نرخ بازیابی هدف ۹۰٪ فاصله برابر خودِ stability است، پس ≈ ۳ روز.
    expect(updated?.intervalDays).toBe(3);
    expect(updated?.ease).toBeCloseTo(2.05);
    expect(new Date(updated?.dueAt ?? '').getTime()).toBe(addDays(NOW, 3).getTime());
    expect(updated?.fsrs?.stability).toBeCloseTo(3.2);
    expect(new Date(updated?.fsrs?.dueAt ?? '').getTime()).toBe(addDays(NOW, 3).getTime());
  });
});

describe('layer 2 — sibling shock', () => {
  it('با سقوط تسلط زیر ۶۰، فاصلهٔ کارت‌های هم‌خانوادهٔ سررسیددار نصف می‌شود', () => {
    const failed = card(questionCardId('user-1', 'q-rbv-1'), 'sm.rbv', { intervalDays: 5 });
    const sib1 = card(questionCardId('user-1', 'q-rbv-2'), 'sm.rbv', { intervalDays: 20 });
    const sib2 = card('user-1:question:q-other', 'sm.rbv', { intervalDays: 9 });
    const state = buildState({ cards: [failed, sib1, sib2] });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a8', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    const s1 = state.cards.find((c) => c.id === sib1.id);
    const s2 = state.cards.find((c) => c.id === sib2.id);
    expect(s1?.intervalDays).toBe(10);
    expect(s2?.intervalDays).toBe(4);
    expect(s1?.isRepair).toBe(true);
    expect(s1?.previousIntervalDays).toBe(20);
    expect(res.report.siblingShock?.applied).toBe(2);
  });

  it('کارت خودِ سؤالِ غلط دوباره نصف نمی‌شود و کارت سررسیدشده جلو نمی‌افتد', () => {
    const failed = card(questionCardId('user-1', 'q-rbv-1'), 'sm.rbv', { intervalDays: 5 });
    const dueSibling = card(questionCardId('user-1', 'q-rbv-2'), 'sm.rbv', {
      intervalDays: 7,
      dueAt: addDays(NOW, -1).toISOString(),
    });
    const state = buildState({ cards: [failed, dueSibling] });
    applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a9', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    const dueCard = state.cards.find((c) => c.id === dueSibling.id);
    expect(dueCard?.intervalDays).toBe(7);
  });

  it('اگر تسلط بالای آستانه بماند، شوک فعال نمی‌شود', () => {
    const failed = card(questionCardId('user-1', 'q-rbv-1'), 'sm.rbv', { intervalDays: 5 });
    const sib = card(questionCardId('user-1', 'q-rbv-2'), 'sm.rbv', { intervalDays: 20 });
    const state = buildState({
      cards: [failed, sib],
      mastery: new Map([['sm.rbv', 85]]),
    });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a10', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(res.report.topicMastery.after).toBe(63.8);
    expect(res.report.siblingShock).toBeNull();
    const s1 = state.cards.find((c) => c.id === sib.id);
    expect(s1?.intervalDays).toBe(20);
  });

  it('تعداد کارت‌های جلوافتاده به ظرفیت موج محدود می‌ماند', () => {
    const failed = card(questionCardId('user-1', 'q-rbv-1'), 'sm.rbv');
    const siblings = Array.from({ length: 10 }, (_, i) =>
      card(questionCardId('user-1', `q-${i}`), 'sm.rbv', { intervalDays: 20 + i }),
    );
    const state = buildState({ cards: [failed, ...siblings] });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a11', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(res.report.siblingShock?.applied).toBeLessThanOrEqual(
      DEFAULT_ENGINE_CONFIG.rippleCapacity,
    );
    expect(res.report.siblingShock?.deferred).toBeGreaterThan(0);
  });

  it('پاسخ درستِ کارت ترمیمی، فاصلهٔ اصلی را بازمی‌گرداند (تأیید ترمیم)', () => {
    const repaired: ReviewCard = {
      ...card(questionCardId('user-1', 'q-rbv-2'), 'sm.rbv'),
      intervalDays: 10,
      previousIntervalDays: 20,
      isRepair: true,
    };
    const state = buildState({ cards: [repaired] });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-2', attemptId: 'a12', selectedOption: 0, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    const updated = res.cardUpdates.find((c) => c.id === repaired.id);
    expect(updated?.intervalDays).toBe(20);
    expect(updated?.isRepair).toBe(false);
  });
});

describe('layers 3 & 4 — diagnostic probes (به‌جای کسر فوری)', () => {
  it('خطا در مبحث پیشرفته، پیش‌نیاز را بدون کسر عددی به بررسی تشخیصی می‌فرستد', () => {
    const state = buildState({
      mastery: new Map([
        ['stats.anova', 80],
        ['stats.scales', 90],
      ]),
    });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-anova-1', attemptId: 'a13', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(res.report.prerequisiteRepairs.length).toBe(1);
    expect(res.report.prerequisiteRepairs[0]?.nodeId).toBe('stats.scales');
    // بدون کسر فوری: from = to — فقط شاهد اولیه است
    expect(res.report.prerequisiteRepairs[0]?.from).toBe(90);
    expect(res.report.prerequisiteRepairs[0]?.to).toBe(90);
    expect(res.report.probeTargets).toContain('stats.scales');
    expect(state.mastery.get('stats.scales')).toBe(90);
  });

  it('پل بین‌درسی فقط برای گرایش‌های فعال کاربر پیشنهاد تشخیصی می‌شود', () => {
    const state = buildState();
    // کاربر تکنولوژی است؛ نباید به مبحث بازرگانی (brand_equity) سرایت کند
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a14', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common', 'technology'] },
    );
    const deltaNodes = res.report.masteryDeltas.map((d) => d.nodeId);
    expect(deltaNodes).not.toContain('tech.absorptive'); // دیگر کسر عددی وجود ندارد
    expect(deltaNodes).not.toContain('mkt.brand_equity');
    expect(res.report.probeTargets).toContain('tech.absorptive');
    expect(res.report.probeTargets).not.toContain('mkt.brand_equity');
    expect(res.masteryUpdates.map((m) => m.nodeId)).toEqual(['sm.rbv']);
  });

  it('پاسخ درست هیچ موجی ایجاد نمی‌کند', () => {
    const state = buildState({ mastery: new Map([['sm.rbv', 70]]) });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a15', selectedOption: 0, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common', 'business'] },
    );
    expect(res.report.masteryDeltas.length).toBe(1);
    expect(res.report.siblingShock).toBeNull();
    expect(res.report.prerequisiteRepairs.length).toBe(0);
  });
});

describe('daily queue', () => {
  it('فقط کارت‌های سررسیدشده و در محدودهٔ گرایش کاربر برمی‌گردد', () => {
    const due = card(questionCardId('user-1', 'q-rbv-1'), 'sm.rbv', {
      dueAt: addDays(NOW, -2).toISOString(),
    });
    const future = card(questionCardId('user-1', 'q-rbv-2'), 'sm.rbv');
    const business = card(questionCardId('user-1', 'q-brand-1'), 'mkt.brand_equity', {
      dueAt: addDays(NOW, -2).toISOString(),
    });
    const state = buildState({ cards: [due, future, business] });
    const queue = buildDailyQueue(state, user, { limit: 10, now: NOW });
    expect(queue.length).toBe(1);
    expect(queue[0]?.card.id).toBe(due.id);
  });

  it('فیلتر واجدشرایط و اولویت قبل از محدودیت تعداد اعمال می‌شوند', () => {
    const earlierButLowerPriority = card('card:earlier-low', 'sm.rbv', {
      dueAt: addDays(NOW, -5).toISOString(),
    });
    const laterButHigherPriority = card('card:later-high', 'sm.value_chain', {
      dueAt: addDays(NOW, -1).toISOString(),
    });
    const commuteExcluded = card('card:commute-excluded', 'stats.anova', {
      dueAt: addDays(NOW, -6).toISOString(),
    });
    const state = buildState({
      cards: [earlierButLowerPriority, laterButHigherPriority, commuteExcluded],
    });
    const scores = new Map([
      [earlierButLowerPriority.id, 1],
      [laterButHigherPriority.id, 10],
      [commuteExcluded.id, 100],
    ]);
    const scoredCardIds: string[] = [];

    const queue = buildDailyQueue(state, user, {
      limit: 1,
      now: NOW,
      includeCard: (candidate) => !candidate.nodeId.startsWith('stats.'),
      priorityScore: (candidate) => {
        scoredCardIds.push(candidate.id);
        return scores.get(candidate.id) ?? 0;
      },
    });

    expect(scoredCardIds).toEqual([earlierButLowerPriority.id, laterButHigherPriority.id]);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.card.id).toBe(laterButHigherPriority.id);
  });

  it('در امتیازهای مساوی، موعد قدیمی‌تر tie-breaker باقی می‌ماند', () => {
    const earlier = card('card:tie-earlier', 'sm.rbv', {
      dueAt: addDays(NOW, -4).toISOString(),
    });
    const later = card('card:tie-later', 'sm.value_chain', {
      dueAt: addDays(NOW, -2).toISOString(),
    });
    const state = buildState({ cards: [later, earlier] });
    const queue = buildDailyQueue(state, user, {
      limit: 2,
      now: NOW,
      priorityScore: () => 5,
    });

    expect(queue.map((item) => item.card.id)).toEqual([earlier.id, later.id]);
  });
});

describe('mentor message', () => {
  it('پیام فارسی برای پاسخ غلط با تمام لایه‌ها ساخته می‌شود', () => {
    const sibling = card(questionCardId('user-1', 'q-rbv-2'), 'sm.rbv', { intervalDays: 20 });
    const state = buildState({
      mastery: new Map([['sm.rbv', 75]]),
      cards: [sibling],
    });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a16', selectedOption: 1, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common', 'business'] },
    );
    const msg = res.report.mentorMessage;
    expect(msg).toContain('شاهد اولیه');
    expect(msg).toContain('هم‌خانواده');
  });

  it('پیام پاسخ درست مثبت است', () => {
    const state = buildState({ mastery: new Map([['sm.rbv', 90]]) });
    const res = applyAnswer(
      state,
      { userId: 'user-1', questionId: 'q-rbv-1', attemptId: 'a17', selectedOption: 0, answeredAt: NOW.toISOString() },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(res.report.mentorMessage).toContain('آفرین');
  });
});

describe('input validation', () => {
  it('سؤال ناشناخته خطا می‌دهد', () => {
    const state = buildState();
    expect(() =>
      applyAnswer(
        state,
        { userId: 'u', questionId: 'nope', attemptId: 'x', selectedOption: 0 },
        { userId: 'u', activeTracks: ['common'] },
      ),
    ).toThrow();
  });

  it('گزینهٔ خارج از محدوده خطا می‌دهد', () => {
    const state = buildState();
    expect(() =>
      applyAnswer(
        state,
        { userId: 'u', questionId: 'q-rbv-1', attemptId: 'x', selectedOption: 9 },
        { userId: 'u', activeTracks: ['common'] },
      ),
    ).toThrow();
  });
});

describe('time-decayed recall evidence', () => {
  it('طبقه‌بندی فراموشی از بازیابیِ محاسبه‌شده با زمان استفاده می‌کند، نه R ذخیره‌شدهٔ قدیمی', () => {
    const lastReviewedAt = new Date(NOW.getTime() - 10 * 86_400_000).toISOString();
    const previous = card(questionCardId('user-1', 'q-rbv-1'), 'sm.rbv', {
      fsrs: {
        stability: 1.5,
        difficulty: 5,
        retrievability: 1,
        reps: 4,
        lapses: 0,
        lastReviewedAt,
        dueAt: NOW.toISOString(),
        intervalDays: 1,
      },
    });
    const state = buildState({
      mastery: new Map([['sm.rbv', 80]]),
      cards: [previous],
      skills: new Map([[smRbvSkill.id, smRbvSkill]]),
    });

    const result = applyAnswer(
      state,
      {
        userId: 'user-1',
        questionId: 'q-rbv-1',
        attemptId: 'time-decayed-recall-1',
        selectedOption: 1,
        answeredAt: NOW.toISOString(),
      },
      { userId: 'user-1', activeTracks: ['common'] },
    );

    expect(result.report.errorType).toBe('recall_failure');
  });
});

describe('slip suppression (سرکوب موج در لغزش)', () => {
  it('خوداظهاری «بی‌دقتی کردم»: بدون کسر تسلط، بدون شوک و بدون probe', () => {
    const sibling = card(questionCardId('user-1', 'q-rbv-2'), 'sm.rbv', { intervalDays: 20 });
    const state = buildState({
      mastery: new Map([['sm.rbv', 80]]),
      cards: [sibling],
    });
    const res = applyAnswer(
      state,
      {
        userId: 'user-1',
        questionId: 'q-rbv-1',
        attemptId: 'a18',
        selectedOption: 1,
        selfReport: 'slip',
        answeredAt: NOW.toISOString(),
      },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(res.report.errorType).toBe('slip');
    expect(res.report.topicMastery.after).toBe(80); // بدون کسر
    expect(res.report.siblingShock).toBeNull();
    expect(res.report.probeTargets).toEqual([]);
    expect(res.masteryUpdates).toEqual([]);
    expect(state.cards.find((c) => c.id === sibling.id)?.intervalDays).toBe(20);
    expect(res.report.mentorMessage).toContain('عجله');
  });

  it('لغزشِ خودکار: پاسخ بسیار سریع روی مبحث مسلط بدون خوداظهاری تشخیص داده می‌شود', () => {
    const state = buildState({ mastery: new Map([['sm.rbv', 80]]) });
    const res = applyAnswer(
      state,
      {
        userId: 'user-1',
        questionId: 'q-rbv-1',
        attemptId: 'a19',
        selectedOption: 1,
        responseTimeMs: 2_000, // کمتر از نصف ۶۰ ثانیهٔ موردانتظار
        answeredAt: NOW.toISOString(),
      },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(res.report.errorType).toBe('slip');
    expect(res.report.topicMastery.after).toBe(80);
    expect(res.report.siblingShock).toBeNull();
  });
});

describe('comparison card (کارت مقایسهٔ مفاهیم متشابه)', () => {
  it('پاسخ غلطِ مفهومی روی مهارت دارای confusable_with کارت مقایسه می‌سازد (بدون تکرار)', () => {
    const state = buildState({
      skills: new Map([[smRbvSkill.id, smRbvSkill]]),
    });
    const r1 = applyAnswer(
      state,
      {
        userId: 'user-1',
        questionId: 'q-rbv-1',
        attemptId: 'a20',
        selectedOption: 1,
        selfReport: 'didnt_know',
        answeredAt: NOW.toISOString(),
      },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    const cmp = r1.createdCards.find((c) => c.cardType === 'comparison_card');
    expect(cmp).toBeDefined();
    expect(cmp?.comparisonSkills).toEqual(['skill.sm.rbv.vrio', 'skill.sm.dynamic.reconfiguration']);
    expect(r1.report.actions.some((a) => a.kind === 'create_comparison_card')).toBe(true);
    expect(r1.report.errorType).toBe('concept_gap');

    const r2 = applyAnswer(
      state,
      {
        userId: 'user-1',
        questionId: 'q-rbv-1',
        attemptId: 'a21',
        selectedOption: 1,
        selfReport: 'didnt_know',
        answeredAt: NOW.toISOString(),
      },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(r2.createdCards.some((c) => c.cardType === 'comparison_card')).toBe(false);
  });
});

describe('6D learner state & holdout proof (مدل ۶ بعدی و اثبات)', () => {
  const prior6D = {
    skillId: smRbvSkill.id,
    proficiencyProbability: 0.8,
    confidence: 0.5,
    evidenceCount: 1,
    memoryRetrievability: 1,
    fluencySpeedRatio: 1,
    dominantErrorType: 'unknown' as const,
    coverageStatus: 'diagnosed' as const,
  };

  it('آمادگی اثبات: احتمال تسلط ≥ ۰٫۷۵ با شواهد ناکافی → needs_proof + کاندیدای اثبات', () => {
    const state = buildState({
      skills: new Map([[smRbvSkill.id, smRbvSkill]]),
      skillStates: new Map([[smRbvSkill.id, prior6D]]),
    });
    const res = applyAnswer(
      state,
      {
        userId: 'user-1',
        questionId: 'q-rbv-1',
        attemptId: 'a22',
        selectedOption: 0,
        answeredAt: NOW.toISOString(),
      },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(res.skillStateUpdate).toBeDefined();
    expect(res.skillStateUpdate?.state.skillId).toBe('skill.sm.rbv.vrio');
    expect(res.skillStateUpdate?.state.proficiencyProbability).toBeGreaterThanOrEqual(0.75);
    expect(res.skillStateUpdate?.state.coverageStatus).toBe('needs_proof');
    expect(res.report.proofCandidate).toEqual({ nodeId: 'sm.rbv', skillId: 'skill.sm.rbv.vrio' });
  });

  it('تلاشِ اثباتِ درست روی کارت Holdout → وضعیت proven', () => {
    const state = buildState({
      skills: new Map([[smRbvSkill.id, smRbvSkill]]),
      skillStates: new Map([[smRbvSkill.id, prior6D]]),
    });
    const res = applyAnswer(
      state,
      {
        userId: 'user-1',
        questionId: 'q-rbv-1',
        attemptId: 'a23',
        selectedOption: 0,
        attemptType: 'proof',
        answeredAt: NOW.toISOString(),
      },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(res.skillStateUpdate?.state.coverageStatus).toBe('proven');
    expect(res.report.proofCandidate).toBeNull();
  });

  it('تلاش اثباتِ غلط، مهارت را proven نمی‌کند', () => {
    const state = buildState({
      skills: new Map([[smRbvSkill.id, smRbvSkill]]),
      skillStates: new Map([[smRbvSkill.id, prior6D]]),
    });
    const res = applyAnswer(
      state,
      {
        userId: 'user-1',
        questionId: 'q-rbv-1',
        attemptId: 'a24',
        selectedOption: 1,
        attemptType: 'proof',
        answeredAt: NOW.toISOString(),
      },
      { userId: 'user-1', activeTracks: ['common'] },
    );
    expect(res.skillStateUpdate?.state.coverageStatus).not.toBe('proven');
    expect(res.skillStateUpdate?.state.coverageStatus).not.toBe('needs_proof');
  });
});
