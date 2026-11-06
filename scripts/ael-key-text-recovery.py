# -*- coding: utf-8 -*-
"""
AEL — Answer-key text-layer recovery (Phase 3 of AEL-HISTORICAL-EXAM-RECOVERY-002).

Reads the ORIGINAL local PDFs (verified byte-identical to the ingestion registry),
extracts the embedded text layer with pypdf layout mode, and parses the key tables
as (question_number, correct_option) column pairs. No OCR, no guessing: only the
PDF's own embedded text is used.

Outputs (local-only staging, never committed as content):
  .ael-work/exam-recovery/text-layer/<key>.jsonl   recovered entries + provenance
  .ael-work/exam-recovery/text-layer/_summary.json recovery/validation stats

Cross-validation: every overlapping (question_number) between the text-layer and
the existing MinerU OCR entry sets is compared; disagreements are recorded, never
auto-resolved. Gap-filling only: recovered entries whose question_number has no
OCR entry are candidates for the repair pass.

Usage: python -I scripts/ael-key-text-recovery.py [--pdf-dir <dir>]
"""
import argparse
import hashlib
import io
import json
import os
import re
import sys
import unicodedata

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

try:
    from pypdf import PdfReader
except ImportError:
    print('pypdf is required: pip install pypdf', file=sys.stderr)
    raise SystemExit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PDF_DIR = os.path.join(
    os.path.expanduser('~'), 'Downloads', 'Compressed', 'Arshad_modiriat_keycafetadris.com_')
RUN_DIR = os.path.join(ROOT, '.ael-work', 'exam-analysis', 'runs', 'structural-20261106f')
OUT_DIR = os.path.join(ROOT, '.ael-work', 'exam-recovery', 'text-layer')

AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

KEY_PDFS = [
    'جواب 1390.pdf', 'جواب 1391.pdf', 'جواب 1392.pdf', 'جواب 1393.pdf',
    'جواب 1394.pdf', 'جواب 1395.pdf', 'جواب 1396.pdf', 'جواب 1397.pdf',
    'جواب 1398.pdf', 'جواب 1399.pdf', 'جواب 1400.pdf', 'جواب1401.pdf',
    'جواب 1402.pdf', 'جواب 1403.pdf', 'جواب 1404.pdf', 'جواب 1405.pdf',
]

# registry basename -> source_id mapping comes from the ingestion registry
def load_registry():
    p = os.path.join(ROOT, '.ael-work', 'pdf-ingestion', 'registry', 'registry.json')
    reg = json.load(open(p, encoding='utf-8'))['sources']
    return {r['basename']: r for r in reg.values()}


def fold(text):
    """NFKC folds Arabic presentation forms; bidi marks stripped; Arabic digits → Latin."""
    t = unicodedata.normalize('NFKC', text)
    t = re.sub(r'[\u200e\u200f\u202a-\u202e\u2066-\u2069]', '', t)
    t = t.replace('\u064a', '\u06cc').replace('\u0643', '\u06a9')
    t = ''.join(str(AR_DIGITS.index(c)) if c in AR_DIGITS else c for c in t)
    return t


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def parse_pair_line(tokens):
    """Walk a token list as (num 1..400, opt 1..4) pairs; skip stray tokens."""
    pairs = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok.isdigit() and 1 <= int(tok) <= 400 and i + 1 < len(tokens):
            nxt = tokens[i + 1]
            if nxt.isdigit() and 1 <= int(nxt) <= 4 and len(nxt) == 1:
                pairs.append((int(tok), int(nxt)))
                i += 2
                continue
        i += 1
    return pairs


def parse_layout_pages(text):
    """Layout text: rows of N column-pairs separated by wide gaps.
    Trailing dangling numbers (option column cut by layout width) are skipped
    by the pair walk, not treated as answers. Up to two trailing non-numeric
    tokens (page furniture, e.g. the reversed word 'صفحه') are tolerated."""
    pairs = []
    for line in text.split('\n'):
        toks = line.split()
        if len(toks) < 2:
            continue
        # tolerate trailing page-furniture tokens
        stripped = list(toks)
        dropped = 0
        while stripped and not stripped[-1].isdigit() and dropped < 2:
            stripped.pop()
            dropped += 1
        if len(stripped) < 2 or not all(t.isdigit() for t in stripped):
            continue
        pairs.extend(parse_pair_line(stripped))
    return pairs


def parse_plain_pages(text):
    """Plain-mode fallback (e.g. 1400): whitespace-separated numeric stream."""
    pairs = []
    toks = re.findall(r'\d{1,3}', text)
    i = 0
    while i < len(toks) - 1:
        n, a = int(toks[i]), int(toks[i + 1])
        if 1 <= n <= 400 and 1 <= a <= 4:
            pairs.append((n, a))
            i += 2
        else:
            i += 1
    return pairs


def extract_key(pdf_path):
    reader = PdfReader(pdf_path)
    pairs = []
    modes = []
    for pi, page in enumerate(reader.pages):
        lay = fold(page.extract_text(extraction_mode='layout') or '')
        got = parse_layout_pages(lay)
        if got:
            modes.append({'page': pi + 1, 'mode': 'layout', 'pairs': len(got)})
            pairs.extend(got)
            continue
        plain = fold(page.extract_text() or '')
        got = parse_plain_pages(plain)
        if got:
            modes.append({'page': pi + 1, 'mode': 'plain', 'pairs': len(got)})
            pairs.extend(got)
        else:
            modes.append({'page': pi + 1, 'mode': 'none', 'pairs': 0})
    return pairs, modes, len(reader.pages)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf-dir', default=DEFAULT_PDF_DIR)
    args = ap.parse_args()

    registry = load_registry()
    os.makedirs(OUT_DIR, exist_ok=True)

    summary = {'pdf_dir': args.pdf_dir, 'keys': []}
    for basename in KEY_PDFS:
        reg = registry.get(basename)
        out = {'basename': basename, 'source_id': reg['source_id'] if reg else None,
               'registry_sha256': reg['sha256'] if reg else None}
        pdf_path = os.path.join(args.pdf_dir, basename)
        if not os.path.exists(pdf_path):
            out['status'] = 'pdf_not_found'
            summary['keys'].append(out)
            continue
        pdf_hash = sha256_file(pdf_path)
        out['pdf_sha256'] = pdf_hash
        if reg and pdf_hash != reg['sha256']:
            out['status'] = 'hash_mismatch_vs_registry'
            summary['keys'].append(out)
            continue
        pairs, modes, pages = extract_key(pdf_path)
        # dedupe by number (last wins), record conflicts
        by_num = {}
        conflicts = []
        for n, a in pairs:
            if n in by_num and by_num[n] != a:
                conflicts.append({'question_number': n, 'first': by_num[n], 'second': a})
            else:
                by_num[n] = a
        entries = [{'question_number': n, 'correct_option': a} for n, a in sorted(by_num.items())]
        out.update({
            'status': 'extracted',
            'pages': pages,
            'modes': modes,
            'entries': entries,
            'conflicts': conflicts[:20],
        })
        # cross-validate against the current OCR run
        ocr_path = os.path.join(RUN_DIR, f'key-{reg["source_id"]}.jsonl') if reg else None
        if ocr_path and os.path.exists(ocr_path):
            ocr = {r['question_number']: r['correct_option']
                   for r in (json.loads(l) for l in open(ocr_path, encoding='utf-8'))}
            overlap = agree = disagree = 0
            disagreements = []
            for e in entries:
                if e['question_number'] in ocr:
                    overlap += 1
                    if ocr[e['question_number']] == e['correct_option']:
                        agree += 1
                    else:
                        disagree += 1
                        disagreements.append({
                            'question_number': e['question_number'],
                            'ocr': ocr[e['question_number']],
                            'text_layer': e['correct_option'],
                        })
            ocr_only = sorted(set(ocr) - {e['question_number'] for e in entries})
            recovered = [e for e in entries if e['question_number'] not in ocr]
            out['validation'] = {
                'ocr_entries': len(ocr),
                'text_layer_entries': len(entries),
                'overlap': overlap,
                'agree': agree,
                'disagree': disagree,
                'disagreements': disagreements[:30],
                'ocr_only_numbers': ocr_only[:40],
                'recovered_gap_count': len(recovered),
            }
            out['recovered_entries'] = recovered
        summary['keys'].append(out)
        # per-key dump (local-only)
        dump = {k: v for k, v in out.items()}
        with open(os.path.join(OUT_DIR, f'{reg["source_id"] if reg else basename}.json'), 'w', encoding='utf-8') as f:
            json.dump(dump, f, ensure_ascii=False, indent=1)

    with open(os.path.join(OUT_DIR, '_summary.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)

    # console summary (numbers only, no protected content)
    for k in summary['keys']:
        v = k.get('validation') or {}
        sys.stdout.write(
            f"{k['basename']}: {k.get('status')} tl={len(k.get('entries') or [])} "
            f"overlap={v.get('overlap')} agree={v.get('agree')} disagree={v.get('disagree')} "
            f"recovered={v.get('recovered_gap_count')}\n")


if __name__ == '__main__':
    main()
