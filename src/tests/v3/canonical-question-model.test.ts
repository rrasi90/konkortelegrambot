/**
 * V3-040 — تست مدل canonical سؤال (مأموریت v5 §5.4)
 * cardinality، versioning، provenance، uniqueness، key isolation،
 * duplicate appearance، append-only کلید و تفکیک تأیید محتوا/کلید.
 */
import { describe, expect, it } from 'vitest';
import {
  computeAllowedUse,
  toCanonicalFromLegacy,
  validateQuestionRegistry,
  type CanonicalQuestionRegistry,
} from '@ael/contracts';

const now = '2026-11-11T00:00:00.000Z';

function validRegistry(): CanonicalQuestionRegistry {
  return {
    questions: [
      { id: 'q.1', primaryNodeId: 'n.1', origin: 'user_authored', rightsStatus: 'original_ael', trustLevel: 'user', createdAt: now },
      { id: 'q.2', primaryNodeId: 'n.1', origin: 'official_imported', rightsStatus: 'unknown', trustLevel: 'reported', createdAt: now },
    ],
    revisions: [
      { id: 'q.1#rev1', questionId: 'q.1', revisionNo: 1, prompt: 'پرسش یک', choices: ['الف', 'ب', 'ج', 'د'], kind: 'mcq', status: 'submitted', createdBy: 'user-9', createdAt: now },
      { id: 'q.1#rev2', questionId: 'q.1', revisionNo: 2, prompt: 'پرسش یک (ویرایش)', choices: ['الف', 'ب', 'ج', 'د'], kind: 'mcq', status: 'draft', createdBy: 'user-9', createdAt: now },
      { id: 'q.2#rev1', questionId: 'q.2', revisionNo: 1, prompt: 'پرسش رسمی', choices: ['الف', 'ب'], kind: 'mcq', status: 'published', createdBy: 'importer', createdAt: now },
    ],
    appearances: [
      { id: 'a.1', questionId: 'q.2', revisionId: 'q.2#rev1', examRef: { examYear: 1404, bookletCode: '1142' }, orderInBooklet: 12, sourceRef: { sourceId: 'src.booklet.1404', locator: 'دفترچه عمومی، سؤال ۱۲' } },
    ],
    keyRevisions: [
      { id: 'q.1#key1', questionId: 'q.1', revisionId: 'q.1#rev1', correctOption: 2, status: 'pending_review', supersedes: null, approvedBy: null, approvedAt: null, createdAt: now },
      { id: 'q.2#key1', questionId: 'q.2', revisionId: 'q.2#rev1', correctOption: 1, status: 'superseded', supersedes: null, approvedBy: 'sme-1', approvedAt: now, createdAt: now },
      { id: 'q.2#key2', questionId: 'q.2', revisionId: 'q.2#rev1', correctOption: 0, status: 'approved', supersedes: 'q.2#key1', approvedBy: 'sme-2', approvedAt: now, rationale: 'اصلاح پس از اعتراض', createdAt: now },
    ],
    reviews: [
      { id: 'r.1', revisionId: 'q.1#rev1', target: 'content', actor: 'mod-1', actorRole: 'moderator', decision: 'changes_requested', reason: 'صورت سؤال مبهم', at: now },
      { id: 'r.2', revisionId: 'q.2#rev1', target: 'key', actor: 'sme-2', actorRole: 'sme', decision: 'approved', at: now },
    ],
    disputes: [
      { id: 'd.1', questionId: 'q.2', revisionId: 'q.2#rev1', appearanceId: 'a.1', keyRevisionId: 'q.2#key1', raisedBy: 'user-7', evidence: 'متن درسنامهٔ AEL مبحث X', status: 'resolved_upheld', resolution: 'کلید اصلاح شد', createdAt: now, resolvedAt: now },
    ],
  };
}

describe('V3-040 canonical question model', () => {
  it('a fully valid registry passes (cardinality 1:N, cross-refs consistent)', () => {
    const result = validateQuestionRegistry(validRegistry());
    expect(result.errors).toEqual([]);
  });

  it('key is isolated from content: content approval and key approval are independent records', () => {
    const registry = validRegistry();
    const contentReview = registry.reviews!.find((r) => r.target === 'content')!;
    const keyReview = registry.reviews!.find((r) => r.target === 'key')!;
    expect(contentReview.revisionId).toBe('q.1#rev1');
    expect(keyReview.revisionId).toBe('q.2#rev1');
    // کلید q.1 هنوز pending است درحالی‌که محتوایش در جریان بازبینی است — مدل اجازه می‌دهد:
    expect(registry.keyRevisions[0].status).toBe('pending_review');
    expect(registry.revisions[0].status).toBe('submitted');
  });

  it('detects dangling references, duplicate ids and cross-question appearance', () => {
    const registry = validRegistry();
    registry.revisions.push({ ...registry.revisions[0], id: 'q.9#rev1', questionId: 'q.9' });
    expect(validateQuestionRegistry(registry).errors.some((e) => e.includes('dangling questionId'))).toBe(true);
    // id تکراری revision:
    const dupe = validRegistry();
    dupe.revisions.push({ ...dupe.revisions[0] });
    expect(validateQuestionRegistry(dupe).errors.some((e) => e.includes('تکراری'))).toBe(true);
    // appearance از سؤال دیگر:
    const cross = validRegistry();
    cross.appearances.push({ ...cross.appearances[0], id: 'a.3', questionId: 'q.1', revisionId: 'q.2#rev1' });
    expect(validateQuestionRegistry(cross).errors.some((e) => e.includes('cross-question appearance'))).toBe(true);
  });

  it('detects duplicate appearance for the same booklet/order', () => {
    const registry = validRegistry();
    registry.appearances.push({ ...registry.appearances[0], id: 'a.2' });
    const result = validateQuestionRegistry(registry);
    expect(result.errors.some((e) => e.includes('duplicate appearance'))).toBe(true);
  });

  it('append-only key: a new key revision must mark the old one superseded', () => {
    const registry = validRegistry();
    // key2 (approved) جایگزین نشده اما key3 ادعای جانشینی دارد → خطا:
    registry.keyRevisions.push({
      id: 'q.2#key3', questionId: 'q.2', revisionId: 'q.2#rev1', correctOption: 1,
      status: 'approved', supersedes: 'q.2#key2', approvedBy: 'sme-1', approvedAt: now, createdAt: now,
    });
    const result = validateQuestionRegistry(registry);
    expect(result.errors.some((e) => e.includes('append-only'))).toBe(true);
  });

  it('key out-of-range and essay-key violations are rejected', () => {
    const registry = validRegistry();
    registry.keyRevisions[0].correctOption = 7;
    expect(validateQuestionRegistry(registry).errors.some((e) => e.includes('خارج از محدوده'))).toBe(true);
    const essay = validRegistry();
    essay.revisions[0].kind = 'essay';
    essay.revisions[0].choices = [];
    essay.keyRevisions[0].correctOption = null;
    expect(validateQuestionRegistry(essay).errors).toEqual([]);
  });

  it('computeAllowedUse: user/pending stays practice+diagnostic only; disputed loses diagnostic; quarantined gets nothing', () => {
    expect(computeAllowedUse({ trustLevel: 'user', verification: 'pending_sme', hasApprovedKey: false, disputed: false }))
      .toEqual(['practice', 'diagnostic']);
    expect(computeAllowedUse({ trustLevel: 'official', verification: 'sme_approved', hasApprovedKey: true, disputed: false }))
      .toEqual(['practice', 'diagnostic', 'verification', 'proof', 'timed_exam']);
    expect(computeAllowedUse({ trustLevel: 'reported', verification: 'pending_sme', hasApprovedKey: true, disputed: true }))
      .toEqual(['practice']);
    expect(computeAllowedUse({ trustLevel: 'official', verification: 'quarantined', hasApprovedKey: true, disputed: false }))
      .toEqual([]);
    // بدون کلید تأییدشده، proof/timed ممکن نیست:
    expect(computeAllowedUse({ trustLevel: 'official', verification: 'sme_approved', hasApprovedKey: false, disputed: false }))
      .toEqual(['practice', 'diagnostic']);
  });

  it('legacy adapter maps flat banks without inventing official provenance', () => {
    const legacy = toCanonicalFromLegacy({
      id: 'yr.1404.q1', nodeId: 'n.5', text: 'متن', options: ['الف', 'ب', 'ج', 'د'],
      correctOption: 3, examYear: 1404, contentOrigin: 'official_booklet',
    });
    // official_booklet فقط reported می‌گیرد — هرگز official_verified:
    expect(legacy.question.trustLevel).toBe('reported');
    expect(legacy.question.rightsStatus).toBe('unknown');
    expect(legacy.key.status).toBe('pending_review');
    expect(legacy.key.rationale).toContain('pending_review');
    const synthetic = toCanonicalFromLegacy({
      id: 'x.1', nodeId: 'n.1', text: 't', options: ['الف', 'ب'], correctOption: undefined,
    });
    // unknown ≠ صفر: کلید نامعلوم null است:
    expect(synthetic.key.correctOption).toBeNull();
    expect(validateQuestionRegistry({
      questions: [legacy.question, synthetic.question],
      revisions: [legacy.revision, synthetic.revision],
      appearances: [],
      keyRevisions: [legacy.key, synthetic.key],
    }).errors).toEqual([]);
  });
});
