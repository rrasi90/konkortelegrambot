/**
 * AEL-313 — Stage 7: Pairing پاسخ‌نامه با دفترچه — قواعد چندشواهدی سند §6 Stage 7.
 * نام فایل هرگز Pair را تأیید نمی‌کند؛ هر مغایرت صریح سال/مجموعه/دفترچه = Blocker.
 * Score فقط اولویت‌بندی است، نه احتمال آماری (§10.6).
 */
import { normalizePersian } from '../normalize.mjs';

export function pairPapersAndKeys(papers, keys) {
  const pairs = [];
  for (const key of keys) {
    const candidates = [];
    for (const paper of papers) {
      const evidence = [];
      let score = 0;
      let blockers = 0;
      // ۱) سال آزمون یکسان
      const keyYear = key.metadata?.exam_year?.value ?? null;
      const paperYear = paper.metadata?.exam_year?.value ?? null;
      if (keyYear !== null && paperYear !== null) {
        if (keyYear === paperYear) { score += 0.4; evidence.push({ rule: 'year_match', value: keyYear }); }
        else { blockers += 1; evidence.push({ rule: 'year_mismatch', key: keyYear, paper: paperYear }); }
      }
      // ۲) مقطع/خانواده یکسان (در صورت تشخیص هر دو)
      if (key.metadata?.exam_level && paper.metadata?.exam_level) {
        if (key.metadata.exam_level === paper.metadata.exam_level) { score += 0.2; evidence.push({ rule: 'level_match' }); }
        else { blockers += 1; evidence.push({ rule: 'level_mismatch' }); }
      }
      // ۳) مقطع/خانواده در سربرگ هر دو (کلید/ارشد/دکتری)
      const keyFront = normalizePersian(key.frontText ?? '');
      const paperFront = normalizePersian(paper.frontText ?? '');
      if (keyFront && paperFront) {
        if (/ارشد/.test(keyFront) && /ارشد/.test(paperFront)) { score += 0.25; evidence.push({ rule: 'level_word_match', term: 'ارشد' }); }
        else if (/دکتری/.test(keyFront) && /دکتری/.test(paperFront)) { score += 0.25; evidence.push({ rule: 'level_word_match', term: 'دکتری' }); }
        if (/سازمان سنجش|سنچش/.test(keyFront) && /سازمان سنجش|سنچش/.test(paperFront)) { score += 0.2; evidence.push({ rule: 'organizer_match' }); }
      }
      // ۴) نام فایل — نشانهٔ کمکی فقط در نبود Blocker (سند: به‌تنهایی هرگز کافی نیست)
      if (blockers === 0) {
        const keyBase = normalizePersian(key.basename ?? '');
        const paperBase = normalizePersian(paper.basename ?? '');
        const yearsInName = [keyYear, paperYear].filter(Boolean);
        if (yearsInName.length && yearsInName.every(year => keyBase.includes(String(year)) === paperBase.includes(String(year)))) {
          score += 0.05; evidence.push({ rule: 'filename_hint_consistent' });
        }
      }
      if (blockers === 0 && score > 0) {
        candidates.push({ paper: paper.registry.source_id, score: Number(score.toFixed(2)), evidence });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0];
    let pairingStatus = 'unresolved';
    let pairedDocumentId = null;
    if (top) {
      // §10.6: ≥0.90 قوی (کاندید)، 0.70-0.89 نیازمند بازبینی، <0.70 unresolved؛ چندنامزدی = عدم Pair خودکار
      const second = candidates[1];
      if (top.score >= 0.7 && (!second || second.score < top.score - 0.15)) {
        pairingStatus = top.score >= 0.9 ? 'candidate' : 'needs_review';
        pairedDocumentId = top.paper;
      }
    }
    pairs.push({
      key: key.registry.source_id,
      paired_document_id: pairedDocumentId,
      pairing_status: pairingStatus,
      pair_candidates: candidates.slice(0, 3),
      evidence: top?.evidence ?? [],
    });
  }
  return pairs;
}
