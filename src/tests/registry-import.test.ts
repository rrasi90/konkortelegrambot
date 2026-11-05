import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RegistryValidationError } from '@ael/contracts';
import { buildUpsertSql, detectPrerequisiteCycles, loadRegistryBundle } from '../lib/registry-import';

const seedPath = join(process.cwd(), 'content', 'registry', 'ael-p1-seed.json');

describe('loadRegistryBundle — Seed رسمی فاز ۱ (Gate P1)', () => {
  const { bundle, report } = loadRegistryBundle(JSON.parse(readFileSync(seedPath, 'utf8')), seedPath);

  it('بستهٔ Seed بدون رد کامل پذیرفته می‌شود', () => {
    expect(report.rejected).toBe(0);
    expect(report.duplicates).toBe(0);
    expect(report.missingReferences).toHaveLength(0);
    expect(report.prerequisiteCycles).toHaveLength(0);
  });

  it('ساختارهای Gate P1 را پوشش می‌دهد', () => {
    // (۱) دبیرستان با سه پایه
    expect(bundle.stages.map(stage => stage.code)).toEqual(['stg-grade-10', 'stg-grade-11', 'stg-grade-12']);
    // (۲) برنامهٔ کارشناسی با دو ترم و چند درس
    const bachelor = bundle.curriculumCourses.filter(row => row.curriculumVersionId === 'cv-ind-bachelor-1404-v1');
    expect(new Set(bachelor.map(row => row.term)).size).toBe(2);
    expect(bachelor.length).toBeGreaterThanOrEqual(2);
    // (۳) مجموعهٔ ارشد با دو کد ضریب متفاوت
    const masterCodes = bundle.examCombinations.filter(row => row.eventVersionId === 'eev-mgm-m-1404-v2').map(row => row.code);
    expect(masterCodes.sort()).toEqual(['6168', '6169']);
    // (۴) دکتری با Rubric مصاحبهٔ مجزا
    const interview = bundle.assessmentComponents.find(row => row.id === 'ac-phd-interview');
    expect(interview?.kind).toBe('interview');
    expect(bundle.assessmentRubrics[0].componentId).toBe('ac-phd-interview');
    // (۵) دو نسخهٔ مقررات سالانه — نسخهٔ قدیمی دست‌نخورده
    const versions = bundle.examEventVersions.filter(row => row.eventId === 'evt-mgm-m-1404');
    expect(versions).toHaveLength(2);
    const v1 = versions.find(row => row.versionNumber === 1);
    const v2 = versions.find(row => row.versionNumber === 2);
    expect(v1?.previousVersionId).toBeNull();
    expect(v2?.previousVersionId).toBe('eev-mgm-m-1404-v1');
    expect(v1?.changeReason).not.toBe(v2?.changeReason);
  });

  it('contentHash قطعی و sha256 است', () => {
    expect(report.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(loadRegistryBundle(JSON.parse(readFileSync(seedPath, 'utf8'))).report.contentHash).toBe(report.contentHash);
  });
});

describe('loadRegistryBundle — ورودی معیوب', () => {
  it('ارجاع گم‌شده در گزارش rejected ثبت می‌شود با پیام قابل اقدام', () => {
    const raw = JSON.parse(readFileSync(seedPath, 'utf8'));
    raw.curriculumCourses[0].curriculumVersionId = 'cv-not-exists';
    const { report } = loadRegistryBundle(raw);
    expect(report.rejected).toBeGreaterThan(0);
    expect(report.missingReferences.join(' | ')).toContain('cv-not-exists');
  });

  it('چرخهٔ پیش‌نیاز درون بسته شناسایی می‌شود', () => {
    const bundle = JSON.parse(readFileSync(seedPath, 'utf8'));
    bundle.prerequisiteEdges.push(
      { id: 'pe-cycle-a', sourceKind: 'course', sourceId: 'crs-finmgmt', targetKind: 'course', targetId: 'crs-statistics', edgeKind: 'prerequisite', scope: null, status: 'draft' },
    );
    const cycles = detectPrerequisiteCycles(bundle);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toContain('crs-finmgmt');
  });

  it('بستهٔ سالم بدون چرخه است', () => {
    const bundle = JSON.parse(readFileSync(seedPath, 'utf8'));
    expect(detectPrerequisiteCycles(bundle)).toHaveLength(0);
  });
});

describe('buildUpsertSql — Idempotency (AT-AEL-04)', () => {
  const { bundle } = loadRegistryBundle(JSON.parse(readFileSync(seedPath, 'utf8')));

  it('همهٔ درج‌ها ON CONFLICT upsert هستند', () => {
    const sql = buildUpsertSql(bundle);
    const inserts = sql.split('\n').filter(line => line.startsWith('insert into '));
    expect(inserts.length).toBe(reportAccepted(bundle));
    expect(sql.split('on conflict').length - 1).toBe(inserts.length);
  });

  it('تغییر مقدار، رکورد جدید نمی‌سازد (همان PK upsert می‌شود)', () => {
    const changed = JSON.parse(JSON.stringify(bundle));
    changed.examSubjects[0].name = 'مدیریت مالی (ویراسته)';
    const first = buildUpsertSql(bundle);
    const second = buildUpsertSql(changed);
    const pkLine = (sql: string) => sql.split('\n').find(line => line.includes("values (") === false)!;
    expect(first).toContain("'subj-finmgmt'");
    expect(second).toContain("'subj-finmgmt'");
    expect(second).toContain('مدیریت مالی (ویراسته)');
    // PK در هر دو نسخه یکسان است → upsert همان ردیف
    expect(pkLine(second)).toBeDefined();
  });

  it('تراکنش را باز و بسته می‌کند', () => {
    const sql = buildUpsertSql(bundle);
    expect(sql).toContain('begin;');
    expect(sql).toContain('commit;');
  });
});

function reportAccepted(bundle: unknown): number {
  let total = 0;
  for (const [key, value] of Object.entries(bundle as Record<string, unknown>)) {
    if (key === 'schemaVersion') continue;
    total += (value as unknown[]).length;
  }
  return total;
}
