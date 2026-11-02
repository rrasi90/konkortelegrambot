// Phase 2 contract tests for the standardized question bank.
// Validates docs/phase-2/QUESTION_BANK_SPECIFICATION.md rules against the
// generated files in content/questions/ (built by scripts/build-question-bank.mts).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type BankItem = {
  id: string;
  tier: string;
  examLevel: string;
  examYear: number;
  bookletCode: string | null;
  courseId: string | null;
  sourceReference: string;
  questionText: string;
  options: string[];
  correctOption: number;
  questionType: string;
  verificationStatus: string;
};
type Bank = {
  tier: string;
  counts: Record<string, number>;
  questions: BankItem[];
};

const base = resolve(process.cwd(), 'content/questions');
const loadBank = (tier: string): Bank =>
  JSON.parse(readFileSync(resolve(base, `bank-${tier}.json`), 'utf8')) as Bank;

const phd = loadBank('official_traced_phd');
const arshad = loadBank('official_traced_arshad');
const quarantine = loadBank('quarantine');
const all = [...phd.questions, ...arshad.questions, ...quarantine.questions];

describe('قرارداد بانک سؤالات (Phase 2)', () => {
  it('هر سه لایه تولید شده و خالی نیستند', () => {
    expect(phd.questions.length).toBeGreaterThan(0);
    expect(arshad.questions.length).toBeGreaterThan(0);
    expect(quarantine.questions.length).toBeGreaterThan(0);
  });

  it('شناسه‌ها در سراسر بانک یکتا هستند', () => {
    const ids = all.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('تعارض محتوایی برای شناسه‌های تکراری وجود نداشته و تکراری‌ها ثبت شده‌اند', () => {
    expect(arshad.counts.contentConflicts).toBe(0);
    expect(arshad.counts.mergedDuplicates).toBeGreaterThan(0);
    expect(arshad.counts.rawInput).toBeGreaterThan(arshad.counts.total);
  });

  it('لایه‌ها سخت جدا هستند: ارشد در دکتری نیست و دکتری در ارشد نیست', () => {
    expect(phd.questions.every((q) => q.examLevel === 'دکتری')).toBe(true);
    expect(arshad.questions.every((q) => q.examLevel === 'ارشد')).toBe(true);
    expect(quarantine.questions.every((q) => q.verificationStatus === 'quarantined')).toBe(true);
  });

  it('سؤال ساختگی/placeholder در بانک رسمی نیست', () => {
    const placeholderIds = ['phd-1405-001', 'phd-1405-002', 'phd-1405-003'];
    for (const id of placeholderIds) {
      expect(all.some((q) => q.id === id)).toBe(false);
    }
    expect(all.every((q) => !q.questionText.includes('placeholder'))).toBe(true);
  });

  it('هر آیتم traced ارجاع منبع کامل، حداقل ۲ گزینه و پاسخ صحیح در بازه دارد', () => {
    for (const q of [...phd.questions, ...arshad.questions]) {
      expect(q.sourceReference.length, q.id).toBeGreaterThan(10);
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.correctOption, q.id).toBeGreaterThanOrEqual(0);
      expect(q.correctOption, q.id).toBeLessThan(q.options.length);
      expect(q.questionText.length, q.id).toBeGreaterThan(5);
    }
  });

  it('آیتم دکتری هرگز کد دفترچهٔ ارشد نمی‌گیرد (مگر از sourceReference خود سؤال)', () => {
    const arshadCodes = new Set(
      arshad.questions.map((q) => q.bookletCode).filter((c): c is string => !!c)
    );
    for (const q of phd.questions) {
      if (q.bookletCode !== null) {
        expect(q.sourceReference, q.id).toContain(q.bookletCode);
      }
      // کد استخراج‌نشده از ارجاع خود آیتم نباید باشد؛ دکتری‌های بی‌ارجاع کد باید null بمانند
      if (!q.sourceReference.includes('کد')) expect(q.bookletCode, q.id).toBeNull();
    }
    expect(arshadCodes.size).toBeGreaterThan(0);
  });

  it('نوع سؤال با لایه هم‌خوان است', () => {
    expect(quarantine.questions.every((q) => q.questionType === 'quarantined_unverified')).toBe(true);
    expect(phd.questions.every((q) => q.questionType === 'official_traced')).toBe(true);
    expect(arshad.questions.every((q) => q.questionType === 'official_traced')).toBe(true);
  });

  it('وضعیت تأیید دکتری صادقانه «منتظر بازبینی کلید» است، نه رسمی', () => {
    expect(phd.questions.every((q) => q.verificationStatus === 'transcribed_pending_key_review')).toBe(true);
    expect(phd.questions.some((q) => q.verificationStatus === 'official_key_cited_in_reference')).toBe(false);
  });

  it('هیچ پارامتر روان‌سنجی فرضی ثبت نشده (difficulty/cognitiveLevel هنوز unclassified)', () => {
    expect(all.every((q) => q.verificationStatus !== 'official_verified')).toBe(true);
    const raw = readFileSync(resolve(base, 'bank-official_traced_arshad.json'), 'utf8');
    expect(raw).toContain('"difficulty": "unclassified"');
    expect(raw).toContain('"cognitiveLevel": "unclassified"');
  });

  it('تعداد هر فایل با total خودش و جمع سه فایل با corpusTotal برابر است', () => {
    expect(phd.counts.total).toBe(phd.questions.length);
    expect(arshad.counts.total).toBe(arshad.questions.length);
    expect(quarantine.counts.total).toBe(quarantine.questions.length);
    expect(phd.counts.official_traced_phd).toBe(phd.questions.length);
    expect(arshad.counts.official_traced_arshad).toBe(arshad.questions.length);
    expect(quarantine.counts.quarantine).toBe(quarantine.questions.length);
    expect(phd.counts.corpusTotal).toBe(arshad.counts.corpusTotal);
    expect(phd.counts.corpusTotal).toBe(quarantine.counts.corpusTotal);
    expect(all.length).toBe(phd.counts.corpusTotal);
  });
});
