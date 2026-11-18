#!/usr/bin/env python3
"""First-pass question-block parser over tesseract.js OCR output (best model, 300 DPI).

Markers in these booklets start the line: «۵- متن ...» (sometimes the dash is
lost). Candidate lines are collected, then a longest increasing subsequence
over (scan position, question number) recovers the 1..N marker chain among
option numbers and noise. Blocks between accepted markers are written with
needsVisualReview=true; nothing is repaired or inferred.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FA = "۰۱۲۳۴۵۶۷۸۹"
AR = "٠١٢٣٤٥٦٧٨٩"
TR = str.maketrans(FA + AR, "0123456789" * 2)
MARK_HEAD = re.compile(r"^(\d{1,3})\s*[-–—]")
MARK_END = re.compile(r"(?:^|[^\d])(\d{1,3})\s*[-–—]\s*$")


def collect(pages, max_q):
    cands = []
    for pg in pages:
        for L in pg["lines"]:
            t = L["text"].translate(TR).strip()
            if not t:
                continue
            n = None
            m = MARK_HEAD.match(t) or MARK_END.search(t)
            if m:
                n = int(m.group(1))
            if n is not None and 1 <= n <= max_q:
                cands.append({"page": pg["page"], "y": L["y"], "x": L["x"],
                              "n": n, "text": t[:80]})
    cands.sort(key=lambda c: (c["page"], c["y"], c["x"]))
    return cands


def lis_chain(cands):
    n = len(cands)
    if n == 0:
        return []
    best = [1] * n
    back = [-1] * n
    for i in range(n):
        for j in range(i):
            if cands[j]["n"] < cands[i]["n"] and best[j] + 1 > best[i]:
                best[i] = best[j] + 1
                back[i] = j
    end = max(range(n), key=lambda i: best[i])
    chain = []
    while end != -1:
        chain.append(cands[end])
        end = back[end]
    chain.reverse()
    return chain


def main():
    src = Path(sys.argv[1])
    max_q = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    pages = json.loads(src.read_text(encoding="utf-8"))
    cands = collect(pages, max_q)
    chain = lis_chain(cands)
    missing = [n for n in range(1, max_q + 1)
               if not any(c["n"] == n for c in chain)]
    print(f"candidates: {len(cands)}; chain: {len(chain)}/{max_q}; missing: {missing[:15]}")

    all_lines = []
    for pg in pages:
        for L in pg["lines"]:
            all_lines.append({"text": L["text"], "x": L["x"], "y": L["y"], "page": pg["page"]})
    all_lines.sort(key=lambda L: (L["page"], L["y"], -L["x"]))

    blocks = []
    accepted = sorted(chain, key=lambda c: (c["page"], c["y"]))
    for idx, marker in enumerate(accepted):
        start = (marker["page"], marker["y"], marker["x"])
        end = ((accepted[idx + 1]["page"], accepted[idx + 1]["y"], accepted[idx + 1]["x"])
               if idx + 1 < len(accepted) else (10 ** 9, 10 ** 9, 0))
        lines = [L["text"].strip() for L in all_lines
                 if start <= (L["page"], L["y"], L["x"]) < end
                 and L["text"].strip() and "konkur" not in L["text"].lower()]
        blocks.append({"questionNumber": marker["n"],
                       "startPage": marker["page"],
                       "rawBlockText": "\n".join(lines),
                       "needsVisualReview": True,
                       "verificationStatus": "ocr_first_pass",
                       "parsingBasis": "LIS-fit of line-start question markers (tesseract.js fas-best 300dpi)"})
    out = src.parent / (src.stem + "-questions.json")
    out.write_text(json.dumps(blocks, ensure_ascii=False, indent=1), encoding="utf-8")
    report = {"source": src.name, "candidates": len(cands),
              "markersFitted": len(chain), "expected": max_q,
              "missing": missing,
              "completenessPct": round(100 * len(chain) / max_q, 1)}
    (src.parent / (src.stem + "-parse-report.json")).write_text(
        json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", out.name)
    for b in blocks[:2]:
        print("Q" + str(b["questionNumber"]), "::", b["rawBlockText"][:150].replace("\n", " | "))


if __name__ == "__main__":
    main()
