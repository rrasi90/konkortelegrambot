/**
 * V3-041..044 — تست lifecycle، role guards، dispute و اصلاح کلید (مأموریت v5 §8)
 */
import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  affectedAttemptRefs,
  DisputeError,
  isEligibleForUse,
  LifecycleError,
  openDispute,
  resolveDispute,
  type AnswerKeyRevision,
  type QuestionDispute,
} from '@ael/contracts';

const now = '2026-11-11T00:00:00.000Z';

const keyRevisions: AnswerKeyRevision[] = [
  { id: 'k.1', questionId: 'q.1', revisionId: 'q.1#rev1', correctOption: 1, status: 'approved', supersedes: null, approvedBy: 'sme-1', approvedAt: now, createdAt: now },
];

const dispute: QuestionDispute = {
  id: 'd.1', questionId: 'q.1', revisionId: 'q.1#rev1', appearanceId: null, keyRevisionId: 'k.1',
  raisedBy: 'user-7', evidence: 'متن درسنامهٔ AEL مبحث X نقطهٔ سر‌به‌سر را متفاوت تعریف می‌کند', status: 'open', createdAt: now,
};

describe('V3-041/042 lifecycle state machine', () => {
  it('happy path: draft → submitted → in_review → approved → published', () => {
    expect(assertTransition({ currentStatus: 'draft', to: 'submitted', actorId: 'u.1', actorRole: 'author', revisionCreatedBy: 'u.1' })).toBe('submitted');
    expect(assertTransition({ currentStatus: 'submitted', to: 'in_review', actorId: 'm.1', actorRole: 'moderator', revisionCreatedBy: 'u.1' })).toBe('in_review');
    expect(assertTransition({ currentStatus: 'in_review', to: 'approved', actorId: 's.1', actorRole: 'sme', revisionCreatedBy: 'u.1' })).toBe('approved');
    expect(assertTransition({ currentStatus: 'approved', to: 'published', actorId: 'm.1', actorRole: 'moderator', revisionCreatedBy: 'u.1' })).toBe('published');
  });

  it('author cannot be final reviewer of own content (dual-approval policy)', () => {
    expect(() => assertTransition({ currentStatus: 'in_review', to: 'approved', actorId: 'u.1', actorRole: 'author', revisionCreatedBy: 'u.1' }))
      .toThrow(LifecycleError);
    // نویسنده با نقش SME هم نمی‌تواند محتوای خودش را نهایی کند (dual-approval):
    expect(() => assertTransition({ currentStatus: 'in_review', to: 'approved', actorId: 'u.1', actorRole: 'sme', revisionCreatedBy: 'u.1' }))
      .toThrow(/تأیید دوگانه/);
  });

  it('unauthorized roles and undefined transitions are rejected', () => {
    expect(() => assertTransition({ currentStatus: 'submitted', to: 'in_review', actorId: 'u.1', actorRole: 'author', revisionCreatedBy: 'u.1' }))
      .toThrow(/مجاز/);
    expect(() => assertTransition({ currentStatus: 'draft', to: 'published', actorId: 'm.1', actorRole: 'moderator', revisionCreatedBy: 'u.1' }))
      .toThrow(LifecycleError);
  });

  it('reason-required transitions (reject/suspend) fail without a real reason', () => {
    expect(() => assertTransition({ currentStatus: 'in_review', to: 'rejected', actorId: 's.1', actorRole: 'sme', revisionCreatedBy: 'u.1' }))
      .toThrow(/دلیل/);
    expect(assertTransition({ currentStatus: 'in_review', to: 'rejected', actorId: 's.1', actorRole: 'sme', revisionCreatedBy: 'u.1', reason: 'گزینهٔ ۲ با تشریح ناسازگار است' }))
      .toBe('rejected');
  });
});

describe('V3-043 engine eligibility', () => {
  it('unpublished revision never enters the engine', () => {
    const r = isEligibleForUse({ revisionStatus: 'approved', trustLevel: 'official', verification: 'sme_approved', keyRevisions, disputes: [], requestedUse: 'practice' });
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain('published');
  });

  it('user-authored pending key: practice OK, proof/timed rejected', () => {
    const base = { revisionStatus: 'published' as const, trustLevel: 'user' as const, verification: 'pending_sme' as const, keyRevisions, disputes: [] };
    expect(isEligibleForUse({ ...base, requestedUse: 'practice' }).eligible).toBe(true);
    expect(isEligibleForUse({ ...base, requestedUse: 'timed_exam' }).eligible).toBe(false);
  });

  it('open dispute quarantines timed_exam but keeps review/practice', () => {
    const base = { revisionStatus: 'published' as const, trustLevel: 'official' as const, verification: 'sme_approved' as const, keyRevisions, disputes: [dispute] };
    expect(isEligibleForUse({ ...base, requestedUse: 'timed_exam' }).eligible).toBe(false);
    expect(isEligibleForUse({ ...base, requestedUse: 'practice' }).eligible).toBe(true);
  });
});

describe('V3-044 dispute and key revision', () => {
  it('dispute requires real evidence; resolution requires SME/admin', () => {
    expect(() => openDispute({ dispute: { ...dispute, evidence: 'کوتاه' } })).toThrow(DisputeError);
    expect(openDispute({ dispute }).status).toBe('open');
    expect(() => resolveDispute({ dispute, keyRevisions, upheld: true, newKey: { correctOption: 0, rationale: 'x', approvedBy: 's.1', approvedAt: now }, resolverRole: 'author' }))
      .toThrow(/SME\/admin/);
  });

  it('upheld dispute creates append-only key fix and preserves history', () => {
    const { dispute: resolved, newKeyRevisions } = resolveDispute({
      dispute, keyRevisions,
      upheld: true,
      newKey: { correctOption: 0, rationale: 'مطابق درسنامهٔ AEL، تعریف درست گزینهٔ ۱ است', approvedBy: 'sme-2', approvedAt: now },
      resolverRole: 'sme',
    });
    expect(resolved.status).toBe('resolved_upheld');
    const fixed = newKeyRevisions.find((k) => k.id === 'k.1.fix2')!;
    expect(fixed.supersedes).toBe('k.1');
    expect(fixed.rationale).toContain('d.1');
    expect(newKeyRevisions.find((k) => k.id === 'k.1')!.status).toBe('superseded');
    // نسخهٔ قبلی هنوز در تاریخچه است (overwrite خاموش نشد):
    expect(newKeyRevisions.length).toBe(2);
  });

  it('rejected dispute preserves key and records resolution', () => {
    const { dispute: resolved, newKeyRevisions } = resolveDispute({
      dispute, keyRevisions, upheld: false, resolverRole: 'sme',
    });
    expect(resolved.status).toBe('resolved_rejected');
    expect(newKeyRevisions).toEqual(keyRevisions);
  });

  it('affected attempt refs: only changed verdicts are reported (no key exposure)', () => {
    const attempts = [
      { attemptId: 'a.1', userId: 'u.1', questionId: 'q.1', selectedOption: 1 },
      { attemptId: 'a.2', userId: 'u.2', questionId: 'q.1', selectedOption: 0 },
      { attemptId: 'a.3', userId: 'u.3', questionId: 'q.other', selectedOption: 1 },
    ];
    const oldKey = keyRevisions[0];
    const newKey = { ...oldKey, correctOption: 0 };
    const affected = affectedAttemptRefs({ attemptsByQuestion: attempts, oldKey, newKey });
    expect(affected).toEqual([
      { userId: 'u.1', attemptId: 'a.1', wasCountedCorrect: true, nowCountedCorrect: false },
      { userId: 'u.2', attemptId: 'a.2', wasCountedCorrect: false, nowCountedCorrect: true },
    ]);
  });
});
