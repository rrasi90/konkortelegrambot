import { describe, expect, it } from 'vitest';
import {
  EMPTY_REGISTRY_BUNDLE,
  findDuplicateKeys,
  RegistryValidationError,
  validateRegistryBundle,
  type RegistryImportBundle,
} from '../src/registry';

describe('validateRegistryBundle — AEL-105', () => {
  it('بستهٔ خالی معتبر است', () => {
    expect(validateRegistryBundle(EMPTY_REGISTRY_BUNDLE)).toEqual({ ok: true });
  });

  it('ورودی غیرشیء رد می‌شود', () => {
    for (const bad of [null, 'x', 42, []]) {
      const result = validateRegistryBundle(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0].code).toBe('invalid_type');
    }
  });

  it('schemaVersion ناشناخته رد می‌شود', () => {
    const result = validateRegistryBundle({ ...EMPTY_REGISTRY_BUNDLE, schemaVersion: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe('unsupported_schema');
  });

  it('کد با نویسهٔ نامجاز رد می‌شود (شناسهٔ پایدار)', () => {
    const result = validateRegistryBundle({
      ...EMPTY_REGISTRY_BUNDLE,
      authorities: [{ code: 'bad code!', name: 'x', kind: 'government', status: 'active' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe('invalid_code');
  });

  it('وضعیت چرخهٔ عمر ناشناخته رد می‌شود', () => {
    const result = validateRegistryBundle({
      ...EMPTY_REGISTRY_BUNDLE,
      institutions: [{ code: 'inst-1', name: 'دانشگاه', kind: 'university', status: 'maybe' }],
    });
    expect(result.ok).toBe(false);
  });

  it('نسخهٔ بدون شمارهٔ صحیح رد می‌شود و unknown با zero یکی نیست', () => {
    const result = validateRegistryBundle({
      ...EMPTY_REGISTRY_BUNDLE,
      programVersions: [{
        id: 'pv-1', programCode: 'prog-1', versionNumber: 0, status: 'draft',
        effectiveFrom: null, effectiveUntil: null, contentHash: null,
        previousVersionId: null, changeReason: null, sourceIds: [], createdBy: null,
      }],
    });
    expect(result.ok).toBe(false);
  });

  it('یال خودارجاع پیش‌نیاز رد می‌شود', () => {
    const result = validateRegistryBundle({
      ...EMPTY_REGISTRY_BUNDLE,
      prerequisiteEdges: [{
        id: 'pe-1', sourceKind: 'course', sourceId: 'crs-a', targetKind: 'course', targetId: 'crs-a',
        edgeKind: 'prerequisite', scope: null, status: 'draft',
      }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some(error => error.code === 'self_edge')).toBe(true);
  });

  it('bloom خارج از ۱..۶ رد می‌شود', () => {
    const result = validateRegistryBundle({
      ...EMPTY_REGISTRY_BUNDLE,
      learningOutcomes: [{ id: 'lo-1', definitionCode: 'crs-1', statement: 'x', bloomLevel: 9, competencyCode: null, status: 'draft' }],
    });
    expect(result.ok).toBe(false);
  });
});

describe('findDuplicateKeys — idempotency (AT-AEL-04)', () => {
  it('کد تکراری در همان موجودیت خطاست', () => {
    const bundle = {
      ...EMPTY_REGISTRY_BUNDLE,
      examSubjects: [
        { code: 'subj-x', name: 'الف', status: 'active' },
        { code: 'subj-x', name: 'ب', status: 'active' },
      ],
    } as RegistryImportBundle;
    const errors = findDuplicateKeys(bundle);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('duplicate_key');
  });

  it('شناسهٔ یکسان در موجودیت‌های مختلف مشکلی ندارد', () => {
    const bundle = {
      ...EMPTY_REGISTRY_BUNDLE,
      examSubjects: [{ code: 'subj-x', name: 'الف', status: 'active' }],
      institutions: [{ code: 'subj-x', name: 'دانشگاه', kind: 'university', status: 'active' }],
    } as unknown as RegistryImportBundle;
    expect(findDuplicateKeys(bundle)).toHaveLength(0);
  });
});

describe('RegistryValidationError', () => {
  it('پیام اولین خطا را می‌دهد و errors را نگه می‌دارد', () => {
    const error = new RegistryValidationError([
      { entity: 'levels', index: 0, field: 'systemCode', code: 'invalid_code', message: 'نظام معتبر نیست.', severity: 'error' },
    ]);
    expect(error.errors).toHaveLength(1);
    expect(error.message).toContain('نظام معتبر نیست');
  });
});
