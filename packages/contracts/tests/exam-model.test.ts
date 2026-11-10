import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  resolveCandidatePreparationPlan,
  validateCandidateExamRegistration,
  validateCandidateStudyPlan,
  validateExamModelBundle,
} from '../src/exam-model';
import type { CandidateExamRegistration, CandidateStudyPlan, ExamModelBundle } from '../src/exam-model';

const bundle = JSON.parse(readFileSync(
  new URL('../../../content/knowledge/exam-model.v1.json', import.meta.url), 'utf8',
)) as ExamModelBundle;

const masterEventVersion = 'event.master.1405.s1.v1';
const doctorateEventVersion = 'event.doctorate.1406.s1.v1';

describe('AEL comprehensive exam model', () => {
  it('validates the versioned 1142 and 2162 source data', () => {
    const result = validateExamModelBundle(bundle);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(bundle.examSets.find(s => s.id === 'set.master.1405.1142')?.examSetCode).toBe('1142');
    expect(bundle.examSets.find(s => s.id === 'set.doctorate.1406.2162')?.examSetCode).toBe('2162');
    expect(bundle.subjects.filter(s => s.id.startsWith('master.1142.'))).toHaveLength(16);
    expect(bundle.subjects.filter(s => s.id.startsWith('phd.2162.'))).toHaveLength(9);
    expect(bundle.combinations.map(c => c.combinationCode).sort()).toEqual(['1','2','3','4','5','6','7']);
  });

  it('keeps set code, combination code, target code and coefficient code in separate fields', () => {
    const target = bundle.targets.find(t => t.id === 'm1405.business.marketing')!;
    expect(bundle.examSets.find(s => s.id === target.examSetId)?.examSetCode).toBe('1142');
    expect(target.combinationCode).toBeNull();
    expect(target.coefficientCode).toBe('1');
    expect(bundle.targets.find(t => t.id === 'p1406.business')?.combinationCode).toBe('1');
    expect(bundle.targets.find(t => t.id === 'p1406.business')?.coefficientCode).toBeNull();
  });

  it('preserves exact official zeros and never treats an unknown coefficient as zero', () => {
    const target = bundle.targets.find(t => t.id === 'm1405.business.marketing')!;
    const assignment = bundle.coefficientAssignments.find(a => a.id === target.coefficientAssignmentId)!;
    expect(assignment.values.find(v => v.subjectId === 'master.1142.s6')).toMatchObject({ value:0,state:'official_zero' });
    expect(() => validateExamModelBundle({
      ...structuredClone(bundle),
      coefficientAssignments: bundle.coefficientAssignments.map(a => a.id === assignment.id
        ? { ...structuredClone(a), values:a.values.map(v=>v.subjectId==='master.1142.s6'?{...v,value:null,state:'unknown'}:v) }
        : structuredClone(a)),
    })).not.toThrow();
    const invalid = structuredClone(bundle);
    const row = invalid.coefficientAssignments.find(a=>a.id===assignment.id)!;
    row.values[0] = { ...row.values[0], value:0, state:'unknown' };
    const result = validateExamModelBundle(invalid);
    expect(result.errors.some(e=>e.code==='unknown_has_value')).toBe(true);
  });

  it('keeps the doctorate specialized coefficient at component scope, not repeated on each subject', () => {
    expect(bundle.componentCoefficients.find(c=>c.componentCode==='language')).toMatchObject({
      value:1,scope:'exam_component',subjectIds:['phd.2162.s1']
    });
    expect(bundle.componentCoefficients.find(c=>c.componentCode==='specialized')).toMatchObject({
      value:5,scope:'exam_component',subjectIds:bundle.subjects.filter(s=>s.id.startsWith('phd.2162.')&&s.subjectCode!=='1').map(s=>s.id)
    });
    expect(bundle.coefficientAssignments.filter(a=>a.eventVersionId===doctorateEventVersion)).toHaveLength(0);
  });

  it('enforces the documented two-set primary/floating master registration policy', () => {
    const registration: CandidateExamRegistration = {
      id:'reg.master.too-many',candidateId:'candidate.1',eventVersionId:masterEventVersion,
      selections:[
        {examSetId:'set.master.1405.1142',role:'primary',registrationReference:null},
        {examSetId:'set.master.1405.1142.other',role:'floating',registrationReference:null},
        {examSetId:'set.master.1405.1142.third',role:'additional',registrationReference:null},
      ],
      status:'draft',sourceRegistrationReference:null,createdAt:'2026-11-08T00:00:00Z'
    };
    const result = validateCandidateExamRegistration(registration,bundle);
    expect(result.errors.some(e=>e.code==='selection_limit_exceeded')).toBe(true);
  });

  it('allows multiple study targets without summing their coefficient vectors', () => {
    const plan: CandidateStudyPlan = {
      id:'plan.master.multi',candidateId:'candidate.1',eventVersionId:masterEventVersion,registrationId:null,
      targets:[
        {targetId:'m1405.business.marketing',priorityOrder:1,registrationSelectionId:null,note:null},
        {targetId:'m1405.public.public-policy',priorityOrder:2,registrationSelectionId:null,note:null}
      ],
      studyTrackIds:['business','public'],status:'active',versionNumber:1,
      createdAt:'2026-11-08T00:00:00Z',updatedAt:'2026-11-08T00:00:00Z'
    };
    expect(validateCandidateStudyPlan(plan,bundle).ok).toBe(true);
    const resolved=resolveCandidatePreparationPlan(plan,bundle);
    expect(resolved.resolutionStatus).toBe('resolved');
    const english=resolved.subjects.find(s=>s.subjectId==='master.1142.s1')!;
    expect(english.includedInTargetIds).toEqual(['m1405.business.marketing','m1405.public.public-policy']);
    expect(english.coefficientsByTarget.map(x=>x.value)).toEqual([3,3]);
    expect(english.coefficientsByTarget).toHaveLength(2);
    expect(resolved.subjects.find(s=>s.subjectId==='master.1142.s8')?.includedInTargetIds)
      .toEqual(['m1405.business.marketing','m1405.public.public-policy']);
  });

  it('resolves doctorate targets by official combinations and preserves component-level weighting', () => {
    const plan: CandidateStudyPlan = {
      id:'plan.phd.multi',candidateId:'candidate.2',eventVersionId:doctorateEventVersion,registrationId:null,
      targets:[
        {targetId:'p1406.business',priorityOrder:1,registrationSelectionId:null,note:null},
        {targetId:'p1406.foresight',priorityOrder:2,registrationSelectionId:null,note:null}
      ],
      studyTrackIds:['business','technology'],status:'active',versionNumber:1,
      createdAt:'2026-11-08T00:00:00Z',updatedAt:'2026-11-08T00:00:00Z'
    };
    const resolved=resolveCandidatePreparationPlan(plan,bundle);
    expect(resolved.resolutionStatus).toBe('resolved');
    expect(resolved.examSetIds).toEqual(['set.doctorate.1406.2162']);
    expect(resolved.subjects.map(s=>s.subjectNumber)).toEqual([1,2,3,7]);
    const specialized=resolved.subjects.find(s=>s.subjectId==='phd.2162.s7')!;
    // V3-Hardening B4: محور مقدار و شواهد جدا — دکتری بردار ضریب سطر ندارد
    // (کامپوننت‌محور است) → شواهد صریحاً pending_verification، نه ارتقای خاموش
    expect(specialized.coefficientsByTarget).toEqual([
      {targetId:'p1406.foresight',value:null,valueState:'unknown',evidence:'pending_verification',scope:null}
    ]);
    const specializationWeight=resolved.componentCoefficients.find(c=>
      c.targetId==='p1406.foresight'&&c.componentCode==='specialized'
    );
    expect(specializationWeight).toMatchObject({
      value:5,valueState:'positive',evidence:'official_verified',
      subjectIds:['phd.2162.s2','phd.2162.s7']
    });
    // ضریب کامپوننت‌سطح هرگز scope سابجکت را حمل نمی‌کند (ResolvedPreparationComponent بدون scope است)
    expect('scope' in specializationWeight!).toBe(false);
    expect(resolved.componentCoefficients.some(c=>
      c.targetId==='p1406.foresight'&&c.componentCode==='language'&&c.value===1
    )).toBe(true);
    expect(resolved.subjects.find(s=>s.subjectId==='phd.2162.s3')?.includedInTargetIds).toEqual(['p1406.business']);
    expect(resolved.subjects.find(s=>s.subjectId==='phd.2162.s2')?.includedInTargetIds).toEqual(['p1406.business','p1406.foresight']);
  });

  it('does not infer an official doctorate set-selection limit from missing evidence', () => {
    const policy=bundle.selectionPolicies.find(p=>p.eventVersionId===doctorateEventVersion)!;
    expect(policy.maxExamSetSelections).toBeNull();
    expect(policy.status).toBe('needs_check');
  });

  it('keeps admission-list entries distinct from confirmed admission offerings', () => {
    const target=bundle.targets.find(t=>t.id==='p1406.amad')!;
    expect(target.admissionStatus).toBe('restricted');
    expect(target.admissionRestriction).toContain('دانشگاه‌های نظامی');
    expect(target.admissionRestriction).toContain('پذیرش نهایی');
  });
});
