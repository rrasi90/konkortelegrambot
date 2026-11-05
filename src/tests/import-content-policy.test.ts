import { describe, expect, it } from 'vitest';
import {
  assertDirectWriteAllowed,
  deriveExamPackRightsStatus,
  deriveExamPackStatus,
  deriveQuestionVerificationStatus,
} from '../import/import-policy.mjs';

describe('AEL-004 — سیاست وضعیت‌گذاری درون‌ریزی (بدون حدس از غیبت)', () => {
  it('AEL-004.1: غیبت synthetic هرگز verified نمی‌دهد — pending_review است', () => {
    expect(deriveQuestionVerificationStatus(undefined)).toBe('pending_review');
    expect(deriveQuestionVerificationStatus({})).toBe('pending_review');
    expect(deriveQuestionVerificationStatus({ synthetic: false })).toBe('pending_review');
    expect(deriveQuestionVerificationStatus({ synthetic: 'no' })).toBe('pending_review');
  });

  it('synthetic صریح → demo', () => {
    expect(deriveQuestionVerificationStatus({ synthetic: true })).toBe('demo');
  });

  it('AEL-004.2: وضعیت بسته هرگز published نیست — draft/demo فقط', () => {
    expect(deriveExamPackStatus(undefined)).toBe('draft');
    expect(deriveExamPackStatus({})).toBe('draft');
    expect(deriveExamPackStatus({ synthetic: true })).toBe('demo');
    expect(deriveExamPackStatus({ published: true })).toBe('draft'); // هیچ ورودی انتشار نمی‌دهد
  });

  it('AEL-004.3: وضعیت حقوق بسته همیشه pending_review است', () => {
    expect(deriveExamPackRightsStatus(undefined)).toBe('pending_review');
    expect(deriveExamPackRightsStatus({ authorized: true })).toBe('pending_review');
  });

  it('AEL-004.4: نوشتن مستقیم فقط با --write و هرگز روی production', () => {
    expect(() => assertDirectWriteAllowed({ writeFlag: false, environment: undefined })).toThrow(/dry-run/);
    expect(() => assertDirectWriteAllowed({ writeFlag: true, environment: 'production' })).toThrow(/production/);
    expect(assertDirectWriteAllowed({ writeFlag: true, environment: 'development' })).toBe(true);
    expect(assertDirectWriteAllowed({ writeFlag: true, environment: undefined })).toBe(true);
  });
});
