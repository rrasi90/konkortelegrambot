/**
 * V3-030..033 — تست پروفایل تحصیلی، چند هدف و eligibility (مأموریت v5 §7)
 */
import { describe, expect, it } from 'vitest';
import {
  assessEligibility,
  currentEducation,
  proposeLegacyMigration,
  unionTargetSubjects,
  validateEducationRecords,
  type CandidateEducationRecord,
  type ExamTargetIntent,
} from '@ael/contracts';

const now = '2026-11-11T00:00:00.000Z';

function edu(partial: Partial<CandidateEducationRecord>): CandidateEducationRecord {
  return {
    id: 'edu.1', userId: 'user-1', level: 'bachelor', fieldOfStudy: null, institution: null,
    status: 'completed', startYear: 1399, endYear: 1403, provenance: 'self_reported',
    deletedAt: null, createdAt: now, updatedAt: now, ...partial,
  };
}

function intent(partial: Partial<ExamTargetIntent>): ExamTargetIntent {
  return {
    id: 'intent.1', userId: 'user-1', intentKind: 'study_plan', targetLevel: 'master',
    familyId: null, setCode: null, createdAt: now, ...partial,
  };
}

describe('V3-030 education history', () => {
  it('multi-record profiles validate; duplicates and inconsistent years fail', () => {
    const records = [
      edu({ id: 'edu.1', level: 'bachelor', status: 'completed', startYear: 1399, endYear: 1403 }),
      edu({ id: 'edu.2', level: 'diploma', status: 'completed', startYear: 1395, endYear: 1399 }),
    ];
    expect(validateEducationRecords(records)).toEqual([]);
    const bad = [
      edu({ id: 'same' }), edu({ id: 'same' }),
      edu({ id: 'edu.3', startYear: 1400, endYear: 1390 }),
    ];
    const errors = validateEducationRecords(bad);
    expect(errors.some((e) => e.includes('تکراری'))).toBe(true);
    expect(errors.some((e) => e.includes('قبل از شروع'))).toBe(true);
  });

  it('current education: in-progress wins over completed; latest completed otherwise', () => {
    const records = [
      edu({ id: 'edu.b', level: 'bachelor', status: 'completed', endYear: 1403 }),
      edu({ id: 'edu.a', level: 'master', status: 'in_progress', endYear: null }),
    ];
    expect(currentEducation(records)?.id).toBe('edu.a');
    expect(currentEducation([records[0]])?.id).toBe('edu.b');
    expect(currentEducation([])).toBeNull();
    // حذف‌شدهٔ نرم دیگر «فعال» نیست:
    expect(currentEducation([records[0], { ...records[1], deletedAt: now }])?.id).toBe('edu.b');
  });
});

describe('V3-032 multi-target eligibility', () => {
  it('no education data -> needs_review (never a fabricated verdict)', () => {
    const result = assessEligibility({ intent: intent({}), education: [], availableFamilyIds: [] });
    expect(result.status).toBe('needs_review');
    expect(result.reasons[0]).toContain('هیچ سابقه');
  });

  it('missing family in complete catalog -> unknown (not ineligible)', () => {
    const result = assessEligibility({
      intent: intent({ familyId: 'fam.konkur.math' }),
      education: [edu({})],
      availableFamilyIds: ['fam.management.1142'],
    });
    expect(result.status).toBe('unknown');
    expect(result.reasons[0]).toContain('نامعلوم');
  });

  it('bachelor holder targeting master verifies under rules v1', () => {
    const result = assessEligibility({
      intent: intent({ targetLevel: 'master', familyId: 'fam.management.1142' }),
      education: [edu({ level: 'bachelor', status: 'completed' })],
      availableFamilyIds: ['fam.management.1142'],
    });
    expect(result.status).toBe('verified');
    expect(result.ruleVersion).toBe('eligibility-rules-v1');
  });

  it('diploma holder targeting phd -> needs_review with reason (not silent pass)', () => {
    const result = assessEligibility({
      intent: intent({ targetLevel: 'phd' }),
      education: [edu({ level: 'diploma' })],
      availableFamilyIds: [],
    });
    expect(result.status).toBe('needs_review');
    expect(result.reasons[0]).toContain('نیازمند بررسی');
  });
});

describe('multi-target subject union', () => {
  it('shared subject deduped once with per-target weights preserved (unknown stays null)', () => {
    const intents = [
      intent({ id: 'i.1', targetLevel: 'master' }),
      intent({ id: 'i.2', targetLevel: 'phd', archived: true }),
    ];
    const weights = new Map([
      ['i.1', [{ subjectId: 'sub.stats', weight: 3 }, { subjectId: 'sub.rbv', weight: null }]],
      ['i.2', [{ subjectId: 'sub.stats', weight: 2 }]],
    ]);
    const union = unionTargetSubjects(intents, weights);
    const stats = union.find((u) => u.subjectId === 'sub.stats')!;
    expect(stats.perTarget).toEqual([{ intentId: 'i.1', weight: 3 }]); // آرشیو حذف شد
    expect(stats.unionWeightKnown).toBe(true);
    const rbv = union.find((u) => u.subjectId === 'sub.rbv')!;
    expect(rbv.unionWeightKnown).toBe(false); // unknown ≠ صفر
  });
});

describe('V3-033 legacy migration (proposal-only per HR-04)', () => {
  it('arshad -> master, phd -> phd; unmapped fields stay unknown; output is a proposal', () => {
    const proposal = proposeLegacyMigration({ legacyTrack: 'arshad', userId: 'user-9', subGroupId: '1142' });
    expect(proposal.proposedEducation.level).toBe('master');
    expect(proposal.proposedIntent.targetLevel).toBe('master');
    expect(proposal.confidence).toBe('deterministic');
    expect(proposal.proposedEducation.status).toBe('unknown');
    expect(proposal.proposedEducation.endYear).toBeNull();
    expect(proposal.note).toContain('HR-04');
    const phd = proposeLegacyMigration({ legacyTrack: 'phd', userId: 'user-8' });
    expect(phd.proposedIntent.targetLevel).toBe('phd');
    expect(phd.proposedIntent.intentKind).toBe('study_plan'); // ثبت‌نام واقعی ≠ قصد
  });

  it('migrated records pass education validation (no destructive data)', () => {
    const proposal = proposeLegacyMigration({ legacyTrack: 'arshad', userId: 'user-9' });
    expect(validateEducationRecords([proposal.proposedEducation])).toEqual([]);
  });
});
