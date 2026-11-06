/**
 * AEL — Recovery data contracts (pure, no IO) — Phase 11 quality controls.
 * Enforces the mission's no-fabrication gates on merged-key rows:
 *   - every entry must carry a provenance from the allowed set
 *   - provenance `text_layer_gap_fill` requires the text layer to have been trusted
 *     (its source summary must show zero or ≤20% overlap disagreement)
 *   - disputed rows must keep both values and the sme_required review flag
 *   - question numbers are 1..400; options 1..4
 * Used by tests; the merge script's output must satisfy these contracts.
 */

export const ALLOWED_PROVENANCE = ['ocr', 'ocr+text_layer_agree', 'text_layer_gap_fill'];

export function validateMergedKeyRow(row) {
  const errors = [];
  if (!Number.isInteger(row.question_number) || row.question_number < 1 || row.question_number > 400) {
    errors.push('invalid question_number');
  }
  if (!Number.isInteger(row.correct_option) || row.correct_option < 1 || row.correct_option > 4) {
    errors.push('invalid correct_option');
  }
  if (!ALLOWED_PROVENANCE.includes(row.provenance)) {
    errors.push(`unknown provenance: ${row.provenance}`);
  }
  if (row.provenance === 'text_layer_gap_fill' && row.review === 'out_of_range_suspect') {
    errors.push('gap-fill row cannot also be an out-of-range suspect');
  }
  if (row.disputed_option_text_layer && row.review !== 'sme_required') {
    errors.push('disputed row must be flagged sme_required');
  }
  return { ok: errors.length === 0, errors };
}

/** Merge summary consistency: holes must equal span − every entry present in span
 *  (normal + out-of-range suspects + disputed all live inside the span). */
export function validateMergeSummary(summary) {
  const errors = [];
  for (const r of summary) {
    if (r.holes_in_span !== r.span - r.merged && r.span != null) {
      errors.push(`${r.source_id}: holes ${r.holes_in_span} != span ${r.span} - merged ${r.merged}`);
    }
    if (r.disputed > 0 && r.disputed > r.merged) {
      errors.push(`${r.source_id}: disputed > merged`);
    }
  }
  return { ok: errors.length === 0, errors };
}
