# -*- coding: utf-8 -*-
"""
AEL — Merge recovered text-layer key entries with OCR entries (provenance-preserving).

Union rule (never fabricate, never overwrite silently):
  - entry exists in both and agrees  -> provenance: ocr+text_layer_agree
  - entry exists only in OCR         -> provenance: ocr
  - entry exists only in text layer  -> provenance: text_layer (gap fill)
  - entry exists in both, differs    -> recorded as conflict; OCR value kept, text_layer
                                        value attached as `disputed_option`; flagged SME review

Outputs (local-only): .ael-work/exam-recovery/merged-keys/<source_id>.jsonl
Console/table output is counts only — no protected content.

Usage: python -I scripts/ael-key-merge-recovered.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUN_DIR = os.path.join(ROOT, '.ael-work', 'exam-analysis', 'runs', 'structural-20261106f')
TL_DIR = os.path.join(ROOT, '.ael-work', 'exam-recovery', 'text-layer')
OUT_DIR = os.path.join(ROOT, '.ael-work', 'exam-recovery', 'merged-keys')

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    rows_out = []
    for tl_path in sorted(os.listdir(TL_DIR)):
        if not tl_path.endswith('.json') or tl_path.startswith('_'):
            continue
        tl = json.load(open(os.path.join(TL_DIR, tl_path), encoding='utf-8'))
        sid = tl.get('source_id')
        if not sid or tl.get('status') != 'extracted':
            continue
        ocr_path = os.path.join(RUN_DIR, f'key-{sid}.jsonl')
        ocr = {}
        if os.path.exists(ocr_path):
            for line in open(ocr_path, encoding='utf-8'):
                r = json.loads(line)
                ocr[r['question_number']] = r['correct_option']
        tl_map = {e['question_number']: e['correct_option'] for e in tl.get('entries') or []}
        # TL trust gate: a broken embedded font yields nonsense digits (e.g. 1400).
        # If the overlap disagreement rate exceeds 20%, the text layer is unusable.
        v = tl.get('validation') or {}
        overlap, disagree = v.get('overlap') or 0, v.get('disagree') or 0
        tl_usable = bool(tl_map) and (overlap == 0 or disagree / overlap <= 0.2)
        tl_max = max(tl_map) if tl_map else 0
        stats = {'agree': 0, 'ocr_only': 0, 'tl_only': 0, 'disputed': 0, 'suspect_ocr_only': 0}
        merged = []
        for n in sorted(set(ocr) | (set(tl_map) if tl_usable else set())):
            o, t = ocr.get(n), tl_map.get(n) if tl_usable else None
            if o is not None and t is not None:
                if o == t:
                    stats['agree'] += 1
                    merged.append({'question_number': n, 'correct_option': o, 'provenance': 'ocr+text_layer_agree'})
                else:
                    stats['disputed'] += 1
                    merged.append({'question_number': n, 'correct_option': o,
                                   'provenance': 'ocr', 'disputed_option_text_layer': t, 'review': 'sme_required'})
            elif o is not None:
                if tl_usable and n > tl_max:
                    # OCR number beyond the text layer's full span: misread suspect
                    stats['suspect_ocr_only'] += 1
                    merged.append({'question_number': n, 'correct_option': o,
                                   'provenance': 'ocr', 'review': 'out_of_range_suspect'})
                else:
                    stats['ocr_only'] += 1
                    merged.append({'question_number': n, 'correct_option': o, 'provenance': 'ocr'})
            else:
                stats['tl_only'] += 1
                merged.append({'question_number': n, 'correct_option': t, 'provenance': 'text_layer_gap_fill'})
        with open(os.path.join(OUT_DIR, f'{sid}.jsonl'), 'w', encoding='utf-8') as f:
            for m in merged:
                f.write(json.dumps(m, ensure_ascii=False) + '\n')
        max_n = merged[-1]['question_number'] if merged else None
        holes = [n for n in range(1, (max_n or 0) + 1) if all(m['question_number'] != n for m in merged)]
        rows_out.append({
            'source_id': sid, 'basename': tl.get('basename'),
            'merged': len(merged), 'max_question': max_n,
            'holes_in_span': len(holes),
            'hole_ranges': _ranges(holes),
            **stats,
        })
    with open(os.path.join(OUT_DIR, '_merge_summary.json'), 'w', encoding='utf-8') as f:
        json.dump(rows_out, f, ensure_ascii=False, indent=1)
    for r in rows_out:
        sys.stdout.write(
            f"{r['basename']}: merged={r['merged']} span={r['max_question']} "
            f"holes={r['holes_in_span']} {r['hole_ranges']} "
            f"agree={r['agree']} ocr_only={r['ocr_only']} tl_only={r['tl_only']} disputed={r['disputed']}\n")


def _ranges(nums):
    if not nums:
        return []
    out = []
    start = prev = nums[0]
    for n in nums[1:]:
        if n == prev + 1:
            prev = n
        else:
            out.append({'from': start, 'to': prev})
            start = prev = n
    out.append({'from': start, 'to': prev})
    return out


if __name__ == '__main__':
    main()
