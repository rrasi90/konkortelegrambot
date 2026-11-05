/**
 * AEL-405/406 — تحلیل محتوا: تشخیص تکرار و اعتبارسنجی کلید پاسخ.
 * اصول (AEL-405): Exact/Normalized تکرار قطعی‌اند؛ شباهت معنایی فقط «پیشنهاد» است
 * و هیچ Merge بدون تأیید انسانی انجام نمی‌شود. Conflict دو منبع با Merge مخفی نمی‌شود.
 */

export interface DuplicateCandidateInput {
  id: string;
  prompt: string;
  variantGroup?: string;
}

export interface DuplicateGroup {
  kind: 'exact' | 'normalized' | 'near_candidate';
  ids: string[];
  /** شباهت ۰..۱ برای near_candidate؛ برای exact/normalized برابر ۱ */
  similarity: number;
}

function normalizePersian(text: string): string {
  return text
    .replace(/[\u200c\u200f\u200e]/g, ' ')   // نیم‌فاصله و علامت‌های جهت
    .replace(/[ىي]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[؟?!.،,؛:؛«»"'()\[\]{}\-—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function trigrams(text: string): Set<string> {
  const padded = `  ${text}  `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export interface DuplicateDetectionReport {
  exactGroups: DuplicateGroup[];
  nearCandidates: DuplicateGroup[];
  /** هیچ Merge خودکاری رخ نداده — فقط کاندید (AEL-405) */
  autoMergedCount: 0;
}

/**
 * تشخیص تکرار: (۱) exact روی متن خام، (۲) normalized فارسی،
 * (۳) near-candidate با شباهت تری‌گرام ≥ آستانه — فقط پیشنهاد.
 */
export function findDuplicateCandidates(
  questions: readonly DuplicateCandidateInput[],
  options: { nearThreshold?: number } = {},
): DuplicateDetectionReport {
  const nearThreshold = options.nearThreshold ?? 0.85;
  const exact = new Map<string, string[]>();
  const normalized = new Map<string, string[]>();
  const vectors: Array<{ id: string; grams: Set<string>; text: string }> = [];

  for (const question of questions) {
    if (!question.prompt?.trim()) continue;
    exact.set(question.prompt, [...(exact.get(question.prompt) ?? []), question.id]);
    const norm = normalizePersian(question.prompt);
    normalized.set(norm, [...(normalized.get(norm) ?? []), question.id]);
    vectors.push({ id: question.id, grams: trigrams(norm), text: norm });
  }

  const exactGroups: DuplicateGroup[] = [];
  for (const ids of exact.values()) if (ids.length > 1) exactGroups.push({ kind: 'exact', ids, similarity: 1 });

  const nearCandidates: DuplicateGroup[] = [];
  for (const ids of normalized.values()) {
    if (ids.length > 1 && !exactGroups.some(group => group.ids.join() === ids.join())) {
      nearCandidates.push({ kind: 'normalized', ids, similarity: 1 });
    }
  }
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const a = vectors[i]!, b = vectors[j]!;
      if (a.text === b.text) continue; // در normalized قبلاً آمده
      const similarity = jaccard(a.grams, b.grams);
      if (similarity >= nearThreshold) {
        const existing = nearCandidates.find(group =>
          group.ids.length === 2 && group.ids.includes(a.id) && group.ids.includes(b.id));
        if (!existing && !nearCandidates.some(group => group.ids.join() === [a.id, b.id].join())) {
          nearCandidates.push({ kind: 'near_candidate', ids: [a.id, b.id], similarity: Number(similarity.toFixed(3)) });
        }
      }
    }
  }
  return { exactGroups, nearCandidates, autoMergedCount: 0 };
}

export interface AnswerKeyValidationInput {
  id: string;
  choices: string[];
  answerIndex: number;
  /** کلید مستقل منبع (در صورت وجود) برای مقایسه — AEL-406 */
  sourceAnswerIndex?: number | null;
}

export interface AnswerKeyFinding {
  questionId: string;
  code: 'ANSWER_KEY_CONFLICT' | 'ANSWER_OUT_OF_RANGE' | 'DUPLICATE_CHOICES';
  detail: string;
}

/** اعتبارسنجی کلید — اختلاف Key/منبع قطعی ANSWER_KEY_CONFLICT می‌سازد (AEL-406). */
export function validateAnswerKeys(questions: readonly AnswerKeyValidationInput[]): AnswerKeyFinding[] {
  const findings: AnswerKeyFinding[] = [];
  for (const question of questions) {
    if (new Set(question.choices).size !== question.choices.length) {
      findings.push({ questionId: question.id, code: 'DUPLICATE_CHOICES', detail: 'گزینه‌های تکراری.' });
    }
    if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= question.choices.length) {
      findings.push({ questionId: question.id, code: 'ANSWER_OUT_OF_RANGE', detail: `answerIndex=${question.answerIndex} خارج از ${question.choices.length} گزینه.` });
      continue;
    }
    if (question.sourceAnswerIndex != null && question.sourceAnswerIndex !== question.answerIndex) {
      findings.push({
        questionId: question.id,
        code: 'ANSWER_KEY_CONFLICT',
        detail: `کلید ثبت‌شده (${question.answerIndex}) با کلید منبع (${question.sourceAnswerIndex}) متفاوت است — قرنطینه/بازبینی لازم.`,
      });
    }
  }
  return findings;
}
